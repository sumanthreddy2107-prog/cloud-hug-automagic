
-- Add columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Loosen payment_status check to include verified/rejected
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'verified'::text, 'rejected'::text]));

-- RLS on storage.objects for payment-proofs bucket
DROP POLICY IF EXISTS "payment-proofs students upload own" ON storage.objects;
CREATE POLICY "payment-proofs students upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "payment-proofs public read" ON storage.objects;
CREATE POLICY "payment-proofs public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment-proofs owners manage" ON storage.objects;
CREATE POLICY "payment-proofs owners manage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'owner'::public.app_role))
WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'owner'::public.app_role));
