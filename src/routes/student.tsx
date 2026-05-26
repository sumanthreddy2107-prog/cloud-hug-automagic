import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { logout, user } = useAuth();
  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link to="/student/home" className="font-semibold">Kaaizens Library</Link>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{user?.phone}</span>
              <button onClick={logout} className="text-primary hover:underline">Logout</button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}
