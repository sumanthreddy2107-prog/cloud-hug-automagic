import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/owner/bookings")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">All bookings</h1>
      <p className="text-muted-foreground">Coming next.</p>
    </div>
  ),
});
