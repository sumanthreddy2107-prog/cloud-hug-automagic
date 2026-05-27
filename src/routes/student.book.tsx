import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student/book")({
  component: BookPage,
});

type SeatType = "ac" | "nonac";
type PassType = "day" | "month";

const DEFAULT_PRICES: Record<string, number> = {
  ac_month_price: 2000,
  ac_day_price: 150,
  nonac_month_price: 1500,
  nonac_day_price: 100,
};

async function fetchPrices() {
  const keys = Object.keys(DEFAULT_PRICES);
  const { data } = await supabase.from("settings").select("key,value").in("key", keys);
  const map: Record<string, number> = { ...DEFAULT_PRICES };
  data?.forEach((row) => {
    const n = Number(row.value);
    if (!Number.isNaN(n)) map[row.key] = n;
  });
  return map;
}

function BookPage() {
  const navigate = useNavigate();
  const [seatType, setSeatType] = useState<SeatType | null>(null);
  const [passType, setPassType] = useState<PassType | null>(null);

  const { data: prices } = useQuery({
    queryKey: ["settings", "prices"],
    queryFn: fetchPrices,
    initialData: DEFAULT_PRICES,
  });

  // reset pass selection when cabin changes
  useEffect(() => {
    setPassType(null);
  }, [seatType]);

  const priceFor = (s: SeatType, p: PassType) =>
    prices[`${s === "ac" ? "ac" : "nonac"}_${p}_price`];

  const canContinue = seatType && passType;

  const handleContinue = () => {
    if (!seatType || !passType) return;
    sessionStorage.setItem(
      "kaaizens.booking",
      JSON.stringify({ seatType, passType, amount: priceFor(seatType, passType) }),
    );
    navigate({ to: "/student/seats" });
  };

  return (
    <div className="flex flex-col gap-8 pb-32">
      {/* Header / progress */}
      <div className="flex items-center gap-3">
        <Link
          to="/student/home"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-foreground">Step 1 of 3</span>
            <span>· Cabin & Pass</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 rounded-full bg-emerald-500 transition-all" />
          </div>
        </div>
      </div>

      {/* Step 1 */}
      <section>
        <h1 className="mb-1 text-2xl font-bold">Choose your cabin type</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Pick the cabin that suits you best.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CabinCard
            icon="❄️"
            title="AC Cabin"
            subtitle="Cool and comfortable"
            total="110 cabins total"
            monthPrice={prices.ac_month_price}
            dayPrice={prices.ac_day_price}
            selected={seatType === "ac"}
            onSelect={() => setSeatType("ac")}
          />
          <CabinCard
            icon="🪑"
            title="Non-AC Cabin"
            subtitle="Simple and affordable"
            total="100 cabins total"
            monthPrice={prices.nonac_month_price}
            dayPrice={prices.nonac_day_price}
            selected={seatType === "nonac"}
            onSelect={() => setSeatType("nonac")}
          />
        </div>
      </section>

      {/* Step 2 */}
      {seatType && (
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="mb-1 text-2xl font-bold">Choose your pass</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            {seatType === "ac" ? "AC Cabin" : "Non-AC Cabin"} selected
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PassCard
              icon="📅"
              title="Day Pass"
              desc="Valid for 24 hours"
              price={priceFor(seatType, "day")}
              selected={passType === "day"}
              onSelect={() => setPassType("day")}
            />
            <PassCard
              icon="🗓️"
              title="Month Pass"
              desc="Valid for 30 days"
              price={priceFor(seatType, "month")}
              selected={passType === "month"}
              onSelect={() => setPassType("month")}
            />
          </div>
        </section>
      )}

      {/* Bottom button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Seat Map →
          </button>
        </div>
      </div>
    </div>
  );
}

function CabinCard({
  icon,
  title,
  subtitle,
  total,
  monthPrice,
  dayPrice,
  selected,
  onSelect,
}: {
  icon: string;
  title: string;
  subtitle: string;
  total: string;
  monthPrice: number;
  dayPrice: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-start gap-3 rounded-2xl border-2 bg-white p-6 text-left text-slate-900 shadow-sm transition hover:shadow-md ${
        selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"
      }`}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-4 w-4" />
        </span>
      )}
      <span className="text-4xl">{icon}</span>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <p className="text-xs font-medium text-slate-400">{total}</p>
      <div className="mt-2 w-full space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Month Pass</span>
          <span className="font-semibold">₹{monthPrice.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Day Pass</span>
          <span className="font-semibold">₹{dayPrice.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </button>
  );
}

function PassCard({
  icon,
  title,
  desc,
  price,
  selected,
  onSelect,
}: {
  icon: string;
  title: string;
  desc: string;
  price: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex items-center gap-4 rounded-2xl border-2 bg-white p-5 text-left text-slate-900 shadow-sm transition hover:shadow-md ${
        selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"
      }`}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="text-3xl">{icon}</span>
      <div className="flex-1">
        <h3 className="font-bold">{title}</h3>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <span className="text-lg font-bold text-emerald-600">
        ₹{price.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
