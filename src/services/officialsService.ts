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
  phone: string | null;
  url: string | null;
}

/** A district containing the camera with no current member in the data, usually a vacancy */
export interface UnfilledSeat {
  chamber: 'upper' | 'lower';
  district: string;
}

interface GovContact {
  /** Governing body, e.g. "Quorum Court" or "City Council"; null where a state's counties or places differ */
  body: string | null;
  /** How its leader is addressed, e.g. "County Judge" or "Mayor" */
  headTitle: string | null;
  email: string | null;
  phone: string | null;
  /** Page the contact came from */
  contactPage: string | null;
  /** 'verified' = a person checked it; 'found' = read from the government's site, not yet checked */
  contactStatus: 'verified' | 'found' | null;
}

export type County = LocalGov & GovContact;

export interface Place extends LocalGov, GovContact {
  /** Census place type: "city", "town", "village", "borough", ...; null when unknown */
  type: string | null;
}

export interface Officials {
  state: { code: string; name: string; fips: string };
  place: Place | null;
  county: County | null;
  /** Why there's no county card (no county government, independent city, ...) */
  countyNote: string | null;
  stateLegislators: Legislator[];
  unfilledSeats: UnfilledSeat[];
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
