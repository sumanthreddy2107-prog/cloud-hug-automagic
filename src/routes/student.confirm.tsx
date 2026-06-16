import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Lock,
  User,
  Ticket,
  X,
  Calendar as CalendarIcon,
  Pencil,
  Minus,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/student/confirm")({
  component: ConfirmPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";

interface BookingDraft {
  seatType: SeatType;
  passType: PassType;
  amount: number; // unit price (per month or per day)
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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  // Date state
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthStart, setMonthStart] = useState<Date>(today);
  const [months, setMonths] = useState<number>(1);
  const [monthsInput, setMonthsInput] = useState<string>("1");
  const [dayFrom, setDayFrom] = useState<Date>(today);
  const [dayTo, setDayTo] = useState<Date>(today);
  const [editMonthStart, setEditMonthStart] = useState(false);
  const [editDayFrom, setEditDayFrom] = useState(false);
  const [editDayTo, setEditDayTo] = useState(false);

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

  const unitPrice = draft.amount;
  const isMonth = draft.passType === "month";

  // Derived date / amount values
  const monthDays = months * 30;
  const monthEnd = addDays(monthStart, monthDays - 1);
  const dayCount = Math.max(
    1,
    Math.round((startOfDay(dayTo).getTime() - startOfDay(dayFrom).getTime()) / 86400000) + 1,
  );
  const quantity = isMonth ? months : dayCount;
  const subtotal = unitPrice * quantity;
  const startDate = isMonth ? monthStart : dayFrom;
  const endDate = isMonth ? monthEnd : dayTo;

  // Re-compute coupon discount on subtotal changes
  const discount = useMemo(() => {
    if (!coupon) return 0;
    if (coupon.type === "fixed") return Math.min(Number(coupon.value), subtotal);
    return Math.round((subtotal * Number(coupon.value)) / 100);
  }, [coupon, subtotal]);
  const finalTotal = Math.max(0, subtotal - discount);

  const cabinLabel = draft.seatType === "ac" ? "❄️ AC Cabin" : "🪑 Non-AC Cabin";
  const passLabel = isMonth ? "🗓️ Month Pass" : "📅 Day Pass";

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
      setCoupon({ ...c, discount: 0 });
      setCouponInput("");
      toast.success(`🎟️ Coupon ${c.code} applied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const commitMonths = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) {
      setMonths(n);
      setMonthsInput(String(n));
    } else {
      setMonthsInput(String(months));
    }
  };

  const handleDayFromChange = (d: Date | undefined) => {
    if (!d) return;
    const nd = startOfDay(d);
    setDayFrom(nd);
    if (nd.getTime() > startOfDay(dayTo).getTime()) {
      setDayTo(nd);
    }
    setEditDayFrom(false);
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
          startDate: toISODate(startDate),
          endDate: toISODate(endDate),
          months: isMonth ? months : undefined,
          days: !isMonth ? dayCount : undefined,
          unitPrice,
          amount: finalTotal,
          originalAmount: subtotal,
          coupon: coupon
            ? { code: coupon.code, discount }
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

      {/* Dates & Duration */}
      <div className="rounded-2xl bg-white p-6 text-slate-900 shadow">
        <div className="mb-4 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-emerald-600" />
          <h2 className="font-bold">
            {isMonth ? "Pass Duration" : "Booking Dates"}
          </h2>
        </div>

        {isMonth ? (
          <div className="space-y-4">
            {/* Start Date */}
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Start date
                  </div>
                  <div className="mt-1 text-base font-semibold">
                    {formatDate(monthStart)}
                  </div>
                </div>
                {editMonthStart ? (
                  <button
                    type="button"
                    onClick={() => setEditMonthStart(false)}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditMonthStart(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
              {editMonthStart && (
                <div className="mt-3 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={monthStart}
                    onSelect={(d) => d && setMonthStart(startOfDay(d))}
                    className="pointer-events-auto rounded-md border"
                  />
                </div>
              )}
            </div>

            {/* Months stepper */}
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 text-xs font-medium text-slate-500">
                Number of months
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const n = Math.max(1, months - 1);
                    setMonths(n);
                    setMonthsInput(String(n));
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                  aria-label="Decrease months"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={monthsInput}
                  onChange={(e) => setMonthsInput(e.target.value)}
                  onBlur={(e) => commitMonths(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitMonths(monthsInput);
                  }}
                  className="h-10 w-20 rounded-lg border border-slate-200 text-center text-base font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = months + 1;
                    setMonths(n);
                    setMonthsInput(String(n));
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                  aria-label="Increase months"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="ml-2 text-sm text-slate-500">
                  {months} {months === 1 ? "month" : "months"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DateRow
              label="From"
              date={dayFrom}
              editing={editDayFrom}
              onToggle={() => setEditDayFrom((v) => !v)}
              onChange={handleDayFromChange}
            />
            <DateRow
              label="To"
              date={dayTo}
              editing={editDayTo}
              minDate={dayFrom}
              onToggle={() => setEditDayTo((v) => !v)}
              onChange={(d) => {
                if (!d) return;
                setDayTo(startOfDay(d));
                setEditDayTo(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Coupon Code */}
      <div className="rounded-2xl bg-white p-6 text-slate-900 shadow">
        <div className="mb-3 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-emerald-600" />
          <h2 className="font-bold">Have a coupon?</h2>
        </div>
        {coupon ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold tracking-wider text-emerald-700">
                🎟️ {coupon.code}
              </div>
              <div className="text-xs text-emerald-600">
                {coupon.type === "fixed"
                  ? `₹${coupon.value} off`
                  : `${coupon.value}% off`}
                {" · "}−₹{discount.toLocaleString("en-IN")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCoupon(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              aria-label="Remove coupon"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
              placeholder="ENTER CODE"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono uppercase tracking-wider outline-none placeholder:font-sans placeholder:tracking-normal focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={applyingCoupon || !couponInput.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {applyingCoupon ? "…" : "Apply"}
            </button>
          </div>
        )}
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
          <SummaryRow label="Start Date" value={formatDate(startDate)} stripe />
          <SummaryRow label="End Date" value={formatDate(endDate)} stripe={false} />
          {isMonth ? (
            <SummaryRow
              label="Duration"
              value={`${months} ${months === 1 ? "month" : "months"} (${monthDays} days)`}
              stripe
            />
          ) : (
            <SummaryRow
              label="Total Days"
              value={`${dayCount} ${dayCount === 1 ? "day" : "days"}`}
              stripe
            />
          )}
          <SummaryRow
            label="Rate"
            value={`₹${unitPrice.toLocaleString("en-IN")} × ${quantity}`}
            stripe={false}
          />
        </div>
        {coupon ? (
          <div className="mt-2 space-y-1 px-6 pb-2 pt-3 text-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="line-through">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600">
              <span>Discount ({coupon.code})</span>
              <span>− ₹{discount.toLocaleString("en-IN")}</span>
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between bg-emerald-50 px-6 py-4">
          <span className="text-sm font-medium text-slate-700">
            {coupon ? "Final Total" : "Total Amount"}
          </span>
          <span className="text-2xl font-bold text-emerald-600">
            ₹{finalTotal.toLocaleString("en-IN")}
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

function DateRow({
  label,
  date,
  editing,
  minDate,
  onToggle,
  onChange,
}: {
  label: string;
  date: Date;
  editing: boolean;
  minDate?: Date;
  onToggle: () => void;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-base font-semibold">{formatDate(date)}</div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={
            editing
              ? "rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              : "inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          {editing ? "Done" : (<><Pencil className="h-3 w-3" /> Edit</>)}
        </button>
      </div>
      {editing && (
        <div className="mt-3 flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onChange}
            disabled={minDate ? { before: minDate } : undefined}
            className="pointer-events-auto rounded-md border"
          />
        </div>
      )}
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
