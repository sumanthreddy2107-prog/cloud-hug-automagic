import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/owner")({
  component: OwnerLayout,
});

function OwnerLayout() {
  const { logout } = useAuth();
  const navItems = [
    { to: "/owner/dashboard", label: "Dashboard" },
    { to: "/owner/seats", label: "Seats" },
    { to: "/owner/bookings", label: "Bookings" },
    { to: "/owner/revenue", label: "Revenue" },
    { to: "/owner/alerts", label: "Alerts" },
    { to: "/owner/settings", label: "Settings" },
  ] as const;

  return (
    <ProtectedRoute requiredRole="owner">
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link to="/owner/dashboard" className="font-semibold">Kaaizens · Owner</Link>
            <button onClick={logout} className="text-sm text-primary hover:underline">Logout</button>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-6 pb-3 text-sm">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeProps={{ className: "text-primary font-semibold" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}
