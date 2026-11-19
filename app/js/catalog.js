// Loads the merged catalog (app/data/catalog.json) and indexes it by id.

const SECTIONS = ["mounts", "cameras", "lenses", "filters", "adapters"];

/** Build lookup tables from the merged catalog JSON. */
export function indexCatalog(data) {
  const byId = new Map();
  for (const section of SECTIONS) {
    for (const item of data[section] ?? []) byId.set(item.id, item);
  }
  return {
    version: data.version,
    byId,
    get: (id) => byId.get(id),
    ...Object.fromEntries(SECTIONS.map((s) => [s, data[s] ?? []])),
  };
}

/** Fetch and index the catalog. */
export async function loadCatalog(url = "data/catalog.json") {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load the gear catalog (${response.status}).`);
  return indexCatalog(await response.json());
}
