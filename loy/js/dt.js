/* ============================================================
   ความรู้รายวิชาการออกแบบและเทคโนโลยี + คณิตศาสตร์บูรณาการ
   - คลังความรู้ (สมดุล กลไก วงจรไฟฟ้า เซ็นเซอร์ มุม เครื่องมือช่าง)
   - โต๊ะช่าง: เลือกเครื่องมือ ตัดกลีบใบตอง → เก็บเป็นวัตถุดิบของฉัน
   - กระดานร่างภาพ: วาด → ระบบสร้างชิ้นส่วน 3 มิติตามภาพ (เลือกสีได้)
   - แผนภาพจุดศูนย์ถ่วง (มุมบน)
   ============================================================ */
import { MATERIALS, BASES, SKETCH_KINDS, sanitizeSketch, uid, computeStats } from './krathong.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export const PALETTE = ['#ff9f1c', '#ffd60a', '#ffe14d', '#ff8fb1', '#e63946', '#b5179e', '#7b2cbf', '#ffffff', '#4cc9f0', '#2a9d8f', '#3f8f3a', '#8d5524'];

/* ---------- หน้าต่างย่อย ---------- */
export function openModal(title, html, { wide = false, onClose } = {}) {
  const el = document.createElement('div'); el.className = 'dt-modal';
  el.innerHTML = `<div class="dt-box ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}"><div class="dt-head"><b>${title}</b><button class="ib dt-x" aria-label="ปิด">✕</button></div><div class="dt-body">${html}</div></div>`;
  document.body.append(el); const close = () => { el.remove(); onClose?.(); }; el.querySelector('.dt-x').onclick = close;
  el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
  return { el, body: el.querySelector('.dt-body'), close };
}

/* ============================================================
   คลังความรู้
   ============================================================ */
export const KNOWLEDGE = [
  { id: 'balance', icon: '⚖️', title: 'การจัดวางองค์ประกอบเพื่อความสมดุล', html: `
    <p><b>จุดศูนย์ถ่วง (Center of Gravity)</b> คือจุดที่น้ำหนักรวมของวัตถุถ่วงกันพอดี ถ้าจุดศูนย์ถ่วงอยู่กลางฐาน กระทงจะลอยตั้งตรง ถ้าเยื้องไปข้างใด กระทงจะเอียงไปข้างนั้น</p>
    <div class="formula">x̄ = Σ(m × x) ÷ Σm &nbsp;&nbsp; z̄ = Σ(m × z) ÷ Σm</div>
    <p class="muted">m = น้ำหนักของชิ้นส่วน · x, z = ระยะจากจุดกึ่งกลางฐาน</p>
    <h4>ตัวอย่างการคำนวณ</h4><p>ฐาน 10 หน่วยอยู่ตรงกลาง (x = 0) วางรางถ่าน 1.6 หน่วยที่ x = 0.5<br>x̄ = (10×0 + 1.6×0.5) ÷ (10 + 1.6) = 0.8 ÷ 11.6 ≈ <b>0.07</b> → เยื้องเล็กน้อย<br>ถ้าวางดอกไม้ 0.4 หน่วย 4 ดอกที่ x = −0.5 จะถ่วงกลับ: (0.8 − 0.8) ÷ 13.2 = <b>0</b> → สมดุล</p>
    <h4>รูปแบบความสมดุล</h4><ul>
      <li><b>สมมาตร (Symmetrical)</b> — ซ้ายขวาเหมือนกัน ดูมั่นคง เป็นทางการ</li>
      <li><b>สมมาตรแบบรัศมี (Radial)</b> — เรียงรอบจุดศูนย์กลาง เช่น กลีบบัวรอบฐาน (ใช้เครื่องมือ "เรียงรอบฐาน")</li>
      <li><b>อสมมาตร (Asymmetrical)</b> — สองข้างไม่เหมือนกัน แต่ "น้ำหนัก × ระยะ" เท่ากัน ตามหลักคาน: ชิ้นหนักใกล้กลาง ถ่วงกับชิ้นเบาที่อยู่ไกล</li></ul>
    <h4>หลักการจัดวาง</h4><ul><li>ของหนัก (ถ่าน มอเตอร์ เทียน) วางใกล้กลางและต่ำ ยิ่งสูงยิ่งล้มง่าย</li><li><b>เอกภาพ</b> ใช้รูปทรง/สีที่เข้ากัน · <b>จุดเด่น</b> มีจุดสนใจ 1 จุด · <b>สัดส่วน</b> ขนาดชิ้นส่วนพอดีกับฐาน · <b>จังหวะ</b> ซ้ำรูปทรงเป็นระยะ</li><li>สีหลัก 1 สี สีรอง 1–2 สี จะดูกลมกลืน</li></ul>` },
  { id: 'mech', icon: '⚙️', title: 'กลไก: เพลา เฟือง รอก', html: `
    <h4>เพลา (Shaft)</h4><p>แกนที่ส่งการหมุนจากต้นกำลัง (มอเตอร์ ใบพัด มือหมุน) ไปยังเฟืองหรือรอก มี <b>แบริ่ง</b> ช่วยลดแรงเสียดทาน</p>
    <h4>เฟือง (Gear)</h4><ul><li>เฟืองสองตัวที่ขบกัน <b>หมุนสวนทางกัน</b></li><li>ถ้าต้องการให้หมุนทางเดียวกัน ใส่ <b>เฟืองตัวกลาง (Idler)</b> คั่น</li></ul>
    <div class="formula">อัตราทด = จำนวนฟันเฟืองตาม ÷ จำนวนฟันเฟืองขับ</div>
    <div class="formula">ความเร็วรอบเฟืองตาม = ความเร็วรอบเฟืองขับ × (ฟันขับ ÷ ฟันตาม)</div>
    <p>ตัวอย่าง: มอเตอร์ 120 รอบ/นาที ขับเฟือง 12 ฟัน → เฟือง 24 ฟัน<br>อัตราทด 24 ÷ 12 = <b>2 : 1</b> → เฟืองตามหมุน 120 × 12 ÷ 24 = <b>60 รอบ/นาที</b> ช้าลงครึ่งหนึ่ง แต่ <b>แรงบิดเพิ่มขึ้น 2 เท่า</b></p>
    <p class="muted">ในโต๊ะประดิษฐ์ รัศมีพิทช์ของเฟือง = โมดูล × จำนวนฟัน ÷ 2 (โมดูล 0.024) วางเฟืองให้ระยะห่างจุดศูนย์กลาง = ผลรวมรัศมีพิทช์ ฟันจะขบกันพอดี</p>
    <h4>รอกและสายพาน (Pulley & Belt)</h4><ul><li>รอกสองตัวคล้องสายพาน <b>หมุนทางเดียวกัน</b> (ถ้าไขว้สายพานเป็นเลข 8 จะหมุนสวนทาง)</li><li>อัตราทด = เส้นผ่านศูนย์กลางรอกตาม ÷ รอกขับ · รอกขับเล็ก รอกตามใหญ่ → ช้าลง แรงขึ้น</li><li><b>รอกยกของ</b>: รอกเดี่ยวตายตัวช่วยเปลี่ยนทิศแรง · รอกเดี่ยวเคลื่อนที่ช่วยผ่อนแรงครึ่งหนึ่ง</li></ul>
    <h4>ทำจริงด้วยวัสดุใกล้ตัว</h4><p>เฟืองจากไม้อัด/ฝาขวด/กระดาษแข็ง เพลาจากไม้ไผ่ สายพานจากยางรัด — ถ้าจะนำลงน้ำจริงควรถอดชิ้นส่วนกลไกเก็บกลับมาใช้ใหม่</p>` },
  { id: 'elec', icon: '🔌', title: 'วงจรไฟฟ้าและเซ็นเซอร์', html: `
    <h4>วงจรไฟฟ้าอย่างง่าย</h4><p>กระแสไฟฟ้าไหลได้เมื่อวงจรเป็น <b>วงปิด</b>: ขั้วบวกของแหล่งจ่าย → สายไฟ → สวิตช์ → โหลด (LED/มอเตอร์) → กลับขั้วลบ</p>
    <ul><li><b>วงจรอนุกรม</b> ต่อเรียงกันเส้นเดียว ถ้าชิ้นใดขาด ทั้งวงจรดับ</li><li><b>วงจรขนาน</b> แยกเป็นหลายเส้นทาง แต่ละโหลดได้แรงดันเท่ากัน</li></ul>
    <div class="formula">กฎของโอห์ม: V = I × R &nbsp;·&nbsp; กำลังไฟฟ้า P = V × I</div>
    <h4>ตัวต้านทานสำหรับ LED</h4><p>LED สีแดงใช้แรงดันประมาณ 2 V กระแส 20 mA (0.02 A) ต่อกับถ่าน 3 V<br>R = (3 − 2) ÷ 0.02 = <b>50 Ω</b> → เลือกตัวต้านทานค่าใกล้เคียงที่มากกว่า เช่น 56 Ω</p>
    <p>LED มีขั้ว: <b>ขายาวคือขั้วบวก (+)</b> ต่อกลับขั้วจะไม่ติด</p>
    <h4>เซ็นเซอร์ = สวิตช์อัตโนมัติ</h4><ul><li><b>LDR (เซ็นเซอร์แสง)</b> ความต้านทานลดลงเมื่อมีแสง ใช้ทำไฟติดเองตอนมืด</li><li><b>เซ็นเซอร์น้ำ</b> ขั้วโลหะสองขั้ว เมื่อสัมผัสน้ำจะนำไฟฟ้า ใช้ทำไฟติดเมื่อกระทงลงน้ำ</li><li><b>เซ็นเซอร์ความเอียง</b> ลูกบอลโลหะกลิ้งแตะขั้วเมื่อเอียง ใช้เตือนเมื่อกระทงไม่สมดุล</li></ul>
    <h4>ระบบเทคโนโลยี</h4><div class="formula">ตัวป้อน (Input) → กระบวนการ (Process) → ผลลัพธ์ (Output) ↺ ข้อมูลย้อนกลับ (Feedback)</div>
    <p>เช่น ความมืด (Input) → LDR ต่อวงจร (Process) → LED สว่าง (Output)</p>
    <div class="warnbox">⚠ ในเกมเป็นการจำลองเท่านั้น ห้ามทิ้งถ่าน สายไฟ หรือวงจรลงแม่น้ำจริง ถ้าทำกระทงมีไฟจริงต้องเก็บกลับขึ้นฝั่ง</div>` },
  { id: 'math', icon: '📐', title: 'คณิตศาสตร์: มุม องศา และตำแหน่ง', html: `
    <h4>มุมรอบจุด</h4><p>มุมรอบจุดหนึ่งรวมกันได้ <b>360°</b> ถ้าเรียงกลีบ n กลีบรอบฐานให้ห่างเท่ากัน</p>
    <div class="formula">มุมระหว่างกลีบ = 360° ÷ n</div>
    <table class="t"><tr><th>จำนวนกลีบ</th><td>4</td><td>6</td><td>8</td><td>10</td><td>12</td><td>16</td></tr><tr><th>มุม</th><td>90°</td><td>60°</td><td>45°</td><td>36°</td><td>30°</td><td>22.5°</td></tr></table>
    <h4>องศา ↔ เรเดียน</h4><div class="formula">π เรเดียน = 180° &nbsp;→&nbsp; เรเดียน = องศา × π ÷ 180</div><p>เช่น 30° = 30 × 3.1416 ÷ 180 ≈ 0.52 rad (โปรแกรม 3 มิติคำนวณมุมเป็นเรเดียน)</p>
    <h4>ตำแหน่งกลีบด้วยตรีโกณมิติ</h4><div class="formula">x = r × sin θ &nbsp;&nbsp; z = r × cos θ</div><p>r = ระยะจากจุดศูนย์กลาง · θ = มุม · ฐานวงรีใช้ x = a·sin θ, z = b·cos θ</p>
    <h4>สมมาตรการหมุน</h4><p>รูปที่หมุนไป 360° ÷ n แล้วเหมือนเดิม เรียกว่ามีสมมาตรการหมุนอันดับ n เช่น กลีบ 8 กลีบ หมุน 45° ก็เหมือนเดิม</p>
    <p class="muted">ลองพิมพ์ตัวเลของศาในช่อง "หมุนรอบตัว" หรือ "มุมเอียง" ของชิ้นส่วนที่เลือก แล้วสังเกตผล</p>` },
  { id: 'tools', icon: '🧰', title: 'เครื่องมือช่างและความปลอดภัย', html: '' },
  { id: 'eco', icon: '🌿', title: 'วัสดุกับสิ่งแวดล้อม', html: `
    <ul><li>เลือกวัสดุธรรมชาติที่ย่อยสลายได้ เช่น หยวกกล้วย ใบตอง ดอกไม้สด ไม้กลัด</li><li>หลีกเลี่ยงโฟม พลาสติก ลวดเย็บ หมุดโลหะ กาวร้อน</li><li>แม้วัสดุธรรมชาติ ถ้ามีจำนวนมากก็เพิ่มสารอินทรีย์และใช้ออกซิเจนในน้ำ → กระทงเล็ก ใช้ชิ้นน้อย ลอยกระทงครอบครัวละใบ</li><li>ชิ้นส่วนกลไกและไฟฟ้าเป็นการจำลองในเกม งานจริงควรถอดเก็บกลับมาใช้ใหม่</li></ul>` }
];
export function openKnowledge(topic) {
  const k = KNOWLEDGE.map(x => x.id === 'tools' ? { ...x, html: toolsHtml() } : x);
  const m = openModal('📘 ความรู้ วิชาการออกแบบและเทคโนโลยี', `<div class="tabs dt-tabs">${k.map(x => `<button data-kt="${x.id}">${x.icon} ${x.title.split(':')[0]}</button>`).join('')}</div><div class="dt-know"></div>`, { wide: true });
  const show = (id) => { const x = k.find(q => q.id === id) || k[0]; m.body.querySelectorAll('[data-kt]').forEach(b => b.classList.toggle('on', b.dataset.kt === x.id)); m.body.querySelector('.dt-know').innerHTML = `<h3 class="f-mitr">${x.icon} ${x.title}</h3>${x.html}`; m.body.querySelector('.dt-know').scrollTop = 0; };
  m.body.querySelectorAll('[data-kt]').forEach(b => b.onclick = () => show(b.dataset.kt)); show(topic || 'balance'); return m;
}

/* ============================================================
   เครื่องมือช่าง / แบบกลีบ
   ============================================================ */
export const TOOLS = [
  { id: 'scissors', icon: '✂️', name: 'กรรไกร', kind: 'cut', good: ['curve'], use: 'ตัดตามเส้นโค้งได้ดี เหมาะกับกลีบโค้ง กลีบกุหลาบ กลีบเล็บมือนาง', safe: 'ส่งกรรไกรโดยหันด้ามจับให้ผู้รับ ไม่ชี้ปลายใส่ผู้อื่น ไม่ถือวิ่ง' },
  { id: 'cutter', icon: '🔪', name: 'คัตเตอร์ + แผ่นรองตัด', kind: 'cut', good: ['straight', 'detail'], use: 'ตัดเส้นตรงหรือฉลุลายละเอียด ใช้คู่กับไม้บรรทัดเหล็กบนแผ่นรองตัด', safe: 'ดันใบมีดออกเพียง 1–2 ข้อ กรีดออกจากตัว เก็บใบมีดทุกครั้งหลังใช้' },
  { id: 'saw', icon: '🪚', name: 'เลื่อยฉลุ', kind: 'cut', wrong: true, use: 'ใช้ตัดไม้หรือไม้อัด (เช่น ทำเฟืองไม้) ไม่เหมาะกับใบตองบาง จะทำให้ใบฉีกขาด', safe: 'จับชิ้นงานด้วยปากกาจับชิ้นงาน มือห่างแนวใบเลื่อย' },
  { id: 'ruler', icon: '📏', name: 'ไม้บรรทัด/ตลับเมตร', kind: 'helper', use: 'วัดขนาดใบตองให้เท่ากันทุกแผ่น กลีบจะเท่ากันและเรียงได้สวย', safe: 'ใช้ไม้บรรทัดเหล็กเป็นแนวกรีดคัตเตอร์ กดให้แน่น นิ้วอยู่หลังขอบ' },
  { id: 'template', icon: '📄', name: 'แม่แบบ (แบบตัด)', kind: 'helper', use: 'ทาบแม่แบบบนใบตองแล้วตัดตาม ได้กลีบขนาดเท่ากันทุกชิ้น ตัดง่ายขึ้น', safe: 'ทำแม่แบบจากกระดาษแข็ง ใช้ซ้ำได้หลายครั้ง' },
  { id: 'cloth', icon: '🧻', name: 'ผ้าชุบน้ำหมาด ๆ', kind: 'helper', use: 'เช็ดใบตองให้สะอาดและนุ่ม ลดการฉีกขาดขณะพับ', safe: 'เช็ดตามแนวเส้นใบ ไม่ถูแรง' },
  { id: 'pin', icon: '📌', name: 'ไม้กลัด', kind: 'fasten', use: 'ยึดกลีบใบตองหลังพับ ทำจากไม้ไผ่ ย่อยสลายได้', safe: 'ปลายแหลม ระวังทิ่มมือ เก็บใส่กล่อง' },
  { id: 'stapler', icon: '🗜️', name: 'ลวดเย็บกระดาษ', kind: 'fasten', bad: true, use: 'ยึดได้เร็วแต่เป็นโลหะ ตกค้างในแหล่งน้ำและเป็นอันตรายต่อสัตว์น้ำ ไม่แนะนำ', safe: 'ระวังลวดทิ่มนิ้ว' },
  { id: 'gluegun', icon: '🔫', name: 'ปืนกาวร้อน', kind: 'fasten', bad: true, use: 'เหมาะกับงานกลไกหรือวงจร แต่กาวเป็นพลาสติก ไม่ควรใช้กับกระทงที่ลอยน้ำจริง', safe: 'หัวปืนและกาวร้อนมาก วางบนขาตั้ง ห้ามสัมผัส ใช้ในที่อากาศถ่ายเท' }
];
function toolsHtml() { return `<p>เลือกเครื่องมือให้เหมาะกับงานและวัสดุ ใช้อย่างถูกวิธีและปลอดภัย</p>${TOOLS.map(t => `<div class="tool-k"><span class="ic">${t.icon}</span><div><b>${t.name}</b> <small class="muted">${{ cut: 'เครื่องมือตัด', helper: 'เครื่องมือช่วย', fasten: 'เครื่องมือยึด' }[t.kind]}</small><br>${t.use}<br><small>🦺 ${t.safe}</small></div></div>`).join('')}
  <h4>หลักความปลอดภัยในการใช้เครื่องมือ</h4><ul><li>เลือกใช้เครื่องมือให้ถูกกับงาน</li><li>ตรวจสภาพเครื่องมือก่อนใช้ ใบมีดต้องคม ไม่บิ่น</li><li>จัดโต๊ะทำงานให้เป็นระเบียบ เก็บเครื่องมือมีคมทันทีหลังใช้</li><li>ทำความสะอาดและเก็บเข้าที่หลังเลิกงาน</li></ul>`; }

// แบบกลีบ: จุดของเส้นรอบรูป (พิกัด 0–1 บนแผ่นใบตอง)
const P = (pts) => pts.map(([x, y]) => [x, y]);
const ellipse = (cx, cy, rx, ry, n = 40, pointy = 0) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; const k = pointy ? 1 - pointy * Math.pow(Math.abs(Math.cos(a / 2)), 6) * 0 : 1; return [cx + Math.sin(a) * rx * (1 - pointy * Math.max(0, -Math.cos(a)) * 0.5), cy - Math.cos(a) * ry * k]; });
export const PATTERNS = [
  { id: 'leaf_rose', name: 'กลีบกุหลาบ', kind: 'curve', yield: 4, path: P([[0.3, 0.85], [0.3, 0.35], [0.33, 0.24], [0.4, 0.17], [0.5, 0.15], [0.6, 0.17], [0.67, 0.24], [0.7, 0.35], [0.7, 0.85]]),
    fold: ['เช็ดใบตองให้สะอาด ตัดตามแบบ (ประมาณ 4 × 12 ซม.)', 'พับครึ่งตามยาว ให้ด้านมันอยู่ด้านนอก', 'ม้วนจากปลายข้างหนึ่งเป็นกรวยคล้ายกลีบกุหลาบ', 'กลัดโคนกลีบด้วยไม้กลัด แล้วเรียงรอบฐาน'] },
  { id: 'leaf_nail', name: 'กลีบเล็บมือนาง', kind: 'curve', yield: 6, path: ellipse(0.5, 0.5, 0.13, 0.36, 36, 1),
    fold: ['ตัดใบตองเป็นแถบรีปลายแหลม (ประมาณ 3 × 10 ซม.)', 'พับครึ่งตามยาว', 'พับมุมปลายเข้าหากันให้แหลมคล้ายเล็บมือ', 'เรียงซ้อนกันเป็นชั้น กลัดด้วยไม้กลัด'] },
  { id: 'leaf_phanom', name: 'กลีบพนม', kind: 'straight', yield: 3, path: P([[0.5, 0.14], [0.8, 0.84], [0.2, 0.84]]),
    fold: ['ใช้ไม้บรรทัดวัดแล้วตัดเป็นสี่เหลี่ยม 6 × 10 ซม.', 'พับมุมบนทั้งสองข้างลงมาให้เป็นสามเหลี่ยม', 'ทำ 3 ชิ้น ขนาดลดหลั่น ซ้อนกันเป็นกลีบพนม', 'กลัดโคนด้วยไม้กลัด'] },
  { id: 'leaf_fan', name: 'กลีบจีบพัด', kind: 'straight', yield: 3, path: P([[0.2, 0.25], [0.8, 0.25], [0.8, 0.75], [0.2, 0.75]]),
    fold: ['ตัดใบตองเป็นสี่เหลี่ยมผืนผ้า 8 × 12 ซม.', 'พับจีบกลับไปกลับมาแบบพัด กว้างจีบละ 1 ซม.', 'รวบโคนให้แน่น แล้วคลี่ปลายให้บานเป็นพัด', 'กลัดโคนด้วยไม้กลัด'] },
  { id: 'leaf_lace', name: 'ใบตองฉลุลาย', kind: 'detail', yield: 2, path: P([[0.5, 0.12], [0.62, 0.2], [0.7, 0.35], [0.7, 0.55], [0.62, 0.72], [0.5, 0.88], [0.38, 0.72], [0.3, 0.55], [0.3, 0.35], [0.38, 0.2]]),
    fold: ['วาดรูปใบไม้และลวดลายบนใบตองด้วยดินสอเบา ๆ', 'วางบนแผ่นรองตัด ใช้คัตเตอร์กรีดตามเส้นรอบรูป', 'ฉลุช่องลายเล็ก ๆ ด้านใน กรีดออกจากตัวเสมอ', 'ใช้ประดับรอบฐาน ไม่ต้องพับ'] }
];

/* ============================================================
   โต๊ะช่าง: ตัดกลีบใบตอง → วัตถุดิบของฉัน
   ============================================================ */
export function openCuttingTable({ inv, onStore, toast }) {
  const st = { tools: new Set(['scissors']), pat: PATTERNS[0].id, step: 'pick' };
  const m = openModal('✂️ โต๊ะช่าง — ตัดกลีบใบตองเป็นวัตถุดิบของฉัน', '<div class="cut"></div>', { wide: true });
  const root = m.body.querySelector('.cut');
  const invHtml = () => `<div class="inv">🧺 วัตถุดิบของฉัน: ${PATTERNS.map(p => `<span class="pill ok">${MATERIALS[p.id].icon} ${p.name} × ${inv()[p.id] || 0}</span>`).join(' ')}</div>`;
  const pick = () => { st.step = 'pick'; const pat = PATTERNS.find(p => p.id === st.pat);
    root.innerHTML = `<p class="muted">1) เลือกแบบกลีบ · 2) เลือกเครื่องมือ (เครื่องมือตัด 1 ชิ้น + เครื่องมือช่วยได้) · 3) ลากตามเส้นประเพื่อตัด · 4) เลือกวิธียึดและพับ</p>
      <label class="l">แบบกลีบที่ต้องการ</label><div class="chips">${PATTERNS.map(p => `<button class="chip ${p.id === st.pat ? 'on' : ''}" data-pat="${p.id}">${MATERIALS[p.id].icon} ${p.name} <small>(${{ curve: 'เส้นโค้ง', straight: 'เส้นตรง', detail: 'ลายละเอียด' }[p.kind]})</small></button>`).join('')}</div>
      <label class="l">เครื่องมือ</label><div class="tool-grid">${TOOLS.filter(t => t.kind !== 'fasten').map(t => `<button class="tool ${st.tools.has(t.id) ? 'on' : ''}" data-tool="${t.id}"><span class="ic">${t.icon}</span><b>${t.name}</b><small>${t.kind === 'cut' ? 'ตัด' : 'ช่วย'}</small></button>`).join('')}</div>
      <div class="tool-info"></div>${invHtml()}
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" data-go>✂️ เริ่มตัด ${esc(pat.name)}</button></div>`;
    const info = (id) => { const t = TOOLS.find(x => x.id === id); root.querySelector('.tool-info').innerHTML = `<b>${t.icon} ${t.name}</b> — ${t.use}<br><small>🦺 ความปลอดภัย: ${t.safe}</small>`; };
    info([...st.tools].pop() || 'scissors');
    root.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { st.pat = b.dataset.pat; pick(); });
    root.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { const t = TOOLS.find(x => x.id === b.dataset.tool);
      if (t.kind === 'cut') { for (const x of TOOLS) if (x.kind === 'cut') st.tools.delete(x.id); st.tools.add(t.id); } else st.tools.has(t.id) ? st.tools.delete(t.id) : st.tools.add(t.id);
      pick(); info(t.id); });
    root.querySelector('[data-go]').onclick = () => { const cut = TOOLS.find(t => t.kind === 'cut' && st.tools.has(t.id));
      if (!cut) return toast('เลือกเครื่องมือตัด (กรรไกรหรือคัตเตอร์) ก่อน');
      if (cut.wrong) { root.querySelector('.tool-info').innerHTML = `<div class="warnbox">🪚 <b>${cut.name}ไม่เหมาะกับใบตอง</b> — ${cut.use}<br>ลองเปลี่ยนเป็นกรรไกร (เส้นโค้ง) หรือคัตเตอร์ (เส้นตรง/ลายละเอียด)</div>`; return; }
      cutting(cut); }; };
  const cutting = (cut) => { st.step = 'cut'; const pat = PATTERNS.find(p => p.id === st.pat), tpl = st.tools.has('template');
    root.innerHTML = `<p><b>${cut.icon} ${cut.name}</b> ${[...st.tools].filter(id => id !== cut.id).map(id => TOOLS.find(t => t.id === id).icon).join(' ')} · ลากนิ้ว/เมาส์ <b>ตามเส้นประ</b> ให้ครบรอบเพื่อตัด ${esc(pat.name)}</p>
      <div class="cut-wrap"><canvas width="420" height="420" class="cut-cv"></canvas></div>
      <div class="prog"><i></i></div><div class="row" style="margin-top:8px"><button class="btn sm ghost" data-back>↩ เปลี่ยนเครื่องมือ</button><button class="btn sm ghost" data-auto title="สำหรับผู้ที่ลากนิ้วไม่สะดวก">🤖 ตัดตามเส้นอัตโนมัติ</button><span class="sp"></span><span class="muted" data-pct>0%</span></div>`;
    const cv = root.querySelector('canvas'), x = cv.getContext('2d'), W = cv.width; const pts = densePath(pat.path.map(([a, b]) => [a * W, b * W]), 90); const hit = new Array(pts.length).fill(false);
    const tol = tpl ? 26 : 17; let trail = [], errSum = 0, errN = 0, done = false, down = false;
    const draw = () => { drawLeaf(x, W); x.save(); x.setLineDash([8, 7]); x.lineWidth = 3; x.strokeStyle = tpl ? '#fff' : 'rgba(255,255,255,.85)'; x.beginPath(); pat.path.forEach(([a, b], i) => i ? x.lineTo(a * W, b * W) : x.moveTo(a * W, b * W)); x.closePath(); x.stroke(); x.restore();
      if (tpl) { x.save(); x.globalAlpha = 0.18; x.fillStyle = '#fff'; x.beginPath(); pat.path.forEach(([a, b], i) => i ? x.lineTo(a * W, b * W) : x.moveTo(a * W, b * W)); x.closePath(); x.fill(); x.restore(); }
      x.fillStyle = '#ffd166'; pts.forEach((p, i) => { if (hit[i]) { x.beginPath(); x.arc(p[0], p[1], 3.2, 0, 7); x.fill(); } });
      x.strokeStyle = cut.id === 'cutter' ? '#e0e0e0' : '#ffb703'; x.lineWidth = 2.5; x.beginPath(); trail.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
      const pct = Math.round(hit.filter(Boolean).length / hit.length * 100); root.querySelector('.prog i').style.width = pct + '%'; root.querySelector('[data-pct]').textContent = pct + '%';
      if (pct >= 92 && !done) { done = true; setTimeout(() => finish(cut, errN ? 1 - Math.min(1, errSum / errN / tol) : 0.9), 250); } };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * W]; };
    const mark = (p) => { let best = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < best) best = d; if (d < tol) hit[i] = true; }); if (best < tol * 2) { errSum += best; errN++; } };
    cv.addEventListener('pointerdown', e => { if (done) return; down = true; cv.setPointerCapture(e.pointerId); const p = pos(e); trail.push(p); mark(p); draw(); });
    cv.addEventListener('pointermove', e => { if (!down || done) return; const p = pos(e), l = trail[trail.length - 1]; const n = l ? Math.ceil(Math.hypot(p[0] - l[0], p[1] - l[1]) / 4) : 1; for (let i = 1; i <= n; i++) { const q = l ? [l[0] + (p[0] - l[0]) * i / n, l[1] + (p[1] - l[1]) * i / n] : p; trail.push(q); mark(q); } draw(); });
    const up = () => { down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    root.querySelector('[data-back]').onclick = pick;
    root.querySelector('[data-auto]').onclick = () => { if (done) return; let i = 0; const tick = () => { if (done || !root.isConnected) return; for (let k = 0; k < 4 && i < pts.length; k++, i++) { trail.push(pts[i]); hit[i] = true; errSum += tol * 0.25; errN++; } draw(); if (i < pts.length) setTimeout(tick, 16); }; tick(); };
    draw(); };
  const finish = (cut, acc) => { st.step = 'fold'; const pat = PATTERNS.find(p => p.id === st.pat), match = (cut.good || []).includes(pat.kind), uniform = st.tools.has('template') || st.tools.has('ruler');
    let qty = pat.yield + (uniform ? 1 : 0) - (match ? 0 : 1); qty = Math.max(1, qty); const quality = acc > 0.75 ? 'ขอบเรียบสวยมาก' : acc > 0.5 ? 'ขอบเรียบดี' : 'ขอบยังไม่เรียบ ลองตัดช้า ๆ ตามเส้น';
    root.innerHTML = `<div class="cols"><div><h3 class="f-mitr">✅ ตัด${esc(pat.name)}เสร็จแล้ว</h3>
      <p>ความแม่นยำ <b>${Math.round(acc * 100)}%</b> — ${quality}</p>
      <p>${match ? `👍 ${cut.name}เหมาะกับงาน${{ curve: 'เส้นโค้ง', straight: 'เส้นตรง', detail: 'ลายละเอียด' }[pat.kind]}` : `💡 งาน${{ curve: 'เส้นโค้ง', straight: 'เส้นตรง', detail: 'ลายละเอียด' }[pat.kind]}เหมาะกับ${pat.kind === 'curve' ? 'กรรไกร' : 'คัตเตอร์บนแผ่นรองตัด'}มากกว่า (ได้กลีบน้อยลง 1 ชิ้น)`}</p>
      ${uniform ? '<p>📏 ใช้ไม้บรรทัด/แม่แบบ → กลีบขนาดเท่ากัน ได้เพิ่ม 1 ชิ้น</p>' : '<p class="muted">เคล็ดลับ: ใช้ไม้บรรทัดหรือแม่แบบช่วย กลีบจะเท่ากันและได้จำนวนมากขึ้น</p>'}
      <h4>วิธีพับ/ประกอบ</h4><ol class="fold">${pat.fold.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <div><label class="l">เลือกวิธียึดกลีบ</label><div class="tool-grid">${TOOLS.filter(t => t.kind === 'fasten').map(t => `<button class="tool" data-fast="${t.id}"><span class="ic">${t.icon}</span><b>${t.name}</b></button>`).join('')}</div><div class="tool-info">เลือกเครื่องมือยึดเพื่อเก็บกลีบเข้าวัตถุดิบ</div></div></div>`;
    root.querySelectorAll('[data-fast]').forEach(b => b.onclick = () => { const t = TOOLS.find(x => x.id === b.dataset.fast);
      root.querySelectorAll('[data-fast]').forEach(q => q.classList.toggle('on', q === b));
      root.querySelector('.tool-info').innerHTML = `${t.bad ? '<div class="warnbox">' : '<div class="notice">'}<b>${t.icon} ${t.name}</b> — ${t.use}<br><small>🦺 ${t.safe}</small></div>
        <div class="row" style="margin-top:10px"><button class="btn" data-store>🧺 เก็บ ${MATERIALS[pat.id].icon} ${esc(pat.name)} × ${qty} เข้าวัตถุดิบของฉัน</button>${t.bad ? '<button class="btn ghost sm" data-redo>เปลี่ยนเป็นไม้กลัด</button>' : ''}</div>`;
      root.querySelector('[data-redo]')?.addEventListener('click', () => root.querySelector('[data-fast="pin"]').click());
      root.querySelector('[data-store]').onclick = () => { onStore(pat.id, qty); toast(`เก็บ${pat.name} × ${qty} แล้ว 🧺`); stored(pat, qty); }; }); };
  const stored = (pat, qty) => { root.innerHTML = `<h3 class="f-mitr">🧺 เพิ่ม${esc(pat.name)} × ${qty} ในวัตถุดิบของฉันแล้ว</h3><p>นำไปใช้ได้ที่โต๊ะประดิษฐ์ 3 มิติ หมวด <b>🧺 วัตถุดิบของฉัน</b> (ใช้ไป 1 ชิ้น จำนวนจะลดลง 1)</p>${invHtml()}
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-more>✂️ ตัดเพิ่ม</button><span class="sp"></span><button class="btn" data-close>เสร็จแล้ว</button></div>`;
    root.querySelector('[data-more]').onclick = pick; root.querySelector('[data-close]').onclick = m.close; };
  pick(); return m;
}
function densePath(poly, n) { const segs = []; let L = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, l]); L += l; }
  const out = []; for (let k = 0; k < n; k++) { let d = k / n * L; for (const [a, b, l] of segs) { if (d <= l) { out.push([a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l]); break; } d -= l; } } return out; }
function drawLeaf(x, W) { x.fillStyle = '#6b4f2a'; x.fillRect(0, 0, W, W); x.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < W; i += 28) x.fillRect(0, i, W, 2);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#2f7a2a'); g.addColorStop(0.5, '#4fa83f'); g.addColorStop(1, '#2f7a2a'); x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(W * 0.08, W * 0.05, W * 0.84, W * 0.9, 30) : x.rect(W * 0.08, W * 0.05, W * 0.84, W * 0.9); x.fill();
  x.strokeStyle = 'rgba(200,240,170,.35)'; x.lineWidth = 1.2; for (let i = 0; i < 24; i++) { const y = W * 0.08 + i * W * 0.036; x.beginPath(); x.moveTo(W * 0.1, y); x.lineTo(W * 0.9, y + W * 0.02); x.stroke(); }
  x.strokeStyle = 'rgba(230,255,200,.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(W * 0.5, W * 0.05); x.lineTo(W * 0.5, W * 0.95); x.stroke(); }

/* ============================================================
   กระดานร่างภาพ → ชิ้นส่วน 3 มิติ
   ============================================================ */
const SAMPLES = {
  marigold: { k: 'flower', c1: '#ff9f1c', c2: '#ffd166', name: 'ดาวเรือง', draw: (W) => { const s = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2, r = W * (0.3 + 0.06 * Math.abs(Math.cos(a * 8))); s.push([W / 2 + Math.sin(a) * r, W / 2 - Math.cos(a) * r]); } return [s]; } },
  star: { k: 'extrude', c1: '#ffd60a', c2: '#ff9f1c', name: 'ดาว', draw: (W) => { const s = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2, r = W * (i % 2 ? 0.16 : 0.38); s.push([W / 2 + Math.sin(a) * r, W / 2 - Math.cos(a) * r]); } return [s]; } },
  heart: { k: 'extrude', c1: '#e63946', c2: '#ff8fb1', name: 'หัวใจ', draw: (W) => { const s = []; for (let i = 0; i <= 80; i++) { const t = i / 80 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); s.push([W / 2 + x * W * 0.018, W * 0.46 - y * W * 0.018]); } return [s]; } },
  vase: { k: 'lathe', c1: '#2a9d8f', c2: '#e9c46a', name: 'แจกัน/โคม', draw: (W) => { const s = []; for (let i = 0; i <= 40; i++) { const y = i / 40, w = 0.1 + 0.14 * Math.sin(y * Math.PI * 0.95 + 0.2) + (y < 0.12 ? 0.05 : 0); s.push([W / 2 + w * W, W * 0.12 + y * W * 0.76]); } return [s, s.map(([x, y]) => [W - x, y])]; } }
};
export function openSketchPad({ toast, onCreate, makePreview }) {
  const st = { strokes: [], k: 'flower', c1: '#ff9f1c', c2: '#ffd166', name: '' };
  const m = openModal('✏️ วาดชิ้นส่วนเอง → ระบบสร้างเป็น 3 มิติ', `<div class="sk">
    <div class="sk-left"><canvas class="sk-cv" width="360" height="360"></canvas>
      <div class="row" style="margin-top:6px"><button class="btn sm ghost" data-undo>↶ ลบเส้นล่าสุด</button><button class="btn sm ghost" data-clear>🧽 ล้าง</button></div>
      <label class="l">ตัวอย่างภาพร่าง (แตะเพื่อดูวิธีวาด)</label><div class="chips">${Object.entries(SAMPLES).map(([k, s]) => `<button class="chip" data-sample="${k}">${s.name}</button>`).join('')}</div></div>
    <div class="sk-right"><label class="l">ให้ระบบสร้างเป็น</label><div class="chips">${Object.entries(SKETCH_KINDS).map(([k, l]) => `<button class="chip ${k === st.k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="l">สีหลัก</label><div class="sw" data-sw="c1">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-cc value="${st.c1}"></div>
      <label class="l">สีรอง (${st.k === 'flower' ? 'กลางดอก' : 'ด้านล่าง'})</label><div class="sw" data-sw="c2">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" data-cc value="${st.c2}"></div>
      <label class="l">ชื่อชิ้นส่วน</label><input class="f" data-name maxlength="24" placeholder="เช่น ดาวเรืองของฉัน">
      <div class="sk-prev"></div>
      <div class="notice" data-tip></div>
      <div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn" data-make>✨ สร้างชิ้นส่วนนี้</button></div></div></div>`, { wide: true, onClose: () => prevObj?.dispose?.() });
  const B = m.body, cv = B.querySelector('canvas'), x = cv.getContext('2d'), W = cv.width; let cur = null, prevObj = null, pt;
  const tips = { flower: 'วาด <b>เส้นรอบรูปของดอกไม้เมื่อมองจากด้านบน</b> เช่น วงกลมขอบหยัก ระบบจะสร้างดอกทรงพุ่มซ้อนชั้นตามรูป', extrude: 'วาด <b>เส้นรอบรูปปิด</b> เช่น ใบไม้ ดาว หัวใจ ระบบจะตัดเป็นแผ่นหนาตั้งขึ้นตามรูป', lathe: 'วาด <b>ครึ่งขวาของรูปทรง</b> (หรือทั้งรูปก็ได้) เช่น แจกัน โคม ยอดฉัตร ระบบจะหมุนรอบแกนตั้งเป็นทรงกลม' };
  const redraw = () => { x.fillStyle = '#fffdf5'; x.fillRect(0, 0, W, W); x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1; for (let i = 0; i <= W; i += 30) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, W); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    x.strokeStyle = 'rgba(230,57,70,.35)'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, W); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#3d2c1e'; x.lineWidth = 5; x.lineCap = x.lineJoin = 'round'; for (const s of st.strokes) { x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }
    B.querySelector('[data-tip]').innerHTML = '💡 ' + tips[st.k]; };
  const sk = () => { const pr = sketchProfile(st.strokes, st.k, W); return pr ? sanitizeSketch({ id: 'tmp', k: st.k, pr: pr.pr, a: pr.a, c2: st.c2, name: st.name || 'ชิ้นงานที่วาด' }) : null; };
  const preview = () => { clearTimeout(pt); pt = setTimeout(() => { const s = sk(); const box = B.querySelector('.sk-prev'); if (!s) { box.innerHTML = '<p class="muted">วาดภาพในกรอบด้านซ้าย แล้วดูตัวอย่าง 3 มิติตรงนี้</p>'; return; } try { prevObj = makePreview(box, s, st.c1); } catch (e) { box.textContent = ''; } }, 200); };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * W]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cur = [pos(e)]; st.strokes.push(cur); redraw(); });
  cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(pos(e)); redraw(); });
  const end = () => { if (cur) { cur = null; preview(); } }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  B.querySelector('[data-undo]').onclick = () => { st.strokes.pop(); redraw(); preview(); };
  B.querySelector('[data-clear]').onclick = () => { st.strokes = []; redraw(); preview(); };
  B.querySelectorAll('[data-sample]').forEach(b => b.onclick = () => { const s = SAMPLES[b.dataset.sample]; st.strokes = s.draw(W); Object.assign(st, { k: s.k, c1: s.c1, c2: s.c2 }); B.querySelector('[data-name]').value = st.name = s.name; syncUI(); redraw(); preview(); });
  B.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { st.k = b.dataset.k; syncUI(); redraw(); preview(); });
  B.querySelectorAll('[data-sw]').forEach(sw => { const key = sw.dataset.sw; sw.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { st[key] = b.dataset.c; syncUI(); preview(); }); sw.querySelector('[data-cc]').addEventListener('input', e => { st[key] = e.target.value; preview(); }); });
  B.querySelector('[data-name]').addEventListener('input', e => { st.name = e.target.value.trim(); });
  const syncUI = () => { B.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === st.k)); B.querySelectorAll('[data-sw]').forEach(sw => { sw.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === st[sw.dataset.sw])); sw.querySelector('[data-cc]').value = st[sw.dataset.sw]; }); };
  B.querySelector('[data-make]').onclick = () => { const s = sk(); if (!s) return toast('วาดภาพให้มีเส้นมากกว่านี้อีกนิดนะ');
    const thumb = (() => { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.drawImage(cv, 0, 0, 96, 96); return c.toDataURL('image/png'); })();
    onCreate({ ...s, id: uid('s').slice(0, 24), c1: st.c1, img: thumb }); m.close(); };
  syncUI(); redraw(); preview(); return m;
}
/** แปลงเส้นที่วาดเป็นโปรไฟล์ตัวเลข: โปรไฟล์เชิงขั้ว (ดอกไม้/แผ่นตัด) หรือความกว้างทีละแถว (ทรงกลึง) */
export function sketchProfile(strokes, kind, W = 360) {
  const pts = []; for (const s of strokes) for (let i = 0; i < s.length; i++) { const a = s[i], b = s[i + 1] || a, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  if (pts.length < 12) return null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 - x0 < 20 && y1 - y0 < 20) return null;
  const fill = (arr) => { const n = arr.length; for (let i = 0; i < n; i++) if (arr[i] < 0) { let l = i, r = i, dl = 0, dr = 0; while (arr[(l + n) % n] < 0 && dl < n) { l--; dl++; } while (arr[r % n] < 0 && dr < n) { r++; dr++; } const a = arr[(l + n) % n], b = arr[r % n]; arr[i] = a < 0 || b < 0 ? 0.5 : a + (b - a) * dl / (dl + dr); } return arr; };
  if (kind === 'lathe') { const N = 24, cx = (x1 - x0) > W * 0.25 && x0 < W / 2 - 10 ? (x0 + x1) / 2 : W / 2, rows = new Array(N).fill(-1);
    for (const [x, y] of pts) { const j = Math.min(N - 1, Math.floor((y - y0) / Math.max(1, y1 - y0) * N)); rows[j] = Math.max(rows[j], Math.abs(x - cx)); }
    const filled = []; for (let j = 0; j < N; j++) filled[j] = rows[j]; for (let j = 0; j < N; j++) if (filled[j] < 0) { let a = j - 1, b = j + 1; while (a >= 0 && rows[a] < 0) a--; while (b < N && rows[b] < 0) b++; filled[j] = a < 0 ? (b < N ? rows[b] : 1) : b >= N ? rows[a] : rows[a] + (rows[b] - rows[a]) * (j - a) / (b - a); }
    const mx = Math.max(...filled) || 1, half = mx; return { pr: filled.map(v => Math.max(0.03, v / mx)), a: (y1 - y0) / (2 * half) }; }
  const N = 48, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, bins = new Array(N).fill(-1);
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy, a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2), i = Math.floor(a / (Math.PI * 2) * N) % N; bins[i] = Math.max(bins[i], Math.hypot(dx, dy)); }
  fill(bins); const sm = bins.map((v, i) => (bins[(i - 1 + N) % N] + 2 * v + bins[(i + 1) % N]) / 4), mx = Math.max(...sm) || 1;
  return { pr: sm.map(v => Math.max(0.12, v / mx)), a: (y1 - y0) / Math.max(1, x1 - x0) };
}

/* ============================================================
   แผนภาพจุดศูนย์ถ่วง (มุมมองจากด้านบน)
   ============================================================ */
export function drawBalance(cv, d) {
  const st = computeStats(d), b = BASES[d.base] || BASES.round, x = cv.getContext('2d'), W = cv.width, H = cv.height, S = Math.min(W, H) / 3.2, cx = W / 2, cy = H / 2;
  x.clearRect(0, 0, W, H); x.fillStyle = '#16123a'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(94,156,76,.55)'; x.strokeStyle = '#7fb069'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy, b.rx * S, b.rz * S, 0, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = 'rgba(110,231,183,.8)'; x.setLineDash([4, 4]); x.beginPath(); x.ellipse(cx, cy, b.rx * S * 0.12, b.rz * S * 0.12, 0, 0, 7); x.stroke(); x.setLineDash([]);
  for (const p of d.pieces) { const def = MATERIALS[p.m]; if (!def) continue; const w = def.w * (p.s || 1) ** 2; x.fillStyle = def.cat === 'elec' ? '#4cc9f0' : def.cat === 'mech' ? '#f4a261' : def.cat === 'leaf' ? '#b7e4a0' : (p.c || def.color);
    x.globalAlpha = 0.85; x.beginPath(); x.arc(cx + p.p[0] * S, cy + p.p[2] * S, 2 + Math.sqrt(w) * 5, 0, 7); x.fill(); x.globalAlpha = 1; }
  x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 7, cy); x.lineTo(cx + 7, cy); x.moveTo(cx, cy - 7); x.lineTo(cx, cy + 7); x.stroke();
  const gx = cx + st.cx * S * 6, gy = cy + st.cz * S * 6; // ขยาย 6 เท่าให้เห็นการเยื้องชัดเจน
  x.strokeStyle = '#ff6b81'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(gx, gy); x.stroke();
  x.fillStyle = st.offset < 0.12 ? '#6ee7b7' : st.offset < 0.3 ? '#ffd166' : '#ff6b81'; x.beginPath(); x.arc(gx, gy, 6, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke();
  x.fillStyle = '#c4bde6'; x.font = '11px sans-serif'; x.fillText('มุมบน · หน้า ↓', 6, H - 6); x.textAlign = 'right'; x.fillText('ระยะเยื้อง ×6', W - 6, H - 6); x.textAlign = 'left';
  return st;
}
