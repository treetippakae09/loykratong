/* ============================================================
   การบันทึกข้อมูล
   - ข้อมูลส่วนตัวของผู้เล่น/ร่างกระทง: localStorage (รีเฟรชไม่หาย)
   - แม่น้ำส่วนรวม: Google Apps Script (ออนไลน์) หรือ โหมดสาธิตในเครื่อง
   ============================================================ */
import { sanitizeDesign, uid } from './krathong.js';

const P = 'loy_v1_';
const ls = {
  get(k, d) { try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return MEM[k] ?? d; } },
  set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { MEM[k] = v; } }
};
const MEM = {};
export const DEFAULT_SETTINGS = { eventName: 'บางขุนเทียน ลอยใจไปกับสายน้ำ', openAt: '', closeAt: '', retentionDays: 30, disabledMaterials: [], disabledPresets: [], teacherOverrides: {} };
export const LIMITS = { msg: 200, floatGapMs: 20000 };

/* ---------- คัดกรองข้อความเบื้องต้น (ไม่ใช่การวินิจฉัยใด ๆ) ---------- */
const BAD = ['เหี้ย', 'สัส', 'ควย', 'เย็ด', 'ระยำ', 'ส้นตีน', 'ไอ้สัตว์', 'อีดอก', 'fuck', 'shit', 'bitch'];
export function screenText(s) {
  const t = String(s || ''); const reasons = [];
  if (/(\+?66|0)\s*\d{1,2}[-\s.]?\d{3}[-\s.]?\d{3,4}/.test(t)) reasons.push('อาจมีเบอร์โทรศัพท์');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) reasons.push('อาจมีอีเมล');
  if (/(https?:\/\/|www\.|\.com\b|\.co\b|line\s*id|ไลน์\s*ไอดี|ig\s*:|เฟส\s*:)/i.test(t)) reasons.push('อาจมีลิงก์หรือบัญชีโซเชียล');
  if (BAD.some(w => t.toLowerCase().includes(w))) reasons.push('อาจมีถ้อยคำไม่สุภาพ');
  return reasons;
}
export function displayName(nameMode, nickname, cls) { return nameMode === 'full' ? `${nickname} · ${cls}` : nameMode === 'class' ? cls : ''; }
const clip = (s) => String(s || '').slice(0, LIMITS.msg);

/* ---------- ข้อมูลในเครื่อง ---------- */
export const local = {
  player: () => ls.get('player', null),
  savePlayer: (p) => ls.set('player', p),
  drafts: () => ls.get('drafts', []),
  saveDraft(d) { const list = this.drafts(); const clean = sanitizeDesign({ ...d, updatedAt: Date.now() }); const i = list.findIndex(x => x.id === clean.id); if (i >= 0) list[i] = clean; else list.unshift(clean); ls.set('drafts', list.slice(0, 30)); return clean; },
  deleteDraft(id) { ls.set('drafts', this.drafts().filter(x => x.id !== id)); },
  current: () => ls.get('currentDesign', null), setCurrent: (id) => ls.set('currentDesign', id),
  msg: () => ls.get('msg', { river: '', friends: '', self: '', nameMode: 'full' }), saveMsg: (m) => ls.set('msg', m),
  myFloats: () => ls.get('myFloats', []), saveMyFloats: (l) => ls.set('myFloats', l),
  prefs: () => ls.get('prefs', { sound: true, quality: 'medium', reflections: true, reduceMotion: false }), savePrefs: (p) => ls.set('prefs', p),
  progress: () => ls.get('progress', { found: [], trashDone: false, talked: [], activities: [] }), saveProgress: (p) => ls.set('progress', p),
  reacted: () => ls.get('reacted', {}), saveReacted: (r) => ls.set('reacted', r),
  reported: () => ls.get('reported', []), saveReported: (r) => ls.set('reported', r),
  scriptUrl: () => (ls.get('scriptUrl', '') || (window.LOY_CONFIG && window.LOY_CONFIG.SCRIPT_URL) || '').trim(),
  setScriptUrl: (u) => ls.set('scriptUrl', u || '')
};

/* ---------- โหมดสาธิต: แม่น้ำส่วนรวมจำลองในเครื่องนี้ ---------- */
const demo = {
  all: () => ls.get('demoRiver', []), save: (l) => ls.set('demoRiver', l),
  settings: () => Object.assign({}, DEFAULT_SETTINGS, ls.get('demoSettings', {})),
  async publicList() { const s = this.settings(), cut = Date.now() - s.retentionDays * 864e5;
    return { floats: this.all().filter(f => f.status === 'ok' && f.releasedAt > cut).map(pub), settings: s }; },
  async float(b) { const list = this.all(); const ex = list.find(f => f.floatId === b.floatId); if (ex) return pub(ex);
    const reasons = [b.messages.river, b.messages.friends].flatMap(screenText);
    const rec = { id: uid('f'), floatId: b.floatId, owner: b.token, nickname: b.nickname, cls: b.cls, nameMode: b.nameMode, display: displayName(b.nameMode, b.nickname, b.cls),
      design: sanitizeDesign(b.design), messages: { river: clip(b.messages.river), friends: clip(b.messages.friends) }, teacherId: b.teacherId || '', releasedAt: Date.now(),
      status: reasons.length ? 'pending' : 'ok', flags: reasons, reports: 0, reactions: { cheer: 0, thanks: 0, goodday: 0 } };
    list.push(rec); this.save(list); return pub(rec); },
  async react(b) { const list = this.all(), f = list.find(x => x.id === b.id); if (f) { f.reactions[b.type] = (f.reactions[b.type] || 0) + 1; this.save(list); } return {}; },
  async report(b) { const list = this.all(), f = list.find(x => x.id === b.id); if (f) { f.reports++; if (f.reports >= 3) f.status = 'pending'; f.flags = [...new Set([...(f.flags || []), 'ถูกรายงาน: ' + (b.reason || '')])]; this.save(list); } return {}; },
  async edit(b) { const list = this.all(), f = list.find(x => x.id === b.id && x.owner === b.token); if (!f) throw new Error('ไม่พบกระทงของคุณ');
    f.messages = { river: clip(b.messages.river), friends: clip(b.messages.friends) }; f.nameMode = b.nameMode; f.display = displayName(b.nameMode, f.nickname, f.cls);
    const reasons = [f.messages.river, f.messages.friends].flatMap(screenText); f.status = reasons.length ? 'pending' : (f.status === 'hidden' ? 'hidden' : 'ok'); f.flags = reasons; this.save(list); return pub(f); },
  async withdraw(b) { this.save(this.all().filter(x => !(x.id === b.id && x.owner === b.token))); return {}; },
  async ownStatus(b) { const s = new Set(b.ids); return { items: this.all().filter(f => s.has(f.id) && f.owner === b.token).map(f => ({ id: f.id, status: f.status, gotReaction: Object.values(f.reactions).some(v => v > 0) })) }; },
  async admin(b) {
    if (b.user !== 'admin' || String(b.pass) !== '1234') throw new Error('สิทธิ์ผู้ดูแลไม่ถูกต้อง');
    const list = this.all();
    if (b.action === 'adminList') { return { floats: list.map(f => ({ ...pub(f), status: f.status, flags: f.flags, reports: f.reports, nickname: f.nickname, cls: f.cls, nameMode: f.nameMode })), settings: this.settings(), stats: stats(list) }; }
    if (b.action === 'adminSetStatus') { const f = list.find(x => x.id === b.id); if (f) { f.status = b.status; if (b.status === 'ok') f.reports = 0; } this.save(list); return {}; }
    if (b.action === 'adminDelete') { this.save(list.filter(x => x.id !== b.id)); return {}; }
    if (b.action === 'adminSettings') { ls.set('demoSettings', Object.assign({}, this.settings(), b.settings)); return {}; }
    if (b.action === 'adminPurge') { const cut = b.all ? Infinity : Date.now() - this.settings().retentionDays * 864e5; this.save(b.all ? [] : list.filter(f => f.releasedAt > cut)); return {}; }
    return {};
  }
};
function stats(list) { const players = new Set(list.map(f => f.owner)); return { floats: list.length, players: players.size, pending: list.filter(f => f.status === 'pending').length, hidden: list.filter(f => f.status === 'hidden').length, withTeacher: list.filter(f => f.teacherId).length }; }
function pub(f) { return { id: f.id, design: f.design, messages: { river: f.messages.river, friends: f.messages.friends }, display: f.nameMode === 'anon' ? '' : f.display, nameMode: f.nameMode, releasedAt: f.releasedAt, teacherId: f.teacherId, status: f.status }; }

/* ---------- ออนไลน์: Google Apps Script ---------- */
const remote = {
  async get(action) { const r = await fetch(local.scriptUrl() + '?action=' + action + '&t=' + Date.now()); const j = await r.json(); if (!j.ok) throw new Error(j.error || 'error'); return j; },
  async post(body) { const r = await fetch(local.scriptUrl(), { method: 'POST', body: JSON.stringify(body) }); const j = await r.json(); if (!j.ok) throw new Error(j.error || 'error'); return j; },
  async publicList() { const j = await this.get('public'); return { floats: j.floats || [], settings: Object.assign({}, DEFAULT_SETTINGS, j.settings || {}) }; },
  async float(b) { return (await this.post({ action: 'float', ...b })).float; },
  async react(b) { return this.post({ action: 'react', ...b }); },
  async report(b) { return this.post({ action: 'report', ...b }); },
  async edit(b) { return (await this.post({ action: 'edit', ...b })).float; },
  async withdraw(b) { return this.post({ action: 'withdraw', ...b }); },
  async ownStatus(b) { return this.post({ action: 'ownStatus', ...b }); },
  async admin(b) { return this.post(b); }
};

export const store = {
  remoteDown: false,
  get mode() { return local.scriptUrl() && !this.remoteDown ? 'online' : 'demo'; },
  get api() { return this.mode === 'online' ? remote : demo; },
  publicList() { return this.api.publicList(); },
  float(b) { return this.api.float(b); }, react(b) { return this.api.react(b); }, report(b) { return this.api.report(b); },
  edit(b) { return this.api.edit(b); }, withdraw(b) { return this.api.withdraw(b); }, ownStatus(b) { return this.api.ownStatus(b); },
  admin(b) { return this.api.admin(b); }
};
