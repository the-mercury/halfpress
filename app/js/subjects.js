// Subjects the app can draw to true scale, shared by the views.

/** Rough real-world sizes, in metres. */
export const SUBJECTS = [
  { id: "person", label: "Person", noun: "person", heightM: 1.75, widthM: 0.5 },
  { id: "child", label: "Child", noun: "child", heightM: 1.1, widthM: 0.35 },
  { id: "dog", label: "Dog", noun: "dog", heightM: 0.6, widthM: 0.9 },
  { id: "bird", label: "Bird", noun: "bird", heightM: 0.2, widthM: 0.25 },
  { id: "car", label: "Car", noun: "car", heightM: 1.5, widthM: 4.5 },
  { id: "house", label: "House", noun: "house", heightM: 8, widthM: 10 },
];

// Subjects drawn in the same flat style as the Lenses and Exposure pictures.
// Units are centimetres, standing on y = 0 and centred on x = 0, so one
// scale factor puts them at their true size in any frame.
export const DRAW = {
  person: { h: 175, svg: `
    <rect x="-12" y="-88" width="10" height="88" rx="3" fill="#2b3a55"/><rect x="2" y="-88" width="10" height="88" rx="3" fill="#2b3a55"/>
    <rect x="-27" y="-142" width="9" height="52" rx="4.5" fill="#c94a46"/><rect x="18" y="-142" width="9" height="52" rx="4.5" fill="#c94a46"/>
    <rect x="-20" y="-146" width="40" height="64" rx="10" fill="#d9534f"/>
    <rect x="-5" y="-152" width="10" height="8" fill="#e6b994"/><circle cy="-161" r="13" fill="#f0c9a4"/>
    <path d="M-13 -162a13 13 0 0 1 26 0c-6-5-20-5-26 0z" fill="#4a3426"/>` },
  child: { h: 110, svg: `
    <rect x="-8" y="-50" width="7" height="50" rx="3" fill="#3f66a8"/><rect x="1" y="-50" width="7" height="50" rx="3" fill="#3f66a8"/>
    <rect x="-18" y="-86" width="7" height="32" rx="3.5" fill="#e3a64a"/><rect x="11" y="-86" width="7" height="32" rx="3.5" fill="#e3a64a"/>
    <rect x="-13" y="-88" width="26" height="42" rx="8" fill="#f2b84f"/>
    <circle cy="-98" r="12" fill="#f0c9a4"/><path d="M-12 -99a12 12 0 0 1 24 0c-5-6-19-6-24 0z" fill="#6b4a2e"/>` },
  dog: { h: 62, svg: `
    <g stroke="#f1e2c4" stroke-width="6" stroke-linecap="round" fill="none">
      <path d="M-20 -14 L-32 0"/><path d="M-12 -14 L-6 0"/><path d="M16 -14 L10 0"/><path d="M24 -14 L36 0"/><path d="M-27 -28 L-42 -40"/></g>
    <rect x="-28" y="-36" width="56" height="24" rx="12" fill="#f1e2c4"/><circle cx="34" cy="-42" r="11" fill="#f1e2c4"/>
    <rect x="38" y="-42" width="16" height="8" rx="4" fill="#f1e2c4"/><path d="M27 -50 L24 -62 L36 -52 Z" fill="#d9c49c"/>
    <circle cx="37" cy="-45" r="1.6" fill="#1b2433"/>` },
  bird: { h: 20, svg: `
    <path d="M-12 -9 L-20 -13 L-18 -6 Z" fill="#4a3a2e"/><ellipse cx="-2" cy="-9" rx="11" ry="7" fill="#5a4636"/>
    <ellipse cx="1" cy="-7" rx="7" ry="5" fill="#d9783a"/><circle cx="8" cy="-15" r="5" fill="#5a4636"/>
    <path d="M12 -16 L17 -14.5 L12 -13 Z" fill="#e3a64a"/><circle cx="9.5" cy="-16" r="0.9" fill="#111"/>
    <path d="M-3 -2 V0 M2 -2 V0" stroke="#4a3a2e" stroke-width="1.2"/>` },
  car: { h: 150, svg: `
    <path d="M-130 -100 L-90 -148 H70 L120 -100 Z" fill="#c0392b"/><path d="M-112 -102 L-82 -138 H-8 V-102 Z M6 -102 V-138 H64 L100 -102 Z" fill="#9ed0ff"/>
    <rect x="-225" y="-108" width="450" height="76" rx="22" fill="#d9534f"/><rect x="190" y="-92" width="26" height="12" rx="4" fill="#ffd27a"/>
    <circle cx="-140" cy="-33" r="33" fill="#1f252f"/><circle cx="140" cy="-33" r="33" fill="#1f252f"/>
    <circle cx="-140" cy="-33" r="13" fill="#8a96a8"/><circle cx="140" cy="-33" r="13" fill="#8a96a8"/>` },
  house: { h: 800, svg: `
    <rect x="-400" y="-500" width="800" height="500" fill="#e8dcc4"/><path d="M-470 -490 L0 -800 L470 -490 Z" fill="#b5543c"/>
    <rect x="-70" y="-230" width="140" height="230" fill="#6b4f3a"/>
    <rect x="-320" y="-400" width="150" height="130" fill="#9ed0ff"/><rect x="170" y="-400" width="150" height="130" fill="#9ed0ff"/>
    <rect x="-320" y="-200" width="150" height="130" fill="#9ed0ff"/><rect x="170" y="-200" width="150" height="130" fill="#9ed0ff"/>` },
};

/** A subject standing at (x, groundY), drawn at `pxPerM` pixels per metre. */
export function drawSubject(subject, x, groundY, pxPerM) {
  const k = (pxPerM / 100) * ((subject.heightM * 100) / DRAW[subject.id].h);
  return `<g transform="translate(${x.toFixed(2)} ${groundY.toFixed(2)}) scale(${k.toFixed(5)})">${DRAW[subject.id].svg}</g>`;
}
