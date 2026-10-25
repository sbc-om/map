/**
 * Shared access to the free, key-less geo services (Nominatim geocoding and
 * OSRM routing) with request timeouts and server failover.
 *
 * No custom User-Agent header is sent: browsers forbid or preflight it, and
 * the Referer the browser sends already satisfies Nominatim's usage policy.
 */

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

/** Public OSRM servers with the same API, tried in order. */
const OSRM_DRIVING_URLS = [
  "https://router.project-osrm.org/route/v1/driving",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
];

const DEFAULT_TIMEOUT_MS = 8000;

/** GET a JSON document, failing after `timeoutMs` instead of hanging. */
export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Nominatim `/search`; `params` is the query string without a leading `?`. */
export function nominatimSearch<T>(params: string): Promise<T> {
  return fetchJson<T>(`${NOMINATIM_URL}/search?${params}`);
}

/** Nominatim `/reverse`; `params` is the query string without a leading `?`. */
export function nominatimReverse<T>(params: string): Promise<T> {
  return fetchJson<T>(`${NOMINATIM_URL}/reverse?${params}`);
}

/**
 * OSRM driving route. `coordsAndQuery` is everything after `/driving/`,
 * e.g. `58.4,23.6;58.5,23.58?overview=full`. A server that errors or
 * answers anything but `code: "Ok"` hands over to the next one.
 */
export async function osrmDrivingRoute<T extends { code: string }>(
  coordsAndQuery: string
): Promise<T> {
  let lastError: unknown = new Error("Routing service unavailable");
  for (const base of OSRM_DRIVING_URLS) {
    try {
      const data = await fetchJson<T>(`${base}/${coordsAndQuery}`);
      if (data.code === "Ok") return data;
      lastError = new Error(`Routing failed: ${data.code}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
