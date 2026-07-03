import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BulletNotes } from "@/components/BulletNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileSpreadsheet, FileText, AlertCircle, StickyNote, Save, UserPlus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf, sumF } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { notesToBullets } from "@/components/BulletNotes";

export const Route = createFileRoute("/_authenticated/checklist")({
  head: () => ({ meta: [{ title: "Checklist — Event Manager" }] }),
  component: ChecklistPage,
});

type C = { id: string; event_id: string; title: string; owner: string | null; owner_staff_id: string | null; status: string; notes: string | null; due_date: string | null; sort_order: number };
type Staff = { id: string; name: string; department: string | null };
type Assignee = { id: string; checklist_item_id: string; staff_id: string };

const statusColor: Record<string, string> = {
  "Pending": "bg-muted text-muted-foreground",
  "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Done": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Blocked": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function ChecklistPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const { data: statusOpts = [] } = useMasterOptions("checklist_status");
  const STATUSES = statusOpts.length ? statusOpts.map(s => s.value) : ["Pending", "In Progress", "Done", "Blocked"];

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const notesValue = notesDraft ?? event?.checklist_notes ?? "";
  const saveNotes = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await supabase.from("events").update({ checklist_notes: val } as any).eq("id", eventId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setNotesDraft(null); toast.success("Notes saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => (await supabase.from("staff").select("id,name,department").eq("active", true).order("name")).data as Staff[] ?? [],
  });
  const staffMap = new Map(staff.map(s => [s.id, s]));

  const { data: items = [] } = useQuery({
    queryKey: ["checklist", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_items").select("*").eq("event_id", eventId!).order("sort_order");
      if (error) throw error;
      return data as C[];
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["checklist_assignees", eventId],
    enabled: !!eventId && items.length > 0,
    queryFn: async () => {
      const ids = items.map(i => i.id);
      const { data, error } = await supabase.from("checklist_assignees" as any).select("*").in("checklist_item_id", ids);
      if (error) throw error;
      return (data ?? []) as unknown as Assignee[];
    },
  });

  const addAssignee = useMutation({
    mutationFn: async ({ itemId, staffId }: { itemId: string; staffId: string }) => {
      const { error } = await supabase.from("checklist_assignees" as any).insert({ checklist_item_id: itemId, staff_id: staffId } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_assignees"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const removeAssignee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_assignees" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_assignees"] }),
  });

  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: async (v: Partial<C>) => {
      const { error } = await supabase.from("checklist_items").insert({ event_id: eventId!, title: v.title || "", owner_staff_id: v.owner_staff_id ?? null, status: v.status || "Pending", notes: v.notes, due_date: v.due_date || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); toast.success("Added"); },
  });
  const update = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Partial<C> }) => {
      const { error } = await supabase.from("checklist_items").update(v).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("checklist_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });

  const done = items.filter(i => i.status === "Done").length;
  const today = new Date().toISOString().slice(0, 10);
  const ownerName = (i: C) => i.owner_staff_id ? (staffMap.get(i.owner_staff_id)?.name ?? "—") : (i.owner ?? "—");
  const responsibleNames = (i: C) => {
    const primary = i.owner_staff_id ? (staffMap.get(i.owner_staff_id)?.name ?? null) : (i.owner ?? null);
    const extras = assignees.filter(a => a.checklist_item_id === i.id && a.staff_id !== i.owner_staff_id)
      .map(a => staffMap.get(a.staff_id)?.name).filter(Boolean) as string[];
    return [primary, ...extras].filter(Boolean).join(", ") || "—";
  };

  const handleXlsx = () => {
    const bullets = notesToBullets(event?.checklist_notes);
    exportXlsx(`${event?.name}_Checklist`.replace(/\s+/g, "_"), [{ name: "Checklist", rows: [
      [`${event?.name} — Operations Checklist`], [`${done} of ${items.length} complete`], [],
      ...(bullets.length ? [["Important notes"], ...bullets.map(b => [`• ${b}`]), []] : []),
      ["Task", "Responsible person(s)", "Status", "Due date", "Notes"],
      ...items.map(i => [i.title, responsibleNames(i), i.status, i.due_date ?? "", i.notes ?? ""]),
    ]}]);
  };
  const handlePdf = () => {
    const bullets = notesToBullets(event?.checklist_notes);
    exportPdf(`${event?.name}_Checklist`.replace(/\s+/g, "_"), `${event?.name} — Operations Checklist`, [
      { title: "Operations Checklist", notes: bullets,
        head: ["Task", "Responsible person(s)", "Status", "Due"],
        body: items.map(i => [i.title, responsibleNames(i), i.status, i.due_date ?? "—"]) },
    ], `${done} of ${items.length} complete`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <PageHeader title="Operations checklist" subtitle={`${event.name} · ${done} of ${items.length} complete`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add task</Button></DialogTrigger>
                <NewItemDialog staff={staff} statuses={STATUSES} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <Card className="border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4 text-amber-600" /> Important notes
          </div>
          {isAdmin ? (
            <>
              <Textarea rows={4} value={notesValue}
                placeholder={"One point per line — each line becomes a bullet.\nE.g.\nCheck all generators by 9am\nConfirm vendor deliveries the night before"}
                onChange={e => setNotesDraft(e.target.value)} />
              <p className="text-xs text-muted-foreground">Tip: Enter each important point on a new line.</p>
              <div className="flex justify-end gap-2">
                {notesDraft !== null && <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>Cancel</Button>}
                <Button size="sm" disabled={notesDraft === null || saveNotes.isPending} onClick={() => saveNotes.mutate(notesDraft ?? "")}>
                  <Save className="h-4 w-4 mr-2" />Save notes
                </Button>
              </div>
            </>
          ) : (
            <BulletNotes text={event.checklist_notes ?? ""} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 divide-y max-h-[calc(100vh-14rem)] overflow-y-auto">
          {items.map(i => (
            <div key={i.id} className="p-4 flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[220px] space-y-1">
                <div className="font-medium flex items-center gap-2">
                  {i.title}
                  {i.due_date && i.due_date < today && i.status !== "Done" && (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Overdue</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{i.notes ?? ""}</div>
                <ExtraAssigneesRow itemId={i.id} ownerStaffId={i.owner_staff_id}
                  assignees={assignees.filter(a => a.checklist_item_id === i.id)}
                  staff={staff} isAdmin={isAdmin}
                  onAdd={(staffId) => addAssignee.mutate({ itemId: i.id, staffId })}
                  onRemove={(id) => removeAssignee.mutate(id)} />
              </div>
              {isAdmin ? (
                <Select value={i.owner_staff_id ?? "none"} onValueChange={(v) => update.mutate({ id: i.id, v: { owner_staff_id: v === "none" ? null : v } })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Responsible person" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="w-48 text-sm text-muted-foreground">{ownerName(i)}</div>
              )}
              {isAdmin ? (
                <Input className="w-40" type="date" defaultValue={i.due_date ?? ""}
                  onBlur={e => e.target.value !== (i.due_date ?? "") && update.mutate({ id: i.id, v: { due_date: e.target.value || null } })} />
              ) : (
                <div className="w-40 text-sm text-muted-foreground">{i.due_date ?? "—"}</div>
              )}
              {isAdmin ? (
                <Select value={i.status} onValueChange={(v) => update.mutate({ id: i.id, v: { status: v } })}>
                  <SelectTrigger className={`w-36 ${statusColor[i.status] ?? ""}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <span className={`px-3 py-1 rounded-md text-xs ${statusColor[i.status] ?? ""}`}>{i.status}</span>
              )}
              {isAdmin && <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </div>
          ))}
          {items.length === 0 && <div className="p-8 text-center text-muted-foreground">No tasks yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function NewItemDialog({ staff, statuses, onSubmit }: { staff: Staff[]; statuses: string[]; onSubmit: (v: Partial<C>) => void }) {
  const [f, setF] = useState<Partial<C>>({ title: "", owner_staff_id: null, status: "Pending", notes: "", due_date: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New checklist task</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Title</Label><Input value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Owner (staff)</Label>
            <Select value={f.owner_staff_id ?? ""} onValueChange={v => setF({ ...f, owner_staff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Due date</Label><Input type="date" value={f.due_date ?? ""} onChange={e => setF({ ...f, due_date: e.target.value })} /></div>
          <div className="col-span-2"><Label>Status</Label>
            <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">Add</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function ExtraAssigneesRow({ itemId, ownerStaffId, assignees, staff, isAdmin, onAdd, onRemove }: {
  itemId: string; ownerStaffId: string | null;
  assignees: Assignee[]; staff: Staff[]; isAdmin: boolean;
  onAdd: (staffId: string) => void; onRemove: (id: string) => void;
}) {
  const staffMap = new Map(staff.map(s => [s.id, s]));
  const extras = assignees.filter(a => a.staff_id !== ownerStaffId);
  const usedIds = new Set<string>([
    ...(ownerStaffId ? [ownerStaffId] : []),
    ...assignees.map(a => a.staff_id),
  ]);
  const pickable = staff.filter(s => !usedIds.has(s.id));
  if (!isAdmin && extras.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      {extras.map(a => (
        <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5">
          {staffMap.get(a.staff_id)?.name ?? "?"}
          {isAdmin && <button onClick={() => onRemove(a.id)} className="text-destructive hover:opacity-70"><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {isAdmin && pickable.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"><UserPlus className="h-3 w-3 mr-1" />Add</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto" align="start">
            {pickable.map(s => (
              <button key={s.id} onClick={() => onAdd(s.id)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent">
                {s.name}{s.department ? ` · ${s.department}` : ""}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}