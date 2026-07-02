import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { lkr } from "@/lib/format";
import { exportXlsx, exportPdf, exportPdfWithAttachments, type PdfAttachment } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { notesToBullets } from "@/components/BulletNotes";

export const Route = createFileRoute("/_authenticated/summary")({
  head: () => ({ meta: [{ title: "Summary — Dansala Management System" }] }),
  component: SummaryPage,
});

function SummaryPage() {
  const event = useCurrentEvent();
  const id = useCurrentEventId();
  const { data: budget = [] } = useQuery({ queryKey: ["sum_budget", id], enabled: !!id, queryFn: async () => (await supabase.from("budget_items").select("*").eq("event_id", id!).order("category").order("sort_order")).data ?? [] });
  const { data: members = [] } = useQuery({ queryKey: ["sum_members", id], enabled: !!id, queryFn: async () => (await supabase.from("team_members").select("*").eq("event_id", id!)).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: ["sum_tasks", id], enabled: !!id, queryFn: async () => (await supabase.from("checklist_items").select("*").eq("event_id", id!)).data ?? [] });
  const { data: contrib = [] } = useQuery({ queryKey: ["sum_contrib", id], enabled: !!id, queryFn: async () => (await supabase.from("contributions").select("*").eq("event_id", id!)).data ?? [] });
  const { data: agenda = [] } = useQuery({ queryKey: ["sum_agenda", id], enabled: !!id, queryFn: async () => (await supabase.from("agenda_items").select("*").eq("event_id", id!).order("start_time")).data ?? [] });
  const { data: staff = [] } = useQuery({ queryKey: ["staff_list"], queryFn: async () => (await supabase.from("staff").select("id,name").eq("active", true)).data ?? [] });
  const { data: cAssignees = [] } = useQuery({
    queryKey: ["sum_checklist_assignees", id],
    enabled: !!id && (tasks as any[]).length > 0,
    queryFn: async () => {
      const ids = (tasks as any[]).map(t => t.id);
      const { data } = await supabase.from("checklist_assignees" as any).select("*").in("checklist_item_id", ids);
      return (data ?? []) as any[];
    },
  });
  const { data: receipts = [] } = useQuery({
    queryKey: ["sum_receipts", id],
    enabled: !!id && budget.length > 0,
    queryFn: async () => {
      const ids = (budget as any[]).map(b => b.id);
      if (!ids.length) return [] as any[];
      const { data } = await supabase.from("budget_receipts").select("*").in("budget_item_id", ids);
      if (!data) return [];
      const withUrls = await Promise.all(data.map(async (r: any) => {
        const { data: s } = await supabase.storage.from("receipts").createSignedUrl(r.file_path, 60 * 60 * 24);
        return { ...r, url: s?.signedUrl ?? "" };
      }));
      return withUrls;
    },
  });
  const staffMap = new Map((staff as any[]).map(s => [s.id, s.name]));
  const itemMap = new Map((budget as any[]).map(b => [b.id, b]));
  const receiptsByItem = (receipts as any[]).reduce((acc: Record<string, any[]>, r) => {
    (acc[r.budget_item_id] ??= []).push(r); return acc;
  }, {});

  const planned = budget.reduce((s, i: any) => s + Number(i.planned_amount || 0), 0);
  const actual = budget.reduce((s, i: any) => s + Number(i.actual_amount || 0), 0);
  const byCat = budget.reduce((acc: Record<string, { p: number; a: number }>, i: any) => {
    const c = i.category || "General";
    acc[c] ??= { p: 0, a: 0 };
    acc[c].p += Number(i.planned_amount || 0); acc[c].a += Number(i.actual_amount || 0);
    return acc;
  }, {});
  const collected = contrib.filter((c: any) => c.status === "Paid" || c.status === "Completed").reduce((s, c: any) => s + Number(c.amount || 0), 0);
  const pendingC = contrib.filter((c: any) => !["Paid", "Completed"].includes(c.status)).reduce((s, c: any) => s + Number(c.amount || 0), 0);
  const officeFunded = Number((event as any)?.office_contribution ?? 0);
  const totalAvailable = collected + officeFunded;
  const inHand = officeFunded + collected - actual;
  const doneTasks = tasks.filter((t: any) => t.status === "Done").length;

  const { data: eventDocs = [] } = useQuery({
    queryKey: ["sum_event_docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("event_documents" as any).select("*").eq("event_id", id!).order("category");
      const withUrls = await Promise.all((data ?? []).map(async (d: any) => {
        const { data: s } = await supabase.storage.from("event-documents").createSignedUrl(d.file_path, 60 * 60 * 24);
        return { ...d, url: s?.signedUrl ?? "" };
      }));
      return withUrls;
    },
  });

  const fileBase = (event?.name ?? "Event").replace(/\s+/g, "_");

  const exportBudgetEst = (kind: "xlsx" | "pdf") => {
    if (kind === "xlsx") {
      exportXlsx(`${fileBase}_Budget_Estimation`, [{ name: "Estimation", rows: [
        [`${event?.name} — Budget Estimation`], [`Generated ${new Date().toLocaleString()}`], [],
        ["Category", "Item", "Qty", "Unit", "Rate (Rs.)", "Estimated (Rs.)"],
        ...budget.map((i: any) => [i.category, i.item, i.planned_qty ?? "", i.unit ?? "", i.planned_unit_price ?? "", Number(i.planned_amount)]),
        [], ["TOTAL ESTIMATED", "", "", "", "", planned],
      ]}]);
    } else {
      exportPdf(`${fileBase}_Budget_Estimation`, `${event?.name} — Budget Estimation`, [{
        head: ["Category", "Item", "Qty", "Unit", "Rate", "Estimated"],
        body: budget.map((i: any) => [i.category, i.item, i.planned_qty ?? "—", i.unit ?? "—", i.planned_unit_price ? lkr(Number(i.planned_unit_price)) : "—", lkr(Number(i.planned_amount))]),
        foot: [["", "", "", "", "TOTAL", lkr(planned)]],
      }], `Estimated total: ${lkr(planned)}`);
    }
  };

  const exportBudgetFull = (kind: "xlsx" | "pdf") => {
    if (kind === "xlsx") {
      exportXlsx(`${fileBase}_Budget_Full`, [
        { name: "Summary", rows: [[`${event?.name} — Budget Summary`], [`Planned ${lkr(planned)} · Actual ${lkr(actual)} · Variance ${lkr(planned - actual)}`], [],
          ["Category", "Planned", "Actual", "Variance"], ...Object.entries(byCat).map(([c, v]) => [c, v.p, v.a, v.p - v.a]), [], ["TOTAL", planned, actual, planned - actual]] },
        { name: "All items", rows: [["Category", "Item", "Qty", "Unit", "Rate", "Planned", "Actual qty", "Actual rate", "Actual", "Variance"],
          ...budget.map((i: any) => [i.category, i.item, i.planned_qty ?? "", i.unit ?? "", i.planned_unit_price ?? "", Number(i.planned_amount), i.actual_qty ?? "", i.actual_unit_price ?? "", Number(i.actual_amount), Number(i.planned_amount) - Number(i.actual_amount)])] },
        { name: "Receipts", rows: [["Category", "Item", "File", "Link"],
          ...(receipts as any[]).map(r => {
            const it = itemMap.get(r.budget_item_id);
            return [it?.category ?? "—", it?.item ?? "—", r.file_name, r.url];
          })] },
      ]);
    } else {
      const tables = [
        { title: "Summary by Category", head: ["Category", "Planned", "Actual", "Variance"],
          body: Object.entries(byCat).map(([c, v]) => [c, lkr(v.p), lkr(v.a), lkr(v.p - v.a)]),
          foot: [["TOTAL", lkr(planned), lkr(actual), lkr(planned - actual)]] },
        { title: "All line items", head: ["Category", "Item", "Planned", "Actual"],
          body: budget.map((i: any) => [i.category, i.item, lkr(Number(i.planned_amount)), lkr(Number(i.actual_amount))]) },
        ...((receipts as any[]).length ? [{
          title: "Receipts & supporting documents",
          head: ["Category", "Item", "File"],
          body: (receipts as any[]).map(r => { const it = itemMap.get(r.budget_item_id); return [it?.category ?? "—", it?.item ?? "—", r.file_name]; }),
        }] : []),
      ];
      const subtitle = `Planned ${lkr(planned)} · Actual ${lkr(actual)} · Variance ${lkr(planned - actual)}`;
      if ((receipts as any[]).length) {
        const atts: PdfAttachment[] = (receipts as any[]).map(r => {
          const it = itemMap.get(r.budget_item_id);
          return { section: `Receipt · ${it?.category ?? ""} — ${it?.item ?? ""}`.trim(), title: r.file_name, url: r.url, fileName: r.file_name };
        });
        void exportPdfWithAttachments(`${fileBase}_Budget_Full`, `${event?.name} — Budget Report`, tables, atts, subtitle);
      } else {
        exportPdf(`${fileBase}_Budget_Full`, `${event?.name} — Budget Report`, tables, subtitle);
      }
    }
  };

  const exportComplete = (kind: "xlsx" | "pdf") => {
    const responsibleNames = (t: any) => {
      const primary = t.owner_staff_id ? (staffMap.get(t.owner_staff_id) ?? null) : (t.owner ?? null);
      const extras = (cAssignees as any[])
        .filter(a => a.checklist_item_id === t.id && a.staff_id !== t.owner_staff_id)
        .map(a => staffMap.get(a.staff_id))
        .filter(Boolean);
      return [primary, ...extras].filter(Boolean).join(", ") || "—";
    };
    const memberName = (m: any) => m.staff_id ? (staffMap.get(m.staff_id) ?? m.name) : m.name;
    const contribName = (c: any) => c.staff_id ? (staffMap.get(c.staff_id) ?? c.member_name) : c.member_name;
    const agendaResp = (a: any) => a.responsible_staff_id ? (staffMap.get(a.responsible_staff_id) ?? "—") : "—";
    const agendaBullets = notesToBullets(event?.agenda_notes);
    const checklistBullets = notesToBullets(event?.checklist_notes);
    const teamNotes = (event?.team_notes ?? {}) as Record<string, string>;
    const teamVenues = ((event as any)?.team_venues ?? {}) as Record<string, string>;
    // Group members by phase → team for export
    const phaseTeamMap: Record<string, Record<string, any[]>> = {};
    (members as any[]).forEach(m => {
      (phaseTeamMap[m.phase] ??= {});
      (phaseTeamMap[m.phase][m.team_name] ??= []).push(m);
    });
    if (kind === "xlsx") {
      // Build Teams sheet grouped by phase → team with notes
      const teamsRows: any[][] = [];
      for (const [phase, teamMap] of Object.entries(phaseTeamMap)) {
        teamsRows.push([phase.toUpperCase()]);
        teamsRows.push([]);
        for (const [team, list] of Object.entries(teamMap)) {
          const key = `${phase}::${team}`;
          const venue = teamVenues[key] ?? "";
          teamsRows.push([team + (venue ? `  ·  Venue: ${venue}` : "")]);
          teamsRows.push(["Name", "Department", "Role", "Contact", "Venue"]);
          list.forEach((m: any) => teamsRows.push([memberName(m), m.department ?? "", m.role ?? "", m.contact ?? "", venue]));
          const notes = notesToBullets(teamNotes[key]);
          if (notes.length) {
            teamsRows.push(["Important notes:"]);
            notes.forEach(n => teamsRows.push([`• ${n}`]));
          }
          teamsRows.push([]);
        }
      }
      exportXlsx(`${fileBase}_Complete_Summary`, [
        { name: "Event Info", rows: [["Event"], ["Name", event?.name ?? ""], ["Year", event?.year ?? ""], ["Location", event?.location ?? ""], ["Type", event?.dansala_type ?? ""], ["Date", event?.event_date ?? ""], ["Status", event?.status ?? ""]] },
        { name: "Budget Summary", rows: [["Category", "Planned", "Actual", "Variance"], ...Object.entries(byCat).map(([c, v]) => [c, v.p, v.a, v.p - v.a]), [], ["TOTAL", planned, actual, planned - actual]] },
        { name: "Budget Detail", rows: [["Category", "Item", "Qty", "Unit", "Rate", "Planned", "Actual", "Note"],
          ...budget.map((i: any) => [i.category, i.item, i.planned_qty ?? "", i.unit ?? "", i.planned_unit_price ?? "", Number(i.planned_amount), Number(i.actual_amount), i.actual_note ?? ""])] },
        { name: "Receipts", rows: [["Category", "Item", "File", "Link"],
          ...(receipts as any[]).map(r => { const it = itemMap.get(r.budget_item_id); return [it?.category ?? "—", it?.item ?? "—", r.file_name, r.url]; })] },
        { name: "Agenda", rows: [["Start", "End", "Activity", "Location", "Responsible", "Notes"],
          ...agenda.map((a: any) => [a.start_time ?? "", a.end_time ?? "", a.title, a.location ?? "", agendaResp(a), a.notes ?? ""])] },
        { name: "Agenda Notes", rows: [["Important notes"], ...agendaBullets.map(b => [`• ${b}`])] },
        { name: "Teams", rows: teamsRows },
        { name: "Checklist", rows: [["Task", "Responsible person(s)", "Status", "Due", "Notes"],
          ...tasks.map((t: any) => [t.title, responsibleNames(t), t.status, t.due_date, t.notes])] },
        { name: "Checklist Notes", rows: [["Important notes"], ...checklistBullets.map(b => [`• ${b}`])] },
        { name: "Contributions", rows: [["Member", "Team", "Amount", "Status", "Paid on", "Note"],
          ...contrib.map((c: any) => [contribName(c), c.team, Number(c.amount), c.status, c.paid_at, c.note]),
          [], ["Collected", "", collected], ["Pending", "", pendingC], ["Office funded", "", officeFunded], ["TOTAL AVAILABLE", "", totalAvailable], ["Budget actual", "", actual], ["IN HAND", "", inHand]] },
        { name: "Event Documents", rows: [["Category", "Title", "File", "Link"],
          ...(eventDocs as any[]).map(d => [d.category, d.title, d.file_name, d.url])] },
      ]);
    } else {
      const teamTables: any[] = [];
      for (const [phase, teamMap] of Object.entries(phaseTeamMap)) {
        for (const [team, list] of Object.entries(teamMap)) {
          const key = `${phase}::${team}`;
          const venue = teamVenues[key] ?? "";
          const notes = notesToBullets(teamNotes[key]);
          teamTables.push({
            title: `${phase} — ${team}${venue ? `  ·  Venue: ${venue}` : ""}`,
            head: ["Name", "Dept", "Role", "Contact", "Venue"],
            body: list.map((m: any) => [memberName(m), m.department ?? "—", m.role ?? "—", m.contact ?? "—", venue || "—"]),
            notes,
          });
        }
      }
      // Mark the first team table to start on a new page
      if (teamTables.length) teamTables[0].newPage = true;
      const completeTables = [
        { title: "Budget by Category", head: ["Category", "Planned", "Actual", "Variance"],
          body: Object.entries(byCat).map(([c, v]) => [c, lkr(v.p), lkr(v.a), lkr(v.p - v.a)]),
          foot: [["TOTAL", lkr(planned), lkr(actual), lkr(planned - actual)]] },
        ...((receipts as any[]).length ? [{
          title: "Receipts & supporting documents",
          head: ["Category", "Item", "File"],
          body: (receipts as any[]).map(r => { const it = itemMap.get(r.budget_item_id); return [it?.category ?? "—", it?.item ?? "—", r.file_name]; }),
        }] : []),
        { title: "Event Agenda", newPage: true, notes: agendaBullets,
          head: ["Start", "End", "Activity", "Location", "Responsible"],
          body: agenda.map((a: any) => [a.start_time ?? "—", a.end_time ?? "—", a.title, a.location ?? "—", agendaResp(a)]) },
        ...teamTables,
        { title: "Checklist", newPage: true, notes: checklistBullets,
          head: ["Task", "Responsible person(s)", "Status", "Due"],
          body: tasks.map((t: any) => [t.title, responsibleNames(t), t.status, t.due_date ?? "—"]) },
        { title: "Contributions", newPage: true, head: ["Member", "Team", "Amount", "Status"],
          body: contrib.map((c: any) => [contribName(c), c.team, lkr(Number(c.amount)), c.status]),
          foot: [["", "Collected", lkr(collected), `Pending ${lkr(pendingC)}`]] },
        { title: "Funding breakdown", head: ["Source", "Amount"],
          body: [["Collected from staff", lkr(collected)], ["Office funded", lkr(officeFunded)], ["Total available", lkr(totalAvailable)], ["Less: Budget actual spend", `- ${lkr(actual)}`]],
          foot: [["IN HAND", lkr(inHand)]] },
        ...(((eventDocs as any[]).length) ? (() => {
          const grouped = (eventDocs as any[]).reduce((a: Record<string, any[]>, d) => { (a[d.category] ??= []).push(d); return a; }, {});
          return Object.entries(grouped).map(([cat, list], idx) => ({
            title: `Documents — ${cat}`,
            newPage: idx === 0,
            head: ["Title", "File"],
            body: (list as any[]).map(d => [d.title, d.file_name]),
          }));
        })() : []),
      ];
      const subtitle = `${members.length} members · ${tasks.length} tasks · ${agenda.length} agenda items`;
      const atts: PdfAttachment[] = [
        ...(receipts as any[]).map(r => {
          const it = itemMap.get(r.budget_item_id);
          return { section: `Receipt · ${it?.category ?? ""} — ${it?.item ?? ""}`.trim(), title: r.file_name, url: r.url, fileName: r.file_name };
        }),
        ...(eventDocs as any[]).map(d => ({
          section: `Document · ${d.category}`, title: d.title || d.file_name, url: d.url, fileName: d.file_name, mime: d.mime_type,
        })),
      ];
      if (atts.length) {
        void exportPdfWithAttachments(`${fileBase}_Complete_Summary`, `${event?.name} — Complete Summary`, completeTables, atts, subtitle);
      } else {
        exportPdf(`${fileBase}_Complete_Summary`, `${event?.name} — Complete Summary`, completeTables, subtitle);
      }
    }
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      <PageHeader title="Summary & Reports" subtitle={`${event.name} · ${event.year} · choose what to export`} />

      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard title="Budget Estimation" description="Planned line items with quantity, rate, and totals — share before purchasing."
          onXlsx={() => exportBudgetEst("xlsx")} onPdf={() => exportBudgetEst("pdf")} />
        <ReportCard title="Full Budget Report" description="Planned vs actual with variance by category and per-item detail."
          onXlsx={() => exportBudgetFull("xlsx")} onPdf={() => exportBudgetFull("pdf")} />
        <ReportCard title="Complete Event Summary" description="Everything: event info, budget, agenda, teams, checklist and contributions."
          onXlsx={() => exportComplete("xlsx")} onPdf={() => exportComplete("pdf")} />
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Planned budget" value={lkr(planned)} />
        <Stat label="Actual spend" value={lkr(actual)} tone={actual > planned ? "neg" : "pos"} />
        <Stat label="Collected" value={lkr(collected)} tone="pos" />
        <Stat label="In hand" value={lkr(inHand)} tone={inHand < 0 ? "neg" : "pos"} />
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
    </div>
  );
}

function ReportCard({ title, description, onXlsx, onPdf }: { title: string; description: string; onXlsx: () => void; onPdf: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          <Button variant="outline" size="sm" onClick={onPdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold ${tone === "neg" ? "text-destructive" : tone === "pos" ? "text-emerald-600" : ""}`}>{value}</div>
  </CardContent></Card>;
}