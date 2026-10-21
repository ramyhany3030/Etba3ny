/* =====================================================================
   portal.js — بوابة الأعضاء (أخبار/رحلات/مؤتمرات/حسابي) + إدارة الأخبار والرحلات للأدمن + خريطة الأتوبيس
   + الضيوف (اسم + تليفون + موافقة الأدمن قبل الحجز) + بوستر الرحلة + أنماط الأتوبيس المحفوظة
   + سجل التدقيق وسلة المحذوفات (سوبر أدمن). بيتحمّل قبل السكريبت الرئيسي في index.html.
   ===================================================================== */
const PORTAL_VER = '2026-10-26-poster-v9';           // لازم يطابق EXPECTED_VERSION في index.html (لو اختلف بيظهر تنبيه "ملف قديم")

const PM = { token: sessionStorage.getItem('m_tok') || '', name: sessionStorage.getItem('m_name') || '', code: sessionStorage.getItem('m_code') || '',
  mustChange: false, tab: 'news', tabs: null, imgs: {}, news: { items: [], total: 0 }, trips: [], io: null, dirty: false };
const PA = { news: [], trips: [], tpls: [], audit: { items: [], hasMore: false }, trashView: 'deleted' };
const P_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function pDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return P_DAYS[d.getDay()] + ' ' + iso.slice(0, 10);
}
const pSpin = '<div class="empty"><span class="spin"></span> جاري التحميل...</div>';
const pShort = n => String(n || '').split(' ').slice(0, 2).join(' ');

// نافذة ديناميكية. o: {narrow, tag:'admin'|'member', onClose}
function pModal(title, body, foot, o) {
  o = o || {};
  const ov = document.createElement('div'); ov.className = 'ov';
  if (o.tag === 'admin') ov.dataset.admin = '1'; else if (o.tag === 'member') ov.dataset.member = '1';
  ov.innerHTML = `<div class="mb${o.narrow ? ' nar' : ''}"><header><h3>${esc(title)}</h3><button class="xb" data-x type="button">×</button></header><div class="bd">${body}</div>${foot ? `<div class="ft">${foot}</div>` : ''}</div>`;
  document.body.appendChild(ov);
  const close = () => { if (ov._closed) return; ov._closed = true; if (o.onClose) o.onClose(); ov.remove(); };
  ov._close = close; ov.querySelector('[data-x]').onclick = close;
  return { el: ov, close, q: s => ov.querySelector(s), qa: s => Array.from(ov.querySelectorAll(s)) };
}
// رسالة بنقاط (تنبيهات أو أخطاء). kind: warn | bad | good
function pInfo(title, lines, kind) {
  const m = pModal(title, `<div class="msgs">${lines.map(l => `<div class="notice ${kind || 'warn'}" style="margin:0 0 6px">${esc(l)}</div>`).join('')}</div>`, '<button class="btn pri" data-ok>تمام</button>', { narrow: true, tag: 'admin' });
  m.q('[data-ok]').onclick = m.close;
  return m;
}

/* =====================================================================
   الضيوف: حالة الموافقة + نماذج الإدخال (اسم + تليفون [+ نوع]) + نافذة «طلب الاشتراك» + نافذة «ضيوفي»
   ===================================================================== */
const PHONE_RE = /^01[0125]\d{8}$/;
const GST = { p: ['⏳ بانتظار الموافقة', 'p'], a: ['✔ موافق عليه', 'o'], r: ['✖ مرفوض', 'n'] };
const gstOf = g => g.st || 'a';
const gstBadge = g => { const x = GST[gstOf(g)] || GST.a; return `<span class="badge ${x[1]}">${x[0]}</span>`; };
const guestsLive = gs => (gs || []).filter(g => gstOf(g) !== 'r');                 // المرفوض مبيتحسبش من الحد
const guestsSummary = gs => {
  gs = gs || []; if (!gs.length) return '';
  const a = gs.filter(g => gstOf(g) === 'a').length, p = gs.filter(g => gstOf(g) === 'p').length, r = gs.filter(g => gstOf(g) === 'r').length;
  return `<span class="badge b">ضيوف: ${a + p}</span>${a ? ` <span class="badge o">✔ ${a} موافق عليهم</span>` : ''}${p ? ` <span class="badge p">⏳ ${p} بانتظار الموافقة</span>` : ''}${r ? ` <span class="badge n">✖ ${r} مرفوض</span>` : ''}`;
};
// حقول ضيف: اسم + تليفون (+ نوع للمؤتمرات)
function guestFieldsHTML(withGender, v) {
  v = v || {};
  return `<input data-gf="name" data-t="name" maxlength="60" placeholder="اسم الضيف (ثنائي على الأقل)" autocomplete="off" value="${esc(v.name || '')}">
    <input data-gf="phone" data-t="digits" inputmode="numeric" maxlength="11" dir="ltr" placeholder="تليفون الضيف (11 رقم)" autocomplete="off" value="${esc(v.phone || '')}">
    ${withGender ? `<select data-gf="gender"><option value="">النوع</option><option${v.gender === 'ذكر' ? ' selected' : ''}>ذكر</option><option${v.gender === 'أنثى' ? ' selected' : ''}>أنثى</option></select>` : ''}`;
}
function readGuestFields(root, withGender) {
  const q = k => root.querySelector(`[data-gf="${k}"]`);
  const name = (q('name').value || '').trim().replace(/\s+/g, ' '), phone = toEn(q('phone').value).replace(/\D/g, ''), gender = withGender ? q('gender').value : '';
  let error = '';
  if (name.split(' ').filter(Boolean).length < 2 || !RE_NAME.test(name)) error = 'اكتب اسم الضيف ثنائي على الأقل (حروف فقط).';
  else if (!PHONE_RE.test(phone)) error = 'رقم تليفون الضيف لازم يكون 11 رقم ويبدأ بـ 01.';
  else if (withGender && !gender) error = 'اختر نوع الضيف (ذكر / أنثى).';
  return { name, phone, gender, error };
}
// حفظ المكتوب في خانات الضيف عبر إعادة الرسم (التحديث الدوري)
function bindDraft(body, draft) { body.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.gf; if (k) draft[k] = e.target.value; }); body.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.gf; if (k) draft[k] = e.target.value; }); }
function applyDraft(body, draft) { $$('[data-gf]', body).forEach(el => { if (draft[el.dataset.gf] != null) el.value = draft[el.dataset.gf]; }); }

// «طلب الاشتراك»: لو الحد > 1 لازم العضو يحدد هيجي لوحده ولا معاه ضيوف (اسم + تليفون [+ نوع]). بيرجّع قايمة (ممكن فاضية) أو null لو لغى.
function askJoinGuests(o) {
  return new Promise(res => {
    const slots = o.max - 1, wg = !!o.withGender;
    const m = pModal(o.title, `
      <div class="notice info">${esc(o.what)} دي بتسمح بحد أقصى <b>${o.max}</b> أشخاص (حضرتك + ${slots} ${slots === 1 ? 'ضيف' : 'ضيوف'}).
        قبل ما تبعت الطلب حدّد هتيجي لوحدك ولا معاك ضيوف، واكتب <b>اسم ورقم تليفون</b> كل ضيف${wg ? ' ونوعه' : ''}.
        الإدارة هتراجع الضيوف وتوافق عليهم، وبعد الموافقة بس تقدر تحجز لكل واحد منهم مقعده${o.what === 'المؤتمر' ? ' وسريره' : ''}.</div>
      <label class="chk big"><input type="radio" name="jm" value="alone"> 🙋 هاجي لوحدي (من غير ضيوف)</label>
      <label class="chk big"><input type="radio" name="jm" value="group"> 👥 هاجي معايا ضيوف</label>
      <div data-rows hidden><div data-list></div><div class="row"><button type="button" class="btn sm ok" data-add>➕ إضافة ضيف</button><small class="hint" data-cnt></small></div></div>
      <div class="formerr" data-err hidden></div>`,
      '<button class="btn pri" data-send>📨 إرسال الطلب</button><button class="btn" data-cancel>إلغاء</button>', { tag: 'member', onClose: () => res(null) });
    const rowsBox = m.q('[data-rows]'), list = m.q('[data-list]'), err = m.q('[data-err]');
    const rows = () => m.qa('[data-row]');
    const sync = () => { m.q('[data-add]').disabled = rows().length >= slots; m.q('[data-cnt]').textContent = `${rows().length} من ${slots}`; };
    const addRow = () => {
      if (rows().length >= slots) return;
      const d = document.createElement('div'); d.className = 'grow-edit' + (wg ? ' g3' : ''); d.dataset.row = '1';
      d.innerHTML = guestFieldsHTML(wg) + '<button type="button" class="btn sm bad" data-rm title="حذف">×</button>';
      list.appendChild(d); sync(); const f = d.querySelector('[data-gf=name]'); if (f) f.focus();
    };
    m.qa('input[name=jm]').forEach(r => r.onchange = () => {
      err.hidden = true; rowsBox.hidden = r.value !== 'group' || !r.checked;
      if (r.value === 'group' && r.checked && !rows().length) addRow();
    });
    m.q('[data-add]').onclick = addRow;
    list.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { b.closest('[data-row]').remove(); sync(); } };
    m.q('[data-cancel]').onclick = m.close;
    m.q('[data-send]').onclick = () => {
      const mode = (m.qa('input[name=jm]').find(r => r.checked) || {}).value, bad = t => { err.textContent = t; err.hidden = false; };
      if (!mode) return bad('اختار الأول: هتيجي لوحدك ولا معاك ضيوف.');
      if (mode === 'alone') { res([]); return m.close(); }
      const rs = rows(); if (!rs.length) return bad('اضغط «إضافة ضيف» واكتب بياناته، أو اختار «هاجي لوحدي».');
      const out = [], seen = {};
      for (let i = 0; i < rs.length; i++) {
        const g = readGuestFields(rs[i], wg);
        if (g.error) { rs[i].scrollIntoView({ block: 'center' }); return bad('الضيف رقم ' + (i + 1) + ': ' + g.error); }
        if (seen[g.name]) return bad('الاسم «' + g.name + '» مكتوب مرتين.');
        seen[g.name] = 1; out.push(o.withGender ? { name: g.name, phone: g.phone, gender: g.gender } : { name: g.name, phone: g.phone });
      }
      res(out); m.close();
    };
  });
}

// «ضيوفي»: قايمة ضيوف العضو بحالة موافقة الإدارة + إضافة/حذف. cfg: {title, withGender, fetchMy: async()=>({ok,error,my,maxPeople,open}), add: async(g)=>resp, remove: async(id)=>resp, onClose}
async function openGuestsManager(cfg) {
  let st = null, busy = false; const draft = {};
  const m = pModal(cfg.title, pSpin, '', { tag: 'member', onClose: cfg.onClose });
  const body = m.q('.bd'); bindDraft(body, draft);
  const draw = () => {
    if (!st) return;
    const gs = st.my.guests || [], live = guestsLive(gs).length, left = st.maxPeople - 1 - live, open = st.open;
    const list = gs.map(g => `<div class="gl ${gstOf(g) === 'p' ? 'pend' : gstOf(g) === 'r' ? 'rej' : ''}"><div><b>${esc(g.name)}</b>${cfg.withGender ? ` <span class="badge ${g.gender === 'أنثى' ? 's' : 'g'}">${esc(g.gender || '—')}</span>` : ''}
      <br><small class="ltr" style="display:inline-block">${esc(g.phone || '—')}</small>${gstOf(g) === 'r' && g.note ? `<br><small style="color:var(--bad)">سبب الرفض: ${esc(g.note)}</small>` : ''}</div>
      <div class="row">${gstBadge(g)}${open ? `<button class="btn sm bad" data-rm="${esc(g.id)}" title="حذف الضيف">🗑</button>` : ''}</div></div>`).join('');
    const form = !open ? '' : left > 0 ? `<div class="sec" style="margin-top:10px"><h3>➕ إضافة ضيف</h3><div class="grow-edit${cfg.withGender ? ' g3' : ''}" data-addform>${guestFieldsHTML(!!cfg.withGender)}<button type="button" class="btn sm pri" data-add>إضافة</button></div>
      <small class="hint">تقدر تضيف ${left} ${left === 1 ? 'ضيف' : 'ضيوف'} كمان. الضيف بيفضل «بانتظار الموافقة» لحد ما الإدارة توافق عليه.</small><div class="formerr" data-err hidden></div></div>`
      : '<div class="notice warn" style="margin-top:10px">وصلت للحد الأقصى من الأشخاص. احذف ضيف لو عايز تضيف غيره.</div>';
    body.innerHTML = `<div class="hint">الحد الأقصى ${st.maxPeople} أشخاص (حضرتك + ${st.maxPeople - 1}). ${guestsSummary(gs) || 'مفيش ضيوف لسه.'}</div>
      <div class="notice info" style="margin:8px 0">الإدارة بتراجع الضيوف وتوافق عليهم، وبعد الموافقة بس تقدر تحجز للضيف مقعده${cfg.withGender ? ' وسريره' : ''}.</div>${list}${form}`;
    applyDraft(body, draft);
  };
  const load = async () => {
    const r = await cfg.fetchMy(); if (!m.el.isConnected) return;
    if (!r.ok) { body.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
    st = r; draw();
  };
  body.onclick = async e => {
    if (busy) return;
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const g = (st.my.guests || []).find(x => x.id === rm.dataset.rm); if (!g) return;
      if (!await ask({ title: 'حذف ضيف', msg: `حذف «${g.name}» من حجزك؟${g.seat || g.bed ? ' مقعده / سريره هيتحرر.' : ''}`, okText: 'حذف' })) return;
      busy = true; const r = await cfg.remove(g.id); busy = false;
      toast(r.ok ? 'تم حذف الضيف' : r.error, r.ok ? 'ok' : 'err'); return load();
    }
    if (e.target.closest('[data-add]')) {
      const box = body.querySelector('[data-addform]'), g = readGuestFields(box, !!cfg.withGender), er = body.querySelector('[data-err]');
      if (g.error) { er.textContent = g.error; er.hidden = false; return; }
      busy = true; const r = await cfg.add(cfg.withGender ? { name: g.name, phone: g.phone, gender: g.gender } : { name: g.name, phone: g.phone }); busy = false;
      if (!r.ok) { er.textContent = r.error; er.hidden = false; return; }
      ['name', 'phone', 'gender'].forEach(k => delete draft[k]); toast('تمت إضافة الضيف — بانتظار موافقة الإدارة', 'ok'); return load();
    }
  };
  load();
}

// نافذة إضافة ضيف (للأدمن): بترجّع {name, phone, gender} أو null. الأدمن بيضيف ضيف موافق عليه أوتوماتيك
function askGuest(withGender) {
  return new Promise(res => {
    const m = pModal('➕ إضافة ضيف', `<div class="grow-edit${withGender ? ' g3' : ''}" data-g="row">${guestFieldsHTML(withGender)}</div><small class="hint">الضيف اللي بيضيفه الأدمن بيتوافق عليه أوتوماتيك.</small><div class="formerr" data-g="err" hidden></div>`,
      '<button class="btn pri" data-g="ok">إضافة</button><button class="btn" data-g="no">إلغاء</button>', { narrow: true, tag: 'admin', onClose: () => res(null) });
    const g = k => m.q(`[data-g="${k}"]`);
    g('no').onclick = m.close;
    g('ok').onclick = () => {
      const x = readGuestFields(g('row'), withGender);
      if (x.error) { g('err').textContent = x.error; g('err').hidden = false; return; }
      res({ name: x.name, phone: x.phone, gender: x.gender }); m.close();
    };
    m.q('[data-gf=name]').focus();
  });
}

/* =====================================================================
   خريطة الأتوبيس (مشتركة: عرض / اختيار / أدمن / محرر)
   الحروف: E ممر | S مقعد | X مقعد غير متاح للحجز | D سائق | R باب
   ===================================================================== */
function numberSeatsJS(cells, oldNums) {            // نفس خوارزمية الخادم بالظبط
  const nums = []; let used = 0;
  cells.forEach((row, r) => { nums.push([]); for (let c = 0; c < row.length; c++) {
    const t = row.charAt(c); let n = 0;
    if (oldNums && (t === 'S' || t === 'X')) n = (oldNums[r] && oldNums[r][c]) || 0;
    nums[r].push(n); if (n > used) used = n;
  } });
  let next = used + 1;
  cells.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const t = row.charAt(c); if ((t === 'S' || t === 'X') && !nums[r][c]) nums[r][c] = next++; } });
  return nums;
}
// o.mine = مقعد الشخص المختار حاليًا (بلون قوي) | o.mineSet = كل مقاعد حجزي (أنا وضيوفي) | o.sel = المقعد اللي بدوس عليه
function cellParts(t, n, o) {
  const occ = o.occupied || {}, cls = ['c', t]; let label = '';
  if (t === 'S' || t === 'X') {
    label = n || '';
    const taken = !!occ[n];
    if (taken) cls.push('taken');
    if (o.mineSet && o.mineSet[n]) cls.push('mine2');
    if (o.mine && o.mine === n) cls.push('mine');
    if (o.sel && o.sel === n) cls.push('sel');
    if (t === 'S' && !taken) cls.push('free');
  } else if (t === 'D') label = 'سائق'; else if (t === 'R') label = 'باب';
  return { cls: cls.join(' '), label };
}
function busHTML(L, o) {
  o = o || {}; const cols = L.cols || (L.cells[0] || '').length, mode = o.mode || 'view', names = o.names || {};
  let h = `<div class="busWrap"><div class="busFront">▲ المقدمة</div><div class="bus${mode === 'edit' ? ' edit' : ''}${mode === 'admin' ? ' adm' : ''}" style="--cols:${cols}">`;
  L.cells.forEach((row, r) => { for (let c = 0; c < cols; c++) {
    const t = row.charAt(c) || 'E', n = (L.nums && L.nums[r] && L.nums[r][c]) || 0, p = cellParts(t, n, o);
    h += `<button type="button" class="${p.cls}" data-r="${r}" data-c="${c}" data-n="${n}" data-k="${t}"${names[n] ? ` title="${esc(names[n])}"` : ''}>${p.label}</button>`;
  } });
  return h + '</div></div>';
}
const BUS_LEGEND = '<div class="legend"><span><i style="background:#e8f4ec;border-color:#1f7a45"></i>متاح</span><span><i style="background:#e9e3d6;border-color:#cfc4ad"></i>محجوز</span><span><i style="background:#c8a24a;border-color:#96601a"></i>مقعدك</span></div>';
function presetCells(kind) {
  const P = { '2+2': [2, 2, 11], '2+3': [2, 3, 10], '1+2': [1, 2, 5] }[kind]; if (!P) return null;
  const L = P[0], R = P[1], n = P[2], cols = L + 1 + R, rows = ['D' + 'E'.repeat(cols - 2) + 'R'];
  for (let i = 0; i < n; i++) rows.push('S'.repeat(L) + 'E' + 'S'.repeat(R));
  rows.push('S'.repeat(cols));
  return rows;
}

// محرر الأتوبيس: بيرسم داخل host. init: {cells, nums, locked}
// فيه شريط «أنماط محفوظة»: تطبّق نمط جاهز، أو تحفظ الشكل الحالي باسم عشان تستخدمه تاني في رحلات/مؤتمرات تانية.
function BusEditor(host, init) {
  const S = { cells: (init && init.cells && init.cells.length ? init.cells : presetCells('2+2')).map(r => r.split('')), oldNums: init && init.nums || null, locked: !!(init && init.locked), tool: 'S' };
  const rows = () => S.cells.length, cols = () => S.cells[0].length;
  host.innerHTML = `
    <div class="tplbar">
      <select data-b="tpl"><option value="">📂 الأنماط المحفوظة...</option></select>
      <button type="button" class="btn sm" data-b="tplApply">تطبيق النمط</button>
      <button type="button" class="btn sm gold" data-b="tplSave">💾 حفظ الشكل الحالي كنمط</button>
      <button type="button" class="btn sm bad" data-b="tplDel" title="حذف النمط المختار">🗑</button>
    </div>
    <div class="row" style="margin-bottom:6px">
      <select data-b="preset" style="width:auto"><option value="">شكل جاهز...</option><option value="2+2">أتوبيس 2+2</option><option value="2+3">أتوبيس 2+3</option><option value="1+2">ميني باص 1+2</option></select>
      <button type="button" class="btn sm" data-b="apply">تطبيق</button>
      <label class="chk" style="margin:0">صفوف <input data-b="rows" type="number" min="1" max="30" style="width:64px;padding:5px"></label>
      <label class="chk" style="margin:0">أعمدة <input data-b="cols" type="number" min="1" max="8" style="width:60px;padding:5px"></label>
    </div>
    <div class="tools" data-b="tools">
      <button type="button" data-tool="S">💺 مقعد</button><button type="button" data-tool="X">⛔ مقعد غير متاح</button>
      <button type="button" data-tool="D">🧑‍✈️ سائق</button><button type="button" data-tool="R">🚪 باب</button><button type="button" data-tool="E">⬜ ممر / مسح</button>
    </div>
    <div class="hint" data-b="info"></div>
    <div data-b="grid" style="text-align:center;margin-top:6px"></div>
    ${S.locked ? '<div class="notice warn" style="margin-top:8px">فيه حجوزات على الرحلة دي: أرقام المقاعد الحالية هتفضل زي ما هي، والمقاعد الجديدة بتتضاف بأرقام بعد آخر رقم. ومينفعش تحذف مقعد محجوز (حرّره الأول).</div>' : ''}`;
  const q = k => host.querySelector(`[data-b="${k}"]`), grid = q('grid');
  const strs = () => S.cells.map(r => r.join(''));
  const nums = () => numberSeatsJS(strs(), S.locked ? S.oldNums : null);
  function info() {
    const s = strs().join(''); const sc = (s.match(/S/g) || []).length, xc = (s.match(/X/g) || []).length;
    q('info').textContent = `اضغط أو اسحب على الخانات للرسم. مقاعد متاحة للحجز: ${sc}${xc ? ' + ' + xc + ' غير متاح' : ''}`;
    q('rows').value = rows(); q('cols').value = cols();
    host.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  }
  function full() { grid.innerHTML = busHTML({ cells: strs(), nums: nums(), cols: cols() }, { mode: 'edit' }); info(); }
  function refresh() {
    const nm = nums();
    grid.querySelectorAll('.c').forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c, t = S.cells[r][c], p = cellParts(t, nm[r][c], {});
      el.className = p.cls; el.textContent = p.label; el.dataset.k = t; el.dataset.n = nm[r][c];
    });
    info();
  }
  let painting = false;
  const paint = el => { if (!el) return; const r = +el.dataset.r, c = +el.dataset.c; if (S.cells[r][c] !== S.tool) { S.cells[r][c] = S.tool; refresh(); } };
  grid.addEventListener('pointerdown', e => { const el = e.target.closest('.c'); if (!el) return; e.preventDefault(); painting = true; paint(el); });
  grid.addEventListener('pointermove', e => { if (!painting) return; const el = document.elementFromPoint(e.clientX, e.clientY); paint(el && el.closest && el.closest('.bus.edit .c')); });
  window.addEventListener('pointerup', () => { painting = false; });
  host.querySelector('[data-b="tools"]').onclick = e => { const b = e.target.closest('[data-tool]'); if (b) { S.tool = b.dataset.tool; info(); } };
  q('apply').onclick = () => { const k = q('preset').value, p = presetCells(k); if (p) { S.cells = p.map(r => r.split('')); full(); } };
  const resize = () => {
    const R = Math.min(30, Math.max(1, parseInt(q('rows').value, 10) || rows())), C = Math.min(8, Math.max(1, parseInt(q('cols').value, 10) || cols()));
    S.cells = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (S.cells[r] && S.cells[r][c]) || 'E')); full();
  };
  q('rows').onchange = resize; q('cols').onchange = resize;

  /* ---- الأنماط المحفوظة ---- */
  let TPLS = [];
  const tplSel = q('tpl');
  const fillTpl = pick => {
    tplSel.innerHTML = '<option value="">📂 الأنماط المحفوظة' + (TPLS.length ? ' (' + TPLS.length + ')' : ' — مفيش لسه') + '...</option>' +
      TPLS.map(t => `<option value="${esc(t.id)}">${esc(t.name)} — ${t.seats} مقعد</option>`).join('');
    if (pick) tplSel.value = pick;
  };
  const setTpls = (items, pick) => { TPLS = items || []; PA.tpls = TPLS; fillTpl(pick); };
  const cur = () => TPLS.find(t => t.id === tplSel.value);
  adm('busTplList').then(r => { if (r.ok && host.isConnected) setTpls(r.items); });
  q('tplApply').onclick = () => {
    const t = cur(); if (!t) return toast('اختار نمط الأول من القايمة.', 'err');
    S.cells = t.cells.map(r => r.split('')); full();
    toast('تم تطبيق النمط «' + t.name + '»' + (S.locked ? ' — خد بالك: مينفعش تحذف مقاعد محجوزة' : ''), 'ok');
  };
  q('tplSave').onclick = async () => {
    const sc = (strs().join('').match(/S/g) || []).length;
    if (!sc) return toast('ارسم مقعد واحد على الأقل قبل الحفظ.', 'err');
    const name = await ask({ title: 'حفظ الشكل كنمط', msg: `الشكل الحالي (${sc} مقعد) هيتحفظ باسم تختاره، وتقدر تطبّقه بعد كده في أي رحلة أو مؤتمر. لو كتبت اسم نمط موجود هتقدر تستبدله.`, input: 'line', okText: 'حفظ' });
    if (!name) return;
    const same = TPLS.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
    let id;
    if (same) { if (!await ask({ title: 'استبدال النمط', msg: `فيه نمط اسمه «${same.name}» (${same.seats} مقعد). تستبدله بالشكل الحالي؟`, okText: 'استبدال' })) return; id = same.id; }
    const r = await adm('busTplSave', { id, name: name.trim(), cells: strs() });
    if (!r.ok) return toast(r.error, 'err');
    const saved = r.items.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
    setTpls(r.items, saved && saved.id); toast('تم حفظ النمط «' + name.trim() + '» ✔', 'ok');
  };
  q('tplDel').onclick = async () => {
    const t = cur(); if (!t) return toast('اختار النمط اللي عايز تحذفه الأول.', 'err');
    if (!await ask({ title: 'حذف نمط', msg: `حذف النمط «${t.name}»؟ هيتنقل لسلة المحذوفات (الرحلات اللي استخدمته مش بتتأثر).`, okText: 'حذف' })) return;
    const r = await adm('busTplDelete', { id: t.id });
    if (!r.ok) return toast(r.error, 'err');
    setTpls(r.items); toast('تم حذف النمط (في سلة المحذوفات)', 'ok'); if (typeof refreshTrashCount === 'function') refreshTrashCount();
  };
  full();
  return { getLayout: () => ({ cells: strs() }) };
}

/* "عدد الأشخاص لكل عضو": قايمة 1..10 (مشتركة بين الرحلات والمؤتمرات) */
function maxPeopleOptions() {
  return Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i === 0 ? '1 — العضو بس (من غير ضيوف)' : (i + 1) + ' أشخاص (هو + ' + i + (i === 1 ? ' ضيف' : ' ضيوف') + ')'}</option>`).join('');
}

/* =====================================================================
   بوابة الأعضاء
   ===================================================================== */
async function mcall(action, payload, t) {
  const r = await api(action, { mtoken: PM.token, ...(payload || {}) }, t);
  if (r.auth) mLogout('انتهت الجلسة، سجّل الدخول مرة أخرى.');
  return r;
}
function mSave(token, name, code) {
  PM.token = token; if (name) PM.name = name; if (code) PM.code = code;
  sessionStorage.setItem('m_tok', PM.token); sessionStorage.setItem('m_name', PM.name); sessionStorage.setItem('m_code', PM.code);
}
function mLogout(msg, tellServer) {
  if (tellServer && PM.token) api('memberLogout', { mtoken: PM.token }).catch(() => {});
  PM.token = ''; PM.name = ''; PM.code = ''; PM.imgs = {}; PM.news = { items: [], total: 0 }; PM.trips = []; PM.tabs = null; PM.tab = 'news';
  ['m_tok', 'm_name', 'm_code'].forEach(k => sessionStorage.removeItem(k));
  $$('.ov[data-member]').forEach(o => o._close && o._close());
  $('#memPortal').hidden = true; $('#memLogin').hidden = false; $('#navMember').textContent = 'دخول الأعضاء';
  if (msg) showErr('#memErr', msg);
}
function portalOnTab(tab) { if (tab === 'member' && PM.token && PM.tab === 'news' && !PM.news.items.length && !$('#memNews').dataset.loaded) loadNews(true); }
function portalAdminReset() { PA.news = []; PA.trips = []; PA.tpls = []; PA.audit = { items: [], hasMore: false }; const a = $('#admAudit'); if (a) { a.dataset.init = ''; a.innerHTML = ''; } }

function portalInit() {
  $('#memCode').addEventListener('input', e => { e.target.value = toEn(e.target.value).replace(/\D/g, '').slice(0, 7); });
  $('#memShow').onchange = e => $('#memPass').type = e.target.checked ? 'text' : 'password';
  $('#memForm').onsubmit = async e => {
    e.preventDefault(); showErr('#memErr', '');
    const code = toEn($('#memCode').value).replace(/\D/g, ''), pw = $('#memPass').value;
    if (code.length !== 7) return showErr('#memErr', 'الكود 7 أرقام (مثال: 5001234).');
    if (!pw) return showErr('#memErr', 'اكتب كلمة المرور.');
    const b = $('#memBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
    const r = await api('memberLogin', { code, password: pw });
    b.disabled = false; b.textContent = 'دخول';
    if (!r.ok) return showErr('#memErr', r.error);
    mSave(r.token, r.name, r.code); PM.mustChange = !!r.mustChange; PM.tabs = r.tabs || null; $('#memPass').value = ''; enterPortal();
  };
  $('#memLogout').onclick = () => mLogout('', true);
  $('#memGoAcct').onclick = e => { e.preventDefault(); showMemberTab('acct'); };
  $$('#memTabs button').forEach(b => b.onclick = () => showMemberTab(b.dataset.mt));
  $('#memTrips').onclick = onTripsClick;
  $('#memNews').onclick = e => { if (e.target.closest('[data-more]')) loadNews(false); };
  if (PM.token) { enterPortal(); refreshMemberTabs(); }
}
function paintWho() {
  $('#memName').textContent = PM.name; $('#memCodeShow').textContent = PM.code;
  $('#memPwWarn').hidden = !PM.mustChange; $('#navMember').textContent = 'منطقتي';
}
// الرحلات والمؤتمرات بتظهر بس لو فيه حاجة منهم (مفتوحة أو مقفولة). لو التاب الحالي اختفى بنرجع للأخبار.
function applyMemberTabs(t) {
  if (t) PM.tabs = t;
  const x = PM.tabs || {};
  $('#mtTrips').hidden = !(x.trips > 0);
  $('#mtConf').hidden = !(x.conf > 0 && window.confModule);
  const cur = $(`#memTabs [data-mt="${PM.tab}"]`);
  if (cur && cur.hidden) showMemberTab('news');
}
async function refreshMemberTabs() {
  const r = await mcall('memberMe');
  if (r.ok) { PM.mustChange = r.mustChange; PM.name = r.name; PM.code = r.code; paintWho(); applyMemberTabs(r.tabs); }
}
function enterPortal() {
  $('#memLogin').hidden = true; $('#memPortal').hidden = false; paintWho(); applyMemberTabs(PM.tabs);
  const want = PM.mustChange ? 'news' : PM.tab, btn = $(`#memTabs [data-mt="${want}"]`);
  showMemberTab(btn && !btn.hidden ? want : 'news');
}
const MEM_BOX = { news: '#memNews', trips: '#memTrips', conf: '#memConf', acct: '#memAcct' };
function showMemberTab(name) {
  PM.tab = name;
  $$('#memTabs button').forEach(b => b.classList.toggle('on', b.dataset.mt === name));
  Object.keys(MEM_BOX).forEach(k => { const e = $(MEM_BOX[k]); if (e) e.hidden = k !== name; });
  if (name === 'news') { loadNews(true); refreshMemberTabs(); }
  else if (name === 'trips') loadTrips();
  else if (name === 'conf') { if (window.confModule) window.confModule.loadMember(); }
  else { renderAccount(); refreshMemberTabs(); }
}

/* ---------- الأخبار ---------- */
async function loadNews(reset) {
  const box = $('#memNews');
  if (reset) { PM.news = { items: [], total: 0 }; box.innerHTML = pSpin; }
  const r = await mcall('newsList', { offset: PM.news.items.length, limit: 10 });
  if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  PM.news.items = PM.news.items.concat(r.items); PM.news.total = r.total; box.dataset.loaded = '1';
  renderNews();
}
function postHTML(p) {
  const n = p.imgCount | 0;
  const imgs = n ? `<div class="pimgs${n === 1 ? ' one' : ''}">` + Array.from({ length: n }, (_, i) => `<div class="pimg" data-pid="${esc(p.id)}" data-i="${i}">⏳</div>`).join('') + '</div>' : '';
  return `<article class="post${p.pinned ? ' pin' : ''}"><h4>${p.pinned ? '📌 ' : ''}${esc(p.title)}</h4><div class="meta">${esc((p.createdAt || '').slice(0, 10))}</div>${p.body ? `<div class="body">${esc(p.body)}</div>` : ''}${imgs}</article>`;
}
function renderNews() {
  const box = $('#memNews'), N = PM.news;
  box.innerHTML = N.items.length ? N.items.map(postHTML).join('') + (N.items.length < N.total ? '<div style="text-align:center"><button class="btn" data-more>عرض المزيد</button></div>' : '')
    : '<div class="empty">مفيش أخبار لسه 📰</div>';
  observeImgs(box);
}
function observeImgs(box) {
  const els = $$('.pimg[data-pid]:not([data-done])', box);
  if (!('IntersectionObserver' in window)) return els.forEach(loadPImg);
  if (!PM.io) PM.io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { PM.io.unobserve(en.target); loadPImg(en.target); } }), { rootMargin: '200px' });
  els.forEach(el => PM.io.observe(el));
}
async function loadPImg(el) {
  if (el.dataset.done) return; el.dataset.done = '1';
  const key = el.dataset.pid + ':' + el.dataset.i; let src = PM.imgs[key];
  if (!src) { const r = await mcall('newsImage', { id: el.dataset.pid, i: +el.dataset.i }, 60000); if (!r.ok) { el.textContent = 'تعذر تحميل الصورة'; el.dataset.done = ''; return; } src = PM.imgs[key] = r.image; }
  el.innerHTML = `<img src="${src}" alt="">`; el.onclick = () => { $('#lbImg').src = src; $('#lightbox').hidden = false; };
}

/* ---------- الرحلات ---------- */
async function loadTrips() {
  const box = $('#memTrips'); box.innerHTML = pSpin;
  const r = await mcall('tripsList');
  if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  PM.trips = r.items;
  if (!r.items.length) { applyMemberTabs({ ...(PM.tabs || {}), trips: 0 }); return; }    // اتحذفت/اتخفت: التاب يختفي
  renderTrips();
}
function tripStateHTML(t) {
  const my = t.my || { status: 'none' }, open = t.status === 'open', gs = my.guests || [], party = t.maxPeople > 1;
  const cancel = open ? ' <button class="btn sm" data-act="cancel">إلغاء الاشتراك</button>' : '';
  const gbtn = party && (my.status === 'requested' || my.status === 'accepted') ? ` <button class="btn sm" data-act="guests">👥 ضيوفي${gs.length ? ' (' + gs.length + ')' : ''}</button>` : '';
  const gsum = gs.length ? `<div style="margin-top:6px">${guestsSummary(gs)}</div>` : '';
  if (my.status === 'requested') return `<span class="badge p">طلبك قيد المراجعة من الإدارة</span>${gbtn}${open ? ' <button class="btn sm" data-act="cancel">إلغاء الطلب</button>' : ''}${gsum}`;
  if (my.status === 'accepted' && my.needsCode) return `<div class="notice good">تم قبول اشتراكك ✔ الإدارة هتبعتلك <b>كود الرحلة</b> (4 أرقام وحروف). اكتبه هنا عشان تفتح اختيار المقعد.</div>
    <div class="row"><input class="tcode" maxlength="4" placeholder="XXXX" data-tc autocomplete="off" autocapitalize="characters"><button class="btn pri" data-act="verify">فتح</button>${gbtn}${cancel}</div>${gsum}`;
  if (my.status === 'accepted') {
    const gseat = gs.filter(g => g.seat).length, label = open ? ((my.seat || gseat) ? 'تعديل المقاعد' : 'اختيار المقعد') : 'عرض المقاعد';
    return `${my.seat ? `<span class="badge o">مقعدك رقم ${my.seat}</span>` : '<span class="badge p">لسه ما اخترتش مقعد</span>'}
      <button class="btn gold" data-act="seats">🚌 ${label}</button>${gbtn}${cancel}${gsum}`;
  }
  if (my.status === 'rejected') return `<div class="notice bad">تم رفض طلب الاشتراك${my.reason ? ': ' + esc(my.reason) : ''}</div>${open ? '<button class="btn pri" data-act="join">إعادة الطلب</button>' : ''}`;
  return open ? `${my.status === 'cancelled' ? '<span class="badge g">ألغيت اشتراكك</span> ' : ''}<button class="btn pri" data-act="join">🙋 طلب الاشتراك في الرحلة</button>` : '<span class="badge g">التسجيل مغلق</span>';
}
function tripCardHTML(t) {
  const pct = t.seatsTotal ? Math.round(t.seatsTaken * 100 / t.seatsTotal) : 0, left = Math.max(t.seatsTotal - t.seatsTaken, 0);
  return `<div class="trip${t.past ? ' past' : ''}" data-id="${esc(t.id)}">
    ${t.poster ? `<div class="tposter" data-poster="${esc(t.id)}" data-pk="${esc(t.poster)}">⏳ جاري تحميل البوستر...</div>` : ''}
    <div class="row" style="justify-content:space-between"><h4>🚌 ${esc(t.title)}</h4>${t.status === 'closed' ? '<span class="badge g">الحجز مغلق</span>' : '<span class="badge o">الحجز مفتوح</span>'}</div>
    <div class="tmeta"><span>📅 ${esc(pDate(t.tripDate))}${t.tripTime ? ' · ' + esc(t.tripTime) : ''}</span>${t.place ? `<span>📍 ${esc(t.place)}</span>` : ''}${t.price ? `<span>💰 ${esc(t.price)}</span>` : ''}${t.maxPeople > 1 ? `<span>👥 تقدر تحجز لحد ${t.maxPeople} أشخاص (بموافقة الإدارة على الضيوف)</span>` : ''}</div>
    ${t.description ? `<div style="margin:0 0 6px;white-space:pre-wrap;word-break:break-word">${esc(t.description)}</div>` : ''}
    <div class="tbar"><i style="width:${pct}%"></i></div><small class="hint">المقاعد: ${t.seatsTaken} محجوز من ${t.seatsTotal} (باقي ${left})</small>
    <div class="tstate">${tripStateHTML(t)}</div></div>`;
}
// البوستر بيتحمّل لوحده بعد ما الكروت تظهر (من غير ما يعطّل الصفحة)، ومتخزّن في الذاكرة بمفتاح = رقم ملف الصورة (لو الأدمن غيّرها بيتحمّل الجديد)
async function loadTripPoster(el, fetcher) {
  if (el.dataset.done) return; el.dataset.done = '1';
  const key = 'poster:' + el.dataset.pk; let src = PM.imgs[key];
  if (!src) { const r = await fetcher(el.dataset.poster); if (!r.ok) { el.remove(); return; } src = PM.imgs[key] = r.image; }
  if (!el.isConnected) return;
  el.innerHTML = `<img src="${src}" alt="بوستر الرحلة">`; el.onclick = () => { $('#lbImg').src = src; $('#lightbox').hidden = false; };
}
function renderTrips() {
  const box = $('#memTrips');
  box.innerHTML = PM.trips.length ? PM.trips.map(tripCardHTML).join('') : '<div class="empty">مفيش رحلات متاحة دلوقتي 🚌</div>';
  $$('.tposter', box).forEach(el => loadTripPoster(el, id => mcall('tripPoster', { id }, 60000)));
}
async function onTripsClick(e) {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const card = btn.closest('.trip'), id = card.dataset.id, act = btn.dataset.act, t = PM.trips.find(x => x.id === id);
  if (act === 'seats') return openSeats(id);
  if (act === 'guests') return openTripGuests(id);
  btn.disabled = true;
  try {
    if (act === 'join') {
      let guests;
      if (t && t.maxPeople > 1) {                                                   // الرحلة بتسمح بضيوف: لازم يحدد الأول
        guests = await askJoinGuests({ title: 'طلب الاشتراك في «' + t.title + '»', what: 'الرحلة', max: t.maxPeople, withGender: false });
        if (!guests) return;
      }
      let r = await mcall('tripJoin', guests ? { tripId: id, guests } : { tripId: id });
      if (!r.ok && r.needGuests && !guests) {                                       // القايمة عندنا قديمة (الحد اتغيّر): نسأل العضو ونعيد الطلب بدل ما نفضل نكرر الخطأ
        guests = await askJoinGuests({ title: 'طلب الاشتراك في «' + (t ? t.title : 'الرحلة') + '»', what: 'الرحلة', max: r.needGuests, withGender: false });
        if (!guests) { await loadTrips(); return; }
        r = await mcall('tripJoin', { tripId: id, guests });
      }
      if (!r.ok) toast(r.error, 'err'); else toast(guests && guests.length ? 'تم إرسال الطلب ✔ والضيوف بانتظار موافقة الإدارة' : 'تم إرسال طلب الاشتراك ✔', 'ok');
    } else if (act === 'cancel') {
      if (!await ask({ title: 'إلغاء الاشتراك', msg: `إلغاء اشتراكك في «${t ? t.title : 'الرحلة'}»؟ مقاعدك ومقاعد ضيوفك (لو فيه) هيتحرروا.`, okText: 'إلغاء الاشتراك' })) return;
      const r = await mcall('tripCancel', { tripId: id }); if (!r.ok) toast(r.error, 'err'); else toast('تم الإلغاء', 'ok');
    } else if (act === 'verify') {
      const code = toEn(card.querySelector('[data-tc]').value).replace(/\s+/g, '').toUpperCase();
      if (code.length !== 4) { toast('كود الرحلة 4 خانات.', 'err'); return; }
      const r = await mcall('tripVerifyCode', { tripId: id, code });
      if (!r.ok) { toast(r.error, 'err'); return; }
      toast('تم فتح الرحلة ✔ اختار مقعدك', 'ok'); await loadTrips(); return openSeats(id);
    }
    await loadTrips();
  } finally { btn.disabled = false; }
}
function openTripGuests(tripId) {
  openGuestsManager({
    title: '👥 ضيوفي في الرحلة', withGender: false,
    fetchMy: async () => { const r = await mcall('tripsList'); if (!r.ok) return r; const t = r.items.find(x => x.id === tripId); return t ? { ok: true, my: t.my, maxPeople: t.maxPeople, open: t.status === 'open' } : { ok: false, error: 'الرحلة غير متاحة.' }; },
    add: g => mcall('tripGuestAdd', { tripId, name: g.name, phone: g.phone }),
    remove: id => mcall('tripGuestRemove', { tripId, guestId: id }),
    onClose: () => { if (PM.tab === 'trips') loadTrips(); }
  });
}

// نافذة اختيار المقعد (ليك ولضيوفك الموافق عليهم): بتتحدّث كل 15 ثانية، والخادم هو اللي بيقرر (مقعد واحد لكل شخص، ولو اتحجز قبلك بيرفض)
async function openSeats(tripId) {
  let v = '', st = null, who = 'me', sel = 0, busy = false, timer = null; const draft = {};
  const m = pModal('اختيار المقعد', pSpin, '', { tag: 'member', onClose: () => { clearInterval(timer); if (PM.dirty && PM.tab === 'trips') loadTrips(); PM.dirty = false; } });
  const body = m.q('.bd'); bindDraft(body, draft);
  const persons = () => [{ id: 'me', name: 'أنا', seat: st.my.seat || 0, st: 'a' }].concat((st.my.guests || []).map(g => ({ id: g.id, name: g.name, seat: g.seat || 0, st: gstOf(g), guest: true })));
  const draw = () => {
    if (!st) return;
    const t = st.trip, my = st.my, open = t.status === 'open';
    if (!my.unlocked || !st.layout) { body.innerHTML = '<div class="empty">لازم اشتراكك يتقبل وتدخل كود الرحلة الأول.</div>'; return; }
    const ps = persons(); if (!ps.some(p => p.id === who && p.st === 'a')) who = 'me';
    const cur = ps.find(p => p.id === who), live = ps.filter(p => p.st !== 'r').length, canAdd = open && t.maxPeople > live, set = {}, names = {};
    ps.forEach(p => { if (p.seat && p.st === 'a') { set[p.seat] = true; names[p.seat] = p.guest ? p.name : 'أنا'; } });
    const lab = p => p.st === 'p' ? '⏳ بانتظار الموافقة' : p.st === 'r' ? '✖ مرفوض' : (p.seat ? 'مقعد ' + p.seat : 'بدون مقعد');
    const chips = ps.map(p => `<div class="pc"><button type="button" class="pchip${p.id === who ? ' on' : ''}${p.st === 'p' ? ' lock' : ''}${p.st === 'r' ? ' rej' : ''}" data-who="${esc(p.id)}"><b>${esc(p.guest ? pShort(p.name) : 'أنا')}</b><small>${lab(p)}</small></button>${p.guest && open ? `<button type="button" class="gx" data-rg="${esc(p.id)}" title="حذف الضيف">×</button>` : ''}</div>`).join('');
    const pending = ps.filter(p => p.st === 'p').length;
    const act = !open ? '<div class="notice warn">الحجز مغلق حاليًا. تقدر تشوف المقاعد بس.</div>'
      : `<div class="row" style="justify-content:center;margin-top:8px">${sel && sel !== cur.seat ? `<button class="btn gold" data-do="take">${cur.seat ? 'نقل ' : 'احجز المقعد ' + sel + ' لـ '}${cur.seat ? esc(cur.guest ? pShort(cur.name) : 'مقعدي') + ' إلى المقعد ' + sel : esc(cur.guest ? pShort(cur.name) : 'نفسي')}</button>` : ''}${cur.seat ? `<button class="btn" data-do="release">إلغاء مقعد ${esc(cur.guest ? pShort(cur.name) : 'حجزي')}</button>` : ''}</div>`;
    const add = canAdd ? `<div class="gform" data-addform>${guestFieldsHTML(false)}<button type="button" class="btn sm pri" data-addg>➕ إضافة ضيف</button></div>` : '';
    const cap = t.maxPeople > 1 ? `<div class="hint">الأشخاص: ${live} من ${t.maxPeople} (بما فيهم حضرتك)${canAdd ? ' — الضيف الجديد بيحتاج موافقة الإدارة قبل ما يتحجز له مقعد.' : ''}</div>` : '';
    body.innerHTML = `<div style="text-align:center"><b>${esc(t.title)}</b><div class="hint">${esc(pDate(t.tripDate))}${t.tripTime ? ' · ' + esc(t.tripTime) : ''}</div>
      ${t.maxPeople > 1 || ps.length > 1 ? `<div class="party">${chips}</div>${cap}${pending ? `<div class="notice warn" style="margin:6px 0">⏳ ${pending} ضيف بانتظار موافقة الإدارة — هتقدر تحجز له أول ما يتوافق عليه.</div>` : ''}${add}` : ''}
      ${open ? `<div class="hint">${ps.filter(p => p.st === 'a').length > 1 ? 'اختار الشخص فوق، وبعدين اضغط على مقعد أخضر واضغط «احجز».' : 'اضغط على مقعد أخضر، وبعدين اضغط «احجز».'}</div>` : ''}${BUS_LEGEND}${busHTML(st.layout, { mode: 'pick', occupied: st.occupied, mine: cur.seat, mineSet: set, sel, names })}${act}</div>`;
    applyDraft(body, draft);
  };
  const refresh = async force => {
    if (busy) return; busy = true;
    const r = await mcall('tripSeats', { tripId, v: force ? '' : v }); busy = false;
    if (!m.el.isConnected) return;
    if (!r.ok) { body.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
    if (r.same) return;
    v = r.v; st = r;
    if (sel && st.occupied && st.occupied[sel]) { sel = 0; toast('المقعد اللي اخترته اتحجز لشخص تاني', 'err'); }
    draw();
  };
  body.onclick = async e => {
    if (!st) return;
    const chip = e.target.closest('[data-who]');
    if (chip) {
      const p = persons().find(x => x.id === chip.dataset.who);
      if (p && p.st !== 'a') return toast(p.st === 'p' ? 'الإدارة لسه ما وافقتش على «' + p.name + '». هتقدر تحجز له بعد الموافقة.' : '«' + p.name + '» الإدارة رفضته، فمينفعش يتحجز له.', 'err');
      who = chip.dataset.who; sel = 0; return draw();
    }
    const rg = e.target.closest('[data-rg]');
    if (rg) {
      const g = (st.my.guests || []).find(x => x.id === rg.dataset.rg); if (!g || busy) return;
      if (!await ask({ title: 'حذف ضيف', msg: `حذف «${g.name}» من حجزك؟${g.seat ? ' مقعده (' + g.seat + ') هيتحرر.' : ''}`, okText: 'حذف' })) return;
      busy = true; const r = await mcall('tripGuestRemove', { tripId, guestId: g.id }); busy = false;
      if (!r.ok) toast(r.error, 'err'); else { toast('تم حذف الضيف', 'ok'); PM.dirty = true; if (who === g.id) who = 'me'; }
      return refresh(true);
    }
    if (e.target.closest('[data-addg]')) {
      const g = readGuestFields(body.querySelector('[data-addform]'), false);
      if (g.error) return toast(g.error, 'err');
      if (busy) return; busy = true; const r = await mcall('tripGuestAdd', { tripId, name: g.name, phone: g.phone }); busy = false;
      if (!r.ok) return toast(r.error, 'err');
      ['name', 'phone'].forEach(k => delete draft[k]); PM.dirty = true; toast('تمت إضافة الضيف — بانتظار موافقة الإدارة', 'ok'); return refresh(true);
    }
    const c = e.target.closest('.bus .c.S.free');
    if (c && st.trip.status === 'open') { const n = +c.dataset.n; sel = sel === n ? 0 : n; return draw(); }
    const d = e.target.closest('[data-do]'); if (!d || busy) return;
    d.disabled = true; busy = true;
    const r = d.dataset.do === 'take' ? await mcall('tripSelectSeat', { tripId, seat: sel, who }) : await mcall('tripReleaseSeat', { tripId, who });
    busy = false;
    if (!r.ok) toast(r.error, 'err'); else { toast(d.dataset.do === 'take' ? 'تم حجز المقعد ✔' : 'تم إلغاء الحجز', 'ok'); PM.dirty = true; }
    sel = 0; refresh(true);
  };
  timer = setInterval(() => { if (!document.hidden && m.el.isConnected) refresh(false); }, 15000);
  refresh(true);
}

/* ---------- حسابي ---------- */
function renderAccount() {
  const box = $('#memAcct');
  box.innerHTML = `<div class="sec"><h3>تغيير كلمة المرور</h3>
    <form id="mpwForm" novalidate>
      <div class="field"><label>كلمة المرور الحالية ${PM.mustChange ? '(رقم الواتساب)' : ''}</label><input id="mpOld" type="password" dir="ltr" autocomplete="current-password"></div>
      <div class="field"><label>كلمة المرور الجديدة (6 أحرف على الأقل)</label><input id="mpNew" type="password" dir="ltr" autocomplete="new-password"></div>
      <div class="field"><label>تأكيد كلمة المرور الجديدة</label><input id="mpNew2" type="password" dir="ltr" autocomplete="new-password"></div>
      <label class="chk"><input type="checkbox" id="mpShow"> إظهار كلمات المرور</label>
      <div class="formerr" id="mpErr" hidden></div>
      <button class="btn pri" type="submit" id="mpBtn">💾 حفظ كلمة المرور</button>
    </form></div>
    <div id="memCardBox"><p class="lead" style="text-align:center"><span class="spin"></span> جاري تجهيز الكارت...</p></div>`;
  $('#mpShow').onchange = e => ['mpOld', 'mpNew', 'mpNew2'].forEach(id => $('#' + id).type = e.target.checked ? 'text' : 'password');
  $('#mpwForm').onsubmit = async e => {
    e.preventDefault(); showErr('#mpErr', '');
    const o = $('#mpOld').value, n = $('#mpNew').value, n2 = $('#mpNew2').value;
    if (!o) return showErr('#mpErr', 'اكتب كلمة المرور الحالية.');
    if (n.length < 6) return showErr('#mpErr', 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.');
    if (n === o) return showErr('#mpErr', 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.');
    if (n !== n2) return showErr('#mpErr', 'تأكيد كلمة المرور غير مطابق.');
    const b = $('#mpBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
    const r = await mcall('memberChangePassword', { oldPassword: o, newPassword: n }, 60000);
    b.disabled = false; b.textContent = '💾 حفظ كلمة المرور';
    if (!r.ok) return showErr('#mpErr', r.error);
    mSave(r.token); PM.mustChange = false; paintWho(); toast('تم تغيير كلمة المرور ✔', 'ok'); renderAccount();
  };
  loadMemberCard();
}
async function loadMemberCard() {
  const host = $('#memCardBox'); if (!host) return;
  const r = await mcall('memberMe', { card: true }, 60000);
  if (!host.isConnected) return;
  if (!r.ok) { host.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  paintCard(host, { name: r.card.name, code: r.card.code, photo: r.card.photo, why: r.card.why }, loadMemberCard);
}

/* =====================================================================
   الأدمن: الأخبار
   ===================================================================== */
async function loadNewsAdmin() {
  const box = $('#admNews'); box.innerHTML = pSpin;
  const r = await adm('newsAdminList');
  if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  PA.news = r.items; renderNewsAdmin();
}
function renderNewsAdmin() {
  const box = $('#admNews');
  box.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn ok" data-n="new">➕ خبر جديد</button></div>` +
    (PA.news.length ? PA.news.map(n => `<div class="post${n.pinned ? ' pin' : ''}" data-id="${esc(n.id)}">
      <div class="row" style="justify-content:space-between"><h4>${n.pinned ? '📌 ' : ''}${esc(n.title)}</h4>${n.published ? '<span class="badge o">منشور</span>' : '<span class="badge g">مسودة</span>'}</div>
      <div class="meta">${esc((n.createdAt || '').slice(0, 16))} · ${esc(n.createdBy || '')}${n.imgCount ? ' · 🖼️ ' + n.imgCount : ''}</div>
      ${n.body ? `<div class="body" style="max-height:4.8em;overflow:hidden">${esc(n.body)}</div>` : ''}
      <div class="acts" style="margin-top:8px"><button class="btn sm" data-n="edit">✎ تعديل</button><button class="btn sm" data-n="pin">${n.pinned ? 'إلغاء التثبيت' : '📌 تثبيت'}</button><button class="btn sm" data-n="pub">${n.published ? '🙈 إخفاء' : '👁 نشر'}</button><button class="btn sm bad" data-n="del">🗑 حذف</button></div></div>`).join('')
      : '<div class="empty">مفيش أخبار. اضغط «خبر جديد».</div>');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('#admNews [data-n]'); if (!b) return;
  const card = b.closest('.post'), n = card ? PA.news.find(x => x.id === card.dataset.id) : null, act = b.dataset.n;
  if (act === 'new') return openNewsEditor(null);
  if (!n) return;
  if (act === 'edit') return openNewsEditor(n);
  if (act === 'del') {
    if (!await ask({ title: 'حذف الخبر', msg: `حذف «${n.title}»؟ هيتنقل لسلة المحذوفات (وصوره بتفضل محفوظة).`, okText: 'حذف' })) return;
    const r = await adm('newsDelete', { id: n.id }); if (r.ok) { PA.news = r.items; renderNewsAdmin(); toast('تم الحذف (في سلة المحذوفات)', 'ok'); refreshTrashCount(); } else toast(r.error, 'err');
  } else {
    const r = await adm('newsSave', { id: n.id, title: n.title, body: n.body, pinned: act === 'pin' ? !n.pinned : n.pinned, published: act === 'pub' ? !n.published : n.published, keep: Array.from({ length: n.imgCount }, (_, i) => i) });
    if (r.ok) { PA.news = r.items; renderNewsAdmin(); } else toast(r.error, 'err');
  }
});

function openNewsEditor(n) {
  const ed = { keep: [], add: [] };                          // keep: {i, src}  add: dataUrl
  const m = pModal(n ? 'تعديل الخبر' : 'خبر جديد', `
    <div class="field"><label>العنوان *</label><input data-e="title" maxlength="120"></div>
    <div class="field"><label>النص</label><textarea data-e="body" rows="6" maxlength="4000" placeholder="اكتب الخبر..."></textarea></div>
    <div class="field"><label>الصور (حتى 4)</label><div class="nimgs" data-e="imgs"></div><input type="file" accept="image/*" multiple hidden data-e="file"></div>
    <label class="chk"><input type="checkbox" data-e="pinned"> 📌 تثبيت في أول الأخبار</label>
    <label class="chk"><input type="checkbox" data-e="published"> 👁 منشور للأعضاء (لو مش معلّم يتحفظ كمسودة)</label>
    <div class="formerr" data-e="err" hidden></div>`,
    '<button class="btn pri" data-e="save">💾 حفظ</button><button class="btn" data-e="cancel">إلغاء</button>', { tag: 'admin' });
  const e = k => m.q(`[data-e="${k}"]`);
  e('title').value = n ? n.title : ''; e('body').value = n ? n.body : ''; e('pinned').checked = n ? n.pinned : false; e('published').checked = n ? n.published : true;
  const paint = () => {
    const tot = ed.keep.length + ed.add.length;
    e('imgs').innerHTML = ed.keep.map((k, j) => `<div class="ni">${k.src ? `<img src="${k.src}" alt="">` : '⏳'}<button type="button" data-rk="${j}">×</button></div>`).join('') +
      ed.add.map((s, j) => `<div class="ni"><img src="${s}" alt=""><button type="button" data-ra="${j}">×</button></div>`).join('') +
      (tot < 4 ? '<button type="button" class="ni add" data-addimg>+</button>' : '');
  };
  if (n) for (let i = 0; i < n.imgCount; i++) { const k = { i, src: '' }; ed.keep.push(k); adm('newsImage', { id: n.id, i }, 60000).then(r => { if (r.ok) { k.src = r.image; if (m.el.isConnected) paint(); } }); }
  paint();
  e('imgs').onclick = ev => {
    const bk = ev.target.closest('[data-rk]'), ba = ev.target.closest('[data-ra]');
    if (bk) { ed.keep.splice(+bk.dataset.rk, 1); paint(); } else if (ba) { ed.add.splice(+ba.dataset.ra, 1); paint(); } else if (ev.target.closest('[data-addimg]')) e('file').click();
  };
  e('file').onchange = async ev => {
    const files = Array.from(ev.target.files); ev.target.value = '';
    for (const f of files) {
      if (ed.keep.length + ed.add.length >= 4) { toast('أقصى عدد صور 4', 'err'); break; }
      try { ed.add.push(resizeToJpeg(await loadBitmap(f), 1000, 0.75)); } catch (x) { toast('تعذر قراءة صورة', 'err'); }
    }
    paint();
  };
  e('cancel').onclick = m.close;
  e('save').onclick = async () => {
    const title = e('title').value.trim(), err = e('err'); err.hidden = true;
    if (!title) { err.textContent = 'اكتب عنوان الخبر.'; err.hidden = false; return; }
    const b = e('save'); b.disabled = true; b.innerHTML = '<span class="spin"></span> جاري الحفظ...';
    const r = await adm('newsSave', { id: n ? n.id : undefined, title, body: e('body').value, pinned: e('pinned').checked, published: e('published').checked, keep: ed.keep.map(k => k.i), add: ed.add }, 180000);
    b.disabled = false; b.textContent = '💾 حفظ';
    if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
    PA.news = r.items; renderNewsAdmin(); m.close(); toast('تم حفظ الخبر ✔', 'ok');
  };
}

/* =====================================================================
   الأدمن: الرحلات
   ===================================================================== */
const TRIP_ST = { draft: ['مسودة', 'g'], open: ['مفتوحة للحجز', 'o'], closed: ['مغلقة', 'p'] };
async function loadTripsAdmin() {
  const box = $('#admTrips'); box.innerHTML = pSpin;
  const r = await adm('tripAdminList');
  if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  PA.trips = r.items; renderTripsAdmin();
}
function renderTripsAdmin() {
  $('#admTrips').innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn ok" data-t="new">➕ رحلة جديدة</button></div>` +
    (PA.trips.length ? PA.trips.map(t => { const s = TRIP_ST[t.status] || ['', 'g'];
      return `<div class="trip" data-id="${esc(t.id)}"><div class="row" style="justify-content:space-between"><h4>🚌 ${esc(t.title)}</h4><span class="badge ${s[1]}">${s[0]}</span></div>
      <div class="tmeta"><span>📅 ${esc(pDate(t.tripDate))}${t.tripTime ? ' · ' + esc(t.tripTime) : ''}</span>${t.place ? `<span>📍 ${esc(t.place)}</span>` : ''}<span>👥 ${t.maxPeople > 1 ? 'لحد ' + t.maxPeople + ' أشخاص لكل عضو' : 'مقعد واحد لكل عضو'}</span>${t.poster ? '<span>🖼️ ليها بوستر</span>' : ''}</div>
      <div class="tmeta"><span>🕓 طلبات جديدة: <b>${t.requested}</b></span><span>✔ مقبولين: <b>${t.accepted}</b></span>${t.guestsCount ? `<span>➕ ضيوف: <b>${t.guestsCount}</b></span>` : ''}${t.pendingGuests ? `<span class="badge p">⏳ ضيوف بانتظار موافقتك: ${t.pendingGuests}</span>` : ''}<span>💺 محجوز: <b>${t.seatsTaken}</b> / ${t.seatsTotal}</span></div>
      <div class="acts"><button class="btn sm pri" data-t="open">📋 إدارة الرحلة</button><button class="btn sm" data-t="edit">✎ تعديل</button></div></div>`; }).join('')
      : '<div class="empty">مفيش رحلات. اضغط «رحلة جديدة».</div>');
}
document.addEventListener('click', e => {
  const b = e.target.closest('#admTrips [data-t]'); if (!b) return;
  const card = b.closest('.trip'), id = card && card.dataset.id;
  if (b.dataset.t === 'new') openTripEditor(null, loadTripsAdmin); else if (b.dataset.t === 'edit') openTripEditor(id, loadTripsAdmin); else if (b.dataset.t === 'open') openTripAdmin(id);
});

// onSaved: بتتنادى بعد الحفظ (عشان نحدّث القايمة أو نافذة الإدارة)
async function openTripEditor(id, onSaved) {
  let t = null;
  if (id) { const r = await adm('tripAdminGet', { id }); if (!r.ok) return toast(r.error, 'err'); t = r.trip; }
  const m = pModal(t ? 'تعديل الرحلة' : 'رحلة جديدة', `
    <div class="grid2"><div class="field"><label>اسم الرحلة *</label><input data-e="title" maxlength="120"></div>
      <div class="field"><label>الحالة</label><select data-e="status"><option value="draft">مسودة (مخفية عن الأعضاء)</option><option value="open">مفتوحة للحجز</option><option value="closed">مغلقة (عرض فقط)</option></select></div></div>
    <div class="grid2"><div class="field"><label>التاريخ *</label><input type="date" data-e="tripDate" dir="ltr"></div><div class="field"><label>الوقت</label><input type="time" data-e="tripTime" dir="ltr"></div></div>
    <div class="grid2"><div class="field"><label>مكان التجمع</label><input data-e="place" maxlength="120"></div><div class="field"><label>السعر / ملاحظة</label><input data-e="price" maxlength="60" placeholder="مثال: 150 جنيه"></div></div>
    <div class="field"><label>تفاصيل الرحلة</label><textarea data-e="description" rows="3" maxlength="1500"></textarea></div>
    <div class="field"><label>🖼️ بوستر الرحلة (اختياري)</label>
      <div class="pedit"><div class="pv" data-e="pv">مفيش بوستر</div>
        <div class="pb"><button type="button" class="btn sm" data-e="pPick">📁 اختيار صورة</button><button type="button" class="btn sm bad" data-e="pClear" hidden>🗑 إزالة البوستر</button></div>
        <input type="file" accept="image/*" hidden data-e="pFile"></div>
      <small class="hint">بيظهر فوق كارت الرحلة للأعضاء. الصورة بتتصغّر تلقائيًا قبل الرفع، ولو شلته أو بدّلته الصورة القديمة بتفضل محفوظة في Drive.</small></div>
    <div class="field"><label>👥 عدد الأشخاص المسموح للعضو الواحد يحجز لهم</label><select data-e="maxPeople">${maxPeopleOptions()}</select>
      <small class="hint">لو اخترت أكتر من 1: العضو لازم يحدد ضيوفه (اسم + تليفون) وقت طلب الاشتراك، وأنت بتوافق على كل ضيف قبل ما يقدر يحجز له مقعد. الحد ده ما يتخطّاش.</small></div>
    <label class="chk"><input type="checkbox" data-e="useCode"> 🔑 الدخول لاختيار المقعد بكود من 4 خانات (بيتولّد لما تقبل اشتراك الشخص وبتبعته له)</label>
    <h4 style="margin:12px 0 4px;color:var(--brown)">شكل الأتوبيس</h4><div data-e="bus"></div>
    <div class="formerr" data-e="err" hidden></div>`,
    '<button class="btn pri" data-e="save">💾 حفظ الرحلة</button><button class="btn" data-e="cancel">إلغاء</button>', { tag: 'admin' });
  const e = k => m.q(`[data-e="${k}"]`);
  e('title').value = t ? t.title : ''; e('status').value = t ? t.status : 'draft'; e('tripDate').value = t ? t.tripDate : ''; e('tripTime').value = t ? t.tripTime : '';
  e('place').value = t ? t.place : ''; e('price').value = t ? t.price : ''; e('description').value = t ? t.description : ''; e('useCode').checked = t ? t.useCode : true;
  e('maxPeople').value = String(t ? t.maxPeople : 1);
  /* ---- البوستر: جديد (posterData) / إزالة (removePoster) / الحالي (hasPoster) ---- */
  const P = { data: null, remove: false, has: !!(t && t.poster) };
  const paintPoster = src => {
    const pv = e('pv');
    if (src) { pv.innerHTML = `<img src="${src}" alt="بوستر">`; pv.querySelector('img').onclick = () => { $('#lbImg').src = src; $('#lightbox').hidden = false; }; }
    else pv.textContent = P.has && !P.remove ? '⏳' : 'مفيش بوستر';
    e('pClear').hidden = !(P.data || (P.has && !P.remove));
    e('pPick').textContent = P.data || (P.has && !P.remove) ? '📁 تغيير الصورة' : '📁 اختيار صورة';
  };
  paintPoster(null);
  if (P.has) adm('tripPoster', { id: t.id }, 60000).then(r => { if (!m.el.isConnected || P.data || P.remove) return; if (r.ok) paintPoster(r.image); else e('pv').textContent = 'تعذر تحميل البوستر الحالي'; });
  e('pPick').onclick = () => e('pFile').click();
  e('pFile').onchange = async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try {
      const bmp = await loadBitmap(f); let url = resizeToJpeg(bmp, 1200, 0.8);
      if (url.length * 0.75 > 1400000) url = resizeToJpeg(bmp, 900, 0.65);               // لو لسه كبيرة نصغّرها أكتر
      if (url.length * 0.75 > 1400000) return toast('الصورة كبيرة جدًا حتى بعد التصغير. جرّب صورة تانية.', 'err');
      P.data = url; P.remove = false; paintPoster(url);
    } catch (x) { toast('تعذر قراءة الصورة. جرّب صورة تانية.', 'err'); }
  };
  e('pClear').onclick = () => { P.data = null; P.remove = P.has; paintPoster(null); e('pv').textContent = 'مفيش بوستر'; e('pClear').hidden = true; e('pPick').textContent = '📁 اختيار صورة'; };
  const bus = BusEditor(e('bus'), t && t.layout ? { cells: t.layout.cells, nums: t.layout.nums, locked: t.locked } : null);
  e('cancel').onclick = m.close;
  e('save').onclick = async () => {
    const err = e('err'); err.hidden = true;
    const body = { id: t ? t.id : undefined, title: e('title').value.trim(), status: e('status').value, tripDate: e('tripDate').value, tripTime: e('tripTime').value,
      place: e('place').value.trim(), price: e('price').value.trim(), description: e('description').value, useCode: e('useCode').checked, maxPeople: +e('maxPeople').value, layout: bus.getLayout() };
    if (P.data) body.poster = P.data; else if (P.remove) body.removePoster = true;
    if (!body.title) { err.textContent = 'اكتب اسم الرحلة.'; err.hidden = false; return; }
    if (!body.tripDate) { err.textContent = 'اختر تاريخ الرحلة.'; err.hidden = false; return; }
    const b = e('save'); b.disabled = true; b.innerHTML = '<span class="spin"></span>';
    const r = await adm('tripSave', body, 120000);
    b.disabled = false; b.textContent = '💾 حفظ الرحلة';
    if (!r.ok) { err.textContent = r.error; err.hidden = false; err.scrollIntoView({ block: 'center' }); return; }
    m.close(); toast('تم حفظ الرحلة ✔', 'ok'); if (onSaved) onSaved();
  };
}

const BK_ST = { requested: ['طلب جديد', 'p'], accepted: ['مقبول', 'o'], rejected: ['مرفوض', 'n'], cancelled: ['ملغي', 'g'] };
// نافذة إدارة رحلة: الطلبات + أكواد الرحلة + الضيوف (موافقة/رفض) + خريطة الأتوبيس بأسماء الركاب
async function openTripAdmin(id) {
  const m = pModal('إدارة الرحلة', pSpin, '', { tag: 'admin' });
  const body = m.q('.bd'); let D = null;
  const load = async () => { const r = await adm('tripAdminGet', { id }); if (!r.ok) { body.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return false; } D = r; draw(); return true; };
  const act = async (action, payload, okMsg) => { const r = await adm(action, payload, 60000); if (!r.ok) toast(r.error, 'err'); else if (okMsg) toast(okMsg, 'ok'); await load(); loadTripsAdmin(); };
  const draw = () => {
    const t = D.trip, L = t.layout, B = D.bookings, s = TRIP_ST[t.status] || ['', 'g'];
    const occ = {}, names = {}, byNum = {}; let people = 0, pendingAll = 0;
    B.forEach(b => {
      if (b.status === 'accepted' || b.status === 'requested') b.guests.forEach(g => { if (gstOf(g) === 'p') pendingAll++; });
      if (b.status !== 'accepted') return; people += 1 + b.guests.filter(g => gstOf(g) === 'a').length;
      if (b.seat) { occ[b.seat] = 1; names[b.seat] = b.name; byNum[b.seat] = { bid: b.id, who: 'me', name: b.name }; }
      b.guests.forEach(g => { if (g.seat && gstOf(g) === 'a') { occ[g.seat] = 1; names[g.seat] = g.name + ' (ضيف ' + pShort(b.name) + ')'; byNum[g.seat] = { bid: b.id, who: g.id, name: g.name }; } });
    });
    const seatsOpts = cur => { const o = ['<option value="0">— بدون مقعد —</option>']; L.cells.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const ch = row.charAt(c), n = L.nums[r][c];
      if ((ch === 'S' || ch === 'X') && n) o.push(`<option value="${n}"${n === cur ? ' selected' : ''}${occ[n] && n !== cur ? ' disabled' : ''}>مقعد ${n}${ch === 'X' ? ' (غير متاح للأعضاء)' : ''}${occ[n] && n !== cur ? ' - ' + esc(pShort(names[n])) : ''}</option>`); } }); return o.join(''); };
    const rows = B.map(b => { const st = BK_ST[b.status] || ['', 'g'], live = b.status === 'requested' || b.status === 'accepted', pend = b.guests.filter(g => gstOf(g) === 'p').length;
      const wa = 'https://wa.me/2' + b.whatsapp + '?text=' + encodeURIComponent(`سلام ونعمة ${b.name.split(' ')[0]} 🙏\nتم قبول اشتراكك في رحلة «${t.title}» (${t.tripDate}).\nكود الرحلة الخاص بيك: ${b.tripCode}\nادخل موقع الأعضاء ← الرحلات ← اكتب الكود واختار مقعدك${t.maxPeople > 1 ? ' (وتقدر تحجز لضيوفك اللي اتوافق عليهم)' : ''}.`);
      const canAddG = t.maxPeople > 1 && guestsLive(b.guests).length + 1 < t.maxPeople;
      let a = '';
      if (b.status === 'requested') a = `<button class="btn sm ok" data-d="accept">✔ قبول</button>${pend ? '<button class="btn sm ok" data-d="acceptg">✔ قبول مع الضيوف</button>' : ''}<button class="btn sm bad" data-d="reject">✖ رفض</button>${canAddG ? '<button class="btn sm" data-d="addg">➕ ضيف</button>' : ''}`;
      else if (b.status === 'accepted') a = `${b.tripCode ? `<a class="btn sm wa" style="text-decoration:none" target="_blank" rel="noopener" href="${wa}">📲 إرسال الكود</a>` : ''}${canAddG ? '<button class="btn sm" data-d="addg">➕ ضيف</button>' : ''}<button class="btn sm" data-d="cancel">إلغاء</button>`;
      else a = `<button class="btn sm ok" data-d="accept">✔ قبول</button>`;
      const main = `<tr data-b="${esc(b.id)}"><td><b>${esc(b.name)}</b><br><small class="ltr" style="display:inline-block">${esc(b.code)} · ${esc(b.whatsapp)}</small>${b.note ? `<br><small style="color:var(--bad)">${esc(b.note)}</small>` : ''}${pend ? `<br><span class="badge p">⏳ ${pend} ضيف بانتظار موافقتك</span>` : ''}</td>
        <td><span class="badge ${st[1]}">${st[0]}</span>${b.status === 'accepted' && t.useCode ? `<br><b class="ltr" style="display:inline-block;letter-spacing:2px">${esc(b.tripCode)}</b><br><small>${b.verified ? '✔ دخل بالكود' : 'لسه ما دخلش'}</small>` : ''}</td>
        <td>${b.status === 'accepted' ? `<select data-seat style="min-width:120px">${seatsOpts(b.seat)}</select>` : '—'}</td><td><div class="acts">${a}</div></td></tr>`;
      const gr = live ? b.guests.map(g => { const gs = gstOf(g);
        const seatCell = gs === 'a' && b.status === 'accepted' ? `<select data-seat style="min-width:120px">${seatsOpts(g.seat)}</select>` : '—';
        const ga = gs === 'p' ? '<button class="btn sm ok" data-d="gok">✔ موافقة</button><button class="btn sm bad" data-d="grej">✖ رفض</button>'
          : gs === 'a' ? '<button class="btn sm" data-d="grej">✖ رفض</button><button class="btn sm bad" data-d="rg">🗑</button>'
          : '<button class="btn sm ok" data-d="gok">✔ موافقة</button><button class="btn sm bad" data-d="rg">🗑</button>';
        return `<tr class="grow${gs === 'p' ? ' pend' : ''}" data-b="${esc(b.id)}" data-g="${esc(g.id)}"><td>↳ <b>${esc(g.name)}</b><br><small class="ltr" style="display:inline-block">📞 ${esc(g.phone || '—')}</small><br><small style="color:var(--mut)">ضيف ${esc(pShort(b.name))}</small>${gs === 'r' && g.note ? `<br><small style="color:var(--bad)">${esc(g.note)}</small>` : ''}</td>
          <td>${gstBadge(g)}</td><td>${seatCell}</td><td><div class="acts">${ga}</div></td></tr>`; }).join('') : '';
      return main + gr; }).join('');
    body.innerHTML = `<div class="row" style="justify-content:space-between"><div><b>${esc(t.title)}</b> <span class="badge ${s[1]}">${s[0]}</span><div class="hint">${esc(pDate(t.tripDate))}${t.tripTime ? ' · ' + esc(t.tripTime) : ''}${t.place ? ' · ' + esc(t.place) : ''} · المقاعد: ${Object.keys(occ).length}/${t.seatsTotal} · الأشخاص: ${people}${t.maxPeople > 1 ? ' · الحد لكل عضو: ' + t.maxPeople : ''}</div></div>
      <div class="acts"><button class="btn sm" data-t2="edit">✎ تعديل الرحلة</button><button class="btn sm" data-t2="xls">⬇ Excel</button><button class="btn sm bad" data-t2="del">🗑 حذف الرحلة</button></div></div>
      ${pendingAll ? `<div class="notice warn" style="margin-top:8px">⏳ فيه <b>${pendingAll}</b> ضيف بانتظار موافقتك (الصفوف المظلّلة في الجدول). الضيف ما يقدرش يتحجز له مقعد غير بعد موافقتك.</div>` : ''}
      <h4 style="margin:12px 0 4px;color:var(--brown)">🚌 خريطة الأتوبيس <small class="hint" style="display:inline">(اضغط على مقعد محجوز لتحريره)</small></h4>
      <div style="text-align:center">${BUS_LEGEND}${busHTML(L, { mode: 'admin', occupied: occ, names })}</div>
      <h4 style="margin:14px 0 4px;color:var(--brown)">👥 المشتركين والطلبات (${B.length})</h4>
      <div class="row" style="margin-bottom:8px"><input data-addcode inputmode="numeric" maxlength="7" dir="ltr" placeholder="كود العضو (7 أرقام) لإضافته مباشرة" style="flex:1;min-width:200px"><button class="btn sm ok" data-t2="add">➕ إضافة عضو</button></div>
      <div class="tbl-wrap" style="max-height:50vh"><table class="tblB"><thead><tr><th>العضو / الضيف</th><th>الحالة / الكود</th><th>المقعد</th><th>إجراءات</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">مفيش طلبات لسه</td></tr>'}</tbody></table></div>`;
    m._D = { occ, byNum };
  };
  body.addEventListener('change', async e => {
    const sel = e.target.closest('[data-seat]'); if (!sel) return;
    const tr = sel.closest('tr');
    await act('tripAssignSeat', { id: tr.dataset.b, who: tr.dataset.g || 'me', seat: +sel.value }, 'تم');
  });
  body.addEventListener('click', async e => {
    const seat = e.target.closest('.bus.adm .c.taken');
    if (seat) { const b = m._D.byNum[+seat.dataset.n]; if (b && await ask({ title: 'تحرير المقعد ' + seat.dataset.n, msg: `المقعد محجوز لـ ${b.name}. تحريره؟`, okText: 'تحرير' })) act('tripAssignSeat', { id: b.bid, who: b.who, seat: 0 }, 'تم تحرير المقعد'); return; }
    const d = e.target.closest('[data-d]');
    if (d) {
      const tr = d.closest('tr'), bid = tr.dataset.b, kind = d.dataset.d, gid = tr.dataset.g;
      if (kind === 'addg') { const g = await askGuest(false); if (!g) return; return act('tripAdminGuestAdd', { id: bid, name: g.name, phone: g.phone }, 'تمت إضافة الضيف (موافق عليه)'); }
      if (kind === 'gok') return act('tripAdminGuestDecide', { id: bid, guestId: gid, decision: 'approve' }, 'تمت الموافقة على الضيف');
      if (kind === 'grej') { const reason = await ask({ title: 'رفض الضيف', msg: 'سبب الرفض (هيظهر للعضو):', input: true, okText: 'رفض' }); if (!reason) return; return act('tripAdminGuestDecide', { id: bid, guestId: gid, decision: 'reject', reason }, 'تم رفض الضيف'); }
      if (kind === 'rg') { if (!await ask({ title: 'حذف ضيف', msg: 'حذف الضيف وتحرير مقعده؟', okText: 'حذف' })) return; return act('tripAdminGuestRemove', { id: bid, guestId: gid }, 'تم حذف الضيف'); }
      if (kind === 'acceptg') return act('tripDecide', { id: bid, decision: 'accept', approveGuests: true }, 'تم القبول مع الضيوف — ابعت له الكود');
      if (kind === 'reject') { const reason = await ask({ title: 'رفض الاشتراك', msg: 'سبب الرفض (هيظهر للعضو):', input: true, okText: 'رفض' }); if (!reason) return; return act('tripDecide', { id: bid, decision: 'reject', reason }, 'تم الرفض'); }
      if (kind === 'cancel' && !await ask({ title: 'إلغاء الاشتراك', msg: 'إلغاء اشتراك الشخص وتحرير مقاعده ومقاعد ضيوفه؟', okText: 'إلغاء الاشتراك' })) return;
      return act('tripDecide', { id: bid, decision: kind }, kind === 'accept' ? 'تم القبول — ابعت له الكود (الضيوف لسه بانتظار موافقتك)' : 'تم');
    }
    const x = e.target.closest('[data-t2]'); if (!x) return;
    if (x.dataset.t2 === 'edit') return openTripEditor(id, () => { load(); loadTripsAdmin(); });
    if (x.dataset.t2 === 'del') { if (!await ask({ title: 'حذف الرحلة', msg: 'حذف الرحلة وحجوزاتها؟ هتتنقل لسلة المحذوفات.', okText: 'حذف' })) return; const r = await adm('tripDelete', { id }); if (r.ok) { m.close(); loadTripsAdmin(); toast('تم الحذف (في سلة المحذوفات)', 'ok'); refreshTrashCount(); } else toast(r.error, 'err'); return; }
    if (x.dataset.t2 === 'add') { const code = toEn(m.q('[data-addcode]').value).replace(/\D/g, ''); if (code.length !== 7) return toast('الكود 7 أرقام', 'err'); return act('tripAddMember', { tripId: id, code }, 'تمت الإضافة — ابعت له الكود'); }
    if (x.dataset.t2 === 'xls') {
      if (!window.XLSX) return toast('مكتبة Excel لم تُحمّل', 'err');
      const aoa = [['الاسم', 'النوع (عضو/ضيف)', 'صاحب الحجز', 'كود العضو', 'الواتساب / تليفون الضيف', 'حالة الحجز', 'موافقة الضيف', 'كود الرحلة', 'المقعد']];
      D.bookings.forEach(b => { const bs = (BK_ST[b.status] || [''])[0]; aoa.push([b.name, 'عضو', '', b.code, b.whatsapp, bs, '', b.tripCode || '', b.seat || '']); b.guests.forEach(g => aoa.push([g.name, 'ضيف', b.name, '', g.phone || '', bs, (GST[gstOf(g)] || [''])[0], '', g.seat || ''])); });
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'الرحلة'); XLSX.writeFile(wb, `trip_${D.trip.tripDate}.xlsx`);
    }
  });
  load();
}

/* =====================================================================
   سجل التدقيق (سوبر أدمن): مين عمل إيه ومتى وقيمة قبل/بعد
   ===================================================================== */
const AUD_ACT = {
  'registration.register': 'تسجيل جديد', 'registration.resubmit': 'إعادة تقديم', 'registration.update': 'تعديل بيانات تسجيل', 'registration.accept': 'قبول تسجيل',
  'registration.reject': 'رفض تسجيل', 'registration.delete': 'حذف تسجيل', 'admin.login': 'دخول أدمن', 'admin.create': 'إضافة أدمن', 'admin.delete': 'حذف أدمن',
  'admin.password.change': 'تغيير باسورد أدمن (ذاتي)', 'admin.password.reset': 'تغيير باسورد أدمن (بواسطة السوبر)', 'admin.super.set': 'تعيين سوبر أدمن',
  'member.password.change': 'تغيير باسورد عضو', 'member.password.reset': 'إرجاع باسورد عضو للواتساب', 'setting.registration': 'فتح/غلق التسجيل',
  'news.create': 'خبر جديد', 'news.update': 'تعديل خبر', 'news.delete': 'حذف خبر',
  'bustpl.create': 'حفظ نمط أتوبيس', 'bustpl.update': 'استبدال نمط أتوبيس', 'bustpl.delete': 'حذف نمط أتوبيس',
  'trip.create': 'رحلة جديدة', 'trip.update': 'تعديل رحلة', 'trip.delete': 'حذف رحلة', 'trip.join': 'طلب اشتراك في رحلة', 'trip.cancel': 'إلغاء اشتراك رحلة',
  'trip.verify': 'دخول بكود رحلة', 'trip.seat.select': 'اختيار مقعد رحلة', 'trip.seat.release': 'إلغاء مقعد رحلة', 'trip.seat.assign': 'تعيين مقعد رحلة (أدمن)',
  'trip.guest.add': 'إضافة ضيف لحجز رحلة', 'trip.guest.remove': 'حذف ضيف من حجز رحلة', 'trip.guest.approve': 'موافقة على ضيف رحلة', 'trip.guest.reject': 'رفض ضيف رحلة',
  'trip.decide.accept': 'قبول اشتراك رحلة', 'trip.decide.reject': 'رفض اشتراك رحلة', 'trip.decide.cancel': 'إلغاء اشتراك رحلة (أدمن)', 'trip.add': 'إضافة عضو لرحلة',
  'conf.create': 'مؤتمر جديد', 'conf.update': 'تعديل مؤتمر', 'conf.delete': 'حذف مؤتمر', 'conf.join': 'طلب اشتراك في مؤتمر', 'conf.cancel': 'إلغاء اشتراك مؤتمر',
  'conf.verify': 'دخول بكود مؤتمر', 'conf.seat.select': 'اختيار مقعد مؤتمر', 'conf.seat.release': 'إلغاء مقعد مؤتمر', 'conf.seat.assign': 'تعيين مقعد مؤتمر (أدمن)',
  'conf.guest.add': 'إضافة ضيف لحجز مؤتمر', 'conf.guest.remove': 'حذف ضيف من حجز مؤتمر', 'conf.guest.approve': 'موافقة على ضيف مؤتمر', 'conf.guest.reject': 'رفض ضيف مؤتمر',
  'conf.access': 'تحديد الغرف المسموحة لشخص',
  'conf.bed.select': 'اختيار سرير', 'conf.bed.release': 'إلغاء سرير', 'conf.bed.assign': 'تسكين (أدمن)', 'conf.decide.accept': 'قبول اشتراك مؤتمر',
  'conf.decide.reject': 'رفض اشتراك مؤتمر', 'conf.decide.cancel': 'إلغاء اشتراك مؤتمر (أدمن)', 'conf.add': 'إضافة عضو لمؤتمر',
  'trash.restore': 'استرجاع من سلة المحذوفات', 'system.migrate': 'ترحيل (من المحرر)'
};
const AUD_ENT = { registration: 'التسجيلات', member: 'الأعضاء (باسورد)', news: 'الأخبار', trip: 'الرحلات', tripBooking: 'حجوزات الرحلات', conference: 'المؤتمرات', confBooking: 'حجوزات المؤتمرات', busTemplate: 'أنماط الأتوبيس', admin: 'الأدمنز', setting: 'الإعدادات', system: 'النظام', memberAuth: 'باسورد عضو' };
const AUD_TYPE = { super: ['سوبر أدمن', 's'], admin: ['أدمن', 'p'], member: ['عضو', 'o'], public: ['زائر', 'g'], system: ['النظام', 'b'] };
const AUD_FIELD_BASE = {
  title: 'العنوان', body: 'النص', pinned: 'مثبّت', published: 'منشور', images: 'الصور', tripDate: 'التاريخ', tripTime: 'الوقت', place: 'المكان', price: 'السعر', description: 'التفاصيل',
  status: 'الحالة', useCode: 'الدخول بكود', useBus: 'أتوبيس', verified: 'دخل بالكود', seat: 'المقعد', bed: 'السرير', destination: 'الوجهة', dateFrom: 'من', dateTo: 'إلى', days: 'الأيام',
  nights: 'الليالي', rooms: 'الغرف', layout: 'الخريطة', open: 'التسجيل مفتوح', details: 'التفاصيل', profilePhoto: 'الصورة الشخصية', idPhoto: 'صورة البطاقة',
  maxPeople: 'حد الأشخاص لكل عضو', guests: 'الضيوف', poster: 'البوستر', roomAccess: 'الغرف المسموحة', name: 'الاسم', seats: 'عدد المقاعد'
};
let AUD_FIELD_ALL = null;                      // بيتبني وقت الاستخدام (EXPORT_COLS بيتعرّف في السكريبت الرئيسي اللي بيتحمّل بعد الملف ده)
function audField(k) {
  if (!AUD_FIELD_ALL) AUD_FIELD_ALL = Object.assign({}, Object.fromEntries(typeof EXPORT_COLS !== 'undefined' ? EXPORT_COLS : []), AUD_FIELD_BASE);
  return AUD_FIELD_ALL[k] || k;
}
function audLabel(a) { return AUD_ACT[a] || (a.indexOf('unaudited.') === 0 ? '⚠ تعديل من غير تفاصيل' : a); }
function audChanges(ch) {
  if (!ch) return '';
  return '<div class="chg">' + Object.keys(ch).map(k => { const o = ch[k][0], n = ch[k][1];
    return `<div><b>${esc(audField(k))}</b>: ${o !== '' ? `<s>${esc(o)}</s> ← ` : ''}<ins>${esc(n === '' ? '(فاضي)' : n)}</ins></div>`; }).join('') + '</div>';
}
function audCard(x) {
  const ty = AUD_TYPE[x.actorType] || [x.actorType, 'g'], danger = /delete|reject|unaudited/.test(x.action);
  return `<div class="aud${danger ? ' danger' : ''}" data-act="${esc(x.action)}"><div class="top"><span class="ltr">${esc(x.at)}</span><span class="badge ${ty[1]}">${ty[0]}</span><b>${esc(x.actorName || x.actor || '—')}</b>${x.actor && x.actor !== x.actorName ? `<span class="ltr">(${esc(x.actor)})</span>` : ''}</div>
    <h5>${esc(audLabel(x.action))}${x.label ? ' · <span style="font-weight:600">' + esc(x.label) + '</span>' : ''}</h5>${x.note ? `<div class="hint">${esc(x.note)}</div>` : ''}${audChanges(x.changes)}</div>`;
}
function audFilters() {
  return { q: $('#audQ').value.trim(), entity: $('#audEnt').value, actorType: $('#audType').value, from: $('#audFrom').value, to: $('#audTo').value };
}
async function loadAuditAdmin(more) {
  const box = $('#admAudit');
  if (!box.dataset.init) {
    box.dataset.init = '1';
    box.innerHTML = `<div class="notice info">كل تعديل في الموقع بيتسجّل هنا باسم اللي عمله (أدمن / عضو / زائر / النظام) وقيمة قبل وبعد. السجل ده للسوبر أدمن بس.</div>
      <div class="flt"><input id="audQ" placeholder="بحث: اسم / كود / عنوان / رقم قومي"><select id="audEnt"><option value="">كل الأقسام</option>${Object.keys(AUD_ENT).map(k => `<option value="${k}">${AUD_ENT[k]}</option>`).join('')}</select>
      <select id="audType"><option value="">كل الفاعلين</option>${Object.keys(AUD_TYPE).map(k => `<option value="${k}">${AUD_TYPE[k][0]}</option>`).join('')}</select>
      <input id="audFrom" type="date" dir="ltr" title="من تاريخ"><input id="audTo" type="date" dir="ltr" title="إلى تاريخ"><button class="btn pri" id="audGo">🔍 بحث</button><button class="btn" id="audXls">⬇ Excel</button></div>
      <div id="audList"></div><div id="audMore" style="text-align:center"></div>`;
    $('#audGo').onclick = () => loadAuditAdmin(false);
    $('#audQ').addEventListener('keydown', e => { if (e.key === 'Enter') loadAuditAdmin(false); });
    ['audEnt', 'audType', 'audFrom', 'audTo'].forEach(id => $('#' + id).onchange = () => loadAuditAdmin(false));
    $('#audMore').onclick = e => { if (e.target.closest('[data-more]')) loadAuditAdmin(true); };
    $('#audXls').onclick = () => {
      if (!window.XLSX) return toast('مكتبة Excel لم تُحمّل', 'err');
      const aoa = [['الوقت', 'الفاعل', 'نوعه', 'العملية', 'القسم', 'العنصر', 'التفاصيل', 'ملاحظة']].concat(PA.audit.items.map(x => [x.at, (x.actorName || '') + (x.actor ? ' (' + x.actor + ')' : ''), (AUD_TYPE[x.actorType] || [x.actorType])[0], audLabel(x.action), AUD_ENT[x.entity] || x.entity, x.label,
        x.changes ? Object.keys(x.changes).map(k => audField(k) + ': ' + x.changes[k][0] + ' ← ' + x.changes[k][1]).join(' | ') : '', x.note]));
      const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'سجل التدقيق'); XLSX.writeFile(wb, 'audit_log.xlsx');
    };
  }
  const list = $('#audList'), my = PA.auditSeq = (PA.auditSeq || 0) + 1;           // رقم الطلب: الرد القديم (فلتر اتغيّر بعده) بيتجاهل
  if (!more) { PA.audit = { items: [], hasMore: false }; list.innerHTML = pSpin; }
  const r = await adm('auditList', { ...audFilters(), offset: PA.audit.items.length, limit: 50 }, 60000);
  if (my !== PA.auditSeq) return;
  if (!r.ok) { list.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  PA.audit.items = PA.audit.items.concat(r.items); PA.audit.hasMore = r.hasMore;
  list.innerHTML = PA.audit.items.length ? PA.audit.items.map(audCard).join('') : '<div class="empty">مفيش عمليات مطابقة.</div>';
  $('#audMore').innerHTML = r.hasMore ? '<button class="btn" data-more>عرض المزيد</button>' : '';
}

/* =====================================================================
   سلة المحذوفات (سوبر أدمن): استرجاع بقيود (من غير تكرار) مع تنبيهات
   ===================================================================== */
const TRASH_KIND = { registration: ['👤', 'تسجيل'], news: ['📰', 'خبر'], trip: ['🚌', 'رحلة'], conference: ['🏨', 'مؤتمر'], admin: ['🔑', 'حساب أدمن'], memberAuth: ['🔒', 'باسورد عضو'], tripBooking: ['🎫', 'حجز رحلة'], confBooking: ['🎫', 'حجز مؤتمر'], busTemplate: ['🗺️', 'نمط أتوبيس'] };
const TRASH_CHILD = { memberAuth: 'باسورد', tripBooking: 'حجز رحلة', confBooking: 'حجز مؤتمر' };
async function loadTrashAdmin() {
  const box = $('#admTrash'); box.innerHTML = pSpin;
  const r = await adm('trashList', { status: PA.trashView }, 60000);
  if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
  setTrashCount(r.count);
  const view = PA.trashView;
  box.innerHTML = `<div class="notice info">أي حاجة بتتمسح بتنتقل هنا ومبتتمسحش نهائيًا. الاسترجاع بيرفض لو هيعمل تكرار (رقم قومي أو كود أو اسم+تاريخ أو يوزر أو اسم نمط)، وبيعرض تنبيهات لو اضطر يتخطى حاجة.</div>
    <div class="subtabs"><button data-tv="deleted" class="${view === 'deleted' ? 'on' : ''}">🗑 المحذوفات (${r.count})</button><button data-tv="restored" class="${view === 'restored' ? 'on' : ''}">♻️ اللي اترجّعت</button></div>
    <div id="trList">${r.items.length ? r.items.map(x => { const k = TRASH_KIND[x.kind] || ['📦', x.kind];
      const kids = Object.keys(x.children).map(c => `${x.children[c]} ${TRASH_CHILD[c] || c}`).join(' + ');
      return `<div class="aud" data-id="${esc(x.id)}"><div class="top"><span class="ltr">${esc(x.deletedAt)}</span><span class="badge n">${k[0]} ${k[1]}</span><span>حذفه: <b>${esc(x.deletedByName || x.deletedBy)}</b></span>${x.restoredAt ? `<span class="badge o">رجّعه ${esc(x.restoredBy)} · ${esc(x.restoredAt)}</span>` : ''}</div>
        <h5>${esc(x.label)}</h5>${kids ? `<div class="hint">معاه: ${esc(kids)}</div>` : ''}${view === 'deleted' ? '<div class="acts" style="margin-top:6px"><button class="btn sm ok" data-restore>♻️ استرجاع</button></div>' : ''}</div>`; }).join('')
      : `<div class="empty">${view === 'deleted' ? 'سلة المحذوفات فاضية 👍' : 'مفيش حاجة اترجّعت لسه.'}</div>`}</div>`;
  $$('[data-tv]', box).forEach(b => b.onclick = () => { PA.trashView = b.dataset.tv; loadTrashAdmin(); });
  $$('[data-restore]', box).forEach(b => b.onclick = () => doRestore(b.closest('.aud').dataset.id, b.closest('.aud').querySelector('h5').textContent));
}
async function doRestore(id, label) {
  if (!await ask({ title: 'استرجاع', msg: `استرجاع «${label}» مع توابعه (لو فيه)؟ الاسترجاع بيرفض لو هيعمل تكرار.`, okText: 'استرجاع' })) return;
  const r = await adm('trashRestore', { id }, 120000);
  if (!r.ok) { pInfo('مينفعش يتسترجع', [r.error], 'bad'); return; }
  if (r.count !== undefined) setTrashCount(r.count);
  if (r.warnings && r.warnings.length) pInfo('اتسترجع «' + r.label + '» مع تنبيهات', r.warnings, 'warn'); else toast('تم استرجاع «' + r.label + '» ✔', 'ok');
  loadTrashAdmin();
}
