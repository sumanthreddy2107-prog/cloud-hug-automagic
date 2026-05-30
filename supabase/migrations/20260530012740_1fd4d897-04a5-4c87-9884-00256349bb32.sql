
-- 1. OTP requests table
CREATE TABLE IF NOT EXISTS public.otp_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','owner')),
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_requests_phone_created_idx ON public.otp_requests (phone, created_at DESC);

GRANT ALL ON public.otp_requests TO service_role;
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated => no client access.

-- 2. Authorized owners whitelist
CREATE TABLE IF NOT EXISTS public.authorized_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{10}$'),
  name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.authorized_owners TO service_role;
GRANT SELECT ON public.authorized_owners TO authenticated;
ALTER TABLE public.authorized_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized_owners owner read"
ON public.authorized_owners FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Seed from existing settings.owner_phone if present
INSERT INTO public.authorized_owners (phone, name, active)
SELECT right(regexp_replace(value, '\D', '', 'g'), 10), 'Primary Owner', true
FROM public.settings
WHERE key = 'owner_phone' AND value IS NOT NULL
  AND length(regexp_replace(value, '\D', '', 'g')) >= 10
ON CONFLICT (phone) DO NOTHING;

-- 3. Update handle_new_user to use authorized_owners
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_digits text;
  existing_student_id uuid;
  is_owner boolean;
BEGIN
  new_digits := right(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), 10);

  SELECT EXISTS (
    SELECT 1 FROM public.authorized_owners
    WHERE phone = new_digits AND active = true
  ) INTO is_owner;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
      ON CONFLICT DO NOTHING;

    SELECT id INTO existing_student_id
      FROM public.students
      WHERE right(regexp_replace(phone, '\D', '', 'g'), 10) = new_digits
      LIMIT 1;

    IF existing_student_id IS NOT NULL THEN
      UPDATE public.students SET user_id = NEW.id WHERE id = existing_student_id;
    ELSE
      INSERT INTO public.students (user_id, phone, name)
      VALUES (NEW.id, '+91' || new_digits, COALESCE(NEW.raw_user_meta_data ->> 'name', ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
