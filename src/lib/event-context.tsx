import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Event = {
  id: string;
  name: string;
  year: number;
  location: string | null;
  event_category: string | null;
  event_date: string | null;
  status: string;
  notes: string | null;
  agenda_notes?: string | null;
  checklist_notes?: string | null;
  team_notes?: Record<string, string> | null;
  team_venues?: Record<string, string> | null;
  office_contribution?: number | null;
  is_public?: boolean;
};

type Ctx = {
  events: Event[];
  currentEvent: Event | null;
  setCurrentEventId: (id: string) => void;
  loading: boolean;
};

const EventCtx = createContext<Ctx>({ events: [], currentEvent: null, setCurrentEventId: () => {}, loading: true });

export function EventProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  useEffect(() => {
    if (selectedId || events.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("dansala.event") : null;
    if (stored && events.some(e => e.id === stored)) { setSelectedId(stored); return; }
    if (settings?.current_event_id && events.some(e => e.id === settings.current_event_id)) { setSelectedId(settings.current_event_id); return; }
    setSelectedId(events[0].id);
  }, [events, settings, selectedId]);

  const setCurrentEventId = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") localStorage.setItem("dansala.event", id);
  };

  const currentEvent = events.find(e => e.id === selectedId) ?? null;
  return <EventCtx.Provider value={{ events, currentEvent, setCurrentEventId, loading: isLoading }}>{children}</EventCtx.Provider>;
}

export const useEventCtx = () => useContext(EventCtx);
export const useCurrentEvent = () => useContext(EventCtx).currentEvent;
export const useCurrentEventId = () => useContext(EventCtx).currentEvent?.id ?? null;

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
}