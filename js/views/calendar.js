import { api, can, canAny, EVENT_TYPES, eventType } from '../core.js';
import { icon, esc, $, $$, modal, toast, pad, MONTHS, DAYS_SHORT, fmtTime, fmtDate, dateOnly, emptyState } from '../ui.js';

let cur = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
let mode = 'month';

export async function render(el, _p, ctx) {
  const showAtt = canAny('attendance.view', 'attendance.mark');

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Takvim</h1><p class="muted">Sürüşler, toplantılar ve grup programları</p></div>
      <div class="actions">
        <div class="seg-ctl" id="mode">
          <button data-v="month" class="${mode === 'month' ? 'on' : ''}">${icon('grid')}<span>Ay</span></button>
          <button data-v="list" class="${mode === 'list' ? 'on' : ''}">${icon('list')}<span>Liste</span></button>
        </div>
        ${can('events.create') ? `<button class="btn btn-primary" id="add">${icon('plus')}<span>Program Ekle</span></button>` : ''}
      </div>
    </div>
    <div class="card cal-card">
      <div class="cal-nav">
        <button class="icon-btn" id="prev" aria-label="Önceki ay">${icon('chevL')}</button>
        <h2 id="cal-title"></h2>
        <button class="icon-btn" id="next" aria-label="Sonraki ay">${icon('chevR')}</button>
        <button class="btn btn-ghost btn-sm" id="today">Bugün</button>
      </div>
      <div id="cal-body"><div class="loader"><span></span></div></div>
    </div>
    <div class="type-legend">${Object.values(EVENT_TYPES).map(t => `<span><i class="dot" style="--c:${t.color}"></i>${t.label}</span>`).join('')}</div>`;

  const draw = async () => {
    $('#cal-title', el).textContent = `${MONTHS[cur.m]} ${cur.y}`;
    const body = $('#cal-body', el);
    const first = new Date(cur.y, cur.m, 1);
    const startOffset = (first.getDay() + 6) % 7;            // Pazartesi başlangıç
    const gridStart = new Date(cur.y, cur.m, 1 - startOffset);
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridEnd.getDate() + 42);
    const from = mode === 'month' ? gridStart : first;
    const to = mode === 'month' ? gridEnd : new Date(cur.y, cur.m + 1, 1);
    const events = await api.events(from.toISOString(), to.toISOString());
    let counts = new Map();
    if (showAtt && events.length) {
      const att = await api.allAttendance();
      const ids = new Set(events.map(e => e.id));
      for (const a of att) if (ids.has(a.event_id)) counts.set(a.event_id, (counts.get(a.event_id) || 0) + 1);
    }
    const byDay = new Map();
    for (const e of events) { const k = dateOnly(e.start_at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
    const todayKey = dateOnly(new Date());

    if (mode === 'month') {
      let cells = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart); d.setDate(d.getDate() + i);
        const k = dateOnly(d);
        const evs = byDay.get(k) || [];
        cells += `<div class="cal-cell ${d.getMonth() !== cur.m ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${can('events.create') ? 'can-add' : ''}" data-day="${k}">
          <span class="cal-day">${d.getDate()}</span>
          <div class="cal-evs">
            ${evs.slice(0, 3).map(e => `<a class="cal-ev" href="#/events/${e.id}" style="--c:${eventType(e.type).color}" title="${esc(e.title)}">
              <span class="t">${fmtTime(e.start_at)}</span> ${esc(e.title)}${counts.get(e.id) ? ` <b class="cnt">${counts.get(e.id)}</b>` : ''}</a>`).join('')}
            ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} daha</span>` : ''}
          </div>
          <div class="cal-dots">${evs.map(e => `<i style="--c:${eventType(e.type).color}"></i>`).join('')}</div>
        </div>`;
      }
      body.innerHTML = `<div class="cal-grid">${DAYS_SHORT.map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
        <div id="day-detail" class="day-detail"></div>`;
      $$('.cal-cell', body).forEach(c => c.addEventListener('click', (e) => {
        if (e.target.closest('.cal-ev')) return;
        const k = c.dataset.day;
        const evs = byDay.get(k) || [];
        // mobilde gün detayını göster, masaüstünde boş güne tıklayınca ekle
        if (window.matchMedia('(max-width: 760px)').matches) {
          $$('.cal-cell', body).forEach(x => x.classList.toggle('sel', x === c));
          showDay(k, evs, counts);
        } else if (!evs.length && can('events.create')) {
          openEventForm(null, k).then(ev => ev && ctx.navigate('events/' + ev.id));
        } else {
          $$('.cal-cell', body).forEach(x => x.classList.toggle('sel', x === c));
          showDay(k, evs, counts);
        }
      }));
      if (cur.y === new Date().getFullYear() && cur.m === new Date().getMonth() && window.matchMedia('(max-width: 760px)').matches) {
        $(`.cal-cell[data-day="${todayKey}"]`, body)?.classList.add('sel');
        showDay(todayKey, byDay.get(todayKey) || [], counts);
      }
    } else {
      body.innerHTML = events.length ? `<ul class="agenda">${events.map(e => agendaItem(e, counts)).join('')}</ul>`
        : emptyState('calendar', 'Bu ay program yok', '', can('events.create') ? `<button class="btn btn-primary btn-sm" data-add>${icon('plus')} Program Ekle</button>` : '');
      $('[data-add]', body)?.addEventListener('click', add);
    }
  };

  const showDay = (k, evs, counts) => {
    const box = $('#day-detail', el);
    box.innerHTML = `
      <div class="dd-head"><b>${fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
        ${can('events.create') ? `<button class="btn btn-primary btn-sm" data-add-day>${icon('plus')} Ekle</button>` : ''}</div>
      ${evs.length ? `<ul class="agenda">${evs.map(e => agendaItem(e, counts)).join('')}</ul>` : '<p class="muted sm">Bu gün için program yok.</p>'}`;
    $('[data-add-day]', box)?.addEventListener('click', () => openEventForm(null, k).then(ev => ev && ctx.navigate('events/' + ev.id)));
  };

  const add = () => openEventForm(null, cur.m === new Date().getMonth() && cur.y === new Date().getFullYear() ? dateOnly(new Date()) : `${cur.y}-${pad(cur.m + 1)}-01`)
    .then(ev => ev && ctx.navigate('events/' + ev.id));

  $('#prev', el).onclick = () => { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } draw(); };
  $('#next', el).onclick = () => { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } draw(); };
  $('#today', el).onclick = () => { const d = new Date(); cur = { y: d.getFullYear(), m: d.getMonth() }; draw(); };
  $$('#mode button', el).forEach(b => b.onclick = () => { mode = b.dataset.v; $$('#mode button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#add', el)?.addEventListener('click', add);
  await draw();
}

function agendaItem(e, counts) {
  const t = eventType(e.type);
  const d = new Date(e.start_at);
  const past = d < new Date();
  return `<li><a href="#/events/${e.id}" class="ag ${past ? 'past' : ''}" style="--c:${t.color}">
    <div class="ag-date"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)}</span></div>
    <div class="ag-body"><span class="tag" style="--c:${t.color}">${t.label}</span><h4>${esc(e.title)}</h4>
      <p>${icon('clock')} ${fmtTime(e.start_at)}${e.end_at ? '–' + fmtTime(e.end_at) : ''}${e.location ? ` · ${icon('pin')} ${esc(e.location)}` : ''}${e.distance_km ? ` · ${icon('route')} ${e.distance_km} km` : ''}</p></div>
    ${counts.has(e.id) ? `<div class="ag-count">${icon('users')}<b>${counts.get(e.id)}</b></div>` : ''}
  </a></li>`;
}

// ---------------------------------------------------------------------
// Etkinlik ekleme / düzenleme formu
// ---------------------------------------------------------------------
export function openEventForm(ev, day) {
  const e = ev || {};
  const start = ev ? new Date(ev.start_at) : null;
  const dateVal = start ? dateOnly(start) : day;
  const timeVal = start ? `${pad(start.getHours())}:${pad(start.getMinutes())}` : '09:00';
  const endVal = ev?.end_at ? `${pad(new Date(ev.end_at).getHours())}:${pad(new Date(ev.end_at).getMinutes())}` : '';
  const endDateVal = ev?.end_at ? dateOnly(ev.end_at) : '';
  return modal({
    title: ev ? 'Programı Düzenle' : 'Yeni Program',
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field span-2"><span>Başlık *</span><input name="title" value="${esc(e.title || '')}" placeholder="ör. Pazar sabah kahvaltı sürüşü" required></label>
        <div class="field span-2"><span>Tür</span>
          <div class="type-pick">${Object.entries(EVENT_TYPES).map(([k, t]) => `
            <label style="--c:${t.color}"><input type="radio" name="type" value="${k}" ${(e.type || 'ride') === k ? 'checked' : ''}><span>${t.label}</span></label>`).join('')}
          </div></div>
        <label class="field"><span>Tarih *</span><input name="date" type="date" value="${esc(dateVal)}" required></label>
        <label class="field"><span>Başlangıç saati *</span><input name="time" type="time" value="${timeVal}" required></label>
        <label class="field"><span>Bitiş tarihi</span><input name="end_date" type="date" value="${esc(endDateVal)}"></label>
        <label class="field"><span>Bitiş saati</span><input name="end_time" type="time" value="${endVal}"></label>
        <label class="field"><span>Toplanma noktası</span><input name="meeting_point" value="${esc(e.meeting_point || '')}" placeholder="ör. Eymir Gölü girişi"></label>
        <label class="field"><span>Varış / Konum</span><input name="location" value="${esc(e.location || '')}" placeholder="ör. Beypazarı"></label>
        <label class="field"><span>Mesafe (km)</span><input name="distance_km" type="number" min="0" step="1" value="${esc(e.distance_km ?? '')}"></label>
        <label class="field span-2"><span>Açıklama / Rota notları</span><textarea name="description" rows="3">${esc(e.description || '')}</textarea></label>
      </div>`,
    onSubmit: async (d) => {
      const start_at = new Date(`${d.date}T${d.time}`);
      let end_at = null;
      if (d.end_time || d.end_date) {
        end_at = new Date(`${d.end_date || d.date}T${d.end_time || '23:59'}`);
        if (end_at < start_at) throw new Error('Bitiş zamanı başlangıçtan önce olamaz.');
      }
      const row = await api.saveEvent(ev?.id, {
        title: d.title.trim(), type: d.type || 'ride', start_at: start_at.toISOString(), end_at: end_at && end_at.toISOString(),
        meeting_point: d.meeting_point.trim() || null, location: d.location.trim() || null,
        distance_km: d.distance_km === '' ? null : Number(d.distance_km), description: d.description.trim() || null,
      });
      toast(ev ? 'Program güncellendi' : 'Program takvime eklendi');
      return row;
    },
  });
}
