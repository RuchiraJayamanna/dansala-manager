import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { MASTER_TYPES, useAllMaster } from "@/lib/master";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({ meta: [{ title: "Master Data — Dansala Manager" }] }),
  component: MasterPage,
});

function MasterPage() {
  const qc = useQueryClient();
  const { data: all = [] } = useAllMaster();

  const add = useMutation({
    mutationFn: async (v: { option_type: string; value: string }) => {
      const sort = all.filter(o => o.option_type === v.option_type).length + 1;
      const { error } = await supabase.from("master_options").insert({ ...v, sort_order: sort });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master"] }); toast.success("Added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("master_options").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master"] }); toast.success("Removed"); },
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <PageHeader title="Master Data" subtitle="All dropdown lists used across the system. Change once, reflects everywhere." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MASTER_TYPES.map(t => (
          <MasterCard key={t.key} type={t.key} label={t.label}
            options={all.filter(o => o.option_type === t.key)}
            onAdd={(v) => add.mutate({ option_type: t.key, value: v })}
            onDel={(id) => del.mutate(id)} />
        ))}
      </div>
    </div>
  );
}

function MasterCard({ type: _type, label, options, onAdd, onDel }: { type: string; label: string; options: { id: string; value: string }[]; onAdd: (v: string) => void; onDel: (id: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{label} <span className="text-muted-foreground text-xs font-normal">· {options.length}</span></CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {options.map(o => (
          <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-1.5">
            <span className="text-sm">{o.value}</span>
            <Button size="icon" variant="ghost" onClick={() => onDel(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }} className="flex gap-2 pt-1">
          <Input value={v} onChange={e => setV(e.target.value)} placeholder="New value" />
          <Button size="icon" type="submit"><Plus className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  );
}