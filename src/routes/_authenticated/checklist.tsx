import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/checklist")({
  head: () => ({ meta: [{ title: "Checklist — Dansala Manager" }] }),
  component: ChecklistPage,
});

type C = { id: string; title: string; owner: string | null; status: string; notes: string | null; due_date: string | null; sort_order: number };
const STATUSES = ["Pending", "In Progress", "Done", "Blocked"];

const statusColor: Record<string, string> = {
  "Pending": "bg-muted text-muted-foreground",
  "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Done": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Blocked": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function ChecklistPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["checklist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_items").select("*").order("sort_order");
      if (error) throw error;
      return data as C[];
    },
  });

  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: async (v: Partial<C>) => {
      const { error } = await supabase.from("checklist_items").insert({ title: v.title || "", owner: v.owner, status: v.status || "Pending", notes: v.notes, due_date: v.due_date || null });
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

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <PageHeader title="Operations checklist" subtitle={`${done} of ${items.length} complete`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add task</Button></DialogTrigger>
            <NewItemDialog onSubmit={(v) => save.mutate(v)} />
          </Dialog>
        } />

      <Card>
        <CardContent className="p-0 divide-y">
          {items.map(i => (
            <div key={i.id} className="p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground">
                  {i.owner ? `Owner: ${i.owner}` : "Unassigned"}{i.due_date ? ` · Due ${i.due_date}` : ""}{i.notes ? ` · ${i.notes}` : ""}
                </div>
              </div>
              <Input className="w-44" placeholder="Assign owner" defaultValue={i.owner ?? ""}
                onBlur={e => e.target.value !== (i.owner ?? "") && update.mutate({ id: i.id, v: { owner: e.target.value } })} />
              <Select value={i.status} onValueChange={(v) => update.mutate({ id: i.id, v: { status: v } })}>
                <SelectTrigger className={`w-36 ${statusColor[i.status]}`}><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {items.length === 0 && <div className="p-8 text-center text-muted-foreground">No tasks yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function NewItemDialog({ onSubmit }: { onSubmit: (v: Partial<C>) => void }) {
  const [f, setF] = useState<Partial<C>>({ title: "", owner: "", status: "Pending", notes: "", due_date: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New checklist task</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Title</Label><Input value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Owner</Label><Input value={f.owner ?? ""} onChange={e => setF({ ...f, owner: e.target.value })} /></div>
          <div><Label>Due date</Label><Input type="date" value={f.due_date ?? ""} onChange={e => setF({ ...f, due_date: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">Add</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}