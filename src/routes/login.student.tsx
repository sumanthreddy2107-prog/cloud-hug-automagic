import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/login/student")({
  component: StudentLogin,
});

function StudentLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+?\d{10,13}$/.test(phone.replace(/\s/g, ""))) return;
    navigate({ to: "/otp", search: { phone, role: "student" } });
  };

  return (
    <AuthShell title="Student login" subtitle="Enter your phone to receive an OTP">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="tel"
          placeholder="+91 9XXXXXXXXX"
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

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
