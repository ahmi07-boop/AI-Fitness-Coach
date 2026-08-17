# AI Fitness Coach — Server API

This step adds the Express REST API layer on top of the MongoDB foundation from Step 1.

## Run

1. Create `server/.env` from `.env.example` and add your working MongoDB Atlas URI.
2. From `server/` run `npm install`.
3. Start development server:

```bash
npm run dev
```

Or production-style:

```bash
npm start
```

The API runs at `http://localhost:5000` by default.

## Health check

`GET /api/health`

## API routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me/profile`
- `POST /api/auth/me/avatar`
- `GET /api/auth/me/avatar`

### Plans

- `GET /api/plans?userId=<id>&status=<status>`
- `GET /api/plans/:id`
- `POST /api/plans`
- `PATCH /api/plans/:id`
- `DELETE /api/plans/:id`

### Progress & Daily Habits

- `GET /api/progress` — authenticated user's progress history and current streak
- `GET /api/progress/today?date=YYYY-MM-DD` — today's habit state and streak
- `PUT /api/progress/today` — create/update today's habits and daily progress
- `PUT /api/progress/today/nutrition` — persist today's meals, nutrition totals and water
- `POST /api/progress/workout-completion` — server-validates completion against the user's current plan
- `GET /api/progress/:id`
- `POST /api/progress`
- `PATCH /api/progress/:id`

### Chat

- `GET /api/chat?userId=<id>&status=<status>`
- `GET /api/chat/:id`
- `POST /api/chat`
- `POST /api/chat/:id/messages`
- `PATCH /api/chat/:id/moderation`

### Admin

- `GET /api/admin/summary`
- `GET /api/admin/users?search=<term>`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/logs`
- `POST /api/admin/logs`

> Admin routes are deliberately not JWT-protected yet because JWT is Step 3. Do not expose this API publicly until authentication middleware is added.


## Stripe subscriptions

The app gives each user 4 free AI plan generations. After the fourth generation, `/api/plans/generate` returns HTTP 402 with `SUBSCRIPTION_REQUIRED` until the user has an active/trialing Stripe subscription. Subscriptions are created with Stripe Checkout and synchronized through a signed webhook.

Required server environment variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` (recurring Stripe Price ID)
- `FREE_PLAN_LIMIT=4`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Local webhook testing can use Stripe CLI forwarding to `POST /api/billing/webhook`.

## Promote a user to admin

The `users` collection stores the role in the `role` field (`user` or `admin`). After the user has signed up, you can promote them safely from the server with:

```bash
npm run make-admin -- user@example.com
```

This updates only the matching user's `role` to `admin`. You can also change the same field directly in MongoDB Atlas Data Explorer.

## Admin password reset

If an existing admin account returns `401 Invalid email or password`, the admin role itself is not the cause. The login endpoint accepts both `user` and `admin` roles. Verify the email and reset the password if needed:

```bash
npm run reset-password -- user@example.com NewPassword123
```

The password must be at least 8 characters. After resetting, sign in again with the exact email stored in MongoDB. This changes only `passwordHash`; it does not change the user's role, profile, plan usage, or billing data.


## Enterprise hardening included in this build

- JWT verification is restricted to HS256 and requires a strong `JWT_SECRET`.
- Admin APIs require JWT + admin role; the last active admin cannot be deactivated, banned, or demoted.
- User account states are persisted separately as `active`, `inactive`, or `banned`.
- MongoDB is the authoritative source for daily progress, habits, nutrition, water, workouts and file metadata.
- User-uploaded images are stored in MongoDB GridFS (`MONGO_FILE_BUCKET`) instead of Railway's ephemeral filesystem; profile, body-analysis, moderation and progress-photo retrieval all use the same storage layer.
- New image uploads are normalized to WebP and EXIF metadata is stripped before persistence; legacy local paths remain readable only when the legacy file still exists.
- Run `npm run migrate:file-storage` once in an environment that still has legacy `server/uploads` files to move them into GridFS without changing their MongoDB records' logical ownership.
- Workout completion is validated server-side against the user's current plan and authoritative exercise IDs.
- Progress uses a unique `(user, date)` index; run `npm run migrate:progress-index` once against an existing database before enabling the unique index if legacy duplicates exist.
- Date-only tracking uses `APP_TIMEZONE` on the server and `VITE_APP_TIMEZONE` on the client. Use the same IANA timezone in both environments.
- Image moderation receives the actual uploaded MIME type instead of inferring it from temporary filenames.
- Runtime secrets and user uploads are never included in the source archive. Copy `.env.example` to `.env` locally or use Railway Variables/a secret manager.
- Generated `client/dist` artifacts are excluded from the source archive; deployment should run a clean client build.
- Do not commit `.env` files or real user/body/progress uploads. Rotate any credentials that were ever exposed in a repository, ZIP, screenshot or log.

## Validation

From `server/`:

```bash
npm ci
npm run test:enterprise
npm start
```

From `client/`:

```bash
npm ci
npm run lint
npm run build
```

For an existing MongoDB database, run the progress-date migration before production deployment:

```bash
npm run migrate:progress-index
```
