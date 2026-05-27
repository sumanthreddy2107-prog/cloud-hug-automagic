import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Download, Send } from "lucide-react";
import jsPDF from "jspdf";
import { useAuth } from "@/context/AuthContext";
import { sendInvoiceWhatsApp } from "@/lib/notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/student/confirmed")({
  component: ConfirmedPage,
});

interface LastBooking {
  id: string;
  booking_code: string;
  seat_id: string;
  pass_type: "day" | "month";
  start_date: string;
  end_date: string;
  amount: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
}

function readLastBooking(): LastBooking | null {
  try {
    const raw = sessionStorage.getItem("kaaizens.lastBooking");
    return raw ? (JSON.parse(raw) as LastBooking) : null;
  } catch {
    return null;
  }
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ConfirmedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<LastBooking | null>(null);
  const [seatNumber, setSeatNumber] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const b = readLastBooking();
    if (!b) {
      navigate({ to: "/student/home" });
      return;
    }
    setBooking(b);

    // fetch seat number
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("seats")
        .select("seat_number,seat_type")
        .eq("id", b.seat_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSeatNumber(data.seat_number);
        });
    });
  }, [navigate]);

  if (!booking) return null;

  const cabinType = seatNumber.startsWith("AC") ? "AC Cabin" : "Non-AC Cabin";
  const passLabel = booking.pass_type === "month" ? "Month Pass" : "Day Pass";
  const paymentLabel = booking.payment_method === "upi" ? "UPI" : "Pay at Counter";
  const today = new Date();
  const invoiceNo = `INV-${booking.booking_code}`;
  const studentName = user?.name ?? "—";
  const studentPhone = user?.phone ?? "—";

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    let y = 60;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("KAAIZENS LIBRARY", w / 2, y, { align: "center" });
    y += 22;
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text("BOOKING INVOICE", w / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 14;
    doc.setLineWidth(0.5);
    doc.setDrawColor(16, 185, 129);
    doc.line(60, y, w - 60, y);
    y += 28;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const rows: [string, string][] = [
      ["Invoice No.", invoiceNo],
      ["Date", fmt(today.toISOString())],
      ["Student Name", studentName],
      ["WhatsApp No.", studentPhone],
      ["Seat Number", seatNumber || "—"],
      ["Cabin Type", cabinType],
      ["Pass Type", passLabel],
      ["Valid From", fmt(booking.start_date)],
      ["Valid Until", fmt(booking.end_date)],
      ["Payment Mode", paymentLabel],
      ["Amount Paid", `Rs. ${booking.amount}`],
    ];

    rows.forEach(([label, value]) => {
      doc.setTextColor(120, 120, 120);
      doc.text(label, 60, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", label === "Amount Paid" ? "bold" : "normal");
      doc.text(String(value), w - 60, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 20;
    });

    y += 20;
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(10);
    doc.text("Thank you for choosing Kaaizens Library!", w / 2, y, { align: "center" });
    y += 14;
    doc.text("Contact: +91 9515503335", w / 2, y, { align: "center" });

    doc.save(`KaaizensLibrary-Invoice-${booking.booking_code}.pdf`);
  };

  const handleSendWhatsApp = async () => {
    if (!user?.phone) return;
    setSending(true);
    try {
      const res = await sendInvoiceWhatsApp({
        phone: user.phone,
        booking_code: booking.booking_code,
        seat_number: seatNumber,
        cabin_type: cabinType,
        pass_type: passLabel,
        start_date: fmt(booking.start_date),
        end_date: fmt(booking.end_date),
        amount: booking.amount,
        payment_method: paymentLabel,
      });
      if (res.ok) toast.success("Invoice queued for WhatsApp delivery");
      else toast.error(res.error ?? "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 pb-10">
      {/* Animated checkmark */}
      <div className="mt-2 flex flex-col items-center gap-3">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 shadow-lg animate-in zoom-in duration-500"
          style={{ animation: "bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        >
          <Check className="h-12 w-12 text-white" strokeWidth={3} />
        </div>
        <style>{`
          @keyframes bounce-in {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); }
          }
        `}</style>
        <h1 className="text-2xl font-bold text-foreground">Booking Confirmed! 🎉</h1>
        <p className="text-sm text-muted-foreground">
          You're all set at Kaaizens Library
        </p>
      </div>

      {/* Invoice card */}
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200 bg-white text-slate-900 shadow-lg">
        {/* Navy header */}
        <div className="bg-slate-900 px-6 py-5 text-center">
          <h2 className="text-lg font-bold tracking-wide text-white">
            📚 KAAIZENS LIBRARY
          </h2>
          <p className="mt-1 text-xs font-semibold tracking-widest text-emerald-400">
            BOOKING INVOICE
          </p>
          <div className="mx-auto mt-3 h-px w-16 bg-emerald-500" />
        </div>

        {/* Details */}
        <div className="px-6 py-5">
          <Section>
            <Row label="Invoice No." value={invoiceNo} />
            <Row label="Date" value={fmt(today.toISOString())} />
          </Section>
          <Divider />
          <Section>
            <Row label="Student Name" value={studentName} />
            <Row label="WhatsApp No." value={studentPhone} />
          </Section>
          <Divider />
          <Section>
            <Row label="Seat Number" value={seatNumber || "—"} />
            <Row label="Cabin Type" value={cabinType} />
            <Row label="Pass Type" value={passLabel} />
            <Row label="Valid From" value={fmt(booking.start_date)} />
            <Row label="Valid Until" value={fmt(booking.end_date)} />
          </Section>
          <Divider />
          <Section>
            <Row label="Payment Mode" value={paymentLabel} />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-slate-500">Amount Paid</span>
              <span className="text-lg font-bold text-emerald-600">
                ₹{booking.amount.toLocaleString("en-IN")}
              </span>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
          <p className="text-xs italic text-slate-500">
            Thank you for choosing Kaaizens Library! 📚
          </p>
          <p className="text-xs italic text-slate-500">Contact: +91 9515503335</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <button
          onClick={handleDownloadPdf}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 font-semibold text-white shadow hover:bg-emerald-600"
        >
          <Download className="h-4 w-4" />
          Download PDF Invoice
        </button>
        <button
          onClick={handleSendWhatsApp}
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-transparent px-6 py-3 font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : "Send to My WhatsApp"}
        </button>
        <button
          onClick={() => {
            sessionStorage.removeItem("kaaizens.lastBooking");
            navigate({ to: "/student/home" });
          }}
          className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          Go to My Dashboard
        </button>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-3 h-px w-full bg-slate-100" />;
}
