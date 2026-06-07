import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Clock, MapPin, User, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { exportXlsx, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Dansala Management System" }] }),
  component: AgendaPage,
});

type A = { id: string; event_id: string; start_time: string | null; end_time: string | null; title: string; location: string | null; responsible_staff_id: string | null; notes: string | null; sort_order: number };
type Staff = { id: string; name: string };

function AgendaPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();

  const { data: staff = [] } = useQuery({ queryKey: ["staff_list"], queryFn: async () => (await supabase.from("staff").select("id,name").eq("active", true).order("name")).data as Staff[] ?? [] });
  const staffMap = new Map(staff.map(s => [s.id, s.name]));

  const { data: items = [] } = useQuery({
    queryKey: ["agenda", eventId],
    enabled: !!eventId,
    queryFn: async () => (await supabase.from("agenda_items").select("*").eq("event_id", eventId!).order("start_time", { nullsFirst: false }).order("sort_order")).data as A[] ?? [],
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<A | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<A>) => {
      if (editing) {
        const { error } = await supabase.from("agenda_items").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agenda_items").insert({ event_id: eventId!, title: v.title || "", start_time: v.start_time || null, end_time: v.end_time || null, location: v.location, responsible_staff_id: v.responsible_staff_id ?? null, notes: v.notes });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("agenda_items").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda"] }),
  });

  const handleXlsx = () => {
    exportXlsx(`${event?.name}_Agenda`.replace(/\s+/g, "_"), [{ name: "Agenda", rows: [
      [`${event?.name} — Event Agenda`], [], ["Start", "End", "Activity", "Location", "Responsible", "Notes"],
      ...items.map(i => [i.start_time ?? "", i.end_time ?? "", i.title, i.location ?? "", i.responsible_staff_id ? staffMap.get(i.responsible_staff_id) : "", i.notes ?? ""]),
    ]}]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Agenda`.replace(/\s+/g, "_"), `${event?.name} — Event Agenda`, [{
      head: ["Start", "End", "Activity", "Location", "Responsible"],
      body: items.map(i => [i.start_time ?? "—", i.end_time ?? "—", i.title, i.location ?? "—", i.responsible_staff_id ? (staffMap.get(i.responsible_staff_id) ?? "—") : "—"]),
    }], `${items.length} activities`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <PageHeader title="Event-day Agenda" subtitle={`${event.name} · timeline of activities`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add activity</Button></DialogTrigger>
                <AgendaDialog key={editing?.id ?? "new"} initial={editing} staff={staff} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {items.map(i => (
              <div key={i.id} className="p-4 flex items-start gap-4">
                <div className="w-28 shrink-0 text-sm">
                  <div className="flex items-center gap-1 text-primary font-medium"><Clock className="h-3 w-3" />{i.start_time?.slice(0, 5) ?? "—"}</div>
                  {i.end_time && <div className="text-xs text-muted-foreground ml-4">to {i.end_time.slice(0, 5)}</div>}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{i.title}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                    {i.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{i.location}</span>}
                    {i.responsible_staff_id && <span className="flex items-center gap-1"><User className="h-3 w-3" />{staffMap.get(i.responsible_staff_id) ?? "—"}</span>}
                  </div>
                  {i.notes && <div className="text-sm text-muted-foreground mt-1">{i.notes}</div>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div className="p-8 text-center text-muted-foreground">No activities scheduled yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgendaDialog({ initial, staff, onSubmit }: { initial: A | null; staff: Staff[]; onSubmit: (v: Partial<A>) => void }) {
  const [f, setF] = useState<Partial<A>>(initial ?? { title: "", start_time: "", end_time: "", location: "", responsible_staff_id: null, notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} activity</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Activity</Label><Input value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })} required placeholder="e.g. Welcome & blessing" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start time</Label><Input type="time" value={f.start_time ?? ""} onChange={e => setF({ ...f, start_time: e.target.value })} /></div>
          <div><Label>End time</Label><Input type="time" value={f.end_time ?? ""} onChange={e => setF({ ...f, end_time: e.target.value })} /></div>
          <div className="col-span-2"><Label>Location</Label><Input value={f.location ?? ""} onChange={e => setF({ ...f, location: e.target.value })} placeholder="e.g. Main hall" /></div>
          <div className="col-span-2"><Label>Responsible (staff)</Label>
            <Select value={f.responsible_staff_id ?? ""} onValueChange={v => setF({ ...f, responsible_staff_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}