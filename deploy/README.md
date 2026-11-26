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

## 0.1 SSH 密钥（服务器与 GitHub）

生产机与 GitHub 都只走密钥，不使用密码：

```bash
# 本机生成专用密钥（无口令，便于自动化）
ssh-keygen -t ed25519 -a 100 -C "harnesspack-deploy" -f ~/.ssh/harnesspack_ed25519 -N ""
cat ~/.ssh/harnesspack_ed25519.pub
```

把公钥分别加到：

1. **阿里云密钥对**（控制台 → 密钥对 → 导入/创建 → 绑定实例后重启）。阿里云会把公钥写入默认用户（通常 root）的 `~/.ssh/authorized_keys`。
2. **GitHub**：<https://github.com/settings/ssh/new> → `Authentication key`，粘贴公钥。

本机 `~/.ssh/config` 建议：

```sshconfig
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/harnesspack_ed25519
  IdentitiesOnly yes

Host harnesspack
  HostName <服务器 IP>
  User root
  IdentityFile ~/.ssh/harnesspack_ed25519
  IdentitiesOnly yes
```

验证与切换：

```bash
ssh -T git@github.com                       # Hi <user>! You've successfully authenticated
ssh harnesspack "hostname"                  # 密钥登录成功
git remote set-url origin git@github.com:<owner>/harnesspack.git
git fetch origin                            # 走 SSH，无需密码
```

服务器端应保持：

```bash
sudo sshd -T | grep -Ei 'passwordauthentication|pubkeyauthentication|permitrootlogin'
# passwordauthentication no / pubkeyauthentication yes / permitrootlogin yes（按需调整）
```

部署脚本 `data/_cache/rsh.py` 支持 `SRV_KEY`（私钥路径），不再需要 `SRV_PW`：

```bash
SRV_HOST=<ip> SRV_KEY=~/.ssh/harnesspack_ed25519 python data/_cache/rsh.py run "hostname"
```

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
sudo systemctl enable --now harnesspack-capture.timer harnesspack-snapshot.timer harnesspack-backup.timer
systemctl status harnesspack-api --no-pager
curl -s http://127.0.0.1:8000/api/v1/health
```

抓取任务需要 GitHub token，放在 `/etc/harnesspack.env`（600 权限、root 所有）：

```bash
echo 'GITHUB_TOKEN=github_pat_xxx' | sudo install -m 600 /dev/stdin /etc/harnesspack.env
```

首次手动跑一次抓取、同步与备份：

```bash
sudo systemctl start harnesspack-capture.service     # 抓取 + 提交 + 入库，约 1–8 分钟
sudo systemctl start harnesspack-snapshot.service
sudo systemctl start harnesspack-backup.service
journalctl -u harnesspack-capture -n 50 --no-pager
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

## 7. 抓取调度：服务器直抓 + Actions 兜底

GitHub Actions 的 `schedule` 经常延迟数小时（00:10 UTC 的任务可能 06:40 才启动），所以主抓取放在服务器上，Actions 只作为兜底。

**服务器（主）**

- `harnesspack-capture.timer`：每天 UTC **00:10 / 01:40 / 03:10** 触发；
- `deploy/scripts/capture.sh`：拉目录 → `heal_seed` → `build_seed` → `snapshot_graphql --missing-only` → `validate` → 提交快照 → `cli ingest`；
- 提交使用 **Deploy key**（仓库 → Settings → Deploy keys，勾选 Allow write access），
  私钥放在 `/var/lib/harnesspack/.ssh/harnesspack_deploy`（即 harnesspack 用户的 home 下，**不在仓库目录内**）；
- token 放在 `/etc/harnesspack.env`，由 systemd `EnvironmentFile` 注入；
- 配额占用：12k 仓库约 123 个 GraphQL 请求 ≈ 123 points/次，PAT 每小时 5,000 points，三次重试约占 7%。

**GitHub Actions（兜底）**

- `.github/workflows/snapshot.yml` 仍是每天 00:10 UTC；当天快照已存在时走 `--missing-only`，只补缺失仓库；
- 若服务器抓取失败，Actions 晚些时候仍能把当天快照补上；两边提交都幂等，冲突时 rebase 重试。

**手工补抓**

```bash
sudo systemctl start harnesspack-capture.service
journalctl -u harnesspack-capture -n 80 --no-pager
```

## 8. 上线验收

```bash
curl -sI https://harnesspack.dev/ | head -1                    # 200
curl -s  https://harnesspack.dev/health                        # {"status":"ok",...}
curl -sI http://harnesspack.dev/ | head -1                     # 301
curl -s  https://harnesspack.dev/robots.txt | head -3
curl -s  https://harnesspack.dev/sitemap.xml | head -3
curl -s  https://harnesspack.dev/api/v1/dashboard | head -c 200
```

浏览器：`/`、`/?board=velocity`、`/plugins/anthropics-skills`、`/about`、`/changelog`、`/api`、`/community` 均能打开；移动端卡片列表正常。旧的独立榜单页与 `/sponsors`、`/submit` 等路径已移除。

## 9. 日常运维

- **更新代码**：服务器 `git pull --ff-only` 后 `sudo systemctl restart harnesspack-api`。前端有改动时先按第 3 步 rsync。
- **补数据**：`sudo systemctl start harnesspack-capture.service`（会抓取、提交并入库）；也可在 Actions 页面 `Run workflow`。
- **恢复备份**：`systemctl stop harnesspack-api` → 用 `backups/harnesspack-<date>.db` 覆盖 `data/harnesspack.db`（同时删 `-wal/-shm`）→ 重启。更彻底的做法是 `cli rebuild` 从快照重放。
- **日志**：`journalctl -u harnesspack-api -f`、`-u harnesspack-capture`、`-u harnesspack-snapshot`。
- **监控**：`/health` 返回 200；Nginx access log 观察 5xx；内存超 400MB 时先查 stats/连接数。

## 9.1 GitHub 登录与 API 限流

站点用 GitHub OAuth 区分 API 配额（会话是 HMAC 签名的 Cookie；社区首次发言时才懒创建 users 行）：

1. 在 GitHub → Settings → Developer settings → OAuth Apps 新建应用：
   - Homepage URL：`https://harnesspack.dev`
   - Redirect URIs（旧界面叫 Authorization callback URL；GitHub 2026-08 起改称 Redirect URIs，并支持多个）：`https://harnesspack.dev/api/auth/github/callback`
   - 只登记这一个精确地址；**不要开 Allow wildcard matching**（站点有 `/community/p/:id` 等 UGC 路由，通配会把 code 送到不可控路径）。
   - **不要勾 Enable Device Flow**：那是给 CLI / 无浏览器设备用的授权方式，本站是标准网页登录，用不到。
   - **Expire user access tokens 保持默认勾选**：本站换到 token 后立刻读一次 `/user`，只存自己的签名 Cookie，不保存 GitHub token，短期令牌没有影响。
2. 把凭据写入 `/etc/harnesspack-api.env`（`root:harnesspack`，`640`）：

   ```bash
   HARNESSPACK_SESSION_SECRET=<random-token>
   GITHUB_CLIENT_ID=<oauth-client-id>
   GITHUB_CLIENT_SECRET=<oauth-client-secret>
   ```

   会话密钥可用 `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'` 生成。
   三个值任一为空则登录入口自动隐藏，所有人按未登录配额计算。
   `HARNESSPACK_BASE_URL` 不写在这里，已在 `harnesspack-api.service` 中设为站点根地址；回调地址由它拼出，必须与 GitHub 后台登记的 Redirect URI 完全一致（含 `https`、域名、末尾 `/callback`，不带查询参数）。
3. `systemctl restart harnesspack-api`，`curl -s https://harnesspack.dev/api/auth/config` 应返回 `{"enabled":true}`。

配额：`/api/*` 未登录 20 次/分钟、100 次/天（按 IP）；已登录 50 次/分钟、500 次/天（按账号）。
普通页面、`/assets/` 和 `/og/` 使用原有宽松桶，不占 API 配额。超限返回 429 与 `Retry-After`。
社区读取另走独立宽松桶；发帖 5 次/分、50 次/天，评论 10 次/分、100 次/天，点赞 30 次/分、300 次/天；删除自己内容不占写额度。

## 10. Cloudflare（当前已启用）

`harnesspack.dev` 的 DNS 托管在 Cloudflare 并开启了代理（橙云），SSL 模式为 **Full**：
Cloudflare 回源到本机 443，Nginx 使用 Let's Encrypt 证书（已签发，2027-02 到期，自动续期）。

- HTTP-01 校验可以穿过 Cloudflare 代理：ACME 请求走 `http://harnesspack.dev/.well-known/acme-challenge/`
  → Cloudflare 回源 80 → Nginx 直接响应 webroot 文件，`certbot renew --dry-run` 已通过。
- 若要升级到 **Full (strict)**：在 Cloudflare 控制台生成 Origin Certificate（15 年），
  替换 Nginx 的 `ssl_certificate/ssl_certificate_key` 即可，无需重新签发 LE。
- 保持 `Always Use HTTPS` 开启；站点自身的 80→443 跳转与之不冲突。

### 动态路由（badge / og / feed / 页面 SEO）

Nginx 需要把下列路径反代到 API，否则会落到静态 index.html：

    location /badge/   { proxy_pass http://harnesspack_api; }
    location /og/      { proxy_pass http://harnesspack_api; }
    location = /feed.xml { proxy_pass http://harnesspack_api; }
    location /plugins/ { proxy_pass http://harnesspack_api; }
    location /         { proxy_pass http://harnesspack_api; }   # 其余页面由 API 渲染

`location /` 兜底给 API 是必要的：首页、榜单、分类、about 等页面的
title / description / canonical / JSON-LD 都是 API 按路由注入的；静态
index.html 里只有默认文案。`/assets/` 与 `/vendor/` 仍然由 Nginx 直接
静态返回，继续享受长缓存。

服务器上实际启用的站点文件是 sites-enabled/harnesspack.dev.tls，改完
deploy/nginx/harnesspack.dev.conf 后要同步覆盖该文件再
`nginx -t && systemctl reload nginx`。

### Cloudflare 缓存

/badge/*.svg 与 /og/*.png 扩展名会被 Cloudflare 默认按静态资源缓存；首次上线或改版后，
如果返回的是 HTML，需要在 Cloudflare 后台 Purge Cache（或对这两个路径规则设为 Bypass Cache）。


## 11. 邮件：订阅日报与内存告警

出站邮件统一走 SMTP 环境变量（QQ 邮箱 SMTP 等），凭据放在服务器本地文件，
不入仓库：

```bash
sudo tee /etc/harnesspack-mail.env >/dev/null <<'ENV'
HARNESSPACK_SMTP_HOST=smtp.qq.com
HARNESSPACK_SMTP_PORT=465
HARNESSPACK_SMTP_USER=honglicha@qq.com
HARNESSPACK_SMTP_PASSWORD=授权码
HARNESSPACK_SMTP_FROM=HarnessPack <honglicha@qq.com>
HARNESSPACK_ALERT_EMAIL=收告警的邮箱
ENV
chmod 600 /etc/harnesspack-mail.env
```

`HARNESSPACK_SMTP_HOST` 为空时所有发信命令直接跳过，不影响站点。

### 每日 Top10 日报（B2）

- 订阅入口 `/subscribe`（双确认：先收确认邮件，点链接才生效），退订链接带 token。
- 单元：`deploy/systemd/harnesspack-digest.{service,timer}`，每天 09:00（UTC+8）发一次；
  同日重复触发由 `digest_log` 表去重，不会双发。

```bash
sudo cp deploy/systemd/harnesspack-digest.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now harnesspack-digest.timer
# 手动试发：sudo systemctl start harnesspack-digest.service
# 强制重发（跳过当日已发记录）：.venv/bin/python -m backend.app.cli send-digest --force
```

### 内存告警（C5）

- 单元：`deploy/systemd/harnesspack-memalert.{service,timer}`，每 10 分钟
  `systemctl show harnesspack-api -p MemoryCurrent` 采样一次。
- 连续 3 次（可调 `--consecutive`）超过 300MB（`--threshold-mb`）才发一封告警，
  回落后发恢复通知；状态存 `/var/lib/harnesspack/memalert.json`。

```bash
sudo cp deploy/systemd/harnesspack-memalert.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now harnesspack-memalert.timer
```

### 部署后冒烟（C4）

```bash
# 路由 + health 全检；第二个参数是本次前端 JS hash（可选）
deploy/scripts/smoke.sh https://harnesspack.dev index-XXXXXXXX.js
```

### 必应 IndexNow（D1）

- `HARNESSPACK_INDEXNOW_KEY` 设一个 32 位十六进制 key（`openssl rand -hex 16`）后，
  站点会自动挂出 `/<key>.txt` 验证文件，CLI 才会真正推送；不设则全部跳过。
- CLI：`python -m backend.app.cli indexnow`（同日幂等，`--force` 强制重推）。
- 推送内容：首页/changelog/about/api/community/compare/subscribe + 增量榜 Top200
  + 近 3 天新收录插件，上限 500 条；`push_log` 表记录每日结果。
- 单元：`deploy/systemd/harnesspack-indexnow.{service,timer}`，每天 10:30（UTC+8）推一次。

```bash
sudo cp deploy/systemd/harnesspack-indexnow.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now harnesspack-indexnow.timer
```

### 必应 IndexNow（D1）

- `HARNESSPACK_INDEXNOW_KEY` 设一个 32 位十六进制 key（`openssl rand -hex 16`）后，
  站点会自动挂出 `/<key>.txt` 验证文件，CLI 才会真正推送；不设则全部跳过。
- CLI：`python -m backend.app.cli indexnow`（同日幂等，`--force` 强制重推）。
- 推送内容：首页/changelog/about/api/community/compare/subscribe + 增量榜 Top200
  + 近 3 天新收录插件，上限 500 条；`push_log` 表记录每日结果。
- 单元：`deploy/systemd/harnesspack-indexnow.{service,timer}`，每天 10:30（UTC+8）推一次。

```bash
sudo cp deploy/systemd/harnesspack-indexnow.* /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now harnesspack-indexnow.timer
```
