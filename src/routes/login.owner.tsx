import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "./login.student";

export const Route = createFileRoute("/login/owner")({
  component: OwnerLogin,
});

function OwnerLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ""))) return;
    navigate({ to: "/otp", search: { phone, role: "owner" } });
  };

  return (
    <AuthShell title="Owner login" subtitle="Owner-only access. Enter your phone.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="tel"
          placeholder="+91 9515503335"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-md border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Send OTP
        </button>
      </form>
    </AuthShell>
  );
}
