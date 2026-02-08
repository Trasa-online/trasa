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
      canonical_pins: {
        Row: {
          address: string | null
          average_rating: number | null
          created_at: string | null
          discovered_at: string | null
          discovered_by_user_id: string | null
          id: string
          latitude: number
          longitude: number
          place_name: string
          total_visits: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          created_at?: string | null
          discovered_at?: string | null
          discovered_by_user_id?: string | null
          id?: string
          latitude: number
          longitude: number
          place_name: string
          total_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          created_at?: string | null
          discovered_at?: string | null
          discovered_by_user_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          place_name?: string
          total_visits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_pins_discovered_by_user_id_fkey"
            columns: ["discovered_by_user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_pins_discovered_by_user_id_fkey"
            columns: ["discovered_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          route_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          route_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          route_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          route_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string | null
          id: string
          read: boolean | null
          route_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          route_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          route_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          pin_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          pin_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_comments_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_visits: {
        Row: {
          created_at: string
          description: string | null
          image_url: string | null
          pin_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          image_url?: string | null
          pin_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          image_url?: string | null
          pin_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_visits_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pins: {
        Row: {
          address: string
          canonical_pin_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_transport: boolean | null
          latitude: number | null
          longitude: number | null
          mentioned_users: string[] | null
          name_translations: Json | null
          original_creator_id: string | null
          pin_order: number
          place_name: string
          rating: number | null
          route_id: string
          tags: string[] | null
          transport_end: string | null
          transport_type: string | null
          visited_at: string | null
        }
        Insert: {
          address: string
          canonical_pin_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          original_creator_id?: string | null
          pin_order: number
          place_name: string
          rating?: number | null
          route_id: string
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          visited_at?: string | null
        }
        Update: {
          address?: string
          canonical_pin_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          original_creator_id?: string | null
          pin_order?: number
          place_name?: string
          rating?: number | null
          route_id?: string
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pins_canonical_pin_id_fkey"
            columns: ["canonical_pin_id"]
            isOneToOne: false
            referencedRelation: "canonical_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_original_creator_id_fkey"
            columns: ["original_creator_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_original_creator_id_fkey"
            columns: ["original_creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pins_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      pins_backup: {
        Row: {
          address: string
          can_restore: boolean | null
          deleted_at: string
          deletion_source: string | null
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_transport: boolean | null
          latitude: number | null
          longitude: number | null
          mentioned_users: string[] | null
          name_translations: Json | null
          original_created_at: string | null
          original_creator_id: string | null
          original_pin_id: string
          pin_order: number
          place_name: string
          rating: number | null
          route_id: string
          route_title: string | null
          tags: string[] | null
          transport_end: string | null
          transport_type: string | null
          user_id: string
        }
        Insert: {
          address: string
          can_restore?: boolean | null
          deleted_at?: string
          deletion_source?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          original_created_at?: string | null
          original_creator_id?: string | null
          original_pin_id: string
          pin_order: number
          place_name: string
          rating?: number | null
          route_id: string
          route_title?: string | null
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          user_id: string
        }
        Update: {
          address?: string
          can_restore?: boolean | null
          deleted_at?: string
          deletion_source?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          original_created_at?: string | null
          original_creator_id?: string | null
          original_pin_id?: string
          pin_order?: number
          place_name?: string
          rating?: number | null
          route_id?: string
          route_title?: string | null
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      route_completions: {
        Row: {
          created_at: string
          route_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          route_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_completions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_folders: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          folder_order: number
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          folder_order?: number
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          folder_order?: number
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      route_notes: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          note_order: number
          note_type: string
          pin_id: string | null
          route_id: string
          text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          note_order?: number
          note_type?: string
          pin_id?: string | null
          route_id: string
          text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          note_order?: number
          note_type?: string
          pin_id?: string | null
          route_id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_notes_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_notes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string | null
          description: string | null
          folder_id: string | null
          folder_order: number | null
          id: string
          rating: number | null
          status: string
          title: string
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string | null
          user_id: string
          views: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          folder_order?: number | null
          id?: string
          rating?: number | null
          status?: string
          title: string
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string | null
          user_id: string
          views?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          folder_order?: number | null
          id?: string
          rating?: number | null
          status?: string
          title?: string
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string | null
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "routes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "route_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_routes: {
        Row: {
          created_at: string | null
          route_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          route_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_routes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          visit_pin_id: string
          visit_user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          visit_pin_id: string
          visit_user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          visit_pin_id?: string
          visit_user_id?: string
        }
        Relationships: []
      }
      visit_likes: {
        Row: {
          created_at: string | null
          user_id: string
          visit_pin_id: string
          visit_user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
          visit_pin_id: string
          visit_user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
          visit_pin_id?: string
          visit_user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_user_stats: {
        Row: {
          avatar_url: string | null
          comments_count: number | null
          id: string | null
          likes_count: number | null
          registered_at: string | null
          routes_count: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_nearby_canonical_pin: {
        Args: { radius_meters?: number; search_lat: number; search_lng: number }
        Returns: string
      }
      find_original_pin_creator: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: string
      }
      get_canonical_pin_stats: {
        Args: { pin_id: string }
        Returns: {
          average_rating: number
          first_visit: string
          latest_visit: string
          total_visits: number
          unique_routes: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_route_views: { Args: { route_id: string }; Returns: undefined }
      restore_pins_from_backup: {
        Args: { p_backup_ids: string[]; p_target_route_id?: string }
        Returns: {
          restored_count: number
          restored_pin_ids: string[]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      notification_type:
        | "like"
        | "comment"
        | "follower"
        | "new_route"
        | "mention"
        | "pin_visit"
        | "route_updated"
        | "visit_comment"
        | "discovery_used"
      trip_type: "planning" | "ongoing" | "completed"
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
      app_role: ["admin", "user"],
      notification_type: [
        "like",
        "comment",
        "follower",
        "new_route",
        "mention",
        "pin_visit",
        "route_updated",
        "visit_comment",
        "discovery_used",
      ],
      trip_type: ["planning", "ongoing", "completed"],
    },
  },
} as const
