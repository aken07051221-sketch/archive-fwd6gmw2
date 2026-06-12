-- KOL OPEN｜D1 資料表
-- 一列 = 一筆 KOL 回傳（文字欄位 + 4 個 R2 圖檔 key 綁在同一筆）
-- 建表：wrangler d1 execute kol-open-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ref            TEXT    NOT NULL,            -- R2 物件前綴 <時間戳_亂碼>

  -- 基本資料
  name           TEXT    NOT NULL,            -- 真實姓名
  id_number      TEXT    NOT NULL,            -- 身分證字號
  birthday       TEXT,                        -- 出生年月日
  phone          TEXT    NOT NULL,            -- 聯絡電話
  email          TEXT,                        -- 電子信箱
  address        TEXT,                        -- 戶籍／通訊地址

  -- 銀行帳戶（匯款用）
  bank_name      TEXT    NOT NULL,            -- 銀行名稱
  bank_code      TEXT,                        -- 銀行代碼
  bank_branch    TEXT,                        -- 分行
  bank_account   TEXT    NOT NULL,            -- 帳號
  account_holder TEXT,                        -- 戶名

  -- 合作資訊
  company        TEXT,                        -- 合作公司
  project        TEXT,                        -- 合作案名
  amount         TEXT,                        -- 約定金額
  note           TEXT,                        -- 備註

  -- 4 個圖檔在 R2 的 key（同一列 = 同一筆）
  idf_key        TEXT,                        -- 身分證正面
  idb_key        TEXT,                        -- 身分證反面
  bank_key       TEXT,                        -- 存摺封面
  sig_key        TEXT,                        -- 手寫簽名

  -- 簽署狀態與稽核
  agreed         INTEGER NOT NULL DEFAULT 0,  -- 是否勾選同意勞務單
  user_agent     TEXT,
  ip             TEXT,
  created_at     TEXT    NOT NULL             -- ISO8601
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_ref        ON submissions (ref);
