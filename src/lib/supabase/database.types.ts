// Gerado via Supabase MCP (generate_typescript_types). Regenerar após migrations.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agenda_attachments: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name: string
          storage_path: string | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name: string
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          admin_notes: string | null
          ai_suggested_category:
            | Database["public"]["Enums"]["agenda_category"]
            | null
          allotted_minutes: number | null
          block_id: string | null
          category: Database["public"]["Enums"]["agenda_category"]
          created_at: string
          deleted_at: string | null
          description: string
          discussed_at: string | null
          expected_impact: string | null
          expected_outcome: string | null
          id: string
          links: Json
          meeting_id: string | null
          people_involved: string | null
          presenter_id: string | null
          priority: number
          problem: string | null
          proposed_solution: string | null
          requires_decision: boolean
          return_reason: string | null
          sort_order: number
          status: Database["public"]["Enums"]["agenda_status"]
          strategic_goal_id: string | null
          submission_id: string | null
          submitted_by: string
          suggested_minutes: number | null
          title: string
          unit_id: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          admin_notes?: string | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["agenda_category"]
            | null
          allotted_minutes?: number | null
          block_id?: string | null
          category?: Database["public"]["Enums"]["agenda_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string
          discussed_at?: string | null
          expected_impact?: string | null
          expected_outcome?: string | null
          id?: string
          links?: Json
          meeting_id?: string | null
          people_involved?: string | null
          presenter_id?: string | null
          priority?: number
          problem?: string | null
          proposed_solution?: string | null
          requires_decision?: boolean
          return_reason?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["agenda_status"]
          strategic_goal_id?: string | null
          submission_id?: string | null
          submitted_by: string
          suggested_minutes?: number | null
          title: string
          unit_id?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          admin_notes?: string | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["agenda_category"]
            | null
          allotted_minutes?: number | null
          block_id?: string | null
          category?: Database["public"]["Enums"]["agenda_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string
          discussed_at?: string | null
          expected_impact?: string | null
          expected_outcome?: string | null
          id?: string
          links?: Json
          meeting_id?: string | null
          people_involved?: string | null
          presenter_id?: string | null
          priority?: number
          problem?: string | null
          proposed_solution?: string | null
          requires_decision?: boolean
          return_reason?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["agenda_status"]
          strategic_goal_id?: string | null
          submission_id?: string | null
          submitted_by?: string
          suggested_minutes?: number | null
          title?: string
          unit_id?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "meeting_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "agenda_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_submissions: {
        Row: {
          client_batch_id: string
          id: string
          is_late: boolean
          item_count: number
          reflection: string | null
          submitted_at: string
          submitted_by: string
          target_meeting_id: string | null
        }
        Insert: {
          client_batch_id: string
          id?: string
          is_late?: boolean
          item_count?: number
          reflection?: string | null
          submitted_at?: string
          submitted_by: string
          target_meeting_id?: string | null
        }
        Update: {
          client_batch_id?: string
          id?: string
          is_late?: boolean
          item_count?: number
          reflection?: string | null
          submitted_at?: string
          submitted_by?: string
          target_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_submissions_target_meeting_id_fkey"
            columns: ["target_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_targets: {
        Row: {
          expansion_contribution: number | null
          note: string | null
          revenue_actual: number | null
          revenue_budget: number | null
          revenue_target: number | null
          scenario_base: number | null
          scenario_conservative: number | null
          scenario_optimistic: number | null
          updated_at: string
          year: number
        }
        Insert: {
          expansion_contribution?: number | null
          note?: string | null
          revenue_actual?: number | null
          revenue_budget?: number | null
          revenue_target?: number | null
          scenario_base?: number | null
          scenario_conservative?: number | null
          scenario_optimistic?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          expansion_contribution?: number | null
          note?: string | null
          revenue_actual?: number | null
          revenue_budget?: number | null
          revenue_target?: number | null
          scenario_base?: number | null
          scenario_conservative?: number | null
          scenario_optimistic?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      business_unit_members: {
        Row: {
          can_edit: boolean
          is_lead: boolean
          profile_id: string
          unit_id: string
        }
        Insert: {
          can_edit?: boolean
          is_lead?: boolean
          profile_id: string
          unit_id: string
        }
        Update: {
          can_edit?: boolean
          is_lead?: boolean
          profile_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_unit_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_members_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          pillar: string
          slug: string
          sort_order: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pillar?: string
          slug: string
          sort_order?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pillar?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      growth_experiments: {
        Row: {
          actual_result: string | null
          actual_revenue: number | null
          created_at: string
          created_by: string | null
          deadline: string | null
          expected_revenue: number | null
          hypothesis: string | null
          id: string
          idea_id: string | null
          investment: number | null
          next_decision: string | null
          objective: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["growth_status"]
          success_metrics: string | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          expected_revenue?: number | null
          hypothesis?: string | null
          id?: string
          idea_id?: string | null
          investment?: number | null
          next_decision?: string | null
          objective?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["growth_status"]
          success_metrics?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          actual_revenue?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          expected_revenue?: number | null
          hypothesis?: string | null
          id?: string
          idea_id?: string | null
          investment?: number | null
          next_decision?: string | null
          objective?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["growth_status"]
          success_metrics?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_experiments_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "growth_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_experiments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_experiments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_ideas: {
        Row: {
          author_id: string
          created_at: string
          description: string | null
          id: string
          kind: string | null
          status: Database["public"]["Enums"]["growth_status"]
          strategic_goal_id: string | null
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string | null
          status?: Database["public"]["Enums"]["growth_status"]
          strategic_goal_id?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string | null
          status?: Database["public"]["Enums"]["growth_status"]
          strategic_goal_id?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_ideas_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_ideas_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_ideas_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      invited_user_units: {
        Row: {
          email: string
          is_lead: boolean
          unit_slug: string
        }
        Insert: {
          email: string
          is_lead?: boolean
          unit_slug: string
        }
        Update: {
          email?: string
          is_lead?: boolean
          unit_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "invited_user_units_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "invited_users"
            referencedColumns: ["email"]
          },
        ]
      }
      invited_users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["user_role"]
          short_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          role?: Database["public"]["Enums"]["user_role"]
          short_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          short_name?: string | null
        }
        Relationships: []
      }
      kpi_definitions: {
        Row: {
          applies_to_all: boolean
          category: Database["public"]["Enums"]["kpi_category"]
          has_budget: boolean
          has_prior_year: boolean
          higher_is_better: boolean
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          unit_type: Database["public"]["Enums"]["kpi_unit_type"]
        }
        Insert: {
          applies_to_all?: boolean
          category?: Database["public"]["Enums"]["kpi_category"]
          has_budget?: boolean
          has_prior_year?: boolean
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          unit_type?: Database["public"]["Enums"]["kpi_unit_type"]
        }
        Update: {
          applies_to_all?: boolean
          category?: Database["public"]["Enums"]["kpi_category"]
          has_budget?: boolean
          has_prior_year?: boolean
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          unit_type?: Database["public"]["Enums"]["kpi_unit_type"]
        }
        Relationships: []
      }
      kpi_entries: {
        Row: {
          budget_value: number | null
          created_at: string
          id: string
          kpi_id: string
          note: string | null
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          prior_year_value: number | null
          unit_id: string
          updated_at: string
          updated_by: string | null
          value: number | null
        }
        Insert: {
          budget_value?: number | null
          created_at?: string
          id?: string
          kpi_id: string
          note?: string | null
          period?: Database["public"]["Enums"]["period_type"]
          period_start: string
          prior_year_value?: number | null
          unit_id: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Update: {
          budget_value?: number | null
          created_at?: string
          id?: string
          kpi_id?: string
          note?: string | null
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          prior_year_value?: number | null
          unit_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_blocks: {
        Row: {
          duration_minutes: number
          id: string
          kind: Database["public"]["Enums"]["block_kind"]
          meeting_id: string
          notes: string | null
          sort_order: number
          title: string
        }
        Insert: {
          duration_minutes: number
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          meeting_id: string
          notes?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          duration_minutes?: number
          id?: string
          kind?: Database["public"]["Enums"]["block_kind"]
          meeting_id?: string
          notes?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_blocks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_decisions: {
        Row: {
          agenda_item_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string
          owner_id: string | null
          strategic_goal_id: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id: string
          owner_id?: string | null
          strategic_goal_id?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string
          owner_id?: string | null
          strategic_goal_id?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_decisions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          created_by: string | null
          drive_url: string | null
          id: string
          meeting_id: string
          source_notes: string | null
          status: Database["public"]["Enums"]["minutes_status"]
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          id?: string
          meeting_id: string
          source_notes?: string | null
          status?: Database["public"]["Enums"]["minutes_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          id?: string
          meeting_id?: string
          source_notes?: string | null
          status?: Database["public"]["Enums"]["minutes_status"]
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          attended: boolean | null
          meeting_id: string
          profile_id: string
        }
        Insert: {
          attended?: boolean | null
          meeting_id: string
          profile_id: string
        }
        Update: {
          attended?: boolean | null
          meeting_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          notes: string | null
          prompt_id: string | null
          published_at: string | null
          review_unit_ids: string[]
          scheduled_at: string
          series_date: string
          started_at: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          prompt_id?: string | null
          published_at?: string | null
          review_unit_ids?: string[]
          scheduled_at: string
          series_date: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          prompt_id?: string | null
          published_at?: string | null
          review_unit_ids?: string[]
          scheduled_at?: string
          series_date?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "weekly_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          short_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      strategic_goals: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: string
          task_id: string
          to_value: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          task_id: string
          to_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          task_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          profile_id: string
          task_id: string
        }
        Insert: {
          profile_id: string
          task_id: string
        }
        Update: {
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agenda_item_id: string | null
          checkin_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          decision_id: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          evidence_note: string | null
          evidence_url: string | null
          id: string
          legacy_owner_text: string | null
          meeting_id: string | null
          owner_id: string | null
          pillar: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          agenda_item_id?: string | null
          checkin_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          legacy_owner_text?: string | null
          meeting_id?: string | null
          owner_id?: string | null
          pillar?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          agenda_item_id?: string | null
          checkin_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          evidence_note?: string | null
          evidence_url?: string | null
          id?: string
          legacy_owner_text?: string | null
          meeting_id?: string | null
          owner_id?: string | null
          pillar?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_checkin_fk"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "weekly_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "meeting_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_annual_revenue: {
        Row: {
          revenue_actual: number | null
          revenue_budget: number | null
          unit_id: string
          updated_at: string
          year: number
        }
        Insert: {
          revenue_actual?: number | null
          revenue_budget?: number | null
          unit_id: string
          updated_at?: string
          year: number
        }
        Update: {
          revenue_actual?: number | null
          revenue_budget?: number | null
          unit_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "unit_annual_revenue_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_kpis: {
        Row: {
          is_active: boolean
          kpi_id: string
          unit_id: string
        }
        Insert: {
          is_active?: boolean
          kpi_id: string
          unit_id: string
        }
        Update: {
          is_active?: boolean
          kpi_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_kpis_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_kpis_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkins: {
        Row: {
          author_id: string
          commitments: string | null
          growth_initiative: string | null
          id: string
          is_late: boolean
          needs_from_comex: string | null
          problems: Json
          sales_initiatives: string | null
          sales_summary: string | null
          solutions: string | null
          submitted_at: string
          unit_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          author_id: string
          commitments?: string | null
          growth_initiative?: string | null
          id?: string
          is_late?: boolean
          needs_from_comex?: string | null
          problems?: Json
          sales_initiatives?: string | null
          sales_summary?: string | null
          solutions?: string | null
          submitted_at?: string
          unit_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          author_id?: string
          commitments?: string | null
          growth_initiative?: string | null
          id?: string
          is_late?: boolean
          needs_from_comex?: string | null
          problems?: Json
          sales_initiatives?: string | null
          sales_summary?: string | null
          solutions?: string | null
          submitted_at?: string
          unit_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkins_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkins_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_prompts: {
        Row: {
          author: string | null
          created_at: string
          id: string
          is_active: boolean
          text: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          text: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          text?: string
        }
        Relationships: []
      }
      weekly_reflections: {
        Row: {
          converted_to: string | null
          created_at: string
          id: string
          profile_id: string
          prompt_id: string | null
          submission_id: string | null
          text: string
        }
        Insert: {
          converted_to?: string | null
          created_at?: string
          id?: string
          profile_id: string
          prompt_id?: string | null
          submission_id?: string | null
          text: string
        }
        Update: {
          converted_to?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          prompt_id?: string | null
          submission_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reflections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reflections_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "weekly_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reflections_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "agenda_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_invite: { Args: { p_email: string }; Returns: undefined }
      can_edit_unit: { Args: { p_unit: string }; Returns: boolean }
      create_decision_with_task: {
        Args: {
          p_agenda_item: string
          p_create_task?: boolean
          p_description: string
          p_due: string
          p_meeting: string
          p_owner: string
          p_title: string
          p_unit: string
        }
        Returns: string
      }
      current_role_of: {
        Args: { uid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      ensure_upcoming_meetings: { Args: { p_weeks?: number }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      link_legacy_task_owners: { Args: never; Returns: number }
      submit_agenda_batch: {
        Args: { p_batch_id: string; p_items: Json; p_reflection?: string }
        Returns: Json
      }
      unaccent_safe: { Args: { t: string }; Returns: string }
    }
    Enums: {
      agenda_category:
        | "strategic_decision"
        | "accountability"
        | "business_review"
        | "brainstorm"
        | "knowledge"
        | "marketing_sales"
        | "innovation"
        | "other"
      agenda_status:
        | "received"
        | "in_review"
        | "returned"
        | "approved"
        | "scheduled"
        | "discussed"
        | "postponed"
        | "archived"
      block_kind:
        | "opening"
        | "accountability"
        | "business_review"
        | "deliberation"
        | "knowledge"
        | "brainstorm"
        | "growth"
        | "closing"
        | "custom"
      growth_status:
        | "idea"
        | "evaluating"
        | "approved"
        | "executing"
        | "done"
        | "scaled"
        | "discontinued"
      kpi_category: "commercial" | "operational" | "experience" | "events"
      kpi_unit_type: "currency" | "percent" | "number" | "score"
      meeting_status:
        | "preparing"
        | "published"
        | "in_progress"
        | "closed"
        | "cancelled"
      minutes_status: "draft" | "approved"
      period_type: "week" | "month" | "year"
      task_priority: "low" | "medium" | "high"
      task_status:
        | "not_started"
        | "in_progress"
        | "waiting"
        | "blocked"
        | "done"
        | "cancelled"
      urgency_level: "low" | "medium" | "high" | "critical"
      user_role: "admin" | "executive" | "unit_lead" | "guest"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agenda_category: [
        "strategic_decision",
        "accountability",
        "business_review",
        "brainstorm",
        "knowledge",
        "marketing_sales",
        "innovation",
        "other",
      ],
      agenda_status: [
        "received",
        "in_review",
        "returned",
        "approved",
        "scheduled",
        "discussed",
        "postponed",
        "archived",
      ],
      block_kind: [
        "opening",
        "accountability",
        "business_review",
        "deliberation",
        "knowledge",
        "brainstorm",
        "growth",
        "closing",
        "custom",
      ],
      growth_status: [
        "idea",
        "evaluating",
        "approved",
        "executing",
        "done",
        "scaled",
        "discontinued",
      ],
      kpi_category: ["commercial", "operational", "experience", "events"],
      kpi_unit_type: ["currency", "percent", "number", "score"],
      meeting_status: [
        "preparing",
        "published",
        "in_progress",
        "closed",
        "cancelled",
      ],
      minutes_status: ["draft", "approved"],
      period_type: ["week", "month", "year"],
      task_priority: ["low", "medium", "high"],
      task_status: [
        "not_started",
        "in_progress",
        "waiting",
        "blocked",
        "done",
        "cancelled",
      ],
      urgency_level: ["low", "medium", "high", "critical"],
      user_role: ["admin", "executive", "unit_lead", "guest"],
    },
  },
} as const
