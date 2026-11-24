/* ============================================================
   ตัวละคร Low-poly: สร้างจากค่าการแต่งตัว (look) + แอนิเมชัน
   เดิน / ยืน / ทักทาย / ก้มวาง / ถือกระทง
   ============================================================ */
import * as THREE from 'three';
import { mat } from './krathong.js';

const G = {};
const g = (k, f) => G[k] || (G[k] = f());
const box = (w, h, d) => g(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const M = (geo, c) => new THREE.Mesh(geo, mat(c));

export function buildAvatar(look) {
  const L = Object.assign({ hair: 'short', hairColor: '#1b1410', skin: '#ecc19c', outfit: 'student', bottom: 'pants', top: '#ffffff', bottomColor: '#1f3a6b', shoes: '#222222', acc: 'none', accColor: '#ff8fb1' }, look || {});
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  // เงาใต้เท้า
  const sh = new THREE.Mesh(g('shadow', () => new THREE.CircleGeometry(0.34, 12)), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);

  // ขา
  const legs = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.11, 0.75, 0); body.add(pivot);
    if (L.bottom === 'shorts') {
      const up = M(box(0.19, 0.32, 0.22), L.bottomColor); up.position.y = -0.16; pivot.add(up);
      const lo = M(box(0.15, 0.4, 0.17), L.skin); lo.position.y = -0.5; pivot.add(lo);
    } else {
      const leg = M(box(0.17, 0.7, 0.2), L.bottom === 'pants' ? L.bottomColor : L.skin); leg.position.y = -0.35; pivot.add(leg);
    }
    const shoe = M(box(0.19, 0.1, 0.28), L.shoes); shoe.position.set(0, -0.71, 0.04); pivot.add(shoe);
    legs.push(pivot);
  }
  if (L.bottom === 'skirt') { const sk = M(g('skirt', () => new THREE.CylinderGeometry(0.26, 0.37, 0.42, 8)), L.bottomColor); sk.position.y = 0.7; body.add(sk); }
  if (L.bottom === 'long') { const sk = M(g('longsk', () => new THREE.CylinderGeometry(0.27, 0.32, 0.72, 8)), L.bottomColor); sk.position.y = 0.4; body.add(sk); }

  // ลำตัว (body: 'f' ผู้หญิง ไหล่แคบ เอวคอด · 'm' ผู้ชาย ไหล่กว้าง · ไม่ระบุ = ทรงกลาง)
  let torso;
  if (L.body === 'f') { torso = M(g('torsoF', () => new THREE.CylinderGeometry(0.235, 0.2, 0.6, 8)), L.top); torso.scale.z = 0.68; }
  else if (L.body === 'm') { torso = M(box(0.56, 0.62, 0.31), L.top); }
  else torso = M(box(0.5, 0.6, 0.3), L.top);
  torso.position.y = 1.05; body.add(torso);
  const shoulderX = L.body === 'f' ? 0.29 : L.body === 'm' ? 0.345 : 0.32;
  const accent = L.outfit === 'local' ? '#e9c46a' : '#d4a017';
  if (L.outfit === 'student') {
    const col = M(box(0.3, 0.06, 0.32), '#f8f9fa'); col.position.y = 1.33; body.add(col);
    const emb = M(box(0.08, 0.06, 0.02), '#1f3a6b'); emb.position.set(-0.13, 1.18, 0.16); body.add(emb);
  } else if (L.outfit === 'thai') {
    const sash = M(box(0.13, 0.78, 0.33), accent); sash.position.set(0, 1.05, 0); sash.rotation.z = 0.62; body.add(sash);
    const belt = M(box(0.52, 0.06, 0.32), accent); belt.position.y = 0.78; body.add(belt);
  } else if (L.outfit === 'local') {
    const hem = M(box(0.52, 0.05, 0.32), accent); hem.position.y = 0.77; body.add(hem);
    const pl = M(box(0.05, 0.56, 0.02), accent); pl.position.set(0, 1.05, 0.16); body.add(pl);
    const sc = M(box(0.34, 0.07, 0.32), '#e63946'); sc.position.y = 1.33; body.add(sc);
  } else {
    const col = M(box(0.26, 0.05, 0.32), L.top); col.position.y = 1.34; body.add(col);
    const bt = M(box(0.04, 0.04, 0.02), '#ffffff'); bt.position.set(0, 1.26, 0.16); body.add(bt);
  }

  // แขน
  const arms = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * shoulderX, 1.31, 0); body.add(pivot);
    const sl = M(box(0.14, 0.3, 0.16), L.top); sl.position.y = -0.14; pivot.add(sl);
    const fa = M(box(0.12, 0.3, 0.14), L.skin); fa.position.y = -0.43; pivot.add(fa);
    const hd = M(g('hand', () => new THREE.SphereGeometry(0.07, 6, 4)), L.skin); hd.position.y = -0.6; pivot.add(hd);
    arms.push(pivot);
  }
  // ศีรษะ
  const neck = M(g('neck', () => new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6)), L.skin); neck.position.y = 1.39; body.add(neck);
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  head.add(M(g('head', () => new THREE.SphereGeometry(0.23, 10, 7)), L.skin));
  for (const s of [1, -1]) {
    const e = M(box(0.04, 0.06, 0.02), '#1b1b1b'); e.position.set(s * 0.08, 0.02, 0.215); head.add(e);
    const ch = new THREE.Mesh(g('cheek', () => new THREE.CircleGeometry(0.03, 8)), mat('#ff9aa2')); ch.position.set(s * 0.13, -0.05, 0.2); ch.rotation.y = s * 0.5; head.add(ch);
  }
  const mouth = M(box(0.06, 0.015, 0.01), '#a4161a'); mouth.position.set(0, -0.08, 0.225); head.add(mouth);

  // ผม
  const hc = L.hairColor;
  const cap = M(g('cap', () => new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)), hc); cap.position.y = 0.02; cap.rotation.x = -0.25; head.add(cap);
  if (L.hair === 'bob') { const b = M(box(0.5, 0.3, 0.22), hc); b.position.set(0, -0.06, -0.1); head.add(b); }
  if (L.hair === 'long') { const b = M(box(0.46, 0.62, 0.14), hc); b.position.set(0, -0.2, -0.17); head.add(b); }
  if (L.hair === 'bun') { const b = M(g('bun', () => new THREE.SphereGeometry(0.12, 8, 6)), hc); b.position.set(0, 0.24, -0.1); head.add(b); }
  if (L.hair === 'ponytail') { const p = M(g('tail', () => new THREE.CylinderGeometry(0.06, 0.03, 0.42, 6)), hc); p.position.set(0, -0.08, -0.3); p.rotation.x = 0.45; head.add(p); }
  if (L.hair === 'spiky') { for (let i = 0; i < 5; i++) { const c = M(g('spike', () => new THREE.ConeGeometry(0.06, 0.16, 4)), hc); c.position.set((i - 2) * 0.08, 0.24, -0.02 - Math.abs(i - 2) * 0.03); c.rotation.z = (i - 2) * -0.25; head.add(c); } }

  // เครื่องประดับ
  const ac = L.accColor || '#ff8fb1';
  if (L.acc === 'flower') { [[0.2, 0.12, 0.05], [0.23, 0.08, 0.1], [0.18, 0.06, 0.13]].forEach(p => { const f = M(g('flw', () => new THREE.IcosahedronGeometry(0.045, 0)), ac); f.position.set(...p); head.add(f); }); }
  if (L.acc === 'headband') { const t = M(g('band', () => new THREE.TorusGeometry(0.235, 0.025, 4, 16)), ac); t.position.y = 0.09; t.rotation.x = Math.PI / 2 - 0.35; head.add(t); }
  if (L.acc === 'necklace') { const t = M(g('neckl', () => new THREE.TorusGeometry(0.14, 0.015, 4, 14)), '#ffd60a'); t.position.y = 1.35; t.rotation.x = Math.PI / 2 - 0.2; body.add(t); }
  if (L.acc === 'hat') { const b = M(g('brim', () => new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12)), '#d9b26f'); b.position.y = 0.2; head.add(b); const c = M(g('hatc', () => new THREE.ConeGeometry(0.24, 0.22, 10)), '#c99a50'); c.position.y = 0.32; head.add(c); }
  if (L.acc === 'glasses') { for (const s of [1, -1]) { const r = M(g('lens', () => new THREE.TorusGeometry(0.055, 0.012, 4, 10)), '#222'); r.position.set(s * 0.08, 0.02, 0.225); head.add(r); } const br = M(box(0.06, 0.012, 0.01), '#222'); br.position.set(0, 0.03, 0.23); head.add(br); }

  // ป้ายชื่อห้อยคอ (ครู/บุคลากร)
  if (L.badge) { for (const s of [1, -1]) { const st = M(box(0.025, 0.3, 0.012), L.badgeColor || '#1f3a6b'); st.position.set(s * 0.06, 1.2, 0.165); st.rotation.z = s * -0.3; body.add(st); }
    const card = M(box(0.12, 0.15, 0.015), '#ffffff'); card.position.set(0, 1.02, 0.17); body.add(card); const stripe = M(box(0.12, 0.035, 0.017), L.badgeColor || '#1f3a6b'); stripe.position.set(0, 1.08, 0.17); body.add(stripe); }
  if (L.body === 'm') root.scale.setScalar(1.04); if (L.body === 'f') root.scale.setScalar(0.98);

  // จุดยึดสำหรับถือกระทง
  const hands = new THREE.Group(); hands.position.set(0, 0.95, 0.42); body.add(hands);

  root.userData = { body, legs, arms, head, hands, look: L, anim: { mode: 'idle', t: Math.random() * 10, holding: false, tray: false }, heading: 0 };
  return root;
}

/** อัปเดตแอนิเมชันตามสถานะ */
export function animateAvatar(av, dt) {
  const u = av.userData, a = u.anim; a.t += dt; const t = a.t;
  const [lL, lR] = u.legs, [aL, aR] = u.arms;
  let bodyY = 0, bodyRX = 0, legX = 0, armLX = 0, armRX = 0, armRZ = 0, armLZ = 0;
  if (a.mode === 'walk') { const s = Math.sin(t * 9); legX = s * 0.6; armLX = -s * 0.5; armRX = s * 0.5; bodyY = Math.abs(Math.cos(t * 9)) * 0.05; }
  else if (a.mode === 'kneel') { bodyY = -0.33; bodyRX = 0.35; armLX = armRX = -0.9; }
  else { bodyY = Math.sin(t * 2) * 0.012; armLZ = 0.05; armRZ = -0.05; }
  if (a.mode === 'wave') { armRZ = -2.6 + Math.sin(t * 10) * 0.3; armRX = 0; }
  if (a.holding && a.mode !== 'kneel') { armLX = armRX = a.tray ? -0.85 : -1.1; armLZ = -0.12; armRZ = 0.12; }
  u.body.position.y = bodyY; u.body.rotation.x = bodyRX;
  if (a.mode === 'kneel') { lL.rotation.x = -1.25; lR.rotation.x = 0.4; } else { lL.rotation.x = legX; lR.rotation.x = -legX; }
  aL.rotation.set(armLX, 0, armLZ); aR.rotation.set(armRX, 0, armRZ);
  // หันหน้าอย่างนุ่มนวล
  let d = u.heading - av.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); av.rotation.y += d * Math.min(1, dt * 10);
}

/** ป้ายชื่อเหนือศีรษะ */
export function makeLabel(text, sub = '', color = '#ffd166') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.font = 'bold 44px Mitr, Sarabun, sans-serif'; const w = Math.min(500, Math.max(x.measureText(text).width, sub ? 200 : 0) + 50);
  x.fillStyle = 'rgba(15,12,40,.78)'; const r = 28, X = (512 - w) / 2, H = sub ? 116 : 70;
  x.beginPath(); x.roundRect(X, 4, w, H, r); x.fill(); x.strokeStyle = color; x.lineWidth = 4; x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 40);
  if (sub) { x.font = '30px Mitr, Sarabun, sans-serif'; x.fillStyle = color; x.fillText(sub, 256, 90); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(2.2, 0.55, 1); s.renderOrder = 10; return s;
}
