# HarnessPack

只收录 **DeepSeek Harness（DSH）插件** 的 **Star 竞速榜**：每天抓一次 star，按日增、周/月增速、总 star、名次跃升、新秀排出榜单，曲线可查。

> 当前阶段：Phase 0（数据地基）+ Phase 1（只读 API + Web 前端）。押注、账号、推荐位在后续阶段。

## 目录

| 路径 | 作用 |
| --- | --- |
| `data/catalog/latest.json` | 从 awesome-dsh-plugin 同步的名单与分类（CC0-1.0） |
| `data/plugins.seed.json` | 入库名单（由 catalog 生成，按仓库去重，约 1.1 万个） |
| `data/snapshots/YYYY-MM-DD.json` | 每日快照，由 Actions 提交进 git，是唯一事实源 |
| `scripts/vendor_catalog.py` | 同步上游名单（plugins.json），记录增删变更 |
| `scripts/build_seed.py` | 由 catalog 生成入库名单 |
| `scripts/snapshot_graphql.py` | 批量抓取器（GitHub GraphQL，100 仓库/请求） |
| `scripts/snapshot.py` | 单仓抓取兜底（REST，退避/失败隔离） |
| `scripts/validate.py` | 快照与名单校验 |
| `backend/app` | FastAPI + SQLite（导入、榜单、/api/v1） |
| `backend/tests` | pytest |
| `frontend/` | React + TS + Vite + Tailwind，构建产物由后端托管 |
| `docs/需求分析.md` | 系统架构与功能需求 |
| `docs/收录规则.md` | 名单来源（上游清单）与退出机制 |
| `docs/adr/` | 架构决策记录 |
| `deploy/` | Nginx、systemd、同步/备份脚本与部署手册 |

## 本地运行

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt

# 把 data/snapshots/*.json 导入 SQLite（幂等）
.venv\Scripts\python -m backend.app.cli ingest

# 启动 API（前端构建产物存在时同端口托管）
.venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000
```

打开 <http://127.0.0.1:8000/docs> 查看 OpenAPI。

## 前端

```powershell
cd frontend
pnpm install
pnpm dev          # http://127.0.0.1:5173，/api 代理到 8000
pnpm build        # 产出 frontend/dist，由 FastAPI 同端口托管
```

页面：`/` 首页、`/rankings/{board}` 五个榜单、`/categories` 分类榜（23 类）、`/plugins/{slug}` 详情与曲线、`/about` 数据口径、`/sponsors` 推荐位说明。

## 抓取

```powershell
$env:GITHUB_TOKEN = "<fine-grained PAT, public repos read-only>"
python scripts/vendor_catalog.py      # 同步 awesome-dsh-plugin 名单
python scripts/build_seed.py          # 重建 seed
python scripts/snapshot_graphql.py    # 全量快照（约 120 次 GraphQL 请求）
python scripts/validate.py            # 校验
```

- 未认证只有 60 次/小时，跑不满上万仓库；GraphQL 批量抓取必须提供 token（PAT 5000 点/小时足够）。
- 每天 00:10 UTC 由 `.github/workflows/snapshot.yml` 自动执行；漏跑可手动 `workflow_dispatch`。

## API（v1）

```
GET /api/v1/health
GET /api/v1/dashboard
GET /api/v1/rankings/{velocity|growth|total|darkhorse|rookie}?window=7|30&limit&offset
GET /api/v1/plugins?query=&harness=&category=&limit&offset
GET /api/v1/plugins/{slug}
GET /api/v1/plugins/{slug}/series?days=90
GET /api/v1/compare?slugs=a,b[,c]
GET /api/v1/sponsors
```

列表统一返回 `{items, total, as_of}`；`growth` / `darkhorse` 需要恰好的基准日快照，缺失时返回空列表与 `reason`。

## 部署

上线目标：`https://harnesspack.dev`（单台 2C1G 海外服务器，Nginx + systemd + SQLite）。
步骤见 [deploy/README.md](deploy/README.md)：DNS → 系统用户 → venv → rsync 前端产物 → systemd → Nginx/TLS → 验收。
服务器只拉快照，不持有 GitHub token；快照缺失不补、不猜。


## 徽章、分享图与订阅

- README 徽章：![](https://harnesspack.dev/badge/<slug>.svg)，显示总榜名次与今日增量。
- 分享图：https://harnesspack.dev/og/<slug>.png（1200×630，服务端生成并缓存）。
- RSS：https://harnesspack.dev/feed.xml（竞速榜前 20 + 最近名单变更）。
- 提交插件：https://harnesspack.dev/submit，名单与分类以上游 awesome-dsh-plugin 为准。

## 数据口径

- 日期一律 UTC；每个快照记录当天 `stargazers_count`。
- `delta` = 与上一次观测的差值，`delta_span_days` 记录真实间隔（允许缺日）。
- 异常标记：`delta > max(5 × 近 7 次日增均值, 20)` 且历史 ≥ 3 次时标记 `is_anomaly`，不删除、不参与真实均值。
- 增速榜要求基准日 star ≥ 50，避免小数分母失真。
- 缺失快照不补、不猜：榜单为空并给出原因。

## 许可与使用条款

- 代码：MIT，见 `LICENSE`。
- 每日快照（`data/snapshots/`）：CC BY 4.0，转载需署名并链接 `https://harnesspack.dev`，详见 `DATA-LICENSE.md`。
- 站点文案、图表与模板：CC BY-NC 4.0，禁止整体复制成竞争站点。
- API 默认每 IP 每分钟 120 次（`/og/` 20 次），超限返回 `429` + `Retry-After`；批量数据请直接读仓库里的快照文件。
- 完整条款：https://harnesspack.dev/about/terms


