import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, createHmac, randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PhoneSchema = z.string().regex(/^[0-9]{10}$/, "Phone must be 10 digits");
const RoleSchema = z.enum(["student", "owner"]);

async function devMode(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "dev_otp_mode")
    .maybeSingle();
  if (data?.value != null) {
    const v = String(data.value).toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  const env = (process.env.DEV_OTP_MODE ?? "true").toLowerCase();
  return env === "true" || env === "1" || env === "yes";
}

function hashOtp(phone: string, otp: string): string {
  const pepper = process.env.AUTH_PHONE_PEPPER ?? "";
  return createHmac("sha256", pepper).update(`${phone}:${otp}`).digest("hex");
}

function derivedPassword(phone: string): string {
  const pepper = process.env.AUTH_PHONE_PEPPER ?? "fallback-pepper-change-me";
  return createHmac("sha256", pepper).update(`pwd:${phone}`).digest("hex");
}

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

async function sendSmsPlaceholder(_phoneE164: string, _otp: string): Promise<void> {
  console.warn("[sendSmsPlaceholder] DEV_OTP_MODE is false but no SMS provider is wired up.");
}

export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ phone: PhoneSchema, role: RoleSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { phone, role } = data;

    if (role === "owner") {
      const { data: owner } = await supabaseAdmin
        .from("authorized_owners")
        .select("phone")
        .eq("phone", phone)
        .eq("active", true)
        .maybeSingle();
      if (!owner) {
        return { ok: false as const, error: "This number is not authorized for owner access." };
      }
    }

    const now = Date.now();
    const { data: recent } = await supabaseAdmin
      .from("otp_requests")
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", new Date(now - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });
    if (recent && recent.length > 0) {
      const lastMs = new Date(recent[0].created_at).getTime();
      if (now - lastMs < 30_000) {
        return { ok: false as const, error: "Please wait 30 seconds before requesting a new OTP." };
      }
      if (recent.length >= 5) {
        return { ok: false as const, error: "Too many OTP requests. Try again in an hour." };
      }
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otp_hash = hashOtp(phone, otp);
    const expires_at = new Date(now + 5 * 60 * 1000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("otp_requests").insert({
      phone,
      otp_hash,
      role,
      expires_at,
      verified: false,
      attempts: 0,
    });
    if (insErr) return { ok: false as const, error: insErr.message };

    if (await devMode()) {
      return { ok: true as const, dev: true as const, otp };
    }

    await sendSmsPlaceholder(`+91${phone}`, otp);
    return { ok: true as const, dev: false as const };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      phone: PhoneSchema,
      otp: z.string().regex(/^[0-9]{6}$/),
      role: RoleSchema,
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { phone, otp, role } = data;

    if (role === "owner") {
      const { data: owner } = await supabaseAdmin
        .from("authorized_owners")
        .select("phone")
        .eq("phone", phone)
        .eq("active", true)
        .maybeSingle();
      if (!owner) {
        return { ok: false as const, error: "This number is not authorized for owner access." };
      }
    }

    const { data: row } = await supabaseAdmin
      .from("otp_requests")
      .select("*")
      .eq("phone", phone)
      .eq("role", role)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false as const, error: "No OTP requested. Please send one first." };
    if (row.attempts >= 5) return { ok: false as const, error: "Too many wrong attempts. Request a new OTP." };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "OTP expired. Request a new one." };
    }

    const expected = hashOtp(phone, otp);
    if (sha(expected) !== sha(row.otp_hash)) {
      await supabaseAdmin
        .from("otp_requests")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false as const, error: "Incorrect OTP." };
    }

    await supabaseAdmin
      .from("otp_requests")
      .update({ verified: true })
      .eq("id", row.id);

    const phoneE164Digits = `91${phone}`;
    const password = derivedPassword(phone);

    let existingId: string | null = null;
    for (let page = 1; page <= 10 && !existingId; page++) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listErr) break;
      const found = list.users.find((u) => (u.phone ?? "").replace(/\D/g, "").endsWith(phone));
      if (found) existingId = found.id;
      if (list.users.length < 1000) break;
    }

    if (existingId) {
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
        password,
        phone_confirm: true,
      });
      if (upErr) return { ok: false as const, error: `Auth update failed: ${upErr.message}` };
    } else {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        phone: phoneE164Digits,
        password,
        phone_confirm: true,
      });
      if (createErr) return { ok: false as const, error: `Auth create failed: ${createErr.message}` };
    }

    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const ephemeral = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signInErr } = await ephemeral.auth.signInWithPassword({
      phone: phoneE164Digits,
      password,
    });
    if (signInErr || !signIn.session) {
      return { ok: false as const, error: `Sign-in failed: ${signInErr?.message ?? "no session"}` };
    }

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
