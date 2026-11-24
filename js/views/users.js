import { api, state, PERMISSION_GROUPS, ALL_PERMS } from '../core.js';
import { icon, esc, $, $$, modal, toast, confirmDialog, initials, fmtShort } from '../ui.js';

const PRESETS = {
  view: { label: 'Sadece görüntüleme', perms: ['dashboard.view', 'members.view', 'events.view', 'attendance.view', 'reports.view'] },
  roll: { label: 'Yoklamacı', perms: ['dashboard.view', 'events.view', 'attendance.view', 'attendance.mark'] },
  org:  { label: 'Etkinlik sorumlusu', perms: ['dashboard.view', 'members.view', 'events.view', 'events.create', 'events.edit', 'attendance.view', 'attendance.mark'] },
  all:  { label: 'Tüm yetkiler', perms: ALL_PERMS },
};

export async function render(el) {
  const profiles = await api.profiles();
  const me = state.profile.id;
  const founders = profiles.filter(p => p.role === 'founder');
  const admins = profiles.filter(p => p.role === 'admin');

  const card = (p) => `
    <div class="user-card ${p.active ? '' : 'inactive'}">
      <span class="avatar ${p.role === 'founder' ? 'gold' : ''}">${esc(initials(p.full_name || p.username))}</span>
      <div class="grow">
        <b>${esc(p.full_name || p.username)} ${p.id === me ? '<span class="tag ghost">Siz</span>' : ''}</b>
        <small>@${esc(p.username)} · ${fmtShort(p.created_at)}</small>
        <div class="uc-tags">
          ${p.role === 'founder' ? `<span class="tag gold">${icon('crown')} Kurucu · Tam yetki</span>` : `<span class="tag">${icon('shield')} Yönetici · ${p.permissions.length}/${ALL_PERMS.length} yetki</span>`}
          ${p.active ? '' : '<span class="tag warn">Pasif / onay bekliyor</span>'}
        </div>
      </div>
      <div class="uc-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">${icon('edit')}<span>${p.role === 'admin' ? 'Yetkiler' : 'Düzenle'}</span></button>
        <button class="icon-btn" data-pw="${p.id}" title="Şifre belirle">${icon('key')}</button>
        ${p.id !== me ? `<button class="icon-btn danger" data-del="${p.id}" title="Hesabı sil">${icon('trash')}</button>` : ''}
      </div>
    </div>`;

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Yetki Yönetimi</h1><p class="muted">Kurucular tüm sisteme tam yetkilidir. Yöneticiler yalnızca kurucuların verdiği yetkilere sahiptir.</p></div>
      <div class="actions"><button class="btn btn-primary" id="add">${icon('plus')}<span>Hesap Oluştur</span></button></div>
    </div>
    <section class="card">
      <header class="card-head"><h3>${icon('crown')} Kurucular <small>${founders.length}</small></h3></header>
      <div class="user-list">${founders.map(card).join('')}</div>
    </section>
    <section class="card">
      <header class="card-head"><h3>${icon('shield')} Yöneticiler <small>${admins.length}</small></h3></header>
      <div class="user-list">${admins.length ? admins.map(card).join('') : '<p class="muted">Henüz yönetici yok. "Hesap Oluştur" ile ekleyebilirsiniz.</p>'}</div>
    </section>`;

  const reload = () => render(el);
  $('#add', el).onclick = async () => { if (await accountForm(null)) reload(); };
  $$('[data-edit]', el).forEach(b => b.onclick = async () => { if (await accountForm(profiles.find(p => p.id === b.dataset.edit))) reload(); });
  $$('[data-pw]', el).forEach(b => b.onclick = async () => {
    const p = profiles.find(x => x.id === b.dataset.pw);
    await modal({
      title: `Şifre belirle · ${p.full_name || p.username}`,
      body: `<label class="field"><span>Yeni şifre</span><input name="pw" type="text" minlength="6" required autocomplete="off"></label>
             <p class="muted sm">Kişiye yeni şifresini iletin; giriş yaptıktan sonra Hesabım sayfasından değiştirebilir.</p>`,
      onSubmit: async (d) => { await api.setPassword(p.id, d.pw); toast('Şifre güncellendi'); },
    });
  });
  $$('[data-del]', el).forEach(b => b.onclick = async () => {
    const p = profiles.find(x => x.id === b.dataset.del);
    if (!await confirmDialog('Hesabı sil', `${p.full_name || p.username} hesabı kalıcı olarak silinecek. Bu kişi artık sisteme giriş yapamaz. (Üye kayıtları etkilenmez.)`, { submitText: 'Hesabı sil' })) return;
    try { await api.deleteAccount(p.id); toast('Hesap silindi'); reload(); } catch (e) { toast(e.message, 'err'); }
  });
}

function permMatrix(selected) {
  return `
    <div class="perm-presets"><span class="muted sm">Hazır şablon:</span>
      ${Object.entries(PRESETS).map(([k, v]) => `<button type="button" class="chip" data-preset="${k}">${v.label}</button>`).join('')}
      <button type="button" class="chip" data-preset="none">Temizle</button>
    </div>
    <div class="perm-grid">
      ${PERMISSION_GROUPS.map(g => `
        <div class="perm-group" data-group="${g.key}">
          <header>${icon(g.icon)}<b>${g.label}</b>
            <label class="switch sm" title="Bu bölümün tümü"><input type="checkbox" data-all="${g.key}"><i></i></label></header>
          ${g.perms.map(([key, label, desc]) => `
            <label class="perm">
              <span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>
              <span class="switch"><input type="checkbox" name="perm" value="${key}" ${selected.includes(key) ? 'checked' : ''}><i></i></span>
            </label>`).join('')}
        </div>`).join('')}
    </div>`;
}

function accountForm(p) {
  const isNew = !p;
  const isMe = p?.id === state.profile.id;
  const role = p?.role || 'admin';
  return modal({
    title: isNew ? 'Yeni Hesap' : `${p.full_name || p.username}`,
    wide: true,
    submitText: isNew ? 'Hesabı Oluştur' : 'Kaydet',
    body: `
      <div class="form-grid">
        <label class="field"><span>Ad Soyad *</span><input name="full_name" value="${esc(p?.full_name || '')}" required></label>
        <label class="field"><span>Kullanıcı adı ${isNew ? '*' : ''}</span><input name="username" value="${esc(p?.username || '')}" ${isNew ? 'required pattern="[a-zA-Z0-9._\\-]{3,30}" title="3-30 karakter: harf, rakam, nokta, tire" autocapitalize="none"' : 'disabled'}></label>
        ${isNew ? '<label class="field"><span>Şifre *</span><input name="password" type="text" minlength="6" required autocomplete="off"></label>' : ''}
        ${!isNew && !isMe ? `<label class="field"><span>Hesap durumu</span><select name="active">
          <option value="true" ${p.active ? 'selected' : ''}>Aktif — giriş yapabilir</option>
          <option value="false" ${!p.active ? 'selected' : ''}>Pasif — giriş engelli</option></select></label>` : ''}
      </div>
      <div class="field"><span>Rol</span>
        <div class="role-pick">
          <label><input type="radio" name="role" value="admin" ${role === 'admin' ? 'checked' : ''} ${isMe ? 'disabled' : ''}>
            <div>${icon('shield')}<b>Yönetici</b><small>Sadece aşağıda seçtiğiniz yetkilere sahip olur</small></div></label>
          <label><input type="radio" name="role" value="founder" ${role === 'founder' ? 'checked' : ''} ${isMe ? 'disabled' : ''}>
            <div>${icon('crown')}<b>Kurucu</b><small>Tüm sisteme tam yetki, yöneticileri yönetir</small></div></label>
        </div>
      </div>
      <div id="perm-wrap">${permMatrix(p?.permissions || PRESETS.view.perms)}</div>
      <div id="founder-note" class="hint gold">${icon('crown')} Kurucular tüm özelliklere tam yetkilidir; ayrıca yetki seçimi gerekmez.</div>`,
    onOpen: (wrap) => {
      const syncRole = () => {
        const r = $('input[name=role]:checked', wrap)?.value || role;
        $('#perm-wrap', wrap).hidden = r === 'founder';
        $('#founder-note', wrap).hidden = r !== 'founder';
      };
      const syncAll = () => $$('[data-all]', wrap).forEach(a => {
        const boxes = $$(`[data-group="${a.dataset.all}"] input[name=perm]`, wrap);
        a.checked = boxes.every(b => b.checked); a.indeterminate = !a.checked && boxes.some(b => b.checked);
      });
      $$('input[name=role]', wrap).forEach(r => r.onchange = syncRole);
      $$('[data-all]', wrap).forEach(a => a.onchange = () => { $$(`[data-group="${a.dataset.all}"] input[name=perm]`, wrap).forEach(b => b.checked = a.checked); });
      // Bir yetki, çalışması için gereken görüntüleme yetkisini de açar
      const DEPENDS = {
        'members.sensitive': 'members.view', 'members.edit': 'members.view', 'members.delete': 'members.view', 'members.export': 'members.view',
        'events.create': 'events.view', 'events.edit': 'events.view', 'events.delete': 'events.view',
        'attendance.mark': 'attendance.view', 'reports.export': 'reports.view', 'reports.email': 'reports.view',
      };
      $$('input[name=perm]', wrap).forEach(b => b.addEventListener('change', () => {
        if (b.checked && DEPENDS[b.value]) { const dep = $(`input[name=perm][value="${DEPENDS[b.value]}"]`, wrap); if (dep) dep.checked = true; }
        if (!b.checked) Object.entries(DEPENDS).forEach(([k, v]) => { if (v === b.value) { const x = $(`input[name=perm][value="${k}"]`, wrap); if (x) x.checked = false; } });
        syncAll();
      }));
      $$('[data-preset]', wrap).forEach(c => c.onclick = () => {
        const set = c.dataset.preset === 'none' ? [] : PRESETS[c.dataset.preset].perms;
        $$('input[name=perm]', wrap).forEach(b => b.checked = set.includes(b.value));
        syncAll();
      });
      syncRole(); syncAll();
    },
    onSubmit: async (d, form) => {
      const perms = $$('input[name=perm]:checked', form).map(b => b.value);
      const newRole = isMe ? p.role : d.role;
      if (isNew) {
        await api.createAccount({ username: d.username.trim().toLowerCase(), full_name: d.full_name.trim(), password: d.password, role: newRole, permissions: newRole === 'founder' ? [] : perms });
        toast('Hesap oluşturuldu');
      } else {
        const patch = { full_name: d.full_name.trim(), role: newRole, permissions: newRole === 'founder' ? p.permissions : perms };
        if (!isMe && d.active !== undefined) patch.active = d.active === 'true';
        await api.updateProfile(p.id, patch);
        toast('Hesap güncellendi');
      }
      return true;
    },
  });
}
