import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function EmailEntry() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    setLoading(false);
    if (otpErr) {
      setError(otpErr.message);
      return;
    }
    navigate({ to: "/otp", search: { email: email.trim(), role: "student" } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col gap-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-4xl">
            ✉️
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Enter your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll send a 6-digit OTP to your email to verify it
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            className="w-full rounded-md border border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <button
            type="button"
            disabled={!valid || loading}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send OTP via Email →
          </button>
        </div>
      </div>
    </div>
  );
}
