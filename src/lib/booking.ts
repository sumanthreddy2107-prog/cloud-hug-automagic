import { supabase } from "@/integrations/supabase/client";

export interface ConfirmBookingInput {
  student_id: string;
  seat_id: string;
  pass_type: "day" | "month";
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  amount: number;
  payment_method: "upi" | "counter";
  upi_transaction_id?: string;
}

function generateBookingCode(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `BK-${y}${m}${day}-${rand}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function confirmBooking(input: ConfirmBookingInput) {
  // 1. Check seat is still vacant
  const { data: seat, error: seatErr } = await supabase
    .from("seats")
    .select("id,status")
    .eq("id", input.seat_id)
    .maybeSingle();

  if (seatErr || !seat) {
    return { ok: false as const, error: "Seat not found" };
  }
  if (seat.status !== "vacant") {
    return { ok: false as const, error: "Seat no longer available" };
  }

  const booking_code = generateBookingCode();
  const grace_end_date = addDays(input.end_date, 2);

  const isUpi = input.payment_method === "upi";
  const status = isUpi ? "active" : "pending_payment";
  const payment_status = isUpi ? "paid" : "pending";
  const hold_expires_at = isUpi
    ? null
    : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      student_id: input.student_id,
      seat_id: input.seat_id,
      pass_type: input.pass_type,
      start_date: input.start_date,
      end_date: input.end_date,
      grace_end_date,
      amount: input.amount,
      payment_method: input.payment_method,
      payment_status,
      status,
      booking_code,
      hold_expires_at,
      upi_transaction_id: input.upi_transaction_id ?? null,
    })
    .select("*")
    .single();

  if (bookingErr || !booking) {
    return { ok: false as const, error: bookingErr?.message ?? "Booking failed" };
  }

  // Update seat status
  const newSeatStatus = isUpi ? "occupied" : "hold";
  await supabase
    .from("seats")
    .update({ status: newSeatStatus })
    .eq("id", input.seat_id);

  return { ok: true as const, booking };
}
