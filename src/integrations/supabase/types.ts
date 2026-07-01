export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_items: {
        Row: {
          created_at: string
          end_time: string | null
          event_id: string
          id: string
          location: string | null
          notes: string | null
          responsible_staff_id: string | null
          sort_order: number
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          event_id: string
          id?: string
          location?: string | null
          notes?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          event_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          company_name: string
          created_at: string
          current_event_id: string | null
          id: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          current_event_id?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          current_event_id?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_current_event_id_fkey"
            columns: ["current_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number
          actual_note: string | null
          actual_qty: number | null
          actual_unit_price: number | null
          category: string
          created_at: string
          event_id: string
          id: string
          item: string
          planned_amount: number
          planned_qty: number | null
          planned_unit_price: number | null
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          actual_note?: string | null
          actual_qty?: number | null
          actual_unit_price?: number | null
          category?: string
          created_at?: string
          event_id: string
          id?: string
          item: string
          planned_amount?: number
          planned_qty?: number | null
          planned_unit_price?: number | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          actual_note?: string | null
          actual_qty?: number | null
          actual_unit_price?: number | null
          category?: string
          created_at?: string
          event_id?: string
          id?: string
          item?: string
          planned_amount?: number
          planned_qty?: number | null
          planned_unit_price?: number | null
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_receipts: {
        Row: {
          budget_item_id: string
          file_name: string
          file_path: string
          id: string
          uploaded_at: string
        }
        Insert: {
          budget_item_id: string
          file_name: string
          file_path: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          budget_item_id?: string
          file_name?: string
          file_path?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_receipts_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_assignees: {
        Row: {
          checklist_item_id: string
          created_at: string
          id: string
          staff_id: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          id?: string
          staff_id: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_assignees_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_assignees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          due_date: string | null
          event_id: string
          id: string
          notes: string | null
          owner: string | null
          owner_staff_id: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          event_id: string
          id?: string
          notes?: string | null
          owner?: string | null
          owner_staff_id?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          owner?: string | null
          owner_staff_id?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_owner_staff_id_fkey"
            columns: ["owner_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_receipts: {
        Row: {
          contribution_id: string
          file_name: string
          file_path: string
          id: string
          uploaded_at: string
        }
        Insert: {
          contribution_id: string
          file_name: string
          file_path: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          contribution_id?: string
          file_name?: string
          file_path?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_receipts_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          created_at: string
          event_id: string
          id: string
          member_name: string
          note: string | null
          paid_at: string | null
          payment_type: string
          staff_id: string | null
          status: string
          team: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          event_id: string
          id?: string
          member_name: string
          note?: string | null
          paid_at?: string | null
          payment_type?: string
          staff_id?: string | null
          status?: string
          team?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_id?: string
          id?: string
          member_name?: string
          note?: string | null
          paid_at?: string | null
          payment_type?: string
          staff_id?: string | null
          status?: string
          team?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          category: string
          created_at: string
          event_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          event_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          event_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda_notes: string | null
          checklist_notes: string | null
          created_at: string
          dansala_type: string | null
          event_date: string | null
          id: string
          is_public: boolean
          location: string | null
          name: string
          notes: string | null
          office_contribution: number
          status: string
          team_notes: Json
          team_venues: Json
          updated_at: string
          year: number
        }
        Insert: {
          agenda_notes?: string | null
          checklist_notes?: string | null
          created_at?: string
          dansala_type?: string | null
          event_date?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          name: string
          notes?: string | null
          office_contribution?: number
          status?: string
          team_notes?: Json
          team_venues?: Json
          updated_at?: string
          year: number
        }
        Update: {
          agenda_notes?: string | null
          checklist_notes?: string | null
          created_at?: string
          dansala_type?: string | null
          event_date?: string | null
          id?: string
          is_public?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          office_contribution?: number
          status?: string
          team_notes?: Json
          team_venues?: Json
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      item_checklist: {
        Row: {
          created_at: string
          event_id: string
          id: string
          item_name: string
          notes: string | null
          quantity: number
          responsible_name: string | null
          responsible_staff_id: string | null
          sort_order: number
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          item_name: string
          notes?: string | null
          quantity?: number
          responsible_name?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          responsible_name?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_checklist_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      master_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          option_type: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          option_type: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          option_type?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          contact: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          employee_no: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_no?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_no?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          attended: boolean
          contact: string | null
          created_at: string
          department: string | null
          event_id: string
          id: string
          name: string
          phase: string
          role: string | null
          staff_id: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          attended?: boolean
          contact?: string | null
          created_at?: string
          department?: string | null
          event_id: string
          id?: string
          name: string
          phase?: string
          role?: string | null
          staff_id?: string | null
          team_name: string
          updated_at?: string
        }
        Update: {
          attended?: boolean
          contact?: string | null
          created_at?: string
          department?: string | null
          event_id?: string
          id?: string
          name?: string
          phase?: string
          role?: string | null
          staff_id?: string | null
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
