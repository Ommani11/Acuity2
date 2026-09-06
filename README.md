# Acuity

A calm daily log for ADHD medication. The person titrating records seven 1–5 scales, side effects, and notes. Observers they invite — partner, parent, clinician — record what they actually saw. Observers cannot read the self-report.

Sign in with Google. Up to eight observers can watch the same person; each keeps their own daily observation.

## Roles

- **Primary** — set the active medication (name, dose, daily frequency), log each day, invite observers.
- **Observer** — accepts a share link, then logs a stripped-back observation. One Google account is one observer, linked to one person.

## Stack

TanStack Start, Postgres, Better Auth. App schema: `migrations/0002_acuity_schema.sql`.

## Supabase

If you host Postgres and Auth on Supabase, run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. That file creates the same tables with Row Level Security:

- New Google accounts default to **primary**
- Observers cannot read self-report daily logs
- A primary user may have up to eight observers
- Observer 1–5 scores are optional

The live app still uses Better Auth until it is pointed at Supabase.
