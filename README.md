# Cedar Winds Tool Tracker

Mobile-first QR code tool tracking for construction crews. Workers scan a tool label, sign in with email, and check tools in or out. Admins get a live dashboard with inventory status, usage history, and overdue items.

## Stack

- Node.js + Express
- PostgreSQL
- Sequelize ORM
- Responsive HTML/CSS/JS
- `html5-qrcode` in the scanner UI
- JWT stored in an HTTP-only session cookie
- Railway-ready environment configuration

## Project Structure

```text
server/
  config/
  controllers/
  middleware/
  models/
  routes/
public/
  dashboard/
  scanner/
  tool/
database/
scripts/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `JWT_SECRET`
- `BASE_URL`

3. Initialize the database:

```bash
npm run db:init
```

4. Seed the default users and tools:

```bash
npm run seed
```

5. Start the app:

```bash
npm run dev
```

## Seeded Access

- Emails are preloaded for the Cedar Winds staff list.
- Default password for every seeded user: `Cedar123!`

Example admin login:

- `nelson.evans@cedarwinds.ca`

## Core Routes

### Pages

- `/`
- `/login`
- `/scanner`
- `/tool/:id`
- `/dashboard`

### API

- `POST /login`
- `POST /logout`
- `GET /tools`
- `GET /api/tool/:id`
- `POST /checkout`
- `POST /return`
- `POST /tools`
- `PUT /tools/:id`
- `GET /api/dashboard`
- `GET /api/me`

## QR Labels

Each tool QR code resolves to:

```text
/tool/{tool_id}
```

To export printable PNG labels for every tool:

```bash
npm run qr:export
```

Generated files are saved in `public/qr-labels/`.

## Railway Deployment

1. Create a new Railway project.
2. Add a PostgreSQL service.
3. Set environment variables in Railway:
   - `DATABASE_URL` from Railway Postgres
   - `JWT_SECRET`
   - `BASE_URL` as your Railway app URL
   - `NODE_ENV=production`
   - `DEFAULT_USER_PASSWORD` if you want a different seeded password
4. Deploy this repo.
5. Run the following one-time commands in Railway:

```bash
npm install
npm run db:init
npm run seed
npm run qr:export
```

6. Set the start command to:

```bash
npm start
```

## Notes

- Tool actions require authentication.
- Only admins can add or edit tools.
- Checkout/return actions are always written to the `transactions` table.
- Overdue tools are defined as checked out for more than 24 hours.
- Invalid or unknown tool IDs are rejected server-side.
