import { api, can, BLOOD_TYPES } from '../core.js';
import { icon, esc, $, $$, avatar, fmtShort, memberSince, modal, toast, downloadCSV, resizeImage, debounce, emptyState, dateOnly, telLink } from '../ui.js';
import { computeStats, levelBadge, LEVELS } from '../stats.js';

let ui = { q: '', status: 'active', level: 'all', view: localStorageGet('ar-members-view', 'grid') };

function localStorageGet(k, d) { try { return localStorage.getItem(k) || d; } catch { return d; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* yok say */ } }

export async function render(el, _p, ctx) {
  const [members, events, attendance] = await Promise.all([api.members(), api.events(), api.allAttendance()]);
  const st = computeStats({ members, events, attendance });
  const statsById = new Map(st.rows.map(r => [r.member.id, r]));

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Üyeler</h1><p class="muted">${members.filter(m => m.status === 'active').length} aktif üye · ${members.length} toplam kayıt</p></div>
      <div class="actions">
        ${can('members.export') ? `<button class="btn btn-ghost" id="export">${icon('download')}<span>Excel</span></button>` : ''}
        ${can('members.create') ? `<button class="btn btn-primary" id="add">${icon('plus')}<span>Üye Ekle</span></button>` : ''}
      </div>
    </div>
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="q" placeholder="İsim, takma ad, telefon, plaka ara…" value="${esc(ui.q)}"></label>
      <div class="seg-ctl" id="status">
        ${[['active', 'Aktif'], ['left', 'Ayrılan'], ['all', 'Tümü']].map(([v, l]) => `<button data-v="${v}" class="${ui.status === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <select id="level" class="select-sm">
        <option value="all">Tüm aktiflik seviyeleri</option>
        ${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}" ${ui.level === k ? 'selected' : ''}>${v.label}</option>`).join('')}
      </select>
      <div class="seg-ctl" id="viewmode">
        <button data-v="grid" class="${ui.view === 'grid' ? 'on' : ''}" title="Kart">${icon('grid')}</button>
        <button data-v="list" class="${ui.view === 'list' ? 'on' : ''}" title="Liste">${icon('list')}</button>
      </div>
    </div>
    <div id="list"></div>`;

  const draw = () => {
    const q = ui.q.trim().toLocaleLowerCase('tr-TR');
    const rows = members.filter(m =>
      (ui.status === 'all' || m.status === ui.status) &&
      (ui.level === 'all' || statsById.get(m.id)?.level === ui.level) &&
      (!q || [m.full_name, m.nickname, m.phone, m.plate, m.motorcycle, m.city].some(v => v && v.toLocaleLowerCase('tr-TR').includes(q))));
    const list = $('#list', el);
    if (!rows.length) {
      list.innerHTML = emptyState('users', members.length ? 'Sonuç bulunamadı' : 'Henüz üye yok',
        members.length ? 'Arama ya da filtreleri değiştirin.' : 'İlk üyeyi ekleyerek başlayın.',
        !members.length && can('members.create') ? `<button class="btn btn-primary" data-add>${icon('plus')} Üye Ekle</button>` : '');
      $('[data-add]', list)?.addEventListener('click', add);
      return;
    }
    if (ui.view === 'grid') {
      list.innerHTML = `<div class="member-grid">${rows.map(m => {
        const s = statsById.get(m.id);
        return `<a class="member-card ${m.status === 'left' ? 'is-left' : ''}" href="#/members/${m.id}">
          <div class="mc-top">${avatar(m, 'lg')}${levelBadge(s.level)}</div>
          <h4>${esc(m.full_name)}</h4>
          <p class="muted sm">${m.nickname ? `“${esc(m.nickname)}”` : '&nbsp;'}</p>
          <div class="mc-meta">
            <span>${icon('bike')}${esc(m.motorcycle || '—')}</span>
            <span>${icon('calendar')}${memberSince(m.join_date) || '—'}</span>
          </div>
          <div class="mc-rate"><div class="bar"><i style="width:${s.rate}%"></i></div><small>%${s.rate} · ${s.attended}/${s.eligible}</small></div>
        </a>`;
      }).join('')}</div>`;
    } else {
      list.innerHTML = `<div class="card table-card"><table class="table">
        <thead><tr><th>Üye</th><th class="hide-sm">Telefon</th><th class="hide-sm">Motosiklet</th><th class="hide-sm">Katılım Tarihi</th><th>Oran</th><th>Durum</th></tr></thead>
        <tbody>${rows.map(m => {
          const s = statsById.get(m.id);
          return `<tr data-href="#/members/${m.id}" class="${m.status === 'left' ? 'is-left' : ''}">
            <td><div class="cell-user">${avatar(m, 'sm')}<div><b>${esc(m.full_name)}</b>${m.nickname ? `<small>${esc(m.nickname)}</small>` : ''}</div></div></td>
            <td class="hide-sm">${telLink(m.phone)}</td>
            <td class="hide-sm">${esc(m.motorcycle || '—')}${m.plate ? ` <small class="muted">${esc(m.plate)}</small>` : ''}</td>
            <td class="hide-sm">${fmtShort(m.join_date)}</td>
            <td><div class="rate-cell"><div class="bar"><i style="width:${s.rate}%"></i></div><span>%${s.rate}</span></div></td>
            <td>${levelBadge(s.level)}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
      $$('tr[data-href]', list).forEach(tr => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
    }
  };

  const add = async () => {
    const saved = await openMemberForm(null);
    if (saved) ctx.navigate('members/' + saved.id);
  };

  $('#q', el).addEventListener('input', debounce((e) => { ui.q = e.target.value; draw(); }, 120));
  $$('#status button', el).forEach(b => b.onclick = () => { ui.status = b.dataset.v; $$('#status button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $$('#viewmode button', el).forEach(b => b.onclick = () => { ui.view = b.dataset.v; localStorageSet('ar-members-view', ui.view); $$('#viewmode button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#level', el).onchange = (e) => { ui.level = e.target.value; draw(); };
  $('#add', el)?.addEventListener('click', add);
  $('#export', el)?.addEventListener('click', async () => {
    let priv = new Map();
    if (can('members.sensitive')) priv = new Map((await api.allPrivate()).map(p => [p.member_id, p]));
    const head = ['Ad Soyad', 'Takma Ad', 'Telefon', 'E-posta', 'Doğum Tarihi', 'Katılım Tarihi', 'Şehir', 'Motosiklet', 'Plaka', 'Durum', 'Katılım Oranı (%)', 'Katıldığı Etkinlik', 'Aktiflik'];
    if (can('members.sensitive')) head.push('Kan Grubu', 'Yakını', 'Yakınlık', 'Yakın Telefonu');
    const rows = members.map(m => {
      const s = statsById.get(m.id);
      const r = [m.full_name, m.nickname, m.phone, m.email, fmtShort(m.birth_date), fmtShort(m.join_date), m.city, m.motorcycle, m.plate,
        m.status === 'active' ? 'Aktif' : 'Ayrıldı', s.rate, s.attended, LEVELS[s.level].label];
      if (can('members.sensitive')) { const p = priv.get(m.id) || {}; r.push(p.blood_type, p.emergency_name, p.emergency_relation, p.emergency_phone); }
      return r;
    });
    downloadCSV(`angora-riders-uyeler-${dateOnly(new Date())}.csv`, [head, ...rows]);
  });
  draw();
}

// ---------------------------------------------------------------------
// Üye ekleme / düzenleme formu
// ---------------------------------------------------------------------
export async function openMemberForm(member, priv = null) {
  const m = member || { join_date: dateOnly(new Date()), status: 'active' };
  const p = priv || {};
  const sens = can('members.sensitive');
  let photo = m.photo || null;
  const v = (k) => esc(m[k] ?? '');
  return modal({
    title: member ? 'Üyeyi Düzenle' : 'Yeni Üye',
    wide: true,
    body: `
      <div class="photo-pick">
        <label class="photo-drop" id="photo-drop">
          ${photo ? `<img src="${esc(photo)}" alt="">` : icon('camera')}
          <input type="file" accept="image/*" id="photo-in" hidden>
        </label>
        <div><b>Profil fotoğrafı</b><p class="muted sm">Kare olarak kırpılır ve küçültülür.</p>
          <button type="button" class="btn btn-ghost btn-sm" id="photo-clear" ${photo ? '' : 'hidden'}>Fotoğrafı kaldır</button></div>
      </div>
      <h5 class="form-sec">Kişisel Bilgiler</h5>
      <div class="form-grid">
        <label class="field span-2"><span>Ad Soyad *</span><input name="full_name" value="${v('full_name')}" required></label>
        <label class="field"><span>Takma ad / Lakap</span><input name="nickname" value="${v('nickname')}"></label>
        <label class="field"><span>Şehir</span><input name="city" value="${v('city')}"></label>
        <label class="field"><span>Telefon</span><input name="phone" type="tel" value="${v('phone')}" placeholder="05xx xxx xx xx"></label>
        <label class="field"><span>E-posta</span><input name="email" type="email" value="${v('email')}"></label>
        <label class="field"><span>Doğum tarihi</span><input name="birth_date" type="date" value="${v('birth_date')}"></label>
        <label class="field"><span>Gruba katılım tarihi *</span><input name="join_date" type="date" value="${v('join_date')}" required></label>
      </div>
      <h5 class="form-sec">Motosiklet</h5>
      <div class="form-grid">
        <label class="field"><span>Marka / Model</span><input name="motorcycle" value="${v('motorcycle')}" placeholder="ör. Yamaha MT-07"></label>
        <label class="field"><span>Plaka</span><input name="plate" value="${v('plate')}" placeholder="06 ABC 123"></label>
      </div>
      ${sens ? `
      <h5 class="form-sec danger">${icon('heart')} Acil Durum & Sağlık</h5>
      <div class="form-grid">
        <label class="field"><span>Kan grubu</span><select name="blood_type"><option value="">Seçiniz</option>
          ${BLOOD_TYPES.map(b => `<option ${p.blood_type === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
        <label class="field"><span>Yakınının adı</span><input name="emergency_name" value="${esc(p.emergency_name || '')}"></label>
        <label class="field"><span>Yakınlık derecesi</span><input name="emergency_relation" value="${esc(p.emergency_relation || '')}" placeholder="Eşi, annesi, kardeşi…"></label>
        <label class="field"><span>Yakınının telefonu</span><input name="emergency_phone" type="tel" value="${esc(p.emergency_phone || '')}"></label>
        <label class="field span-2"><span>Sağlık notu (alerji, ilaç vb.)</span><input name="health_notes" value="${esc(p.health_notes || '')}"></label>
      </div>` : ''}
      <h5 class="form-sec">Diğer</h5>
      <div class="form-grid">
        <label class="field"><span>Üyelik durumu</span><select name="status">
          <option value="active" ${m.status === 'active' ? 'selected' : ''}>Aktif üye</option>
          <option value="left" ${m.status === 'left' ? 'selected' : ''}>Gruptan ayrıldı</option></select></label>
        <label class="field span-2"><span>Notlar</span><textarea name="notes" rows="2">${v('notes')}</textarea></label>
      </div>`,
    onOpen: (wrap) => {
      const inp = $('#photo-in', wrap), drop = $('#photo-drop', wrap), clr = $('#photo-clear', wrap);
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        try { photo = await resizeImage(f); drop.innerHTML = `<img src="${photo}" alt="">`; drop.appendChild(inp); clr.hidden = false; }
        catch (e) { toast(e.message, 'err'); }
      });
      clr.addEventListener('click', () => { photo = null; drop.innerHTML = icon('camera'); drop.appendChild(inp); clr.hidden = true; });
    },
    onSubmit: async (d) => {
      const nn = (x) => (x && String(x).trim()) || null;
      const data = {
        full_name: d.full_name.trim(), nickname: nn(d.nickname), city: nn(d.city), phone: nn(d.phone), email: nn(d.email),
        birth_date: nn(d.birth_date), join_date: d.join_date, motorcycle: nn(d.motorcycle), plate: nn(d.plate) && d.plate.toLocaleUpperCase('tr-TR'),
        status: d.status, notes: nn(d.notes), photo,
      };
      const privData = sens ? { blood_type: nn(d.blood_type), emergency_name: nn(d.emergency_name), emergency_relation: nn(d.emergency_relation),
        emergency_phone: nn(d.emergency_phone), health_notes: nn(d.health_notes) } : null;
      const row = await api.saveMember(member?.id, data, privData);
      toast(member ? 'Üye güncellendi' : 'Üye eklendi');
      return row;
    },
  });
}
