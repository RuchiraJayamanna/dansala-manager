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
import { Plus, Trash2, Pencil, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { lkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Dansala Manager" }] }),
  component: BudgetPage,
});

type Item = {
  id: string; category: string; item: string;
  planned_qty: number | null; planned_unit_price: number | null;
  planned_amount: number; actual_note: string | null; actual_amount: number; sort_order: number;
};

function BudgetPage() {
  const qc = useQueryClient();
  const { data: catOpts = [] } = useMasterOptions("budget_category");
  const CATEGORIES = catOpts.map(c => c.value);
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

  // Group by category for clean summary
  const byCat = items.reduce((acc: Record<string, { p: number; a: number; rows: Item[] }>, i) => {
    const c = i.category || "General";
    acc[c] ??= { p: 0, a: 0, rows: [] };
    acc[c].p += Number(i.planned_amount || 0);
    acc[c].a += Number(i.actual_amount || 0);
    acc[c].rows.push(i);
    return acc;
  }, {});

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

  const handleXlsx = () => {
    const sheets: { name: string; rows: any[][] }[] = [];
    // Clean summary sheet
    const summary: any[][] = [
      ["MISL Dansala 2026 — Budget Summary"],
      [`Generated ${new Date().toLocaleString()}`],
      [],
      ["Category", "Planned (Rs.)", "Actual (Rs.)", "Variance (Rs.)"],
      ...Object.entries(byCat).map(([c, v]) => [c, v.p, v.a, v.p - v.a]),
      [],
      ["TOTAL", planned, actual, variance],
    ];
    sheets.push({ name: "Summary", rows: summary });
    // Per-category sheets like the original Excel
    for (const [c, v] of Object.entries(byCat)) {
      const rows: any[][] = [
        [`${c} — line items`], [],
        ["Item", "Planned (Rs.)", "Actual note", "Actual (Rs.)", "Variance (Rs.)"],
        ...v.rows.map(r => [r.item, Number(r.planned_amount), r.actual_note ?? "", Number(r.actual_amount), Number(r.planned_amount) - Number(r.actual_amount)]),
        [], ["Subtotal", v.p, "", v.a, v.p - v.a],
      ];
      sheets.push({ name: c, rows });
    }
    // Full detail
    sheets.push({
      name: "All items",
      rows: [["Category", "Item", "Planned (Rs.)", "Actual note", "Actual (Rs.)", "Variance (Rs.)"],
        ...items.map(i => [i.category, i.item, Number(i.planned_amount), i.actual_note ?? "", Number(i.actual_amount), Number(i.planned_amount) - Number(i.actual_amount)]),
        [], ["TOTAL", "", planned, "", actual, variance]],
    });
    exportXlsx("MISL_Dansala_Budget", sheets);
  };

  const handlePdf = () => {
    exportPdf("MISL_Dansala_Budget", "MISL Dansala 2026 — Budget Report", [
      { title: "Summary by Category",
        head: ["Category", "Planned (Rs.)", "Actual (Rs.)", "Variance (Rs.)"],
        body: Object.entries(byCat).map(([c, v]) => [c, lkr(v.p), lkr(v.a), lkr(v.p - v.a)]),
        foot: [["TOTAL", lkr(planned), lkr(actual), lkr(variance)]] },
      { title: "All line items",
        head: ["Category", "Item", "Planned", "Actual", "Variance"],
        body: items.map(i => [i.category, i.item, lkr(Number(i.planned_amount)), lkr(Number(i.actual_amount)), lkr(Number(i.planned_amount) - Number(i.actual_amount))]) },
    ], `Planned ${lkr(planned)} · Actual ${lkr(actual)} · Variance ${lkr(variance)}`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Budget" subtitle="Planned vs actual spend with live variance"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add item</Button></DialogTrigger>
              <ItemDialog initial={editing} categories={CATEGORIES} onSubmit={(v) => save.mutate(v)} />
            </Dialog>
          </div>
        } />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Planned</div><div className="text-2xl font-semibold">{lkr(planned)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Actual</div><div className="text-2xl font-semibold">{lkr(actual)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Variance</div><div className={`text-2xl font-semibold ${variance < 0 ? "text-destructive" : "text-emerald-600"}`}>{lkr(variance)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold mb-3">Summary by category</div>
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Planned</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(byCat).map(([c, v]) => (
                <TableRow key={c}>
                  <TableCell className="font-medium">{c}</TableCell>
                  <TableCell className="text-right">{lkr(v.p)}</TableCell>
                  <TableCell className="text-right">{lkr(v.a)}</TableCell>
                  <TableCell className={`text-right ${v.p - v.a < 0 ? "text-destructive" : "text-emerald-600"}`}>{lkr(v.p - v.a)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

function ItemDialog({ initial, categories, onSubmit }: { initial: Item | null; categories: string[]; onSubmit: (v: Partial<Item>) => void }) {
  const [form, setForm] = useState<Partial<Item>>(initial ?? { category: "General", item: "", planned_amount: 0, actual_amount: 0, actual_note: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} budget item</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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