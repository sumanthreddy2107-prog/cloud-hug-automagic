import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kaaizens Library — Book your study hall seat" },
      { name: "description", content: "Reserve AC and Non-AC study cabins at Kaaizens Library. Day and month passes available." },
      { property: "og:title", content: "Kaaizens Library" },
      { property: "og:description", content: "Book your study hall seat in seconds." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-tight">Kaaizens Library</span>
          <span className="text-sm text-muted-foreground">Study Hall · Hyderabad</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-20">
        <section className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
            Your seat in our study hall,{" "}
            <span className="text-primary">booked in seconds.</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            110 AC cabins and 100 Non-AC cabins. Pick your spot, pay by UPI or at the counter,
            and start studying.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login/student"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              I'm a Student — Book a seat
            </Link>
            <Link
              to="/login/owner"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary"
            >
              Owner login
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm uppercase tracking-wide text-primary">AC Cabin</div>
            <div className="mt-2 text-3xl font-bold">₹2,000<span className="text-base font-normal text-muted-foreground">/month</span></div>
            <div className="text-sm text-muted-foreground">or ₹150 / day · 110 cabins</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm uppercase tracking-wide text-primary">Non-AC Cabin</div>
            <div className="mt-2 text-3xl font-bold">₹1,500<span className="text-base font-normal text-muted-foreground">/month</span></div>
            <div className="text-sm text-muted-foreground">or ₹100 / day · 100 cabins</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted-foreground">
          Need help? WhatsApp +91 9515503335
        </div>
      </footer>
    </div>
  );
}
