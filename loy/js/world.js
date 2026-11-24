/* ============================================================
   โลกงานวัดยามค่ำ 3D Low-poly: แผนที่ ตารางเดิน A* ครู NPC
   แม่น้ำ กระทงลอยต่อเนื่อง ฉากชวนครูเดินไปลอยกระทง
   ============================================================ */
import * as THREE from 'three';
import { buildAvatar, animateAvatar, makeLabel } from './avatar.js';
import { buildKrathong, animateKrathong, setLOD, WORLD_SCALE, mat, glowSprite, BASES, computeStats } from './krathong.js';
import { TEACHERS, ZONES, MANGROVE_SPOTS } from './data.js';

const W = 64, D = 48, WATER_Z = 37, WATER_Y = -0.15;
export const PIER_POINT = { x: 30.5, z: 39.4 };
export const RELEASE = { x: 30.5, z: 41.4 };
const RIVER_SPEED = 0.07;

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, n) => arr[n % arr.length];

/* ---------- ป้ายข้อความ ---------- */
function makeSign(text, w = 2.4, h = 0.6, bg = '#5a2a0a', fg = '#ffe8a3', sub = '') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(6, 6, c.width - 12, c.height - 12);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = Math.min(64, c.height * (sub ? 0.4 : 0.55)); x.font = `bold ${fs}px Mitr, Sarabun, sans-serif`;
  x.fillText(text, 256, sub ? c.height * 0.38 : c.height / 2, 480);
  if (sub) { x.font = `${fs * 0.6}px Mitr, Sarabun, sans-serif`; x.fillText(sub, 256, c.height * 0.74, 480); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // ป้ายสองหน้า: อ่านได้ถูกต้องทั้งด้านหน้าและด้านหลัง (ไม่กลับด้าน)
  const g = new THREE.Group(), geoP = new THREE.PlaneGeometry(w, h), m = new THREE.MeshBasicMaterial({ map: t });
  const f = new THREE.Mesh(geoP, m); f.position.z = 0.006; const b = new THREE.Mesh(geoP, m); b.rotation.y = Math.PI; b.position.z = -0.006; g.add(f, b); return g;
}
function prism(w, h, L, color) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2);
  return new THREE.Mesh(g, mat(color));
}

export class World {
  constructor(canvas, cb = {}, opts = {}) {
    this.cb = cb; this.quality = opts.quality || 'medium'; this.reflections = opts.reflections !== false; this.reduceMotion = !!opts.reduceMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'low' ? 1 : this.quality === 'high' ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#0d0b2b'); this.scene.fog = new THREE.Fog('#120e33', 28, 70);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300); this.zoom = 1; this.camLook = new THREE.Vector3(5, 0, 6);
    this.walk = new Uint8Array(W * D); this.t = 0; this.keys = new Set(); this.joy = { x: 0, y: 0 }; this.inputEnabled = true; this.paused = false;
    this.river = new Map(); this.riverRecs = []; this.ripples = []; this.fx = []; this.trash = []; this.spots = [];
    this.buildGrid(); this.buildEnvironment(); this.buildTeachers();
    this.player = this.spawnAvatar(opts.look, 5, 6); this.player.userData.heading = Math.PI;
    this.path = []; this.onArrive = null; this.escort = null; this.placing = null; this.focus = null; this.followId = null;
    this.raycaster = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    this.bindInput(canvas); this.resize();
  }

  /* ---------- ตารางเดิน ---------- */
  setRect(x0, z0, x1, z1, v) { for (let z = Math.max(0, z0); z < Math.min(D, z1); z++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) this.walk[z * W + x] = v; }
  buildGrid() {
    this.setRect(0, 0, W, WATER_Z, 1);
    this.setRect(0, 0, W, 1, 0); this.setRect(0, 0, 1, D, 0); this.setRect(W - 1, 0, W, D, 0);
    this.obstacles = [
      ['temple', 25, 1, 37, 9], ['dress', 9, 3, 14, 7], ['workshop', 45, 2, 54, 8], ['pond', 56, 2, 62, 8],
      ['stage', 27, 17, 35, 21], ['icecream', 10, 17, 14, 20], ['stall1', 44, 17, 48, 20], ['stall2', 50, 17, 54, 20],
      ['rest', 6, 30, 13, 35], ['memsign', 20, 35, 21, 36], ['gateL', 2, 1, 3, 3], ['gateR', 7, 1, 8, 3], ['salt', 15, 2, 17, 4]
    ];
    this.booths = TEACHERS.map((t, i) => { const row = i < 12 ? 0 : 1, k = i % 12, x0 = 6 + k * 4.6;
      return row === 0 ? { t, x0, rect: [Math.floor(x0), 11, Math.floor(x0) + 3, 13], stand: { x: x0 + 1.5, z: 13.8 }, face: 0 } : { t, x0, rect: [Math.floor(x0), 26, Math.floor(x0) + 3, 28], stand: { x: x0 + 1.5, z: 25.2 }, face: Math.PI }; });
    for (const o of this.obstacles) this.setRect(o[1], o[2], o[3], o[4], 0);
    for (const b of this.booths) this.setRect(...b.rect, 0);
    // ป่าชายเลน: ต้นไม้เป็นสิ่งกีดขวาง ยกเว้นสะพานไม้
    this.mangroves = [];
    for (let z = 29; z < 37; z++) for (let x = 45; x < 63; x++) { if (z === 33) continue; if ((hash(x + ':' + z) % 100) < 42) { this.walk[z * W + x] = 0; this.mangroves.push([x + 0.5, z + 0.5]); } }
    this.setRect(44, 33, 63, 34, 1);                 // สะพานป่าชายเลน
    this.setRect(55, 34, 57, 37, 1); this.setRect(55, 37, 57, 43, 1); // สะพานยื่นลงน้ำ
    this.setRect(28, 37, 33, 41, 1);                 // ท่าน้ำ
  }
  walkable(x, z) { const cx = Math.floor(x), cz = Math.floor(z); return cx >= 0 && cz >= 0 && cx < W && cz < D && this.walk[cz * W + cx] === 1; }
  nearestWalkable(cx, cz) {
    if (this.walkable(cx + 0.5, cz + 0.5)) return [cx, cz];
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; if (this.walkable(cx + dx + 0.5, cz + dz + 0.5)) return [cx + dx, cz + dz]; }
    return null;
  }
  /** A* 8 ทิศ ไม่ตัดมุมสิ่งกีดขวาง + ทำให้เส้นทางเรียบด้วย line-of-sight */
  findPath(sx, sz, tx, tz) {
    const s = this.nearestWalkable(Math.floor(sx), Math.floor(sz)), e = this.nearestWalkable(Math.floor(tx), Math.floor(tz)); if (!s || !e) return [];
    const N = W * D, gS = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const si = s[1] * W + s[0], ei = e[1] * W + e[0]; const hh = (i) => { const dx = Math.abs(i % W - e[0]), dz = Math.abs(((i / W) | 0) - e[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gS[si] = 0; f[si] = hh(si); const open = [si];
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop(); if (cur === ei) break; if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue; const ni = nz * W + nx;
        if (!this.walk[ni] || closed[ni]) continue; if (dx && dz && (!this.walk[cz * W + nx] || !this.walk[nz * W + cx])) continue;
        const ng = gS[cur] + (dx && dz ? 1.414 : 1); if (ng < gS[ni]) { gS[ni] = ng; f[ni] = ng + hh(ni); from[ni] = cur; open.push(ni); }
      }
    }
    if (from[ei] === -1 && si !== ei) return [];
    const cells = []; for (let i = ei; i !== -1; i = from[i]) { cells.push(i); if (i === si) break; } cells.reverse();
    const pts = cells.map(i => ({ x: i % W + 0.5, z: ((i / W) | 0) + 0.5 }));
    if (pts.length) { pts[pts.length - 1] = this.walkable(tx, tz) ? { x: tx, z: tz } : pts[pts.length - 1]; }
    const out = []; let a = { x: sx, z: sz };
    for (let i = 0; i < pts.length; i++) { if (i === pts.length - 1 || !this.los(a, pts[i + 1])) { out.push(pts[i]); a = pts[i]; } }
    return out;
  }
  los(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.2); for (let i = 1; i <= n; i++) { const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; if (!this.walkable(x, z) || !this.walkable(x + 0.22, z) || !this.walkable(x - 0.22, z) || !this.walkable(x, z + 0.22) || !this.walkable(x, z - 0.22)) return false; } return true; }

  /* ---------- สร้างฉาก ---------- */
  add(o, x = 0, y = 0, z = 0) { o.position.set(x, y, z); this.scene.add(o); return o; }
  box(w, h, d, c, x, y, z, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); return this.add(m, x, y + h / 2, z); }
  buildEnvironment() {
    const S = this.scene, low = this.quality === 'low';
    S.add(new THREE.HemisphereLight('#8f93e0', '#4a3018', 1.7));
    const moonL = new THREE.DirectionalLight('#c9d2ff', 1.1); moonL.position.set(20, 40, -30); S.add(moonL);
    const warm = [[31, 4, 19, 40], [31, 3.5, 30, 22], [30.5, 2.5, 39, 30], [12, 3, 21.5, 18], [49.5, 3.5, 9, 22], [9.5, 3, 31, 18], [18, 3, 14, 16], [44, 3, 14, 16]];
    for (const [x, y, z, i] of (low ? warm.slice(0, 3) : warm)) { const l = new THREE.PointLight('#ffb347', i, 16, 1.6); l.position.set(x, y, z); S.add(l); }
    // ท้องฟ้า ดาว ดวงจันทร์
    const sp = []; for (let i = 0; i < (low ? 400 : 1200); i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.2; const r = 140; sp.push(Math.cos(th) * Math.sin(ph) * r + 32, Math.cos(ph) * r * 0.6 + 10, Math.sin(th) * Math.sin(ph) * r + 10); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    S.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff7d6', size: 0.6, sizeAttenuation: true, fog: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff4c2', fog: false })); moon.position.set(46, 34, -50); S.add(moon);
    const mg = glowSprite('#ffe9a8', 26); mg.material = mg.material.clone(); mg.material.fog = false; mg.position.copy(moon.position); S.add(mg);
    // พื้น
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, WATER_Z + 20), mat('#2c4a2e')); ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, (WATER_Z - 20) / 2); ground.name = 'ground'; S.add(ground);
    const sand = (x0, z0, x1, z1, c = '#a08662') => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat(c)); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); S.add(m); };
    sand(3, 9, 61, 26); sand(27, 26, 34, 37); sand(2, 3, 9, 10); sand(14, 26, 27, 37, '#8f7a58'); sand(44, 29, 64, 37, '#4a3b2a');
    // แม่น้ำ (คลื่นต่ำ ๆ)
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(130, 34, low ? 32 : 64, low ? 8 : 14), new THREE.MeshStandardMaterial({ color: '#0d3358', roughness: 0.35, metalness: 0.15, emissive: '#05173a', flatShading: true }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(W / 2, WATER_Y, WATER_Z + 17); S.add(this.water); this.waterBase = Float32Array.from(this.water.geometry.attributes.position.array);
    this.box(W + 30, 0.35, 0.6, '#3b2f22', W / 2, -0.2, WATER_Z - 0.1);
    // ทางเข้า
    this.box(0.4, 3.2, 0.4, '#8b1e3f', 2.5, 0, 2); this.box(0.4, 3.2, 0.4, '#8b1e3f', 7.5, 0, 2); this.box(5.6, 0.4, 0.5, '#d4a017', 5, 3.1, 2);
    this.add(makeSign('บางขุนเทียน ลอยใจไปกับสายน้ำ', 5, 0.75, '#6a040f', '#ffd166'), 5, 2.6, 2.3);
    // แสดงดอกเกลือ (ตกแต่ง)
    this.box(2, 0.7, 1.4, '#6f4e37', 16, 0, 3); for (let i = 0; i < 7; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + (i % 3) * 0.04), mat('#f8f9fa', { emissive: '#bde0fe', ei: 0.3 })); o.position.set(15.4 + (i % 4) * 0.4, 0.85, 2.7 + Math.floor(i / 4) * 0.5); S.add(o); }
    this.add(makeSign('ดอกเกลือ (ของตกแต่ง)', 1.8, 0.4, '#264653', '#e9f5db'), 16, 1.4, 3.75);
    // วัด (อุโบสถ)
    this.box(12, 0.5, 8, '#e9e3d5', 31, 0, 5); this.box(9, 3, 5.5, '#f4efe1', 31, 0.5, 5);
    this.box(1.4, 2.1, 0.1, '#5c3317', 31, 0.5, 7.8); for (const x of [27.5, 29.2, 32.8, 34.5]) this.box(0.8, 1.2, 0.1, '#ffcf6b', x, 1.6, 7.8, { emissive: '#ff9f1c', ei: 0.9 });
    const r1 = prism(7.4, 2.2, 10.5, '#9d0208'); r1.rotation.y = Math.PI / 2; this.add(r1, 31, 3.5, 5);
    const r2 = prism(5.2, 1.8, 8.4, '#e85d04'); r2.rotation.y = Math.PI / 2; this.add(r2, 31, 4.5, 5);
    for (const x of [26, 36]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 5), mat('#ffd60a', { emissive: '#d4a017', ei: 0.4 })); c.rotation.z = x < 31 ? 0.5 : -0.5; this.add(c, x, 6.3, 5); }
    // ซุ้มต่าง ๆ
    const stall = (x0, z0, x1, z1, c1, c2, label, faceZ = 1) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      this.box(w - 0.4, 1, d - 0.6, '#7f5539', cx, 0, cz); for (const [px, pz] of [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x0 + 0.2, z1 - 0.2], [x1 - 0.2, z1 - 0.2]]) this.box(0.15, 2.4, 0.15, '#5a3e2b', px, 0, pz);
      for (let i = 0; i < 6; i++) this.box(w / 6, 0.12, d + 0.3, i % 2 ? c1 : c2, x0 + w / 12 + i * w / 6, 2.4, cz);
      const sg = makeSign(label, Math.min(w, 3.4), 0.55, '#3d1a00', '#ffe8a3'); sg.position.set(cx, 2.05, faceZ > 0 ? z1 + 0.05 : z0 - 0.05); if (faceZ < 0) sg.rotation.y = Math.PI; S.add(sg); };
    stall(9, 3, 14, 7, '#f28482', '#f7ede2', '👘 ซุ้มแต่งตัว');
    stall(10, 17, 14, 20, '#ffafcc', '#cdeffd', '🍦 ไอศกรีมริมเล');
    stall(44, 17, 48, 20, '#e76f51', '#f4a261', 'ซุ้มอาหาร'); stall(50, 17, 54, 20, '#2a9d8f', '#e9c46a', 'ขนมไทย');
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), mat('#c68b59')); cone.rotation.x = Math.PI; this.add(cone, 14.4, 3.2, 20.2);
    this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat('#ffafcc', { emissive: '#ff8fab', ei: 0.3 })), 14.4, 3.85, 20.2); this.box(0.08, 2.75, 0.08, '#5a3e2b', 14.4, 0, 20.2);
    // เวทีเล็ก
    this.box(8, 0.6, 4, '#8b5e3c', 31, 0, 19); this.box(8, 3.2, 0.2, '#6a040f', 31, 0.6, 17.2); this.add(makeSign('เวทีรำวง', 3, 0.6, '#370617', '#ffd166'), 31, 3.2, 17.35);
    // ศาลา (ศาลาประดิษฐ์ / ศาลาพักใจ)
    const sala = (x0, z0, x1, z1, roofC, label) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      this.box(w, 0.4, d, '#b08968', cx, 0, cz); for (const px of [x0 + 0.3, cx, x1 - 0.3]) for (const pz of [z0 + 0.3, z1 - 0.3]) this.box(0.25, 2.6, 0.25, '#7f4f24', px, 0.4, pz);
      const r = prism(d + 1.2, 1.8, w + 1, roofC); r.rotation.y = Math.PI / 2; this.add(r, cx, 3, cz);
      const r2 = prism(d * 0.6, 1.1, w * 0.7, '#e85d04'); r2.rotation.y = Math.PI / 2; this.add(r2, cx, 4.2, cz);
      const sg = makeSign(label, 3.2, 0.6, '#3d1a00', '#ffe8a3'); sg.position.set(cx, 2.6, z1 + 0.35); S.add(sg); return { cx, cz }; };
    const ws = sala(45, 2, 54, 8, '#9d0208', '🪷 ศาลาประดิษฐ์กระทง');
    this.box(3, 0.9, 1.4, '#a47148', ws.cx - 2, 0.4, ws.cz); this.box(3, 0.9, 1.4, '#a47148', ws.cx + 2, 0.4, ws.cz);
    this.tableKrathongs = [];
    const rs = sala(6, 30, 13, 35, '#6d597a', '💌 ศาลาพักใจ');
    this.box(3, 0.45, 0.6, '#a47148', rs.cx, 0.4, rs.cz); for (const x of [rs.cx - 2, rs.cx + 2]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), mat('#ffb4a2', { emissive: '#ff8c69', ei: 0.8 })); this.add(l, x, 2.4, rs.cz); }
    // บ่อทดลอง
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshStandardMaterial({ color: '#1b6ca8', roughness: 0.3, emissive: '#0a2a4a' })); pond.rotation.x = -Math.PI / 2; this.add(pond, 59, 0.06, 5);
    for (const [w, d, x, z] of [[6, 0.3, 59, 2.15], [6, 0.3, 59, 7.85], [0.3, 6, 56.15, 5], [0.3, 6, 61.85, 5]]) this.box(w, 0.35, d, '#9a8c98', x, 0, z);
    this.add(makeSign('🧪 บ่อทดลอง', 2.4, 0.55, '#023e8a', '#caf0f8'), 59, 1.4, 8.2);
    this.box(0.08, 1.15, 0.08, '#5a3e2b', 59, 0, 8.2);
    // ท่าน้ำ
    this.box(5, 0.25, 4.2, '#9c6644', 30.5, 0, 39); for (const x of [28.2, 32.8]) for (const z of [37.3, 38.9, 40.8]) this.box(0.18, 1.0, 0.18, '#6f4518', x, -0.6, z);
    for (const x of [28.15, 32.85]) this.box(0.08, 0.6, 4, '#6f4518', x, 0.25, 39);
    this.add(makeSign('🌊 ท่าน้ำลอยใจ', 2.6, 0.55, '#03045e', '#caf0f8'), 30.5, 1.4, 36.9); this.box(0.08, 1.15, 0.08, '#5a3e2b', 30.5, 0, 36.9);
    for (const x of [28.3, 32.7]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), mat('#ffd166', { emissive: '#ffb347', ei: 1 })); this.add(l, x, 1.25, 40.8); }
    // สายน้ำแห่งความทรงจำ
    this.add(makeSign('✨ สายน้ำแห่งความทรงจำ', 2.8, 0.6, '#5a189a', '#ffd6a5'), 20.5, 1.5, 35.5); this.box(0.1, 1.2, 0.1, '#5a3e2b', 20.5, 0, 35.5);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 24, Math.PI), mat('#ffd6a5', { emissive: '#ffb703', ei: 0.8 })); this.add(arch, 18, 0, 36.6);
    // ป่าชายเลน (instanced) + สะพานไม้
    const n = this.mangroves.length, trunkG = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 5), canG = new THREE.IcosahedronGeometry(0.95, 0), rootG = new THREE.CylinderGeometry(0.03, 0.04, 0.9, 4);
    const trunks = new THREE.InstancedMesh(trunkG, mat('#5c4033'), n), cans = new THREE.InstancedMesh(canG, mat('#1f5f3b'), n), roots = new THREE.InstancedMesh(rootG, mat('#6b4f3a'), n * 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    this.mangroves.forEach(([x, z], i) => { const hgt = 1 + (hash(i + 'h') % 40) / 100;
      m4.compose(v.set(x, 1.1 * hgt, z), q.identity(), sc.set(1, hgt, 1)); trunks.setMatrixAt(i, m4);
      m4.compose(v.set(x, 2.2 * hgt, z), q.setFromEuler(e.set(0, i, 0)), sc.set(1.1, 0.75, 1.1)); cans.setMatrixAt(i, m4);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + i; m4.compose(v.set(x + Math.sin(a) * 0.25, 0.35, z + Math.cos(a) * 0.25), q.setFromEuler(e.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6)), sc.set(1, 1, 1)); roots.setMatrixAt(i * 4 + k, m4); } });
    S.add(trunks, cans, roots);
    for (let x = 44; x < 63; x++) this.box(0.95, 0.12, 1.1, '#a47148', x + 0.5, 0.2, 33.5);
    this.box(19, 0.5, 0.06, '#7f5539', 53.5, 0.3, 32.95); this.box(19, 0.5, 0.06, '#7f5539', 53.5, 0.3, 34.05);
    this.box(2, 0.12, 9, '#a47148', 56, 0.2, 38.5); for (const z of [35, 38, 41, 42.8]) for (const x of [55.1, 56.9]) this.box(0.14, 0.9, 0.14, '#6f4518', x, -0.55, z);
    this.add(makeSign('🌳 สะพานป่าชายเลน', 2.6, 0.55, '#1b4332', '#d8f3dc'), 46, 1.4, 32.8);
    // ปลาตีน ปูก้ามดาบ บนเลน
    this.critters = [];
    const mk = (type, x, z) => { const g = new THREE.Group();
      if (type === 'fish') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mat('#7d6b58')); b.scale.set(0.9, 0.7, 2); b.position.y = 0.08; g.add(b); for (const s of [1, -1]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), mat('#222')); ey.position.set(s * 0.04, 0.17, 0.14); g.add(ey); } }
      else { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mat('#e63946')); b.scale.set(1.3, 0.55, 1); b.position.y = 0.07; g.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), mat('#f1c453')); c.position.set(0.2, 0.1, 0.08); c.name = 'claw'; g.add(c); }
      g.userData = { type, x, z, ph: Math.random() * 6 }; g.position.set(x, 0, z); S.add(g); this.critters.push(g); };
    [[48.6, 36.4], [50.2, 35.9], [53, 36.5], [60.5, 35.8]].forEach(([x, z], i) => mk(i % 2 ? 'crab' : 'fish', x, z)); mk('fish', 44.6, 36.4); mk('crab', 58.2, 36.3);
    // เรือ
    this.boats = [];
    for (const [x, z, c] of [[12, 46, '#9c6644'], [46, 48, '#7f5539']]) { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 3.2), mat(c)); g.add(h);
      const r = prism(1.2, 0.6, 1.4, '#e9c46a'); r.position.y = 0.6; g.add(r); this.box(0.05, 0.45, 0.05, '#5a3e2b', 0, 0, 0); const l = glowSprite('#ffb347', 1.1); l.position.set(0, 0.9, 1.4); g.add(l); g.position.set(x, -0.05, z); g.rotation.y = Math.PI / 2; S.add(g); this.boats.push(g); }
    // สายไฟประดับงานวัด
    const bulbs = []; const lines = [[5, 15.6, 60, 15.6], [5, 24.2, 60, 24.2], [12, 10, 12, 30], [31, 10, 31, 16.5], [50, 10, 50, 30], [27.5, 26, 27.5, 37], [33.5, 26, 33.5, 37]];
    const lineMat = new THREE.LineBasicMaterial({ color: '#3a2a1a' });
    for (const [x0, z0, x1, z1] of lines) { const pts = []; const L = Math.hypot(x1 - x0, z1 - z0), segs = Math.ceil(L / 1.2);
      for (let i = 0; i <= segs; i++) { const t = i / segs, y = 3.4 - Math.sin(t * Math.PI * Math.max(1, Math.round(L / 10))) ** 2 * 0.5; const p = new THREE.Vector3(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t); pts.push(p); if (i % 1 === 0) bulbs.push(p); }
      S.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat)); }
    const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length); const cols = ['#ffd166', '#ef476f', '#06d6a0', '#ffb347', '#a78bfa'];
    bulbs.forEach((p, i) => { m4.makeTranslation(p.x, p.y - 0.08, p.z); bm.setMatrixAt(i, m4); bm.setColorAt(i, new THREE.Color(cols[i % cols.length])); }); S.add(bm);
    if (!low) bulbs.forEach((p, i) => { if (i % 3 === 0) { const s = glowSprite(cols[i % cols.length], 0.7); s.position.set(p.x, p.y - 0.08, p.z); S.add(s); } });
    // ต้นไม้ทั่วไป + รั้ว
    const trees = [[2, 12], [2, 20], [2, 28], [62, 12], [62, 22], [20, 1.6], [42, 1.6], [24, 30], [38, 31], [16, 30]];
    for (const [x, z] of trees) { this.box(0.3, 1.4, 0.3, '#5c4033', x, 0, z); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat('#2d6a4f').clone()); c.material.transparent = true; this.add(c, x, 2.2, z); c.updateMatrixWorld(); (this.roofs ||= []).push({ m: c, box: new THREE.Box3().setFromObject(c) }); this.setRect(Math.floor(x), Math.floor(z), Math.floor(x) + 1, Math.floor(z) + 1, 0); }
    const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), mat('#6f4518'), 2 * W + 2 * WATER_Z); let fi = 0;
    for (let x = 0; x < W; x++) { m4.makeTranslation(x + 0.5, 0.4, 0.5); fence.setMatrixAt(fi++, m4); m4.makeTranslation(x + 0.5, 0.4, -100); fence.setMatrixAt(fi++, m4); }
    for (let z = 0; z < WATER_Z; z++) { m4.makeTranslation(0.5, 0.4, z + 0.5); fence.setMatrixAt(fi++, m4); m4.makeTranslation(W - 0.5, 0.4, z + 0.5); fence.setMatrixAt(fi++, m4); } S.add(fence);
    // หิ่งห้อย
    if (!low) { const fp = []; for (let i = 0; i < 60; i++) fp.push(45 + Math.random() * 18, 0.5 + Math.random() * 2, 29 + Math.random() * 9);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#d9ed92', size: 0.14, transparent: true, opacity: 0.9 })); S.add(this.fireflies); this.ffBase = Float32Array.from(fp); }
    this.ground = ground;
  }
  /** กระทงตัวอย่างบนโต๊ะศาลา (ใช้โมเดลจากข้อมูลจริง) */
  setTableKrathongs(designs) {
    for (const k of this.tableKrathongs) this.scene.remove(k); this.tableKrathongs = [];
    designs.slice(0, 4).forEach((d, i) => { const k = buildKrathong(d); k.scale.setScalar(0.42); k.position.set(47.5 + (i % 2) * 1.2 + (i > 1 ? 2.8 : 0), 1.3, 5 - 0.3 + (i % 2) * 0.6); this.scene.add(k); this.tableKrathongs.push(k); });
  }

  /* ---------- ครู NPC ---------- */
  /** รูปลักษณ์ครูตามคำนำหน้าชื่อ: นาง/นางสาว = ผู้หญิง · นาย/Mr. = ผู้ชาย (ผู้ดูแลแก้ทับได้ด้วย t.look) */
  teacherLook(t) {
    const h = hash(t.id), female = /^(นาง|นางสาว|Mrs|Ms|Miss)/.test(t.name), male = !female;
    const shirts = ['#f1faee', '#a8dadc', '#457b9d', '#e9c46a', '#f4a261', '#b5838d', '#cdb4db', '#8ecae6', '#ffffff', '#e5989b'];
    const look = female ? {
      body: 'f', hair: pick(['long', 'bun', 'bob', 'ponytail', 'long'], h), hairColor: pick(['#1b1410', '#2b1a12', '#3b2618', '#4a2c1a'], h >>> 3),
      outfit: pick(['thai', 'casual', 'local', 'casual', 'thai'], h >>> 5), bottom: pick(['skirt', 'long', 'long', 'skirt'], h >>> 7),
      top: pick(shirts, h >>> 9), bottomColor: pick(['#1f3a6b', '#3d405b', '#6d597a', '#2f3e46', '#111111', '#7f5539'], h >>> 11), shoes: pick(['#3b2618', '#111111', '#7f5539'], h >>> 13),
      acc: pick(['none', 'necklace', 'flower', 'glasses', 'none', 'necklace'], h >>> 15), accColor: pick(['#ff8fb1', '#ffd166', '#ffffff'], h >>> 17) }
    : { body: 'm', hair: pick(['short', 'short', 'spiky', 'short'], h), hairColor: pick(['#1b1410', '#2b1a12', '#3a3a3a', '#555555'], h >>> 3),
      outfit: pick(['casual', 'casual', 'local', 'thai', 'student'], h >>> 5), bottom: 'pants',
      top: pick(shirts, h >>> 9), bottomColor: pick(['#1f2a44', '#2f3e46', '#3d405b', '#111111', '#5c4033'], h >>> 11), shoes: pick(['#111111', '#3b2618'], h >>> 13),
      acc: pick(['none', 'glasses', 'none', 'none'], h >>> 15), accColor: '#222222' };
    look.skin = pick(['#f2d0b1', '#e8bd96', '#d9a57a', '#c9946a'], h >>> 19); look.badge = true; look.badgeColor = t.color;
    if (/^Mr/.test(t.name)) Object.assign(look, { hairColor: '#c9a15b', skin: '#f6d7bd', outfit: 'casual', top: '#dbe9f6' });
    return Object.assign(look, t.look || {});
  }
  /** จุดที่ครูเดินแวะทั่วงาน (คำนวณจากพื้นที่ที่เดินได้) */
  roamPoints() {
    if (this._roam) return this._roam;
    const pts = [[20, 18], [25, 22.5], [38, 22.5], [42, 15.2], [20, 15.2], [8, 23], [56, 23], [31, 24.4], [16, 22], [41, 21], [49, 21.5], [49.5, 10], [58.5, 10], [11.5, 9.3], [5.5, 8], [18, 9.8], [40, 9.8], [9.5, 28.8], [18, 31], [31, 32], [24, 34.5], [37, 34.5], [41, 29.5], [46, 33.5], [53, 33.5], [60, 33.5], [26, 13.9], [36, 13.9], [14, 25.1], [48, 25.1], [3.5, 16], [61, 16], [30.5, 37.5]];
    for (const b of this.booths) pts.push([b.stand.x, b.stand.z]);
    this._roam = pts.filter(([x, z]) => this.walkable(x, z)).map(([x, z]) => ({ x, z })); return this._roam;
  }
  buildTeachers() {
    this.teachers = []; const R = this.roamPoints();
    for (const [i, b] of this.booths.entries()) {
      const t = b.t, cx = b.x0 + 1.5, cz = b.rect[1] + 1, front = b.face === 0 ? 1 : -1;
      // ซุ้มกลุ่มสาระ (ตกแต่ง) — ครูไม่ประจำซุ้ม เดินอยู่ทั่วงาน
      this.box(2.8, 1, 0.6, '#8b5e3c', cx, 0, cz + front * 0.7);
      for (const [px, pz] of [[b.x0 + 0.15, cz - 0.9], [b.x0 + 2.85, cz - 0.9], [b.x0 + 0.15, cz + 0.9], [b.x0 + 2.85, cz + 0.9]]) this.box(0.12, 2.5, 0.12, '#5a3e2b', px, 0, pz);
      const r = prism(2.4, 0.8, 3.4, t.color); r.material = r.material.clone(); r.material.transparent = true; r.rotation.y = Math.PI / 2; this.add(r, cx, 2.5, cz);
      r.updateMatrixWorld(); (this.roofs ||= []).push({ m: r, box: new THREE.Box3().setFromObject(r).expandByScalar(0.3) });
      const sg = makeSign(t.subject, 2.6, 0.45, '#2b1d0e', '#ffe8a3', 'ซุ้มกลุ่มสาระ'); sg.scale.y = 1.3; sg.position.set(cx, 2.05, cz + front * 1.02); if (front < 0) sg.rotation.y = Math.PI; this.scene.add(sg);
      const look = this.teacherLook(t); const sp = R[(i * 7) % R.length];
      const av = this.spawnAvatar(look, sp.x + (Math.random() - 0.5) * 0.8, sp.z + (Math.random() - 0.5) * 0.6); av.rotation.y = av.userData.heading = Math.random() * 6.28;
      const lab = makeLabel(t.short, t.subject, t.color); lab.position.y = 2.25; av.add(lab);
      av.userData.npc = { t, look, path: [], wait: Math.random() * 6, waveCd: 0, speed: 1.0 + Math.random() * 0.35 };
      av.userData.teacherId = t.id; this.teachers.push(av);
    }
  }
  spawnAvatar(look, x, z) { const a = buildAvatar(look); a.position.set(x, 0, z); this.scene.add(a); return a; }
  setPlayerLook(look) { const p = this.player, pos = p.position.clone(), hd = p.userData.heading, hold = this.heldDesign; this.scene.remove(p); this.player = this.spawnAvatar(look, pos.x, pos.z); this.player.userData.heading = hd; this.player.rotation.y = hd; if (hold) this.setHolding(hold); }
  teleport(x, z) { this.player.position.set(x, 0, z); this.path = []; this.camLook.set(x, 0, z); this.snapCam = true; }
  teacherById(id) { return this.teachers.find(a => a.userData.teacherId === id); }

  /* ---------- การถือกระทง (ใช้แบบที่นักเรียนออกแบบ) ---------- */
  setHolding(design) {
    const h = this.player.userData.hands; while (h.children.length) h.remove(h.children[0]);
    this.heldDesign = design || null; const a = this.player.userData.anim; a.holding = !!design; a.tray = false; if (!design) return null;
    const k = buildKrathong(design); k.scale.setScalar(WORLD_SCALE * 0.9); const b = BASES[design.base] || BASES.round;
    const big = b.rx > 1.2 || (design.pieces || []).length > 40;
    if (big) { a.tray = true; const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.04, 14), mat('#a47148')); tray.position.y = -0.02; h.add(tray); k.position.y = 0.01; h.position.set(0, 0.82, 0.48); }
    else h.position.set(0, 0.95, 0.42);
    h.add(k); this.heldMesh = k; return k;
  }

  /* ---------- อินพุต ---------- */
  bindInput(cv) {
    let down = null;
    cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 12 || !this.inputEnabled) return; this.click(e); });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(0.55, Math.min(1.7, this.zoom * (e.deltaY > 0 ? 1.08 : 0.92))); }, { passive: false });
    addEventListener('keydown', e => { if (!this.inputEnabled || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return; const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys.add(k); e.preventDefault(); }
      if ((k === 'e' || k === 'enter') && this.near) { this.cb.onInteract?.(this.near); } });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }
  click(e) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ptr, this.camera);
    const ks = [...this.river.values()].filter(x => x.group.visible).map(x => x.group);
    if (ks.length) { const hit = this.raycaster.intersectObjects(ks, true)[0]; if (hit) { let o = hit.object; while (o && !o.userData.recId) o = o.parent; if (o) { this.cb.onKrathongClick?.(o.userData.recId); return; } } }
    const th = this.raycaster.intersectObjects(this.teachers, true)[0];
    if (th) { let o = th.object; while (o && !o.userData.teacherId) o = o.parent; if (o && !this.escort) { const id = o.userData.teacherId; this.walkToTeacher(id, () => this.cb.onInteract?.({ type: 'teacher', id })); return; } }
    const p = new THREE.Vector3(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (this.raycaster.ray.intersectPlane(plane, p)) { if (this.escort || this.placing) return; this.walkTo(p.x, p.z); this.cb.onWalkClick?.(p); }
  }
  walkTo(x, z, done) { this.chase = null; const p = this.player.position; this.path = this.findPath(p.x, p.z, x, z); this.onArrive = done || null; if (!this.path.length && done) { if (Math.hypot(p.x - x, p.z - z) < 1.6) done(); } this.focus = null; this.followId = null; return this.path.length > 0; }
  walkToZone(id, done) { const z = ZONES.find(q => q.id === id); if (z) this.walkTo(z.x, z.z, done); }
  /** เดินตามหาครู (ครูเดินอยู่ทั่วงาน จึงคำนวณเส้นทางใหม่เป็นระยะ) */
  walkToTeacher(id, done) { const a = this.teacherById(id); if (!a) return; this.walkTo(a.position.x, a.position.z); this.chase = { id, done, t: 0 }; }

  /* ---------- อัปเดตทุกเฟรม ---------- */
  moveAvatar(av, path, speed, dt) {
    if (!path.length) return false; const p = av.position, t = path[0]; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { path.shift(); return path.length > 0; } const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; av.userData.heading = Math.atan2(dx, dz); return true;
  }
  update(dt) {
    if (this.paused) return; dt = Math.min(dt, 0.05); this.t += dt; const t = this.t, P = this.player, a = P.userData.anim;
    // ผู้เล่น: แป้นพิมพ์ / จอยสติ๊ก
    let kx = 0, kz = 0; if (this.inputEnabled && !this.escort && !this.placing) {
      if (this.keys.has('w') || this.keys.has('arrowup')) kz -= 1; if (this.keys.has('s') || this.keys.has('arrowdown')) kz += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1; if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
      kx += this.joy.x; kz += this.joy.y; }
    let moving = false;
    if (Math.hypot(kx, kz) > 0.15) { this.path = []; this.onArrive = null; this.chase = null; this.focus = null; this.followId = null; const l = Math.max(1, Math.hypot(kx, kz)), sp = 4 * dt, nx = P.position.x + kx / l * sp, nz = P.position.z + kz / l * sp;
      if (this.walkable(nx, nz)) { P.position.x = nx; P.position.z = nz; } else if (this.walkable(nx, P.position.z)) P.position.x = nx; else if (this.walkable(P.position.x, nz)) P.position.z = nz;
      P.userData.heading = Math.atan2(kx, kz); moving = true; }
    else if (this.path.length) { moving = this.moveAvatar(P, this.path, this.escort ? 3 : 4, dt) || this.path.length > 0; if (!this.path.length) { moving = false; const cb = this.onArrive; this.onArrive = null; cb && cb(); } }
    if (!this.placing) a.mode = moving ? 'walk' : (a.mode === 'wave' ? 'wave' : 'idle');
    animateAvatar(P, dt);
    // ผู้ร่วมเดิน (ครูเฉพาะฉากของผู้เล่น)
    this.updateEscort(dt, moving);
    // ตามหาครูที่กำลังเดิน
    if (this.chase) { const c = this.chase, ta = this.teacherById(c.id); c.t += dt;
      if (!ta) this.chase = null; else { const d = Math.hypot(ta.position.x - P.position.x, ta.position.z - P.position.z);
        if (d < 1.9) { this.chase = null; this.path = []; this.onArrive = null; P.userData.heading = Math.atan2(ta.position.x - P.position.x, ta.position.z - P.position.z); c.done && c.done(); }
        else if (c.t > 0.7 || !this.path.length) { c.t = 0; this.path = this.findPath(P.position.x, P.position.z, ta.position.x, ta.position.z); } } }
    // ครู NPC เดินทั่วงาน แวะยืนตามจุดต่าง ๆ หยุดคุยเมื่อผู้เล่นเข้าใกล้
    const R = this.roamPoints();
    for (const av of this.teachers) { if (this.escort && this.escort.companion === av) continue;
      const n = av.userData.npc, an = av.userData.anim, dp = Math.hypot(P.position.x - av.position.x, P.position.z - av.position.z);
      n.waveCd -= dt; let mv = false;
      if (dp < 3.2) { av.userData.heading = Math.atan2(P.position.x - av.position.x, P.position.z - av.position.z); if (dp < 2.6 && n.waveCd <= 0) { an.mode = 'wave'; n.waveUntil = t + 1.6; n.waveCd = 14; } }
      else if (n.path.length && !this.reduceMotion) { mv = this.moveAvatar(av, n.path, n.speed, dt) || n.path.length > 0; if (!n.path.length) { mv = false; n.wait = 4 + Math.random() * 9; } }
      else { n.wait -= dt; if (n.wait <= 0 && !this.reduceMotion) { let dst = R[Math.floor(Math.random() * R.length)]; for (let k = 0; k < 4 && Math.hypot(dst.x - av.position.x, dst.z - av.position.z) < 5; k++) dst = R[Math.floor(Math.random() * R.length)];
          n.path = this.findPath(av.position.x, av.position.z, dst.x + (Math.random() - 0.5) * 0.8, dst.z + (Math.random() - 0.5) * 0.5); if (!n.path.length) n.wait = 3; } }
      if (n.waveUntil && t > n.waveUntil) { n.waveUntil = 0; an.mode = 'idle'; } if (!n.waveUntil) an.mode = mv ? 'walk' : 'idle';
      animateAvatar(av, dt); }
    // ใกล้จุดกิจกรรม
    this.updateNear();
    // น้ำ หิ่งห้อย สัตว์ เรือ
    if (!this.reduceMotion) {
      const pos = this.water.geometry.attributes.position, b = this.waterBase; for (let i = 0; i < pos.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; pos.array[i * 3 + 2] = Math.sin(x * 0.35 + t * 1.2) * 0.06 + Math.cos(y * 0.5 + t * 0.9) * 0.05; } pos.needsUpdate = true; this.water.geometry.computeVertexNormals();
      if (this.fireflies) { const fp = this.fireflies.geometry.attributes.position; for (let i = 0; i < fp.count; i++) { fp.array[i * 3] = this.ffBase[i * 3] + Math.sin(t * 0.7 + i) * 0.4; fp.array[i * 3 + 1] = this.ffBase[i * 3 + 1] + Math.sin(t * 1.3 + i * 2) * 0.3; } fp.needsUpdate = true; this.fireflies.material.opacity = 0.6 + Math.sin(t * 3) * 0.3; }
      for (const c of this.critters) { const u = c.userData; if (u.type === 'fish') { const h = Math.max(0, Math.sin(t * 2 + u.ph)) ** 8; c.position.y = h * 0.25; } else { const cl = c.getObjectByName('claw'); if (cl) cl.rotation.z = Math.sin(t * 4 + u.ph) * 0.5; } }
      for (const [i, b2] of this.boats.entries()) { b2.position.y = -0.05 + Math.sin(t * 1.1 + i) * 0.05; b2.rotation.z = Math.sin(t * 0.9 + i) * 0.03; b2.position.x += dt * 0.15 * (i ? -1 : 1); if (b2.position.x > 75) b2.position.x = -10; if (b2.position.x < -10) b2.position.x = 75; }
    }
    for (const k of this.tableKrathongs) animateKrathong(k, t); if (this.heldMesh) animateKrathong(this.heldMesh, t);
    this.updatePlacing(dt); this.updateRiver(dt); this.updateFx(dt); this.updateMinigames();
    this.updateCamera(dt);
  }
  updateNear() {
    if (this.escort || this.placing) { if (this.near) { this.near = null; this.cb.onNear?.(null); } return; }
    const p = this.player.position; let best = null, bd = 1e9;
    for (const av of this.teachers) { const d = Math.hypot(av.position.x - p.x, av.position.z - p.z); if (d < 2.1 && d < bd) { bd = d; best = { type: 'teacher', id: av.userData.teacherId }; } }
    for (const z of ZONES) { const d = Math.hypot(z.x - p.x, z.z - p.z); if (d < 1.7 && d < bd) { bd = d; best = { type: 'zone', id: z.id }; } }
    const key = best ? best.type + best.id : ''; if (key !== this.nearKey) { this.nearKey = key; this.near = best; this.cb.onNear?.(best); }
    let zn = 'ลานงานวัด', zd = 7; for (const z of ZONES) { const d = Math.hypot(z.x - p.x, z.z - p.z); if (d < zd) { zd = d; zn = z.name; } }
    if (zn !== this.zoneName) { this.zoneName = zn; this.cb.onZone?.(zn); }
  }
  updateCamera(dt) {
    let target = this.player.position.clone();
    if (this.escort?.companion) target.lerp(this.escort.companion.position, 0.5);
    if (this.followId && this.river.get(this.followId)) target = this.river.get(this.followId).group.position.clone();
    if (this.focus) { target = this.focus.pos.clone(); if (this.t > this.focus.until) this.focus = null; }
    const k = this.snapCam ? 1 : 1 - Math.exp(-dt * 4); this.snapCam = false;
    this.camLook.lerp(target, k); const off = new THREE.Vector3(0, 12.5, 11.5).multiplyScalar(this.zoom * (this.camera.aspect < 0.8 ? 1.45 : 1));
    this.camera.position.lerp(this.camLook.clone().add(off), k); this.camera.lookAt(this.camLook.x, this.camLook.y + 0.8, this.camLook.z);
    // หลังคาซุ้มที่บังตัวละครจะจางลง
    if (this.roofs) { const targets = [this.player.position]; if (this.escort?.companion) targets.push(this.escort.companion.position); const ray = new THREE.Ray(), hit = new THREE.Vector3();
      for (const r of this.roofs) { let block = false; for (const tp of targets) { const dst = tp.clone(); dst.y += 1; ray.origin.copy(this.camera.position); ray.direction.copy(dst).sub(this.camera.position); const len = ray.direction.length(); ray.direction.normalize();
          if (ray.intersectBox(r.box, hit) && hit.distanceTo(this.camera.position) < len) { block = true; break; } }
        const o = r.m.material.opacity, to = block ? 0.22 : 1; if (Math.abs(o - to) > 0.01) { r.m.material.opacity = o + (to - o) * Math.min(1, dt * 8); r.m.material.depthWrite = r.m.material.opacity > 0.9; } } }
  }
  render() { this.renderer.render(this.scene, this.camera); }
  resize() { const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  /* ---------- ชวนครูเดินไปท่าน้ำ ---------- */
  startEscort(teacherId, design) {
    if (this.escort || this.placing) return false; const src = this.teacherById(teacherId); if (!src) return false;
    const n = src.userData.npc; n.path = []; n.waveUntil = 0;   // ครูตัวจริงเดินไปด้วยกัน
    this.setHolding(design); this.escort = { teacherId, companion: src, trail: [], tt: 0, phase: 'walk' };
    this.walkTo(PIER_POINT.x, PIER_POINT.z, () => this.arrivePier()); this.path.length || this.arrivePier(); return true;
  }
  arrivePier() { if (!this.escort || this.escort.phase !== 'walk') { if (!this.escort) this.cb.onEscortArrive?.(null); return; } this.escort.phase = 'atPier'; this.player.userData.heading = 0; this.cb.onEscortArrive?.(this.escort.teacherId); }
  updateEscort(dt, moving) {
    const e = this.escort; if (!e || !e.companion) return; const c = e.companion, P = this.player.position; e.tt += dt;
    if (e.phase === 'walk' || e.phase === 'atPier') {
      if (e.tt > 0.1) { e.tt = 0; e.trail.push({ x: P.x, z: P.z }); if (e.trail.length > 40) e.trail.shift(); }
      let goal = e.trail[Math.max(0, e.trail.length - 9)] || { x: P.x - 0.8, z: P.z };
      if (e.phase === 'atPier') goal = { x: PIER_POINT.x - 0.9, z: PIER_POINT.z - 0.4 };
      const d = Math.hypot(goal.x - c.position.x, goal.z - c.position.z); let mv = false;
      if (d > 0.35) { const tp = [goal]; mv = this.moveAvatar(c, tp, Math.min(4.5, 2.5 + d), dt); }
      else if (e.phase === 'atPier') c.userData.heading = Math.atan2(P.x - c.position.x, P.z - c.position.z);
      if (c.userData.anim.mode !== 'wave') c.userData.anim.mode = mv ? 'walk' : 'idle';
    } else if (e.phase === 'farewell') { e.ft -= dt; c.userData.anim.mode = 'wave'; c.userData.heading = Math.atan2(P.x - c.position.x, P.z - c.position.z); if (e.ft <= 0) this.endEscort(); }
    animateAvatar(c, dt);
  }
  skipEscort() { const e = this.escort; if (!e || e.phase !== 'walk') return; this.path = []; this.onArrive = null; this.teleport(PIER_POINT.x, PIER_POINT.z); e.companion.position.set(PIER_POINT.x - 0.9, 0, PIER_POINT.z - 0.4); this.arrivePier(); }
  releaseTeacher() { const c = this.escort?.companion; if (c) { const n = c.userData.npc; n.path = []; n.wait = 0.2; c.userData.anim.mode = 'idle'; } }
  cancelEscort() { this.path = []; this.onArrive = null; this.releaseTeacher(); this.escort = null; }
  endEscort() { this.releaseTeacher(); this.escort = null; this.cb.onEscortEnd?.(); }
  /** ก้มวางกระทงชิ้นเดิมลงน้ำ → กระทงเข้าสู่แม่น้ำ */
  placeKrathong(rec, farewellText) {
    if (this.placing) return; this.path = []; const P = this.player;
    if (!this.heldMesh) this.setHolding(rec.design);
    P.userData.heading = 0; P.userData.anim.mode = 'kneel';
    const mesh = this.heldMesh; const wp = new THREE.Vector3(); mesh.getWorldPosition(wp); mesh.removeFromParent(); this.player.userData.hands.clear();
    mesh.position.copy(wp); mesh.scale.setScalar(WORLD_SCALE); this.scene.add(mesh); this.heldMesh = null; this.heldDesign = null; P.userData.anim.holding = false; P.userData.anim.tray = false;
    this.placing = { t: 0, mesh, from: wp.clone(), to: new THREE.Vector3(RELEASE.x, WATER_Y - 0.02, RELEASE.z), rec, farewellText, rippled: false };
  }
  updatePlacing(dt) {
    const p = this.placing; if (!p) return; p.t += dt; const P = this.player;
    if (p.t < 0.6) { /* ก้มตัว */ } else if (p.t < 1.9) { const k = Math.min(1, (p.t - 0.6) / 1.3), e = k * k * (3 - 2 * k); p.mesh.position.lerpVectors(p.from, p.to, e); p.mesh.position.y += Math.sin(e * Math.PI) * 0.35; }
    else if (!p.rippled) { p.rippled = true; p.mesh.position.copy(p.to); for (let i = 0; i < 3; i++) setTimeout(() => this.ripple(p.to.x, p.to.z), i * 350); this.cb.onSplash?.();
      p.rec.releasedAt = Date.now(); this.addRiverEntity(p.rec, p.mesh); }
    if (p.t > 3.1) { P.userData.anim.mode = 'idle'; this.placing = null;
      if (this.escort) { this.escort.phase = 'farewell'; this.escort.ft = 2.6; this.cb.onSpeech?.(this.escort.teacherId, p.farewellText); }
      this.cb.onPlaced?.(p.rec); }
  }
  ripple(x, z) { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 24), new THREE.MeshBasicMaterial({ color: '#bde0fe', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, WATER_Y + 0.06, z); this.scene.add(m); this.ripples.push({ m, t: 0 }); }

  /* ---------- แม่น้ำส่วนรวม: ตำแหน่งคำนวณจากเวลาปล่อย ---------- */
  riverPos(rec, now = Date.now()) {
    const s = (now - rec.releasedAt) / 1000, seed = hash(rec.id) % 1000; const lane = 0.6 + (seed % 9) * 0.45;
    const x = RELEASE.x + s * RIVER_SPEED * (0.85 + (seed % 7) * 0.05), z = RELEASE.z + lane * Math.min(1, s / 40) + Math.sin(s * 0.06 + seed) * 0.35;
    return { x, z, s, gone: x > W + 8 };
  }
  setRiver(recs) {
    this.riverRecs = recs.filter(r => r && r.design && r.releasedAt);
    const ids = new Set(this.riverRecs.map(r => r.id));
    for (const [id, e] of this.river) if (!ids.has(id)) { this.scene.remove(e.group); if (e.refl) this.scene.remove(e.refl); this.river.delete(id); }
  }
  addRiverEntity(rec, mesh) {
    if (!this.riverRecs.find(r => r.id === rec.id)) this.riverRecs.push(rec);
    const old = this.river.get(rec.id); if (old && old.group !== mesh) { this.scene.remove(old.group); if (old.refl) this.scene.remove(old.refl); }
    const g = mesh || buildKrathong(rec.design); g.scale.setScalar(WORLD_SCALE); g.userData.recId = rec.id; if (!g.parent) this.scene.add(g);
    let refl = null; if (this.reflections) { refl = glowSprite('#ffcf6b', 1.0); refl.material = refl.material.clone(); refl.material.opacity = 0.45; this.scene.add(refl); }
    const e = { rec, group: g, refl }; this.river.set(rec.id, e); return e;
  }
  updateRiver() {
    const now = Date.now(), cx = this.camLook.x, cz = this.camLook.z; const vis = [];
    for (const r of this.riverRecs) { const p = this.riverPos(r, now); if (p.gone) continue; const d = Math.hypot(p.x - cx, p.z - cz); if (d < 30 || r.id === this.followId) vis.push([d, r, p]); }
    vis.sort((a, b) => a[0] - b[0]); const show = new Set(vis.slice(0, this.quality === 'low' ? 20 : 40).map(v => v[1].id));
    for (const [d, r, p] of vis) { if (!show.has(r.id)) continue; let e = this.river.get(r.id); if (!e) e = this.addRiverEntity(r);
      const g = e.group; g.visible = true; const bob = Math.sin(this.t * 1.6 + p.s) * 0.025; g.position.set(p.x, WATER_Y - 0.03 + bob, p.z); g.rotation.set(Math.sin(this.t * 1.1 + p.s) * 0.05, p.s * 0.02, Math.cos(this.t * 0.9 + p.s) * 0.05);
      setLOD(g, d > 16); if (d < 22) animateKrathong(g, this.t); if (e.refl) { e.refl.visible = this.reflections; e.refl.position.set(p.x, WATER_Y - 0.25, p.z + 0.2); } }
    for (const [id, e] of this.river) if (!show.has(id) && !(this.placing && this.placing.rec.id === id)) { e.group.visible = false; if (e.refl) e.refl.visible = false; }
  }
  findKrathong(id) { const r = this.riverRecs.find(x => x.id === id); if (!r) return null; const p = this.riverPos(r); if (p.gone) return { gone: true, rec: r }; this.focus = { pos: new THREE.Vector3(p.x, 0, p.z), until: this.t + 6 }; this.beacon(p.x, p.z); return { gone: false, rec: r }; }
  follow(id) { this.followId = id; }
  beacon(x, z) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.4, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); b.position.set(x, 3, z); this.scene.add(b); this.fx.push({ o: b, t: 0, life: 6, follow: true, kind: 'beacon' }); }
  reactionFX(id, type) { const e = this.river.get(id); if (!e || !e.group.visible) return; const col = { cheer: '#ffd166', thanks: '#ff8fb1', goodday: '#bde0fe' }[type] || '#fff';
    for (let i = 0; i < 12; i++) { const s = glowSprite(col, 0.35); s.position.copy(e.group.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6)); this.scene.add(s); this.fx.push({ o: s, t: 0, life: 2.5 + Math.random(), vy: 0.6 + Math.random() * 0.6, kind: 'spark' }); } }
  updateFx(dt) {
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.t += dt; r.m.scale.setScalar(1 + r.t * 3); r.m.material.opacity = Math.max(0, 0.8 - r.t * 0.5); if (r.t > 1.6) { this.scene.remove(r.m); this.ripples.splice(i, 1); } }
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.kind === 'spark') { f.o.position.y += f.vy * dt; f.o.material.opacity = 1 - f.t / f.life; } if (f.kind === 'beacon') f.o.material.opacity = 0.5 * (1 - f.t / f.life);
      if (f.t > f.life) { this.scene.remove(f.o); this.fx.splice(i, 1); } }
  }

  /* ---------- กิจกรรมเสริมในฉาก ---------- */
  startTrash() {
    this.clearTrash(); const spots = [[36, 36.2], [39.5, 35.6], [42.5, 36.3], [46, 33.5], [50.5, 33.4], [54, 33.6], [56, 36], [59.5, 33.5]];
    for (const [x, z] of spots) { const g = new THREE.Group(); const bottle = Math.random() < 0.5;
      const m = bottle ? new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), mat('#90e0ef', { opacity: 0.8, emissive: '#48cae4', ei: 0.3 })) : new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat('#f8f9fa', { emissive: '#adb5bd', ei: 0.2 }));
      if (bottle) m.rotation.z = Math.PI / 2; m.position.y = 0.3; g.add(m); const s = glowSprite('#ffd166', 0.7); s.position.y = 0.32; g.add(s); g.position.set(x, 0, z); this.scene.add(g); this.trash.push(g); }
    this.trashTotal = this.trash.length; this.trashActive = true;
    const guide = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat('#8d7b68')); b.scale.set(0.9, 0.7, 2); b.position.y = 0.15; guide.add(b);
    for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat('#222')); e.position.set(s * 0.07, 0.3, 0.25); guide.add(e); }
    const lab = makeLabel('น้องปลาตีน', 'ช่วยเก็บขยะหน่อยนะ', '#ffd166'); lab.position.y = 1; guide.add(lab); guide.position.set(43.5, 0, 33.5); this.scene.add(guide); this.trashGuide = guide;
  }
  clearTrash() { for (const g of this.trash) this.scene.remove(g); this.trash = []; if (this.trashGuide) this.scene.remove(this.trashGuide); this.trashGuide = null; this.trashActive = false; }
  startExplore(found = []) {
    for (const s of this.spots) this.scene.remove(s.o); this.spots = [];
    for (const sp of MANGROVE_SPOTS) { if (found.includes(sp.id)) continue; const o = makeLabel(sp.icon + ' ?', '', '#95d5b2'); o.scale.set(1.2, 0.3, 1); o.position.set(sp.x, 1.6, sp.z); this.scene.add(o); this.spots.push({ sp, o }); }
    this.exploreActive = true;
  }
  updateMinigames() {
    const p = this.player.position;
    if (this.trashActive) { for (let i = this.trash.length - 1; i >= 0; i--) { const g = this.trash[i]; g.children[0].rotation.y += 0.03; if (Math.hypot(g.position.x - p.x, g.position.z - p.z) < 1.2) { this.scene.remove(g); this.trash.splice(i, 1); this.cb.onTrash?.(this.trashTotal - this.trash.length, this.trashTotal); } }
      if (!this.trash.length) { this.trashActive = false; if (this.trashGuide) setTimeout(() => this.clearTrash(), 4000); } }
    if (this.exploreActive) { for (let i = this.spots.length - 1; i >= 0; i--) { const s = this.spots[i]; s.o.position.y = 1.6 + Math.sin(this.t * 2 + i) * 0.1; if (Math.hypot(s.sp.x - p.x, s.sp.z - p.z) < 2.6) { this.scene.remove(s.o); this.spots.splice(i, 1); this.cb.onSpot?.(s.sp); } } if (!this.spots.length) this.exploreActive = false; }
  }

  /* ---------- แผนที่ย่อ ---------- */
  drawMinimap(cv, myIds = []) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, sx = w / W, sz = h / 44;
    x.fillStyle = '#20402a'; x.fillRect(0, 0, w, h); x.fillStyle = '#0d3358'; x.fillRect(0, WATER_Z * sz, w, h);
    x.fillStyle = '#a08662'; x.fillRect(3 * sx, 9 * sz, 58 * sx, 17 * sz);
    x.fillStyle = 'rgba(0,0,0,.45)'; for (const o of this.obstacles) x.fillRect(o[1] * sx, o[2] * sz, (o[3] - o[1]) * sx, (o[4] - o[2]) * sz);
    for (const b of this.booths) { x.fillStyle = b.t.color; x.fillRect(b.rect[0] * sx, b.rect[1] * sz, 3 * sx, 2 * sz); }
    x.fillStyle = '#1f5f3b'; for (const [mx, mz] of this.mangroves) x.fillRect((mx - 0.5) * sx, (mz - 0.5) * sz, sx, sz);
    x.fillStyle = '#a47148'; x.fillRect(28 * sx, 37 * sz, 5 * sx, 4 * sz); x.fillRect(44 * sx, 33 * sz, 19 * sx, sz); x.fillRect(55 * sx, 34 * sz, 2 * sx, 9 * sz);
    x.font = `${Math.max(9, w / 22)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; for (const z of ZONES) x.fillText(z.icon, z.x * sx, z.z * sz);
    const now = Date.now(); for (const r of this.riverRecs) { const p = this.riverPos(r, now); if (p.gone) continue; x.fillStyle = myIds.includes(r.id) ? '#ffd60a' : 'rgba(255,207,107,.6)'; x.beginPath(); x.arc(p.x * sx, p.z * sz, myIds.includes(r.id) ? 3 : 1.6, 0, 7); x.fill(); }
    for (const av of this.teachers) { x.fillStyle = av.userData.npc.t.color; x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); x.arc(av.position.x * sx, av.position.z * sz, 2.4, 0, 7); x.fill(); x.stroke(); }
    if (this.escort?.companion) { const c = this.escort.companion.position; x.fillStyle = '#ff8fb1'; x.beginPath(); x.arc(c.x * sx, c.z * sz, 3, 0, 7); x.fill(); }
    const p = this.player.position; x.fillStyle = '#fff'; x.strokeStyle = '#ef476f'; x.lineWidth = 2; x.beginPath(); x.arc(p.x * sx, p.z * sz, 4, 0, 7); x.fill(); x.stroke();
  }
  minimapToWorld(cv, mx, my) { return { x: mx / cv.clientWidth * W, z: my / cv.clientHeight * 44 }; }

  setReflections(on) { this.reflections = on; for (const e of this.river.values()) if (e.refl) e.refl.visible = on; }
}
