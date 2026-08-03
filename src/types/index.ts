import { Database } from './database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Company = Database['public']['Tables']['companies']['Row'];
export type CompanyUser = Database['public']['Tables']['company_users']['Row'];
export type Segment = Database['public']['Tables']['segments']['Row'];
export type CompanySegment = Database['public']['Tables']['company_segments']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export type Screen = Database['public']['Tables']['screens']['Row'];
export type ScreenPairingCode = Database['public']['Tables']['screen_pairing_codes']['Row'];
export type MediaAsset = Database['public']['Tables']['media_assets']['Row'];

export type Playlist = Database['public']['Tables']['playlists']['Row'];
export type PlaylistItem = Database['public']['Tables']['playlist_items']['Row'];
export type ScreenPlaylist = Database['public']['Tables']['screen_playlists']['Row'];
export type PlaybackLog = Database['public']['Tables']['playback_logs']['Row'];

export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignMedia = Database['public']['Tables']['campaign_media']['Row'];
export type CampaignScreen = Database['public']['Tables']['campaign_screens']['Row'];

export type CompanyTrial = Database['public']['Tables']['company_trials']['Row'];
export type ReferralInvite = Database['public']['Tables']['referral_invites']['Row'];

export type CreditPackage = Database['public']['Tables']['credit_packages']['Row'];
export type PlaybackCreditCharge = Database['public']['Tables']['playback_credit_charges']['Row'];

export type CreditPolicyRule = Database['public']['Tables']['credit_policy_rules']['Row'];
export type CompanyNetworkPreferences = Database['public']['Tables']['company_network_preferences']['Row'];
export type NetworkInventoryLedger = Database['public']['Tables']['network_inventory_ledger']['Row'];
export type NetworkInventoryUsage = Database['public']['Tables']['network_inventory_usage']['Row'];

export type PlatformRevenueSettings = Database['public']['Tables']['platform_revenue_settings']['Row'];
export type CompanyAdOffer = Database['public']['Tables']['company_ad_offers']['Row'];
export type AdOfferOrder = Database['public']['Tables']['ad_offer_orders']['Row'];

export type AdOrderDeliveryLedger = Database['public']['Tables']['ad_order_delivery_ledger']['Row'];
export type AdOrderDeliveryUsage = Database['public']['Tables']['ad_order_delivery_usage']['Row'];

export type SellerFinancialLedger = Database['public']['Tables']['seller_financial_ledger']['Row'];
export type MonthlyFeeDiscount = Database['public']['Tables']['monthly_fee_discounts']['Row'];

export type PlatformTerm = Database['public']['Tables']['platform_terms']['Row'];
export type CompanyTermAcceptance = Database['public']['Tables']['company_term_acceptances']['Row'];
export type AsaasPaymentEvent = Database['public']['Tables']['asaas_payment_events']['Row'];
export type AsaasReconciliationReview = Database['public']['Tables']['asaas_reconciliation_reviews']['Row'];
export type SellerFinancialProfile = Database['public']['Tables']['seller_financial_profiles']['Row'];
export type SellerFinancialProfileLog = Database['public']['Tables']['seller_financial_profile_logs']['Row'];
export type SellerPayoutEligibility = Database['public']['Tables']['seller_payout_eligibility']['Row'];
export type SellerPayoutSimulation = Database['public']['Tables']['seller_payout_simulations']['Row'];
export type SellerPayoutBatch = Database['public']['Tables']['seller_payout_batches']['Row'];
export type SellerPayoutBatchItem = Database['public']['Tables']['seller_payout_batch_items']['Row'];
export type SellerPayoutTransfer = Database['public']['Tables']['seller_payout_transfers']['Row'];

export type UserRole = 'admin' | 'operator' | 'external';
export type ScreenOrientation = 'horizontal' | 'vertical';
export type ScreenStatus = 'pending_pairing' | 'online' | 'offline' | 'inactive';

export type MediaType = 'image' | 'video';
export type MediaOrientation = 'horizontal' | 'vertical' | 'square' | 'unknown';
export type PlaybackDurationSeconds = number;
export type MediaStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';

export type PlaylistOrientation = 'horizontal' | 'vertical' | 'mixed';
export type PlaylistStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type PlaybackStatus = 'started' | 'completed' | 'skipped' | 'failed';

export type CampaignType = 'internal' | 'paid' | 'exchange' | 'external';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled' | 'archived';

export type TrialStatus = 'active' | 'expired' | 'converted' | 'cancelled';
export type ReferralInviteStatus = 'created' | 'sent' | 'accepted' | 'expired' | 'converted' | 'cancelled';

export type AdOfferStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'archived';
export type AdOrderStatus = 'draft' | 'requested' | 'approved' | 'rejected' | 'cancelled' | 'paid_manual' | 'converted_to_campaign';
export type AdOrderPaymentStatus = 'not_required' | 'pending' | 'paid_manual' | 'failed' | 'refunded';
export type AdOrderApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'cancelled';

export type RuleType = 
  | 'trial_standard' 
  | 'trial_immediate_conversion' 
  | 'vip_invite' 
  | 'paid_plan_monthly' 
  | 'manual_bonus' 
  | 'exchange_agreement';

export type CreditType = 
  | 'paid_credit'
  | 'trial_credit'
  | 'exchange_credit'
  | 'bonus_credit'
  | 'referral_credit'
  | 'network_inventory_credit'
  | 'monthly_network_quota'
  | 'usage_debit';

export type SourceType =
  | 'manual_adjustment'
  | 'credit_package'
  | 'playback_charge'
  | 'trial_grant'
  | 'referral_bonus'
  | 'network_quota'
  | 'exchange'
  | 'refund';

export interface UserCompanyContext {
  company: Company;
  role: UserRole;
}
