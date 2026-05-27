import { supabase } from "@/integrations/supabase/client";

export interface SendInvoiceParams {
  phone: string;
  booking_code: string;
  seat_number: string;
  cabin_type: string;
  pass_type: string;
  start_date: string;
  end_date: string;
  amount: number;
  payment_method: string;
}

export async function sendInvoiceWhatsApp(p: SendInvoiceParams) {
  const message = `🧾 *Kaaizens Library — Invoice*

Booking: ${p.booking_code}
Seat: ${p.seat_number} (${p.cabin_type})
Pass: ${p.pass_type}
Valid: ${p.start_date} to ${p.end_date}
Amount: ₹${p.amount}
Payment: ${p.payment_method}

Thank you! 📚
Contact: +91 9515503335`;

  const { error } = await supabase.from("notifications").insert({
    type: "invoice",
    recipient_phone: p.phone,
    message,
    status: "queued",
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
