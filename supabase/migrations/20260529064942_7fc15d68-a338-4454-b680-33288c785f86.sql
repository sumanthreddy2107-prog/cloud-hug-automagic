
CREATE POLICY "notifications self insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  regexp_replace(recipient_phone, '\D', '', 'g')
  = regexp_replace(COALESCE(auth.jwt() ->> 'phone', ''), '\D', '', 'g')
);
