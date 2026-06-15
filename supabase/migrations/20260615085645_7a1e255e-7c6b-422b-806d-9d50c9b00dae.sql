
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('fixed','percent')),
  value numeric NOT NULL CHECK (value > 0),
  applies_to text NOT NULL CHECK (applies_to IN ('both','month','day')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read coupons (needed to validate at checkout)
CREATE POLICY "Authenticated can read coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (true);

-- Only owners can create coupons
CREATE POLICY "Owners can insert coupons"
ON public.coupons FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Only owners can delete coupons
CREATE POLICY "Owners can delete coupons"
ON public.coupons FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
