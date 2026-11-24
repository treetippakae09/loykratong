/* เสียงบรรยากาศสังเคราะห์ (ไม่ใช้ไฟล์เสียง): สายน้ำ จิ้งหรีด เสียงระฆังเบา ๆ */
let ctx = null, master = null, on = false, timers = [];
function ensure() { if (ctx) return ctx; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); return ctx; }
function water() { const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = ctx.createGain(); g.gain.value = 0.22; src.connect(f).connect(g).connect(master); src.start(); return src; }
function chirp() { if (!on) return; const t = ctx.currentTime; for (let k = 0; k < 3; k++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 4200 + Math.random() * 600; g.gain.setValueAtTime(0, t + k * 0.09); g.gain.linearRampToValueAtTime(0.025, t + k * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.09 + 0.06); o.connect(g).connect(master); o.start(t + k * 0.09); o.stop(t + k * 0.09 + 0.08); }
  timers.push(setTimeout(chirp, 900 + Math.random() * 2600)); }
function pluck() { if (!on) return; const notes = [523.25, 587.33, 659.25, 783.99, 880]; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = notes[Math.floor(Math.random() * notes.length)] / 2;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); o.connect(g).connect(master); o.start(t); o.stop(t + 1.7); timers.push(setTimeout(pluck, 2500 + Math.random() * 4000)); }
let wsrc = null;
export const audio = {
  get on() { return on; },
  start() { if (!ensure()) return; ctx.resume(); if (on) return; on = true; wsrc = water(); chirp(); pluck(); },
  stop() { on = false; timers.forEach(clearTimeout); timers = []; try { wsrc && wsrc.stop(); } catch (e) {} wsrc = null; },
  sfx(type) { if (!on || !ctx) return; const t = ctx.currentTime; const tone = (f, d, v = 0.12, ty = 'sine', at = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + at + d); o.connect(g).connect(master); o.start(t + at); o.stop(t + at + d + 0.05); };
    if (type === 'click') tone(880, 0.12, 0.05); if (type === 'chime') { tone(659, 0.9); tone(988, 1.1, 0.08, 'sine', 0.12); } if (type === 'pick') tone(1200, 0.15, 0.07, 'triangle');
    if (type === 'splash') { const len = ctx.sampleRate * 0.6, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; s.connect(f).connect(master); s.start(); } }
};
