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
      audit_logs: {
        Row: {
          action: string
          actor_name: string
          created_at: string
          hotel_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          resource: string
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          resource: string
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          resource?: string
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number
          cancelled_at: string | null
          check_in: string
          check_out: string
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          created_by: string | null
          customer_user_id: string | null
          discount: number
          guest_id: string
          guests_count: number
          hotel_id: string
          id: string
          nights: number | null
          notes: string
          reference: string
          room_id: string | null
          room_rate: number
          room_type_id: string | null
          service_charge: number
          services_total: number
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cancelled_at?: string | null
          check_in: string
          check_out: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_user_id?: string | null
          discount?: number
          guest_id: string
          guests_count?: number
          hotel_id: string
          id?: string
          nights?: number | null
          notes?: string
          reference?: string
          room_id?: string | null
          room_rate?: number
          room_type_id?: string | null
          service_charge?: number
          services_total?: number
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_user_id?: string | null
          discount?: number
          guest_id?: string
          guests_count?: number
          hotel_id?: string
          id?: string
          nights?: number | null
          notes?: string
          reference?: string
          room_id?: string | null
          room_rate?: number
          room_type_id?: string | null
          service_charge?: number
          services_total?: number
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          actual_cash: number | null
          cashier_name: string
          closed_at: string | null
          difference: number | null
          expected_cash: number | null
          hotel_id: string
          id: string
          notes: string
          opened_at: string
          opening_balance: number
          status: Database["public"]["Enums"]["cash_session_status"]
          user_id: string | null
        }
        Insert: {
          actual_cash?: number | null
          cashier_name?: string
          closed_at?: string | null
          difference?: number | null
          expected_cash?: number | null
          hotel_id: string
          id?: string
          notes?: string
          opened_at?: string
          opening_balance?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          user_id?: string | null
        }
        Update: {
          actual_cash?: number | null
          cashier_name?: string
          closed_at?: string | null
          difference?: number | null
          expected_cash?: number | null
          hotel_id?: string
          id?: string
          notes?: string
          opened_at?: string
          opening_balance?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_items: {
        Row: {
          amount: number
          booking_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          hotel_id: string
          id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          booking_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          hotel_id: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          booking_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          hotel_id?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "folio_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          email: string | null
          emergency_contact: string | null
          full_name: string
          hotel_id: string
          id: string
          id_number: string | null
          id_type: string | null
          notes: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          full_name: string
          hotel_id: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          notes?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          full_name?: string
          hotel_id?: string
          id?: string
          id_number?: string | null
          id_type?: string | null
          notes?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_members: {
        Row: {
          created_at: string
          full_name: string
          hotel_id: string
          id: string
          invited_email: string | null
          is_active: boolean
          permissions: string[]
          staff_role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          hotel_id: string
          id?: string
          invited_email?: string | null
          is_active?: boolean
          permissions?: string[]
          staff_role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          hotel_id?: string
          id?: string
          invited_email?: string | null
          is_active?: boolean
          permissions?: string[]
          staff_role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_payment_methods: {
        Row: {
          config: Json
          hotel_id: string
          id: string
          is_enabled: boolean
          method: Database["public"]["Enums"]["payment_method"]
          provider: string
        }
        Insert: {
          config?: Json
          hotel_id: string
          id?: string
          is_enabled?: boolean
          method: Database["public"]["Enums"]["payment_method"]
          provider?: string
        }
        Update: {
          config?: Json
          hotel_id?: string
          id?: string
          is_enabled?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_payment_methods_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          accept_online_bookings: boolean
          address: string
          amenities: string[]
          cancellation_policy: string
          check_in_time: string
          check_out_time: string
          city: string
          country: string
          cover_url: string | null
          created_at: string
          currency: string
          description: string
          email: string | null
          hotel_type: string
          id: string
          is_demo: boolean
          is_featured: boolean
          is_public_listed: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          onboarding_completed: boolean
          onboarding_step: number
          owner_id: string | null
          phone: string | null
          rating: number
          region: string
          rejection_reason: string | null
          room_count: number
          service_charge_percent: number
          show_availability: boolean
          show_prices: boolean
          slug: string
          status: Database["public"]["Enums"]["hotel_status"]
          tax_percent: number
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          accept_online_bookings?: boolean
          address?: string
          amenities?: string[]
          cancellation_policy?: string
          check_in_time?: string
          check_out_time?: string
          city?: string
          country?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          email?: string | null
          hotel_type?: string
          id?: string
          is_demo?: boolean
          is_featured?: boolean
          is_public_listed?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          onboarding_completed?: boolean
          onboarding_step?: number
          owner_id?: string | null
          phone?: string | null
          rating?: number
          region?: string
          rejection_reason?: string | null
          room_count?: number
          service_charge_percent?: number
          show_availability?: boolean
          show_prices?: boolean
          slug: string
          status?: Database["public"]["Enums"]["hotel_status"]
          tax_percent?: number
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          accept_online_bookings?: boolean
          address?: string
          amenities?: string[]
          cancellation_policy?: string
          check_in_time?: string
          check_out_time?: string
          city?: string
          country?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          email?: string | null
          hotel_type?: string
          id?: string
          is_demo?: boolean
          is_featured?: boolean
          is_public_listed?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          owner_id?: string | null
          phone?: string | null
          rating?: number
          region?: string
          rejection_reason?: string | null
          room_count?: number
          service_charge_percent?: number
          show_availability?: boolean
          show_prices?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["hotel_status"]
          tax_percent?: number
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          hotel_id: string | null
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          cash_session_id: string | null
          created_at: string
          currency: string
          guest_id: string | null
          hotel_id: string
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string | null
          provider: string
          provider_reference: string | null
          reason: string
          receipt_number: string
          received_by: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          hotel_id: string
          id?: string
          metadata?: Json
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          reason?: string
          receipt_number?: string
          received_by?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          currency?: string
          guest_id?: string | null
          hotel_id?: string
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          reason?: string
          receipt_number?: string
          received_by?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          auto_approve_hotels: boolean
          commission_percent: number
          id: boolean
          platform_name: string
          support_email: string
          updated_at: string
        }
        Insert: {
          auto_approve_hotels?: boolean
          commission_percent?: number
          id?: boolean
          platform_name?: string
          support_email?: string
          updated_at?: string
        }
        Update: {
          auto_approve_hotels?: boolean
          commission_percent?: number
          id?: boolean
          platform_name?: string
          support_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          amenities: string[]
          base_price: number
          bed_count: number
          bed_type: string
          created_at: string
          description: string
          hotel_id: string
          id: string
          images: string[]
          is_active: boolean
          max_guests: number
          name: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          base_price?: number
          bed_count?: number
          bed_type?: string
          created_at?: string
          description?: string
          hotel_id: string
          id?: string
          images?: string[]
          is_active?: boolean
          max_guests?: number
          name: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          base_price?: number
          bed_count?: number
          bed_type?: string
          created_at?: string
          description?: string
          hotel_id?: string
          id?: string
          images?: string[]
          is_active?: boolean
          max_guests?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor: string
          hotel_id: string
          id: string
          notes: string
          room_number: string
          room_type_id: string | null
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor?: string
          hotel_id: string
          id?: string
          notes?: string
          room_number: string
          room_type_id?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor?: string
          hotel_id?: string
          id?: string
          notes?: string
          room_number?: string
          room_type_id?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
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
      has_hotel_access: { Args: { _hotel_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hotel_is_public: { Args: { _hotel_id: string }; Returns: boolean }
      is_demo_hotel: { Args: { _hotel_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      owns_hotel: { Args: { _hotel_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "platform_admin" | "hotel_owner" | "hotel_staff" | "customer"
      booking_source: "staff" | "hotel_website" | "discovery" | "external"
      booking_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      cash_session_status: "open" | "closed"
      hotel_status: "pending" | "active" | "suspended" | "rejected" | "archived"
      payment_method: "mobile_money" | "cash" | "bank_transfer" | "card"
      payment_status:
        | "pending"
        | "processing"
        | "successful"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      room_status:
        | "available"
        | "reserved"
        | "occupied"
        | "cleaning"
        | "dirty"
        | "inspected"
        | "maintenance"
        | "out_of_service"
      staff_role:
        | "manager"
        | "receptionist"
        | "cashier"
        | "accountant"
        | "housekeeping"
        | "restaurant"
        | "other"
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
      app_role: ["platform_admin", "hotel_owner", "hotel_staff", "customer"],
      booking_source: ["staff", "hotel_website", "discovery", "external"],
      booking_status: [
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      cash_session_status: ["open", "closed"],
      hotel_status: ["pending", "active", "suspended", "rejected", "archived"],
      payment_method: ["mobile_money", "cash", "bank_transfer", "card"],
      payment_status: [
        "pending",
        "processing",
        "successful",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      room_status: [
        "available",
        "reserved",
        "occupied",
        "cleaning",
        "dirty",
        "inspected",
        "maintenance",
        "out_of_service",
      ],
      staff_role: [
        "manager",
        "receptionist",
        "cashier",
        "accountant",
        "housekeeping",
        "restaurant",
        "other",
      ],
    },
  },
} as const
