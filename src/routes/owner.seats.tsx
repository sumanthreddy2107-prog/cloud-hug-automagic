import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/seats")({
  component: OwnerSeatsPage,
});

type SeatStatus = "vacant" | "occupied" | "blocked" | "grace" | "hold";

interface Seat {
  id: string;
  seat_number: string;
  seat_type: string;
  status: SeatStatus;
  block_reason: string | null;
  updated_at: string;
}

interface BookingRow {
  id: string;
  booking_code: string;
  student_id: string;
  seat_id: string;
  pass_type: string;
  start_date: string;
  end_date: string;
  grace_end_date: string | null;
  amount: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
}

interface StudentRow {
  id: string;
  name: string;
  phone: string;
}

type Filter = "all" | "ac" | "nonac" | "vacant" | "occupied" | "blocked";

async function fetchAllSeats(): Promise<Seat[]> {
  const { data, error } = await supabase
    .from("seats")
    .select("id,seat_number,seat_type,status,block_reason,updated_at")
    .order("seat_number");
  if (error) throw error;
  return (data ?? []) as Seat[];
}

async function fetchSeatDetails(seatId: string): Promise<{ booking: BookingRow | null; student: StudentRow | null }> {
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("seat_id", seatId)
    .in("status", ["active", "grace", "pending_payment"])
    .order("created_at", { ascending: false })
    .limit(1);
  const booking = (bookings?.[0] ?? null) as BookingRow | null;
  if (!booking) return { booking: null, student: null };
  const { data: student } = await supabase
    .from("students")
    .select("id,name,phone")
    .eq("id", booking.student_id)
    .maybeSingle();
  return { booking, student: (student ?? null) as StudentRow | null };
}

function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function OwnerSeatsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [openAc, setOpenAc] = useState(true);
  const [openNon, setOpenNon] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [blockOpenFor, setBlockOpenFor] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data: seats = [], isLoading, refetch } = useQuery({
    queryKey: ["owner", "seats"],
    queryFn: fetchAllSeats,
  });

  useEffect(() => {
    setLastUpdated(new Date());
  }, [seats]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel("owner-seats")
      .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const passesFilter = (s: Seat): boolean => {
    switch (filter) {
      case "all": return true;
      case "ac": return s.seat_type === "ac";
      case "nonac": return s.seat_type === "nonac";
      case "vacant": return s.status === "vacant";
      case "occupied": return s.status === "occupied" || s.status === "grace";
      case "blocked": return s.status === "blocked";
    }
  };

  const acSeats = useMemo(() => seats.filter((s) => s.seat_type === "ac" && passesFilter(s)), [seats, filter]);
  const nonSeats = useMemo(() => seats.filter((s) => s.seat_type === "nonac" && passesFilter(s)), [seats, filter]);
  const acTotal = useMemo(() => seats.filter((s) => s.seat_type === "ac").length, [seats]);
  const nonTotal = useMemo(() => seats.filter((s) => s.seat_type === "nonac").length, [seats]);

  const selectedSeat = seats.find((s) => s.id === selectedId) ?? null;

  const { data: details } = useQuery({
    queryKey: ["owner", "seat-details", selectedId],
    queryFn: () => fetchSeatDetails(selectedId!),
    enabled: !!selectedSeat && (selectedSeat.status === "occupied" || selectedSeat.status === "grace" || selectedSeat.status === "hold"),
  });

  const sinceText = useMemo(() => {
    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  }, [lastUpdated]);

  const handleBlock = async () => {
    if (!blockOpenFor) return;
    const reason = blockReason.trim();
    if (!reason) {
      toast.error("Please provide a reason");
      return;
    }
    const { error } = await supabase
      .from("seats")
      .update({ status: "blocked", block_reason: reason })
      .eq("id", blockOpenFor);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Seat blocked");
    setBlockOpenFor(null);
    setBlockReason("");
    refetch();
  };

  const handleUnblock = async (seatId: string) => {
    const { error } = await supabase
      .from("seats")
      .update({ status: "vacant", block_reason: null })
      .eq("id", seatId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Seat unblocked");
    refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0b1e3f]">🗺️ Live Seat Map</h1>
        <p className="text-xs text-slate-500">Last updated: {sinceText}</p>
      </div>

      {/* Filter chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["all", "ac", "nonac", "vacant", "occupied", "blocked"] as Filter[]).map((f) => {
          const labels: Record<Filter, string> = {
            all: "All", ac: "AC Only", nonac: "Non-AC Only",
            vacant: "Vacant", occupied: "Occupied", blocked: "Blocked",
          };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <LegendDot color="bg-emerald-500" label="Vacant" />
        <LegendDot color="bg-red-500" label="Occupied" />
        <LegendDot color="bg-amber-400" label="Grace" />
        <LegendDot color="bg-slate-500" label="Blocked" />
        <LegendDot color="bg-blue-500" label="Hold" />
      </div>

      {/* AC section */}
      <Section
        title={`❄️ AC Cabins (${acTotal} seats)`}
        open={openAc}
        onToggle={() => setOpenAc((v) => !v)}
      >
        <SeatGrid seats={acSeats} loading={isLoading} onSelect={(id) => setSelectedId(id)} />
      </Section>

      {/* Non-AC section */}
      <Section
        title={`🪑 Non-AC Cabins (${nonTotal} seats)`}
        open={openNon}
        onToggle={() => setOpenNon((v) => !v)}
      >
        <SeatGrid seats={nonSeats} loading={isLoading} onSelect={(id) => setSelectedId(id)} />
      </Section>

      {/* Drawer */}
      {selectedSeat && (
        <Drawer onClose={() => setSelectedId(null)}>
          <SeatDrawerBody
            seat={selectedSeat}
            booking={details?.booking ?? null}
            student={details?.student ?? null}
            onBlockClick={() => setBlockOpenFor(selectedSeat.id)}
            onUnblock={() => handleUnblock(selectedSeat.id)}
          />
        </Drawer>
      )}

      {/* Block modal */}
      {blockOpenFor && (
        <Modal onClose={() => { setBlockOpenFor(null); setBlockReason(""); }}>
          <h3 className="text-lg font-bold text-slate-900">Block seat</h3>
          <p className="mt-1 text-sm text-slate-500">This seat will not be bookable until unblocked.</p>
          <input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason (e.g. Under maintenance)"
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            autoFocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setBlockOpenFor(null); setBlockReason(""); }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Block Seat
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-slate-100 p-3">{children}</div>}
    </div>
  );
}

function SeatGrid({ seats, loading, onSelect }: { seats: Seat[]; loading: boolean; onSelect: (id: string) => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-[60px] animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    );
  }
  if (seats.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400">No seats match this filter.</p>;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
      {seats.map((seat) => (
        <button
          key={seat.id}
          type="button"
          onClick={() => onSelect(seat.id)}
          className="flex flex-col items-center gap-1"
        >
          <span className={`flex h-11 w-11 items-center justify-center rounded-lg text-[10px] font-bold text-white transition hover:scale-110 ${seatColor(seat.status)}`}>
            {seat.seat_number.split("-").pop()}
          </span>
          <span className="text-[10px] text-slate-500">{seat.seat_number}</span>
        </button>
      ))}
    </div>
  );
}

function seatColor(status: SeatStatus): string {
  switch (status) {
    case "vacant": return "bg-emerald-500";
    case "occupied": return "bg-red-500";
    case "blocked": return "bg-slate-500";
    case "grace": return "bg-amber-400 text-slate-900";
    case "hold": return "bg-blue-500";
    default: return "bg-slate-300";
  }
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Seat Details</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">{children}</div>
    </div>
  );
}

function SeatDrawerBody({
  seat, booking, student, onBlockClick, onUnblock,
}: {
  seat: Seat;
  booking: BookingRow | null;
  student: StudentRow | null;
  onBlockClick: () => void;
  onUnblock: () => void;
}) {
  const statusLabel: Record<SeatStatus, string> = {
    vacant: "🟢 Vacant",
    occupied: "🔴 Occupied",
    blocked: "⬛ Blocked",
    grace: "🟡 Grace",
    hold: "🔵 Hold",
  };

  const whatsappUrl = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean.startsWith("91") ? clean : `91${clean}`}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400">Seat</div>
        <div className="text-2xl font-bold text-slate-900">{seat.seat_number}</div>
        <div className="mt-1 text-sm">{statusLabel[seat.status]}</div>
      </div>

      {seat.status === "vacant" && (
        <button
          onClick={onBlockClick}
          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
        >
          🔧 Block This Seat
        </button>
      )}

      {seat.status === "blocked" && (
        <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Reason</div>
            <div className="font-medium text-slate-800">{seat.block_reason || "—"}</div>
          </div>
          <button
            onClick={onUnblock}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            ✅ Unblock This Seat
          </button>
        </>
      )}

      {(seat.status === "occupied" || seat.status === "grace" || seat.status === "hold") && (
        <div className="flex flex-col gap-3">
          {booking && student ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
              <Row label="Student" value={student.name} />
              <Row
                label="Phone"
                value={
                  <a
                    href={whatsappUrl(student.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    {student.phone}
                  </a>
                }
              />
              <Row label="Pass" value={booking.pass_type === "month" ? "Month Pass" : "Day Pass"} />
              <Row label="Expires" value={fmt(booking.end_date)} />
              <Row label="Booking" value={`#${booking.booking_code}`} />
              <Row label="Amount" value={`₹${Number(booking.amount).toLocaleString("en-IN")}`} />
              <Row
                label="Payment"
                value={
                  booking.payment_method === "upi"
                    ? "UPI ✅"
                    : booking.payment_method === "counter"
                      ? "Counter"
                      : booking.payment_status
                }
              />
              {seat.status === "grace" && booking.grace_end_date && (
                <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  ⚠️ Grace period ends {fmt(booking.grace_end_date)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading booking…</p>
          )}

          {seat.status === "grace" ? (
            <div className="grid grid-cols-2 gap-2">
              {student && (
                <a
                  href={whatsappUrl(student.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  📞 WhatsApp Student
                </a>
              )}
              <button className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600">
                ⏰ Extend
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                ✏️ Edit Booking
              </button>
              <button className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">
                ❌ Cancel Booking
              </button>
              <button
                onClick={onBlockClick}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                🔧 Block After Expiry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}
