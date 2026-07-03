import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, Copy, Eye, EyeOff, Users2, BookmarkPlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { useEventCtx, type Event } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useQuery } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({ meta: [{ title: "Events — Event Manager" }] }),
  component: EventsPage,
});

function EventsPage() {
  const qc = useQueryClient();
  const { events, currentEvent, setCurrentEventId } = useEventCtx();
  const { isAdmin } = useIsAdmin();
  const { data: types = [] } = useMasterOptions("event_category");
  const { data: statuses = [] } = useMasterOptions("event_status");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<Event>) => {
      if (editing) {
        const { error } = await supabase.from("events").update(v as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert({
          name: v.name || "", year: v.year || new Date().getFullYear(),
          location: v.location, event_category: v.event_category,
          event_date: v.event_date || null, status: v.status || "Planning",
          notes: v.notes, visibility: (v as any).visibility ?? "private",
          currency: (v as any).currency ?? "LKR",
          timezone: (v as any).timezone ?? "Asia/Colombo",
        } as any);
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
        name: newName, year: src.year, location: src.location, event_category: src.event_category,
        event_date: null, status: "Planning", notes: src.notes, agenda_notes: src.agenda_notes ?? null,
        is_public: false,
      } as any).select().single();
      if (error) throw error;
      const newId = created.id as string;
      const stripIds = (rows: any[]) => rows.map(({ id, created_at, updated_at, ...rest }) => ({ ...rest, event_id: newId }));

      const [b, c, t, a] = await Promise.all([
        supabase.from("budget_items").select("*").eq("event_id", src.id),
        supabase.from("checklist_items").select("*").eq("event_id", src.id),
        supabase.from("team_members").select("*").eq("event_id", src.id),
        supabase.from("agenda_items").select("*").eq("event_id", src.id),
      ]);

      const tasks: Array<PromiseLike<{ error: any }>> = [];
      if (b.data?.length) tasks.push(supabase.from("budget_items").insert(stripIds(b.data)) as any);
      if (c.data?.length) tasks.push(supabase.from("checklist_items").insert(stripIds(c.data)) as any);
      if (t.data?.length) tasks.push(supabase.from("team_members").insert(stripIds(t.data)) as any);
      if (a.data?.length) tasks.push(supabase.from("agenda_items").insert(stripIds(a.data)) as any);
      const results = await Promise.all(tasks);
      for (const r of results) if (r?.error) throw r.error;
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries();
      setCurrentEventId(newId);
      toast.success("Event duplicated — edit the copy as needed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["event_templates"],
    queryFn: async () => (await supabase.from("event_templates" as any).select("*").order("name")).data ?? [],
  });

  const newFromTemplate = useMutation({
    mutationFn: async (tpl: any) => {
      const { data: created, error } = await supabase.from("events").insert({
        name: `${tpl.name} — ${new Date().getFullYear()}`,
        year: new Date().getFullYear(),
        event_category: tpl.event_category,
        status: "Planning",
        visibility: "private",
        currency: "LKR",
      } as any).select().single();
      if (error) throw error;
      const eid = created.id as string;
      const agenda = Array.isArray(tpl.default_agenda) ? tpl.default_agenda : [];
      const checklist = Array.isArray(tpl.default_checklist) ? tpl.default_checklist : [];
      const budgetCats = Array.isArray(tpl.default_budget_categories) ? tpl.default_budget_categories : [];
      const jobs: any[] = [];
      if (agenda.length) jobs.push(supabase.from("agenda_items").insert(agenda.map((a: any, i: number) => ({ event_id: eid, title: a.title ?? "Item", description: a.description ?? null, sort_order: i }))));
      if (checklist.length) jobs.push(supabase.from("checklist_items").insert(checklist.map((c: any) => ({ event_id: eid, title: c.title ?? "Task", status: "Pending" }))));
      if (budgetCats.length) jobs.push(supabase.from("budget_items").insert(budgetCats.map((c: any) => ({ event_id: eid, category: typeof c === "string" ? c : c.category, item_name: "—", planned_amount: 0, actual_amount: 0 }))));
      const r = await Promise.all(jobs);
      for (const x of r) if ((x as any)?.error) throw (x as any).error;
      return eid;
    },
    onSuccess: (id) => { qc.invalidateQueries(); setCurrentEventId(id); toast.success("Event created from template"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAsTemplate = useMutation({
    mutationFn: async (ev: Event) => {
      const [a, c, b] = await Promise.all([
        supabase.from("agenda_items").select("title, description, sort_order").eq("event_id", ev.id).order("sort_order"),
        supabase.from("checklist_items").select("title").eq("event_id", ev.id),
        supabase.from("budget_items").select("category").eq("event_id", ev.id),
      ]);
      const cats = Array.from(new Set((b.data ?? []).map((r: any) => r.category).filter(Boolean)));
      const { error } = await supabase.from("event_templates" as any).insert({
        name: `${ev.name} template`,
        description: `Saved from “${ev.name}”`,
        event_category: ev.event_category,
        default_agenda: a.data ?? [],
        default_checklist: c.data ?? [],
        default_budget_categories: cats,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event_templates"] }); toast.success("Saved as template"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Events / Projects" subtitle="Each event is a separate project with its own budget, teams and checklist."
        action={isAdmin && (
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline"><Sparkles className="h-4 w-4 mr-2" />From template</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {templates.map((t: any) => (
                    <DropdownMenuItem key={t.id} onClick={() => newFromTemplate.mutate(t)}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.name}</span>
                        {t.event_category && <span className="text-[11px] text-muted-foreground">{t.event_category}</span>}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New event</Button></DialogTrigger>
              <EventDialog key={editing?.id ?? "new"} initial={editing} types={types.map(t => t.value)} statuses={statuses.map(s => s.value)} onSubmit={(v) => save.mutate(v)} />
            </Dialog>
          </div>
        )} />

      <div className="grid gap-4 md:grid-cols-2">
        {events.map(e => {
          const active = currentEvent?.id === e.id;
          return (
            <Card key={e.id} className={active ? "border-primary ring-1 ring-primary" : ""}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{e.event_category ?? "General"} · {e.year}</div>
                    <div className="text-lg font-semibold">{e.name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs px-2 py-1 rounded bg-muted">{e.status}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1 ${e.is_public ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {e.is_public ? <><Eye className="h-3 w-3" />Public</> : <><EyeOff className="h-3 w-3" />Private</>}
                    </span>
                  </div>
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
                      <Button size="icon" variant="ghost" title="Save as template" onClick={() => saveAsTemplate.mutate(e)}>
                        <BookmarkPlus className="h-4 w-4" />
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
  const [f, setF] = useState<Partial<Event>>(initial ?? { name: "", year: new Date().getFullYear(), location: "", event_category: types[0] ?? "", event_date: "", status: statuses[0] ?? "Planning", notes: "", visibility: "private", currency: "LKR", timezone: "Asia/Colombo" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "New"} event</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Event name</Label><Input value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} required placeholder="e.g. Annual Event 2026" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Year</Label><Input type="number" value={f.year ?? new Date().getFullYear()} onChange={e => setF({ ...f, year: Number(e.target.value) })} required /></div>
          <div><Label>Event date</Label><Input type="date" value={f.event_date ?? ""} onChange={e => setF({ ...f, event_date: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={f.location ?? ""} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          <div><Label>Event category</Label>
            <Select value={f.event_category ?? ""} onValueChange={v => setF({ ...f, event_category: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status ?? "Planning"} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Currency</Label>
            <Select value={(f as any).currency ?? "LKR"} onValueChange={v => setF({ ...f, currency: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LKR","USD","EUR","GBP","INR","AUD","CAD","JPY","SGD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Visibility</Label>
            <Select value={(f as any).visibility ?? (f.is_public ? "public" : "private")} onValueChange={v => setF({ ...f, visibility: v as any, is_public: v === "public" } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — anyone signed in can view</SelectItem>
                <SelectItem value="internal">Internal — admins only for now</SelectItem>
                <SelectItem value="private">Private — admins only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}