import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Utensils } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Dansala Manager" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Sign in failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--gradient-brand)" }}>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
            <Utensils className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Admin Sign-in</CardTitle>
          <p className="text-sm text-muted-foreground">Dansala Management System · administrators only</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Please wait…" : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Public users can browse the site read-only without signing in.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}