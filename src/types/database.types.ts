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
      acquisition_attributions: {
        Row: {
          attributed_at: string
          attributed_holder_id: string
          attributed_holder_type: string
          converted_at: string | null
          converted_company_id: string | null
          id: string
          idempotency_key: string
          metadata: Json
          program_id: string
          source_code: string | null
          source_type: string
        }
        Insert: {
          attributed_at?: string
          attributed_holder_id: string
          attributed_holder_type: string
          converted_at?: string | null
          converted_company_id?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          program_id: string
          source_code?: string | null
          source_type: string
        }
        Update: {
          attributed_at?: string
          attributed_holder_id?: string
          attributed_holder_type?: string
          converted_at?: string | null
          converted_company_id?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          program_id?: string
          source_code?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "acquisition_attributions_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisition_attributions_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "acquisition_attributions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_offer_orders: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          asaas_bank_slip_url: string | null
          asaas_customer_id: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          asaas_pix_copy_paste: string | null
          asaas_pix_qr_code: string | null
          buyer_company_id: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          campaign_id: string | null
          created_at: string | null
          created_by: string | null
          credits_amount: number
          gross_amount_cents: number
          id: string
          metadata: Json | null
          mpm_fee_rule_id: string | null
          notes: string | null
          offer_id: string
          payment_confirmed_at: string | null
          payment_due_date: string | null
          payment_metadata: Json | null
          payment_method: string
          payment_provider: string | null
          payment_status: string
          payment_webhook_last_event: string | null
          platform_fee_cents: number
          platform_fee_percentage: number
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_message: string | null
          requested_end_date: string | null
          requested_media_asset_id: string | null
          requested_start_date: string | null
          seller_company_id: string
          seller_net_cents: number
          status: string
          updated_at: string | null
          wallet_reservation_id: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asaas_bank_slip_url?: string | null
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          buyer_company_id?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_amount: number
          gross_amount_cents: number
          id?: string
          metadata?: Json | null
          mpm_fee_rule_id?: string | null
          notes?: string | null
          offer_id: string
          payment_confirmed_at?: string | null
          payment_due_date?: string | null
          payment_metadata?: Json | null
          payment_method?: string
          payment_provider?: string | null
          payment_status?: string
          payment_webhook_last_event?: string | null
          platform_fee_cents: number
          platform_fee_percentage: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_message?: string | null
          requested_end_date?: string | null
          requested_media_asset_id?: string | null
          requested_start_date?: string | null
          seller_company_id: string
          seller_net_cents: number
          status?: string
          updated_at?: string | null
          wallet_reservation_id?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asaas_bank_slip_url?: string | null
          asaas_customer_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          buyer_company_id?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_amount?: number
          gross_amount_cents?: number
          id?: string
          metadata?: Json | null
          mpm_fee_rule_id?: string | null
          notes?: string | null
          offer_id?: string
          payment_confirmed_at?: string | null
          payment_due_date?: string | null
          payment_metadata?: Json | null
          payment_method?: string
          payment_provider?: string | null
          payment_status?: string
          payment_webhook_last_event?: string | null
          platform_fee_cents?: number
          platform_fee_percentage?: number
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_message?: string | null
          requested_end_date?: string | null
          requested_media_asset_id?: string | null
          requested_start_date?: string | null
          seller_company_id?: string
          seller_net_cents?: number
          status?: string
          updated_at?: string | null
          wallet_reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_offer_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ad_offer_orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_mpm_fee_rule_id_fkey"
            columns: ["mpm_fee_rule_id"]
            isOneToOne: false
            referencedRelation: "platform_fee_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "company_ad_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_requested_media_asset_id_fkey"
            columns: ["requested_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_offer_orders_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ad_offer_orders_wallet_reservation_id_fkey"
            columns: ["wallet_reservation_id"]
            isOneToOne: false
            referencedRelation: "wallet_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_order_delivery_ledger: {
        Row: {
          buyer_company_id: string
          campaign_id: string
          created_at: string | null
          credits_contracted: number
          credits_delivered: number
          credits_remaining: number
          id: string
          order_id: string
          seller_company_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          buyer_company_id: string
          campaign_id: string
          created_at?: string | null
          credits_contracted: number
          credits_delivered?: number
          credits_remaining: number
          id?: string
          order_id: string
          seller_company_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          buyer_company_id?: string
          campaign_id?: string
          created_at?: string | null
          credits_contracted?: number
          credits_delivered?: number
          credits_remaining?: number
          id?: string
          order_id?: string
          seller_company_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_order_delivery_ledger_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_ledger_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ad_order_delivery_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_ledger_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_ledger_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ad_order_delivery_usage: {
        Row: {
          campaign_id: string
          created_at: string | null
          credits_used: number
          delivery_ledger_id: string
          failure_reason: string | null
          id: string
          media_asset_id: string
          order_id: string
          playback_log_id: string
          screen_id: string
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          credits_used: number
          delivery_ledger_id: string
          failure_reason?: string | null
          id?: string
          media_asset_id: string
          order_id: string
          playback_log_id: string
          screen_id: string
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          credits_used?: number
          delivery_ledger_id?: string
          failure_reason?: string | null
          id?: string
          media_asset_id?: string
          order_id?: string
          playback_log_id?: string
          screen_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_order_delivery_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_usage_delivery_ledger_id_fkey"
            columns: ["delivery_ledger_id"]
            isOneToOne: false
            referencedRelation: "ad_order_delivery_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_usage_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_usage_playback_log_id_fkey"
            columns: ["playback_log_id"]
            isOneToOne: true
            referencedRelation: "playback_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_order_delivery_usage_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_profiles: {
        Row: {
          affiliate_type: string
          attribution_code: string
          company_id: string | null
          created_at: string
          display_name: string
          id: string
          metadata: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliate_type: string
          attribution_code: string
          company_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliate_type?: string
          attribution_code?: string
          company_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          metadata?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "affiliate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_payment_events: {
        Row: {
          ad_offer_order_id: string | null
          asaas_event_id: string | null
          asaas_payment_id: string
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payment_status: string
          processed_at: string | null
          processing_status: string
          raw_payload: Json
          webhook_idempotency_key: string
        }
        Insert: {
          ad_offer_order_id?: string | null
          asaas_event_id?: string | null
          asaas_payment_id: string
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payment_status: string
          processed_at?: string | null
          processing_status?: string
          raw_payload: Json
          webhook_idempotency_key: string
        }
        Update: {
          ad_offer_order_id?: string | null
          asaas_event_id?: string | null
          asaas_payment_id?: string
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payment_status?: string
          processed_at?: string | null
          processing_status?: string
          raw_payload?: Json
          webhook_idempotency_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_payment_events_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_reconciliation_reviews: {
        Row: {
          ad_offer_order_id: string | null
          asaas_payment_event_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string | null
        }
        Insert: {
          ad_offer_order_id?: string | null
          asaas_payment_event_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_offer_order_id?: string | null
          asaas_payment_event_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_reconciliation_reviews_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_reconciliation_reviews_asaas_payment_event_id_fkey"
            columns: ["asaas_payment_event_id"]
            isOneToOne: false
            referencedRelation: "asaas_payment_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_reconciliation_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_matching_requirements: {
        Row: {
          blocked_companies: string[]
          blocked_segments: string[]
          campaign_id: string
          category: string | null
          created_at: string
          max_budget_credits: number | null
          max_frequency_per_inventory: number | null
          metadata: Json
          priority_contract_level: number
          target_cities: string[]
          target_states: string[]
          updated_at: string
        }
        Insert: {
          blocked_companies?: string[]
          blocked_segments?: string[]
          campaign_id: string
          category?: string | null
          created_at?: string
          max_budget_credits?: number | null
          max_frequency_per_inventory?: number | null
          metadata?: Json
          priority_contract_level?: number
          target_cities?: string[]
          target_states?: string[]
          updated_at?: string
        }
        Update: {
          blocked_companies?: string[]
          blocked_segments?: string[]
          campaign_id?: string
          category?: string | null
          created_at?: string
          max_budget_credits?: number | null
          max_frequency_per_inventory?: number | null
          metadata?: Json
          priority_contract_level?: number
          target_cities?: string[]
          target_states?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_matching_requirements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_media: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          media_asset_id: string
          playback_duration_seconds: number
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_asset_id: string
          playback_duration_seconds: number
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_asset_id?: string
          playback_duration_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_media_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_screens: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          screen_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          screen_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_screens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_screens_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ad_offer_order_id: string | null
          buyer_company_id: string | null
          campaign_type: string
          company_id: string
          created_at: string | null
          created_by: string | null
          credits_contracted: number | null
          credits_delivered: number | null
          delivered_insertions: number | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          seller_company_id: string | null
          start_date: string | null
          status: string
          target_insertions: number | null
          updated_at: string | null
        }
        Insert: {
          ad_offer_order_id?: string | null
          buyer_company_id?: string | null
          campaign_type?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          credits_contracted?: number | null
          credits_delivered?: number | null
          delivered_insertions?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          seller_company_id?: string | null
          start_date?: string | null
          status?: string
          target_insertions?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_offer_order_id?: string | null
          buyer_company_id?: string | null
          campaign_type?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          credits_contracted?: number | null
          credits_delivered?: number | null
          delivered_insertions?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          seller_company_id?: string | null
          start_date?: string | null
          status?: string
          target_insertions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      cashout_requests: {
        Row: {
          amount_credits: number
          block_reasons: string[]
          external_transfer_id: string | null
          id: string
          idempotency_key: string
          metadata: Json
          payout_account_id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          simulation_only: boolean
          status: string
          wallet_account_id: string
        }
        Insert: {
          amount_credits: number
          block_reasons?: string[]
          external_transfer_id?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          payout_account_id: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          simulation_only?: boolean
          status?: string
          wallet_account_id: string
        }
        Update: {
          amount_credits?: number
          block_reasons?: string[]
          external_transfer_id?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          payout_account_id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          simulation_only?: boolean
          status?: string
          wallet_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashout_requests_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashout_requests_wallet_account_id_fkey"
            columns: ["wallet_account_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accepts_exchange: boolean | null
          accepts_external_media: boolean | null
          address: string | null
          city: string
          cnpj: string | null
          corporate_name: string | null
          created_at: string | null
          id: string
          neighborhood: string | null
          state: string
          trade_name: string
          updated_at: string | null
        }
        Insert: {
          accepts_exchange?: boolean | null
          accepts_external_media?: boolean | null
          address?: string | null
          city: string
          cnpj?: string | null
          corporate_name?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          state: string
          trade_name: string
          updated_at?: string | null
        }
        Update: {
          accepts_exchange?: boolean | null
          accepts_external_media?: boolean | null
          address?: string | null
          city?: string
          cnpj?: string | null
          corporate_name?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          state?: string
          trade_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_ad_offers: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          credits_amount: number
          description: string | null
          duration_seconds: number | null
          id: string
          is_public: boolean | null
          metadata: Json | null
          platform_fee_cents: number | null
          platform_fee_percentage: number
          price_cents: number
          rejection_reason: string | null
          requires_approval: boolean | null
          seller_net_cents: number | null
          status: string
          title: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          credits_amount: number
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          platform_fee_cents?: number | null
          platform_fee_percentage?: number
          price_cents: number
          rejection_reason?: string | null
          requires_approval?: boolean | null
          seller_net_cents?: number | null
          status?: string
          title: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          credits_amount?: number
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          platform_fee_cents?: number | null
          platform_fee_percentage?: number
          price_cents?: number
          rejection_reason?: string | null
          requires_approval?: boolean | null
          seller_net_cents?: number | null
          status?: string
          title?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_ad_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_ad_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_ad_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_network_preferences: {
        Row: {
          accepts_network_ads: boolean | null
          blocked_companies: string[] | null
          blocked_segments: string[] | null
          company_id: string
          max_external_grade_percentage: number | null
          notes: string | null
          requires_manual_approval: boolean | null
          updated_at: string | null
        }
        Insert: {
          accepts_network_ads?: boolean | null
          blocked_companies?: string[] | null
          blocked_segments?: string[] | null
          company_id: string
          max_external_grade_percentage?: number | null
          notes?: string | null
          requires_manual_approval?: boolean | null
          updated_at?: string | null
        }
        Update: {
          accepts_network_ads?: boolean | null
          blocked_companies?: string[] | null
          blocked_segments?: string[] | null
          company_id?: string
          max_external_grade_percentage?: number | null
          notes?: string | null
          requires_manual_approval?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_network_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_network_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_onboarding_progress: {
        Row: {
          company_id: string
          created_at: string
          dont_show_again: boolean
          first_campaign_started_at: string | null
          first_invite_copied_at: string | null
          first_media_uploaded_at: string | null
          first_playback_detected_at: string | null
          first_playlist_created_at: string | null
          first_screen_created_at: string | null
          first_screen_paired_at: string | null
          id: string
          metadata: Json
          tour_completed_at: string | null
          tour_seen_at: string | null
          tour_skipped_at: string | null
          tour_started_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dont_show_again?: boolean
          first_campaign_started_at?: string | null
          first_invite_copied_at?: string | null
          first_media_uploaded_at?: string | null
          first_playback_detected_at?: string | null
          first_playlist_created_at?: string | null
          first_screen_created_at?: string | null
          first_screen_paired_at?: string | null
          id?: string
          metadata?: Json
          tour_completed_at?: string | null
          tour_seen_at?: string | null
          tour_skipped_at?: string | null
          tour_started_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dont_show_again?: boolean
          first_campaign_started_at?: string | null
          first_invite_copied_at?: string | null
          first_media_uploaded_at?: string | null
          first_playback_detected_at?: string | null
          first_playlist_created_at?: string | null
          first_screen_created_at?: string | null
          first_screen_paired_at?: string | null
          id?: string
          metadata?: Json
          tour_completed_at?: string | null
          tour_seen_at?: string | null
          tour_skipped_at?: string | null
          tour_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_onboarding_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_segments: {
        Row: {
          company_id: string
          is_primary: boolean | null
          segment_id: string
        }
        Insert: {
          company_id: string
          is_primary?: boolean | null
          segment_id: string
        }
        Update: {
          company_id?: string
          is_primary?: boolean | null
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      company_term_acceptances: {
        Row: {
          acceptance_context: string | null
          accepted_at: string | null
          accepted_by: string
          company_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          term_id: string
          user_agent: string | null
        }
        Insert: {
          acceptance_context?: string | null
          accepted_at?: string | null
          accepted_by: string
          company_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          term_id: string
          user_agent?: string | null
        }
        Update: {
          acceptance_context?: string | null
          accepted_at?: string | null
          accepted_by?: string
          company_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          term_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_term_acceptances_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_term_acceptances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_term_acceptances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_term_acceptances_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "platform_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      company_trials: {
        Row: {
          cancelled_at: string | null
          company_id: string
          converted_at: string | null
          created_at: string | null
          created_by: string | null
          free_days: number
          id: string
          metadata: Json
          status: string
          trial_days: number
          trial_end_date: string
          trial_start_date: string
          trial_type: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          free_days?: number
          id?: string
          metadata?: Json
          status?: string
          trial_days?: number
          trial_end_date?: string
          trial_start_date?: string
          trial_type?: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          converted_at?: string | null
          created_at?: string | null
          created_by?: string | null
          free_days?: number
          id?: string
          metadata?: Json
          status?: string
          trial_days?: number
          trial_end_date?: string
          trial_start_date?: string
          trial_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_trials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_trials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_trials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sources: {
        Row: {
          category: string | null
          city: string | null
          created_at: string
          created_by: string
          expiry_hours: number
          id: string
          is_active: boolean
          last_error: string | null
          last_fetched_at: string | null
          last_success_at: string | null
          metadata: Json
          refresh_interval_minutes: number
          region: string | null
          requires_manual_approval: boolean
          source_name: string
          source_type: string
          source_url: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          expiry_hours?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          refresh_interval_minutes?: number
          region?: string | null
          requires_manual_approval?: boolean
          source_name: string
          source_type?: string
          source_url: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          expiry_hours?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          refresh_interval_minutes?: number
          region?: string | null
          requires_manual_approval?: boolean
          source_name?: string
          source_type?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_campaign_offers: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string
          expires_at: string | null
          id: string
          offered_credits: number
          rate_card_id: string | null
          responded_at: string | null
          response_reason: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id: string
          expires_at?: string | null
          id?: string
          offered_credits: number
          rate_card_id?: string | null
          responded_at?: string | null
          response_reason?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          id?: string
          offered_credits?: number
          rate_card_id?: string | null
          responded_at?: string | null
          response_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_campaign_offers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_campaign_offers_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_campaign_offers_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "creator_rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_metric_snapshots: {
        Row: {
          advertiser_rating: number | null
          captured_at: string
          completed_campaigns: number
          creator_id: string
          delayed_campaigns: number
          engagement_rate: number
          follower_growth: number
          followers: number
          id: string
          local_relevance: number
          metrics: Json
          refused_campaigns: number
          social_snapshot_id: string | null
          views: number
        }
        Insert: {
          advertiser_rating?: number | null
          captured_at?: string
          completed_campaigns?: number
          creator_id: string
          delayed_campaigns?: number
          engagement_rate?: number
          follower_growth?: number
          followers?: number
          id?: string
          local_relevance?: number
          metrics?: Json
          refused_campaigns?: number
          social_snapshot_id?: string | null
          views?: number
        }
        Update: {
          advertiser_rating?: number | null
          captured_at?: string
          completed_campaigns?: number
          creator_id?: string
          delayed_campaigns?: number
          engagement_rate?: number
          follower_growth?: number
          followers?: number
          id?: string
          local_relevance?: number
          metrics?: Json
          refused_campaigns?: number
          social_snapshot_id?: string | null
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_metric_snapshots_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_metric_snapshots_social_snapshot_id_fkey"
            columns: ["social_snapshot_id"]
            isOneToOne: false
            referencedRelation: "social_metric_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          creator_score: number
          display_name: string
          id: string
          media_value_score: number
          metadata: Json
          niches: string[]
          state: string | null
          status: string
          terms_accepted_at: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          creator_score?: number
          display_name: string
          id?: string
          media_value_score?: number
          metadata?: Json
          niches?: string[]
          state?: string | null
          status?: string
          terms_accepted_at?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          creator_score?: number
          display_name?: string
          id?: string
          media_value_score?: number
          metadata?: Json
          niches?: string[]
          state?: string | null
          status?: string
          terms_accepted_at?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_rate_cards: {
        Row: {
          available_from: string | null
          available_until: string | null
          created_at: string
          creator_id: string
          format: string
          id: string
          is_active: boolean
          metadata: Json
          price_credits: number
          social_channel_id: string | null
          turnaround_hours: number
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          creator_id: string
          format: string
          id?: string
          is_active?: boolean
          metadata?: Json
          price_credits: number
          social_channel_id?: string | null
          turnaround_hours?: number
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          created_at?: string
          creator_id?: string
          format?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          price_credits?: number
          social_channel_id?: string | null
          turnaround_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_rate_cards_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_rate_cards_social_channel_id_fkey"
            columns: ["social_channel_id"]
            isOneToOne: false
            referencedRelation: "social_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_reviews: {
        Row: {
          campaign_id: string
          comment: string | null
          created_at: string
          creator_id: string
          id: string
          rating: number
          reviewer_company_id: string
        }
        Insert: {
          campaign_id: string
          comment?: string | null
          created_at?: string
          creator_id: string
          id?: string
          rating: number
          reviewer_company_id: string
        }
        Update: {
          campaign_id?: string
          comment?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          rating?: number
          reviewer_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_reviews_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_reviews_reviewer_company_id_fkey"
            columns: ["reviewer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_reviews_reviewer_company_id_fkey"
            columns: ["reviewer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      creator_score_history: {
        Row: {
          configuration_fingerprint: string
          created_at: string
          creator_id: string
          creator_score: number
          formula_version: string
          id: string
          media_value_score: number
          next_tier_requirements: Json
          score_components: Json
          snapshot_id: string
          tier: string
        }
        Insert: {
          configuration_fingerprint: string
          created_at?: string
          creator_id: string
          creator_score: number
          formula_version: string
          id?: string
          media_value_score: number
          next_tier_requirements?: Json
          score_components: Json
          snapshot_id: string
          tier: string
        }
        Update: {
          configuration_fingerprint?: string
          created_at?: string
          creator_id?: string
          creator_score?: number
          formula_version?: string
          id?: string
          media_value_score?: number
          next_tier_requirements?: Json
          score_components?: Json
          snapshot_id?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_score_history_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_score_history_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "creator_metric_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          created_at: string | null
          credit_type: string
          credits_amount: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credit_type?: string
          credits_amount: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credit_type?: string
          credits_amount?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_policy_rules: {
        Row: {
          ceded_credit_type: string
          ceded_credits: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_external_grade_percentage: number | null
          name: string
          received_credit_type: string
          received_credits: number | null
          requires_manual_approval: boolean | null
          rule_type: string
          updated_at: string | null
          validity_days: number | null
        }
        Insert: {
          ceded_credit_type?: string
          ceded_credits?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_external_grade_percentage?: number | null
          name: string
          received_credit_type?: string
          received_credits?: number | null
          requires_manual_approval?: boolean | null
          rule_type: string
          updated_at?: string | null
          validity_days?: number | null
        }
        Update: {
          ceded_credit_type?: string
          ceded_credits?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_external_grade_percentage?: number | null
          name?: string
          received_credit_type?: string
          received_credits?: number | null
          requires_manual_approval?: boolean | null
          rule_type?: string
          updated_at?: string | null
          validity_days?: number | null
        }
        Relationships: []
      }
      delivery_proofs: {
        Row: {
          campaign_id: string
          contract_id: string
          created_at: string
          delivered_units: number
          evidence: Json
          id: string
          idempotency_key: string
          inventory_id: string
          occurred_at: string
          proof_type: string
          source_id: string
          source_type: string
          status: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          campaign_id: string
          contract_id: string
          created_at?: string
          delivered_units: number
          evidence?: Json
          id?: string
          idempotency_key: string
          inventory_id: string
          occurred_at: string
          proof_type: string
          source_id: string
          source_type: string
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          campaign_id?: string
          contract_id?: string
          created_at?: string
          delivered_units?: number
          evidence?: Json
          id?: string
          idempotency_key?: string
          inventory_id?: string
          occurred_at?: string
          proof_type?: string
          source_id?: string
          source_type?: string
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "media_commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_periods: {
        Row: {
          created_at: string
          entitlement_id: string
          granted_quantity: number
          id: string
          period_end: string
          period_start: string
          released_quantity: number
          status: string
          used_quantity: number
        }
        Insert: {
          created_at?: string
          entitlement_id: string
          granted_quantity: number
          id?: string
          period_end: string
          period_start: string
          released_quantity?: number
          status?: string
          used_quantity?: number
        }
        Update: {
          created_at?: string
          entitlement_id?: string
          granted_quantity?: number
          id?: string
          period_end?: string
          period_start?: string
          released_quantity?: number
          status?: string
          used_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "entitlement_periods_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "inventory_entitlements"
            referencedColumns: ["id"]
          },
        ]
      }
      event_inventory: {
        Row: {
          commercial_capacity: number
          created_at: string
          event_id: string
          id: string
          inventory_name: string
          media_inventory_id: string
          metadata: Json
          sponsor_capacity: number
          status: string
          total_capacity: number
        }
        Insert: {
          commercial_capacity?: number
          created_at?: string
          event_id: string
          id?: string
          inventory_name: string
          media_inventory_id: string
          metadata?: Json
          sponsor_capacity?: number
          status?: string
          total_capacity: number
        }
        Update: {
          commercial_capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          inventory_name?: string
          media_inventory_id?: string
          metadata?: Json
          sponsor_capacity?: number
          status?: string
          total_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_inventory_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_inventory_media_inventory_id_fkey"
            columns: ["media_inventory_id"]
            isOneToOne: true
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          city: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          metadata: Json
          name: string
          owner_company_id: string
          proof_method: string
          starts_at: string
          state: string
          status: string
          updated_at: string
          venue_name: string | null
        }
        Insert: {
          city: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          metadata?: Json
          name: string
          owner_company_id: string
          proof_method?: string
          starts_at: string
          state: string
          status?: string
          updated_at?: string
          venue_name?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          metadata?: Json
          name?: string
          owner_company_id?: string
          proof_method?: string
          starts_at?: string
          state?: string
          status?: string
          updated_at?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      informative_content_items: {
        Row: {
          body: string | null
          category: string | null
          city: string | null
          company_id: string | null
          content_origin: string
          content_source_id: string | null
          created_at: string
          created_by: string
          duration_seconds: number
          end_date: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          media_asset_id: string | null
          metadata: Json
          original_url: string | null
          published_at: string | null
          region: string | null
          rss_dedupe_key: string | null
          segment: string | null
          source_name: string | null
          start_date: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          content_origin: string
          content_source_id?: string | null
          created_at?: string
          created_by: string
          duration_seconds?: number
          end_date?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_asset_id?: string | null
          metadata?: Json
          original_url?: string | null
          published_at?: string | null
          region?: string | null
          rss_dedupe_key?: string | null
          segment?: string | null
          source_name?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          content_origin?: string
          content_source_id?: string | null
          created_at?: string
          created_by?: string
          duration_seconds?: number
          end_date?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_asset_id?: string | null
          metadata?: Json
          original_url?: string | null
          published_at?: string | null
          region?: string | null
          rss_dedupe_key?: string | null
          segment?: string | null
          source_name?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "informative_content_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informative_content_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "informative_content_items_content_source_id_fkey"
            columns: ["content_source_id"]
            isOneToOne: false
            referencedRelation: "content_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informative_content_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informative_content_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_allocations: {
        Row: {
          allocation_type: string
          beneficiary_id: string | null
          beneficiary_type: string
          bucket_policy_id: string
          campaign_id: string | null
          capacity_period_id: string
          consumed_quantity: number
          created_at: string
          created_by: string | null
          ends_at: string
          expires_at: string | null
          id: string
          idempotency_key: string
          insertion_quantity: number
          inventory_id: string
          release_policy: Json
          reserved_quantity: number
          source_id: string | null
          source_type: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          allocation_type: string
          beneficiary_id?: string | null
          beneficiary_type: string
          bucket_policy_id: string
          campaign_id?: string | null
          capacity_period_id: string
          consumed_quantity?: number
          created_at?: string
          created_by?: string | null
          ends_at: string
          expires_at?: string | null
          id?: string
          idempotency_key: string
          insertion_quantity: number
          inventory_id: string
          release_policy?: Json
          reserved_quantity: number
          source_id?: string | null
          source_type: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_type?: string
          beneficiary_id?: string | null
          beneficiary_type?: string
          bucket_policy_id?: string
          campaign_id?: string | null
          capacity_period_id?: string
          consumed_quantity?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          insertion_quantity?: number
          inventory_id?: string
          release_policy?: Json
          reserved_quantity?: number
          source_id?: string | null
          source_type?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_allocations_bucket_policy_id_fkey"
            columns: ["bucket_policy_id"]
            isOneToOne: false
            referencedRelation: "inventory_bucket_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_capacity_period_id_fkey"
            columns: ["capacity_period_id"]
            isOneToOne: false
            referencedRelation: "inventory_capacity_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_allocations_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          allocation_id: string | null
          capacity_period_id: string | null
          created_at: string
          details: Json
          id: string
          inventory_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          allocation_id?: string | null
          capacity_period_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          inventory_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          allocation_id?: string | null
          capacity_period_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          inventory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_logs_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_logs_capacity_period_id_fkey"
            columns: ["capacity_period_id"]
            isOneToOne: false
            referencedRelation: "inventory_capacity_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_logs_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_bucket_policies: {
        Row: {
          allocated_quantity: number
          bucket_type: string
          capacity_period_id: string
          capacity_quantity: number
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          metadata: Json
          reason: string | null
          release_after_day: number | null
          release_lead_days: number | null
          release_to_bucket: string | null
          release_unused_owner_capacity: boolean
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          bucket_type: string
          capacity_period_id: string
          capacity_quantity: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          release_after_day?: number | null
          release_lead_days?: number | null
          release_to_bucket?: string | null
          release_unused_owner_capacity?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          bucket_type?: string
          capacity_period_id?: string
          capacity_quantity?: number
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          release_after_day?: number | null
          release_lead_days?: number | null
          release_to_bucket?: string | null
          release_unused_owner_capacity?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_bucket_policies_capacity_period_id_fkey"
            columns: ["capacity_period_id"]
            isOneToOne: false
            referencedRelation: "inventory_capacity_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_bucket_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_capacity_periods: {
        Row: {
          available_capacity: number
          calculation_inputs: Json
          calculation_source: string
          calculation_version: number
          committed_capacity: number
          created_at: string
          created_by: string | null
          cycle_type: string
          delivered_capacity: number
          id: string
          media_inventory_id: string
          network_capacity: number
          own_use_capacity: number
          period_end: string
          period_start: string
          reserved_capacity: number
          status: string
          theoretical_capacity: number
          updated_at: string
        }
        Insert: {
          available_capacity?: number
          calculation_inputs?: Json
          calculation_source: string
          calculation_version?: number
          committed_capacity?: number
          created_at?: string
          created_by?: string | null
          cycle_type?: string
          delivered_capacity?: number
          id?: string
          media_inventory_id: string
          network_capacity?: number
          own_use_capacity?: number
          period_end: string
          period_start: string
          reserved_capacity?: number
          status?: string
          theoretical_capacity: number
          updated_at?: string
        }
        Update: {
          available_capacity?: number
          calculation_inputs?: Json
          calculation_source?: string
          calculation_version?: number
          committed_capacity?: number
          created_at?: string
          created_by?: string | null
          cycle_type?: string
          delivered_capacity?: number
          id?: string
          media_inventory_id?: string
          network_capacity?: number
          own_use_capacity?: number
          period_end?: string
          period_start?: string
          reserved_capacity?: number
          status?: string
          theoretical_capacity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_capacity_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_capacity_periods_media_inventory_id_fkey"
            columns: ["media_inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_entitlements: {
        Row: {
          beneficiary_id: string
          beneficiary_type: string
          created_at: string
          ends_at: string | null
          enrollment_id: string
          id: string
          insertion_quantity: number
          inventory_id: string | null
          metadata: Json
          program_id: string
          recurrence: string
          starts_at: string
          status: string
          unused_policy: string
        }
        Insert: {
          beneficiary_id: string
          beneficiary_type: string
          created_at?: string
          ends_at?: string | null
          enrollment_id: string
          id?: string
          insertion_quantity: number
          inventory_id?: string | null
          metadata?: Json
          program_id: string
          recurrence?: string
          starts_at: string
          status?: string
          unused_policy?: string
        }
        Update: {
          beneficiary_id?: string
          beneficiary_type?: string
          created_at?: string
          ends_at?: string | null
          enrollment_id?: string
          id?: string
          insertion_quantity?: number
          inventory_id?: string | null
          metadata?: Json
          program_id?: string
          recurrence?: string
          starts_at?: string
          status?: string
          unused_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_entitlements_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "partnership_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_entitlements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_entitlements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_matching_rules: {
        Row: {
          allowed_categories: string[]
          blocked_categories: string[]
          blocked_companies: string[]
          blocked_segments: string[]
          created_at: string
          inventory_id: string
          max_campaign_frequency_monthly: number | null
          metadata: Json
          minimum_budget_credits: number | null
          service_cities: string[]
          service_states: string[]
          updated_at: string
        }
        Insert: {
          allowed_categories?: string[]
          blocked_categories?: string[]
          blocked_companies?: string[]
          blocked_segments?: string[]
          created_at?: string
          inventory_id: string
          max_campaign_frequency_monthly?: number | null
          metadata?: Json
          minimum_budget_credits?: number | null
          service_cities?: string[]
          service_states?: string[]
          updated_at?: string
        }
        Update: {
          allowed_categories?: string[]
          blocked_categories?: string[]
          blocked_companies?: string[]
          blocked_segments?: string[]
          created_at?: string
          inventory_id?: string
          max_campaign_frequency_monthly?: number | null
          metadata?: Json
          minimum_budget_credits?: number | null
          service_cities?: string[]
          service_states?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_matching_rules_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: true
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_preferred_participants: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          inventory_id: string
          max_insertions: number
          preferred_company_id: string
          priority: number
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          inventory_id: string
          max_insertions: number
          preferred_company_id: string
          priority: number
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          inventory_id?: string
          max_insertions?: number
          preferred_company_id?: string
          priority?: number
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_preferred_participants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_preferred_participants_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_preferred_participants_preferred_company_id_fkey"
            columns: ["preferred_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_preferred_participants_preferred_company_id_fkey"
            columns: ["preferred_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      legacy_balance_reconciliations: {
        Row: {
          bridge_ledger_id: string | null
          holder_id: string
          holder_type: string
          id: string
          legacy_record_id: string
          legacy_source: string
          metadata: Json
          observed_amount: number
          observed_at: string
          observed_unit: string
          reconciliation_status: string
        }
        Insert: {
          bridge_ledger_id?: string | null
          holder_id: string
          holder_type: string
          id?: string
          legacy_record_id: string
          legacy_source: string
          metadata?: Json
          observed_amount: number
          observed_at?: string
          observed_unit: string
          reconciliation_status?: string
        }
        Update: {
          bridge_ledger_id?: string | null
          holder_id?: string
          holder_type?: string
          id?: string
          legacy_record_id?: string
          legacy_source?: string
          metadata?: Json
          observed_amount?: number
          observed_at?: string
          observed_unit?: string
          reconciliation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_balance_reconciliations_bridge_ledger_id_fkey"
            columns: ["bridge_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_candidates: {
        Row: {
          available_capacity: number
          bucket_policy_id: string | null
          capacity_period_id: string | null
          created_at: string
          eligible: boolean
          exclusion_reasons: string[]
          id: string
          inventory_id: string
          run_id: string
          score: number
          score_components: Json
        }
        Insert: {
          available_capacity?: number
          bucket_policy_id?: string | null
          capacity_period_id?: string | null
          created_at?: string
          eligible: boolean
          exclusion_reasons?: string[]
          id?: string
          inventory_id: string
          run_id: string
          score?: number
          score_components?: Json
        }
        Update: {
          available_capacity?: number
          bucket_policy_id?: string | null
          capacity_period_id?: string | null
          created_at?: string
          eligible?: boolean
          exclusion_reasons?: string[]
          id?: string
          inventory_id?: string
          run_id?: string
          score?: number
          score_components?: Json
        }
        Relationships: [
          {
            foreignKeyName: "matching_candidates_bucket_policy_id_fkey"
            columns: ["bucket_policy_id"]
            isOneToOne: false
            referencedRelation: "inventory_bucket_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_candidates_capacity_period_id_fkey"
            columns: ["capacity_period_id"]
            isOneToOne: false
            referencedRelation: "inventory_capacity_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_candidates_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_candidates_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "matching_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_decisions: {
        Row: {
          allocated_insertions: number
          allocation_id: string | null
          campaign_id: string
          candidate_id: string
          created_at: string
          decision_reason: string
          id: string
          inventory_id: string
          rank: number
          run_id: string
        }
        Insert: {
          allocated_insertions: number
          allocation_id?: string | null
          campaign_id: string
          candidate_id: string
          created_at?: string
          decision_reason: string
          id?: string
          inventory_id: string
          rank: number
          run_id: string
        }
        Update: {
          allocated_insertions?: number
          allocation_id?: string | null
          campaign_id?: string
          candidate_id?: string
          created_at?: string
          decision_reason?: string
          id?: string
          inventory_id?: string
          rank?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matching_decisions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_decisions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "matching_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_decisions_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "matching_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_runs: {
        Row: {
          algorithm_version: string
          allocated_insertions: number
          buyer_company_id: string
          campaign_id: string
          completed_at: string | null
          id: string
          idempotency_key: string
          metadata: Json
          requested_insertions: number
          started_at: string
          status: string
          weights: Json
        }
        Insert: {
          algorithm_version?: string
          allocated_insertions?: number
          buyer_company_id: string
          campaign_id: string
          completed_at?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          requested_insertions: number
          started_at?: string
          status?: string
          weights?: Json
        }
        Update: {
          algorithm_version?: string
          allocated_insertions?: number
          buyer_company_id?: string
          campaign_id?: string
          completed_at?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          requested_insertions?: number
          started_at?: string
          status?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "matching_runs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_runs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "matching_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          file_name: string | null
          file_path: string
          file_size_bytes: number | null
          file_url: string | null
          height: number | null
          id: string
          is_external: boolean | null
          media_type: string
          mime_type: string
          orientation: string
          owner_only: boolean
          playback_duration_seconds: number
          rejection_reason: string | null
          status: string
          title: string
          trial_internal_only: boolean
          updated_at: string | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_name?: string | null
          file_path: string
          file_size_bytes?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_external?: boolean | null
          media_type: string
          mime_type: string
          orientation?: string
          owner_only?: boolean
          playback_duration_seconds: number
          rejection_reason?: string | null
          status?: string
          title: string
          trial_internal_only?: boolean
          updated_at?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_name?: string | null
          file_path?: string
          file_size_bytes?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_external?: boolean | null
          media_type?: string
          mime_type?: string
          orientation?: string
          owner_only?: boolean
          playback_duration_seconds?: number
          rejection_reason?: string | null
          status?: string
          title?: string
          trial_internal_only?: boolean
          updated_at?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_commercial_contracts: {
        Row: {
          buyer_company_id: string
          campaign_id: string
          contracted_units: number
          created_at: string
          ends_at: string
          fee_percentage: number
          fee_rule_id: string
          gross_credits: number
          id: string
          idempotency_key: string
          inventory_id: string
          metadata: Json
          price_quote_id: string
          settlement_rule_id: string
          starts_at: string
          status: string
          supplier_holder_id: string
          supplier_holder_type: string
          updated_at: string
        }
        Insert: {
          buyer_company_id: string
          campaign_id: string
          contracted_units: number
          created_at?: string
          ends_at: string
          fee_percentage: number
          fee_rule_id: string
          gross_credits: number
          id?: string
          idempotency_key: string
          inventory_id: string
          metadata?: Json
          price_quote_id: string
          settlement_rule_id: string
          starts_at: string
          status?: string
          supplier_holder_id: string
          supplier_holder_type: string
          updated_at?: string
        }
        Update: {
          buyer_company_id?: string
          campaign_id?: string
          contracted_units?: number
          created_at?: string
          ends_at?: string
          fee_percentage?: number
          fee_rule_id?: string
          gross_credits?: number
          id?: string
          idempotency_key?: string
          inventory_id?: string
          metadata?: Json
          price_quote_id?: string
          settlement_rule_id?: string
          starts_at?: string
          status?: string
          supplier_holder_id?: string
          supplier_holder_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_commercial_contracts_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "platform_fee_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_price_quote_id_fkey"
            columns: ["price_quote_id"]
            isOneToOne: false
            referencedRelation: "media_price_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_commercial_contracts_settlement_rule_id_fkey"
            columns: ["settlement_rule_id"]
            isOneToOne: false
            referencedRelation: "settlement_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      media_inventory: {
        Row: {
          channel_family: string
          city: string | null
          commercial_enabled: boolean
          created_at: string
          id: string
          inventory_type: string
          metadata: Json
          orientation: string | null
          owner_id: string
          owner_type: string
          proof_method: string
          source_id: string
          source_type: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel_family: string
          city?: string | null
          commercial_enabled?: boolean
          created_at?: string
          id?: string
          inventory_type: string
          metadata?: Json
          orientation?: string | null
          owner_id: string
          owner_type: string
          proof_method?: string
          source_id: string
          source_type: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel_family?: string
          city?: string | null
          commercial_enabled?: boolean
          created_at?: string
          id?: string
          inventory_type?: string
          metadata?: Json
          orientation?: string | null
          owner_id?: string
          owner_type?: string
          proof_method?: string
          source_id?: string
          source_type?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_price_quotes: {
        Row: {
          buyer_company_id: string | null
          created_at: string
          ends_at: string
          expires_at: string
          gross_credits: number
          id: string
          idempotency_key: string
          insertion_quantity: number
          inventory_id: string
          price_rule_id: string
          pricing_context: Json
          starts_at: string
          status: string
          unit_price_credits: number
        }
        Insert: {
          buyer_company_id?: string | null
          created_at?: string
          ends_at: string
          expires_at: string
          gross_credits: number
          id?: string
          idempotency_key: string
          insertion_quantity: number
          inventory_id: string
          price_rule_id: string
          pricing_context?: Json
          starts_at: string
          status?: string
          unit_price_credits: number
        }
        Update: {
          buyer_company_id?: string | null
          created_at?: string
          ends_at?: string
          expires_at?: string
          gross_credits?: number
          id?: string
          idempotency_key?: string
          insertion_quantity?: number
          inventory_id?: string
          price_rule_id?: string
          pricing_context?: Json
          starts_at?: string
          status?: string
          unit_price_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_price_quotes_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_price_quotes_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "media_price_quotes_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_price_quotes_price_rule_id_fkey"
            columns: ["price_rule_id"]
            isOneToOne: false
            referencedRelation: "media_price_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      media_price_rules: {
        Row: {
          campaign_type: string | null
          channel_family: string | null
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          effective_from: string
          effective_to: string | null
          ends_time: string | null
          format: string | null
          id: string
          inventory_id: string | null
          inventory_type: string | null
          is_active: boolean
          metadata: Json
          occupancy_multiplier: number
          partnership_program_id: string | null
          plan_code: string | null
          priority: number
          starts_time: string | null
          state: string | null
          unit_price_credits: number
          version: number
          weekday: number | null
        }
        Insert: {
          campaign_type?: string | null
          channel_family?: string | null
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          effective_from: string
          effective_to?: string | null
          ends_time?: string | null
          format?: string | null
          id?: string
          inventory_id?: string | null
          inventory_type?: string | null
          is_active?: boolean
          metadata?: Json
          occupancy_multiplier?: number
          partnership_program_id?: string | null
          plan_code?: string | null
          priority?: number
          starts_time?: string | null
          state?: string | null
          unit_price_credits: number
          version?: number
          weekday?: number | null
        }
        Update: {
          campaign_type?: string | null
          channel_family?: string | null
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          effective_from?: string
          effective_to?: string | null
          ends_time?: string | null
          format?: string | null
          id?: string
          inventory_id?: string | null
          inventory_type?: string | null
          is_active?: boolean
          metadata?: Json
          occupancy_multiplier?: number
          partnership_program_id?: string | null
          plan_code?: string | null
          priority?: number
          starts_time?: string | null
          state?: string | null
          unit_price_credits?: number
          version?: number
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_price_rules_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "media_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_price_rules_partnership_program_fkey"
            columns: ["partnership_program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fee_discounts: {
        Row: {
          amount_cents: number
          applied_at: string | null
          applied_by: string
          financial_ledger_id: string | null
          id: string
          metadata: Json | null
          reason: string
          seller_company_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          applied_by: string
          financial_ledger_id?: string | null
          id?: string
          metadata?: Json | null
          reason: string
          seller_company_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          applied_by?: string
          financial_ledger_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string
          seller_company_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fee_discounts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_discounts_financial_ledger_id_fkey"
            columns: ["financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "seller_financial_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_discounts_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_fee_discounts_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      mpm_job_runs: {
        Row: {
          completed_at: string | null
          counters: Json
          error_message: string | null
          id: string
          job_name: string
          run_key: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          counters?: Json
          error_message?: string | null
          id?: string
          job_name: string
          run_key: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          counters?: Json
          error_message?: string | null
          id?: string
          job_name?: string
          run_key?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      mpm_spend_policies: {
        Row: {
          credit_class_order: string[]
          id: string
          is_active: boolean
          metadata: Json
          purpose: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credit_class_order: string[]
          id?: string
          is_active?: boolean
          metadata?: Json
          purpose: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credit_class_order?: string[]
          id?: string
          is_active?: boolean
          metadata?: Json
          purpose?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mpm_subscription_payments: {
        Row: {
          amount_credits: number
          billing_cycle: string
          billing_reference: string
          company_id: string
          created_at: string
          id: string
          idempotency_key: string
          reservation_id: string
          status: string
        }
        Insert: {
          amount_credits: number
          billing_cycle: string
          billing_reference: string
          company_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          reservation_id: string
          status?: string
        }
        Update: {
          amount_credits?: number
          billing_cycle?: string
          billing_reference?: string
          company_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          reservation_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpm_subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mpm_subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "mpm_subscription_payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "wallet_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      network_inventory_ledger: {
        Row: {
          company_id: string
          created_at: string | null
          credit_type: string
          credits_granted: number
          credits_remaining: number
          credits_used: number | null
          expires_at: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string
          status: string
          updated_at: string | null
          valid_from: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          credit_type: string
          credits_granted: number
          credits_remaining: number
          credits_used?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string | null
          valid_from?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          credit_type?: string
          credits_granted?: number
          credits_remaining?: number
          credits_used?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string | null
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_inventory_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      network_inventory_usage: {
        Row: {
          advertiser_company_id: string
          campaign_id: string | null
          created_at: string | null
          credits_used: number
          display_company_id: string
          failure_reason: string | null
          id: string
          inventory_ledger_id: string
          media_asset_id: string
          playback_log_id: string
          screen_id: string
          status: string
        }
        Insert: {
          advertiser_company_id: string
          campaign_id?: string | null
          created_at?: string | null
          credits_used: number
          display_company_id: string
          failure_reason?: string | null
          id?: string
          inventory_ledger_id: string
          media_asset_id: string
          playback_log_id: string
          screen_id: string
          status?: string
        }
        Update: {
          advertiser_company_id?: string
          campaign_id?: string | null
          created_at?: string | null
          credits_used?: number
          display_company_id?: string
          failure_reason?: string | null
          id?: string
          inventory_ledger_id?: string
          media_asset_id?: string
          playback_log_id?: string
          screen_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_inventory_usage_advertiser_company_id_fkey"
            columns: ["advertiser_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_advertiser_company_id_fkey"
            columns: ["advertiser_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "network_inventory_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_display_company_id_fkey"
            columns: ["display_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_display_company_id_fkey"
            columns: ["display_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "network_inventory_usage_inventory_ledger_id_fkey"
            columns: ["inventory_ledger_id"]
            isOneToOne: false
            referencedRelation: "network_inventory_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_playback_log_id_fkey"
            columns: ["playback_log_id"]
            isOneToOne: true
            referencedRelation: "playback_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_inventory_usage_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_campaign_rewards: {
        Row: {
          campaign_id: string
          city: string | null
          company_id: string
          created_at: string
          created_by: string | null
          credit_budget: number
          credits_distributed: number
          credits_required: number
          description: string | null
          expires_at: string
          id: string
          quantity_available: number
          quantity_redeemed: number
          quantity_reserved: number
          quantity_total: number
          starts_at: string
          state: string | null
          status: string
          terms: string | null
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          city?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          credit_budget: number
          credits_distributed?: number
          credits_required: number
          description?: string | null
          expires_at: string
          id?: string
          quantity_available: number
          quantity_redeemed?: number
          quantity_reserved?: number
          quantity_total: number
          starts_at?: string
          state?: string | null
          status?: string
          terms?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          city?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit_budget?: number
          credits_distributed?: number
          credits_required?: number
          description?: string | null
          expires_at?: string
          id?: string
          quantity_available?: number
          quantity_redeemed?: number
          quantity_reserved?: number
          quantity_total?: number
          starts_at?: string
          state?: string | null
          status?: string
          terms?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_campaign_rewards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_campaign_rewards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_campaign_rewards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "organic_campaign_rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_credit_ledger: {
        Row: {
          amount: number
          available_at: string | null
          balance_bucket: string
          created_at: string
          description: string
          id: string
          metadata: Json
          participant_id: string
          playback_event_id: string | null
          reward_id: string | null
          screen_id: string | null
          type: string
        }
        Insert: {
          amount: number
          available_at?: string | null
          balance_bucket: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          participant_id: string
          playback_event_id?: string | null
          reward_id?: string | null
          screen_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          available_at?: string | null
          balance_bucket?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          participant_id?: string
          playback_event_id?: string | null
          reward_id?: string | null
          screen_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_credit_ledger_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "organic_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_credit_ledger_playback_event_id_fkey"
            columns: ["playback_event_id"]
            isOneToOne: true
            referencedRelation: "organic_playback_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_credit_ledger_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "organic_campaign_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_credit_ledger_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "organic_screens"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_pairing_codes: {
        Row: {
          code: string
          created_at: string
          encrypted_device_token: Json | null
          expires_at: string
          id: string
          request_secret_hash: string
          screen_id: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          encrypted_device_token?: Json | null
          expires_at: string
          id?: string
          request_secret_hash: string
          screen_id?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          encrypted_device_token?: Json | null
          expires_at?: string
          id?: string
          request_secret_hash?: string
          screen_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_pairing_codes_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "organic_screens"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_participants: {
        Row: {
          available_balance: number
          city: string
          created_at: string
          display_name: string
          id: string
          lifetime_earned: number
          pending_balance: number
          state: string
          status: string
          terms_accepted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          city: string
          created_at?: string
          display_name: string
          id?: string
          lifetime_earned?: number
          pending_balance?: number
          state?: string
          status?: string
          terms_accepted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          city?: string
          created_at?: string
          display_name?: string
          id?: string
          lifetime_earned?: number
          pending_balance?: number
          state?: string
          status?: string
          terms_accepted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_playback_events: {
        Row: {
          base_credits: number
          campaign_id: string
          created_at: string
          credits_earned: number
          device_multiplier: number
          id: string
          idempotency_key: string
          media_asset_id: string
          participant_id: string
          planned_duration_seconds: number
          played_at: string
          reward_id: string
          screen_id: string
          status: string
        }
        Insert: {
          base_credits: number
          campaign_id: string
          created_at?: string
          credits_earned: number
          device_multiplier?: number
          id?: string
          idempotency_key: string
          media_asset_id: string
          participant_id: string
          planned_duration_seconds: number
          played_at?: string
          reward_id: string
          screen_id: string
          status?: string
        }
        Update: {
          base_credits?: number
          campaign_id?: string
          created_at?: string
          credits_earned?: number
          device_multiplier?: number
          id?: string
          idempotency_key?: string
          media_asset_id?: string
          participant_id?: string
          planned_duration_seconds?: number
          played_at?: string
          reward_id?: string
          screen_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_playback_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_playback_events_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_playback_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "organic_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_playback_events_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "organic_campaign_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_playback_events_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "organic_screens"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_reward_redemptions: {
        Row: {
          created_at: string
          credits_reserved: number
          expires_at: string
          id: string
          participant_id: string
          redeemed_at: string | null
          redemption_code_hash: string
          redemption_code_suffix: string
          reserved_at: string
          reward_id: string
          status: string
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          credits_reserved: number
          expires_at: string
          id?: string
          participant_id: string
          redeemed_at?: string | null
          redemption_code_hash: string
          redemption_code_suffix: string
          reserved_at?: string
          reward_id: string
          status?: string
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          credits_reserved?: number
          expires_at?: string
          id?: string
          participant_id?: string
          redeemed_at?: string | null
          redemption_code_hash?: string
          redemption_code_suffix?: string
          reserved_at?: string
          reward_id?: string
          status?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organic_reward_redemptions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "organic_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "organic_campaign_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organic_reward_redemptions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_screens: {
        Row: {
          allowed_end_time: string | null
          allowed_start_time: string | null
          blocked_categories: string[]
          created_at: string
          daily_credit_limit: number
          device_token_hash: string | null
          device_type: string
          id: string
          idle_start_seconds: number
          last_ping_at: string | null
          name: string
          orientation: string
          paired_at: string | null
          participant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          allowed_end_time?: string | null
          allowed_start_time?: string | null
          blocked_categories?: string[]
          created_at?: string
          daily_credit_limit?: number
          device_token_hash?: string | null
          device_type?: string
          id?: string
          idle_start_seconds?: number
          last_ping_at?: string | null
          name: string
          orientation?: string
          paired_at?: string | null
          participant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_end_time?: string | null
          allowed_start_time?: string | null
          blocked_categories?: string[]
          created_at?: string
          daily_credit_limit?: number
          device_token_hash?: string | null
          device_type?: string
          id?: string
          idle_start_seconds?: number
          last_ping_at?: string | null
          name?: string
          orientation?: string
          paired_at?: string | null
          participant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organic_screens_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "organic_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_programs: {
        Row: {
          attribution_window_days: number
          code: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          name: string
          owner_company_id: string | null
          program_type: string
          recurring_months: number | null
          reward_cap: number | null
          reward_type: string
          reward_value: number
          starts_at: string
          status: string
          terms: Json
        }
        Insert: {
          attribution_window_days?: number
          code: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name: string
          owner_company_id?: string | null
          program_type: string
          recurring_months?: number | null
          reward_cap?: number | null
          reward_type: string
          reward_value?: number
          starts_at?: string
          status?: string
          terms?: Json
        }
        Update: {
          attribution_window_days?: number
          code?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          owner_company_id?: string | null
          program_type?: string
          recurring_months?: number | null
          reward_cap?: number | null
          reward_type?: string
          reward_value?: number
          starts_at?: string
          status?: string
          terms?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partner_programs_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_programs_owner_company_id_fkey"
            columns: ["owner_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      partnership_enrollments: {
        Row: {
          attribution_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          metadata: Json
          participant_id: string
          participant_type: string
          program_id: string
          starts_at: string
          status: string
        }
        Insert: {
          attribution_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          participant_id: string
          participant_type: string
          program_id: string
          starts_at?: string
          status?: string
        }
        Update: {
          attribution_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          metadata?: Json
          participant_id?: string
          participant_type?: string
          program_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_enrollments_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "acquisition_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          created_at: string
          holder_id: string
          holder_type: string
          id: string
          kyc_status: string
          metadata: Json
          provider: string | null
          provider_account_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holder_id: string
          holder_type: string
          id?: string
          kyc_status?: string
          metadata?: Json
          provider?: string | null
          provider_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holder_id?: string
          holder_type?: string
          id?: string
          kyc_status?: string
          metadata?: Json
          provider?: string | null
          provider_account_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          created_at: string
          encrypted_details: string
          fingerprint: string
          id: string
          is_default: boolean
          key_version: number
          method_type: string
          payout_account_id: string
          status: string
        }
        Insert: {
          created_at?: string
          encrypted_details: string
          fingerprint: string
          id?: string
          is_default?: boolean
          key_version: number
          method_type: string
          payout_account_id: string
          status?: string
        }
        Update: {
          created_at?: string
          encrypted_details?: string
          fingerprint?: string
          id?: string
          is_default?: boolean
          key_version?: number
          method_type?: string
          payout_account_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_methods_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_rules: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          metadata: Json
          operation_type: string
          percentage: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          operation_type: string
          percentage: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          operation_type?: string
          percentage?: number
        }
        Relationships: []
      }
      platform_revenue_settings: {
        Row: {
          allow_company_custom_fee: boolean | null
          default_platform_fee_percentage: number
          id: string
          is_active: boolean | null
          minimum_price_cents: number
          updated_at: string | null
        }
        Insert: {
          allow_company_custom_fee?: boolean | null
          default_platform_fee_percentage?: number
          id?: string
          is_active?: boolean | null
          minimum_price_cents?: number
          updated_at?: string | null
        }
        Update: {
          allow_company_custom_fee?: boolean | null
          default_platform_fee_percentage?: number
          id?: string
          is_active?: boolean | null
          minimum_price_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_terms: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          term_type: string
          title: string
          updated_at: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          term_type: string
          title: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          term_type?: string
          title?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_credit_charges: {
        Row: {
          campaign_id: string | null
          charge_status: string
          company_id: string
          created_at: string | null
          credits_charged: number
          failure_reason: string | null
          id: string
          media_asset_id: string
          playback_log_id: string
          screen_id: string
          wallet_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          charge_status: string
          company_id: string
          created_at?: string | null
          credits_charged: number
          failure_reason?: string | null
          id?: string
          media_asset_id: string
          playback_log_id: string
          screen_id: string
          wallet_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          charge_status?: string
          company_id?: string
          created_at?: string | null
          credits_charged?: number
          failure_reason?: string | null
          id?: string
          media_asset_id?: string
          playback_log_id?: string
          screen_id?: string
          wallet_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playback_credit_charges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playback_credit_charges_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_playback_log_id_fkey"
            columns: ["playback_log_id"]
            isOneToOne: true
            referencedRelation: "playback_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_credit_charges_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      playback_logs: {
        Row: {
          actual_duration_seconds: number | null
          company_id: string
          created_at: string | null
          device_token_hash: string | null
          ended_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          media_asset_id: string
          media_type: string
          planned_duration_seconds: number
          played_at: string
          player_session_id: string | null
          playlist_id: string | null
          playlist_item_id: string | null
          screen_id: string
          started_at: string
          status: string
          synced_at: string | null
        }
        Insert: {
          actual_duration_seconds?: number | null
          company_id: string
          created_at?: string | null
          device_token_hash?: string | null
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          media_asset_id: string
          media_type: string
          planned_duration_seconds: number
          played_at?: string
          player_session_id?: string | null
          playlist_id?: string | null
          playlist_item_id?: string | null
          screen_id: string
          started_at: string
          status: string
          synced_at?: string | null
        }
        Update: {
          actual_duration_seconds?: number | null
          company_id?: string
          created_at?: string | null
          device_token_hash?: string | null
          ended_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          media_asset_id?: string
          media_type?: string
          planned_duration_seconds?: number
          played_at?: string
          player_session_id?: string | null
          playlist_id?: string | null
          playlist_item_id?: string | null
          screen_id?: string
          started_at?: string
          status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playback_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playback_logs_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_logs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_logs_playlist_item_id_fkey"
            columns: ["playlist_item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_logs_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          media_asset_id: string
          playback_duration_seconds: number
          playlist_id: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_asset_id: string
          playback_duration_seconds: number
          playlist_id: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          media_asset_id?: string
          playback_duration_seconds?: number
          playlist_id?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          orientation: string
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          orientation?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          orientation?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "playlists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_master_admin: boolean | null
          phone: string | null
          public_onboarding_completed_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_master_admin?: boolean | null
          phone?: string | null
          public_onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_master_admin?: boolean | null
          phone?: string | null
          public_onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quota_usage: {
        Row: {
          allocation_id: string | null
          campaign_id: string | null
          created_at: string
          entitlement_period_id: string
          id: string
          idempotency_key: string
          quantity: number
          status: string
        }
        Insert: {
          allocation_id?: string | null
          campaign_id?: string | null
          created_at?: string
          entitlement_period_id: string
          id?: string
          idempotency_key: string
          quantity: number
          status?: string
        }
        Update: {
          allocation_id?: string | null
          campaign_id?: string | null
          created_at?: string
          entitlement_period_id?: string
          id?: string
          idempotency_key?: string
          quantity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_usage_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quota_usage_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quota_usage_entitlement_period_id_fkey"
            columns: ["entitlement_period_id"]
            isOneToOne: false
            referencedRelation: "entitlement_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_commissions: {
        Row: {
          amount_credits: number
          attribution_id: string
          available_at: string | null
          beneficiary_id: string
          beneficiary_type: string
          created_at: string
          id: string
          idempotency_key: string
          outstanding_debit_credits: number
          period_reference: string
          program_id: string
          reversal_ledger_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          source_id: string
          source_type: string
          status: string
        }
        Insert: {
          amount_credits: number
          attribution_id: string
          available_at?: string | null
          beneficiary_id: string
          beneficiary_type: string
          created_at?: string
          id?: string
          idempotency_key: string
          outstanding_debit_credits?: number
          period_reference: string
          program_id: string
          reversal_ledger_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          source_id: string
          source_type: string
          status?: string
        }
        Update: {
          amount_credits?: number
          attribution_id?: string
          available_at?: string | null
          beneficiary_id?: string
          beneficiary_type?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          outstanding_debit_credits?: number
          period_reference?: string
          program_id?: string
          reversal_ledger_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          source_id?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_commissions_attribution_id_fkey"
            columns: ["attribution_id"]
            isOneToOne: false
            referencedRelation: "acquisition_attributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_commissions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_commissions_reversal_ledger_id_fkey"
            columns: ["reversal_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_invites: {
        Row: {
          accepted_at: string | null
          converted_at: string | null
          converted_company_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          invite_code: string
          invited_company_id: string | null
          invited_company_name: string | null
          invited_contact_name: string | null
          invited_email: string | null
          invited_phone: string | null
          inviter_company_id: string
          metadata: Json
          status: string
          trial_days: number
          trial_days_granted: number
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          invite_code: string
          invited_company_id?: string | null
          invited_company_name?: string | null
          invited_contact_name?: string | null
          invited_email?: string | null
          invited_phone?: string | null
          inviter_company_id: string
          metadata?: Json
          status?: string
          trial_days?: number
          trial_days_granted?: number
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invited_company_id?: string | null
          invited_company_name?: string | null
          invited_contact_name?: string | null
          invited_email?: string | null
          invited_phone?: string | null
          inviter_company_id?: string
          metadata?: Json
          status?: string
          trial_days?: number
          trial_days_granted?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_invites_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_invites_converted_company_id_fkey"
            columns: ["converted_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "referral_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_invites_invited_company_id_fkey"
            columns: ["invited_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_invites_invited_company_id_fkey"
            columns: ["invited_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "referral_invites_inviter_company_id_fkey"
            columns: ["inviter_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_invites_inviter_company_id_fkey"
            columns: ["inviter_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      screen_content_logs: {
        Row: {
          company_id: string
          content_id: string
          content_type: string
          created_at: string
          ended_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          metadata: Json
          player_session_id: string | null
          screen_id: string
          started_at: string
          status: string
        }
        Insert: {
          company_id: string
          content_id: string
          content_type: string
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          player_session_id?: string | null
          screen_id: string
          started_at: string
          status: string
        }
        Update: {
          company_id?: string
          content_id?: string
          content_type?: string
          created_at?: string
          ended_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          player_session_id?: string | null
          screen_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_content_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_content_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "screen_content_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "informative_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_content_logs_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_content_settings: {
        Row: {
          ads_between_content: number
          allowed_categories: string[] | null
          company_id: string
          content_duration_seconds: number
          created_at: string
          enable_breathing_content: boolean
          enable_manual_content: boolean
          enable_rss_content: boolean
          fallback_to_ads: boolean
          id: string
          is_active: boolean
          metadata: Json
          screen_id: string
          updated_at: string
        }
        Insert: {
          ads_between_content?: number
          allowed_categories?: string[] | null
          company_id: string
          content_duration_seconds?: number
          created_at?: string
          enable_breathing_content?: boolean
          enable_manual_content?: boolean
          enable_rss_content?: boolean
          fallback_to_ads?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          screen_id: string
          updated_at?: string
        }
        Update: {
          ads_between_content?: number
          allowed_categories?: string[] | null
          company_id?: string
          content_duration_seconds?: number
          created_at?: string
          enable_breathing_content?: boolean
          enable_manual_content?: boolean
          enable_rss_content?: boolean
          fallback_to_ads?: boolean
          id?: string
          is_active?: boolean
          metadata?: Json
          screen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_content_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_content_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "screen_content_settings_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: true
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_pairing_codes: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          device_fingerprint: string | null
          encrypted_device_token: Json | null
          expires_at: string
          id: string
          paired_at: string | null
          pairing_secret_hash: string | null
          screen_id: string | null
          status: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          encrypted_device_token?: Json | null
          expires_at: string
          id?: string
          paired_at?: string | null
          pairing_secret_hash?: string | null
          screen_id?: string | null
          status?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          encrypted_device_token?: Json | null
          expires_at?: string
          id?: string
          paired_at?: string | null
          pairing_secret_hash?: string | null
          screen_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_pairing_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_pairing_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "screen_pairing_codes_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_playlists: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_active: boolean | null
          playlist_id: string
          screen_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          playlist_id: string
          screen_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          playlist_id?: string
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_playlists_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_playlists_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_playlists_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          device_token_hash: string | null
          device_type: string
          id: string
          last_ping_at: string | null
          location_description: string | null
          name: string
          orientation: string
          paired_at: string | null
          resolution: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          device_token_hash?: string | null
          device_type?: string
          id?: string
          last_ping_at?: string | null
          location_description?: string | null
          name: string
          orientation: string
          paired_at?: string | null
          resolution?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          device_token_hash?: string | null
          device_type?: string
          id?: string
          last_ping_at?: string | null
          location_description?: string | null
          name?: string
          orientation?: string
          paired_at?: string | null
          resolution?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      seller_financial_ledger: {
        Row: {
          ad_offer_order_id: string
          amount_available_cents: number
          amount_pending_cents: number
          amount_transferred_cents: number
          amount_used_for_discount_cents: number
          buyer_company_id: string | null
          campaign_id: string | null
          created_at: string | null
          delivery_status: string
          financial_status: string
          gross_amount_cents: number
          id: string
          last_transfer_at: string | null
          metadata: Json | null
          platform_fee_cents: number
          seller_company_id: string
          seller_net_cents: number
          transfer_status: string
          updated_at: string | null
        }
        Insert: {
          ad_offer_order_id: string
          amount_available_cents?: number
          amount_pending_cents?: number
          amount_transferred_cents?: number
          amount_used_for_discount_cents?: number
          buyer_company_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivery_status?: string
          financial_status?: string
          gross_amount_cents: number
          id?: string
          last_transfer_at?: string | null
          metadata?: Json | null
          platform_fee_cents: number
          seller_company_id: string
          seller_net_cents: number
          transfer_status?: string
          updated_at?: string | null
        }
        Update: {
          ad_offer_order_id?: string
          amount_available_cents?: number
          amount_pending_cents?: number
          amount_transferred_cents?: number
          amount_used_for_discount_cents?: number
          buyer_company_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivery_status?: string
          financial_status?: string
          gross_amount_cents?: number
          id?: string
          last_transfer_at?: string | null
          metadata?: Json | null
          platform_fee_cents?: number
          seller_company_id?: string
          seller_net_cents?: number
          transfer_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_financial_ledger_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: true
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_ledger_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_ledger_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_financial_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_ledger_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_ledger_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      seller_financial_profile_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_by: string | null
          company_id: string | null
          created_at: string | null
          id: string
          seller_financial_profile_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          seller_financial_profile_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          seller_financial_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_financial_profile_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_profile_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_profile_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_financial_profile_logs_seller_financial_profile_id_fkey"
            columns: ["seller_financial_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_financial_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asaas_account_id: string | null
          asaas_status: string
          asaas_wallet_id: string | null
          bank_account: string
          bank_account_digit: string
          bank_account_type: string
          bank_agency: string
          bank_code: string
          bank_name: string
          company_id: string
          created_at: string | null
          document_number: string
          document_type: string
          id: string
          legal_name: string
          metadata: Json | null
          pix_key: string | null
          pix_key_type: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          responsible_email: string
          responsible_name: string
          responsible_phone: string
          trade_name: string | null
          updated_at: string | null
          verification_status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asaas_account_id?: string | null
          asaas_status?: string
          asaas_wallet_id?: string | null
          bank_account: string
          bank_account_digit: string
          bank_account_type: string
          bank_agency: string
          bank_code: string
          bank_name: string
          company_id: string
          created_at?: string | null
          document_number: string
          document_type: string
          id?: string
          legal_name: string
          metadata?: Json | null
          pix_key?: string | null
          pix_key_type?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          responsible_email: string
          responsible_name: string
          responsible_phone: string
          trade_name?: string | null
          updated_at?: string | null
          verification_status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asaas_account_id?: string | null
          asaas_status?: string
          asaas_wallet_id?: string | null
          bank_account?: string
          bank_account_digit?: string
          bank_account_type?: string
          bank_agency?: string
          bank_code?: string
          bank_name?: string
          company_id?: string
          created_at?: string | null
          document_number?: string
          document_type?: string
          id?: string
          legal_name?: string
          metadata?: Json | null
          pix_key?: string | null
          pix_key_type?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          responsible_email?: string
          responsible_name?: string
          responsible_phone?: string
          trade_name?: string | null
          updated_at?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_financial_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_financial_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_financial_profiles_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_batch_items: {
        Row: {
          ad_offer_order_id: string
          amount_cents: number
          asaas_payment_id: string | null
          asaas_transfer_id: string | null
          asaas_wallet_id: string | null
          batch_id: string
          campaign_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          seller_company_id: string
          seller_financial_ledger_id: string | null
          seller_payout_eligibility_id: string | null
          status: string
          transfer_response: Json | null
          updated_at: string | null
        }
        Insert: {
          ad_offer_order_id: string
          amount_cents: number
          asaas_payment_id?: string | null
          asaas_transfer_id?: string | null
          asaas_wallet_id?: string | null
          batch_id: string
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          seller_company_id: string
          seller_financial_ledger_id?: string | null
          seller_payout_eligibility_id?: string | null
          status?: string
          transfer_response?: Json | null
          updated_at?: string | null
        }
        Update: {
          ad_offer_order_id?: string
          amount_cents?: number
          asaas_payment_id?: string | null
          asaas_transfer_id?: string | null
          asaas_wallet_id?: string | null
          batch_id?: string
          campaign_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          seller_company_id?: string
          seller_financial_ledger_id?: string | null
          seller_payout_eligibility_id?: string | null
          status?: string
          transfer_response?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_batch_items_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_seller_financial_ledger_id_fkey"
            columns: ["seller_financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "seller_financial_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batch_items_seller_payout_eligibility_id_fkey"
            columns: ["seller_payout_eligibility_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_eligibility"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_number: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          executed_at: string | null
          executed_by: string | null
          id: string
          metadata: Json | null
          status: string
          total_amount_cents: number
          total_items: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          total_amount_cents?: number
          total_items?: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_number?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          total_amount_cents?: number
          total_items?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batches_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_batches_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_eligibility: {
        Row: {
          ad_offer_order_id: string
          asaas_payment_id: string | null
          asaas_status: string | null
          asaas_wallet_id: string | null
          buyer_company_id: string | null
          calculated_at: string | null
          campaign_id: string | null
          created_at: string | null
          delivery_status: string
          eligibility_reason: string | null
          eligibility_status: string
          eligible_amount_cents: number
          financial_status: string
          gross_amount_cents: number
          id: string
          ineligible_amount_cents: number
          metadata: Json | null
          platform_fee_cents: number
          seller_company_id: string
          seller_financial_ledger_id: string | null
          seller_net_cents: number
          seller_verification_status: string | null
          updated_at: string | null
        }
        Insert: {
          ad_offer_order_id: string
          asaas_payment_id?: string | null
          asaas_status?: string | null
          asaas_wallet_id?: string | null
          buyer_company_id?: string | null
          calculated_at?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivery_status?: string
          eligibility_reason?: string | null
          eligibility_status?: string
          eligible_amount_cents?: number
          financial_status?: string
          gross_amount_cents?: number
          id?: string
          ineligible_amount_cents?: number
          metadata?: Json | null
          platform_fee_cents?: number
          seller_company_id: string
          seller_financial_ledger_id?: string | null
          seller_net_cents?: number
          seller_verification_status?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_offer_order_id?: string
          asaas_payment_id?: string | null
          asaas_status?: string | null
          asaas_wallet_id?: string | null
          buyer_company_id?: string | null
          calculated_at?: string | null
          campaign_id?: string | null
          created_at?: string | null
          delivery_status?: string
          eligibility_reason?: string | null
          eligibility_status?: string
          eligible_amount_cents?: number
          financial_status?: string
          gross_amount_cents?: number
          id?: string
          ineligible_amount_cents?: number
          metadata?: Json | null
          platform_fee_cents?: number
          seller_company_id?: string
          seller_financial_ledger_id?: string | null
          seller_net_cents?: number
          seller_verification_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_eligibility_ad_offer_order_id_fkey"
            columns: ["ad_offer_order_id"]
            isOneToOne: true
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_payout_eligibility_seller_financial_ledger_id_fkey"
            columns: ["seller_financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "seller_financial_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_simulations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          period_end: string
          period_start: string
          seller_company_id: string
          total_blocked_cents: number
          total_eligible_cents: number
          total_gross_cents: number
          total_platform_fee_cents: number
          total_seller_net_cents: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          period_end: string
          period_start: string
          seller_company_id: string
          total_blocked_cents?: number
          total_eligible_cents?: number
          total_gross_cents?: number
          total_platform_fee_cents?: number
          total_seller_net_cents?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          period_end?: string
          period_start?: string
          seller_company_id?: string
          total_blocked_cents?: number
          total_eligible_cents?: number
          total_gross_cents?: number
          total_platform_fee_cents?: number
          total_seller_net_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_simulations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_simulations_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_simulations_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      seller_payout_transfers: {
        Row: {
          amount_cents: number
          asaas_transfer_id: string | null
          asaas_wallet_id: string
          batch_item_id: string | null
          confirmed_at: string | null
          created_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          raw_request: Json | null
          raw_response: Json | null
          requested_at: string | null
          requested_by: string | null
          seller_company_id: string
          seller_financial_ledger_id: string | null
          transfer_status: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          asaas_transfer_id?: string | null
          asaas_wallet_id: string
          batch_item_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          raw_request?: Json | null
          raw_response?: Json | null
          requested_at?: string | null
          requested_by?: string | null
          seller_company_id: string
          seller_financial_ledger_id?: string | null
          transfer_status?: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          asaas_transfer_id?: string | null
          asaas_wallet_id?: string
          batch_item_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          raw_request?: Json | null
          raw_response?: Json | null
          requested_at?: string | null
          requested_by?: string | null
          seller_company_id?: string
          seller_financial_ledger_id?: string | null
          transfer_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_transfers_batch_item_id_fkey"
            columns: ["batch_item_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_batch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_transfers_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_transfers_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "seller_payout_transfers_seller_financial_ledger_id_fkey"
            columns: ["seller_financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "seller_financial_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_entries: {
        Row: {
          allocation_id: string | null
          buyer_company_id: string
          campaign_id: string
          commercial_contract_id: string | null
          created_at: string
          delivered_units: number
          delivery_proof_id: string | null
          fee_rule_id: string
          gross_credits: number
          id: string
          idempotency_key: string
          metadata: Json
          order_id: string | null
          platform_fee_credits: number
          playback_log_id: string | null
          seller_company_id: string | null
          settled_at: string | null
          status: string
          supplier_holder_id: string
          supplier_holder_type: string
          supplier_net_credits: number
        }
        Insert: {
          allocation_id?: string | null
          buyer_company_id: string
          campaign_id: string
          commercial_contract_id?: string | null
          created_at?: string
          delivered_units: number
          delivery_proof_id?: string | null
          fee_rule_id: string
          gross_credits: number
          id?: string
          idempotency_key: string
          metadata?: Json
          order_id?: string | null
          platform_fee_credits: number
          playback_log_id?: string | null
          seller_company_id?: string | null
          settled_at?: string | null
          status?: string
          supplier_holder_id: string
          supplier_holder_type?: string
          supplier_net_credits: number
        }
        Update: {
          allocation_id?: string | null
          buyer_company_id?: string
          campaign_id?: string
          commercial_contract_id?: string | null
          created_at?: string
          delivered_units?: number
          delivery_proof_id?: string | null
          fee_rule_id?: string
          gross_credits?: number
          id?: string
          idempotency_key?: string
          metadata?: Json
          order_id?: string | null
          platform_fee_credits?: number
          playback_log_id?: string | null
          seller_company_id?: string | null
          settled_at?: string | null
          status?: string
          supplier_holder_id?: string
          supplier_holder_type?: string
          supplier_net_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_entries_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "settlement_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_commercial_contract_id_fkey"
            columns: ["commercial_contract_id"]
            isOneToOne: false
            referencedRelation: "media_commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_delivery_proof_id_fkey"
            columns: ["delivery_proof_id"]
            isOneToOne: false
            referencedRelation: "delivery_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "platform_fee_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ad_offer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_playback_log_id_fkey"
            columns: ["playback_log_id"]
            isOneToOne: false
            referencedRelation: "playback_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_entries_seller_company_id_fkey"
            columns: ["seller_company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      settlement_rules: {
        Row: {
          channel_family: string
          code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          fee_rule_id: string | null
          hold_hours: number
          id: string
          is_active: boolean
          metadata: Json
          minimum_proof_count: number
          proof_method: string
          version: number
        }
        Insert: {
          channel_family: string
          code: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fee_rule_id?: string | null
          hold_hours?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          minimum_proof_count?: number
          proof_method: string
          version?: number
        }
        Update: {
          channel_family?: string
          code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          fee_rule_id?: string | null
          hold_hours?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          minimum_proof_count?: number
          proof_method?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_rules_fee_rule_id_fkey"
            columns: ["fee_rule_id"]
            isOneToOne: false
            referencedRelation: "platform_fee_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      social_channels: {
        Row: {
          allowed_formats: string[]
          blocked_categories: string[]
          blocked_companies: string[]
          channel_type: string
          connection_id: string
          created_at: string
          display_name: string
          id: string
          max_publications_per_month: number
          metadata: Json
          owner_id: string
          owner_type: string
          participation_enabled: boolean
          provider: string
          provider_channel_id: string
          requires_approval: boolean
          status: string
          updated_at: string
        }
        Insert: {
          allowed_formats?: string[]
          blocked_categories?: string[]
          blocked_companies?: string[]
          channel_type: string
          connection_id: string
          created_at?: string
          display_name: string
          id?: string
          max_publications_per_month?: number
          metadata?: Json
          owner_id: string
          owner_type: string
          participation_enabled?: boolean
          provider: string
          provider_channel_id: string
          requires_approval?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_formats?: string[]
          blocked_categories?: string[]
          blocked_companies?: string[]
          channel_type?: string
          connection_id?: string
          created_at?: string
          display_name?: string
          id?: string
          max_publications_per_month?: number
          metadata?: Json
          owner_id?: string
          owner_type?: string
          participation_enabled?: boolean
          provider?: string
          provider_channel_id?: string
          requires_approval?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_channels_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          created_at: string
          encrypted_access_token: string | null
          expires_at: string | null
          id: string
          metadata: Json
          owner_id: string
          owner_type: string
          provider: string
          provider_account_id: string
          scopes: string[]
          status: string
          token_key_version: number | null
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_id: string
          owner_type: string
          provider: string
          provider_account_id: string
          scopes?: string[]
          status?: string
          token_key_version?: number | null
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          encrypted_access_token?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          owner_id?: string
          owner_type?: string
          provider?: string
          provider_account_id?: string
          scopes?: string[]
          status?: string
          token_key_version?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      social_metric_snapshots: {
        Row: {
          captured_at: string
          channel_id: string
          engagement_rate: number | null
          followers: number | null
          id: string
          impressions: number | null
          metrics: Json
          provider_payload_hash: string | null
          reach: number | null
        }
        Insert: {
          captured_at?: string
          channel_id: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          metrics?: Json
          provider_payload_hash?: string | null
          reach?: number | null
        }
        Update: {
          captured_at?: string
          channel_id?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          metrics?: Json
          provider_payload_hash?: string | null
          reach?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_metric_snapshots_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "social_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      social_publications: {
        Row: {
          campaign_id: string | null
          channel_id: string
          created_at: string
          id: string
          idempotency_key: string
          media_asset_id: string | null
          metadata: Json
          proof: Json
          provider_publication_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          validated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          media_asset_id?: string | null
          metadata?: Json
          proof?: Json
          provider_publication_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          validated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          media_asset_id?: string | null
          metadata?: Json
          proof?: Json
          provider_publication_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "social_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_publications_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_accounts: {
        Row: {
          available_balance: number
          cashout_eligible_balance: number
          company_id: string | null
          created_at: string
          credit_class: string
          disputed_balance: number
          forecast_balance: number
          holder_id: string
          holder_type: string
          id: string
          in_cashout_balance: number
          pending_balance: number
          reserved_balance: number
          settled_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          cashout_eligible_balance?: number
          company_id?: string | null
          created_at?: string
          credit_class: string
          disputed_balance?: number
          forecast_balance?: number
          holder_id: string
          holder_type?: string
          id?: string
          in_cashout_balance?: number
          pending_balance?: number
          reserved_balance?: number
          settled_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          cashout_eligible_balance?: number
          company_id?: string | null
          created_at?: string
          credit_class?: string
          disputed_balance?: number
          forecast_balance?: number
          holder_id?: string
          holder_type?: string
          id?: string
          in_cashout_balance?: number
          pending_balance?: number
          reserved_balance?: number
          settled_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          account_id: string
          actor_id: string | null
          amount: number
          available_balance_after: number
          campaign_id: string | null
          cashout_eligible_balance_after: number
          company_id: string | null
          created_at: string
          credit_class: string
          direction: string
          disputed_balance_after: number
          entry_type: string
          forecast_balance_after: number
          holder_id: string
          holder_type: string
          id: string
          idempotency_key: string
          in_cashout_balance_after: number
          media_asset_id: string | null
          metadata: Json
          pending_balance_after: number
          reserved_balance_after: number
          reverses_entry_id: string | null
          settled_balance_after: number
          settlement_id: string | null
          source_id: string | null
          source_type: string
          state_from: string | null
          state_to: string | null
        }
        Insert: {
          account_id: string
          actor_id?: string | null
          amount: number
          available_balance_after: number
          campaign_id?: string | null
          cashout_eligible_balance_after?: number
          company_id?: string | null
          created_at?: string
          credit_class: string
          direction: string
          disputed_balance_after?: number
          entry_type: string
          forecast_balance_after?: number
          holder_id: string
          holder_type?: string
          id?: string
          idempotency_key: string
          in_cashout_balance_after?: number
          media_asset_id?: string | null
          metadata?: Json
          pending_balance_after: number
          reserved_balance_after: number
          reverses_entry_id?: string | null
          settled_balance_after?: number
          settlement_id?: string | null
          source_id?: string | null
          source_type: string
          state_from?: string | null
          state_to?: string | null
        }
        Update: {
          account_id?: string
          actor_id?: string | null
          amount?: number
          available_balance_after?: number
          campaign_id?: string | null
          cashout_eligible_balance_after?: number
          company_id?: string | null
          created_at?: string
          credit_class?: string
          direction?: string
          disputed_balance_after?: number
          entry_type?: string
          forecast_balance_after?: number
          holder_id?: string
          holder_type?: string
          id?: string
          idempotency_key?: string
          in_cashout_balance_after?: number
          media_asset_id?: string | null
          metadata?: Json
          pending_balance_after?: number
          reserved_balance_after?: number
          reverses_entry_id?: string | null
          settled_balance_after?: number
          settlement_id?: string | null
          source_id?: string | null
          source_type?: string
          state_from?: string | null
          state_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "wallet_ledger_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: true
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlement_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_reservation_lines: {
        Row: {
          account_id: string
          amount: number
          consumed_ledger_id: string | null
          created_at: string
          id: string
          reservation_id: string
        }
        Insert: {
          account_id: string
          amount: number
          consumed_ledger_id?: string | null
          created_at?: string
          id?: string
          reservation_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          consumed_ledger_id?: string | null
          created_at?: string
          id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_reservation_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_reservation_lines_consumed_ledger_fkey"
            columns: ["consumed_ledger_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_reservation_lines_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "wallet_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_reservations: {
        Row: {
          allocation_id: string | null
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          idempotency_key: string
          metadata: Json
          purpose: string
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          allocation_id?: string | null
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          purpose: string
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          allocation_id?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          purpose?: string
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_reservations_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "inventory_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          credit_type: string | null
          description: string
          expires_at: string | null
          id: string
          metadata: Json | null
          new_balance: number
          previous_balance: number
          source: string
          source_id: string | null
          source_type: string | null
          type: string
          user_id: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          credit_type?: string | null
          description: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          new_balance: number
          previous_balance: number
          source: string
          source_id?: string | null
          source_type?: string | null
          type: string
          user_id?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          credit_type?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          new_balance?: number
          previous_balance?: number
          source?: string
          source_id?: string | null
          source_type?: string | null
          type?: string
          user_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          company_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          company_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          company_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "mpm_company_dashboard"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Views: {
      mpm_admin_dashboard: {
        Row: {
          active_creators: number | null
          active_events: number | null
          active_programs: number | null
          fee_revenue_credits: number | null
          mpm_balance: number | null
          occupied_capacity: number | null
          pending_settlements: number | null
          total_capacity: number | null
          total_inventory: number | null
        }
        Relationships: []
      }
      mpm_company_dashboard: {
        Row: {
          available_credits: number | null
          campaigns: number | null
          company_id: string | null
          earned_credits: number | null
          fee_credits: number | null
          inventory_items: number | null
          occupied_capacity: number | null
          proof_of_delivery_count: number | null
          total_capacity: number | null
        }
        Insert: {
          available_credits?: never
          campaigns?: never
          company_id?: string | null
          earned_credits?: never
          fee_credits?: never
          inventory_items?: never
          occupied_capacity?: never
          proof_of_delivery_count?: never
          total_capacity?: never
        }
        Update: {
          available_credits?: never
          campaigns?: never
          company_id?: string | null
          earned_credits?: never
          fee_credits?: never
          inventory_items?: never
          occupied_capacity?: never
          proof_of_delivery_count?: never
          total_capacity?: never
        }
        Relationships: []
      }
    }
    Functions: {
      _mpm_post_entry: {
        Args: {
          p_account_id: string
          p_amount: number
          p_available_delta: number
          p_campaign_id?: string
          p_direction: string
          p_entry_type: string
          p_idempotency_key: string
          p_media_asset_id?: string
          p_metadata?: Json
          p_pending_delta: number
          p_reserved_delta: number
          p_reverses_entry_id?: string
          p_settlement_id?: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      accept_platform_term: {
        Args: {
          p_acceptance_context?: string
          p_company_id: string
          p_ip_address?: string
          p_term_id: string
          p_user_agent?: string
        }
        Returns: Json
      }
      accrue_partner_commission: {
        Args: {
          p_attribution_id: string
          p_idempotency_key: string
          p_period_reference: string
          p_settlement_id: string
        }
        Returns: string
      }
      activate_organic_participant: {
        Args: { p_city: string; p_display_name: string; p_state?: string }
        Returns: string
      }
      apply_seller_monthly_discount: {
        Args: { p_amount_cents: number; p_ledger_id: string; p_reason: string }
        Returns: Json
      }
      approve_marketplace_media_request: {
        Args: { p_order_id: string }
        Returns: Json
      }
      approve_media_asset: { Args: { p_media_id: string }; Returns: boolean }
      archive_media_asset: { Args: { p_media_id: string }; Returns: boolean }
      assign_playlist_to_screen: {
        Args: { p_playlist_id: string; p_screen_id: string }
        Returns: boolean
      }
      can_access_media_inventory: {
        Args: { p_inventory_id: string; p_require_admin?: boolean }
        Returns: boolean
      }
      cancel_inventory_allocation: {
        Args: { p_allocation_id: string; p_reason: string }
        Returns: boolean
      }
      cancel_marketplace_media_request: {
        Args: { p_order_id: string }
        Returns: Json
      }
      charge_playback_credit:
        | { Args: { p_playback_log_id: string }; Returns: Json }
        | {
            Args: { p_campaign_id?: string; p_playback_log_id: string }
            Returns: Json
          }
      check_company_required_terms: {
        Args: { p_company_id: string }
        Returns: Json
      }
      complete_public_company_onboarding: {
        Args: {
          p_city: string
          p_cnpj: string
          p_corporate_name: string
          p_full_name: string
          p_invite_code?: string
          p_phone: string
          p_segment_id: string
          p_state: string
          p_trade_name: string
          p_user_id: string
        }
        Returns: Json
      }
      configure_inventory_period: {
        Args: {
          p_automatic_pool: number
          p_calculation_inputs: Json
          p_calculation_source: string
          p_growth_reason?: string
          p_inventory_id: string
          p_mpm_growth: number
          p_own_use: number
          p_partnership: number
          p_period_end: string
          p_period_start: string
          p_preferred: number
          p_release_after_day: number
          p_release_lead_days: number
          p_release_unused: boolean
          p_theoretical_capacity: number
        }
        Returns: string
      }
      consume_inventory_entitlement: {
        Args: {
          p_campaign_id: string
          p_entitlement_period_id: string
          p_idempotency_key: string
          p_quantity: number
        }
        Returns: string
      }
      convert_ad_offer_order_to_campaign: {
        Args: { p_order_id: string }
        Returns: Json
      }
      create_ad_offer_order_rpc: {
        Args: {
          p_buyer_company_id?: string
          p_buyer_email?: string
          p_buyer_name?: string
          p_buyer_phone?: string
          p_notes?: string
          p_offer_id: string
        }
        Returns: Json
      }
      create_cashout_simulation: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_payout_account_id: string
          p_wallet_account_id: string
        }
        Returns: Json
      }
      create_event_inventory: {
        Args: {
          p_commercial_capacity: number
          p_event_id: string
          p_idempotency_key: string
          p_inventory_name: string
          p_sponsor_capacity: number
          p_total_capacity: number
        }
        Returns: Json
      }
      create_marketplace_media_request: {
        Args: {
          p_buyer_company_id: string
          p_notes?: string
          p_offer_id: string
          p_request_message?: string
          p_requested_end_date?: string
          p_requested_media_asset_id?: string
          p_requested_start_date?: string
        }
        Returns: Json
      }
      create_media_commercial_contract: {
        Args: {
          p_campaign_id: string
          p_idempotency_key: string
          p_quote_id: string
          p_supplier_holder_id: string
          p_supplier_holder_type: string
        }
        Returns: string
      }
      expire_inventory_allocations: { Args: never; Returns: number }
      expire_mpm_reservations: { Args: { p_now?: string }; Returns: number }
      expire_organic_redemptions: { Args: never; Returns: number }
      get_mpm_admin_dashboard: { Args: never; Returns: Json }
      get_user_admin_company_ids: { Args: never; Returns: string[] }
      get_user_company_ids: { Args: never; Returns: string[] }
      is_authorized_commercial_distribution: {
        Args: {
          p_campaign_id: string
          p_media_asset_id: string
          p_screen_id: string
        }
        Returns: boolean
      }
      is_inventory_feature_enabled: {
        Args: { p_key: string }
        Returns: boolean
      }
      is_master_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_company_id: string
          p_details?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      mark_company_onboarding_progress: {
        Args: {
          p_company_id: string
          p_event: string
          p_metadata?: Json
          p_user_id?: string
        }
        Returns: {
          company_id: string
          created_at: string
          dont_show_again: boolean
          first_campaign_started_at: string | null
          first_invite_copied_at: string | null
          first_media_uploaded_at: string | null
          first_playback_detected_at: string | null
          first_playlist_created_at: string | null
          first_screen_created_at: string | null
          first_screen_paired_at: string | null
          id: string
          metadata: Json
          tour_completed_at: string | null
          tour_seen_at: string | null
          tour_skipped_at: string | null
          tour_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_onboarding_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mpm_can_manage_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      mpm_can_manage_holder: {
        Args: { p_holder_id: string; p_holder_type: string }
        Returns: boolean
      }
      mpm_cancel_media_purchase: {
        Args: {
          p_idempotency_key: string
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      mpm_consume_reservation: {
        Args: { p_idempotency_key: string; p_reservation_id: string }
        Returns: boolean
      }
      mpm_ensure_account: {
        Args: { p_company_id: string; p_credit_class: string }
        Returns: string
      }
      mpm_ensure_holder_account: {
        Args: {
          p_credit_class: string
          p_holder_id: string
          p_holder_type: string
        }
        Returns: string
      }
      mpm_grant_credits: {
        Args: {
          p_amount: number
          p_company_id: string
          p_credit_class: string
          p_idempotency_key: string
          p_metadata?: Json
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      mpm_pay_subscription: {
        Args: {
          p_amount: number
          p_billing_cycle: string
          p_billing_reference: string
          p_company_id: string
          p_idempotency_key: string
        }
        Returns: string
      }
      mpm_purchase_media_with_credits: {
        Args: {
          p_bucket_policy_id: string
          p_capacity_period_id: string
          p_idempotency_key: string
          p_inventory_id: string
          p_order_id: string
        }
        Returns: Json
      }
      mpm_release_reservation: {
        Args: { p_idempotency_key: string; p_reservation_id: string }
        Returns: boolean
      }
      mpm_reserve_credits: {
        Args: {
          p_amount: number
          p_company_id: string
          p_expires_at?: string
          p_idempotency_key: string
          p_metadata?: Json
          p_purpose: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      mpm_reverse_ledger_entry: {
        Args: {
          p_entry_id: string
          p_idempotency_key: string
          p_reason: string
        }
        Returns: string
      }
      mpm_wallet_summary: { Args: { p_company_id: string }; Returns: Json }
      process_commercial_campaign_delivery: {
        Args: { p_campaign_id: string }
        Returns: Json
      }
      process_credit_transaction: {
        Args: {
          p_amount: number
          p_company_id: string
          p_description: string
          p_source: string
          p_type: string
          p_user_id?: string
        }
        Returns: string
      }
      quote_media_inventory: {
        Args: {
          p_buyer_company_id: string
          p_campaign_type?: string
          p_duration_seconds?: number
          p_ends_at: string
          p_format?: string
          p_idempotency_key?: string
          p_insertion_quantity: number
          p_inventory_id: string
          p_plan_code?: string
          p_starts_at: string
        }
        Returns: Json
      }
      recalculate_creator_score: {
        Args: {
          p_creator_id: string
          p_formula_version?: string
          p_snapshot_id: string
        }
        Returns: Json
      }
      reconcile_legacy_balances: { Args: never; Returns: Json }
      record_legacy_balance_observation: {
        Args: {
          p_holder_id: string
          p_holder_type: string
          p_legacy_record_id: string
          p_legacy_source: string
          p_metadata?: Json
          p_observed_amount: number
          p_observed_unit: string
        }
        Returns: string
      }
      record_organic_playback: {
        Args: {
          p_campaign_id: string
          p_duration_seconds: number
          p_idempotency_key: string
          p_media_asset_id: string
          p_reward_id: string
          p_screen_id: string
        }
        Returns: Json
      }
      record_playback_log: {
        Args: {
          p_actual_duration_seconds?: number
          p_device_token_hash: string
          p_ended_at?: string
          p_failure_reason?: string
          p_idempotency_key?: string
          p_media_asset_id: string
          p_media_type?: string
          p_planned_duration_seconds?: number
          p_player_session_id?: string
          p_playlist_id?: string
          p_playlist_item_id?: string
          p_started_at?: string
          p_status?: string
        }
        Returns: Json
      }
      record_validated_delivery_proof: {
        Args: {
          p_contract_id: string
          p_delivered_units: number
          p_evidence: Json
          p_idempotency_key: string
          p_occurred_at: string
          p_source_id: string
          p_source_type: string
        }
        Returns: Json
      }
      refresh_inventory_capacity_counters: {
        Args: { p_capacity_period_id: string }
        Returns: undefined
      }
      reject_marketplace_media_request: {
        Args: { p_order_id: string; p_rejection_reason: string }
        Returns: Json
      }
      reject_media_asset: {
        Args: { p_media_id: string; p_reason: string }
        Returns: boolean
      }
      release_organic_pending_credits: { Args: never; Returns: number }
      release_partner_commissions: { Args: { p_now?: string }; Returns: number }
      release_pending_mpm_settlements: {
        Args: { p_now?: string }
        Returns: number
      }
      release_unused_owner_capacity: {
        Args: { p_capacity_period_id: string; p_now?: string }
        Returns: number
      }
      requalify_creators: { Args: never; Returns: number }
      reserve_inventory_allocation: {
        Args: {
          p_allocation_type: string
          p_beneficiary_id: string
          p_beneficiary_type: string
          p_bucket_policy_id: string
          p_capacity_period_id: string
          p_ends_at: string
          p_expires_at: string
          p_idempotency_key: string
          p_insertion_quantity: number
          p_inventory_id: string
          p_release_policy: Json
          p_source_id: string
          p_source_type: string
          p_starts_at: string
        }
        Returns: string
      }
      reserve_organic_reward: {
        Args: {
          p_code_hash: string
          p_code_suffix: string
          p_reward_id: string
        }
        Returns: Json
      }
      reverse_partner_commissions_for_settlement: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_settlement_id: string
        }
        Returns: Json
      }
      run_campaign_matching: {
        Args: {
          p_campaign_id: string
          p_idempotency_key: string
          p_requested_insertions: number
        }
        Returns: Json
      }
      run_mpm_ecosystem_jobs: { Args: { p_run_key?: string }; Returns: Json }
      run_mpm_maintenance: { Args: { p_run_key?: string }; Returns: Json }
      run_organic_maintenance: { Args: never; Returns: Json }
      set_inventory_bucket_policy: {
        Args: {
          p_bucket_type: string
          p_capacity_period_id: string
          p_capacity_quantity: number
          p_reason?: string
          p_release_after_day?: number
          p_release_lead_days?: number
          p_release_unused?: boolean
        }
        Returns: string
      }
      set_inventory_preferred_participant: {
        Args: {
          p_ends_at: string
          p_inventory_id: string
          p_max_insertions: number
          p_preferred_company_id: string
          p_priority: number
          p_starts_at: string
        }
        Returns: string
      }
      set_master_admin_by_email: {
        Args: { p_email: string; p_enabled?: boolean }
        Returns: string
      }
      set_media_inventory_commercial_enabled: {
        Args: { p_enabled: boolean; p_inventory_id: string }
        Returns: boolean
      }
      set_social_channel_participation: {
        Args: { p_channel_id: string; p_enabled: boolean }
        Returns: boolean
      }
      upsert_inventory_capacity_period: {
        Args: {
          p_calculation_inputs?: Json
          p_calculation_source: string
          p_inventory_id: string
          p_network_capacity: number
          p_own_use_capacity: number
          p_period_end: string
          p_period_start: string
          p_theoretical_capacity: number
        }
        Returns: string
      }
      use_network_inventory_credit: {
        Args: { p_inventory_ledger_id: string; p_playback_log_id: string }
        Returns: Json
      }
      validate_organic_redemption: {
        Args: { p_code_hash: string }
        Returns: Json
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
    Enums: {},
  },
} as const
