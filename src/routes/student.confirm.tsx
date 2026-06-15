import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, User, Ticket, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";


export const Route = createFileRoute("/student/confirm")({
  component: ConfirmPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";

interface BookingDraft {
  seatType: SeatType;
  passType: PassType;
  amount: number;
  seatId?: string;
  seatNumber?: string;
}

function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem("kaaizens.booking");
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type AppliedCoupon = {
  id: string;
  code: string;
  type: "fixed" | "percent";
  value: number;
  applies_to: "both" | "month" | "day";
  discount: number;
};

function ConfirmPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d || !d.seatId) {
      navigate({ to: "/student/seats" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  const { data: student } = useQuery({
    queryKey: ["student", user?.studentId],
    queryFn: async () => {
      if (!user?.studentId) return null;
      const { data, error } = await supabase
        .from("students")
        .select("id,name,phone")
        .eq("id", user.studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.studentId,
  });

  useEffect(() => {
    if (student?.name) setName(student.name);
    else if (user?.name) setName(user.name);
  }, [student, user]);

  if (!draft) return null;

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + (draft.passType === "month" ? 30 : 1));

  const cabinLabel = draft.seatType === "ac" ? "❄️ AC Cabin" : "🪑 Non-AC Cabin";
  const passLabel = draft.passType === "month" ? "🗓️ Month Pass" : "📅 Day Pass";

  const subtotal = draft.amount;
  const discount = coupon?.discount ?? 0;
  const finalTotal = Math.max(0, subtotal - discount);

  const computeDiscount = (c: { type: "fixed" | "percent"; value: number }, amount: number) => {
    if (c.type === "fixed") return Math.min(Number(c.value), amount);
    return Math.round((amount * Number(c.value)) / 100);
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setApplyingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("id,code,type,value,applies_to")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Invalid coupon code.");
        return;
      }
      const c = data as Omit<AppliedCoupon, "discount">;
      if (c.applies_to !== "both" && c.applies_to !== draft.passType) {
        const which = c.applies_to === "month" ? "Month" : "Day";
        toast.error(`This coupon is valid for ${which} Pass only.`);
        return;
      }
      setCoupon({ ...c, discount: computeDiscount(c, subtotal) });
      setCouponInput("");
      toast.success(`🎟️ Coupon ${c.code} applied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleProceed = async () => {
    if (!name.trim()) {
      toast("Please enter your name");
      return;
    }
    setSaving(true);
    try {
      if (user?.studentId && name.trim() !== student?.name) {
        const { error } = await supabase
          .from("students")
          .update({ name: name.trim() })
          .eq("id", user.studentId);
        if (error) throw error;
      }
      sessionStorage.setItem(
        "kaaizens.booking",
        JSON.stringify({
          ...draft,
          name: name.trim(),
          startDate: today.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          amount: finalTotal,
          originalAmount: subtotal,
          coupon: coupon
            ? { code: coupon.code, discount: coupon.discount }
            : null,
        }),
      );
      navigate({ to: "/student/payment" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/student/seats"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-foreground">Step 3 of 3</span>
            <span>· Confirm</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>

      <h1 className="text-2xl font-bold">Confirm Booking</h1>

      {/* Student Details */}
      <div className="rounded-2xl bg-white p-6 text-slate-900 shadow">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-emerald-600" />
          <h2 className="font-bold">Your Details</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Phone
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              <span>{student?.phone ?? user?.phone}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Login number cannot be changed
            </p>
          </div>
        </div>
      </div>

      {/* Booking Summary */}
      <div className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow">
        <div className="h-1 w-full bg-emerald-500" />
        <div className="p-6 pb-0">
          <h2 className="mb-4 font-bold">📋 Booking Summary</h2>
        </div>
        <div className="px-6">
          <SummaryRow label="Seat Number" value={draft.seatNumber ?? "—"} stripe={false} />
          <SummaryRow label="Cabin Type" value={cabinLabel} stripe />
          <SummaryRow label="Pass Type" value={passLabel} stripe={false} />
          <SummaryRow label="Valid From" value={formatDate(today)} stripe />
          <SummaryRow label="Valid Until" value={formatDate(end)} stripe={false} />
        </div>
        <div className="mt-4 flex items-center justify-between bg-emerald-50 px-6 py-4">
          <span className="text-sm font-medium text-slate-700">Total Amount</span>
          <span className="text-2xl font-bold text-emerald-600">
            ₹{draft.amount.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={handleProceed}
        disabled={saving}
        className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Proceed to Payment →"}
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  stripe,
}: {
  label: string;
  value: string;
  stripe: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-3 text-sm ${
        stripe ? "bg-slate-50" : "bg-white"
      } -mx-2 rounded`}
    >
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
