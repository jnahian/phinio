# Deployment Guide

Phinio is built for Vercel (Nitro preset, prerendered marketing/auth routes, scheduled cron worker for push reminders). This guide walks through a production deployment from a fresh Vercel project.

> For local development setup, see [Getting Started](../README.md#getting-started) in the README.

---

## 1. Provision the database (Neon)

Phinio uses Prisma 7 with the `@prisma/adapter-pg` adapter against PostgreSQL. [Neon](https://neon.tech) is the recommended host — its free tier is sufficient and it provides both pooled and direct connection strings, which Prisma needs.

1. Create a Neon project.
2. From the Neon dashboard, copy two connection strings:
   - **Pooled** (PgBouncer, `?sslmode=require&pgbouncer=true`) → `DATABASE_URL`
   - **Direct** (non-pooled) → `DIRECT_URL`
3. Migrations require a direct connection. Running `prisma migrate deploy` against the pooled URL will fail.

---

## 2. Set up Resend (email)

Email verification and password reset links are delivered through [Resend](https://resend.com).

1. Create a Resend account and verify your sender domain (DNS records: SPF, DKIM, optionally DMARC).
2. Create an API key → `RESEND_API_KEY`.
3. Pick a `From` address on your verified domain → `RESEND_FROM` (e.g. `Phinio <noreply@yourdomain.com>`).

---

## 3. Generate VAPID keys (web push)

Web push uses VAPID. Generate a keypair locally:

```bash
npx web-push generate-vapid-keys
```

Set:

- `VAPID_PUBLIC_KEY` — server-side public key
- `VAPID_PRIVATE_KEY` — server-side private key (never exposed to the client)
- `VAPID_SUBJECT` — `mailto:you@yourdomain.com` or an `https:` URL you control
- `VITE_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY`, exposed to the client so `PushManager.subscribe()` can use it

---

## 4. Generate auth secrets

```bash
npx -y @better-auth/cli secret    # → BETTER_AUTH_SECRET
openssl rand -hex 32              # → CRON_SECRET (guards the cron endpoint)
```

---

## 5. Create the Vercel project

1. Import the repository in the Vercel dashboard. The framework should auto-detect as **Vite** — no overrides needed.
2. In **Project Settings → Environment Variables**, add every variable listed below for the **Production** (and optionally **Preview**) environment.

### Required environment variables

| Variable                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Neon **pooled** connection string                                              |
| `DIRECT_URL`            | Neon **direct** (non-pooled) connection string                                 |
| `BETTER_AUTH_SECRET`    | Output of `npx -y @better-auth/cli secret`                                     |
| `BETTER_AUTH_URL`       | Full deployed URL, e.g. `https://phinio.example.com` (no trailing slash)       |
| `RESEND_API_KEY`        | Resend dashboard → API keys                                                    |
| `RESEND_FROM`           | Verified sender, e.g. `Phinio <noreply@yourdomain.com>`                        |
| `VAPID_PUBLIC_KEY`      | From `npx web-push generate-vapid-keys`                                        |
| `VAPID_PRIVATE_KEY`     | Same — keep server-only                                                        |
| `VAPID_SUBJECT`         | `mailto:` or `https:` URI registered with the push service                     |
| `VITE_VAPID_PUBLIC_KEY` | Same value as `VAPID_PUBLIC_KEY` (exposed to the client by Vite)               |
| `CRON_SECRET`           | Random 32-byte hex; sent as `Authorization: Bearer ...` to the cron endpoint   |

> **`BETTER_AUTH_URL` matters.** Better Auth embeds this URL verbatim into every email link (verification, password reset). If it's wrong, every link in every email 404s.

### Build command

The default `npm run build` is correct. It runs `prisma migrate deploy && prisma generate && vite build` (see `package.json`), so migrations apply automatically on every deploy.

> Migrations run against `DIRECT_URL`. If you only set `DATABASE_URL` (pooled), the migrate step fails.

---

## 6. Schedule the push-notification cron

The cron worker at `/api/cron/send-reminders` checks for upcoming and overdue EMI / DPS installments and sends web-push notifications. It's gated by `CRON_SECRET`.

In `vercel.json` (commit this if it isn't already there):

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Vercel automatically signs cron requests with the project's `CRON_SECRET`. Adjust the schedule to your timezone — the example fires daily at 09:00 UTC.

---

## 7. First deploy

Trigger a deploy (push to `main`, or click **Deploy** in Vercel). On success:

1. Visit the production URL — the landing page should load.
2. Sign up with a real email; the verification link should arrive within a few seconds.
3. Verify the email and sign in.
4. Check the Vercel **Functions** logs after the first cron run (or invoke the endpoint manually with the `CRON_SECRET` to confirm it returns 200).

---

## Custom domains

1. Add the domain in **Vercel → Domains**.
2. Update `BETTER_AUTH_URL` to the new domain (this is the single most-forgotten step — old verification links keep pointing at the Vercel preview URL until you do).
3. Redeploy so the env-var change takes effect.

---

## Troubleshooting

| Symptom                                                        | Likely cause                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Build fails with `PrismaConfigEnvError`                        | `DATABASE_URL` / `DIRECT_URL` not set in the Vercel environment            |
| `prisma migrate deploy` fails with a PgBouncer error           | `DIRECT_URL` is pointing at the pooled connection — use the non-pooled URL |
| Email links go to `localhost:3000` in production               | `BETTER_AUTH_URL` was never updated for the production environment         |
| Push notifications don't fire                                  | `CRON_SECRET` mismatch between Vercel and the env, or VAPID keys missing   |
| Client-side `PushManager.subscribe()` errors with invalid key  | `VITE_VAPID_PUBLIC_KEY` not set or doesn't match `VAPID_PUBLIC_KEY`        |
| Marketing/auth pages show stale copy after a content edit      | They are prerendered at build time — trigger a redeploy                    |

---

## Rolling back

Vercel keeps every previous deployment. To roll back:

1. **Vercel → Deployments**, find the last good deploy, click **Promote to Production**.
2. If the rollback skips a forward migration, manually revert the schema in Neon (or apply a corrective migration) — Prisma does not auto-roll-back migrations on deploy rollback.
