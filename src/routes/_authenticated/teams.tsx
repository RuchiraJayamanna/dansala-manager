import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, FileSpreadsheet, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Teams — Dansala Manager" }] }),
  component: TeamsPage,
});

type M = { id: string; name: string; department: string | null; phase: string; team_name: string; role: string | null; contact: string | null; attended: boolean; staff_id: string | null };
type Staff = { id: string; name: string; department: string | null; contact: string | null };

function TeamsPage() {
  const qc = useQueryClient();
  const { data: phaseOpts = [] } = useMasterOptions("phase");
  const { data: teamOpts = [] } = useMasterOptions("team_group");
  const { data: roleOpts = [] } = useMasterOptions("member_role");
  const PHASES = phaseOpts.map(p => p.value);
  const TEAMS = teamOpts.map(t => t.value);
  const ROLES = roleOpts.map(r => r.value);

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id,name,department,contact").eq("active", true).order("name");
      if (error) throw error;
      return data as Staff[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("phase").order("team_name").order("name");
      if (error) throw error;
      return data as M[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<M | null>(null);

  const save = useMutation({
    mutationFn: async (v: Partial<M>) => {
      if (editing) {
        const { error } = await supabase.from("team_members").update(v).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_members").insert({ name: v.name || "", team_name: v.team_name || "Team", phase: v.phase || "Preparation", department: v.department, role: v.role, contact: v.contact, staff_id: v.staff_id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("team_members").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });

  const handleXlsx = () => {
    const sheets = PHASES.map(p => ({
      name: p,
      rows: [[`${p} — team assignments`], [], ["Name", "Department", "Team", "Role", "Contact", "Attended"],
        ...members.filter(m => m.phase === p).map(m => [m.name, m.department, m.team_name, m.role, m.contact, m.attended ? "Yes" : "No"])],
    }));
    exportXlsx("MISL_Dansala_Teams", sheets.length ? sheets : [{ name: "Teams", rows: [["No data"]] }]);
  };
  const handlePdf = () => {
    exportPdf("MISL_Dansala_Teams", "MISL Dansala 2026 — Teams & Assignments",
      PHASES.map(p => ({ title: p, head: ["Name", "Dept", "Team", "Role", "Contact"],
        body: members.filter(m => m.phase === p).map(m => [m.name, m.department ?? "—", m.team_name, m.role ?? "—", m.contact ?? "—"]) })),
      `${members.length} members assigned`);
  };

  const toggle = useMutation({
    mutationFn: async ({ id, attended }: { id: string; attended: boolean }) => {
      const { error } = await supabase.from("team_members").update({ attended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Teams & Assignments" subtitle="Organize members across preparation and dansala-day duties"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />Assign member</Button></DialogTrigger>
              <MemberDialog initial={editing} staff={staffList} phases={PHASES} teams={TEAMS} roles={ROLES} onSubmit={(v) => save.mutate(v)} />
            </Dialog>
          </div>
        } />

      <Tabs defaultValue={PHASES[0] ?? "Preparation"}>
        <TabsList>{PHASES.map(p => <TabsTrigger key={p} value={p}>{p}</TabsTrigger>)}</TabsList>
        {PHASES.map(phase => (
          <TabsContent key={phase} value={phase} className="space-y-4 pt-4">
            <PhaseView phase={phase} members={members.filter(m => m.phase === phase)}
              onEdit={(m) => { setEditing(m); setOpen(true); }}
              onDelete={(id) => del.mutate(id)}
              onToggle={(id, attended) => toggle.mutate({ id, attended })} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PhaseView({ phase, members, onEdit, onDelete, onToggle }: {
  phase: string; members: M[]; onEdit: (m: M) => void; onDelete: (id: string) => void; onToggle: (id: string, a: boolean) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, M[]> = {};
    members.forEach(m => { (g[m.team_name] ??= []).push(m); });
    return g;
  }, [members]);

  if (members.length === 0) return <div className="text-muted-foreground">No members in {phase} yet.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(grouped).map(([team, list]) => (
        <Card key={team}>
          <CardHeader className="pb-3"><CardTitle className="text-base">{team} <span className="text-muted-foreground font-normal text-sm">· {list.length}</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                <Checkbox checked={m.attended} onCheckedChange={(c) => onToggle(m.id, !!c)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name} {m.role && <span className="text-xs text-muted-foreground">· {m.role}</span>}</div>
                  <div className="text-xs text-muted-foreground">{m.department}{m.contact ? ` · ${m.contact}` : ""}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MemberDialog({ initial, staff, phases, teams, roles, onSubmit }: { initial: M | null; staff: Staff[]; phases: string[]; teams: string[]; roles: string[]; onSubmit: (v: Partial<M>) => void }) {
  const [f, setF] = useState<Partial<M>>(initial ?? { name: "", department: "", phase: phases[0] ?? "Preparation", team_name: teams[0] ?? "", role: roles[0] ?? "Member", contact: "", staff_id: null });

  const pickStaff = (id: string) => {
    const s = staff.find(x => x.id === id);
    if (!s) return;
    setF({ ...f, staff_id: s.id, name: s.name, department: s.department ?? "", contact: s.contact ?? "" });
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit assignment" : "Assign member to team"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        {!initial && (
          <div><Label>Pick from staff master</Label>
            <Select value={f.staff_id ?? ""} onValueChange={pickStaff}>
              <SelectTrigger><SelectValue placeholder={staff.length ? "Select staff…" : "No staff yet — add via Staff page"} /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} required /></div>
          <div><Label>Department</Label><Input value={f.department ?? ""} onChange={e => setF({ ...f, department: e.target.value })} placeholder="ENG / SOL" /></div>
          <div><Label>Phase</Label>
            <Select value={f.phase} onValueChange={v => setF({ ...f, phase: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{phases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Team</Label>
            <Select value={f.team_name ?? ""} onValueChange={v => setF({ ...f, team_name: v })}>
              <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Role</Label>
            <Select value={f.role ?? ""} onValueChange={v => setF({ ...f, role: v })}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Contact</Label><Input value={f.contact ?? ""} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="Phone / email" /></div>
        </div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}