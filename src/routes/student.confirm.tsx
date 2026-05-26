import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/student/confirm")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Confirm booking</h1>
      <p className="text-muted-foreground">Coming next.</p>
    </div>
  ),
});
