import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/owner/dashboard")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Occupancy and revenue at a glance.</p>
    </div>
  ),
});
