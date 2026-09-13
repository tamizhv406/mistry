-- ==============================================================================
-- BUILDING MISTRY — SUPABASE POSTGRESQL ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Isolation & Super Admin Override
-- ==============================================================================

-- 1. Helper function: Check if authenticated caller is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text
        AND (role = 'SUPER_ADMIN' OR email = 'tamilthilagan82@gmail.com')
        AND is_active = true
    )
    OR (auth.jwt() ->> 'role') = 'service_role'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Helper function: Check if authenticated caller owns a site
CREATE OR REPLACE FUNCTION public.is_site_owner(lookup_site_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sites
    WHERE id = lookup_site_id
      AND user_id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- TABLE 1: USERS
-- ==============================================================================
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile or Super Admin views all" ON public.users;
CREATE POLICY "Users can view own profile or Super Admin views all"
  ON public.users
  FOR SELECT
  USING (id = auth.uid()::text OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update own profile or Super Admin updates all" ON public.users;
CREATE POLICY "Users can update own profile or Super Admin updates all"
  ON public.users
  FOR UPDATE
  USING (id = auth.uid()::text OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can insert profile or Super Admin inserts" ON public.users;
CREATE POLICY "Users can insert profile or Super Admin inserts"
  ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid()::text OR public.is_super_admin());

-- ==============================================================================
-- TABLE 2: SITES
-- ==============================================================================
ALTER TABLE IF EXISTS public.sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sites owner isolation and Super Admin inspection" ON public.sites;
CREATE POLICY "Sites owner isolation and Super Admin inspection"
  ON public.sites
  FOR ALL
  USING (user_id = auth.uid()::text OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_super_admin());

-- ==============================================================================
-- TABLES 3 - 17: SITE-SCOPED PROJECT ENTITIES
-- ==============================================================================

-- Materials
ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Materials site isolation" ON public.materials;
CREATE POLICY "Materials site isolation" ON public.materials
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Rod Entries
ALTER TABLE IF EXISTS public.rod_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rod Entries site isolation" ON public.rod_entries;
CREATE POLICY "Rod Entries site isolation" ON public.rod_entries
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Workers
ALTER TABLE IF EXISTS public.workers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workers site isolation" ON public.workers;
CREATE POLICY "Workers site isolation" ON public.workers
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Attendance
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attendance site isolation" ON public.attendance;
CREATE POLICY "Attendance site isolation" ON public.attendance
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Labour Advances
ALTER TABLE IF EXISTS public.labour_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Labour Advances site isolation" ON public.labour_advances;
CREATE POLICY "Labour Advances site isolation" ON public.labour_advances
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Salary Payments
ALTER TABLE IF EXISTS public.salary_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Salary Payments site isolation" ON public.salary_payments;
CREATE POLICY "Salary Payments site isolation" ON public.salary_payments
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Tools
ALTER TABLE IF EXISTS public.tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tools site isolation" ON public.tools;
CREATE POLICY "Tools site isolation" ON public.tools
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Tea / Snacks Expenses
ALTER TABLE IF EXISTS public.tea_snacks_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tea Snacks Expenses site isolation" ON public.tea_snacks_expenses;
CREATE POLICY "Tea Snacks Expenses site isolation" ON public.tea_snacks_expenses
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Pooja Expenses
ALTER TABLE IF EXISTS public.pooja_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pooja Expenses site isolation" ON public.pooja_expenses;
CREATE POLICY "Pooja Expenses site isolation" ON public.pooja_expenses
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Electricity Bills
ALTER TABLE IF EXISTS public.electricity_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Electricity Bills site isolation" ON public.electricity_bills;
CREATE POLICY "Electricity Bills site isolation" ON public.electricity_bills
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Water Bills
ALTER TABLE IF EXISTS public.water_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Water Bills site isolation" ON public.water_bills;
CREATE POLICY "Water Bills site isolation" ON public.water_bills
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Other Expenses
ALTER TABLE IF EXISTS public.other_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Other Expenses site isolation" ON public.other_expenses;
CREATE POLICY "Other Expenses site isolation" ON public.other_expenses
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Site Comments
ALTER TABLE IF EXISTS public.site_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site Comments site isolation" ON public.site_comments;
CREATE POLICY "Site Comments site isolation" ON public.site_comments
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Estimates
ALTER TABLE IF EXISTS public.estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Estimates site isolation" ON public.estimates;
CREATE POLICY "Estimates site isolation" ON public.estimates
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Payments / Transactions
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Payments site isolation" ON public.payments;
CREATE POLICY "Payments site isolation" ON public.payments
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- ==============================================================================
-- TABLES 18 - 21: LOGS, OTP SESSIONS & AUDIT
-- ==============================================================================

-- Activity Logs
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Activity Logs site isolation" ON public.activity_logs;
CREATE POLICY "Activity Logs site isolation" ON public.activity_logs
  FOR ALL
  USING (public.is_site_owner(site_id) OR public.is_super_admin())
  WITH CHECK (public.is_site_owner(site_id) OR public.is_super_admin());

-- Material Prices
ALTER TABLE IF EXISTS public.material_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Material Prices readable by all authenticated" ON public.material_prices;
CREATE POLICY "Material Prices readable by all authenticated" ON public.material_prices
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Material Prices editable by Super Admin" ON public.material_prices;
CREATE POLICY "Material Prices editable by Super Admin" ON public.material_prices
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- OTP Sessions
ALTER TABLE IF EXISTS public.otp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OTP Sessions strictly isolated" ON public.otp_sessions;
CREATE POLICY "OTP Sessions strictly isolated" ON public.otp_sessions
  FOR ALL
  USING (public.is_super_admin() OR auth.jwt() ->> 'role' = 'service_role');

-- Admin Audit Logs
ALTER TABLE IF EXISTS public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin Audit Logs readable by Super Admin" ON public.admin_audit_logs;
CREATE POLICY "Admin Audit Logs readable by Super Admin" ON public.admin_audit_logs
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Admin Audit Logs insertable by authenticated users" ON public.admin_audit_logs;
CREATE POLICY "Admin Audit Logs insertable by authenticated users" ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
