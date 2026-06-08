import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { lkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/contributions")({
  head: () => ({ meta: [{ title: "Contributions — Dansala Management System" }] }),
  component: ContributionsPage,
});

type Co = { id: string; event_id: string; member_name: string; team: string; amount: number; status: string; paid_at: string | null; note: string | null; staff_id: string | null };
type Staff = { id: string; name: string; department: string | null };

function ContributionsPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const { data: statusOpts = [] } = useMasterOptions("contribution_status");
  const { data: teamOpts = [] } = useMasterOptions("contribution_team");
  const STATUSES = statusOpts.length ? statusOpts.map(s => s.value) : ["Pending", "Paid"];
  const TEAMS = teamOpts.map(t => t.value);

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => (await supabase.from("staff").select("id,name,department").eq("active", true).order("name")).data as Staff[] ?? [],
  });
  const staffMap = new Map(staffList.map(s => [s.id, s]));

  const { data: rows = [] } = useQuery({
    queryKey: ["contrib", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contributions").select("*").eq("event_id", eventId!).order("team").order("member_name");
      if (error) throw error;
      return data as Co[];
    },
  });

  const displayName = (r: Co) => r.staff_id ? (staffMap.get(r.staff_id)?.name ?? r.member_name) : r.member_name;
  const paidStatuses = ["Paid", "Completed"];
  const collected = rows.filter(r => paidStatuses.includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter(r => !paidStatuses.includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);

  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: async (v: Partial<Co>) => {
      const s = v.staff_id ? staffMap.get(v.staff_id) : undefined;
      const { error } = await supabase.from("contributions").insert({
        event_id: eventId!,
        member_name: s?.name ?? v.member_name ?? "",
        team: v.team || (TEAMS[0] ?? "General"),
        amount: Number(v.amount || 0),
        status: v.status || "Pending",
        note: v.note,
        staff_id: v.staff_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contrib"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); toast.success("Added"); },
  });
  const update = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Partial<Co> }) => {
      const payload: any = { ...v };
      if (paidStatuses.includes(v.status ?? "") && !v.paid_at) payload.paid_at = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("contributions").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contrib"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contributions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contrib"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });

  const handleXlsx = () => {
    const byTeam = rows.reduce((a: Record<string, { c: number; p: number }>, r) => {
      a[r.team] ??= { c: 0, p: 0 };
      if (paidStatuses.includes(r.status)) a[r.team].c += Number(r.amount); else a[r.team].p += Number(r.amount);
      return a;
    }, {});
    exportXlsx(`${event?.name}_Contributions`.replace(/\s+/g, "_"), [
      { name: "Summary", rows: [[`${event?.name} — Contributions`], [`Collected ${lkr(collected)}  ·  Pending ${lkr(pending)}`], [],
        ["Team", "Collected (Rs.)", "Pending (Rs.)"], ...Object.entries(byTeam).map(([t, v]) => [t, v.c, v.p]),
        [], ["TOTAL", collected, pending]] },
      { name: "All entries", rows: [["Member", "Team", "Amount", "Status", "Paid on", "Note"],
        ...rows.map(r => [displayName(r), r.team, Number(r.amount), r.status, r.paid_at ?? "", r.note ?? ""])] },
    ]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Contributions`.replace(/\s+/g, "_"), `${event?.name} — Contributions`, [{
      head: ["Member", "Team", "Amount", "Status", "Paid on"],
      body: rows.map(r => [displayName(r), r.team, lkr(Number(r.amount)), r.status, r.paid_at ?? "—"]),
      foot: [["", "Collected", lkr(collected), "Pending", lkr(pending)]],
    }], `${rows.length} entries`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Contributions" subtitle={`${event.name} · payments from members`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add contribution</Button></DialogTrigger>
                <NewDialog staff={staffList} teams={TEAMS} statuses={STATUSES} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Collected</div><div className="text-2xl font-semibold text-emerald-600">{lkr(collected)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-semibold text-amber-600">{lkr(pending)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Members</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Member</TableHead><TableHead>Team</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              <TableHead>Paid on</TableHead>{isAdmin && <TableHead className="w-12"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{displayName(r)}</TableCell>
                  <TableCell>{r.team}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <Input className="w-28 ml-auto text-right" type="number" defaultValue={r.amount}
                        onBlur={e => Number(e.target.value) !== Number(r.amount) && update.mutate({ id: r.id, v: { amount: Number(e.target.value) } })} />
                    ) : lkr(Number(r.amount))}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, v: { status: v } })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : r.status}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.paid_at ?? "—"}</TableCell>
                  {isAdmin && <TableCell><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">No contributions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewDialog({ staff, teams, statuses, onSubmit }: { staff: Staff[]; teams: string[]; statuses: string[]; onSubmit: (v: Partial<Co>) => void }) {
  const [f, setF] = useState<Partial<Co>>({ staff_id: null, team: teams[0] ?? "General", amount: 0, status: statuses[0] ?? "Pending", note: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New contribution</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Staff member</Label>
          <Select value={f.staff_id ?? ""} onValueChange={(v) => setF({ ...f, staff_id: v })}>
            <SelectTrigger><SelectValue placeholder={staff.length ? "Select staff…" : "Add staff first"} /></SelectTrigger>
            <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Team</Label>
            <Select value={f.team} onValueChange={v => setF({ ...f, team: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount (Rs.)</Label><Input type="number" value={f.amount ?? 0} onChange={e => setF({ ...f, amount: Number(e.target.value) })} /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Input value={f.note ?? ""} onChange={e => setF({ ...f, note: e.target.value })} /></div>
        </div>
        <DialogFooter><Button type="submit" disabled={!f.staff_id}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}