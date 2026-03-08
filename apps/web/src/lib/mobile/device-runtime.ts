export interface DeviceRuntimeInfo {
  platform: string;
  appVersion: string | null;
  osVersion: string | null;
  wrapperChannel: string | null;
}

function cleanToken(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function encodeDeviceRuntime(input: {
  platform?: string | null;
  appVersion?: string | null;
  osVersion?: string | null;
  wrapperChannel?: string | null;
}): string {
  const platform = cleanToken(input.platform ?? null, 40) ?? "unknown";
  const appVersion = cleanToken(input.appVersion ?? null, 30);
  const osVersion = cleanToken(input.osVersion ?? null, 30);
  const wrapperChannel = cleanToken(input.wrapperChannel ?? null, 40);

  const segments = [platform];
  if (appVersion) segments.push(`app=${appVersion}`);
  if (osVersion) segments.push(`os=${osVersion}`);
  if (wrapperChannel) segments.push(`channel=${wrapperChannel}`);
  return segments.join(";");
}

export function parseDeviceRuntime(raw: string | null | undefined): DeviceRuntimeInfo {
  const normalized = cleanToken(raw ?? null, 240) ?? "unknown";
  const [platformSegment, ...meta] = normalized.split(";").map((segment) => segment.trim());

  const result: DeviceRuntimeInfo = {
    platform: platformSegment || "unknown",
    appVersion: null,
    osVersion: null,
    wrapperChannel: null,
  };

  for (const entry of meta) {
    const [keyRaw, ...valueRaw] = entry.split("=");
    const key = keyRaw?.trim().toLowerCase();
    const value = valueRaw.join("=").trim();
    if (!key || !value) continue;
    if (key === "app") result.appVersion = value;
    if (key === "os") result.osVersion = value;
    if (key === "channel") result.wrapperChannel = value;
  }

  return result;
}
