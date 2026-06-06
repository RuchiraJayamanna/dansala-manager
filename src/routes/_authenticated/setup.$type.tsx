import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/lib/use-is-admin";

const TYPE_LABELS: Record<string, string> = {
  budget_category: "Budget Categories",
  team_group: "Team Groups",
  department: "Departments",
  designation: "Designations",
  dansala_type: "Dansala Types",
  unit: "Units of Measure",
  phase: "Event Phases",
  member_role: "Member Roles",
  checklist_status: "Checklist Statuses",
  contribution_status: "Contribution Statuses",
  contribution_team: "Contribution Teams",
  event_status: "Event Statuses",
};

export const Route = createFileRoute("/_authenticated/setup/$type")({
  head: () => ({ meta: [{ title: "Setup — Dansala Management System" }] }),
  component: SetupPage,
});

type Opt = { id: string; option_type: string; value: string; sort_order: number; active: boolean };

function SetupPage() {
  const { type } = useParams({ from: "/_authenticated/setup/$type" });
  const label = TYPE_LABELS[type] ?? type;
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [newVal, setNewVal] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["setup", type],
    queryFn: async () => (await supabase.from("master_options").select("*").eq("option_type", type).order("sort_order")).data as Opt[] ?? [],
  });

  const add = useMutation({
    mutationFn: async (value: string) => {
      const max = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
      const { error } = await supabase.from("master_options").insert({ option_type: type, value, sort_order: max + 1, active: true });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setup", type] }); qc.invalidateQueries({ queryKey: ["master", type] }); setNewVal(""); toast.success("Added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("master_options").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setup", type] }); qc.invalidateQueries({ queryKey: ["master", type] }); setEditId(null); toast.success("Updated"); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("master_options").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["setup", type] }); qc.invalidateQueries({ queryKey: ["master", type] }); },
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <PageHeader title={label} subtitle="Manage dropdown values used across the system." />

      {isAdmin && (
        <Card><CardContent className="p-4 flex gap-2">
          <Input placeholder={`Add new ${label.toLowerCase().slice(0, -1)}…`} value={newVal} onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newVal.trim()) add.mutate(newVal.trim()); }} />
          <Button onClick={() => newVal.trim() && add.mutate(newVal.trim())}><Plus className="h-4 w-4 mr-2" />Add</Button>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Value</TableHead>{isAdmin && <TableHead className="w-32"></TableHead>}</TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  {editId === r.id
                    ? <Input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") update.mutate({ id: r.id, value: editVal }); if (e.key === "Escape") setEditId(null); }} />
                    : <span className="font-medium">{r.value}</span>}
                </TableCell>
                {isAdmin && <TableCell className="text-right">
                  {editId === r.id ? (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: r.id, value: editVal })}><Save className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setEditVal(r.value); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </TableCell>}
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-muted-foreground py-8">No values yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}