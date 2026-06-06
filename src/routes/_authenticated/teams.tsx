import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useMasterOptions } from "@/lib/master";
import { exportXlsx, exportPdf } from "@/lib/export";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Teams — Dansala Management System" }] }),
  component: TeamsPage,
});

type M = { id: string; event_id: string; name: string; department: string | null; phase: string; team_name: string; role: string | null; contact: string | null; attended: boolean; staff_id: string | null };
type Staff = { id: string; name: string; department: string | null; contact: string | null };

function TeamsPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const { data: phaseOpts = [] } = useMasterOptions("phase");
  const { data: teamOpts = [] } = useMasterOptions("team_group");
  const { data: roleOpts = [] } = useMasterOptions("member_role");
  const PHASES = phaseOpts.length ? phaseOpts.map(p => p.value) : ["Preparation", "Dansala Day"];
  const TEAMS = teamOpts.map(t => t.value);
  const ROLES = roleOpts.map(r => r.value);

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => (await supabase.from("staff").select("id,name,department,contact").eq("active", true).order("name")).data as Staff[] ?? [],
  });
  const staffMap = new Map(staffList.map(s => [s.id, s]));

  const { data: members = [] } = useQuery({
    queryKey: ["members", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").eq("event_id", eventId!).order("phase").order("team_name");
      if (error) throw error;
      return data as M[];
    },
  });

  // Always resolve display name from staff master if linked, so renames propagate
  const displayName = (m: M) => m.staff_id ? (staffMap.get(m.staff_id)?.name ?? m.name) : m.name;
  const displayDept = (m: M) => m.staff_id ? (staffMap.get(m.staff_id)?.department ?? m.department) : m.department;
  const displayContact = (m: M) => m.staff_id ? (staffMap.get(m.staff_id)?.contact ?? m.contact) : m.contact;

  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (v: Partial<M>) => {
      const s = v.staff_id ? staffMap.get(v.staff_id) : undefined;
      const { error } = await supabase.from("team_members").insert({
        event_id: eventId!,
        name: s?.name ?? v.name ?? "",
        team_name: v.team_name || "Team",
        phase: v.phase || PHASES[0],
        department: s?.department ?? v.department ?? null,
        role: v.role ?? null,
        contact: s?.contact ?? v.contact ?? null,
        staff_id: v.staff_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dash"] }); setOpen(false); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("team_members").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, attended }: { id: string; attended: boolean }) => {
      const { error } = await supabase.from("team_members").update({ attended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });

  const handleXlsx = () => {
    const sheets = PHASES.map(p => ({
      name: p.slice(0, 31),
      rows: [[`${event?.name} — ${p}`], [], ["Name", "Department", "Team", "Role", "Contact", "Attended"],
        ...members.filter(m => m.phase === p).map(m => [displayName(m), displayDept(m), m.team_name, m.role, displayContact(m), m.attended ? "Yes" : "No"])],
    }));
    exportXlsx(`${event?.name}_Teams`.replace(/\s+/g, "_"), sheets.length ? sheets : [{ name: "Teams", rows: [["No data"]] }]);
  };
  const handlePdf = () => {
    exportPdf(`${event?.name}_Teams`.replace(/\s+/g, "_"), `${event?.name} — Teams & Assignments`,
      PHASES.map(p => ({ title: p, head: ["Name", "Dept", "Team", "Role", "Contact"],
        body: members.filter(m => m.phase === p).map(m => [displayName(m), displayDept(m) ?? "—", m.team_name, m.role ?? "—", displayContact(m) ?? "—"]) })),
      `${members.length} members assigned`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Teams & Assignments" subtitle={`${event.name} · members across phases`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Assign member</Button></DialogTrigger>
                <MemberDialog staff={staffList} phases={PHASES} teams={TEAMS} roles={ROLES} onSubmit={(v) => save.mutate(v)} />
              </Dialog>
            )}
          </div>
        } />

      <Tabs defaultValue={PHASES[0] ?? "Preparation"}>
        <TabsList>{PHASES.map(p => <TabsTrigger key={p} value={p}>{p}</TabsTrigger>)}</TabsList>
        {PHASES.map(phase => (
          <TabsContent key={phase} value={phase} className="space-y-4 pt-4">
            <PhaseView phase={phase} members={members.filter(m => m.phase === phase)} isAdmin={isAdmin}
              displayName={displayName} displayDept={displayDept} displayContact={displayContact}
              onDelete={(id) => del.mutate(id)} onToggle={(id, a) => toggle.mutate({ id, attended: a })} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PhaseView({ phase, members, isAdmin, displayName, displayDept, displayContact, onDelete, onToggle }: {
  phase: string; members: M[]; isAdmin: boolean;
  displayName: (m: M) => string; displayDept: (m: M) => string | null | undefined; displayContact: (m: M) => string | null | undefined;
  onDelete: (id: string) => void; onToggle: (id: string, a: boolean) => void;
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
                <Checkbox checked={m.attended} disabled={!isAdmin} onCheckedChange={(c) => onToggle(m.id, !!c)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{displayName(m)} {m.role && <span className="text-xs text-muted-foreground">· {m.role}</span>}</div>
                  <div className="text-xs text-muted-foreground">{displayDept(m)}{displayContact(m) ? ` · ${displayContact(m)}` : ""}</div>
                </div>
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MemberDialog({ staff, phases, teams, roles, onSubmit }: { staff: Staff[]; phases: string[]; teams: string[]; roles: string[]; onSubmit: (v: Partial<M>) => void }) {
  const [f, setF] = useState<Partial<M>>({ staff_id: null, phase: phases[0], team_name: teams[0] ?? "", role: roles[0] ?? "Member" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Assign staff to team</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Staff member</Label>
          <Select value={f.staff_id ?? ""} onValueChange={(v) => setF({ ...f, staff_id: v })}>
            <SelectTrigger><SelectValue placeholder={staff.length ? "Select staff…" : "Add staff first"} /></SelectTrigger>
            <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div className="col-span-2"><Label>Role</Label>
            <Select value={f.role ?? ""} onValueChange={v => setF({ ...f, role: v })}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button type="submit" disabled={!f.staff_id || !f.team_name}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}