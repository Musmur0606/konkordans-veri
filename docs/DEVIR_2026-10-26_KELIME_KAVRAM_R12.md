# AYATULKURAN — Kelime/Kelime Grubu/Kavram Dizini R12 (26.10.2026)

## Amaç
Ana Kur'an sitesinden ayrı ve henüz başka amaçla kullanılmayan bir **kelime / kelime grubu / kavram → sûre ve âyet numarası** veri seti. Metin ve mealler veri setinde tekrar edilmeyecek. Kullanıcı Arapça sözcük veya kelime grubu ilave ettiğinde Arapça kaynak metin taranarak konumlar belirlenecek; Türkçe kavramların anlam bağlantıları otomatik onaylanmayacak. Kayıtlar eklenebilir, çıkarılabilir ve tarih/gerekçesiyle düzeltilebilir.

## R12 çıktısı (bu sohbette sandbox dosya olarak teslim)
- **ZIP:** `AYATULKURAN_KELIME_KAVRAM_VERI_SETI_VE_YONETIM_R1.zip`
- **SHA256:** `e5be4a141021dbde5f8c63a8275d34c25f8d4b8816e46635ba91e28b79101737`
- ZIP içinde `KELIME_KAVRAM_MATRISI_R1.json`, `ARAPCA_AYET_KONUM_KAYNAGI.json` (yalnız otomatik tarama yardımcısı), `YONETIM_DENEME.html` (bağımsız/offline), `AC.bat`, `DENEME_KAYITLARI_R1.json`, `KULLANIM_TR.txt`, `DEVIR_R1.md`, `TEST_RAPORU_R1.json`, `MANIFEST_SHA256.json` ve test/üretim betikleri bulunur.
- İlk kabul kaynak dizini: **21.125 Arapça harekeli yüzey yazımı, 75.071 kelime–âyet ilişkisi**. **6.236** âyetlik Arapça kaynak korundu. Kaynaklar, kullanıcının önceki `KURAN_KELIME_AYET_DIZINI_ILK_SURUM.zip` ve `KURAN_ARASTIRMASI_TEK_DEVIR_DOSYASI.zip` dosyalarıdır.
- Yeni JSON sözlüğü `words:{"kelime":[[sure,ayet],...]}` + `custom_records` (kelime grubu/kavram) + `base_excluded`, `base_overrides`, `events` içerir. Arapça âyetin tamamı veya meal metni matrise yazılmaz.
- R1 denemeleri: normalize Arapça `ٱللَّهِ` kelimesi **1.566 âyet**, `رَبِّ ٱلۡعَٰلَمِينَ` birleşik sözcük grubu **34 âyet**. Bunlar literal Arapça yazım eşleşmesidir; kök/anlamsal eşitlik ispatı değildir. `Rahmet` Türkçe kavramı için 1.1 ve 1.3 sadece **incelemeye açık manuel aday örneği**dir ve ana matrise kendiliğinden eklenmedi.
- Ekle/çıkar/geri al, zorunlu tarih–gerekçe, ikinci onay, kaynak dosyanın korunması, aynı terimi iki kez ekleme engeli, JSON/CSV dışa aktarma, sadece değişiklik JSON içe alma kuruldu. İnternetsiz HTML / çift tıkla BAT; GitHub kişisel erişim anahtarı yok.
- Node üzerinden simüle edilmiş JS/arayüz kontrolü PASS; ZIP 11/11 dosya bütünlüğü PASS. Gerçek Windows tarayıcı görsel/işlemsel kabulü **AÇIK**.
  
## KORUNACAK kabul / DO_NOT_REDO
- Word benzeşen matrisi **111 sûre / 5.574 ana / 175.478 ilişki**, Enfâl 8.58 = 30 benzeşen + ana dahil 31. 
- 2/3/4 ana kayıtları, 99 Esmâ/2.050 bağlantı, Arapça/Mushaf işaretleri, mealler, yönetici MLOG ve önceki canlı site sürümleri değiştirilmeyecek.
- Kabul edilmiş 21.125/75.071 ilk kelime sayımı yeniden yapılmayacak; yeni tür/kavram katmanı bunun üstüne kurulacak.
- Bu R1 paketinin verileri **henüz GitHub canlı siteye aktarılmadı veya bağlanmadı**. GitHub'a sadece bu devrin notu eklenmektedir. ZIP, mevcut sohbetin indirilebilir dosyasıdır.

## REVIEW / HOLD
1. Kullanıcı ZIP'i açıp `AC.bat` ile `YONETIM_DENEME.html` dosyasını Windows tarayıcısında dener; örnek 34 âyet, ekleme ve JSON dışa aktarımı doğrular.
2. İthal edilecek halka açık kök/morfoloji/semantik kavram verilerinin kullanım lisansı ve sûre-âyet doğruluğu ayrı incelenmeden esas matrise alınmaz.
3. Gelecekte ayatulkuran.com'dan "seçileni dizine ekle" ve GitHub admin yazma entegrasyonu kullanıcı onayı ve yetkili mimari olmadan yapılmayacak.
4. Güncel canlı site koduna bu deneme kapsamında müdahale edilmeyecek.

## Sonraki adım
R1 kabulünden sonra kaynaklı `kelime_grubu` ve `kavram` adaylarını manuel/otomatik ekle, kayıtların doğrulamasını sürdür, sonra gerekirse GitHub'a ayrı staging klasöründe aktar. ZIP/manifest dosyalarının SHA kontrolüyle çalışmayı devral; yeniden üretme.
