import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileSpreadsheet, FileText, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/checklist")({
  head: () => ({ meta: [{ title: "Checklist — Dansala Management System" }] }),
  component: ChecklistPage,
});

type C = { id: string; event_id: string; title: string; owner: string | null; owner_staff_id: string | null; status: string; notes: string | null; due_date: string | null; sort_order: number };
type Staff = { id: string; name: string; department: string | null };

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

  const handleXlsx = () => {
    exportXlsx(`${event?.name}_Checklist`.replace(/\s+/g, "_"), [{ name: "Checklist", rows: [
      [`${event?.name} — Operations Checklist`], [`${done} of ${items.length} complete`], [],
      ["Task", "Owner", "Status", "Due date", "Notes"],
      ...items.map(i => [i.title, ownerName(i), i.status, i.due_date ?? "", i.notes ?? ""]),
    ]}]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Checklist`.replace(/\s+/g, "_"), `${event?.name} — Operations Checklist`, [{
      head: ["Task", "Owner", "Status", "Due"],
      body: items.map(i => [i.title, ownerName(i), i.status, i.due_date ?? "—"]),
    }], `${done} of ${items.length} complete`);
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

      <Card>
        <CardContent className="p-0 divide-y">
          {items.map(i => (
            <div key={i.id} className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium flex items-center gap-2">
                  {i.title}
                  {i.due_date && i.due_date < today && i.status !== "Done" && (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Overdue</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{i.notes ?? ""}</div>
              </div>
              {isAdmin ? (
                <Select value={i.owner_staff_id ?? "none"} onValueChange={(v) => update.mutate({ id: i.id, v: { owner_staff_id: v === "none" ? null : v } })}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Assign staff" /></SelectTrigger>
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