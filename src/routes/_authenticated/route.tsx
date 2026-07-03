import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Wallet, Users, ListChecks, HandCoins, LogOut, Utensils,
  UserCog, BarChart3, CalendarClock, CalendarRange, Settings, LogIn, ShieldCheck, ChevronsUpDown, Menu, FolderOpen, Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EventProvider, useEventCtx, useAppSettings } from "@/lib/event-context";
import { useIsAdmin } from "@/lib/use-is-admin";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => (
    <EventProvider>
      <Layout />
    </EventProvider>
  ),
});

const eventNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/summary", label: "Summary & Reports", icon: BarChart3 },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/agenda", label: "Event Agenda", icon: CalendarClock },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/checklist", label: "Checklist", icon: ListChecks },
  { to: "/items", label: "Item Checklist", icon: Boxes },
  { to: "/contributions", label: "Contributions", icon: HandCoins },
  { to: "/documents", label: "Documents", icon: FolderOpen },
] as const;

const topSetupNav = [
  { to: "/events", label: "Events / Projects", icon: CalendarRange },
  { to: "/staff", label: "Staff", icon: UserCog },
] as const;
const setupTypes = [
  { type: "budget_category", label: "Budget Categories" },
  { type: "team_group", label: "Team Groups" },
  { type: "department", label: "Departments" },
  { type: "designation", label: "Designations" },
  { type: "event_category", label: "Event Categories" },
  { type: "unit", label: "Units of Measure" },
  { type: "phase", label: "Event Phases" },
  { type: "member_role", label: "Member Roles" },
  { type: "checklist_status", label: "Checklist Statuses" },
  { type: "contribution_status", label: "Contribution Statuses" },
  { type: "contribution_team", label: "Contribution Teams" },
] as const;

function Layout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { events, currentEvent, setCurrentEventId } = useEventCtx();
  const { isAdmin, userId } = useIsAdmin();
  const { data: settings } = useAppSettings();
  const companyName = settings?.company_name || "Dansala Management System";
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/dashboard", replace: true });
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl grid place-items-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
            <Utensils className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold tracking-tight truncate">{companyName}</div>
            <div className="text-[11px] text-muted-foreground">Event control panel</div>
          </div>
        </div>
        {events.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1"><ChevronsUpDown className="h-3 w-3" />Current project</div>
            <Select value={currentEvent?.id ?? ""} onValueChange={setCurrentEventId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map(e => (<SelectItem key={e.id} value={e.id}>{e.name} · {e.year}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
        <SectionLabel>Event</SectionLabel>
        {eventNav.map(item => <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} active={pathname.startsWith(item.to)} />)}
        <SectionLabel>Setup</SectionLabel>
        {topSetupNav.map(item => <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} active={pathname.startsWith(item.to)} />)}
        {setupTypes.map(s => (
          <Link key={s.type} to="/setup/$type" params={{ type: s.type }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${pathname === `/setup/${s.type}` ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <span className="w-4" />{s.label}
          </Link>
        ))}
        <SectionLabel>Admin</SectionLabel>
        <NavItem to="/settings" label="Settings" icon={Settings} active={pathname.startsWith("/settings")} />
      </nav>
      <div className="p-3 border-t space-y-2">
        {isAdmin ? (
          <>
            <div className="flex items-center gap-2 text-xs text-emerald-600 px-2"><ShieldCheck className="h-3.5 w-3.5" />Signed in as admin</div>
            <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </>
        ) : (
          <Button variant="outline" className="w-full justify-start gap-3" onClick={() => navigate({ to: "/auth" })}>
            <LogIn className="h-4 w-4" /> Admin sign in
          </Button>
        )}
        {!isAdmin && userId && (
          <div className="text-[11px] text-muted-foreground px-1">Signed in but no admin role assigned.</div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden md:flex w-64 shrink-0 border-r bg-card flex-col sticky top-0 h-screen">
        {sidebarContent}
      </aside>
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 h-14 border-b bg-card">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg grid place-items-center text-primary-foreground shrink-0" style={{ background: "var(--gradient-brand)" }}>
            <Utensils className="h-4 w-4" />
          </div>
          <div className="font-semibold tracking-tight truncate text-sm">{companyName}</div>
        </div>
        <div className="w-9" />
      </header>
      <main className="flex-1 min-w-0 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1">{children}</div>;
}

function NavItem({ to, label, icon: Icon, active }: { to: string; label: string; icon?: any; active: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      {Icon ? <Icon className="h-4 w-4" /> : <span className="w-4" />}
      {label}
    </Link>
  );
}