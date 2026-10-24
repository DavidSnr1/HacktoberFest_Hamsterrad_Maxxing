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
      ],
    },
  },
} as const
