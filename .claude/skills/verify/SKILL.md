---
name: verify
description: Launch and drive the Tabi PWA (Vite + React Router + Supabase) for end-to-end verification in a real browser.
---

# Verify: Tabi (trip-planning PWA)

## Launch

```bash
npm run dev   # Vite, wants port 4200; check the output — if 4200 is taken it silently moves to 4201
```

**Port 4200 matters**: it is the localhost origin allowed in Supabase Auth redirect URLs. If another (stale) dev server holds 4200, OAuth and testing hit the WRONG build — `lsof -tiTCP:4200 -sTCP:LISTEN` and kill it first.

Requires `.env.local` (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — hits the LIVE Supabase project; there is no staging DB. Never delete or mutate the user's real trips; create a disposable test trip and clean it up.

## Login (Google OAuth only)

Google blocks OAuth inside automated Chrome ("browser may not be secure"). Workaround: user logs in with their normal browser at localhost:4200, then in that page's console runs
`copy(localStorage.getItem('sb-lyolbcmrqgxvrznudjsp-auth-token'))`
and pastes the JSON. Inject it into the automation browser with `localStorage.setItem('sb-lyolbcmrqgxvrznudjsp-auth-token', JSON.stringify(session))` on the localhost:4200 origin, then reload.

## Driving gotchas (chrome-devtools MCP)

- `fill` sets DOM values on `<input type="date">` but React onChange does NOT fire → state stays stale (buttons stay disabled). Use the native-setter trick via `evaluate_script`, and set a DIFFERENT value first (React's value tracker suppresses same-value events):
  ```js
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ''); el.dispatchEvent(new Event('input', {bubbles:true}));
  setter.call(el, '2026-09-01'); el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
  ```
- Settings saves fire on blur — call `el.focus(); el.blur()` after setting.
- 刪除旅程/退出旅程 use `window.confirm` → the click errors with an open-dialog notice; call `handle_dialog` (accept) then continue.
- Screenshots: MCP only writes inside workspace roots — use `.playwright-mcp/` under the repo.

## Flows worth driving

login → `/` trip list → `+ 新增旅程` (button enables only with name + valid dates) → lands on `/trips/:id` with day sections → add event via ＋ → `/trips/:id/settings`: rename (blur), extend end date (new day appears on timeline), shrink onto a day WITH events (must show 以下日期已有行程 and not persist), 複製邀請連結 (verify clipboard = `/join/:id`), owner sees 刪除旅程 / non-owner sees 退出旅程 → delete test trip → back at list. Probe: `/trips/<garbage-uuid>` must redirect to `/`.
