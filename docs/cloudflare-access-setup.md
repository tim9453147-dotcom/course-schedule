# Cloudflare Access 登入完整設定（純新手版）

本文件適用於本專案目前的正式網址：

```text
https://course-schedule-2689336.pages.dev/
```

文件更新日期：2026-08-12。Cloudflare 或 Google 偶爾會調整按鈕名稱；若畫面文字有些微不同，請找本文件括號內的英文關鍵字。

## 先了解完成後會發生什麼

使用者開啟網站後，登入流程會變成：

```text
開啟網站
  ↓
Cloudflare Access 擋在網站前面
  ↓
使用 Google 驗證 email
  ↓
Cloudflare 檢查這個 email 是否在允許名單
  ↓
進入課表系統
  ↓
課表系統再判斷他是超級管理員、已核准使用者或待核准使用者
```

兩層權限不要混在一起：

| 管理位置 | 負責的事情 |
| --- | --- |
| Cloudflare Access | 這個 email 能不能進入網站 |
| 課表系統 `/admin` | 進入後能使用哪些頁面與教室 |
| Pages 環境變數 `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS` | 哪些 email 是超級管理員 |

## 開始前先準備

準備以下資料：

- 可以管理此 Pages 專案的 Cloudflare 帳號。
- 一個要當超級管理員的 Google email。
- 可以登入 [Google Cloud Console](https://console.cloud.google.com/) 的 Google 帳號。
- 家裡電腦已安裝 Git、Bun、Node.js 與 `just`。
- 專案程式已經 push 到 GitHub，家裡電腦可以 pull。

請先建立自己的設定紀錄，但不要把密碼或 Secret 寫進 Git：

```text
超級管理員 email：____________________________
Zero Trust Team name：_________________________
Zero Trust Team domain：_______________________
Google OAuth Client ID：_______________________
Google OAuth Client Secret：不要寫入 Git
Production Application AUD：__________________
NUXT_SESSION_PASSWORD：不要寫入 Git
```

文件中出現「你的超管 email」時，都要換成真正的 email，例如 `tim@gmail.com`，不要照抄範例。

---

## 第一部分：確認 Pages 網站

這一部分目前已確認完成，但換電腦後可以再檢查一次。

1. 開啟 [Cloudflare Dashboard](https://dash.cloudflare.com/) 並登入。
2. 如果 Cloudflare 要求選擇帳號，點選放置本專案的帳號。
3. 點左側的 `Workers & Pages`。
4. 在專案列表點擊 `course-schedule-2689336`。
5. 找到 `Production deployment`。
6. 點擊 `course-schedule-2689336.pages.dev`。
7. 確認網站可以開啟。

此專案目前使用 Cloudflare 免費提供的 `pages.dev` 網址，不需要先購買自己的網域。

---

## 第二部分：建立 Cloudflare Zero Trust 組織

Cloudflare Access 位於 Zero Trust 裡面。第一次使用時要先建立一個 Zero Trust 組織。

### 2.1 進入 Zero Trust

1. 回到 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 點左側選單的 `Zero Trust`。
3. 若找不到，展開左側的 `More` 或「更多」，再找 `Zero Trust`。

### 2.2 如果畫面要求建立組織

如果你看到 `Get started with Cloudflare One`、`Get started` 或 `Team name`：

1. 點 `Get started`。
2. 在 `Team name` 輸入一個只有英文、數字或連字號，而且不容易重複的名稱，例如：

   ```text
   course-schedule-tim
   ```

3. 點 `Next`、`Continue` 或 `Create organization`。
4. 選擇 `Zero Trust Free`。
5. 再次確認價格顯示 `$0`。
6. 點 `Proceed`、`Continue` 或 `Select plan`。
7. Cloudflare 可能要求輸入付款資料。只要選的是 Free 方案，方案本身不收費；不要另外勾選付費加購。
8. 如果畫面詢問要設定 VPN、WARP、DNS 或 Gateway，先按 `Skip` 或離開導覽。本專案目前不需要安裝 WARP。

如果一點進去就看到 Zero Trust 管理畫面，表示這個帳號以前已經建立過組織，不要再建立第二個。

### 2.3 找出 Team domain

1. 在 Zero Trust 左側點 `Settings`。
2. 找到 `Team name and domain`。
3. 記下 `Team name`。
4. 記下 `Team domain`，它會類似：

   ```text
   course-schedule-tim.cloudflareaccess.com
   ```

5. 後續填環境變數時必須在前面加上 `https://`：

   ```text
   https://course-schedule-tim.cloudflareaccess.com
   ```

注意：設定好 Google 登入後不要隨便更改 Team name，因為 Google 的回呼網址也包含這個名稱。

官方說明：[建立 Zero Trust 組織](https://developers.cloudflare.com/cloudflare-one/setup/)

---

## 第三部分：在 Google 建立登入用的 OAuth Client

這一部分是在 Google Cloud Console 操作，不是在 Cloudflare 操作。

### 3.1 建立 Google Cloud 專案

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)。
2. 使用準備好的 Google 帳號登入。
3. 點頁面上方目前的專案名稱或 `Select a project`。
4. 在彈出視窗點 `New Project`。
5. `Project name` 填：

   ```text
   Course Schedule Login
   ```

6. `Location` 沒有公司組織時可以保留 `No organization`。
7. 點 `Create`。
8. 等待建立完成後，確認頁面上方已切換到 `Course Schedule Login`。

### 3.2 設定 OAuth 同意畫面

Google 的新介面可能顯示 `Google Auth Platform`；舊介面可能顯示 `APIs & Services > OAuth consent screen`，兩者是同一類設定。

1. 點左上角三條線選單。
2. 進入 `Google Auth Platform`。
3. 如果看到 `Get started`，點它。
4. `App name` 填：

   ```text
   Course Schedule
   ```

5. `User support email` 選擇你自己的 email。
6. 點 `Next`。
7. `Audience` 選 `External`。
8. 點 `Next`。
9. `Contact information` 填你的 email。
10. 點 `Next`。
11. 勾選同意 Google API Services User Data Policy。
12. 點 `Continue` 或 `Create`。

如果你的 Google Auth Platform 顯示 `Testing`：

- 初次測試可以保持 Testing。
- 到 `Audience > Test users > Add users`，加入超管 email 和測試者 email。
- 尚未加入 Test users 的 Google 帳號會無法完成 Google OAuth。
- 正式開放給更多人之前，可以到 `Audience` 點 `Publish app`。Access policy 仍會限制真正能進網站的人。

### 3.3 建立 OAuth Client

1. 在 Google Auth Platform 左側點 `Clients`。
2. 點 `Create client`。舊介面可能是 `Credentials > Create Credentials > OAuth client ID`。
3. `Application type` 選 `Web application`。
4. `Name` 填：

   ```text
   Cloudflare Access
   ```

5. 找到 `Authorized JavaScript origins`。
6. 點 `Add URI`。
7. 填入你的 Team domain，必須包含 `https://`，結尾不要加 `/`。例如：

   ```text
   https://course-schedule-tim.cloudflareaccess.com
   ```

8. 找到 `Authorized redirect URIs`。
9. 點 `Add URI`。
10. 填入：

    ```text
    https://你的-team-name.cloudflareaccess.com/cdn-cgi/access/callback
    ```

    例如 Team name 是 `course-schedule-tim`，就填：

    ```text
    https://course-schedule-tim.cloudflareaccess.com/cdn-cgi/access/callback
    ```

11. 再檢查一次，`cloudflareaccess.com` 前面的名稱必須與第二部分看到的 Team name 完全相同。
12. 點 `Create`。
13. Google 會顯示 `Client ID` 與 `Client secret`。
14. 先不要關閉視窗，下一部分要把這兩個值貼到 Cloudflare。

`Client secret` 相當於密碼：不要貼到聊天、GitHub、`.md`、程式碼或公開截圖中。

官方說明：[Cloudflare 的 Google IdP 設定](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)

---

## 第四部分：把 Google 登入接到 Cloudflare

### 4.1 新增 Google Identity Provider

1. 另開一個分頁，回到 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 點 `Zero Trust`。
3. 點左側 `Integrations`。
4. 點 `Identity providers`。
5. 在 `Your identity providers` 區塊點 `Add new identity provider`。
6. 在清單選 `Google`，不要選 `Google Workspace`。一般 Gmail 使用 `Google` 即可。
7. `Name` 可以填：

   ```text
   Google
   ```

8. `App ID` 或 `Client ID` 貼上 Google 顯示的 `Client ID`。
9. `Client secret` 貼上 Google 顯示的 `Client secret`。
10. 如果看到 `Proof of Key Exchange (PKCE)`，建議開啟。
11. 點 `Save`。

### 4.2 測試 Google 登入連線

1. 回到 `Zero Trust > Integrations > Identity providers`。
2. 找到剛建立的 `Google`。
3. 點右側 `Test`。
4. 瀏覽器會開啟 Google 登入視窗。
5. 選擇 Google 帳號並允許登入。
6. 成功時應看到類似 `Your connection works!`。

如果出現 `redirect_uri_mismatch`：

1. 回 Google Cloud Console。
2. 進入 `Google Auth Platform > Clients`。
3. 點剛才的 `Cloudflare Access` client。
4. 檢查 Authorized redirect URI 是否完整等於：

   ```text
   https://你的-team-name.cloudflareaccess.com/cdn-cgi/access/callback
   ```

5. 修正後儲存，等幾分鐘再回 Cloudflare 按 `Test`。

如果顯示「此應用程式僅限測試使用者」：回 Google Cloud Console 的 `Audience > Test users` 加入目前登入的 email。

---

## 第五部分：保護正式的 pages.dev 網址

`pages.dev` 有一個容易踩到的地方：Pages 的 `Enable access policy` 第一次會先建立「預覽部署」的萬用字元規則，不是直接保護正式網址。因此必須照下面順序操作。

### 5.1 讓 Pages 自動建立第一個 Access Application

1. 回到一般的 Cloudflare Dashboard，不是在 Zero Trust 裡。
2. 點左側 `Workers & Pages`。
3. 點 `course-schedule-2689336`。
4. 點上方或側邊的 `Settings`。
5. 點 `General`。
6. 找到 `Access policy`。
7. 點 `Enable access policy`。
8. 等待 Cloudflare 建立完成。
9. 看到 Access policy 後點 `Manage`。

如果按鈕位置有變，可以在 Pages 專案的 Settings 頁搜尋 `Access`。

### 5.2 把萬用字元規則改成正式網址

按 `Manage` 後應進入 Zero Trust 的 Access Application：

1. 找到剛由 Pages 建立的 application。
2. 點它旁邊的 `Configure`。
3. 找到 `Public hostname`。
4. 你應該會看到類似：

   ```text
   *.course-schedule-2689336.pages.dev
   ```

5. 找到 `Subdomain` 欄位中的 `*`。
6. 把 `*` 刪除，讓最後顯示的網址變成：

   ```text
   course-schedule-2689336.pages.dev
   ```

7. `Path` 保持空白，代表保護整個網站。
8. Application name 改成容易辨認的名稱：

   ```text
   Course Schedule Production
   ```

9. 先不要離開，接著設定登入方式與政策。

官方特別要求 `pages.dev` 使用這個修改萬用字元的流程：[Pages 的 Access 已知事項](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain)

### 5.3 指定使用 Google 登入

在同一個 Application 設定畫面：

1. 找到 `Login methods`、`Identity providers` 或 `Authentication`。
2. 選擇剛建立的 `Google`。
3. 如果有 `Accept all available identity providers`，可以關閉，然後只勾 `Google`。
4. 如果只有 Google 一種方式，看到 `Instant authentication` 時可以開啟，使用者會直接前往 Google 登入。

### 5.4 建立第一個 Allow Policy

仍在同一個 Application：

1. 進入 `Policies`。
2. 點 `Add a policy`、`Create policy` 或 `Add new policy`。
3. 如果詢問是否建立 reusable policy，可以建立 reusable policy。
4. `Policy name` 填：

   ```text
   Course Schedule - Pilot Emails
   ```

5. `Action` 選 `Allow`。
6. `Session duration` 選 `8 hours`。
7. 在 `Configure rules` 找到 `Include`。
8. Selector 選 `Emails`，不要選 `Emails ending in`。
9. Value 填入你的超管 email。
10. 有測試者時，可以在同一個 `Emails` 規則中再加入測試者 email。
11. 不要建立 `Include Everyone`。
12. 不要用 `Login Methods = Google` 當作唯一的 Include 條件，否則所有 Google 帳號都可能通過 Cloudflare 這一層。
13. 點 `Save policy`。
14. 回到 Application 設定後，確認這個 Allow policy 已被加入。
15. 如果 Pages 自動建立了其他 policy，檢查它允許的是誰。不確定時先停用或移除其他 Allow policy，只保留 `Course Schedule - Pilot Emails`。
16. 點 `Save` 或 `Update application`。

此時的允許規則應該是：

| Action | Rule type | Selector | Value |
| --- | --- | --- | --- |
| Allow | Include | Emails | 你的超管 email |

Access 預設拒絕。沒有出現在 Allow policy 的 email 會被擋在網站外。[Access policy 官方說明](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)

### 5.5 重新保護預覽部署

前面把原本的預覽規則改成正式網址後，預覽網址暫時沒有 Access 保護。請再建立一次：

1. 回到 `Workers & Pages > course-schedule-2689336 > Settings > General`。
2. 找到 `Access policy`。
3. 再按一次 `Enable access policy`。
4. Cloudflare 會再建立一個 application，網址類似：

   ```text
   *.course-schedule-2689336.pages.dev
   ```

5. 這次不要刪除 `*`，它就是用來保護 Git branch 和 preview deployment。
6. 點 `Manage`，將名稱改成：

   ```text
   Course Schedule Previews
   ```

7. 在 Login methods 選 Google。
8. 加入同一個 `Course Schedule - Pilot Emails` policy。
9. 儲存。

完成後，`Zero Trust > Access controls > Applications` 應該至少看到兩個 application：

| Application | 保護的網址 |
| --- | --- |
| Course Schedule Production | `course-schedule-2689336.pages.dev` |
| Course Schedule Previews | `*.course-schedule-2689336.pages.dev` |

---

## 第六部分：取得正式 Application 的 AUD

AUD 是 Access Application 的識別碼。程式會用它確認登入憑證真的屬於本網站。

1. 進入 `Zero Trust`。
2. 點 `Access controls`。
3. 點 `Applications`。
4. 找到 `Course Schedule Production`。不要選 `Course Schedule Previews`。
5. 點 `Configure`。
6. 點 `Additional settings`。
7. 找到 `Application Audience (AUD) Tag`。
8. 點複製按鈕。
9. 把它記在安全的地方，下一部分要使用。

如果你刪掉並重新建立 Production Application，AUD 會改變，Pages 的環境變數也必須一起更新。

官方說明：[取得 Application AUD](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/#get-your-aud-tag)

---

## 第七部分：設定 Pages 正式環境變數

這些值不能只寫在本機 `.env`。正式網站必須在 Cloudflare Pages 裡設定。

### 7.1 產生 Session Password

在家裡電腦的 Terminal 執行：

```bash
openssl rand -base64 32
```

會得到一串隨機文字。複製它，但不要提交到 GitHub。

### 7.2 進入 Variables and Secrets

1. 回到 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 點 `Workers & Pages`。
3. 點 `course-schedule-2689336`。
4. 點 `Settings`。
5. 點 `Variables and Secrets`。
6. 確認正在設定 `Production` 環境，不是只有 Preview。

### 7.3 新增四個必要值

每一個值都按 `Add`，填好後按 `Save`。

#### 變數一：Team domain

```text
Variable name:
NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN

Value:
https://你的-team-name.cloudflareaccess.com
```

例如：

```text
https://course-schedule-tim.cloudflareaccess.com
```

必須有 `https://`，結尾不要加 `/cdn-cgi/...`。

#### 變數二：Production AUD

```text
Variable name:
NUXT_CLOUDFLARE_ACCESS_AUDIENCE

Value:
第六部分複製的 Production Application AUD
```

不要誤用 Preview Application 的 AUD。

#### 變數三：超級管理員 email

```text
Variable name:
NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS

Value:
你的超管 email
```

多位超管使用逗號分隔，中間不需要空格，例如：

```text
admin1@gmail.com,admin2@gmail.com
```

這個 email 必須同時存在於第五部分的 Access Allow policy，否則他雖然被程式設定成超管，仍會先被 Cloudflare 擋住。

#### 變數四：Session Password

```text
Variable name:
NUXT_SESSION_PASSWORD

Value:
剛才用 openssl 產生的隨機文字
```

勾選 `Encrypt` 或將類型設為 `Secret`，然後儲存。

### 7.4 不要設定 DEV_EMAIL 到 Production

以下變數只用於本機開發，不要新增到 Cloudflare Production：

```text
NUXT_CLOUDFLARE_ACCESS_DEV_EMAIL
```

### 7.5 如果需要 Preview deployment

Production 與 Preview Application 的 AUD 不同。如果你真的需要執行 preview deployment：

1. 到 `Zero Trust > Access controls > Applications`。
2. 打開 `Course Schedule Previews`。
3. 從 `Additional settings` 複製它自己的 AUD。
4. 回 Pages 的 `Settings > Variables and Secrets`。
5. 切換到 `Preview` 環境。
6. 設定相同四個變數，但 `NUXT_CLOUDFLARE_ACCESS_AUDIENCE` 要填 Preview Application 的 AUD。

若目前只部署 `main` 正式版本，可以先完成 Production，再處理 Preview。

修改環境變數後必須重新部署才會生效。[Pages Variables and Secrets](https://developers.cloudflare.com/pages/functions/bindings/#environment-variables)

---

## 第八部分：從家裡電腦部署新版程式

先確認目前電腦上的變更已由你自行 push 到 GitHub。回家後在 Terminal 操作：

### 8.1 取得最新程式

如果家裡電腦已經有專案：

```bash
cd /你的專案路徑/course-schedule
git pull
```

如果家裡電腦還沒有專案，先 clone：

```bash
git clone 你的-GitHub-repository-網址
cd course-schedule
```

### 8.2 安裝套件並登入 Cloudflare

```bash
just install
just wrangler login
```

`wrangler login` 會開啟瀏覽器，請使用管理 `course-schedule-2689336` 的同一個 Cloudflare 帳號授權。

### 8.3 部署前檢查

```bash
just lint
just typecheck
just build
```

三個指令都成功後再繼續。如果出現錯誤，不要直接部署。

### 8.4 更新正式 D1 資料庫

```bash
just db-migrate-remote
```

這會套用包含 `access_email` 的 migration。若 Wrangler 顯示即將執行的 migration 並要求確認，檢查目標是 `course-schedule-db` 的 remote database，再確認執行。

不要執行 seed 到遠端，也不要刪除 migration。

### 8.5 部署 Pages

```bash
just deploy
```

等待看到部署成功與 Pages URL。環境變數必須在部署前先設定完成，否則新版程式會因缺少 Access 設定而拒絕 production request。

---

## 第九部分：第一次登入與驗收

### 9.1 測試超級管理員

1. 開啟 Chrome 或 Edge 的無痕視窗。
2. 前往：

   ```text
   https://course-schedule-2689336.pages.dev/
   ```

3. 應該先看到 Cloudflare Access 或直接被轉到 Google。
4. 使用 `NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS` 中的 Google email 登入。
5. 登入後應回到課表網站。
6. 前往：

   ```text
   https://course-schedule-2689336.pages.dev/admin
   ```

7. 確認可以看到使用者管理功能。

如果 Google 登入成功，但網站顯示 401、`Invalid Access token`、`Invalid issuer` 或 `Invalid audience`：

- 檢查 Team domain 是否包含 `https://` 且沒有多餘 path。
- 檢查 AUD 是否來自 `Course Schedule Production`。
- 確認修改 Pages 環境變數後已重新部署。

### 9.2 測試未允許的 email

1. 登出後開新的無痕視窗。
2. 使用一個沒有加進 Access Allow policy 的 Google email。
3. 預期結果是 Cloudflare 顯示無權存取，不能進入網站。

### 9.3 查看登入紀錄

1. 回 Cloudflare Dashboard。
2. 進入 `Zero Trust`。
3. 點 `Insights`。
4. 點 `Logs`。
5. 點 `Access authentication logs`。
6. 可以依 email、Application 和 Allow/Deny 結果查看登入紀錄。

---

## 第十部分：日後如何新增一般使用者

建議使用「先邀請 email，再由系統核准」的方式。

### 10.1 先在 Cloudflare 允許 email

1. 進入 `Zero Trust > Access controls > Policies`。
2. 找到 `Course Schedule - Pilot Emails`。
3. 點 `Configure`。
4. 在 `Include > Emails` 加入新使用者的完整 email。
5. 點 `Save`。

如果你是在 Application 內建立的舊式 policy，則進入：

```text
Zero Trust
→ Access controls
→ Applications
→ Course Schedule Production
→ Configure
→ Policies
```

再編輯對應的 Allow policy。

### 10.2 請使用者第一次登入

1. 請使用者開啟正式網址。
2. 使用剛加入的 Google email 登入。
3. 系統第一次看到這個 email 時，會建立 `pending` 帳號。

### 10.3 超管在系統內核准

1. 超管進入 `/admin`。
2. 找到剛登入的使用者。
3. 將狀態由 pending 改成 active／啟用。
4. 指派他能使用的頁面。
5. 指派他能管理的教室。
6. 儲存。
7. 請使用者重新整理或重新登入。

所以新增帳號的完整順序是：

```text
Cloudflare Allow policy 加 email
→ 使用者 Google 登入一次
→ 系統產生 pending 帳號
→ 超管到 /admin 核准與分配權限
```

### 10.4 是否可以讓所有 Google 帳號自行申請

技術上可以把 Allow policy 改成 `Include > Login Methods > Google`，但這代表任何有效 Google 帳號都可能通過 Cloudflare，抵達系統的公開唯讀頁面並建立 pending 帳號。

初次上線不建議這樣設定。先使用完整 email 邀請名單，等確定網站上的 public 資料可以讓陌生人看到後再考慮開放申請。

---

## 第十一部分：停用或刪除使用者

需要停權時，建議三個動作都做。

### 11.1 先在課表系統停用

1. 超管進入 `/admin`。
2. 找到使用者。
3. 將狀態改成 disabled／停用。
4. 儲存。

這會立即阻止他使用系統內受權限控制的功能。

### 11.2 從 Access Allow policy 移除 email

1. 進入 `Zero Trust > Access controls > Policies`。
2. 打開 `Course Schedule - Pilot Emails`。
3. 從 `Include > Emails` 刪除該 email。
4. 儲存。

這會阻止他下次重新登入網站。

### 11.3 撤銷現有 Access session

1. 進入 `Zero Trust > Team & Resources > Users`。
2. 找到該使用者並勾選。
3. 點 `Action`。
4. 點 `Revoke`。
5. 點 `Revoke sessions` 確認。

只做 Revoke 不等於永久停權；如果 policy 仍允許該 email，他之後還能重新登入。因此要同時從 Allow policy 移除。[Access Session 管理](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/#revoke-user-sessions)

---

## 第十二部分：LINE webhook 與每日通知（有使用才做）

如果完全沒有使用 LINE 通知或 GitHub Actions 每日通知，先跳過整個章節。

Cloudflare Access 會要求瀏覽器登入，但 LINE 與排程機器人不會操作 Google 登入。因此下列兩個精確路徑需要建立 Bypass：

```text
/api/line/webhook
/api/notifications/daily-digest
```

不要 Bypass 整個網站，也不要 Bypass `/api/*`。

### 12.1 建立 LINE webhook 的 path application

1. 進入 `Zero Trust > Access controls > Applications`。
2. 點 `Create new application`。
3. 選 `Self-hosted and private`。
4. 點 `Add public hostname`。
5. Application name 填：

   ```text
   Course Schedule - LINE Webhook
   ```

6. 選擇或輸入 Pages 正式 hostname，讓最後預覽的完整網址為：

   ```text
   course-schedule-2689336.pages.dev/api/line/webhook
   ```

7. 如果畫面把 hostname 拆成欄位，應為：

   ```text
   Subdomain: course-schedule-2689336
   Domain: pages.dev
   Path: api/line/webhook
   ```

8. 最重要的是確認畫面最後顯示的完整 hostname/path 完全正確。
9. 建立 policy：

   ```text
   Policy name: Bypass LINE webhook
   Action: Bypass
   Include: Everyone
   ```

10. 儲存 Application。

### 12.2 建立 daily digest 的 path application

重複上面的操作，但改成：

```text
Application name: Course Schedule - Daily Digest
完整網址: course-schedule-2689336.pages.dev/api/notifications/daily-digest
Policy name: Bypass daily digest
Action: Bypass
Include: Everyone
```

程式端仍會驗證：

- LINE webhook 的 LINE signature。
- Daily digest 的 `NUXT_NOTIFY_CRON_SECRET` Bearer secret。

更精確的 path application 會優先於整站 application。[Application path 規則](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

如果建立 Application 時無法選擇 `pages.dev` 或無法得到上面完全相同的完整網址，不要改成 Bypass 更大的範圍；先略過此章節，保持端點被 Access 擋住，再確認 Cloudflare 當下的 Pages UI。

---

## 常見問題排查

### 開啟網站後沒有出現 Cloudflare 登入

檢查：

- `Course Schedule Production` 的 public hostname 是否沒有 `*`。
- hostname 是否正好是 `course-schedule-2689336.pages.dev`。
- Application 是否有有效的 Allow policy。
- 是否已按 Save。

### Google 顯示 redirect_uri_mismatch

Google OAuth Client 的 redirect URI 必須完全等於：

```text
https://你的-team-name.cloudflareaccess.com/cdn-cgi/access/callback
```

不能填 Pages URL，也不能漏掉 `https://`。

### Google 測試成功，但使用者被 Cloudflare 拒絕

Google Test 只表示 Google 和 Cloudflare 連線正常。還要確認使用者的完整 email 已加入 Access Allow policy。

### 超管能登入，但進入 /admin 沒有超管權限

檢查 Pages Production 的：

```text
NUXT_CLOUDFLARE_ACCESS_SUPER_ADMIN_EMAILS
```

必須與 Google 登入後的 email 完全相同。修改後要重新部署。

### 網站顯示 Invalid audience

最常見原因是把 Preview Application 的 AUD 填到 Production。重新從 `Course Schedule Production > Additional settings` 複製 AUD，更新 Pages Production 變數並重新部署。

### 修改環境變數後仍然沒有變化

Pages 的變數或 Secret 需要下一次 deployment 才會生效，重新執行：

```bash
just deploy
```

### 不小心把自己鎖在外面

1. 使用 Cloudflare Dashboard 管理帳號登入。
2. 進入 `Zero Trust > Access controls > Applications`。
3. 編輯 `Course Schedule Production` 的 Allow policy。
4. 把超管完整 email 加回 `Include > Emails`。
5. 儲存後用無痕視窗重試。

不要刪除 D1 migration，也不要用 `Include Everyone` 當成長期解法。

---

## 最終完成檢查表

- [ ] `https://course-schedule-2689336.pages.dev/` 可以開啟。
- [ ] 已建立 Zero Trust Team，並記下 Team domain。
- [ ] Google OAuth Client 的 origin 與 redirect URI 使用正確 Team domain。
- [ ] Cloudflare Google Identity Provider 的 Test 成功。
- [ ] Production Application hostname 沒有 `*`。
- [ ] Preview Application hostname 有 `*`。
- [ ] Production Allow policy 目前只包含超管與測試者完整 email。
- [ ] 沒有使用 `Include Everyone` 保護整站。
- [ ] 已複製 Production Application AUD。
- [ ] Pages Production 已設定四個必要變數／Secret。
- [ ] Production 沒有設定 `NUXT_CLOUDFLARE_ACCESS_DEV_EMAIL`。
- [ ] 已執行 `just db-migrate-remote`。
- [ ] 已執行 `just deploy`。
- [ ] 超管可以透過 Google 登入並進入 `/admin`。
- [ ] 未加入 Allow policy 的 email 會被 Cloudflare 擋下。
- [ ] 一般使用者能依照「Access 加 email → 首次登入 → `/admin` 核准」流程啟用。
- [ ] 若有使用 LINE 或 daily digest，已只針對兩個精確 path 設定 Bypass。

## 官方參考資料

- [建立 Cloudflare Zero Trust 組織](https://developers.cloudflare.com/cloudflare-one/setup/)
- [Google Identity Provider](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/)
- [Cloudflare Access Policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [保護 pages.dev 與 preview deployments](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain)
- [取得 Application AUD 與驗證 JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Pages Variables and Secrets](https://developers.cloudflare.com/pages/functions/bindings/)
- [Access Application Paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Access Session Management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
