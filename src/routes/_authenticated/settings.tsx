import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useAppSettings } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { ShieldCheck, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Dansala Management System" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { data: settings } = useAppSettings();
  const [name, setName] = useState("");
  useEffect(() => { if (settings?.company_name) setName(settings.company_name); }, [settings?.company_name]);

  const save = useMutation({
    mutationFn: async (company_name: string) => {
      const { error } = await supabase.from("app_settings").update({ company_name }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_settings"] }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <PageHeader title="Settings" subtitle="System-wide configuration." />

      <Card>
        <CardHeader><CardTitle className="text-base">Organisation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Organisation / company name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} placeholder="Dansala Management System" />
            <p className="text-xs text-muted-foreground mt-1">Shown in the sidebar header.</p>
          </div>
          {isAdmin && <Button onClick={() => save.mutate(name)}>Save</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Access model</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>The site is <span className="font-medium text-foreground">publicly viewable</span> — anyone with the link can browse data without signing in.</p>
          <p>Only signed-in administrators can create, edit or delete records. New admins cannot self-register; an existing admin must add them in the backend.</p>
          <div className="rounded-md border bg-muted/50 p-3 flex gap-2 text-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>To add an admin: have them sign in once at <code>/auth</code>, then add their user id to the <code>user_roles</code> table with role <code>admin</code> from the backend.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}