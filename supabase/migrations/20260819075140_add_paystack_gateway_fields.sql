-- Add Paystack-specific fields to gateways table
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS paystack_public_key text DEFAULT '';
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS paystack_secret_key text DEFAULT '';
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS paystack_webhook_secret text DEFAULT '';

-- Add a gateway_type column to distinguish between VPay, Paystack, etc.
ALTER TABLE public.gateways ADD COLUMN IF NOT EXISTS gateway_type text DEFAULT 'vpay';
