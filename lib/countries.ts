import type { Feature, FeatureCollection } from "geojson";

export interface Country {
  id: string;
  name: string;
  nameLong: string;
}

const DEFAULT_COUNTRIES = [
  "Oman",
  "United Arab Emirates",
  "Saudi Arabia",
  "India",
  "Indonesia",
];

let cache: FeatureCollection | null = null;

async function loadGeoJSON(): Promise<FeatureCollection> {
  if (cache) return cache;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const res = await fetch(`${base}/data/world.geojson`);
  cache = (await res.json()) as FeatureCollection;
  return cache;
}

export async function searchCountries(query: string): Promise<Country[]> {
  const data = await loadGeoJSON();

  if (!query.trim()) {
    return data.features
      .filter((f) => DEFAULT_COUNTRIES.includes(f.properties?.NAME as string))
      .slice(0, 5)
      .map(toCountry);
  }

  const lower = query.toLowerCase();
  return data.features
    .filter((f) => {
      const name = (f.properties?.NAME as string | undefined)?.toLowerCase() ?? "";
      const nameLong = (f.properties?.NAME_LONG as string | undefined)?.toLowerCase() ?? "";
      return name.includes(lower) || nameLong.includes(lower);
    })
    .slice(0, 5)
    .map(toCountry);
}

export async function getCountryFeature(id: string): Promise<Feature | null> {
  const data = await loadGeoJSON();
  const decoded = decodeURIComponent(id);
  return (
    data.features.find(
      (f) =>
        f.properties?.NAME === decoded || f.properties?.NAME_LONG === decoded
    ) ?? null
  );
}

function toCountry(f: Feature): Country {
  const name = (f.properties?.NAME as string) || "Unknown";
  const nameLong = (f.properties?.NAME_LONG as string) || name;
  return { id: name, name, nameLong };
}
