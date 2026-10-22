// Client for the DeFlock API's /officials endpoint: who answers for a camera
// (city, county, state legislators), looked up from the camera's coordinates.
// Only the camera's location is sent, never anything about the user.

const OFFICIALS_API_URL = (import.meta.env.VITE_OFFICIALS_API_URL as string | undefined) || 'https://api.deflock.org/officials';

export interface LocalGov {
  name: string;
  fips: string;
  website: string | null;
  /** Mayor or county head from Wikidata; can lag after an election */
  head: string | null;
}

export interface Legislator {
  name: string;
  givenName: string;
  familyName: string;
  party: string;
  chamber: 'upper' | 'lower' | 'legislature';
  district: string;
  email: string | null;
  url: string | null;
}

export interface Officials {
  state: { code: string; name: string; fips: string };
  place: LocalGov | null;
  county: LocalGov | null;
  stateLegislators: Legislator[];
}

export class NotInUSError extends Error {}

const cache = new Map<string, Promise<Officials>>();

export function fetchOfficials(lat: number, lon: number): Promise<Officials> {
  // Same ~110m rounding as the API cache, so re-opening a camera is instant
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const params = new URLSearchParams({ lat: lat.toString(), lon: lon.toString() });
      const response = await fetch(`${OFFICIALS_API_URL}?${params}`);
      if (response.status === 404) throw new NotInUSError('No US officials for this location');
      if (!response.ok) throw new Error(`Officials API error: ${response.status}`);
      return response.json() as Promise<Officials>;
    })();
    // Don't cache failures; let the user retry
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}
