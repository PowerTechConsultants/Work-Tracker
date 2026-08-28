# Employee Work Tracker — Local Development

This repository runs an Express + TypeScript API and a static frontend under `public/`.

Quick setup (recommended with Docker):

1. Copy the example env:

```bash
cp .env.example .env
```

2. Start Postgres via Docker Compose:

```bash
docker compose up -d
```

3. Generate Prisma client and run migrations:

```bash
npx prisma generate
npm run prisma:migrate
npm run seed
```

4. Start the server:

```bash
npm start
```

Default seeded admin credentials:

- email: `admin@example.com`
- password: `Admin@123`

If Docker is not available, you must provide a PostgreSQL instance and set `DATABASE_URL` in `.env` accordingly.

Environment variables required in `.env`:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL_SECONDS`
- `JWT_REFRESH_TTL_SECONDS`
- `PORT`
- `CORS_ORIGIN`
