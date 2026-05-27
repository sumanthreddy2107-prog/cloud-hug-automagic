import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { sendOtp } from "@/lib/otp";

export function PhoneEntry({ role }: { role: "student" | "owner" }) {
  const navigate = useNavigate();
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^\d{10}$/.test(digits);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    const res = await sendOtp({ phone: digits, role });
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "Unauthorised" ? "Unauthorised" : "Could not send OTP. Please try again.");
      return;
    }
    navigate({
      to: "/otp",
      search: { phone: digits, role, devOtp: res.devOtp },
    });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-3xl">
          💬
        </div>
        <h1 className="mt-6 text-center text-2xl font-bold">Enter your WhatsApp number</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We&apos;ll send a 6-digit OTP to your WhatsApp
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex w-full flex-col gap-4">
          <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-input focus-within:border-primary">
            <span className="flex items-center px-4 text-sm font-medium text-muted-foreground border-r border-border">
              +91
            </span>
            <input
              inputMode="numeric"
              autoFocus
              placeholder="9XXXXXXXXX"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="flex-1 bg-transparent px-3 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={!valid || loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Sending..." : "Send OTP on WhatsApp →"}
          </button>
        </form>
      </div>
    </div>
  );
}
