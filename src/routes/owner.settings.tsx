import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Trash2, Plus, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/owner/settings")({
  component: SettingsPage,
});


const KEYS = [
  "hall_name", "hall_phone", "hall_address",
  "ac_month_price", "ac_day_price", "nonac_month_price", "nonac_day_price",
  "qr_image_url", "upi_id",
  "counter_hold_hours", "grace_period_days", "expiry_reminder_days",
  "owner_phone",
  "dev_otp_mode",
] as const;
type Key = (typeof KEYS)[number];

// High-contrast input/textarea styles for dark theme
const FIELD =
  "w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none";

function SettingsPage() {
  const [form, setForm] = useState<Record<Key, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, ""])) as Record<Key, string>,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      return data as { key: string; value: string | null }[];
    },
  });

  useEffect(() => {
    if (!data) return;
    const map = Object.fromEntries(data.map((r) => [r.key, r.value ?? ""]));
    setForm((prev) => {
      const next = { ...prev };
      for (const k of KEYS) if (k in map) next[k] = map[k] ?? "";
      return next;
    });
  }, [data]);

  const set = (k: Key, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png"].includes(ext)) {
      toast.error("Only JPG or PNG files allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    setUploading(true);
    try {
      const path = `qr-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("settings").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("settings").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: saveErr } = await supabase.from("settings").upsert({ key: "qr_image_url", value: url }, { onConflict: "key" });
      if (saveErr) throw saveErr;
      set("qr_image_url", url);
      toast.success("✅ QR Code updated!");
    } catch (err) {
      toast.error("Failed to upload QR code");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = KEYS.map((k) => ({ key: k, value: form[k] }));
      const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("✅ All settings saved successfully!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-white">⚙️ Settings</h1>
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48 w-full bg-white/10" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-24 bg-[#0F172A] min-h-screen p-6 rounded-xl text-white">
      <h1 className="text-3xl font-bold text-white">⚙️ Settings</h1>

      <Section title="🏛️ Library Information">
        <Field label="Library Name">
          <input className={FIELD} value={form.hall_name} onChange={(e) => set("hall_name", e.target.value)} maxLength={100} />
        </Field>
        <Field label="Contact Phone">
          <input className={FIELD} value={form.hall_phone} onChange={(e) => set("hall_phone", e.target.value)} maxLength={20} />
        </Field>
        <Field label="Address">
          <textarea className={FIELD} value={form.hall_address} onChange={(e) => set("hall_address", e.target.value)} rows={3} maxLength={500} placeholder="Enter address" />
        </Field>
      </Section>

      <Section title="💰 Pricing (in ₹)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="AC Month Pass">
            <input className={FIELD} type="number" min={0} value={form.ac_month_price} onChange={(e) => set("ac_month_price", e.target.value)} />
          </Field>
          <Field label="AC Day Pass">
            <input className={FIELD} type="number" min={0} value={form.ac_day_price} onChange={(e) => set("ac_day_price", e.target.value)} />
          </Field>
          <Field label="Non-AC Month Pass">
            <input className={FIELD} type="number" min={0} value={form.nonac_month_price} onChange={(e) => set("nonac_month_price", e.target.value)} />
          </Field>
          <Field label="Non-AC Day Pass">
            <input className={FIELD} type="number" min={0} value={form.nonac_day_price} onChange={(e) => set("nonac_day_price", e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-300 mt-2">Prices apply to new bookings only</p>
      </Section>

      <Section title="📱 Payment QR Code">
        <div className="flex items-start gap-4 flex-wrap">
          {form.qr_image_url ? (
            <img src={form.qr_image_url} alt="QR" className="w-[120px] h-[120px] object-contain border border-white/20 rounded-md bg-white" />
          ) : (
            <div className="w-[120px] h-[120px] border border-white/20 rounded-md flex items-center justify-center text-xs text-slate-300 bg-white/5">No QR</div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload New QR Code"}
            </Button>
            <p className="text-xs text-slate-300">JPG or PNG, max 5MB</p>
          </div>
        </div>
        <Field label="UPI ID" className="mt-4">
          <input className={FIELD} value={form.upi_id} onChange={(e) => set("upi_id", e.target.value)} placeholder="e.g. kaaizens@upi" maxLength={100} />
        </Field>
      </Section>

      <Section title="⏰ Booking Rules">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Counter Hold (hours)">
            <input className={FIELD} type="number" min={0} value={form.counter_hold_hours} onChange={(e) => set("counter_hold_hours", e.target.value)} />
          </Field>
          <Field label="Grace Period (days)">
            <input className={FIELD} type="number" min={0} value={form.grace_period_days} onChange={(e) => set("grace_period_days", e.target.value)} />
          </Field>
          <Field label="Expiry Reminder (days before)">
            <input className={FIELD} type="number" min={0} value={form.expiry_reminder_days} onChange={(e) => set("expiry_reminder_days", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="🔑 Owner Account">
        <Field label="Owner WhatsApp Number">
          <input className={FIELD} value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} maxLength={20} />
        </Field>
        <div className="mt-3 rounded-md border border-sky-400/40 bg-sky-400/10 text-sky-100 px-3 py-2 text-sm">
          ⚠️ Owner login is now controlled by the <span className="font-semibold">authorized_owners</span> table. Add or remove numbers there to change who can log in as owner.
        </div>
      </Section>
      <Section title="🧪 Developer Options">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-white font-medium">Dev Mode — Sample OTP</div>
            <p className="text-xs text-slate-300 mt-1">
              When ON, no SMS is sent. The 6-digit OTP is displayed on the verification screen for both student & owner logins. Turn OFF in production.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.dev_otp_mode === "true"}
            onClick={() => set("dev_otp_mode", form.dev_otp_mode === "true" ? "false" : "true")}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${form.dev_otp_mode === "true" ? "bg-emerald-500" : "bg-white/20"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.dev_otp_mode === "true" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </Section>

      <CouponsSection />

      <Button
        size="lg"
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold h-12 rounded-xl"
      >
        💾 {saving ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}

type Coupon = {
  id: string;
  code: string;
  type: "fixed" | "percent";
  value: number;
  applies_to: "both" | "month" | "day";
};

function CouponsSection() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("");
  const [appliesTo, setAppliesTo] = useState<"both" | "month" | "day">("both");
  const [creating, setCreating] = useState(false);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("id,code,type,value,applies_to")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
  });

  const handleCreate = async () => {
    const trimmed = code.trim().toUpperCase();
    const num = Number(value);
    if (!trimmed) return toast.error("Enter a coupon code");
    if (!/^[A-Z0-9_-]+$/.test(trimmed)) return toast.error("Code: letters, numbers, _ or - only");
    if (!Number.isFinite(num) || num <= 0) return toast.error("Value must be greater than 0");
    if (type === "percent" && num > 100) return toast.error("Percentage cannot exceed 100");

    setCreating(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: trimmed,
        type,
        value: num,
        applies_to: appliesTo,
      });
      if (error) {
        if (error.code === "23505") toast.error("Coupon code already exists");
        else toast.error(error.message);
        return;
      }
      toast.success(`🎟️ Coupon ${trimmed} created`);
      setCode("");
      setValue("");
      setType("fixed");
      setAppliesTo("both");
      qc.invalidateQueries({ queryKey: ["coupons"] });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, codeLabel: string) => {
    if (!confirm(`Delete coupon ${codeLabel}? This cannot be undone.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${codeLabel}`);
    qc.invalidateQueries({ queryKey: ["coupons"] });
  };

  const appliesLabel = (a: Coupon["applies_to"]) =>
    a === "both" ? "All passes" : a === "month" ? "Month Pass only" : "Day Pass only";

  return (
    <Section title="🎟️ Coupons">
      {/* Active coupons */}
      <div className="space-y-3 mb-6">
        <div className="text-sm text-slate-300">Active coupons</div>
        {isLoading ? (
          <Skeleton className="h-20 w-full bg-white/10" />
        ) : coupons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
            No coupons yet. Create your first one below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/15 bg-white/5 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-base font-bold tracking-wider text-white">
                      {c.code}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm text-emerald-300">
                    {c.type === "fixed"
                      ? `₹${Number(c.value).toLocaleString("en-IN")} off`
                      : `${c.value}% off`}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{appliesLabel(c.applies_to)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Unlimited uses</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.code)}
                  aria-label={`Delete coupon ${c.code}`}
                  className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new */}
      <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
        <div className="text-sm font-medium text-white mb-3">Create new coupon</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Code">
            <input
              className={FIELD + " uppercase tracking-wider font-mono"}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SAVE200"
              maxLength={32}
            />
          </Field>
          <Field label="Type">
            <select
              className={FIELD}
              value={type}
              onChange={(e) => setType(e.target.value as "fixed" | "percent")}
            >
              <option value="fixed">Fixed Amount (₹)</option>
              <option value="percent">Percentage (%)</option>
            </select>
          </Field>
          <Field label={type === "fixed" ? "Value (₹)" : "Value (%)"}>
            <input
              className={FIELD}
              type="number"
              min={1}
              max={type === "percent" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "fixed" ? "200" : "10"}
            />
          </Field>
          <Field label="Applies to">
            <select
              className={FIELD}
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as "both" | "month" | "day")}
            >
              <option value="both">All passes (Month + Day)</option>
              <option value="month">Month Pass only</option>
              <option value="day">Day Pass only</option>
            </select>
          </Field>
        </div>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create Coupon"}
        </Button>
      </div>
    </Section>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-sm">
      <h2 className="font-semibold text-lg mb-4 text-[#4FC3F7]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ?? "mb-3"}>
      <label className="text-sm mb-1 block text-white font-medium">{label}</label>
      {children}
    </div>
  );
}
