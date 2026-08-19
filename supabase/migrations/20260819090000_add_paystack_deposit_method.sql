-- Paystack deposits are created before hosted checkout and completed by webhook.
ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_method_check;
ALTER TABLE public.deposits ADD CONSTRAINT deposits_method_check
  CHECK (method IN ('virtual_account', 'bank_transfer', 'manual', 'paystack'));
