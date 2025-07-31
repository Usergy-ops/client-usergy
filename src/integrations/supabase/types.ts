export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      account_types: {
        Row: {
          account_type: string
          auth_user_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          account_type: string
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          account_type?: string
          auth_user_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      consolidated_social_presence: {
        Row: {
          additional_links: string[] | null
          created_at: string | null
          github_url: string | null
          id: string
          linkedin_url: string | null
          metadata: Json | null
          other_social_networks: Json | null
          portfolio_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_links?: string[] | null
          created_at?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          metadata?: Json | null
          other_social_networks?: Json | null
          portfolio_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_links?: string[] | null
          created_at?: string | null
          github_url?: string | null
          id?: string
          linkedin_url?: string | null
          metadata?: Json | null
          other_social_networks?: Json | null
          portfolio_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      enhanced_rate_limits: {
        Row: {
          action: string
          attempts: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          metadata: Json | null
          updated_at: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          metadata?: Json | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          metadata?: Json | null
          updated_at?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: string | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          metadata: Json | null
          resolved: boolean | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          ai_familiarity_level: string | null
          availability_hours: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          company_size: string | null
          completion_percentage: number | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          education_level: string | null
          email: string
          employer: string | null
          field_of_study: string | null
          full_name: string | null
          gender: string | null
          github_url: string | null
          household_income_range: string | null
          id: string
          industry: string | null
          job_title: string | null
          languages_spoken: string[] | null
          linkedin_url: string | null
          phone_number: string | null
          portfolio_url: string | null
          profile_completed: boolean | null
          section_1_completed: boolean | null
          section_2_completed: boolean | null
          section_3_completed: boolean | null
          section_4_completed: boolean | null
          section_5_completed: boolean | null
          section_6_completed: boolean | null
          technical_experience_level: string | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string
          work_role: string | null
        }
        Insert: {
          age?: number | null
          ai_familiarity_level?: string | null
          availability_hours?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          company_size?: string | null
          completion_percentage?: number | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          education_level?: string | null
          email: string
          employer?: string | null
          field_of_study?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          household_income_range?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          phone_number?: string | null
          portfolio_url?: string | null
          profile_completed?: boolean | null
          section_1_completed?: boolean | null
          section_2_completed?: boolean | null
          section_3_completed?: boolean | null
          section_4_completed?: boolean | null
          section_5_completed?: boolean | null
          section_6_completed?: boolean | null
          technical_experience_level?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id: string
          work_role?: string | null
        }
        Update: {
          age?: number | null
          ai_familiarity_level?: string | null
          availability_hours?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          company_size?: string | null
          completion_percentage?: number | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          education_level?: string | null
          email?: string
          employer?: string | null
          field_of_study?: string | null
          full_name?: string | null
          gender?: string | null
          github_url?: string | null
          household_income_range?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          phone_number?: string | null
          portfolio_url?: string | null
          profile_completed?: boolean | null
          section_1_completed?: boolean | null
          section_2_completed?: boolean | null
          section_3_completed?: boolean | null
          section_4_completed?: boolean | null
          section_5_completed?: boolean | null
          section_6_completed?: boolean | null
          technical_experience_level?: string | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string
          work_role?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          identifier: string
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier: string
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          identifier?: string
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string | null
          desktop_manufacturers: string[] | null
          devices_owned: string[] | null
          email_clients: string[] | null
          id: string
          mobile_manufacturers: string[] | null
          music_subscriptions: string[] | null
          operating_systems: string[] | null
          streaming_subscriptions: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          desktop_manufacturers?: string[] | null
          devices_owned?: string[] | null
          email_clients?: string[] | null
          id?: string
          mobile_manufacturers?: string[] | null
          music_subscriptions?: string[] | null
          operating_systems?: string[] | null
          streaming_subscriptions?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          desktop_manufacturers?: string[] | null
          devices_owned?: string[] | null
          email_clients?: string[] | null
          id?: string
          mobile_manufacturers?: string[] | null
          music_subscriptions?: string[] | null
          operating_systems?: string[] | null
          streaming_subscriptions?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string | null
          id: string
          interests: string[] | null
          product_categories: string[] | null
          skills: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interests?: string[] | null
          product_categories?: string[] | null
          skills?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interests?: string[] | null
          product_categories?: string[] | null
          skills?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_social_presence: {
        Row: {
          additional_links: string[] | null
          created_at: string | null
          id: string
          other_social_networks: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_links?: string[] | null
          created_at?: string | null
          id?: string
          other_social_networks?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_links?: string[] | null
          created_at?: string | null
          id?: string
          other_social_networks?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_social_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_tech_fluency: {
        Row: {
          ai_interests: string[] | null
          ai_models_used: string[] | null
          coding_experience_years: number | null
          created_at: string | null
          id: string
          programming_languages: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_interests?: string[] | null
          ai_models_used?: string[] | null
          coding_experience_years?: number | null
          created_at?: string | null
          id?: string
          programming_languages?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_interests?: string[] | null
          ai_models_used?: string[] | null
          coding_experience_years?: number | null
          created_at?: string | null
          id?: string
          programming_languages?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_account_type_by_domain: {
        Args: { user_id_param: string; user_email: string }
        Returns: Json
      }
      calculate_profile_completion: {
        Args: { user_uuid: string }
        Returns: number
      }
      check_email_exists_for_account_type: {
        Args: { email_param: string; account_type_param: string }
        Returns: boolean
      }
      cleanup_expired_otp: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_enhanced_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_error_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      ensure_profile_exists: {
        Args: { user_uuid: string; user_email: string; user_full_name?: string }
        Returns: boolean
      }
      ensure_user_has_account_type: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
      fix_existing_users_without_account_types: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_account_type: {
        Args: { user_id_param?: string }
        Returns: string
      }
      is_user_account: {
        Args: { user_id_param?: string }
        Returns: boolean
      }
      monitor_account_type_coverage: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_password_requirements: {
        Args: { password_hash: string }
        Returns: boolean
      }
      validate_password_strength: {
        Args: { password: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
