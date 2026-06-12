# 後端 Phase 1：全球排行榜與統計

純前端可正常運作（離線時自動回退 localStorage）。要啟用「全球」功能需建立 Cloudflare D1 並部署 Pages Functions。

## 架構
- **Pages Functions**（`functions/api/*.ts`）＝ 同源 `/api/*`，零 CORS。
- **D1**（SQLite）存排行榜 `runs` 與累計統計 `stats`。
- 前端 [`src/game/api.ts`](src/game/api.ts) 呼叫，失敗則回退本機。

## API
| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/run` | 送出一場結算（驗證後寫入並累加統計） |
| GET | `/api/leaderboard?limit=10` | 全球前 N（依存活時間） |
| GET | `/api/stats` | 全球累計（場次／時間／擊殺） |

## 一次性設定
```bash
# 1) 建立 D1 資料庫（記下回傳的 database_id）
wrangler d1 create animal-survivors-db

# 2) 把 database_id 填進 wrangler.jsonc 的 d1_databases[0].database_id

# 3) 建表（遠端正式庫）
wrangler d1 execute animal-survivors-db --file=./schema.sql --remote

# 4) 部署
pnpm build
wrangler pages deploy --branch=main
```

> 若 Pages 專案是用 Cloudflare 儀表板連 Git 自動部署，請改在
> Pages 專案 → Settings → Functions → D1 bindings 綁定 `DB` → `animal-survivors-db`。

## 本機測試（含 Functions / D1）
```bash
pnpm build
wrangler d1 execute animal-survivors-db --file=./schema.sql --local
wrangler pages dev dist        # 提供 /api/* 與本機 D1
```
（一般 `pnpm dev` 不會有 `/api`，前端會自動回退 localStorage，仍可正常開發遊戲本體。）

## 防作弊（基本）
[`functions/api/run.ts`](functions/api/run.ts) 對 time／kills／level／gold 做上限與合理性過濾。casual 遊戲採「軟驗證」，可接受少量偽造；要更嚴格可加事件簽章或回合驗證（Phase 3）。
