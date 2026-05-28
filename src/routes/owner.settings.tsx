import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
] as const;
type Key = (typeof KEYS)[number];

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
        <h1 className="text-3xl font-bold">⚙️ Settings</h1>
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl pb-24">
      <h1 className="text-3xl font-bold">⚙️ Settings</h1>

      <Section title="🏛️ Library Information">
        <Field label="Library Name">
          <Input value={form.hall_name} onChange={(e) => set("hall_name", e.target.value)} maxLength={100} />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.hall_phone} onChange={(e) => set("hall_phone", e.target.value)} maxLength={20} />
        </Field>
        <Field label="Address">
          <Textarea value={form.hall_address} onChange={(e) => set("hall_address", e.target.value)} rows={3} maxLength={500} placeholder="Enter address" />
        </Field>
      </Section>

      <Section title="💰 Pricing (in ₹)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="AC Month Pass">
            <Input type="number" min={0} value={form.ac_month_price} onChange={(e) => set("ac_month_price", e.target.value)} />
          </Field>
          <Field label="AC Day Pass">
            <Input type="number" min={0} value={form.ac_day_price} onChange={(e) => set("ac_day_price", e.target.value)} />
          </Field>
          <Field label="Non-AC Month Pass">
            <Input type="number" min={0} value={form.nonac_month_price} onChange={(e) => set("nonac_month_price", e.target.value)} />
          </Field>
          <Field label="Non-AC Day Pass">
            <Input type="number" min={0} value={form.nonac_day_price} onChange={(e) => set("nonac_day_price", e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Prices apply to new bookings only</p>
      </Section>

      <Section title="📱 Payment QR Code">
        <div className="flex items-start gap-4 flex-wrap">
          {form.qr_image_url ? (
            <img src={form.qr_image_url} alt="QR" className="w-[120px] h-[120px] object-contain border rounded-md bg-white" />
          ) : (
            <div className="w-[120px] h-[120px] border rounded-md flex items-center justify-center text-xs text-muted-foreground bg-muted">No QR</div>
          )}
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={handleUpload} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload New QR Code"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB</p>
          </div>
        </div>
        <Field label="UPI ID" className="mt-4">
          <Input value={form.upi_id} onChange={(e) => set("upi_id", e.target.value)} placeholder="e.g. kaaizens@upi" maxLength={100} />
        </Field>
      </Section>

      <Section title="⏰ Booking Rules">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Counter Hold (hours)">
            <Input type="number" min={0} value={form.counter_hold_hours} onChange={(e) => set("counter_hold_hours", e.target.value)} />
          </Field>
          <Field label="Grace Period (days)">
            <Input type="number" min={0} value={form.grace_period_days} onChange={(e) => set("grace_period_days", e.target.value)} />
          </Field>
          <Field label="Expiry Reminder (days before)">
            <Input type="number" min={0} value={form.expiry_reminder_days} onChange={(e) => set("expiry_reminder_days", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="🔑 Owner Account">
        <Field label="Owner WhatsApp Number">
          <Input value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} maxLength={20} />
        </Field>
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          ⚠️ This number is used for owner login. Changing it means you must use the new number to log in next time.
        </div>
      </Section>

      <Button
        size="lg"
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold h-12 rounded-xl"
      >
        💾 {saving ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-lg mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ?? "mb-3"}>
      <Label className="text-sm mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
