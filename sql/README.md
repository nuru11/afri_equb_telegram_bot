# Manual MySQL Setup (cPanel / phpMyAdmin)

Create and update tables in phpMyAdmin. No migration tools required.

## 1. cPanel prerequisites

1. **MySQL Databases** — link your database user to the database with **ALL PRIVILEGES**
2. If the Node app runs on the **same server** — use `localhost` in `DATABASE_URL`
3. If the app runs on your **PC** — **Remote MySQL** → add your public IP

## 2. Create tables (run once)

phpMyAdmin → select your database → **SQL** → run [`init.sql`](init.sql)

## 3. Create admin login

Run [`create-admin.sql`](create-admin.sql) for default login:

- Email: `admin@example.com`
- Password: `changeme`

## 4. Configure `.env` (or cPanel environment variables)

```env
DATABASE_URL=mysql://USER:URL_ENCODED_PASSWORD@localhost:3306/your_database
BOT_TOKEN=your_token_from_botfather
JWT_SECRET=at-least-16-random-characters
```

URL-encode password special chars: `{` → `%7B`, `}` → `%7D`, `&` → `%26`

## 5. Ongoing updates

Use the admin dashboard, or [`manual-queries.sql`](manual-queries.sql) for toggles, URLs, messages, and stats.
