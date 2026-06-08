import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { useEventCtx, type Event } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({ meta: [{ title: "Events — Dansala Management System" }] }),
  component: EventsPage,
});

function EventsPage() {
  const qc = useQueryClient();
  const { events, currentEvent, setCurrentEventId } = useEventCtx();
  const { isAdmin } = useIsAdmin();
  const { data: types = [] } = useMasterOptions("dansala_type");
  const { data: statuses = [] } = useMasterOptions("event_status");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<Event>) => {
      if (editing) {
        const { error } = await supabase.from("events").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert({ name: v.name || "", year: v.year || new Date().getFullYear(), location: v.location, dansala_type: v.dansala_type, event_date: v.event_date || null, status: v.status || "Planning", notes: v.notes });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("events").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Removed"); },
  });

  const duplicate = useMutation({
    mutationFn: async (src: Event) => {
      const newName = `${src.name} (Copy)`;
      const { data: created, error } = await supabase.from("events").insert({
        name: newName, year: src.year, location: src.location, dansala_type: src.dansala_type,
        event_date: null, status: "Planning", notes: src.notes, agenda_notes: src.agenda_notes ?? null,
      }).select().single();
      if (error) throw error;
      const newId = created.id as string;
      const stripIds = (rows: any[]) => rows.map(({ id, created_at, updated_at, ...rest }) => ({ ...rest, event_id: newId }));

      const [b, c, t, a] = await Promise.all([
        supabase.from("budget_items").select("*").eq("event_id", src.id),
        supabase.from("checklist_items").select("*").eq("event_id", src.id),
        supabase.from("team_members").select("*").eq("event_id", src.id),
        supabase.from("agenda_items").select("*").eq("event_id", src.id),
      ]);

      const tasks: Promise<any>[] = [];
      if (b.data?.length) tasks.push(supabase.from("budget_items").insert(stripIds(b.data)));
      if (c.data?.length) tasks.push(supabase.from("checklist_items").insert(stripIds(c.data)));
      if (t.data?.length) tasks.push(supabase.from("team_members").insert(stripIds(t.data)));
      if (a.data?.length) tasks.push(supabase.from("agenda_items").insert(stripIds(a.data)));
      const results = await Promise.all(tasks);
      for (const r of results) if (r.error) throw r.error;
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries();
      setCurrentEventId(newId);
      toast.success("Event duplicated — edit the copy as needed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Events / Projects" subtitle="Each Dansala event is a separate project with its own budget, teams and checklist."
        action={isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New event</Button></DialogTrigger>
            <EventDialog key={editing?.id ?? "new"} initial={editing} types={types.map(t => t.value)} statuses={statuses.map(s => s.value)} onSubmit={(v) => save.mutate(v)} />
          </Dialog>
        )} />

      <div className="grid gap-4 md:grid-cols-2">
        {events.map(e => {
          const active = currentEvent?.id === e.id;
          return (
            <Card key={e.id} className={active ? "border-primary ring-1 ring-primary" : ""}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{e.dansala_type ?? "Dansala"} · {e.year}</div>
                    <div className="text-lg font-semibold">{e.name}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted">{e.status}</span>
                </div>
                <div className="text-sm text-muted-foreground">{e.location ?? "—"} · {e.event_date ?? "Date TBD"}</div>
                {e.notes && <p className="text-sm">{e.notes}</p>}
                <div className="flex items-center gap-2 pt-3">
                  <Button size="sm" variant={active ? "default" : "outline"} onClick={() => setCurrentEventId(e.id)}>
                    {active ? <><Check className="h-4 w-4 mr-2" />Selected</> : "Select"}
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Duplicate event"
                        onClick={() => { if (confirm(`Duplicate "${e.name}" with all budget, checklist, team and agenda data?`)) duplicate.mutate(e); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {events.length === 0 && (
          <Card className="md:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">
            No events yet. {isAdmin ? "Click \"New event\" to create one." : "An admin must create one first."}
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

function EventDialog({ initial, types, statuses, onSubmit }: { initial: Event | null; types: string[]; statuses: string[]; onSubmit: (v: Partial<Event>) => void }) {
  const [f, setF] = useState<Partial<Event>>(initial ?? { name: "", year: new Date().getFullYear(), location: "", dansala_type: types[0] ?? "", event_date: "", status: statuses[0] ?? "Planning", notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "New"} event</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Event name</Label><Input value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} required placeholder="e.g. Annual Dansala 2026" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Year</Label><Input type="number" value={f.year ?? new Date().getFullYear()} onChange={e => setF({ ...f, year: Number(e.target.value) })} required /></div>
          <div><Label>Event date</Label><Input type="date" value={f.event_date ?? ""} onChange={e => setF({ ...f, event_date: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={f.location ?? ""} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          <div><Label>Dansala type</Label>
            <Select value={f.dansala_type ?? ""} onValueChange={v => setF({ ...f, dansala_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Status</Label>
            <Select value={f.status ?? "Planning"} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}