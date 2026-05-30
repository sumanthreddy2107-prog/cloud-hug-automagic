import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendOtp, verifyOtp } from "@/lib/otp.functions";

export const Route = createFileRoute("/otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: search.phone ? String(search.phone) : "",
    role: (search.role === "owner" ? "owner" : "student") as "student" | "owner",
    devOtp: search.devOtp ? String(search.devOtp) : "",
  }),
  component: OtpPage,
});

function OtpPage() {
  const { phone, role, devOtp } = Route.useSearch();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const send = useServerFn(sendOtp);
  const verify = useServerFn(verifyOtp);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [resending, setResending] = useState(false);
  const [devOtpShown, setDevOtpShown] = useState(devOtp);
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
    if (!c) { setDigit(i, ""); return; }
    if (c.length === 1) {
      setDigit(i, c);
      if (i < 5) refs.current[i + 1]?.focus();
    } else {
      const chars = c.slice(0, 6).split("");
      const next = Array(6).fill("");
      chars.forEach((ch, idx) => (next[idx] = ch));
      setDigits(next);
      refs.current[Math.min(chars.length, 5)]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onVerify = async () => {
    if (!filled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verify({ data: { phone, otp: code, role } });
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (setErr) {
        setError(setErr.message);
        setLoading(false);
        return;
      }
      await refresh();
      setLoading(false);
      navigate({ to: role === "owner" ? "/owner/dashboard" : "/student/home" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await send({ data: { phone, role } });
      if (!res.ok) {
        setError(res.error);
      } else {
        setCountdown(30);
        setDigits(Array(6).fill(""));
        if ("dev" in res && res.dev) setDevOtpShown(res.otp);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white px-6 py-6">
      <Link
        to={role === "owner" ? "/login/owner" : "/login/student"}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" /> Back
      </Link>

      <div className="mx-auto mt-8 flex max-w-md flex-col">
        <h1 className="text-2xl font-bold">Verify OTP</h1>
        <p className="mt-2 text-sm text-gray-400">
          Enter the 6-digit code sent to +91 {phone}
        </p>

        {devOtpShown && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-amber-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Dev mode</div>
              <div>Your OTP is <span className="font-mono text-lg tracking-widest">{devOtpShown}</span></div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              inputMode="numeric"
              maxLength={6}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-full rounded-md border border-white/20 bg-white/10 text-center text-lg font-semibold text-white focus:border-emerald-400 focus:outline-none"
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          type="button"
          disabled={!filled || loading}
          onClick={onVerify}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 hover:bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify →
        </button>

        <div className="mt-4 text-center text-sm text-gray-400">
          {countdown > 0 ? (
            <>Resend OTP in {countdown}s</>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="text-emerald-400 hover:underline disabled:opacity-50"
            >
              {resending ? "Resending..." : "Resend OTP"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
