import { supabase } from "@/integrations/supabase/client";

const OWNER_PHONE_KEY = "owner_phone";

function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(params: { phone: string; role: "student" | "owner" }) {
  const fullPhone = `+91${params.phone}`;

  if (params.role === "owner") {
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", OWNER_PHONE_KEY)
      .maybeSingle();
    const ownerPhone = setting?.value ?? "+919515503335";
    if (ownerPhone.replace(/\s/g, "") !== fullPhone) {
      return { ok: false as const, error: "Unauthorised" };
    }
  }

  const code = gen6();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("otp_requests").insert({
    phone: fullPhone,
    otp_code: code,
    role: params.role,
    expires_at,
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, devOtp: code };
}

export async function verifyOtp(params: { phone: string; code: string }) {
  const fullPhone = `+91${params.phone}`;
  const nowIso = new Date().toISOString();

  const { data: req, error } = await supabase
    .from("otp_requests")
    .select("*")
    .eq("phone", fullPhone)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !req) {
    return { ok: false as const, error: "OTP expired. Request a new one.", attemptsLeft: 0 };
  }

  if (req.attempts >= 3) {
    return {
      ok: false as const,
      error: "Too many attempts. Please request a new OTP.",
      attemptsLeft: 0,
    };
  }

  if (req.otp_code !== params.code) {
    const newAttempts = req.attempts + 1;
    await supabase.from("otp_requests").update({ attempts: newAttempts }).eq("id", req.id);
    const left = Math.max(0, 3 - newAttempts);
    return {
      ok: false as const,
      error:
        left > 0
          ? `Incorrect OTP. ${left} attempts remaining.`
          : "Too many attempts. Please request a new OTP.",
      attemptsLeft: left,
    };
  }

  await supabase.from("otp_requests").update({ verified: true }).eq("id", req.id);

  const role = (req.role === "owner" ? "owner" : "student") as "owner" | "student";

  let isNewUser = false;
  let studentId: string | undefined;
  let name: string | undefined;
  if (role === "student") {
    const { data: existing } = await supabase
      .from("students")
      .select("id, name")
      .eq("phone", fullPhone)
      .maybeSingle();
    if (existing) {
      studentId = existing.id;
      name = existing.name;
    } else {
      isNewUser = true;
    }
  }

  return { ok: true as const, role, isNewUser, studentId, name, phone: fullPhone };
}

export async function createStudent(phone: string, name: string) {
  const { data, error } = await supabase
    .from("students")
    .insert({ phone, name })
    .select("id, name")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
