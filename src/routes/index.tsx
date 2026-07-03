import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Event Manager" },
      { name: "description", content: "Plan, track and run events end-to-end." },
    ],
  }),
  component: () => <Navigate to="/dashboard" replace />,
});