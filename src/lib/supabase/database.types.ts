// Database types in the format of `supabase gen types typescript`.
// Hand-written from supabase/migrations until a project is linked;
// regenerate with `npm run db:types` (see README) after schema changes.

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      candidate_profiles: {
        Row: {
          created_at: string
          data: Json
          onboarding_completed_at: string | null
          onboarding_skipped_at: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          data: Json
          onboarding_completed_at?: string | null
          onboarding_skipped_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          created_at?: string
          data?: Json
          onboarding_completed_at?: string | null
          onboarding_skipped_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      consents: {
        Row: {
          granted_at: string
          id: string
          policy_version: string
          type: Database["public"]["Enums"]["consent_type"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          policy_version: string
          type: Database["public"]["Enums"]["consent_type"]
          user_id?: string
        }
        Update: {
          granted_at?: string
          id?: string
          policy_version?: string
          type?: Database["public"]["Enums"]["consent_type"]
          user_id?: string
        }
        Relationships: []
      }
      experiences: {
        Row: {
          created_at: string
          id: string
          raw_transcript: string
          structured: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_transcript: string
          structured?: Json | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_transcript?: string
          structured?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      interview_feedback: {
        Row: {
          created_at: string
          exercise: string
          id: string
          improvements: string[]
          interview_id: string
          scores: Json
          strengths: string[]
          summary: string
        }
        Insert: {
          created_at?: string
          exercise?: string
          id?: string
          improvements?: string[]
          interview_id: string
          scores: Json
          strengths?: string[]
          summary?: string
        }
        Update: {
          created_at?: string
          exercise?: string
          id?: string
          improvements?: string[]
          interview_id?: string
          scores?: Json
          strengths?: string[]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          duration_seconds: number | null
          finished_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["interview_status"]
          track: Database["public"]["Enums"]["interview_track"]
          transcript: Json
          user_id: string
        }
        Insert: {
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          track: Database["public"]["Enums"]["interview_track"]
          transcript?: Json
          user_id?: string
        }
        Update: {
          duration_seconds?: number | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          track?: Database["public"]["Enums"]["interview_track"]
          transcript?: Json
          user_id?: string
        }
        Relationships: []
      }
      job_outlook_cache: {
        Row: {
          cache_key: string
          created_at: string
          outlook: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          outlook: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          outlook?: Json
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          company: string | null
          description: string
          detail_insights: Json
          details_fetched_at: string | null
          employment_type: string | null
          fetched_at: string
          id: string
          insights: Json
          location: string | null
          published_at: string | null
          snippet: string
          source: string
          source_id: string
          source_url: string
          title: string
          track: string | null
        }
        Insert: {
          company?: string | null
          description?: string
          detail_insights?: Json
          details_fetched_at?: string | null
          employment_type?: string | null
          fetched_at?: string
          id?: string
          insights?: Json
          location?: string | null
          published_at?: string | null
          snippet?: string
          source: string
          source_id: string
          source_url: string
          title: string
          track?: string | null
        }
        Update: {
          company?: string | null
          description?: string
          detail_insights?: Json
          details_fetched_at?: string | null
          employment_type?: string | null
          fetched_at?: string
          id?: string
          insights?: Json
          location?: string | null
          published_at?: string | null
          snippet?: string
          source?: string
          source_id?: string
          source_url?: string
          title?: string
          track?: string | null
        }
        Relationships: []
      }
      job_search_cache: {
        Row: {
          created_at: string
          posting_ids: string[]
          query_hash: string
          source_status: Json
        }
        Insert: {
          created_at?: string
          posting_ids?: string[]
          query_hash: string
          source_status?: Json
        }
        Update: {
          created_at?: string
          posting_ids?: string[]
          query_hash?: string
          source_status?: Json
        }
        Relationships: []
      }
      job_search_events: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      resume_documents: {
        Row: {
          active_version: number
          created_at: string
          id: string
          language: string
          target_role: string
          track: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_version?: number
          created_at?: string
          id?: string
          language?: string
          target_role: string
          track: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          active_version?: number
          created_at?: string
          id?: string
          language?: string
          target_role?: string
          track?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          content: Json
          created_at: string
          document_id: string
          id: string
          instruction: string | null
          notes: string | null
          status: string
          user_id: string
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          document_id: string
          id?: string
          instruction?: string | null
          notes?: string | null
          status: string
          user_id?: string
          version: number
        }
        Update: {
          content?: Json
          created_at?: string
          document_id?: string
          id?: string
          instruction?: string | null
          notes?: string | null
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "resume_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          id: string
          original_text: string
          parsed: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_text: string
          parsed?: Json | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_text?: string
          parsed?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      tailored_resumes: {
        Row: {
          created_at: string
          id: string
          job_posting_text: string
          result: Json
          resume_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_posting_text: string
          result: Json
          resume_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_posting_text?: string
          result?: Json
          resume_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tailored_resumes_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          ref_id: string | null
          type: Database["public"]["Enums"]["xp_event_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ref_id?: string | null
          type: Database["public"]["Enums"]["xp_event_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ref_id?: string | null
          type?: Database["public"]["Enums"]["xp_event_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      consent_type: "voice" | "resume"
      interview_status: "running" | "finished" | "aborted"
      interview_track: "startup" | "consulting" | "finance"
      xp_event_type:
        | "interview_finished"
        | "feedback_score"
        | "resume_uploaded"
        | "resume_tailored"
        | "experience_recorded"
        | "daily_streak"
        | "profile_completed"
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

export const Constants = {
  public: {
    Enums: {
      consent_type: ["voice", "resume"],
      interview_status: ["running", "finished", "aborted"],
      interview_track: ["startup", "consulting", "finance"],
      xp_event_type: [
        "interview_finished",
        "feedback_score",
        "resume_uploaded",
        "resume_tailored",
        "experience_recorded",
        "daily_streak",
        "profile_completed",
      ],
    },
  },
} as const
