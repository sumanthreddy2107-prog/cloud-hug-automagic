import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/owner/settings")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Edit prices, phone, QR & UPI here.</p>
    </div>
  ),
});
