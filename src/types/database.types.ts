export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null; phone: string | null; is_master_admin: boolean; created_at: string; updated_at: string; };
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null; phone?: string | null; is_master_admin?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; email?: string; full_name?: string | null; avatar_url?: string | null; phone?: string | null; is_master_admin?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      companies: {
        Row: { id: string; trade_name: string; corporate_name: string | null; cnpj: string | null; city: string; state: string; neighborhood: string | null; address: string | null; accepts_external_media: boolean; accepts_exchange: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; trade_name: string; corporate_name?: string | null; cnpj?: string | null; city: string; state: string; neighborhood?: string | null; address?: string | null; accepts_external_media?: boolean; accepts_exchange?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; trade_name?: string; corporate_name?: string | null; cnpj?: string | null; city?: string; state?: string; neighborhood?: string | null; address?: string | null; accepts_external_media?: boolean; accepts_exchange?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      company_users: {
        Row: { id: string; company_id: string; user_id: string; role: 'admin' | 'operator' | 'external'; is_active: boolean; created_at: string; };
        Insert: { id?: string; company_id: string; user_id: string; role: 'admin' | 'operator' | 'external'; is_active?: boolean; created_at?: string; };
        Update: { id?: string; company_id?: string; user_id?: string; role?: 'admin' | 'operator' | 'external'; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      segments: {
        Row: { id: string; name: string; description: string | null; icon: string | null; created_at: string; };
        Insert: { id?: string; name: string; description?: string | null; icon?: string | null; created_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; icon?: string | null; created_at?: string; };
        Relationships: [];
      };
      company_segments: {
        Row: { company_id: string; segment_id: string; is_primary: boolean; };
        Insert: { company_id: string; segment_id: string; is_primary?: boolean; };
        Update: { company_id?: string; segment_id?: string; is_primary?: boolean; };
        Relationships: [];
      };
      wallets: {
        Row: { id: string; company_id: string; balance: number; updated_at: string; };
        Insert: { id?: string; company_id: string; balance?: number; updated_at?: string; };
        Update: { id?: string; company_id?: string; balance?: number; updated_at?: string; };
        Relationships: [];
      };
      wallet_transactions: {
        Row: { id: string; wallet_id: string; company_id: string; previous_balance: number; amount: number; new_balance: number; type: 'credit' | 'debit'; source: string; credit_type?: string; source_type?: string; source_id?: string | null; expires_at?: string | null; metadata?: Json | null; description: string; user_id?: string | null; created_at: string; };
        Insert: { id?: string; wallet_id: string; company_id: string; previous_balance: number; amount: number; new_balance: number; type: 'credit' | 'debit'; source: string; credit_type?: string; source_type?: string; source_id?: string | null; expires_at?: string | null; metadata?: Json | null; description: string; user_id?: string | null; created_at?: string; };
        Update: { id?: string; wallet_id?: string; company_id?: string; previous_balance?: number; amount?: number; new_balance?: number; type?: 'credit' | 'debit'; source?: string; credit_type?: string; source_type?: string; source_id?: string | null; expires_at?: string | null; metadata?: Json | null; description?: string; user_id?: string | null; created_at?: string; };
        Relationships: [];
      };
      audit_logs: {
        Row: { id: string; user_id: string | null; company_id: string | null; action: string; details: Json; ip_address: string | null; created_at: string; };
        Insert: { id?: string; user_id?: string | null; company_id?: string | null; action: string; details?: Json; ip_address?: string | null; created_at?: string; };
        Update: { id?: string; user_id?: string | null; company_id?: string | null; action?: string; details?: Json; ip_address?: string | null; created_at?: string; };
        Relationships: [];
      };
      screens: {
        Row: { id: string; company_id: string; name: string; description: string | null; orientation: 'horizontal' | 'vertical'; resolution: string | null; location_description: string | null; status: string; device_token_hash: string | null; last_ping_at: string | null; paired_at: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id: string; name: string; description?: string | null; orientation?: 'horizontal' | 'vertical'; resolution?: string | null; location_description?: string | null; status?: string; device_token_hash?: string | null; last_ping_at?: string | null; paired_at?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string; name?: string; description?: string | null; orientation?: 'horizontal' | 'vertical'; resolution?: string | null; location_description?: string | null; status?: string; device_token_hash?: string | null; last_ping_at?: string | null; paired_at?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      screen_pairing_codes: {
        Row: { id: string; code: string; screen_id: string | null; company_id: string | null; status: string; expires_at: string; created_at: string; };
        Insert: { id?: string; code: string; screen_id?: string | null; company_id?: string | null; status?: string; expires_at: string; created_at?: string; };
        Update: { id?: string; code?: string; screen_id?: string | null; company_id?: string | null; status?: string; expires_at?: string; created_at?: string; };
        Relationships: [];
      };
      media_assets: {
        Row: { id: string; company_id: string; uploaded_by: string | null; title: string; description: string | null; file_path: string; file_url: string | null; file_name: string | null; file_size_bytes: number | null; mime_type: string; media_type: 'image' | 'video'; orientation: string; width: number | null; height: number | null; duration_seconds: number | null; playback_duration_seconds: number; status: string; rejection_reason: string | null; is_external: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id: string; uploaded_by?: string | null; title: string; description?: string | null; file_path: string; file_url?: string | null; file_name?: string | null; file_size_bytes?: number | null; mime_type: string; media_type: 'image' | 'video'; orientation?: string; width?: number | null; height?: number | null; duration_seconds?: number | null; playback_duration_seconds: number; status?: string; rejection_reason?: string | null; is_external?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string; uploaded_by?: string | null; title?: string; description?: string | null; file_path?: string; file_url?: string | null; file_name?: string | null; file_size_bytes?: number | null; mime_type?: 'image' | 'video'; orientation?: string; width?: number | null; height?: number | null; duration_seconds?: number | null; playback_duration_seconds?: 5 | 10 | 15 | 30; status?: string; rejection_reason?: string | null; is_external?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      playlists: {
        Row: { id: string; company_id: string; name: string; description: string | null; orientation: 'horizontal' | 'vertical' | 'mixed'; status: 'draft' | 'active' | 'inactive' | 'archived'; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id: string; name: string; description?: string | null; orientation?: 'horizontal' | 'vertical' | 'mixed'; status?: 'draft' | 'active' | 'inactive' | 'archived'; created_by?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string; name?: string; description?: string | null; orientation?: 'horizontal' | 'vertical' | 'mixed'; status?: 'draft' | 'active' | 'inactive' | 'archived'; created_by?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      playlist_items: {
        Row: { id: string; playlist_id: string; media_asset_id: string; sort_order: number; playback_duration_seconds: number; is_active: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; playlist_id: string; media_asset_id: string; sort_order?: number; playback_duration_seconds: number; is_active?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; playlist_id?: string; media_asset_id?: string; sort_order?: number; playback_duration_seconds?: 5 | 10 | 15 | 30; is_active?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      screen_playlists: {
        Row: { id: string; screen_id: string; playlist_id: string; is_active: boolean; assigned_at: string; assigned_by: string | null; };
        Insert: { id?: string; screen_id: string; playlist_id: string; is_active?: boolean; assigned_at?: string; assigned_by?: string | null; };
        Update: { id?: string; screen_id?: string; playlist_id?: string; is_active?: boolean; assigned_at?: string; assigned_by?: string | null; };
        Relationships: [];
      };
      playback_logs: {
        Row: { id: string; company_id: string; screen_id: string; playlist_id: string | null; playlist_item_id: string | null; media_asset_id: string; media_type: 'image' | 'video'; planned_duration_seconds: number; actual_duration_seconds: number | null; started_at: string; ended_at: string | null; played_at: string; status: string; failure_reason: string | null; idempotency_key: string; player_session_id: string | null; device_token_hash: string | null; created_at: string; synced_at: string; };
        Insert: { id?: string; company_id: string; screen_id: string; playlist_id?: string | null; playlist_item_id?: string | null; media_asset_id: string; media_type: 'image' | 'video'; planned_duration_seconds: number; actual_duration_seconds?: number | null; started_at: string; ended_at?: string | null; played_at?: string; status?: string; failure_reason?: string | null; idempotency_key: string; player_session_id?: string | null; device_token_hash?: string | null; created_at?: string; synced_at?: string; };
        Update: { id?: string; company_id?: string; screen_id?: string; playlist_id?: string | null; playlist_item_id?: string | null; media_asset_id?: string; media_type?: 'image' | 'video'; planned_duration_seconds?: number; actual_duration_seconds?: number | null; started_at?: string; ended_at?: string | null; played_at?: string; status?: string; failure_reason?: string | null; idempotency_key?: string; player_session_id?: string | null; device_token_hash?: string | null; created_at?: string; synced_at?: string; };
        Relationships: [];
      };
      campaigns: {
        Row: { id: string; company_id: string; name: string; description: string | null; campaign_type: 'internal' | 'paid' | 'exchange' | 'external' | 'marketplace' | 'commercial'; status: string; start_date: string | null; end_date: string | null; target_insertions: number | null; delivered_insertions: number; buyer_company_id: string | null; seller_company_id: string | null; ad_offer_order_id: string | null; credits_contracted: number | null; credits_delivered: number | null; created_by: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id: string; name: string; description?: string | null; campaign_type?: 'internal' | 'paid' | 'exchange' | 'external' | 'marketplace' | 'commercial'; status?: string; start_date?: string | null; end_date?: string | null; target_insertions?: number | null; delivered_insertions?: number; buyer_company_id?: string | null; seller_company_id?: string | null; ad_offer_order_id?: string | null; credits_contracted?: number | null; credits_delivered?: number | null; created_by?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string; name?: string; description?: string | null; campaign_type?: 'internal' | 'paid' | 'exchange' | 'external' | 'marketplace' | 'commercial'; status?: string; start_date?: string | null; end_date?: string | null; target_insertions?: number | null; delivered_insertions?: number; buyer_company_id?: string | null; seller_company_id?: string | null; ad_offer_order_id?: string | null; credits_contracted?: number | null; credits_delivered?: number | null; created_by?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      campaign_media: {
        Row: { id: string; campaign_id: string; media_asset_id: string; playback_duration_seconds: number; is_active: boolean; created_at: string; };
        Insert: { id?: string; campaign_id: string; media_asset_id: string; playback_duration_seconds: number; is_active?: boolean; created_at?: string; };
        Update: { id?: string; campaign_id?: string; media_asset_id?: string; playback_duration_seconds?: 5 | 10 | 15 | 30; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      campaign_screens: {
        Row: { id: string; campaign_id: string; screen_id: string; is_active: boolean; created_at: string; };
        Insert: { id?: string; campaign_id: string; screen_id: string; is_active?: boolean; created_at?: string; };
        Update: { id?: string; campaign_id?: string; screen_id?: string; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      company_trials: {
        Row: { id: string; company_id: string; trial_start_date: string; trial_end_date: string; trial_days: number; free_days: number; trial_type: string; status: string; created_by?: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; company_id: string; trial_start_date?: string; trial_end_date?: string; trial_days?: number; free_days?: number; trial_type?: string; status?: string; created_by?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; company_id?: string; trial_start_date?: string; trial_end_date?: string; trial_days?: number; free_days?: number; trial_type?: string; status?: string; created_by?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
      referral_invites: {
        Row: { id: string; inviter_company_id: string; invited_company_id?: string | null; invite_code: string; status: string; trial_days_granted: number; metadata: Json; created_at: string; invited_company_name?: string | null; invited_contact_name?: string | null; accepted_at?: string | null; expires_at?: string | null; };
        Insert: { id?: string; inviter_company_id: string; invited_company_id?: string | null; invite_code: string; status?: string; trial_days_granted?: number; metadata?: Json; created_at?: string; invited_company_name?: string | null; invited_contact_name?: string | null; accepted_at?: string | null; expires_at?: string | null; };
        Update: { id?: string; inviter_company_id?: string; invited_company_id?: string | null; invite_code?: string; status?: string; trial_days_granted?: number; metadata?: Json; created_at?: string; invited_company_name?: string | null; invited_contact_name?: string | null; accepted_at?: string | null; expires_at?: string | null; };
        Relationships: [];
      };
      platform_settings: {
        Row: { key: string; value: Json; description: string | null; updated_by: string | null; updated_at: string; };
        Insert: { key: string; value: Json; description?: string | null; updated_by?: string | null; updated_at?: string; };
        Update: { key?: string; value?: Json; description?: string | null; updated_by?: string | null; updated_at?: string; };
        Relationships: [];
      };
      credit_packages: {
        Row: { id: string; name: string; description?: string | null; credits_amount: number; price_cents: number; is_active: boolean; created_at: string; };
        Insert: { id?: string; name: string; description?: string | null; credits_amount: number; price_cents?: number; is_active?: boolean; created_at?: string; };
        Update: { id?: string; name?: string; description?: string | null; credits_amount?: number; price_cents?: number; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      playback_credit_charges: {
        Row: { id: string; company_id: string; wallet_id: string; playback_log_id: string; credits_charged: number; created_at: string; };
        Insert: { id?: string; company_id: string; wallet_id: string; playback_log_id: string; credits_charged: number; created_at?: string; };
        Update: { id?: string; company_id?: string; wallet_id?: string; playback_log_id?: string; credits_charged?: number; created_at?: string; };
        Relationships: [];
      };
      credit_policy_rules: {
        Row: { id: string; name: string; rule_type: string; received_credits?: number; ceded_credits?: number; is_active: boolean; created_at: string; };
        Insert: { id?: string; name: string; rule_type: string; received_credits?: number; ceded_credits?: number; is_active?: boolean; created_at?: string; };
        Update: { id?: string; name?: string; rule_type?: string; received_credits?: number; ceded_credits?: number; is_active?: boolean; created_at?: string; };
        Relationships: [];
      };
      company_network_preferences: {
        Row: { company_id: string; accepts_network_ads: boolean; max_external_grade_percentage?: number; requires_manual_approval?: boolean; notes?: string | null; blocked_segments: string[]; blocked_companies: string[]; updated_at: string; };
        Insert: { company_id: string; accepts_network_ads?: boolean; max_external_grade_percentage?: number; requires_manual_approval?: boolean; notes?: string | null; blocked_segments?: string[]; blocked_companies?: string[]; updated_at?: string; };
        Update: { company_id?: string; accepts_network_ads?: boolean; max_external_grade_percentage?: number; requires_manual_approval?: boolean; notes?: string | null; blocked_segments?: string[]; blocked_companies?: string[]; updated_at?: string; };
        Relationships: [];
      };
      network_inventory_ledger: {
        Row: { id: string; company_id: string; source_type?: string; credit_type: string; credits_granted: number; credits_used?: number; credits_remaining: number; expires_at?: string | null; status: string; created_at: string; };
        Insert: { id?: string; company_id: string; source_type?: string; credit_type: string; credits_granted: number; credits_used?: number; credits_remaining: number; expires_at?: string | null; status?: string; created_at?: string; };
        Update: { id?: string; company_id?: string; source_type?: string; credit_type?: string; credits_granted?: number; credits_used?: number; credits_remaining?: number; expires_at?: string | null; status?: string; created_at?: string; };
        Relationships: [];
      };
      network_inventory_usage: {
        Row: { id: string; inventory_ledger_id: string; playback_log_id: string; credits_used: number; created_at: string; };
        Insert: { id?: string; inventory_ledger_id: string; playback_log_id: string; credits_used: number; created_at?: string; };
        Update: { id?: string; inventory_ledger_id?: string; playback_log_id?: string; credits_used?: number; created_at?: string; };
        Relationships: [];
      };
      platform_revenue_settings: {
        Row: { id: string; default_platform_fee_percentage: number; minimum_price_cents: number; is_active: boolean; updated_at: string; };
        Insert: { id?: string; default_platform_fee_percentage?: number; minimum_price_cents?: number; is_active?: boolean; updated_at?: string; };
        Update: { id?: string; default_platform_fee_percentage?: number; minimum_price_cents?: number; is_active?: boolean; updated_at?: string; };
        Relationships: [];
      };
      company_ad_offers: {
        Row: { id: string; company_id: string; title: string; description?: string | null; price_cents: number; credits_amount: number; platform_fee_percentage: number; platform_fee_cents: number; seller_net_cents: number; status: string; rejection_reason?: string | null; created_at: string; };
        Insert: { id?: string; company_id: string; title: string; description?: string | null; price_cents: number; credits_amount: number; platform_fee_percentage?: number; platform_fee_cents?: number; seller_net_cents?: number; status?: string; rejection_reason?: string | null; created_at?: string; };
        Update: { id?: string; company_id?: string; title?: string; description?: string | null; price_cents?: number; credits_amount?: number; platform_fee_percentage?: number; platform_fee_cents?: number; seller_net_cents?: number; status?: string; rejection_reason?: string | null; created_at?: string; };
        Relationships: [];
      };
      ad_offer_orders: {
        Row: {
          id: string;
          offer_id: string;
          seller_company_id: string;
          buyer_company_id: string | null;
          gross_amount_cents: number;
          platform_fee_percentage: number;
          platform_fee_cents: number;
          seller_net_cents: number;
          credits_amount: number;
          status: string;
          payment_status: string;
          approval_status: string;
          requested_start_date: string | null;
          requested_end_date: string | null;
          requested_media_asset_id: string | null;
          campaign_id: string | null;
          payment_provider?: string | null;
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_invoice_url?: string | null;
          asaas_bank_slip_url?: string | null;
          asaas_pix_qr_code?: string | null;
          asaas_pix_copy_paste?: string | null;
          payment_due_date?: string | null;
          payment_confirmed_at?: string | null;
          payment_webhook_last_event?: string | null;
          payment_metadata?: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          seller_company_id: string;
          buyer_company_id?: string | null;
          gross_amount_cents: number;
          platform_fee_percentage: number;
          platform_fee_cents: number;
          seller_net_cents: number;
          credits_amount: number;
          status?: string;
          payment_status?: string;
          approval_status?: string;
          requested_start_date?: string | null;
          requested_end_date?: string | null;
          requested_media_asset_id?: string | null;
          campaign_id?: string | null;
          payment_provider?: string | null;
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_invoice_url?: string | null;
          asaas_bank_slip_url?: string | null;
          asaas_pix_qr_code?: string | null;
          asaas_pix_copy_paste?: string | null;
          payment_due_date?: string | null;
          payment_confirmed_at?: string | null;
          payment_webhook_last_event?: string | null;
          payment_metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          offer_id?: string;
          seller_company_id?: string;
          buyer_company_id?: string | null;
          gross_amount_cents?: number;
          platform_fee_percentage?: number;
          platform_fee_cents?: number;
          seller_net_cents?: number;
          credits_amount?: number;
          status?: string;
          payment_status?: string;
          approval_status?: string;
          requested_start_date?: string | null;
          requested_end_date?: string | null;
          requested_media_asset_id?: string | null;
          campaign_id?: string | null;
          payment_provider?: string | null;
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_invoice_url?: string | null;
          asaas_bank_slip_url?: string | null;
          asaas_pix_qr_code?: string | null;
          asaas_pix_copy_paste?: string | null;
          payment_due_date?: string | null;
          payment_confirmed_at?: string | null;
          payment_webhook_last_event?: string | null;
          payment_metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ad_order_delivery_ledger: {
        Row: { id: string; order_id: string; campaign_id: string; seller_company_id: string; buyer_company_id: string; credits_contracted: number; credits_delivered: number; credits_remaining: number; status: string; created_at: string; };
        Insert: { id?: string; order_id: string; campaign_id: string; seller_company_id: string; buyer_company_id: string; credits_contracted: number; credits_delivered?: number; credits_remaining: number; status?: string; created_at?: string; };
        Update: { id?: string; order_id?: string; campaign_id?: string; seller_company_id?: string; buyer_company_id?: string; credits_contracted?: number; credits_delivered?: number; credits_remaining?: number; status?: string; created_at?: string; };
        Relationships: [];
      };
      ad_order_delivery_usage: {
        Row: { id: string; delivery_ledger_id: string; playback_log_id: string; order_id: string; campaign_id: string; media_asset_id: string; screen_id: string; credits_used: number; status: string; created_at: string; };
        Insert: { id?: string; delivery_ledger_id: string; playback_log_id: string; order_id: string; campaign_id: string; media_asset_id: string; screen_id: string; credits_used: number; status?: string; created_at?: string; };
        Update: { id?: string; delivery_ledger_id?: string; playback_log_id?: string; order_id?: string; campaign_id?: string; media_asset_id?: string; screen_id?: string; credits_used?: number; status?: string; created_at?: string; };
        Relationships: [];
      };
      seller_financial_ledger: {
        Row: {
          id: string;
          seller_company_id: string;
          buyer_company_id: string | null;
          ad_offer_order_id: string;
          campaign_id: string | null;
          gross_amount_cents: number;
          platform_fee_cents: number;
          seller_net_cents: number;
          amount_available_cents: number;
          amount_used_for_discount_cents: number;
          amount_pending_cents: number;
          amount_transferred_cents: number;
          last_transfer_at: string | null;
          transfer_status: 'not_requested' | 'partially_transferred' | 'transferred' | 'transfer_failed';
          financial_status: string;
          delivery_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_company_id: string;
          buyer_company_id?: string | null;
          ad_offer_order_id: string;
          campaign_id?: string | null;
          gross_amount_cents: number;
          platform_fee_cents: number;
          seller_net_cents: number;
          amount_available_cents?: number;
          amount_used_for_discount_cents?: number;
          amount_pending_cents?: number;
          amount_transferred_cents?: number;
          last_transfer_at?: string | null;
          transfer_status?: 'not_requested' | 'partially_transferred' | 'transferred' | 'transfer_failed';
          financial_status?: string;
          delivery_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_company_id?: string;
          buyer_company_id?: string | null;
          ad_offer_order_id?: string;
          campaign_id?: string | null;
          gross_amount_cents?: number;
          platform_fee_cents?: number;
          seller_net_cents?: number;
          amount_available_cents?: number;
          amount_used_for_discount_cents?: number;
          amount_pending_cents?: number;
          amount_transferred_cents?: number;
          last_transfer_at?: string | null;
          transfer_status?: 'not_requested' | 'partially_transferred' | 'transferred' | 'transfer_failed';
          financial_status?: string;
          delivery_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_fee_discounts: {
        Row: { id: string; seller_company_id: string; financial_ledger_id: string | null; amount_cents: number; reason: string; applied_by: string; applied_at: string; status: string; };
        Insert: { id?: string; seller_company_id: string; financial_ledger_id?: string | null; amount_cents: number; reason: string; applied_by: string; applied_at?: string; status?: string; };
        Update: { id?: string; seller_company_id?: string; financial_ledger_id?: string | null; amount_cents?: number; reason?: string; applied_by?: string; applied_at?: string; status?: string; };
        Relationships: [];
      };
      platform_terms: {
        Row: { id: string; term_type: 'general_terms' | 'network_participation' | 'media_policy' | 'advertiser_terms' | 'display_partner_terms' | 'financial_discount_policy' | 'marketplace_terms'; version: number; title: string; content: string; is_active: boolean; effective_from: string; created_by: string | null; created_at: string; updated_at: string; metadata: Json | null; };
        Insert: { id?: string; term_type: 'general_terms' | 'network_participation' | 'media_policy' | 'advertiser_terms' | 'display_partner_terms' | 'financial_discount_policy' | 'marketplace_terms'; version?: number; title: string; content: string; is_active?: boolean; effective_from?: string; created_by?: string | null; created_at?: string; updated_at?: string; metadata?: Json | null; };
        Update: { id?: string; term_type?: 'general_terms' | 'network_participation' | 'media_policy' | 'advertiser_terms' | 'display_partner_terms' | 'financial_discount_policy' | 'marketplace_terms'; version?: number; title?: string; content?: string; is_active?: boolean; effective_from?: string; created_by?: string | null; created_at?: string; updated_at?: string; metadata?: Json | null; };
        Relationships: [];
      };
      company_term_acceptances: {
        Row: { id: string; company_id: string; term_id: string; accepted_by: string; accepted_at: string; ip_address: string | null; user_agent: string | null; acceptance_context: string; metadata: Json | null; };
        Insert: { id?: string; company_id: string; term_id: string; accepted_by: string; accepted_at?: string; ip_address?: string | null; user_agent?: string | null; acceptance_context?: string; metadata?: Json | null; };
        Update: { id?: string; company_id?: string; term_id?: string; accepted_by?: string; accepted_at?: string; ip_address?: string | null; user_agent?: string | null; acceptance_context?: string; metadata?: Json | null; };
        Relationships: [];
      };
      asaas_payment_events: {
        Row: {
          id: string;
          webhook_idempotency_key: string;
          asaas_event_id: string | null;
          asaas_payment_id: string;
          ad_offer_order_id: string | null;
          event_type: string;
          payment_status: string;
          raw_payload: Json;
          processing_status: 'processed' | 'duplicate_ignored' | 'failed' | 'ignored';
          error_message: string | null;
          processed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          webhook_idempotency_key: string;
          asaas_event_id?: string | null;
          asaas_payment_id: string;
          ad_offer_order_id?: string | null;
          event_type: string;
          payment_status: string;
          raw_payload: Json;
          processing_status?: 'processed' | 'duplicate_ignored' | 'failed' | 'ignored';
          error_message?: string | null;
          processed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          webhook_idempotency_key?: string;
          asaas_event_id?: string | null;
          asaas_payment_id?: string;
          ad_offer_order_id?: string | null;
          event_type?: string;
          payment_status?: string;
          raw_payload?: Json;
          processing_status?: 'processed' | 'duplicate_ignored' | 'failed' | 'ignored';
          error_message?: string | null;
          processed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      asaas_reconciliation_reviews: {
        Row: {
          id: string;
          asaas_payment_event_id: string | null;
          ad_offer_order_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string;
          review_status: 'pending_review' | 'reviewed' | 'ignored' | 'resolved';
          notes: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asaas_payment_event_id?: string | null;
          ad_offer_order_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string;
          review_status?: 'pending_review' | 'reviewed' | 'ignored' | 'resolved';
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          asaas_payment_event_id?: string | null;
          ad_offer_order_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string;
          review_status?: 'pending_review' | 'reviewed' | 'ignored' | 'resolved';
          notes?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_financial_profiles: {
        Row: {
          id: string;
          company_id: string;
          document_type: 'cnpj' | 'cpf';
          document_number: string;
          legal_name: string;
          trade_name: string | null;
          responsible_name: string;
          responsible_email: string;
          responsible_phone: string;
          bank_code: string;
          bank_name: string;
          bank_agency: string;
          bank_account: string;
          bank_account_digit: string;
          bank_account_type: 'checking' | 'savings';
          pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
          pix_key: string | null;
          asaas_wallet_id: string | null;
          asaas_account_id: string | null;
          asaas_status: 'not_created' | 'created' | 'pending_validation' | 'active' | 'rejected' | 'blocked';
          verification_status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
          approved_by: string | null;
          approved_at: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          document_type: 'cnpj' | 'cpf';
          document_number: string;
          legal_name: string;
          trade_name?: string | null;
          responsible_name: string;
          responsible_email: string;
          responsible_phone: string;
          bank_code: string;
          bank_name: string;
          bank_agency: string;
          bank_account: string;
          bank_account_digit: string;
          bank_account_type: 'checking' | 'savings';
          pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
          pix_key?: string | null;
          asaas_wallet_id?: string | null;
          asaas_account_id?: string | null;
          asaas_status?: 'not_created' | 'created' | 'pending_validation' | 'active' | 'rejected' | 'blocked';
          verification_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          document_type?: 'cnpj' | 'cpf';
          document_number?: string;
          legal_name?: string;
          trade_name?: string | null;
          responsible_name?: string;
          responsible_email?: string;
          responsible_phone?: string;
          bank_code?: string;
          bank_name?: string;
          bank_agency?: string;
          bank_account?: string;
          bank_account_digit?: string;
          bank_account_type?: 'checking' | 'savings';
          pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
          pix_key?: string | null;
          asaas_wallet_id?: string | null;
          asaas_account_id?: string | null;
          asaas_status?: 'not_created' | 'created' | 'pending_validation' | 'active' | 'rejected' | 'blocked';
          verification_status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_financial_profile_logs: {
        Row: {
          id: string;
          seller_financial_profile_id: string;
          company_id: string;
          changed_by: string | null;
          action: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_financial_profile_id: string;
          company_id: string;
          changed_by?: string | null;
          action: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_financial_profile_id?: string;
          company_id?: string;
          changed_by?: string | null;
          action?: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      seller_payout_eligibility: {
        Row: {
          id: string;
          seller_company_id: string;
          buyer_company_id: string | null;
          ad_offer_order_id: string;
          campaign_id: string | null;
          seller_financial_ledger_id: string | null;
          asaas_payment_id: string | null;
          gross_amount_cents: number;
          platform_fee_cents: number;
          seller_net_cents: number;
          eligible_amount_cents: number;
          ineligible_amount_cents: number;
          eligibility_status: 'not_eligible' | 'pending_delivery' | 'pending_financial_profile' | 'pending_asaas_wallet' | 'eligible' | 'blocked' | 'cancelled';
          eligibility_reason: string | null;
          delivery_status: string;
          financial_status: string;
          seller_verification_status: string | null;
          asaas_status: string | null;
          asaas_wallet_id: string | null;
          calculated_at: string;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_company_id: string;
          buyer_company_id?: string | null;
          ad_offer_order_id: string;
          campaign_id?: string | null;
          seller_financial_ledger_id?: string | null;
          asaas_payment_id?: string | null;
          gross_amount_cents?: number;
          platform_fee_cents?: number;
          seller_net_cents?: number;
          eligible_amount_cents?: number;
          ineligible_amount_cents?: number;
          eligibility_status?: 'not_eligible' | 'pending_delivery' | 'pending_financial_profile' | 'pending_asaas_wallet' | 'eligible' | 'blocked' | 'cancelled';
          eligibility_reason?: string | null;
          delivery_status?: string;
          financial_status?: string;
          seller_verification_status?: string | null;
          asaas_status?: string | null;
          asaas_wallet_id?: string | null;
          calculated_at?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_company_id?: string;
          buyer_company_id?: string | null;
          ad_offer_order_id?: string;
          campaign_id?: string | null;
          seller_financial_ledger_id?: string | null;
          asaas_payment_id?: string | null;
          gross_amount_cents?: number;
          platform_fee_cents?: number;
          seller_net_cents?: number;
          eligible_amount_cents?: number;
          ineligible_amount_cents?: number;
          eligibility_status?: 'not_eligible' | 'pending_delivery' | 'pending_financial_profile' | 'pending_asaas_wallet' | 'eligible' | 'blocked' | 'cancelled';
          eligibility_reason?: string | null;
          delivery_status?: string;
          financial_status?: string;
          seller_verification_status?: string | null;
          asaas_status?: string | null;
          asaas_wallet_id?: string | null;
          calculated_at?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_payout_simulations: {
        Row: {
          id: string;
          seller_company_id: string;
          period_start: string;
          period_end: string;
          total_gross_cents: number;
          total_platform_fee_cents: number;
          total_seller_net_cents: number;
          total_eligible_cents: number;
          total_blocked_cents: number;
          created_by: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_company_id: string;
          period_start: string;
          period_end: string;
          total_gross_cents?: number;
          total_platform_fee_cents?: number;
          total_seller_net_cents?: number;
          total_eligible_cents?: number;
          total_blocked_cents?: number;
          created_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_company_id?: string;
          period_start?: string;
          period_end?: string;
          total_gross_cents?: number;
          total_platform_fee_cents?: number;
          total_seller_net_cents?: number;
          total_eligible_cents?: number;
          total_blocked_cents?: number;
          created_by?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      seller_payout_batches: {
        Row: {
          id: string;
          batch_number: string;
          created_by: string | null;
          status: 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'partially_failed' | 'failed' | 'cancelled';
          total_amount_cents: number;
          total_items: number;
          approved_by: string | null;
          approved_at: string | null;
          executed_by: string | null;
          executed_at: string | null;
          cancelled_by: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_number: string;
          created_by?: string | null;
          status?: 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'partially_failed' | 'failed' | 'cancelled';
          total_amount_cents?: number;
          total_items?: number;
          approved_by?: string | null;
          approved_at?: string | null;
          executed_by?: string | null;
          executed_at?: string | null;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          batch_number?: string;
          created_by?: string | null;
          status?: 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'partially_failed' | 'failed' | 'cancelled';
          total_amount_cents?: number;
          total_items?: number;
          approved_by?: string | null;
          approved_at?: string | null;
          executed_by?: string | null;
          executed_at?: string | null;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_payout_batch_items: {
        Row: {
          id: string;
          batch_id: string;
          seller_company_id: string;
          ad_offer_order_id: string;
          campaign_id: string | null;
          seller_financial_ledger_id: string | null;
          seller_payout_eligibility_id: string | null;
          asaas_payment_id: string | null;
          asaas_wallet_id: string | null;
          amount_cents: number;
          status: 'pending' | 'ready' | 'processing' | 'transferred' | 'failed' | 'cancelled' | 'blocked';
          asaas_transfer_id: string | null;
          transfer_response: Json | null;
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          seller_company_id: string;
          ad_offer_order_id: string;
          campaign_id?: string | null;
          seller_financial_ledger_id?: string | null;
          seller_payout_eligibility_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_wallet_id?: string | null;
          amount_cents: number;
          status?: 'pending' | 'ready' | 'processing' | 'transferred' | 'failed' | 'cancelled' | 'blocked';
          asaas_transfer_id?: string | null;
          transfer_response?: Json | null;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          seller_company_id?: string;
          ad_offer_order_id?: string;
          campaign_id?: string | null;
          seller_financial_ledger_id?: string | null;
          seller_payout_eligibility_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_wallet_id?: string | null;
          amount_cents?: number;
          status?: 'pending' | 'ready' | 'processing' | 'transferred' | 'failed' | 'cancelled' | 'blocked';
          asaas_transfer_id?: string | null;
          transfer_response?: Json | null;
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_payout_transfers: {
        Row: {
          id: string;
          seller_company_id: string;
          batch_item_id: string | null;
          seller_financial_ledger_id: string | null;
          amount_cents: number;
          asaas_wallet_id: string;
          asaas_transfer_id: string | null;
          transfer_status: 'created' | 'processing' | 'done' | 'failed' | 'cancelled' | 'reversed';
          requested_by: string | null;
          requested_at: string;
          confirmed_at: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          raw_request: Json | null;
          raw_response: Json | null;
          idempotency_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_company_id: string;
          batch_item_id?: string | null;
          seller_financial_ledger_id?: string | null;
          amount_cents: number;
          asaas_wallet_id: string;
          asaas_transfer_id?: string | null;
          transfer_status?: 'created' | 'processing' | 'done' | 'failed' | 'cancelled' | 'reversed';
          requested_by?: string | null;
          requested_at?: string;
          confirmed_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          raw_request?: Json | null;
          raw_response?: Json | null;
          idempotency_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_company_id?: string;
          batch_item_id?: string | null;
          seller_financial_ledger_id?: string | null;
          amount_cents?: number;
          asaas_wallet_id?: string;
          asaas_transfer_id?: string | null;
          transfer_status?: 'created' | 'processing' | 'done' | 'failed' | 'cancelled' | 'reversed';
          requested_by?: string | null;
          requested_at?: string;
          confirmed_at?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          raw_request?: Json | null;
          raw_response?: Json | null;
          idempotency_key?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_sources: {
        Row: { id: string; created_by: string; source_name: string; source_url: string; source_type: 'rss'; category: string | null; region: string | null; city: string | null; refresh_interval_minutes: number; expiry_hours: number; requires_manual_approval: boolean; is_active: boolean; last_fetched_at: string | null; last_success_at: string | null; last_error: string | null; metadata: Json; created_at: string; updated_at: string; };
        Insert: { id?: string; created_by: string; source_name: string; source_url: string; source_type?: 'rss'; category?: string | null; region?: string | null; city?: string | null; refresh_interval_minutes?: number; expiry_hours?: number; requires_manual_approval?: boolean; is_active?: boolean; last_fetched_at?: string | null; last_success_at?: string | null; last_error?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Update: { id?: string; created_by?: string; source_name?: string; source_url?: string; source_type?: 'rss'; category?: string | null; region?: string | null; city?: string | null; refresh_interval_minutes?: number; expiry_hours?: number; requires_manual_approval?: boolean; is_active?: boolean; last_fetched_at?: string | null; last_success_at?: string | null; last_error?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      informative_content_items: {
        Row: { id: string; company_id: string | null; created_by: string; content_source_id: string | null; content_origin: 'manual' | 'rss'; title: string; summary: string | null; body: string | null; category: string | null; image_url: string | null; media_asset_id: string | null; source_name: string | null; original_url: string | null; rss_dedupe_key: string | null; published_at: string | null; region: string | null; city: string | null; segment: string | null; duration_seconds: number; start_date: string | null; end_date: string | null; status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'active' | 'paused' | 'expired' | 'archived'; is_active: boolean; expires_at: string | null; metadata: Json; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id?: string | null; created_by: string; content_source_id?: string | null; content_origin: 'manual' | 'rss'; title: string; summary?: string | null; body?: string | null; category?: string | null; image_url?: string | null; media_asset_id?: string | null; source_name?: string | null; original_url?: string | null; rss_dedupe_key?: string | null; published_at?: string | null; region?: string | null; city?: string | null; segment?: string | null; duration_seconds?: number; start_date?: string | null; end_date?: string | null; status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'active' | 'paused' | 'expired' | 'archived'; is_active?: boolean; expires_at?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string | null; created_by?: string; content_source_id?: string | null; content_origin?: 'manual' | 'rss'; title?: string; summary?: string | null; body?: string | null; category?: string | null; image_url?: string | null; media_asset_id?: string | null; source_name?: string | null; original_url?: string | null; rss_dedupe_key?: string | null; published_at?: string | null; region?: string | null; city?: string | null; segment?: string | null; duration_seconds?: number; start_date?: string | null; end_date?: string | null; status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'active' | 'paused' | 'expired' | 'archived'; is_active?: boolean; expires_at?: string | null; metadata?: Json; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      screen_content_settings: {
        Row: { id: string; company_id: string; screen_id: string; enable_breathing_content: boolean; enable_manual_content: boolean; enable_rss_content: boolean; ads_between_content: number; content_duration_seconds: number; allowed_categories: string[] | null; fallback_to_ads: boolean; is_active: boolean; metadata: Json; created_at: string; updated_at: string; };
        Insert: { id?: string; company_id: string; screen_id: string; enable_breathing_content?: boolean; enable_manual_content?: boolean; enable_rss_content?: boolean; ads_between_content?: number; content_duration_seconds?: number; allowed_categories?: string[] | null; fallback_to_ads?: boolean; is_active?: boolean; metadata?: Json; created_at?: string; updated_at?: string; };
        Update: { id?: string; company_id?: string; screen_id?: string; enable_breathing_content?: boolean; enable_manual_content?: boolean; enable_rss_content?: boolean; ads_between_content?: number; content_duration_seconds?: number; allowed_categories?: string[] | null; fallback_to_ads?: boolean; is_active?: boolean; metadata?: Json; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      screen_content_logs: {
        Row: { id: string; company_id: string; screen_id: string; content_type: 'manual' | 'rss'; content_id: string; started_at: string; ended_at: string | null; status: 'started' | 'completed' | 'skipped' | 'failed'; error_message: string | null; idempotency_key: string; player_session_id: string | null; metadata: Json; created_at: string; };
        Insert: { id?: string; company_id: string; screen_id: string; content_type: 'manual' | 'rss'; content_id: string; started_at: string; ended_at?: string | null; status: 'started' | 'completed' | 'skipped' | 'failed'; error_message?: string | null; idempotency_key: string; player_session_id?: string | null; metadata?: Json; created_at?: string; };
        Update: { id?: string; company_id?: string; screen_id?: string; content_type?: 'manual' | 'rss'; content_id?: string; started_at?: string; ended_at?: string | null; status?: 'started' | 'completed' | 'skipped' | 'failed'; error_message?: string | null; idempotency_key?: string; player_session_id?: string | null; metadata?: Json; created_at?: string; };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never; };
    Functions: {
      is_master_admin: { Args: Record<PropertyKey, never>; Returns: boolean; };
      get_user_company_ids: { Args: Record<PropertyKey, never>; Returns: string[]; };
      accept_platform_term: { Args: { p_company_id: string; p_term_id: string; p_acceptance_context?: string; p_ip_address?: string; p_user_agent?: string; }; Returns: Json; };
      check_company_required_terms: { Args: { p_company_id: string }; Returns: Json; };
    };
    Enums: { [_ in never]: never; };
    CompositeTypes: { [_ in never]: never; };
  };
}
