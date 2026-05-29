import { createFileRoute } from "@tanstack/react-router";
import { EmailEntry } from "@/components/EmailEntry";

export const Route = createFileRoute("/login/student")({
      component: () => <EmailEntry />,
});
