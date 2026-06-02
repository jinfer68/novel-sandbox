# 靈感培養皿 — 多角色自主實境沙盒

小說家的 AI 創作工具：設定角色與場景，AI 讓角色們自己活起來、吵架、背叛。

## 快速啟動（Claude Code）

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定 API Key（二選一）

**方法 A：建立 .env 檔案（推薦）**
```bash
cp .env.example .env
# 編輯 .env，填入你的 Anthropic API Key
```

**方法 B：在網頁介面輸入**
啟動後在設定頁直接輸入 Key，會存在 localStorage。

### 3. 啟動開發伺服器
```bash
npm run dev
```

開啟瀏覽器前往 `http://localhost:3000`

---

## 功能說明

### 設定頁
- 填入場景世界觀
- 設定三個角色的名字、性格、秘密、語氣
- 調整每個角色的初始情緒值（憤怒／恐懼／信任）

### 舞台頁
- **自動推進**：每 20 秒自動呼叫一輪 Claude，推進角色對話
- **情緒儀表板**：即時顯示三個角色的情緒變化
- **導演介入**：6 個快捷按鈕 + 自訂輸入框，隨時插入事件
- **DEBUG 模式**：右上角 DEBUG 按鈕，顯示 API 呼叫記錄

### 建議書頁
- 分析整場對話，輸出劇情摘要、角色弧線、三條情節岔路
- 一鍵複製全文

---

## 專案結構

```
novel-sandbox/
├── src/
│   ├── App.jsx          # 根元件，管理頁面切換
│   ├── main.jsx         # React 入口
│   ├── api.js           # Claude API 呼叫邏輯
│   ├── constants.js     # 常數、預設值、主題色
│   └── components/
│       ├── Setup.jsx    # 設定頁
│       ├── Stage.jsx    # 舞台頁（核心體驗）
│       └── Report.jsx   # 情節建議書頁
├── public/
│   └── index.html
├── vite.config.js       # Vite 設定（含 API proxy）
├── .env.example         # API Key 範本
└── package.json
```

---

## API Proxy 說明

`vite.config.js` 設定了 proxy，將 `/api/claude` 轉發到 `api.anthropic.com/v1/messages`。
這樣做是為了避免瀏覽器 CORS 問題，API Key 只在本地端使用，不會暴露到網路。

---

## 技術棧

- React 18 + Vite
- 純 inline styles（無 CSS 框架）
- Anthropic Claude API（claude-sonnet-4-20250514）
