/*
# Core Schema for OTP Suite SaaS Platform

## Overview
Creates the complete database schema for a temporary/virtual phone number SaaS platform
where users fund a wallet, buy temporary numbers for OTP/SMS verification, and receive
OTP codes in real-time. Includes full admin management capabilities.

## New Tables
1. `profiles` — extends auth.users with wallet balance, role (user/admin), ban status
2. `services` — catalog of apps (WhatsApp, Telegram, Instagram, etc.)
3. `countries` — supported countries for virtual numbers
4. `providers` — SMS provider integrations (5sim, SMS-Activate, etc.)
5. `provider_services` — pricing/stock per provider × service × country
6. `gateways` — payment gateway configurations (VPay, etc.)
7. `numbers` — purchased temporary numbers owned by users
8. `sms_logs` — SMS/OTP messages received on a number
9. `deposits` — wallet funding requests (virtual account, bank transfer, manual)
10. `transactions` — wallet ledger (every credit/debit)
11. `settings` — site-wide key/value settings
12. `audit_logs` — admin action audit trail

## Security
- RLS enabled on ALL tables.
- `is_admin()` SECURITY DEFINER helper checks profile role.
- `credit_wallet()` and `debit_wallet()` SECURITY DEFINER functions for atomic wallet ops.
- Column-level privileges: users cannot directly update `wallet_balance`, `role`, or `banned`.
- Users can only access their own deposits, transactions, numbers, and SMS logs.
- Admins get broad access via `is_admin()` policies.
- Public catalog tables (services, countries) are readable by anon + authenticated.
*/

-- ============================================================
-- PROFILES (must exist before is_admin())
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  avatar_url text DEFAULT '',
  wallet_balance numeric(18,2) NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies: users read/update own profile; admins read all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Column privileges: users can only update name/avatar, NOT wallet_balance/role/banned
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;

-- ============================================================
-- SERVICES (app catalog — public read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_public" ON public.services;
CREATE POLICY "services_select_public" ON public.services
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "services_admin_write" ON public.services;
CREATE POLICY "services_admin_write" ON public.services
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- COUNTRIES (public read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  flag text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "countries_select_public" ON public.countries;
CREATE POLICY "countries_select_public" ON public.countries
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "countries_admin_write" ON public.countries;
CREATE POLICY "countries_admin_write" ON public.countries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- PROVIDERS (SMS provider integrations — admin write, authenticated read)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  base_url text NOT NULL,
  api_key_encrypted text NOT NULL DEFAULT '',
  priority int NOT NULL DEFAULT 0,
  markup_percent numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_select_auth" ON public.providers;
CREATE POLICY "providers_select_auth" ON public.providers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "providers_admin_write" ON public.providers;
CREATE POLICY "providers_admin_write" ON public.providers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- PROVIDER_SERVICES (pricing/stock per provider × service × country)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  provider_price numeric(18,2) NOT NULL DEFAULT 0,
  our_price numeric(18,2) NOT NULL DEFAULT 0,
  max_price numeric(18,2) NOT NULL DEFAULT 0,
  stock int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, service_id, country_id)
);

ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_services_select_auth" ON public.provider_services;
CREATE POLICY "provider_services_select_auth" ON public.provider_services
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "provider_services_admin_write" ON public.provider_services;
CREATE POLICY "provider_services_admin_write" ON public.provider_services
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- GATEWAYS (payment gateway configs — admin only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  public_key_encrypted text NOT NULL DEFAULT '',
  secret_key_encrypted text NOT NULL DEFAULT '',
  webhook_secret_encrypted text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gateways_admin_all" ON public.gateways;
CREATE POLICY "gateways_admin_all" ON public.gateways
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- NUMBERS (purchased temporary numbers — user owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  phone_number text NOT NULL DEFAULT '',
  provider_activation_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled','expired','failed')),
  cost numeric(18,2) NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_numbers_user_id ON public.numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_numbers_status ON public.numbers(status);

DROP POLICY IF EXISTS "numbers_select_own_or_admin" ON public.numbers;
CREATE POLICY "numbers_select_own_or_admin" ON public.numbers
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "numbers_insert_own" ON public.numbers;
CREATE POLICY "numbers_insert_own" ON public.numbers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "numbers_update_own_or_admin" ON public.numbers;
CREATE POLICY "numbers_update_own_or_admin" ON public.numbers
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "numbers_delete_admin" ON public.numbers;
CREATE POLICY "numbers_delete_admin" ON public.numbers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- SMS_LOGS (received SMS/OTP on a number)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid NOT NULL REFERENCES public.numbers(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sms_logs_number_id ON public.sms_logs(number_id);

DROP POLICY IF EXISTS "sms_logs_select_own_or_admin" ON public.sms_logs;
CREATE POLICY "sms_logs_select_own_or_admin" ON public.sms_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.numbers n
      WHERE n.id = sms_logs.number_id
      AND (n.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "sms_logs_insert_admin" ON public.sms_logs;
CREATE POLICY "sms_logs_insert_admin" ON public.sms_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- DEPOSITS (wallet funding requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'virtual_account' CHECK (method IN ('virtual_account','bank_transfer','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','successful','failed','rejected')),
  reference text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  virtual_account_number text DEFAULT '',
  proof_url text DEFAULT '',
  gateway_id uuid REFERENCES public.gateways(id) ON DELETE SET NULL,
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);

DROP POLICY IF EXISTS "deposits_select_own_or_admin" ON public.deposits;
CREATE POLICY "deposits_select_own_or_admin" ON public.deposits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
CREATE POLICY "deposits_insert_own" ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "deposits_update_admin" ON public.deposits;
CREATE POLICY "deposits_update_admin" ON public.deposits
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- TRANSACTIONS (wallet ledger — read only for users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  amount numeric(18,2) NOT NULL DEFAULT 0,
  balance_after numeric(18,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  reference_type text DEFAULT '',
  reference_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

DROP POLICY IF EXISTS "transactions_select_own_or_admin" ON public.transactions;
CREATE POLICY "transactions_select_own_or_admin" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================
-- SETTINGS (site-wide key/value — public read, admin write)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_public" ON public.settings;
CREATE POLICY "settings_select_public" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR public.is_admin());

DROP POLICY IF EXISTS "settings_admin_write" ON public.settings;
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- AUDIT_LOGS (admin actions — admin only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT '',
  target_id text DEFAULT '',
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all" ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- WALLET FUNCTIONS (SECURITY DEFINER — atomic credit/debit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_reference_type text DEFAULT '',
  p_reference_id text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(18,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + p_amount,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
  VALUES (p_user_id, 'credit', p_amount, v_balance, p_description, p_reference_type, p_reference_id);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT '',
  p_reference_type text DEFAULT '',
  p_reference_id text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(18,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = now()
  WHERE id = p_user_id AND wallet_balance >= p_amount
  RETURNING wallet_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance or user not found';
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description, reference_type, reference_id)
  VALUES (p_user_id, 'debit', p_amount, v_balance, p_description, p_reference_type, p_reference_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- UPDATED_AT trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS providers_updated_at ON public.providers;
CREATE TRIGGER providers_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS gateways_updated_at ON public.gateways;
CREATE TRIGGER gateways_updated_at BEFORE UPDATE ON public.gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS numbers_updated_at ON public.numbers;
CREATE TRIGGER numbers_updated_at BEFORE UPDATE ON public.numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS deposits_updated_at ON public.deposits;
CREATE TRIGGER deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS provider_services_updated_at ON public.provider_services;
CREATE TRIGGER provider_services_updated_at BEFORE UPDATE ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
