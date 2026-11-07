# Ayatülkuran — 2/3/4 ayrı çalışma kaydı — R234 R1

Tarih: 7 Kasım 2026 (Türkiye)
Standart: Tüm Projeler İçin Kalıcı Hafıza ve Kesintisiz Devir Standardı V1
Depo: Musmur0606/konkordans-veri
Panel: https://www.ayatulkuran.com/mutesabih-admin.html
Başlangıç main commit: 3a0c08fbba3da25e7529351c954347c56863737c
Başlangıç Git tree: afec4bacf15138feaa1f811e6901804bc50d0584

## Bağlayıcı kullanıcı kararı

- Yeni uygulama veya ayrı giriş ekranı yok. Mevcut admin paneli ve ses düğmesi kullanılır.
- ANA sûre Bakara (2), Âl-i İmrân (3) veya Nisâ (4) olduğunda kayıt yeri otomatik ayrılır.
- Bu üç sûrede başlangıç benzeşen listesi BOŞTUR. Motor önerileri ve Word ilişkileri çalışma listesine kopyalanmaz.
- Yalnız kullanıcının bu çalışma dosyasına kaydettiği ilişkiler görünür.
- Hedef/benzeşen âyet herhangi bir sûreden olabilir. Kayıt yerini hedef sûre değil ANA sûre belirler.
- 2/3/4 çalışması bitip kullanıcı ayrıca yayın onayı verene kadar portal veri setine aktarılmaz.
- “Çalışma kaydını doğrula” işlemi yayın onayı değildir; yayın kilidi değişmez.
- Diğer 111 sûrenin mevcut kayıt akışı ve portalın 2/3/4 motor/ters ilişki sonuçları korunur.

## Kesin kayıt hedefleri

| Ana sûre | Git dalı | Dosya | Başlangıç |
| --- | --- | --- | --- |
| 2, 3, 4 | calisma-234 | data/mutesabih-calisma-234.json | Boş; yalnız kullanıcı eklemesi |
| Diğer 111 sûre | main | data/mutesabih-degisiklikler.json | Mevcut kaynak ve yönetici geçmişi |

Çalışma JSON'u main dalına eklenmez. Portal okuyucusu ve servis çalışanı değiştirilmez.
Depo zaten herkese açıktır. Çalışma dosyası portalda yayımlanmaz ancak GitHub üzerinde gizli değildir.

## Kaynak ve doğrulanan envanter

Başlangıç main ağacında 276 dosya bulundu; ağaç yanıtı kesilmemiştir.
Tam yol, bayt ve Git blob SHA-1 envanteri:
[Kontrol noktası](R234_KONTROL_NOKTASI_20261107.json).

Canlı değişiklik geçmişinin doğrulanan başlangıcı: 103 ana âyet kaydı, 154 işlem;
ana sûre 2/3/4 olan kayıt veya işlem yoktur.
Çalışma dosyası boş oluşturulmuştur: 0 kayıt / 0 işlem.
Başlangıç çalışma commit'i: 315740e5b5ab4699e046e07b418b90adc19ceace.
Çalışma dosyası Git blob'u: 303d68e94c3bfc98affd9b37f2d7a606e18c3223.
Hiçbir gerçek deneme âyet ilişkisi GitHub'a yazılmadı.

## ACCEPTED / DO_NOT_REDO

- Mevcut mutesabih-core.mjs, mutesabih-public.js, index.html, app_data.json, sw.js değişmez.
- data/benzesen-matris.json, data/benzesen-matris.csv ve data/mutesabih-degisiklikler.json bu kurulumda değişmez.
- Önceki terim/taslak ve Hasenat geliştirme dalları birleştirilmez veya silinmez.
- Sesli sayı ayrıştırıcısı birebir korunur.
- Yeni çalışma olayları source=kullanici_calismasi, scope=draft234 ve yönetici/tarih bilgisi taşır.
- Kayıt öncesinde SHA kontrolü, hedef dal/yol doğrulaması ve ikinci onay vardır.
- Çalışma dosyası eksik veya bozuksa canlı dosyaya yönlendirme YAPILMAZ.
- Ekleme, çıkarma, doğrulama, tek işlem/gün geri alma ve günlük kayıt indirme seçili kayıt yerine bağlıdır.
- Sûre değişince eski mikrofon oturumunun gecikmiş sonucu yeni âyete eklenmez.
- GitHub Contents yanıtı büyük dosya içeriğini vermediğinde aynı SHA'lı blob okunur.

## Yapılan testler

- test-r234-core.mjs: 15/15
- test-r234-browser.mjs: 19/19 (ağsız DOM/API benzetimi)
- test-r234-regressions.mjs: 8/8
- test-r23-word-matrix.mjs: 6/6

Toplam 48 otomatik kontrol başarılıdır. Bunlar gerçek kullanıcı mikrofonu/kimlik doğrulamalı tarayıcı testi değildir.
Benzetim raporu: ../qa/R234_UI_BENZETIM_RAPORU.json.

Test edilen admin SHA-256:
b2b1ce5ec845cda8d2163540a7e3f235a20f1aaeb6ee8299592b6432c5cd9dba

Test edilen çalışma çekirdeği SHA-256:
17644d3668d7f16c7b70b1f45eabc302806b7e870f4ba04a2782ee593b708738

Çalışma ortamı bağlantısı aktarım sırasında kesildi.
Admin kodu önceki değişikliklerden kurtarıldı; yukarıdaki son test SHA-256'sı ile BİREBİR eşleştirildi.
HTML kimlikleri, JavaScript sözdizimi ve ses ayrıştırıcısının değişmediği ayrıca kontrol edildi.
Veri setleri yeniden üretilmedi.

## HOLD / REVIEW / WAIT_USER

- WAIT_USER: Gerçek GitHub yönetici oturumu, mikrofon ve kullanıcının kendi âyet girdisiyle kabul kontrolü.
- HOLD: Yerel Chromium görsel testi socket EPERM nedeniyle çalışmadı; bu kabul verilmedi.
- REVIEW: Eski test-r22-homepage.mjs 4/5; sabit 2.7.0 beklentisi mevcut 2.8.20 sürümüyle uyuşmuyor. Bu işe ait yeni hata değildir, dosya değiştirilmedi.
- GitHub Pages yayın kanıtı bu kontrol noktasının commit'i için ayrıca doğrulanmalıdır. Sonuç, veri dosyasına dokunmadan calisma-234 dalında qa/R234_YAYIN_DOGRULAMA_20261107.json yoluna kaydedilebilir.

## Geri alma ve sonraki güvenli adım

Panel kodunu geri almak gerekirse yalnız mutesabih-admin.js ve mutesabih-admin.html başlangıç commit'indeki içerikle yeni bir düzeltme commit'inde geri yüklenir.
Canlı değişiklik geçmişi, çalışma JSON'u ve sonradan girilmiş gerçek kayıtlar ASLA eski sürüme çevrilmez; geçmiş silinmez.
Yeni yardımcı dosyalar veri kaybı yaratmadan yerinde kalabilir.
Önce güncel branch SHA'ları okunmalı; başka kullanıcının değişiklikleri ezilmemelidir.

Kurulumdan sonra paneli yenileyin. Ana sûre 2, 3 veya 4 seçildiğinde:
1. KAYIT YERİ ayrı çalışma veri seti olarak görünmeli.
2. Önceden kullanıcı kaydı yoksa benzeşen listesi boş olmalı.
3. Ses yalnız giriş kutusunu doldurmalı; ikinci onay olmadan kayıt yapılmamalı.
4. Gerçek çalışma kaydı calisma-234 dalında oluşmalı; main veri geçmişine yazılmamalı.
5. Ana sûre başka bir sûre olduğunda mevcut kayıt yeri geri gelmeli.

Bu noktada 2/3/4 çalışma verileri için yayın yetkisi yoktur. Sonraki yayın işlemi ayrıca kullanıcının onayını gerektirir.
