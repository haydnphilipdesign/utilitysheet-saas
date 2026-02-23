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
  };
  seller_submitted: BasePayload & {
    source: "seller_flow";
    utility_count: number;
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
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export function trackEvent<E extends AnalyticsEventName>(
  eventName: E,
  payload: AnalyticsEventMap[E]
) {
  if (typeof window === "undefined") {
    return;
  }

  track(eventName, {
    ...payload,
    device: payload.device ?? getDeviceType(),
  });
}
