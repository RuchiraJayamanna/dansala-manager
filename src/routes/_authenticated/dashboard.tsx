import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, Users, ListChecks, HandCoins, TrendingDown, TrendingUp } from "lucide-react";
import { lkr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Dansala Manager" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dash"],
    queryFn: async () => {
      const [b, m, c, contrib] = await Promise.all([
        supabase.from("budget_items").select("planned_amount, actual_amount"),
        supabase.from("team_members").select("id, phase"),
        supabase.from("checklist_items").select("status"),
        supabase.from("contributions").select("amount, status"),
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

  return (
    <div className="p-8 space-y-8 max-w-7xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dansala 2026 — Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time snapshot of budget, teams, checklist and contributions.</p>
      </header>

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