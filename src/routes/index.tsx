import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dansala Management System" },
      { name: "description", content: "Plan, track and run Dansala events end-to-end." },
    ],
  }),
  component: () => <Navigate to="/dashboard" replace />,
});