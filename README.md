# 靈感培養皿 — 多角色自主實境沙盒

> 小說家的 AI 即興創作工具：設定角色與場景，放手讓他們自己活起來、吵架、背叛、崩潰。

**專為 Claude Code 設計**，不需要 Anthropic API Key。瀏覽器透過 Vite bridge 發出 pending request，由 Claude Code 或其他本地 worker 即時生成角色對話並推回舞台。

---

## 示範場景

```
謀殺案剛發生。三人被困在莊園密室，大雪封路，兇器消失，互相懷疑。

偵探陳修遠  ── 冷靜多疑，認識死者，是舊情人
管家林威廉  ── 過度禮貌，才是兇手，藏了心臟藥
繼承人蘇艾倫 ── 衝動天真，偷改了遺囑
```

每 30 秒自動推進，隨時可按「導演介入」插入事件（停電、說謊被抓包、警笛聲……或任何你想得到的荒誕）。

---

## 快速啟動

### 前置條件
- [Claude Code](https://claude.ai/code) 已安裝並登入
- Node.js 18+

### 啟動

```bash
git clone https://github.com/jinfer68/novel-sandbox.git
cd novel-sandbox
npm install
npm run dev
```

開啟瀏覽器前往 `http://localhost:3000`，點「開幕 — 讓角色活起來」。

### Claude Code bridge 與本地測試引擎

預設狀態下，瀏覽器會寫入 `/tmp/novel-sandbox-pending.json`，外部 Claude Code / local worker 需要讀取 pending request，產生 JSON 後 POST 到 `/api/bridge/push`。

若只是想測 UI 流程、不接外部生成器，可以用 local engine 模式啟動：

```bash
NOVEL_SANDBOX_ENGINE=local npm run dev
```

local engine 是規則式 fallback，只適合測試互動流程；正式即時創作仍建議用 Claude Code bridge。

若在設定頁選擇 `Codex` 作為主導引擎，請另外開一個終端啟動 worker：

```bash
npm run codex-worker
```

如此每次倒數結束或導演介入時，瀏覽器會送出 `engine: "codex"` 的 pending request，worker 會自動呼叫 `codex exec` 生成 JSON 並推回舞台。

所有主導引擎預設都使用 30 秒自動推進。Codex CLI 若超過 30 秒仍未產生可解析 JSON，worker 會回傳失敗訊息並釋放舞台。

---

## 功能

### 設定頁
| 欄位 | 說明 |
|------|------|
| 主導引擎 | 開始前選擇這場演出的生成來源：Claude Code、Codex、Local |
| 文字匯入 | 貼上世界觀與角色設定，自動拆成場景、世界觀卡與角色卡 |
| 場景設定 | 世界觀背景，一句話到一段都行 |
| 世界觀卡 | 類型、地點、時代、氣氛、世界規則、勢力、核心衝突、世界秘密、時間線、導演備註 |
| 角色名字 | 三個角色各自命名 |
| 性格 | 個性特質，影響說話方式 |
| 目的 | 角色在這場戲裡想達到什麼 |
| 與他人的關係 | 角色之間的預設關係網 |
| 秘密 | 不會主動說出的隱藏資訊 |
| 語氣 | 說話風格（簡短反問、過度禮貌…） |
| 補充設定 | 身份、背景、能力、弱點、價值觀、創傷、行動原則等不適合放進其他欄位的細節 |
| 初始情緒 | 怒 / 懼 / 信，各 0–10 分滑桿 |

角色數量可動態新增或移除，不再限制為三人。文字匯入解析後仍可手動微調世界觀與每張角色卡。

### 長文本匯入

目前匯入器是本地規則式解析，不需要 API。為了避免世界觀、規則、秘密、時間線被誤讀成角色，建議使用嚴格區段格式：

- `---世界觀---` 到 `---結束世界觀---` 之間只放世界、場景、規則、勢力、時間線。
- `---角色---` 到 `---結束角色---` 之間只放角色。
- 每位角色必須用 `角色：` 開頭。
- 每位角色建議保留 `姓名`、`身份`、`性格`、`目的`、`關係`、`秘密`、`語氣`、`補充設定`。
- 不要在世界觀區段使用 `角色：` 這個標籤。

完整範例：

```text
---世界觀---
類型：宮廷權謀
地點：封鎖中的王宮
時代：架空王國內戰前夜
氣氛：猜忌、壓迫、資訊不對稱
核心前提：女王暴斃，遺詔失蹤，王室、軍方與教會都想控制繼承人。
世界規則：
- 王宮封鎖前沒有人能離開
- 只有掌印官知道真正遺詔的位置
勢力：
- 王室
- 軍方
- 教會
核心衝突：
- 遺詔可能被偽造
- 軍方即將進城
世界秘密：
- 女王不是病死
時間線：
- 昨夜女王死亡
- 黎明前軍方會進城
導演備註：旁白可以描寫壓迫感，但不要直接揭露秘密。
---結束世界觀---

---角色---
角色：李曜
姓名：李曜
身份：宰相
背景：先王朝舊臣，長期掌控文官系統。
性格：謹慎、溫和、擅長轉移話題。
能力：熟悉宮廷文書與人脈操作。
弱點：害怕軍方失控，也害怕真正遺詔曝光。
價值觀：相信秩序比血統重要。
行動原則：永遠先讓別人說出立場，再決定要推誰出局。
目的：扶植傀儡繼承人。
關係：表面效忠阿棠，實際忌憚沈珂。
秘密：偽造遺詔。
語氣：禮貌、低聲、每句話都留餘地。
補充設定：習慣隨身攜帶空白印泥；遇到質問時會先稱讚對方觀察敏銳。

角色：阿棠
姓名：阿棠
身份：公主
背景：女王唯一公開承認的繼承人。
性格：衝動、驕傲、容易被挑釁。
能力：能鼓動近衛與年輕貴族。
弱點：政治判斷不穩，容易被情緒操控。
目的：奪回王位。
關係：憎恨李曜，但不得不利用他。
秘密：知道女王不是病死。
語氣：直接、尖銳、情緒外露。
補充設定：怕黑；被稱呼全名時會本能地緊張。
---結束角色---
```

可以交給其他 AI 的整理指令：

```text
請把以下故事設定整理成 novel-sandbox 匯入格式。必須嚴格分成 ---世界觀--- 與 ---角色--- 兩個區段。
世界觀區段不得使用「角色：」標籤。
角色區段中，每位角色必須以「角色：角色名」開頭，並盡量補齊：姓名、身份、背景、性格、能力、弱點、目的、關係、秘密、語氣、補充設定。
無法分類但會影響角色行動、判斷、說話、恐懼、偏好、習慣的內容，全部放進「補充設定」。
不要新增不存在的重要設定；不確定的內容請留空或寫「未設定」。
```

### 舞台頁
- **自動推進**：每 30 秒自動觸發下一輪對話
- **旁白敘事**：生成結果可包含旁白段落，讓演繹更接近小說場景
- **世界觀約束**：每輪生成會讀取世界觀卡，讓角色行動受規則、勢力、衝突與時間線影響
- **情緒儀表板**：即時顯示三人情緒變化曲線
- **導演介入**：6 個快捷事件 + 自訂輸入框，隨時插入劇情轉折
- **排隊機制**：生成中也可以按按鈕，介入會自動排隊執行
- **DEBUG 模式**：右上角切換，顯示每輪呼叫狀態

### 情節建議書頁
- AI 分析整場對話
- 輸出：劇情摘要、小說正文草稿、角色弧線、可用台詞、最高張力點、三條後續岔路
- 一鍵複製全文

---

## 架構說明

```
novel-sandbox/
├── src/
│   ├── App.jsx           # 根元件，頁面切換
│   ├── main.jsx          # React 入口
│   ├── api.js            # Claude Code bridge 邏輯
│   ├── constants.js      # 預設角色、場景、情緒值
│   └── components/
│       ├── Setup.jsx     # 設定頁
│       ├── Stage.jsx     # 舞台頁（核心體驗）
│       └── Report.jsx    # 情節建議書
├── vite.config.js        # Vite + bridge API plugin
└── package.json
```

### 各檔案說明

#### 進入點

| 檔案 | 說明 |
|------|------|
| `index.html` | HTML 進入點，掛載 `#root` 並載入 `src/main.jsx` |
| `src/main.jsx` | React 進入點，將 `<App />` 渲染到 `#root` |
| `src/App.jsx` | 根元件，管理三個頁面（setup / stage / report）的切換狀態 |

#### 核心邏輯

| 檔案 | 說明 |
|------|------|
| `src/api.js` | Claude Code bridge 的核心。`callClaude()` 向 `/api/bridge/pending` 發出請求並輪詢 `/api/bridge/queue`，等 Claude Code 把對話推進來。請求會帶上 system prompt、messages、intervention 與 request id |
| `src/constants.js` | 所有常數：預設場景文字、三個角色的預設值（名字／性格／目的／關係／秘密／語氣）、初始情緒值、導演快捷指令列表、主題色盤 |

#### 頁面元件

| 檔案 | 說明 |
|------|------|
| `src/components/Setup.jsx` | 設定頁。包含場景輸入框、三個角色卡（名字／性格／目的／關係／秘密／語氣），以及每個角色的怒／懼／信情緒滑桿 |
| `src/components/Stage.jsx` | 舞台頁，核心體驗。管理對話訊息串、情緒儀表板、30 秒自動計時器、導演介入按鈕，以及排隊機制（busy 時按按鈕不丟失，下輪自動執行） |
| `src/components/Report.jsx` | 情節建議書頁。呼叫 `callClaude()` 請 Claude Code 分析整場對話，輸出劇情摘要、角色弧線、最高張力點、三條後續岔路，並提供一鍵複製 |

#### 設定檔

| 檔案 | 說明 |
|------|------|
| `vite.config.js` | Vite 設定 + bridge plugin。Plugin 在開發伺服器上掛載三個端點（`/api/bridge/pending`、`/api/bridge/push`、`/api/bridge/queue`），透過本地檔案傳遞訊息；設定 `NOVEL_SANDBOX_ENGINE=local` 時提供 local engine fallback |
| `package.json` | 專案依賴：`react`、`react-dom`、`vite`、`@vitejs/plugin-react` |
| `.claude/launch.json` | Claude Code preview server 設定，讓 Claude Code 知道如何用 `npm run dev` 啟動並預覽這個專案 |

---

### Claude Code Bridge

`vite.config.js` 內建一個輕量 bridge plugin，提供三個本地端點：

| 端點 | 用途 |
|------|------|
| `POST /api/bridge/pending` | 瀏覽器通知「需要一輪對話」 |
| `GET /api/bridge/queue` | 瀏覽器輪詢等待回應 |
| `POST /api/bridge/push` | Claude Code 推送生成內容 |

每場演出開始前會選定主導引擎，之後每個 request 都會帶上 `id` 與 `engine`。瀏覽器輪詢 `/api/bridge/queue?id=...`，只會取回同一個 request id 的結果，避免 Claude Code、Codex、Local 互相搶答。

預設可讓外部 worker 監看 `/tmp/novel-sandbox-pending.json`，偵測到符合自己 `engine` 的請求後生成並推送。若選擇 `Local`，則由內建 local engine 在瀏覽器輪詢 `/api/bridge/queue?id=...` 時直接生成回應。

---

## 架構方向

目前建議保留 **React + Vite**：

- 這是一個本地互動工具，前端狀態、即時 UI、表單與舞台互動都很適合 React。
- Vite dev server 可以同時提供前端與本地 bridge endpoint，對 MVP 來說比另開 Express / Electron / Next.js 更輕。
- 目前沒有 SSR、資料庫、多頁 SEO 或遠端部署需求，Next.js 會增加不必要複雜度。
- 若未來要做成桌面 App，可在保留 React UI 的前提下接 Tauri 或 Electron。

下一步可以把 Claude Code 接管流程整理成獨立的 `scripts/worker.js` 或操作腳本，明確負責讀 pending、呼叫生成、push 回應。這樣瀏覽器、bridge、生成器三者職責會更清楚。

---

## 技術棧

- **React 18 + Vite 5**
- **純 inline styles**（無 CSS 框架依賴）
- **Claude Code bridge** 作為即時生成通道（無需獨立 API Key）
- 設計參考：沉浸式黑色終端美學
