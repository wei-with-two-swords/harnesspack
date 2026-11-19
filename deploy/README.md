# HarnessPack 部署手册

目标：单台 2C1G 海外服务器（默认 Ubuntu 22.04/24.04）承载 `https://harnesspack.dev`。
前端静态由 Nginx 提供，`/api/` 反代到本机 uvicorn；数据由 GitHub Actions 每日提交快照，服务器定时 `git pull` + 导入。

```
/opt/harnesspack
├── backend/            应用代码（git）
├── frontend/dist/      前端构建产物（rsync 上传，不入库）
├── data/snapshots/     每日快照（git）
├── data/harnesspack.db SQLite（不入库）
├── backups/            每日 .backup（保留 14 天）
├── .venv/              Python 虚拟环境
└── deploy/             Nginx / systemd / 脚本（git）
```

## 0. DNS

在域名注册商或 Cloudflare 添加：

| 类型 | 名称 | 值 |
|---|---|---|
| A | `@` | 服务器公网 IP |
| CNAME | `www` | `harnesspack.dev` |

等 `dig +short harnesspack.dev` 返回服务器 IP 再做证书。

## 1. 系统用户与目录

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin harnesspack
sudo mkdir -p /opt/harnesspack /var/www/certbot
sudo chown -R harnesspack:harnesspack /opt/harnesspack
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip git nginx sqlite3 certbot rsync
```

## 2. 拉代码与 Python 依赖

```bash
sudo -u harnesspack -H bash -c '
  git clone https://github.com/<owner>/harnesspack.git /opt/harnesspack
  cd /opt/harnesspack
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r backend/requirements.txt
'
```

私有镜像/部署 key 加分：仓库公开时无需凭据；如需 deploy key，把公钥加到仓库 Deploy keys，私钥放 `/home/harnesspack/.ssh/id_ed25519`（`chmod 600`），并在 `~/.ssh/config` 指定 `github.com`。

## 3. 前端产物（服务器不跑 vite build，1G 内存易 OOM）

在本地或 CI：

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm build
rsync -avz frontend/dist/ <user>@<server>:/opt/harnesspack/frontend/dist/
```

上传后属主应为 `harnesspack`。

## 4. 初始化数据库

```bash
cd /opt/harnesspack
sudo -u harnesspack .venv/bin/python -m backend.app.cli rebuild
sudo -u harnesspack .venv/bin/python -m backend.app.cli stats
```

`rebuild` 会从 `data/snapshots/` 全量重放；首次可看到 `plugins 100 / stars 1 / days 1`。

## 5. systemd

```bash
sudo cp deploy/systemd/harnesspack-*.service deploy/systemd/harnesspack-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now harnesspack-api.service
sudo systemctl enable --now harnesspack-snapshot.timer harnesspack-backup.timer
systemctl status harnesspack-api --no-pager
curl -s http://127.0.0.1:8000/api/v1/health
```

首次手动跑一次同步与备份：

```bash
sudo systemctl start harnesspack-snapshot.service
sudo systemctl start harnesspack-backup.service
journalctl -u harnesspack-snapshot -n 50 --no-pager
```

## 6. Nginx 与 TLS

```bash
sudo cp deploy/nginx/harnesspack.dev.conf /etc/nginx/sites-available/harnesspack.dev
sudo ln -sf /etc/nginx/sites-available/harnesspack.dev /etc/nginx/sites-enabled/harnesspack.dev
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 首次签发（Nginx 已经能响 80 端口的 acme-challenge）
sudo certbot certonly --webroot -w /var/www/certbot \
  -d harnesspack.dev -d www.harnesspack.dev \
  --email <you>@example.com --agree-tos --no-eff-email
sudo nginx -t && sudo systemctl reload nginx

# 若先跑过 HTTP-only 配置（deploy/nginx/harnesspack.dev.http.conf），
# 签完证书后把 sites-available/harnesspack.dev 换成 harnesspack.dev.conf 再 reload。

# 续期后自动 reload
sudo install -m 755 deploy/scripts/certbot-deploy.sh /etc/letsencrypt/renewal-hooks/deploy/harnesspack.sh
sudo certbot renew --dry-run
```

## 7. GitHub 仓库与 Actions

- 仓库设为 **Public**，默认分支 `main`。
- Actions 用内置 `GITHUB_TOKEN`（`permissions: contents: write`）即可，无需额外 secret。
- 每天 UTC 00:10 由 `.github/workflows/snapshot.yml` 抓取并提交 `data/snapshots/YYYY-MM-DD.json`；服务器 00:20 同步。
- 漏跑：在 Actions 页面 `Run workflow` 手动补跑；服务器下次 `git pull` 自动接上，缺失日期不伪造。

## 8. 上线验收

```bash
curl -sI https://harnesspack.dev/ | head -1                    # 200
curl -s  https://harnesspack.dev/health                        # {"status":"ok",...}
curl -sI http://harnesspack.dev/ | head -1                     # 301
curl -s  https://harnesspack.dev/robots.txt | head -3
curl -s  https://harnesspack.dev/sitemap.xml | head -3
curl -s  https://harnesspack.dev/api/v1/dashboard | head -c 200
```

浏览器：`/`、`/rankings/velocity`、`/rankings/total`、`/plugins/anthropics-skills`、`/about`、`/sponsors` 均能打开；移动端卡片列表正常。

## 9. 日常运维

- **更新代码**：服务器 `git pull --ff-only` 后 `sudo systemctl restart harnesspack-api`。前端有改动时先按第 3 步 rsync。
- **补数据**：本机 `GITHUB_TOKEN=... python scripts/snapshot.py --missing-only`，提交快照后服务器同步。
- **恢复备份**：`systemctl stop harnesspack-api` → 用 `backups/harnesspack-<date>.db` 覆盖 `data/harnesspack.db`（同时删 `-wal/-shm`）→ 重启。更彻底的做法是 `cli rebuild` 从快照重放。
- **日志**：`journalctl -u harnesspack-api -f`、`-u harnesspack-snapshot`。
- **监控**：`/health` 返回 200；Nginx access log 观察 5xx；内存超 400MB 时先查 stats/连接数。

## 10. Cloudflare（当前已启用）

`harnesspack.dev` 的 DNS 托管在 Cloudflare 并开启了代理（橙云），SSL 模式为 **Full**：
Cloudflare 回源到本机 443，Nginx 使用 Let's Encrypt 证书（已签发，2027-02 到期，自动续期）。

- HTTP-01 校验可以穿过 Cloudflare 代理：ACME 请求走 `http://harnesspack.dev/.well-known/acme-challenge/`
  → Cloudflare 回源 80 → Nginx 直接响应 webroot 文件，`certbot renew --dry-run` 已通过。
- 若要升级到 **Full (strict)**：在 Cloudflare 控制台生成 Origin Certificate（15 年），
  替换 Nginx 的 `ssl_certificate/ssl_certificate_key` 即可，无需重新签发 LE。
- 保持 `Always Use HTTPS` 开启；站点自身的 80→443 跳转与之不冲突。

