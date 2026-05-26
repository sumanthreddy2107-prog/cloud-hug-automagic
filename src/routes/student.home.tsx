import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/student/home")({
  component: () => (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-muted-foreground">Ready to book your study seat?</p>
      <Link to="/student/book" className="inline-flex w-fit items-center rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
        Book a seat
      </Link>
    </div>
  ),
});
