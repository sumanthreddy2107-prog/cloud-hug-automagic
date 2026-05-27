import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/student/home")({
  component: StudentHome,
});

type Booking = {
  id: string;
  seat_id: string;
  pass_type: string;
  start_date: string;
  end_date: string;
  amount: number;
  status: string;
  booking_code: string;
  seat?: { seat_number: string; seat_type: string } | null;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function fetchBookings(studentId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, seat:seats(seat_number, seat_type)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

function StudentHome() {
  const { user, role, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (role !== "student" || !user?.studentId)) {
      navigate({ to: "/" });
    }
  }, [isLoading, role, user, navigate]);

  const studentId = user?.studentId;

  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ["student-bookings", studentId],
    queryFn: () => fetchBookings(studentId!),
    enabled: !!studentId,
  });

  const active = bookings?.find((b) =>
    ["active", "grace", "pending_payment"].includes(b.status),
  );
  const past = (bookings ?? []).filter((b) => ["expired", "cancelled"].includes(b.status));

  const onLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="text-base font-semibold text-foreground">📚 Kaaizens Library</div>
        <button
          onClick={onLogout}
          aria-label="Logout"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold">
          {greeting()}, {user?.name ?? "Student"} 👋
        </h1>

        <section className="mt-6">
          {loadingBookings ? (
            <SkeletonCard />
          ) : active ? (
            <>
              {active.status === "grace" && (
                <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  ⚠️ Your booking has expired. You have a 2-day grace period. Please renew to keep your seat.
                </div>
              )}
              <ActiveBookingCard booking={active} />
            </>
          ) : (
            <BookNewCard />
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Booking History</h2>
          <div className="mt-3 flex flex-col gap-2">
            {loadingBookings ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : past.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past bookings yet</p>
            ) : (
              past.map((b) => <PastRow key={b.id} booking={b} />)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-emerald-500/20 text-emerald-300", label: "Active ✓" },
    grace: { cls: "bg-amber-500/20 text-amber-300", label: "⚠️ Grace Period" },
    pending_payment: { cls: "bg-blue-500/20 text-blue-300", label: "⏳ Payment Pending" },
  };
  const s = map[status] ?? { cls: "bg-muted text-muted-foreground", label: status };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
  );
}

function ActiveBookingCard({ booking }: { booking: Booking }) {
  const seatNumber = booking.seat?.seat_number ?? "—";
  const seatType = booking.seat?.seat_type;
  const seatLabel = seatType === "AC" ? "❄️ AC Cabin" : "🪑 Non-AC Cabin";
  const passLabel = booking.pass_type === "month" ? "Month Pass" : "Day Pass";

  return (
    <div className="relative rounded-xl border-l-4 border-primary bg-white p-5 text-slate-900 shadow-lg">
      <div className="absolute right-4 top-4">
        <StatusBadge status={booking.status} />
      </div>
      <div className="text-3xl font-bold text-slate-900">{seatNumber}</div>
      <div className="mt-1 text-sm text-slate-600">{seatLabel}</div>
      <div className="mt-3 text-sm text-slate-700">{passLabel}</div>
      <div className="mt-1 text-sm text-slate-700">
        Valid from {fmtDate(booking.start_date)} to {fmtDate(booking.end_date)}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">
        Amount: ₹{Number(booking.amount).toLocaleString("en-IN")}
      </div>

      <div className="mt-5 flex gap-3">
        <button className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          View Invoice
        </button>
        <Link
          to="/student/book"
          className="flex-1 rounded-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Renew
        </Link>
      </div>
    </div>
  );
}

function BookNewCard() {
  return (
    <Link
      to="/student/book"
      className="flex flex-col items-center justify-center rounded-xl bg-primary px-6 py-10 text-center text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
    >
      <span className="text-5xl">🪑</span>
      <span className="mt-3 text-xl font-bold">Book a Seat</span>
      <span className="mt-1 text-sm opacity-90">110 AC + 100 Non-AC cabins available</span>
    </Link>
  );
}

function PastRow({ booking }: { booking: Booking }) {
  const seatNumber = booking.seat?.seat_number ?? "—";
  const passLabel = booking.pass_type === "month" ? "Month" : "Day";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{seatNumber}</span>
        <span className="text-xs">
          {passLabel} · {fmtDate(booking.start_date)} – {fmtDate(booking.end_date)}
        </span>
      </div>
      <span>₹{Number(booking.amount).toLocaleString("en-IN")}</span>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />;
}

function SkeletonRow() {
  return <div className="h-14 w-full animate-pulse rounded-md bg-muted" />;
}
