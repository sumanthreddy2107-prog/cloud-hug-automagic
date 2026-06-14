import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Eye, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/owner/invoices")({
  component: OwnerInvoices,
});

type Filter = "all" | "pending" | "verified" | "rejected";

interface InvoiceRow {
  id: string;
  created_at: string;
  booking_code: string;
  amount: number;
  payment_method: string | null;
  payment_status: string;
  payment_proof_url: string | null;
  pass_type: string;
  verified_at: string | null;
  seat: { seat_number: string } | null;
  student: { name: string; phone: string } | null;
}

async function fetchInvoices(): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id,created_at,booking_code,amount,payment_method,payment_status,payment_proof_url,pass_type,verified_at,seat:seats(seat_number),student:students(name,phone)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceRow[];
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    rejected: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
    paid: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${
        map[status] ?? "bg-slate-200 text-slate-700 ring-slate-300"
      }`}
    >
      {status}
    </span>
  );
}

function inr(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function OwnerInvoices() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [proof, setProof] = useState<{ url: string; code: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["owner", "invoices"],
    queryFn: fetchInvoices,
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    if (filter === "all") return data;
    return data.filter((r) => r.payment_status === filter);
  }, [data, filter]);

  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const collected = data
      .filter((r) => r.payment_status === "verified" && new Date(r.created_at).getTime() >= monthStart)
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const pending = data.filter((r) => r.payment_status === "pending").length;
    return { collected, pending, total: data.length };
  }, [data]);

  const updateStatus = async (id: string, status: "verified" | "rejected") => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          payment_status: status,
          verified_at: status === "verified" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Marked as ${status}`);
      await qc.invalidateQueries({ queryKey: ["owner", "invoices"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const openProof = async (path: string, code: string) => {
    const { data: signed, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 10);
    if (error || !signed) {
      toast.error("Could not load proof");
      return;
    }
    setProof({ url: signed.signedUrl, code });
  };

  const exportRows = () =>
    rows.map((r) => ({
      Date: fmtDate(r.created_at),
      "Booking Code": r.booking_code,
      Student: r.student?.name ?? "—",
      Phone: r.student?.phone ?? "—",
      Seat: r.seat?.seat_number ?? "—",
      Plan: r.pass_type === "month" ? "Month Pass" : "Day Pass",
      Amount: Number(r.amount),
      Method: r.payment_method ?? "—",
      Status: r.payment_status,
    }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `Kaaizens-Invoices-${Date.now()}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Kaaizens Library — Invoices", 40, 40);
    const data = exportRows();
    autoTable(doc, {
      startY: 60,
      head: [Object.keys(data[0] ?? { Date: "" })],
      body: data.map((r) => Object.values(r).map((v) => String(v))),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`Kaaizens-Invoices-${Date.now()}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1e3f]">Invoices</h1>
          <p className="text-sm text-slate-500">Verify payments and export records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Collected this month" value={inr(stats.collected)} accent="emerald" />
        <StatCard label="Pending verification" value={stats.pending} accent="amber" />
        <StatCard label="Total bookings" value={stats.total} accent="indigo" />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === f.id
                ? "bg-[#0b1e3f] text-white ring-[#0b1e3f]"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Seat / Plan</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Method</th>
                <th className="px-3 py-3">Proof</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 text-slate-600">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{r.student?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{r.student?.phone ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{r.seat?.seat_number ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {r.pass_type === "month" ? "Month Pass" : "Day Pass"}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{inr(r.amount)}</td>
                    <td className="px-3 py-3 capitalize text-slate-600">{r.payment_method ?? "—"}</td>
                    <td className="px-3 py-3">
                      {r.payment_method === "upi" && r.payment_proof_url ? (
                        <button
                          onClick={() => openProof(r.payment_proof_url!, r.booking_code)}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.payment_status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => updateStatus(r.id, "verified")}
                          disabled={busyId === r.id || r.payment_status === "verified"}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" /> Verify
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, "rejected")}
                          disabled={busyId === r.id || r.payment_status === "rejected"}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!proof} onOpenChange={(o) => !o && setProof(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Payment proof · {proof?.code}</DialogTitle>
          {proof && (
            <div className="mt-2 flex flex-col items-center gap-3">
              <img
                src={proof.url}
                alt="Payment proof"
                className="max-h-[70vh] w-auto rounded-lg border border-slate-200"
              />
              <a
                href={proof.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Open in new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "emerald" | "amber" | "indigo";
}) {
  const border: Record<string, string> = {
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    indigo: "border-l-indigo-500",
  };
  return (
    <div className={`rounded-xl border-l-4 ${border[accent]} bg-white p-4 shadow-sm`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
