import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MISL Dansala Manager" },
      { name: "description", content: "Plan, track and run the MISL Dansala event end-to-end." },
    ],
  }),
  component: Index,
});

function Index() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setTarget(data.user ? "/dashboard" : "/auth");
    });
  }, []);
  if (!target) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  return <Navigate to={target} replace />;
}
