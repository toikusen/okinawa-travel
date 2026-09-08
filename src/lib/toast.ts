// ponytail: module-level singleton, one Toast host mounted at the app root.
// Swap for a context provider only if a second, independently-scoped host appears.
type Push = (message: string) => void

let push: Push | null = null

export function registerToastHost(fn: Push | null): void {
  push = fn
}

export function toast(message: string): void {
  push?.(message)
}
