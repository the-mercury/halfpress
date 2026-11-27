// Camera and lens math used by every screen. Pure functions only, no DOM.

/** Standard f-numbers in third stops. */
export const F_STOPS = [
  1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1,
  8, 9, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32, 36, 40, 45,
];

/** Standard shutter speeds in third stops, as seconds, slowest first. */
export const SHUTTER_STOPS = [
  30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3,
  1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40,
  1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400,
  1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200,
  1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000,
];

const EPS = 1e-9;

/** Full-frame equivalent focal length, rounded to whole millimetres. */
export function equivalentFocal(focalMm, cropFactor) {
  return Math.round(focalMm * cropFactor);
}

/** Horizontal angle of view in degrees. */
export function angleOfView(focalMm, sensorWidthMm) {
  return (2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180) / Math.PI;
}

/**
 * Widest aperture a lens offers at a focal length. Between the maker's listed
 * points the value is interpolated, then rounded to the next standard stop
 * that is not wider, because a zoom never opens wider than its spec.
 */
export function widestAperture(lens, focalMm) {
  const points = lens.maxAperture;
  if (points.length === 1 || focalMm <= points[0].atMm) return points[0].f;
  const last = points[points.length - 1];
  if (focalMm >= last.atMm) return last.f;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (focalMm <= b.atMm) {
      const t = (focalMm - a.atMm) / (b.atMm - a.atMm);
      const f = a.f + t * (b.f - a.f);
      return F_STOPS.find((s) => s >= f - EPS) ?? b.f;
    }
  }
  return last.f;
}

/** "1/4000" or "30" to seconds. */
export function parseShutter(text) {
  const [num, den] = String(text).split("/");
  return den === undefined ? Number(num) : Number(num) / Number(den);
}

/** Seconds to the way a camera shows them: "1/250", "1/2", "2 s", "1 min 30 s". */
export function formatShutter(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds - m * 60);
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  if (seconds >= 1 - EPS) {
    const rounded = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
    return `${rounded} s`;
  }
  // Under a second, cameras show whole fractions (1/2, 1/4) and the rest as tenths (0.8 s).
  const inverse = 1 / seconds;
  if (Math.abs(inverse - Math.round(inverse)) < 0.02) return `1/${Math.round(inverse)}`;
  return `${Math.round(seconds * 10) / 10} s`;
}

/** The standard shutter speed closest to the given seconds that is not slower. */
export function snapShutterFaster(seconds) {
  return SHUTTER_STOPS.find((s) => s <= seconds + EPS) ?? SHUTTER_STOPS[SHUTTER_STOPS.length - 1];
}

/**
 * Slowest shutter speed for a sharp handheld shot of a still subject.
 * Starts from 1 / (focal x crop). Stabilization is counted at half its rated
 * stops, a common rule of thumb, since rated stops assume ideal technique.
 */
export function handheldShutter(focalMm, cropFactor, stabilizationStops = 0) {
  const base = 1 / (focalMm * cropFactor);
  return snapShutterFaster(base * 2 ** (stabilizationStops / 2));
}

/** Exposure value at ISO 100 terms: EV = log2(N^2 / t) - log2(ISO / 100). */
export function exposureValue(fNumber, seconds, iso) {
  return Math.log2((fNumber * fNumber) / seconds) - Math.log2(iso / 100);
}

/** Exposure time with an ND filter of the given factor (e.g. 1000). */
export function ndExposure(seconds, factor) {
  return seconds * factor;
}

/** Stops of light an ND factor removes. ND1000 is about 9.97 stops. */
export function ndStops(factor) {
  return Math.log2(factor);
}

/**
 * How a filter goes on a lens.
 * Returns { fit: "direct" | "ring" | "none", ring?, vignetteRisk }.
 * A smaller filter on a larger thread never fits; a larger filter needs a
 * step-up ring from the kit.
 */
export function filterFit(threadMm, filterMm, rings = []) {
  if (threadMm == null) return { fit: "none", reason: "lens has no filter thread" };
  if (threadMm === filterMm) return { fit: "direct" };
  if (filterMm > threadMm) {
    const ring = rings.find((r) => r.kind === "step-up-ring" && r.from === threadMm && r.to === filterMm);
    return ring
      ? { fit: "ring", ring }
      : { fit: "none", reason: `needs a ${threadMm}-${filterMm} mm step-up ring` };
  }
  return { fit: "none", reason: `a ${filterMm} mm filter is smaller than the ${threadMm} mm thread` };
}

/**
 * Whether a lens fits a camera, directly or through an adapter in the kit.
 * Returns { fit: "native" | "adapter" | "none", adapter?, cropped }.
 * cropped is true when an APS-C lens goes on a larger sensor.
 */
export function mountFit(camera, lens, adapters = []) {
  const cropped = lens.coverage === "aps-c" && camera.sensor.format === "full-frame";
  if (lens.mount === camera.mount) return { fit: "native", cropped };
  const adapter = adapters.find(
    (a) => a.kind === "mount-adapter" && a.from === lens.mount && a.to === camera.mount,
  );
  return adapter ? { fit: "adapter", adapter, cropped } : { fit: "none", cropped };
}

/**
 * How much of the frame a subject fills at a distance: the larger of its
 * height share and width share (landscape orientation). 1 means it just fits.
 */
export function frameFill(subject, distanceM, focalMm, sensor) {
  const sceneH = (distanceM * sensor.heightMm) / focalMm;
  const sceneW = (distanceM * sensor.widthMm) / focalMm;
  return Math.max(subject.heightM / sceneH, subject.widthM / sceneW);
}

/** Megapixels left after cropping until the subject fills `target` of the frame. */
export function cropMegapixels(megapixels, fill, target = 0.6) {
  return fill >= target ? megapixels : megapixels * (fill / target) ** 2;
}

/** Longest side, in centimetres, of a sharp 300 dpi print from that many megapixels. */
export function printSizeCm(megapixels, aspect = 1.5) {
  const longSidePx = Math.sqrt(megapixels * 1e6 * aspect);
  return (longSidePx / 300) * 2.54;
}

/**
 * Blur circle of a background point `behindM` metres behind a subject in
 * focus at `distanceM`, as a share of the frame width. Thin-lens model: with
 * magnification m = f / (s - f), the circle on the sensor is
 * f·m·D / (N·(s + D)); a far background (Infinity) gives f·m / N.
 */
export function blurCircle(focalMm, fNumber, distanceM, behindM, sensorWidthMm) {
  const s = distanceM * 1000;
  const m = focalMm / (s - focalMm);
  const share = Number.isFinite(behindM) ? (behindM * 1000) / (s + behindM * 1000) : 1;
  return ((focalMm * m) / fNumber) * share / sensorWidthMm;
}
