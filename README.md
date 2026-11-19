# HarnessPack

给 Claude Code / Codex / Cursor / DSH 等 harness 生态里的插件做的 **Star 竞速榜**：每天抓一次 star，按日增、周/月增速、总 star、名次跃升、新秀排出榜单，曲线可查。

> 当前阶段：Phase 0（数据地基）+ Phase 1（只读 API + Web 前端）。押注、账号、推荐位在后续阶段。

## 目录

| 路径 | 作用 |
| --- | --- |
| `data/plugins.seed.json` | 入选名单（100 个仓库，人工复核） |
| `data/snapshots/YYYY-MM-DD.json` | 每日快照，由 Actions 提交进 git，是唯一事实源 |
| `scripts/snapshot.py` | 抓取器（GitHub REST，ETag/退避/失败隔离） |
| `scripts/validate.py` | 快照与名单校验 |
| `backend/app` | FastAPI + SQLite（导入、榜单、/api/v1） |
| `backend/tests` | pytest |
| `frontend/` | React + TS + Vite + Tailwind，构建产物由后端托管 |
| `docs/需求分析.md` | 系统架构与功能需求 |
| `docs/收录规则.md` | 100 名单的进入、退出与替换机制 |
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

页面：`/` 首页、`/rankings/{board}` 五个榜单、`/plugins/{slug}` 详情与曲线、`/about` 数据口径、`/sponsors` 推荐位说明。

## 抓取

```powershell
$env:GITHUB_TOKEN = "<fine-grained PAT, public repos read-only>"
python scripts/snapshot.py            # 全量 100 个仓库
python scripts/validate.py            # 校验
```

- 未认证只有 60 次/小时，跑不满 100 个仓库，必须提供 token。
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

## 数据口径

- 日期一律 UTC；每个快照记录当天 `stargazers_count`。
- `delta` = 与上一次观测的差值，`delta_span_days` 记录真实间隔（允许缺日）。
- 异常标记：`delta > max(5 × 近 7 次日增均值, 20)` 且历史 ≥ 3 次时标记 `is_anomaly`，不删除、不参与真实均值。
- 增速榜要求基准日 star ≥ 50，避免小数分母失真。
- 缺失快照不补、不猜：榜单为空并给出原因。
