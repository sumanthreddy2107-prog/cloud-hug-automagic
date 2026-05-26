
-- Reusable updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ settings ============
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by all" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings writable by all" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.settings (key, value) VALUES
  ('hall_name', 'Kaaizens Library'),
  ('hall_phone', '+91 9515503335'),
  ('owner_phone', '+91 9515503335'),
  ('ac_month_price', '2000'),
  ('ac_day_price', '150'),
  ('nonac_month_price', '1500'),
  ('nonac_day_price', '100'),
  ('ac_seat_count', '110'),
  ('nonac_seat_count', '100'),
  ('counter_hold_hours', '2'),
  ('grace_period_days', '2'),
  ('expiry_reminder_days', '3'),
  ('qr_image_url', ''),
  ('upi_id', '');

-- ============ students ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students all access" ON public.students FOR ALL USING (true) WITH CHECK (true);

-- ============ otp_requests ============
CREATE TABLE public.otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','owner')),
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone ON public.otp_requests(phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.otp_requests TO anon, authenticated;
GRANT ALL ON public.otp_requests TO service_role;
ALTER TABLE public.otp_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "otp all access" ON public.otp_requests FOR ALL USING (true) WITH CHECK (true);

-- ============ seats ============
CREATE TABLE public.seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_number TEXT NOT NULL UNIQUE,
  seat_type TEXT NOT NULL CHECK (seat_type IN ('AC','NAC')),
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','occupied','blocked','grace','hold')),
  block_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seats TO anon, authenticated;
GRANT ALL ON public.seats TO service_role;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seats all access" ON public.seats FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_seats_updated BEFORE UPDATE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all 210 seats
INSERT INTO public.seats (seat_number, seat_type)
SELECT 'AC-' || LPAD(g::text, 3, '0'), 'AC' FROM generate_series(1, 110) g;
INSERT INTO public.seats (seat_number, seat_type)
SELECT 'NAC-' || LPAD(g::text, 3, '0'), 'NAC' FROM generate_series(1, 100) g;

-- ============ bookings ============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE RESTRICT,
  pass_type TEXT NOT NULL CHECK (pass_type IN ('day','month')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  grace_end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','active','grace','expired','cancelled')),
  payment_method TEXT CHECK (payment_method IN ('upi','counter')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  upi_transaction_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_student ON public.bookings(student_id);
CREATE INDEX idx_bookings_seat ON public.bookings(seat_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO anon, authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings all access" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

-- ============ notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications all access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
