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
export const CATS = [['base', 'ฐานกระทง', '🟢'], ['leaf', 'ใบตอง', '🍃'], ['flower', 'ดอกไม้', '🌸'], ['center', 'องค์ประกอบกลาง', '🕯️'], ['deco', 'ของตกแต่ง', '🐚'], ['light', 'แสงเสมือน', '✨']];

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
      [[0, 0.15, 0], [0.12, 0.3, 0.05], [-0.1, 0.25, -0.06], [0.05, 0.4, -0.1], [-0.08, 0.38, 0.08], [0.14, 0.12, -0.08]].forEach((p, i) => { const s = glowSprite(c, 0.12); s.position.set(...p); s.userData.twinkle = i; g.add(s); }); return g; } }
};
export const SMALL_CATS = new Set(['flower', 'deco', 'light']);

/* ---------- สร้างชิ้นส่วน / กระทงทั้งใบจากข้อมูล ---------- */
export function buildPiece(p) {
  const def = MATERIALS[p.m]; if (!def) return null;
  const color = def.colorable && p.c && HEX.test(p.c) ? p.c : def.color;
  const o = def.build(color);
  o.rotation.order = 'YXZ';
  o.position.set(p.p[0], p.p[1], p.p[2]);
  o.rotation.set(p.r[0] || 0, p.r[1] || 0, p.r[2] || 0);
  o.scale.setScalar(p.s || 1);
  o.userData.pieceId = p.id; o.userData.small = SMALL_CATS.has(def.cat) && (p.s || 1) < 1.3;
  return o;
}
export function buildKrathong(design) {
  const root = new THREE.Group(); const d = design || {};
  root.add(makeBase(d.base, d.baseColor && HEX.test(d.baseColor) ? d.baseColor : '#5e9c4c'));
  const anim = { flames: [], twinkles: [] }, small = [], map = new Map();
  for (const p of d.pieces || []) {
    const o = buildPiece(p); if (!o) continue; root.add(o); map.set(p.id, o); if (o.userData.small) small.push(o);
    o.traverse(ch => { if (ch.userData.flame) anim.flames.push(ch); if (ch.userData.twinkle !== undefined || ch.userData.glow) anim.twinkles.push(ch); });
  }
  root.userData = { anim, small, map, design: d };
  return root;
}
/** แอนิเมชันเปลวเทียน/ประกาย */
export function animateKrathong(root, t) {
  const a = root.userData.anim; if (!a) return;
  for (const f of a.flames) { const k = 1 + Math.sin(t * 18 + f.id) * 0.08 + Math.sin(t * 7.3 + f.id) * 0.06; f.scale.set(1 / k, k, 1 / k); }
  for (const s of a.twinkles) { if (s.userData.twinkle !== undefined) { const k = 0.6 + 0.4 * Math.sin(t * 3 + s.userData.twinkle * 1.7); s.material.opacity = k; } }
}
/** ลดรายละเอียดเมื่ออยู่ไกล (ยังคงรูปทรงหลักของกระทงตามแบบ) */
export function setLOD(root, far) { for (const o of root.userData.small || []) o.visible = !far; }

/* ---------- สถิติจำลองเพื่อการเรียนรู้ ---------- */
export function computeStats(design) {
  const b = BASES[design.base] || BASES.round; let W = 10, cx = 0, cz = 0, h = BASE_TOP, fantasy = 0; const cats = {};
  for (const p of design.pieces || []) {
    const def = MATERIALS[p.m]; if (!def) continue; const w = def.w * (p.s || 1) ** 2;
    W += w; cx += w * p.p[0]; cz += w * p.p[2]; h = Math.max(h, p.p[1] + def.h * (p.s || 1));
    if (def.fantasy) fantasy++; cats[def.cat] = (cats[def.cat] || 0) + 1;
  }
  cx /= W; cz /= W; const off = Math.hypot(cx / b.rx, cz / b.rz);
  return { count: (design.pieces || []).length, weight: W, cx, cz, offset: off, height: h, fantasy, cats,
    balance: off < 0.12 ? 'สมดุลดี' : off < 0.3 ? 'เอียงเล็กน้อย' : 'อาจเอียงมาก', tilt: Math.min(0.25, off * 0.6), tiltDir: Math.atan2(cx, cz) };
}

/* ---------- ตรวจสอบข้อมูลชิ้นงานก่อนบันทึก ---------- */
const num = (v, a, b, d = 0) => { v = Number(v); if (!isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); };
export function sanitizeDesign(d) {
  d = d || {}; const ids = new Set();
  const pieces = (Array.isArray(d.pieces) ? d.pieces : []).filter(p => p && MATERIALS[p.m]).slice(0, MAX_PIECES).map(p => {
    const def = MATERIALS[p.m]; let id = String(p.id || uid('p')).slice(0, 40); if (ids.has(id)) id = uid('p'); ids.add(id);
    const pp = Array.isArray(p.p) ? p.p : [0, BASE_TOP, 0]; const r = Array.isArray(p.r) ? p.r : [0, 0, 0];
    return { id, m: p.m, p: [num(pp[0], -2, 2), num(pp[1], 0, 3, BASE_TOP), num(pp[2], -2, 2)], r: [num(r[0], -3.2, 3.2), num(r[1], -7, 7), num(r[2], -3.2, 3.2)],
      s: num(p.s, def.smin, def.smax, 1), c: def.colorable && HEX.test(p.c || '') ? p.c : null };
  });
  return { schema: SCHEMA, id: String(d.id || uid('k')).slice(0, 40), name: String(d.name || 'กระทงของฉัน').slice(0, 40),
    base: BASES[d.base] ? d.base : 'round', baseColor: HEX.test(d.baseColor || '') ? d.baseColor : '#5e9c4c', pieces,
    createdAt: d.createdAt || Date.now(), updatedAt: d.updatedAt || Date.now(), version: Math.max(1, parseInt(d.version) || 1),
    owner: d.owner || '', thumb: typeof d.thumb === 'string' && d.thumb.startsWith('data:image/') && d.thumb.length < 60000 ? d.thumb : '' };
}
export const cloneDesign = (d) => JSON.parse(JSON.stringify(d));
export function newDesign(base = 'round', owner = '') { return sanitizeDesign({ id: uid('k'), name: 'กระทงของฉัน', base, owner, pieces: [] }); }

/* ---------- แบบสำเร็จรูป 5 แบบ (สร้างจากชิ้นส่วนจริง แก้ไขต่อได้) ---------- */
export function ring(m, n, r, y, tilt = 0, s = 1, c = null, start = 0, rx = 1, rz = 1) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = start + (i / n) * Math.PI * 2; out.push({ id: uid('p'), m, p: [Math.sin(a) * r * rx, y, Math.cos(a) * r * rz], r: [tilt, a, 0], s, c }); }
  return out;
}
const one = (m, x, y, z, s = 1, c = null, ry = 0, rx = 0) => ({ id: uid('p'), m, p: [x, y, z], r: [rx, ry, 0], s, c });
const T = BASE_TOP;
export const PRESETS = [
  { id: 'objai', name: 'กระทงโอบใจ', desc: 'กลีบบัวโอบรอบ อบอุ่นเหมือนอ้อมกอด', make: () => ({ base: 'round', pieces: [...ring('leaf_lotus', 12, 0.8, T, 0.35), ...ring('lotus', 6, 0.45, T, 0, 0.9, '#ff8fb1'), one('lotus', 0, T, 0, 1.4, '#ffc2d1'), one('candle', 0, T + 0.12, 0, 1)] }) },
  { id: 'reborn', name: 'กระทงเริ่มใหม่', desc: 'ดาวเรืองสีสด เริ่มต้นวันใหม่อย่างสดใส', make: () => ({ base: 'oval', pieces: [...ring('leaf_tri', 10, 0.82, T, 0.25, 1, null, 0, 1.25, 0.85), ...ring('marigold', 6, 0.42, T, 0, 0.9, '#ff9f1c', 0.3, 1.25, 0.85), one('candle', 0, T, 0), one('leafsmall', 0.25, T, 0.1, 1), one('leafsmall', -0.25, T, -0.1, 1, null, 3)] }) },
  { id: 'thanks', name: 'กระทงขอบคุณ', desc: 'กลีบโค้งนุ่มนวลกับกล้วยไม้ ส่งคำขอบคุณ', make: () => ({ base: 'round', pieces: [...ring('leaf_curve', 16, 0.82, T, 0.2), ...ring('orchid', 8, 0.5, T, 0, 1, '#b5179e', 0.4), one('lotus', 0, T, 0, 1.3, '#fff0f3'), one('tag', 0.18, T, 0.18, 1, '#fff1d0', 0.6)] }) },
  { id: 'rimlay', name: 'กระทงริมเล', desc: 'ฐานทรงเรือ ลายคลื่น และเพื่อนจากป่าชายเลน', make: () => ({ base: 'boat', pieces: [...ring('leaf_sheet', 10, 0.86, T, 0.15, 0.7, null, 0, 1.35, 0.6), one('wave', -0.5, T, 0.12, 1), one('wave', 0.5, T, -0.12, 1, null, 3.14), one('crab', 0.35, T, 0.05, 1.1), one('mudskipper', -0.3, T, -0.05, 1, null, 1.4), one('seablite', 0, T, 0.18, 1), one('saltflower', 0.05, T, -0.18, 1), one('candle', 0, T, 0, 0.9)] }) },
  { id: 'hope', name: 'กระทงความหวัง', desc: 'ดวงแสงและประกาย ส่งความหวังไปกับสายน้ำ', make: () => ({ base: 'round', pieces: [...ring('leaf_lotus', 8, 0.8, T, 0.3), ...ring('globe', 8, 0.62, T, 0, 1.1, '#d0006f', 0.39), ...ring('marigold', 4, 0.32, T, 0, 0.8, '#ffd60a'), one('glow_orb', 0, T + 0.05, 0, 1.3, '#ffe66d'), one('sparkles', 0, T + 0.1, 0, 1.4, '#fff3b0')] }) }
];
export function presetDesign(id, owner = '') {
  const p = PRESETS.find(x => x.id === id) || PRESETS[0]; const d = p.make();
  return sanitizeDesign({ id: uid('k'), name: p.name, owner, base: d.base, pieces: d.pieces });
}
