import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Map, ListChecks, IndianRupee, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner")({
  component: OwnerLayoutRoute,
});

const NAV = [
  { to: "/owner/seats", label: "Seat Map", icon: Map },
  { to: "/owner/bookings", label: "Bookings", icon: ListChecks },
  { to: "/owner/revenue", label: "Revenue", icon: IndianRupee },
  { to: "/owner/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/owner/settings", label: "Settings", icon: SettingsIcon },
] as const;

async function fetchAlertCount() {
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [pending, grace, expiring] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "grace"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "active").gte("end_date", today).lte("end_date", in3),
  ]);
  return (pending.count ?? 0) + (grace.count ?? 0) + (expiring.count ?? 0);
}

function OwnerLayoutRoute() {
  const { logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: alertCount = 0 } = useQuery({
    queryKey: ["owner", "alert-count"],
    queryFn: fetchAlertCount,
    refetchInterval: 60_000,
  });

  return (
    <ProtectedRoute requiredRole="owner">
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Top bar */}
        <header className="sticky top-0 z-30 w-full bg-[#0b1e3f] text-white shadow">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="font-semibold tracking-wide">📚 Kaaizens Library — Owner</div>
            <div className="flex items-center gap-3">
              <Link to="/owner/alerts" className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {alertCount}
                  </span>
                )}
              </Link>
              <button onClick={logout} className="text-xs text-white/80 hover:text-white">Logout</button>
            </div>
          </div>
        </header>

        {/* Body with sidebar on desktop */}
        <div className="mx-auto flex max-w-6xl">
          {/* Desktop sidebar */}
          <aside className="sticky top-[60px] hidden h-[calc(100vh-60px)] w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-6 md:block">
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => {
                const active = pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
          <ul className="grid grid-cols-5">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <Link
                    to={n.to}
                    className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                      active ? "text-emerald-600" : "text-slate-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </ProtectedRoute>
  );
}
