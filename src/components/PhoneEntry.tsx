import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { sendOtp } from "@/lib/otp";

export function PhoneEntry({ role }: { role: "student" | "owner" }) {
  const navigate = useNavigate();
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[0-9]{10}$/.test(digits);

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    const res = await sendOtp({ phone: digits, role });
    setLoading(false);
    if (res.ok) {
      navigate({ to: "/otp", search: { phone: digits, role } });
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      {/* Hidden reCAPTCHA container required by Firebase */}
      <div id="recaptcha-container" />

      <div className="w-full max-w-md flex flex-col gap-6">
        <Link
          to={role === "owner" ? "/login/owner" : "/"}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground self-start"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Phone icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-4xl">
            📱
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Enter your phone number
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll send a 6-digit OTP via SMS to verify your number
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-0 rounded-md border border-border bg-input overflow-hidden">
            <span className="px-4 py-3 text-foreground font-medium border-r border-border bg-muted">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Enter 10-digit number"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              className="flex-1 px-4 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!valid || loading}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send OTP via SMS →
          </button>
        </div>
      </div>
    </div>
  );
}
