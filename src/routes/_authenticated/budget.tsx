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
import { Plus, Trash2, Pencil, FileSpreadsheet, FileText, Upload, Paperclip, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { lkr } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Dansala Management System" }] }),
  component: BudgetPage,
});

type Item = {
  id: string; event_id: string; category: string; item: string; unit: string | null;
  planned_qty: number | null; planned_unit_price: number | null; planned_amount: number;
  actual_qty: number | null; actual_unit_price: number | null; actual_amount: number;
  actual_note: string | null; sort_order: number;
};
type Receipt = { id: string; budget_item_id: string; file_path: string; file_name: string };

function BudgetPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const { data: catOpts = [] } = useMasterOptions("budget_category");
  const { data: unitOpts = [] } = useMasterOptions("unit");
  const CATEGORIES = catOpts.map(c => c.value);
  const UNITS = unitOpts.map(u => u.value);

  const { data: items = [] } = useQuery({
    queryKey: ["budget", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_items").select("*").eq("event_id", eventId!).order("category").order("sort_order");
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["receipts", eventId],
    enabled: !!eventId && items.length > 0,
    queryFn: async () => {
      const ids = items.map(i => i.id);
      const { data, error } = await supabase.from("budget_receipts").select("*").in("budget_item_id", ids);
      if (error) throw error;
      return data as Receipt[];
    },
  });

  const planned = items.reduce((s, i) => s + Number(i.planned_amount || 0), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual_amount || 0), 0);
  const variance = planned - actual;

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
      const pq = Number(v.planned_qty ?? 0), pu = Number(v.planned_unit_price ?? 0);
      const aq = Number(v.actual_qty ?? 0), au = Number(v.actual_unit_price ?? 0);
      const payload = {
        category: v.category || "General", item: v.item || "",
        unit: v.unit ?? null,
        planned_qty: pq || null, planned_unit_price: pu || null,
        planned_amount: pq && pu ? pq * pu : Number(v.planned_amount ?? 0),
        actual_qty: aq || null, actual_unit_price: au || null,
        actual_amount: aq && au ? aq * au : Number(v.actual_amount ?? 0),
        actual_note: v.actual_note ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("budget_items").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_items").insert({ ...payload, event_id: eventId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("budget_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget"] }); qc.invalidateQueries({ queryKey: ["dash"] }); toast.success("Removed"); },
  });

  const handleXlsx = (mode: "estimate" | "full") => {
    const sheets: { name: string; rows: any[][] }[] = [];
    const evtLabel = `${event?.name ?? ""}`;
    if (mode === "estimate") {
      sheets.push({ name: "Estimation", rows: [
        [`${evtLabel} — Budget Estimation`], [`Generated ${new Date().toLocaleString()}`], [],
        ["Category", "Item", "Qty", "Unit", "Unit Price (Rs.)", "Estimated (Rs.)"],
        ...items.map(i => [i.category, i.item, i.planned_qty ?? "", i.unit ?? "", i.planned_unit_price ?? "", Number(i.planned_amount)]),
        [], ["TOTAL ESTIMATED", "", "", "", "", planned],
      ]});
    } else {
      sheets.push({ name: "Summary", rows: [
        [`${evtLabel} — Budget Summary`], [`Generated ${new Date().toLocaleString()}`], [],
        ["Category", "Planned (Rs.)", "Actual (Rs.)", "Variance (Rs.)"],
        ...Object.entries(byCat).map(([c, v]) => [c, v.p, v.a, v.p - v.a]),
        [], ["TOTAL", planned, actual, variance],
      ]});
      for (const [c, v] of Object.entries(byCat)) {
        sheets.push({ name: c.slice(0, 31), rows: [
          [`${c} — line items`], [],
          ["Item", "Qty", "Unit", "Unit Price", "Planned (Rs.)", "Actual Qty", "Actual Price", "Actual (Rs.)", "Variance"],
          ...v.rows.map(r => [r.item, r.planned_qty ?? "", r.unit ?? "", r.planned_unit_price ?? "", Number(r.planned_amount), r.actual_qty ?? "", r.actual_unit_price ?? "", Number(r.actual_amount), Number(r.planned_amount) - Number(r.actual_amount)]),
          [], ["Subtotal", "", "", "", v.p, "", "", v.a, v.p - v.a],
        ]});
      }
    }
    exportXlsx(`${evtLabel}_Budget_${mode}`.replace(/\s+/g, "_"), sheets);
  };

  const handlePdf = (mode: "estimate" | "full") => {
    const title = `${event?.name} — Budget ${mode === "estimate" ? "Estimation" : "Report"}`;
    if (mode === "estimate") {
      exportPdf(`${event?.name}_Budget_Estimation`.replace(/\s+/g, "_"), title, [{
        head: ["Category", "Item", "Qty", "Unit", "Unit Price", "Estimated"],
        body: items.map(i => [i.category, i.item, i.planned_qty ?? "—", i.unit ?? "—", i.planned_unit_price ? lkr(Number(i.planned_unit_price)) : "—", lkr(Number(i.planned_amount))]),
        foot: [["", "", "", "", "TOTAL", lkr(planned)]],
      }], `Estimated total: ${lkr(planned)}`);
    } else {
      exportPdf(`${event?.name}_Budget_Full`.replace(/\s+/g, "_"), title, [
        { title: "Summary by Category", head: ["Category", "Planned", "Actual", "Variance"],
          body: Object.entries(byCat).map(([c, v]) => [c, lkr(v.p), lkr(v.a), lkr(v.p - v.a)]),
          foot: [["TOTAL", lkr(planned), lkr(actual), lkr(variance)]] },
        { title: "All line items", head: ["Category", "Item", "Planned", "Actual", "Variance"],
          body: items.map(i => [i.category, i.item, lkr(Number(i.planned_amount)), lkr(Number(i.actual_amount)), lkr(Number(i.planned_amount) - Number(i.actual_amount))]) },
      ], `Planned ${lkr(planned)} · Actual ${lkr(actual)} · Variance ${lkr(variance)}`);
    }
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      <PageHeader title="Budget" subtitle={`${event.name} · planned vs actual with live variance`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Select onValueChange={(v) => { if (v === "est_x") handleXlsx("estimate"); if (v === "full_x") handleXlsx("full"); if (v === "est_p") handlePdf("estimate"); if (v === "full_p") handlePdf("full"); }}>
              <SelectTrigger className="w-44"><FileSpreadsheet className="h-4 w-4 mr-2" /><SelectValue placeholder="Export…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="est_x">Estimation · Excel</SelectItem>
                <SelectItem value="full_x">Full Budget · Excel</SelectItem>
                <SelectItem value="est_p">Estimation · PDF</SelectItem>
                <SelectItem value="full_p">Full Budget · PDF</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add item</Button></DialogTrigger>
                <ItemDialog key={editing?.id ?? "new"} initial={editing} categories={CATEGORIES} units={UNITS} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
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
                <TableHead>Category</TableHead><TableHead>Item</TableHead>
                <TableHead className="text-right">Qty × Rate</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Receipts</TableHead>
                {isAdmin && <TableHead className="w-32"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => {
                const v = Number(i.planned_amount) - Number(i.actual_amount);
                const myReceipts = receipts.filter(r => r.budget_item_id === i.id);
                return (
                  <TableRow key={i.id}>
                    <TableCell><span className="text-xs px-2 py-1 rounded bg-muted">{i.category}</span></TableCell>
                    <TableCell className="font-medium">{i.item}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {i.planned_qty && i.planned_unit_price ? `${i.planned_qty} ${i.unit ?? ""} × ${lkr(Number(i.planned_unit_price))}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">{lkr(Number(i.planned_amount))}</TableCell>
                    <TableCell className="text-right">{lkr(Number(i.actual_amount))}</TableCell>
                    <TableCell className={`text-right ${v < 0 ? "text-destructive" : "text-emerald-600"}`}>{lkr(v)}</TableCell>
                    <TableCell><ReceiptCell itemId={i.id} receipts={myReceipts} isAdmin={isAdmin} /></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">No items yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReceiptCell({ itemId, receipts, isAdmin }: { itemId: string; receipts: Receipt[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${itemId}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("receipts").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("budget_receipts").insert({ budget_item_id: itemId, file_path: path, file_name: file.name });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); toast.success("Uploaded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (r: Receipt) => {
      await supabase.storage.from("receipts").remove([r.file_path]);
      await supabase.from("budget_receipts").delete().eq("id", r.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });

  const open = async (r: Receipt) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(r.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {receipts.map(r => (
        <span key={r.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
          <button onClick={() => open(r)} className="hover:underline flex items-center gap-1"><Paperclip className="h-3 w-3" />{r.file_name.slice(0, 18)}</button>
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

function ItemDialog({ initial, categories, units, onSubmit }: { initial: Item | null; categories: string[]; units: string[]; onSubmit: (v: Partial<Item>) => void }) {
  const [form, setForm] = useState<Partial<Item>>(initial ?? { category: categories[0] ?? "General", item: "", unit: units[0] ?? "", planned_qty: 0, planned_unit_price: 0, planned_amount: 0, actual_qty: 0, actual_unit_price: 0, actual_amount: 0 });
  const pq = Number(form.planned_qty || 0), pu = Number(form.planned_unit_price || 0);
  const aq = Number(form.actual_qty || 0), au = Number(form.actual_unit_price || 0);
  const computedP = pq * pu, computedA = aq * au;
  return (
    <DialogContent className="max-w-2xl">
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
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-medium">Planned (estimation)</div>
          <div className="grid grid-cols-4 gap-2">
            <div><Label className="text-xs">Quantity</Label><Input type="number" step="0.01" value={form.planned_qty ?? 0} onChange={e => setForm({ ...form, planned_qty: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={form.unit ?? ""} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Rate / unit (Rs.)</Label><Input type="number" step="0.01" value={form.planned_unit_price ?? 0} onChange={e => setForm({ ...form, planned_unit_price: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Estimated total</Label><Input readOnly value={computedP.toFixed(2)} className="bg-muted" /></div>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-medium">Actual (after purchase)</div>
          <div className="grid grid-cols-4 gap-2">
            <div><Label className="text-xs">Actual qty</Label><Input type="number" step="0.01" value={form.actual_qty ?? 0} onChange={e => setForm({ ...form, actual_qty: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Unit</Label><Input readOnly value={form.unit ?? ""} className="bg-muted" /></div>
            <div><Label className="text-xs">Actual rate (Rs.)</Label><Input type="number" step="0.01" value={form.actual_unit_price ?? 0} onChange={e => setForm({ ...form, actual_unit_price: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Actual total</Label><Input readOnly value={computedA.toFixed(2)} className="bg-muted" /></div>
          </div>
          <div><Label className="text-xs">Note</Label><Input value={form.actual_note ?? ""} onChange={e => setForm({ ...form, actual_note: e.target.value })} placeholder="e.g. Bought from XYZ supplier" /></div>
        </div>

        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}