import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, eachDayOfInterval,
} from "date-fns";
import { CalendarIcon, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/owner/revenue")({
  component: RevenuePage,
});

type Period = "today" | "week" | "month" | "custom";

type BookingRow = {
  id: string;
  booking_code: string;
  amount: number;
  payment_status: string;
  payment_method: string | null;
  pass_type: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  student_id: string;
  seat_id: string;
};

type StudentRow = { id: string; name: string; phone: string };
type SeatRow = { id: string; seat_number: string; seat_type: string };

function fmtINR(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN");
}

function RevenuePage() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(endOfMonth(new Date()));

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (period === "today") return { from: startOfDay(now), to: endOfDay(now) };
    if (period === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    if (period === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
    return { from: customFrom ?? startOfMonth(now), to: customTo ?? endOfMonth(now) };
  }, [period, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id,booking_code,amount,payment_status,payment_method,pass_type,status,start_date,end_date,created_at,student_id,seat_id")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (bookings ?? []) as BookingRow[];
      const sIds = Array.from(new Set(rows.map((r) => r.student_id)));
      const seatIds = Array.from(new Set(rows.map((r) => r.seat_id)));
      const [studentsRes, seatsRes] = await Promise.all([
        sIds.length ? supabase.from("students").select("id,name,phone").in("id", sIds) : Promise.resolve({ data: [] as StudentRow[] }),
        seatIds.length ? supabase.from("seats").select("id,seat_number,seat_type").in("id", seatIds) : Promise.resolve({ data: [] as SeatRow[] }),
      ]);
      const studentMap = new Map<string, StudentRow>((studentsRes.data ?? []).map((s) => [s.id, s as StudentRow]));
      const seatMap = new Map<string, SeatRow>((seatsRes.data ?? []).map((s) => [s.id, s as SeatRow]));
      return { rows, studentMap, seatMap };
    },
  });

  const rows = data?.rows ?? [];
  const confirmed = rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0);
  const pending = rows.filter((r) => r.payment_status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalCount = rows.length;

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: from, end: to });
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayRows = rows.filter((r) => r.created_at.slice(0, 10) === key);
      return {
        date: format(d, "MMM d"),
        Confirmed: dayRows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.amount || 0), 0),
        Pending: dayRows.filter((r) => r.payment_status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0),
      };
    });
  }, [rows, from, to]);

  const breakdown = useMemo(() => {
    const cats = [
      { key: "ac_month", label: "AC Month Pass", match: (r: BookingRow) => data?.seatMap.get(r.seat_id)?.seat_type === "ac" && r.pass_type === "month" },
      { key: "ac_day", label: "AC Day Pass", match: (r: BookingRow) => data?.seatMap.get(r.seat_id)?.seat_type === "ac" && r.pass_type === "day" },
      { key: "nonac_month", label: "Non-AC Month Pass", match: (r: BookingRow) => data?.seatMap.get(r.seat_id)?.seat_type === "nonac" && r.pass_type === "month" },
      { key: "nonac_day", label: "Non-AC Day Pass", match: (r: BookingRow) => data?.seatMap.get(r.seat_id)?.seat_type === "nonac" && r.pass_type === "day" },
    ];
    const computed = cats.map((c) => {
      const matched = rows.filter(c.match);
      return { label: c.label, count: matched.length, revenue: matched.reduce((s, r) => s + Number(r.amount || 0), 0) };
    });
    const totalRev = computed.reduce((s, c) => s + c.revenue, 0);
    const totalCnt = computed.reduce((s, c) => s + c.count, 0);
    return { rows: computed, totalRev, totalCnt };
  }, [rows, data]);

  const upiCount = rows.filter((r) => r.payment_method === "upi").length;
  const counterCount = rows.filter((r) => r.payment_method === "counter").length;
  const paySum = upiCount + counterCount;
  const upiPct = paySum ? Math.round((upiCount / paySum) * 100) : 0;
  const counterPct = paySum ? 100 - upiPct : 0;

  const exportCSV = () => {
    const header = ["Booking Code", "Student Name", "Phone", "Seat", "Type", "Pass", "Start Date", "End Date", "Amount", "Payment Method", "Status", "Date"];
    const lines = rows.map((r) => {
      const stu = data?.studentMap.get(r.student_id);
      const seat = data?.seatMap.get(r.seat_id);
      return [
        r.booking_code, stu?.name ?? "", stu?.phone ?? "",
        seat?.seat_number ?? "", seat?.seat_type === "ac" ? "AC" : "Non-AC",
        r.pass_type, r.start_date, r.end_date, r.amount,
        r.payment_method ?? "", r.payment_status,
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PeriodBtn = ({ value, label }: { value: Period; label: string }) => (
    <button
      onClick={() => setPeriod(value)}
      className={cn(
        "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
        period === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-input hover:bg-accent",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">💰 Revenue</h1>
        <Button variant="outline" onClick={exportCSV} className="border-[#0c2340] text-[#0c2340]">
          <Download className="w-4 h-4 mr-1" /> Export as CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PeriodBtn value="today" label="Today" />
        <PeriodBtn value="week" label="This Week" />
        <PeriodBtn value="month" label="This Month" />
        <PeriodBtn value="custom" label="Custom Range" />
        {period === "custom" && (
          <div className="flex flex-wrap gap-2 ml-2">
            <DatePick label="From" date={customFrom} onChange={setCustomFrom} />
            <DatePick label="To" date={customTo} onChange={setCustomTo} />
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard bg="bg-emerald-600" title="✅ Confirmed Revenue" value={fmtINR(confirmed)} loading={isLoading} />
        <SummaryCard bg="bg-amber-500" title="⏳ Pending Revenue" value={fmtINR(pending)} loading={isLoading} />
        <SummaryCard bg="bg-[#0c2340]" title="📊 Total Bookings" value={String(totalCount)} loading={isLoading} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Daily Revenue</h2>
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v: number) => fmtINR(v)} />
              <Legend />
              <Bar dataKey="Confirmed" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Revenue by Category</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Bookings</th>
                <th className="py-2 px-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-muted/40" : ""}>
                  <td className="py-2 px-3">{r.label}</td>
                  <td className="py-2 px-3">{r.count}</td>
                  <td className="py-2 px-3 text-right">{fmtINR(r.revenue)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t bg-emerald-50">
                <td className="py-2 px-3">TOTAL</td>
                <td className="py-2 px-3">{breakdown.totalCnt}</td>
                <td className="py-2 px-3 text-right">{fmtINR(breakdown.totalRev)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Payment Method Split</h2>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-emerald-700 font-medium">UPI: {upiPct}%</span>
          <span className="text-amber-700 font-medium">Counter: {counterPct}%</span>
        </div>
        <div className="flex w-full h-4 rounded-full overflow-hidden bg-muted">
          <div className="bg-emerald-600" style={{ width: `${upiPct}%` }} />
          <div className="bg-amber-500" style={{ width: `${counterPct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {upiCount} UPI payment{upiCount === 1 ? "" : "s"} · {counterCount} counter payment{counterCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ bg, title, value, loading }: { bg: string; title: string; value: string; loading: boolean }) {
  return (
    <div className={cn("rounded-xl shadow p-5 text-white", bg)}>
      <div className="text-sm opacity-90">{title}</div>
      {loading ? (
        <Skeleton className="h-8 w-32 mt-2 bg-white/30" />
      ) : (
        <div className="text-3xl font-bold mt-1">{value}</div>
      )}
    </div>
  );
}

function DatePick({ label, date, onChange }: { label: string; date?: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="w-4 h-4 mr-2" />
          {date ? format(date, "PP") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}
