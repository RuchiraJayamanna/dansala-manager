import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, FileSpreadsheet, FileText, StickyNote, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BulletNotes, notesToBullets } from "@/components/BulletNotes";
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
  const [addPhase, setAddPhase] = useState<string | null>(null);
  const [addTeam, setAddTeam] = useState<string | null>(null);

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

  const teamNotes = (event?.team_notes ?? {}) as Record<string, string>;
  const teamVenues = (event?.team_venues ?? {}) as Record<string, string>;
  const saveTeamNote = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const next = { ...teamNotes, [key]: value };
      const { error } = await supabase.from("events").update({ team_notes: next } as any).eq("id", eventId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Notes saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveTeamVenue = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const next = { ...teamVenues, [key]: value };
      const { error } = await supabase.from("events").update({ team_venues: next } as any).eq("id", eventId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Venue saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const teamsInPhase = (p: string) => {
    const set = new Set<string>();
    members.filter(m => m.phase === p).forEach(m => set.add(m.team_name));
    return Array.from(set);
  };

  const handleXlsx = () => {
    const sheets = PHASES.map(p => {
      const rows: any[][] = [[`${event?.name} — ${p}`], []];
      for (const team of teamsInPhase(p)) {
        const list = members.filter(m => m.phase === p && m.team_name === team);
        const key = `${p}::${team}`;
        const venue = teamVenues[key] ?? "";
        rows.push([team + (venue ? `  ·  Venue: ${venue}` : "")]);
        rows.push(["Name", "Department", "Role", "Contact", "Venue"]);
        list.forEach(m => rows.push([displayName(m), displayDept(m) ?? "", m.role ?? "", displayContact(m) ?? "", venue]));
        const notes = notesToBullets(teamNotes[key]);
        if (notes.length) {
          rows.push(["Important notes:"]);
          notes.forEach(n => rows.push([`• ${n}`]));
        }
        rows.push([]);
      }
      return { name: p.slice(0, 31), rows };
    });
    exportXlsx(`${event?.name}_Teams`.replace(/\s+/g, "_"), sheets.length ? sheets : [{ name: "Teams", rows: [["No data"]] }]);
  };

  const handlePdf = () => {
    const tables: any[] = [];
    for (const p of PHASES) {
      const teamsArr = teamsInPhase(p);
      teamsArr.forEach((team, idx) => {
        const list = members.filter(m => m.phase === p && m.team_name === team);
        const key = `${p}::${team}`;
        const venue = teamVenues[key] ?? "";
        const notes = notesToBullets(teamNotes[key]);
        tables.push({
          title: `${p} — ${team}${venue ? `  ·  Venue: ${venue}` : ""}`,
          newPage: idx === 0,
          notes,
          head: ["Name", "Dept", "Role", "Contact", "Venue"],
          body: list.map(m => [displayName(m), displayDept(m) ?? "—", m.role ?? "—", displayContact(m) ?? "—", venue || "—"]),
        });
      });
    }
    exportPdf(`${event?.name}_Teams`.replace(/\s+/g, "_"), `${event?.name} — Teams & Assignments`,
      tables.length ? tables : [{ head: ["Info"], body: [["No members yet"]] }],
      `${members.length} members assigned`);
  };

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      <PageHeader title="Teams & Assignments" subtitle={`${event.name} · members across phases`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-2" />PDF</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setAddPhase(null); setAddTeam(null); } }}>
                <DialogTrigger asChild><Button onClick={() => { setAddPhase(null); setAddTeam(null); }}><Plus className="h-4 w-4 mr-2" />Assign member</Button></DialogTrigger>
                <MemberDialog staff={staffList} members={members} phases={PHASES} teams={TEAMS} roles={ROLES}
                  initialPhase={addPhase} initialTeam={addTeam}
                  onSubmit={(v) => save.mutate(v)} />
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
              teamNotes={teamNotes} teamVenues={teamVenues}
              onSaveNote={(key, value) => saveTeamNote.mutate({ key, value })}
              onSaveVenue={(key, value) => saveTeamVenue.mutate({ key, value })}
              onDelete={(id) => del.mutate(id)}
              onAddToTeam={(p, t) => { setAddPhase(p); setAddTeam(t); setOpen(true); }} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PhaseView({ phase, members, isAdmin, displayName, displayDept, displayContact, teamNotes, teamVenues, onSaveNote, onSaveVenue, onDelete, onAddToTeam }: {
  phase: string; members: M[]; isAdmin: boolean;
  displayName: (m: M) => string; displayDept: (m: M) => string | null | undefined; displayContact: (m: M) => string | null | undefined;
  teamNotes: Record<string, string>; teamVenues: Record<string, string>;
  onSaveNote: (key: string, value: string) => void;
  onSaveVenue: (key: string, value: string) => void;
  onDelete: (id: string) => void; onAddToTeam: (phase: string, team: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, M[]> = {};
    members.forEach(m => { (g[m.team_name] ??= []).push(m); });
    return g;
  }, [members]);

  if (members.length === 0) return <div className="text-muted-foreground">No members in {phase} yet.</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 max-h-[calc(100vh-18rem)] overflow-y-auto pr-2">
      {Object.entries(grouped).map(([team, list]) => {
        const key = `${phase}::${team}`;
        return (
          <Card key={team}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{team} <span className="text-muted-foreground font-normal text-sm">· {list.length}</span></CardTitle>
              {isAdmin && <Button size="sm" variant="ghost" onClick={() => onAddToTeam(phase, team)}><Plus className="h-4 w-4" /></Button>}
            </CardHeader>
            <CardContent className="space-y-3">
              <VenueBlock noteKey={key} initial={teamVenues[key] ?? ""} isAdmin={isAdmin} onSave={onSaveVenue} />
              {list.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{displayName(m)} {m.role && <span className="text-xs text-muted-foreground">· {m.role}</span>}</div>
                    <div className="text-xs text-muted-foreground">{displayDept(m)}{displayContact(m) ? ` · ${displayContact(m)}` : ""}</div>
                  </div>
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => onDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              ))}
              <TeamNotesBlock noteKey={key} initial={teamNotes[key] ?? ""} isAdmin={isAdmin} onSave={onSaveNote} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TeamNotesBlock({ noteKey, initial, isAdmin, onSave }: { noteKey: string; initial: string; isAdmin: boolean; onSave: (key: string, value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? initial;
  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium"><StickyNote className="h-3.5 w-3.5 text-amber-600" /> Team notes</div>
      {isAdmin ? (
        <>
          <Textarea rows={3} value={value} placeholder={"One point per line — each line becomes a bullet."}
            onChange={e => setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            {draft !== null && <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>}
            <Button size="sm" disabled={draft === null} onClick={() => { onSave(noteKey, draft ?? ""); setDraft(null); }}>
              <Save className="h-3.5 w-3.5 mr-1" />Save
            </Button>
          </div>
        </>
      ) : (
        <BulletNotes text={initial} empty="No team notes." />
      )}
    </div>
  );
}

function VenueBlock({ noteKey, initial, isAdmin, onSave }: { noteKey: string; initial: string; isAdmin: boolean; onSave: (key: string, value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? initial;
  if (!isAdmin) {
    return <div className="text-xs text-muted-foreground">Venue: <span className="text-foreground font-medium">{initial || "—"}</span></div>;
  }
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs whitespace-nowrap">Venue</Label>
      <Input value={value} placeholder="e.g. Main Hall" onChange={e => setDraft(e.target.value)} className="h-8" />
      {draft !== null && <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>}
      <Button size="sm" disabled={draft === null} onClick={() => { onSave(noteKey, draft ?? ""); setDraft(null); }}>
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function MemberDialog({ staff, members, phases, teams, roles, initialPhase, initialTeam, onSubmit }: {
  staff: Staff[]; members: M[]; phases: string[]; teams: string[]; roles: string[];
  initialPhase: string | null; initialTeam: string | null;
  onSubmit: (v: Partial<M>) => void;
}) {
  const [f, setF] = useState<Partial<M>>({
    staff_id: null,
    phase: initialPhase ?? phases[0],
    team_name: initialTeam ?? teams[0] ?? "",
    role: roles[0] ?? "Member",
  });
  // Hide staff already on the same (phase, team)
  const taken = new Set(
    members.filter(m => m.phase === f.phase && m.team_name === f.team_name && m.staff_id).map(m => m.staff_id!)
  );
  const eligible = staff.filter(s => !taken.has(s.id));
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Assign staff to team</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="space-y-3">
        <div><Label>Staff member</Label>
          <Select value={f.staff_id ?? ""} onValueChange={(v) => setF({ ...f, staff_id: v })}>
            <SelectTrigger><SelectValue placeholder={eligible.length ? "Select staff…" : "All staff already in this team"} /></SelectTrigger>
            <SelectContent>{eligible.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</SelectItem>)}</SelectContent>
          </Select>
          {eligible.length === 0 && <p className="text-xs text-muted-foreground mt-1">Everyone available is already on this team for this phase.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phase</Label>
            <Select value={f.phase} onValueChange={v => setF({ ...f, phase: v, staff_id: null })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{phases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Team</Label>
            <Select value={f.team_name ?? ""} onValueChange={v => setF({ ...f, team_name: v, staff_id: null })}>
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