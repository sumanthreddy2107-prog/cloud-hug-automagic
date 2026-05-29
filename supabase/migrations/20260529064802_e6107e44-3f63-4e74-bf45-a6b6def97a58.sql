
-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "user_roles self read"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- 2. STUDENTS: link to auth.users
-- ============================================================
ALTER TABLE public.students
  ADD COLUMN user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 3. handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_phone_raw text;
  owner_digits text;
  new_digits text;
  existing_student_id uuid;
BEGIN
  SELECT value INTO owner_phone_raw FROM public.settings WHERE key = 'owner_phone' LIMIT 1;
  owner_digits := regexp_replace(COALESCE(owner_phone_raw, ''), '\D', '', 'g');
  new_digits := regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g');

  IF owner_digits <> '' AND new_digits = owner_digits THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
      ON CONFLICT DO NOTHING;

    -- Link or create student row by phone (stored as +91XXXXXXXXXX)
    SELECT id INTO existing_student_id
      FROM public.students
      WHERE regexp_replace(phone, '\D', '', 'g') = new_digits
      LIMIT 1;

    IF existing_student_id IS NOT NULL THEN
      UPDATE public.students SET user_id = NEW.id WHERE id = existing_student_id;
    ELSE
      INSERT INTO public.students (user_id, phone, name)
      VALUES (NEW.id, '+' || new_digits, COALESCE(NEW.raw_user_meta_data ->> 'name', ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. Drop old OTP table
-- ============================================================
DROP TABLE IF EXISTS public.otp_requests;

-- ============================================================
-- 5. STUDENTS RLS
-- ============================================================
DROP POLICY IF EXISTS "students all access" ON public.students;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

CREATE POLICY "students self or owner read"
ON public.students FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "students self or owner update"
ON public.students FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "students owner insert"
ON public.students FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "students owner delete"
ON public.students FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- 6. SEATS RLS
-- ============================================================
DROP POLICY IF EXISTS "seats all access" ON public.seats;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.seats TO authenticated;
GRANT ALL ON public.seats TO service_role;

CREATE POLICY "seats read all signed-in"
ON public.seats FOR SELECT TO authenticated USING (true);

CREATE POLICY "seats owner write"
ON public.seats FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- 7. BOOKINGS RLS
-- ============================================================
DROP POLICY IF EXISTS "bookings all access" ON public.bookings;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

CREATE POLICY "bookings self read"
ON public.bookings FOR SELECT TO authenticated
USING (student_id = public.current_student_id() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "bookings self insert"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (student_id = public.current_student_id() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "bookings owner update"
ON public.bookings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "bookings owner delete"
ON public.bookings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- 8. NOTIFICATIONS RLS
-- ============================================================
DROP POLICY IF EXISTS "notifications all access" ON public.notifications;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE POLICY "notifications owner all"
ON public.notifications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "notifications self read"
ON public.notifications FOR SELECT TO authenticated
USING (
  regexp_replace(recipient_phone, '\D', '', 'g')
  = regexp_replace(COALESCE(auth.jwt() ->> 'phone', ''), '\D', '', 'g')
);

-- ============================================================
-- 9. SETTINGS RLS
-- ============================================================
DROP POLICY IF EXISTS "settings readable by all" ON public.settings;
DROP POLICY IF EXISTS "settings writable by all" ON public.settings;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;

-- Public read keeps the landing page / QR display working pre-login
CREATE POLICY "settings public read"
ON public.settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "settings owner write"
ON public.settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- 10. STORAGE: settings bucket
-- ============================================================
DROP POLICY IF EXISTS "Settings bucket public read" ON storage.objects;
DROP POLICY IF EXISTS "Settings bucket public insert" ON storage.objects;
DROP POLICY IF EXISTS "Settings bucket public update" ON storage.objects;
DROP POLICY IF EXISTS "Settings bucket public delete" ON storage.objects;

CREATE POLICY "Settings bucket public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'settings');

CREATE POLICY "Settings bucket owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'settings' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Settings bucket owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'settings' AND public.has_role(auth.uid(), 'owner'))
WITH CHECK (bucket_id = 'settings' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Settings bucket owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'settings' AND public.has_role(auth.uid(), 'owner'));
