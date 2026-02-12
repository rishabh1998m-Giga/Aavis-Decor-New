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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string | null
          full_name: string
          id: string
          is_default: boolean | null
          phone: string
          pincode: string
          state: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string | null
          full_name: string
          id?: string
          is_default?: boolean | null
          phone: string
          pincode: string
          state: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string | null
          full_name?: string
          id?: string
          is_default?: boolean | null
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      collection_products: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          rules: Json | null
          slug: string
          sort_order: number
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          rules?: Json | null
          slug: string
          sort_order?: number
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          rules?: Json | null
          slug?: string
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      discounts: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_cart_value: number | null
          type: string
          updated_at: string | null
          usage_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_cart_value?: number | null
          type: string
          updated_at?: string | null
          usage_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_cart_value?: number | null
          type?: string
          updated_at?: string | null
          usage_count?: number
          value?: number
        }
        Relationships: []
      }
      gst_settings: {
        Row: {
          business_address: string | null
          business_name: string | null
          business_state: string | null
          created_at: string | null
          default_gst_rate: number | null
          gstin: string | null
          id: string
          invoice_prefix: string | null
          is_gst_inclusive: boolean | null
          next_invoice_number: number | null
          updated_at: string | null
        }
        Insert: {
          business_address?: string | null
          business_name?: string | null
          business_state?: string | null
          created_at?: string | null
          default_gst_rate?: number | null
          gstin?: string | null
          id?: string
          invoice_prefix?: string | null
          is_gst_inclusive?: boolean | null
          next_invoice_number?: number | null
          updated_at?: string | null
        }
        Update: {
          business_address?: string | null
          business_name?: string | null
          business_state?: string | null
          created_at?: string | null
          default_gst_rate?: number | null
          gstin?: string | null
          id?: string
          invoice_prefix?: string | null
          is_gst_inclusive?: boolean | null
          next_invoice_number?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          gst_amount: number | null
          gst_rate: number | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
          variant_info: string | null
        }
        Insert: {
          created_at?: string | null
          gst_amount?: number | null
          gst_rate?: number | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
          variant_info?: string | null
        }
        Update: {
          created_at?: string | null
          gst_amount?: number | null
          gst_rate?: number | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
          variant_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          cod_fee: number | null
          created_at: string | null
          customer_gstin: string | null
          discount_amount: number | null
          discount_code: string | null
          fulfillment_status: string
          gst_amount: number | null
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          shipping_address: Json | null
          shipping_amount: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          total_amount: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          cod_fee?: number | null
          created_at?: string | null
          customer_gstin?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          fulfillment_status?: string
          gst_amount?: number | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          cod_fee?: number | null
          created_at?: string | null
          customer_gstin?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          fulfillment_status?: string
          gst_amount?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          total_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          error_description: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          order_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          refund_amount: number | null
          refund_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          error_description?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          error_description?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          refund_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pincode_serviceability: {
        Row: {
          city: string | null
          created_at: string | null
          estimated_days: number | null
          id: string
          is_cod_available: boolean | null
          is_serviceable: boolean | null
          pincode: string
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          is_cod_available?: boolean | null
          is_serviceable?: boolean | null
          pincode: string
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          is_cod_available?: boolean | null
          is_serviceable?: boolean | null
          pincode?: string
          state?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
          url: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
          url: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          compare_at_price: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          low_stock_threshold: number | null
          price: number
          product_id: string
          size: string | null
          sku: string
          stock_quantity: number | null
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          color?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          price: number
          product_id: string
          size?: string | null
          sku: string
          stock_quantity?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          color?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          price?: number
          product_id?: string
          size?: string | null
          sku?: string
          stock_quantity?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          care_instructions: string | null
          category_id: string | null
          compare_at_price: number | null
          created_at: string | null
          description: string | null
          design_name: string | null
          dimensions: string | null
          fabric: string | null
          gst_rate: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          meta_description: string | null
          meta_title: string | null
          name: string
          short_description: string | null
          slug: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          care_instructions?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          design_name?: string | null
          dimensions?: string | null
          fabric?: string | null
          gst_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          short_description?: string | null
          slug: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          care_instructions?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          design_name?: string | null
          dimensions?: string | null
          fabric?: string | null
          gst_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          short_description?: string | null
          slug?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipping_rules: {
        Row: {
          cod_fee: number | null
          cod_min_order: number | null
          created_at: string | null
          flat_rate: number | null
          free_shipping_threshold: number | null
          id: string
          is_active: boolean | null
          is_cod_available: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          cod_fee?: number | null
          cod_min_order?: number | null
          created_at?: string | null
          flat_rate?: number | null
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean | null
          is_cod_available?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          cod_fee?: number | null
          cod_min_order?: number | null
          created_at?: string | null
          flat_rate?: number | null
          free_shipping_threshold?: number | null
          id?: string
          is_active?: boolean | null
          is_cod_available?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      decrement_inventory: {
        Args: { p_quantity: number; p_variant_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "returned"
        | "cancelled"
      payment_method: "upi" | "card" | "netbanking" | "wallet" | "cod"
      payment_status: "pending" | "paid" | "failed" | "refunded"
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
      app_role: ["admin", "staff", "customer"],
      order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "returned",
        "cancelled",
      ],
      payment_method: ["upi", "card", "netbanking", "wallet", "cod"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
