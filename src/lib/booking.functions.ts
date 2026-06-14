import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  seat_id: z.string().uuid(),
  pass_type: z.enum(["day", "month"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(1_000_000),
  payment_method: z.enum(["upi", "counter"]),
  payment_proof_url: z.string().min(1).max(2048).optional(),
});

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

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Find the caller's student row (RLS-scoped)
    const { data: student, error: stuErr } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (stuErr || !student) throw new Error("Student profile not found.");

    // 2. Verify seat is vacant using the admin client (atomicity-ish)
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from("seats")
      .select("id,status")
      .eq("id", data.seat_id)
      .maybeSingle();
    if (seatErr || !seat) throw new Error("Seat not found.");
    if (seat.status !== "vacant") throw new Error("Seat no longer available.");

    const isUpi = data.payment_method === "upi";
    if (isUpi && !data.payment_proof_url) {
      throw new Error("Payment screenshot is required.");
    }
    // UPI: booking is CONFIRMED (active) immediately, payment awaits owner verification.
    // Counter: held for 2 hours pending payment.
    const status = isUpi ? "active" : "pending_payment";
    const payment_status = "pending";
    const hold_expires_at = isUpi
      ? null
      : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const booking_code = generateBookingCode();
    const grace_end_date = addDays(data.end_date, 2);

    const { data: booking, error: bookErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        student_id: student.id,
        seat_id: data.seat_id,
        pass_type: data.pass_type,
        start_date: data.start_date,
        end_date: data.end_date,
        grace_end_date,
        amount: data.amount,
        payment_method: data.payment_method,
        payment_status,
        status,
        booking_code,
        hold_expires_at,
        payment_proof_url: data.payment_proof_url ?? null,
      })
      .select("*")
      .single();
    if (bookErr || !booking) throw new Error(bookErr?.message ?? "Booking failed");

    // 4. Update seat status
    const newSeatStatus = isUpi ? "occupied" : "hold";
    const { error: seatUpdErr } = await supabaseAdmin
      .from("seats")
      .update({ status: newSeatStatus })
      .eq("id", data.seat_id);
    if (seatUpdErr) {
      // Best-effort rollback
      await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
      throw new Error("Could not reserve the seat. Please try again.");
    }

    return { booking };
  });
