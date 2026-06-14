import { createBooking } from "@/lib/booking.functions";

export interface ConfirmBookingInput {
  seat_id: string;
  pass_type: "day" | "month";
  start_date: string;
  end_date: string;
  amount: number;
  payment_method: "upi" | "counter";
  payment_proof_url?: string;
}

export async function confirmBooking(input: ConfirmBookingInput) {
  try {
    const { booking } = await createBooking({ data: input });
    return { ok: true as const, booking };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Booking failed" };
  }
}
