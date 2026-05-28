import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, Check, X, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/owner/alerts")({
  component: AlertsPage,
});

type Booking = {
  id: string;
  booking_code: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  amount: number;
  start_date: string;
  end_date: string;
  grace_end_date: string | null;
  hold_expires_at: string | null;
  student_id: string;
  seat_id: string;
  created_at: string;
};
type Student = { id: string; name: string; phone: string };
type Seat = { id: string; seat_number: string; seat_type: string };

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("91") ? digits : `91${digits}`;
  return `https://wa.me/${num}`;
}

function diffParts(target: Date) {
  const ms = target.getTime() - Date.now();
  return { ms, h: Math.floor(ms / 3600000), m: Math.floor((ms % 3600000) / 60000), s: Math.floor((ms % 60000) / 1000) };
}

function AlertsPage() {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["alerts"] }), 120_000);
    return () => clearInterval(t);
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const { data: rows, error } = await supabase
        .from("bookings")
        .select("id,booking_code,status,payment_method,payment_status,amount,start_date,end_date,grace_end_date,hold_expires_at,student_id,seat_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const all = (rows ?? []) as Booking[];
      const sIds = Array.from(new Set(all.map((r) => r.student_id)));
      const seatIds = Array.from(new Set(all.map((r) => r.seat_id)));
      const [stuRes, seatRes] = await Promise.all([
        sIds.length ? supabase.from("students").select("id,name,phone").in("id", sIds) : Promise.resolve({ data: [] }),
        seatIds.length ? supabase.from("seats").select("id,seat_number,seat_type").in("id", seatIds) : Promise.resolve({ data: [] }),
      ]);
      const stuMap = new Map<string, Student>(((stuRes.data ?? []) as Student[]).map((s) => [s.id, s]));
      const seatMap = new Map<string, Seat>(((seatRes.data ?? []) as Seat[]).map((s) => [s.id, s]));

      const nowIso = new Date().toISOString();
      const pending = all.filter((b) => b.status === "pending_payment" && b.payment_method === "counter" && b.hold_expires_at && b.hold_expires_at > nowIso);
      const expiring = all.filter((b) => b.status === "active" && b.end_date >= today && b.end_date <= in3);
      const grace = all.filter((b) => b.status === "grace");
      const released = all.filter((b) => b.status === "expired" && b.created_at > since);
      return { pending, expiring, grace, released, stuMap, seatMap };
    },
    refetchInterval: 120_000,
  });

  const pending = data?.pending ?? [];
  const expiring = data?.expiring ?? [];
  const grace = data?.grace ?? [];
  const released = data?.released ?? [];
  const stuMap = data?.stuMap ?? new Map();
  const seatMap = data?.seatMap ?? new Map();

  const markPaid = async (b: Booking) => {
    await supabase.from("bookings").update({ status: "active", payment_status: "paid", hold_expires_at: null }).eq("id", b.id);
    await supabase.from("seats").update({ status: "occupied" }).eq("id", b.seat_id);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  const release = async (b: Booking) => {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", b.id);
    await supabase.from("seats").update({ status: "vacant" }).eq("id", b.seat_id);
    toast.success("Seat released");
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  const sendReminder = async (b: Booking) => {
    const stu = stuMap.get(b.student_id);
    const seat = seatMap.get(b.seat_id);
    if (!stu) return;
    const msg = `Hi ${stu.name}, your seat ${seat?.seat_number ?? ""} pass expires on ${b.end_date}. Renew at Kaaizens Library to avoid losing your seat. 📚`;
    await supabase.from("notifications").insert({ type: "reminder", recipient_phone: stu.phone, message: msg, status: "queued", booking_id: b.id });
    toast.success(`Reminder sent to ${stu.name}! ✓`);
  };
  const sendAllReminders = async () => {
    for (const b of expiring) await sendReminder(b);
  };
  const extendGrace = async (b: Booking) => {
    const base = b.grace_end_date ? new Date(b.grace_end_date) : new Date();
    const next = new Date(base.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    await supabase.from("bookings").update({ grace_end_date: next }).eq("id", b.id);
    toast.success("Grace extended 7 days");
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">⚠️ Alerts</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">⚠️ Alerts</h1>

      {/* Pending */}
      <Section title="🔴 Pending Counter Payments" count={pending.length} color="text-red-700 border-red-200 bg-red-50">
        {pending.length === 0 ? (
          <Empty msg="✅ No pending counter payments" />
        ) : (
          <div className="grid gap-3">
            {pending.map((b) => {
              const stu = stuMap.get(b.student_id);
              const seat = seatMap.get(b.seat_id);
              const exp = b.hold_expires_at ? new Date(b.hold_expires_at) : null;
              const d = exp ? diffParts(exp) : null;
              const urgent = d ? d.ms < 30 * 60 * 1000 : false;
              void now;
              return (
                <div key={b.id} className="rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">{b.booking_code} · Seat {seat?.seat_number}</div>
                    <div className="text-sm text-muted-foreground">{stu?.name} · {stu?.phone}</div>
                    <div className="text-sm">Amount: <span className="font-semibold">₹{b.amount}</span></div>
                    {d && (
                      <div className={cn("text-sm font-medium mt-1 flex items-center gap-1", urgent ? "text-red-600" : "text-amber-600")}>
                        <Clock className="w-4 h-4" />
                        {d.ms <= 0 ? "Expired" : `Hold expires in ${d.h}h ${d.m}m ${d.s}s`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => markPaid(b)}>
                      <Check className="w-4 h-4" /> Mark Paid
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => release(b)}>
                      <X className="w-4 h-4" /> Release
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Expiring */}
      <Section
        title="🟡 Expiring Soon (within 3 days)"
        count={expiring.length}
        color="text-amber-700 border-amber-200 bg-amber-50"
        action={expiring.length > 0 ? (
          <Button size="sm" variant="outline" onClick={sendAllReminders}>
            <Send className="w-4 h-4" /> Send Reminder to All
          </Button>
        ) : null}
      >
        {expiring.length === 0 ? (
          <Empty msg="No bookings expiring soon" />
        ) : (
          <div className="grid gap-3">
            {expiring.map((b) => {
              const stu = stuMap.get(b.student_id);
              const seat = seatMap.get(b.seat_id);
              const daysLeft = Math.max(0, Math.ceil((new Date(b.end_date).getTime() - Date.now()) / 86400000));
              const pillColor = daysLeft <= 1 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
              return (
                <div key={b.id} className="rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{stu?.name} · Seat {seat?.seat_number}</div>
                    <div className="text-sm text-muted-foreground">Expires {b.end_date}</div>
                    <span className={cn("inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full", pillColor)}>
                      Expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => sendReminder(b)}>
                    <MessageCircle className="w-4 h-4" /> Send Reminder
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Grace */}
      <Section title="🔴 In Grace Period" count={grace.length} color="text-red-700 border-red-200 bg-red-50">
        {grace.length === 0 ? (
          <Empty msg="No bookings in grace period" />
        ) : (
          <div className="grid gap-3">
            {grace.map((b) => {
              const stu = stuMap.get(b.student_id);
              const seat = seatMap.get(b.seat_id);
              const endBase = new Date(b.end_date);
              const dayNum = Math.min(2, Math.max(1, Math.ceil((Date.now() - endBase.getTime()) / 86400000)));
              const urgent = dayNum >= 2;
              return (
                <div key={b.id} className={cn("rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3", urgent && "border-red-500 border-2")}>
                  <div className="flex-1">
                    <div className="font-semibold">{stu?.name} · Seat {seat?.seat_number}</div>
                    <div className="text-sm">Grace Day {dayNum} of 2</div>
                    <div className="w-full h-2 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className={cn("h-full", urgent ? "bg-red-500" : "bg-amber-500")} style={{ width: `${(dayNum / 2) * 100}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Grace ends: {b.grace_end_date ?? "—"}</div>
                  </div>
                  <div className="flex gap-2">
                    {stu && (
                      <a href={waLink(stu.phone)} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700">
                          <Phone className="w-4 h-4" /> WhatsApp
                        </Button>
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => extendGrace(b)}>
                      <Clock className="w-4 h-4" /> Extend 7 Days
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Released */}
      <Section title="ℹ️ Recently Released" count={released.length} color="text-gray-700 border-gray-200 bg-gray-50">
        {released.length === 0 ? (
          <Empty msg="No recent releases" />
        ) : (
          <ul className="divide-y border rounded-xl bg-card">
            {released.map((b) => {
              const stu = stuMap.get(b.student_id);
              const seat = seatMap.get(b.seat_id);
              const hrs = Math.max(1, Math.floor((Date.now() - new Date(b.created_at).getTime()) / 3600000));
              return (
                <li key={b.id} className="px-4 py-2 text-sm flex justify-between">
                  <span>Seat {seat?.seat_number} · {stu?.name}</span>
                  <span className="text-muted-foreground">Released {hrs}h ago</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, color, action, children }: { title: string; count: number; color: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex items-center justify-between rounded-lg border px-4 py-2", color)}>
        <h2 className="font-semibold flex items-center gap-2">
          {title}
          <span className="text-xs font-bold bg-white/70 px-2 py-0.5 rounded-full">{count}</span>
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">{msg}</div>;
}
