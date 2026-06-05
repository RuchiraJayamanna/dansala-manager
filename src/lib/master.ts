import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MasterOption = {
  id: string;
  option_type: string;
  value: string;
  sort_order: number;
  active: boolean;
};

export const MASTER_TYPES = [
  { key: "budget_category", label: "Budget Categories" },
  { key: "phase", label: "Phases" },
  { key: "team_group", label: "Team Groups" },
  { key: "checklist_status", label: "Checklist Statuses" },
  { key: "contribution_status", label: "Contribution Statuses" },
  { key: "department", label: "Departments" },
  { key: "contribution_team", label: "Contribution Teams" },
  { key: "member_role", label: "Member Roles" },
] as const;

export function useMasterOptions(type: string) {
  return useQuery({
    queryKey: ["master", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_options")
        .select("*")
        .eq("option_type", type)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as MasterOption[];
    },
    staleTime: 60_000,
  });
}

export function useAllMaster() {
  return useQuery({
    queryKey: ["master", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_options")
        .select("*")
        .order("option_type")
        .order("sort_order");
      if (error) throw error;
      return data as MasterOption[];
    },
  });
}