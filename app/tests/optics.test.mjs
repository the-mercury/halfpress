import { test } from "node:test";
import assert from "node:assert/strict";
import {
  angleOfView,
  equivalentFocal,
  exposureValue,
  filterFit,
  formatShutter,
  handheldShutter,
  mountFit,
  ndExposure,
  ndStops,
  parseShutter,
  widestAperture,
} from "../js/optics.js";

const zoom = { maxAperture: [{ atMm: 18, f: 4.5 }, { atMm: 45, f: 6.3 }] };
const prime = { maxAperture: [{ atMm: 50, f: 1.8 }] };

test("equivalent focal length uses the crop factor", () => {
  assert.equal(equivalentFocal(50, 1.6), 80);
  assert.equal(equivalentFocal(210, 1.6), 336);
});

test("angle of view on an APS-C sensor", () => {
  assert.equal(Math.round(angleOfView(18, 22.3)), 64);
  assert.equal(Math.round(angleOfView(50, 22.3)), 25);
});

test("widest aperture at the ends of a zoom", () => {
  assert.equal(widestAperture(zoom, 18), 4.5);
  assert.equal(widestAperture(zoom, 45), 6.3);
  assert.equal(widestAperture(zoom, 10), 4.5);
  assert.equal(widestAperture(prime, 50), 1.8);
});

test("widest aperture between zoom points never rounds wider", () => {
  const f = widestAperture(zoom, 30);
  assert.ok(f >= 4.5 + (30 - 18) / (45 - 18) * (6.3 - 4.5) - 1e-9);
  assert.equal(f, 5.6);
});

test("shutter text round trip", () => {
  assert.equal(parseShutter("1/4000"), 1 / 4000);
  assert.equal(parseShutter("30"), 30);
  assert.equal(formatShutter(1 / 250), "1/250");
  assert.equal(formatShutter(2), "2 s");
  assert.equal(formatShutter(1 / 2), "1/2");
  assert.equal(formatShutter(0.8), "0.8 s");
  assert.equal(formatShutter(1), "1 s");
  assert.equal(formatShutter(90), "1 min 30 s");
  assert.equal(formatShutter(1000 / 30), "33 s");
});

test("handheld shutter without stabilization is 1 / (focal x crop)", () => {
  assert.equal(formatShutter(handheldShutter(50, 1.6)), "1/80");
  assert.equal(formatShutter(handheldShutter(210, 1.6)), "1/400");
});

test("stabilization allows slower speeds at half its rated stops", () => {
  assert.equal(formatShutter(handheldShutter(18, 1.6, 4)), "1/8");
  assert.ok(handheldShutter(210, 1.6, 4.5) > handheldShutter(210, 1.6));
});

test("exposure value: sunny 16 at ISO 100 is about EV 15", () => {
  assert.equal(Math.round(exposureValue(16, 1 / 125, 100)), 15);
  assert.equal(Math.round(exposureValue(16, 1 / 125, 400)), 13);
});

test("ND1000 turns 1/30 into about 33 seconds", () => {
  assert.equal(Math.round(ndExposure(1 / 30, 1000)), 33);
  assert.equal(ndStops(1000).toFixed(2), "9.97");
});

test("filter fit: direct, step-up ring, missing ring, too small", () => {
  const ring = { kind: "step-up-ring", from: 49, to: 55 };
  assert.deepEqual(filterFit(55, 55), { fit: "direct" });
  assert.equal(filterFit(49, 55, [ring]).fit, "ring");
  assert.match(filterFit(43, 55, [ring]).reason, /43-55 mm step-up ring/);
  assert.equal(filterFit(55, 43).fit, "none");
  assert.equal(filterFit(null, 55).fit, "none");
});

test("mount fit: native, adapter, crop warning", () => {
  const apsc = { mount: "rf", sensor: { format: "aps-c" } };
  const ff = { mount: "rf", sensor: { format: "full-frame" } };
  const rfS = { mount: "rf", coverage: "aps-c" };
  const ef = { mount: "ef", coverage: "full-frame" };
  const adapter = { kind: "mount-adapter", from: "ef", to: "rf" };
  assert.deepEqual(mountFit(apsc, rfS), { fit: "native", cropped: false });
  assert.equal(mountFit(ff, rfS).cropped, true);
  assert.equal(mountFit(apsc, ef, [adapter]).fit, "adapter");
  assert.equal(mountFit(apsc, ef).fit, "none");
});

import { backgroundBlur, blurriestSetting, cropMegapixels, frameFill, printSizeCm } from "../js/optics.js";

const r50 = { widthMm: 22.3, heightMm: 14.9 };
const person = { heightM: 1.75, widthM: 0.5 };

test("frame fill for a person at the long end of the 55-210", () => {
  // At 210 mm and 20 m the frame is 20 × 14.9 / 210 ≈ 1.42 m tall.
  assert.equal(Math.round(frameFill(person, 20, 210, r50) * 100), 123);
  assert.equal(Math.round(frameFill(person, 50, 210, r50) * 100), 49);
});

test("cropping keeps megapixels in proportion to the area kept", () => {
  assert.equal(cropMegapixels(24, 0.3, 0.6), 6);
  assert.equal(cropMegapixels(24, 0.8, 0.6), 24);
});

test("print size from megapixels at 300 dpi", () => {
  assert.equal(Math.round(printSizeCm(24)), 51);
  assert.equal(Math.round(printSizeCm(6)), 25);
});

test("background blur for the same framing grows with focal length over f-number", () => {
  const framing = { subjectHeightM: 0.6, fill: 0.9, sensor: r50, behindM: Infinity };
  const prime = backgroundBlur({ ...framing, focalMm: 50, fNumber: 1.8 });
  const tele = backgroundBlur({ ...framing, focalMm: 210, fNumber: 7.1 });
  // Far background: blur is f·m/N, so the ratio is (50/1.8) / (210/7.1).
  assert.ok(Math.abs(prime.blur / tele.blur - (50 / 1.8) / (210 / 7.1)) < 1e-9);
  assert.ok(tele.distanceM > prime.distanceM * 4);
});

test("which lens blurs most depends on how far the background is", () => {
  const at = (behindM) => {
    const framing = { subjectHeightM: 0.6, fill: 0.9, sensor: r50, behindM };
    return [
      backgroundBlur({ ...framing, focalMm: 50, fNumber: 1.8 }).blur,
      backgroundBlur({ ...framing, focalMm: 210, fNumber: 7.1 }).blur,
    ];
  };
  // Far background: 210/7.1 beats 50/1.8. Two metres behind: standing 4x
  // farther back with the telephoto puts the background relatively closer.
  const [primeFar, teleFar] = at(Infinity);
  assert.ok(teleFar > primeFar);
  const [primeNear, teleNear] = at(2);
  assert.ok(primeNear > teleNear * 2);
});

test("the blurriest setting on a zoom is its long end", () => {
  const lens = { focalMm: { min: 55, max: 210 }, maxAperture: [{ atMm: 55, f: 5 }, { atMm: 210, f: 7.1 }] };
  const best = blurriestSetting(lens, { subjectHeightM: 0.6, fill: 0.9, sensor: r50, behindM: Infinity });
  assert.equal(best.focalMm, 210);
  assert.equal(best.fNumber, 7.1);
});
