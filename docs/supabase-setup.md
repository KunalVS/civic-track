# CivicTrack Supabase Setup

## 1. Create a Supabase project

1. Create a new project in the Supabase dashboard.
2. Open the `Connect` panel for the project.
3. Copy a Postgres connection string.

Recommended for this backend:

- Use the `Session pooler` connection string for a long-running Node.js server.
- Use the `Direct connection` only if your environment supports IPv6.

## 2. Configure CivicTrack

Create a root `.env` file from [`.env.example`](C:/Users/ASUS/OneDrive/Desktop/civictrack/.env.example) and set:

```env
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
JWT_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGIN=http://localhost:5173
```

If you are using Twilio for SMS OTP:

```env
SMS_SENDER_ID=+1XXXXXXXXXX
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

If you use another SMS provider, set:

```env
SMS_PROVIDER_URL=https://your-provider.example/send
SMS_PROVIDER_API_KEY=your_provider_key
SMS_SENDER_ID=CIVICTRACK
```

## 3. Initialize the database

Open the Supabase SQL Editor and run:

- [0000_init.sql](C:/Users/ASUS/OneDrive/Desktop/civictrack/backend/src/db/migrations/0000_init.sql)

That creates:

- `users`
- `workers`
- `supervisors`
- `admins`
- `otp_codes`
- `auth_sessions`
- attendance and task tables
- the single seeded admin row

## 4. Start the app

Backend:

```powershell
npm run dev:backend
```

Frontend:

```powershell
npm run dev:frontend
```

## 5. Login behavior

- Signup is allowed for `worker` and `supervisor`
- Admin signup is disabled
- Login sends OTP only if the `email + phone` pair already exists in `users`
- JWTs are backed by `auth_sessions`

## 6. Seeded admin

The migration seeds one admin account:

- email: `admin@civictrack.local`
- phone: `9876543212`

You should replace this record in Supabase before production use.
