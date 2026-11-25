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

核心页面：`/` 榜单（通过 `?board=`、`?view=directory` 等查询参数切换榜单/分类/插件库视图）、`/community` DSH 讨论区（`/community/p/{id}` 详情、`/community/u/{login}` 用户页）、`/api` API 说明。功能页：`/plugins/{slug}` 详情与曲线、`/compare` 插件对比（弹窗搜索选插件）、`/changelog` 名单变更与数据状态（含最近抓取、失败清单）。描述性内容统一收在 `/about`，以锚点分区：站点简介、收录规则、插件提交、数据口径、使用条款。旧的独立描述页、榜单页、插件库页与 `/submit`、`/sponsors` 等路径已移除。

### SEO

SPA 的抓取信息由后端注入（`backend/app/main.py` 的 SPA handler + `backend/app/seo.py`），不依赖 JS：

- 每个公开路由都有独立的 `<title>`、`meta description`、canonical 与 Open Graph / Twitter 卡片；
- 首页注入 WebSite + Dataset JSON-LD，榜单注入 ItemList，插件详情注入 SoftwareApplication + BreadcrumbList；
- 未知插件/榜单/分类返回 404 + `noindex`，`/compare` 恒为 `noindex`（参数页）；
- 首页与通用页共用 `/og/site.png`（1200×630，按快照日缓存）；
- `sitemap.xml` 覆盖全部在册插件、六个榜单、23 个分类与静态页；`robots.txt` 禁止抓取 `/api/`。

## 抓取

```powershell
$env:GITHUB_TOKEN = "<fine-grained PAT, public repos read-only>"
python scripts/vendor_catalog.py      # 同步 awesome-dsh-plugin 名单
python scripts/build_seed.py          # 重建 seed
python scripts/snapshot_graphql.py    # 全量快照（约 120 次 GraphQL 请求）
python scripts/validate.py            # 校验
```

- 未认证只有 60 次/小时，跑不满上万仓库；GraphQL 批量抓取必须提供 token（PAT 5000 点/小时足够）。
- 每天 00:10 UTC 由 `.github/workflows/snapshot.yml` 自动执行；漏跑可在 Actions 页面 `Run workflow`，`date` 填要补的 UTC 日期（留空 = 今天）。

### 限流与续抓

全量快照是约 120 次 GraphQL 批请求。GitHub 除了每小时的额度，还有「短时间打太多」的次要限流（官方建议批请求之间留间隔），所以 `scripts/snapshot_graphql.py` 不再一口气打满：

- 每批之间默认停 1 秒（`--delay`），避免触发次要限流；
- 每 10 批（`--flush-every`）把已抓记录落盘；遇到 429 / `rate limit` 时按 `retry-after` 或 `x-ratelimit-reset` 等待后继续，等待超过 `--max-wait` 就先保存再以退出码 3 结束；
- 退出码 3 不丢数据：workflow 仍会提交已经抓到的部分快照，之后同一天重跑时 `--missing-only` 只补缺失的仓库，已完成的不会重抓；
- 快照未完成或校验失败时 run 仍然会失败（`::error::snapshot fetch or validation did not finish`），避免把残缺数据当成完整快照。

token 额度：workflow 优先用 `secrets.SNAPSHOT_TOKEN`（个人 PAT，GraphQL 5,000 点/小时）；没配置时回退到 `GITHUB_TOKEN`，而它只有 1,000 点/小时，全量抓取更容易触顶，建议配置 `SNAPSHOT_TOKEN`。

### 快照监控

`scripts/check_snapshot.py` 检查指定日期（默认今天 UTC）的快照是否存在、ok 率是否 ≥99%、是否覆盖完整 seed、历史有没有断档。`.github/workflows/snapshot-monitor.yml` 每天 01:30 / 04:30 UTC 各跑一次，异常时自动开 issue（已有同类 issue 则追加评论）并让本次 run 失败——这样你会同时收到 issue 通知和 GitHub 的失败邮件。

```powershell
python scripts/check_snapshot.py                      # 检查今天
python scripts/check_snapshot.py --date 2026-11-20    # 检查指定日期
```

> 注意：GitHub 对 60 天没有提交的仓库会暂停定时工作流；如果长期不动代码，记得每月手动跑一次 `workflow_dispatch` 或提交一次小改动。

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

# 社区（读公开，写需 GitHub 登录）
GET/POST /api/community/posts
GET/DELETE /api/community/posts/{id}
GET /api/community/posts/{id}/comments
POST /api/community/posts/{id}/comments
DELETE /api/community/comments/{id}
POST /api/community/posts/{id}/like
GET /api/community/users/{login}
```

v1 列表统一返回 `{items, total, as_of}`（社区列表返回 `{items, total}`）；`growth` / `darkhorse` 需要恰好的基准日快照，缺失时返回空列表与 `reason`。

## DSH 讨论区

只发文字，GitHub 账号登录即可发言，没有等级和积分。正文里的 `@owner/name` 或插件详情页链接会带出本地插件卡片，写不存在的插件不会有卡片；作者可随时删掉自己的帖子和评论。

- 读取走社区独立限流桶；发帖 5 次/分、50 次/天，评论与点赞各自独立额度，删除自己内容不受写额度限制。
- 广告、人身攻击、与 DSH 无关的内容可下架（不物理删除）：
  `python -m backend.app.cli community hide post <id>` / `community unhide comment <id>`。
- 登录依赖 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`HARNESSPACK_SESSION_SECRET` 与 `HARNESSPACK_BASE_URL`（OAuth 回调地址由 base URL 拼出）。

## 部署

上线目标：`https://harnesspack.dev`（单台 2C1G 海外服务器，Nginx + systemd + SQLite）。
步骤见 [deploy/README.md](deploy/README.md)：DNS → 系统用户 → venv → rsync 前端产物 → systemd → Nginx/TLS → 验收。
服务器只拉快照，不持有 GitHub token；快照缺失不补、不猜。


## 徽章、分享图与订阅

- README 徽章：![](https://harnesspack.dev/badge/<slug>.svg)，显示总榜名次与今日增量。
- 分享图：https://harnesspack.dev/og/<slug>.png（1200×630，服务端生成并缓存）。
- RSS：https://harnesspack.dev/feed.xml（竞速榜前 20 + 最近名单变更）。
- 提交插件：https://harnesspack.dev/about#submit，名单与分类以上游 awesome-dsh-plugin 为准。

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
- 完整条款：https://harnesspack.dev/about#terms


