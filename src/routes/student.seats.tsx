import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/student/seats")({
  component: SeatsPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";
type SeatStatus = "vacant" | "occupied" | "blocked" | "grace";

interface Seat {
  id: string;
  seat_number: string;
  seat_type: string;
  status: SeatStatus;
}

interface BookingDraft {
  seatType: SeatType;
  passType: PassType;
  amount: number;
}

function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem("kaaizens.booking");
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

async function fetchSeats(seatType: SeatType): Promise<Seat[]> {
  const { data, error } = await supabase
    .from("seats")
    .select("id,seat_number,seat_type,status")
    .eq("seat_type", seatType)
    .order("seat_number");
  if (error) throw error;
  return (data ?? []) as Seat[];
}

function SeatsPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d) {
      navigate({ to: "/student/book" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  const seatType = draft?.seatType;

  const { data: seats, isLoading, refetch } = useQuery({
    queryKey: ["seats", seatType],
    queryFn: () => fetchSeats(seatType!),
    enabled: !!seatType,
  });

  // realtime
  useEffect(() => {
    if (!seatType) return;
    const channel = supabase
      .channel(`seats-${seatType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seats" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [seatType, refetch]);

  const vacantCount = useMemo(
    () => seats?.filter((s) => s.status === "vacant").length ?? 0,
    [seats],
  );

  const selectedSeat = seats?.find((s) => s.id === selectedId) ?? null;

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === "vacant") {
      setSelectedId(seat.id);
    } else {
      toast("Seat not available");
    }
  };

  const handleConfirm = () => {
    if (!selectedSeat || !draft) return;
    sessionStorage.setItem(
      "kaaizens.booking",
      JSON.stringify({
        ...draft,
        seatId: selectedSeat.id,
        seatNumber: selectedSeat.seat_number,
      }),
    );
    navigate({ to: "/student/confirm" });
  };

  if (!draft) return null;

  const cabinLabel = draft.seatType === "ac" ? "❄️ AC Cabins" : "🪑 Non-AC Cabins";
  const passLabel = draft.passType === "month" ? "Month Pass" : "Day Pass";
  const cabinShort = draft.seatType === "ac" ? "AC Cabin" : "Non-AC Cabin";

  return (
    <div className="flex flex-col gap-6 pb-40">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/student/book"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-foreground">Step 2 of 3</span>
            <span>· {cabinLabel}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 rounded-full bg-emerald-500 transition-all" />
          </div>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Choose Your Seat</h1>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-3 text-xs">
        <LegendDot color="bg-emerald-500" label="Vacant" />
        <LegendDot color="bg-red-500" label="Occupied" />
        <LegendDot color="bg-slate-500" label="Blocked" />
        <LegendDot color="bg-amber-400" label="Grace" />
        <LegendDot color="bg-blue-500" label="Selected" />
      </div>

      {/* Count */}
      <p className="text-sm font-semibold text-emerald-600">
        {isLoading ? "Loading seats..." : `${vacantCount} seats available`}
      </p>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {seats?.map((seat) => {
            const isSelected = seat.id === selectedId;
            const cls = seatClasses(seat.status, isSelected);
            const clickable = seat.status === "vacant";
            return (
              <button
                key={seat.id}
                type="button"
                onClick={() => handleSeatClick(seat)}
                disabled={!clickable && !isSelected}
                title={
                  seat.status === "vacant"
                    ? "Available"
                    : seat.status === "occupied"
                      ? "Occupied"
                      : seat.status === "blocked"
                        ? "Blocked"
                        : "In grace period"
                }
                className={`flex aspect-square min-h-[44px] items-center justify-center rounded-lg text-[10px] font-semibold transition-transform ${cls}`}
              >
                {seat.seat_number}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected bar */}
      {selectedSeat && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white px-6 py-4 shadow-lg animate-in slide-in-from-bottom duration-300">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-700">
              <span className="font-semibold text-emerald-600">
                ✓ {selectedSeat.seat_number} selected
              </span>
              <span className="text-slate-400"> | </span>
              <span>{cabinShort}</span>
              <span className="text-slate-400"> | </span>
              <span>{passLabel}</span>
              <span className="text-slate-400"> | </span>
              <span className="font-semibold">
                ₹{draft.amount.toLocaleString("en-IN")}
              </span>
            </div>
            <button
              onClick={handleConfirm}
              className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow hover:bg-emerald-600"
            >
              Confirm This Seat →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function seatClasses(status: SeatStatus, selected: boolean): string {
  if (selected) {
    return "bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-2 ring-offset-background cursor-pointer scale-105";
  }
  switch (status) {
    case "vacant":
      return "bg-emerald-500 text-white cursor-pointer hover:scale-110";
    case "occupied":
      return "bg-red-500 text-white cursor-not-allowed opacity-90";
    case "blocked":
      return "bg-slate-500 text-white cursor-not-allowed opacity-80";
    case "grace":
      return "bg-amber-400 text-slate-900 cursor-not-allowed";
    default:
      return "bg-muted";
  }
}
