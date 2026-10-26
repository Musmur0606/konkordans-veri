# Ayatulkuran — Kelime / kelime grubu / kavram deneme R1
Tarih: 26.10.2026
Durum: DENEME — ana Kur'an/benzeşen/Esmâ verisi ile entegre değil.

## Kaynak ve kabul
- Tek kaynak Kur'an 6236 ayet: depodaki `app_data.json`, alan `verses[ref].ar` (blob e3e38c1eb4970e4ee14c71eabe1e262f1850ef77).
- `data/kelime-kavram-deneme/kelime_ayet_harekeli.json`: **21.125** orijinal yazılış biçimi ve **75.071** tekil kelime/ayet referansı. Yalnız [sure_no,ayet_no] matrisi.
- `data/kelime-kavram-deneme/kayitlar.json`: **7** deneme kaydı: kelime 2, ifade 3, kavram adayı 2; toplam **425** terim/ayet referansı.
- Orijinal harekeler/harfler kaynak metinde değişmedi. Karşılaştırmada hareke düşümü, elif-i vasla, küçük elif ve hemzeli elif eşdeğerliği sadece arama anahtarına uygulanır.
- `kelime-kavram-deneme.html`: Arapça sanal klavye, kelime/ifade/kavram ekleme, mevcut kaydı düzenleme ve çıkarma, otomatik sure/ayet keşfi, elle ref ekleme/çıkarma, tarih + gerekçe zorunluluğu, iki onay, JSON/CSV dışa aktarma.
- Düzenlemeler şimdilik **yalnız tarayıcının localStorage** deposuna kaydedilir; JSON dışa alınmadıkça GitHub veri kaydına yazılmaz.
- Sayfa ana menüde yok, noindex; GitHub Pages kamuya açık olduğundan **gerçek gizli yönetici alanı değildir**.
- Ana okuyucuda Arapça klavye için kutucuklu tuşlar ve Arapça yazınca otomatik açılma: `index.html` + `sw.js` **v2.8.15**, commit 353a6ae5264e318df0b2b055d01d17a6a10c02e8 / 9204770bcc1c6f0244b8f95f28e6bccae758b96f.
- Deneme kaynak commitleri: HTML 390bb91c4357c30da2af3e5f5939a7e7efef2592, otomatik refs HTML c63caaa05d7d1232f2052445061033ef8d18c082, 7 kayıt JSON 3d07683087b6f2b7e0b5a62abb91510be056bcdb, tam kelime JSON 09fa8edc8c31acd0fb426d10b4f76ea0c2154df6.

## Kapsam
- Kelime: tam normalize edilmiş Arapça kelime.
- Kelime grubu: art arda gelen tam kelimeler.
- Kavram: kullanıcı tarafından listelenen birden çok Arapça gösterge ifadenin âyet birleşimi; **anlamsal doğrulama değildir**.
- Aynı terimin aynı âyette birden fazla geçişi tek [sure,ayet] kaydıdır.
- Ana Kur'an metni, Türkçe/İngilizce mealler, Word benzeşen matrisi, 2/3/4 sûrelerin korunmuş durumu, yönetici MLOG ve Esmâ kuralları DEĞİŞMEDİ.

## DO_NOT_REDO
- Kabul edilmiş Word matrisi 111 sûre / 5574 ana / 175478 bağlantı; Enfâl 8.58 30 benzeşen + ana = 31.
- Orijinal Kur'an ve meal dosyaları, 228 bağımsız sûre sayfası, Esmâ 99 ve önceki elle kabul edilen düzenlemeler yeniden yazılmayacak.
- Kaynak lisansları ve anlamsal eşleşmeleri onaylanmamış dış kavram listeleri otomatik içeri aktarılmayacak.

## OPEN_REVIEW / HOLD
- Demo giriş/doğrulama sunucu tarafında korumalı değildir. Kişisel/özel veriler için kullanılmamalı.
- Demodaki kelime araması morfolojik kök/parçalı ek çözümlemesi değildir; bağlı Arapça ön/son eklerle farklı biçimler ayrı kalabilir.
- Kavram sonuçları yalnız lafzî aday; kullanıcı onayı olmadan doğrulanmış anlam ilişkisi kabul edilmez.
- Canlı telefon/masaüstü tıklama kontrolü henüz yapılmadı. GitHub commit başka, tarayıcı LIVE PASS ayrıdır.
- JSON dışa alma kullanıcı tarafından yapılmadan tarayıcılar arası paylaşım yoktur.

## Sonraki adım
1. Arapça arama kutusunda **عربي** tuşlarına tıklayıp hareke ekleme ve aramayı kontrol et.
2. Deneme sayfasında seçili Arapça kelime/ifade için referansları otomatik getir, 1.2/1.4/112.1 örneklerini teyit et.
3. Elle referans ekle-çıkar, gerekçe/tarih ve iki onay, JSON/CSV dışa alma testini gerçekleştir.
4. Kullanıcı kabulü sonrasında erişim kontrollü admin veri kayıt akışını tasarla; canlı ana veriyle birleşme ayrı onay ister.
