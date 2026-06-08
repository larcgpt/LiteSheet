# LiteSheet — 輕量試算表

**LiteSheet** 是一個基於 TypeScript + Canvas 實作的輕量級瀏覽器試算表，從 [Luckysheet](https://github.com/dream-num/Luckysheet) 的架構重寫精簡而來。保留了核心試算表功能，同時大幅降低依賴套件數量與 bundle 大小，適合嵌入網頁或作為獨立應用使用。

## 功能一覽

| 分類 | 功能 | 狀態 |
|------|------|------|
| 儲存格編輯 | 雙擊編輯、鍵盤導航、公式輸入 | ✅ |
| 儲存格格式 | 粗體 / 斜體 / 底線 / 刪除線、文字顏色、背景色、字型、字體大小 | ✅ |
| 對齊與縮排 | 水平對齊(左/中/右)、垂直對齊(上/中/下)、縮排增減、自動換行 | ✅ |
| 數字格式 | 一般、數字、貨幣、百分比、日期、科學記號、千分位 | ✅ |
| 範圍選取 | 點選單格、拖曳範圍、Shift+Click 延伸、Ctrl+Click 多重選取(含取消) | ✅ |
| 合併儲存格 | 合併所有、水平合併、垂直合併、取消合併 | ✅ |
| 欄列操作 | 插入/刪除欄列、調整寬高、雙擊欄邊界自動調整寬度 | ✅ |
| 凍結窗格 | 凍結首列、凍結首欄、凍結首欄與首列、取消凍結 | ✅ |
| 排序 | 遞增排序、遞減排序(依選取欄位) | ✅ |
| 篩選 | 自動篩選(選取值清單)、清除篩選 | ✅ |
| 資料驗證 | 下拉式清單驗證 | ✅ |
| 復原/重做 | 無限歷史(undo/redo) | ✅ |
| 公式引擎 | SUM、AVERAGE、MAX、MIN、COUNT、IF、CONCATENATE 等 (JS 後端,可擴充 WASM) | ✅ |
| 縮放 | 50% ~ 300%, 支援重置 | ✅ |
| 工作表管理 | 新增工作表、刪除工作表、重新命名、拖曳排序 | ✅ |
| XLSX 匯入/匯出 | 透過 SheetJS 完整支援 .xlsx 格式 | ✅ |
| 圖片 | 插入浮動圖片、拖曳移動、調整大小 | ✅ |
| 註解 | 新增/編輯/刪除註解 | ✅ |
| 超連結 | 插入超連結 | ✅ |
| 尋找取代 | 全文搜尋、取代、正規表達式支援 | ✅ |
| 快捷鍵 | Ctrl+C/V/X/Z/Y/B/I/U/S/P/A/H/K, F2, Delete, Esc, Enter, Tab, 方向鍵 | ✅ |
| 右鍵選單 | 複製/貼上/剪下/插入/刪除/合併/排序/篩選/凍結/格式設定 | ✅ |
| PWA | Service Worker + Manifest, 可離線使用 | ✅ |

## 快速開始

直接用瀏覽器開啟 `index.html`（支援 Chrome / Edge / Firefox）：

```
LiteSheetWASM/index.html
```

無需建置步驟 — `dist/litesheet.js` 與 `dist/xlsx.full.min.js` 已預先打包。

## 開發

```bash
# 安裝相依套件
npm install

# TypeScript 編譯
npm run build

# 產生 IIFE bundle (for browser)
npx esbuild src/index.ts --bundle --outfile=dist/litesheet.js --format=iife --global-name=litesheet

# 複製 xlsx 函式庫
Copy-Item node_modules/xlsx/dist/xlsx.full.min.js dist/xlsx.full.min.js

# 執行單元測試
npx vitest run

# TypeScript 型別檢查
npm run typecheck

# ESLint 檢查
npm run lint

# 自動化功能稽核 (34 項檢測)
node audit.cjs
```

## 專案架構

```
LiteSheetWASM/
├── index.html                    # 主應用程式（UI + 事件綁定 + toolbar/menu/context-menu）
├── src/
│   ├── index.ts                  # 匯出入口
│   ├── Spreadsheet.ts            # 整合類別
│   ├── core/
│   │   ├── store/Store.ts        # 資料儲存（undo/redo、cell CRUD、selections、merge、sort、fill）
│   │   └── events/EventBus.ts    # 事件匯流排
│   ├── formula/
│   │   ├── FormulaEngine.ts      # JS 公式引擎（SUM/AVERAGE/MAX/MIN/COUNT/IF/CONCATENATE...）
│   │   └── wasm/                 # WASM 公式引擎（Rust 實作，可選）
│   ├── rendering/
│   │   └── canvas/
│   │       └── CanvasRenderer.ts  # Canvas 渲染器（cells、headers、selection、zoom、float images）
│   ├── types/index.ts            # TypeScript 型別定義
│   └── utils/helpers.ts          # 輔助函式
├── dist/
│   ├── litesheet.js              # IIFE bundle（92KB，瀏覽器可直接載入）
│   └── xlsx.full.min.js          # SheetJS（881KB，xlsx 匯入匯出用）
├── tests/
│   ├── formula.test.ts           # 公式引擎測試（18 項）
│   └── store-multiselect.test.ts # 多選區測試（6 項）
├── public/                       # Vite / PWA 入口
├── audit.cjs                     # 自動化功能稽核腳本（50 項檢測）
├── audit.html                    # 瀏覽器稽核頁面
├── vitest.config.ts              # Vitest 設定
├── .eslintrc.json                # ESLint 設定
└── vite.config.ts                # Vite 設定
```

## 與 Luckysheet 的差異

LiteSheet 從 Luckysheet 汲取設計靈感，但進行了大量精簡與現代化改寫：

| 面向 | Luckysheet | LiteSheet |
|------|-----------|-----------|
| 語言 | JavaScript | TypeScript |
| Bundle 大小 | ~1.5MB+ | ~92KB (不含 xlsx) |
| 依賴套件 | jQuery、lodash、chrome-aws-lambda 等 20+ | 0 執行時期依賴 |
| 渲染方式 | DOM 混合 | 全 Canvas |
| 公式引擎 | 僅 JS | JS + 可選 WASM (Rust) |
| 事件系統 | 耦合 | EventBus 解耦 |
| 建置 | Webpack | esbuild + Vite |
| 測試 | 無 | Vitest 單元測試 + 自動化稽核 |
| 授權 | MIT | MIT |

## 設計原理

- **Store 單一資料源** — 所有資料變更集中通過 Store API，支援 undo/redo
- **Renderer 無狀態渲染** — CanvasRenderer 每次呼叫 `setSheet()` 從 Store 讀取快照重新渲染
- **事件驅動** — index.html 作為橋接層，監聽使用者事件並呼叫 Store/Renderer API
- **多選區支援** — `selections[]` 陣列儲存所有選取範圍，Shift+Click/Ctrl+Click 統一處理
- **Per-sheet 設定** — 每個工作表獨立儲存 config（合併、欄寬、列高、篩選、凍結、浮動圖片）

## License

MIT — 基於 [Luckysheet](https://github.com/dream-num/Luckysheet) 的 MIT 授權改寫。
