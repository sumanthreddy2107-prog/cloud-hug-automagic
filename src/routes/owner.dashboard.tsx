import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/owner/dashboard")({
  component: OwnerDashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Stats {
  occupied: number;
  vacant: number;
  pending: number;
  revenue: number;
  expiring: number;
  grace: number;
}

async function fetchStats(): Promise<Stats> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [occupied, vacant, pending, expiring, grace, revenueRows] = await Promise.all([
    supabase.from("seats").select("id", { count: "exact", head: true }).in("status", ["occupied", "grace"]),
    supabase.from("seats").select("id", { count: "exact", head: true }).eq("status", "vacant"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "active").gte("end_date", todayStr).lte("end_date", in3),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "grace"),
    supabase.from("bookings").select("amount").eq("payment_status", "paid").gte("created_at", monthStart),
  ]);

  const revenue = (revenueRows.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

  return {
    occupied: occupied.count ?? 0,
    vacant: vacant.count ?? 0,
    pending: pending.count ?? 0,
    revenue,
    expiring: expiring.count ?? 0,
    grace: grace.count ?? 0,
  };
}

const BORDER: Record<string, string> = {
  emerald: "border-l-emerald-500",
  blue: "border-l-blue-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
};

function Tile({
  emoji,
  label,
  value,
  color,
  loading,
}: {
  emoji: string;
  label: string;
  value: string | number;
  color: keyof typeof BORDER;
  loading: boolean;
}) {
  return (
    <div className={`rounded-xl border-l-4 ${BORDER[color]} bg-white p-4 shadow-sm`}>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="text-lg">{emoji}</span>
        {label}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-slate-200" />
      ) : (
        <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      )}
    </div>
  );
}

function OwnerDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["owner", "dashboard-stats"],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  const s = data;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1e3f] sm:text-3xl">
          {greeting()}, {user?.name || "Owner"} 👋
        </h1>
        <p className="text-sm text-slate-500">Here's what's happening at Kaaizens Library today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <Tile emoji="🟢" label="Occupied Seats" value={s?.occupied ?? 0} color="emerald" loading={isLoading} />
        <Tile emoji="🔵" label="Vacant Seats" value={s?.vacant ?? 0} color="blue" loading={isLoading} />
        <Tile emoji="⏳" label="Pending Payments" value={s?.pending ?? 0} color="amber" loading={isLoading} />
        <Tile emoji="💰" label="This Month Revenue" value={inr(s?.revenue ?? 0)} color="emerald" loading={isLoading} />
        <Tile emoji="⚠️" label="Expiring in 3 Days" value={s?.expiring ?? 0} color="amber" loading={isLoading} />
        <Tile emoji="🔄" label="In Grace Period" value={s?.grace ?? 0} color="red" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/owner/seats" className="rounded-xl bg-[#0b1e3f] px-4 py-3 text-center text-sm font-semibold text-white shadow hover:bg-[#13294f]">
          View Seat Map
        </Link>
        <Link to="/owner/alerts" className="rounded-xl bg-amber-500 px-4 py-3 text-center text-sm font-semibold text-white shadow hover:bg-amber-600">
          Pending Payments
        </Link>
        <Link to="/owner/revenue" className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow hover:bg-emerald-700">
          Today's Revenue
        </Link>
      </div>
    </div>
  );
}
