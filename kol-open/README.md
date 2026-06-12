# KOL OPEN｜隔壁老王合作勞務回傳系統

讓合作 KOL 線上完成：基本資料 → 上傳身分證正反面 + 存摺 → 線上閱讀勞務單並手寫簽名。
所有資料（文字 + 4 個圖檔）綁定為 D1 的同一筆紀錄，管理者於後台一頁看齊。

## 架構
```
KOL → public/index.html（黃白品牌風表單，圖檔前端自動壓縮 + Canvas 手寫簽名）
        │  POST /api/submit
        ▼
  Pages Function ──► R2: <時間戳_亂碼>/idf.jpg · idb.jpg · bank.jpg · sig.png
        │          └► D1: 文字欄位 + 4 個圖檔 key（同一列 = 同一筆）
        ▼
財務 → public/admin.html → /api/records + /api/image/<key>
```

## 檔案結構
```
kol-open/
├─ public/
│  ├─ index.html              KOL 表單（前端壓縮 + 手寫簽名 + Turnstile）
│  └─ admin.html              財務後台（卡片式檢視 + 圖檔燈箱 + 搜尋 + 列印）
├─ functions/api/
│  ├─ submit.js               POST /api/submit（寫 R2 + D1）
│  ├─ records.js              GET  /api/records（後台列表 / 搜尋）
│  └─ image/[[key]].js        GET  /api/image/<key>（串流單張圖）
├─ schema.sql                 D1 資料表
└─ wrangler.toml              D1 / R2 綁定設定
```

## ⚠️ 上線前必做（本系統含身分證件，屬高敏感個資）
1. **admin.html 與 /api/records、/api/image 一定要用 Cloudflare Access 鎖住**
   （Zero Trust → Access → 新增 Application，路徑設 `你的網域/admin.html` 與 `/api/records`、`/api/image/*`，
   只允許財務同仁 Email 登入）。**不鎖的話，任何知道網址的人都能看到所有證件。**
2. 表單頁加 **Turnstile** 防機器人灌資料：
   - 前端 `public/index.html` 內 `data-sitekey="YOUR_TURNSTILE_SITE_KEY"` 換成你的 site key。
   - Pages 專案 Settings → 環境變數加 `TURNSTILE_SECRET`（後端 `submit.js` 會自動驗證）。
3. 資料用畢請定期刪除（R2 物件 + D1 列），遵循個資法保存期限。
4. 表單內的個資告知聲明聯絡信箱 `finance@example.com` 請換成真實信箱。

## 部署步驟
```bash
# 0. 前置：npm i -g wrangler && wrangler login
cd kol-open

# 1. 建 R2（存證件與簽名）
wrangler r2 bucket create kol-open-files

# 2. 建 D1（存文字），把印出的 database_id 貼進 wrangler.toml
wrangler d1 create kol-open-db

# 3. 建資料表
wrangler d1 execute kol-open-db --remote --file=./schema.sql

# 4. 部署
wrangler pages deploy public --project-name=kol-open
```
最後到 Cloudflare 後台 → 專案 → Settings → Functions 綁定：
- D1 bindings：`FORM_DB` → kol-open-db
- R2 bindings：`FORM_BUCKET` → kol-open-files

綁完重新 deploy 一次。

- 表單：`https://kol-open.pages.dev/`
- 後台：`https://kol-open.pages.dev/admin.html`（鎖 Access 後）

## 本機測試
```bash
cd kol-open
wrangler pages dev public
```
> 本機測試需綁本機 D1/R2，可用 `wrangler pages dev public --d1 FORM_DB=kol-open-db --r2 FORM_BUCKET=kol-open-files`。

## 自訂
- **勞務單條款**：`public/index.html` 內 `.doc` 區塊的 `<ol>` 直接改文字。
- **公司名 / 案名預設**：同檔搜尋「隔壁老王」「DEFAULT_COMPANY」「合作案名」。
- **欄位增減**：`public/index.html` 表單欄位 ↔ `functions/api/submit.js` ↔ `schema.sql` 三處同步。
- **壓縮品質 / 尺寸**：`public/index.html` 的 `MAX_EDGE`、`JPEG_QUALITY`。

## 名稱建議
「合作勞務單回傳系統」偏內部文件味，對外給 KOL 看的入口可以更輕快，例如：
- **KOL OPEN 合作夥伴中心**（呼應 logo，最推薦，已套用於頁面）
- 老王開單｜KOL 簽署中心
- NEAR OLDWANG DIGITAL 創作者請款通道
