/** Distances et positions approximatives (centres de quartiers) pour le filtre « Autour de moi ». */
export type LatLng = { lat: number; lng: number };

export const distanceOptions = [1, 2, 5, 10] as const;

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rectangle qui contient le cercle : premier filtre rapide en base, avant le calcul exact. */
export function boundingBox(c: LatLng, km: number) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return { lat: { gte: c.lat - dLat, lte: c.lat + dLat }, lng: { gte: c.lng - dLng, lte: c.lng + dLng } };
}

/** « 43.123,-4.567 » → position, arrondie à ~100 m (on ne garde jamais la position exacte). */
export function parseNear(raw: string | undefined | null): LatLng | null {
  const m = raw?.match(/^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Math.round(Number(m[1]) * 1000) / 1000;
  const lng = Math.round(Number(m[2]) * 1000) / 1000;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km < 10 ? km.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(km)} km`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const CITY: Record<string, LatLng> = {
  marbella: { lat: 36.5101, lng: -4.8825 },
  malaga: { lat: 36.7213, lng: -4.4214 },
  estepona: { lat: 36.4256, lng: -5.1459 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  paris: { lat: 48.8566, lng: 2.3522 },
  "tel aviv": { lat: 32.0853, lng: 34.7818 },
};

export const AREA: Record<string, Record<string, LatLng>> = {
  marbella: {
    "casco antiguo": { lat: 36.5107, lng: -4.8848 },
    "centre historique": { lat: 36.5107, lng: -4.8848 },
    "vieille ville": { lat: 36.5107, lng: -4.8848 },
    "paseo maritimo": { lat: 36.5065, lng: -4.885 },
    "playa de la fontanilla": { lat: 36.507, lng: -4.893 },
    "playa de venus": { lat: 36.5068, lng: -4.887 },
    "puerto deportivo": { lat: 36.5061, lng: -4.882 },
    "parque de la alameda": { lat: 36.5089, lng: -4.8855 },
    "golden mile": { lat: 36.504, lng: -4.92 },
    "playa del cable": { lat: 36.504, lng: -4.905 },
    "el angel": { lat: 36.505, lng: -4.91 },
    "puerto banus": { lat: 36.4855, lng: -4.953 },
    "nueva andalucia": { lat: 36.499, lng: -4.956 },
    "san pedro": { lat: 36.487, lng: -4.99 },
    "la canada": { lat: 36.516, lng: -4.87 },
    "sierra blanca": { lat: 36.523, lng: -4.901 },
    cabopino: { lat: 36.489, lng: -4.743 },
    elviria: { lat: 36.498, lng: -4.77 },
    ojen: { lat: 36.565, lng: -4.855 },
  },
  malaga: {
    soho: { lat: 36.717, lng: -4.425 },
    "la malagueta": { lat: 36.7195, lng: -4.408 },
    "muelle uno": { lat: 36.7175, lng: -4.414 },
    "el limonar": { lat: 36.723, lng: -4.398 },
    pedregalejo: { lat: 36.7215, lng: -4.386 },
    "el palo": { lat: 36.7225, lng: -4.36 },
    teatinos: { lat: 36.728, lng: -4.472 },
    "el perchel": { lat: 36.715, lng: -4.43 },
    "depart gare maria zambrano": { lat: 36.7115, lng: -4.4325 },
    "centre historique": { lat: 36.7213, lng: -4.4214 },
  },
  estepona: {
    "port d'estepona": { lat: 36.414, lng: -5.16 },
    port: { lat: 36.414, lng: -5.16 },
    "paseo maritimo": { lat: 36.424, lng: -5.147 },
    "bord de mer": { lat: 36.424, lng: -5.147 },
    "playa de la rada": { lat: 36.423, lng: -5.14 },
    "centre historique": { lat: 36.4262, lng: -5.145 },
    "vieille ville": { lat: 36.4262, lng: -5.145 },
  },
  madrid: {
    malasana: { lat: 40.426, lng: -3.704 },
    lavapies: { lat: 40.4089, lng: -3.701 },
  },
};

/** Position approximative d'un quartier connu, sinon du centre-ville, sinon null. */
export function approxLocation(city: string, ...hints: (string | null | undefined)[]): LatLng | null {
  const c = norm(city);
  const areas = AREA[c] ?? {};
  for (const h of hints) {
    const a = h ? norm(h) : "";
    if (!a) continue;
    if (areas[a]) return areas[a];
    // « Rooftop à Golden Mile », « Plage de Cabopino »… : un nom de quartier connu contenu dans le texte.
    const key = Object.keys(areas).sort((x, y) => y.length - x.length).find((k) => a.includes(k));
    if (key) return areas[key];
  }
  return CITY[c] || null;
}
