import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/student/confirmed")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Booking confirmed</h1>
      <p className="text-muted-foreground">Invoice will appear here.</p>
    </div>
  ),
});
