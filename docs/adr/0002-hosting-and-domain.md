# ADR 0002：托管、域名与部署形态

状态：已接受（2026-11-19）

## 背景

Phase 0 数据管线与只读 API 已在本地跑通（100 仓快照、SQLite、`/api/v1`、React SPA）。
用户提供了域名 `harnesspack.dev` 与一台 2C1G 海外服务器，要求尽快上线可访问的只读 MVP。

## 决策

1. **单机部署**：Nginx（TLS、静态、`/api` 反代）+ systemd（uvicorn 单 worker、每日同步、每日备份）+ SQLite WAL。
2. **品牌统一为 HarnessPack**：站点名、包名、文档、环境变量 `HARNESSPACK_*` 全部改名；域名 `harnesspack.dev` 与品牌一致。
3. **仓库公开**：快照与收录变更可审计，符合「数据可信」定位；Actions 用内置 token。
4. **前端不在服务器构建**：构建产物由本地/CI 生成后 rsync 到 `/opt/harnesspack/frontend/dist`，避免 1G 内存 OOM。
5. **TLS 用 Let's Encrypt webroot + 自动续期 deploy hook**；域名已接入 Cloudflare 代理（SSL 模式 Full），HTTP-01 可穿过代理回源 80，续期已验证。后续可换 Cloudflare Origin Certificate 升级到 Full (strict)。
6. **数据同步单向下行**：Actions 抓取 → git 提交 → 服务器 `git pull` + `validate` + `ingest`，服务器不持有 GitHub token。

## 后果

- 部署步骤明确、可重复，见 `deploy/README.md`；服务器不跑构建、不写 GitHub。
- 数据库可随时由 `data/snapshots/` 全量重建，备份只保留 14 天滚动副本。
- 品牌改名一次到位，避免域名与站点名长期不一致的 SEO 与记忆成本。
- 2C1G 上 uvicorn 单 worker + SQLite 足够只读阶段；触发迁移的条件（RSS 持续 > 300MB 或并发明显上升）写入需求分析 §3.5。

## 备选方案

- Docker Compose：多一层运行时与内存开销，2C1G 不划算。
- 静态托管 + Serverless API：押注/结算/定时任务需要长驻进程，迁移成本高。
- 服务器直接抓 GitHub：token 落生产机、抓取故障影响站点，已由 A 轨替代。
