# HASENAT — bütün Arapça yazılar (önizleme dalı)

**Durum: ÖNİZLEME / CANLI YAYIN DEĞİL.**

Çalışmanın bilimsel ve ticari olmayan niteliği kullanıcı tarafından teyit edildi.

Gönderilen özgün `hasenat.ttf` dosyasının metaverisi:
- Font ailesi: **HASENAT**, Regular
- Sürüm: **1.00 (31.01.2016)**
- SHA-256: `1d37c471fcd5afc126a925c1b18f7727fa944692558a17c12da890abd8ae384c`
- Arapça yazı desteği: doğrulandı
- Dosyada FontCreator Home Edition kaynaklı ticari kullanım kısıtı notu bulunuyor.

Fontun **yayınlanması/yeniden dağıtılması** ile kullanıcı cihazında kurulu fontun **görünmesi** farklı işlemlerdir. Font yaratımına ilişkin araç lisansı tek başına Hasenat fontunun yeniden dağıtım izni sayılmaz. Bu nedenle bu dalda **font dosyası yoktur**; yalnız `local("HASENAT")` kaynağı çağrılır.

## Uygulama
- `assets/hasenat-arabic.css` ortak stil dosyasına bağlanır.
- Ana site, sûre sayfaları, Esmâ, benzeşenler, kelime/kavram ve yönetici ekranı Arapça alanları HASENAT'ı öncelikli kullanır.
- HASENAT yazı tipi Windows/macOS cihazında yüklüyse tarayıcı onu kullanabilir. Diğer cihazlarda Amiri Quran/Amiri yedekleri kullanılacaktır. Tüm ziyaretçilere birebir aynı font görünümü **henüz garanti edilmez**.
- Türkçe ve İngilizce yazı tipleri değişmez.
- Kuran ayetleri, benzeşme matrisi ve GitHub yönetici düzeltme kayıtlarına dokunulmaz.
- Özel 2/3/4 çalışma alanı GitHub Pages'te yayınlanmamalıdır; yerel programda aynı HASENAT font seçimi yapılır.

## Koruma
Önce arayüz görsel/işlev testleri ve font dağıtım yetkisi kontrolü. `main` dalına otomatik birleştirme yok.
