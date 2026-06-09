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
import { Plus, Trash2, FileSpreadsheet, FileText, Paperclip, Upload, X, Save } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { lkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf, sumF } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/contributions")({
  head: () => ({ meta: [{ title: "Contributions — Dansala Management System" }] }),
  component: ContributionsPage,
});

type Co = { id: string; event_id: string; member_name: string; team: string; amount: number; status: string; paid_at: string | null; note: string | null; staff_id: string | null };
type Staff = { id: string; name: string; department: string | null };
type CReceipt = { id: string; contribution_id: string; file_path: string; file_name: string };

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

  const { data: cReceipts = [] } = useQuery({
    queryKey: ["contrib_receipts", eventId],
    enabled: !!eventId && rows.length > 0,
    queryFn: async () => {
      const ids = rows.map(r => r.id);
      const { data, error } = await supabase.from("contribution_receipts" as any).select("*").in("contribution_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as CReceipt[];
    },
  });

  const displayName = (r: Co) => r.staff_id ? (staffMap.get(r.staff_id)?.name ?? r.member_name) : r.member_name;
  const paidStatuses = ["Paid", "Completed"];
  const collected = rows.filter(r => paidStatuses.includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter(r => !paidStatuses.includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
  const office = Number(event?.office_contribution ?? 0);
  const totalAvailable = collected + office;

  // Office contribution editor
  const [officeDraft, setOfficeDraft] = useState<number | null>(null);
  const officeValue = officeDraft ?? office;
  const saveOffice = useMutation({
    mutationFn: async (val: number) => {
      const { error } = await supabase.from("events").update({ office_contribution: val } as any).eq("id", eventId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOfficeDraft(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

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
    const teamEntries = Object.entries(byTeam);
    // Summary sheet uses SUM() formulas referencing the team-by-team rows.
    const summaryRows: any[][] = [
      [`${event?.name} — Contributions`],
      [`Collected ${lkr(collected)}  ·  Pending ${lkr(pending)}  ·  Office ${lkr(office)}  ·  Total ${lkr(totalAvailable)}`],
      [],
      ["Team", "Collected (Rs.)", "Pending (Rs.)"],
    ];
    const firstTeamRow = summaryRows.length + 1; // 1-indexed
    teamEntries.forEach(([t, v]) => summaryRows.push([t, v.c, v.p]));
    const lastTeamRow = summaryRows.length;
    summaryRows.push([]);
    summaryRows.push(["Staff total", sumF("B", firstTeamRow, lastTeamRow), sumF("C", firstTeamRow, lastTeamRow)]);
    summaryRows.push(["Office funded", office, ""]);
    summaryRows.push(["GRAND TOTAL AVAILABLE", { t: "n", f: `B${summaryRows.length}+B${summaryRows.length - 1}` } as any, ""]);

    const allRows: any[][] = [["Member", "Team", "Amount", "Status", "Paid on", "Note"]];
    const firstDataRow = allRows.length + 1;
    rows.forEach(r => allRows.push([displayName(r), r.team, Number(r.amount), r.status, r.paid_at ?? "", r.note ?? ""]));
    const lastDataRow = allRows.length;
    allRows.push([]);
    allRows.push(["", "TOTAL", sumF("C", firstDataRow, lastDataRow), "", "", ""]);

    exportXlsx(`${event?.name}_Contributions`.replace(/\s+/g, "_"), [
      { name: "Summary", rows: summaryRows },
      { name: "All entries", rows: allRows },
    ]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Contributions`.replace(/\s+/g, "_"), `${event?.name} — Contributions`, [{
      head: ["Member", "Team", "Amount", "Status", "Paid on"],
      body: rows.map(r => [displayName(r), r.team, lkr(Number(r.amount)), r.status, r.paid_at ?? "—"]),
      foot: [["", "Collected", lkr(collected), "Pending", lkr(pending)]],
    }, {
      title: "Funding breakdown",
      head: ["Source", "Amount"],
      body: [["Collected from staff", lkr(collected)], ["Office funded", lkr(office)]],
      foot: [["TOTAL AVAILABLE", lkr(totalAvailable)]],
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

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Collected</div><div className="text-2xl font-semibold text-emerald-600">{lkr(collected)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-semibold text-amber-600">{lkr(pending)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Office funded</div><div className="text-2xl font-semibold text-sky-600">{lkr(office)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total available</div><div className="text-2xl font-semibold">{lkr(totalAvailable)}</div></CardContent></Card>
      </div>

      <Card className="border-sky-300/50 bg-sky-50/40 dark:bg-sky-950/10">
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium">Office top-up</div>
          <p className="text-xs text-muted-foreground">Members typically cover about half the budget; the office funds the remainder. Record that amount here so the total available reflects both sources.</p>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Input type="number" className="w-48" value={officeValue}
                onChange={(e) => setOfficeDraft(Number(e.target.value))} />
              <Button size="sm" disabled={officeDraft === null || saveOffice.isPending} onClick={() => saveOffice.mutate(officeDraft ?? 0)}>
                <Save className="h-4 w-4 mr-1" />Save
              </Button>
              {officeDraft !== null && <Button size="sm" variant="ghost" onClick={() => setOfficeDraft(null)}>Cancel</Button>}
            </div>
          ) : (
            <div className="text-sm">{lkr(office)}</div>
          )}
        </CardContent>
      </Card>

      <div className="hidden md:grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Members</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 max-h-[calc(100vh-26rem)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10"><TableRow>
              <TableHead>Member</TableHead><TableHead>Team</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
              <TableHead>Paid on</TableHead><TableHead>Receipt</TableHead>{isAdmin && <TableHead className="w-12"></TableHead>}
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
                  <TableCell><ReceiptCell contribId={r.id} receipts={cReceipts.filter(x => x.contribution_id === r.id)} isAdmin={isAdmin} /></TableCell>
                  {isAdmin && <TableCell><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">No contributions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptCell({ contribId, receipts, isAdmin }: { contribId: string; receipts: CReceipt[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `contributions/${contribId}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("receipts").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("contribution_receipts" as any).insert({ contribution_id: contribId, file_path: path, file_name: file.name } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contrib_receipts"] }); toast.success("Uploaded"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (r: CReceipt) => {
      await supabase.storage.from("receipts").remove([r.file_path]);
      await supabase.from("contribution_receipts" as any).delete().eq("id", r.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contrib_receipts"] }),
  });
  const openFile = async (r: CReceipt) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(r.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {receipts.map(r => (
        <span key={r.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
          <button onClick={() => openFile(r)} className="hover:underline flex items-center gap-1"><Paperclip className="h-3 w-3" />{r.file_name.slice(0, 14)}</button>
          {isAdmin && <button onClick={() => remove.mutate(r)} className="text-destructive"><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {isAdmin && (
        <>
          <input ref={ref} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <Button size="sm" variant="ghost" onClick={() => ref.current?.click()} className="h-7"><Upload className="h-3 w-3" /></Button>
        </>
      )}
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