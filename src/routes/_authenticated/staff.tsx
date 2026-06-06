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
import { Plus, Pencil, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — Dansala Management System" }] }),
  component: StaffPage,
});

type S = { id: string; name: string; employee_no: string | null; department: string | null; designation: string | null; contact: string | null; email: string | null; active: boolean };

function StaffPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { data: depts = [] } = useMasterOptions("department");
  const { data: designations = [] } = useMasterOptions("designation");

  const { data: rows = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => (await supabase.from("staff").select("*").order("name")).data as S[] ?? [],
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<S | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<S>) => {
      if (editing) {
        const { error } = await supabase.from("staff").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert({ name: v.name || "", employee_no: v.employee_no, department: v.department, designation: v.designation, contact: v.contact, email: v.email, active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); qc.invalidateQueries({ queryKey: ["staff_list"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("staff").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleXlsx = () => {
    exportXlsx("Staff_Master", [{ name: "Staff", rows: [["Staff Master"], [`Total ${rows.length}`], [],
      ["Name", "Employee No", "Department", "Designation", "Contact", "Email"],
      ...rows.map(r => [r.name, r.employee_no, r.department, r.designation, r.contact, r.email])]}]);
  };
  const handlePdf = () => {
    exportPdf("Staff_Master", "Staff Master", [{
      head: ["Name", "Emp No", "Dept", "Designation", "Contact", "Email"],
      body: rows.map(r => [r.name, r.employee_no ?? "—", r.department ?? "—", r.designation ?? "—", r.contact ?? "—", r.email ?? "—"]),
    }], `Total ${rows.length} staff members`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Staff" subtitle="Central staff master — used across all events. Renaming here propagates everywhere."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Add staff</Button></DialogTrigger>
                <StaffDialog initial={editing} departments={depts.map(d => d.value)} designations={designations.map(d => d.value)} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Emp No</TableHead><TableHead>Department</TableHead>
              <TableHead>Designation</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.employee_no ?? "—"}</TableCell>
                  <TableCell>{r.department ?? "—"}</TableCell>
                  <TableCell>{r.designation ?? "—"}</TableCell>
                  <TableCell>{r.contact ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email ?? "—"}</TableCell>
                  {isAdmin && <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">No staff yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffDialog({ initial, departments, designations, onSubmit }: { initial: S | null; departments: string[]; designations: string[]; onSubmit: (v: Partial<S>) => void }) {
  const [f, setF] = useState<Partial<S>>(initial ?? { name: "", employee_no: "", department: "", designation: "", contact: "", email: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit" : "Add"} staff</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} required /></div>
          <div><Label>Employee No</Label><Input value={f.employee_no ?? ""} onChange={e => setF({ ...f, employee_no: e.target.value })} /></div>
          <div><Label>Department</Label>
            <Select value={f.department ?? ""} onValueChange={v => setF({ ...f, department: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Designation</Label>
            <Select value={f.designation ?? ""} onValueChange={v => setF({ ...f, designation: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{designations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Contact</Label><Input value={f.contact ?? ""} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}