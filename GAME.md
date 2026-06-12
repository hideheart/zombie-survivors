# 開發經驗談：用現成 3D 素材快速做一款新遊戲

這份文件記錄我們怎麼從既有專案一路演進、最後「換皮」成《殭屍大逃殺》的經驗，**重點放在 3D 素材要去哪裡抓、怎麼接進 Babylon.js 專案**，以及一路踩過的坑。給未來想用現成素材快速做新遊戲的人當 playbook。

演進脈絡：
《動物嗨起來》(2D 派對) → 企鵝亂鬥場 → **動物大逃殺**（3D 倖存者類，動物 GLB）→ **殭屍大逃殺**（全面換皮）。
核心心法一句話：**先做好「玩法系統」，美術只是可抽換的資產層**。把渲染/數值/狀態跟「模型路徑」解耦，換皮就只是換素材 + 改對應表。

---

## 1. 3D 素材去哪裡抓

優先找**同一個作者/同一個包**的低面數素材，風格才會一致。常用免費（多為 CC0，可商用）來源：

| 來源 | 特色 |
|---|---|
| **Quaternius** (quaternius.com) | 大量 CC0 低面數包：角色、殭屍、動物、武器、載具、環境，**附骨架動畫**。本專案的殭屍/倖存者/武器/場景都來自這類包。 |
| **Kenney** (kenney.nl) | CC0，風格乾淨統一，含 UI/音效/模型，新手最好上手。 |
| **Poly Pizza** (poly.pizza) | 低面數模型搜尋引擎，多數 CC0，可直接下載 GLB。 |
| **Sketchfab** | 量最大，記得用 **License 篩選 CC0／Downloadable**，留意標示來源。 |
| **itch.io / OpenGameArt** | 獨立作者素材包，授權逐一確認。 |

選素材原則：
- **同一包 = 同一風格**：跨包混用比例會打架。
- **角色要有動畫**：至少 `Idle` 與 `Walk/Run`（移動時腳要會動）。
- **格式優先 GLB / glTF**：Babylon 原生支援；FBX/OBJ 需轉檔。
- **授權先看清楚**：CC0 最省事；其他要保留出處、遵守姓名標示。
- **面數要低**：怪海/倖存者類會同時出現大量單位，模型越輕越好。

---

## 2. 下載後怎麼接進專案

### 2-1. 先搞清楚 glTF 的「自包性」
`.gltf` 可能有兩種：
- **自包**：buffer 與貼圖以 base64 內嵌在單一 `.gltf`（或就是 `.glb`）→ 複製一個檔就能用。
- **外部相依**：`.gltf` 旁邊還有 `.bin` 與貼圖 `.png`，靠相對路徑載入 → 要連同一起搬。

檢查方法（看有沒有指向外部檔的 `uri`）：
```bash
grep -o '"uri"[^,}]*' model.gltf | grep -v 'data:'
```
沒輸出 = 自包，直接複製即可。本專案的包剛好都是自包單檔。

### 2-2. 只搬用到的，原始包別進版控
原始素材包通常很肥（本專案 `download/` 達 177MB，含一堆沒用到的 FBX/Blend/載具）。做法：
1. 把**實際會用到**的檔複製到 `public/models/<theme>/`，用語意化命名（`survivor_matt.gltf`、`zombie_basic.gltf`、`weapon_axe.gltf`、`prop_couch.gltf`）。
2. 原始包整包 **gitignore**：
   ```gitignore
   # 原始素材包（僅 public/models 內為實際使用）
   download
   ```
3. Commit 時把「模型資產」與「程式碼」分開兩筆，歷史乾淨、好 review。

---

## 3. Babylon.js 載入模型的坑（我們實際踩過的）

### 3-1. 大小正規化 + 貼地
不同模型原始尺寸天差地遠。統一用「目標身高」縮放、底部對齊 `y=0`：
```ts
const { min, max } = root.getHierarchyBoundingVectors();
const scale = targetHeight / (max.y - min.y);
root.scaling.scaleInPlace(scale);
root.position.y = -min.y * scale; // 腳貼地
```
見 `src/game/model-loader.ts`。

### 3-2. glTF 根節點帶 `rotationQuaternion` → `rotation.y` 失效
最常見的雷。glTF 匯入後的 `__root__` 帶有四元數（處理座標系轉換），**直接設 `mesh.rotation.y` 不會轉**。解法：**包一層自己的 `TransformNode` holder，轉 holder**：
```ts
const holder = new TransformNode('unit', scene);
modelRoot.parent = holder;
holder.rotation.y = Math.atan2(dirX, dirZ); // 有效
```
玩家、殭屍、王、環繞武器、寶箱、血跡全用這招（見 `zombie-horde.ts`、`boss.ts`、`extra-weapons.ts`）。

### 3-3. 角色動畫：idle / walk 切換
匯入後拿 `animationGroups`，用名稱比對抓 idle 與 walk，依移動狀態切換（只在狀態改變時切，避免每幀重啟）：
```ts
const walk = groups.find(g => /walk|run|move|sprint/i.test(g.name));
const idle = groups.find(g => /idle/i.test(g.name)) ?? groups[0];
```
見 `model-loader.ts` 的 `loadCharacter` 與 `game.ts` 的移動判斷。

### 3-4. 大量同模型：兩條路線
- **thin instances**（單一 draw call、超快）：適合**靜態或無骨架**物件（子彈、地面、環境）。模型是階層 → 先 `Mesh.MergeMeshes(parts, true, true, undefined, false, true)` 合併成單一 mesh，再 `thinInstanceSetBuffer('matrix', ...)`。每個實例的位置/旋轉/縮放都靠矩陣陣列。見 `weapon-system.ts`（飛刀）。
- **全動畫池**（`instantiateModelsToScene`）：要**骨架動畫**的單位（殭屍）無法用 thin instance，改預先複製一池、循環啟用前 N 隻；數量上限要壓低（本專案 ~50）。見 `zombie-horde.ts`。

### 3-5. 扁平模型不能用「高度」正規化
血跡、地磚這種**扁平**模型，高度≈0，用 `targetHeight/height` 會算出**爆炸級縮放**。改用**橫向寬度**正規化：
```ts
const w = Math.max(max.x - min.x, max.z - min.z);
root.scaling.scaleInPlace(TARGET_WIDTH / w);
```
見 `decals.ts`。

### 3-6. 發光：自發光材質 + GlowLayer
想讓武器/寶箱「邊緣發光」，模型原始材質通常不發光。做法：場景加一個 `GlowLayer`，再把目標物件的材質換成 `emissiveColor` 高的 `StandardMaterial`（`disableLighting = true`）。GlowLayer 成本是**固定的後處理模糊**，跟發光物件數量幾乎無關。見 `game.ts` 的 GlowLayer 與各武器材質覆寫。

### 3-7. 單體受擊閃白：per-mesh `renderOverlay`
怪物共用材質，想讓「被打的那一隻」閃白而不影響別隻 → 用 **per-mesh** 的 `mesh.renderOverlay = true` + `overlayColor`，**不要改材質**。前提：`new Engine(canvas, true, { stencil: true })` 要開 stencil。見 `zombie-horde.ts` / `boss.ts`。

### 3-8. 教訓：不是每個素材都適合你的用途
我們本來想用 `Street_4Way` 街道磚平鋪當地面，結果該磚可見幾何只佔格子中央一小塊，鋪出來變成「藍底散落灰方塊」很醜。**素材不合用時別硬湊**——最後改用程序生成的柏油貼圖（`DynamicTexture` 畫裂縫/血漬/黃線 + 平鋪），可靠又零相依。見 `game.ts` 的 `createGround`。

---

## 4. 換皮（reskin）流程清單

1. **盤點素材**：把包裡的 `Characters / Environment / Weapons / Vehicles` 列出來。
2. **做對應表**：舊概念 → 新素材。例：
   | 遊戲角色 | 用到的素材 |
   |---|---|
   | 玩家 | 持槍倖存者 `*_SingleWeapon` |
   | 怪海 | 4 種殭屍 |
   | 王 | 放大的胖殭屍／各類殭屍 |
   | 經驗寶石/寶箱 | 內嵌幾何 + `Chest.gltf` |
   | 場景 | 油桶/貨櫃/水塔/卡車… |
3. **逐系統替換模型路徑**（因為玩法與資產解耦，多半只改 `characters.ts`、`config`、各 system 的 `path` 字串）。
4. **文案換主題**（HUD 標題、選單、結算字）。
5. **音效**：用 Web Audio 程式合成即可零音檔（見 `sound.ts`）。
6. **型別檢查 + 本地測試**：`pnpm exec vue-tsc --noEmit` 後在 `pnpm dev` 實測。

---

## 5. 給「下一款新遊戲」的快速起步

1. `pnpm create vite`（Vue + TS）→ 裝 Babylon、Tailwind。
2. 先做**玩法骨架**（主迴圈、輸入、相機、一個會動的方塊），美術用程序幾何當 placeholder。
3. 確認好玩後再**接素材**：抓一個風格一致的 CC0 包，用上面第 2、3 節的方式接進來。
4. 維持「**資產層可抽換**」：模型路徑集中、渲染與數值分離，之後要換主題（換皮）成本極低。
5. 大量單位先想清楚 **thin instance vs 動畫池**，效能要在原型階段就壓測。
6. 部署：Cloudflare Pages（`wrangler pages deploy`）+ `_redirects` 做 SPA fallback。

> 一句總結：**玩法是資產，美術也是資產，但兩者要分層。** 把系統寫得跟模型無關，換皮就是換 `public/models/` 加改幾個字串而已。
