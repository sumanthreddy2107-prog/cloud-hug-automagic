import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createStudent, sendOtp, verifyOtp } from "@/lib/otp";

export const Route = createFileRoute("/otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: String(search.phone ?? ""),
    role: (search.role === "owner" ? "owner" : "student") as "student" | "owner",
    devOtp: search.devOtp ? String(search.devOtp) : undefined,
  }),
  component: OtpPage,
});

function OtpPage() {
  const { phone, role, devOtp } = Route.useSearch();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [resending, setResending] = useState(false);
  const [currentDevOtp, setCurrentDevOtp] = useState<string | undefined>(devOtp);
  const [showNameModal, setShowNameModal] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [name, setName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const code = digits.join("");
  const filled = code.length === 6;

  const setDigit = (i: number, v: string) => {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
  };

  const handleChange = (i: number, v: string) => {
    const c = v.replace(/\D/g, "");
    if (!c) {
      setDigit(i, "");
      return;
    }
    if (c.length === 1) {
      setDigit(i, c);
      if (i < 5) refs.current[i + 1]?.focus();
    } else {
      // paste
      const chars = c.slice(0, 6).split("");
      const next = Array(6).fill("");
      chars.forEach((ch, idx) => (next[idx] = ch));
      setDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      refs.current[focusIdx]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const onVerify = async () => {
    if (!filled || loading) return;
    setLoading(true);
    setError(null);
    const res = await verifyOtp({ phone, code });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.role === "owner") {
      login({ phone: res.phone }, "owner");
      navigate({ to: "/owner/dashboard" });
      return;
    }
    if (res.isNewUser) {
      setVerifiedPhone(res.phone);
      setShowNameModal(true);
      return;
    }
    login({ phone: res.phone, studentId: res.studentId, name: res.name }, "student");
    navigate({ to: "/student/home" });
  };

  const onResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError(null);
    const res = await sendOtp({ phone, role });
    setResending(false);
    if (res.ok) {
      setCurrentDevOtp(res.devOtp);
      setCountdown(30);
      setDigits(Array(6).fill(""));
    } else {
      setError("Could not resend OTP.");
    }
  };

  const onSubmitName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || nameLoading) return;
    setNameLoading(true);
    try {
      const created = await createStudent(verifiedPhone, trimmed);
      login({ phone: verifiedPhone, studentId: created.id, name: created.name }, "student");
      navigate({ to: "/student/home" });
    } catch {
      setError("Could not save name. Try again.");
      setNameLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <Link to="/login/student" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mx-auto mt-8 flex max-w-md flex-col">
        <h1 className="text-2xl font-bold">Verify OTP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit code sent to +91{phone}
        </p>

        {currentDevOtp && (
          <div className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span className="font-semibold">Dev Mode OTP:</span>{" "}
            <span className="font-mono tracking-widest text-foreground">{currentDevOtp}</span>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={6}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-full rounded-md border border-border bg-input text-center text-lg font-semibold text-foreground focus:border-primary focus:outline-none"
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <button
          type="button"
          disabled={!filled || loading}
          onClick={onVerify}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verify →
        </button>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {countdown > 0 ? (
            <>Resend OTP in {countdown}s</>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {resending ? "Resending..." : "Resend OTP"}
            </button>
          )}
        </div>
      </div>

      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-xl">
            <h2 className="text-xl font-bold">Welcome! What&apos;s your name?</h2>
            <form onSubmit={onSubmitName} className="mt-4 flex flex-col gap-4">
              <input
                autoFocus
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!name.trim() || nameLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Get Started →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
