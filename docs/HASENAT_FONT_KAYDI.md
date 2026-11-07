# Hasenat Arapça yazı tipi — kaynak ve uygulama kaydı

Proje: ayatulkuran · Musmur0606/konkordans-veri  
Kayıt tarihi: 7 Kasım 2026  
Kapsam: Arapça görünüm. Âyet metni, harekeler, Türkçe meal ve benzeşen veri setleri değiştirilmez.

## Kolay bulma

- Asıl font: `assets/fonts/hasenat.ttf`
- Ortak görünüm: `amiri-site.css` (mevcut sûre sayfalarının bağlantılarını korumak için dosya adı değiştirilmedi)
- Yönetim ekranı: `mutesabih-admin.html`
- İlgili kavram kaydı: [KAVRAMLAR_CALISMA_KAYDI.md](KAVRAMLAR_CALISMA_KAYDI.md)
- Kabul / açık kontrol bilgisi: [HASENAT_KAVRAMLAR_KONTROL_20261107.json](HASENAT_KAVRAMLAR_KONTROL_20261107.json)

## Kaynak kimliği

Kullanıcının sağladığı `hasenat(1).ttf` dosyası, önceki özgün `hasenat.ttf` dosyasıyla byte düzeyinde aynıdır.

- SHA-256: `1d37c471fcd5afc126a925c1b18f7727fa944692558a17c12da890abd8ae384c`
- Boyut: 512.196 bayt
- Dahili aile ve PostScript adı: HASENAT
- Sürüm: Version 1.00 January 31, 2016, initial release
- Dosya değiştirilmez; alt kümeye ayrılmaz, başka fontla taklit edilmez.

## Kullanım kaydı

Kullanıcı çalışmanın bilimsel ve ticari olmayan çalışma olduğunu belirtmiştir. Özgün dosyanın dahili lisans alanında ticari kullanıma izin verilmediği yazılıdır. Bu kayıt ve özgün fontun lisans alanları korunur. Teknik gömme bayrağı `fsType=0`, tek başına hukuki lisans veya yeniden dağıtım izni kanıtı olarak yorumlanmaz; ayrı bir Hasenat yeniden dağıtım lisansı doğrulanmış değildir. Ticari kullanım kararı için bu uygulama kaydı yeterli değildir.

## Uygulama

Ortak CSS içindeki `AyatulKuran Hasenat` yüzü aynı sitedeki özgün TTF'yi yükler. Bilgisayarda fontun kurulu olmasına bağlı değildir. Arapça Unicode aralıklarında kullanılır; Türkçe harfler ve genel arayüz fontu değiştirilmez. Arapça dışındaki boşluklar yedek fonttan gelebilir; kaynak metin değiştirilmez. Font yüklenemezse Amiri / serif yedeği vardır.

Mevcut 228 sûre/alternatif sayfa ve ortak CSS'ye bağlı özel sayfalar korunur. Önceden ortak CSS bağlantısı olmayan kelime-kavram deneme sayfasına bağlantı eklenmiştir. Sesli giriş, ayrı 2/3/4 kayıt yolu ve portalın veri okuma mantığı font değişikliğinden bağımsızdır.

Eski `feat/hasenat-arapca-tum-site-20261107` dalı ve #4 taslak isteği bütünüyle birleştirilmemiştir. Bu dal eski panel kodu içerdiğinden güncel uygulama yerine geçirilmemelidir.

### R2 — daha büyük Arapça yazı

7 Kasım 2026 kullanıcı talebiyle yalnız Arapça okuma alanlarının boyutu büyütülmüştür. Boyutların tek kaynağı `amiri-site.css` dosyasıdır; bağlantı sürümü `hasenat-2`, site/önbellek sürümü `2.8.22` olur. Özgün TTF'nin SHA-256 değeri aynıdır. Türkçe metinler, genel düğmeler, klavye harf düğmeleri ve karma dildeki `#term` kutusunun boyutu değiştirilmez.

| Arapça alan | Masaüstü / dar ekran |
| --- | --- |
| Ana âyet | 44 / 38 px |
| Benzeşen âyet | 32 / 30 px |
| Admin seçili âyet | 40 / 36 px |
| Kavram kutusu ve kavram kayıtları | 36 / 34 px |
| Günün âyeti / Esmâ âyetleri | 35 / 32 px |
| Sûre okuma sayfası | 38 / 35 px |

Kesin test/yayın durumu: [R2 kontrol noktası](HASENAT_KAVRAM_DOSYA_R2_20261107.json).

### Yeni ana metin kararı — R2 görünüm değişikliğinden ayrı

Kullanıcı 7 Kasım 2026 tarihinde Diyanet tabanlı `KURAN_HASENAT_YAZIMI.txt` dosyasını yeni ana metin kaynağı olarak belirledi. Girdi 1.337.706 bayttır; SHA-256 değeri `90469b1ff1e5414872ba529efccd9bbec375b9f8fd094f70a5a2e1043afe6f9a` olarak yeniden okunup doğrulanmıştır. Kaynak beyanı: Diyanet İşleri Başkanlığı, `https://kuran.diyanet.gov.tr/mushaf` ve `https://github.com/alperenugus/Kuran`.

Bu karar font dosyasının değişmesi değildir. Kullanıcı metni Hasenat'a özgü dişli hemze gösterimi için U+067E (`پ`) karakteri içerebilir. Bu kod, başka fontta farklı görünür; sessizce standart bir Arapça harfe dönüştürülmemelidir. Arama, kopyalama, sağ tık kavram aktarımı ve kaynak konumları birlikte sınanmadan ana uygulama metni değiştirilmez. R2 yalnız boyut/dosya ekleme sürümüdür; bu yeni ana metin henüz R2'nin `app_data.json` dosyasına uygulanmamıştır.

Kullanıcının 41 örneğin aynı olduğu beyanı korunur; 41 örneğin tamamına ait karşılaştırma kanıtı bu çalışma ortamında yoktur. Eldeki 5:117 ve 5:119 düz metin örnekleri, ham karakter dizisi ile Unicode eşdeğerliği ayrı tutularak denetlenir. Ham dosya aynen korunur. Önceki kaynakların silinmesi veya kabul kayıtlarının yeniden yazılması yapılmaz.

Sonraki güvenli adım: tam dosyanın sûre/âyet envanteri, özgün Hasenat fontuyla özel karakterli örneklerin görünümü ve kaynak-konum geçişi doğrulanarak ayrı bir ana metin sürümü hazırlanması. Diyanet'in bağımsız yeniden dağıtım koşulları doğrulanmış kabul edilmez; kullanıcının bilimsel/ticari olmayan kullanım beyanı ve kaynak gösterme talebi korunur.

## Doğrulama sınırları

FontTools + HarfBuzz + Pillow/RAQM kontrolünde 6.236 âyetin 73 farklı karakterinde eksik karakter bulunmamıştır. Altı gerçek âyet örneğinde eksik glif yoktur; masaüstü ve dar ekran örnekleri çizilmiştir. Bunlar gerçek Chrome/Windows CSS, HTTP ve pano/mikrofon testi yerine geçmez.

Gerçek tarayıcıda kullanıcı kabulü: sayfayı Ctrl+F5 ile yenileyin, Arapça yazının görünümünü ve seçim yapılabildiğini kontrol edin. Yayın ve test kanıtlarının kesin durumu eşlik eden kontrol noktasında tutulur.
