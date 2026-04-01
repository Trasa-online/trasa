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
      chat_sessions: {
        Row: {
          ai_extracted: Json | null
          completed_at: string | null
          created_at: string | null
          current_phase: number | null
          id: string
          messages: Json
          route_id: string
          user_id: string
        }
        Insert: {
          ai_extracted?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: number | null
          id?: string
          messages?: Json
          route_id: string
          user_id: string
        }
        Update: {
          ai_extracted?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: number | null
          id?: string
          messages?: Json
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: true
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
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
      creator_places: {
        Row: {
          category: string | null
          city: string
          created_at: string
          creator_handle: string
          description: string | null
          google_maps_url: string | null
          id: string
          instagram_reel_url: string | null
          is_active: boolean
          order_index: number | null
          photo_url: string | null
          place_name: string
          plan_id: string | null
          suggested_time: string | null
        }
        Insert: {
          category?: string | null
          city: string
          created_at?: string
          creator_handle: string
          description?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_reel_url?: string | null
          is_active?: boolean
          order_index?: number | null
          photo_url?: string | null
          place_name: string
          plan_id?: string | null
          suggested_time?: string | null
        }
        Update: {
          category?: string | null
          city?: string
          created_at?: string
          creator_handle?: string
          description?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_reel_url?: string | null
          is_active?: boolean
          order_index?: number | null
          photo_url?: string | null
          place_name?: string
          plan_id?: string | null
          suggested_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_places_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "creator_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_plans: {
        Row: {
          city: string
          created_at: string
          creator_avatar_url: string | null
          creator_handle: string
          creator_social_platform: string | null
          creator_social_url: string | null
          description: string | null
          id: string
          is_active: boolean
          num_days: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          creator_avatar_url?: string | null
          creator_handle: string
          creator_social_platform?: string | null
          creator_social_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          num_days?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          creator_avatar_url?: string | null
          creator_handle?: string
          creator_social_platform?: string | null
          creator_social_url?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          num_days?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      day_considerations: {
        Row: {
          created_at: string | null
          google_place_id: string | null
          id: string
          place_name: string
          rejection_reason: string | null
          route_id: string
        }
        Insert: {
          created_at?: string | null
          google_place_id?: string | null
          id?: string
          place_name: string
          rejection_reason?: string | null
          route_id: string
        }
        Update: {
          created_at?: string | null
          google_place_id?: string | null
          id?: string
          place_name?: string
          rejection_reason?: string | null
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_considerations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      day_deviations: {
        Row: {
          created_at: string | null
          description: string | null
          deviation_type: string
          id: string
          pin_id: string | null
          route_id: string
          trigger: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          deviation_type: string
          id?: string
          pin_id?: string | null
          route_id: string
          trigger?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          deviation_type?: string
          id?: string
          pin_id?: string | null
          route_id?: string
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_deviations_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_deviations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
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
      memory_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          memory_type: string
          metadata: Json | null
          pin_id: string | null
          route_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          pin_id?: string | null
          route_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          pin_id?: string | null
          route_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_embeddings_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_embeddings_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
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
          category: string | null
          cons: string[] | null
          core_decision: string | null
          created_at: string | null
          description: string | null
          expectation_met: string | null
          experience_note: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_transport: boolean | null
          latitude: number | null
          longitude: number | null
          mentioned_users: string[] | null
          name_translations: Json | null
          one_liner: string | null
          optional_note: string | null
          original_creator_id: string | null
          pin_order: number
          place_id: string | null
          place_name: string
          place_type: string | null
          planned_order: number | null
          pros: string[] | null
          rating: number | null
          realized_order: number | null
          recommended_for: string[] | null
          route_id: string
          selected_tags: string[] | null
          sentiment: string | null
          sequence_note: string | null
          sequence_rating: string | null
          skip_reason: string | null
          suggested_time: string | null
          tags: string[] | null
          time_spent: string | null
          timing_tag: string | null
          transport_end: string | null
          transport_type: string | null
          trip_role: string | null
          visited_at: string | null
          was_skipped: boolean | null
          was_spontaneous: boolean | null
        }
        Insert: {
          address: string
          canonical_pin_id?: string | null
          category?: string | null
          cons?: string[] | null
          core_decision?: string | null
          created_at?: string | null
          description?: string | null
          expectation_met?: string | null
          experience_note?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          one_liner?: string | null
          optional_note?: string | null
          original_creator_id?: string | null
          pin_order: number
          place_id?: string | null
          place_name: string
          place_type?: string | null
          planned_order?: number | null
          pros?: string[] | null
          rating?: number | null
          realized_order?: number | null
          recommended_for?: string[] | null
          route_id: string
          selected_tags?: string[] | null
          sentiment?: string | null
          sequence_note?: string | null
          sequence_rating?: string | null
          skip_reason?: string | null
          suggested_time?: string | null
          tags?: string[] | null
          time_spent?: string | null
          timing_tag?: string | null
          transport_end?: string | null
          transport_type?: string | null
          trip_role?: string | null
          visited_at?: string | null
          was_skipped?: boolean | null
          was_spontaneous?: boolean | null
        }
        Update: {
          address?: string
          canonical_pin_id?: string | null
          category?: string | null
          cons?: string[] | null
          core_decision?: string | null
          created_at?: string | null
          description?: string | null
          expectation_met?: string | null
          experience_note?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          one_liner?: string | null
          optional_note?: string | null
          original_creator_id?: string | null
          pin_order?: number
          place_id?: string | null
          place_name?: string
          place_type?: string | null
          planned_order?: number | null
          pros?: string[] | null
          rating?: number | null
          realized_order?: number | null
          recommended_for?: string[] | null
          route_id?: string
          selected_tags?: string[] | null
          sentiment?: string | null
          sequence_note?: string | null
          sequence_rating?: string | null
          skip_reason?: string | null
          suggested_time?: string | null
          tags?: string[] | null
          time_spent?: string | null
          timing_tag?: string | null
          transport_end?: string | null
          transport_type?: string | null
          trip_role?: string | null
          visited_at?: string | null
          was_skipped?: boolean | null
          was_spontaneous?: boolean | null
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
          cons: string[] | null
          deleted_at: string
          deletion_source: string | null
          description: string | null
          expectation_met: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_transport: boolean | null
          latitude: number | null
          longitude: number | null
          mentioned_users: string[] | null
          name_translations: Json | null
          one_liner: string | null
          original_created_at: string | null
          original_creator_id: string | null
          original_pin_id: string
          pin_order: number
          place_name: string
          pros: string[] | null
          rating: number | null
          recommended_for: string[] | null
          route_id: string
          route_title: string | null
          tags: string[] | null
          transport_end: string | null
          transport_type: string | null
          trip_role: string | null
          user_id: string
        }
        Insert: {
          address: string
          can_restore?: boolean | null
          cons?: string[] | null
          deleted_at?: string
          deletion_source?: string | null
          description?: string | null
          expectation_met?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          one_liner?: string | null
          original_created_at?: string | null
          original_creator_id?: string | null
          original_pin_id: string
          pin_order: number
          place_name: string
          pros?: string[] | null
          rating?: number | null
          recommended_for?: string[] | null
          route_id: string
          route_title?: string | null
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          trip_role?: string | null
          user_id: string
        }
        Update: {
          address?: string
          can_restore?: boolean | null
          cons?: string[] | null
          deleted_at?: string
          deletion_source?: string | null
          description?: string | null
          expectation_met?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_transport?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mentioned_users?: string[] | null
          name_translations?: Json | null
          one_liner?: string | null
          original_created_at?: string | null
          original_creator_id?: string | null
          original_pin_id?: string
          pin_order?: number
          place_name?: string
          pros?: string[] | null
          rating?: number | null
          recommended_for?: string[] | null
          route_id?: string
          route_title?: string | null
          tags?: string[] | null
          transport_end?: string | null
          transport_type?: string | null
          trip_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      place_details_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string | null
          id: string
          place_id: string | null
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          place_id?: string | null
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          place_id?: string | null
          response?: Json
        }
        Relationships: []
      }
      place_photo_cache: {
        Row: {
          created_at: string
          id: string
          photo_reference: string
          public_url: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_reference: string
          public_url: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_reference?: string
          public_url?: string
          storage_path?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          best_time: string[] | null
          category: string
          city: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          place_name: string
          price_level: number | null
          rating: number | null
          vibe_tags: string[] | null
        }
        Insert: {
          address?: string | null
          best_time?: string[] | null
          category: string
          city: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          place_name: string
          price_level?: number | null
          rating?: number | null
          vibe_tags?: string[] | null
        }
        Update: {
          address?: string | null
          best_time?: string[] | null
          category?: string
          city?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          place_name?: string
          price_level?: number | null
          rating?: number | null
          vibe_tags?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cookie_consent: string | null
          cookie_consent_at: string | null
          created_at: string | null
          dietary_prefs: string[] | null
          first_name: string | null
          id: string
          onboarding_completed: boolean | null
          travel_interests: string[] | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cookie_consent?: string | null
          cookie_consent_at?: string | null
          created_at?: string | null
          dietary_prefs?: string[] | null
          first_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          travel_interests?: string[] | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cookie_consent?: string | null
          cookie_consent_at?: string | null
          created_at?: string | null
          dietary_prefs?: string[] | null
          first_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          travel_interests?: string[] | null
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          owner_id: string
          slot: number
          used_at: string | null
          used_by_email: string | null
          used_by_name: string | null
          used_by_profile_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          owner_id: string
          slot: number
          used_at?: string | null
          used_by_email?: string | null
          used_by_name?: string | null
          used_by_profile_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          owner_id?: string
          slot?: number
          used_at?: string | null
          used_by_email?: string | null
          used_by_name?: string | null
          used_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_used_by_profile_id_fkey"
            columns: ["used_by_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_used_by_profile_id_fkey"
            columns: ["used_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      route_examples: {
        Row: {
          city: string
          created_at: string | null
          day_metrics: Json | null
          description: string | null
          evaluator_notes: string | null
          id: string
          is_approved: boolean | null
          is_rejected: boolean | null
          personality_type: string
          pins: Json
          title: string
        }
        Insert: {
          city: string
          created_at?: string | null
          day_metrics?: Json | null
          description?: string | null
          evaluator_notes?: string | null
          id?: string
          is_approved?: boolean | null
          is_rejected?: boolean | null
          personality_type: string
          pins?: Json
          title: string
        }
        Update: {
          city?: string
          created_at?: string | null
          day_metrics?: Json | null
          description?: string | null
          evaluator_notes?: string | null
          id?: string
          is_approved?: boolean | null
          is_rejected?: boolean | null
          personality_type?: string
          pins?: Json
          title?: string
        }
        Relationships: []
      }
      route_folders: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          folder_order: number
          id: string
          is_trip: boolean | null
          name: string
          num_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          folder_order?: number
          id?: string
          is_trip?: boolean | null
          name: string
          num_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          folder_order?: number
          id?: string
          is_trip?: boolean | null
          name?: string
          num_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_folders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_folders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      route_templates: {
        Row: {
          city: string
          cover_photos: string[] | null
          created_at: string | null
          creator_handle: string | null
          fork_count: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          personality_type: string | null
          pins: Json | null
          point_count: number | null
          tags: string[] | null
          title: string
        }
        Insert: {
          city: string
          cover_photos?: string[] | null
          created_at?: string | null
          creator_handle?: string | null
          fork_count?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          personality_type?: string | null
          pins?: Json | null
          point_count?: number | null
          tags?: string[] | null
          title: string
        }
        Update: {
          city?: string
          cover_photos?: string[] | null
          created_at?: string | null
          creator_handle?: string | null
          fork_count?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          personality_type?: string | null
          pins?: Json | null
          point_count?: number | null
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          ai_highlight: string | null
          ai_summary: string | null
          ai_tip: string | null
          chat_status: string | null
          city: string | null
          created_at: string | null
          day_number: number | null
          description: string | null
          end_date: string | null
          folder_id: string | null
          folder_order: number | null
          id: string
          intent: Json | null
          is_shared: boolean | null
          pace: string | null
          priorities: string[] | null
          rating: number | null
          review_narrative: string | null
          review_photos: string[] | null
          start_date: string | null
          status: string
          title: string
          trip_type: Database["public"]["Enums"]["trip_type"] | null
          updated_at: string | null
          user_id: string
          views: number
          weather_impact: string | null
        }
        Insert: {
          ai_highlight?: string | null
          ai_summary?: string | null
          ai_tip?: string | null
          chat_status?: string | null
          city?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          folder_order?: number | null
          id?: string
          intent?: Json | null
          is_shared?: boolean | null
          pace?: string | null
          priorities?: string[] | null
          rating?: number | null
          review_narrative?: string | null
          review_photos?: string[] | null
          start_date?: string | null
          status?: string
          title: string
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string | null
          user_id: string
          views?: number
          weather_impact?: string | null
        }
        Update: {
          ai_highlight?: string | null
          ai_summary?: string | null
          ai_tip?: string | null
          chat_status?: string | null
          city?: string | null
          created_at?: string | null
          day_number?: number | null
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          folder_order?: number | null
          id?: string
          intent?: Json | null
          is_shared?: boolean | null
          pace?: string | null
          priorities?: string[] | null
          rating?: number | null
          review_narrative?: string | null
          review_photos?: string[] | null
          start_date?: string | null
          status?: string
          title?: string
          trip_type?: Database["public"]["Enums"]["trip_type"] | null
          updated_at?: string | null
          user_id?: string
          views?: number
          weather_impact?: string | null
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
      scraped_places: {
        Row: {
          category: string | null
          city: string
          creator_name: string | null
          description: string | null
          embedding: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          place_name: string
          post_url: string | null
          scraped_at: string | null
          source_platform: string | null
          tags: string[] | null
          thumbnail_url: string | null
        }
        Insert: {
          category?: string | null
          city: string
          creator_name?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          place_name: string
          post_url?: string | null
          scraped_at?: string | null
          source_platform?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
        }
        Update: {
          category?: string | null
          city?: string
          creator_name?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          place_name?: string
          post_url?: string | null
          scraped_at?: string | null
          source_platform?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      user_insights: {
        Row: {
          category: string
          created_at: string | null
          id: string
          insight: string
          source_route_id: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          insight: string
          source_route_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          insight?: string
          source_route_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_insights_source_route_id_fkey"
            columns: ["source_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          city: string | null
          content: string
          created_at: string
          day_number: number | null
          embedding: string | null
          id: string
          metadata: Json | null
          route_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          content: string
          created_at?: string
          day_number?: number | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          route_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          content?: string
          created_at?: string
          day_number?: number | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          route_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_place_reactions: {
        Row: {
          category: string | null
          city: string
          created_at: string | null
          id: string
          photo_url: string | null
          place_id: string | null
          place_name: string
          reaction: string
          user_id: string
        }
        Insert: {
          category?: string | null
          city: string
          created_at?: string | null
          id?: string
          photo_url?: string | null
          place_id?: string | null
          place_name: string
          reaction: string
          user_id: string
        }
        Update: {
          category?: string | null
          city?: string
          created_at?: string | null
          id?: string
          photo_url?: string | null
          place_id?: string | null
          place_name?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_place_reactions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_place_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_user_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_place_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preference_graph: {
        Row: {
          confidence: number
          evidence_count: number
          id: string
          last_updated: string
          preference_key: string
          preference_value: string
          user_id: string
        }
        Insert: {
          confidence?: number
          evidence_count?: number
          id?: string
          last_updated?: string
          preference_key: string
          preference_value: string
          user_id: string
        }
        Update: {
          confidence?: number
          evidence_count?: number
          id?: string
          last_updated?: string
          preference_key?: string
          preference_value?: string
          user_id?: string
        }
        Relationships: []
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
          referral_code: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          referral_code?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          referral_code?: string | null
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
      match_memories: {
        Args: {
          filter_user_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          metadata: Json
          pin_id: string
          route_id: string
          similarity: number
        }[]
      }
      match_scraped_places: {
        Args: {
          exclude_names?: string[]
          filter_city: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          category: string
          creator_name: string
          description: string
          id: string
          latitude: number
          longitude: number
          place_name: string
          post_url: string
          source_platform: string
          tags: string[]
          thumbnail_url: string
        }[]
      }
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
