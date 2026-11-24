/* ============================================================
   โต๊ะประดิษฐ์กระทง 3 มิติ
   ถาดวัสดุ (ซ้าย) · พื้นที่ 3 มิติ (กลาง) · เครื่องมือ (ขวา) · แถบล่าง
   วาง ย้าย หมุน เอียง ปรับขนาด/ความสูง ทำสำเนา ลบ เปลี่ยนสี
   เลือกหลายชิ้น ย้อนกลับ/ทำซ้ำ จัดกึ่งกลาง วางชิดพื้นผิว เรียงรอบฐาน
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MATERIALS, CATS, BASES, BASE_TOP, MAX_PIECES, makeBase, buildPiece, buildKrathong, animateKrathong, insideBase, sanitizeDesign, cloneDesign, uid } from './krathong.js';

const PALETTE = ['#ff8fb1', '#ffc2d1', '#fff0f3', '#ff9f1c', '#ffd60a', '#e63946', '#b5179e', '#7b2cbf', '#4cc9f0', '#2a9d8f', '#ffffff', '#ffcf6b'];
const BASE_COLORS = ['#5e9c4c', '#3f7f35', '#7fb069', '#a3b18a', '#d4a373'];
const deg = (r) => Math.round(r * 180 / Math.PI), rad = (d) => d * Math.PI / 180;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export class Workshop {
  constructor(host, toast) {
    this.host = host; this.toast = toast || (() => {}); this.open_ = false;
    host.innerHTML = `
    <div class="ws">
      <div class="ws-top"><span class="ws-title">🪷 โต๊ะประดิษฐ์กระทง 3 มิติ</span>
        <input class="ws-name" maxlength="40" placeholder="ตั้งชื่อกระทง">
        <span class="ws-steps">เลือกฐาน → เพิ่มกลีบ → ตกแต่ง → ทดลองลอย</span>
        <button class="ib ws-help" title="วิธีใช้">❔</button><button class="ib ws-close" title="ปิด">✕</button></div>
      <aside class="ws-tray"><div class="ws-cats"></div><div class="ws-items"></div></aside>
      <div class="ws-stage"><canvas></canvas>
        <div class="ws-modes"><button data-mode="move" class="on">🖐 ย้ายวัสดุ</button><button data-mode="camera">🎥 หมุนกล้อง</button><button data-multi class="">☑ เลือกหลายชิ้น</button></div>
        <div class="ws-cams"><button data-cam="top">มุมบน</button><button data-cam="front">มุมหน้า</button><button data-cam="side">มุมเฉียง</button><button data-cam="reset">⟲ รีเซ็ต</button></div>
        <div class="ws-hint"></div><div class="ws-count"></div>
        <div class="ws-mob"><button data-open="tray">🧺 วัสดุ</button><button data-open="tools">🛠 เครื่องมือ</button></div>
      </div>
      <aside class="ws-tools"></aside>
      <div class="ws-bottom"><button data-act="undo">↶ ย้อนกลับ</button><button data-act="redo">↷ ทำซ้ำ</button><span class="sp"></span>
        <button data-act="save">💾 บันทึกร่าง</button><button data-act="test" class="pri2">🌊 ทดลองลอย</button><button data-act="done" class="pri">✅ เสร็จสิ้น</button></div>
      <div class="ws-coach hidden"><div><h3>วิธีใช้โต๊ะประดิษฐ์</h3><ol>
        <li><b>เลือกฐาน</b> ที่หมวด "ฐานกระทง" ด้านซ้าย</li><li><b>แตะวัสดุ</b> ในถาด แล้ว<b>แตะบนฐาน</b>เพื่อวาง</li>
        <li>โหมด <b>🖐 ย้ายวัสดุ</b>: แตะเลือกชิ้น แล้วลากเพื่อย้าย · โหมด <b>🎥 หมุนกล้อง</b>: ลากเพื่อหมุนมุมมอง</li>
        <li>ใช้แผงขวาเพื่อหมุน เอียง ปรับขนาด ความสูง สี หรือ <b>เรียงรอบฐาน</b> ให้สมมาตร</li><li>กด <b>🌊 ทดลองลอย</b> เพื่อดูในบ่อทดลอง แล้วกด <b>✅ เสร็จสิ้น</b></li></ol>
        <button class="btn">เริ่มประดิษฐ์</button></div></div>
    </div>`;
    this.$ = (s) => host.querySelector(s);
    this.canvas = this.$('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color('#1d1845');
    S.add(new THREE.HemisphereLight('#c9d6ff', '#4a3520', 1.1)); const dl = new THREE.DirectionalLight('#fff1d6', 1.6); dl.position.set(3, 6, 4); S.add(dl);
    const pl = new THREE.PointLight('#ffb347', 6, 8); pl.position.set(-2, 2.5, 2); S.add(pl);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.2, 32), new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.8 })); table.position.y = -0.1; S.add(table);
    const grid = new THREE.PolarGridHelper(1.9, 16, 4, 48, '#5c3d2e', '#5c3d2e'); grid.position.y = 0.002; S.add(grid); this.grid = grid;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.target.set(0, 0.35, 0); this.controls.enableDamping = true; this.controls.minDistance = 1.4; this.controls.maxDistance = 7; this.controls.maxPolarAngle = Math.PI / 2 - 0.04; this.controls.enablePan = false;
    this.root = new THREE.Group(); S.add(this.root); this.helpers = new THREE.Group(); S.add(this.helpers); this.ghosts = new THREE.Group(); S.add(this.ghosts);
    this.ray = new THREE.Raycaster(); this.ptr = new THREE.Vector2(); this.mode = 'move'; this.multi = false; this.cat = 'base'; this.snap = true;
    this.bindUI(); this.bindPointer(); this.setCam('side');
    new ResizeObserver(() => this.resize()).observe(this.$('.ws-stage'));
  }

  /* ---------- เปิด/ปิด ---------- */
  open(design, opts = {}) {
    this.opts = opts; this.disabled = new Set(opts.disabled || []);
    this.d = sanitizeDesign(cloneDesign(design)); this.sel = new Set(); this.history = []; this.future = []; this.placing = null; this.arr = null;
    this.$('.ws-name').value = this.d.name; this.host.classList.add('show'); this.open_ = true; this.rebuild(); this.renderTray(); this.renderTools(); this.commit(true);
    this.resize(); this.setCam('side'); if (!localStorage.getItem('loy_ws_coach')) this.$('.ws-coach').classList.remove('hidden');
    const loop = () => { if (!this.open_) return; this.controls.update(); for (const h of this.helpers.children) h.update?.(); animateKrathong(this.root.children[0] || this.root, performance.now() / 1000); this.animFlames(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); }; loop();
  }
  close() { this.open_ = false; this.host.classList.remove('show'); }
  animFlames() { const t = performance.now() / 1000; this.root.traverse(o => { if (o.userData.flame) { const k = 1 + Math.sin(t * 18 + o.id) * 0.08; o.scale.set(1 / k, k, 1 / k); } }); }
  resize() { const st = this.$('.ws-stage'), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setCam(k) { const pos = { top: [0, 5.2, 0.01], front: [0, 1.3, 4.4], side: [3, 3.1, 3.4], reset: [3, 3.1, 3.4] }[k]; this.camera.position.set(...pos); this.controls.target.set(0, 0.35, 0); this.controls.update(); }

  /* ---------- สร้างโมเดลจากข้อมูล ---------- */
  rebuild() {
    this.root.clear(); this.objs = new Map(); this.baseObj = makeBase(this.d.base, this.d.baseColor); this.root.add(this.baseObj);
    for (const p of this.d.pieces) this.addObj(p); this.updateHelpers(); this.updateWarnings();
    this.$('.ws-count').textContent = `${this.d.pieces.length}/${MAX_PIECES} ชิ้น`;
  }
  addObj(p) { const o = buildPiece(p); if (!o) return; o.traverse(c => c.userData.pid = p.id); this.root.add(o); this.objs.set(p.id, o); }
  refreshObj(p) { const o = this.objs.get(p.id); if (!o) return; o.position.set(...p.p); o.rotation.set(p.r[0], p.r[1], p.r[2]); o.scale.setScalar(p.s); }
  rebuildObj(p) { const o = this.objs.get(p.id); if (o) this.root.remove(o); this.addObj(p); }
  piece(id) { return this.d.pieces.find(p => p.id === id); }
  selected() { return this.d.pieces.filter(p => this.sel.has(p.id)); }
  updateHelpers() { this.helpers.clear(); for (const id of this.sel) { const o = this.objs.get(id); if (o) { const h = new THREE.BoxHelper(o, '#ffd60a'); this.helpers.add(h); } } }

  /* ---------- ประวัติ ย้อนกลับ/ทำซ้ำ ---------- */
  snapshot() { return JSON.stringify({ base: this.d.base, baseColor: this.d.baseColor, pieces: this.d.pieces, name: this.d.name }); }
  commit(init = false) { const s = this.snapshot(); if (this.history[this.history.length - 1] === s) return; this.history.push(s); if (this.history.length > 80) this.history.shift(); if (!init) this.future = []; this.updateWarnings(); this.$('.ws-count').textContent = `${this.d.pieces.length}/${MAX_PIECES} ชิ้น`; this.dirty = !init || this.dirty; }
  restore(s) { const o = JSON.parse(s); Object.assign(this.d, o); this.sel = new Set([...this.sel].filter(id => this.piece(id))); this.rebuild(); this.renderTools(); this.$('.ws-name').value = this.d.name; }
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
    $('.ws-coach .btn').onclick = () => { $('.ws-coach').classList.add('hidden'); try { localStorage.setItem('loy_ws_coach', '1'); } catch (e) {} };
    $('.ws-name').addEventListener('change', e => { this.d.name = e.target.value.trim().slice(0, 40) || 'กระทงของฉัน'; this.commit(); });
    this.host.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.mode = b.dataset.mode; this.host.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b)); this.controls.enableRotate = this.mode === 'camera'; this.hint(); });
    this.controls.enableRotate = false;
    $('[data-multi]').onclick = (e) => { this.multi = !this.multi; e.currentTarget.classList.toggle('on', this.multi); this.hint(); };
    this.host.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => this.setCam(b.dataset.cam));
    this.host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const k = b.dataset.open; this.host.querySelector('.ws').classList.toggle('open-' + k); this.host.querySelector('.ws').classList.remove(k === 'tray' ? 'open-tools' : 'open-tray'); });
    this.host.querySelectorAll('[data-act]').forEach(b => b.onclick = () => this.act(b.dataset.act));
    addEventListener('keydown', e => { if (!this.open_ || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { this.del(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? this.redo() : this.undo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { this.redo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { this.dup(); e.preventDefault(); }
      if (e.key === 'Escape') { this.cancelPlacing(); this.sel.clear(); this.updateHelpers(); this.renderTools(); } });
  }
  hint(t) { const h = this.$('.ws-hint'); if (t) { h.innerHTML = t; return; }
    h.innerHTML = this.placing ? `แตะบนฐานเพื่อวาง <b>${esc(MATERIALS[this.placing].name)}</b> <button data-center>วางกึ่งกลาง</button> <button data-cancel>ยกเลิก</button>` : this.mode === 'move' ? (this.multi ? 'แตะหลายชิ้นเพื่อเลือกเป็นกลุ่ม แล้วลากเพื่อย้ายพร้อมกัน' : 'แตะเลือกชิ้นส่วน แล้วลากเพื่อย้าย · Shift+คลิก เลือกหลายชิ้น') : 'ลากเพื่อหมุนกล้องรอบกระทง · เลื่อน/บีบนิ้วเพื่อซูม';
    h.querySelector('[data-center]')?.addEventListener('click', () => this.placeAt(0, 0));
    h.querySelector('[data-cancel]')?.addEventListener('click', () => this.cancelPlacing()); }
  renderTray() {
    const cats = this.$('.ws-cats'); cats.innerHTML = CATS.map(([k, n, i]) => `<button data-cat="${k}" class="${k === this.cat ? 'on' : ''}">${i}<span>${n}</span></button>`).join('');
    cats.querySelectorAll('button').forEach(b => b.onclick = () => { this.cat = b.dataset.cat; this.renderTray(); });
    const it = this.$('.ws-items');
    if (this.cat === 'base') {
      it.innerHTML = `<div class="ws-sub">รูปทรงฐาน</div>${Object.entries(BASES).map(([k, b]) => `<button class="ws-item ${this.d.base === k ? 'on' : ''}" data-base="${k}"><span class="ic">${b.icon}</span>${b.name}</button>`).join('')}
        <div class="ws-sub">สีฐาน</div><div class="sw">${BASE_COLORS.map(c => `<button data-bc="${c}" style="background:${c}" class="${this.d.baseColor === c ? 'on' : ''}"></button>`).join('')}</div>
        <p class="ws-note">ฐานจริงนิยมทำจากหยวกกล้วยหรือขนมปัง ซึ่งย่อยสลายได้ แต่ทุกวัสดุมีผลต่อแหล่งน้ำเมื่อมีจำนวนมาก</p>`;
      it.querySelectorAll('[data-base]').forEach(b => b.onclick = () => { this.d.base = b.dataset.base; this.rebuild(); this.commit(); this.renderTray(); });
      it.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => { this.d.baseColor = b.dataset.bc; this.rebuild(); this.commit(); this.renderTray(); });
      return;
    }
    const list = Object.entries(MATERIALS).filter(([id, m]) => m.cat === this.cat && !this.disabled.has(id));
    it.innerHTML = list.map(([id, m]) => `<button class="ws-item ${this.placing === id ? 'on' : ''}" data-mat="${id}"><span class="ic">${m.icon}</span>${m.name}${m.fantasy ? '<em>จินตนาการ</em>' : ''}</button>`).join('') +
      (this.cat === 'center' ? '<p class="ws-note">เทียน ธูป และป้ายข้อความ เลือกไม่ใส่ได้ตามความเชื่อและความสบายใจ</p>' : '') +
      (this.cat === 'deco' || this.cat === 'light' ? '<p class="ws-note">ชิ้นที่มีป้าย <em>จินตนาการ</em> เป็นของตกแต่งในเกมเท่านั้น ไม่ใช่คำแนะนำวัสดุสำหรับกระทงจริง</p>' : '');
    it.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { this.startPlacing(b.dataset.mat); this.showReal(b.dataset.mat); this.host.querySelector('.ws').classList.remove('open-tray'); });
  }
  showReal(id) { const m = MATERIALS[id]; const el = this.$('.ws-real'); if (el) el.innerHTML = `<b>${m.fantasy ? '🎨 ของตกแต่งในเกม' : '🌿 คำแนะนำสำหรับกระทงจริง'}</b><br>${esc(m.real)}`; }
  renderTools() {
    const t = this.$('.ws-tools'), sel = this.selected();
    let h = '';
    if (!sel.length) h += `<div class="ws-sec"><b>ยังไม่ได้เลือกชิ้นส่วน</b><p class="muted">แตะชิ้นส่วนบนกระทงเพื่อปรับแต่ง หรือเลือกวัสดุจากถาดด้านซ้าย</p>
      <div class="row"><button data-t="selall">เลือกทั้งหมด</button></div></div>`;
    else {
      const p = sel[0], def = MATERIALS[p.m], one = sel.length === 1;
      h += `<div class="ws-sec"><b>${one ? def.icon + ' ' + esc(def.name) : `เลือก ${sel.length} ชิ้น`}</b>
        <label>หมุนรอบตัว <span data-v="ry">${deg(p.r[1]) % 360}°</span><input type="range" data-k="ry" min="-180" max="180" value="${((deg(p.r[1]) + 540) % 360) - 180}"></label>
        <label>เอียง <span data-v="rx">${deg(p.r[0])}°</span><input type="range" data-k="rx" min="-70" max="70" value="${deg(p.r[0])}"></label>
        <label>ขนาด <span data-v="s">${p.s.toFixed(2)}×</span><input type="range" data-k="s" min="${def.smin}" max="${def.smax}" step="0.05" value="${p.s}"></label>
        <label>ความสูง <span data-v="y">${p.p[1].toFixed(2)}</span><input type="range" data-k="y" min="0" max="2.4" step="0.01" value="${p.p[1]}"></label>
        ${sel.some(x => MATERIALS[x.m].colorable) ? `<div class="ws-sub">${def.colorLabel || 'สี'}</div><div class="sw">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-cc value="${p.c || def.color}"></div>` : ''}
        <div class="grid2"><button data-t="snap">⬇ วางชิดพื้นผิว</button><button data-t="center">◎ จัดกึ่งกลาง</button><button data-t="dup">⧉ ทำสำเนา</button><button data-t="del" class="danger">🗑 ลบ</button><button data-t="selall">เลือกทั้งหมด</button><button data-t="none">ยกเลิกเลือก</button></div></div>`;
    }
    h += `<details class="ws-sec" ${this.arr ? 'open' : ''}><summary>🔄 เรียงรอบฐาน (สมมาตร)</summary>
      <label>กลีบต้นแบบ <select data-a="m">${Object.entries(MATERIALS).filter(([id, m]) => !this.disabled.has(id) && ['leaf', 'flower', 'deco', 'light'].includes(m.cat)).map(([id, m]) => `<option value="${id}" ${(this.arr?.m || (sel.length === 1 ? sel[0].m : 'leaf_lotus')) === id ? 'selected' : ''}>${m.icon} ${m.name}</option>`).join('')}</select></label>
      <label>จำนวน <select data-a="n">${[4, 6, 8, 10, 12, 16].map(n => `<option ${(this.arr?.n || 8) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>ระยะจากจุดศูนย์กลาง <span data-av="r"></span><input type="range" data-a="r" min="0.2" max="1.3" step="0.01" value="${this.arr?.r ?? 0.8}"></label>
      <label>มุมเอียงออก <span data-av="tilt"></span><input type="range" data-a="tilt" min="0" max="70" value="${this.arr?.tilt ?? 25}"></label>
      <label>มุมเริ่มต้น <span data-av="start"></span><input type="range" data-a="start" min="0" max="360" value="${this.arr?.start ?? 0}"></label>
      <label class="chk"><input type="checkbox" data-a="fit" ${this.arr?.fit === false ? '' : 'checked'}> เรียงตามรูปฐาน (วงรี/เรือ)</label>
      <div class="math" data-math></div>
      <div class="row"><button data-arr="preview">👁 ดูตัวอย่าง</button><button data-arr="ok" class="pri">ยืนยัน</button><button data-arr="cancel">ยกเลิก</button></div>
      <p class="muted">แก้ไขกลีบแต่ละชิ้นได้ภายหลัง และยังจัดวางอิสระได้เสมอ</p></details>`;
    h += `<div class="ws-sec ws-warn"></div><div class="ws-sec ws-real"><b>🌿 คำแนะนำสำหรับกระทงจริง</b><br>แตะวัสดุในถาดเพื่อดูคำแนะนำ · กระทงจริงควรใช้วัสดุน้อยชิ้น ไม่ใช้โฟม พลาสติก ลวด หรือหมุดโลหะ</div>`;
    t.innerHTML = h; this.renderWarnings();
    t.querySelectorAll('input[data-k]').forEach(inp => { inp.addEventListener('input', () => this.applySlider(inp.dataset.k, +inp.value)); inp.addEventListener('change', () => { if (inp.dataset.k === 'y') {} this.commit(); this.updateHelpers(); }); });
    t.querySelectorAll('[data-c]').forEach(b => b.onclick = () => this.setColor(b.dataset.c));
    t.querySelector('[data-cc]')?.addEventListener('change', e => this.setColor(e.target.value));
    t.querySelectorAll('[data-t]').forEach(b => b.onclick = () => ({ snap: () => { this.snapPieces(this.selected()); this.commit(); this.updateHelpers(); this.renderTools(); }, center: () => this.center(), dup: () => this.dup(), del: () => this.del(), selall: () => { this.sel = new Set(this.d.pieces.map(p => p.id)); this.updateHelpers(); this.renderTools(); }, none: () => { this.sel.clear(); this.updateHelpers(); this.renderTools(); } })[b.dataset.t]());
    const readArr = () => { const q = (k) => t.querySelector(`[data-a="${k}"]`); this.arr = { m: q('m').value, n: +q('n').value, r: +q('r').value, tilt: +q('tilt').value, start: +q('start').value, fit: q('fit').checked };
      t.querySelector('[data-av="r"]').textContent = this.arr.r.toFixed(2); t.querySelector('[data-av="tilt"]').textContent = this.arr.tilt + '°'; t.querySelector('[data-av="start"]').textContent = this.arr.start + '°';
      t.querySelector('[data-math]').innerHTML = `📐 มุมระหว่างกลีบ = 360° ÷ ${this.arr.n} = <b>${(360 / this.arr.n).toFixed(1).replace('.0', '')}°</b>`; };
    t.querySelectorAll('[data-a]').forEach(el => el.addEventListener('input', () => { readArr(); if (this.ghosts.children.length) this.previewArrange(); }));
    t.querySelector('details').addEventListener('toggle', e => { if (e.target.open) readArr(); else this.ghosts.clear(); });
    if (this.arr) readArr();
    t.querySelector('[data-arr="preview"]').onclick = () => { readArr(); this.previewArrange(); };
    t.querySelector('[data-arr="ok"]').onclick = () => { readArr(); this.confirmArrange(); };
    t.querySelector('[data-arr="cancel"]').onclick = () => { this.ghosts.clear(); this.arr = null; this.renderTools(); };
  }
  renderWarnings() { const el = this.$('.ws-warn'); if (!el) return; const w = this.warnings || [];
    el.innerHTML = w.length ? `<b>⚠ ตรวจพบ ${w.length} จุด</b> <span class="muted">(ไม่ลบอัตโนมัติ)</span>${w.slice(0, 8).map(x => `<button class="wl" data-w="${x.id}">${esc(x.text)}</button>`).join('')}` : '<b>✓ ชิ้นส่วนทั้งหมดวางบนฐานเรียบร้อย</b>';
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { this.sel = new Set([b.dataset.w]); this.updateHelpers(); this.renderTools(); }); }

  /* ---------- การแก้ไข ---------- */
  applySlider(k, v) {
    const sel = this.selected(); if (!sel.length) return; const first = sel[0];
    if (k === 'ry') { const d = rad(v) - first.r[1]; sel.forEach(p => p.r[1] += d); }
    if (k === 'rx') sel.forEach(p => p.r[0] = rad(v));
    if (k === 's') sel.forEach(p => { const def = MATERIALS[p.m]; p.s = Math.max(def.smin, Math.min(def.smax, v)); });
    if (k === 'y') { const d = v - first.p[1]; sel.forEach(p => p.p[1] = Math.max(0, Math.min(2.4, p.p[1] + d))); }
    sel.forEach(p => this.refreshObj(p)); this.updateHelpers();
    const lab = this.$(`[data-v="${k}"]`); if (lab) lab.textContent = k === 's' ? first.s.toFixed(2) + '×' : k === 'y' ? first.p[1].toFixed(2) : v + '°';
  }
  setColor(c) { const sel = this.selected().filter(p => MATERIALS[p.m].colorable); sel.forEach(p => { p.c = c; this.rebuildObj(p); }); this.updateHelpers(); this.commit(); }
  dup() { const sel = this.selected(); if (!sel.length) return; if (this.d.pieces.length + sel.length > MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนสูงสุด ${MAX_PIECES} ชิ้น`);
    const ns = sel.map(p => ({ ...JSON.parse(JSON.stringify(p)), id: uid('p'), p: [Math.max(-1.8, Math.min(1.8, p.p[0] + 0.18)), p.p[1], Math.max(-1.8, Math.min(1.8, p.p[2] + 0.12))] }));
    ns.forEach(p => { this.d.pieces.push(p); this.addObj(p); }); if (this.snap) this.snapPieces(ns); this.sel = new Set(ns.map(p => p.id)); this.updateHelpers(); this.commit(); this.renderTools(); }
  del() { if (!this.sel.size) return; this.d.pieces = this.d.pieces.filter(p => !this.sel.has(p.id)); for (const id of this.sel) { const o = this.objs.get(id); if (o) this.root.remove(o); this.objs.delete(id); } this.sel.clear(); this.updateHelpers(); this.commit(); this.renderTools(); }
  center() { const sel = this.selected(); if (!sel.length) return; const cx = sel.reduce((a, p) => a + p.p[0], 0) / sel.length, cz = sel.reduce((a, p) => a + p.p[2], 0) / sel.length;
    sel.forEach(p => { p.p[0] -= cx; p.p[2] -= cz; }); if (this.snap) this.snapPieces(sel); else sel.forEach(p => this.refreshObj(p)); this.updateHelpers(); this.commit(); this.renderTools(); }

  /* ---------- วางวัสดุใหม่ ---------- */
  startPlacing(id) { if (this.d.pieces.length >= MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนสูงสุด ${MAX_PIECES} ชิ้น`); this.placing = id; this.ghosts.clear(); const g = this.ghostOf({ id: 'ghost', m: id, p: [0, BASE_TOP, 0], r: [0, 0, 0], s: 1, c: null }); g.visible = false; this.ghosts.add(g); this.ghost = g; this.renderTray(); this.hint(); }
  cancelPlacing() { this.placing = null; this.ghosts.clear(); this.ghost = null; this.renderTray(); this.hint(); }
  ghostOf(p) { const o = buildPiece(p); o.traverse(c => { if (c.material && !c.isSprite) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; c.material.depthWrite = false; } }); return o; }
  placeAt(x, z) {
    const id = this.placing; if (!id) return; const def = MATERIALS[id];
    const outward = Math.hypot(x, z) > 0.15 ? Math.atan2(x, z) : 0; const leanCats = ['leaf'];
    const p = { id: uid('p'), m: id, p: [x, 0, z], r: [leanCats.includes(def.cat) && Math.hypot(x, z) > 0.4 ? 0.3 : 0, outward, 0], s: 1, c: null };
    p.p[1] = this.support(x, z); this.d.pieces.push(p); this.addObj(p); this.sel = new Set([p.id]);
    this.cancelPlacing(); this.updateHelpers(); this.commit(); this.renderTools();
    if (!insideBase(this.d.base, x, z, 0.1)) this.toast('วางไว้นอกฐาน — ลากกลับเข้ามาบนฐานได้');
  }

  /* ---------- เรียงรอบฐาน ---------- */
  arrangeList() { const a = this.arr; if (!a) return []; const b = BASES[this.d.base] || BASES.round; const tpl = this.selected().length === 1 ? this.selected()[0] : null; const out = [];
    for (let i = 0; i < a.n; i++) { const ang = rad(a.start) + (i / a.n) * Math.PI * 2; const x = Math.sin(ang) * a.r * (a.fit ? b.rx : 1), z = Math.cos(ang) * a.r * (a.fit ? b.rz : 1);
      out.push({ id: uid('p'), m: a.m, p: [x, BASE_TOP, z], r: [rad(a.tilt), Math.atan2(x, z), 0], s: tpl && tpl.m === a.m ? tpl.s : 1, c: tpl && tpl.m === a.m ? tpl.c : null }); }
    return out; }
  previewArrange() { this.ghosts.clear(); for (const p of this.arrangeList()) { p.p[1] = this.support(p.p[0], p.p[2]); this.ghosts.add(this.ghostOf(p)); } }
  confirmArrange() { const list = this.arrangeList(); const tpl = this.selected().length === 1 && this.selected()[0].m === this.arr.m ? this.selected()[0] : null;
    if (this.d.pieces.length - (tpl ? 1 : 0) + list.length > MAX_PIECES) return this.toast(`จำนวนชิ้นส่วนเกิน ${MAX_PIECES} ชิ้น ลองลดจำนวนกลีบ`);
    if (tpl) { this.d.pieces = this.d.pieces.filter(p => p.id !== tpl.id); const o = this.objs.get(tpl.id); if (o) this.root.remove(o); this.objs.delete(tpl.id); }
    for (const p of list) { p.p[1] = this.support(p.p[0], p.p[2]); this.d.pieces.push(p); this.addObj(p); }
    this.ghosts.clear(); this.sel = new Set(list.map(p => p.id)); this.updateHelpers(); this.commit(); this.toast(`เรียง ${list.length} ชิ้น ห่างกันชิ้นละ ${(360 / list.length).toFixed(1).replace('.0', '')}°`); this.arr = null; this.renderTools(); }

  /* ---------- เมาส์/สัมผัส ---------- */
  setPtr(e) { const r = this.canvas.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.ray.setFromCamera(this.ptr, this.camera); }
  hitPiece() { const hit = this.ray.intersectObjects([...this.objs.values()], true).find(h => h.object.type === 'Mesh'); return hit ? { id: hit.object.userData.pid, point: hit.point } : null; }
  hitSurface() { const hit = this.ray.intersectObjects([this.baseObj, ...this.objs.values()], true).find(h => h.object.type === 'Mesh'); if (hit) return hit.point;
    const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null; }
  bindPointer() {
    const cv = this.canvas; let down = null;
    cv.addEventListener('pointerdown', e => { if (e.button > 0) return; this.setPtr(e); down = { x: e.clientX, y: e.clientY, moved: false };
      if (this.placing || this.mode !== 'move') return;
      const h = this.hitPiece(); if (!h) return;
      if (e.shiftKey || this.multi) { if (this.sel.has(h.id)) this.sel.delete(h.id); else this.sel.add(h.id); } else if (!this.sel.has(h.id)) this.sel = new Set([h.id]);
      this.updateHelpers(); this.renderTools(); if (!this.sel.has(h.id)) return;
      const y = this.piece(h.id).p[1]; this.drag = { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -h.point.y), start: h.point.clone(), orig: this.selected().map(p => ({ p, x: p.p[0], z: p.p[2] })), moved: false, y };
      this.controls.enabled = false; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { this.setPtr(e); if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (this.placing && this.ghost) { const p = this.hitSurface(); if (p) { this.ghost.visible = true; const x = Math.max(-1.9, Math.min(1.9, p.x)), z = Math.max(-1.9, Math.min(1.9, p.z)); this.ghost.position.set(x, this.support(x, z), z); this.ghost.rotation.y = Math.hypot(x, z) > 0.15 ? Math.atan2(x, z) : 0; } return; }
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

  /* ---------- บันทึก / ภาพตัวอย่าง ---------- */
  thumbnail() {
    const cam = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 50); cam.position.set(2.4, 2.4, 2.8); cam.lookAt(0, 0.3, 0);
    const hv = this.helpers.visible, gv = this.ghosts.visible; this.helpers.visible = false; this.ghosts.visible = false; this.grid.visible = false;
    const size = new THREE.Vector2(); this.renderer.getSize(size); const pr = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1); this.renderer.setSize(200, 150, false); this.renderer.render(this.scene, cam); const url = this.canvas.toDataURL('image/jpeg', 0.72);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(size.x, size.y, false); this.helpers.visible = hv; this.ghosts.visible = gv; this.grid.visible = true;
    return url;
  }
  current() { this.d.name = this.$('.ws-name').value.trim().slice(0, 40) || 'กระทงของฉัน'; return sanitizeDesign({ ...cloneDesign(this.d), thumb: this.thumbnail(), updatedAt: Date.now() }); }
  save(silent) { const d = this.current(); this.opts.onSave?.(d); this.dirty = false; if (!silent) this.toast('💾 บันทึกร่างแล้ว'); return d; }
  act(a) {
    if (a === 'undo') return this.undo(); if (a === 'redo') return this.redo();
    if (a === 'save') return this.save();
    if (!this.d.pieces.length && a !== 'save') { if (!confirm('กระทงยังไม่มีวัสดุบนฐาน ต้องการไปต่อหรือไม่?')) return; }
    if (a === 'test') { const d = this.save(true); this.opts.onTest?.(d); }
    if (a === 'done') { if (this.warnings?.length && !confirm(`มีชิ้นส่วนนอกฐานหรือลอยอยู่ ${this.warnings.length} จุด (เป็นการจำลองเท่านั้น) ต้องการใช้กระทงนี้เลยหรือไม่?`)) return; const d = this.save(true); this.close(); this.opts.onDone?.(d); }
  }
}
