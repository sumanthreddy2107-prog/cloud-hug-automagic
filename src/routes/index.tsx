import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kaaizens Library" },
      { name: "description", content: "Your quiet space to grow — book your study hall seat at Kaaizens Library." },
      { property: "og:title", content: "Kaaizens Library" },
      { property: "og:description", content: "Your quiet space to grow." },
      { property: "og:url", content: "/" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-between px-6 py-10"
      style={{ backgroundColor: "#0F172A" }}
    >
      <div aria-hidden className="h-2" />

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="text-[5rem] leading-none" aria-hidden>
          📚
        </div>

        <h1 className="mt-4 text-[3rem] font-bold leading-tight text-white">
          Kaaizens Library
        </h1>

        <p className="mt-2 italic" style={{ color: "#10B981" }}>
          Your quiet space to grow
        </p>

        <div
          className="my-6 h-px w-24"
          style={{ backgroundColor: "#10B981" }}
          aria-hidden
        />

        <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/login/student"
            className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-bold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: "#10B981" }}
          >
            🎓 Student Login
          </Link>

          <Link
            to="/login/owner"
            className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-transparent px-8 py-4 text-base font-bold text-white transition hover:bg-white hover:text-[#0F172A]"
          >
            🔑 Owner Login
          </Link>
        </div>
      </main>

      <footer className="pt-8 text-xs text-gray-500">
        Kaaizens Library © 2026
      </footer>
    </div>
  );
}
