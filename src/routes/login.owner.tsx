import { createFileRoute } from "@tanstack/react-router";
import { PhoneEntry } from "@/components/PhoneEntry";

export const Route = createFileRoute("/login/owner")({
      component: () => <PhoneEntry role="owner" />,
});
