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
import { PageHeader } from "@/components/PageHeader";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/items")({
  head: () => ({ meta: [{ title: "Item Checklist — Dansala Management System" }] }),
  component: ItemsPage,
});

type Row = { id: string; event_id: string; item_name: string; quantity: number; unit: string | null; responsible_staff_id: string | null; responsible_name: string | null; status: string; notes: string | null; sort_order: number };
type Staff = { id: string; name: string; department: string | null };

const STATUSES = ["Pending", "Arranged", "Received"];

function ItemsPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const { data: unitOpts = [] } = useMasterOptions("unit");
  const UNITS = unitOpts.map(u => u.value);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => (await supabase.from("staff").select("id,name,department").eq("active", true).order("name")).data as Staff[] ?? [],
  });
  const staffMap = new Map(staff.map(s => [s.id, s]));

  const { data: rows = [] } = useQuery({
    queryKey: ["items", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("item_checklist" as any).select("*").eq("event_id", eventId!).order("sort_order").order("item_name");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const responsibleOf = (r: Row) => r.responsible_staff_id ? (staffMap.get(r.responsible_staff_id)?.name ?? r.responsible_name ?? "—") : (r.responsible_name ?? "—");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<Row>) => {
      const payload: any = {
        item_name: v.item_name || "",
        quantity: Number(v.quantity ?? 0),
        unit: v.unit ?? null,
        responsible_staff_id: v.responsible_staff_id ?? null,
        responsible_name: v.responsible_staff_id ? (staffMap.get(v.responsible_staff_id)?.name ?? null) : (v.responsible_name ?? null),
        status: v.status || "Pending",
        notes: v.notes ?? null,
      };
      if (editing) {
        const { error } = await supabase.from("item_checklist" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("item_checklist" as any).insert({ ...payload, event_id: eventId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Partial<Row> }) => {
      const { error } = await supabase.from("item_checklist" as any).update(v as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("item_checklist" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); toast.success("Removed"); },
  });

  const totals = { total: rows.length, done: rows.filter(r => r.status === "Received").length };

  const handleXlsx = () => {
    exportXlsx(`${event?.name}_Item_Checklist`.replace(/\s+/g, "_"), [{
      name: "Items", rows: [
        [`${event?.name} — Item Checklist`], [`Generated ${new Date().toLocaleString()}`], [],
        ["Item", "Qty", "Unit", "Responsible", "Status", "Notes"],
        ...rows.map(r => [r.item_name, r.quantity, r.unit ?? "", responsibleOf(r), r.status, r.notes ?? ""]),
      ],
    }]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Item_Checklist`.replace(/\s+/g, "_"), `${event?.name} — Item Checklist`, [{
      head: ["Item", "Qty", "Unit", "Responsible", "Status", "Notes"],
      body: rows.map(r => [r.item_name, String(r.quantity), r.unit ?? "—", responsibleOf(r), r.status, r.notes ?? "—"]),
    }], `${totals.done} of ${totals.total} received`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Item Checklist" subtitle={`${event.name} · items needed (spoons, buckets, etc.) and who is bringing them`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add item</Button></DialogTrigger>
                <ItemDialog key={editing?.id ?? "new"} initial={editing} staff={staff} units={UNITS} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total items</div><div className="text-2xl font-semibold">{totals.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Received</div><div className="text-2xl font-semibold text-emerald-600">{totals.done}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-semibold text-amber-600">{totals.total - totals.done}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 max-h-[calc(100vh-16rem)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10"><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead>
              <TableHead>Responsible</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell>{r.unit ?? "—"}</TableCell>
                  <TableCell>{responsibleOf(r)}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, v: { status: v } })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : r.status}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.notes ?? "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">No items yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemDialog({ initial, staff, units, onSubmit }: { initial: Row | null; staff: Staff[]; units: string[]; onSubmit: (v: Partial<Row>) => void }) {
  const [f, setF] = useState<Partial<Row>>(initial ?? { item_name: "", quantity: 1, unit: units[0] ?? "", responsible_staff_id: null, status: "Pending", notes: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} item</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Item name</Label><Input value={f.item_name ?? ""} onChange={e => setF({ ...f, item_name: e.target.value })} placeholder="e.g. Spoons, Buckets, Chairs" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Quantity</Label><Input type="number" value={f.quantity ?? 0} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} required /></div>
          <div><Label>Unit</Label>
            <Select value={f.unit ?? ""} onValueChange={v => setF({ ...f, unit: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Responsible (staff)</Label>
          <Select value={f.responsible_staff_id ?? ""} onValueChange={v => setF({ ...f, responsible_staff_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
            <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Notes</Label><Input value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}