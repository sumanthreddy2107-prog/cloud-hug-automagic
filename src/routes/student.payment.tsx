import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { confirmBooking } from "@/lib/booking";
import { toast } from "sonner";

export const Route = createFileRoute("/student/payment")({
  component: PaymentPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";

interface BookingDraft {
  seatType: SeatType;
  passType: PassType;
  amount: number;
  seatId?: string;
  seatNumber?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
}

function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem("kaaizens.booking");
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState<null | "upi" | "counter">(null);
  const [counterBookingCode, setCounterBookingCode] = useState<string | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d || !d.seatId || !d.startDate || !d.endDate) {
      navigate({ to: "/student/confirm" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  const { data: qrUrl } = useQuery({
    queryKey: ["settings", "qr_image_url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "qr_image_url")
        .maybeSingle();
      return data?.value ?? "";
    },
  });

  if (!draft) return null;

  const passLabel = draft.passType === "month" ? "Month Pass" : "Day Pass";

  const doConfirm = async (method: "upi" | "counter") => {
    if (!user?.studentId || !draft.seatId || !draft.startDate || !draft.endDate) return;
    setSubmitting(method);
    try {
      const res = await confirmBooking({
        seat_id: draft.seatId,
        pass_type: draft.passType,
        start_date: draft.startDate,
        end_date: draft.endDate,
        amount: draft.amount,
        payment_method: method,
        upi_transaction_id: method === "upi" ? utr.trim() : undefined,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Booking failed. Please try again.");
        setSubmitting(null);
        return;
      }

      sessionStorage.setItem(
        "kaaizens.lastBooking",
        JSON.stringify(res.booking),
      );

      if (method === "upi") {
        sessionStorage.removeItem("kaaizens.booking");
        navigate({ to: "/student/confirmed" });
      } else {
        setCounterBookingCode(res.booking.booking_code);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center gap-3">
        <Link
          to="/student/confirm"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Payment</h1>
      </div>

      {/* Amount */}
      <div className="text-center">
        <p className="text-[2.5rem] font-bold leading-none text-foreground">
          ₹{draft.amount.toLocaleString("en-IN")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Seat {draft.seatNumber} · {passLabel}
        </p>
      </div>

      {/* UPI */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-bold">💳 Pay via UPI</h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Recommended
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="UPI QR Code"
              className="max-w-[220px] rounded-lg border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-400">
              QR Code will appear here
            </div>
          )}
          <p className="text-xs text-slate-600">
            Scan with GPay, PhonePe, Paytm or any UPI app
          </p>
          <p className="text-xs text-slate-400">Pay to: Kaaizens Library</p>
        </div>

        <div className="mt-6 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            Enter Transaction ID after payment
          </label>
          <input
            type="text"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            placeholder="Enter UTR / Transaction ID"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <p className="text-[11px] text-slate-400">
            You can find this in your UPI app payment history
          </p>
        </div>

        <button
          onClick={() => doConfirm("upi")}
          disabled={utr.trim().length < 8 || submitting !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-white shadow transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "upi" && <Loader2 className="h-4 w-4 animate-spin" />}
          ✅ I Have Paid — Confirm Booking
        </button>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Counter */}
      <section className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-slate-900">
        <h2 className="mb-2 font-bold">🏦 Pay at the Counter</h2>
        <p className="mb-3 text-sm text-slate-600">
          Visit our front desk and pay cash or card.
        </p>
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Your seat will be held for only 2 hours
        </div>

        {counterBookingCode ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-xs font-medium text-emerald-700">
                Your Booking Code
              </p>
              <p className="my-1 text-xl font-bold text-emerald-700">
                #{counterBookingCode}
              </p>
              <p className="text-xs text-emerald-700">
                Show this code at the front desk
              </p>
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem("kaaizens.booking");
                navigate({ to: "/student/confirmed" });
              }}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
            >
              Continue →
            </button>
          </div>
        ) : (
          <button
            onClick={() => doConfirm("counter")}
            disabled={submitting !== null}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 font-semibold text-white shadow transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting === "counter" && <Loader2 className="h-4 w-4 animate-spin" />}
            Reserve Seat — I'll Pay Later
          </button>
        )}
      </section>
    </div>
  );
}
