import { supabase } from "@/integrations/supabase/client";

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function toE164India(local10: string): string {
  return `+91${digitsOnly(local10).slice(-10)}`;
}

/** Returns true if the given 10-digit local phone matches the configured owner_phone setting. */
export async function isOwnerPhone(local10: string): Promise<boolean> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "owner_phone")
    .maybeSingle();
  const ownerDigits = digitsOnly(data?.value ?? "");
  if (!ownerDigits) return false;
  // Compare last 10 digits (ignore country code formatting)
  return ownerDigits.slice(-10) === digitsOnly(local10).slice(-10);
}
