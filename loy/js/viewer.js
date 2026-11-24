/* ============================================================
   ตัวแสดงผล 3 มิติขนาดเล็ก: บ่อทดลอง / ดูกระทงระยะใกล้ / ตัวอย่างตัวละคร
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildKrathong, animateKrathong, computeStats } from './krathong.js';

export class Viewer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.active = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!opts.transparent });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene(); if (!opts.transparent) this.scene.background = new THREE.Color(opts.bg || '#14123a');
    this.scene.add(new THREE.HemisphereLight('#c9d6ff', '#3a2a1a', 1.1)); const d = new THREE.DirectionalLight('#fff1d6', 1.5); d.position.set(3, 5, 4); this.scene.add(d);
    const p = new THREE.PointLight('#ffb347', 5, 8); p.position.set(-2, 2, 2); this.scene.add(p);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60); this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minDistance = opts.minD || 1.5; this.controls.maxDistance = opts.maxD || 7; this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.holder = new THREE.Group(); this.scene.add(this.holder); this.ripples = [];
    new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize() { const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  clear() { this.holder.clear(); if (this.water) { this.scene.remove(this.water); this.water = null; } if (this.refl) { this.scene.remove(this.refl); this.refl = null; } }
  /** แสดงกระทงจากข้อมูลชิ้นงาน (water=true คือบ่อทดลอง) */
  showKrathong(design, { water = false, reflections = true, target = 0.35, dist = [2.6, 2.2, 3.0] } = {}) {
    this.clear(); this.kind = 'krathong'; this.k = buildKrathong(design); this.holder.add(this.k); this.stats = computeStats(design); this.waterOn = water;
    if (water) {
      this.water = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.MeshStandardMaterial({ color: '#1b5e8c', roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.88 }));
      this.water.rotation.x = -Math.PI / 2; this.water.position.y = 0.1; this.scene.add(this.water);
      if (reflections) { this.refl = this.k.clone(true); this.refl.traverse(o => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.28; } }); this.refl.scale.y = -1; this.scene.add(this.refl); }
      this.t0 = performance.now(); for (let i = 0; i < 3; i++) setTimeout(() => this.ripple(), 200 + i * 350);
    }
    this.camera.position.set(...dist); this.controls.target.set(0, target, 0); this.controls.update(); this.start();
  }
  showObject(obj, { target = 0.9, dist = [0, 1.3, 3.6], spin = true } = {}) { this.clear(); this.kind = 'object'; this.spin = spin; this.holder.add(obj); this.camera.position.set(...dist); this.controls.target.set(0, target, 0); this.controls.update(); this.start(); }
  ripple() { if (!this.water) return; const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.96, 40), new THREE.MeshBasicMaterial({ color: '#cdeffd', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.11; this.scene.add(m); this.ripples.push({ m, t: 0 }); }
  setCam(k) { const p = { top: [0, 4.5, 0.01], front: [0, 0.9, 3.6], side: [2.6, 2.2, 3] }[k] || [2.6, 2.2, 3]; this.camera.position.set(...p); this.controls.update(); }
  start() { this.resize(); if (this.active) return; this.active = true; let last = performance.now();
    const loop = (now) => { if (!this.active) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000; this.controls.update();
      if (this.kind === 'krathong' && this.k) { animateKrathong(this.k, t);
        if (this.waterOn) { const s = this.stats, e = Math.min(1, (now - this.t0) / 1200); const bob = Math.sin(t * 1.7) * 0.03; this.k.position.y = 0.1 - 0.08 * BASEDRAFT(s) + bob + (1 - e) * 0.35;
          this.k.rotation.x = Math.cos(s.tiltDir) * s.tilt * e + Math.sin(t * 1.3) * 0.03; this.k.rotation.z = -Math.sin(s.tiltDir) * s.tilt * e + Math.cos(t * 1.1) * 0.03; this.k.rotation.y += dt * 0.08;
          if (this.refl) { this.refl.position.set(0, 0.2 - (this.k.position.y - 0.1), 0); this.refl.rotation.set(-this.k.rotation.x, this.k.rotation.y, -this.k.rotation.z); } } }
      if (this.kind === 'object' && this.spin) this.holder.rotation.y += dt * 0.5;
      for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.t += dt; r.m.scale.setScalar(1 + r.t * 1.6); r.m.material.opacity = Math.max(0, 0.7 - r.t * 0.35); if (r.t > 2) { this.scene.remove(r.m); this.ripples.splice(i, 1); } }
      this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    requestAnimationFrame(loop); }
  stop() { this.active = false; }
}
// ความลึกที่จมน้ำแบบจำลองอย่างง่าย (ยิ่งหนักยิ่งจมมาก) — เพื่อการเรียนรู้เท่านั้น
function BASEDRAFT(s) { return Math.min(1.4, 0.6 + s.weight / 60); }
