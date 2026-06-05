import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Wallet, Users, ListChecks, HandCoins, LogOut, Utensils, UserCog, Database, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/summary", label: "Summary", icon: BarChart3 },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/checklist", label: "Checklist", icon: ListChecks },
  { to: "/contributions", label: "Contributions", icon: HandCoins },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/master", label: "Master Data", icon: Database },
] as const;

function Layout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 border-r bg-card flex flex-col">
        <div className="p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">MISL Dansala</div>
              <div className="text-xs text-muted-foreground">2026 control panel</div>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map(item => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}