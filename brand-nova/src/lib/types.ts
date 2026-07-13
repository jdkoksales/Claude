export type LeadStatus =
  | "new"
  | "queued"
  | "sending"
  | "emailed"
  | "followup_1"
  | "followup_2"
  | "followup_3"
  | "positive_reply"
  | "question"
  | "warm_lead"
  | "meeting_request"
  | "website_check_completed"
  | "not_interested"
  | "spam"
  | "out_of_office"
  | "bounced"
  | "unsubscribed"
  | "stopped"
  | "skipped";

/** Statuses that count as a warm lead — the only KPI. */
export const WARM_STATUSES: LeadStatus[] = [
  "positive_reply",
  "question",
  "warm_lead",
  "meeting_request",
  "website_check_completed",
];

/** Statuses in which the lead may still receive automated email. */
export const ACTIVE_OUTREACH_STATUSES: LeadStatus[] = [
  "emailed",
  "followup_1",
  "followup_2",
  "followup_3",
];

export type ReplyClassification =
  | "interested"
  | "question"
  | "warm_lead"
  | "meeting_request"
  | "website_check_completed"
  | "not_interested"
  | "spam"
  | "out_of_office";

/** Reply classifications that turn a lead warm. */
export const WARM_CLASSIFICATIONS: ReplyClassification[] = [
  "interested",
  "question",
  "warm_lead",
  "meeting_request",
  "website_check_completed",
];

export interface Company {
  id: string;
  name: string;
  website_url: string;
  domain: string;
  email: string;
  email_valid: boolean | null;
  industry: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  company_id: string;
  status: LeadStatus;
  warm_since: string | null;
  next_action_at: string | null;
  followups_sent: number;
  created_at: string;
}

export interface WebsiteAnalysis {
  id: string;
  company_id: string;
  raw_homepage_text: string | null;
  fetched_at: string | null;
  what_they_do: string | null;
  target_audience: string | null;
  services: string[];
  usp: string[];
  trust_signals: string[];
  ctas: string[];
  tone: string | null;
  improvement_observation: string | null;
  positive: string | null;
  contact_first_name: string | null;
  analysis_version: number;
  status: "pending" | "done" | "failed" | "unreachable" | "no_observation";
}

export interface EmailSequence {
  id: string;
  lead_id: string;
  step: number;
  subject: string;
  body: string;
  observation_used: string | null;
  strategy_tags: Record<string, string>;
  sent_at: string | null;
  provider_message_id: string | null;
  status: "draft" | "sent" | "bounced" | "failed";
}

export interface Reply {
  id: string;
  lead_id: string;
  email_sequence_id: string | null;
  from_email: string | null;
  subject: string | null;
  raw_body: string;
  received_at: string;
  classification: ReplyClassification | null;
  classification_confidence: number | null;
  auto_replied: boolean;
  auto_reply_body: string | null;
  needs_human: boolean;
}

export interface Settings {
  id: number;
  user_name: string;
  from_name: string;
  from_email: string;
  website_check_url: string;
  daily_send_cap: number;
  sending_hours: {
    start: string;
    end: string;
    tz: string;
    days: number[];
  };
  daily_warm_lead_goal: number;
  max_followups: number;
  followup_delay_days: number[];
  /** 0 = auto-spread across the window; >0 = at most 1 email per N minutes. */
  send_interval_minutes: number;
  auto_reply_confidence_threshold: number;
  auto_reply_enabled: boolean;
  paused: boolean;
}

export interface Insight {
  dimension: string;
  key: string;
  warm_lead_rate: number;
  sample_size: number;
}

export type ActivityType =
  | "analyzing"
  | "writing"
  | "sending"
  | "reading"
  | "learning"
  | "followup"
  | "warm_lead"
  | "import"
  | "system"
  | "waiting";

export interface ActivityEntry {
  id: number;
  occurred_at: string;
  type: ActivityType;
  company_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
}
