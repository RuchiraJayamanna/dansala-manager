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
import { Plus, Trash2, Paperclip, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useCurrentEvent, useCurrentEventId } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — Event Manager" }] }),
  component: DocumentsPage,
});

type Doc = { id: string; event_id: string; title: string; category: string; file_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; created_at: string };

const CATEGORIES = ["PHI Approval", "Banner Design", "Special Donation", "Sponsorship", "Permit", "Photo", "Other"];

function DocumentsPage() {
  const qc = useQueryClient();
  const event = useCurrentEvent();
  const eventId = useCurrentEventId();
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["event_documents", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_documents" as any).select("*").eq("event_id", eventId!).order("category").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Doc[];
    },
  });

  const add = useMutation({
    mutationFn: async (v: { title: string; category: string; file: File }) => {
      const path = `${eventId}/${Date.now()}-${v.file.name}`;
      const up = await supabase.storage.from("event-documents").upload(path, v.file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("event_documents" as any).insert({
        event_id: eventId!, title: v.title, category: v.category, file_path: path,
        file_name: v.file.name, mime_type: v.file.type, size_bytes: v.file.size,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event_documents"] }); setOpen(false); toast.success("Uploaded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (d: Doc) => {
      await supabase.storage.from("event-documents").remove([d.file_path]);
      const { error } = await supabase.from("event_documents" as any).delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event_documents"] }); toast.success("Removed"); },
  });

  const openFile = async (d: Doc) => {
    const { data } = await supabase.storage.from("event-documents").createSignedUrl(d.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const grouped = docs.reduce((acc: Record<string, Doc[]>, d) => { (acc[d.category] ??= []).push(d); return acc; }, {});

  if (!event) return <div className="p-8 text-muted-foreground">Select an event first.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <PageHeader title="Documents" subtitle={`${event.name} · PHI letters, banner designs, donation letters, photos & more`}
        action={isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Upload document</Button></DialogTrigger>
            <UploadDialog onSubmit={(v) => add.mutate(v)} />
          </Dialog>
        )} />

      {Object.entries(grouped).length === 0 && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No documents uploaded yet.</CardContent></Card>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <Card key={cat}>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-muted/40 font-medium">{cat} <span className="text-xs text-muted-foreground">· {list.length} file(s)</span></div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead className="w-32"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell><button onClick={() => openFile(d)} className="text-primary hover:underline inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{d.file_name}</button></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openFile(d)}><Download className="h-4 w-4" /></Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this document?")) del.mutate(d); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UploadDialog({ onSubmit }: { onSubmit: (v: { title: string; category: string; file: File }) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); if (file) onSubmit({ title, category, file }); }} className="space-y-3">
        <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. PHI Approval Letter" required /></div>
        <div><Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>File</Label><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} required /></div>
        <DialogFooter><Button type="submit" disabled={!file || !title}>Upload</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}