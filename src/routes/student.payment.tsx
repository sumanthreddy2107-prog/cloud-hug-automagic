import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, UploadCloud, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { confirmBooking } from "@/lib/booking";
import { toast } from "sonner";

export const Route = createFileRoute("/student/payment")({
  component: PaymentPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";

interface BookingDraft {
  seatType: SeatType;
  passType: PassType;
  amount: number;
  seatId?: string;
  seatNumber?: string;
  startDate?: string;
  endDate?: string;
  name?: string;
}

function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem("kaaizens.booking");
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg"];

function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [submitting, setSubmitting] = useState<null | "upi" | "counter">(null);
  const [counterBookingCode, setCounterBookingCode] = useState<string | null>(null);

  // Upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d || !d.seatId || !d.startDate || !d.endDate) {
      navigate({ to: "/student/confirm" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const { data: qrUrl } = useQuery({
    queryKey: ["settings", "qr_image_url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "qr_image_url")
        .maybeSingle();
      return data?.value ?? "";
    },
  });

  if (!draft) return null;

  const passLabel = draft.passType === "month" ? "Month Pass" : "Day Pass";

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please upload a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      toast.error("Image is too large (max 5MB).");
      return;
    }
    setProofFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    pickFile(f ?? null);
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile || !user?.id) return null;
    const ext = proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("payment-proofs")
      .upload(path, proofFile, { contentType: proofFile.type, upsert: false });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    return path;
  };

  const doConfirm = async (method: "upi" | "counter") => {
    if (!user?.studentId || !draft.seatId || !draft.startDate || !draft.endDate) return;
    setSubmitting(method);
    try {
      let proofPath: string | undefined;
      if (method === "upi") {
        const uploaded = await uploadProof();
        if (!uploaded) {
          setSubmitting(null);
          return;
        }
        proofPath = uploaded;
      }

      const res = await confirmBooking({
        seat_id: draft.seatId,
        pass_type: draft.passType,
        start_date: draft.startDate,
        end_date: draft.endDate,
        amount: draft.amount,
        payment_method: method,
        payment_proof_url: proofPath,
      });

      if (!res.ok) {
        toast.error(res.error ?? "Booking failed. Please try again.");
        setSubmitting(null);
        return;
      }

      sessionStorage.setItem("kaaizens.lastBooking", JSON.stringify(res.booking));

      if (method === "upi") {
        sessionStorage.removeItem("kaaizens.booking");
        navigate({ to: "/student/confirmed" });
      } else {
        setCounterBookingCode(res.booking.booking_code);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1020] text-slate-100">
      {/* Aurora blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#4F46E5] opacity-30 blur-[120px]" />
        <div className="absolute right-[-120px] top-32 h-[380px] w-[380px] rounded-full bg-[#7C3AED] opacity-25 blur-[120px]" />
        <div className="absolute bottom-[-120px] left-1/3 h-[420px] w-[420px] rounded-full bg-[#14B8A6] opacity-20 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/student/confirm"
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">Payment</h1>
        </div>

        {/* Amount */}
        <div className="text-center">
          <p className="font-display text-[2.75rem] font-bold leading-none tracking-tight text-white">
            ₹{draft.amount.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Seat {draft.seatNumber} · {passLabel}
          </p>
        </div>

        {/* UPI Card with gradient border */}
        <div className="rounded-[24px] bg-gradient-to-br from-[#4F46E5] via-[#7C3AED] to-[#14B8A6] p-[1.5px] shadow-[0_20px_60px_-20px_rgba(79,70,229,0.55)]">
          <section className="rounded-[22px] bg-white/5 p-6 backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-white">💳 Pay via UPI</h2>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                Recommended
              </span>
            </div>

            <div className="flex flex-col items-center gap-2">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="UPI QR Code"
                  className="max-w-[220px] rounded-xl border border-white/15 bg-white p-2 shadow-lg"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-center text-xs text-slate-400">
                  QR Code will appear here
                </div>
              )}
              <p className="text-xs text-slate-300">Scan with GPay, PhonePe, Paytm or any UPI app</p>
              <p className="text-xs text-slate-400">Pay to: Kaaizens Library</p>
            </div>

            {/* Upload */}
            <div className="mt-6 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Upload payment screenshot
              </label>

              {proofPreview ? (
                <div className="relative overflow-hidden rounded-xl border border-white/15 bg-white/5 p-2">
                  <img src={proofPreview} alt="Payment proof preview" className="mx-auto max-h-56 rounded-lg" />
                  <button
                    onClick={() => setProofFile(null)}
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />{proofFile?.name}</span>
                    <span>{((proofFile?.size ?? 0) / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition ${
                    dragOver
                      ? "border-indigo-300 bg-indigo-400/10"
                      : "border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <UploadCloud className="h-6 w-6 text-indigo-300" />
                  <p className="text-sm font-medium text-white">Drag & drop or tap to select</p>
                  <p className="text-[11px] text-slate-400">PNG or JPG · max 5MB</p>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              onClick={() => doConfirm("upi")}
              disabled={!proofFile || submitting !== null}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3.5 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.7)] transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === "upi" && <Loader2 className="h-4 w-4 animate-spin" />}
              ✅ Confirm Booking
            </button>
          </section>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Counter */}
        <section className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="mb-2 font-display text-lg font-bold text-white">🏦 Pay at the Counter</h2>
          <p className="mb-3 text-sm text-slate-300">Visit our front desk and pay cash or card.</p>
          <div className="mb-4 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/30">
            ⚠️ Your seat will be held for only 2 hours
          </div>

          {counterBookingCode ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-4 text-center">
                <p className="text-xs font-medium text-emerald-200">Your Booking Code</p>
                <p className="my-1 font-display text-2xl font-bold text-emerald-200">
                  #{counterBookingCode}
                </p>
                <p className="text-xs text-emerald-200/80">Show this code at the front desk</p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.removeItem("kaaizens.booking");
                  navigate({ to: "/student/confirmed" });
                }}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 font-semibold text-white shadow hover:from-indigo-400 hover:to-violet-400"
              >
                Continue →
              </button>
            </div>
          ) : (
            <button
              onClick={() => doConfirm("counter")}
              disabled={submitting !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-50"
            >
              {submitting === "counter" && <Loader2 className="h-4 w-4 animate-spin" />}
              Reserve Seat — I'll Pay Later
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
