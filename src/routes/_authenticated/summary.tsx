import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { lkr } from "@/lib/format";
import { exportXlsx, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({ meta: [{ title: "Summary — Dansala Manager" }] }),
  component: SummaryPage,
});

function SummaryPage() {
  const { data: budget = [] } = useQuery({ queryKey: ["sum_budget"], queryFn: async () => (await supabase.from("budget_items").select("*").order("sort_order")).data ?? [] });
  const { data: members = [] } = useQuery({ queryKey: ["sum_members"], queryFn: async () => (await supabase.from("team_members").select("*")).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: ["sum_tasks"], queryFn: async () => (await supabase.from("checklist_items").select("*")).data ?? [] });
  const { data: contrib = [] } = useQuery({ queryKey: ["sum_contrib"], queryFn: async () => (await supabase.from("contributions").select("*")).data ?? [] });

  const planned = budget.reduce((s, i: any) => s + Number(i.planned_amount || 0), 0);
  const actual = budget.reduce((s, i: any) => s + Number(i.actual_amount || 0), 0);

  const byCat = budget.reduce((acc: Record<string, { p: number; a: number }>, i: any) => {
    const c = i.category || "General";
    acc[c] ??= { p: 0, a: 0 };
    acc[c].p += Number(i.planned_amount || 0);
    acc[c].a += Number(i.actual_amount || 0);
    return acc;
  }, {});

  const collected = contrib.filter((c: any) => c.status === "Paid" || c.status === "Completed").reduce((s, c: any) => s + Number(c.amount || 0), 0);
  const pendingC = contrib.filter((c: any) => !["Paid", "Completed"].includes(c.status)).reduce((s, c: any) => s + Number(c.amount || 0), 0);

  const doneTasks = tasks.filter((t: any) => t.status === "Done").length;

  const exportAllXlsx = () => {
    const budgetRows: any[][] = [
      ["MISL Dansala 2026 — Budget Summary"], [`Planned: ${lkr(planned)}    Actual: ${lkr(actual)}    Variance: ${lkr(planned - actual)}`], [],
      ["Category", "Item", "Planned (Rs.)", "Actual note", "Actual (Rs.)", "Variance (Rs.)"],
      ...budget.map((i: any) => [i.category, i.item, Number(i.planned_amount), i.actual_note ?? "", Number(i.actual_amount), Number(i.planned_amount) - Number(i.actual_amount)]),
      [], ["TOTALS", "", planned, "", actual, planned - actual],
    ];
    const catRows = [["Category", "Planned", "Actual", "Variance"], ...Object.entries(byCat).map(([c, v]) => [c, v.p, v.a, v.p - v.a])];
    const memberRows = [["Name", "Department", "Phase", "Team", "Role", "Contact", "Attended"],
      ...members.map((m: any) => [m.name, m.department, m.phase, m.team_name, m.role, m.contact, m.attended ? "Yes" : "No"])];
    const taskRows = [["Title", "Owner", "Status", "Due", "Notes"],
      ...tasks.map((t: any) => [t.title, t.owner, t.status, t.due_date, t.notes])];
    const contribRows = [["Member", "Team", "Amount", "Status", "Paid on", "Note"],
      ...contrib.map((c: any) => [c.member_name, c.team, Number(c.amount), c.status, c.paid_at, c.note]),
      [], ["Collected", "", collected], ["Pending", "", pendingC]];
    exportXlsx("MISL_Dansala_2026_Summary", [
      { name: "Budget", rows: budgetRows },
      { name: "Budget by Category", rows: catRows },
      { name: "Members", rows: memberRows },
      { name: "Tasks", rows: taskRows },
      { name: "Contributions", rows: contribRows },
    ]);
  };

  const exportAllPdf = () => {
    exportPdf("MISL_Dansala_2026_Summary", "MISL Dansala 2026 — Event Summary", [
      { title: "Budget by Category", head: ["Category", "Planned (Rs.)", "Actual (Rs.)", "Variance (Rs.)"],
        body: Object.entries(byCat).map(([c, v]) => [c, lkr(v.p), lkr(v.a), lkr(v.p - v.a)]),
        foot: [["TOTAL", lkr(planned), lkr(actual), lkr(planned - actual)]] },
      { title: "Operations Checklist", head: ["Task", "Owner", "Status", "Due"],
        body: tasks.map((t: any) => [t.title, t.owner ?? "—", t.status, t.due_date ?? "—"]) },
      { title: "Contributions", head: ["Member", "Team", "Amount", "Status"],
        body: contrib.map((c: any) => [c.member_name, c.team, lkr(Number(c.amount)), c.status]),
        foot: [["", "Collected", lkr(collected), `Pending ${lkr(pendingC)}`]] },
    ], `Generated for the IT-managed Dansala event · ${members.length} members · ${tasks.length} tasks`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Summary & Reports" subtitle="High-level view of the entire event, with exports"
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={exportAllXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Export Excel</Button>
          <Button variant="outline" onClick={exportAllPdf}><FileText className="h-4 w-4 mr-2" />Export PDF</Button>
        </div>} />

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Planned budget" value={lkr(planned)} />
        <Stat label="Actual spend" value={lkr(actual)} tone={actual > planned ? "neg" : "pos"} />
        <Stat label="Contributions collected" value={lkr(collected)} tone="pos" />
        <Stat label="Tasks done" value={`${doneTasks} / ${tasks.length}`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Budget by category</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(byCat).map(([c, v]) => {
              const pct = v.p === 0 ? 0 : Math.min(100, (v.a / v.p) * 100);
              return (
                <div key={c}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{c}</span>
                    <span className="text-muted-foreground">{lkr(v.a)} / {lkr(v.p)}</span></div>
                  <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
            {Object.keys(byCat).length === 0 && <div className="text-muted-foreground text-sm">No budget items yet.</div>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Members per phase</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {Object.entries(members.reduce((a: Record<string, number>, m: any) => { a[m.phase] = (a[m.phase] || 0) + 1; return a; }, {})).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-1.5 last:border-0"><span>{k}</span><span className="font-medium">{String(v)}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Tasks by status</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {Object.entries(tasks.reduce((a: Record<string, number>, t: any) => { a[t.status] = (a[t.status] || 0) + 1; return a; }, {})).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b py-1.5 last:border-0"><span>{k}</span><span className="font-medium">{String(v)}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold ${tone === "neg" ? "text-destructive" : tone === "pos" ? "text-emerald-600" : ""}`}>{value}</div>
  </CardContent></Card>;
}