import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/student/book")({
  component: () => <Placeholder title="Choose seat type & pass" />,
});
function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Coming next.</p>
    </div>
  );
}
