-- Add "awaiting_payment" status to deposits
ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE public.deposits ADD CONSTRAINT deposits_status_check 
  CHECK (status = ANY (ARRAY['awaiting_payment', 'pending', 'successful', 'failed', 'rejected']));

-- Add account details to gateways so admin can configure the actual bank account
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS account_number text DEFAULT '';
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS bank_name text DEFAULT '';
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS account_name text DEFAULT '';
