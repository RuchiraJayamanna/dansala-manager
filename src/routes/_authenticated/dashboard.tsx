import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, Users, ListChecks, HandCoins, TrendingDown, TrendingUp, CalendarRange } from "lucide-react";
import { lkr } from "@/lib/format";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Dansala Management System" }] }),
  component: Dashboard,
});

function Dashboard() {
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();

  const { data } = useQuery({
    queryKey: ["dash", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [b, m, c, contrib] = await Promise.all([
        supabase.from("budget_items").select("planned_amount, actual_amount").eq("event_id", eventId!),
        supabase.from("team_members").select("id, phase").eq("event_id", eventId!),
        supabase.from("checklist_items").select("status").eq("event_id", eventId!),
        supabase.from("contributions").select("amount, status").eq("event_id", eventId!),
      ]);
      const budget = b.data ?? [];
      const planned = budget.reduce((s, r: any) => s + Number(r.planned_amount || 0), 0);
      const actual = budget.reduce((s, r: any) => s + Number(r.actual_amount || 0), 0);
      const members = m.data ?? [];
      const checklist = c.data ?? [];
      const done = checklist.filter((x: any) => x.status === "Done").length;
      const contribs = contrib.data ?? [];
      const paid = ["Paid", "Completed"];
      const collected = contribs.filter((x: any) => paid.includes(x.status)).reduce((s, r: any) => s + Number(r.amount), 0);
      const pending = contribs.filter((x: any) => !paid.includes(x.status)).reduce((s, r: any) => s + Number(r.amount), 0);
      return { planned, actual, members, checklist: { total: checklist.length, done }, collected, pending };
    },
  });

  const variance = (data?.planned ?? 0) - (data?.actual ?? 0);
  const overspend = variance < 0;

  const { data: banners = [] } = useQuery({
    queryKey: ["dash_banners", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("event_documents" as any).select("*").eq("event_id", eventId!).eq("category", "Banner Design").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const latest = banners[0];
      if (!latest) { setBannerUrl(null); return; }
      const { data } = await supabase.storage.from("event-documents").createSignedUrl(latest.file_path, 60 * 60);
      setBannerUrl(data?.signedUrl ?? null);
    })();
  }, [banners]);

  if (!event) return <NoEvent />;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" />{event.dansala_type ?? "Dansala"} · {event.location ?? "—"} · {event.event_date ?? `${event.year}`}</div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">{event.name}</h1>
        <p className="text-muted-foreground mt-1">Real-time snapshot of budget, teams, checklist and contributions.</p>
      </header>

      {bannerUrl && (
        <Card className="overflow-hidden">
          <div className="text-xs uppercase tracking-wide text-muted-foreground px-4 pt-3">Event banner</div>
          <div className="p-4">
            <img src={bannerUrl} alt="Event banner" className="w-full max-h-96 object-contain rounded-lg bg-muted" />
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Planned Budget" value={lkr(data?.planned ?? 0)} hint="Across all line items" />
        <StatCard icon={overspend ? TrendingDown : TrendingUp} label="Actual Spend" value={lkr(data?.actual ?? 0)}
          hint={overspend ? `Over by ${lkr(Math.abs(variance))}` : `Under by ${lkr(variance)}`}
          tone={overspend ? "danger" : "success"} />
        <StatCard icon={HandCoins} label="Collected" value={lkr(data?.collected ?? 0)} hint={`${lkr(data?.pending ?? 0)} pending`} />
        <StatCard icon={Users} label="Team Members" value={String(data?.members.length ?? 0)} hint="Across both phases" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Checklist progress</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{data?.checklist.done ?? 0} of {data?.checklist.total ?? 0} done</span>
              <span className="text-muted-foreground">{data?.checklist.total ? Math.round((data.checklist.done / data.checklist.total) * 100) : 0}%</span>
            </div>
            <Progress value={data?.checklist.total ? (data.checklist.done / data.checklist.total) * 100 : 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Budget utilization</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{lkr(data?.actual ?? 0)} of {lkr(data?.planned ?? 0)}</span>
              <span className={overspend ? "text-destructive" : "text-muted-foreground"}>
                {data?.planned ? Math.round(((data.actual ?? 0) / data.planned) * 100) : 0}%
              </span>
            </div>
            <Progress value={data?.planned ? Math.min(100, ((data.actual ?? 0) / data.planned) * 100) : 0} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NoEvent() {
  return <div className="p-12"><Card><CardContent className="p-12 text-center text-muted-foreground">
    No event selected. Go to <span className="font-medium">Events / Projects</span> to create one.
  </CardContent></Card></div>;
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string; hint?: string; tone?: "success" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className={`mt-1 text-xs ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>{hint}</div>}
      </CardContent>
    </Card>
  );
}