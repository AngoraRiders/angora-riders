import { api, can, canAny, eventType, REPORT_EMAIL } from '../core.js';
import { icon, esc, $, $$, avatar, fmtDateTime, fmtTime, fmtDate, relativeDays, confirmDialog, toast, debounce, emptyState } from '../ui.js';
import { openEventForm } from './calendar.js';

export async function render(el, { id }, ctx) {
  const ev = await api.event(id);
  if (!ev) { el.innerHTML = emptyState('calendar', 'Etkinlik bulunamadı', '', '<a class="btn btn-ghost" href="#/calendar">Takvime dön</a>'); return; }
  ctx.setTitle(ev.title);
  const t = eventType(ev.type);
  const showAtt = canAny('attendance.view', 'attendance.mark');
  const canMark = can('attendance.mark');
  const [members, att] = showAtt ? await Promise.all([api.members(), api.attendance(id)]) : [[], []];
  const present = new Set(att.map(a => a.member_id));
  const evDay = new Date(ev.start_at); evDay.setHours(23, 59, 59, 999);
  // Yoklama listesi: aktif üyeler + (ayrılmış olsa da) işaretlenmiş olanlar
  const roster = members.filter(m => (m.status === 'active' && (!m.join_date || new Date(m.join_date) <= evDay)) || present.has(m.id));
  const mapsQ = ev.meeting_point || ev.location;
  const isFuture = new Date(ev.start_at) > new Date();
  let q = '';
  let filter = 'all';

  el.innerHTML = `
    <a href="#/calendar" class="back">${icon('chevL')} Takvim</a>
    <section class="event-hero" style="--c:${t.color}">
      <div class="eh-date"><b>${new Date(ev.start_at).getDate()}</b><span>${fmtDate(ev.start_at, { month: 'short' })}</span><small>${fmtDate(ev.start_at, { weekday: 'short' })}</small></div>
      <div class="eh-body">
        <div class="ph-badges"><span class="tag" style="--c:${t.color}">${t.label}</span><span class="tag ghost">${relativeDays(ev.start_at)}</span></div>
        <h1>${esc(ev.title)}</h1>
        <ul class="eh-meta">
          <li>${icon('clock')} ${fmtDateTime(ev.start_at)}${ev.end_at ? ` – ${fmtDate(ev.end_at, { day: 'numeric', month: 'short' }) !== fmtDate(ev.start_at, { day: 'numeric', month: 'short' }) ? fmtDate(ev.end_at, { day: 'numeric', month: 'short' }) + ' ' : ''}${fmtTime(ev.end_at)}` : ''}</li>
          ${ev.meeting_point ? `<li>${icon('users')} Toplanma: <b>${esc(ev.meeting_point)}</b></li>` : ''}
          ${ev.location ? `<li>${icon('pin')} ${esc(ev.location)}</li>` : ''}
          ${ev.distance_km ? `<li>${icon('route')} ${ev.distance_km} km</li>` : ''}
        </ul>
      </div>
      <div class="ph-actions">
        ${mapsQ ? `<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQ)}">${icon('pin')}<span>Harita</span></a>` : ''}
        ${can('reports.email') && !isFuture ? `<button class="btn btn-ghost" id="mail">${icon('mail')}<span>Raporu E-postala</span></button>` : ''}
        ${can('events.edit') ? `<button class="btn btn-ghost" id="edit">${icon('edit')}<span>Düzenle</span></button>` : ''}
        ${can('events.delete') ? `<button class="btn btn-ghost danger" id="del">${icon('trash')}<span>Sil</span></button>` : ''}
      </div>
    </section>
    ${ev.description ? `<section class="card"><header class="card-head"><h3>${icon('info')} Açıklama</h3></header><p class="pre">${esc(ev.description)}</p></section>` : ''}

    ${showAtt ? `
    <section class="card attendance">
      <header class="card-head att-head">
        <h3>${icon('check')} Katılım ${canMark ? '<small>dokunarak işaretleyin</small>' : ''}</h3>
        <div class="att-counter"><b id="cnt">0</b><span>/ ${roster.length}</span><small id="pct"></small></div>
      </header>
      <div class="att-progress"><i id="prog"></i></div>
      ${isFuture && canMark ? `<p class="hint">${icon('info')} Bu etkinlik henüz gerçekleşmedi. Katılım bilgisini etkinlik günü işaretleyebilirsiniz.</p>` : ''}
      <div class="toolbar">
        <label class="search">${icon('search')}<input id="aq" placeholder="Üye ara…"></label>
        <div class="seg-ctl" id="af">
          <button data-v="all" class="on">Tümü</button><button data-v="in">Gelenler</button><button data-v="out">Gelmeyenler</button>
        </div>
        ${canMark ? `<button class="btn btn-ghost btn-sm" id="all-on">${icon('check')}<span>Tümünü işaretle</span></button>
        <button class="btn btn-ghost btn-sm" id="all-off">${icon('x')}<span>Temizle</span></button>` : ''}
        <button class="btn btn-ghost btn-sm" id="share">${icon('download')}<span>Listeyi paylaş</span></button>
      </div>
      <ul class="att-list ${canMark ? 'markable' : ''}" id="alist"></ul>
    </section>` : ''}`;

  const updateCounter = () => {
    const n = roster.filter(m => present.has(m.id)).length;
    $('#cnt', el).textContent = n;
    const pct = roster.length ? Math.round(n / roster.length * 100) : 0;
    $('#pct', el).textContent = `%${pct}`;
    $('#prog', el).style.width = pct + '%';
  };

  const drawList = () => {
    const ql = q.toLocaleLowerCase('tr-TR');
    const rows = roster.filter(m =>
      (!ql || [m.full_name, m.nickname].some(v => v && v.toLocaleLowerCase('tr-TR').includes(ql))) &&
      (filter === 'all' || (filter === 'in') === present.has(m.id)));
    $('#alist', el).innerHTML = rows.length ? rows.map(m => `
      <li class="${present.has(m.id) ? 'on' : ''}" data-id="${m.id}" ${canMark ? 'role="checkbox" tabindex="0" aria-checked="' + present.has(m.id) + '"' : ''}>
        ${avatar(m, 'sm')}
        <span class="grow"><b>${esc(m.full_name)}</b>${m.nickname ? `<small>${esc(m.nickname)}</small>` : ''}</span>
        <span class="tick">${icon('check')}</span>
      </li>`).join('') : `<li class="none">${roster.length ? 'Eşleşen üye yok' : 'Aktif üye yok'}</li>`;
  };

  if (showAtt) {
    updateCounter(); drawList();
    const toggle = async (li) => {
      const mid = li.dataset.id; if (!mid) return;
      const on = !present.has(mid);
      on ? present.add(mid) : present.delete(mid);
      li.classList.toggle('on', on); li.setAttribute('aria-checked', on); updateCounter();
      if (navigator.vibrate) navigator.vibrate(12);
      try { await api.mark(id, mid, on); }
      catch (e) { on ? present.delete(mid) : present.add(mid); li.classList.toggle('on', !on); updateCounter(); toast(e.message, 'err'); }
    };
    if (canMark) {
      $('#alist', el).addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (li) toggle(li); });
      $('#alist', el).addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('li[data-id]')) { e.preventDefault(); toggle(e.target); } });
      $('#all-on', el).onclick = async () => {
        const ids = roster.filter(m => !present.has(m.id)).map(m => m.id);
        if (!ids.length) return;
        try { await api.markMany(id, ids, true); ids.forEach(i => present.add(i)); updateCounter(); drawList(); toast(`${ids.length} üye işaretlendi`); }
        catch (e) { toast(e.message, 'err'); }
      };
      $('#all-off', el).onclick = async () => {
        const ids = [...present];
        if (!ids.length) return;
        if (!await confirmDialog('Katılımı temizle', `${ids.length} üyenin işareti kaldırılacak.`, { submitText: 'Temizle' })) return;
        try { await api.markMany(id, ids, false); present.clear(); updateCounter(); drawList(); toast('Katılım temizlendi'); }
        catch (e) { toast(e.message, 'err'); }
      };
    }
    $('#aq', el).addEventListener('input', debounce((e) => { q = e.target.value; drawList(); }, 100));
    $$('#af button', el).forEach(b => b.onclick = () => { filter = b.dataset.v; $$('#af button', el).forEach(x => x.classList.toggle('on', x === b)); drawList(); });
    $('#share', el).onclick = async () => {
      const names = roster.filter(m => present.has(m.id)).map((m, i) => `${i + 1}. ${m.full_name}`);
      const text = `🏍️ ${ev.title}\n📅 ${fmtDateTime(ev.start_at)}\n\nKatılanlar (${names.length}):\n${names.join('\n') || '-'}\n\nAngora Riders`;
      try {
        if (navigator.share) await navigator.share({ title: ev.title, text });
        else { await navigator.clipboard.writeText(text); toast('Liste panoya kopyalandı'); }
      } catch { /* kullanıcı vazgeçti */ }
    };
  }

  $('#mail', el)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!await confirmDialog('Etkinlik raporunu gönder', `"${ev.title}" katılım raporu ${REPORT_EMAIL} adresine gönderilecek.`, { danger: false, submitText: 'Gönder' })) return;
    btn.disabled = true; btn.classList.add('loading');
    try { await api.sendReport({ mode: 'event', eventId: id }); toast(`Rapor ${REPORT_EMAIL} adresine gönderildi`); }
    catch (err) { toast(err.message, 'err'); }
    finally { btn.disabled = false; btn.classList.remove('loading'); }
  });
  $('#edit', el)?.addEventListener('click', async () => { if (await openEventForm(ev)) render(el, { id }, ctx); });
  $('#del', el)?.addEventListener('click', async () => {
    if (!await confirmDialog('Etkinliği sil', `"${ev.title}" ve bu etkinliğe ait katılım kayıtları silinecek.`, { submitText: 'Sil' })) return;
    try { await api.deleteEvent(id); toast('Etkinlik silindi'); ctx.navigate('calendar'); }
    catch (e) { toast(e.message, 'err'); }
  });
}
