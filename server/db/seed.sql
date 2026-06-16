-- 範例課表資料（用 bun run db:seed:local 套用到本地 D1）
-- 注意：會先清空 courses / events 再插入。
DELETE FROM courses;
DELETE FROM events;

INSERT INTO courses (classroom, title, teacher, day_of_week, start_time, end_time, location, color, note, created_at) VALUES
('中壢', '微積分',     '王老師', 1, '08:10', '10:00', '理學院 101', 'sky',     '帶計算機', 1718000000),
('中壢', '資料結構',   '陳老師', 2, '09:10', '12:00', '工學院 305', 'violet',  '每週小考', 1718000000),
('新竹', 'Python 入門', '吳老師', 2, '09:00', '11:00', '新竹 A 教室', 'emerald', NULL,       1718000000),
('台北', '日文會話',   '佐藤',   1, '18:00', '20:00', '台北車站',   'rose',    NULL,       1718000000);

INSERT INTO events (classroom, title, date, start_time, end_time, location, color, note, created_at) VALUES
('中壢', '期中考',   '2026-06-18', NULL,    NULL,    NULL,     'rose',   '全範圍', 1718000000),
('中壢', '社團成發', '2026-06-20', '14:00', '16:00', '大禮堂', 'violet', NULL,     1718000000);
