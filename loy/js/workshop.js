/* ============================================================
   โต๊ะประดิษฐ์กระทง 3 มิติ
   ถาดวัสดุ (ซ้าย) · พื้นที่ 3 มิติ (กลาง) · เครื่องมือ (ขวา) · แถบล่าง
   วาง ย้าย หมุน/เอียง (พิมพ์องศาได้) ปรับขนาด/ความสูง ทำสำเนา ลบ เปลี่ยนสี
   เรียงรอบฐาน · จุดศูนย์ถ่วง · กลไกเฟือง/รอก · วงจรไฟฟ้า/เซ็นเซอร์
   วัตถุดิบของฉัน (จากโต๊ะช่าง) · ชิ้นส่วนจากภาพร่าง · บันทึกภาพ
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MATERIALS, CATS, BASES, BASE_TOP, MAX_PIECES, GEAR_MODULE, makeBase, buildPiece, makeExtras, setupAnim, animateKrathong, evalCircuit, mechInfo, computeStats, insideBase, sanitizeDesign, sanitizeSketch, cloneDesign, uid } from './krathong.js';
import { openKnowledge, openCuttingTable, openSketchPad, drawBalance, PALETTE as SK_PALETTE } from './dt.js';

const PALETTE = ['#ff8fb1', '#ffc2d1', '#fff0f3', '#ff9f1c', '#ffd60a', '#e63946', '#b5179e', '#7b2cbf', '#4cc9f0', '#2a9d8f', '#ffffff', '#ffcf6b'];
const BASE_COLORS = ['#5e9c4c', '#3f7f35', '#7fb069', '#a3b18a', '#d4a373'];
const deg = (r) => Math.round(r * 180 / Math.PI), rad = (d) => d * Math.PI / 180;
const wrap180 = (d) => ((Math.round(d) + 540) % 360) - 180;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const usedCount = (d) => { const o = {}; for (const p of d.pieces) if (MATERIALS[p.m]?.inv) o[p.m] = (o[p.m] || 0) + 1; return o; };

export class Workshop {
  constructor(host, toast) {
    this.host = host; this.toast = toast || (() => {}); this.open_ = false; this.simDay = false;
    host.innerHTML = `
    <div class="ws">
      <div class="ws-top"><span class="ws-title">🪷 โต๊ะประดิษฐ์ 3 มิติ</span>
        <input class="ws-name" maxlength="40" placeholder="ตั้งชื่อกระทง">
        <span class="ws-steps">เลือกฐาน → เพิ่มกลีบ → ตกแต่ง/กลไก/ไฟ → ตรวจสมดุล → ทดลองลอย</span>
        <button class="tb" data-top="know" title="ความรู้ วิชาการออกแบบและเทคโนโลยี">📘<span> ความรู้</span></button>
        <button class="tb" data-top="sketch" title="วาดชิ้นส่วนเอง">✏️<span> วาดชิ้นส่วน</span></button>
        <button class="tb" data-top="cut" title="โต๊ะช่าง ตัดกลีบใบตอง">✂️<span> โต๊ะช่าง</span></button>
        <button class="ib ws-help" title="วิธีใช้">❔</button><button class="ib ws-close" title="ปิด">✕</button></div>
      <aside class="ws-tray"><div class="ws-cats"></div><div class="ws-items"></div></aside>
      <div class="ws-stage"><canvas></canvas>
        <div class="ws-modes"><button data-mode="move" class="on">🖐 ย้าย</button><button data-mode="camera">🎥 หมุนกล้อง</button><button data-multi class="">☑ หลายชิ้น</button></div>
        <div class="ws-cams"><button data-cam="top">มุมบน</button><button data-cam="front">มุมหน้า</button><button data-cam="side">มุมเฉียง</button><button data-cam="reset">⟲</button></div>
        <div class="ws-hint"></div><div class="ws-count"></div><div class="ws-bal"></div>
        <div class="ws-mob"><button data-open="tray">🧺 วัสดุ</button><button data-open="tools">🛠 ปรับแต่ง</button></div>
      </div>
      <aside class="ws-tools"></aside>
      <div class="ws-bottom"><button data-act="undo">↶ ย้อนกลับ</button><button data-act="redo">↷ ทำซ้ำ</button><span class="sp"></span>
        <button data-act="photo">📸 บันทึกภาพ</button><button data-act="save">💾 บันทึกร่าง</button><button data-act="test" class="pri2">🌊 ทดลองลอย</button><button data-act="done" class="pri">✅ เสร็จสิ้น</button></div>
      <div class="ws-coach hidden"><div><h3>วิธีใช้โต๊ะประดิษฐ์</h3><ol>
        <li><b>เลือกฐาน</b> ที่หมวด "ฐานกระทง"</li><li><b>แตะวัสดุ</b> ในถาด แล้ว<b>แตะบนฐาน</b>เพื่อวาง (บนมือถือกด 🧺 วัสดุ)</li>
        <li>โหมด <b>🖐 ย้าย</b>: แตะเลือกแล้วลาก · <b>🎥 หมุนกล้อง</b>: ลากเพื่อหมุนมุมมอง</li>
        <li>แผง <b>🛠 ปรับแต่ง</b>: พิมพ์องศาการหมุน/เอียงได้ ดู <b>⚖️ จุดศูนย์ถ่วง</b> ต่อ <b>⚡ วงจรไฟฟ้า</b> และดู <b>⚙️ อัตราทดเฟือง</b></li>
        <li>ไม่มีชิ้นที่ต้องการ? กด <b>✏️ วาดชิ้นส่วน</b> · อยากได้กลีบพิเศษ? ไป <b>✂️ โต๊ะช่าง</b> เลือกเครื่องมือตัดใบตอง</li>
        <li>กด <b>🌊 ทดลองลอย</b> แล้ว <b>✅ เสร็จสิ้น</b> — ตัวละครจะถือกระทงนี้ไว้</li></ol>
        <button class="btn">เริ่มประดิษฐ์</button></div></div>
    </div>`;
    this.$ = (s) => host.querySelector(s);
    this.canvas = this.$('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color('#1d1845');
    S.add(new THREE.HemisphereLight('#c9d6ff', '#4a3520', 1.1)); const dl = new THREE.DirectionalLight('#fff1d6', 1.6); dl.position.set(3, 6, 4); S.add(dl);
    const pl = new THREE.PointLight('#ffb347', 6, 8); pl.position.set(-2, 2.5, 2); S.add(pl);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.2, 32), new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.8 })); table.position.y = -0.1; S.add(table); this.table = table;
    const grid = new THREE.PolarGridHelper(1.9, 16, 4, 48, '#5c3d2e', '#5c3d2e'); grid.position.y = 0.002; S.add(grid); this.grid = grid;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.target.set(0, 0.35, 0); this.controls.enableDamping = true; this.controls.minDistance = 1.4; this.controls.maxDistance = 7; this.controls.maxPolarAngle = Math.PI / 2 - 0.04; this.controls.enablePan = false;
    this.root = new THREE.Group(); S.add(this.root); this.helpers = new THREE.Group(); S.add(this.helpers); this.ghosts = new THREE.Group(); S.add(this.ghosts);
    // เครื่องหมายจุดศูนย์ถ่วง
    this.com = new THREE.Group(); const cm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff3b5c', depthTest: false })); cm.renderOrder = 20; this.com.add(cm);
    const cr = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 24), new THREE.MeshBasicMaterial({ color: '#ff3b5c', side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.8 })); cr.rotation.x = -Math.PI / 2; cr.renderOrder = 20; this.com.add(cr); S.add(this.com);
    this.comLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ff3b5c', depthTest: false })); this.comLine.renderOrder = 20; S.add(this.comLine);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.mode = 'move'; this.multi = false; this.cat = 'base'; this.snap = true; this.showCom = true;
    this.bindUI(); this.bindPointer(); this.setCam('side');
    new ResizeObserver(() => this.resize()).observe(this.$('.ws-stage'));
  }

  /* ---------- เปิด/ปิด ---------- */
  open(design, opts = {}) {
    this.opts = opts; this.disabled = new Set(opts.disabled || []);
    this.d = sanitizeDesign(cloneDesign(design)); this.sel = new Set(); this.history = []; this.future = []; this.placing = null; this.arr = null;
    this.inv = { ...(opts.inv?.() || {}) }; this.invBase = usedCount(this.d);
    this.$('.ws-name').value = this.d.name; this.host.classList.add('show'); this.open_ = true; this.rebuild(); this.renderTray(); this.renderTools(); this.commit(true);
    this.resize(); this.setCam(innerWidth < innerHeight ? 'front' : 'side'); if (!localStorage.getItem('loy_ws_coach2')) this.$('.ws-coach').classList.remove('hidden');
    const loop = () => { if (!this.open_) return; this.controls.update(); for (const h of this.helpers.children) h.update?.(); animateKrathong(this.root, performance.now() / 1000); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); }; loop();
  }
  close() { this.open_ = false; this.host.classList.remove('show'); this.host.querySelector('.ws').classList.remove('open-tray', 'open-tools'); }
  resize() { const st = this.$('.ws-stage'), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setCam(k) { const port = this.camera.aspect < 0.8 ? 1.35 : 1; const pos = { top: [0, 5.2, 0.01], front: [0, 1.3, 4.4], side: [3, 3.1, 3.4], reset: [3, 3.1, 3.4] }[k]; this.camera.position.set(...pos.map(v => v * port)); this.controls.target.set(0, 0.35, 0); this.controls.update(); }

  /* ---------- สร้างโมเดลจากข้อมูล ---------- */
  env() { return { dark: !this.simDay, sun: this.simDay, water: false }; }
  sig(ctx) { return [ctx.lit, ctx.on, ctx.motorOn, ctx.blink].join(); }
  rebuild() {
    this.root.clear(); this.objs = new Map(); this.ctx = evalCircuit(this.d, this.env()); this.baseObj = makeBase(this.d.base, this.d.baseColor); this.root.add(this.baseObj);
    for (const p of this.d.pieces) this.addObj(p); this.refreshDerived(true); this.updateHelpers(); this.updateWarnings();
    this.$('.ws-count').textContent = `${this.d.pieces.length}/${MAX_PIECES} ชิ้น`;
  }
  /** สายไฟ สายพาน แอนิเมชันกลไก จุดศูนย์ถ่วง (คำนวณใหม่หลังแก้ไข) */
  refreshDerived(fromRebuild = false) {
    const ctx = evalCircuit(this.d, this.env()); if (!fromRebuild && this.sig(ctx) !== this.sig(this.ctx || {})) { this.ctx = ctx; return this.rebuild(); } this.ctx = ctx;
    if (this.extras) this.root.remove(this.extras); this.extras = makeExtras(this.d, ctx); this.root.add(this.extras); setupAnim(this.root, this.d, ctx);
    const st = computeStats(this.d); this.stats = st; this.com.visible = this.showCom; this.com.position.set(st.cx, BASE_TOP + 0.03, st.cz);
    const g = this.comLine.geometry; g.setFromPoints([new THREE.Vector3(0, BASE_TOP + 0.03, 0), new THREE.Vector3(st.cx, BASE_TOP + 0.03, st.cz)]); this.comLine.visible = this.showCom;
    const b = this.$('.ws-bal'); b.className = 'ws-bal ' + (st.offset < 0.12 ? 'ok' : st.offset < 0.3 ? 'mid' : 'bad'); b.innerHTML = `⚖️ ${st.balance}`;
  }
  addObj(p) { const o = buildPiece(p, this.d, this.ctx); if (!o) return; o.traverse(c => c.userData.pid = p.id); this.root.add(o); this.objs.set(p.id, o); }
  refreshObj(p) { const o = this.objs.get(p.id); if (!o) return; o.position.set(...p.p); o.rotation.set(p.r[0], p.r[1], p.r[2]); o.scale.setScalar(p.s); }
  rebuildObj(p) { const o = this.objs.get(p.id); if (o) this.root.remove(o); this.addObj(p); }
  piece(id) { return this.d.pieces.find(p => p.id === id); }
  selected() { return this.d.pieces.filter(p => this.sel.has(p.id)); }
  updateHelpers() { this.helpers.clear(); for (const id of this.sel) { const o = this.objs.get(id); if (o) { const h = new THREE.BoxHelper(o, '#ffd60a'); this.helpers.add(h); } } }

  /* ---------- วัตถุดิบของฉัน (นับเฉพาะส่วนที่ใช้เพิ่มจากตอนเปิด) ---------- */
  available(m) { const used = usedCount(this.d); return (this.inv[m] || 0) - ((used[m] || 0) - (this.invBase[m] || 0)); }
  canUse(m, n = 1) { if (!MATERIALS[m]?.inv) return true; if (this.available(m) >= n) return true; this.toast(`${MATERIALS[m].name} ไม่พอ (เหลือ ${Math.max(0, this.available(m))}) — ไปตัดเพิ่มที่ ✂️ โต๊ะช่าง`); return false; }
  syncInv() { const used = usedCount(this.d), all = new Set([...Object.keys(used), ...Object.keys(this.invBase)]); for (const m of all) this.inv[m] = Math.max(0, (this.inv[m] || 0) - ((used[m] || 0) - (this.invBase[m] || 0))); this.invBase = used; this.opts.onInv?.({ ...this.inv }); }

  /* ---------- ประวัติ ย้อนกลับ/ทำซ้ำ ---------- */
  snapshot() { return JSON.stringify({ base: this.d.base, baseColor: this.d.baseColor, pieces: this.d.pieces, sketches: this.d.sketches, circuit: this.d.circuit, name: this.d.name }); }
  commit(init = false) { const s = this.snapshot(); if (this.history[this.history.length - 1] === s) return; this.history.push(s); if (this.history.length > 80) this.history.shift(); if (!init) this.future = [];
    if (!init) this.refreshDerived(); this.updateWarnings(); this.$('.ws-count').textContent = `${this.d.pieces.length}/${MAX_PIECES} ชิ้น`; this.dirty = !init || this.dirty; if (!init) this.renderSide(); }
  restore(s) { const o = JSON.parse(s); Object.assign(this.d, o); this.sel = new Set([...this.sel].filter(id => this.piece(id))); this.rebuild(); this.renderTools(); this.renderTray(); this.$('.ws-name').value = this.d.name; }
  undo() { if (this.history.length < 2) return this.toast('ย้อนกลับไม่ได้แล้ว'); this.future.push(this.history.pop()); this.restore(this.history[this.history.length - 1]); }
  redo() { if (!this.future.length) return this.toast('ไม่มีขั้นตอนให้ทำซ้ำ'); const s = this.future.pop(); this.history.push(s); this.restore(s); }

  /* ---------- พื้นผิวรองรับ (สำหรับวางชิดพื้นผิว) ---------- */
  support(x, z, exclude = new Set()) {
    this.root.updateMatrixWorld(true);
    const targets = [this.baseObj, ...[...this.objs].filter(([id]) => !exclude.has(id)).map(([, o]) => o)];
    this.ray.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0)); this.ray.camera = this.camera; this.ray.far = 10;
    const hit = this.ray.intersectObjects(targets, true).find(h => h.object.type === 'Mesh'); this.ray.far = Infinity;
    return hit ? hit.point.y : 0;
  }
  snapPieces(list) { const ex = new Set(list.map(p => p.id)); for (const p of list) { p.p[1] = Math.max(0, this.support(p.p[0], p.p[2], ex)); this.refreshObj(p); } }
  updateWarnings() {
    const out = []; if (!this.objs) return;
    for (const p of this.d.pieces) { const def = MATERIALS[p.m]; if (!insideBase(this.d.base, p.p[0], p.p[2], 0.1)) out.push({ id: p.id, text: `${def.name}: อยู่นอกฐาน` });
      else { const sy = this.support(p.p[0], p.p[2], new Set([p.id])); if (p.p[1] - sy > 0.07) out.push({ id: p.id, text: `${def.name}: ลอยอยู่ ไม่ติดชิ้นอื่น` }); } }
    this.warnings = out; this.renderWarnings();
  }

  /* ---------- ส่วนติดต่อ ---------- */
  bindUI() {
    const $ = this.$;
    $('.ws-close').onclick = () => { if (this.dirty && !confirm('ออกจากโต๊ะประดิษฐ์? ระบบจะบันทึกร่างให้อัตโนมัติ')) return; this.save(true); this.opts.onClose?.(); this.close(); };
    $('.ws-help').onclick = () => $('.ws-coach').classList.remove('hidden');
    $('.ws-coach .btn').onclick = () => { $('.ws-coach').classList.add('hidden'); try { localStorage.setItem('loy_ws_coach2', '1'); } catch (e) {} };
    $('.ws-name').addEventListener('change', e => { this.d.name = e.target.value.trim().slice(0, 40) || 'กระทงของฉัน'; this.commit(); });
    this.host.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.mode = b.dataset.mode; this.host.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b)); this.controls.enableRotate = this.mode === 'camera'; this.hint(); });
    this.controls.enableRotate = false;
    $('[data-multi]').onclick = (e) => { this.multi = !this.multi; e.currentTarget.classList.toggle('on', this.multi); this.hint(); };
    this.host.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => this.setCam(b.dataset.cam));
    this.host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const k = b.dataset.open, ws = this.host.querySelector('.ws'); ws.classList.toggle('open-' + k); ws.classList.remove(k === 'tray' ? 'open-tools' : 'open-tray'); });
    this.host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => this.act(b.dataset.act));
    this.host.querySelectorAll('[data-top]').forEach(b => b.onclick = () => ({ know: () => openKnowledge(), sketch: () => this.openSketch(), cut: () => this.openCut() })[b.dataset.top]());
    addEventListener('keydown', e => { if (!this.open_ || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.querySelector('.dt-modal')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { this.del(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? this.redo() : this.undo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { this.redo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { this.dup(); e.preventDefault(); }
      if (e.key === 'Escape') { this.cancelPlacing(); this.sel.clear(); this.updateHelpers(); this.renderTools(); } });
  }
  openCut() { openCuttingTable({ inv: () => this.inv, toast: this.toast, onStore: (m, n) => { this.inv[m] = (this.inv[m] || 0) + n; this.opts.onInv?.({ ...this.inv }); this.cat = 'mine'; this.renderTray(); } }); }
  openSketch() { openSketchPad({ toast: this.toast, makePreview: (box, sk, c) => this.opts.sketchPreview?.(box, sk, c),
    onCreate: (sk) => { this.opts.onSketch?.(sk); this.cat = 'sketch'; this.renderTray(); this.startPlacing('sketch', { sk }); this.toast(`สร้าง "${sk.name}" แล้ว — แตะบนฐานเพื่อวาง`); } }); }
  hint(t) { const h = this.$('.ws-hint'); if (t) { h.innerHTML = t; return; }
    const nm = this.placing ? (this.placing === 'sketch' ? this.placingExtra?.sk?.name : MATERIALS[this.placing].name) : '';
    h.innerHTML = this.placing ? `แตะบนฐานเพื่อวาง <b>${esc(nm)}</b> <button data-center>วางกึ่งกลาง</button> <button data-cancel>ยกเลิก</button>` : this.mode === 'move' ? (this.multi ? 'แตะหลายชิ้นเพื่อเลือกเป็นกลุ่ม แล้วลากเพื่อย้ายพร้อมกัน' : 'แตะเลือกชิ้นส่วน แล้วลากเพื่อย้าย') : 'ลากเพื่อหมุนกล้อง · บีบนิ้ว/เลื่อนเพื่อซูม';
    h.querySelector('[data-center]')?.addEventListener('click', () => this.placeAt(0, 0));
    h.querySelector('[data-cancel]')?.addEventListener('click', () => this.cancelPlacing()); }
  renderTray() {
    const cats = this.$('.ws-cats'); cats.innerHTML = CATS.map(([k, n, i]) => `<button data-cat="${k}" class="${k === this.cat ? 'on' : ''}" title="${n}">${i}<span>${n.split(' ')[0]}</span></button>`).join('');
    cats.querySelectorAll('button').forEach(b => b.onclick = () => { this.cat = b.dataset.cat; this.renderTray(); });
    const it = this.$('.ws-items'); const closeTray = () => this.host.querySelector('.ws').classList.remove('open-tray');
    if (this.cat === 'base') {
      it.innerHTML = `<div class="ws-sub">รูปทรงฐาน</div>${Object.entries(BASES).map(([k, b]) => `<button class="ws-item ${this.d.base === k ? 'on' : ''}" data-base="${k}"><span class="ic">${b.icon}</span>${b.name}</button>`).join('')}
        <div class="ws-sub">สีฐาน</div><div class="sw">${BASE_COLORS.map(c => `<button data-bc="${c}" style="background:${c}" class="${this.d.baseColor === c ? 'on' : ''}"></button>`).join('')}</div>
        <p class="ws-note">ฐานจริงนิยมทำจากหยวกกล้วยหรือขนมปัง ซึ่งย่อยสลายได้ · ฐานกว้างช่วยให้ทรงตัวดีกว่าฐานแคบ</p>`;
      it.querySelectorAll('[data-base]').forEach(b => b.onclick = () => { this.d.base = b.dataset.base; this.rebuild(); this.commit(); this.renderTray(); });
      it.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => { this.d.baseColor = b.dataset.bc; this.rebuild(); this.commit(); this.renderTray(); });
      return;
    }
    if (this.cat === 'mine') {
      const list = Object.entries(MATERIALS).filter(([id, m]) => m.inv && !this.disabled.has(id));
      it.innerHTML = `<p class="ws-note" style="margin-top:0">กลีบที่คุณตัดเองที่ ✂️ โต๊ะช่าง · ใช้ 1 ชิ้น จำนวนลดลง 1 (ลบออกได้คืน)</p>` + list.map(([id, m]) => { const n = Math.max(0, this.available(id));
        return `<button class="ws-item ${this.placing === id ? 'on' : ''}" data-mat="${id}" ${n ? '' : 'disabled'}><span class="ic">${m.icon}</span>${m.name}<em class="cnt">× ${n}</em></button>`; }).join('') +
        `<button class="ws-item cutbtn" data-cutopen><span class="ic">✂️</span>ไปโต๊ะช่าง ตัดกลีบเพิ่ม</button>`;
      it.querySelector('[data-cutopen]').onclick = () => this.openCut();
    } else if (this.cat === 'sketch') {
      const lib = this.opts.sketches?.() || [];
      it.innerHTML = `<button class="ws-item cutbtn" data-skopen><span class="ic">✏️</span>วาดชิ้นส่วนใหม่</button>` + (lib.length ? lib.map(s => `<button class="ws-item" data-sk="${s.id}"><img src="${s.img || ''}" alt="" class="skimg">${esc(s.name)}<em>${{ flower: 'ดอกไม้', extrude: 'แผ่นตัด', lathe: 'ทรงกลึง' }[s.k]}</em></button>`).join('') : '') +
        `<p class="ws-note">วาดสิ่งที่ไม่มีในถาด เช่น ดอกไม้ ใบไม้ ดาว แจกัน ระบบจะสร้างเป็น 3 มิติตามภาพ และเลือกสีได้</p>`;
      it.querySelector('[data-skopen]').onclick = () => this.openSketch();
      it.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => { const sk = lib.find(s => s.id === b.dataset.sk); this.startPlacing('sketch', { sk }); closeTray(); });
      return;
    } else {
      const list = Object.entries(MATERIALS).filter(([id, m]) => m.cat === this.cat && !m.inv && id !== 'sketch' && !this.disabled.has(id));
      it.innerHTML = list.map(([id, m]) => `<button class="ws-item ${this.placing === id ? 'on' : ''}" data-mat="${id}"><span class="ic">${m.icon}</span>${m.name}${m.fantasy ? '<em>จินตนาการ</em>' : m.tech ? '<em class="tech">ว.ออกแบบฯ</em>' : ''}</button>`).join('') +
        (this.cat === 'leaf' ? '<p class="ws-note">กลีบพิเศษ (กุหลาบ เล็บมือนาง พนม จีบพัด ฉลุลาย) ต้องตัดเองที่ ✂️ โต๊ะช่าง แล้วจะอยู่ใน 🧺 วัตถุดิบของฉัน</p>' : '') +
        (this.cat === 'center' ? '<p class="ws-note">เทียน ธูป และป้ายข้อความ เลือกไม่ใส่ได้ตามความเชื่อ · คำอธิษฐานจะพิมพ์ตอนลอยกระทงและแสดงบนป้ายใบตองของกระทง</p>' : '') +
        (this.cat === 'mech' ? '<p class="ws-note">⚙️ มอเตอร์หรือใบพัดกังหันเป็นต้นกำลัง → เพลา/เฟือง/รอกหมุนตาม · เลือกเฟืองแล้วกำหนดจำนวนฟันได้ · ดูอัตราทดที่แผงปรับแต่ง <button class="linkb" data-k="mech">📘 ความรู้กลไก</button></p>' : '') +
        (this.cat === 'elec' ? '<p class="ws-note">🔌 วางถ่าน + สวิตช์ + LED/มอเตอร์ ระบบต่อสายไฟให้อัตโนมัติ (แดง = ขั้วบวก ดำ = ขั้วลบ) · ตรวจวงจรที่แผงปรับแต่ง <button class="linkb" data-k="elec">📘 ความรู้วงจร</button></p>' : '') +
        (this.cat === 'deco' || this.cat === 'light' ? '<p class="ws-note">ชิ้นที่มีป้าย <em>จินตนาการ</em> เป็นของตกแต่งในเกมเท่านั้น ไม่ใช่คำแนะนำวัสดุสำหรับกระทงจริง</p>' : '');
      it.querySelectorAll('[data-k]').forEach(b => b.onclick = () => openKnowledge(b.dataset.k));
    }
    it.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { this.startPlacing(b.dataset.mat); this.showReal(b.dataset.mat); closeTray(); });
  }
  showReal(id) { const m = MATERIALS[id]; const el = this.$('.ws-real'); if (el) el.innerHTML = `<b>${m.fantasy ? '🎨 ของตกแต่งในเกม' : m.tech ? '🔧 ความรู้' : '🌿 คำแนะนำสำหรับกระทงจริง'}</b><br>${esc(m.real)}`; }
  numRow(k, label, min, max, val, unit = '°', step = 1) {
    return `<label>${label}</label><div class="numrow"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><input type="number" class="num" data-kn="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><span class="u">${unit}</span></div>`;
  }
  renderTools() {
    const t = this.$('.ws-tools'), sel = this.selected();
    let h = '';
    if (!sel.length) h += `<div class="ws-sec"><b>ยังไม่ได้เลือกชิ้นส่วน</b><p class="muted">แตะชิ้นส่วนบนกระทงเพื่อปรับแต่ง หรือเลือกวัสดุจากถาด</p>
      <div class="row"><button data-t="selall">เลือกทั้งหมด</button></div></div>`;
    else {
      const p = sel[0], def = MATERIALS[p.m], one = sel.length === 1, ry = wrap180(deg(p.r[1])), nm = p.m === 'sketch' ? ((this.d.sketches || []).find(s => s.id === p.sk)?.name || def.name) : def.name;
      h += `<div class="ws-sec"><b>${one ? def.icon + ' ' + esc(nm) : `เลือก ${sel.length} ชิ้น`}</b>
        ${this.numRow('ry', '🔄 หมุนรอบตัว (แกนตั้ง)', -180, 180, ry)}
        <div class="qrow"><button data-q="-45">−45°</button><button data-q="-15">−15°</button><button data-q="0">0°</button><button data-q="15">+15°</button><button data-q="45">+45°</button></div>
        ${this.numRow('rx', '↗ มุมเอียงหน้า-หลัง', -90, 90, deg(p.r[0]))}
        ${this.numRow('rz', '↔ มุมเอียงซ้าย-ขวา', -90, 90, deg(p.r[2]))}
        <div class="math" data-rmath>📐 ${ry}° = ${ry} × π ÷ 180 ≈ <b>${(rad(ry)).toFixed(2)} rad</b></div>
        ${this.numRow('s', '📏 ขนาด', def.smin, def.smax, +p.s.toFixed(2), '×', 0.05)}
        ${this.numRow('y', '⬆ ความสูง', 0, 2.4, +p.p[1].toFixed(2), '', 0.01)}
        ${one && p.m === 'gear' ? `${this.numRow('n', '⚙️ จำนวนฟันเฟือง', 6, 40, p.n || 12, 'ฟัน')}<div class="math">รัศมีพิทช์ = โมดูล × N ÷ 2 = ${GEAR_MODULE} × ${p.n || 12} ÷ 2 = <b>${(GEAR_MODULE * (p.n || 12) / 2).toFixed(3)}</b></div>` : ''}
        ${sel.some(x => MATERIALS[x.m].colorable) ? `<div class="ws-sub">${def.colorLabel || 'สี'}</div><div class="sw">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-cc value="${p.c || def.color}"></div>` : ''}
        <div class="grid2"><button data-t="snap">⬇ วางชิดพื้นผิว</button><button data-t="center">◎ จัดกึ่งกลาง</button><button data-t="dup">⧉ ทำสำเนา</button><button data-t="del" class="danger">🗑 ลบ</button><button data-t="selall">เลือกทั้งหมด</button><button data-t="none">ยกเลิกเลือก</button></div></div>`;
    }
    const arrMats = Object.entries(MATERIALS).filter(([id, m]) => !this.disabled.has(id) && id !== 'sketch' && ['leaf', 'flower', 'deco', 'light', 'elec', 'mech'].includes(m.cat) && (!m.inv || this.available(id) > 0));
    h += `<details class="ws-sec" data-arrd ${this.arr ? 'open' : ''}><summary>🔄 เรียงรอบฐาน (สมมาตรแบบรัศมี)</summary>
      <label>ชิ้นต้นแบบ <select data-a="m">${arrMats.map(([id, m]) => `<option value="${id}" ${(this.arr?.m || (sel.length === 1 ? sel[0].m : 'leaf_lotus')) === id ? 'selected' : ''}>${m.icon} ${m.name}${m.inv ? ` (เหลือ ${this.available(id)})` : ''}</option>`).join('')}</select></label>
      <label>จำนวนชิ้น (n)</label><div class="numrow"><input type="range" data-a="n" min="2" max="24" value="${this.arr?.n || 8}"><input type="number" class="num" data-an="n" min="2" max="24" value="${this.arr?.n || 8}"><span class="u">ชิ้น</span></div>
      <label>ระยะจากจุดศูนย์กลาง (r) <span data-av="r"></span><input type="range" data-a="r" min="0.2" max="1.3" step="0.01" value="${this.arr?.r ?? 0.8}"></label>
      <label>มุมเอียงออก</label><div class="numrow"><input type="range" data-a="tilt" min="0" max="80" value="${this.arr?.tilt ?? 25}"><input type="number" class="num" data-an="tilt" min="0" max="80" value="${this.arr?.tilt ?? 25}"><span class="u">°</span></div>
      <label>มุมเริ่มต้น</label><div class="numrow"><input type="range" data-a="start" min="0" max="360" value="${this.arr?.start ?? 0}"><input type="number" class="num" data-an="start" min="0" max="360" value="${this.arr?.start ?? 0}"><span class="u">°</span></div>
      <label class="chk"><input type="checkbox" data-a="fit" ${this.arr?.fit === false ? '' : 'checked'}> เรียงตามรูปฐาน (วงรี/เรือ)</label>
      <div class="math" data-math></div>
      <div class="row"><button data-arr="preview">👁 ดูตัวอย่าง</button><button data-arr="ok" class="pri">ยืนยัน</button><button data-arr="cancel">ยกเลิก</button></div></details>
      <div class="ws-sec" data-side></div>
      <div class="ws-sec ws-warn"></div><div class="ws-sec ws-real"><b>🌿 คำแนะนำสำหรับกระทงจริง</b><br>แตะวัสดุในถาดเพื่อดูคำแนะนำ · กระทงจริงควรใช้วัสดุน้อยชิ้น ไม่ใช้โฟม พลาสติก ลวด หรือหมุดโลหะ</div>`;
    t.innerHTML = h; this.renderWarnings(); this.renderSide();
    // ตัวเลื่อน + ช่องพิมพ์ตัวเลข (ซิงก์กัน)
    t.querySelectorAll('input[data-k]').forEach(inp => { const k = inp.dataset.k, box = t.querySelector(`[data-kn="${k}"]`);
      inp.addEventListener('input', () => { box.value = inp.value; this.applySlider(k, +inp.value); }); inp.addEventListener('change', () => this.afterEdit(k)); });
    t.querySelectorAll('input[data-kn]').forEach(box => { const k = box.dataset.kn, rng = t.querySelector(`[data-k="${k}"]`);
      box.addEventListener('change', () => { let v = +box.value; if (!isFinite(v)) v = +rng.value; v = Math.max(+box.min, Math.min(+box.max, v)); box.value = v; rng.value = v; this.applySlider(k, v); this.afterEdit(k); }); });
    t.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const q = +b.dataset.q, cur = +t.querySelector('[data-kn="ry"]').value, v = q === 0 ? 0 : wrap180(cur + q); t.querySelector('[data-kn="ry"]').value = v; t.querySelector('[data-k="ry"]').value = v; this.applySlider('ry', v); this.afterEdit('ry'); });
    t.querySelectorAll('[data-c]').forEach(b => b.onclick = () => this.setColor(b.dataset.c));
    t.querySelector('[data-cc]')?.addEventListener('change', e => this.setColor(e.target.value));
    t.querySelectorAll('[data-t]').forEach(b => b.onclick = () => ({ snap: () => { this.snapPieces(this.selected()); this.commit(); this.updateHelpers(); this.renderTools(); }, center: () => this.center(), dup: () => this.dup(), del: () => this.del(), selall: () => { this.sel = new Set(this.d.pieces.map(p => p.id)); this.updateHelpers(); this.renderTools(); }, none: () => { this.sel.clear(); this.updateHelpers(); this.renderTools(); } })[b.dataset.t]());
    const readArr = () => { const q = (k) => t.querySelector(`[data-a="${k}"]`); if (!q('m')) return; this.arr = { m: q('m').value, n: +q('n').value, r: +q('r').value, tilt: +q('tilt').value, start: +q('start').value, fit: q('fit').checked };
      t.querySelector('[data-av="r"]').textContent = this.arr.r.toFixed(2); const a = 360 / this.arr.n, A = a.toFixed(1).replace('.0', '');
      t.querySelector('[data-math]').innerHTML = `📐 มุมระหว่างชิ้น = 360° ÷ ${this.arr.n} = <b>${A}°</b><br>ชิ้นที่ k อยู่ที่มุม θ = ${this.arr.start}° + k × ${A}°<br>ตำแหน่ง x = r·sin θ, z = r·cos θ (r = ${this.arr.r.toFixed(2)})<br>สมมาตรการหมุนอันดับ ${this.arr.n}`; };
    t.querySelectorAll('[data-a]').forEach(el => el.addEventListener('input', () => { const bx = t.querySelector(`[data-an="${el.dataset.a}"]`); if (bx) bx.value = el.value; readArr(); if (this.ghosts.children.length) this.previewArrange(); }));
    t.querySelectorAll('[data-an]').forEach(bx => bx.addEventListener('change', () => { const r = t.querySelector(`[data-a="${bx.dataset.an}"]`); let v = Math.max(+bx.min, Math.min(+bx.max, Math.round(+bx.value || +r.value))); bx.value = r.value = v; readArr(); if (this.ghosts.children.length) this.previewArrange(); }));
    t.querySelector('[data-arrd]').addEventListener('toggle', e => { if (e.target.open) readArr(); else this.ghosts.clear(); });
    if (this.arr) readArr();
    t.querySelector('[data-arr="preview"]').onclick = () => { readArr(); this.previewArrange(); };
    t.querySelector('[data-arr="ok"]').onclick = () => { readArr(); this.confirmArrange(); };
    t.querySelector('[data-arr="cancel"]').onclick = () => { this.ghosts.clear(); this.arr = null; this.renderTools(); };
  }
  /** แผงความรู้ด้านข้าง: สมดุล กลไก วงจร (อัปเดตทุกครั้งที่แก้ไข) */
  renderSide() {
    const el = this.$('[data-side]'); if (!el || !this.d) return; const st = this.stats || computeStats(this.d), ctx = this.ctx || evalCircuit(this.d, this.env()), mi = mechInfo(this.d, ctx);
    const hasMech = this.d.pieces.some(p => MATERIALS[p.m]?.cat === 'mech'), f2 = (v) => v.toFixed(2);
    let h = `<details open><summary>⚖️ จุดศูนย์ถ่วงและความสมดุล</summary><canvas class="balcv" width="220" height="170"></canvas>
      <div class="math">x̄ = Σ(m·x) ÷ Σm = ${f2(st.mx)} ÷ ${f2(st.weight)} = <b>${f2(st.cx)}</b><br>z̄ = Σ(m·z) ÷ Σm = ${f2(st.mz)} ÷ ${f2(st.weight)} = <b>${f2(st.cz)}</b><br>น้ำหนักรวม ${f2(st.weight)} หน่วย (ฐาน 10) · ความสูง ${f2(st.height)}</div>
      <p class="bal ${st.offset < 0.12 ? 'ok' : st.offset < 0.3 ? 'mid' : 'bad'}">● ${st.balance}${st.offset >= 0.12 ? ` — ย้ายของหนักไปทาง${st.cx > 0.02 ? 'ซ้าย' : st.cx < -0.02 ? 'ขวา' : ''}${Math.abs(st.cz) > 0.02 ? (st.cz > 0 ? 'ด้านหลัง' : 'ด้านหน้า') : ''} หรือเข้าใกล้กลางฐาน` : ''}</p>
      ${st.height > 1.3 ? '<p class="muted">⚠ กระทงสูงมาก จุดศูนย์ถ่วงสูง ล้มง่ายขึ้น</p>' : ''}
      <label class="chk"><input type="checkbox" data-showcom ${this.showCom ? 'checked' : ''}> แสดงจุดศูนย์ถ่วง (จุดแดง) บนกระทง</label>
      <button class="linkb" data-k="balance">📘 ความรู้การจัดวางเพื่อความสมดุล</button></details>`;
    if (hasMech) { const g = mi.gears, pl = mi.pulleys, rpmS = (w) => mi.rpm(w);
      h += `<details open><summary>⚙️ กลไก เพลา เฟือง รอก</summary><p>ต้นกำลัง: <b>${mi.src ? mi.srcName : 'ยังไม่มี'}</b>${mi.src ? ` · ${rpmS(mi.w0)} รอบ/นาที (จำลอง)` : ' — เพิ่มมอเตอร์ (ต่อวงจรไฟให้ทำงาน) หรือใบพัดกังหัน'}</p>
        ${g.length ? `<table class="t mini"><tr><th>เฟือง</th><th>ฟัน</th><th>รอบ/นาที</th><th>ทิศ</th></tr>${g.map((p, i) => `<tr><td>${i ? `ตัวที่ ${i + 1}` : 'ตัวขับ'}</td><td>${p.n || 12}</td><td>${mi.src ? rpmS(mi.speeds[p.id]) : 0}</td><td>${mi.src ? (mi.speeds[p.id] >= 0 ? '↻' : '↺') : '–'}</td></tr>`).join('')}</table>` : ''}
        ${g.length >= 2 ? `<div class="math">อัตราทด = ฟันเฟืองตาม ÷ ฟันเฟืองขับ = ${g[1].n || 12} ÷ ${g[0].n || 12} = <b>${((g[1].n || 12) / (g[0].n || 12)).toFixed(2)} : 1</b><br>${(g[1].n || 12) > (g[0].n || 12) ? 'เฟืองตามหมุนช้าลง แต่แรงบิดมากขึ้น' : (g[1].n || 12) < (g[0].n || 12) ? 'เฟืองตามหมุนเร็วขึ้น แต่แรงบิดน้อยลง' : 'ความเร็วเท่ากัน'} · เฟืองที่ขบกันหมุนสวนทางกัน</div>` : g.length === 1 ? '<p class="muted">เพิ่มเฟืองอีกตัวเพื่อดูอัตราทด</p>' : ''}
        ${pl.length >= 2 ? `<div class="math">รอก: อัตราทด = Dตาม ÷ Dขับ = ${f2(pl[1].s)} ÷ ${f2(pl[0].s)} = <b>${(pl[1].s / pl[0].s).toFixed(2)} : 1</b> · รอกคล้องสายพานหมุนทางเดียวกัน</div>` : pl.length === 1 ? '<p class="muted">เพิ่มรอกอีกตัว ระบบจะคล้องสายพานให้อัตโนมัติ</p>' : ''}
        <button class="linkb" data-k="mech">📘 ความรู้กลไก</button></details>`; }
    if (ctx.any) {
      h += `<details open><summary>⚡ วงจรไฟฟ้าและเซ็นเซอร์</summary><div class="circ ${ctx.powered ? 'on' : 'off'}">${ctx.powered ? '💡 วงจรทำงาน กระแสไหลครบวงจร' : '⭕ วงจรยังไม่ทำงาน'}</div>
        <ul class="steps">${ctx.steps.map(([s, x]) => `<li class="s${s === '✓' ? 'ok' : s === '✗' ? 'bad' : 'mid'}"><b>${s}</b> ${esc(x)}</li>`).join('')}</ul>
        ${ctx.powered ? `<div class="math">กระแสโดยประมาณ I ≈ ${ctx.current.toFixed(2)} A · กำลังไฟฟ้า P = V × I = ${ctx.volts.toFixed(1)} × ${ctx.current.toFixed(2)} ≈ <b>${(ctx.volts * ctx.current).toFixed(2)} W</b></div>` : ''}
        ${ctx.warn.map(w => `<p class="muted">⚠ ${esc(w)}</p>`).join('')}
        <div class="row">${ctx.n.switch ? `<button data-circ="on" class="${ctx.on ? 'pri' : ''}">${ctx.on ? '🟢 สวิตช์ ON' : '🔴 สวิตช์ OFF'}</button>` : ''}<button data-circ="wires">${ctx.wires ? '✂️ ถอดสายไฟ' : '🔌 ต่อสายไฟ'}</button><button data-circ="day">${this.simDay ? '🌙 จำลองกลางคืน' : '☀️ จำลองกลางวัน'}</button></div>
        <p class="muted">IPO: ${ctx.n.ldr ? 'ความมืด' : ctx.n.water_sensor ? 'น้ำ' : ctx.n.tilt_sensor ? 'ความเอียง' : 'การกดสวิตช์'} (Input) → วงจร/เซ็นเซอร์ (Process) → ${ctx.n.led ? 'แสง LED' : ''}${ctx.n.led && ctx.n.motor ? ' + ' : ''}${ctx.n.motor ? 'การหมุนของมอเตอร์' : ''}${!ctx.n.led && !ctx.n.motor ? '?' : ''} (Output)</p>
        <button class="linkb" data-k="elec">📘 ความรู้วงจรไฟฟ้าและเซ็นเซอร์</button></details>`; }
    el.innerHTML = h; const cv = el.querySelector('.balcv'); if (cv) drawBalance(cv, this.d);
    el.querySelector('[data-showcom]').onchange = (e) => { this.showCom = e.target.checked; this.com.visible = this.comLine.visible = this.showCom; };
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => openKnowledge(b.dataset.k));
    el.querySelectorAll('[data-circ]').forEach(b => b.onclick = () => { const k = b.dataset.circ, c = this.d.circuit = { on: true, wires: true, ...(this.d.circuit || {}) };
      if (k === 'on') c.on = !c.on; if (k === 'wires') c.wires = !c.wires; if (k === 'day') { this.simDay = !this.simDay; this.rebuild(); this.renderSide(); return; } this.commit(); });
  }
  renderWarnings() { const el = this.$('.ws-warn'); if (!el) return; const w = this.warnings || [];
    el.innerHTML = w.length ? `<b>⚠ ตรวจพบ ${w.length} จุด</b> <span class="muted">(ไม่ลบอัตโนมัติ)</span>${w.slice(0, 8).map(x => `<button class="wl" data-w="${x.id}">${esc(x.text)}</button>`).join('')}` : '<b>✓ ชิ้นส่วนทั้งหมดวางบนฐานเรียบร้อย</b>';
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { this.sel = new Set([b.dataset.w]); this.updateHelpers(); this.renderTools(); }); }

  /* ---------- การแก้ไข ---------- */
  applySlider(k, v) {
    const sel = this.selected(); if (!sel.length) return; const first = sel[0];
    if (k === 'ry') { const d = rad(v) - first.r[1]; sel.forEach(p => p.r[1] += d); const m = this.$('[data-rmath]'); if (m) m.innerHTML = `📐 ${v}° = ${v} × π ÷ 180 ≈ <b>${rad(v).toFixed(2)} rad</b>`; }
    if (k === 'rx') sel.forEach(p => p.r[0] = rad(v));
    if (k === 'rz') sel.forEach(p => p.r[2] = rad(v));
    if (k === 's') sel.forEach(p => { const def = MATERIALS[p.m]; p.s = Math.max(def.smin, Math.min(def.smax, v)); });
    if (k === 'y') { const d = v - first.p[1]; sel.forEach(p => p.p[1] = Math.max(0, Math.min(2.4, p.p[1] + d))); }
    if (k === 'n') { sel.filter(p => p.m === 'gear').forEach(p => { p.n = Math.round(v); this.rebuildObj(p); }); }
    sel.forEach(p => this.refreshObj(p)); this.updateHelpers();
  }
  afterEdit(k) { this.commit(); this.updateHelpers(); if (k === 'n') this.renderTools(); }
  setColor(c) { const sel = this.selected().filter(p => MATERIALS[p.m].colorable); sel.forEach(p => { p.c = c; this.rebuildObj(p); }); this.updateHelpers(); this.commit(); }
  dup() { const sel = this.selected(); if (!sel.length) return; if (this.d.pieces.length + sel.length > MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนสูงสุด ${MAX_PIECES} ชิ้น`);
    const need = {}; sel.forEach(p => { if (MATERIALS[p.m].inv) need[p.m] = (need[p.m] || 0) + 1; }); for (const [m, n] of Object.entries(need)) if (!this.canUse(m, n)) return;
    const ns = sel.map(p => ({ ...JSON.parse(JSON.stringify(p)), id: uid('p'), p: [Math.max(-1.8, Math.min(1.8, p.p[0] + 0.18)), p.p[1], Math.max(-1.8, Math.min(1.8, p.p[2] + 0.12))] }));
    ns.forEach(p => { this.d.pieces.push(p); this.addObj(p); }); if (this.snap) this.snapPieces(ns); this.sel = new Set(ns.map(p => p.id)); this.updateHelpers(); this.commit(); this.renderTools(); this.renderTray(); }
  del() { if (!this.sel.size) return; this.d.pieces = this.d.pieces.filter(p => !this.sel.has(p.id)); for (const id of this.sel) { const o = this.objs.get(id); if (o) this.root.remove(o); this.objs.delete(id); } this.sel.clear(); this.updateHelpers(); this.commit(); this.renderTools(); this.renderTray(); }
  center() { const sel = this.selected(); if (!sel.length) return; const cx = sel.reduce((a, p) => a + p.p[0], 0) / sel.length, cz = sel.reduce((a, p) => a + p.p[2], 0) / sel.length;
    sel.forEach(p => { p.p[0] -= cx; p.p[2] -= cz; }); if (this.snap) this.snapPieces(sel); else sel.forEach(p => this.refreshObj(p)); this.updateHelpers(); this.commit(); this.renderTools(); }

  /* ---------- วางวัสดุใหม่ ---------- */
  startPlacing(id, extra = null) { if (this.d.pieces.length >= MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนสูงสุด ${MAX_PIECES} ชิ้น`); if (!this.canUse(id)) return;
    this.placing = id; this.placingExtra = extra; this.ghosts.clear(); const proto = this.protoPiece(id, extra, 0, 0); const g = this.ghostOf(proto); g.visible = false; this.ghosts.add(g); this.ghost = g; this.renderTray(); this.hint(); }
  protoPiece(id, extra, x, z) { const def = MATERIALS[id], outward = Math.hypot(x, z) > 0.15 ? Math.atan2(x, z) : 0;
    const p = { id: uid('p'), m: id, p: [x, BASE_TOP, z], r: [def.cat === 'leaf' && Math.hypot(x, z) > 0.4 ? 0.3 : 0, ['mech', 'elec'].includes(def.cat) ? 0 : outward, 0], s: 1, c: null };
    if (id === 'gear') p.n = extra?.n || 12; if (id === 'sketch' && extra?.sk) { p.sk = extra.sk.id; p.c = extra.sk.c1 || null; } return p; }
  ensureSketch(sk) { if (!sk) return; this.d.sketches = this.d.sketches || []; if (!this.d.sketches.find(s => s.id === sk.id)) { const clean = sanitizeSketch(sk); if (clean) { clean.id = sk.id; this.d.sketches.push(clean); } } }
  cancelPlacing() { this.placing = null; this.placingExtra = null; this.ghosts.clear(); this.ghost = null; this.renderTray(); this.hint(); }
  ghostOf(p) { if (p.sk) this.ensureSketch(this.placingExtra?.sk); const o = buildPiece(p, this.d, this.ctx); o.traverse(c => { if (c.material && !c.isSprite) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; } }); return o; }
  placeAt(x, z) {
    const id = this.placing; if (!id) return; if (!this.canUse(id)) return this.cancelPlacing();
    const p = this.protoPiece(id, this.placingExtra, x, z); if (p.sk) this.ensureSketch(this.placingExtra.sk);
    p.p[1] = this.support(x, z); this.d.pieces.push(p); this.addObj(p); this.sel = new Set([p.id]);
    this.cancelPlacing(); this.updateHelpers(); this.commit(); this.renderTools(); this.renderTray();
    if (!insideBase(this.d.base, x, z, 0.1)) this.toast('วางไว้นอกฐาน — ลากกลับเข้ามาบนฐานได้');
  }

  /* ---------- เรียงรอบฐาน ---------- */
  arrangeList() { const a = this.arr; if (!a) return []; const b = BASES[this.d.base] || BASES.round; const tpl = this.selected().length === 1 ? this.selected()[0] : null; const out = [];
    for (let i = 0; i < a.n; i++) { const ang = rad(a.start) + (i / a.n) * Math.PI * 2; const x = Math.sin(ang) * a.r * (a.fit ? b.rx : 1), z = Math.cos(ang) * a.r * (a.fit ? b.rz : 1);
      const p = { id: uid('p'), m: a.m, p: [x, BASE_TOP, z], r: [rad(a.tilt), Math.atan2(x, z), 0], s: tpl && tpl.m === a.m ? tpl.s : 1, c: tpl && tpl.m === a.m ? tpl.c : null };
      if (a.m === 'gear') p.n = tpl?.n || 12; out.push(p); }
    return out; }
  previewArrange() { this.ghosts.clear(); for (const p of this.arrangeList()) { p.p[1] = this.support(p.p[0], p.p[2]); this.ghosts.add(this.ghostOf(p)); } }
  confirmArrange() { const list = this.arrangeList(); const tpl = this.selected().length === 1 && this.selected()[0].m === this.arr.m ? this.selected()[0] : null;
    if (this.d.pieces.length - (tpl ? 1 : 0) + list.length > MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนเกิน ${MAX_PIECES} ชิ้น ลองลดจำนวน`);
    if (!this.canUse(this.arr.m, list.length - (tpl ? 1 : 0))) return;
    if (tpl) { this.d.pieces = this.d.pieces.filter(p => p.id !== tpl.id); const o = this.objs.get(tpl.id); if (o) this.root.remove(o); this.objs.delete(tpl.id); }
    for (const p of list) { p.p[1] = this.support(p.p[0], p.p[2]); this.d.pieces.push(p); this.addObj(p); }
    this.ghosts.clear(); this.sel = new Set(list.map(p => p.id)); this.updateHelpers(); this.commit(); this.toast(`เรียง ${list.length} ชิ้น ห่างกันชิ้นละ ${(360 / list.length).toFixed(1).replace('.0', '')}°`); this.arr = null; this.renderTools(); this.renderTray(); }

  /* ---------- เมาส์/สัมผัส ---------- */
  setPtr(e) { const r = this.canvas.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera); }
  hitPiece() { const hit = this.ray.intersectObjects([...this.objs.values()], true).find(h => h.object.type === 'Mesh'); return hit ? { id: hit.object.userData.pid, point: hit.point } : null; }
  hitSurface() { const hit = this.ray.intersectObjects([this.baseObj, ...this.objs.values()], true).find(h => h.object.type === 'Mesh'); if (hit) return hit.point;
    const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; }
  bindPointer() {
    const cv = this.canvas; let down = null;
    cv.addEventListener('pointerdown', e => { if (e.button > 0) return; this.setPtr(e); down = { x: e.clientX, y: e.clientY, moved: false }; this.host.querySelector('.ws').classList.remove('open-tray', 'open-tools');
      if (this.placing || this.mode !== 'move') return;
      const h = this.hitPiece(); if (!h) return;
      if (e.shiftKey || this.multi) { if (this.sel.has(h.id)) this.sel.delete(h.id); else this.sel.add(h.id); } else if (!this.sel.has(h.id)) this.sel = new Set([h.id]);
      this.updateHelpers(); this.renderTools(); if (!this.sel.has(h.id)) return;
      this.drag = { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -h.point.y), start: h.point.clone(), orig: this.selected().map(p => ({ p, x: p.p[0], z: p.p[2] })), moved: false };
      this.controls.enabled = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { this.setPtr(e); if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (this.placing && this.ghost) { const p = this.hitSurface(); if (p) { this.ghost.visible = true; const x = Math.max(-1.9, Math.min(1.9, p.x)), z = Math.max(-1.9, Math.min(1.9, p.z)); this.ghost.position.set(x, this.support(x, z), z); const def = MATERIALS[this.placing]; this.ghost.rotation.y = !['mech', 'elec'].includes(def.cat) && Math.hypot(x, z) > 0.15 ? Math.atan2(x, z) : 0; } return; }
      if (!this.drag) return; const pt = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.drag.plane, pt)) return;
      const dx = pt.x - this.drag.start.x, dz = pt.z - this.drag.start.z; if (Math.hypot(dx, dz) > 0.005) this.drag.moved = true;
      for (const o of this.drag.orig) { o.p.p[0] = Math.max(-1.9, Math.min(1.9, o.x + dx)); o.p.p[2] = Math.max(-1.9, Math.min(1.9, o.z + dz)); this.refreshObj(o.p); } this.updateHelpers(); });
    cv.addEventListener('pointerup', e => { this.setPtr(e);
      if (this.drag) { const moved = this.drag.moved; const list = this.drag.orig.map(o => o.p); this.drag = null; this.controls.enabled = true; if (moved) { if (this.snap) this.snapPieces(list); this.updateHelpers(); this.commit(); this.renderTools(); } down = null; return; }
      if (!down) return; const tap = !down.moved; down = null; if (!tap) return;
      if (this.placing) { const p = this.hitSurface(); if (p) this.placeAt(Math.max(-1.9, Math.min(1.9, p.x)), Math.max(-1.9, Math.min(1.9, p.z))); return; }
      const h = this.hitPiece(); if (h) { if (e.shiftKey || this.multi) { if (this.sel.has(h.id)) this.sel.delete(h.id); else this.sel.add(h.id); } else this.sel = new Set([h.id]); }
      else if (!this.multi) this.sel.clear(); this.updateHelpers(); this.renderTools(); });
    this.hint();
  }

  /* ---------- บันทึก / ภาพ ---------- */
  render2(w, h, cam) { const hv = this.helpers.visible, gv = this.ghosts.visible, cv = this.com.visible, lv = this.comLine.visible; this.helpers.visible = this.ghosts.visible = this.com.visible = this.comLine.visible = this.grid.visible = false;
    const size = new THREE.Vector2(); this.renderer.getSize(size); const pr = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.renderer.render(this.scene, cam); const url = this.canvas.toDataURL(w > 400 ? 'image/png' : 'image/jpeg', 0.72);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(size.x, size.y, false); this.helpers.visible = hv; this.ghosts.visible = gv; this.com.visible = cv; this.comLine.visible = lv; this.grid.visible = true; return url; }
  thumbnail() { const cam = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 50); cam.position.set(2.4, 2.4, 2.8); cam.lookAt(0, 0.3, 0); return this.render2(200, 150, cam); }
  /** ภาพความละเอียดสูงจากมุมกล้องปัจจุบัน (สำหรับบันทึกลงเครื่อง) */
  photo(w = 1080, h = 1080) { const cam = this.camera.clone(); cam.aspect = w / h; cam.updateProjectionMatrix(); this.table.visible = true; return this.render2(w, h, cam); }
  current() { this.d.name = this.$('.ws-name').value.trim().slice(0, 40) || 'กระทงของฉัน'; return sanitizeDesign({ ...cloneDesign(this.d), thumb: this.thumbnail(), updatedAt: Date.now() }); }
  save(silent) { const d = this.current(); this.syncInv(); this.opts.onSave?.(d); this.dirty = false; if (!silent) this.toast('💾 บันทึกร่างแล้ว'); return d; }
  act(a) {
    if (a === 'undo') return this.undo(); if (a === 'redo') return this.redo();
    if (a === 'save') return this.save();
    if (a === 'photo') { const d = this.current(); return this.opts.onPhoto?.(d, this.photo()); }
    if (!this.d.pieces.length) { if (!confirm('กระทงยังไม่มีวัสดุบนฐาน ต้องการไปต่อหรือไม่?')) return; }
    if (a === 'test') { const d = this.save(true); this.opts.onTest?.(d); }
    if (a === 'done') { if (this.warnings?.length && !confirm(`มีชิ้นส่วนนอกฐานหรือลอยอยู่ ${this.warnings.length} จุด (เป็นการจำลองเท่านั้น) ต้องการใช้กระทงนี้เลยหรือไม่?`)) return; const d = this.save(true); this.close(); this.opts.onDone?.(d); }
  }
}
