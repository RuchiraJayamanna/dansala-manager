import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Event Templates — Event Manager" }] }),
  component: TemplatesPage,
});

type Tpl = {
  id: string;
  name: string;
  description: string | null;
  event_category: string | null;
  default_agenda: any;
  default_checklist: any;
  default_budget_categories: any;
};

function TemplatesPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["event_templates"],
    queryFn: async () => ((await supabase.from("event_templates" as any).select("*").order("name")).data as unknown as Tpl[]) ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Tpl>) => {
      const payload = {
        name: v.name ?? "",
        description: v.description ?? null,
        event_category: v.event_category ?? null,
        default_agenda: v.default_agenda ?? [],
        default_checklist: v.default_checklist ?? [],
        default_budget_categories: v.default_budget_categories ?? [],
      };
      if (editing) {
        const { error } = await supabase.from("event_templates" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_templates" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event_templates"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("event_templates" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event_templates"] }); toast.success("Deleted"); },
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Event templates" subtitle="Reusable skeletons of agenda, checklist and budget categories. Create a new event from any template in one click."
        action={isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New template</Button></DialogTrigger>
            <TemplateDialog key={editing?.id ?? "new"} initial={editing} onSubmit={(v) => save.mutate(v)} />
          </Dialog>
        )}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(t => (
          <Card key={t.id}>
            <CardContent className="p-5 space-y-2">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">{t.event_category ?? "General"}</div>
                  <div className="text-lg font-semibold">{t.name}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              <div className="text-xs text-muted-foreground pt-2">
                {(t.default_agenda?.length ?? 0)} agenda · {(t.default_checklist?.length ?? 0)} tasks · {(t.default_budget_categories?.length ?? 0)} budget categories
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="md:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">
            No templates yet. {isAdmin ? "Create one here or save an existing event as a template from the Events page." : "An admin must create one first."}
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

function TemplateDialog({ initial, onSubmit }: { initial: Tpl | null; onSubmit: (v: Partial<Tpl>) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.event_category ?? "");
  const [agenda, setAgenda] = useState((initial?.default_agenda ?? []).map((a: any) => a.title).join("\n"));
  const [checklist, setChecklist] = useState((initial?.default_checklist ?? []).map((c: any) => c.title).join("\n"));
  const [budgetCats, setBudgetCats] = useState((initial?.default_budget_categories ?? []).map((b: any) => typeof b === "string" ? b : b.category).join("\n"));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "New"} template</DialogTitle></DialogHeader>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name, description, event_category: category || null,
          default_agenda: agenda.split("\n").map((s: string) => s.trim()).filter(Boolean).map((title: string, i: number) => ({ title, sort_order: i })),
          default_checklist: checklist.split("\n").map((s: string) => s.trim()).filter(Boolean).map((title: string) => ({ title })),
          default_budget_categories: budgetCats.split("\n").map((s: string) => s.trim()).filter(Boolean),
        });
      }} className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
        <div><Label>Category (optional)</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Conference, Wedding…" /></div>
        <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><Label>Agenda items (one per line)</Label><Textarea rows={4} value={agenda} onChange={e => setAgenda(e.target.value)} /></div>
        <div><Label>Checklist tasks (one per line)</Label><Textarea rows={4} value={checklist} onChange={e => setChecklist(e.target.value)} /></div>
        <div><Label>Budget categories (one per line)</Label><Textarea rows={3} value={budgetCats} onChange={e => setBudgetCats(e.target.value)} /></div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
