// The gear the app gives advice for. Until My Kit lands, this is a fixed
// default kit: a Canon EOS R50 with its two zooms, the RF 50mm and filters.

export const DEFAULT_KIT = {
  camera: "canon-eos-r50",
  lenses: [
    "canon-rf-s-18-45-f4.5-6.3-is-stm",
    "canon-rf-50-f1.8-stm",
    "canon-rf-s-55-210-f5-7.1-is-stm",
  ],
  filters: [
    "kf-concept-nano-x-magnetic-mcuv-55",
    "kf-concept-nano-x-magnetic-cpl-55",
    "kf-concept-nano-x-magnetic-nd1000-55",
    "kf-concept-nano-x-mcuv-43",
  ],
  adapters: ["kf-concept-step-up-49-55"],
};

/**
 * Turn kit ids into catalog entries. Ids missing from the catalog are
 * collected in `missing` instead of throwing, so an old saved kit still loads.
 */
export function resolveKit(catalog, ids = DEFAULT_KIT) {
  const missing = [];
  const pick = (id) => {
    const item = catalog.get(id);
    if (!item) missing.push(id);
    return item;
  };
  const camera = pick(ids.camera);
  const list = (key) => (ids[key] ?? []).map(pick).filter(Boolean);
  return {
    camera,
    lenses: list("lenses").sort((a, b) => a.focalMm.min - b.focalMm.min),
    filters: list("filters"),
    adapters: list("adapters"),
    missing,
  };
}
