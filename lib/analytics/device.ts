export type DeviceType = "mobile_phone" | "desktop";

const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function getDeviceType(userAgentOverride?: string): DeviceType {
  if (typeof window === "undefined" && !userAgentOverride) {
    return "desktop";
  }

  const ua =
    userAgentOverride ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isMobileUa = MOBILE_UA_PATTERN.test(ua);
  const isNarrowViewport =
    typeof window !== "undefined" ? window.innerWidth < 1024 : false;

  return isMobileUa || isNarrowViewport ? "mobile_phone" : "desktop";
}

