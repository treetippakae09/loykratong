/* เพลงพื้นหลัง: ฝังเครื่องเล่น YouTube แบบทางการ (IFrame API) — ไม่ดาวน์โหลด/ไม่โฮสต์ไฟล์เพลงเอง
   ใช้คลิป "รำวงลอยกระทง" จากช่อง MiDi Channel · เปลี่ยนคลิปได้ที่ VIDEO_ID */
export const VIDEO_ID = 'dFJHQVAkHk4';
const VOL = 35;

let player = null, ready = false, want = false, apiP = null, card = null, onChange = () => {};

function loadApi() {
  if (apiP) return apiP;
  apiP = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { apiP = null; rej(new Error('yt')); }; document.head.appendChild(s);
  });
  return apiP;
}

function ensureCard() {
  if (card) return card;
  card = document.createElement('div'); card.id = 'musicCard'; card.className = 'hidden';
  card.innerHTML = `<div class="mc-h"><span>🎵 รำวงลอยกระทง</span><button class="mc-x" title="ปิดเพลง">✕</button></div>
    <div class="mc-v"><div id="musicYT"></div></div>
    <div class="mc-f">เพลงจาก YouTube · <a href="https://youtu.be/${VIDEO_ID}" target="_blank" rel="noopener">MiDi Channel</a></div>`;
  document.body.appendChild(card);
  card.querySelector('.mc-x').onclick = () => music.stop();
  return card;
}

function state() { return player && ready && player.getPlayerState ? player.getPlayerState() : -1; }

export const music = {
  get on() { return want; },
  get playing() { return state() === 1; },
  onChange(fn) { onChange = fn || (() => {}); },
  /** เรียกจากการแตะ/คลิกของผู้ใช้เท่านั้น (เบราว์เซอร์บล็อกเสียงอัตโนมัติ) */
  async start() {
    want = true; ensureCard().classList.remove('hidden'); onChange(true);
    if (player && ready) { player.setVolume(VOL); player.playVideo(); return; }
    if (player) return;
    try { await loadApi(); } catch (e) { card.querySelector('.mc-v').innerHTML = '<p class="mc-err">โหลดเพลงไม่ได้ (ไม่มีอินเทอร์เน็ต หรือเครือข่ายโรงเรียนปิด YouTube)</p>'; return; }
    player = new YT.Player('musicYT', {
      videoId: VIDEO_ID, width: '100%', height: '100%',
      playerVars: { autoplay: 1, loop: 1, playlist: VIDEO_ID, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
      events: {
        onReady: (e) => { ready = true; e.target.setVolume(VOL); if (want) e.target.playVideo(); else e.target.pauseVideo(); },
        onStateChange: () => onChange(want),
        onError: () => { card.querySelector('.mc-f').textContent = 'คลิปนี้เล่นในเว็บอื่นไม่ได้ ลองเปิดจาก YouTube โดยตรง'; }
      }
    });
  },
  stop() {
    want = false; if (player && ready) player.pauseVideo();
    if (card) card.classList.add('hidden');
    onChange(false);
  }
};
