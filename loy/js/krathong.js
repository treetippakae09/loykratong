/* ============================================================
   โมเดลกระทง: ข้อมูลชิ้นงาน (design) → โมเดล 3 มิติ
   ใช้ฟังก์ชันเดียวกันทุกฉาก: โต๊ะประดิษฐ์ บ่อทดลอง ถือ วาง และลอยในแม่น้ำ
   ============================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SCHEMA = 1;
export const MAX_PIECES = 80;
export const WORLD_SCALE = 0.32;   // ขนาดกระทงในโลกเกม (ฐานรัศมี 1 → 0.32 หน่วย)

export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const HEX = /^#[0-9a-fA-F]{6}$/;

/* ---------- แคช geometry / material เพื่อลดภาระ ---------- */
const geoCache = new Map();
const geo = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };
const matCache = new Map();
export function mat(color, o = {}) {
  const key = [color, o.emissive || '', o.ei ?? 1, o.opacity ?? 1, o.side || 0, o.vc ? 1 : 0, o.smooth ? 1 : 0].join('|');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, flatShading: !o.smooth, roughness: o.rough ?? 0.78, metalness: 0,
      emissive: new THREE.Color(o.emissive || '#000000'), emissiveIntensity: o.ei ?? 1,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side || THREE.FrontSide, vertexColors: !!o.vc
    }));
  }
  return matCache.get(key);
}
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
const spriteCache = new Map();
export function glowSprite(color, size) {
  if (!spriteCache.has(color)) spriteCache.set(color, new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const s = new THREE.Sprite(spriteCache.get(color)); s.scale.set(size, size, size); return s;
}
const M = (g, color, o) => { const m = new THREE.Mesh(g, mat(color, o)); m.castShadow = false; return m; };

/* ---------- ฐานกระทง ---------- */
export const BASES = {
  round: { name: 'ฐานหยวกกล้วยทรงกลม', icon: '⭕', rx: 1, rz: 1 },
  oval: { name: 'ฐานหยวกกล้วยทรงรี', icon: '🥚', rx: 1.25, rz: 0.85 },
  boat: { name: 'ฐานทรงเรือ', icon: '🛶', rx: 1.35, rz: 0.6 }
};
export const BASE_TOP = 0.32;
export const insideBase = (base, x, z, margin = 0) => { const b = BASES[base] || BASES.round; return (x / b.rx) ** 2 + (z / b.rz) ** 2 <= (1 + margin) ** 2; };

export function makeBase(type, color = '#5e9c4c') {
  const b = BASES[type] || BASES.round; const g = new THREE.Group();
  const side = M(geo('baseSide', () => new THREE.CylinderGeometry(1, 1.05, BASE_TOP, 16)), color);
  side.scale.set(b.rx, 1, b.rz); side.position.y = BASE_TOP / 2; g.add(side);
  const top = M(geo('baseTop', () => new THREE.CylinderGeometry(0.93, 0.93, 0.02, 16)), '#e8efc6');
  top.scale.set(b.rx, 1, b.rz); top.position.y = BASE_TOP + 0.005; g.add(top);
  const ring = M(geo('baseRing', () => new THREE.TorusGeometry(1.0, 0.035, 4, 24)), '#3f7f35');
  ring.rotation.x = Math.PI / 2; ring.scale.set(b.rx, b.rz, 1); ring.position.y = BASE_TOP; g.add(ring);
  if (type === 'boat') {
    for (const sgn of [1, -1]) {
      const end = M(geo('boatEnd', () => new THREE.ConeGeometry(0.32, 0.75, 6)), color);
      end.scale.z = 0.6; end.position.set(sgn * b.rx * 0.93, 0.36, 0); end.rotation.z = -sgn * 1.0; g.add(end);
    }
  }
  g.userData.isBase = true;
  return g;
}

/* ---------- วัสดุ (ทุกชิ้นมีจุดกำเนิดที่ด้านล่างกึ่งกลาง ด้านหน้าหัน +z) ---------- */
export const CATS = [['base', 'ฐานกระทง', '🟢'], ['leaf', 'ใบตอง', '🍃'], ['mine', 'วัตถุดิบของฉัน', '🧺'], ['flower', 'ดอกไม้', '🌸'], ['center', 'องค์ประกอบกลาง', '🕯️'], ['deco', 'ของตกแต่ง', '🐚'], ['mech', 'กลไก เพลา เฟือง รอก', '⚙️'], ['elec', 'ไฟฟ้า/เซ็นเซอร์', '🔌'], ['sketch', 'ชิ้นงานที่วาด', '✏️'], ['light', 'แสงเสมือน', '✨']];

function radial(n, fn) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const p = new THREE.Group(); p.rotation.y = (i / n) * Math.PI * 2; p.add(fn(i)); g.add(p); } return g; }

/* ---------- กลีบดอกไม้สมจริง: กลีบโค้ง ห่อ ปลายแหลม ไล่สีจากโคนถึงปลาย ---------- */
const WHITE = new THREE.Color('#ffffff');
const col = (hex) => new THREE.Color(hex);
function petalGeo({ len, wid, cup = 0.3, curl = 0.35, ruffle = 0, nu = 3, nv = 5, c0, c1 }) {
  const pos = [], cl = [], idx = []; const tmp = new THREE.Color();
  for (let j = 0; j <= nv; j++) { const v = j / nv, w = wid * Math.pow(Math.sin(Math.PI * Math.min(0.999, v * 0.92 + 0.04)), 0.85) * (1 - 0.2 * v);
    for (let i = 0; i <= nu; i++) { const u = i / nu * 2 - 1; const x = u * w, y = v * len;
      const z = cup * len * v * v + curl * wid * u * u + (ruffle ? Math.sin(u * Math.PI * 2 + v * 5) * ruffle * v : 0);
      pos.push(x, y, z); tmp.copy(c0).lerp(c1, Math.pow(v, 0.8)); cl.push(tmp.r, tmp.g, tmp.b); } }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** วางกลีบ: ปลายกลีบชี้ไปทิศ (เอียงจากแนวตั้ง tilt, หมุนรอบแกนตั้ง yaw) */
function place(g, x, y, z, tilt, yaw, roll = 0, s = 1) { _e.set(tilt, yaw, roll, 'YXZ'); _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e), _s.set(s, s, s)); return g.clone().applyMatrix4(_m4); }
const flowerMat = () => mat('#ffffff', { vc: true, side: THREE.DoubleSide, rough: 0.6, smooth: true });
const FM = (g) => new THREE.Mesh(g, flowerMat());

/** ดอกบัว: กลีบใหญ่ปลายแหลม 3 ชั้น โคนกลีบสีอ่อน ปลายสีเข้ม ฝักเมล็ดสีเหลืองอมเขียวตรงกลาง */
function lotusPetals(c) { return geo('lotusP' + c, () => { const base = col(c).lerp(WHITE, 0.7), tip = col(c).multiplyScalar(0.82); const L = [];
  for (const [n, tilt, len, wid, cup, off] of [[8, 66, 0.2, 0.085, 0.32, 0], [8, 44, 0.18, 0.08, 0.38, Math.PI / 8], [6, 20, 0.14, 0.066, 0.46, 0.25]]) {
    const pg = petalGeo({ len, wid, cup, curl: 0.4, nu: 3, nv: 6, c0: base, c1: tip });
    for (let i = 0; i < n; i++) { const yaw = off + i / n * Math.PI * 2; L.push(place(pg, Math.sin(yaw) * 0.035, 0.035, Math.cos(yaw) * 0.035, tilt * Math.PI / 180, yaw)); } }
  return mergeGeometries(L); }); }
/** ดาวเรือง: กลีบหยักซ้อนหลายชั้นเป็นทรงพุ่มกลม โคนกลีบเข้ม ปลายสว่าง มีกลีบเลี้ยงสีเขียวรองใต้ดอก */
function marigoldHead(c) { return geo('mariH' + c, () => { const base = col(c).multiplyScalar(0.78), tip = col(c).lerp(col('#fff1a8'), 0.22); const L = []; const counts = [5, 9, 12, 15, 17, 18, 18, 16];
  counts.forEach((n, i) => { const a = (6 + i * 12.5) * Math.PI / 180, len = 0.062 + i * 0.006, pg = petalGeo({ len, wid: 0.042, cup: 0.18, curl: 0.55, ruffle: 0.006, nu: 3, nv: 4, c0: base, c1: tip });
    for (let k = 0; k < n; k++) { const yaw = k / n * Math.PI * 2 + i * 0.37, r = 0.045; L.push(place(pg, r * Math.sin(a) * Math.sin(yaw), 0.15 + r * Math.cos(a), r * Math.sin(a) * Math.cos(yaw), a, yaw, (k % 3 - 1) * 0.25)); } });
  return mergeGeometries(L); }); }
/** กล้วยไม้ (สกุลหวาย): กลีบเลี้ยง 3 กลีบ กลีบดอก 2 กลีบ และกลีบปากสีเข้มตรงกลาง */
function orchidHead(c) { return geo('orch' + c, () => { const light = col(c).lerp(WHITE, 0.72), deep = col(c), dark = col(c).multiplyScalar(0.5); const L = [];
  const sep = petalGeo({ len: 0.085, wid: 0.028, cup: 0.12, curl: 0.25, nu: 2, nv: 5, c0: light, c1: deep }), pet = petalGeo({ len: 0.08, wid: 0.045, cup: 0.1, curl: 0.3, nu: 3, nv: 5, c0: light, c1: deep });
  const lip = petalGeo({ len: 0.055, wid: 0.04, cup: 0.6, curl: 0.7, nu: 3, nv: 4, c0: dark.clone().lerp(WHITE, 0.25), c1: dark });
  for (const yaw of [Math.PI, Math.PI + 2.1, Math.PI - 2.1]) L.push(place(sep, 0, 0.06, 0, 1.35, yaw));
  for (const yaw of [1.05, -1.05]) L.push(place(pet, 0, 0.062, 0, 1.4, yaw));
  L.push(place(lip, 0, 0.065, 0.005, 1.1, 0)); return mergeGeometries(L); }); }
/** บานไม่รู้โรย: ช่อดอกทรงกลมรีที่มีใบประดับเล็ก ๆ เรียงซ้อนแบบเกลียว 3 ช่อ พร้อมก้านและใบ */
function globeCluster(c) { return geo('glob' + c, () => { const base = col(c).multiplyScalar(0.7), tip = col(c).lerp(WHITE, 0.25); const br = petalGeo({ len: 0.03, wid: 0.018, cup: 0.25, curl: 0.3, nu: 2, nv: 3, c0: base, c1: tip }); const L = [];
  for (const [hx, hy, hz] of [[0, 0.075, 0.05], [-0.055, 0.085, -0.03], [0.055, 0.095, -0.03]]) {
    for (let i = 0; i < 36; i++) { const phi = Math.acos(1 - 2 * (i + 0.5) / 36 * 0.88), th = i * 2.39996; L.push(place(br, hx + Math.sin(phi) * Math.sin(th) * 0.03, hy + Math.cos(phi) * 0.038, hz + Math.sin(phi) * Math.cos(th) * 0.03, phi, th)); } }
  return mergeGeometries(L); }); }
function scatterPetals(c) { return geo('scat' + c, () => { const pg = petalGeo({ len: 0.075, wid: 0.048, cup: 0.12, curl: 0.25, nu: 3, nv: 4, c0: col(c).lerp(WHITE, 0.55), c1: col(c) }); const L = [];
  [[0, 0], [0.13, 0.05], [-0.1, 0.1], [0.06, -0.13], [-0.14, -0.06], [0.18, -0.08], [-0.02, 0.19]].forEach(([x, z], i) => L.push(place(pg, x, 0.012, z, Math.PI / 2 - 0.12, i * 1.9, (i % 2) * 0.3)));
  return mergeGeometries(L); }); }
const GREEN = '#3f7d2c';

/* ---------- ใบตองและดอกไม้เพิ่มเติม ---------- */
const LEAF0 = '#2c6a26', LEAF1 = '#8fd174';
const leafPetal = (key, o) => geo(key, () => petalGeo({ c0: col(LEAF0), c1: col(LEAF1), ...o }));
function vcolorY(g, c0, c1) { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, cl = [], t = new THREE.Color(); const h = (b.max.y - b.min.y) || 1;
  for (let i = 0; i < p.count; i++) { t.copy(c0).lerp(c1, (p.getY(i) - b.min.y) / h); cl.push(t.r, t.g, t.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return g; }
function fanGeo() { return geo('lfan', () => { const pos = [0, 0, 0], cl = [], idx = [], N = 14, R = 0.42, c0 = col(LEAF0), c1 = col(LEAF1);
  cl.push(c0.r, c0.g, c0.b);
  for (let i = 0; i <= N; i++) { const a = -0.6 + 1.2 * i / N, z = (i % 2) * 0.05; for (const [f, k] of [[0.5, 0.5], [1, 1]]) { pos.push(Math.sin(a) * R * f, Math.cos(a) * R * f, z * f); const t = c0.clone().lerp(c1, k); cl.push(t.r, t.g, t.b); } }
  for (let i = 0; i < N; i++) { const m0 = 1 + i * 2, o0 = m0 + 1, m1 = m0 + 2, o1 = m0 + 3; idx.push(0, m0, m1, m0, o0, o1, m0, o1, m1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }); }
function laceGeo() { return geo('llace', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.21, 0.12, 0.21, 0.4, 0, 0.56); s.bezierCurveTo(-0.21, 0.4, -0.21, 0.12, 0, 0);
  for (const [x, y, r] of [[0, 0.13, 0.03], [0, 0.27, 0.035], [0.075, 0.2, 0.022], [-0.075, 0.2, 0.022], [0.07, 0.34, 0.02], [-0.07, 0.34, 0.02], [0, 0.42, 0.025]]) { const h = new THREE.Path(); h.moveTo(x, y - r); h.lineTo(x + r, y); h.lineTo(x, y + r); h.lineTo(x - r, y); h.lineTo(x, y - r); s.holes.push(h); }
  return vcolorY(new THREE.ShapeGeometry(s, 10), col(LEAF0), col(LEAF1)); }); }
/** กุหลาบ: กลีบเรียงเป็นเกลียวตามมุมทองคำ ด้านในตั้งห่อ ด้านนอกบานออก */
function roseHead(c) { return geo('rose' + c, () => { const L = [], dark = col(c).multiplyScalar(0.55), base = col(c), light = col(c).lerp(WHITE, 0.15);
  for (let i = 0; i < 18; i++) { const k = i / 17, pg = petalGeo({ len: 0.05 + 0.055 * k, wid: 0.04 + 0.04 * k, cup: 0.55 - 0.25 * k, curl: 0.9 - 0.4 * k, nu: 3, nv: 5, c0: dark.clone().lerp(base, k), c1: k < 0.3 ? base : light });
    const yaw = i * 2.39996, r = 0.008 + 0.035 * k; L.push(place(pg, Math.sin(yaw) * r, 0.07, Math.cos(yaw) * r, 0.12 + 1.15 * k, yaw)); }
  return mergeGeometries(L); }); }
function chrysHead(c) { return geo('chry' + c, () => { const L = [], base = col(c).multiplyScalar(0.8), tip = col(c).lerp(WHITE, 0.2);
  [[22, 1.45, 0.13], [18, 1.15, 0.11], [14, 0.8, 0.085], [10, 0.45, 0.06]].forEach(([n, tilt, len], j) => { const pg = petalGeo({ len, wid: 0.022, cup: 0.12, curl: 0.6, nu: 2, nv: 4, c0: base, c1: tip });
    for (let i = 0; i < n; i++) { const yaw = i / n * Math.PI * 2 + j * 0.3; L.push(place(pg, Math.sin(yaw) * 0.02, 0.07, Math.cos(yaw) * 0.02, tilt, yaw)); } });
  return mergeGeometries(L); }); }
/** บัวตูม: กลีบโค้งเข้าหากันเป็นทรงหยดน้ำ */
function budHead(c) { return geo('bud' + c, () => { const L = [], base = col(c).lerp(WHITE, 0.6), tip = col(c).multiplyScalar(0.9);
  [[5, 0.38, 0.24, 0.09, -0.45, 0], [5, 0.2, 0.23, 0.085, -0.4, Math.PI / 5], [4, 0.08, 0.2, 0.07, -0.3, 0.3]].forEach(([n, tilt, len, wid, cup, off]) => { const pg = petalGeo({ len, wid, cup, curl: 0.45, nu: 3, nv: 6, c0: base, c1: tip });
    for (let i = 0; i < n; i++) { const yaw = off + i / n * Math.PI * 2; L.push(place(pg, Math.sin(yaw) * 0.02, 0.03, Math.cos(yaw) * 0.02, tilt, yaw)); } });
  return mergeGeometries(L); }); }
function jasmineRing() { return geo('jasm', () => { const L = [], N = 30, R = 0.3; const b = new THREE.SphereGeometry(0.028, 7, 5); b.scale(1, 1.5, 1);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2, a, 0, 'YXZ')); m.setPosition(Math.sin(a) * R, 0.035, Math.cos(a) * R); L.push(b.clone().applyMatrix4(m)); }
  return mergeGeometries(L); }); }
function spireLeaves() { return geo('spireL', () => { const L = [], pg = petalGeo({ len: 0.16, wid: 0.07, cup: 0.2, curl: 0.7, nu: 3, nv: 4, c0: col(LEAF0), c1: col(LEAF1) });
  for (let j = 0; j < 6; j++) { const r = 0.2 * (1 - j / 6.5), y = j * 0.12, n = Math.max(5, (12 - j * 1.4) | 0); for (let i = 0; i < n; i++) { const yaw = i / n * Math.PI * 2 + j * 0.4; L.push(place(pg, Math.sin(yaw) * r, y, Math.cos(yaw) * r, 0.55 - j * 0.05, yaw)); } }
  return mergeGeometries(L); }); }
/** เฟือง: รัศมีพิทช์ = โมดูล × จำนวนฟัน ÷ 2 (โมดูล 0.024) */
export const GEAR_MODULE = 0.024;
function gearGeo(n) { return geo('gear' + n, () => { const R = GEAR_MODULE * n / 2, ra = R + GEAR_MODULE * 0.9, rd = R - GEAR_MODULE * 1.1, s = new THREE.Shape(), da = Math.PI * 2 / n;
  for (let i = 0; i < n; i++) { const a = i * da, pts = [[rd, a], [ra, a + da * 0.28], [ra, a + da * 0.5], [rd, a + da * 0.78]]; pts.forEach(([r, q], k) => { const x = Math.cos(q) * r, y = Math.sin(q) * r; i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y); }); }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.02, 0, Math.PI * 2, true); s.holes.push(hole);
  if (R > 0.2) for (let k = 0; k < 4; k++) { const h = new THREE.Path(), a = k * Math.PI / 2 + Math.PI / 4; h.absarc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.18, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; }); }
function pulleyGeo() { return geo('pulley', () => new THREE.LatheGeometry([[0.02, 0], [0.12, 0], [0.12, 0.012], [0.088, 0.035], [0.12, 0.058], [0.12, 0.07], [0.02, 0.07]].map(([x, y]) => new THREE.Vector2(x, y)), 20)); }

/* ---------- ชิ้นส่วนจากภาพร่าง: โปรไฟล์ที่ได้จากภาพวาด → รูปทรง 3 มิติ ---------- */
export const SKETCH_KINDS = { flower: 'ดอกไม้/ทรงพุ่ม (ใช้เส้นรอบรูป)', extrude: 'แผ่นตัดตามรูป (ตั้งขึ้น)', lathe: 'ทรงกลึงหมุนรอบแกน (ใช้ครึ่งขวาของภาพ)' };
export function sketchGeo(sk, c) {
  const c1 = col(c), c2 = col(HEX.test(sk.c2 || '') ? sk.c2 : c); const pr = sk.pr; const N = pr.length;
  return geo('sk|' + sk.k + '|' + pr.join(',') + '|' + (sk.a || 1) + c + sk.c2, () => {
    if (sk.k === 'extrude') { const R = 0.3, s = new THREE.Shape(); for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, x = Math.sin(a) * pr[i] * R, y = Math.cos(a) * pr[i] * R; i ? s.lineTo(x, y) : s.moveTo(x, y); }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, -0.015); return vcolorY(g, c2, c1); }
    if (sk.k === 'lathe') { const W = 0.16, H = Math.min(1.1, 2 * W * (sk.a || 1)), pts = []; for (let j = 0; j < N; j++) pts.push(new THREE.Vector2(Math.max(0.004, pr[N - 1 - j] * W), j / (N - 1) * H));
      pts.unshift(new THREE.Vector2(0, 0)); pts.push(new THREE.Vector2(0, H)); const g = new THREE.LatheGeometry(pts, 22); return vcolorY(g, c2, c1); }
    // flower: โดมซ้อน 3 ชั้น ขอบเป็นรูปทรงตามภาพวาด มีหยักกลีบเล็ก ๆ
    const L = [], R = 0.2, H = 0.12, V = 8, tmp = new THREE.Color();
    for (const [sc, y0] of [[1, 0.04], [0.72, 0.07], [0.42, 0.1]]) { const pos = [], cl = [], idx = [];
      for (let v = 0; v <= V; v++) { const q = v / V, f = Math.cos(q * Math.PI / 2), y = y0 + H * sc * Math.sin(q * Math.PI / 2);
        for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, rr = pr[i] * R * sc * f * (1 + 0.07 * Math.abs(Math.sin(a * 9 + v * 0.8)));
          pos.push(Math.sin(a) * rr, y + 0.01 * Math.sin(a * 13 + v * 2.1) * (1 - q), Math.cos(a) * rr); tmp.copy(c1).lerp(c2, Math.pow(q, 0.8) * (1.15 - sc * 0.4)); cl.push(tmp.r, tmp.g, tmp.b); } }
      for (let v = 0; v < V; v++) for (let i = 0; i < N; i++) { const a = v * N + i, b = v * N + (i + 1) % N, cc = a + N, d = b + N; idx.push(a, cc, b, b, cc, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); L.push(g); }
    return mergeGeometries(L);
  });
}

export const MATERIALS = {
  leaf_sheet: { cat: 'leaf', name: 'แผ่นใบตอง', icon: '🟩', color: '#3f8f3a', colorable: false, h: 0.55, w: 1, smin: 0.5, smax: 1.8,
    real: 'ใบตองย่อยสลายได้ แต่หากทิ้งลงน้ำจำนวนมากจะเพิ่มสารอินทรีย์และใช้ออกซิเจนในน้ำ',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('lsheet', () => new THREE.BoxGeometry(0.5, 0.55, 0.03)), c); m.position.y = 0.275; g.add(m); return g; } },
  leaf_tri: { cat: 'leaf', name: 'กลีบพับสามเหลี่ยม', icon: '🔺', color: '#4a9b3f', colorable: false, h: 0.55, w: 0.6, smin: 0.5, smax: 1.8,
    real: 'การพับใบตองเป็นกลีบช่วยใช้ใบได้คุ้มค่า ควรยึดด้วยไม้กลัดแทนลวดเย็บหรือหมุดโลหะ',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('ltri', () => new THREE.ConeGeometry(0.22, 0.55, 3)), c); m.scale.z = 0.32; m.position.y = 0.275; g.add(m); return g; } },
  leaf_lotus: { cat: 'leaf', name: 'กลีบบัวใบตอง', icon: '🪷', color: '#3d8b37', colorable: false, h: 0.62, w: 0.6, smin: 0.5, smax: 1.8,
    real: 'กลีบบัวใบตองเป็นงานฝีมือดั้งเดิม ใช้ใบตองที่สดและไม่ขาด',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('llotus', () => new THREE.ConeGeometry(0.2, 0.62, 8)), c); m.scale.z = 0.3; m.position.y = 0.31; g.add(m); return g; } },
  leaf_curve: { cat: 'leaf', name: 'กลีบโค้ง', icon: '🌙', color: '#56a845', colorable: false, h: 0.4, w: 0.5, smin: 0.5, smax: 1.8,
    real: 'กลีบโค้งทำจากการม้วนใบตอง ช่วยให้กระทงดูนุ่มนวล',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('lcurve', () => new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), c, { side: THREE.DoubleSide }); m.scale.set(0.85, 1.4, 0.35); g.add(m); return g; } },

  lotus: { cat: 'flower', name: 'ดอกบัว', icon: '🪷', color: '#ff7aa2', colorable: true, h: 0.3, w: 0.8, smin: 0.5, smax: 2.2,
    real: 'ดอกบัวสดย่อยสลายได้ ใช้ในปริมาณพอดี',
    build: (c) => { const g = new THREE.Group(); g.add(FM(lotusPetals(c)));
      const cal = M(geo('lcal', () => new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), GREEN); cal.position.y = 0.045; g.add(cal);
      const pod = M(geo('lpod', () => new THREE.CylinderGeometry(0.042, 0.032, 0.045, 10)), '#c5d64a'); pod.position.y = 0.075; g.add(pod);
      const st = M(geo('lstam', () => new THREE.TorusGeometry(0.046, 0.009, 4, 16)), '#ffd23f'); st.rotation.x = Math.PI / 2; st.position.y = 0.068; g.add(st);
      const dg = geo('ldot', () => new THREE.SphereGeometry(0.008, 5, 3)); for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 0.024 : 0; const d = M(dg, '#7a8a22'); d.position.set(Math.sin(a) * r, 0.098, Math.cos(a) * r); g.add(d); }
      return g; } },
  marigold: { cat: 'flower', name: 'ดาวเรือง', icon: '🌼', color: '#ff9f1c', colorable: true, h: 0.3, w: 0.4, smin: 0.5, smax: 2.2,
    real: 'ดาวเรืองย่อยสลายได้ เด็ดเฉพาะดอกที่ใช้ ไม่ใส่ก้านพลาสติก',
    build: (c) => { const g = new THREE.Group(); g.add(FM(marigoldHead(c)));
      const cal = M(geo('mcal', () => new THREE.ConeGeometry(0.075, 0.09, 10)), GREEN); cal.rotation.x = Math.PI; cal.position.y = 0.075; g.add(cal);
      const core = new THREE.Mesh(geo('mcore', () => new THREE.SphereGeometry(0.045, 10, 8)), mat(c, { smooth: true })); core.position.y = 0.15; g.add(core); return g; } },
  orchid: { cat: 'flower', name: 'กล้วยไม้', icon: '🌺', color: '#9d2fb0', colorable: true, h: 0.16, w: 0.3, smin: 0.5, smax: 2.2,
    real: 'กล้วยไม้ใช้ประดับได้สวย ควรใช้จำนวนน้อย',
    build: (c) => { const g = new THREE.Group(); g.add(FM(orchidHead(c)));
      const ce = M(geo('orcol', () => new THREE.CylinderGeometry(0.008, 0.012, 0.03, 6)), '#fff7e0'); ce.position.set(0, 0.075, 0.008); ce.rotation.x = 0.5; g.add(ce); return g; } },
  globe: { cat: 'flower', name: 'บานไม่รู้โรย', icon: '💮', color: '#c2185b', colorable: true, h: 0.14, w: 0.2, smin: 0.5, smax: 2.2,
    real: 'บานไม่รู้โรยแห้งช้า ใช้เป็นจุดสีเล็ก ๆ ได้',
    build: (c) => { const g = new THREE.Group(); g.add(FM(globeCluster(c)));
      const sg = geo('gst', () => new THREE.CylinderGeometry(0.005, 0.006, 0.08, 4)); for (const [x, y, z] of [[0, 0.04, 0.05], [-0.055, 0.045, -0.03], [0.055, 0.05, -0.03]]) { const s = M(sg, GREEN); s.position.set(x, y - 0.005, z); g.add(s); }
      const lf = geo('glf', () => petalGeo({ len: 0.08, wid: 0.03, cup: 0.15, curl: 0.3, nu: 2, nv: 4, c0: col('#2d6a4f'), c1: col('#52b788') }));
      for (const yaw of [0.8, 3.6]) { const m = FM(lf); m.rotation.set(1.2, yaw, 0, 'YXZ'); m.position.y = 0.01; g.add(m); } return g; } },
  petals: { cat: 'flower', name: 'กลีบดอกไม้โรย', icon: '🌸', color: '#ff8fb1', colorable: true, h: 0.03, w: 0.1, smin: 0.5, smax: 2.5,
    real: 'กลีบดอกไม้โรยใช้ตกแต่งเล็กน้อยก็สวยพอ',
    build: (c) => { const g = new THREE.Group(); g.add(FM(scatterPetals(c))); return g; } },

  candle: { cat: 'center', name: 'เทียน', icon: '🕯️', color: '#ffcf6b', colorable: true, colorLabel: 'สีแสงเทียน', h: 0.48, w: 1.2, smin: 0.6, smax: 1.6,
    real: 'กระทงจริงที่มีเทียนต้องระวังไฟ ห่างจากเสื้อผ้าและเด็กเล็ก (เลือกไม่ใส่ก็ได้)',
    build: (c) => { const g = new THREE.Group(); const b = M(geo('cand', () => new THREE.CylinderGeometry(0.055, 0.06, 0.38, 8)), '#fff4dc'); b.position.y = 0.19; g.add(b);
      const f = M(geo('flame', () => new THREE.ConeGeometry(0.035, 0.1, 6)), c, { emissive: c, ei: 1.4 }); f.position.y = 0.43; f.userData.flame = true; g.add(f);
      const s = glowSprite(c, 0.5); s.position.y = 0.43; s.userData.glow = true; g.add(s); return g; } },
  incense: { cat: 'center', name: 'ธูป', icon: '🥢', color: '#8d5524', colorable: false, h: 0.58, w: 0.2, smin: 0.6, smax: 1.4,
    real: 'ธูปเป็นตัวเลือกตามความเชื่อ ใส่หรือไม่ก็ได้',
    build: (c) => { const g = new THREE.Group(); const sg = geo('ince', () => new THREE.CylinderGeometry(0.009, 0.009, 0.55, 4)); const tg = geo('incet', () => new THREE.SphereGeometry(0.016, 4, 3));
      [-0.04, 0, 0.04].forEach((x, i) => { const s = M(sg, c); s.position.set(x, 0.275, 0); s.rotation.z = (i - 1) * 0.12; g.add(s); const t = M(tg, '#ff3b1f', { emissive: '#ff3b1f', ei: 1.5 }); t.position.set(x + (i - 1) * 0.065, 0.55, 0); g.add(t); }); return g; } },
  tag: { cat: 'center', name: 'ป้ายข้อความเล็ก', icon: '🏷️', color: '#fff1d0', colorable: true, h: 0.45, w: 0.15, smin: 0.6, smax: 1.6,
    real: 'ป้ายในกระทงจริงควรทำจากใบไม้หรือกระดาษที่ย่อยสลายได้ ไม่ใช้พลาสติก',
    build: (c) => { const g = new THREE.Group(); const st = M(geo('tagst', () => new THREE.CylinderGeometry(0.01, 0.01, 0.36, 4)), '#a07a4a'); st.position.y = 0.18; g.add(st);
      const cd = M(geo('tagcd', () => new THREE.BoxGeometry(0.26, 0.16, 0.015)), c); cd.position.y = 0.38; g.add(cd);
      const h = M(geo('taght', () => new THREE.OctahedronGeometry(0.035)), '#e63946'); h.position.set(0, 0.38, 0.012); h.scale.z = 0.3; g.add(h); return g; } },

  wave: { cat: 'deco', name: 'ลายคลื่น', icon: '🌊', color: '#4cc9f0', colorable: true, h: 0.22, w: 0.15, smin: 0.5, smax: 2,
    real: 'ลายคลื่นในกระทงจริงทำได้จากการตัดใบตองเป็นลาย',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('wave', () => new THREE.TorusGeometry(0.18, 0.035, 4, 12, Math.PI)), c); g.add(m); return g; } },
  leafsmall: { cat: 'deco', name: 'ใบไม้เล็ก', icon: '🌿', color: '#2d6a4f', colorable: true, h: 0.22, w: 0.1, smin: 0.5, smax: 2,
    real: 'ใช้ใบไม้ที่ร่วงแล้วหรือเศษใบที่เหลือจากการพับ',
    build: (c) => { const g = new THREE.Group(); const lg = geo('lfs', () => new THREE.ConeGeometry(0.07, 0.24, 4));
      [-1, 1].forEach(s => { const m = M(lg, c); m.scale.z = 0.3; m.position.set(s * 0.05, 0.11, 0); m.rotation.z = -s * 0.45; g.add(m); }); return g; } },
  seablite: { cat: 'deco', name: 'ชะครามจำลอง', icon: '🌱', color: '#c1121f', colorable: true, h: 0.22, w: 0.15, smin: 0.5, smax: 2, fantasy: true,
    real: 'ของตกแต่งในเกมที่ได้แรงบันดาลใจจากพืชทนเค็มของบางขุนเทียน — ไม่แนะนำให้เด็ดพืชจริงมาใส่กระทง',
    build: (c) => { const g = new THREE.Group(); const sg = geo('sbs', () => new THREE.CylinderGeometry(0.01, 0.014, 0.18, 4)); const tg = geo('sbt', () => new THREE.IcosahedronGeometry(0.028, 0));
      for (let i = 0; i < 5; i++) { const a = i * 1.26; const s = M(sg, '#588157'); s.position.set(Math.sin(a) * 0.04, 0.09, Math.cos(a) * 0.04); s.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4); g.add(s);
        const t = M(tg, c); t.position.set(Math.sin(a) * 0.075, 0.18, Math.cos(a) * 0.075); g.add(t); } return g; } },
  mudskipper: { cat: 'deco', name: 'ปลาตีนจำลอง', icon: '🐟', color: '#8d7b68', colorable: true, h: 0.18, w: 0.3, smin: 0.5, smax: 2, fantasy: true,
    real: 'ของตกแต่งจินตนาการในเกมเท่านั้น — กระทงจริงไม่ควรใส่ตุ๊กตาหรือพลาสติก',
    build: (c) => { const g = new THREE.Group(); const b = M(geo('mdb', () => new THREE.SphereGeometry(0.1, 7, 5)), c); b.scale.set(0.9, 0.7, 2); b.position.y = 0.07; g.add(b);
      const eg = geo('mde', () => new THREE.SphereGeometry(0.032, 6, 4)); [-1, 1].forEach(s => { const e = M(eg, '#222222'); e.position.set(s * 0.035, 0.14, 0.12); g.add(e); });
      const fin = M(geo('mdf', () => new THREE.ConeGeometry(0.06, 0.12, 4)), c); fin.rotation.x = -Math.PI / 2; fin.scale.x = 0.3; fin.position.set(0, 0.07, -0.24); g.add(fin); return g; } },
  crab: { cat: 'deco', name: 'ปูก้ามดาบจำลอง', icon: '🦀', color: '#e63946', colorable: true, h: 0.15, w: 0.3, smin: 0.5, smax: 2, fantasy: true,
    real: 'ของตกแต่งจินตนาการในเกมเท่านั้น — ไม่ควรนำสัตว์หรือตุ๊กตาพลาสติกใส่กระทงจริง',
    build: (c) => { const g = new THREE.Group(); const b = M(geo('crb', () => new THREE.SphereGeometry(0.11, 7, 5)), c); b.scale.set(1.3, 0.55, 1); b.position.y = 0.07; g.add(b);
      const big = M(geo('crbig', () => new THREE.BoxGeometry(0.1, 0.07, 0.15)), '#f1c453'); big.position.set(0.18, 0.09, 0.08); big.rotation.y = -0.4; g.add(big);
      const sm = M(geo('crsm', () => new THREE.BoxGeometry(0.04, 0.03, 0.06)), c); sm.position.set(-0.14, 0.07, 0.08); g.add(sm);
      const lg = geo('crl', () => new THREE.BoxGeometry(0.12, 0.015, 0.015)); [-1, 1].forEach(s => [-0.04, 0, 0.04].forEach(z => { const l = M(lg, c); l.position.set(s * 0.15, 0.03, z); l.rotation.z = s * 0.4; g.add(l); })); return g; } },
  saltflower: { cat: 'deco', name: 'ดอกเกลือจำลอง', icon: '❄️', color: '#f8f9fa', colorable: false, h: 0.14, w: 0.2, smin: 0.5, smax: 2, fantasy: true,
    real: 'ผลึกจำลองในเกม ได้แรงบันดาลใจจาก "ดอกเกลือ" ผลึกเกลือที่เกิดบนผิวน้ำในนาเกลือ — ไม่ใช่วัสดุสำหรับกระทงจริง',
    build: (c) => { const g = new THREE.Group(); const og = geo('slt', () => new THREE.OctahedronGeometry(0.06));
      [[0, 0.06, 0], [0.07, 0.05, 0.03], [-0.06, 0.045, 0.04], [0.01, 0.1, -0.05]].forEach(p => { const m = M(og, c, { emissive: '#bde0fe', ei: 0.25 }); m.position.set(...p); g.add(m); }); return g; } },
  boatmini: { cat: 'deco', name: 'เรือจำลอง', icon: '⛵', color: '#9c6644', colorable: true, h: 0.16, w: 0.3, smin: 0.5, smax: 2, fantasy: true,
    real: 'ของตกแต่งจินตนาการในเกม สื่อถึงวิถีชีวิตริมคลอง',
    build: (c) => { const g = new THREE.Group(); const h = M(geo('bth', () => new THREE.BoxGeometry(0.13, 0.06, 0.34)), c); h.position.y = 0.03; g.add(h);
      const r = M(geo('btr', () => new THREE.ConeGeometry(0.1, 0.1, 4)), '#e9c46a'); r.position.y = 0.11; r.rotation.y = Math.PI / 4; g.add(r); return g; } },

  glow_orb: { cat: 'light', name: 'ดวงแสง', icon: '🔆', color: '#ffe66d', colorable: true, h: 0.2, w: 0.1, smin: 0.5, smax: 2, fantasy: true,
    real: 'แสงเสมือนสำหรับกระทงในโลกดิจิทัลเท่านั้น',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('orb', () => new THREE.IcosahedronGeometry(0.06, 1)), c, { emissive: c, ei: 1.2 }); m.position.y = 0.12; g.add(m);
      const s = glowSprite(c, 0.55); s.position.y = 0.12; s.userData.glow = true; g.add(s); return g; } },
  sparkles: { cat: 'light', name: 'ประกายระยิบ', icon: '✨', color: '#fff3b0', colorable: true, h: 0.4, w: 0, smin: 0.5, smax: 2, fantasy: true,
    real: 'ประกายเสมือนสำหรับโลกดิจิทัล ไม่มีวัสดุจริง',
    build: (c) => { const g = new THREE.Group();
      [[0, 0.15, 0], [0.12, 0.3, 0.05], [-0.1, 0.25, -0.06], [0.05, 0.4, -0.1], [-0.08, 0.38, 0.08], [0.14, 0.12, -0.08]].forEach((p, i) => { const s = glowSprite(c, 0.12); s.position.set(...p); s.userData.twinkle = i; g.add(s); }); return g; } },

  /* ---------- กลีบใบตองพิเศษ (ต้องตัดที่โต๊ะช่างก่อน → เก็บเป็นวัตถุดิบของฉัน) ---------- */
  leaf_rose: { cat: 'leaf', inv: true, name: 'กลีบกุหลาบใบตอง', icon: '🌹', color: '#3f8f3a', colorable: false, h: 0.5, w: 0.6, smin: 0.5, smax: 1.8,
    real: 'ตัดใบตองเป็นแถบ พับครึ่งตามยาว แล้วม้วนเป็นกรวยคล้ายกลีบกุหลาบ ยึดด้วยไม้กลัด',
    build: () => { const g = new THREE.Group(); g.add(FM(leafPetal('lrose', { len: 0.5, wid: 0.2, cup: 0.18, curl: 1.1, nu: 5, nv: 6 })));
      const inner = FM(leafPetal('lrose2', { len: 0.36, wid: 0.13, cup: 0.1, curl: 1.3, nu: 4, nv: 5 })); inner.position.z = 0.05; g.add(inner); return g; } },
  leaf_nail: { cat: 'leaf', inv: true, name: 'กลีบเล็บมือนาง', icon: '💅', color: '#3f8f3a', colorable: false, h: 0.55, w: 0.5, smin: 0.5, smax: 1.8,
    real: 'ตัดใบตองเป็นแถบเล็ก พับปลายให้แหลมคล้ายเล็บมือ เรียงซ้อนกันเป็นชั้น',
    build: () => { const g = new THREE.Group(); const pg = leafPetal('lnail', { len: 0.55, wid: 0.075, cup: 0.25, curl: 0.9, nu: 3, nv: 6 });
      for (const s of [-1, 1]) { const m = FM(pg); m.position.x = s * 0.045; m.rotation.z = -s * 0.12; g.add(m); } return g; } },
  leaf_phanom: { cat: 'leaf', inv: true, name: 'กลีบพนม (ซ้อน 3 ชั้น)', icon: '🔼', color: '#3f8f3a', colorable: false, h: 0.55, w: 0.65, smin: 0.5, smax: 1.8,
    real: 'พับใบตองเป็นรูปสามเหลี่ยมคล้ายมือพนม ซ้อนกัน 3 ชั้นจากใหญ่ไปเล็ก',
    build: () => { const g = new THREE.Group(); const cg = geo('lphan', () => { const c = new THREE.ConeGeometry(0.2, 0.55, 4, 1, true); c.rotateY(Math.PI / 4); c.scale(1, 1, 0.35); c.translate(0, 0.275, 0); return c; });
      [[1, '#3a8a33', 0], [0.78, '#58a845', 0.035], [0.56, '#7cc46a', 0.07]].forEach(([s, cc, z]) => { const m = M(cg, cc, { side: THREE.DoubleSide }); m.scale.setScalar(s); m.position.z = z; g.add(m); }); return g; } },
  leaf_fan: { cat: 'leaf', inv: true, name: 'กลีบจีบพัด', icon: '🪭', color: '#3f8f3a', colorable: false, h: 0.42, w: 0.55, smin: 0.5, smax: 1.8,
    real: 'พับใบตองกลับไปกลับมาแบบจีบพัด แล้วรวบโคนให้บานออกเป็นรูปพัด',
    build: () => { const g = new THREE.Group(); g.add(FM(fanGeo())); return g; } },
  leaf_lace: { cat: 'leaf', inv: true, name: 'ใบตองฉลุลาย', icon: '🍃', color: '#3f8f3a', colorable: false, h: 0.55, w: 0.45, smin: 0.5, smax: 1.8,
    real: 'วาดลายบนใบตองแล้วใช้คัตเตอร์บนแผ่นรองตัดฉลุช่องเล็ก ๆ ให้เป็นลวดลาย',
    build: () => { const g = new THREE.Group(); g.add(FM(laceGeo())); return g; } },

  /* ---------- ดอกไม้เพิ่มเติม ---------- */
  rose: { cat: 'flower', name: 'กุหลาบ', icon: '🌹', color: '#e63946', colorable: true, h: 0.17, w: 0.35, smin: 0.5, smax: 2.2,
    real: 'กุหลาบสดย่อยสลายได้ ใช้เฉพาะดอก ไม่ใช้ก้านลวดหรือฟองน้ำโอเอซิส',
    build: (c) => { const g = new THREE.Group(); g.add(FM(roseHead(c)));
      const sep = leafPetal('rsep', { len: 0.07, wid: 0.03, cup: 0.1, curl: 0.3, nu: 2, nv: 3 }); for (let i = 0; i < 5; i++) { const m = FM(sep); m.rotation.set(2.0, i * 1.2566, 0, 'YXZ'); m.position.y = 0.06; g.add(m); } return g; } },
  chrys: { cat: 'flower', name: 'เบญจมาศ', icon: '🌼', color: '#ffe14d', colorable: true, h: 0.14, w: 0.35, smin: 0.5, smax: 2.2,
    real: 'เบญจมาศกลีบเล็กละเอียด สีสด อยู่ได้นาน',
    build: (c) => { const g = new THREE.Group(); g.add(FM(chrysHead(c))); const core = new THREE.Mesh(geo('chc', () => new THREE.SphereGeometry(0.035, 10, 6)), mat('#c9a227', { smooth: true })); core.scale.y = 0.6; core.position.y = 0.08; g.add(core); return g; } },
  crown: { cat: 'flower', name: 'ดอกรัก', icon: '💜', color: '#d8c3f5', colorable: true, h: 0.1, w: 0.15, smin: 0.5, smax: 2.2,
    real: 'ดอกรักนิยมร้อยเป็นมาลัย กลีบหนาและอยู่ได้นาน',
    build: (c) => { const g = new THREE.Group(); const pg = geo('crp' + c, () => petalGeo({ len: 0.07, wid: 0.035, cup: -0.15, curl: 0.3, nu: 2, nv: 4, c0: col(c).lerp(WHITE, 0.5), c1: col(c) }));
      for (let i = 0; i < 5; i++) { const m = FM(pg); m.rotation.set(1.75, i * 1.2566, 0, 'YXZ'); m.position.y = 0.05; g.add(m); }
      const hg = geo('crh', () => new THREE.ConeGeometry(0.012, 0.035, 5)); for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.6, h = M(hg, '#f8f0ff'); h.position.set(Math.sin(a) * 0.022, 0.07, Math.cos(a) * 0.022); h.rotation.set(-Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); g.add(h); }
      const cc = M(geo('crc', () => new THREE.CylinderGeometry(0.014, 0.018, 0.04, 6)), '#ffffff'); cc.position.y = 0.075; g.add(cc); return g; } },
  lotusbud: { cat: 'flower', name: 'ดอกบัวตูม', icon: '🌷', color: '#ff7aa2', colorable: true, h: 0.3, w: 0.5, smin: 0.5, smax: 2.2,
    real: 'บัวตูมใช้เป็นยอดหรือจุดเด่นของกระทง ควรใช้ดอกที่หลุดร่วงหรือปลูกเอง',
    build: (c) => { const g = new THREE.Group(); g.add(FM(budHead(c))); const st = M(geo('bst', () => new THREE.CylinderGeometry(0.015, 0.018, 0.05, 6)), GREEN); st.position.y = 0.02; g.add(st); return g; } },
  garland: { cat: 'flower', name: 'พวงมาลัยมะลิ', icon: '📿', color: '#e63946', colorable: true, colorLabel: 'สีดอกไม้แซม', h: 0.07, w: 0.6, smin: 0.5, smax: 2,
    real: 'มาลัยมะลิร้อยด้วยด้ายฝ้าย วางรอบฐานเพิ่มความหอม ไม่ควรใช้ด้ายไนลอน',
    build: (c) => { const g = new THREE.Group(); g.add(new THREE.Mesh(jasmineRing(), mat('#fbfbf2', { smooth: true, rough: 0.5 })));
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, h = FM(roseHead(c)); h.scale.setScalar(0.55); h.position.set(Math.sin(a) * 0.3, -0.01, Math.cos(a) * 0.3); g.add(h); } return g; } },

  /* ---------- องค์ประกอบกลาง/ของตกแต่งเพิ่มเติม ---------- */
  spire: { cat: 'center', name: 'ยอดพุ่มใบตอง', icon: '🎄', color: '#ffffff', colorable: true, colorLabel: 'สีดอกบนยอด', h: 0.85, w: 1.0, smin: 0.5, smax: 1.6,
    real: 'ยอดพุ่มทำจากกลีบใบตองซ้อนเป็นชั้นบนแกนหยวก ช่วยให้กระทงสูงสง่า แต่ยิ่งสูงยิ่งต้องระวังสมดุล',
    build: (c) => { const g = new THREE.Group(); g.add(FM(spireLeaves())); const core = M(geo('spireC', () => new THREE.ConeGeometry(0.17, 0.75, 8)), '#4f8f3c'); core.position.y = 0.36; g.add(core);
      const top = FM(budHead(c)); top.scale.setScalar(0.6); top.position.y = 0.7; g.add(top); return g; } },
  pin: { cat: 'deco', name: 'ไม้กลัด', icon: '📌', color: '#c8a26b', colorable: false, h: 0.08, w: 0.02, smin: 0.5, smax: 2,
    real: 'ไม้กลัดทำจากไม้ไผ่ ใช้ยึดกลีบใบตองแทนลวดเย็บหรือหมุดโลหะ ย่อยสลายได้',
    build: (c) => { const g = new THREE.Group(); const sg = geo('pinst', () => new THREE.CylinderGeometry(0.006, 0.004, 0.16, 4)); [[0, 0.5], [0.04, -0.4], [-0.04, 0.2]].forEach(([x, r]) => { const m = M(sg, c); m.rotation.set(Math.PI / 2 - 0.25, r, 0); m.position.set(x, 0.03, 0); g.add(m); }); return g; } },
  bread: { cat: 'deco', name: 'ขนมปังอาหารปลา', icon: '🍞', color: '#e9c46a', colorable: false, h: 0.08, w: 0.15, smin: 0.5, smax: 2,
    real: 'ขนมปังเป็นอาหารปลาได้ แต่ถ้ามากเกินไปจะทำให้น้ำเน่าเสีย ใช้แต่พอดี',
    build: (c) => { const g = new THREE.Group(); const bg = geo('brd', () => new THREE.IcosahedronGeometry(0.045, 0)); [[0, 0], [0.08, 0.03], [-0.05, 0.07]].forEach(([x, z], i) => { const m = M(bg, i ? '#f4d58d' : c); m.position.set(x, 0.035, z); m.rotation.set(i, i * 2, 0); g.add(m); }); return g; } },
  rope: { cat: 'deco', name: 'เชือกกาบกล้วย', icon: '➰', color: '#9c8b5e', colorable: false, h: 0.04, w: 0.2, smin: 0.5, smax: 2,
    real: 'เชือกจากกาบกล้วยแห้ง ใช้รัดหรือตกแต่งขอบ ย่อยสลายได้',
    build: (c) => { const g = new THREE.Group(); const m = M(geo('rope', () => new THREE.TorusGeometry(0.3, 0.014, 5, 40)), c); m.rotation.x = Math.PI / 2; m.position.y = 0.015; g.add(m); return g; } },
  ribbon: { cat: 'deco', name: 'โบใบตอง', icon: '🎀', color: '#4a9b3f', colorable: false, h: 0.14, w: 0.08, smin: 0.5, smax: 2,
    real: 'พับใบตองเป็นห่วงสองข้างแล้วรัดตรงกลาง',
    build: (c) => { const g = new THREE.Group(); const lg = geo('rbl', () => new THREE.TorusGeometry(0.05, 0.016, 4, 12)); for (const s of [-1, 1]) { const m = M(lg, c); m.scale.set(1, 0.7, 0.4); m.position.set(s * 0.055, 0.07, 0); g.add(m); }
      const k = M(geo('rbk', () => new THREE.BoxGeometry(0.035, 0.04, 0.03)), '#3a7d32'); k.position.y = 0.07; g.add(k); return g; } },

  /* ---------- กลไก (วิชาการออกแบบและเทคโนโลยี) ---------- */
  shaft: { cat: 'mech', tech: true, name: 'เพลา (แกนหมุน)', icon: '🦯', color: '#ced4da', colorable: false, h: 0.62, w: 0.25, smin: 0.5, smax: 2,
    real: 'เพลาเป็นแกนส่งการหมุนจากต้นกำลังไปยังเฟืองหรือรอก มีแบริ่งรองรับ · กระทงจริงใช้ไม้ไผ่หรือก้านมะพร้าวแทนได้',
    build: (c) => { const g = new THREE.Group(); const b = M(geo('brg', () => new THREE.CylinderGeometry(0.05, 0.055, 0.04, 10)), '#6c757d'); b.position.y = 0.02; g.add(b);
      const sp = new THREE.Group(); sp.userData.spinAxis = 'y'; const rod = M(geo('rod', () => new THREE.CylinderGeometry(0.022, 0.022, 0.6, 8)), c); rod.position.y = 0.31; sp.add(rod);
      const key = M(geo('rodk', () => new THREE.BoxGeometry(0.07, 0.02, 0.015)), '#e63946'); key.position.set(0.03, 0.45, 0); sp.add(key); g.add(sp); return g; } },
  gear: { cat: 'mech', tech: true, param: 'n', name: 'เฟือง (กำหนดจำนวนฟันได้)', icon: '⚙️', color: '#f4a261', colorable: true, h: 0.16, w: 0.3, smin: 0.6, smax: 1.6,
    real: 'เฟืองที่ขบกันจะหมุนสวนทางกัน · อัตราทด = จำนวนฟันเฟืองตาม ÷ จำนวนฟันเฟืองขับ · ทำจากไม้อัดหรือกระดาษแข็งได้',
    build: (c, p) => { const n = p?.n || 12, g = new THREE.Group(); const ax = M(geo('gax', () => new THREE.CylinderGeometry(0.018, 0.018, 0.17, 8)), '#adb5bd'); ax.position.y = 0.085; g.add(ax);
      const sp = new THREE.Group(); sp.userData.spinAxis = 'y'; sp.position.y = 0.11; sp.add(M(gearGeo(n), c));
      const mk = M(geo('gmk', () => new THREE.BoxGeometry(0.02, 0.012, 0.05)), '#ffffff'); mk.position.set(0, 0.04, -(0.012 * n - 0.035)); sp.add(mk); g.add(sp); return g; } },
  pulley: { cat: 'mech', tech: true, name: 'รอก/มู่เล่ (ต่อสายพานอัตโนมัติ)', icon: '🛞', color: '#8d99ae', colorable: true, h: 0.16, w: 0.3, smin: 0.6, smax: 2,
    real: 'รอกสองตัวที่ต่อด้วยสายพานหมุนทางเดียวกัน · อัตราทด = เส้นผ่านศูนย์กลางรอกตาม ÷ รอกขับ · ปรับขนาดรอกเพื่อเปลี่ยนความเร็ว',
    build: (c) => { const g = new THREE.Group(); const ax = M(geo('pax', () => new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8)), '#adb5bd'); ax.position.y = 0.08; g.add(ax);
      const sp = new THREE.Group(); sp.userData.spinAxis = 'y'; sp.position.y = 0.08; sp.add(M(pulleyGeo(), c));
      const mk = M(geo('pmk', () => new THREE.BoxGeometry(0.02, 0.01, 0.07)), '#ffd60a'); mk.position.set(0, 0.072, -0.06); sp.add(mk); g.add(sp); return g; } },
  propeller: { cat: 'mech', tech: true, name: 'ใบพัดกังหัน', icon: '🌀', color: '#f1faee', colorable: true, h: 0.75, w: 0.35, smin: 0.5, smax: 1.6,
    real: 'ใบพัดเปลี่ยนพลังงานลมเป็นการหมุน (กังหันลม) หรือใช้มอเตอร์หมุนใบพัด · ทำจากใบตองแห้งหรือกระดาษได้',
    build: (c) => { const g = new THREE.Group(); const mast = M(geo('mst', () => new THREE.CylinderGeometry(0.018, 0.024, 0.55, 6)), '#8d6e4f'); mast.position.y = 0.275; g.add(mast);
      const sp = new THREE.Group(); sp.userData.spinAxis = 'z'; sp.position.set(0, 0.56, 0.04); const hub = M(geo('hub', () => new THREE.SphereGeometry(0.035, 8, 6)), '#e63946'); sp.add(hub);
      const bl = geo('blade', () => { const b = new THREE.BoxGeometry(0.06, 0.2, 0.01); b.translate(0, 0.11, 0); return b; }); for (let i = 0; i < 3; i++) { const m = M(bl, c); m.rotation.set(0, 0.35, i * 2.094); sp.add(m); } g.add(sp); return g; } },

  /* ---------- ไฟฟ้าและเซ็นเซอร์ ---------- */
  battery: { cat: 'elec', tech: true, name: 'รางถ่าน AA 2 ก้อน (3 V)', icon: '🔋', color: '#2b9348', colorable: false, h: 0.11, w: 1.6, smin: 0.7, smax: 1.4,
    real: 'แหล่งจ่ายไฟฟ้ากระแสตรง ถ่าน 1 ก้อน = 1.5 V ต่ออนุกรม 2 ก้อน = 3 V · มีน้ำหนักมาก ควรวางใกล้กลางฐาน · ห้ามทิ้งถ่านลงน้ำจริง',
    build: (c) => { const g = new THREE.Group(); const box = M(geo('bhold', () => new THREE.BoxGeometry(0.26, 0.06, 0.16)), '#212529'); box.position.y = 0.03; g.add(box);
      const cg = geo('cell', () => { const q = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10); q.rotateZ(Math.PI / 2); return q; }); const tg = geo('ctop', () => { const q = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6); q.rotateZ(Math.PI / 2); return q; });
      for (const z of [-0.035, 0.035]) { const cl = M(cg, c); cl.position.set(0, 0.075, z); g.add(cl); const tp = M(tg, '#ced4da'); tp.position.set(z > 0 ? 0.11 : -0.11, 0.075, z); g.add(tp); }
      const tb = geo('bterm', () => new THREE.BoxGeometry(0.03, 0.025, 0.025)); const pl = M(tb, '#e63946'); pl.position.set(0.145, 0.04, 0.05); g.add(pl); const mn = M(tb, '#111111'); mn.position.set(0.145, 0.04, -0.05); g.add(mn); return g; } },
  solar: { cat: 'elec', tech: true, name: 'แผงโซลาร์เซลล์', icon: '🔆', color: '#1d3557', colorable: false, h: 0.22, w: 0.5, smin: 0.6, smax: 1.5,
    real: 'เปลี่ยนพลังงานแสงเป็นไฟฟ้า ใช้ได้เมื่อมีแสง · กลางคืนต้องใช้ถ่านหรือแบตเตอรี่ที่เก็บพลังงานไว้',
    build: (c) => { const g = new THREE.Group(); const leg = M(geo('sleg', () => new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5)), '#6c757d'); leg.position.y = 0.07; g.add(leg);
      const pan = new THREE.Group(); pan.position.y = 0.15; pan.rotation.x = -0.6; pan.add(M(geo('span', () => new THREE.BoxGeometry(0.3, 0.012, 0.2)), c));
      const lg = geo('sline', () => new THREE.BoxGeometry(0.302, 0.014, 0.006)); for (const z of [-0.05, 0, 0.05]) { const l = M(lg, '#a8dadc'); l.position.z = z; pan.add(l); }
      const lv = geo('slinev', () => new THREE.BoxGeometry(0.006, 0.014, 0.202)); for (const x of [-0.075, 0, 0.075]) { const l = M(lv, '#a8dadc'); l.position.x = x; pan.add(l); } g.add(pan); return g; } },
  switch: { cat: 'elec', tech: true, name: 'สวิตช์ เปิด/ปิด', icon: '🎚️', color: '#f8f9fa', colorable: false, h: 0.09, w: 0.1, smin: 0.7, smax: 1.6,
    real: 'สวิตช์ทำหน้าที่ตัดหรือต่อวงจร เมื่อปิดสวิตช์ (Open) กระแสไฟฟ้าไหลไม่ได้',
    build: (c, p, d, ctx) => { const g = new THREE.Group(); const b = M(geo('swb', () => new THREE.BoxGeometry(0.12, 0.04, 0.08)), c); b.position.y = 0.02; g.add(b);
      const lv = M(geo('swl', () => { const q = new THREE.BoxGeometry(0.02, 0.07, 0.03); q.translate(0, 0.035, 0); return q; }), ctx?.on ? '#2a9d8f' : '#e63946'); lv.position.y = 0.04; lv.rotation.z = ctx?.on ? -0.5 : 0.5; g.add(lv); return g; } },
  resistor: { cat: 'elec', tech: true, name: 'ตัวต้านทาน', icon: '〰️', color: '#e9d8a6', colorable: false, h: 0.05, w: 0.03, smin: 0.7, smax: 1.6,
    real: 'ตัวต้านทานจำกัดกระแสไฟฟ้า ต่ออนุกรมกับ LED เพื่อไม่ให้ LED ร้อนจนเสียหาย · อ่านค่าได้จากแถบสี',
    build: (c) => { const g = new THREE.Group(); const body = M(geo('rbody', () => { const q = new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8); q.rotateZ(Math.PI / 2); return q; }), c); body.position.y = 0.03; g.add(body);
      const bg = geo('rband', () => { const q = new THREE.CylinderGeometry(0.0195, 0.0195, 0.008, 8); q.rotateZ(Math.PI / 2); return q; }); [['#7f5539', -0.022], ['#111111', -0.008], ['#e63946', 0.006], ['#d4a017', 0.024]].forEach(([cc, x]) => { const m = M(bg, cc); m.position.set(x, 0.03, 0); g.add(m); });
      const lg = geo('rleg', () => { const q = new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4); q.rotateZ(Math.PI / 2); return q; }); for (const x of [-0.06, 0.06]) { const m = M(lg, '#adb5bd'); m.position.set(x, 0.03, 0); g.add(m); } return g; } },
  led: { cat: 'elec', tech: true, name: 'หลอด LED', icon: '💡', color: '#ffe66d', colorable: true, colorLabel: 'สีแสง LED', h: 0.12, w: 0.03, smin: 0.7, smax: 2,
    real: 'LED (ไดโอดเปล่งแสง) มีขั้ว ขาเลยยาวคือขั้วบวก (+) · ใช้ไฟน้อยกว่าหลอดไส้มาก · ควรต่อตัวต้านทานอนุกรม',
    build: (c, p, d, ctx) => { const g = new THREE.Group(); const lg = geo('lleg', () => new THREE.CylinderGeometry(0.003, 0.003, 0.06, 4)); for (const [x, h] of [[-0.012, 0.06], [0.012, 0.07]]) { const m = M(lg, '#adb5bd'); m.scale.y = h / 0.06; m.position.set(x, h / 2, 0); g.add(m); }
      const lit = !!ctx?.lit; const dm = new THREE.Mesh(geo('ldome', () => { const q = new THREE.CapsuleGeometry(0.025, 0.03, 4, 10); q.translate(0, 0.09, 0); return q; }), mat(c, lit ? { emissive: c, ei: 2.2, smooth: true } : { opacity: 0.75, smooth: true, rough: 0.3 })); g.add(dm);
      if (lit) { const s = glowSprite(c, 0.45); s.position.y = 0.09; s.userData.glow = true; if (ctx.blink) s.userData.blink = true; g.add(s); if (ctx.blink) dm.userData.blinkMesh = true; } return g; } },
  motor: { cat: 'elec', tech: true, name: 'มอเตอร์ไฟฟ้า (DC)', icon: '🔄', color: '#ced4da', colorable: false, h: 0.1, w: 0.6, smin: 0.7, smax: 1.6,
    real: 'มอเตอร์เปลี่ยนพลังงานไฟฟ้าเป็นพลังงานกล (การหมุน) ใช้เป็นต้นกำลังขับเฟือง รอก หรือใบพัด',
    build: (c) => { const g = new THREE.Group(); const body = M(geo('mbody', () => { const q = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12); q.rotateX(Math.PI / 2); return q; }), c); body.position.y = 0.05; g.add(body);
      const cap = M(geo('mcap', () => { const q = new THREE.CylinderGeometry(0.046, 0.046, 0.02, 12); q.rotateX(Math.PI / 2); return q; }), '#e63946'); cap.position.set(0, 0.05, -0.065); g.add(cap);
      const sp = new THREE.Group(); sp.userData.spinAxis = 'z'; sp.position.set(0, 0.05, 0.07); const disc = M(geo('mdisc', () => { const q = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10); q.rotateX(Math.PI / 2); return q; }), '#f8f9fa'); sp.add(disc);
      const mk = M(geo('mmk', () => new THREE.BoxGeometry(0.008, 0.028, 0.012)), '#e63946'); mk.position.y = 0.015; sp.add(mk); g.add(sp); return g; } },
  ldr: { cat: 'elec', tech: true, sensor: true, name: 'เซ็นเซอร์แสง (LDR)', icon: '🌗', color: '#e76f51', colorable: false, h: 0.06, w: 0.03, smin: 0.7, smax: 1.8,
    real: 'LDR เปลี่ยนค่าความต้านทานตามแสง ใช้ทำไฟที่ติดเองเมื่อมืด (กลางคืนในงานจึงทำงาน)',
    build: (c) => { const g = new THREE.Group(); const d = M(geo('ldrd', () => new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12)), '#f1faee'); d.position.y = 0.05; g.add(d);
      const zg = geo('ldrz', () => new THREE.BoxGeometry(0.044, 0.004, 0.005)); for (let i = 0; i < 5; i++) { const z = M(zg, c); z.position.set(0, 0.057, -0.016 + i * 0.008); g.add(z); }
      const lg = geo('lleg', () => new THREE.CylinderGeometry(0.003, 0.003, 0.06, 4)); for (const x of [-0.01, 0.01]) { const m = M(lg, '#adb5bd'); m.scale.y = 0.75; m.position.set(x, 0.022, 0); g.add(m); } return g; } },
  water_sensor: { cat: 'elec', tech: true, sensor: true, name: 'เซ็นเซอร์น้ำ', icon: '💧', color: '#0077b6', colorable: false, h: 0.1, w: 0.05, smin: 0.7, smax: 1.6,
    real: 'เมื่อขั้วโลหะสองขั้วสัมผัสน้ำ น้ำจะเป็นตัวนำต่อวงจร (ใช้ทำไฟที่ติดเมื่อกระทงลงน้ำ)',
    build: (c) => { const g = new THREE.Group(); const b = M(geo('wsb', () => new THREE.BoxGeometry(0.06, 0.1, 0.012)), c); b.position.y = 0.05; g.add(b);
      const pg = geo('wsp', () => new THREE.BoxGeometry(0.006, 0.08, 0.014)); for (const x of [-0.015, 0.015]) { const m = M(pg, '#d4a017'); m.position.set(x, 0.045, 0.002); g.add(m); } return g; } },
  tilt_sensor: { cat: 'elec', tech: true, sensor: true, name: 'เซ็นเซอร์ความเอียง', icon: '📐', color: '#6a4c93', colorable: false, h: 0.07, w: 0.04, smin: 0.7, smax: 1.6,
    real: 'ภายในมีลูกบอลโลหะ เมื่อเอียงมากลูกบอลจะกลิ้งไปแตะขั้ว ต่อวงจรให้ไฟเตือนกะพริบ (ใช้ตรวจความสมดุลของกระทง)',
    build: (c) => { const g = new THREE.Group(); const can = M(geo('tsc', () => new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10)), c); can.position.y = 0.04; g.add(can);
      const ball = M(geo('tsb', () => new THREE.SphereGeometry(0.012, 6, 4)), '#ced4da'); ball.position.y = 0.072; g.add(ball); return g; } },

  /* ---------- ชิ้นส่วนจากภาพร่าง ---------- */
  sketch: { cat: 'sketch', name: 'ชิ้นงานที่วาด', icon: '✏️', color: '#ff9f1c', colorable: true, h: 0.25, w: 0.4, smin: 0.4, smax: 2.5,
    real: 'ชิ้นงานที่สร้างจากภาพร่างของคุณ เมื่อทำจริงเลือกวัสดุธรรมชาติที่ย่อยสลายได้',
    build: (c, p, d) => { const g = new THREE.Group(); const sk = (d?.sketches || []).find(s => s.id === p?.sk);
      if (!sk) { g.add(M(geo('skmiss', () => new THREE.OctahedronGeometry(0.06)), c)); return g; }
      const geom = sketchGeo(sk, c); g.add(new THREE.Mesh(geom, mat('#ffffff', { vc: true, side: THREE.DoubleSide, rough: 0.6, smooth: true })));
      if (sk.k === 'flower') { const cal = M(geo('skcal', () => new THREE.ConeGeometry(0.07, 0.05, 8)), GREEN); cal.rotation.x = Math.PI; cal.position.y = 0.03; g.add(cal); } return g; } }
};
export const SMALL_CATS = new Set(['flower', 'deco', 'light', 'elec']);
export const TECH_CATS = new Set(['mech', 'elec']);

/* ---------- วงจรไฟฟ้า (จำลองเพื่อการเรียนรู้) ---------- */
export function evalCircuit(d, env = {}) {
  const ps = (d && d.pieces) || []; const n = {}; for (const p of ps) n[p.m] = (n[p.m] || 0) + 1; const k = (m) => n[m] || 0;
  const elec = ps.filter(p => MATERIALS[p.m] && MATERIALS[p.m].cat === 'elec').length;
  const c = (d && d.circuit) || {}, on = c.on !== false, wires = c.wires !== false, dark = env.dark !== false, sun = !!env.sun;
  const volts = k('battery') * 3 + (sun ? k('solar') * 2 : 0);
  const out = { any: elec > 0, on, wires, volts, steps: [], warn: [], powered: false, lit: false, motorOn: false, blink: false, current: 0, n };
  if (!elec) return out;
  let ok = true; const S = (s, t) => out.steps.push([s, t]);
  if (!k('battery') && !k('solar')) { ok = false; S('✗', 'ไม่มีแหล่งจ่ายไฟ — เพิ่มรางถ่านหรือโซลาร์เซลล์'); }
  else S(volts > 0 ? '✓' : '✗', `แหล่งจ่ายไฟ: ${k('battery') ? `ถ่าน AA ${k('battery') * 2} ก้อน` : ''}${k('battery') && k('solar') ? ' + ' : ''}${k('solar') ? `โซลาร์เซลล์ ${k('solar')} แผง${sun ? '' : ' (ไม่มีแสง)'}` : ''} = ${volts.toFixed(1)} V`);
  if (k('solar') && !sun) out.warn.push('โซลาร์เซลล์ผลิตไฟได้เมื่อมีแสง — งานลอยกระทงเป็นเวลากลางคืน ต้องมีถ่านหรือแบตเตอรี่ช่วย');
  if (volts <= 0) ok = false;
  if (!k('led') && !k('motor')) { ok = false; S('✗', 'ยังไม่มีโหลด (อุปกรณ์ที่ใช้ไฟ) เช่น LED หรือมอเตอร์'); }
  else S('✓', `โหลด: ${[k('led') ? `LED ${k('led')} ดวง` : '', k('motor') ? `มอเตอร์ ${k('motor')} ตัว` : ''].filter(Boolean).join(', ')}`);
  if (!wires) { ok = false; S('✗', 'ยังไม่ได้ต่อสายไฟ — วงจรต้องเป็นวงปิดจากขั้วบวก ผ่านโหลด กลับขั้วลบ'); } else S('✓', 'ต่อสายไฟเป็นวงปิด (สายแดง = ทางไปจากขั้วบวก, สายดำ = ทางกลับขั้วลบ)');
  if (k('switch')) S(on ? '✓' : '○', on ? 'สวิตช์ ON: ต่อวงจร กระแสไหลได้' : 'สวิตช์ OFF: วงจรเปิด กระแสไหลไม่ได้');
  if (k('switch') && !on) ok = false;
  const tilted = computeStats(d).offset > 0.3; let sens = true;
  if (k('ldr')) { S(dark ? '✓' : '○', dark ? 'เซ็นเซอร์แสง: มืด → ต่อวงจร (ไฟติดเอง)' : 'เซ็นเซอร์แสง: สว่าง → ตัดวงจร'); sens = sens && dark; }
  if (k('water_sensor')) { S(env.water ? '✓' : '○', env.water ? 'เซ็นเซอร์น้ำ: สัมผัสน้ำ → ต่อวงจร' : 'เซ็นเซอร์น้ำ: ยังไม่สัมผัสน้ำ (ลองที่บ่อทดลอง)'); sens = sens && !!env.water; }
  if (k('tilt_sensor')) { S(tilted ? '!' : '○', tilted ? 'เซ็นเซอร์เอียง: กระทงเอียงมาก → ไฟเตือนกะพริบ' : 'เซ็นเซอร์เอียง: กระทงสมดุล → ไม่เตือน'); sens = sens && tilted; }
  out.powered = ok && sens;
  out.lit = out.powered && k('led') > 0; out.motorOn = out.powered && k('motor') > 0; out.blink = out.powered && k('tilt_sensor') > 0;
  if (k('led') && !k('resistor')) out.warn.push('ควรต่อตัวต้านทานอนุกรมกับ LED เพื่อจำกัดกระแส ไม่ให้ LED ร้อนจนเสียหาย');
  if (k('led') && volts > 0 && volts < 3) out.warn.push('LED สีขาว/ฟ้าต้องใช้แรงดันประมาณ 3 V');
  if (k('led') + k('motor') > 1) out.warn.push(`มีโหลด ${k('led') + k('motor')} ชิ้น ในการจำลองต่อแบบขนาน แต่ละชิ้นได้แรงดันเท่ากัน`);
  out.current = out.powered ? k('led') * 0.02 + k('motor') * 0.25 : 0;
  return out;
}

/* ---------- กลไก: ความเร็วรอบของเฟือง/รอก ---------- */
export function mechInfo(d, ctx) {
  const ps = (d && d.pieces) || []; const gears = ps.filter(p => p.m === 'gear'), pul = ps.filter(p => p.m === 'pulley'), motor = ps.find(p => p.m === 'motor'), prop = ps.find(p => p.m === 'propeller');
  let w0 = 0, src = null, srcName = '';
  if (motor && ctx && ctx.motorOn) { w0 = 2 + ctx.volts * 0.8; src = motor; srcName = 'มอเตอร์'; } else if (prop) { w0 = 1.4; src = prop; srcName = 'ใบพัดกังหัน (แรงลม)'; }
  const speeds = {}, dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]);
  if (src) { speeds[src.id] = w0; for (const p of ps) if (p.m === 'shaft') speeds[p.id] = w0; if (prop && motor && ctx && ctx.motorOn) speeds[prop.id] = w0; }
  const g = src ? [...gears].sort((a, b) => dist(a, src) - dist(b, src)) : gears, pl = src ? [...pul].sort((a, b) => dist(a, src) - dist(b, src)) : pul;
  const nd = (g[0] && g[0].n) || 12; g.forEach((p, i) => { speeds[p.id] = src ? w0 * nd / (p.n || 12) * (i % 2 ? -1 : 1) : 0; });
  const rd = (pl[0] && pl[0].s) || 1; pl.forEach(p => { speeds[p.id] = src ? w0 * rd / (p.s || 1) : 0; });
  return { speeds, src, srcName, w0, gears: g, pulleys: pl, rpm: (w) => Math.round(Math.abs(w) * 60 / (2 * Math.PI)) };
}

/* ---------- สายไฟ สายพาน ป้ายคำอธิษฐาน ---------- */
const topOf = (p) => { const def = MATERIALS[p.m]; return new THREE.Vector3(p.p[0], p.p[1] + Math.min(0.1, def.h * 0.6) * (p.s || 1), p.p[2]); };
function hull(pts) { pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
export function makeExtras(d, ctx) {
  const g = new THREE.Group(); g.userData.extras = true; const ps = (d && d.pieces) || [];
  // สายไฟ: แหล่งจ่าย → สวิตช์ → เซ็นเซอร์ → ตัวต้านทาน → โหลด → กลับแหล่งจ่าย
  const order = ['battery', 'solar', 'switch', 'ldr', 'water_sensor', 'tilt_sensor', 'resistor', 'led', 'motor'];
  const el = ps.filter(p => order.includes(p.m)).sort((a, b) => order.indexOf(a.m) - order.indexOf(b.m));
  if (el.length >= 2 && (d.circuit || {}).wires !== false) {
    const seg = (a, b, color) => { const A = topOf(a), B = topOf(b), mid = A.clone().lerp(B, 0.5); mid.y = Math.max(A.y, B.y) + 0.1 + A.distanceTo(B) * 0.12;
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, mid, B), 14, 0.009, 5, false), mat(color, { smooth: true, rough: 0.5 }))); };
    for (let i = 0; i < el.length - 1; i++) seg(el[i], el[i + 1], '#e63946'); seg(el[el.length - 1], el[0], '#222222');
  }
  // สายพานระหว่างรอกที่อยู่ติดกัน
  const pl = ps.filter(p => p.m === 'pulley');
  for (let i = 0; i < pl.length - 1; i++) { const a = pl[i], b = pl[i + 1], pts = [];
    for (const q of [a, b]) { const r = 0.118 * (q.s || 1); for (let k = 0; k < 20; k++) { const t = k / 20 * Math.PI * 2; pts.push([q.p[0] + Math.cos(t) * r, q.p[2] + Math.sin(t) * r]); } }
    const y = ((a.p[1] + 0.115 * (a.s || 1)) + (b.p[1] + 0.115 * (b.s || 1))) / 2, h = hull(pts).map(([x, z]) => new THREE.Vector3(x, y, z));
    if (h.length > 3) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(h, true, 'centripetal'), 64, 0.012, 5, true), mat('#2b2b2b', { smooth: true }))); }
  // ป้ายคำอธิษฐาน (ผู้ร่วมงานทุกคนมองเห็น)
  if (d && d.wish) { const b = BASES[d.base] || BASES.round, w = new THREE.Group(); w.position.set(0, BASE_TOP, -0.62 * b.rz);
    const st = M(geo('wstick', () => new THREE.CylinderGeometry(0.018, 0.022, 0.9, 6)), '#a07a4a'); st.position.y = 0.45; w.add(st);
    const s = wishSprite(d.wish); s.position.y = 1.12; w.add(s); g.add(w); g.userData.wish = s; }
  return g;
}
const segWords = (t) => { try { if (Intl.Segmenter) return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(t)].map(s => s.segment); } catch (e) {} return Array.from(t); };
const wishCache = new Map();
export function wishSprite(text) {
  text = String(text || '').slice(0, 60); let tex = wishCache.get(text);
  if (!tex) { const c = document.createElement('canvas'); c.width = 640; c.height = 240; const x = c.getContext('2d');
    x.fillStyle = '#3f8f3a'; x.beginPath(); x.moveTo(20, 120); x.quadraticCurveTo(80, 10, 320, 12); x.quadraticCurveTo(560, 10, 620, 120); x.quadraticCurveTo(560, 230, 320, 228); x.quadraticCurveTo(80, 230, 20, 120); x.fill();
    x.strokeStyle = '#2c6a26'; x.lineWidth = 3; x.beginPath(); x.moveTo(30, 120); x.lineTo(610, 120); x.stroke();
    x.fillStyle = '#fff8e1'; x.beginPath(); if (x.roundRect) x.roundRect(70, 36, 500, 168, 22); else x.rect(70, 36, 500, 168); x.fill(); x.strokeStyle = '#d4a017'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#5a3a14'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 46, lines; const fit = () => { x.font = `600 ${fs}px Mitr, Sarabun, sans-serif`; lines = ['']; for (const w of segWords(text)) { const tr = lines[lines.length - 1] + w; if (x.measureText(tr).width > 460 && lines[lines.length - 1]) lines.push(w.trimStart()); else lines[lines.length - 1] = tr; } };
    fit(); while ((lines.length > 3 || lines.some(l => x.measureText(l).width > 470)) && fs > 18) { fs -= 3; fit(); }
    const lh = fs * 1.2, y0 = 120 - (Math.min(3, lines.length) - 1) * lh / 2; lines.slice(0, 3).forEach((l, i) => x.fillText(l, 320, y0 + i * lh));
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; wishCache.set(text, tex); if (wishCache.size > 150) wishCache.delete(wishCache.keys().next().value); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(1.6, 0.6, 1); s.renderOrder = 5; s.userData.wishSprite = true; return s;
}

/* ---------- สร้างชิ้นส่วน / กระทงทั้งใบจากข้อมูล ---------- */
export function buildPiece(p, d, ctx) {
  const def = MATERIALS[p.m]; if (!def) return null;
  const color = def.colorable && p.c && HEX.test(p.c) ? p.c : def.color;
  const o = def.build(color, p, d, ctx);
  o.rotation.order = 'YXZ';
  o.position.set(p.p[0], p.p[1], p.p[2]);
  o.rotation.set(p.r[0] || 0, p.r[1] || 0, p.r[2] || 0);
  o.scale.setScalar(p.s || 1);
  o.userData.pieceId = p.id; o.userData.small = SMALL_CATS.has(def.cat) && (p.s || 1) < 1.3;
  return o;
}
/** เก็บรายการแอนิเมชัน: เปลวเทียน ประกาย การหมุนของกลไก ไฟเตือนกะพริบ */
export function setupAnim(root, d, ctx) {
  const anim = { flames: [], twinkles: [], spins: [], blinks: [] }; const sp = mechInfo(d, ctx).speeds;
  for (const ch of root.children) { const pid = ch.userData.pieceId;
    ch.traverse(o => { if (o.userData.flame) anim.flames.push(o); if (o.userData.twinkle !== undefined || o.userData.glow) anim.twinkles.push(o); if (o.userData.blink) anim.blinks.push(o);
      if (o.userData.spinAxis && pid) anim.spins.push({ o, axis: o.userData.spinAxis, w: sp[pid] || 0 }); }); }
  root.userData.anim = anim; return anim;
}
export function buildKrathong(design, env = {}) {
  const root = new THREE.Group(); const d = design || {}; const ctx = evalCircuit(d, env);
  root.add(makeBase(d.base, d.baseColor && HEX.test(d.baseColor) ? d.baseColor : '#5e9c4c'));
  const small = [], map = new Map();
  for (const p of d.pieces || []) { const o = buildPiece(p, d, ctx); if (!o) continue; root.add(o); map.set(p.id, o); if (o.userData.small) small.push(o); }
  const ex = makeExtras(d, ctx); root.add(ex);
  setupAnim(root, d, ctx); Object.assign(root.userData, { small, map, design: d, ctx, wish: ex.userData.wish || null });
  return root;
}
/** แอนิเมชันเปลวเทียน ประกาย กลไกหมุน ไฟกะพริบ */
export function animateKrathong(root, t) {
  const a = root.userData.anim; if (!a) return;
  for (const f of a.flames) { const k = 1 + Math.sin(t * 18 + f.id) * 0.08 + Math.sin(t * 7.3 + f.id) * 0.06; f.scale.set(1 / k, k, 1 / k); }
  for (const s of a.twinkles) { if (s.userData.twinkle !== undefined) { const k = 0.6 + 0.4 * Math.sin(t * 3 + s.userData.twinkle * 1.7); s.material.opacity = k; } }
  for (const s of a.spins) s.o.rotation[s.axis] = t * s.w;
  const on = Math.sin(t * 9) > 0; for (const b of a.blinks) b.visible = on;
}
/** ลดรายละเอียดเมื่ออยู่ไกล (ยังคงรูปทรงหลักของกระทงตามแบบ) */
export function setLOD(root, far) { for (const o of root.userData.small || []) o.visible = !far; }

/* ---------- สถิติจำลองเพื่อการเรียนรู้ (จุดศูนย์ถ่วง = Σ(น้ำหนัก × ตำแหน่ง) ÷ Σน้ำหนัก) ---------- */
export const BASE_WEIGHT = 10;
export function computeStats(design) {
  const b = BASES[design.base] || BASES.round; let W = BASE_WEIGHT, mx = 0, mz = 0, h = BASE_TOP, fantasy = 0; const cats = {};
  for (const p of design.pieces || []) {
    const def = MATERIALS[p.m]; if (!def) continue; const w = def.w * (p.s || 1) ** 2;
    W += w; mx += w * p.p[0]; mz += w * p.p[2]; h = Math.max(h, p.p[1] + def.h * (p.s || 1));
    if (def.fantasy) fantasy++; cats[def.cat] = (cats[def.cat] || 0) + 1;
  }
  const cx = mx / W, cz = mz / W, off = Math.hypot(cx / b.rx, cz / b.rz);
  return { count: (design.pieces || []).length, weight: W, mx, mz, cx, cz, offset: off, height: h, fantasy, cats,
    balance: off < 0.12 ? 'สมดุลดี' : off < 0.3 ? 'เอียงเล็กน้อย' : 'อาจเอียงมาก', tilt: Math.min(0.25, off * 0.6), tiltDir: Math.atan2(cx, cz) };
}

/* ---------- ตรวจสอบข้อมูลชิ้นงานก่อนบันทึก ---------- */
const num = (v, a, b, d = 0) => { v = Number(v); if (!isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); };
const SK_ID = /^[\w-]{1,24}$/;
export function sanitizeSketch(s) {
  if (!s || !SKETCH_KINDS[s.k] || !Array.isArray(s.pr)) return null; const pr = s.pr.slice(0, 64).map(v => Math.round(num(v, 0, 1, 0.5) * 100) / 100); if (pr.length < 12) return null;
  return { id: SK_ID.test(String(s.id)) ? String(s.id) : uid('s').slice(0, 24), k: s.k, pr, a: Math.round(num(s.a, 0.2, 5, 1) * 100) / 100, c2: HEX.test(s.c2 || '') ? s.c2 : '#ffd166', name: String(s.name || 'ชิ้นงานที่วาด').slice(0, 24) };
}
export const cleanWish = (t) => String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
export function sanitizeDesign(d) {
  d = d || {}; const ids = new Set();
  const sketches = (Array.isArray(d.sketches) ? d.sketches : []).map(sanitizeSketch).filter(Boolean).slice(0, 8), skIds = new Set(sketches.map(s => s.id));
  const pieces = (Array.isArray(d.pieces) ? d.pieces : []).filter(p => p && MATERIALS[p.m] && (p.m !== 'sketch' || skIds.has(p.sk))).slice(0, MAX_PIECES).map(p => {
    const def = MATERIALS[p.m]; let id = String(p.id || uid('p')).slice(0, 40); if (ids.has(id)) id = uid('p'); ids.add(id);
    const pp = Array.isArray(p.p) ? p.p : [0, BASE_TOP, 0]; const r = Array.isArray(p.r) ? p.r : [0, 0, 0];
    const o = { id, m: p.m, p: [num(pp[0], -2, 2), num(pp[1], 0, 3, BASE_TOP), num(pp[2], -2, 2)], r: [num(r[0], -3.2, 3.2), num(r[1], -7, 7), num(r[2], -3.2, 3.2)],
      s: num(p.s, def.smin, def.smax, 1), c: def.colorable && HEX.test(p.c || '') ? p.c : null };
    if (p.m === 'gear') o.n = Math.round(num(p.n, 6, 40, 12)); if (p.m === 'sketch') o.sk = p.sk; return o;
  });
  const used = new Set(pieces.map(p => p.sk).filter(Boolean)), c = d.circuit || {};
  return { schema: SCHEMA, id: String(d.id || uid('k')).slice(0, 40), name: String(d.name || 'กระทงของฉัน').slice(0, 40),
    base: BASES[d.base] ? d.base : 'round', baseColor: HEX.test(d.baseColor || '') ? d.baseColor : '#5e9c4c', pieces, sketches: sketches.filter(s => used.has(s.id)),
    circuit: { on: c.on !== false, wires: c.wires !== false }, wish: cleanWish(d.wish),
    createdAt: d.createdAt || Date.now(), updatedAt: d.updatedAt || Date.now(), version: Math.max(1, parseInt(d.version) || 1),
    owner: d.owner || '', thumb: typeof d.thumb === 'string' && d.thumb.startsWith('data:image/') && d.thumb.length < 60000 ? d.thumb : '' };
}
export const cloneDesign = (d) => JSON.parse(JSON.stringify(d));
export function newDesign(base = 'round', owner = '') { return sanitizeDesign({ id: uid('k'), name: 'กระทงของฉัน', base, owner, pieces: [] }); }

/* ---------- ภาพแรงบันดาลใจ (ดูเป็นภาพเท่านั้น ไม่มีแบบสำเร็จรูปให้ใช้) ---------- */
export function ring(m, n, r, y, tilt = 0, s = 1, c = null, start = 0, rx = 1, rz = 1) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = start + (i / n) * Math.PI * 2; out.push({ id: uid('p'), m, p: [Math.sin(a) * r * rx, y, Math.cos(a) * r * rz], r: [tilt, a, 0], s, c }); }
  return out;
}
const one = (m, x, y, z, s = 1, c = null, ry = 0, rx = 0, extra = {}) => ({ id: uid('p'), m, p: [x, y, z], r: [rx, ry, 0], s, c, ...extra });
const T = BASE_TOP;
const scallop = (n = 48, k = 8) => Array.from({ length: n }, (_, i) => Math.round((0.8 + 0.2 * Math.abs(Math.cos(i / n * Math.PI * k))) * 100) / 100);
export const INSPIRATIONS = [
  { id: 'objai', name: 'กลีบบัวโอบรอบ', idea: 'เรียงกลีบบัวใบตอง 12 กลีบ ห่างกัน 360° ÷ 12 = 30° → สมมาตรแบบหมุน มีเทียนเป็นจุดเด่นตรงกลาง', make: () => ({ base: 'round', pieces: [...ring('leaf_lotus', 12, 0.8, T, 0.35), ...ring('lotus', 6, 0.45, T, 0, 0.9, '#ff8fb1'), one('lotus', 0, T, 0, 1.4, '#ffc2d1'), one('candle', 0, T + 0.12, 0, 1)] }) },
  { id: 'spire', name: 'ยอดพุ่มกุหลาบ', idea: 'ยอดพุ่มสูงวางตรงกลางฐาน (จุดศูนย์ถ่วงอยู่กลาง) ล้อมด้วยกุหลาบ 8 ดอก (45°) และกลีบกุหลาบใบตองรอบนอก', make: () => ({ base: 'round', pieces: [...ring('leaf_rose', 10, 0.82, T, 0.3), ...ring('rose', 8, 0.5, T, 0, 0.9, '#e63946', 0.39), one('spire', 0, T, 0, 0.9, '#ffffff')] }) },
  { id: 'gearwind', name: 'กังหันเฟืองทด', idea: 'ใบพัดกังหันรับลม → เฟือง 12 ฟันขับเฟือง 24 ฟัน · อัตราทด 24 ÷ 12 = 2 : 1 เฟืองตามหมุนช้าลงครึ่งหนึ่ง', make: () => ({ base: 'round', pieces: [...ring('leaf_phanom', 10, 0.82, T, 0.3), one('propeller', 0, T, -0.25, 1.1, '#f1faee'), one('gear', -0.22, T, 0.18, 1, '#f4a261', 0, 0, { n: 12 }), one('gear', 0.212, T, 0.18, 1, '#e9c46a', 0, 0, { n: 24 }), ...ring('marigold', 4, 0.55, T, 0, 0.8, '#ff9f1c', Math.PI / 4)] }) },
  { id: 'nightlight', name: 'ไฟกลางคืนอัตโนมัติ', idea: 'วงจร: ถ่าน 3 V → สวิตช์ → เซ็นเซอร์แสง (LDR) → ตัวต้านทาน → LED · พอมืด ไฟติดเอง', make: () => ({ base: 'round', circuit: { on: true, wires: true }, pieces: [...ring('leaf_lotus', 10, 0.82, T, 0.3), one('battery', 0, T, 0, 1), one('switch', 0.28, T, 0.12, 1), one('ldr', 0.22, T, -0.22, 1.2), one('resistor', -0.22, T, -0.2, 1.2), ...ring('led', 3, 0.42, T, 0, 1.3, '#ffe66d', Math.PI / 3), ...ring('lotus', 3, 0.55, T, 0, 0.7, '#ff8fb1')] }) },
  { id: 'pulley', name: 'รอกสายพานหมุนช้า', idea: 'มอเตอร์หมุนรอกเล็ก ส่งแรงผ่านสายพานไปรอกใหญ่ (ขนาด 2 เท่า) → หมุนช้าลง 2 เท่า แต่มีแรงบิดมากขึ้น', make: () => ({ base: 'oval', circuit: { on: true, wires: true }, pieces: [...ring('leaf_nail', 12, 0.84, T, 0.3, 1, null, 0, 1.25, 0.85), one('battery', -0.15, T, -0.25, 1), one('switch', 0.3, T, -0.25, 1), one('motor', -0.45, T, 0.12, 1), one('pulley', -0.3, T, 0.15, 0.8, '#8d99ae'), one('pulley', 0.3, T, 0.15, 1.6, '#e9c46a')] }) },
  { id: 'lace', name: 'ใบตองฉลุกับมาลัย', idea: 'ใบตองฉลุลาย 8 ใบ สลับเบญจมาศ วางพวงมาลัยมะลิเป็นวงกลางเพื่อสร้างจังหวะซ้ำและเอกภาพ', make: () => ({ base: 'round', pieces: [...ring('leaf_lace', 8, 0.8, T, 0.3), ...ring('chrys', 8, 0.62, T, 0, 0.8, '#ffe14d', Math.PI / 8), one('garland', 0, T, 0, 1, '#e63946'), one('lotusbud', 0, T, 0, 1.2, '#ff7aa2')] }) },
  { id: 'sketchflower', name: 'ดาวเรืองจากภาพร่าง', idea: 'วาดเส้นรอบรูปหยัก ๆ ที่โต๊ะประดิษฐ์ (✏️ วาดชิ้นส่วน) ระบบสร้างดอกไม้ตามภาพวาด แล้วเลือกสีเองได้', make: () => ({ base: 'round', sketches: [{ id: 's_mari', k: 'flower', pr: scallop(), a: 1, c2: '#ffd166', name: 'ดาวเรืองที่วาด' }], pieces: [...ring('leaf_fan', 8, 0.8, T, 0.3), ...ring('sketch', 6, 0.48, T, 0, 1, '#ff9f1c').map(p => ({ ...p, sk: 's_mari' })), one('sketch', 0, T, 0, 1.4, '#ff7b00', 0, 0, { sk: 's_mari' })] }) },
  { id: 'rimlay', name: 'ริมเลอสมมาตร', idea: 'ฐานทรงเรือ จัดวางไม่เหมือนกันสองข้าง (อสมมาตร) แต่น้ำหนักซ้าย-ขวาถ่วงกันพอดี จุดศูนย์ถ่วงยังอยู่กลาง', make: () => ({ base: 'boat', pieces: [...ring('leaf_sheet', 10, 0.86, T, 0.15, 0.7, null, 0, 1.35, 0.6), one('wave', -0.5, T, 0.12, 1), one('wave', 0.5, T, -0.12, 1, null, 3.14), one('crab', 0.35, T, 0.05, 1.1), one('mudskipper', -0.3, T, -0.05, 1, null, 1.4), one('seablite', 0, T, 0.18, 1), one('saltflower', 0.05, T, -0.18, 1), one('candle', 0, T, 0, 0.9)] }) },
  { id: 'hope', name: 'แสงแห่งความหวัง', idea: 'ใช้สีน้อยสี (ชมพู-เหลือง) ให้กลมกลืน เรียงบานไม่รู้โรย 8 ดอก ดาวเรือง 4 ดอก ดวงแสงเป็นจุดเด่นตรงกลาง', make: () => ({ base: 'round', pieces: [...ring('leaf_lotus', 8, 0.8, T, 0.3), ...ring('globe', 8, 0.62, T, 0, 1.1, '#d0006f', 0.39), ...ring('marigold', 4, 0.32, T, 0, 0.8, '#ffd60a'), one('glow_orb', 0, T + 0.05, 0, 1.3, '#ffe66d'), one('sparkles', 0, T + 0.1, 0, 1.4, '#fff3b0')] }) }
];
export function inspirationDesign(id, owner = '') {
  const p = INSPIRATIONS.find(x => x.id === id) || INSPIRATIONS[0]; const d = p.make();
  return sanitizeDesign({ id: uid('k'), name: p.name, owner, base: d.base, pieces: d.pieces, sketches: d.sketches, circuit: d.circuit });
}
// ใช้เฉพาะโหมดสำรอง (อุปกรณ์ที่ไม่รองรับ 3 มิติ จึงประดิษฐ์เองไม่ได้)
export const PRESETS = INSPIRATIONS, presetDesign = inspirationDesign;
