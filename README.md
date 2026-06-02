# 靈感培養皿 — 多角色自主實境沙盒

> 小說家的 AI 即興創作工具：設定角色與場景，放手讓他們自己活起來、吵架、背叛、崩潰。

**專為 Claude Code 設計**，不需要 Anthropic API Key——Claude Code 本身就是引擎，透過 Vite bridge 即時驅動角色對話。

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

### 讓 Claude Code 接管

在 Claude Code 對話中輸入：

```
幫我資料夾內容執行這個自動化沙盒
```

Claude Code 會自動啟動 dev server，監控舞台狀態，並在你按下任何導演按鈕後即時生成角色回應。

---

## 功能

### 設定頁
| 欄位 | 說明 |
|------|------|
| 場景設定 | 世界觀背景，一句話到一段都行 |
| 角色名字 | 三個角色各自命名 |
| 性格 | 個性特質，影響說話方式 |
| 目的 | 角色在這場戲裡想達到什麼 |
| 與他人的關係 | 角色之間的預設關係網 |
| 秘密 | 不會主動說出的隱藏資訊 |
| 語氣 | 說話風格（簡短反問、過度禮貌…） |
| 初始情緒 | 怒 / 懼 / 信，各 0–10 分滑桿 |

### 舞台頁
- **自動推進**：每 30 秒自動觸發下一輪對話
- **情緒儀表板**：即時顯示三人情緒變化曲線
- **導演介入**：6 個快捷事件 + 自訂輸入框，隨時插入劇情轉折
- **排隊機制**：生成中也可以按按鈕，介入會自動排隊執行
- **DEBUG 模式**：右上角切換，顯示每輪呼叫狀態

### 情節建議書頁
- AI 分析整場對話
- 輸出：劇情摘要、三條角色弧線、最高張力點、三條後續岔路
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

### Claude Code Bridge

`vite.config.js` 內建一個輕量 bridge plugin，提供三個本地端點：

| 端點 | 用途 |
|------|------|
| `POST /api/bridge/pending` | 瀏覽器通知「需要一輪對話」 |
| `GET /api/bridge/queue` | 瀏覽器輪詢等待回應 |
| `POST /api/bridge/push` | Claude Code 推送生成內容 |

Claude Code 透過 Monitor 工具監看 `/tmp/novel-sandbox-pending.json`，偵測到請求就即時生成並推送。

---

## 技術棧

- **React 18 + Vite 5**
- **純 inline styles**（無 CSS 框架依賴）
- **Claude Code** 作為 AI 引擎（無需獨立 API Key）
- 設計參考：沉浸式黑色終端美學
