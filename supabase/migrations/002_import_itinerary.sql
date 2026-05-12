-- ============================================================
-- 沖繩旅遊行程匯入
-- ============================================================

DO $$
DECLARE
  v_trip_id UUID;
  d11 UUID; d12 UUID; d13 UUID; d14 UUID; d15 UUID;
BEGIN
  -- 找到旅程 ID
  SELECT t.id INTO v_trip_id
  FROM trips t
  JOIN trip_members tm ON t.id = tm.trip_id
  WHERE tm.user_email = 'tuyucheng0407@gmail.com'
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION '找不到旅程';
  END IF;

  -- 更新旅程名稱
  UPDATE trips SET name = '沖繩 2026' WHERE id = v_trip_id;

  -- 取得各天 ID
  SELECT id INTO d11 FROM days WHERE trip_id = v_trip_id AND date = '2026-06-11';
  SELECT id INTO d12 FROM days WHERE trip_id = v_trip_id AND date = '2026-06-12';
  SELECT id INTO d13 FROM days WHERE trip_id = v_trip_id AND date = '2026-06-13';
  SELECT id INTO d14 FROM days WHERE trip_id = v_trip_id AND date = '2026-06-14';
  SELECT id INTO d15 FROM days WHERE trip_id = v_trip_id AND date = '2026-06-15';

  -- 更新每天標籤
  UPDATE days SET label = '抵達日'            WHERE id = d11;
  UPDATE days SET label = '沖繩北部'          WHERE id = d12;
  UPDATE days SET label = '美國村+港川外人住宅' WHERE id = d13;
  UPDATE days SET label = '那霸市區日'        WHERE id = d14;
  UPDATE days SET label = '回程日'            WHERE id = d15;

  -- ───────────────────────────────────────────────
  -- 6/11 抵達日
  -- ───────────────────────────────────────────────
  INSERT INTO events (day_id, trip_id, type, title, time_start, time_end, location, notes, sort_order, fork_items) VALUES
    (d11, v_trip_id, 'shared', '台灣 → 沖繩', '18:30', '20:50', '那霸空港', '飛機', 0, NULL),
    (d11, v_trip_id, 'shared', '出關', '20:50', '22:00', '那霸空港', '', 1, NULL),
    (d11, v_trip_id, 'shared', '移動', '22:00', '23:00', '', '叫計程車', 2, NULL),
    (d11, v_trip_id, 'shared', '買宵夜回民宿休息', '22:00', '', '', '', 3, NULL);

  -- ───────────────────────────────────────────────
  -- 6/12 沖繩北部
  -- ───────────────────────────────────────────────
  INSERT INTO events (day_id, trip_id, type, title, time_start, time_end, location, notes, sort_order, fork_items) VALUES
    (d12, v_trip_id, 'shared', '租車', '09:00', '09:30', '美榮橋站前 外語櫃台', '', 0, NULL),
    (d12, v_trip_id, 'shared', '移動', '09:30', '12:00', '', '', 1, NULL),
    (d12, v_trip_id, 'shared', '美麗海水族館', '12:00', '15:00', '本部町', '午餐', 2, NULL),
    (d12, v_trip_id, 'shared', '移動', '15:00', '15:30', '', '', 3, NULL),
    (d12, v_trip_id, 'shared', '古宇利島', '15:30', '16:30', '今歸仁村', '', 4, NULL),
    (d12, v_trip_id, 'shared', '移動', '16:30', '17:00', '', '', 5, NULL),
    (d12, v_trip_id, 'shared', '萬座毛/殘波岬', '17:00', '18:30', '', '', 6, NULL),
    (d12, v_trip_id, 'shared', '移動', '18:30', '19:00', '', '', 7, NULL),
    (d12, v_trip_id, 'shared', '瀨長島看夕陽', '19:00', '', '瀨長島', '日落約 19:22', 8, NULL);

  -- ───────────────────────────────────────────────
  -- 6/13 美國村+港川外人住宅
  -- ───────────────────────────────────────────────
  INSERT INTO events (day_id, trip_id, type, title, time_start, time_end, location, notes, sort_order, fork_items) VALUES
    (d13, v_trip_id, 'shared', '出發前往美國村', '09:30', '10:00', '', '', 0, NULL),
    (d13, v_trip_id, 'shared', '美國村', '10:00', '13:00', '北谷町', '', 1, NULL),
    (d13, v_trip_id, 'shared', '移動', '13:00', '13:30', '', '', 2, NULL),
    (d13, v_trip_id, 'shared', '港川外人住宅', '13:30', '15:30', '浦添市港川', '', 3, NULL),
    (d13, v_trip_id, 'fork', '', '15:30', '17:30', '', '', 4,
      '[{"person":"Sei","title":"參加活動","location":"","notes":""},{"person":"同事","title":"浦添PARCO CITY","location":"浦添市","notes":""}]'::jsonb),
    (d13, v_trip_id, 'shared', '晚餐', '17:30', '19:00', '', '', 5, NULL);

  -- ───────────────────────────────────────────────
  -- 6/14 那霸市區日
  -- ───────────────────────────────────────────────
  INSERT INTO events (day_id, trip_id, type, title, time_start, time_end, location, notes, sort_order, fork_items) VALUES
    (d14, v_trip_id, 'shared', '第一牧志公設市場', '10:30', '13:00', '那霸市牧志', '午餐', 0, NULL),
    (d14, v_trip_id, 'fork', '', '13:30', '17:00', '', '', 1,
      '[{"person":"Sei","title":"跑場","location":"","notes":"13:30 入場｜14:00 開演｜15:30 演出結束｜16:30 物販結束"},{"person":"同事","title":"首里城","location":"那霸市首里","notes":""}]'::jsonb),
    (d14, v_trip_id, 'shared', '波上宮', '16:00', '17:30', '那霸市若狹', '', 2, NULL),
    (d14, v_trip_id, 'shared', '還車', '17:30', '19:00', '美榮橋站前 外語櫃台', '', 3, NULL),
    (d14, v_trip_id, 'shared', '暖暮拉麵', '19:00', '20:00', '那霸市', '', 4, NULL),
    (d14, v_trip_id, 'shared', '國際通逛街/居酒屋', '20:00', '22:00', '國際通', '', 5, NULL);

  -- ───────────────────────────────────────────────
  -- 6/15 回程日
  -- ───────────────────────────────────────────────
  INSERT INTO events (day_id, trip_id, type, title, time_start, time_end, location, notes, sort_order, fork_items) VALUES
    (d15, v_trip_id, 'shared', '起床', '06:30', '07:00', '', '', 0, NULL),
    (d15, v_trip_id, 'shared', '移動到機場', '07:00', '07:30', '', '叫車', 1, NULL),
    (d15, v_trip_id, 'shared', '沖繩 → 台灣', '10:10', '10:40', '那霸空港', '飛機', 2, NULL);

  RAISE NOTICE '行程匯入完成！';
END;
$$;
