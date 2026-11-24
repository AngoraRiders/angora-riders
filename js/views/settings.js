import { api, state, REPORT_EMAIL } from '../core.js';
import { icon, esc, $, toast } from '../ui.js';

export async function render(el) {
  const s = state.settings;
  el.innerHTML = `
    <div class="page-head"><div><h1>Ayarlar</h1><p class="muted">Grup bilgileri ve aktiflik hesaplama kuralları</p></div></div>
    <form class="card settings-form" id="sf">
      <header class="card-head"><h3>${icon('settings')} Genel</h3></header>
      <label class="field"><span>Grup adı</span><input name="group_name" value="${esc(s.group_name)}" required></label>
      <header class="card-head" style="margin-top:12px"><h3>${icon('flame')} Aktiflik Eşikleri</h3></header>
      <p class="muted sm">Üyenin katılım oranı, katılım tarihinden sonra gerçekleşen etkinliklerin yüzde kaçına geldiğidir.</p>
      <div class="form-grid">
        <label class="field"><span>Aktif sayılmak için en az (%)</span><input name="active_threshold" type="number" min="1" max="100" value="${s.active_threshold}" required></label>
        <label class="field"><span>Bu oranın altı Pasif (%)</span><input name="passive_threshold" type="number" min="0" max="99" value="${s.passive_threshold}" required></label>
      </div>
      <div class="threshold-preview" id="tp"></div>
      <header class="card-head" style="margin-top:12px"><h3>${icon('mail')} E-posta Raporları</h3></header>
      <label class="perm" style="padding:12px 0">
        <span><b>Gün sonu otomatik rapor</b><small>Her gün 23:30'da, o gün biten her etkinliğin katılım raporu <b>${esc(REPORT_EMAIL)}</b> adresine gönderilir.</small></span>
        <span class="switch"><input type="checkbox" name="auto_report" ${s.auto_report !== false ? 'checked' : ''}><i></i></span>
      </label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Kaydet</button></div>
    </form>`;
  const f = $('#sf', el);
  const preview = () => {
    const a = +f.active_threshold.value || 0, p = +f.passive_threshold.value || 0;
    $('#tp', el).innerHTML = `
      <span class="lv lv-passive"><i></i>Pasif: %0 – %${Math.max(0, p - 1)}</span>
      <span class="lv lv-mid"><i></i>Orta: %${p} – %${Math.max(p, a - 1)}</span>
      <span class="lv lv-active"><i></i>Aktif: %${a} – %100</span>`;
  };
  f.addEventListener('input', preview); preview();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = +f.active_threshold.value, p = +f.passive_threshold.value;
    if (p >= a) return toast('Pasif eşiği, aktif eşiğinden küçük olmalı.', 'err');
    try {
      state.settings = await api.saveSettings({ group_name: f.group_name.value.trim(), active_threshold: a, passive_threshold: p, auto_report: f.auto_report.checked });
      toast('Ayarlar kaydedildi');
    } catch (err) { toast(err.message, 'err'); }
  });
}
