# MOE Result Telegram Bot

Telegram bot that directs students to 2018 Remedial and Entrance results, with channel-join gating, a web admin dashboard, analytics, and mass broadcast.

Simple layout for **cPanel Node.js** hosting: one `server.js`, `package.json`, prebuilt `public/` admin, and `node_modules`.

## Stack

- **Bot + API:** Node.js (plain JavaScript), grammY, Fastify
- **Database:** MySQL (`mysql2`) — set up in phpMyAdmin
- **Admin UI:** React (built into `public/` before deploy)

No TypeScript, Prisma, or Redis required.

## Project layout

```
server.js       # bot + API (startup file)
package.json
.env            # or set vars in cPanel
public/         # prebuilt admin dashboard
node_modules/   # from npm install
sql/            # phpMyAdmin scripts (not required at runtime)
admin/          # admin source (local only — build into public/)
```

## Database setup (phpMyAdmin)

See [`sql/README.md`](sql/README.md).

1. Link MySQL user to database with **ALL PRIVILEGES**
2. Run [`sql/init.sql`](sql/init.sql)
3. Run [`sql/create-admin.sql`](sql/create-admin.sql) (login: `admin@example.com` / `changeme`)

## Local development

```bash
cp .env.example .env
# edit BOT_TOKEN, DATABASE_URL, JWT_SECRET

npm install
cd admin && npm install && cd ..
npm run build:admin
npm start
```

- API + bot: http://localhost:3000
- Admin dashboard: http://localhost:3000 (same origin)

For admin UI hot-reload while developing:

```bash
# terminal 1
npm start

# terminal 2
cd admin && npm run dev
```

Admin dev server proxies `/api` to port 3000.

### Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `BOT_TOKEN` | yes | From [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | yes | `mysql://user:pass@host:3306/db` (use `localhost` on cPanel) |
| `JWT_SECRET` | yes | At least 16 characters |
| `PORT` | no | Default `3000` |
| `NODE_ENV` | no | `development` or `production` |
| `WEBHOOK_URL` | no | Set in production for webhook mode |
| `WEBHOOK_SECRET` | no | Optional Telegram webhook secret |
| `CHANNEL_CHAT_ID` | no | Optional default; usually set in admin Settings |

URL-encode special characters in the MySQL password (`{` → `%7B`, `}` → `%7D`, `&` → `%26`).

## Deploy to cPanel

### 1. Build admin locally

**Same domain as API** (admin served from `public/` on the Node app):

```bash
cd admin
npm install
npm run build
cd ..
```

**Separate admin subdomain** (e.g. `botpanel.entrancetricks.com` → API at `resultbotapi.entrancetricks.com`):

```bash
cd admin
npm install
# admin/.env.production must set VITE_API_URL=https://resultbotapi.entrancetricks.com
npm run build
cd ..
```

Upload the contents of `admin/dist/` to the admin subdomain document root.

On the **API server**, set in cPanel environment variables:

```env
ADMIN_ORIGIN=http://botpanel.entrancetricks.com
```

(`server.js` accepts both `http://` and `https://` for the admin origin.)

This writes static files to `admin/dist/` (or `public/` if you copy them for same-origin hosting).

### 2. Upload these files/folders

- `server.js`
- `package.json`
- `public/` (entire folder)
- `.env` (optional — you can set variables in the cPanel UI instead)

Do **not** upload `admin/`, `sql/`, or `src/` (there is no `src/` anymore).

### 3. Create the Node.js app in cPanel

| Setting | Value |
|---------|--------|
| Application root | your app folder (e.g. `resultbotapi.entrancetricks.com`) |
| Application startup file | **`server.js`** |
| Node.js version | 18+ or 20+ |

Click **Run NPM Install**, set environment variables, then **Restart**.

### 4. Environment on the server

Use `localhost` for MySQL when the app and database are on the same host:

```env
DATABASE_URL=mysql://USER:URL_ENCODED_PASSWORD@localhost:3306/your_database
BOT_TOKEN=...
JWT_SECRET=...
NODE_ENV=production
PORT=3000
WEBHOOK_URL=https://resultbotapi.entrancetricks.com
ADMIN_ORIGIN=http://botpanel.entrancetricks.com
```

For webhook mode, set `WEBHOOK_URL` to your app’s public HTTPS URL (no trailing path). The bot registers `/webhook` automatically.

### 5. Verify

- Health: `https://your-domain/api/health` → `{"ok":true,"database":"connected"}`
- Admin: open `https://your-domain/` and sign in
- Ensure the `uploads/broadcasts/` folder exists next to `server.js` and is writable (created automatically on first start; do not delete on deploy)

## Channel setup

1. Create your official Telegram channels (one for remedial, one for entrance).
2. Add the bot as a **channel administrator** on both channels (recommended for automatic membership checks).
3. In the admin **Settings** page, set **Remedial Channel** and **Entrance Channel** link + chat ID separately (`@yourchannel` or numeric ID).
4. Click **Test Remedial Channel** and **Test Entrance Channel** to verify each connection.

Users must join the relevant channel for each result type. If the bot is not an admin, users can still verify by forwarding a channel post to the bot.

## Bot user flow

1. `/start` → main menu (Remedial / Entrance)
2. User selects a result type → channel membership check
3. Not joined → join prompt for that result's channel + **Joined ✅**
4. Joined → pre-release message, or result URL when released

## Admin dashboard

- **Settings** — release flags, remedial/entrance channels, result URLs, messages
- **Analytics** — users and click counts
- **Broadcast** — send a message (optional image attachment) to all active users; delete from history or recall within 48 hours

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run `server.js` |
| `npm run dev` | Run with `--watch` (Node 18+) |
| `npm run build:admin` | Build admin UI into `public/` |
