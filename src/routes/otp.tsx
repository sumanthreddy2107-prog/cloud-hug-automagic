import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "./login.student";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: String(search.phone ?? ""),
    role: (search.role === "owner" ? "owner" : "student") as "student" | "owner",
  }),
  component: OtpPage,
});

function OtpPage() {
  const { phone, role } = Route.useSearch();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [code, setCode] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // OTP verification stubbed for foundation — accepts any 6 digits
    if (!/^\d{4,6}$/.test(code)) return;
    login({ phone }, role);
    navigate({ to: role === "owner" ? "/owner/dashboard" : "/student/home" });
  };

  return (
    <AuthShell title="Verify OTP" subtitle={`Sent to ${phone}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          inputMode="numeric"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-border bg-input px-4 py-3 text-center text-lg tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Verify & continue
        </button>
      </form>
    </AuthShell>
  );
}
