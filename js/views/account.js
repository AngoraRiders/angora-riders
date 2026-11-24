import { api, state, PERMISSION_GROUPS, isFounder, can } from '../core.js';
import { icon, esc, $, toast, initials } from '../ui.js';

export async function render(el) {
  const p = state.profile;
  el.innerHTML = `
    <section class="profile-hero">
      <span class="avatar xl ${isFounder() ? 'gold' : ''}">${esc(initials(p.full_name || p.username))}</span>
      <div class="ph-body">
        <div class="ph-badges">${isFounder() ? `<span class="tag gold">${icon('crown')} Kurucu</span>` : `<span class="tag">${icon('shield')} Yönetici</span>`}</div>
        <h1>${esc(p.full_name || p.username)}</h1>
        <p class="muted">@${esc(p.username)}</p>
      </div>
      <div class="ph-actions"><button class="btn btn-ghost" id="out">${icon('logout')}<span>Çıkış Yap</span></button></div>
    </section>
    <div class="grid-2">
      <form class="card" id="pw">
        <header class="card-head"><h3>${icon('key')} Şifre Değiştir</h3></header>
        <label class="field"><span>Yeni şifre</span><input name="p1" type="password" minlength="6" autocomplete="new-password" required></label>
        <label class="field"><span>Yeni şifre (tekrar)</span><input name="p2" type="password" minlength="6" autocomplete="new-password" required></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Şifreyi Güncelle</button></div>
      </form>
      <section class="card">
        <header class="card-head"><h3>${icon('shield')} Yetkilerim</h3></header>
        ${isFounder() ? '<p class="muted">Kurucu olarak sistemin tüm özelliklerine tam yetkilisiniz.</p>' : `
        <ul class="my-perms">
          ${PERMISSION_GROUPS.flatMap(g => g.perms.map(([k, l]) => `<li class="${can(k) ? 'yes' : 'no'}">${icon(can(k) ? 'check' : 'x')}<span>${g.label} · ${l}</span></li>`)).join('')}
        </ul>`}
      </section>
    </div>
    <section class="card install">
      <header class="card-head"><h3>${icon('download')} Uygulamayı Cihaza Yükle</h3></header>
      <div class="install-grid">
        <div><b>iPhone / iPad</b><p class="muted sm">Safari'de açın → Paylaş düğmesi → <b>Ana Ekrana Ekle</b>.</p></div>
        <div><b>Windows / Mac</b><p class="muted sm">Chrome veya Edge'de adres çubuğundaki <b>Yükle</b> simgesine tıklayın.</p></div>
        <div><b>Android</b><p class="muted sm">Grubun APK dosyasını kurun ya da Chrome menüsü → <b>Uygulamayı yükle</b>.</p></div>
      </div>
      <button class="btn btn-primary" id="install" hidden>${icon('download')} Şimdi Yükle</button>
    </section>`;

  $('#out', el).onclick = () => api.signOut();
  $('#pw', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value !== f.p2.value) return toast('Şifreler eşleşmiyor.', 'err');
    try { await api.changeOwnPassword(f.p1.value); f.reset(); toast('Şifreniz güncellendi'); }
    catch (err) { toast(err.message, 'err'); }
  });
  const btn = $('#install', el);
  if (window.__installPrompt) {
    btn.hidden = false;
    btn.onclick = async () => { window.__installPrompt.prompt(); await window.__installPrompt.userChoice; window.__installPrompt = null; btn.hidden = true; };
  }
}
