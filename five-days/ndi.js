/* @ds-bundle: {"format":4,"namespace":"NDI","components":[{"name":"Kit"},{"name":"People"},{"name":"Lettering"},{"name":"Devices"},{"name":"Views"},{"name":"Opener"},{"name":"Spot"},{"name":"Divider"},{"name":"Pattern"},{"name":"Stamp"},{"name":"ListRow"},{"name":"OnNavy"}]} */
/*
  The ND Agency picture kit. Every function returns a string of SVG.
  Units: one unit is one pixel at the size the picture is drawn for. The edge is 3 units, the shadow
  step 4 units. A picture scaled up keeps its proportions, so the edge grows with it (print).
  Use: NDI.use('light' | 'navy'); then build parts and hand them to NDI.picture(...).
*/
(function (root) {
  'use strict';
  const C = { white: '#FFFFFF', offwhite: '#F4F7FA', ink: '#1A1A1A', green: '#1C7A4E', yellow: '#F2A223', navy: '#2A3869', orange: '#DC6919', lines: '#D3D9E8', linesDark: '#3A4A7D', red: '#C6302A', grey: '#5C6B89' };
  const THEMES = {
    light: { name: 'light', ground: C.white, edge: C.ink, shadow: C.ink, hatch: C.lines, hair: C.ink, skin: C.white, thing: C.white, pane: C.offwhite, sky: C.offwhite, night: C.navy },
    navy:  { name: 'navy',  ground: C.navy,  edge: C.white, shadow: C.linesDark, hatch: C.linesDark, hair: C.white, skin: C.navy, thing: C.navy, pane: C.navy, sky: C.navy, night: C.navy },
  };
  const U = { edge: 3, shadow: 4, hatchPitch: 12, hatchBar: 3, dash: 7, gap: 5, grid: 20 };
  let T = THEMES.light;
  let cur = { id: 'pic' };
  let k = 1; // the current placement scale: edges and shadows divide by it so they stay 3 and 4 units in the picture
  const E = () => U.edge / k, S = () => U.shadow / k;
  const num = n => +(+n).toFixed(1);
  const pts = a => a.map(p => num(p[0]) + ',' + num(p[1])).join(' ');

  // ---------- primitives ----------
  // A dashed edge whose dashes land on both corners: one line per edge, dash near 7, gap near 5.
  function goneEdge(a, b) {
    const e = E(), dash = U.dash / k, gap = U.gap / k;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), run = L + e;
    const n = Math.max(1, Math.round((run + gap) / (dash + gap)));
    if (n < 2 || L < 12 / k) return `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="${T.edge}" stroke-width="${num(e)}" stroke-linecap="square"/>`;
    const unit = run / (n * dash + (n - 1) * gap), d = dash * unit - e, g = gap * unit + e;
    return `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="${T.edge}" stroke-width="${num(e)}" stroke-linecap="square" stroke-dasharray="${num(d)} ${num(g)}"/>`;
  }
  // shape(points, fill, options): the filled shape with its edge and hard shadow.
  // options: shadow:false (no shadow), gone:true (dashed outline, no fill, no shadow), edge (colour), sw (edge width)
  function shape(a, fill, o) {
    o = o || {}; const sw = num(o.sw ? o.sw / k : E()), edge = o.edge || T.edge;
    if (o.gone) return a.map((p, i) => goneEdge(p, a[(i + 1) % a.length])).join('');
    let s = '';
    if (o.shadow !== false) s += `<polygon points="${pts(a.map(p => [p[0] + S(), p[1] + S()]))}" fill="${T.shadow}" stroke="${T.shadow}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
    s += `<polygon points="${pts(a)}" fill="${fill || T.thing}" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
    return s;
  }
  const box = (x, y, w, h, fill, o) => shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, o);
  function octagon(cx, cy, r) { const k = r * 0.414; return [[cx - k, cy - r], [cx + k, cy - r], [cx + r, cy - k], [cx + r, cy + k], [cx + k, cy + r], [cx - k, cy + r], [cx - r, cy + k], [cx - r, cy - k]]; }
  // disc: the one round thing a picture may have. No shadow.
  const disc = (cx, cy, r, fill) => `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill || C.yellow}" stroke="${T.edge}" stroke-width="${num(E())}"/>`;
  const line = (x1, y1, x2, y2, o) => { o = o || {}; return `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${o.stroke || T.edge}" stroke-width="${num(o.sw ? o.sw / k : E())}" stroke-linecap="square"${o.gone ? ` stroke-dasharray="${num(U.dash / k)} ${num(U.gap / k)}"` : ''}/>`; };
  function arrow(x1, y1, x2, y2, o) { o = o || {}; const a = Math.atan2(y2 - y1, x2 - x1), hl = 10 / k, hw = 6 / k, hx = x2 - hl * Math.cos(a), hy = y2 - hl * Math.sin(a); return line(x1, y1, hx, hy, o) + `<polygon points="${pts([[x2, y2], [hx + hw * Math.sin(a), hy - hw * Math.cos(a)], [hx - hw * Math.sin(a), hy + hw * Math.cos(a)]])}" fill="${o.stroke || T.edge}"/>`; }
  // star: a four-point star in Yellow, for night skies. Small shapes on Navy go without an edge.
  const star = (cx, cy, r) => `<polygon points="${pts([[cx, cy - r], [cx + r * .3, cy - r * .3], [cx + r, cy], [cx + r * .3, cy + r * .3], [cx, cy + r], [cx - r * .3, cy + r * .3], [cx - r, cy], [cx - r * .3, cy - r * .3]])}" fill="${C.yellow}"/>`;
  // hatch: the -45 degree texture. Means nothing. Needs a picture's defs (picture() writes them).
  const hatch = (x, y, w, h) => `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="url(#${cur.id}-hatch)"/>`;
  const defs = (id) => `<defs><pattern id="${id}-hatch" width="${U.hatchPitch}" height="${U.hatchPitch}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${U.hatchBar}" height="${U.hatchPitch}" fill="${T.hatch}"/></pattern></defs>`;
  // place(x, y, scale, fn): draws fn() scaled, keeping every edge at 3 units and every shadow at 4 in the finished picture. Use it to put a part into a bigger picture.
  function place(tx, ty, sc, fn) { k *= sc; const inner = fn(); k /= sc; return group(tx, ty, sc, inner); }
  const group = (tx, ty, sc, inner) => `<g transform="translate(${num(tx)} ${num(ty)})${sc && sc !== 1 ? ` scale(${sc})` : ''}">${inner}</g>`;

  // ---------- the floor and the picture ----------
  // floor(w, h): the dead zone at the foot: a band of hatch under the floor line, 28 units tall. Covers any shadow below it.
  const floor = (w, h, band) => { band = band || 28; const fy = h - band; return `<rect x="0" y="${fy}" width="${w}" height="${band}" fill="${T.ground}"/>` + hatch(0, fy, w, band) + line(0, fy, w, fy); };
  // picture({w, h, theme, id, title, desc, floor, body}): a complete SVG. body is a function (so it draws in the theme) or a string.
  function picture(o) {
    const prev = T; if (o.theme) use(o.theme);
    cur = { id: o.id || 'pic' };
    const w = o.w || 360, h = o.h || 240;
    const body = typeof o.body === 'function' ? o.body() : (o.body || '');
    const fl = o.floor === false ? '' : floor(w, h, o.band);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${cur.id}-title${o.desc ? ' ' + cur.id + '-desc' : ''}">` +
      `<title id="${cur.id}-title">${esc(o.title || cur.id)}</title>` + (o.desc ? `<desc id="${cur.id}-desc">${esc(o.desc)}</desc>` : '') +
      defs(cur.id) + `<rect width="${w}" height="${h}" fill="${T.ground}"/>` + body + fl + `</svg>`;
    T = prev; return svg;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function use(name) { T = THEMES[name] || THEMES.light; return T; }

  // ---------- parts: home ----------
  // Every part: (x, y, o). For things that stand, y is the floor line they stand on. For things that hang, y is their top.
  const kettle = (x, y, o) => shape([[x, y + 8], [x + 28, y + 8], [x + 26, y + 30], [x + 2, y + 30]], T.thing, o) + shape([[x + 28, y + 12], [x + 38, y + 8], [x + 36, y + 20], [x + 28, y + 22]], T.thing, nos(o)) + box(x + 10, y, 8, 8, T.edge, nos(o)); // top-left, 38 by 30
  const mug = (x, y, o) => box(x, y, 14, 16, T.thing, o) + box(x + 14, y + 4, 5, 8, T.thing, nos(o)); // top-left, 19 by 16
  const cup = (x, y, o) => box(x, y, 16, 20, T.thing, o) + shape([[x, y + 20], [x + 16, y + 20], [x + 13, y + 26], [x + 3, y + 26]], T.thing, nos(o)); // a takeaway cup, top-left, 16 by 26
  const counter = (x, fy, w, o) => box(x + 4, fy - 32, w - 8, 32, T.thing, nos(o)) + line(x + w / 2, fy - 26, x + w / 2, fy - 6, { sw: 2 }) + box(x, fy - 40, w, 8, T.thing, o); // stands on fy, top at fy-40
  const windowPane = (x, y, w, h, o) => { o = o || {}; let s = box(x, y, w, h, o.night ? T.night : T.pane, o); if (o.night) s += star(x + w * .22, y + h * .25, 5) + star(x + w * .75, y + h * .4, 6) + star(x + w * .5, y + h * .72, 4); else if (o.sun !== false) s += disc(x + w * (o.sunX == null ? .7 : o.sunX), y + h * (o.sunY == null ? .4 : o.sunY), o.sunR || 10, C.yellow); if (o.land) s += box(x + U.edge / 2, y + h * .72, w - U.edge, h * .28 - U.edge / 2, C.green, nos(o)); return s; }; // top-left; options night, sun:false, sunX/sunY as shares, land (a green horizon)
  const lamp = (x, fy, o) => box(x + 6, fy - 60, 4, 60, T.thing, nos(o)) + shape([[x - 4, fy - 60], [x + 20, fy - 60], [x + 24, fy - 44], [x - 8, fy - 44]], C.yellow, o) + box(x - 2, fy - 4, 20, 4, T.thing, nos(o)); // stands on fy, 32 by 60
  const plant = (x, fy, o) => box(x, fy - 28, 20, 28, T.thing, o) + shape([[x - 6, fy - 28], [x + 26, fy - 28], [x + 20, fy - 46], [x, fy - 46]], C.green, o) + box(x + 7, fy - 62, 6, 16, C.green, nos(o)); // stands on fy, 32 by 62
  const bed = (x, fy, o) => box(x, fy - 42, 160, 42, T.thing, o) + box(x + 10, fy - 70, 140, 28, T.pane, o) + box(x + 20, fy - 88, 44, 18, T.thing, o); // stands on fy, 160 by 88
  const clock = (cx, cy, r, o) => shape(octagon(cx, cy, r), T.thing, o) + line(cx, cy, cx, cy - r * .6, { sw: 2 }) + line(cx, cy, cx + r * .5, cy, { sw: 2 }); // hangs; hands, no digits
  const shelf = (x, y, w, o) => box(x, y, w, 6, T.thing, o) + box(x + 6, y + 6, 6, 10, T.thing, nos(o)) + box(x + w - 12, y + 6, 6, 10, T.thing, nos(o)); // hangs; top-left
  // ---------- parts: the office (kept, no longer the default) ----------
  const desk = (x, fy, w, o) => box(x + 6, fy - 28, 6, 28, T.thing, nos(o)) + box(x + w - 12, fy - 28, 6, 28, T.thing, nos(o)) + box(x, fy - 36, w, 8, T.thing, o); // stands on fy, top at fy-36
  const laptop = (x, y, o) => { o = o || {}; let s = box(x, y - 4, 30, 4, T.thing, nos(o)) + box(x + 1, y - 24, 28, 20, o.lit ? C.yellow : C.ink, o); if (o.lit) s += [y - 19, y - 14, y - 9].map(yy => line(x + 7, yy, x + 22, yy, { sw: 2, stroke: C.ink })).join(''); return s; }; // y is the desk top; option lit
  const chair = (x, fy, o) => box(x, fy - 56, 6, 32, T.thing, o) + box(x + 2, fy - 24, 4, 24, T.thing, nos(o)) + box(x + 18, fy - 24, 4, 24, T.thing, nos(o)) + box(x, fy - 30, 24, 6, T.thing, o); // stands on fy, 24 by 56
  const board = (x, y, w, h, o) => { let s = box(x, y, w, h, T.thing, o); [[6, 6], [24, 10], [42, 6], [12, 26], [32, 24]].forEach(d => { if (d[0] + 14 < w && d[1] + 12 < h) s += box(x + d[0], y + d[1], 14, 12, C.orange, nos(o)); }); return s; }; // hangs; orange notes on it
  const timer = (x, y, o) => shape([[x, y], [x + 20, y], [x + 10, y + 12], [x + 20, y + 24], [x, y + 24], [x + 10, y + 12]], T.thing, o); // an hourglass, top-left, 20 by 24
  const padlock = (x, y, o) => box(x + 4, y, 12, 10, T.thing, nos(o)) + box(x, y + 8, 20, 16, T.thing, o); // top-left, 20 by 24
  // ---------- parts: the street ----------
  const train = (x, fy, o) => shape([[x, fy - 50], [x + 8, fy - 60], [x + 70, fy - 60], [x + 70, fy - 10], [x, fy - 10]], T.thing, o) + box(x + 12, fy - 50, 14, 16, C.yellow, nos(o)) + box(x + 32, fy - 50, 14, 16, C.yellow, nos(o)) + box(x + 52, fy - 50, 12, 16, C.yellow, nos(o)) + box(x + 8, fy - 24, 54, 6, T.edge, nos(o)) + box(x, fy - 10, 70, 10, T.thing, nos(o)); // front of a train, stands on fy, 70 by 60
  const signal = (x, fy, o) => box(x, fy - 70, 6, 70, T.thing, nos(o)) + box(x - 6, fy - 80, 18, 14, T.edge, o) + disc(x + 3, fy - 73, 4, C.yellow); // stands on fy
  const kerb = (x, fy, w, o) => box(x, fy - 10, w, 10, T.thing, o); // a pavement edge, stands on fy
  const bicycle = (x, fy, o) => shape(octagon(x + 16, fy - 16, 16), T.thing, nos(o)) + shape(octagon(x + 64, fy - 16, 16), T.thing, nos(o)) + shape([[x + 16, fy - 16], [x + 34, fy - 44], [x + 56, fy - 44], [x + 64, fy - 16], [x + 40, fy - 16]], T.thing, nos(o)) + line(x + 34, fy - 44, x + 28, fy - 56) + line(x + 56, fy - 44, x + 62, fy - 56) + box(x + 22, fy - 60, 12, 4, T.thing, nos(o)); // side-on, stands on fy, 80 by 60; the wheels are octagons, not round things
  const taxi = (x, fy, o) => shape([[x, fy - 10], [x, fy - 50], [x + 14, fy - 64], [x + 96, fy - 64], [x + 96, fy - 10]], T.thing, o) + box(x + 14, fy - 54, 20, 18, T.pane, nos(o)) + box(x + 40, fy - 54, 20, 18, T.pane, nos(o)) + box(x + 66, fy - 54, 20, 18, T.pane, nos(o)) + shape(octagon(x + 22, fy - 8, 10), T.edge, nos(o)) + shape(octagon(x + 74, fy - 8, 10), T.edge, nos(o)); // a minibus, side-on, stands on fy, 96 by 64
  const gate = (x, fy, o) => box(x, fy - 60, 6, 60, T.thing, o) + box(x + 70, fy - 60, 6, 60, T.thing, o) + box(x + 6, fy - 44, 64, 4, T.thing, nos(o)) + box(x + 6, fy - 18, 64, 4, T.thing, nos(o)) + [18, 32, 46].map(d => box(x + d, fy - 50, 4, 42, T.thing, nos(o))).join(''); // stands on fy, 76 by 60
  const bench = (x, fy, o) => box(x + 4, fy - 20, 6, 20, T.thing, nos(o)) + box(x + 70, fy - 20, 6, 20, T.thing, nos(o)) + box(x, fy - 26, 80, 6, T.thing, o) + box(x, fy - 44, 80, 6, T.thing, o); // stands on fy, 80 by 44
  // ---------- parts: outdoors ----------
  const mountain = (x, fy, w, o) => shape([[x, fy], [x + w * .3, fy - w * .35], [x + w * .7, fy - w * .35], [x + w, fy]], C.green, o); // a flat top, stands on fy
  const hill = (x, fy, w, o) => shape([[x, fy], [x + w * .5, fy - w * .25], [x + w, fy]], C.green, o);
  const sun = (cx, cy, r) => disc(cx, cy, r || 12, C.yellow); // the one round thing
  const rain = (x, y, n, h) => { let s = ''; for (let i = 0; i < (n || 4); i++) s += line(x + i * 20, y, x + i * 20 - 6, y + (h || 30)); return s; }; // straight lines, slanted
  const path = (x, fy, w, o) => shape([[x, fy], [x + w * .3, fy - 32], [x + w * .5, fy - 32], [x + w, fy]], T.thing, nos(o)); // a path narrowing away, flat
  // ---------- parts: the body (no faces) ----------
  const shoe = (x, fy, o) => shape([[x, fy - 10], [x + 8, fy - 16], [x + 16, fy - 16], [x + 30, fy - 6], [x + 30, fy], [x, fy]], T.thing, o); // side-on, stands on fy, 30 by 16
  const step = (x, fy, w, o) => box(x, fy - 14, w, 14, T.thing, o); // a doorstep
  const hand = (x, y, o) => box(x, y, 16, 26, T.thing, o) + box(x - 6, y + 6, 6, 10, T.thing, nos(o)); // a mitten hand with a thumb, top-left, 22 by 26
  const back = (x, fy, col, o) => shape([[x - 24, fy - 90], [x + 24, fy - 90], [x + 30, fy - 80], [x + 30, fy], [x - 30, fy], [x - 30, fy - 80]], col || T.thing, o) + shape(octagon(x, fy - 104, 14), T.skin, nos(o)) + shape([[x - 6, fy - 118], [x + 6, fy - 118], [x + 14, fy - 110], [x + 14, fy - 102], [x - 14, fy - 102], [x - 14, fy - 110]], T.hair, nos(o)); // a person's back, close, 60 wide
  // ---------- parts: the table of interests ----------
  const controller = (x, y, o) => shape([[x, y + 10], [x + 6, y], [x + 44, y], [x + 50, y + 10], [x + 50, y + 24], [x + 38, y + 30], [x + 12, y + 30], [x, y + 24]], T.thing, o) + box(x + 8, y + 8, 6, 6, T.edge, nos(o)) + box(x + 34, y + 8, 6, 6, T.edge, nos(o)); // top-left, 50 by 30
  const guitar = (x, fy, o) => box(x + 18, fy - 90, 6, 50, T.thing, nos(o)) + shape([[x + 6, fy - 40], [x + 36, fy - 40], [x + 42, fy - 24], [x + 40, fy - 4], [x + 2, fy - 4], [x, fy - 24]], C.yellow, o) + box(x + 16, fy - 26, 10, 10, T.edge, nos(o)); // stands on fy, 42 by 90
  const camera = (x, y, o) => box(x, y + 6, 40, 26, T.thing, o) + box(x + 6, y, 12, 6, T.thing, nos(o)) + box(x + 14, y + 12, 14, 14, T.edge, nos(o)); // top-left, 40 by 32
  const headphones = (x, y, o) => shape([[x, y + 30], [x, y + 10], [x + 10, y], [x + 40, y], [x + 50, y + 10], [x + 50, y + 30], [x + 44, y + 30], [x + 44, y + 12], [x + 6, y + 12], [x + 6, y + 30]], T.thing, nos(o)) + box(x - 4, y + 22, 12, 18, T.thing, o) + box(x + 42, y + 22, 12, 18, T.thing, o); // top-left, 58 by 40
  const book = (x, y, o) => box(x, y, 30, 40, C.green, o) + box(x + 4, y, 4, 40, T.thing, nos(o)); // top-left, 30 by 40
  const pencil = (x, y, o) => shape([[x, y + 4], [x + 40, y + 4], [x + 48, y + 8], [x + 40, y + 12], [x, y + 12]], C.yellow, o); // top-left, 48 by 8
  // ---------- parts: paper and admin ----------
  const envelope = (x, y, o) => box(x, y, 36, 24, T.thing, o) + line(x, y, x + 18, y + 13, { sw: 2 }) + line(x + 36, y, x + 18, y + 13, { sw: 2 }); // top-left, 36 by 24
  const pile = (x, y, o) => envelope(x, y + 20, o) + envelope(x + 8, y + 10, o) + envelope(x + 16, y, o); // three envelopes, top-left, 52 by 44
  const stamp = (x, y, o) => box(x, y + 10, 20, 10, T.edge, nos(o)) + box(x + 4, y, 12, 10, T.thing, o); // a rubber stamp, top-left, 20 by 20
  const invoice = (x, y, o) => box(x, y, 30, 40, T.thing, o) + [10, 18, 26].map(d => line(x + 6, y + d, x + 24, y + d, { sw: 2 })).join('') + box(x + 16, y + 30, 8, 4, C.orange, nos(o)); // a sheet with lines and one orange mark, top-left, 30 by 40
  const bin = (x, fy, o) => shape([[x, fy - 30], [x + 24, fy - 30], [x + 20, fy], [x + 4, fy]], T.thing, o) + box(x - 2, fy - 34, 28, 4, T.thing, nos(o)); // stands on fy, 28 by 34
  const folder = (x, y, o) => box(x, y + 6, 40, 28, C.yellow, o) + box(x, y, 16, 6, C.yellow, nos(o)); // top-left, 40 by 34
  // ---------- parts: the building and its edges ----------
  const doorAjar = (x, y, w, h, o) => box(x, y, w, h, T.pane, nos(o)) + shape([[x + 2, y + 2], [x + w * .42, y + 6], [x + w * .42, y + h - 2], [x + 2, y + h]], T.thing, o); // a door standing ajar, tapered like the motif; top-left
  const doorClosed = (x, y, w, h, o) => box(x, y, w, h, T.thing, o) + box(x + w - 12, y + h / 2, 6, 6, T.edge, nos(o)); // top-left
  const doorway = (x, y, w, h, o) => box(x, y, w, h, C.yellow, o); // an open doorway full of light; top-left
  const lightOnFloor = (x, fy, w, o) => shape([[x + 6, fy - 12], [x + w - 6, fy - 12], [x + w + 24, fy], [x - 20, fy]], C.yellow, nos(o)); // light falling through a door onto the floor: a yellow band just above fy. Draw it after the door, before people
  const wall = (x, y, w, h, o) => box(x, y, w, h, T.edge, nos(o)); // a heavy wall, solid Ink (White on Navy)
  const stairs = (x, fy, n, o) => { let s = ''; for (let i = 0; i < (n || 4); i++) s += box(x + i * 20, fy - (i + 1) * 16, 20 + (n - 1 - i) * 0, (i + 1) * 16, T.thing, o); return s; }; // steps rising to the right, stand on fy
  const corridor = (x, y, w, h, o) => box(x, y, w, h, T.thing, nos(o)); // a wall face to hang things on
  // ---------- parts: abstract made concrete ----------
  const block = (x, y, w, h, o) => box(x, y, w, h, T.edge, nos(o)); // a heavy end block
  const track = (x, y, w) => line(x, y, x + w, y); // a track between things
  const stop = (x, y, fill, o) => box(x - 8, y - 8, 16, 16, fill || T.thing, o); // a stop on a track, centred
  const bars = (w, h) => block(8, 8, 12, h - 16) + block(w - 20, 8, 12, h - 16); // the two edges of a day, at the sides of a picture
  // ---------- parts: animals ----------
  const dog = (x, fy, o) => box(x, fy - 26, 44, 18, T.thing, o) + shape(octagon(x + 50, fy - 28, 10), T.thing, nos(o)) + shape([[x + 42, fy - 36], [x + 50, fy - 44], [x + 52, fy - 36]], T.edge, nos(o)) + box(x + 4, fy - 8, 6, 8, T.thing, nos(o)) + box(x + 32, fy - 8, 6, 8, T.thing, nos(o)) + shape([[x - 14, fy - 30], [x, fy - 24], [x, fy - 18]], T.thing, nos(o)); // side-on, stands on fy, 74 by 44
  function nos(o) { return Object.assign({}, o || {}, { shadow: false }); }

  // ---------- people ----------
  // person(x, fy, o): sharp parts, seen from behind, no face. Stands on fy, 70 tall, 40 wide.
  // o.colour: 'green' (the one the picture is about), 'white' (anyone else, the default), or a hex.
  // o.marker: 'lanyard' | 'bag' | 'cap' | 'none'. o.pose: 'stand' | 'wave' | 'lean' | 'carry'. o.facing: 'back' | 'side'. o.gone: true.
  const colourOf = c => c === 'green' ? C.green : c === 'white' ? T.thing : c === 'yellow' ? C.yellow : c === 'orange' ? C.orange : (c || T.thing);
  function person(x, fy, o) {
    o = o || {}; const col = colourOf(o.colour), g = { gone: o.gone }, gn = { gone: o.gone, shadow: false };
    let s = box(x - 10, fy - 24, 8, 24, col, gn) + box(x + 2, fy - 24, 8, 24, col, gn);
    s += shape([[x - 10, fy - 48], [x + 10, fy - 48], [x + 14, fy - 42], [x + 14, fy - 24], [x - 14, fy - 24], [x - 14, fy - 42]], col, g);
    if (o.pose === 'wave') s += box(x + 14, fy - 46, 6, 18, col, gn) + box(x + 16, fy - 66, 6, 22, col, gn);
    else if (o.pose === 'lean') s += box(x - 20, fy - 44, 6, 20, col, gn) + box(x + 14, fy - 44, 6, 20, col, gn);
    else if (o.pose === 'carry') s += box(x - 20, fy - 44, 6, 22, col, gn) + box(x + 14, fy - 44, 6, 22, col, gn) + box(x + 14, fy - 30, 22, 14, T.thing, gn);
    else s += box(x - 20, fy - 44, 6, 22, col, gn) + box(x + 14, fy - 44, 6, 22, col, gn);
    if (!o.gone) {
      if (o.marker === 'lanyard') s += line(x - 4, fy - 48, x - 4, fy - 32, { stroke: C.orange }) + box(x - 7, fy - 34, 6, 8, C.orange, { shadow: false });
      if (o.marker === 'bag') s += box(x + 16, fy - 26, 12, 12, C.yellow, { shadow: false });
    }
    const hy = fy - 60, r = 9, k = r * 0.414;
    s += shape(octagon(x, hy, r), T.skin, gn);
    if (!o.gone) {
      const hairCol = o.marker === 'cap' ? C.green : T.hair;
      if (o.facing === 'side') s += shape([[x - k, hy - r], [x + k, hy - r], [x + r, hy - k], [x + r, hy], [x - r, hy + k], [x - r, hy - k]], hairCol, { shadow: false }) + shape([[x + r, hy], [x + r + 4, hy + 3], [x + r, hy + 6]], T.skin, { shadow: false });
      else s += shape([[x - k, hy - r], [x + k, hy - r], [x + r, hy - k], [x + r, hy + 2], [x - r, hy + 2], [x - r, hy - k]], hairCol, { shadow: false });
      if (o.marker === 'cap') s += box(x - 13, hy - 2, 26, 4, C.green, { shadow: false });
    }
    return s;
  }
  // hands(x, y, o): two mitten hands at a surface, for a person present as parts. Top-left of the left hand.
  const hands = (x, y, o) => hand(x, y, o) + hand(x + 60, y, o);
  // personAbove(x, y, o): a person seen from above, for plan views: hair as an octagon on a shoulder block. Centred.
  const personAbove = (x, y, o) => { o = o || {}; return box(x - 12, y - 5, 24, 12, colourOf(o.colour), { gone: o.gone }) + shape(octagon(x, y, 7), T.hair, { gone: o.gone, shadow: false }); };

  // ---------- lettering: block capitals and numerals ----------
  // Glyphs are polylines on a 60 by 80 box; the stroke is 14 wide. Drawn three times: shadow, edge (20 wide), fill (14 wide).
  const L = 7, R = 53, Tt = 7, B = 73, M = 30, CY = 40;
  const G = {
    A: [[[L, B], [M, Tt], [R, B]], [[L + 9, 50], [R - 9, 50]]],
    B: [[[L, Tt], [L, B]], [[L, Tt], [R - 10, Tt], [R, Tt + 10], [R, CY - 10], [R - 10, CY], [L, CY]], [[R - 10, CY], [R, CY + 10], [R, B - 10], [R - 10, B], [L, B]]],
    C: [[[R, Tt + 10], [R - 10, Tt], [L + 10, Tt], [L, Tt + 10], [L, B - 10], [L + 10, B], [R - 10, B], [R, B - 10]]],
    D: [[[L, Tt], [L, B]], [[L, Tt], [R - 14, Tt], [R, Tt + 14], [R, B - 14], [R - 14, B], [L, B]]],
    E: [[[R, Tt], [L, Tt], [L, B], [R, B]], [[L, CY], [R - 6, CY]]],
    F: [[[R, Tt], [L, Tt], [L, B]], [[L, CY], [R - 8, CY]]],
    G: [[[R, Tt + 10], [R - 10, Tt], [L + 10, Tt], [L, Tt + 10], [L, B - 10], [L + 10, B], [R - 10, B], [R, B - 10], [R, CY], [M, CY]]],
    H: [[[L, Tt], [L, B]], [[R, Tt], [R, B]], [[L, CY], [R, CY]]],
    I: [[[M, Tt], [M, B]], [[L + 6, Tt], [R - 6, Tt]], [[L + 6, B], [R - 6, B]]],
    J: [[[R - 6, Tt], [R - 6, B - 10], [R - 16, B], [L + 10, B], [L, B - 10]]],
    K: [[[L, Tt], [L, B]], [[R - 2, Tt], [L + 4, CY], [R, B]]],
    L: [[[L, Tt], [L, B], [R, B]]],
    M: [[[L, B], [L, Tt], [M, CY + 4], [R, Tt], [R, B]]],
    N: [[[L, B], [L, Tt], [R, B], [R, Tt]]],
    O: [[[L + 10, Tt], [R - 10, Tt], [R, Tt + 10], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10], [L, Tt + 10], 'z']],
    P: [[[L, B], [L, Tt], [R - 10, Tt], [R, Tt + 10], [R, CY - 6], [R - 10, CY + 4], [L, CY + 4]]],
    Q: [[[L + 10, Tt], [R - 10, Tt], [R, Tt + 10], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10], [L, Tt + 10], 'z'], [[M + 2, B - 12], [R + 2, B + 2]]],
    R: [[[L, B], [L, Tt], [R - 10, Tt], [R, Tt + 10], [R, CY - 6], [R - 10, CY + 4], [L, CY + 4]], [[L + 14, CY + 4], [R, B]]],
    S: [[[R, Tt + 10], [R - 10, Tt], [L + 10, Tt], [L, Tt + 10], [L, CY - 8], [L + 10, CY], [R - 10, CY], [R, CY + 8], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10]]],
    T: [[[L, Tt], [R, Tt]], [[M, Tt], [M, B]]],
    U: [[[L, Tt], [L, B - 10], [L + 10, B], [R - 10, B], [R, B - 10], [R, Tt]]],
    V: [[[L, Tt], [M, B], [R, Tt]]],
    W: [[[L, Tt], [L + 8, B], [M, CY], [R - 8, B], [R, Tt]]],
    X: [[[L, Tt], [R, B]], [[R, Tt], [L, B]]],
    Y: [[[L, Tt], [M, CY], [R, Tt]], [[M, CY], [M, B]]],
    Z: [[[L, Tt], [R, Tt], [L, B], [R, B]]],
    '0': [[[L + 10, Tt], [R - 10, Tt], [R, Tt + 10], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10], [L, Tt + 10], 'z']],
    '1': [[[L + 10, Tt + 12], [M, Tt], [M, B]], [[L + 6, B], [R - 6, B]]],
    '2': [[[L, Tt + 10], [L + 10, Tt], [R - 10, Tt], [R, Tt + 10], [R, CY - 6], [L, B], [R, B]]],
    '3': [[[L, Tt], [R, Tt], [M, CY - 2], [R - 10, CY - 2], [R, CY + 8], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10]]],
    '4': [[[R - 8, B], [R - 8, Tt], [L, CY + 10], [R, CY + 10]]],
    '5': [[[R, Tt], [L, Tt], [L, CY - 4], [R - 10, CY - 4], [R, CY + 6], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10]]],
    '6': [[[R - 8, Tt], [L + 10, Tt], [L, Tt + 10], [L, B - 10], [L + 10, B], [R - 10, B], [R, B - 10], [R, CY + 4], [R - 10, CY - 4], [L, CY - 4]]],
    '7': [[[L, Tt], [R, Tt], [L + 12, B]]],
    '8': [[[L + 10, Tt], [R - 10, Tt], [R, Tt + 10], [R, CY - 8], [R - 10, CY], [L + 10, CY], [L, CY - 8], [L, Tt + 10], 'z'], [[L + 10, CY], [R - 10, CY], [R, CY + 8], [R, B - 10], [R - 10, B], [L + 10, B], [L, B - 10], [L, CY + 8], 'z']],
    '9': [[[L + 8, B], [R - 10, B], [R, B - 10], [R, Tt + 10], [R - 10, Tt], [L + 10, Tt], [L, Tt + 10], [L, CY - 4], [L + 10, CY + 4], [R, CY + 4]]],
    '-': [[[L + 4, CY], [R - 4, CY]]], '.': [[[M, B - 6], [M, B]]], ':': [[[M, Tt + 16], [M, Tt + 22]], [[M, B - 6], [M, B]]], '/': [[[R - 4, Tt], [L + 4, B]]], '&': [[[R, B], [L + 6, Tt + 16], [L + 14, Tt], [R - 20, Tt], [R - 14, Tt + 14], [L, B - 14], [L + 10, B], [R - 8, B], [R, B - 16]]],
  };
  const glyphPath = (strokes, x, y, s) => strokes.map(st => st.map((p, i) => p === 'z' ? 'Z' : (i ? 'L' : 'M') + num(x + p[0] * s) + ' ' + num(y + p[1] * s)).join(' ')).join(' ');
  // letters(text, x, y, o): block capitals from the top-left, o.size = the cap height in units (default 80), o.fill, o.edge:false (no edge), o.shadow:false.
  // Returns { svg, width }. Unknown characters are skipped; a space is a gap of half a letter.
  function letters(text, x, y, o) {
    o = o || {}; const s = (o.size || 80) / 80, adv = 72 * s, sp = 36 * s, fill = o.fill || C.green;
    let cx = x, passes = [], sw = 14 * s;
    String(text).toUpperCase().split('').forEach(ch => {
      if (ch === ' ') { cx += sp; return; }
      const gl = G[ch]; if (!gl) return;
      passes.push(glyphPath(gl, cx, y, s)); cx += adv;
    });
    const d = passes.join(' ');
    const attrs = `fill="none" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="10"`;
    let svg = '';
    if (o.shadow !== false) svg += `<path d="${d}" transform="translate(${num(S())} ${num(S())})" stroke="${T.shadow}" stroke-width="${num(sw + 2 * E())}" ${attrs}/>`;
    if (o.edge !== false) svg += `<path d="${d}" stroke="${o.edgeColour || T.edge}" stroke-width="${num(sw + 2 * E())}" ${attrs}/>`;
    svg += `<path d="${d}" stroke="${fill}" stroke-width="${num(sw)}" ${attrs}/>`;
    return { svg, width: cx - x - (passes.length ? 12 * s : 0) };
  }
  const textWidth = (text, size) => { const s = (size || 80) / 80; let w = 0; String(text).toUpperCase().split('').forEach(ch => { if (ch === ' ') w += 36 * s; else if (G[ch]) w += 72 * s; }); return w - 12 * s; };
  // sign(text, x, y, o): capitals on a plate. o.plate: 'yellow' (Ink letters) | 'green' | 'navy' (White letters). o.size.
  function sign(text, x, y, o) {
    o = o || {}; const size = o.size || 60, pad = size * .4, w = textWidth(text, size) + pad * 2 + 2 * U.edge, h = size + pad * 2;
    const plate = o.plate === 'green' ? C.green : o.plate === 'navy' ? C.navy : C.yellow, ink = o.plate === 'yellow' || !o.plate ? C.ink : C.white;
    const prevEdge = T.edge;
    let s = box(x, y, w, h, plate, o);
    s += letters(text, x + pad + U.edge, y + pad, { size, fill: ink, edge: false, shadow: false }).svg;
    return { svg: s, width: w + U.shadow, height: h + U.shadow };
  }

  // ---------- the families a PDF needs ----------
  // opener({theme, body, title, desc, id}): a wide picture across the top of a section, 960 by 320.
  const opener = o => picture(Object.assign({ w: 960, h: 320, band: 40 }, o));
  // spot(body, o): one thing on its own in an 80 by 80 square, no floor. body draws at the square's origin.
  const spot = (body, o) => picture(Object.assign({ w: 80, h: 80, floor: false }, o || {}, { body }));
  // divider({theme, kind:'hatch'|'things', things:[fn], id}): a band 960 by 40. 'things' repeats small parts along it.
  function divider(o) {
    o = o || {}; const w = 960, h = 40;
    return picture({ w, h, floor: false, theme: o.theme, id: o.id || 'divider', title: o.title || 'Divider', body: () => {
      if (o.kind === 'things' && o.things && o.things.length) { let s = line(0, h - 2, w, h - 2); const n = o.things.length, pitch = o.pitch || 120; for (let x = 20, i = 0; x < w - 40; x += pitch, i++) s += place(x, 4, 0.5, o.things[i % n]); return s; }
      return hatch(0, U.edge, w, h - 2 * U.edge) + line(0, U.edge / 2 + 1, w, U.edge / 2 + 1) + line(0, h - U.edge / 2 - 1, w, h - U.edge / 2 - 1);
    } });
  }
  // pattern({theme, tile:[fn], w, h, pitch, id}): a repeating field of small parts, for covers and grounds. Each tile fn draws at (0,0) at half size.
  function pattern(o) {
    o = o || {}; const w = o.w || 480, h = o.h || 480, p = o.pitch || 120, sc = o.scale || 1, tiles = o.tile || [];
    return picture({ w, h, floor: false, theme: o.theme, id: o.id || 'pattern', title: o.title || 'Pattern', body: () => { let s = ''; let i = 0; for (let y = 10; y < h; y += p) for (let x = (Math.floor(y / p) % 2) * p / 2 + 10; x < w; x += p, i++) s += place(x, y, sc, tiles[i % tiles.length]); return s; } });
  }
  // stampPlate({theme, body, plate:'yellow'|'green'|'white', tilt, w, h, id}): a tilted plate carrying one small drawing, 200 by 100.
  function stampPlate(o) {
    o = o || {}; const w = o.w || 200, h = o.h || 100, tilt = o.tilt == null ? -3 : o.tilt, plate = o.plate === 'green' ? C.green : o.plate === 'white' ? C.white : C.yellow;
    return picture({ w: w + 24, h: h + 24, floor: false, theme: o.theme, id: o.id || 'stamp', title: o.title || 'Stamp', body: () => `<g transform="rotate(${tilt} ${(w + 24) / 2} ${(h + 24) / 2})">` + box(12, 12, w, h, plate, {}) + (o.body ? place(12, 12, o.scale || 1, o.body) : '') + `</g>` });
  }
  // listRow({theme, items:[fn], size, gap, id}): small drawings in a row, each in its own square, standing for the items of a list.
  function listRow(o) {
    o = o || {}; const size = o.size || 80, gap = o.gap || 20, n = o.items.length, w = n * size + (n - 1) * gap;
    return picture({ w, h: size, floor: false, theme: o.theme, id: o.id || 'list', title: o.title || 'List pictures', body: () => o.items.map((fn, i) => box(i * (size + gap) + 1.5, 1.5, size - 7, size - 7, T.ground, { shadow: true }) + group(i * (size + gap), 0, 1, fn())).join('') });
  }
  // heading(text, o): the text in block capitals as its own picture. o.size (cap height), o.fill, o.theme, o.id.
  function heading(text, o) {
    o = o || {}; const size = o.size || 80, w = textWidth(text, size) + 2 * U.edge + U.shadow + 8, h = size + 2 * U.edge + U.shadow + 8;
    return picture({ w, h, floor: false, theme: o.theme, id: o.id || 'heading', title: o.title || text, body: () => letters(text, U.edge + 4, U.edge + 4, { size, fill: o.fill }).svg });
  }

  root.NDI = {
    colours: C, themes: THEMES, units: U, use, theme: () => T,
    shape, box, octagon, disc, line, arrow, star, hatch, group, place, floor, picture, esc,
    parts: { kettle, mug, cup, counter, window: windowPane, lamp, plant, bed, clock, shelf, desk, laptop, chair, board, timer, padlock, train, signal, kerb, bicycle, taxi, gate, bench, mountain, hill, sun, rain, path, shoe, step, hand, back, controller, guitar, camera, headphones, book, pencil, envelope, pile, stamp, invoice, bin, folder, doorAjar, doorClosed, doorway, lightOnFloor, wall, stairs, corridor, block, track, stop, bars, dog },
    person, hands, personAbove, letters, textWidth, sign, glyphs: G,
    opener, spot, divider, pattern, stampPlate, listRow, heading,
  };
})(typeof window !== 'undefined' ? window : globalThis);
