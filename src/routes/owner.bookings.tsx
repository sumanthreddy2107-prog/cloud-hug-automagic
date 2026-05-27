import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Inbox, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendInvoiceWhatsApp } from "@/lib/notifications";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/owner/bookings")({
  component: BookingsPage,
});

type Status = "active" | "pending_payment" | "grace" | "expired" | "cancelled";
type Filter = "all" | "active" | "pending_payment" | "grace" | "day" | "month" | "expired";
type Sort = "newest" | "expiry" | "seat";

interface Booking {
  id: string;
  booking_code: string;
  student_id: string;
  seat_id: string;
  pass_type: string;
  start_date: string;
  end_date: string;
  grace_end_date: string | null;
  amount: number;
  payment_method: string | null;
  payment_status: string;
  status: Status;
  created_at: string;
}

interface Joined extends Booking {
  student_name: string;
  student_phone: string;
  seat_number: string;
  seat_type: string;
}

const PAGE = 20;

async function fetchBookings(): Promise<Joined[]> {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (bookings ?? []) as Booking[];
  if (list.length === 0) return [];

  const studentIds = [...new Set(list.map((b) => b.student_id))];
  const seatIds = [...new Set(list.map((b) => b.seat_id))];
  const [{ data: students }, { data: seats }] = await Promise.all([
    supabase.from("students").select("id,name,phone").in("id", studentIds),
    supabase.from("seats").select("id,seat_number,seat_type").in("id", seatIds),
  ]);
  const sMap = new Map((students ?? []).map((s) => [s.id, s]));
  const seatMap = new Map((seats ?? []).map((s) => [s.id, s]));
  return list.map((b) => ({
    ...b,
    student_name: sMap.get(b.student_id)?.name ?? "—",
    student_phone: sMap.get(b.student_id)?.phone ?? "",
    seat_number: seatMap.get(b.seat_id)?.seat_number ?? "—",
    seat_type: seatMap.get(b.seat_id)?.seat_type ?? "",
  }));
}

const STATUS_META: Record<string, { border: string; badge: string; label: string }> = {
  active: { border: "border-l-emerald-500", badge: "bg-emerald-100 text-emerald-700", label: "Active" },
  pending_payment: { border: "border-l-blue-500", badge: "bg-blue-100 text-blue-700", label: "Pending Payment" },
  grace: { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-700", label: "Grace" },
  expired: { border: "border-l-slate-400", badge: "bg-slate-200 text-slate-700", label: "Expired" },
  cancelled: { border: "border-l-slate-400", badge: "bg-slate-200 text-slate-600", label: "Cancelled" },
};

function fmt(d: string): string {
  return format(new Date(d), "dd MMM yyyy");
}

function BookingsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Joined | null>(null);
  const [cancelling, setCancelling] = useState<Joined | null>(null);

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["owner", "bookings"],
    queryFn: fetchBookings,
  });

  const filtered = useMemo(() => {
    let arr = bookings;
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter((b) =>
        b.student_name.toLowerCase().includes(q) ||
        b.student_phone.toLowerCase().includes(q) ||
        b.seat_number.toLowerCase().includes(q) ||
        b.booking_code.toLowerCase().includes(q)
      );
    }
    switch (filter) {
      case "active": arr = arr.filter((b) => b.status === "active"); break;
      case "pending_payment": arr = arr.filter((b) => b.status === "pending_payment"); break;
      case "grace": arr = arr.filter((b) => b.status === "grace"); break;
      case "day": arr = arr.filter((b) => b.pass_type === "day"); break;
      case "month": arr = arr.filter((b) => b.pass_type === "month"); break;
      case "expired": arr = arr.filter((b) => b.status === "expired"); break;
    }
    const sorted = [...arr];
    if (sort === "newest") {
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === "expiry") {
      sorted.sort((a, b) => +new Date(a.end_date) - +new Date(b.end_date));
    } else {
      sorted.sort((a, b) => a.seat_number.localeCompare(b.seat_number));
    }
    return sorted;
  }, [bookings, query, filter, sort]);

  const visible = filtered.slice(0, page * PAGE);

  const handleMarkPaid = async (b: Joined) => {
    const [b1, s1] = await Promise.all([
      supabase.from("bookings").update({ payment_status: "paid", status: "active" }).eq("id", b.id),
      supabase.from("seats").update({ status: "occupied" }).eq("id", b.seat_id),
    ]);
    if (b1.error || s1.error) { toast.error(b1.error?.message || s1.error?.message || "Failed"); return; }
    toast.success("✅ Payment confirmed!");
    refetch();
  };

  const handleReleaseSeat = async (b: Joined) => {
    const [b1, s1] = await Promise.all([
      supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id),
      supabase.from("seats").update({ status: "vacant" }).eq("id", b.seat_id),
    ]);
    if (b1.error || s1.error) { toast.error(b1.error?.message || s1.error?.message || "Failed"); return; }
    toast.success("Seat released");
    refetch();
  };

  const handleCancel = async () => {
    if (!cancelling) return;
    const b = cancelling;
    const [b1, s1] = await Promise.all([
      supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id),
      supabase.from("seats").update({ status: "vacant" }).eq("id", b.seat_id),
    ]);
    if (b1.error || s1.error) { toast.error(b1.error?.message || s1.error?.message || "Failed"); return; }
    toast.success("Booking cancelled. Seat is now available.");
    setCancelling(null);
    refetch();
  };

  const handleResend = async (b: Joined) => {
    try {
      await sendInvoiceWhatsApp({
        booking_code: b.booking_code,
        seat_number: b.seat_number,
        cabin_type: b.seat_type === "ac" ? "AC Cabin" : "Non-AC Cabin",
        pass_type: b.pass_type === "month" ? "Month Pass" : "Day Pass",
        start_date: fmt(b.start_date),
        end_date: fmt(b.end_date),
        amount: Number(b.amount),
        payment_method: (b.payment_method || "—").toUpperCase(),
        phone: b.student_phone,
      });
      toast.success("Invoice queued to WhatsApp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1e3f]">Bookings</h1>
        <p className="text-xs text-slate-500">Manage all student bookings</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search name, phone, or seat number..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Filter chips + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {([
            ["all", "All"],
            ["active", "Active"],
            ["pending_payment", "Pending Payment"],
            ["grace", "Grace Period"],
            ["day", "Day Pass"],
            ["month", "Month Pass"],
            ["expired", "Expired"],
          ] as Array<[Filter, string]>).map(([key, label]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => { setFilter(key); setPage(1); }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="newest">Newest First</option>
          <option value="expiry">Expiry Soonest</option>
          <option value="seat">Seat Number</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No bookings found</p>
          <p className="text-xs text-slate-500">Try changing your search or filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              onMarkPaid={() => handleMarkPaid(b)}
              onRelease={() => handleReleaseSeat(b)}
              onEdit={() => setEditing(b)}
              onCancel={() => setCancelling(b)}
              onResend={() => handleResend(b)}
            />
          ))}
          {visible.length < filtered.length && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="mx-auto mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load More ({filtered.length - visible.length} remaining)
            </button>
          )}
        </div>
      )}

      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch(); }}
        />
      )}

      {cancelling && (
        <ConfirmModal
          title="Cancel this booking?"
          message="The seat will be freed and made available for new bookings."
          confirmLabel="Yes, Cancel"
          danger
          onConfirm={handleCancel}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  );
}

function BookingCard({
  b, onMarkPaid, onRelease, onEdit, onCancel, onResend,
}: {
  b: Joined;
  onMarkPaid: () => void;
  onRelease: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onResend: () => void;
}) {
  const meta = STATUS_META[b.status] ?? STATUS_META.expired;
  const passLabel = b.pass_type === "month" ? "Month Pass" : "Day Pass";
  const isCounter = (b.payment_method ?? "").toLowerCase() === "counter";
  const payLabel = isCounter ? "Counter ⏳" : "UPI ✅";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${meta.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-mono text-slate-400">#{b.booking_code}</div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{passLabel}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>{meta.label}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold text-slate-900">{b.seat_number}</span>
        <span className="text-sm font-medium text-slate-800">{b.student_name}</span>
        <span className="text-xs text-slate-500">{b.student_phone}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>{fmt(b.start_date)} → {fmt(b.end_date)}</span>
        <span className="font-semibold text-slate-900">₹{Number(b.amount).toLocaleString("en-IN")}</span>
        <span>{payLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {b.status === "pending_payment" ? (
          <>
            <button onClick={onMarkPaid} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
              ✅ Mark as Paid
            </button>
            <button onClick={onRelease} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
              ❌ Release Seat
            </button>
            <button onClick={onEdit} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              👁️ View Details
            </button>
          </>
        ) : b.status === "active" || b.status === "grace" ? (
          <>
            <button onClick={onEdit} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              ✏️ Edit
            </button>
            <button onClick={onCancel} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
              ❌ Cancel
            </button>
            <button onClick={onResend} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              📲 Resend Invoice
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  title, message, confirmLabel, danger, onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Keep</button>
        <button
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${danger ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function EditBookingModal({
  booking, onClose, onSaved,
}: { booking: Joined; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(booking.student_name);
  const [phone, setPhone] = useState(booking.student_phone);
  const [expiry, setExpiry] = useState<Date>(new Date(booking.end_date));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const expiryStr = format(expiry, "yyyy-MM-dd");
    const graceStr = format(new Date(expiry.getTime() + 2 * 86400000), "yyyy-MM-dd");
    const [s, b] = await Promise.all([
      supabase.from("students").update({ name, phone }).eq("id", booking.student_id),
      supabase.from("bookings").update({ end_date: expiryStr, grace_end_date: graceStr }).eq("id", booking.id),
    ]);
    setSaving(false);
    if (s.error || b.error) {
      toast.error(s.error?.message || b.error?.message || "Save failed");
      return;
    }
    toast.success("Booking updated");
    onSaved();
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-slate-900">Edit Booking</h3>
      <p className="mt-1 text-xs text-slate-500">#{booking.booking_code} · {booking.seat_number}</p>

      <div className="mt-4 flex flex-col gap-3">
        <Field label="Student Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Student Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Expiry Date">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-left text-sm">
                {format(expiry, "PPP")}
                <CalendarIcon className="h-4 w-4 text-slate-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expiry}
                onSelect={(d) => d && setExpiry(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
