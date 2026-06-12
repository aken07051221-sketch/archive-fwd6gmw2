# KOL OPEN 部署教學（免打指令 · 全程在 Cloudflare 網站點選）

這份教學用「Cloudflare Pages 連結 GitHub」的方式部署，整個過程都是滑鼠點選，不需要輸入任何指令。
照著下面的順序做，每一步都有「要點哪裡、要填什麼」。

預估時間：約 15 分鐘。

---

## 步驟 1️⃣ 建立 D1 資料庫（存文字資料）

1. 登入 Cloudflare，左側選單點 **Storage & Databases → D1 SQL Database**。
2. 按 **Create database（建立資料庫）**。
3. 名稱填：`kol-open-db` → 按 **Create**。
4. 進入這個資料庫後，點上方的 **Console（主控台）** 分頁。
5. 打開倉庫裡的 `kol-open/schema.sql`，把**整個內容**複製，貼到 Console 的輸入框，按 **Execute（執行）**。
   - 看到執行成功、沒有紅色錯誤，就代表資料表建好了。

> 📌 `schema.sql` 在 GitHub 上的位置：你的倉庫 → `kol-open` 資料夾 → `schema.sql`，點進去按右上角複製鈕即可。

---

## 步驟 2️⃣ 建立 R2 儲存桶（存證件與簽名圖檔）

1. 左側選單點 **R2 Object Storage**。
2. 按 **Create bucket（建立儲存桶）**。
3. 名稱填：`kol-open-files` → 按 **Create bucket**。
   - 其他設定維持預設即可。

---

## 步驟 3️⃣ 用 Pages 連結 GitHub 部署網站

1. 左側選單點 **Workers & Pages**，按 **Create（建立）** → 選 **Pages** 分頁 → **Connect to Git（連結 Git）**。
2. 第一次使用會要你授權 GitHub，按提示授權並選擇可存取的倉庫，選 `archive-fwd6gmw2`。
3. 選好倉庫後，**Set up builds and deployments（設定建置與部署）** 頁面這樣填：

   | 欄位 | 填入 |
   |---|---|
   | Production branch（正式分支） | `claude/professional-website-build-jjbict` |
   | Framework preset（框架預設） | `None` |
   | Build command（建置指令） | **留空** |
   | Build output directory（輸出目錄） | `public` |

4. 展開 **Root directory (advanced)（根目錄，進階）**，填入：`kol-open`
5. 按 **Save and Deploy（儲存並部署）**，等它跑完第一次部署（約 1～2 分鐘）。
   - 這次部署網站會先上線，但「送出表單」還不會動，因為還沒綁定 D1/R2 —— 下一步就綁。

---

## 步驟 4️⃣ 綁定 D1 與 R2（讓表單能存資料）

1. 進入剛建立的 **kol-open** 專案 → **Settings（設定）** → **Functions（函式）** → 找到 **Bindings**（或 Variables and bindings）。
2. 新增 **D1 database binding**：
   - Variable name（變數名稱）：`FORM_DB`　← 一定要一模一樣
   - D1 database：選 `kol-open-db`
3. 新增 **R2 bucket binding**：
   - Variable name（變數名稱）：`FORM_BUCKET`　← 一定要一模一樣
   - R2 bucket：選 `kol-open-files`
4. 儲存後，回到 **Deployments（部署）** 分頁，對最新一次部署按 **⋯ → Retry deployment（重新部署）**，讓綁定生效。

✅ 到這裡，網站就能正常收件了：
- 表單：`https://kol-open.pages.dev/`
- 後台：`https://kol-open.pages.dev/admin.html`

---

## ⚠️ 步驟 5️⃣ 上線前必做的安全設定（含身分證，務必完成）

### 5-1　用 Access 鎖住後台（最重要！不鎖任何人都能看到所有證件）
1. 左側選單 **Zero Trust**（第一次進入會要你建立一個免費的 team 名稱）。
2. **Access → Applications → Add an application → Self-hosted**。
3. Application name：`KOL OPEN 後台`
4. **Add public hostname**，加入這幾條（Subdomain 留空、Domain 選 `kol-open.pages.dev`，Path 分別填）：
   - Path：`admin.html`
   - 再 Add，Path：`api/records`
   - 再 Add，Path：`api/image`
5. 下一步 **Policies**：
   - Policy name：`只允許財務`
   - Action：`Allow`
   - Include → Selector 選 `Emails` → 填入財務同仁的 Email（可加多個）。
6. 一路 Next → **Add application** 完成。
   - 之後任何人開 `admin.html`、`/api/records`、`/api/image/*` 都會先要求登入，只有名單內 Email 進得去。

### 5-2　開 Turnstile 防機器人（選用但建議）
1. 左側選單 **Turnstile → Add widget**。
2. Domain 填 `kol-open.pages.dev`，建立後會得到 **Site Key** 與 **Secret Key**。
3. **Site Key**：到 GitHub 倉庫 `kol-open/public/index.html`，把 `data-sitekey="YOUR_TURNSTILE_SITE_KEY"` 換成你的 Site Key（可直接在 GitHub 網頁上按鉛筆圖示編輯、Commit）。存檔後 Pages 會自動重新部署。
4. **Secret Key**：到 Pages 專案 **Settings → Environment variables**，新增 `TURNSTILE_SECRET` = 你的 Secret Key → 儲存後重新部署。

### 5-3　換掉個資聲明信箱
- GitHub 倉庫 `kol-open/public/index.html` 內搜尋 `finance@example.com`，改成你的真實信箱（一樣可在 GitHub 網頁編輯）。

---

## 之後要改東西怎麼辦？
因為是「連結 Git」自動部署，**你只要在 GitHub 上修改檔案並 Commit，Cloudflare 就會自動重新部署**，不用再做任何事。

卡關時，把畫面截圖貼給我，我直接幫你看是哪一步、怎麼解。
