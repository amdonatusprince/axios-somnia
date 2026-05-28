-- ═══════════════════════════════════════════════════════════════════════════
-- Axios — wipe all application data (empty tables, keep schema + RLS policies)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- How to run (Supabase):
--   1. Open https://supabase.com/dashboard → your project → SQL Editor
--   2. Paste this file → Run
--
-- What it does:
--   Deletes every row from employers, employees, payroll_runs, payment_items,
--   compliance_events, mpp_sessions. Resets SERIAL/identity sequences if any.
--
-- What it does NOT do:
--   • Does not drop tables or policies
--   • Does not delete Supabase Auth users (auth.users) — remove those in
--     Authentication → Users if you need a full identity reset
--   • Does not affect on-chain contracts — treasury balances are separate
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

TRUNCATE TABLE
  public.payment_items,
  public.payroll_runs,
  public.compliance_events,
  public.mpp_sessions,
  public.employees,
  public.employers
RESTART IDENTITY CASCADE;

COMMIT;
