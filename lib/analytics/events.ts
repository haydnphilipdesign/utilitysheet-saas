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
  signup_started: BasePayload & {
    method: "email" | "google";
    source: string;
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
