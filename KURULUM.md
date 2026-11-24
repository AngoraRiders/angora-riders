# Angora Riders – Grup Takip Sistemi · Kurulum Rehberi

Tek bir web uygulaması her yerde çalışır:

| Cihaz | Nasıl kullanılır |
|---|---|
| **Web** | Vercel adresi (ör. `https://angora-riders.vercel.app`) |
| **iPhone / iPad** | Safari → Paylaş → **Ana Ekrana Ekle** (uygulama gibi açılır) |
| **Windows** | Chrome / Edge → adres çubuğundaki **Yükle** simgesi (masaüstü uygulaması olur) |
| **Android** | APK (aşağıda 5. adım) ya da Chrome → **Uygulamayı yükle** |

Altyapı: **Supabase** (ücretsiz veritabanı + giriş sistemi + e-posta fonksiyonu) · **Vercel** (ücretsiz barındırma) · **Resend** (ücretsiz e-posta gönderimi).

---

## 1) Supabase – veritabanı (≈5 dk)

1. https://supabase.com → ücretsiz hesap → **New project** (Bölge: *Central EU (Frankfurt)*).
2. Sol menü **SQL Editor** → **New query** → `supabase/schema.sql` dosyasının tamamını yapıştırın → **Run**.
3. **Authentication → Sign In / Providers → Email**:
   - **Confirm email** → **KAPALI** (kullanıcı adlarıyla giriş yapıldığı için zorunlu)
   - **Allow new users to sign up** → **AÇIK** kalsın (kurucuların hesap açabilmesi için; dışarıdan açılan hesaplar onaysız/pasif kalır, hiçbir şey göremez)
4. **Project Settings → API**: *Project URL* ve *anon public* anahtarını kopyalayın.
5. `js/config.js` dosyasını açıp bu iki değeri yapıştırın.

## 2) Vercel – yayına alma (≈5 dk)

**Yol A – GitHub ile (önerilen, güncellemeler otomatik):**
1. https://github.com → yeni depo (private olabilir) → **Add file → Upload files** → bu klasördeki her şeyi sürükleyin.
2. https://vercel.com → GitHub ile giriş → **Add New → Project** → depoyu seçin → Framework: **Other** → **Deploy**.

**Yol B – Komut satırı:** Node.js kurun (https://nodejs.org), bu klasörde `npx vercel --prod` çalıştırın.

Çıkan adres (`https://....vercel.app`) sisteminizin adresidir. İsterseniz Vercel'den kendi alan adınızı bağlayabilirsiniz.

## 3) İlk giriş

Adresi açın → **İlk kurulum** ekranı gelir → ilk **Kurucu** hesabını oluşturun.
Sonra **Yetkiler** menüsünden diğer kurucuları ve yöneticileri ekleyin.

## 4) E-posta raporları → angorariders@gmail.com (≈10 dk)

Tüm raporlar (elle gönderilen ve gün sonu otomatik raporlar) **yalnızca angorariders@gmail.com** adresine gider. Alıcı sunucuda sabittir; uygulamadan değiştirilemez.

**a) Resend hesabı**
1. https://resend.com → **angorariders@gmail.com** adresiyle kayıt olun (önemli: bu adresle kaydolunca alan adı doğrulamadan bu adrese gönderim yapılabilir).
2. **API Keys → Create API Key** → anahtarı kopyalayın (`re_...`).

**b) Edge Function**
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Adı: `send-report` · içerik: `supabase/functions/send-report/index.ts` dosyasının tamamı → **Deploy**.
3. Fonksiyon ayarlarında **Verify JWT** seçeneğini **KAPATIN** (yetki kontrolünü fonksiyon kendisi yapar).
4. **Edge Functions → Secrets** bölümüne ekleyin:

| Ad | Değer |
|---|---|
| `RESEND_API_KEY` | Resend anahtarınız (`re_...`) |
| `CRON_SECRET` | Kendi belirleyeceğiniz uzun rastgele bir metin (ör. `ar-7f3k9q2m8x...`) |
| `APP_URL` | Vercel adresiniz (ör. `https://angora-riders.vercel.app`) – e-postada logo ve bağlantı için |
| `REPORT_EMAIL` | *(isteğe bağlı)* varsayılan zaten `angorariders@gmail.com` |

**c) Gün sonu otomatik rapor**
1. `supabase/cron.sql` dosyasında `PROJE-ID` ve `GIZLI-ANAHTAR` (= `CRON_SECRET`) değerlerini değiştirin.
2. SQL Editor'de çalıştırın. Artık her gün **23:30**'da, o gün biten her etkinliğin katılım raporu (katılanlar, katılmayanlar, oran, Excel eki) otomatik gelir. Etkinlik yoksa e-posta gönderilmez.
3. Ayarlar sayfasından otomatik rapor açılıp kapatılabilir.

**Elle rapor:** Raporlar sayfası → **E-postaya Gönder** (seçili tarih aralığı) · Etkinlik sayfası → **Raporu E-postala**.
Kurucular her zaman gönderebilir; yöneticiler yalnızca **"Raporu e-postaya gönderme"** yetkisi verilirse. Gönderilen tüm raporlar Raporlar sayfasının altında listelenir.

## 5) Android APK

1. https://www.pwabuilder.com → Vercel adresinizi yazın → **Package for stores → Android** → **Generate Package**.
2. İnen zip içindeki `.apk` dosyasını telefonlara kurun (WhatsApp grubuna atabilirsiniz; telefonda "bilinmeyen kaynaklara izin ver" gerekir).
3. Zip içindeki `assetlinks.json` dosyasını projede `.well-known/assetlinks.json` olarak ekleyip yeniden yayınlarsanız uygulama adres çubuğu olmadan tam ekran açılır.

Uygulama Vercel adresinizden çalıştığı için, siteyi güncellediğinizde APK'yı yeniden kurmanıza gerek yoktur.

---

## Roller ve yetkiler

- **Kurucu:** Tüm sisteme tam yetki. Hesap açar/siler, şifre belirler, yöneticilerin yetkilerini ayarlar. Son kurucu silinemez veya düşürülemez.
- **Yönetici:** Yalnızca kurucunun verdiği yetkiler. Her özellik ayrı ayrı açılıp kapatılabilir:

| Bölüm | Yetkiler |
|---|---|
| Ana Sayfa | Özet paneli görüntüleme |
| Üyeler | Görüntüleme · Hassas bilgiler (kan grubu, yakın telefonu, sağlık notu) · Ekleme · Düzenleme · Silme · Excel'e aktarma |
| Takvim | Görüntüleme · Program ekleme · Düzenleme · Silme |
| Katılım | Katılanları görme · Tik atma (yoklama) |
| Raporlar | Görüntüleme · Excel/PDF alma · E-postaya gönderme |
| Ayarlar | Grup adı, aktiflik eşikleri, otomatik rapor |

Yetkiler veritabanı düzeyinde (RLS) de uygulanır; arayüzü atlatsa bile yetkisiz kişi veriye erişemez.

## Aktiflik nasıl hesaplanır?

Katılım oranı = üyenin katıldığı etkinlik ÷ **gruba katılım tarihinden sonra** gerçekleşen etkinlik sayısı.
Varsayılan: **%60+ Aktif**, **%30–59 Orta**, **%30 altı Pasif** (Ayarlar'dan değiştirilebilir).
