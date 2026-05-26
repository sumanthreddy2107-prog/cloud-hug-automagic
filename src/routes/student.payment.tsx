import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/student/payment")({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Payment</h1>
      <p className="text-muted-foreground">Coming next.</p>
    </div>
  ),
});
