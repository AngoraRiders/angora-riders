import { api, can, state, EVENT_TYPES, eventType, REPORT_EMAIL } from '../core.js';
import { icon, esc, $, $$, avatar, fmtShort, fmtDate, MONTHS, downloadCSV, dateOnly, emptyState, confirmDialog, toast } from '../ui.js';
import { computeStats, levelBadge, LEVELS } from '../stats.js';
import { levelBar } from './dashboard.js';

const ui = { preset: '3m', from: '', to: '', type: 'all', includeLeft: false, sort: 'rate', dir: -1 };

function presetRange(p) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (p) {
    case 'month': return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case 'lastmonth': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case '3m': return [new Date(y, m - 2, 1), new Date(y, m + 1, 1)];
    case '6m': return [new Date(y, m - 5, 1), new Date(y, m + 1, 1)];
    case 'year': return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    case 'lastyear': return [new Date(y - 1, 0, 1), new Date(y, 0, 1)];
    case 'all': return [null, null];
    default: return [ui.from ? new Date(ui.from) : null, ui.to ? new Date(new Date(ui.to).getTime() + 86400000) : null];
  }
}
const PRESETS = [['month', 'Bu ay'], ['lastmonth', 'Geçen ay'], ['3m', 'Son 3 ay'], ['6m', 'Son 6 ay'], ['year', 'Bu yıl'], ['lastyear', 'Geçen yıl'], ['all', 'Tümü'], ['custom', 'Özel']];

export async function render(el) {
  const [members, allEvents, attendance] = await Promise.all([api.members(), api.events(), api.allAttendance()]);

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Aktiflik Raporu</h1><p class="muted" id="range-label"></p></div>
      <div class="actions no-print">
        ${can('reports.export') ? `<button class="btn btn-ghost" id="csv">${icon('download')}<span>Excel</span></button>
        <button class="btn btn-ghost" id="print">${icon('printer')}<span>PDF / Yazdır</span></button>` : ''}
        ${can('reports.email') ? `<button class="btn btn-primary" id="mail">${icon('mail')}<span>E-postaya Gönder</span></button>` : ''}
      </div>
    </div>
    <div class="print-head"><img src="/assets/logo.png" alt=""><div><b>${esc(state.settings.group_name)}</b><span>Aktiflik Raporu · <span id="print-range"></span></span></div></div>
    <div class="card filters no-print">
      <div class="chips" id="presets">${PRESETS.map(([k, l]) => `<button data-v="${k}" class="chip ${ui.preset === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="filter-row">
        <label class="field inline ${ui.preset === 'custom' ? '' : 'dim'}"><span>Başlangıç</span><input type="date" id="from" value="${ui.from}"></label>
        <label class="field inline ${ui.preset === 'custom' ? '' : 'dim'}"><span>Bitiş</span><input type="date" id="to" value="${ui.to}"></label>
        <label class="field inline"><span>Etkinlik türü</span><select id="type"><option value="all">Tümü</option>
          ${Object.entries(EVENT_TYPES).map(([k, t]) => `<option value="${k}" ${ui.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="left" ${ui.includeLeft ? 'checked' : ''}><span>Ayrılan üyeleri dahil et</span></label>
      </div>
    </div>
    <div id="report"></div>
    <section class="card no-print" id="log-card" hidden>
      <header class="card-head"><h3>${icon('mail')} Gönderilen Raporlar <small>${esc(REPORT_EMAIL)}</small></h3>
        <span class="tag ${state.settings.auto_report ? 'ok' : 'ghost'}">${icon('clock')} Gün sonu otomatik rapor: ${state.settings.auto_report ? 'Açık' : 'Kapalı'}</span></header>
      <ul class="log-list" id="log"></ul>
    </section>`;

  const loadLog = async () => {
    try {
      const rows = await api.reportLog();
      $('#log-card', el).hidden = false;
      $('#log', el).innerHTML = rows.length ? rows.map(r => `
        <li class="${r.status === 'error' ? 'err' : ''}">
          <span class="log-ic">${icon(r.status === 'error' ? 'x' : r.kind === 'daily' ? 'clock' : 'mail')}</span>
          <span class="grow"><b>${esc(r.subject)}</b>
            <small>${fmtDate(r.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${esc(r.sent_by_name || '')}${r.status === 'error' ? ` · <span class="bad">Hata: ${esc(r.error || '')}</span>` : ''}</small></span>
          <span class="tag ghost">${{ daily: 'Otomatik', event: 'Etkinlik', period: 'Dönem' }[r.kind] || r.kind}</span>
        </li>`).join('') : '<li class="muted">Henüz rapor gönderilmedi.</li>';
    } catch { /* tablo yoksa gizli kalsın */ }
  };

  const draw = () => {
    const [from, to] = presetRange(ui.preset);
    const events = ui.type === 'all' ? allEvents : allEvents.filter(e => e.type === ui.type);
    const mem = ui.includeLeft ? members : members.filter(m => m.status === 'active');
    const st = computeStats({ members: mem, events, attendance, from, to });
    const label = from || to
      ? `${from ? fmtDate(from) : 'Başlangıç'} – ${to ? fmtDate(new Date(to.getTime() - 1)) : 'Bugün'}`
      : 'Tüm zamanlar';
    $('#range-label', el).textContent = `${label}${ui.type !== 'all' ? ' · ' + eventType(ui.type).label : ''}`;
    $('#print-range', el).textContent = $('#range-label', el).textContent;

    // aylık seri
    const monthly = new Map();
    for (const r of st.eventRows) {
      const d = new Date(r.event.start_at); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = monthly.get(k) || { events: 0, att: 0 };
      cur.events++; cur.att += r.count; monthly.set(k, cur);
    }
    const months = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const maxAtt = Math.max(1, ...months.map(([, v]) => v.att));

    const sorted = [...st.rows].sort((a, b) => {
      const f = { name: (r) => r.member.full_name, rate: (r) => r.rate, attended: (r) => r.attended, km: (r) => r.km, last: (r) => r.last || '', join: (r) => r.member.join_date || '' }[ui.sort];
      const x = f(a), y = f(b);
      return (typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y) * ui.dir || b.attended - a.attended;
    });
    const th = (k, l, cls = '') => `<th class="sortable ${cls} ${ui.sort === k ? 'sorted' : ''}" data-sort="${k}">${l}${ui.sort === k ? (ui.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;

    $('#report', el).innerHTML = `
      <section class="kpis">
        ${k('calendar', 'Etkinlik', st.totals.events, 'gerçekleşen')}
        ${k('users', 'Toplam Katılım', st.totals.attendance, 'kişi × etkinlik')}
        ${k('check', 'Etkinlik Başına', st.totals.avgPerEvent, 'ortalama katılımcı')}
        ${k('flame', 'Ort. Katılım Oranı', '%' + st.totals.avgRate, 'aktif üyeler')}
      </section>
      <div class="grid-2">
        <section class="card">
          <header class="card-head"><h3>${icon('chart')} Aylık Toplam Katılım</h3></header>
          ${months.length ? `<div class="bars" role="img" aria-label="Aylık katılım grafiği">
            ${months.map(([key, v]) => {
              const [yy, mm] = key.split('-');
              return `<div class="bar-col" tabindex="0">
                <div class="bar-tip"><b>${MONTHS[+mm - 1]} ${yy}</b>${v.att} katılım · ${v.events} etkinlik<br>Etkinlik başına ${Math.round(v.att / v.events * 10) / 10}</div>
                <span class="bar-val">${v.att}</span>
                <div class="bar-track"><i style="height:${Math.max(2, v.att / maxAtt * 100)}%"></i></div>
                <span class="bar-lbl">${MONTHS[+mm - 1].slice(0, 3)}${months.length > 6 ? '' : ' ' + yy.slice(2)}</span>
              </div>`;
            }).join('')}
          </div>` : emptyState('chart', 'Bu aralıkta etkinlik yok')}
        </section>
        <section class="card">
          <header class="card-head"><h3>${icon('users')} Üye Aktiflik Dağılımı</h3></header>
          ${levelBar(st.totals.levels)}
          <p class="muted sm" style="margin-top:12px">Oran = katıldığı etkinlik ÷ katılım tarihinden sonra gerçekleşen etkinlik. Eşikler Ayarlar sayfasından değiştirilebilir.</p>
        </section>
      </div>

      <section class="card table-card">
        <header class="card-head"><h3>${icon('users')} Üye Bazında Aktiflik</h3><small class="muted">${sorted.length} üye</small></header>
        ${sorted.length ? `<div class="table-scroll"><table class="table" id="mt">
          <thead><tr><th class="num">#</th>${th('name', 'Üye')}${th('join', 'Katılım Tarihi', 'hide-sm')}${th('attended', 'Katıldı', 'num')}<th class="num hide-sm">Fırsat</th>${th('rate', 'Oran')}${th('km', 'Km', 'num hide-sm')}${th('last', 'Son Katılım', 'hide-sm')}<th>Durum</th></tr></thead>
          <tbody>${sorted.map((r, i) => `<tr data-href="#/members/${r.member.id}" class="${r.member.status === 'left' ? 'is-left' : ''}">
            <td class="num muted">${i + 1}</td>
            <td><div class="cell-user">${avatar(r.member, 'xs')}<b>${esc(r.member.full_name)}</b></div></td>
            <td class="hide-sm">${fmtShort(r.member.join_date)}</td>
            <td class="num"><b>${r.attended}</b></td>
            <td class="num hide-sm muted">${r.eligible}</td>
            <td><div class="rate-cell"><div class="bar"><i style="width:${r.rate}%"></i></div><span>%${r.rate}</span></div></td>
            <td class="num hide-sm">${r.km.toLocaleString('tr-TR')}</td>
            <td class="hide-sm">${r.last ? fmtShort(r.last) : '—'}</td>
            <td>${levelBadge(r.level)}</td>
          </tr>`).join('')}</tbody></table></div>` : emptyState('users', 'Üye yok')}
      </section>

      <section class="card table-card">
        <header class="card-head"><h3>${icon('calendar')} Etkinlik Bazında Katılım</h3><small class="muted">${st.eventRows.length} etkinlik</small></header>
        ${st.eventRows.length ? `<div class="table-scroll"><table class="table">
          <thead><tr><th>Tarih</th><th>Etkinlik</th><th class="hide-sm">Tür</th><th class="num hide-sm">Km</th><th class="num">Katılımcı</th><th>Oran</th></tr></thead>
          <tbody>${st.eventRows.map(r => `<tr data-href="#/events/${r.event.id}">
            <td>${fmtShort(r.event.start_at)}</td>
            <td><b>${esc(r.event.title)}</b></td>
            <td class="hide-sm"><span class="tag" style="--c:${eventType(r.event.type).color}">${eventType(r.event.type).label}</span></td>
            <td class="num hide-sm">${r.event.distance_km ?? '—'}</td>
            <td class="num"><b>${r.count}</b></td>
            <td><div class="rate-cell"><div class="bar"><i style="width:${r.rate}%"></i></div><span>%${r.rate}</span></div></td>
          </tr>`).join('')}</tbody></table></div>` : emptyState('calendar', 'Bu aralıkta gerçekleşmiş etkinlik yok')}
      </section>`;

    $$('th[data-sort]', el).forEach(h => h.onclick = () => {
      if (ui.sort === h.dataset.sort) ui.dir *= -1; else { ui.sort = h.dataset.sort; ui.dir = h.dataset.sort === 'name' ? 1 : -1; }
      draw();
    });
    $$('tr[data-href]', el).forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });

    const csvBtn = $('#csv', el);
    if (csvBtn) csvBtn.onclick = () => {
      const rows = [
        [`${state.settings.group_name} - Aktiflik Raporu`], [label], [],
        ['Üye', 'Katılım Tarihi', 'Durum', 'Katıldığı', 'Katılabileceği', 'Oran (%)', 'Km', 'Son Katılım', 'Aktiflik'],
        ...sorted.map(r => [r.member.full_name, fmtShort(r.member.join_date), r.member.status === 'active' ? 'Aktif' : 'Ayrıldı', r.attended, r.eligible, r.rate, r.km, r.last ? fmtShort(r.last) : '', LEVELS[r.level].label]),
        [], ['Tarih', 'Etkinlik', 'Tür', 'Km', 'Katılımcı', 'Oran (%)'],
        ...st.eventRows.map(r => [fmtShort(r.event.start_at), r.event.title, eventType(r.event.type).label, r.event.distance_km ?? '', r.count, r.rate]),
      ];
      downloadCSV(`angora-riders-rapor-${dateOnly(new Date())}.csv`, rows);
    };

    const mailBtn = $('#mail', el);
    if (mailBtn) mailBtn.onclick = async () => {
      const ok = await confirmDialog('Raporu e-postaya gönder', `"${label}${ui.type !== 'all' ? ' · ' + eventType(ui.type).label : ''}" aktiflik raporu ${REPORT_EMAIL} adresine gönderilecek.`, { danger: false, submitText: 'Gönder' });
      if (!ok) return;
      mailBtn.disabled = true; mailBtn.classList.add('loading');
      try {
        await api.sendReport({ mode: 'period', from: from && from.toISOString(), to: to && to.toISOString(), type: ui.type, includeLeft: ui.includeLeft, label });
        toast(`Rapor ${REPORT_EMAIL} adresine gönderildi`);
      } catch (e) { toast(e.message, 'err'); }
      finally { mailBtn.disabled = false; mailBtn.classList.remove('loading'); loadLog(); }
    };
  };
  loadLog();

  $$('#presets .chip', el).forEach(c => c.onclick = () => {
    ui.preset = c.dataset.v;
    $$('#presets .chip', el).forEach(x => x.classList.toggle('on', x === c));
    $$('.filter-row .field', el).slice(0, 2).forEach(f => f.classList.toggle('dim', ui.preset !== 'custom'));
    draw();
  });
  const custom = () => { ui.from = $('#from', el).value; ui.to = $('#to', el).value; ui.preset = 'custom';
    $$('#presets .chip', el).forEach(x => x.classList.toggle('on', x.dataset.v === 'custom'));
    $$('.filter-row .field', el).slice(0, 2).forEach(f => f.classList.remove('dim')); draw(); };
  $('#from', el).onchange = custom; $('#to', el).onchange = custom;
  $('#type', el).onchange = (e) => { ui.type = e.target.value; draw(); };
  $('#left', el).onchange = (e) => { ui.includeLeft = e.target.checked; draw(); };
  const pr = $('#print', el); if (pr) pr.onclick = () => window.print();
  draw();
}

const k = (ic, label, value, sub) => `<div class="kpi"><div class="kpi-ic">${icon(ic)}</div><div><span class="kpi-label">${label}</span><b class="kpi-value">${value}</b><small>${sub}</small></div></div>`;
