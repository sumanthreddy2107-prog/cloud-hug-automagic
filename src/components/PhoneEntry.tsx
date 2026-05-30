import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, User, Shield } from "lucide-react";
import { sendOtp } from "@/lib/otp.functions";

export function PhoneEntry({ role }: { role: "student" | "owner" }) {
  const navigate = useNavigate();
  const send = useServerFn(sendOtp);
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[0-9]{10}$/.test(digits);
  const isOwner = role === "owner";

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await send({ data: { phone: digits, role } });
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      const devOtp = "dev" in res && res.dev ? res.otp : undefined;
      navigate({ to: "/otp", search: { phone: digits, role, devOtp: devOtp ?? "" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to={isOwner ? "/" : "/"}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isOwner ? "bg-sky-500" : "bg-emerald-500"}`}>
            {isOwner ? <Shield className="w-8 h-8 text-white" /> : <User className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white">{isOwner ? "Owner Login" : "Student Login"}</h1>
          <p className="text-gray-400 mt-1 text-sm">
            We'll send a 6-digit OTP to verify your number
          </p>
        </div>

        <div className="space-y-4">
          <label className="text-gray-300 text-sm block">Phone Number</label>
          <div className="flex gap-2">
            <span className="flex items-center bg-white/10 border border-white/20 rounded-md px-3 text-gray-300 text-sm">
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit number"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              className="flex-1 bg-white/10 border border-white/20 rounded-md text-white h-12 px-3 placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
              maxLength={10}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="button"
            disabled={!valid || loading}
            onClick={handleSubmit}
            className={`w-full inline-flex items-center justify-center gap-2 h-12 rounded-md text-white font-semibold transition-colors disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed ${isOwner ? "bg-sky-500 hover:bg-sky-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send OTP
          </button>
        </div>
      </div>
    </div>
  );
}
