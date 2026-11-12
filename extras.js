/* =====================================================================
   extras.js — (ملف جديد، ارفعه باسم extras.js جنب portal.js و conferences.js)
   1) المدفوعات بالأقساط:
      - العضو: تاب «💳 مدفوعاتي» (بيظهر لو عليه مدفوعات): المطلوب / دفع كام / الباقي كام / الأقساط ومواعيدها،
        وبينوّر أحمر + تنبيه فوق الصفحة لو قسط عدّى ميعاده. وبيدفع بكود الكوبون اللي خده من الخادم.
      - الأدمن: تاب «💳 المدفوعات»: نظام الأقساط لكل رحلة/مؤتمر، تسجيل دفع نقدي، إدخال كوبون بدل العضو، السجل، تقرير Excel.
      - السوبر أدمن: «🎟️ الكوبونات»: توليد عدد أكواد بقيمة معينة + طباعة + Excel + إلغاء كود.
   2) الملفات والمرفقات: بوستر / بامفلت / بروشور / ترانيم / شعار مكتوب / صوت لكل رحلة ومؤتمر:
      - الأدمن: زرار «📎 الملفات» على كل رحلة ومؤتمر. - العضو: زرار «📎 ملفات ومرفقات» يشوف ويحمّل، وبوستر المؤتمر بيظهر فوق الكارت.
   بيركّب نفسه في الصفحة لوحده، وبيستخدم دوال portal.js والسكريبت الرئيسي (api / mcall / adm / pModal / ask / toast ...).
   ===================================================================== */
window.EXTRAS_VER = '2026-11-09-pay-v11';            // لازم يطابق EXPECTED_VERSION في index.html
(function () {
  'use strict';
  if (window.__extras) return; window.__extras = true;

  const CSS = `
  .pay-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:12px;background:#fff;box-shadow:0 2px 8px rgba(60,36,18,.05)}
  .pay-card.late{border-color:#e7a29a;background:#fff8f6;box-shadow:0 0 0 3px rgba(176,52,39,.14)}
  .pay-card h4{margin:0 0 2px;color:var(--brown);font-size:17px}
  .pay-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
  .pay-sum div{background:var(--tint);border:1px solid var(--line);border-radius:12px;text-align:center;padding:6px 4px}
  .pay-sum small{display:block;color:var(--mut);font-size:12px}.pay-sum b{font-size:16px;color:var(--brown)}
  .pay-sum b.ok{color:var(--ok)}.pay-sum b.bad{color:var(--bad)}
  .pay-card.late .tbar i{background:linear-gradient(90deg,#962a20,var(--bad))}
  table.payT{min-width:0;font-size:13px;margin-top:6px}
  table.payT td,table.payT th{white-space:normal}
  tr.lateRow td{background:#fdecea!important;color:#8f2a20;font-weight:600}
  tr.paidRow td{background:#f1f8f3!important}
  .pay-redeem{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .pay-redeem input{max-width:200px;letter-spacing:2px;text-transform:uppercase;font-weight:700;direction:ltr;text-align:center}
  #mtPay.lateTab{border-color:var(--bad);color:var(--bad)}
  #mtPay.lateTab.on{background:linear-gradient(135deg,#962a20,var(--bad));color:#fff;border-color:var(--bad)}
  .instRow{display:grid;grid-template-columns:1.3fr 1fr 1fr 34px;gap:6px;align-items:center;margin-bottom:6px}
  .instRow input{padding:7px 8px;min-height:38px}
  .instRow button{border:0;background:#fdecea;color:var(--bad);border-radius:8px;height:34px;cursor:pointer;font-size:18px}
  @media(max-width:640px){.instRow{grid-template-columns:1fr 1fr 34px}.instRow [data-pf=label]{grid-column:1/-1}}
  .ev-pick tr{cursor:pointer}.ev-pick tr:hover td{background:var(--tint)}
  .pstat{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0}
  .pstat div{background:linear-gradient(180deg,#fff,var(--tint));border:1px solid var(--line);border-radius:12px;text-align:center;padding:6px}
  .pstat b{display:block;font-size:18px;color:var(--brown)}.pstat span{font-size:12px;color:var(--mut)}
  .pstat .bad b{color:var(--bad)}
  .vch-codes{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin:8px 0}
  .vch-codes code{display:block;text-align:center;font-size:15px;font-weight:700;letter-spacing:2px;border:1.5px dashed var(--gold);border-radius:10px;padding:6px;background:#fffaf0;direction:ltr}
  .att-row{margin:8px 0 0;display:flex;gap:6px;flex-wrap:wrap}
  .att-item{border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin-bottom:8px;background:#fff}
  .att-item .top{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .att-item .txt{white-space:pre-wrap;word-break:break-word;background:var(--tint);border-radius:10px;padding:8px 10px;margin-top:6px;line-height:1.9}
  .att-item audio,.att-item video{width:100%;margin-top:6px}
  .att-item img.prev{display:block;max-width:100%;max-height:280px;margin:6px auto 0;border-radius:10px;cursor:zoom-in}
  .att-ic{font-size:20px}
  `;

  /* ---------------- أدوات ---------------- */
  const $1 = (s, r) => (r || document).querySelector(s);
  const $A = (s, r) => Array.from((r || document).querySelectorAll(s));
  const num = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US');
  const money = n => num(n) + ' جنيه';
  const SPIN = '<div class="empty"><span class="spin"></span> جاري التحميل...</div>';
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const daysSince = iso => Math.max(0, Math.round((Date.parse(todayStr() + 'T12:00:00') - Date.parse(iso + 'T12:00:00')) / 864e5));
  const evIcon = t => t === 'trip' ? '🚌' : '🏨';
  const evWord = t => t === 'trip' ? 'رحلة' : 'مؤتمر';
  const INST = { paid: ['✔ مدفوع', 'o'], partial: ['◐ جزئي', 'p'], due: ['⏳ لسه', 'g'], late: ['⚠ متأخر', 'n'] };
  const badge = (k, map) => { const x = map[k] || ['', 'g']; return `<span class="badge ${x[1]}">${x[0]}</span>`; };
  const vchInput = el => { let v = toEn(el.value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4); el.value = v; };
  function xlsx(sheets, file) {
    if (!window.XLSX) return toast('مكتبة Excel لم تُحمّل', 'err');
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    sheets.forEach(([name, aoa]) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = (aoa[0] || []).map(h => ({ wch: Math.max(12, String(h).length + 4) })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30)); });
    XLSX.writeFile(wb, file);
  }
  function dataToBlob(d) {
    const i = d.indexOf(','), mime = d.slice(5, i).split(';')[0] || 'application/octet-stream', bin = atob(d.slice(i + 1)), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    return new Blob([u], { type: mime });
  }
  function saveData(d, name) {
    const u = URL.createObjectURL(dataToBlob(d)), a = document.createElement('a');
    a.href = u; a.download = name || 'file'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 20000);
  }
  let EXOK = null;
  async function probe() { if (EXOK) return true; const r = await api('exInfo', {}, 20000); EXOK = !!(r && r.ok && r.ex); return EXOK; }
  const STALE = '<div class="notice bad">الميزة دي مش شغالة على الخادم لسه: ضيف ملف <b>Extras</b> في Apps Script والصق <b>Code.gs</b> الجديد، وبعدين Deploy ← Manage deployments ← ✏️ ← <b>New version</b>.</div>';

  /* =====================================================================
     العضو: «💳 مدفوعاتي»
     ===================================================================== */
  const MP = { items: [] };
  function memInject() {
    const tabs = $1('#memTabs'), acct = $1('#memAcct');
    if (!tabs || !acct || $1('#mtPay')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'mtPay'; b.dataset.mt = 'pay'; b.hidden = true; b.textContent = '💳 مدفوعاتي';
    tabs.insertBefore(b, tabs.querySelector('[data-mt="acct"]'));
    b.onclick = () => showMemberTab('pay');
    const box = document.createElement('div'); box.id = 'memPay'; box.hidden = true; acct.parentNode.insertBefore(box, acct);
    box.addEventListener('click', onMemPayClick);
    box.addEventListener('input', e => { if (e.target.matches('[data-vc]')) vchInput(e.target); });
    const al = document.createElement('div'); al.id = 'payAlert'; al.className = 'notice bad'; al.hidden = true; al.style.marginTop = '10px';
    const pw = $1('#memPwWarn'); if (pw) pw.after(al);
    al.addEventListener('click', e => { if (e.target.closest('[data-gopay]')) { e.preventDefault(); showMemberTab('pay'); } });
    const origShowM = window.showMemberTab;
    window.showMemberTab = function (name) {
      const box2 = $1('#memPay');
      if (name !== 'pay' || !box2) { if (box2) box2.hidden = true; return origShowM(name); }
      PM.tab = 'pay';
      $A('#memTabs button').forEach(x => x.classList.toggle('on', x.dataset.mt === 'pay'));
      ['#memNews', '#memTrips', '#memConf', '#memAcct'].forEach(sel => { const el = $1(sel); if (el) el.hidden = true; });
      box2.hidden = false; renderMemPay(true);
    };
  }
  function memReset() { MP.items = []; const b = $1('#mtPay'), al = $1('#payAlert'); if (b) b.hidden = true; if (al) al.hidden = true; }
  async function memRefresh() {
    if (!PM.token || !(await probe())) return;
    const r = await mcall('payMine');
    if (!r.ok) return;
    MP.items = r.items; paintMemberBits();
  }
  function paintMemberBits() {
    const b = $1('#mtPay'), al = $1('#payAlert'); if (!b) return;
    const late = MP.items.filter(x => x.late);
    b.hidden = !MP.items.length; b.textContent = '💳 مدفوعاتي' + (late.length ? ' ⚠' : ''); b.classList.toggle('lateTab', late.length > 0);
    if (late.length) {
      al.innerHTML = '⚠ عندك قسط متأخر: ' + late.map(x => `«${esc(x.title)}» <b>${money(x.overdue)}</b>`).join(' · ') + ' — <a href="#" data-gopay>افتح مدفوعاتي</a>';
      al.hidden = false;
    } else al.hidden = true;
    if (b.hidden && PM.tab === 'pay') showMemberTab('news');
  }
  async function renderMemPay(fetch) {
    const box = $1('#memPay'); if (!box) return;
    if (fetch) {
      box.innerHTML = SPIN;
      if (!(await probe())) { box.innerHTML = STALE; return; }
      const r = await mcall('payMine');
      if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
      MP.items = r.items; paintMemberBits();
      if (PM.tab !== 'pay') return;
    }
    box.innerHTML = MP.items.length ? MP.items.map(payCardHTML).join('') : '<div class="empty">مفيش مدفوعات مطلوبة منك دلوقتي 👍</div>';
  }
  function payCardHTML(x) {
    const pct = x.total ? Math.min(100, Math.round(x.paid * 100 / x.total)) : 0;
    let msg = '';
    if (x.remaining <= 0) msg = '<div class="notice good">✔ المبلغ مدفوع بالكامل. ربنا يعوّض تعبك.</div>';
    else if (x.late) msg = `<div class="notice bad">⚠ متأخر عليك <b>${money(x.overdue)}</b>${x.lateSince ? ' — القسط كان معاده ' + esc(pDate(x.lateSince)) + ' (من ' + daysSince(x.lateSince) + ' يوم)' : ''}. ادفع للخدام وخد منه كود، واكتبه تحت.</div>`;
    else if (x.next) msg = `<div class="notice info">القسط الجاي: <b>${esc(x.next.label)}</b> — ${money(x.next.left)}${x.next.due ? ' قبل ' + esc(pDate(x.next.due)) : ''}</div>`;
    const rows = x.installments.map(it => `<tr class="${it.status === 'late' ? 'lateRow' : it.status === 'paid' ? 'paidRow' : ''}"><td>${esc(it.label)}</td><td>${it.due ? esc(pDate(it.due)) : '—'}</td>
      <td>${money(it.amount)}${it.status === 'partial' || (it.status === 'late' && it.covered) ? `<br><small>دفعت ${money(it.covered)}</small>` : ''}</td><td>${badge(it.status, INST)}</td></tr>`).join('');
    const hist = x.payments.length ? '<h4 style="margin:12px 0 6px;color:var(--brown)">اللي دفعته</h4>' + x.payments.map(p =>
      `<div class="gl"><div><b>${money(p.amount)}</b> · ${esc(p.methodLabel)}${p.ref ? ` <span class="ltr" style="display:inline-block">${esc(p.ref)}</span>` : ''}${p.note ? '<br><small>' + esc(p.note) + '</small>' : ''}</div><small class="ltr" style="color:var(--mut)">${esc((p.at || '').slice(0, 16))}</small></div>`).join('') : '';
    return `<div class="pay-card${x.late ? ' late' : ''}"><h4>${evIcon(x.type)} ${esc(x.title)}</h4>
      <div class="hint">${esc(pDate(x.date))}${x.persons > 1 ? ' · المبلغ محسوب على ' + x.persons + ' أشخاص (حضرتك وضيوفك)' : ''} · ${money(x.perPerson)} للفرد</div>
      <div class="pay-sum"><div><small>المطلوب</small><b>${money(x.total)}</b></div><div><small>دفعت</small><b class="ok">${money(x.paid)}</b></div><div><small>الباقي</small><b class="${x.late ? 'bad' : ''}">${money(x.remaining)}</b></div></div>
      <div class="tbar"><i style="width:${pct}%"></i></div>${msg}${x.note ? `<div class="hint">${esc(x.note)}</div>` : ''}
      <table class="tblB payT"><thead><tr><th>القسط</th><th>آخر ميعاد</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody></table>
      ${x.remaining > 0 ? `<div class="pay-redeem"><input data-vc="${esc(x.key)}" maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" aria-label="كود الكوبون"><button class="btn gold" type="button" data-redeem="${esc(x.key)}">🎟️ ادفع بالكود</button></div>
        <small class="hint">الخادم بياخد منك المبلغ ويديك كود؛ اكتبه هنا فيتسجّل إنك دفعت.</small>` : ''}${hist}</div>`;
  }
  async function onMemPayClick(e) {
    const b = e.target.closest('[data-redeem]'); if (!b) return;
    const key = b.dataset.redeem, inp = $A('[data-vc]', $1('#memPay')).find(i => i.dataset.vc === key), code = inp ? inp.value : '';
    if (toEn(code).replace(/[^A-Za-z0-9]/g, '').length !== 8) return toast('الكود 8 حروف وأرقام (مثال: AB3K-9QXZ).', 'err');
    b.disabled = true; const r = await mcall('payRedeem', { key, code }); b.disabled = false;
    if (!r.ok) return toast(r.error, 'err');
    toast('تم تسجيل دفع ' + money(r.amount) + ' ✔' + (r.remaining > 0 ? ' — الباقي ' + money(r.remaining) : ' — كده دفعت كله 🎉'), 'ok');
    renderMemPay(true);
  }

  /* =====================================================================
     الأدمن: «💳 المدفوعات»
     ===================================================================== */
  const AP = { events: [], key: '', D: null, plan: null, filter: '', q: '' };
  function admInject() {
    const tabs = $1('#admTabs'), dash = $1('#admDash');
    if (!tabs || !dash || $1('#admTabPay')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'admTabPay'; b.dataset.at = 'pay'; b.textContent = '💳 المدفوعات';
    tabs.insertBefore(b, $1('#admTabAudit'));
    b.onclick = () => showAdminTab('pay');
    const c = document.createElement('div'); c.id = 'admPay'; c.hidden = true; dash.appendChild(c);
    c.addEventListener('click', onAdmPayClick);
    c.addEventListener('input', onAdmPayInput);
    c.addEventListener('change', onAdmPayInput);
    const origShowA = window.showAdminTab;
    window.showAdminTab = function (name) {
      const box = $1('#admPay');
      if (name !== 'pay') { if (box) box.hidden = true; return origShowA(name); }
      origShowA('pay'); box.hidden = false; loadAdmPay();
    };
    const rf = $1('#admRefresh'); if (rf) rf.addEventListener('click', () => { if (A.tab === 'pay') loadAdmPay(); });
  }
  async function loadAdmPay() {
    const box = $1('#admPay');
    box.innerHTML = SPIN;
    if (!(await probe())) { box.innerHTML = STALE; return; }
    const r = await adm('payAdminEvents');
    if (!r.ok) { box.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
    AP.events = r.items;
    if (AP.key && AP.events.some(e => e.key === AP.key)) return openEvent(AP.key);
    AP.key = ''; renderEvents();
  }
  function renderEvents() {
    const box = $1('#admPay'), E = AP.events;
    const rows = E.map(e => `<tr data-ev="${esc(e.key)}"${e.late ? ' class="lateRow"' : ''}><td>${evIcon(e.type)} <b>${esc(e.title)}</b><br><small>${esc(pDate(e.date))}${e.status === 'draft' ? ' · مسودة' : ''}</small></td>
      <td>${e.hasPlan ? money(e.perPerson) + ' للفرد<br><small>' + e.installments + ' قسط</small>' : '<span class="badge g">مفيش نظام دفع</span>'}</td>
      <td>${e.members}</td><td>${e.hasPlan ? money(e.paid) + '<br><small>من ' + money(e.total) + '</small>' : '—'}</td><td>${e.hasPlan ? money(e.remaining) : '—'}</td>
      <td>${e.late ? `<b>⚠ ${e.late}</b><br><small>${money(e.lateAmount)}</small>` : (e.hasPlan ? '✔' : '—')}</td></tr>`).join('');
    box.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:8px"><b style="color:var(--brown)">💳 المدفوعات والأقساط</b>
      <div class="acts"><button class="btn sm gold" type="button" data-p="report">⬇ تقرير شامل (Excel)</button>${isSuper() ? '<button class="btn sm pri" type="button" data-p="vch">🎟️ الكوبونات</button>' : ''}</div></div>
      <div class="notice info">اختار رحلة أو مؤتمر عشان تحدد الأقساط (قيمتها للفرد وآخر ميعاد لكل قسط)، وتسجّل اللي اتدفع. الصف الأحمر = فيه حد متأخر.</div>
      <div class="tbl-wrap"><table class="tblB ev-pick"><thead><tr><th>الرحلة / المؤتمر</th><th>نظام الدفع</th><th>المقبولين</th><th>المدفوع</th><th>الباقي</th><th>متأخرين</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="empty">مفيش رحلات ولا مؤتمرات لسه</td></tr>'}</tbody></table></div>`;
  }
  async function openEvent(key, data) {
    const box = $1('#admPay');
    AP.key = key;
    if (!data) { box.innerHTML = SPIN; data = await adm('payAdminGet', { key }); }
    if (!data.ok) { box.innerHTML = `<div class="formerr">${esc(data.error)}</div><button class="btn" type="button" data-p="back">→ رجوع</button>`; return; }
    AP.D = data;
    AP.plan = data.plan ? { includeGuests: data.plan.includeGuests, note: data.plan.note, installments: data.plan.installments.map(i => Object.assign({}, i)) }
      : { includeGuests: true, note: '', installments: [{ label: 'المقدم', amount: '', due: '' }] };
    renderEvent();
  }
  function planHTML() {
    const P = AP.plan, per = P.installments.reduce((a, i) => a + (+toEn(i.amount) || 0), 0);
    return P.installments.map((it, i) => `<div class="instRow" data-pi="${i}"><input data-pf="label" maxlength="40" placeholder="اسم القسط (مثال: المقدم)" value="${esc(it.label || '')}">
      <input data-pf="amount" inputmode="decimal" dir="ltr" placeholder="المبلغ للفرد" value="${esc(it.amount === '' ? '' : String(it.amount))}"><input data-pf="due" type="date" dir="ltr" value="${esc(it.due || '')}" title="آخر ميعاد للدفع">
      <button type="button" data-prm="${i}" title="حذف القسط"${P.installments.length < 2 ? ' disabled' : ''}>×</button></div>`).join('') +
      `<div class="row"><button type="button" class="btn sm ok" data-p="addInst">➕ قسط</button><span class="hint" data-p="per">الإجمالي للفرد: <b>${money(per)}</b></span></div>`;
  }
  function filteredRows() {
    const q = AP.q.trim().toLowerCase();
    return AP.D.rows.filter(r => (!AP.filter || (AP.filter === 'late' ? r.late : AP.filter === 'left' ? r.remaining > 0 : r.remaining <= 0)) &&
      (!q || [r.name, r.code, r.whatsapp].join(' ').toLowerCase().includes(q)));
  }
  function rowsHTML() {
    const D = AP.D, hasPlan = !!D.plan;
    return filteredRows().map(r => {
      const st = !hasPlan ? '—' : r.remaining <= 0 ? '<span class="badge o">✔ مدفوع بالكامل</span>' : r.late ? `<span class="badge n">⚠ متأخر ${money(r.overdue)}</span><br><small>من ${esc(r.lateSince)} (${daysSince(r.lateSince)} يوم)</small>` : '<span class="badge p">⏳ ماشي في المواعيد</span>';
      const nx = r.next ? `${esc(r.next.label)}: ${money(r.next.left)}${r.next.due ? '<br><small>قبل ' + esc(r.next.due) + '</small>' : ''}` : '—';
      const wa = r.whatsapp && r.remaining > 0 ? 'https://wa.me/2' + r.whatsapp + '?text=' + encodeURIComponent(`سلام ونعمة ${String(r.name).split(' ')[0]} 🙏\nبالنسبة لـ${evWord(D.event.type)} «${D.event.title}»: ${r.late ? 'عليك قسط متأخر ' + num(r.overdue) + ' جنيه' : 'القسط الجاي ' + (r.next ? r.next.label + ' ' + num(r.next.left) + ' جنيه' + (r.next.due ? ' قبل ' + r.next.due : '') : '')}.\nالمدفوع: ${num(r.paid)} من ${num(r.total)} جنيه — الباقي ${num(r.remaining)} جنيه.\nتقدر تتابع من الموقع ← مدفوعاتي.`) : '';
      return `<tr data-nid="${esc(r.nid)}"${r.late ? ' class="lateRow"' : ''}><td><b>${esc(r.name)}</b><br><small class="ltr" style="display:inline-block">${esc(r.code)} · ${esc(r.whatsapp)}</small></td>
        <td>${r.persons}</td><td>${hasPlan ? money(r.total) : '—'}</td><td>${money(r.paid)}</td><td>${hasPlan ? money(r.remaining) : '—'}</td><td>${st}</td><td>${nx}</td>
        <td><div class="acts">${hasPlan && r.remaining > 0 ? '<button class="btn sm ok" type="button" data-p="cash">💵 دفع نقدي</button><button class="btn sm gold" type="button" data-p="code">🎟️ كوبون</button>' : ''}
        <button class="btn sm" type="button" data-p="hist">📜 السجل (${r.payments.length})</button>${wa ? `<a class="btn sm wa" style="text-decoration:none" target="_blank" rel="noopener" href="${wa}">📲 تذكير</a>` : ''}</div></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">مفيش نتائج</td></tr>';
  }
  function renderEvent() {
    const box = $1('#admPay'), D = AP.D, e = D.event, R = D.rows, hasPlan = !!D.plan;
    const sum = k => R.reduce((a, r) => a + (+r[k] || 0), 0), lateN = R.filter(r => r.late).length;
    box.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:6px"><div><button class="btn sm" type="button" data-p="back">→ كل الرحلات والمؤتمرات</button>
        <b style="color:var(--brown);margin-right:6px">${evIcon(e.type)} ${esc(e.title)}</b> <small class="hint" style="display:inline">${esc(pDate(e.date))}</small></div>
      <div class="acts"><button class="btn sm gold" type="button" data-p="xls">⬇ Excel</button>${isSuper() ? '<button class="btn sm pri" type="button" data-p="vch">🎟️ الكوبونات</button>' : ''}</div></div>
      <details class="sec" ${hasPlan ? '' : 'open'}><summary style="cursor:pointer;font-weight:700;color:var(--brown)">🗓️ نظام الأقساط ${hasPlan ? '— ' + money(D.plan.perPerson) + ' للفرد · ' + D.plan.installments.length + ' قسط' : '(لسه ما اتحددش)'}</summary>
        <div class="hint" style="margin:8px 0">لكل قسط: اسمه، قيمته <b>للفرد</b>، وآخر ميعاد للدفع. اللي يعدّي عليه الميعاد ومدفعش بيظهر أحمر عنده وعندك.</div>
        <label class="chk"><input type="checkbox" data-p="inclG"${AP.plan.includeGuests ? ' checked' : ''}> المبلغ بيتحسب على العضو وضيوفه الموافق عليهم (لكل فرد)</label>
        <div data-p="plan">${planHTML()}</div>
        <div class="field" style="margin-top:8px"><label>ملاحظة تظهر للأعضاء (اختياري)</label><input data-p="pnote" maxlength="300" value="${esc(AP.plan.note || '')}" placeholder="مثال: الدفع لأي خادم بعد الاجتماع"></div>
        <button class="btn pri" type="button" data-p="savePlan">💾 حفظ نظام الأقساط</button></details>
      ${hasPlan ? `<div class="pstat"><div><b>${R.length}</b><span>مقبولين</span></div><div><b>${money(sum('total'))}</b><span>المطلوب</span></div><div><b>${money(sum('paid'))}</b><span>اتدفع</span></div>
        <div><b>${money(sum('remaining'))}</b><span>الباقي</span></div><div class="${lateN ? 'bad' : ''}"><b>${lateN}</b><span>متأخرين (${money(sum('overdue'))})</span></div></div>` : '<div class="notice warn">حدّد نظام الأقساط الأول عشان تقدر تسجّل مدفوعات.</div>'}
      <div class="row" style="margin-bottom:8px"><input data-p="q" placeholder="بحث بالاسم / الكود / التليفون" value="${esc(AP.q)}" style="flex:1;min-width:180px">
        <select data-p="flt" style="width:auto"><option value="">الكل</option><option value="late"${AP.filter === 'late' ? ' selected' : ''}>المتأخرين بس</option><option value="left"${AP.filter === 'left' ? ' selected' : ''}>عليهم باقي</option><option value="done"${AP.filter === 'done' ? ' selected' : ''}>دفعوا بالكامل</option></select></div>
      <div class="tbl-wrap"><table class="tblB"><thead><tr><th>العضو</th><th>أفراد</th><th>المطلوب</th><th>دفع</th><th>الباقي</th><th>الحالة</th><th>القسط الجاي</th><th>إجراءات</th></tr></thead><tbody data-p="rows">${rowsHTML()}</tbody></table></div>
      ${D.others.length ? `<h4 style="margin:14px 0 6px;color:var(--warn)">⚠ دفعات لأشخاص مبقوش مقبولين (${D.others.length}) — راجع لو محتاجين ترجيع فلوس</h4>` + D.others.map(p => `<div class="gl"><div><b>${esc(p.name)}</b> <small class="ltr">${esc(p.code)}</small> — ${money(p.amount)} · ${esc(p.methodLabel)}</div><small class="ltr">${esc((p.at || '').slice(0, 16))}</small></div>`).join('') : ''}`;
  }
  function onAdmPayInput(e) {
    const t = e.target, row = t.closest('[data-pi]');
    if (row && t.dataset.pf) {
      AP.plan.installments[+row.dataset.pi][t.dataset.pf] = t.value;
      if (t.dataset.pf === 'amount') { const per = AP.plan.installments.reduce((a, i) => a + (+toEn(i.amount) || 0), 0), el = $1('[data-p="per"]'); if (el) el.innerHTML = 'الإجمالي للفرد: <b>' + money(per) + '</b>'; }
      return;
    }
    if (t.dataset.p === 'inclG') AP.plan.includeGuests = t.checked;
    else if (t.dataset.p === 'pnote') AP.plan.note = t.value;
    else if (t.dataset.p === 'q' && e.type === 'input') { AP.q = t.value; $1('[data-p="rows"]').innerHTML = rowsHTML(); }
    else if (t.dataset.p === 'flt' && e.type === 'change') { AP.filter = t.value; $1('[data-p="rows"]').innerHTML = rowsHTML(); }
  }
  async function onAdmPayClick(e) {
    const ev = e.target.closest('tr[data-ev]'); if (ev && !AP.key) return openEvent(ev.dataset.ev);
    const rm = e.target.closest('[data-prm]');
    if (rm && !rm.disabled) { AP.plan.installments.splice(+rm.dataset.prm, 1); $1('[data-p="plan"]').innerHTML = planHTML(); return; }
    const b = e.target.closest('button[data-p]'); if (!b) return;
    const act = b.dataset.p, tr = b.closest('tr[data-nid]'), row = tr && AP.D ? AP.D.rows.find(r => r.nid === tr.dataset.nid) : null;
    if (act === 'back') { AP.key = ''; return loadAdmPay(); }
    if (act === 'report') return exportAll();
    if (act === 'vch') return openVouchers();
    if (act === 'xls') return exportEvent();
    if (act === 'addInst') {
      if (AP.plan.installments.length >= 24) return toast('أقصى عدد أقساط 24', 'err');
      AP.plan.installments.push({ label: 'القسط ' + (AP.plan.installments.length + 1), amount: '', due: '' }); $1('[data-p="plan"]').innerHTML = planHTML(); return;
    }
    if (act === 'savePlan') {
      const P = AP.plan;
      for (let i = 0; i < P.installments.length; i++) if (!(+toEn(P.installments[i].amount) > 0)) return toast('اكتب قيمة القسط رقم ' + (i + 1) + ' (للفرد).', 'err');
      b.disabled = true;
      const r = await adm('paySavePlan', { key: AP.key, includeGuests: P.includeGuests, note: P.note, installments: P.installments.map(i => ({ id: i.id, label: i.label, amount: toEn(String(i.amount)), due: i.due })) }, 60000);
      b.disabled = false;
      if (!r.ok) return toast(r.error, 'err');
      toast('تم حفظ نظام الأقساط ✔', 'ok'); return openEvent(AP.key, r);
    }
    if (!row) return;
    if (act === 'cash') return payCash(row);
    if (act === 'code') return payCode(row);
    if (act === 'hist') return payHistory(row);
  }
  function payCash(row) {
    const m = pModal('💵 دفع نقدي — ' + row.name, `<div class="notice info">الباقي عليه: <b>${money(row.remaining)}</b>${row.next ? ' · القسط الجاي: ' + esc(row.next.label) + ' (' + money(row.next.left) + ')' : ''}</div>
      <div class="field"><label>المبلغ اللي اتدفع</label><input data-x="amt" inputmode="decimal" dir="ltr" value="${row.next ? row.next.left : ''}"></div>
      <div class="field"><label>ملاحظة (اختياري)</label><input data-x="note" maxlength="200" placeholder="مثال: استلمه مينا بعد الاجتماع"></div><div class="formerr" data-x="err" hidden></div>`,
      '<button class="btn ok" type="button" data-x="ok">💾 تسجيل الدفع</button><button class="btn" type="button" data-x="no">إلغاء</button>', { narrow: true, tag: 'admin' });
    const x = k => m.q(`[data-x="${k}"]`);
    x('no').onclick = m.close;
    x('ok').onclick = async () => {
      const amt = toEn(x('amt').value).replace(/[,\s]/g, '');
      if (!(+amt > 0)) { x('err').textContent = 'اكتب مبلغ صحيح.'; x('err').hidden = false; return; }
      x('ok').disabled = true; const r = await adm('payAdd', { key: AP.key, nid: row.nid, amount: amt, note: x('note').value }, 60000); x('ok').disabled = false;
      if (!r.ok) { x('err').textContent = r.error; x('err').hidden = false; return; }
      m.close(); toast('تم تسجيل ' + money(amt) + ' لـ ' + row.name, 'ok'); openEvent(AP.key, r);
    };
    x('amt').focus();
  }
  function payCode(row) {
    const m = pModal('🎟️ دفع بكوبون — ' + row.name, `<div class="notice info">الباقي عليه: <b>${money(row.remaining)}</b>. اكتب الكود اللي معاه.</div>
      <div class="field"><label>الكود</label><input data-x="code" maxlength="9" dir="ltr" placeholder="XXXX-XXXX" style="letter-spacing:3px;text-align:center;font-weight:700"></div><div class="formerr" data-x="err" hidden></div>`,
      '<button class="btn gold" type="button" data-x="ok">🎟️ تسجيل</button><button class="btn" type="button" data-x="no">إلغاء</button>', { narrow: true, tag: 'admin' });
    const x = k => m.q(`[data-x="${k}"]`);
    x('code').oninput = () => vchInput(x('code'));
    x('no').onclick = m.close;
    x('ok').onclick = async () => {
      x('ok').disabled = true; const r = await adm('payAdminRedeem', { key: AP.key, nid: row.nid, code: x('code').value }, 60000); x('ok').disabled = false;
      if (!r.ok) { x('err').textContent = r.error; x('err').hidden = false; return; }
      m.close(); toast('تم تسجيل كوبون بـ ' + money(r.amount), 'ok'); openEvent(AP.key);
    };
    x('code').focus();
  }
  function payHistory(row) {
    const sup = isSuper();
    const m = pModal('📜 مدفوعات ' + row.name, row.payments.length ? row.payments.map(p => `<div class="gl" data-pid="${esc(p.id)}"><div><b>${money(p.amount)}</b> · ${esc(p.methodLabel)}${p.ref ? ` <span class="ltr" style="display:inline-block">${esc(p.ref)}</span>` : ''}
      <br><small>${esc((p.at || '').slice(0, 16))} · سجّلها ${esc(p.byName || '')}${p.note ? ' · ' + esc(p.note) : ''}</small></div>${sup ? '<button class="btn sm bad" type="button" data-del>🗑 حذف</button>' : ''}</div>`).join('')
      + (sup ? '<small class="hint">الحذف بيروح لسلة المحذوفات، ولو الدفعة بكوبون الكوبون بيرجع صالح.</small>' : '') : '<div class="empty">مفيش مدفوعات لسه.</div>', '', { narrow: true, tag: 'admin' });
    m.el.addEventListener('click', async e => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const pid = d.closest('[data-pid]').dataset.pid;
      if (!await ask({ title: 'حذف دفعة', msg: 'حذف الدفعة دي من سجل ' + row.name + '؟ (هتتنقل لسلة المحذوفات)', okText: 'حذف' })) return;
      const r = await adm('payDelete', { id: pid }, 60000);
      if (!r.ok) return toast(r.error, 'err');
      m.close(); toast('تم حذف الدفعة (في سلة المحذوفات)', 'ok'); if (r.trashCount !== undefined && typeof setTrashCount === 'function') setTrashCount(r.trashCount);
      openEvent(AP.key, r);
    });
  }
  const RHEAD = ['الاسم', 'الكود', 'الواتساب', 'عدد الأفراد', 'المطلوب', 'المدفوع', 'الباقي', 'المتأخر', 'متأخر من', 'الحالة', 'القسط الجاي', 'قيمته', 'آخر ميعاد له'];
  const rLine = r => [r.name, r.code, r.whatsapp, r.persons, r.total, r.paid, r.remaining, r.overdue, r.lateSince || '', r.remaining <= 0 ? 'مدفوع بالكامل' : r.late ? 'متأخر' : 'ماشي في المواعيد', r.next ? r.next.label : '', r.next ? r.next.left : '', r.next ? r.next.due : ''];
  const PHEAD = ['الوقت', 'الاسم', 'الكود', 'المبلغ', 'الطريقة', 'الكوبون', 'ملاحظة', 'سجّلها'];
  const pLine = p => [p.at, p.name, p.code, p.amount, p.methodLabel, p.ref, p.note, p.byName];
  function exportEvent() {
    const D = AP.D, pays = [];
    D.rows.forEach(r => r.payments.forEach(p => pays.push(p)));
    xlsx([['الحالة', [RHEAD].concat(D.rows.map(rLine))], ['الدفعات', [PHEAD].concat(pays.map(pLine))]], 'payments_' + D.event.title.replace(/[\\/:*?"<>|]/g, '_') + '.xlsx');
  }
  async function exportAll() {
    const r = await adm('payReport', {}, 120000);
    if (!r.ok) return toast(r.error, 'err');
    xlsx([['حالة الدفع', [['الرحلة / المؤتمر', 'النوع', 'التاريخ'].concat(RHEAD)].concat(r.rows.map(x => [x.event, evWord(x.type), x.date].concat(rLine(x))))],
      ['كل الدفعات', [['الرحلة / المؤتمر'].concat(PHEAD)].concat(r.payments.map(p => [p.event].concat(pLine(p))))]], 'payments_report_' + r.today + '.xlsx');
  }

  /* ---------- الكوبونات (سوبر أدمن) ---------- */
  const VST = { 'new': ['✅ متاح', 'o'], used: ['✔ اتستخدم', 'b'], 'void': ['⛔ ملغي', 'n'] };
  function openVouchers() {
    if (!isSuper()) return;
    const evOpts = AP.events.map(e => `<option value="${esc(e.key)}">${evIcon(e.type)} ${esc(e.title)} (${esc(e.date)})</option>`).join('');
    const m = pModal('🎟️ الكوبونات (سوبر أدمن)', `
      <div class="sec"><h3>توليد كوبونات جديدة</h3>
        <div class="grid2"><div class="field"><label>العدد (لحد 500)</label><input data-v="count" type="number" min="1" max="500" value="20"></div>
          <div class="field"><label>قيمة الكوبون (جنيه)</label><input data-v="value" inputmode="decimal" dir="ltr" placeholder="مثال: 200"></div></div>
        <div class="grid2"><div class="field"><label>صالح لـ</label><select data-v="key"><option value="">أي رحلة أو مؤتمر</option>${evOpts}</select></div>
          <div class="field"><label>ملاحظة (اختياري)</label><input data-v="note" maxlength="100" placeholder="مثال: دفعة مع مينا"></div></div>
        <button class="btn pri" type="button" data-v="gen">🎲 توليد</button><div data-v="out"></div></div>
      <div class="sec"><h3>كل الكوبونات</h3><div data-v="stats" class="hint"></div>
        <div class="row" style="margin-bottom:8px"><select data-v="fst" style="width:auto"><option value="">كل الحالات</option><option value="new">المتاحة</option><option value="used">المستخدمة</option><option value="void">الملغية</option></select>
          <select data-v="fev" style="width:auto;max-width:240px"><option value="">كل الأحداث</option><option value="*">الصالحة لأي حدث</option>${evOpts}</select>
          <button class="btn sm gold" type="button" data-v="xls">⬇ Excel</button><button class="btn sm" type="button" data-v="print">🖨️ طباعة المتاحة</button></div>
        <div class="tbl-wrap" style="max-height:45vh"><table class="tblB"><thead><tr><th>الكود</th><th>القيمة</th><th>صالح لـ</th><th>الحالة</th><th>استخدمه</th><th></th></tr></thead><tbody data-v="list"></tbody></table></div></div>`, '', { tag: 'admin' });
    const v = k => m.q(`[data-v="${k}"]`);
    let LIST = [];
    const load = async () => {
      v('list').innerHTML = '<tr><td colspan="6" class="empty"><span class="spin"></span></td></tr>';
      const r = await adm('vchList', { status: v('fst').value, key: v('fev').value }, 60000);
      if (!r.ok) { v('list').innerHTML = `<tr><td colspan="6">${esc(r.error)}</td></tr>`; return; }
      LIST = r.items; const s = r.stats;
      v('stats').innerHTML = `متاحة: <b>${s['new'] || 0}</b> (${money(s.newValue)}) · مستخدمة: <b>${s.used || 0}</b> (${money(s.usedValue)}) · ملغية: <b>${s['void'] || 0}</b>`;
      v('list').innerHTML = LIST.map(x => `<tr data-code="${esc(x.code)}"><td class="ltr"><b>${esc(x.code)}</b><br><small>${esc((x.createdAt || '').slice(0, 10))}${x.note ? ' · ' + esc(x.note) : ''}</small></td><td>${money(x.value)}</td><td>${esc(x.event || 'أي حدث')}</td>
        <td>${badge(x.status, VST)}</td><td>${x.usedName ? esc(x.usedName) + '<br><small>' + esc(x.usedEvent) + ' · ' + esc((x.usedAt || '').slice(0, 10)) + '</small>' : '—'}</td>
        <td>${x.status === 'new' ? '<button class="btn sm bad" type="button" data-void>⛔ إلغاء</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">مفيش كوبونات</td></tr>';
    };
    const printCodes = (codes, value, title) => {
      const w = window.open('', '_blank'); if (!w) return toast('المتصفح منع فتح نافذة الطباعة.', 'err');
      w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كوبونات</title><style>body{font-family:Cairo,Tahoma,Arial;margin:12px}
        .g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.c{border:2px dashed #96601a;border-radius:10px;padding:10px;text-align:center;break-inside:avoid}
        .c b{display:block;font-size:20px;letter-spacing:3px;direction:ltr;margin:4px 0}.c small{color:#555}</style></head><body>
        <div class="g">${codes.map(c => `<div class="c"><small>${esc(EVENT_NAME)}</small><b>${esc(c.code || c)}</b>${money(c.value || value)}<br><small>${esc(c.event || title || 'أي رحلة / مؤتمر')}</small></div>`).join('')}</div>
        <script>window.onload=function(){window.print()}<\/script></body></html>`);
      w.document.close();
    };
    v('gen').onclick = async () => {
      const count = +v('count').value, value = toEn(v('value').value).replace(/[,\s]/g, '');
      if (!(count >= 1 && count <= 500)) return toast('العدد من 1 لـ 500', 'err');
      if (!(+value > 0)) return toast('اكتب قيمة الكوبون', 'err');
      if (!await ask({ title: 'توليد كوبونات', msg: `توليد ${count} كوبون بقيمة ${money(value)} (الإجمالي ${money(count * value)})؟`, okText: 'توليد' })) return;
      v('gen').disabled = true; const r = await adm('vchGenerate', { count, value, key: v('key').value, note: v('note').value }, 120000); v('gen').disabled = false;
      if (!r.ok) return toast(r.error, 'err');
      v('out').innerHTML = `<div class="notice good" style="margin-top:10px">✔ اتولّد ${r.codes.length} كوبون × ${money(r.value)}${r.eventTitle ? ' لـ «' + esc(r.eventTitle) + '»' : ''}. كل كود بيتستخدم مرة واحدة.</div>
        <div class="vch-codes">${r.codes.map(c => `<code>${esc(c)}</code>`).join('')}</div>
        <div class="acts"><button class="btn sm gold" type="button" data-v="genxls">⬇ Excel</button><button class="btn sm" type="button" data-v="genprint">🖨️ طباعة</button></div>`;
      v('genxls').onclick = () => xlsx([['الكوبونات', [['الكود', 'القيمة', 'صالح لـ', 'ملاحظة']].concat(r.codes.map(c => [c, r.value, r.eventTitle || 'أي حدث', r.note || '']))]], 'vouchers_' + r.batch + '.xlsx');
      v('genprint').onclick = () => printCodes(r.codes, r.value, r.eventTitle);
      load();
    };
    v('fst').onchange = load; v('fev').onchange = load;
    v('xls').onclick = () => xlsx([['الكوبونات', [['الكود', 'القيمة', 'صالح لـ', 'الحالة', 'استخدمه', 'في', 'تاريخ الاستخدام', 'اتعمل', 'بواسطة', 'ملاحظة']]
      .concat(LIST.map(x => [x.code, x.value, x.event || 'أي حدث', (VST[x.status] || [x.status])[0], x.usedName, x.usedEvent, x.usedAt, x.createdAt, x.createdBy, x.note]))]], 'vouchers.xlsx');
    v('print').onclick = () => { const av = LIST.filter(x => x.status === 'new'); if (!av.length) return toast('مفيش كوبونات متاحة في الفلتر ده', 'err'); printCodes(av); };
    v('list').onclick = async e => {
      const b = e.target.closest('[data-void]'); if (!b) return;
      const code = b.closest('tr').dataset.code;
      if (!await ask({ title: 'إلغاء كوبون', msg: `إلغاء الكود ${code}؟ مش هيتقبل بعد كده.`, okText: 'إلغاء الكود' })) return;
      const r = await adm('vchVoid', { code }); toast(r.ok ? 'تم الإلغاء' : r.error, r.ok ? 'ok' : 'err'); load();
    };
    load();
  }

  /* =====================================================================
     الملفات والمرفقات
     ===================================================================== */
  const EXT_MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', amr: 'audio/amr', mp4: 'video/mp4', txt: 'text/plain', doc: 'application/msword', ppt: 'application/vnd.ms-powerpoint', xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const KIND_IC = { image: '🖼️', audio: '🎵', video: '🎬', pdf: '📄', doc: '📝', text: '✍️' };
  const kb = n => n > 1048576 ? (Math.round(n / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const ATT_CACHE = {};
  async function attFetch(id, admin) {
    if (ATT_CACHE[id]) return ATT_CACHE[id];
    const r = admin ? await adm('attGet', { id }, 120000) : await mcall('attGet', { id }, 120000);
    if (r.ok && r.data && r.data.length < 4e6) ATT_CACHE[id] = r;
    return r;
  }
  function readFile(f) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        let d = String(fr.result), ext = (f.name.split('.').pop() || '').toLowerCase(), mime = (d.slice(5, d.indexOf(';')) || '').toLowerCase();
        const fix = { 'audio/x-m4a': 'audio/mp4', 'audio/mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav' }[mime];
        if (fix) mime = fix;
        if (!mime || mime === 'application/octet-stream') mime = EXT_MIME[ext] || mime;
        res('data:' + mime + d.slice(d.indexOf(';')));
      };
      fr.onerror = () => rej(new Error('read'));
      fr.readAsDataURL(f);
    });
  }
  function admDecorate() {
    [['#admTrips', 'trip'], ['#admConf', 'conf']].forEach(([sel, type]) => {
      const box = $1(sel); if (!box) return;
      $A('.trip[data-id]', box).forEach(card => {
        const acts = card.querySelector('.acts'); if (!acts || acts.querySelector('[data-att]')) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.dataset.att = type + ':' + card.dataset.id;
        b.dataset.title = (card.querySelector('h4') || {}).textContent || ''; b.textContent = '📎 الملفات'; acts.appendChild(b);
      });
    });
  }
  function openAttAdmin(key, title) {
    const m = pModal('📎 ملفات ومرفقات: ' + title.replace(/^[🚌🏨]\s*/u, ''), SPIN, '', { tag: 'admin' });
    const body = m.q('.bd'); let busy = false;
    const draw = r => {
      if (!r.ok) { body.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
      const items = r.items;
      body.innerHTML = `<div class="notice info">بوستر، بامفلت، بروشور، ترانيم، شعار مكتوب، تسجيل صوتي ... الشباب بيشوفوها ويحمّلوها من كارت ${key.indexOf('trip:') === 0 ? 'الرحلة' : 'المؤتمر'}.
          ${key.indexOf('conf:') === 0 ? 'الصورة اللي تعلّمها «⭐ بوستر» بتظهر فوق كارت المؤتمر.' : 'بوستر الرحلة الأساسي بيتغيّر من «✎ تعديل»، وتقدر هنا تضيف أي ملفات تانية.'}</div>
        ${items.length ? items.map(a => `<div class="att-item" data-aid="${esc(a.id)}"><div class="top"><div><span class="att-ic">${KIND_IC[a.kind] || '📎'}</span> <b>${esc(a.title)}</b>${a.poster ? ' <span class="badge s">⭐ بوستر</span>' : ''}
          <br><small class="hint" style="display:inline">${a.kind === 'text' ? 'نص مكتوب' : esc(a.fileName) + ' · ' + kb(a.size)} · ${esc(a.createdBy)} · ${esc((a.createdAt || '').slice(0, 10))}</small></div>
          <div class="acts">${a.kind !== 'text' ? '<button class="btn sm" type="button" data-a="open">👁 فتح</button>' : ''}${a.kind === 'image' ? `<button class="btn sm" type="button" data-a="poster">${a.poster ? 'إلغاء البوستر' : '⭐ بوستر'}</button>` : ''}
            <button class="btn sm" type="button" data-a="rename">✎</button><button class="btn sm bad" type="button" data-a="del">🗑</button></div></div>
          ${a.kind === 'text' ? `<div class="txt">${esc(a.text)}</div>` : ''}<div data-a="view"></div></div>`).join('') : '<div class="empty">مفيش ملفات لسه.</div>'}
        <div class="sec" style="margin-top:12px"><h3>⬆ رفع ملف</h3>
          <div class="field"><label>العنوان</label><input data-u="title" maxlength="80" placeholder="مثال: بروشور الرحلة / ترنيمة الشعار"></div>
          <input type="file" data-u="file" accept="image/*,audio/*,video/mp4,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt">
          <label class="chk"><input type="checkbox" data-u="poster"> ⭐ استخدمها كبوستر (للصور)</label>
          <small class="hint">لحد 10 ميجا: صور، PDF، صوت (MP3/M4A/WAV/OGG)، فيديو قصير MP4، Word / PowerPoint / Excel.</small>
          <button class="btn pri" type="button" data-u="up">⬆ رفع</button></div>
        <div class="sec"><h3>✍️ نص مكتوب (شعار / كلمات ترنيمة / تعليمات)</h3>
          <div class="field"><label>العنوان</label><input data-u="ttitle" maxlength="80" placeholder="مثال: شعار المؤتمر"></div>
          <textarea data-u="text" rows="5" maxlength="6000" placeholder="اكتب النص هنا..."></textarea>
          <button class="btn pri" type="button" data-u="save" style="margin-top:8px">💾 حفظ النص</button></div>`;
      m._items = items;
    };
    const load = async () => draw(await adm('attList', { key }, 60000));
    const after = r => { if (!r.ok) return toast(r.error, 'err'); if (r.trashCount !== undefined && typeof setTrashCount === 'function') setTrashCount(r.trashCount); draw(r); };
    body.addEventListener('click', async e => {
      if (busy) return;
      const u = e.target.closest('button[data-u]');
      if (u && u.dataset.u === 'up') {
        const f = body.querySelector('[data-u="file"]').files[0], t = body.querySelector('[data-u="title"]').value.trim();
        if (!f) return toast('اختار ملف الأول.', 'err');
        if (f.size > 10 * 1024 * 1024) return toast('الملف أكبر من 10 ميجا.', 'err');
        const data = await readFile(f).catch(() => null); if (!data) return toast('تعذر قراءة الملف.', 'err');
        busy = true; u.disabled = true; u.innerHTML = '<span class="spin"></span> جاري الرفع...';
        const r = await adm('attAdd', { key, title: t || f.name.replace(/\.[^.]+$/, ''), kind: 'file', data, fileName: f.name, poster: body.querySelector('[data-u="poster"]').checked }, 300000);
        busy = false; if (r.ok) toast('تم رفع الملف ✔', 'ok'); else { u.disabled = false; u.textContent = '⬆ رفع'; } return after(r);
      }
      if (u && u.dataset.u === 'save') {
        const t = body.querySelector('[data-u="ttitle"]').value.trim(), tx = body.querySelector('[data-u="text"]').value.trim();
        if (!t || !tx) return toast('اكتب العنوان والنص.', 'err');
        busy = true; u.disabled = true; const r = await adm('attAdd', { key, title: t, kind: 'text', text: tx }, 60000); busy = false;
        if (r.ok) toast('تم حفظ النص ✔', 'ok'); else u.disabled = false; return after(r);
      }
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const item = b.closest('[data-aid]'), a = (m._items || []).find(x => x.id === item.dataset.aid); if (!a) return;
      if (b.dataset.a === 'open') { b.disabled = true; const r = await attFetch(a.id, true); b.disabled = false; return showAtt(item.querySelector('[data-a="view"]'), a, r); }
      if (b.dataset.a === 'poster') { busy = true; const r = await adm('attUpdate', { id: a.id, poster: !a.poster }); busy = false; return after(r); }
      if (b.dataset.a === 'rename') { const t = await ask({ title: 'تغيير العنوان', msg: 'العنوان الجديد:', input: 'line', okText: 'حفظ' }); if (!t) return; busy = true; const r = await adm('attUpdate', { id: a.id, title: t }); busy = false; return after(r); }
      if (b.dataset.a === 'del') { if (!await ask({ title: 'حذف ملف', msg: `حذف «${a.title}»؟ (بيروح لسلة المحذوفات، والملف نفسه بيفضل في Drive)`, okText: 'حذف' })) return; busy = true; const r = await adm('attDelete', { id: a.id }); busy = false; if (r.ok) toast('تم الحذف', 'ok'); return after(r); }
    });
    load();
  }
  function showAtt(host, a, r) {
    if (!r || !r.ok) return toast((r && r.error) || 'تعذر تحميل الملف', 'err');
    if (a.kind === 'image') host.innerHTML = `<img class="prev" src="${r.data}" alt="">`;
    else if (a.kind === 'audio') host.innerHTML = `<audio controls preload="auto" src="${r.data}"></audio>`;
    else if (a.kind === 'video') host.innerHTML = `<video controls preload="metadata" src="${r.data}"></video>`;
    else host.innerHTML = '';
    host.insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:6px"><button class="btn sm gold" type="button" data-dl>⬇ تحميل</button>${a.kind === 'pdf' ? '<button class="btn sm" type="button" data-tab>↗ فتح في صفحة</button>' : ''}</div>`);
    host.querySelector('[data-dl]').onclick = () => saveData(r.data, r.fileName || a.fileName || a.title);
    const tb = host.querySelector('[data-tab]'); if (tb) tb.onclick = () => { const u = URL.createObjectURL(dataToBlob(r.data)); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); };
    const im = host.querySelector('img.prev'); if (im) im.onclick = () => { $1('#lbImg').src = r.data; $1('#lightbox').hidden = false; };
  }
  let decoSeq = 0;
  async function memDecorate() {
    if (!PM.token) return;
    const cards = $A('#memTrips .trip[data-id]').map(c => [c, 'trip']).concat($A('#memConf .trip[data-id]').map(c => [c, 'conf']));
    if (!cards.length || !(await probe())) return;
    const my = ++decoSeq, r = await mcall('attSummary');
    if (my !== decoSeq || !r.ok) return;
    cards.forEach(([card, type]) => {
      if (!card.isConnected) return;
      const key = type + ':' + card.dataset.id, s = r.items[key], native = card.querySelector('.tposter[data-poster]');
      if (s && s.poster && !card.querySelector('.tposter')) {
        const d = document.createElement('div'); d.className = 'tposter'; d.dataset.attposter = s.poster; d.textContent = '⏳ جاري تحميل البوستر...';
        card.insertBefore(d, card.firstChild); loadAttPoster(d);
      }
      if ((s && s.n) || native) {
        if (card.querySelector('.att-row')) return;
        const row = document.createElement('div'); row.className = 'att-row';
        row.innerHTML = (s && s.n ? `<button class="btn sm" type="button" data-matt="${esc(key)}">📎 ملفات ومرفقات (${s.n})</button>` : '') +
          (native ? `<button class="btn sm" type="button" data-mposter="${esc(card.dataset.id)}">⬇ تحميل البوستر</button>` : '');
        card.insertBefore(row, card.querySelector('.tstate'));
      }
    });
  }
  async function loadAttPoster(el) {
    const r = await attFetch(el.dataset.attposter, false);
    if (!el.isConnected) return;
    if (!r.ok) { el.remove(); return; }
    el.innerHTML = `<img src="${r.data}" alt="البوستر">`; el.onclick = () => { $1('#lbImg').src = r.data; $1('#lightbox').hidden = false; };
  }
  async function openAttMember(key, title) {
    const m = pModal('📎 ' + title, SPIN, '', { tag: 'member' }), body = m.q('.bd');
    const r = await mcall('attList', { key }, 60000);
    if (!r.ok) { body.innerHTML = `<div class="formerr">${esc(r.error)}</div>`; return; }
    body.innerHTML = r.items.map(a => `<div class="att-item" data-aid="${esc(a.id)}"><div class="top"><div><span class="att-ic">${KIND_IC[a.kind] || '📎'}</span> <b>${esc(a.title)}</b>
        ${a.kind !== 'text' ? `<br><small class="hint" style="display:inline">${esc(a.fileName)} · ${kb(a.size)}</small>` : ''}</div>
        <div class="acts">${a.kind === 'text' ? '<button class="btn sm" type="button" data-a="copy">📋 نسخ</button>' : `<button class="btn sm gold" type="button" data-a="open">${a.kind === 'audio' ? '▶ تشغيل' : a.kind === 'image' || a.kind === 'video' ? '👁 عرض' : '⬇ تحميل'}</button>`}</div></div>
        ${a.kind === 'text' ? `<div class="txt">${esc(a.text)}</div>` : ''}<div data-a="view"></div></div>`).join('') || '<div class="empty">مفيش ملفات.</div>';
    body.addEventListener('click', async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const item = b.closest('[data-aid]'), a = r.items.find(x => x.id === item.dataset.aid);
      if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(a.text); toast('اتنسخ ✔', 'ok'); } catch (er) { toast('انسخ النص يدوي', 'err'); } return; }
      b.disabled = true; b.innerHTML = '<span class="spin"></span>'; const x = await attFetch(a.id, false); b.disabled = false; b.textContent = '✔';
      if (a.kind === 'pdf' || a.kind === 'doc') { if (x.ok) saveData(x.data, x.fileName); }
      showAtt(item.querySelector('[data-a="view"]'), a, x);
    });
  }
  function onDocClick(e) {
    const a = e.target.closest('[data-att]');
    if (a && a.closest('#admTrips,#admConf')) return openAttAdmin(a.dataset.att, a.dataset.title || '');
    const b = e.target.closest('[data-matt]');
    if (b) { const card = b.closest('.trip'); return openAttMember(b.dataset.matt, ((card && card.querySelector('h4')) || {}).textContent || 'الملفات'); }
    const p = e.target.closest('[data-mposter]');
    if (p) {
      p.disabled = true;
      mcall('tripPoster', { id: p.dataset.mposter }, 60000).then(r => { p.disabled = false; if (!r.ok) return toast(r.error, 'err'); saveData(r.image, 'poster.' + ((/image\/(\w+)/.exec(r.image) || [])[1] || 'jpg').replace('jpeg', 'jpg')); });
    }
  }

  /* ---------------- التركيب ---------------- */
  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function init() {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    memInject(); admInject();
    document.addEventListener('click', onDocClick);
    try {
      if (typeof AUD_ACT !== 'undefined') Object.assign(AUD_ACT, { 'pay.plan.create': 'نظام أقساط جديد', 'pay.plan.update': 'تعديل نظام الأقساط', 'pay.cash': 'دفعة نقدي', 'pay.voucher': 'دفع بكوبون', 'pay.delete': 'حذف دفعة', 'vch.generate': 'توليد كوبونات', 'vch.void': 'إلغاء كوبون', 'att.add': 'إضافة ملف/مرفق', 'att.update': 'تعديل ملف/مرفق', 'att.delete': 'حذف ملف/مرفق' });
    } catch (e) {}
    const mp = $1('#memPortal');
    if (mp) {
      new MutationObserver(() => { if (mp.hidden) memReset(); else memRefresh(); }).observe(mp, { attributes: true, attributeFilter: ['hidden'] });
      if (!mp.hidden) memRefresh();
    }
    const md = debounce(memDecorate, 60), ad = debounce(admDecorate, 30);
    ['#memTrips', '#memConf'].forEach(sel => { const el = $1(sel); if (el) new MutationObserver(md).observe(el, { childList: true }); });
    ['#admTrips', '#admConf'].forEach(sel => { const el = $1(sel); if (el) new MutationObserver(ad).observe(el, { childList: true }); });
    const dash = $1('#admDash'); if (dash) new MutationObserver(() => { const c = $1('#admPay'); if (c && dash.hidden) { c.hidden = true; AP.key = ''; } }).observe(dash, { attributes: true, attributeFilter: ['hidden'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
