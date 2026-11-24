/* ============================================================
   บางขุนเทียน ลอยใจไปกับสายน้ำ — ส่วนควบคุมหลัก
   เส้นทางหลัก: เข้าใช้งาน → สร้างตัวละคร → เดินพบครู → ประดิษฐ์กระทง 3 มิติ
   → ทดลองลอย → เขียนข้อความ → ชวนครู → เดินไปท่าน้ำ → ลอยกระทงที่ออกแบบ → กลับมาดู
   ============================================================ */
import * as THREE from 'three';
import { TEACHERS, ZONES, CLASSES, HAIR_STYLES, HAIR_COLORS, SKIN_TONES, OUTFITS, BOTTOMS, ACCESSORIES, CLOTH_COLORS, DEFAULT_LOOK, STARTERS, NAME_MODES, REACTIONS, NPC_NOTE, MANGROVE_SPOTS } from './data.js';
import { PRESETS, presetDesign, INSPIRATIONS, inspirationDesign, newDesign, sanitizeDesign, cloneDesign, computeStats, evalCircuit, cleanWish, MATERIALS, BASES, buildKrathong, uid } from './krathong.js';
import { openCuttingTable, openKnowledge } from './dt.js';
import { buildAvatar, makeLabel } from './avatar.js';
import { World, PIER_POINT } from './world.js';
import { Workshop } from './workshop.js';
import { Viewer } from './viewer.js';
import { store, local, screenText, displayName, LIMITS, DEFAULT_SETTINGS } from './store.js';
import { audio } from './audio.js';
import { music } from './music.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmtTime = (t) => new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

const S = { prefs: local.prefs(), player: local.player(), settings: { ...DEFAULT_SETTINGS }, publicFloats: [], myFloats: local.myFloats(), progress: local.progress(), pending: null, dialogKey: null, admin: null, lastFloatId: null };
let world = null, ws = null, crViewer = null, pondViewer = null, viewViewer = null, kmViewer = null;

/* ---------- เครื่องมือทั่วไป ---------- */
let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function openOv(id) { $(id).classList.add('show'); if (world) world.inputEnabled = false; }
function closeOv(id) { $(id).classList.remove('show'); ({ ovPond: () => pondViewer?.stop(), ovView: () => viewViewer?.stop(), ovCreator: () => crViewer?.stop(), ovKMenu: () => kmViewer?.stop() })[id]?.();
  if (world && !document.querySelector('.ov.show') && !$('workshop').classList.contains('show')) world.inputEnabled = true; }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeOv(b.closest('.ov').id));
addEventListener('keydown', e => { if (e.key === 'Escape') { const o = [...document.querySelectorAll('.ov.show')].pop(); if (o && o.id !== 'ovCreator' && o.id !== 'ovFloat') closeOv(o.id); else if (!o) closeDialog(); } });
const teacher = (id) => { const base = TEACHERS.find(t => t.id === id); if (!base) return null; const o = (S.settings.teacherOverrides || {})[id] || {}; return Object.assign({}, base, o, { activity: o.activity || base.activity }); };
const currentDesign = () => { const id = local.current(); return local.drafts().find(d => d.id === id) || null; };
function setCurrentDesign(d) { const saved = local.saveDraft(d); local.setCurrent(saved.id); holdDesign(saved); return saved; }
/** ตัวละครถือกระทงที่ออกแบบไว้ตลอด จนกว่าจะลอย (รีเฟรชหน้าแล้วยังถืออยู่) */
function holdDesign(d) { S.prefs.holding = d ? d.id : null; local.savePrefs(S.prefs); if (world && !world.placing) world.setHolding(d || null); }
const heldDesign = () => S.prefs.holding ? local.drafts().find(d => d.id === S.prefs.holding) || null : null;
const isOpen = () => { const s = S.settings, now = Date.now(); if (s.openAt && now < Date.parse(s.openAt)) return false; if (s.closeAt && now > Date.parse(s.closeAt)) return false; return true; };
const disabledMats = () => S.settings.disabledMaterials || [];
function cleanDesignForSettings(d) { const dis = new Set(disabledMats()); return { ...d, pieces: d.pieces.filter(p => !dis.has(p.m)) }; }

/* ---------- ภาพตัวอย่างกระทง (renderer นอกจอ) ---------- */
let thumbR = null, thumbS, thumbC; const thumbCache = new Map();
function thumbSetup() { if (thumbR) return; const cv = document.createElement('canvas'); cv.width = 200; cv.height = 150; thumbR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); thumbR.outputColorSpace = THREE.SRGBColorSpace; thumbR.toneMapping = THREE.ACESFilmicToneMapping;
  thumbS = new THREE.Scene(); thumbS.background = new THREE.Color('#1d1845'); thumbS.add(new THREE.HemisphereLight('#c9d6ff', '#4a3520', 1.2)); const d = new THREE.DirectionalLight('#fff1d6', 1.5); d.position.set(3, 6, 4); thumbS.add(d); const pl = new THREE.PointLight('#ffb347', 4, 8); pl.position.set(-2, 2.5, 2); thumbS.add(pl);
  thumbC = new THREE.PerspectiveCamera(40, 4 / 3, 0.05, 50); }
/** เรนเดอร์กระทงจากข้อมูล (จัดกล้องให้พอดีกับชิ้นงาน รวมป้ายคำอธิษฐาน) */
function renderPhoto(design, w = 200, h = 150, type = 'image/jpeg') {
  try { thumbSetup(); thumbR.setSize(w, h, false); thumbC.aspect = w / h; thumbC.updateProjectionMatrix();
    const k = buildKrathong(design); thumbS.add(k); k.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(k), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.y * 1.1, sz.z, 1.6) / 2, dist = r / Math.sin(THREE.MathUtils.degToRad(thumbC.fov / 2)) * (w < h ? 1.25 : 0.95);
    thumbC.position.copy(c).add(new THREE.Vector3(0.55, 0.62, 0.85).normalize().multiplyScalar(dist)); thumbC.lookAt(c.x, c.y - sz.y * 0.05, c.z);
    thumbR.render(thumbS, thumbC); const url = thumbR.domElement.toDataURL(type, 0.8); thumbS.remove(k); return url;
  } catch (e) { console.warn(e); return ''; }
}
const makeThumb = (design, w = 200, h = 150) => renderPhoto(design, w, h);

/* ---------- บันทึกภาพกระทงลงเครื่อง (คอมพิวเตอร์/สมาร์ตโฟน) ---------- */
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
async function composePhoto(design, renderUrl) {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  try { await document.fonts?.load('600 40px Mitr'); await document.fonts?.load('700 60px Charm'); } catch (e) {}
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1650'); g.addColorStop(1, '#0b2a4a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,236,170,${0.15 + Math.random() * 0.5})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * 170, Math.random() * 2 + 0.5, 0, 7); x.fill(); }
  try { const logo = await loadImg('logo.png'); x.save(); x.beginPath(); x.arc(92, 92, 56, 0, 7); x.fillStyle = '#fff'; x.fill(); x.clip(); x.drawImage(logo, 40, 40, 104, 104); x.restore(); } catch (e) {}
  x.fillStyle = '#ffe8a3'; x.font = '700 58px Charm, serif'; x.fillText('ลอยกระทงออนไลน์', 170, 92); x.fillStyle = '#c4bde6'; x.font = '30px Sarabun, sans-serif'; x.fillText(S.settings.eventName || 'บางขุนเทียน ลอยใจไปกับสายน้ำ', 172, 138);
  const img = await loadImg(renderUrl); x.save(); x.beginPath(); x.roundRect ? x.roundRect(40, 180, 1000, 1000, 36) : x.rect(40, 180, 1000, 1000); x.clip(); x.drawImage(img, 40, 180, 1000, 1000); x.restore();
  x.strokeStyle = 'rgba(255,209,102,.6)'; x.lineWidth = 3; x.beginPath(); x.roundRect ? x.roundRect(40, 180, 1000, 1000, 36) : x.rect(40, 180, 1000, 1000); x.stroke();
  x.fillStyle = '#ffd166'; x.font = '600 46px Mitr, sans-serif'; x.textAlign = 'center'; x.fillText(`🪷 ${design.name || 'กระทงของฉัน'}`, W / 2, 1240);
  x.fillStyle = '#fdf6e3'; x.font = '30px Sarabun, sans-serif'; x.fillText(design.wish ? `🙏 ${design.wish}` : `${design.pieces.length} ชิ้นส่วน · ออกแบบด้วยโต๊ะประดิษฐ์ 3 มิติ`, W / 2, 1290);
  x.fillStyle = '#c4bde6'; x.font = '24px Sarabun, sans-serif'; x.fillText(`โรงเรียนพิทยาลงกรณ์พิทยาคม · ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`, W / 2, 1330);
  return c;
}
async function photoKrathong(design, renderUrl) {
  toast('กำลังสร้างภาพ…'); const url = renderUrl || renderPhoto(design, 1000, 1000, 'image/png'); if (!url) return toast('สร้างภาพไม่สำเร็จ');
  const cv = await composePhoto(design, url); const blob = await new Promise(r => cv.toBlob(r, 'image/png')); const name = `กระทง-${(design.name || 'ของฉัน').replace(/[\\/:*?"<>|\s]+/g, '-')}.png`;
  const href = URL.createObjectURL(blob), file = new File([blob], name, { type: 'image/png' }), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $('ovPhoto').style.zIndex = $('workshop').classList.contains('show') ? 75 : '';
  $('photoBody').innerHTML = `<img src="${href}" alt="ภาพกระทง" class="photo-img"><div class="row" style="margin-top:12px;justify-content:center"><a class="btn" id="phSave" href="${href}" download="${esc(name)}">💾 บันทึกลงเครื่อง</a>${canShare ? '<button class="btn pink" id="phShare">📤 แชร์/บันทึกลงอัลบั้ม</button>' : ''}</div>
    <p class="muted" style="text-align:center;margin-top:8px">คอมพิวเตอร์: ไฟล์จะอยู่ในโฟลเดอร์ดาวน์โหลด · สมาร์ตโฟน: กด "แชร์/บันทึกลงอัลบั้ม" แล้วเลือกบันทึกภาพ หรือ<b>กดค้างที่ภาพ</b>เพื่อบันทึก</p>`;
  $('phShare')?.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: design.name || 'กระทงของฉัน' }); } catch (e) { if (e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ ลองกดค้างที่ภาพแทน'); } });
  openOv('ovPhoto');
}
const inspThumbs = {}; const inspThumb = (id) => inspThumbs[id] || (inspThumbs[id] = renderPhoto(inspirationDesign(id), 480, 360, 'image/jpeg'));
let skCanvas = null, skViewer = null;
const thumbOf = (d) => d.thumb || (thumbCache.has(d.id) ? thumbCache.get(d.id) : (thumbCache.set(d.id, makeThumb(d)), thumbCache.get(d.id)));

/* ============================================================
   เริ่มต้น
   ============================================================ */
function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
async function boot() {
  $('loadMsg').textContent = 'กำลังโหลดฉาก 3 มิติ…';
  if (!webglOK()) { $('loader').classList.add('done'); return fallback(); }
  try {
    world = new World($('world'), {
      onNear, onInteract: handleInteract, onZone: (n) => $('zoneName').textContent = n, onKrathongClick: openView,
      onEscortArrive: (tid) => openFloatConfirm(tid), onSpeech: showFarewell, onPlaced: afterPlaced, onSplash: () => audio.sfx('splash'),
      onEscortEnd: () => { if (!world.followId) $('escortBar').classList.add('hidden'); },
      onTrash: (n, tot) => { audio.sfx('pick'); toast(`🗑 เก็บขยะแล้ว ${n}/${tot} ชิ้น`); if (n === tot) trashDone(); }, onSpot: spotFound
    }, { quality: S.prefs.quality, reflections: S.prefs.reflections, reduceMotion: S.prefs.reduceMotion, look: S.player?.look || DEFAULT_LOOK });
  } catch (e) { console.error(e); $('loader').classList.add('done'); return fallback(); }
  world.setTableKrathongs(INSPIRATIONS.slice(0, 4).map(p => inspirationDesign(p.id)));
  if (S.player && heldDesign()) world.setHolding(heldDesign());
  addEventListener('resize', () => world.resize());
  setupHUD(); updatePlayerChip();
  let last = performance.now(), mm = 0;
  const frame = (now) => { const dt = (now - last) / 1000; last = now; if (!world.paused) { world.update(dt); world.render(); }
    if ((mm += dt) > 0.2) { mm = 0; world.drawMinimap($('minimap'), S.myFloats.map(f => f.id)); } requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  await refreshPublic(true);
  $('loader').classList.add('done');
  if (!S.player) openCreator('new'); else { world.teleport(5, 6); toast(`ยินดีต้อนรับกลับ ${S.player.nickname} 🏮`); }
  setInterval(() => { if (!document.hidden) refreshPublic(); }, 20000);
  setInterval(() => { if (!document.hidden) refreshOwn(); }, 60000); refreshOwn();
}

async function refreshPublic(first) {
  try { const r = await store.publicList(); const prevOv = JSON.stringify(S.settings.teacherOverrides || {}); S.settings = r.settings; S.publicFloats = r.floats;
    if (JSON.stringify(S.settings.teacherOverrides || {}) !== prevOv) applyTeacherOverrides(); }
  catch (e) { if (store.mode === 'online' && first) { store.remoteDown = true; S.remoteErr = e.message; toast('เซิร์ฟเวอร์ยังไม่พร้อม — ใช้โหมดสาธิตชั่วคราว'); return refreshPublic(false); } }
  mergeRiver(); updateDemoBadge();
}
async function refreshOwn() { if (!S.player || !S.myFloats.length) return; try { const r = await store.ownStatus({ token: S.player.token, ids: S.myFloats.map(f => f.id) });
  const m = new Map((r.items || []).map(i => [i.id, i])); S.myFloats.forEach(f => { const i = m.get(f.id); if (i) { f.status = i.status; f.gotReaction = i.gotReaction; } }); local.saveMyFloats(S.myFloats); } catch (e) {} }
function mergeRiver() { if (!world) return; const cut = Date.now() - (S.settings.retentionDays || 30) * 864e5; const map = new Map();
  for (const f of S.publicFloats) map.set(f.id, f); for (const f of S.myFloats) if (f.releasedAt > cut && !map.has(f.id)) map.set(f.id, f);
  world.setRiver([...map.values()]); }
function applyTeacherOverrides() { if (!world) return; for (const av of world.teachers) { const t = teacher(av.userData.teacherId); av.userData.npc.t = t;
  const old = av.children.find(c => c.isSprite); if (old) av.remove(old); const lab = makeLabel(t.short, t.subject, t.color); lab.position.y = 2.25; av.add(lab); } }
function updateDemoBadge() { const b = $('demoBadge'); b.classList.remove('hidden');
  b.innerHTML = store.remoteDown ? '⚠️ <b>โหมดสาธิตชั่วคราว</b> — เซิร์ฟเวอร์ยังไม่รองรับงานลอยกระทงออนไลน์ (ผู้ดูแลต้อง Deploy Code.gs เวอร์ชันใหม่) · ข้อมูลเก็บในเครื่องนี้' : store.mode === 'demo' ? '🧪 <b>โหมดสาธิต</b> — แม่น้ำส่วนรวมเก็บในเครื่องนี้เท่านั้น · ยังไม่มีผู้เล่นอื่นแบบเรียลไทม์' : '🌐 แม่น้ำส่วนรวมออนไลน์ · ไม่แสดงตัวละครผู้เล่นอื่นแบบเรียลไทม์'; }
function updatePlayerChip() { $('pname').textContent = S.player ? `${S.player.nickname} · ${S.player.cls}` : 'ผู้มาเยือน'; }

/* ---------- HUD ---------- */
function setupHUD() {
  $('minimap').addEventListener('click', e => { const r = e.target.getBoundingClientRect(); const p = world.minimapToWorld(e.target, e.clientX - r.left, e.clientY - r.top); if (!world.escort && !world.placing) world.walkTo(p.x, p.z); });
  $('bNav').onclick = openNav; $('bMine').onclick = () => openKMenu(); $('bMem').onclick = () => openMem(); $('bFind').onclick = findMine; $('bSet').onclick = openSettings;
  $('bSound').onclick = () => { S.prefs.sound = !audio.on; local.savePrefs(S.prefs); S.prefs.sound ? audio.start() : audio.stop(); $('bSound').textContent = S.prefs.sound ? '🔊' : '🔈'; };
  $('bSound').textContent = '🔈'; const startAudio = () => { if (S.prefs.sound && !audio.on) { audio.start(); $('bSound').textContent = '🔊'; } if (S.prefs.music !== false && !music.on) music.start(); removeEventListener('pointerdown', startAudio); }; addEventListener('pointerdown', startAudio);
  const musicBtn = (on) => { $('bMusic').classList.toggle('off', !on); $('bMusic').title = on ? 'ปิดเพลงพื้นหลัง' : 'เปิดเพลงพื้นหลัง'; };
  music.onChange(on => { if (S.prefs.music !== on) { S.prefs.music = on; local.savePrefs(S.prefs); } musicBtn(on); }); musicBtn(false);
  $('bMusic').onclick = (e) => { e.stopPropagation(); music.on ? music.stop() : music.start(); };
  $('interact').onclick = () => world.near && handleInteract(world.near);
  if (matchMedia('(pointer:coarse)').matches) setupJoystick();
}
function setupJoystick() { const j = $('joy'), k = j.querySelector('i'); j.classList.remove('hidden'); let id = null;
  const mv = (e) => { const r = j.getBoundingClientRect(); let x = (e.clientX - r.left - 60) / 45, y = (e.clientY - r.top - 60) / 45; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } world.joy = { x, y }; k.style.transform = `translate(${x * 35}px,${y * 35}px)`; };
  j.addEventListener('pointerdown', e => { id = e.pointerId; j.setPointerCapture(id); mv(e); }); j.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
  const end = () => { id = null; world.joy = { x: 0, y: 0 }; k.style.transform = ''; }; j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end); }
const ZONE_ACTION = { entrance: '🏮 แก้ไขโปรไฟล์', dress: '👘 เปลี่ยนชุด', workshop: '🪷 เข้าศาลาประดิษฐ์กระทง', pond: '🧪 ทดลองลอยกระทง', rest: '💌 เขียนข้อความถึงสายน้ำ', icecream: '🍦 แวะไอศกรีมริมเล', pier: '🌊 ท่าน้ำลอยใจ', bridge: '🌳 สำรวจป่าชายเลน', memory: '✨ สายน้ำแห่งความทรงจำ' };
function onNear(item) {
  const b = $('interact');
  if (!item || (item.type === 'zone' && !ZONE_ACTION[item.id])) { b.classList.add('hidden'); if (S.dialogKey && !S.dialogSticky) closeDialog(); return; }
  b.textContent = item.type === 'teacher' ? `💬 คุยกับ${teacher(item.id).short}` : ZONE_ACTION[item.id]; b.classList.remove('hidden');
}
function handleInteract(item) {
  if (!item || world.escort || world.placing) return; audio.sfx('click');
  if (item.type === 'teacher') return openTeacher(item.id);
  ({ entrance: () => openCreator('edit'), dress: () => openCreator('dress'), workshop: () => openKMenu(), pond: () => { const d = currentDesign(); d ? openPond(d) : dialogSystem('🧪 บ่อทดลอง', 'ยังไม่มีกระทง ลองไปเลือกหรือประดิษฐ์ที่ศาลาประดิษฐ์กระทงก่อนนะ', [['🪷 ไปศาลาประดิษฐ์', () => goZone('workshop', () => openKMenu())], ['ปิด', closeDialog]]); },
    rest: () => openMsg(), icecream: iceCream, pier: pierMenu, bridge: bridgeMenu, memory: () => openMem() })[item.id]?.();
}
function goZone(id, done) { closeDialog(); world.walkToZone(id, done); }

/* ============================================================
   สร้างตัวละคร / ซุ้มแต่งตัว
   ============================================================ */
function openCreator(mode) {
  const look = { ...DEFAULT_LOOK, ...(S.player?.look || {}) }; S.crLook = look;
  $('crProfile').classList.toggle('hidden', mode === 'dress'); $('crCancel').classList.toggle('hidden', mode === 'new');
  $('crGo').textContent = mode === 'new' ? 'เข้างานกันเลย 🏮' : mode === 'dress' ? 'ใส่ชุดนี้ 👘' : 'บันทึกโปรไฟล์';
  $('crClass').innerHTML = CLASSES.map(c => `<option ${S.player?.cls === c ? 'selected' : ''}>${c}</option>`).join(''); $('crName').value = S.player?.nickname || '';
  const groups = [['body', 'รูปร่าง', [['', 'มาตรฐาน'], ['f', 'ผู้หญิง'], ['m', 'ผู้ชาย']]], ['outfit', 'ชุด', OUTFITS], ['bottom', 'ท่อนล่าง', BOTTOMS], ['top', 'สีเสื้อ', CLOTH_COLORS], ['bottomColor', 'สีท่อนล่าง', CLOTH_COLORS], ['hair', 'ทรงผม', HAIR_STYLES], ['hairColor', 'สีผม', HAIR_COLORS], ['skin', 'สีผิว', SKIN_TONES], ['shoes', 'สีรองเท้า', ['#222222', '#ffffff', '#7f5539', '#1f3a6b', '#e63946']], ['acc', 'เครื่องประดับ', ACCESSORIES], ['accColor', 'สีเครื่องประดับ', ['#ff8fb1', '#ffd166', '#ffffff', '#4cc9f0', '#e63946', '#2a9d8f']]];
  const render = () => { $('crOpts').innerHTML = groups.map(([k, n, list]) => `<label class="l">${n}</label>` + (Array.isArray(list[0]) ? `<div class="chips">${list.map(([v, l]) => `<button class="chip ${look[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>` : `<div class="sw">${list.map(c => `<button class="${look[k] === c ? 'on' : ''}" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${n} ${c}"></button>`).join('')}</div>`)).join('');
    $('crOpts').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const OT = { student: '#ffffff', thai: '#e5989b', local: '#1f3a6b', casual: '#81b29a' }; if (b.dataset.k === 'outfit' && (!look.top || Object.values(OT).includes(look.top))) look.top = OT[b.dataset.v]; look[b.dataset.k] = b.dataset.v; render(); preview(); }); };
  const preview = () => { if (!crViewer) crViewer = new Viewer($('crCanvas'), { bg: '#1b1745', minD: 2, maxD: 6 }); const av = buildAvatar(look); crViewer.showObject(av, { target: 0.95, dist: [0, 1.4, 3.4], spin: true }); };
  render(); openOv('ovCreator'); requestAnimationFrame(preview);
  $('crCancel').onclick = () => closeOv('ovCreator');
  $('crGo').onclick = () => {
    if (mode !== 'dress') { const nm = $('crName').value.trim(); if (!nm) return toast('กรุณากรอกชื่อเล่น'); if (screenText(nm).length) return toast('ลองใช้ชื่อเล่นอื่นที่สุภาพและไม่เป็นข้อมูลส่วนตัว'); S.player = { ...(S.player || { id: uid('u'), token: uid('t') + uid('s'), createdAt: Date.now() }), nickname: nm, cls: $('crClass').value }; }
    S.player.look = { ...look }; local.savePlayer(S.player); world.setPlayerLook(S.player.look); if (heldDesign() && !world.heldDesign) world.setHolding(heldDesign()); updatePlayerChip(); closeOv('ovCreator');
    if (mode === 'new') { world.teleport(5, 6); setTimeout(() => dialogSystem('🏮 ยินดีต้อนรับสู่งาน', `สวัสดี ${esc(S.player.nickname)}! เดินด้วยการคลิก/แตะพื้น ปุ่ม WASD หรือจอยสติ๊ก<br>• คุยกับครูที่เดินอยู่ทั่วงาน (จุดสีบนแผนที่ย่อ หรือปุ่ม 🧭 นำทาง)<br>• ประดิษฐ์กระทงที่ <b>ศาลาประดิษฐ์กระทง</b> (มุมขวาบน)<br>• เขียนข้อความที่ <b>ศาลาพักใจ</b> แล้ว <b>ชวนครู</b> ไปลอยด้วยกันที่ท่าน้ำ`, [['🧭 เปิดนำทาง', () => { closeDialog(); openNav(); }], ['เริ่มเดินเที่ยว', closeDialog]]), 400); }
    else toast(mode === 'dress' ? 'เปลี่ยนชุดแล้ว ✨' : 'บันทึกโปรไฟล์แล้ว');
  };
}

/* ============================================================
   บทสนทนา
   ============================================================ */
function showDialog({ who, text, opts = [], note = '', key = null, sticky = false }) {
  const d = $('dialog'); S.dialogKey = key; S.dialogSticky = sticky;
  d.innerHTML = `<div class="dh"><div class="port" style="background:${who.color || '#6d597a'}">${esc(who.icon || [...String(who.name || '?').replace(/^ครู|^Mr\.\s*/, '')][0])}</div><div><b>${esc(who.name)}</b><small>${esc(who.sub || '')}</small></div><span class="sp"></span><button class="ib" data-x style="width:38px;height:38px">✕</button></div>
    <div class="dtext">${text}</div><div class="dopts">${opts.map((o, i) => `<button data-i="${i}" class="${o[2] || ''}">${o[0]}</button>`).join('')}</div>${note ? `<div class="npcnote">${note}</div>` : ''}`;
  d.classList.remove('hidden'); d.querySelector('[data-x]').onclick = closeDialog; d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { audio.sfx('click'); opts[+b.dataset.i][1](b); });
}
function closeDialog() { $('dialog').classList.add('hidden'); S.dialogKey = null; S.dialogSticky = false; }
const dialogSystem = (name, text, opts) => showDialog({ who: { name, color: '#3d405b', icon: '🏮' }, text, opts, sticky: true });
const whoT = (t) => ({ name: t.short, sub: t.subject, color: t.color });

function openTeacher(id) {
  const t = teacher(id); if (!t) return; if (!S.progress.talked.includes(id)) { S.progress.talked.push(id); local.saveProgress(S.progress); }
  const greet = t.greet[Math.floor(Math.random() * t.greet.length)];
  teacherMenu(t, esc(greet));
}
function teacherMenu(t, text) {
  showDialog({ who: whoT(t), key: 'teacher' + t.id, note: NPC_NOTE, text, opts: [
    ['📖 ครูมีเรื่องอะไรเล่าให้ฟังบ้าง?', () => teacherFacts(t, 0)],
    ['🎯 ลองทำกิจกรรมกับครู', () => teacherActivity(t)],
    ['🪷 ช่วยแนะนำการทำกระทงหน่อย', () => teacherMenuSub(t, esc(t.craft), [['🪷 ไปศาลาประดิษฐ์กระทง', () => goZone('workshop', () => openKMenu())]])],
    ['💌 ช่วยแนะนำข้อความใส่กระทงหน่อย', () => teacherMenuSub(t, esc(t.msg), [['✍️ เขียนข้อความตอนนี้', () => { closeDialog(); openMsg(); }]])],
    ['🌊 ชวนครูไปลอยกระทงด้วยกัน', () => invite(t)],
    ['👋 ไว้พบกันใหม่นะคะ/ครับ', closeDialog]] });
}
function teacherMenuSub(t, text, extra = []) { showDialog({ who: whoT(t), key: 'teacher' + t.id, note: NPC_NOTE, text, opts: [...extra, ['↩ กลับ', () => teacherMenu(t, 'มีอะไรอยากคุยอีกไหม')]] }); }
function teacherFacts(t, i) { teacherMenuSub(t, `<b>เกร็ดความรู้ ${i + 1}/${t.facts.length}</b><br>${esc(t.facts[i])}`, i < t.facts.length - 1 ? [['ถัดไป ›', () => teacherFacts(t, i + 1)]] : []); }
function teacherActivity(t) {
  const a = t.activity || {}; if (!S.progress.activities.includes(t.id)) { S.progress.activities.push(t.id); local.saveProgress(S.progress); }
  if (a.kind === 'trash') return teacherMenuSub(t, `<b>${esc(a.title)}</b><br>น้องปลาตีนรออยู่ที่สะพานป่าชายเลน ช่วยเดินเก็บขยะเสมือน 8 ชิ้นริมคลองและบนสะพานนะ (ไม่มีคะแนนหรืออันดับ ทำแค่ไหนก็ได้)`, [['🐟 เริ่มเลย นำทางไปที่สะพาน', () => { world.startTrash(); closeDialog(); world.walkTo(43.5, 33.5); toast('เดินเข้าใกล้ขยะที่มีแสงเพื่อเก็บ'); }]]);
  runQuiz(t, 0);
}
function runQuiz(t, i) {
  const a = t.activity, st = a.steps[i]; if (!st) return;
  showDialog({ who: whoT(t), key: 'teacher' + t.id, note: NPC_NOTE + ' · กิจกรรมนี้ไม่ใช่ข้อสอบ และไม่บังคับก่อนลอยกระทง', text: `<b>🎯 ${esc(a.title)}</b> <span class="muted">(${i + 1}/${a.steps.length})</span><br>${esc(st.q)}`,
    opts: st.opts.map((o, k) => [esc(o), (btn) => {
      const ok = k === st.a; btn.parentElement.querySelectorAll('button').forEach((b, j) => { b.disabled = true; b.classList.add('qopt'); if (j === st.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      const d = document.createElement('div'); d.className = 'dtext'; d.style.marginTop = '8px'; d.innerHTML = `${ok ? '✅ ถูกต้อง!' : '💡 ลองดูคำอธิบายนะ'} ${esc(st.ex)}`; btn.parentElement.after(d);
      const row = document.createElement('div'); row.className = 'row'; row.style.marginTop = '8px';
      if (st.insert) { const ib = document.createElement('button'); ib.className = 'btn sm pink'; ib.textContent = '💌 ใช้ข้อความนี้ในกระทง'; ib.onclick = () => { const f = t.id === 't23' ? 'self' : 'friends'; const m = local.msg(); m[f] = (m[f] ? m[f] + ' ' : '') + st.insert; m[f] = m[f].slice(0, LIMITS.msg); local.saveMsg(m); toast('เพิ่มลงข้อความแล้ว'); if (a.kind === 'message') { closeDialog(); openMsg({ focus: f }); } }; row.append(ib); }
      const nb = document.createElement('button'); nb.className = 'btn sm'; nb.textContent = i < a.steps.length - 1 ? 'ข้อต่อไป ›' : 'จบกิจกรรม'; nb.onclick = () => i < a.steps.length - 1 ? runQuiz(t, i + 1) : teacherMenu(t, 'ขอบคุณที่มาทำกิจกรรมกับครูนะ 😊'); row.append(nb);
      d.after(row); audio.sfx(ok ? 'chime' : 'click');
    }]) });
}

/* ---------- ชวนครู ---------- */
function invite(t) {
  if (!isOpen()) return teacherMenuSub(t, 'ตอนนี้อยู่นอกเวลาเปิดงานลอยกระทง ยังเดินเที่ยวและประดิษฐ์กระทงได้นะ');
  if (world.escort) return toast('ชวนครูได้ครั้งละหนึ่งคน');
  const d = currentDesign();
  if (!d) return teacherMenuSub(t, `${esc(t.invite)}<br><br>แต่เรายังไม่มีกระทงเลย ไปเลือกหรือประดิษฐ์ก่อนนะ แล้วกลับมาชวนครูอีกครั้ง`, [['🪷 ไปศาลาประดิษฐ์กระทง', () => goZone('workshop', () => openKMenu())]]);
  const m = local.msg(); const empty = !m.river.trim() && !m.friends.trim();
  showDialog({ who: whoT(t), key: 'teacher' + t.id, sticky: true, note: NPC_NOTE, text: `${esc(t.invite)}<div class="row" style="margin-top:10px"><img src="${thumbOf(d)}" style="width:110px;border-radius:12px" alt=""><div><b>${esc(d.name)}</b><br><span class="muted">${d.pieces.length} ชิ้นส่วน · จะลอยแบบที่ออกแบบไว้</span>${empty ? '<br><span class="muted">ยังไม่ได้เขียนข้อความ (ไม่บังคับ)</span>' : ''}</div></div>`,
    opts: [['🚶 ถือกระทงแล้วเดินไปท่าน้ำด้วยกัน', () => startEscortWith(t.id)], ['✍️ เขียน/แก้ข้อความก่อน', () => { closeDialog(); openMsg(); }], ['🪷 เปลี่ยนกระทง', () => { closeDialog(); openKMenu('drafts'); }], ['↩ ไว้ก่อน', () => teacherMenu(t, 'ไม่เป็นไร พร้อมเมื่อไหร่ก็มาชวนครูได้นะ')]] });
}
function startEscortWith(tid) {
  const d = currentDesign(); if (!d) return; const t = teacher(tid); closeDialog();
  if (!world.startEscort(tid, d)) return toast('ตอนนี้ยังเริ่มไม่ได้'); S.pending = { floatId: uid('fl'), teacherId: tid };
  const bar = $('escortBar'); bar.classList.remove('hidden');
  bar.innerHTML = `<span>🚶 กำลังถือกระทงเดินไปท่าน้ำกับ <b>${esc(t.short)}</b></span><button class="btn sm ghost" id="eSkip">⏭ ข้ามฉาก</button><button class="btn sm ghost" id="eCancel">✕ ยกเลิก</button>`;
  $('eSkip').onclick = () => world.skipEscort(); $('eCancel').onclick = cancelFloat;
}
function cancelFloat() { closeOv('ovFloat'); world.cancelEscort(); holdDesign(currentDesign()); S.pending = null; $('escortBar').classList.add('hidden'); toast('ยกเลิกแล้ว ชวนครูใหม่ได้เสมอ'); }

/* ---------- ท่าน้ำ ---------- */
function pierMenu() {
  const d = currentDesign();
  dialogSystem('🌊 ท่าน้ำลอยใจ', isOpen() ? 'ลอยสิ่งที่หนักใจ และส่งสิ่งดี ๆ ให้กัน · ลอยคนเดียวได้ หรือไปชวนครูที่เดินอยู่ในงานมาด้วยกันก็ได้' : 'ตอนนี้อยู่นอกเวลาเปิดงาน ยังชมสายน้ำได้นะ', [
    ...(isOpen() ? [[d ? `🪷 ลอย "${esc(d.name)}" คนเดียว` : '🪷 ยังไม่มีกระทง — ไปศาลาประดิษฐ์', () => { if (!d) return goZone('workshop', () => openKMenu()); closeDialog(); holdDesign(d); world.walkTo(PIER_POINT.x, PIER_POINT.z, () => { world.player.userData.heading = 0; world.setHolding(d); S.pending = { floatId: uid('fl'), teacherId: '' }; openFloatConfirm(null); }); }],
      ['👩‍🏫 ไปชวนครูมาด้วยกัน', () => { closeDialog(); openNav(); }]] : []),
    ['✨ ชมสายน้ำแห่งความทรงจำ', () => { closeDialog(); openMem(); }], ['ปิด', closeDialog]]);
}

/* ---------- ยืนยันก่อนลอย: พิมพ์คำอธิษฐาน → แสดงบนป้ายใบตองของกระทง ---------- */
const WISH_STARTERS = ['ขอให้แม่น้ำใสสะอาดตลอดไป', 'ขอให้ครอบครัวมีสุขภาพแข็งแรง', 'ขอให้เรียนเก่งและสอบผ่านทุกวิชา', 'ขอบคุณแม่น้ำที่หล่อเลี้ยงชีวิต', 'ขอให้เพื่อน ๆ มีความสุข', 'จะช่วยกันไม่ทิ้งขยะลงน้ำ'];
function openFloatConfirm(tid) {
  const d = currentDesign(); if (!d) { cancelFloat(); return toast('ไม่พบกระทงที่เลือก'); }
  S.pending = S.pending || { floatId: uid('fl'), teacherId: tid || '' }; const m = local.msg(); m.wish = m.wish || ''; const t = tid ? teacher(tid) : null; let pt = 0;
  const withWish = () => ({ ...d, wish: cleanWish(m.wish) });
  const refreshPrev = () => { clearTimeout(pt); pt = setTimeout(() => { const img = $('fPrev'); if (img) img.src = makeThumb(withWish(), 360, 270); if (world && !world.placing) world.setHolding(withWish()); }, 250); };
  const render = () => { const name = displayName(m.nameMode, S.player.nickname, S.player.cls); const warn = [...new Set([m.river, m.friends, m.wish].flatMap(screenText))];
    $('floatBody').innerHTML = `<div class="cols" style="margin-top:8px"><div><img id="fPrev" src="${makeThumb(withWish(), 360, 270)}" style="width:100%;border-radius:14px" alt="ตัวอย่างกระทงพร้อมป้ายคำอธิษฐาน">
      <b class="f-mitr">${esc(d.name)}</b><div class="muted">${d.pieces.length} ชิ้นส่วน · กระทงที่ลอยคือแบบที่คุณออกแบบไว้ (บันทึกสำเนา ณ ตอนนี้)</div>
      ${t ? `<div style="margin-top:6px">👩‍🏫 เดินมาด้วยกันกับ <b>${esc(t.short)}</b></div>` : ''}</div>
      <div><div class="msgbox" style="margin-top:0"><h4>🙏 คำอธิษฐาน <span class="cnt" id="fWc">${m.wish.length}/60</span></h4><p class="muted">แสดงบน <b>ป้ายใบตองของกระทง</b> ผู้ร่วมงานทุกคนมองเห็นในแม่น้ำ</p>
        <input class="f" id="fWish" maxlength="60" value="${esc(m.wish)}" placeholder="เช่น ขอให้แม่น้ำใสสะอาดตลอดไป">
        <div class="chips" style="margin-top:6px">${WISH_STARTERS.map(w => `<button class="chip" data-ws="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>
      <label class="l">รูปแบบการแสดงชื่อ</label><div class="chips">${NAME_MODES.map(([k, l]) => `<button class="chip ${m.nameMode === k ? 'on' : ''}" data-nm="${k}">${l}</button>`).join('')}</div>
      <div class="preview"><small>ข้อความที่ผู้ร่วมงานจะเห็นเมื่อแตะกระทง</small><br>${m.wish ? `🙏 ${esc(m.wish)}<br>` : ''}${m.river ? `🌊 ${esc(m.river)}<br>` : ''}${m.friends ? `💛 ${esc(m.friends)}<br>` : ''}${!m.river && !m.friends && !m.wish ? '<small>(ไม่มีข้อความ — ลอยได้)</small><br>' : ''}<small>— ${name ? esc(name) : 'ไม่แสดงชื่อ'}</small></div></div></div>
      ${m.self ? `<div class="notice">🔒 ข้อความ "ถึงตัวเอง" เห็นได้เฉพาะคุณ ไม่แสดงในแม่น้ำส่วนรวม</div>` : ''}
      <div class="notice">📢 คำอธิษฐาน ข้อความ "ถึงแม่น้ำ" และ "ถึงเพื่อน ๆ" <b>ผู้ร่วมงานอ่านได้</b> · ไม่ควรใส่ชื่อจริง เบอร์โทร หรือเรื่องส่วนตัว${m.nameMode === 'anon' ? '<br>👤 <b>ไม่แสดงชื่อแก่ผู้ร่วมงาน</b> — ผู้ดูแลระบบยังตรวจสอบเจ้าของได้เพื่อความปลอดภัย' : ''}</div>
      ${warn.length ? `<div class="warnbox">⚠ ${warn.join(', ')} — ข้อความลักษณะนี้จะรอผู้ดูแลตรวจก่อนแสดง</div>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="fEdit">✏️ แก้ข้อความอื่น</button><button class="btn ghost" id="fCancel">ยกเลิก</button><span class="sp"></span><button class="btn pink" id="fGo">🪷 ลอยกระทง</button></div>`;
    const wi = $('fWish'); wi.addEventListener('input', () => { m.wish = wi.value.slice(0, 60); $('fWc').textContent = `${m.wish.length}/60`; local.saveMsg(m); refreshPrev(); });
    wi.addEventListener('change', () => render());
    $('floatBody').querySelectorAll('[data-ws]').forEach(b => b.onclick = () => { m.wish = b.dataset.ws; local.saveMsg(m); render(); refreshPrev(); });
    $('floatBody').querySelectorAll('[data-nm]').forEach(b => b.onclick = () => { m.nameMode = b.dataset.nm; local.saveMsg(m); render(); });
    $('fEdit').onclick = () => { closeOv('ovFloat'); openMsg({ after: () => openFloatConfirm(tid) }); }; $('fCancel').onclick = cancelFloat; $('fGo').onclick = () => confirmFloat(d, m, tid); };
  render(); openOv('ovFloat'); refreshPrev();
}
async function confirmFloat(d, m, tid) {
  const btn = $('fGo'); if (!btn || btn.disabled) return; btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  const snapshot = sanitizeDesign({ ...cloneDesign(d), id: uid('k'), wish: cleanWish(m.wish), owner: '' }); snapshot.thumb = makeThumb(snapshot) || d.thumb;
  const payload = { floatId: S.pending.floatId, token: S.player.token, nickname: S.player.nickname, cls: S.player.cls, nameMode: m.nameMode, design: snapshot, messages: { river: m.river, friends: m.friends }, teacherId: tid || '' };
  let rec; try { rec = await store.float(payload); } catch (e) { btn.disabled = false; btn.textContent = '🪷 ลองอีกครั้ง'; return toast('ส่งไม่สำเร็จ: ' + e.message); }
  rec.design = rec.design && rec.design.pieces ? rec.design : snapshot; if (!rec.design.thumb) rec.design.thumb = snapshot.thumb; const mine = { ...rec, self: m.self, floatId: payload.floatId, mine: true };
  S.myFloats = S.myFloats.filter(f => f.id !== rec.id && f.floatId !== payload.floatId); S.myFloats.push(mine); local.saveMyFloats(S.myFloats); S.lastFloatId = rec.id;
  m.wish = ''; local.saveMsg(m);
  closeOv('ovFloat'); world.inputEnabled = false; const t = tid ? teacher(tid) : null;
  world.placeKrathong(mine, t ? t.farewell : ''); holdDesign(null); S.pending = null; $('escortBar').classList.add('hidden');
}
function afterPlaced(rec) {
  world.inputEnabled = !document.querySelector('.ov.show'); if (!S.publicFloats.find(f => f.id === rec.id) && rec.status === 'ok') S.publicFloats.push(rec);
  if (rec.status === 'pending') toast('ข้อความรอผู้ดูแลตรวจก่อนแสดงในแม่น้ำส่วนรวม (คุณยังเห็นกระทงของคุณ)');
  if (!world.escort) postFloatChoices(null);
}
function showFarewell(tid, text) { postFloatChoices(teacher(tid), text); }
function postFloatChoices(t, text) {
  const opts = [['🔭 ติดตามกระทง', () => { closeDialog(); followMine(S.lastFloatId); }], ['🚶 เดินเที่ยวต่อ', closeDialog], ['✨ สายน้ำแห่งความทรงจำ', () => { closeDialog(); openMem(); }]];
  if (t) showDialog({ who: whoT(t), text: esc(text) + '<br><span class="muted">ครูโบกมือ แล้วเดินเที่ยวงานต่อ</span>', opts, note: NPC_NOTE, sticky: true });
  else dialogSystem('🌊 ท่าน้ำลอยใจ', 'กระทงของคุณสัมผัสสายน้ำแล้ว ค่อย ๆ ลอยออกไป 🪷', opts);
  audio.sfx('chime');
}
function followMine(id) { if (!id) return; world.follow(id); const bar = $('escortBar'); bar.classList.remove('hidden'); bar.innerHTML = `<span>🔭 กำลังติดตามกระทงของคุณ</span><button class="btn sm ghost" id="fRead">อ่านข้อความ</button><button class="btn sm ghost" id="fStop">หยุดติดตาม</button>`;
  $('fRead').onclick = () => openView(id); $('fStop').onclick = () => { world.follow(null); bar.classList.add('hidden'); }; }

/* ============================================================
   ศาลาประดิษฐ์กระทง
   ============================================================ */
function openKMenu(tab) {
  tab = tab || (local.drafts().length ? 'drafts' : 'scratch');
  S.kmTab = tab; const tabs = [['scratch', '🛠 ประดิษฐ์เอง (3 มิติ)'], ['inspire', '💡 แรงบันดาลใจ'], ['cut', '✂️ โต๊ะช่าง'], ['drafts', '📁 กระทงของฉัน']];
  $('kmTabs').innerHTML = tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}">${l}</button>`).join('');
  $('kmTabs').querySelectorAll('button').forEach(b => b.onclick = () => openKMenu(b.dataset.t));
  const body = $('kmBody'); kmViewer?.stop(); openOv('ovKMenu');
  if (tab === 'inspire') {
    body.innerHTML = `<div class="notice" style="margin-top:0">💡 <b>ดูเป็นแรงบันดาลใจเท่านั้น</b> — ไม่มีแบบสำเร็จรูปให้ใช้ ลองสังเกตการจัดวาง สมดุล กลไก และวงจร แล้วไปประดิษฐ์เป็นแบบของตัวเองที่ <b>🛠 ประดิษฐ์เอง</b></div>
      <div class="grid insp" style="margin-top:12px">${INSPIRATIONS.map(p => `<figure class="kc" data-zoom="${p.id}"><img src="${inspThumb(p.id)}" alt="ภาพแรงบันดาลใจ ${esc(p.name)}" loading="lazy"><b>${esc(p.name)}</b><small>${esc(p.idea)}</small></figure>`).join('')}</div>
      <div class="row" style="margin-top:14px;justify-content:center"><button class="btn" id="kmGo">🛠 ไปประดิษฐ์เอง</button><button class="btn ghost" id="kmKnow">📘 ความรู้การออกแบบ</button></div>`;
    body.querySelectorAll('[data-zoom]').forEach(f => f.onclick = () => { const p = INSPIRATIONS.find(x => x.id === f.dataset.zoom);
      $('photoBody').innerHTML = `<img src="${renderPhoto(inspirationDesign(p.id), 900, 900)}" class="photo-img" alt=""><h3 class="f-mitr" style="margin-top:10px;color:var(--gold2)">${esc(p.name)}</h3><p>${esc(p.idea)}</p><p class="muted">ภาพแรงบันดาลใจ — ลองนำแนวคิดไปออกแบบในแบบของคุณ</p>`; openOv('ovPhoto'); });
    $('kmGo').onclick = () => openKMenu('scratch'); $('kmKnow').onclick = () => openKnowledge('balance');
  } else if (tab === 'scratch') {
    body.innerHTML = `<p>เริ่มจากฐานเปล่า แล้วนำวัสดุมาประกอบตามความคิดของคุณ</p><div class="grid" style="margin-top:10px">${Object.entries(BASES).map(([k, b]) => `<button class="kc" data-b="${k}"><div class="ph">${b.icon}</div><b>${b.name}</b><small>เริ่มประดิษฐ์บนโต๊ะ 3 มิติ</small></button>`).join('')}</div>
      <div class="notice">ในโต๊ะประดิษฐ์มี: 🧺 วัตถุดิบที่ตัดเอง · ⚙️ เพลา เฟือง รอก · 🔌 ไฟ LED มอเตอร์ เซ็นเซอร์ · ✏️ วาดชิ้นส่วนเอง · 📐 พิมพ์องศาการหมุน · ⚖️ ดูจุดศูนย์ถ่วง · 📸 บันทึกภาพ</div>`;
    body.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { closeOv('ovKMenu'); openWorkshop(newDesign(b.dataset.b, S.player?.id)); });
  } else if (tab === 'cut') {
    const inv = local.inv(); body.innerHTML = `<p>เลือกเครื่องมือช่างให้เหมาะกับงาน แล้วตัดใบตองเป็นกลีบแบบต่าง ๆ เก็บเป็น <b>วัตถุดิบของฉัน</b> ไว้ใช้ที่โต๊ะประดิษฐ์</p>
      <div class="grid" style="margin-top:10px">${Object.entries(MATERIALS).filter(([, m]) => m.inv).map(([id, m]) => `<div class="kc"><div class="ph">${m.icon}</div><b>${m.name}</b><small>มีอยู่ ${inv[id] || 0} ชิ้น</small></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn" id="kmCut">✂️ เปิดโต๊ะช่าง</button><button class="btn ghost" id="kmTools">🧰 ความรู้เครื่องมือช่าง</button></div>`;
    $('kmCut').onclick = () => openCuttingTable({ inv: () => local.inv(), toast, onStore: (m, n) => { const v = local.inv(); v[m] = (v[m] || 0) + n; local.saveInv(v); openKMenu('cut'); } });
    $('kmTools').onclick = () => openKnowledge('tools');
  } else {
    const drafts = local.drafts(), cur = local.current();
    body.innerHTML = drafts.length ? `<div class="grid">${drafts.map(d => `<div class="kc ${d.id === cur ? 'on' : ''}"><img src="${thumbOf(d)}" alt=""><b>${esc(d.name)}</b><small>${d.pieces.length} ชิ้น · แก้ไข ${fmtTime(d.updatedAt)}</small>${d.id === cur ? '<span class="pill ok">กำลังใช้ / ถืออยู่</span>' : ''}
      <div class="row"><button class="btn sm" data-use="${d.id}">ใช้ & ถือ</button><button class="btn sm ghost" data-ed="${d.id}">แก้ไข</button><button class="btn sm ghost" data-ph="${d.id}">📸</button><button class="btn sm ghost" data-cp="${d.id}">สำเนา</button><button class="btn sm ghost" data-del="${d.id}">ลบ</button></div></div>`).join('')}</div>` : '<p class="muted">ยังไม่มีกระทงที่บันทึกไว้ ลองประดิษฐ์เองที่แท็บ 🛠 ประดิษฐ์เอง</p>';
    const get = (id) => drafts.find(d => d.id === id);
    body.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { local.setCurrent(b.dataset.use); holdDesign(get(b.dataset.use)); toast('เลือกกระทงแล้ว ตัวละครถือกระทงไว้ 🪷'); openKMenu('drafts'); });
    body.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { closeOv('ovKMenu'); openWorkshop(get(b.dataset.ed)); });
    body.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => photoKrathong(get(b.dataset.ph)));
    body.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { const d = cloneDesign(get(b.dataset.cp)); d.id = uid('k'); d.name = (d.name + ' (สำเนา)').slice(0, 40); d.createdAt = Date.now(); d.version = 1; local.saveDraft(d); openKMenu('drafts'); });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('ลบร่างกระทงนี้? (กระทงที่ลอยไปแล้วจะไม่ถูกลบ)')) { local.deleteDraft(b.dataset.del); if (S.prefs.holding === b.dataset.del) holdDesign(null); openKMenu('drafts'); } });
  }
}
function suggestNext() { const m = local.msg(); dialogSystem('🪷 กระทงพร้อมแล้ว — ตัวละครถือกระทงไว้แล้ว', 'ทำอะไรต่อดี? (คำอธิษฐานจะพิมพ์ตอนลอยที่ท่าน้ำ)', [['🧪 ทดลองลอยในบ่อทดลอง', () => { closeDialog(); openPond(currentDesign()); }], [m.river || m.friends ? '💌 แก้ไขข้อความ' : '💌 เขียนข้อความถึงสายน้ำ', () => { closeDialog(); openMsg(); }], ['👩‍🏫 ไปชวนครูลอยกระทง', () => { closeDialog(); openNav(); }], ['🌊 เดินไปท่าน้ำ', () => { closeDialog(); goZone('pier', pierMenu); }], ['ปิด', closeDialog]]); }
function sketchPreview(box, sk, c) {
  if (!skCanvas) skCanvas = document.createElement('canvas'); box.innerHTML = ''; box.append(skCanvas);
  if (!skViewer) skViewer = new Viewer(skCanvas, { bg: '#1b1745', minD: 0.25, maxD: 4 });
  const obj = MATERIALS.sketch.build(c, { sk: sk.id }, { sketches: [sk] }); const h = sk.k === 'lathe' ? Math.min(1.1, 0.32 * sk.a) : sk.k === 'extrude' ? 0.3 : 0.15;
  const dist = sk.k === 'flower' ? [0.3, 0.55, 0.48] : sk.k === 'extrude' ? [0.3, 0.3, 0.6] : [0.45, 0.35 + h * 0.5, 0.6 + h]; skViewer.showObject(obj, { target: h / 2, dist, spin: true }); return { dispose: () => skViewer.stop() };
}
function openWorkshop(design) {
  try { if (!ws) ws = new Workshop($('workshop'), toast); } catch (e) { console.error(e); toast('อุปกรณ์นี้ไม่รองรับโต๊ะ 3 มิติ'); return; }
  world.paused = true; world.inputEnabled = false; closeDialog();
  const resume = () => { world.paused = false; world.inputEnabled = !document.querySelector('.ov.show'); };
  ws.open(design, { disabled: disabledMats(), onSave: (d) => { local.saveDraft(d); },
    inv: () => local.inv(), onInv: (v) => local.saveInv(v), sketches: () => local.sketches(),
    onSketch: (sk) => { const l = local.sketches().filter(x => x.id !== sk.id); l.unshift(sk); local.saveSketches(l); }, sketchPreview,
    onPhoto: (d, url) => photoKrathong(d, url),
    onTest: (d) => openPond(d, { fromWorkshop: true }), onClose: resume,
    onDone: (d) => { setCurrentDesign(d); resume(); toast(`บันทึก "${d.name}" แล้ว — ตัวละครถือกระทงไว้ ✅`); suggestNext(); } });
}

/* ============================================================
   บ่อทดลอง
   ============================================================ */
function openPond(d, opts = {}) {
  if (!d) return; $('ovPond').style.zIndex = opts.fromWorkshop ? 60 : ''; openOv('ovPond');
  if (!pondViewer) pondViewer = new Viewer($('pondCanvas'), { bg: '#0f2a46' }); pondViewer.showKrathong(d, { water: true, reflections: S.prefs.reflections, dist: [2.8, 2.0, 3.2] });
  document.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => pondViewer.setCam(b.dataset.pc));
  const s = computeStats(d); const colors = new Set(d.pieces.map(p => p.c || MATERIALS[p.m].color)); const T = (id) => teacher(id);
  const tips = [
    [T('t05'), s.offset < 0.12 ? 'น้ำหนักกระจายรอบฐานดี ในการจำลองกระทงลอยค่อนข้างตั้งตรง' : s.offset < 0.3 ? 'ในการจำลองกระทงเอียงเล็กน้อย ลองย้ายของหนัก เช่น เทียน เข้ากลางฐาน' : 'ในการจำลองกระทงเอียงมาก ลองกระจายวัสดุให้สมดุลรอบฐาน'],
    [T('t17'), colors.size > 6 ? `ใช้ ${colors.size} สี ลองเลือกสีหลัก 1 สี และสีรอง 1–2 สี จะดูกลมกลืนขึ้น` : 'โทนสีกลมกลืนดี จุดเด่นชัดเจน'],
    [T('t11'), d.pieces.length > 40 ? `ใช้ ${d.pieces.length} ชิ้น ถ้าทำจริงลองลดจำนวนชิ้น จะคุ้มค่าและมีขยะน้อยลง` : `ใช้ ${d.pieces.length} ชิ้น กำลังพอดี`],
    ...(s.fantasy ? [[T('t06'), `มีของตกแต่งจินตนาการ ${s.fantasy} ชิ้น ใช้ได้ในเกมเท่านั้น กระทงจริงไม่ควรใส่พลาสติกหรือตุ๊กตา`]] : [])];
  const cw = evalCircuit(d, { water: true });
  $('pondInfo').innerHTML = `<h3 class="f-mitr" style="color:var(--gold2)">${esc(d.name)}</h3>
    <div class="stat"><span>จำนวนชิ้นส่วน</span><b>${s.count}</b></div><div class="stat"><span>ความสมดุล (จำลอง)</span><b>${s.balance}</b></div><div class="stat"><span>ความสูงโดยประมาณ (หน่วยในเกม)</span><b>${s.height.toFixed(2)}</b></div>
    <div class="stat"><span>จุดศูนย์ถ่วง (x̄, z̄)</span><b>(${s.cx.toFixed(2)}, ${s.cz.toFixed(2)})</b></div>
    ${cw.any ? `<div class="stat"><span>วงจรไฟฟ้าเมื่อลงน้ำ</span><b>${cw.powered ? '💡 ทำงาน' : '⭕ ไม่ทำงาน'}</b></div>${cw.n.water_sensor ? `<div class="muted">💧 เซ็นเซอร์น้ำ${cw.powered ? 'สัมผัสน้ำแล้ว ต่อวงจรให้ไฟติด' : 'สัมผัสน้ำแล้ว แต่วงจรยังไม่ครบ'}</div>` : ''}${cw.n.tilt_sensor ? `<div class="muted">📐 เซ็นเซอร์เอียง: ${s.offset > 0.3 ? 'ตรวจพบความเอียง ไฟเตือนกะพริบ' : 'กระทงสมดุล ไม่เตือน'}</div>` : ''}` : ''}
    ${tips.map(([t, x]) => `<div class="tip"><div class="port" style="background:${t.color}">${esc(t.short.replace('ครู', '').slice(0, 1))}</div><div><b>${esc(t.short)}</b><br>${esc(x)}</div></div>`).join('')}
    <div class="notice">🔬 ผลนี้เป็น <b>การจำลองเพื่อการเรียนรู้</b> ไม่ใช่ผลทดสอบกระทงจริง และไม่ได้ยืนยันว่ากระทงจริงจะลอยได้ · ไม่มีผลต่อการร่วมกิจกรรม</div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" id="pEdit">🛠 กลับไปแก้ไข</button><button class="btn ghost" id="pPhoto">📸 บันทึกภาพ</button><button class="btn" id="pUse">✅ ใช้กระทงนี้</button></div>`;
  $('pPhoto').onclick = () => photoKrathong(d);
  $('pEdit').onclick = () => { closeOv('ovPond'); if (!opts.fromWorkshop) openWorkshop(d); };
  $('pUse').onclick = () => { closeOv('ovPond'); if (opts.fromWorkshop) { ws.act('done'); } else { setCurrentDesign(d); toast('เลือกใช้กระทงนี้แล้ว'); suggestNext(); } };
}

/* ============================================================
   ศาลาพักใจ: ข้อความ
   ============================================================ */
function openMsg(opts = {}) {
  const editing = opts.editRec; const m = editing ? { river: editing.messages.river, friends: editing.messages.friends, self: editing.self || '', nameMode: editing.nameMode || 'full' } : local.msg();
  const boxes = [['river', '🌊 ถึงแม่น้ำ…', 'ขอบคุณ ขอโทษ หรือสิ่งที่ตั้งใจจะทำเพื่อดูแลแม่น้ำ'], ['friends', '💛 ถึงเพื่อน ๆ…', 'คำขอบคุณ กำลังใจ หรือความทรงจำดี ๆ'], ['self', '🔒 ถึงตัวเอง… (ไม่บังคับ)', 'เห็นได้เฉพาะคุณ ไม่แสดงในแม่น้ำส่วนรวม']];
  const render = () => { const name = displayName(m.nameMode, S.player?.nickname, S.player?.cls); const warn = [...new Set([m.river, m.friends].flatMap(screenText))];
    $('msgBody').innerHTML = boxes.map(([k, t, h]) => `<div class="msgbox"><h4>${t}<span class="cnt" data-c="${k}">${m[k].length}/${LIMITS.msg}</span></h4><p class="muted">${h}</p>
      <textarea class="f" rows="3" maxlength="${LIMITS.msg}" data-m="${k}" ${editing && k === 'self' ? 'disabled' : ''}>${esc(m[k])}</textarea><div class="chips" style="margin-top:6px">${STARTERS[k].map(s => `<button class="chip" data-st="${k}">${esc(s)}</button>`).join('')}</div></div>`).join('') +
      `<label class="l">รูปแบบการแสดงชื่อ</label><div class="chips">${NAME_MODES.map(([k, l]) => `<button class="chip ${m.nameMode === k ? 'on' : ''}" data-nm="${k}">${l}</button>`).join('')}</div>
      <div class="preview" id="msgPrev"></div>
      ${warn.length ? `<div class="warnbox">⚠ ${warn.join(', ')} — ไม่ควรใส่ข้อมูลส่วนตัวหรือถ้อยคำไม่สุภาพ ข้อความลักษณะนี้จะรอผู้ดูแลตรวจก่อนแสดง</div>` : ''}
      <div class="notice">📢 ข้อความถึงแม่น้ำและถึงเพื่อนในแม่น้ำส่วนรวม ผู้ร่วมงานอ่านได้ · ไม่ต้องเปิดเผยเรื่องส่วนตัว${m.nameMode === 'anon' ? '<br>👤 เมื่อเลือกไม่แสดงชื่อ: <b>ไม่แสดงชื่อแก่ผู้ร่วมงาน</b> (ผู้ดูแลระบบยังตรวจสอบเจ้าของได้)' : ''}</div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" data-close2>ยกเลิก</button><button class="btn" id="msgSave">${editing ? 'บันทึกการแก้ไข' : '💾 บันทึกข้อความ'}</button></div>`;
    const prev = () => { const nm = displayName(m.nameMode, S.player?.nickname, S.player?.cls); $('msgPrev').innerHTML = `<small>ตัวอย่างที่ผู้ร่วมงานจะเห็น</small><br>${m.river ? '🌊 ' + esc(m.river) + '<br>' : ''}${m.friends ? '💛 ' + esc(m.friends) + '<br>' : ''}${!m.river && !m.friends ? '<small>(ยังไม่มีข้อความ)</small><br>' : ''}<small>— ${nm ? esc(nm) : 'ไม่แสดงชื่อ'}</small>`; }; prev();
    $('msgBody').querySelectorAll('[data-m]').forEach(ta => ta.addEventListener('input', () => { m[ta.dataset.m] = ta.value.slice(0, LIMITS.msg); $('msgBody').querySelector(`[data-c="${ta.dataset.m}"]`).textContent = `${ta.value.length}/${LIMITS.msg}`; prev(); }));
    $('msgBody').querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const k = b.dataset.st; if (editing && k === 'self') return; m[k] = (m[k] ? m[k] + ' ' : '') + b.textContent.replace('…', ''); m[k] = m[k].slice(0, LIMITS.msg); render(); $('msgBody').querySelector(`[data-m="${k}"]`).focus(); });
    $('msgBody').querySelectorAll('[data-nm]').forEach(b => b.onclick = () => { m.nameMode = b.dataset.nm; render(); });
    $('msgBody').querySelector('[data-close2]').onclick = () => closeOv('ovMsg');
    $('msgSave').onclick = async () => {
      if (editing) { try { const r = await store.edit({ id: editing.id, token: S.player.token, messages: { river: m.river, friends: m.friends }, nameMode: m.nameMode }); const f = S.myFloats.find(x => x.id === editing.id); Object.assign(f, r || {}, { messages: { river: m.river, friends: m.friends }, nameMode: m.nameMode, display: displayName(m.nameMode, S.player.nickname, S.player.cls) }); local.saveMyFloats(S.myFloats); await refreshPublic(); toast('แก้ไขข้อความแล้ว'); closeOv('ovMsg'); } catch (e) { toast('แก้ไขไม่สำเร็จ: ' + e.message); } return; }
      local.saveMsg(m); toast('บันทึกข้อความแล้ว 💌'); closeOv('ovMsg'); opts.after ? opts.after() : null; };
    if (opts.focus) setTimeout(() => $('msgBody').querySelector(`[data-m="${opts.focus}"]`)?.focus(), 50); };
  render(); openOv('ovMsg');
}

/* ============================================================
   ดูกระทง / ปฏิกิริยา / รายงาน
   ============================================================ */
function findRec(id) { return S.myFloats.find(f => f.id === id) || S.publicFloats.find(f => f.id === id); }
function openView(id) {
  const r = findRec(id); if (!r) return toast('ไม่พบกระทงนี้ (อาจถูกถอนหรือหมดระยะเวลาเก็บข้อมูล)'); const mine = S.myFloats.some(f => f.id === id); const t = r.teacherId ? teacher(r.teacherId) : null;
  openOv('ovView'); if (!viewViewer) viewViewer = new Viewer($('viewCanvas'), { bg: '#0f2a46' }); viewViewer.showKrathong(r.design, { water: true, reflections: S.prefs.reflections });
  const reacted = local.reacted()[id] || []; const pos = world?.riverPos(r); const status = !pos ? '' : pos.gone ? 'ลอยพ้นสายตาแล้ว' : 'กำลังลอยอยู่ในแม่น้ำ';
  $('viewInfo').innerHTML = `<h3 class="f-mitr" style="color:var(--gold2)">${esc(r.design?.name || 'กระทง')}</h3>
    <div class="muted">${r.display ? '— ' + esc(r.display) : 'ไม่แสดงชื่อ'} · ลอยเมื่อ ${fmtTime(r.releasedAt)}${t ? ` · ลอยพร้อม${esc(t.short)}` : ''}<br>${status}</div>
    <div class="preview">${r.design?.wish ? '🙏 ' + esc(r.design.wish) + '<br>' : ''}${r.messages?.river ? '🌊 ' + esc(r.messages.river) + '<br>' : ''}${r.messages?.friends ? '💛 ' + esc(r.messages.friends) : ''}${!r.messages?.river && !r.messages?.friends && !r.design?.wish ? '<small>(ไม่มีข้อความ)</small>' : ''}</div>
    ${mine ? `${r.self ? `<div class="notice">🔒 ถึงตัวเอง (เห็นเฉพาะคุณ): ${esc(r.self)}</div>` : ''}
      <div style="margin-top:8px">สถานะ: <span class="pill ${r.status || 'ok'}">${{ ok: 'แสดงในแม่น้ำ', pending: 'รอผู้ดูแลตรวจ', hidden: 'ถูกซ่อนโดยผู้ดูแล' }[r.status || 'ok']}</span>${r.gotReaction ? ' · 💛 มีคนส่งกำลังใจให้กระทงของคุณ' : ''}</div>
      <div class="row" style="margin-top:12px"><button class="btn sm" id="vFind">🔦 ตามหา</button><button class="btn sm ghost" id="vPhoto">📸 บันทึกภาพ</button><button class="btn sm ghost" id="vEdit">✏️ แก้ไขข้อความ</button><button class="btn sm danger" id="vWd">ถอนกระทง</button></div>`
    : `<div class="row" style="margin-top:12px">${REACTIONS.map(([k, l]) => `<button class="btn sm ${reacted.includes(k) ? 'ghost' : 'pink'}" data-rx="${k}" ${reacted.includes(k) ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      <p class="muted" style="margin-top:6px">ปฏิกิริยาเป็นแสงหรือดอกไม้ชั่วคราว ไม่มีคะแนนหรืออันดับ</p>
      <details style="margin-top:10px"><summary class="muted">🚩 รายงานข้อความนี้</summary><div class="row" style="margin-top:6px"><select class="f" id="vRs" style="max-width:260px"><option>ถ้อยคำไม่เหมาะสม</option><option>เปิดเผยข้อมูลส่วนตัว</option><option>กลั่นแกล้ง/ทำให้ผู้อื่นไม่สบายใจ</option><option>อื่น ๆ</option></select><button class="btn sm ghost" id="vRp">ส่งรายงาน</button></div></details>`}`;
  if (mine) {
    $('vFind').onclick = () => { closeOv('ovView'); locate(id); }; $('vPhoto').onclick = () => photoKrathong(r.design);
    $('vEdit').onclick = () => { closeOv('ovView'); openMsg({ editRec: S.myFloats.find(f => f.id === id) }); };
    $('vWd').onclick = async () => { if (!confirm('ถอนกระทงนี้ออกจากแม่น้ำส่วนรวม? (ย้อนกลับไม่ได้)')) return; try { await store.withdraw({ id, token: S.player.token }); } catch (e) { return toast('ถอนไม่สำเร็จ: ' + e.message); }
      S.myFloats = S.myFloats.filter(f => f.id !== id); local.saveMyFloats(S.myFloats); S.publicFloats = S.publicFloats.filter(f => f.id !== id); mergeRiver(); closeOv('ovView'); toast('ถอนกระทงแล้ว'); };
  } else {
    $('viewInfo').querySelectorAll('[data-rx]').forEach(b => b.onclick = async () => { const k = b.dataset.rx; const all = local.reacted(); all[id] = [...(all[id] || []), k]; local.saveReacted(all); b.disabled = true; b.classList.replace('pink', 'ghost');
      world?.reactionFX(id, k); audio.sfx('chime'); toast('ส่งแล้ว ✨'); try { await store.react({ id, type: k, token: S.player?.token || '' }); } catch (e) {} });
    $('vRp').onclick = async () => { const rep = local.reported(); if (rep.includes(id)) return toast('คุณรายงานข้อความนี้แล้ว'); try { await store.report({ id, reason: $('vRs').value, token: S.player?.token || '' }); rep.push(id); local.saveReported(rep); toast('ส่งรายงานแล้ว ผู้ดูแลจะตรวจสอบ'); } catch (e) { toast('ส่งรายงานไม่สำเร็จ'); } };
  }
}
function locate(id) { if (!world) return; const r = world.findKrathong(id); if (!r) return openView(id); if (r.gone) { toast('กระทงลอยพ้นสายตาแล้ว — เปิดดูในสายน้ำแห่งความทรงจำ'); return openView(id); } toast('กระทงของคุณอยู่ตรงนี้ 🔦'); }
function findMine() { const mine = [...S.myFloats].sort((a, b) => b.releasedAt - a.releasedAt)[0]; if (!mine) return toast('ยังไม่มีกระทงที่ลอยไว้'); locate(mine.id); }

/* ---------- สายน้ำแห่งความทรงจำ ---------- */
function openMem(tab = 'mine') {
  const cut = Date.now() - (S.settings.retentionDays || 30) * 864e5;
  const mineL = [...S.myFloats].filter(f => f.releasedAt > cut).sort((a, b) => b.releasedAt - a.releasedAt);
  const allL = [...S.publicFloats].sort((a, b) => b.releasedAt - a.releasedAt).slice(0, 80); const list = tab === 'mine' ? mineL : allL;
  $('memBody').innerHTML = `<p class="muted">กลับมาชมกระทงที่เคยลอย · เก็บข้อมูล ${S.settings.retentionDays || 30} วันตามที่ผู้ดูแลกำหนด · ไม่มีการจัดอันดับ</p>
    <div class="tabs"><button class="${tab === 'mine' ? 'on' : ''}" data-mt="mine">🪷 กระทงของฉัน (${mineL.length})</button><button class="${tab === 'all' ? 'on' : ''}" data-mt="all">🌊 สายน้ำส่วนรวม (${S.publicFloats.length})</button><span class="sp"></span>${mineL.length ? '<button class="btn sm" id="memFind">🔦 ตามหากระทงของฉัน</button>' : ''}</div>
    ${list.length ? `<div class="grid">${list.map(f => { const p = world?.riverPos(f); return `<button class="kc" data-v="${f.id}"><img src="${thumbOf(f.design)}" alt=""><b>${esc(f.design?.name || 'กระทง')}</b><small>${f.display ? esc(f.display) : 'ไม่แสดงชื่อ'} · ${fmtTime(f.releasedAt)}</small><small>${p && !p.gone ? '🌊 กำลังลอยอยู่' : '✨ ลอยพ้นสายตาแล้ว'}${tab === 'mine' && f.status && f.status !== 'ok' ? ` · <span class="pill ${f.status}">${f.status === 'pending' ? 'รอตรวจ' : 'ถูกซ่อน'}</span>` : ''}</small></button>`; }).join('')}</div>` : `<p class="muted" style="margin-top:20px">${tab === 'mine' ? 'ยังไม่มีกระทงที่ลอยไว้ ไปที่ท่าน้ำลอยใจได้เลย' : 'ยังไม่มีกระทงในสายน้ำส่วนรวม'}</p>`}`;
  $('memBody').querySelectorAll('[data-mt]').forEach(b => b.onclick = () => openMem(b.dataset.mt));
  $('memBody').querySelectorAll('[data-v]').forEach(b => b.onclick = () => { closeOv('ovMem'); openView(b.dataset.v); });
  $('memFind')?.addEventListener('click', () => { closeOv('ovMem'); findMine(); });
  openOv('ovMem');
}

/* ============================================================
   กิจกรรมเสริม: ไอศกรีม ป่าชายเลน เก็บขยะ
   ============================================================ */
function iceCream() { showDialog({ who: { name: 'ซุ้มไอศกรีมริมเล', sub: 'ซุ้มในเกม', color: '#ff8fab', icon: '🍦' }, sticky: true, text: 'ยินดีต้อนรับสู่ไอศกรีมริมเล! เดินเที่ยวงานเหนื่อย ๆ แวะพักกินของเย็น ๆ กันหน่อยไหม<br><span class="muted">ซุ้มสมมติในเกม เป็นรายละเอียดของโรงเรียนและชุมชน</span>',
  opts: [['🥥 รสกะทิ', () => yum('กะทิ')], ['🧋 รสชาไทย', () => yum('ชาไทย')], ['🥭 รสมะม่วง', () => yum('มะม่วง')], ['ไว้คราวหน้า', closeDialog]] }); }
function yum(f) { closeDialog(); audio.sfx('chime'); toast(`ได้ไอศกรีมรส${f}แล้ว 🍦 อย่าลืมทิ้งถ้วยลงถังขยะนะ`); world.player.userData.anim.mode = 'wave'; setTimeout(() => { world.player.userData.anim.mode = 'idle'; }, 1500); }
function bridgeMenu() { const found = S.progress.found || []; dialogSystem('🌳 สะพานป่าชายเลน', `เดินตามสะพานไม้เพื่อสำรวจสิ่งมีชีวิตในป่าชายเลน (พบแล้ว ${found.length}/${MANGROVE_SPOTS.length}) · มองหาป้าย "?" ลอยอยู่ แล้วเดินเข้าใกล้`, [
  ['🔍 เริ่มสำรวจ', () => { world.startExplore(found); closeDialog(); toast('มองหาป้าย ? ตามแนวสะพาน'); }], ...(S.progress.trashDone ? [] : [['🐟 ช่วยน้องปลาตีนเก็บขยะ', () => { world.startTrash(); closeDialog(); }]]), ['ปิด', closeDialog]]); }
function spotFound(sp) { if (!S.progress.found.includes(sp.id)) { S.progress.found.push(sp.id); local.saveProgress(S.progress); } audio.sfx('chime');
  showDialog({ who: { name: `${sp.icon} ${sp.name}`, sub: `สำรวจป่าชายเลน ${S.progress.found.length}/${MANGROVE_SPOTS.length}`, color: '#2d6a4f', icon: sp.icon }, text: esc(sp.text) + '<br><span class="muted">ข้อมูลทั่วไปเพื่อการเรียนรู้</span>', opts: [['สำรวจต่อ', closeDialog]], sticky: true }); }
function trashDone() { S.progress.trashDone = true; local.saveProgress(S.progress); const t = teacher('t04');
  showDialog({ who: { name: 'น้องปลาตีน', sub: 'ขอบคุณที่ช่วยเก็บขยะ', color: '#8d7b68', icon: '🐟' }, sticky: true, text: `ขอบคุณมากเลย! ริมคลองสะอาดขึ้นแล้ว 💚<br><span class="muted">${esc(t.facts[0])}</span>`, opts: [['ยินดีจ้า', closeDialog]] }); }

/* ============================================================
   นำทาง / ตั้งค่า
   ============================================================ */
function openNav() {
  const render = () => { const q = $('navQ').value.trim(); const match = (s) => !q || s.includes(q);
    const zones = ZONES.filter(z => match(z.name)); const ts = TEACHERS.map(t => teacher(t.id)).filter(t => match(t.short + t.subject + t.name));
    $('navBody').innerHTML = `<h3 class="f-mitr" style="margin:6px 0">พื้นที่</h3><div class="grid">${zones.map(z => `<button class="kc" data-z="${z.id}"><b>${z.icon} ${z.name}</b></button>`).join('')}</div>
      <h3 class="f-mitr" style="margin:14px 0 6px">ครู 24 ท่าน <small class="muted">(เดินอยู่ทั่วงาน — แตะเพื่อเดินไปหา · ดูจุดสีบนแผนที่ย่อ)</small></h3><div class="grid">${ts.map(t => `<button class="kc" data-t="${t.id}"><b><span style="color:${t.color}">●</span> ${esc(t.short)}</b><small>${esc(t.subject)}</small></button>`).join('')}</div>`;
    $('navBody').querySelectorAll('[data-z]').forEach(b => b.onclick = () => { closeOv('ovNav'); if (world.escort) return toast('กำลังเดินกับครูอยู่'); world.walkToZone(b.dataset.z, () => handleInteract({ type: 'zone', id: b.dataset.z })); });
    $('navBody').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { closeOv('ovNav'); if (world.escort) return toast('กำลังเดินกับครูอยู่'); world.walkToTeacher(b.dataset.t, () => openTeacher(b.dataset.t)); }); };
  $('navQ').value = ''; $('navQ').oninput = render; render(); openOv('ovNav');
}
function openSettings() {
  const p = S.prefs;
  $('setBody').innerHTML = `<label class="l">คุณภาพภาพ (มีผลเมื่อโหลดใหม่)</label><div class="chips">${[['low', 'ต่ำ (เครื่องโรงเรียน/มือถือรุ่นเก่า)'], ['medium', 'ปานกลาง'], ['high', 'สูง']].map(([k, l]) => `<button class="chip ${p.quality === k ? 'on' : ''}" data-q="${k}">${l}</button>`).join('')}</div>
    <label class="l">การแสดงผล</label><div class="chips"><button class="chip ${p.reflections ? 'on' : ''}" data-tg="reflections">เงาสะท้อนบนน้ำ</button><button class="chip ${p.reduceMotion ? 'on' : ''}" data-tg="reduceMotion">ลดภาพเคลื่อนไหว</button><button class="chip ${p.sound ? 'on' : ''}" data-tg="sound">เสียงบรรยากาศ</button><button class="chip ${p.music !== false ? 'on' : ''}" data-tg="music">เพลงรำวงลอยกระทง</button></div>
    <div class="notice">${store.mode === 'demo' ? '🧪 โหมดสาธิต: ข้อมูลแม่น้ำส่วนรวมเก็บในเครื่องนี้เท่านั้น ยังไม่มีระบบผู้เล่นหลายคนแบบเรียลไทม์' : '🌐 เชื่อมต่อแม่น้ำส่วนรวมออนไลน์แล้ว'}</div>
    <div class="row" style="margin-top:14px"><button class="btn ghost sm" id="sProf">👤 แก้ไขโปรไฟล์</button><button class="btn ghost sm" id="sAdmin">🛡️ ผู้ดูแลระบบ</button><button class="btn ghost sm" id="sClear">🗑 ล้างข้อมูลในเครื่องนี้</button></div>`;
  $('setBody').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { p.quality = b.dataset.q; local.savePrefs(p); if (confirm('โหลดหน้าใหม่เพื่อใช้คุณภาพภาพนี้?')) location.reload(); else openSettings(); });
  $('setBody').querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { const k = b.dataset.tg; if (k === 'music') { music.on ? music.stop() : music.start(); return openSettings(); } p[k] = !p[k]; local.savePrefs(p);
    if (k === 'reflections') world.setReflections(p[k]); if (k === 'reduceMotion') world.reduceMotion = p[k]; if (k === 'sound') { p[k] ? audio.start() : audio.stop(); $('bSound').textContent = p[k] ? '🔊' : '🔈'; } openSettings(); });
  $('sProf').onclick = () => { closeOv('ovSet'); openCreator('edit'); }; $('sAdmin').onclick = () => { closeOv('ovSet'); openAdmin(); };
  $('sClear').onclick = () => { if (!confirm('ล้างโปรไฟล์ ร่างกระทง และข้อมูลในเครื่องนี้ทั้งหมด? (กระทงที่ลอยไปแล้วบนเซิร์ฟเวอร์ไม่ถูกลบ ใช้ "ถอนกระทง" ก่อนหากต้องการ)')) return; Object.keys(localStorage).filter(k => k.startsWith('loy_')).forEach(k => localStorage.removeItem(k)); location.reload(); };
  openOv('ovSet');
}

/* ============================================================
   ผู้ดูแลระบบ (ตรวจสิทธิ์ที่ฝั่งเซิร์ฟเวอร์ในโหมดออนไลน์)
   ============================================================ */
async function adminCall(action, extra = {}) { return store.admin({ action, user: S.admin.user, pass: S.admin.pass, ...extra }); }
function openAdmin(tab = 'overview') {
  openOv('ovAdmin'); const B = $('adminBody');
  if (!S.admin) { B.innerHTML = `<p class="muted">เข้าสู่ระบบเพื่อดูแลข้อความและตั้งค่างาน</p><div style="max-width:360px"><label class="l">ชื่อผู้ใช้</label><input class="f" id="aU" autocomplete="username"><label class="l">รหัสผ่าน</label><input class="f" id="aP" type="password" autocomplete="current-password"><button class="btn" id="aGo" style="margin-top:12px">เข้าสู่ระบบ</button></div>`;
    $('aGo').onclick = async () => { S.admin = { user: $('aU').value.trim(), pass: $('aP').value }; try { S.adminData = await adminCall('adminList'); openAdmin(); } catch (e) { S.admin = null; toast('เข้าสู่ระบบไม่สำเร็จ: ' + e.message); } }; return; }
  const D = S.adminData || {}; const tabs = [['overview', '📈 ภาพรวม'], ['msgs', '💬 ข้อความ'], ['event', '📅 ตั้งค่างาน'], ['mats', '🧺 วัสดุ'], ['teachers', '👩‍🏫 ครู'], ['conn', '🔗 การเชื่อมต่อ'], ['purge', '🗑 ล้างข้อมูล']];
  B.innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-at="${k}">${l}</button>`).join('')}<span class="sp"></span><button class="btn sm ghost" id="aRef">⟳ โหลดใหม่</button><button class="btn sm ghost" id="aOut">ออกจากระบบ</button></div><div id="aPane"></div>`;
  B.querySelectorAll('[data-at]').forEach(b => b.onclick = () => openAdmin(b.dataset.at));
  $('aRef').onclick = async () => { S.adminData = await adminCall('adminList'); openAdmin(tab); }; $('aOut').onclick = () => { S.admin = null; S.adminData = null; openAdmin(); };
  const P = $('aPane'), st = D.stats || {}, set = { ...DEFAULT_SETTINGS, ...(D.settings || {}) };
  if (tab === 'overview') P.innerHTML = `<div class="grid">${[['กระทงทั้งหมด', st.floats], ['ผู้ร่วมลอย (ไม่ซ้ำ)', st.players], ['รอตรวจ', st.pending], ['ถูกซ่อน', st.hidden], ['ลอยพร้อมครู', st.withTeacher]].map(([l, v]) => `<div class="kc"><small>${l}</small><b style="font-size:28px;color:var(--gold)">${v ?? 0}</b></div>`).join('')}</div><div class="notice">โหมด: ${store.mode === 'demo' ? 'สาธิต (ข้อมูลในเครื่องนี้)' : 'ออนไลน์ (Google Apps Script)'} · ไม่มีการจัดอันดับนักเรียน กระทง หรือข้อความ</div>`;
  if (tab === 'msgs') { const f = S.adminFilter || 'attention'; const rows = (D.floats || []).filter(x => f === 'all' ? true : f === 'attention' ? (x.status !== 'ok' || x.reports > 0) : x.status === f).sort((a, b) => b.releasedAt - a.releasedAt);
    P.innerHTML = `<div class="chips">${[['attention', 'ต้องตรวจ'], ['pending', 'รอตรวจ'], ['hidden', 'ถูกซ่อน'], ['ok', 'แสดงอยู่'], ['all', 'ทั้งหมด']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-af="${k}">${l}</button>`).join('')}</div>
    <div style="overflow:auto;margin-top:10px"><table class="t"><tr><th>กระทง</th><th>ข้อความ</th><th>เจ้าของ (เห็นเฉพาะผู้ดูแล)</th><th>สถานะ</th><th>จัดการ</th></tr>${rows.map(x => `<tr><td><img src="${thumbOf(x.design)}" style="width:80px;border-radius:8px" alt=""><br><small>${fmtTime(x.releasedAt)}</small></td>
      <td>🌊 ${esc(x.messages.river)}<br>💛 ${esc(x.messages.friends)}${(x.flags || []).length ? `<div class="warnbox">${esc(x.flags.join(', '))}</div>` : ''}</td>
      <td>${esc(x.nickname)} · ${esc(x.cls)}<br><small>${x.nameMode === 'anon' ? 'ไม่แสดงชื่อแก่ผู้ร่วมงาน' : x.nameMode === 'class' ? 'แสดงเฉพาะชั้น' : 'แสดงชื่อและชั้น'}</small></td>
      <td><span class="pill ${x.status}">${x.status}</span>${x.reports ? `<br><small>รายงาน ${x.reports} ครั้ง</small>` : ''}</td>
      <td><div class="row"><button class="btn sm" data-ok="${x.id}">แสดง</button><button class="btn sm ghost" data-hide="${x.id}">ซ่อน</button><button class="btn sm danger" data-del="${x.id}">ลบ</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">ไม่มีรายการ</td></tr>'}</table></div>`;
    P.querySelectorAll('[data-af]').forEach(b => b.onclick = () => { S.adminFilter = b.dataset.af; openAdmin('msgs'); });
    const act = async (fn) => { try { await fn(); S.adminData = await adminCall('adminList'); await refreshPublic(); openAdmin('msgs'); } catch (e) { toast(e.message); } };
    P.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(() => adminCall('adminSetStatus', { id: b.dataset.ok, status: 'ok' })));
    P.querySelectorAll('[data-hide]').forEach(b => b.onclick = () => act(() => adminCall('adminSetStatus', { id: b.dataset.hide, status: 'hidden' })));
    P.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirm('ลบกระทงนี้ถาวร?') && act(() => adminCall('adminDelete', { id: b.dataset.del }))); }
  const saveSet = async (patch) => { try { await adminCall('adminSettings', { settings: patch }); S.adminData = await adminCall('adminList'); await refreshPublic(); toast('บันทึกแล้ว'); } catch (e) { toast(e.message); } };
  const toLocalDT = (s) => s ? new Date(Date.parse(s) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
  if (tab === 'event') { P.innerHTML = `<div style="max-width:480px"><label class="l">ชื่องาน</label><input class="f" id="eN" value="${esc(set.eventName)}"><label class="l">เปิดงาน (เว้นว่าง = เปิดตลอด)</label><input class="f" type="datetime-local" id="eO" value="${toLocalDT(set.openAt)}"><label class="l">ปิดงาน</label><input class="f" type="datetime-local" id="eC" value="${toLocalDT(set.closeAt)}"><label class="l">ระยะเวลาเก็บข้อมูลกระทง (วัน)</label><input class="f" type="number" min="1" max="365" id="eR" value="${set.retentionDays}"><button class="btn" id="eS" style="margin-top:12px">บันทึก</button></div>`;
    $('eS').onclick = () => saveSet({ eventName: $('eN').value.trim(), openAt: $('eO').value ? new Date($('eO').value).toISOString() : '', closeAt: $('eC').value ? new Date($('eC').value).toISOString() : '', retentionDays: Math.max(1, Math.min(365, +$('eR').value || 30)) }); }
  if (tab === 'mats') { const dm = new Set(set.disabledMaterials), dp = new Set(set.disabledPresets);
    P.innerHTML = `<p class="muted">ยกเลิกการเลือกเพื่อซ่อนวัสดุจากผู้เล่น (ชิ้นงานเดิมที่ลอยแล้วไม่เปลี่ยน)</p>      <h3 class="f-mitr" style="margin-top:10px">วัสดุ</h3><div class="chips">${Object.entries(MATERIALS).map(([id, m]) => `<label class="chip"><input type="checkbox" data-mm="${id}" ${dm.has(id) ? '' : 'checked'}> ${m.icon} ${m.name}</label>`).join('')}</div><button class="btn" id="mS" style="margin-top:12px">บันทึก</button>`;
    $('mS').onclick = () => saveSet({ disabledMaterials: [...P.querySelectorAll('[data-mm]')].filter(c => !c.checked).map(c => c.dataset.mm) }); }
  if (tab === 'teachers') { P.innerHTML = `<p class="muted">แก้ไขชื่อ รูปลักษณ์ และบทสนทนาของครูแบบ JSON (ใส่เฉพาะส่วนที่ต้องการเปลี่ยน) · คีย์ที่ใช้ได้: short, subject, color, greet[2], facts[3], craft, msg, invite, farewell, look{hair,hairColor,skin,outfit,bottom,top,bottomColor,acc}</p>
      <textarea class="f" id="tJ" rows="14" style="font-family:monospace;font-size:13px">${esc(JSON.stringify(set.teacherOverrides || {}, null, 2))}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="tEx">ใส่ตัวอย่าง</button><select class="f" id="tPick" style="max-width:260px">${TEACHERS.map(t => `<option value="${t.id}">${t.id} · ${t.short}</option>`).join('')}</select><button class="btn ghost sm" id="tCopy">คัดลอกข้อมูลเดิมของครูคนนี้</button><span class="sp"></span><button class="btn" id="tS">บันทึก</button></div>`;
    $('tEx').onclick = () => { $('tJ').value = JSON.stringify({ t01: { greet: ['สวัสดีจ้ะ ยินดีต้อนรับ', 'มาเขียนถึงแม่น้ำกันไหม'], look: { hair: 'long', outfit: 'thai' } } }, null, 2); };
    $('tCopy').onclick = () => { let o = {}; try { o = JSON.parse($('tJ').value || '{}'); } catch (e) {} const t = TEACHERS.find(x => x.id === $('tPick').value); o[t.id] = { short: t.short, subject: t.subject, color: t.color, greet: t.greet, facts: t.facts, craft: t.craft, msg: t.msg, invite: t.invite, farewell: t.farewell }; $('tJ').value = JSON.stringify(o, null, 2); };
    $('tS').onclick = () => { let o; try { o = JSON.parse($('tJ').value || '{}'); } catch (e) { return toast('รูปแบบ JSON ไม่ถูกต้อง'); } saveSet({ teacherOverrides: o }); }; }
  if (tab === 'conn') { P.innerHTML = `<div style="max-width:620px"><p>สถานะ: <b>${store.mode === 'demo' ? 'โหมดสาธิต' : 'ออนไลน์'}</b></p><label class="l">Apps Script Web App URL (สำหรับเบราว์เซอร์นี้)</label><input class="f" id="cU" value="${esc(local.scriptUrl())}" placeholder="https://script.google.com/macros/s/.../exec">
      <div class="row" style="margin-top:10px"><button class="btn" id="cS">บันทึกและทดสอบ</button><button class="btn ghost" id="cD">กลับเป็นโหมดสาธิต</button></div><div class="notice">เพื่อให้ทุกเครื่องใช้แม่น้ำเดียวกัน ให้ใส่ URL ในไฟล์ <code>config.js</code> แล้วอัปโหลดขึ้น GitHub</div></div>`;
    $('cS').onclick = async () => { local.setScriptUrl($('cU').value.trim()); try { await store.publicList(); toast('เชื่อมต่อสำเร็จ'); S.admin = null; location.reload(); } catch (e) { toast('เชื่อมต่อไม่สำเร็จ: ' + e.message); } };
    $('cD').onclick = () => { local.setScriptUrl(''); location.reload(); }; }
  if (tab === 'purge') { P.innerHTML = `<div style="max-width:560px"><div class="notice">ลบข้อมูลตามระยะเวลาเก็บที่แจ้งไว้ (${set.retentionDays} วัน) หรือเมื่อสิ้นสุดกิจกรรม</div><div class="row" style="margin-top:12px"><button class="btn ghost" id="pE">ลบกระทงที่เกินระยะเวลาเก็บ</button><button class="btn danger" id="pA">ลบกระทงทั้งหมด (สิ้นสุดกิจกรรม)</button></div></div>`;
    $('pE').onclick = async () => { if (!confirm('ลบกระทงที่เกินระยะเวลาเก็บ?')) return; await adminCall('adminPurge', { all: false }); S.adminData = await adminCall('adminList'); await refreshPublic(); toast('ลบแล้ว'); };
    $('pA').onclick = async () => { if (prompt('พิมพ์คำว่า ลบทั้งหมด เพื่อยืนยัน') !== 'ลบทั้งหมด') return; await adminCall('adminPurge', { all: true }); S.adminData = await adminCall('adminList'); await refreshPublic(); toast('ลบข้อมูลทั้งหมดแล้ว'); }; }
}
if (location.hash === '#admin') setTimeout(() => openAdmin(), 800);

/* ============================================================
   โหมดสำรอง (อุปกรณ์ไม่รองรับ 3 มิติ)
   ============================================================ */
function fallback() {
  const p = S.player || { id: uid('u'), token: uid('t') + uid('s'), nickname: '', cls: CLASSES[0], look: DEFAULT_LOOK }; const m = local.msg(); let preset = PRESETS[0].id;
  $('fbBody').innerHTML = `<div class="hero"><img src="logo.png" alt=""><h1>บางขุนเทียน ลอยใจไปกับสายน้ำ</h1></div><div class="notice">อุปกรณ์นี้ไม่รองรับการแสดงผล 3 มิติ จึงเปิด <b>โหมดเลือกแบบสำเร็จรูป</b> เพื่อร่วมลอยกระทงได้</div>
    <label class="l">ชื่อเล่น</label><input class="f" id="fbN" maxlength="20" value="${esc(p.nickname)}"><label class="l">ชั้นเรียน</label><select class="f" id="fbC">${CLASSES.map(c => `<option ${p.cls === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <label class="l">แบบกระทง</label><div class="chips">${PRESETS.map((x, i) => `<button class="chip ${i ? '' : 'on'}" data-fp="${x.id}">${x.name}</button>`).join('')}</div>
    <label class="l">🙏 คำอธิษฐาน (แสดงบนป้ายของกระทง)</label><input class="f" id="fbW" maxlength="60" value="${esc(m.wish || '')}">
    <label class="l">🌊 ถึงแม่น้ำ…</label><textarea class="f" id="fbR" maxlength="200">${esc(m.river)}</textarea><label class="l">💛 ถึงเพื่อน ๆ…</label><textarea class="f" id="fbF" maxlength="200">${esc(m.friends)}</textarea>
    <label class="l">การแสดงชื่อ</label><select class="f" id="fbM">${NAME_MODES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <div class="notice">ข้อความในแม่น้ำส่วนรวมผู้ร่วมงานอ่านได้ · ${store.mode === 'demo' ? 'โหมดสาธิต: เก็บในเครื่องนี้' : 'ออนไลน์'}</div><button class="btn pink" id="fbGo" style="margin-top:12px">🪷 ลอยกระทง</button><div id="fbList" style="margin-top:12px"></div>`;
  $('fbBody').querySelectorAll('[data-fp]').forEach(b => b.onclick = () => { preset = b.dataset.fp; $('fbBody').querySelectorAll('[data-fp]').forEach(x => x.classList.toggle('on', x === b)); });
  const list = () => { $('fbList').innerHTML = S.myFloats.map(f => `<div class="msgbox">🪷 ${esc(f.design.name)} · ${fmtTime(f.releasedAt)}<br>🌊 ${esc(f.messages.river)}<br>💛 ${esc(f.messages.friends)}</div>`).join(''); }; list();
  $('fbGo').onclick = async () => { const nm = $('fbN').value.trim(); if (!nm) return toast('กรุณากรอกชื่อเล่น'); Object.assign(p, { nickname: nm, cls: $('fbC').value }); S.player = p; local.savePlayer(p);
    const d = presetDesign(preset); d.wish = cleanWish($('fbW').value); try { const rec = await store.float({ floatId: uid('fl'), token: p.token, nickname: p.nickname, cls: p.cls, nameMode: $('fbM').value, design: d, messages: { river: $('fbR').value, friends: $('fbF').value }, teacherId: '' });
      S.myFloats.push({ ...rec, mine: true }); local.saveMyFloats(S.myFloats); toast('ลอยกระทงแล้ว 🪷'); list(); } catch (e) { toast('ไม่สำเร็จ: ' + e.message); } };
  openOv('ovFallback');
}

window.LOY = { get world() { return world; }, S, store, local, openTeacher, openKMenu, openWorkshop, openPond, openMsg, openFloatConfirm, startEscortWith, openMem, openView, openAdmin, findMine, teacher, currentDesign, setCurrentDesign, get ws() { return ws; } };
boot();
