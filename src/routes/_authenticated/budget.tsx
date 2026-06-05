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
import { Plus, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { lkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Dansala Manager" }] }),
  component: BudgetPage,
});

type Item = {
  id: string; category: string; item: string;
  planned_qty: number | null; planned_unit_price: number | null;
  planned_amount: number; actual_note: string | null; actual_amount: number; sort_order: number;
};

const CATEGORIES = ["Paste", "Bread", "Materials", "Team", "General"];

function BudgetPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["budget"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_items").select("*").order("sort_order");
      if (error) throw error;
      return data as Item[];
    },
  });

  const planned = items.reduce((s, i) => s + Number(i.planned_amount || 0), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual_amount || 0), 0);
  const variance = planned - actual;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<Item>) => {
      const payload = { ...v, planned_amount: Number(v.planned_amount || 0), actual_amount: Number(v.actual_amount || 0) };
      if (editing) {
        const { error } = await supabase.from("budget_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_items").insert({ ...payload, item: v.item || "", category: v.category || "General" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget"] }); qc.invalidateQueries({ queryKey: ["dash"] }); toast.success("Removed"); },
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Budget" subtitle="Planned vs actual spend with live variance"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add item</Button></DialogTrigger>
            <ItemDialog initial={editing} onSubmit={(v) => save.mutate(v)} />
          </Dialog>
        } />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Planned</div><div className="text-2xl font-semibold">{lkr(planned)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Actual</div><div className="text-2xl font-semibold">{lkr(actual)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Variance</div><div className={`text-2xl font-semibold ${variance < 0 ? "text-destructive" : "text-emerald-600"}`}>{lkr(variance)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead>Actual note</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const v = Number(i.planned_amount) - Number(i.actual_amount);
                return (
                  <TableRow key={i.id}>
                    <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{i.category}</span></TableCell>
                    <TableCell className="font-medium">{i.item}</TableCell>
                    <TableCell className="text-right">{lkr(Number(i.planned_amount))}</TableCell>
                    <TableCell className="text-muted-foreground">{i.actual_note}</TableCell>
                    <TableCell className="text-right">{lkr(Number(i.actual_amount))}</TableCell>
                    <TableCell className={`text-right ${v < 0 ? "text-destructive" : "text-emerald-600"}`}>{lkr(v)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No items yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemDialog({ initial, onSubmit }: { initial: Item | null; onSubmit: (v: Partial<Item>) => void }) {
  const [form, setForm] = useState<Partial<Item>>(initial ?? { category: "General", item: "", planned_amount: 0, actual_amount: 0, actual_note: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} budget item</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Item</Label><Input value={form.item ?? ""} onChange={e => setForm({ ...form, item: e.target.value })} required /></div>
          <div><Label>Planned amount (Rs.)</Label><Input type="number" step="0.01" value={form.planned_amount ?? 0} onChange={e => setForm({ ...form, planned_amount: Number(e.target.value) })} /></div>
          <div><Label>Actual amount (Rs.)</Label><Input type="number" step="0.01" value={form.actual_amount ?? 0} onChange={e => setForm({ ...form, actual_amount: Number(e.target.value) })} /></div>
          <div className="col-span-2"><Label>Actual note</Label><Input value={form.actual_note ?? ""} onChange={e => setForm({ ...form, actual_note: e.target.value })} placeholder="e.g. 13Kg @ Rs. 160" /></div>
        </div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}