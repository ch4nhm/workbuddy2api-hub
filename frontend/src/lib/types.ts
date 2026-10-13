export type Realm = "intl" | "cn";

export interface Credits {
  remain: number;
  used: number;
  size: number;
  used_percent: string;
  remain_percent: string;
  is_paid_user: boolean;
  checkin?: {
    today_checked_in: boolean;
    streak_days: number;
    daily_credit: number;
    today_credit: number;
    active: boolean;
  };
  earliest_expiring?: {
    name: string;
    remain: number;
    cycle_end_time: string;
    days_left: number;
  } | null;
  packages?: CreditsPackage[];
  updated_at?: number;
  updated_iso?: string;
}

export interface CreditsPackage {
  name: string;
  package_code?: string;
  grant_reason?: string;
  remain: number;
  used: number;
  size: number;
  in_usage?: boolean;
  no_expiry?: boolean;
  cycle_start_time?: string;
  cycle_end_time?: string;
  expire_time?: string;
  days_left?: number | null;
  is_expired?: boolean;
}

export interface ModelCooldown {
  model: string;
  expiresAt: number;
  cappedAt?: number;
}

export interface Account {
  uid: string;
  nickname: string;
  domain?: string;
  realm: Realm;
  platform?: string;
  product?: string;
  enabled: boolean;
  weight: number;
  note: string;
  source?: string;
  proxySlot?: string;
  proxy?: string;
  expiresAt?: number;
  expiresIn?: string;
  hasRefreshToken?: boolean;
  lastError?: string;
  lastErrorDetail?: unknown;
  inCooldown?: boolean;
  cooldownFor?: string | null;
  modelCooldowns?: ModelCooldown[];
  softStreak?: number;
  breakerFor?: string | null;
  degradeFor?: string | null;
  addedAt?: number;
  credits?: Credits;
  reserveCredits?: number;
  reserveBlocked?: boolean;
  dailyTokenLimit?: number;
  dailyTokensToday?: number | null;
  dailyLimitBlocked?: boolean;
  dailyCreditLimit?: number;
  dailyCreditsToday?: number | null;
  creditLimitReached?: boolean;
  modelDailyTokenLimit?: number;
  modelDailyTokens?: Record<string, number> | null;
  lastCheckin?: string | null;
  lastDailyChat?: string | null;
  lastActivityReport?: string | null;
  canCheckin?: boolean;
  canDailyChat?: boolean;
  canReportActivity?: boolean;
  machineId?: string;
  sessionId?: string;
}

export interface Model {
  id: string;
  name?: string;
  description?: string;
  owned_by?: string;
  vendor?: string;
  credits?: string | number | null;
  capabilities?: { vision?: boolean; tool_calls?: boolean; reasoning?: boolean };
  supports_vision?: boolean;
  supports_tool_calls?: boolean;
  supports_reasoning?: boolean;
  reasoning_efforts?: string[];
  reasoning_fixed_effort?: string | null;
  context_length?: number;
  context_windows?: number[];
  max_output_tokens?: number;
  output_clamp?: number;
  tags?: string[];
}

export interface UsageTotals {
  requests: number;
  errors: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  credit: number;
  cost_cny: number;
  ttft_sum?: number;
  ttft_n?: number;
  speed_sum?: number;
  speed_n?: number;
  elapsed_sum?: number;
  elapsed_n?: number;
  cache_hit_pct?: number;
  reasoning_ratio?: number;
  ttft_ms_avg?: number;
  speed_avg?: number;
  elapsed_ms_avg?: number;
}

export interface UsageResponse extends UsageTotals {
  started?: number;
  since?: string;
  realm?: string;
  usd_cny?: number;
  accounts_map?: Record<string, { nickname: string; realm: Realm }>;
  by_model?: Record<string, UsageTotals>;
  by_model_realm?: Record<string, Record<string, UsageTotals>>;
  account?: { accounts?: number; accounts_ready?: number };
}

export interface UsageRecentRow {
  at: number;
  iso: string;
  model: string;
  stream: boolean;
  outcome: string;
  elapsed_ms: number;
  ttft_ms?: number;
  gen_ms?: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  credit: number;
  account: string;
  realm: Realm;
  key?: string;
  reasoning_effort?: string;
  tokens_per_sec?: number;
  cache_hit_pct?: number;
  cost_cny?: number;
}

export interface UsageRecent {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  usd_cny?: number;
  rows: UsageRecentRow[];
}

export interface AnalyticsResponse {
  window: { since: number; until: number | null };
  realm: string;
  usd_cny?: number;
  summary: { window: UsageTotals; all_time: UsageTotals };
  accounts: AnalyticsAccount[];
  models?: Record<string, AnalyticsModel>;
}

export interface AnalyticsAccount {
  uid: string;
  nickname: string;
  realm: Realm;
  domain?: string;
  window: UsageTotals;
  all_time: UsageTotals;
  window_models?: Record<string, AnalyticsModel>;
  all_models?: Record<string, AnalyticsModel>;
  credits?: Credits;
}

export interface AnalyticsModel {
  requests: number;
  tokens: number;
  reasoning: number;
  cost_cny: number;
}

export interface TimeseriesResponse {
  realm: string;
  bucket_seconds: number;
  series: Array<{
    at: number;
    requests: number;
    errors: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    cached_tokens: number;
    credit: number;
    cost_cny?: number;
  }>;
}

export interface PerfBucket {
  avg: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  samples: number;
}

export interface PerfResponse {
  sampled: number;
  success: number;
  errors: number;
  client_aborted: number;
  success_rate_pct: number;
  ttft_ms?: PerfBucket;
  generation_ms?: PerfBucket;
  wall_ms?: PerfBucket;
  tokens_per_sec?: PerfBucket;
  cache_hit_pct?: PerfBucket;
  by_model?: Record<string, PerfResponse>;
}

export interface Settings {
  panel_password_is_default?: boolean;
  api_key_set?: boolean;
  api_key_masked?: string;
  auth_required?: boolean;
  api_keys?: ApiKeyRecord[];
  deleted_api_keys?: ApiKeyRecord[];
  limits?: Record<string, { global: number; intl: number | null; cn: number | null }>;
  reserve_credits?: number;
  daily_token_limit?: number;
  daily_credit_limit?: number;
  model_daily_token_limit?: number;
  pricing_refresh_minutes?: number;
  credits_refresh_hours?: number;
  ui_language?: string;
  pricing_variant_inherit?: boolean;
  pricing_enabled?: boolean;
  auto_switch_product?: boolean;
  daily_chat_web?: boolean;
  local_web_tools?: boolean;
  remaining_priority_enabled?: boolean;
  egress_backoff_enabled?: boolean;
  accounts_collapsed?: boolean;
  accounts_separate_tab?: boolean;
  key_before_hidden?: boolean;
  hidden_pages?: string[];
  update_check_enabled?: boolean;
  upstream?: {
    header_timeout_seconds: number;
    idle_timeout_seconds: number;
    device_token?: string;
    device_token_file?: string;
  };
  prompt?: { mode: string; file: string };
  accounts_dir?: string;
  usage_dir?: string;
  settings_file?: string;
  version?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  realm: Realm | "all";
  models: string[];
  enabled: boolean;
  masked: string;
  source?: string;
  created_at?: string;
  deleted_at?: string;
  key?: string;
}

export interface SchedulerStatus {
  enabled: boolean;
  mode?: string;
  mode_cn?: string;
  mode_intl?: string;
  last_run_time?: string | null;
  next_run_time?: string | null;
  logs?: string[];
}

export interface GrowthTask {
  task_code: string;
  name: string;
  description?: string;
  jump_url?: string;
  status: string;
  task_type?: string;
  current: number;
  target: number;
  reward_credit?: number;
  reward_energy?: number;
  unforgeable?: boolean;
  reason?: string;
}

export interface TasksResponse {
  tasks: GrowthTask[];
  summary?: {
    streak_days?: number;
    energy?: number;
    makeup_cards?: number;
    lottery_chances?: number;
    travel?: {
      state?: string;
      reward_credit?: number;
      ends_at?: string;
      started_at?: string;
    };
  };
  accounts?: Array<{ uid: string; nickname: string; realm: Realm }>;
}

export interface ActivityRow {
  ts: string;
  uid: string;
  nickname?: string;
  realm: Realm;
  task: string;
  trigger: string;
  ok: boolean;
  message?: string;
}

export interface ActivityResponse {
  rows: ActivityRow[];
  total: number;
  limit?: number;
  range?: string;
}

export interface LogRow {
  id: number;
  ts: string;
  time: string;
  level: string;
  tag: string;
  msg: string;
}

export interface LogsResponse {
  total: number;
  logs: LogRow[];
  max_id?: number;
}

export interface ProxySlot {
  slot: string;
  url?: string;
  enabled?: boolean;
  status?: string;
  latency_ms?: number | null;
  exit_ip?: string | null;
  last_error?: string | null;
  bound_accounts?: number;
}
