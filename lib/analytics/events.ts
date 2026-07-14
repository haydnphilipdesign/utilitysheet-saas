"use client";

import { track } from "@vercel/analytics";
import { getDeviceType } from "@/lib/analytics/device";

type BasePayload = {
  device?: "mobile_phone" | "desktop";
  location?: string;
  page?: string;
};

type AnalyticsEventMap = {
  landing_cta_clicked: BasePayload & {
    cta_id: string;
    destination: string;
  };
  landing_primary_cta_viewed: BasePayload & {
    cta_id: string;
  };
  landing_primary_cta_clicked: BasePayload & {
    cta_id: string;
    destination: string;
  };
  landing_section_viewed: BasePayload & {
    section_id: string;
  };
  pdf_attachment_value_prop_viewed: BasePayload & {
    section_id: string;
  };
  landing_demo_video_played: BasePayload;
  signup_started: BasePayload & {
    method: "email" | "google";
    source: string;
  };
  signup_completed: BasePayload & {
    method: "email" | "google";
    source: string;
  };
  signup_verification_required: BasePayload & {
    method: "email";
    source: string;
  };
  signup_verified: BasePayload & {
    source: string;
  };
  account_created: BasePayload & {
    source: string;
  };
  defaults_provisioned: BasePayload & {
    source: string;
    organization_created: boolean;
    brand_profile_created: boolean;
    intake_link_created: boolean;
  };
  dashboard_first_view: BasePayload & {
    source: string;
  };
  dashboard_first_run_link_viewed: BasePayload & {
    source: string;
  };
  onboarding_step_viewed: BasePayload & {
    step: string;
    step_number: number;
  };
  onboarding_step_completed: BasePayload & {
    step: string;
    step_number: number;
    method: "completed" | "skipped";
  };
  onboarding_completed: BasePayload & {
    destination: string;
  };
  progressive_setup_viewed: BasePayload & {
    source: string;
  };
  progressive_setup_task_completed: BasePayload & {
    source: string;
    task: string;
    method: string;
  };
  first_request_started: BasePayload & {
    source: string;
  };
  first_request_created: BasePayload & {
    source: string;
    utility_count: number;
  };
  seller_link_copied: BasePayload & {
    source: string;
  };
  seller_link_sms_copied: BasePayload & {
    source: string;
  };
  seller_link_email_opened: BasePayload & {
    source: string;
  };
  setup_dismissed: BasePayload & {
    source: string;
    destination: string;
  };
  new_request_started: BasePayload & {
    source: string;
  };
  new_request_created: BasePayload & {
    source: string;
    utility_count: number;
  };
  seller_step_viewed: BasePayload & {
    step: string;
    packet_mode?: "simple" | "advanced";
  };
  seller_submitted: BasePayload & {
    source: "seller_flow";
    utility_count: number;
    packet_mode?: "simple" | "advanced";
  };
  packet_mode_selected: BasePayload & {
    mode: "simple" | "advanced";
  };
  advanced_module_toggled: BasePayload & {
    module: string;
    enabled: boolean;
  };
  mode_switch_attempted: BasePayload & {
    from_mode: "simple" | "advanced";
    to_mode: "simple" | "advanced";
  };
  mode_switch_blocked: BasePayload & {
    from_mode: "simple" | "advanced";
    to_mode: "simple" | "advanced";
    reason: string;
  };
  advanced_packet_generated: BasePayload & {
    request_id?: string;
  };
  advanced_packet_downloaded: BasePayload & {
    token?: string;
  };
  packet_action_clicked: BasePayload & {
    action: "copy_link" | "download_pdf" | "phone_tap" | "website_tap";
  };
  packet_referral_cta_clicked: BasePayload & {
    source: "packet_share_page";
    has_referral_code: boolean;
  };
  dashboard_reusable_link_copied: BasePayload & {
    location: string;
  };
  dashboard_reusable_slug_save_attempted: BasePayload & {
    location: string;
  };
  dashboard_reusable_slug_save_succeeded: BasePayload & {
    location: string;
  };
  dashboard_reusable_upgrade_clicked: BasePayload & {
    location: string;
  };
  intake_address_continue_clicked: BasePayload & {
    location: string;
    input_mode: "single" | "confirm";
  };
  intake_address_validation_failed: BasePayload & {
    location: string;
    stage: "client" | "server";
    missing_fields: ("street" | "city" | "state" | "zip")[];
  };
  intake_address_confirmed: BasePayload & {
    location: string;
    source: "confirm_step";
  };
  intake_address_autocomplete_selected: BasePayload & {
    location: string;
    has_place_id: boolean;
    is_complete: boolean;
  };
  seller_help_contact_clicked: BasePayload & {
    contact_type: "email" | "phone" | "website";
    step: string;
  };
  seller_save_link_requested: BasePayload & {
    step: string;
  };
  seller_save_link_sent: BasePayload & {
    step: string;
    success: boolean;
  };
  seller_utility_skipped: BasePayload & {
    category: string;
    reason: "i_dont_know" | "skipped_section";
  };
  seller_provider_search_no_results_committed: BasePayload & {
    category: string;
    query_length: number;
  };
  seller_advanced_section_skipped: BasePayload & {
    module: string;
  };
  seller_submission_retry_clicked: BasePayload & {
    error_kind: "network" | "server" | "rate_limit" | "unknown";
  };
  seller_success_pdf_downloaded: BasePayload;
  seller_success_email_confirmation_requested: BasePayload & {
    success: boolean;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

type TrackPrimitive = string | number | boolean | null | undefined;

function toTrackPrimitive(value: unknown): TrackPrimitive {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(",");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toTrackProperties(
  payload: Record<string, unknown>
): Record<string, TrackPrimitive> {
  const out: Record<string, TrackPrimitive> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = toTrackPrimitive(value);
  }
  return out;
}

export function trackEvent<E extends AnalyticsEventName>(
  eventName: E,
  payload: AnalyticsEventMap[E]
) {
  if (typeof window === "undefined") {
    return;
  }

  const enrichedPayload: Record<string, unknown> = {
    ...payload,
    device: payload.device ?? getDeviceType(),
  };

  track(eventName, toTrackProperties(enrichedPayload));
}
