# VPS deployment (Hostinger) — API + PostgreSQL + SPA

This runbook assumes Ubuntu 22.04+ on the VPS, a single host serving the built Vite app and proxying `/api` and `/media` to Node.

## 1. PostgreSQL

Install Postgres, create a database and user, then set `DATABASE_URL`, for example:

`postgresql://cushy:STRONG_PASSWORD@127.0.0.1:5432/cushy`

Apply schema from the app server:

```bash
cd /var/www/cushy-crafts-store/server
export DATABASE_URL="postgresql://…"
npm ci
npm run db:migrate
```

Enable daily backups (example cron):

`0 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/cushy-$(date +\%F).sql.gz`

## 2. API process (Fastify)

Build and run (or use `tsx` only for testing):

```bash
cd /var/www/cushy-crafts-store/server
npm ci
npm run build
```

Required environment (e.g. `/etc/cushy-api.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Long random string for signing session JWT |
| `FRONTEND_ORIGIN` | Production origin, e.g. `https://yourdomain.com` (CORS + cookie `SameSite`) |
| `PORT` | Listen port, e.g. `3001` |
| `UPLOAD_DIR` | Absolute path for uploaded files (default relative `uploads/` in server cwd) |
| `FIRST_ADMIN_EMAIL` | Optional: first registered user with this email gets `admin` role |
| `COOKIE_SECURE` | Set `true` in production (HTTPS only cookies) |

Example systemd unit `/etc/systemd/system/cushy-api.service`:

```ini
[Unit]
Description=Cushy Crafts API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/cushy-crafts-store/server
EnvironmentFile=/etc/cushy-api.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cushy-api
```

## 3. Nginx + TLS

- Point certbot at your domain for Let’s Encrypt certificates.
- Serve `dist/` from the frontend build at `/`.
- Proxy `/api/` to `http://127.0.0.1:3001` (preserve path).
- Proxy or alias `/media/` to files: either `alias` the same directory as `UPLOAD_DIR`, or serve only via the API static plugin.

Example location blocks:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /media/ {
  alias /var/www/cushy-uploads/;
}
```

Frontend build:

```bash
cd /var/www/cushy-crafts-store
npm ci
# Optional if API is on another subdomain: VITE_API_URL=https://api.example.com
npm run build
```

Point Nginx `root` to `dist`.

## 4. Cutover from Firebase

1. Run Firestore → Postgres ETL on a staging DB, validate counts and sample orders.
2. Deploy API + run migrations on production DB.
3. Run ETL against production (see `npm run etl:firestore` in `server/`), with optional `MEDIA_URL_PREFIX_OLD` / `MEDIA_URL_PREFIX_NEW` for image URL rewrites.
4. For Auth: use `--with-auth` and `MIGRATION_DEFAULT_PASSWORD` **only** with a coordinated password-reset or known temporary password policy; otherwise import catalog-only and use stub users, then invite users to reset.
5. Switch DNS / env: ensure production SPA uses correct `VITE_API_URL` if cross-origin.
6. Monitor API logs and order creation; verify stock levels after migration.

## 5. Secrets hygiene

- Never commit `.env` with `JWT_SECRET` or `DATABASE_URL`.
- Root `VITE_*` variables are public in the browser; only put non-secret API base URLs there.
