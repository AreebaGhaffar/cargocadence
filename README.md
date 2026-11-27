# CargoCadence

AI-assisted truck booking and logistics platform for US freight. Customers chat with a Gemini-powered assistant to describe a load, get an instant estimate from admin-defined rates, confirm or request a custom deal, and pay by card through Stripe. Admins manage rates, approve custom deals, see a payments ledger, edit contact details, and get automated pickup reminders.

## Features

- **Authentication:** register, log in, log out (Supabase Auth). Roles: `client` and `admin`.
- **AI booking chat:** Gemini collects pickup, drop-off, cargo details and time. Output is validated with Zod; the system prompt treats customer text as data (prompt-injection defence). The server, not the model, decides when details are complete and calculates every price.
- **Estimates:** base fee + road miles x rate per mile, plus admin-defined surcharges. Custom or negotiated deals, and loads over a truck's weight limit, are flagged for admin approval.
- **Customer dashboard:** list of bookings with status, totals, admin notes, Pay now button, and support contact card.
- **Stripe payments:** Checkout Session created on the server; a signature-verified webhook records each payment and marks the booking paid.
- **Admin panel (`/admin`):** truck rates and surcharges, bookings (approve custom deals, cancel), payments ledger, platform contact details and support channels.
- **Pickup reminders:** a secret-protected route emails the admin about upcoming pickups; a scheduler calls it hourly.
- **Security:** row-level security on every table, role checks on every admin page and action, server-only secrets, per-user rate limiting on the chat, security headers.

## Tech stack

Next.js 16 (App Router, TypeScript, Tailwind), Supabase (Postgres, Auth, RLS), Google Gemini API (`@google/genai`), Stripe Checkout, HeiGIT openrouteservice (road distance), Resend (email), Zod, deployed on Vercel.

## Requirements

- Node.js 20.9 or newer (developed on Node 24) and npm
- Accounts: Supabase, Google AI Studio, Stripe, HeiGIT (openrouteservice), Resend, Vercel, GitHub

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in every value (see the table below).
3. Create the database (next section).
4. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Database setup (Supabase)

1. Create a Supabase project.
2. Open **SQL Editor -> New query**, paste the whole of `supabase/schema.sql`, and run it. This applies migrations 001-010 in order. The individual files are kept in `supabase/migrations/` for reference.
3. The schema includes sample truck types and surcharges. Replace them with your real rates in **Admin -> Manage truck rates** (or delete the samples).
4. **Create your first admin.** Register a normal account on the site, then run this in the SQL Editor with your email. There is intentionally no way to become admin from the website:
   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@yourcompany.com');
   ```
5. In **Authentication -> URL Configuration**, set the Site URL to your site address and add it to the redirect URLs. Decide whether to require email confirmation (it needs working email delivery).

New tables need explicit grants to the `authenticated` role as well as RLS policies, otherwise the app gets "permission denied". Also revoke `truncate`, `references` and `trigger` from `anon` and `authenticated` on any new table.

## Environment variables

Names are listed in `.env.example`. Never commit `.env.local`.

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Project Settings -> API | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase -> API Keys | Public |
| `SUPABASE_SECRET_KEY` | Supabase -> API Keys | **Server only.** Bypasses RLS. Used by the Stripe webhook, reminder route and rate limiter |
| `GEMINI_API_KEY` | Google AI Studio | Server only |
| `GEMINI_MODEL` | Google AI docs | Model names change often; check the docs. A fast "flash-lite" model gives the quickest replies. |
| `GEMINI_FALLBACK_MODELS` | Google AI docs | Comma-separated, tried in order when the main model is busy or out of quota |
| `GEMINI_THINKING_LEVEL` | Google AI docs | Optional. minimal, low, medium or high. low keeps replies fast. |
| `ORS_API_KEY` | account.heigit.org | Road distance (truck profile). Calls api.heigit.org; the old api.openrouteservice.org was shut down. |
| `STRIPE_SECRET_KEY` | Stripe -> Developers -> API keys | `sk_test_...` until go-live |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint or `stripe listen` | `whsec_...` |
| `NEXT_PUBLIC_SITE_URL` | Your site address | No trailing slash; used for Stripe redirects |
| `RESEND_API_KEY` | resend.com -> API Keys | Email |
| `RESEND_FROM_EMAIL` | Resend | Use an address on a verified domain in production |
| `ADMIN_NOTIFY_EMAIL` | Your choice | Receives pickup reminders |
| `CRON_SECRET` | Generate a long random string | Protects the reminder route |
| `REMINDER_WINDOW_HOURS` | Optional | Default 24 |

## Stripe

**Local testing**

1. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run `stripe login`.
2. Forward webhooks to your dev server:
   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/stripe/webhook
   ```
3. Put the printed `whsec_...` value in `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.
4. Pay a booking with test card `4242 4242 4242 4242` (any future expiry, any CVC, any ZIP).

**Production**

1. In the Stripe Dashboard add a webhook endpoint pointing to `https://YOUR-DOMAIN/api/stripe/webhook` for the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
2. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`, and use live keys in `STRIPE_SECRET_KEY`.

Payments are recorded only by the webhook (never from the success page). Retries are safe: payments are unique per Checkout Session.

## Pickup reminders

`GET /api/cron/reminders` finds `confirmed` or `paid` bookings with a pickup inside the reminder window and no reminder sent yet, emails the admin once, and marks them as reminded. It requires the header `Authorization: Bearer <CRON_SECRET>`.

It needs a scheduler that calls it regularly. Options:

- **GitHub Actions (included):** `.github/workflows/pickup-reminders.yml` runs hourly. In the repository go to **Settings -> Secrets and variables -> Actions** and add `APP_URL` (your live site address, no trailing slash) and `CRON_SECRET` (the same value as in your hosting environment). The job skips itself while these are unset. Private repositories have a monthly free-minutes limit; hourly runs fit within it.
- **External cron service** such as cron-job.org: call `https://YOUR-DOMAIN/api/cron/reminders` every hour with the `Authorization` header above.
- **Vercel Cron:** per-minute or hourly schedules need the Pro plan. The Hobby plan allows only once-a-day jobs with imprecise timing.

## Deploying to Vercel

1. Import the GitHub repository into Vercel.
2. Add every variable from `.env.example` under **Project Settings -> Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to the production address.
3. Deploy, then set the Supabase Auth Site URL and redirect URLs to the production address.
4. Create the production Stripe webhook (see above).
5. Add the GitHub Actions secrets for reminders.
6. Check Vercel's current plan terms before running a commercial project on the Hobby plan.

## Pricing rules

- `subtotal = truck base fee + distance in miles x rate per mile`
- Flat surcharges add dollars; percent surcharges are a percentage of the subtotal (they do not compound).
- Each surcharge has an `applies_when` setting: `always`, `weekend` (pickup date is a Saturday or Sunday) or `manual` (never automatic).
- All calculations use whole cents and run on the server. The browser sends only booking details, never prices.
- A booking becomes a custom deal when the customer asks for a discount or special terms, or when cargo weight exceeds the truck's maximum. An admin then sets the final total and approves it.

Booking statuses: `quoted`, `pending_approval`, `confirmed`, `paid`, `completed`, `cancelled`.

## Security notes

- Secrets (Gemini, Stripe, Supabase secret key, Resend) are server-side only. Only variables prefixed `NEXT_PUBLIC_` reach the browser.
- Row-level security is enabled on every table. Customers can read only their own bookings and payments; only admins change rates, bookings and settings; payments are written only by the webhook; nobody can delete bookings.
- Admin pages and server actions call `requireAdmin()` themselves; the layout alone is not relied on.
- The AI chat requires login, limits message length and conversation size, and is rate limited per user (10 per minute, 200 per day) with counters stored in Supabase.
- Security headers are set in `next.config.ts`. A strict script-restricting Content-Security-Policy is not set (Next.js inline scripts need a nonce-based policy); this is a recommended follow-up.

## Free-tier limits to know before launch

- **Gemini free tier:** about 20 requests per model per day. Fine for development, not for real customers. Use your own key with billing enabled.
- **HeiGIT free key:** daily limits and terms apply. Use your own key in production.
- **Resend test sender** (`onboarding@resend.dev`) only delivers to your own Resend account email. Verify a domain to send from your own address.
- **Supabase free projects** pause after about a week of inactivity.

## Go-live checklist

- [ ] Replace sample truck types and surcharges with the final approved rates
- [ ] Use your own Gemini and HeiGIT keys; enable Gemini billing
- [ ] Switch Stripe to live keys and create the production webhook
- [ ] Verify a sending domain in Resend and set `RESEND_FROM_EMAIL`
- [ ] Set `CRON_SECRET` in Vercel and GitHub, and `APP_URL` in GitHub
- [ ] Set Supabase Auth Site URL and redirect URLs; decide on email confirmation
- [ ] Promote the first admin and fill in contact details under **Admin -> Contact and support settings**

## Project structure

```
src/
  proxy.ts                     session refresh and protected routes
  app/
    page.tsx                   landing page
    login/ register/ dashboard/ book/
    admin/                     rates, bookings, payments, settings
    api/
      chat/                    Gemini booking chat
      quote/ bookings/         price preview and save
      checkout/                Stripe Checkout Session
      stripe/webhook/          payment recording
      cron/reminders/          pickup reminder route
  components/support-info.tsx  contact card and footer
  lib/
    supabase/                  clients (browser, server, admin) and session
    auth/require-admin.ts
    ai/ gemini/                prompt, schemas, Gemini client with fallback
    geo/ pricing/ booking/     distance, price calculator, quote builder
    stripe/ email/ rate-limit.ts
    validators/                Zod schemas
supabase/
  schema.sql                   full schema (run once)
  migrations/                  001-010
.github/workflows/             hourly reminder scheduler
```

## Scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # run the production build
```