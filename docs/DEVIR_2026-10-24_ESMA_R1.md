# AYATULKURAN — DEVİR NOTU (24.10.2026, Esmâ R1)

## Korunacak kabul
- Depo: Musmur0606/konkordans-veri; site: https://www.ayatulkuran.com/.
- Benzeşen matris ayrı otorite: 111 sûre, 5.574 ana âyet, 175.478 bağlantı; 8:58 için 30 benzeşen + ana âyet = 31. Kaynağı sessizce değiştirme.
- 2, 3, 4. sûreler benzeşen matrisinde ana kayıt olarak korunur; hedef olarak kullanılabilir.
- Önceden işlenmiş Kur’an metinleri ve ses/video özellikleri değiştirilmedi.

## Bu tur kabul ve işlemler
- Kullanıcı kaynakları: ESMAU'L-HUSNA VE MANALARI.docx ve Esma_Veri_Seti_Paketi.zip.
- Word: 99 Esmâ ismine Türkçe anlam; Word'de VEHHÂB sıra numarası 85 yazılmış olsa da isimle eşleştirildi. Site isimleri ve Arapçaları olduğu gibi tutuldu.
- Esmâ ZIP: 99 isim, 2.050 tekil isim→âyet bağlantısı, 1.465 tekil âyet. Eski site 2.049; tek içerik farkı VELÎ 41:31 (eklendi).
- esma_index.json SHA 889df97349043ce44211f60dd471106fa3e323bf, commit 7b61fa5161494ae224271b972ef03736094c1808.
- index.html son SHA 04adb2c903e54165f349090c499f64d743a29ce9, commit 20bfeeb37c376e817eb47b8fec8acd22f287950a; arayüz sürümü 2.8.0.
- Esmâ yan menüsünde Arapça, mevcut Esmâ adı, Türkçe anlam ve adet; ayrıntı başlığında anlam.
- Mobil sûre okumada âyet numarası seçicisi eklendi; masaüstü kenar çubuğu ayet kutusu korundu.
- Esmâ Arapça renklendirmede sadece seçilen adın hareke/tenvin farkları ve isteğe uygun baştaki ال varyantı; kökten gelen diğer kelimeler boyanmayacak; âyetin gerçek Arapça metni değiştirilmez.
- Benzeşen hedefe tıklama zaten goto(ref)→openRef(ref)→selectVerse(ref) akışıyla kendi ekranını açıyor.

## Açık inceleme ve sınırlar
- ZIP kaynak notunda altı kaynak tutarsızlığı işaretli (İLAH, MUHÎT, TEVVÂB, VELÎ, CÂMİ’, RAZZÂK) ve başlıksız 14 işaret. Bunlar keyfî yeni eşleşmeye dönüştürülmemeli.
- Benzeşen Word ilişkilerindeki 14 sınır kaydı ayrıca incelemeye açık.
- Son kod GitHub'da doğrulandı; mobil cihazda ve yayındaki statik site dağıtımında son görsel/tıklama kabulü yapılmalı.
- Yönetim paneli için güvenli kullanıcı adı/şifre, oturum denetimi, zorunlu tarih/gerekçe, ikinci onay ve sunucu tarafı erişim kontrolü önceki taleplerden açık; bunların tamamlanmış olduğu iddia edilmemeli.

## Sonraki adım
1. Cep telefonu görünümünde sûre→âyet seçme ve benzeşen→kendi benzeşenleri akışını elle test et.
2. Esmâ'da besîr örneği gibi i‘rab varyantlarını ve kökdeş ama başka kelimeleri ayırma testleri yap.
3. Kullanıcı onayıyla altı Esmâ kaynak tutarsızlığını ve açık kayıtları ayrı incele.
4. Admin güvenlik mimarisi ve sunucu tarafı yetkilendirme işine dön.

## 24.10.2026 — Müteşabih hedef tıklama R2
- Kullanıcı isteği: Ana âyetin altındaki bir müteşabih hedefe tıklandığında seçilen âyetin kendi müteşabihleri listelensin.
- Kodda hedefe tıklama zaten `goto(ref) → openRef(ref) → selectVerse(ref)` çalışıyordu; görülen boşluk 2/3/4 sûrelerinin ana matris içinde bulunmamasıydı.
- `index.html` sürüm 2.8.1 commit `9d138aebc0a0ed49120ca3ecb7a3e67c9fc387ae`.
- Word matrisi ve MLOG doğrulandıktan sonra yalnız 2/3/4 sûrelerine gelen ilişkiler ayrı `BENZESEN_TERS` görüntüleme indeksinde oluşturuluyor; 2/3/4 mevcut `V[ref].r` kayıtları değişmiyor. Görüntüde mevcut liste + ters ilişki listesi tekilleştirilerek gösteriliyor.
- Kaynak 111 sûre / 5574 ana / 175478 bağlantı kabulü, 8:58 için 30 hedef ve 2/3/4 koruma kuralı değişmedi.
- GitHub son dosya SHA `9e6f5d36ea58b197ee9840fc4cab69960c31f680`. JavaScript sözdizimi kontrolü PASS; canlı mobil tıklama testi açık.

## 24.10.2026 — Esmâ tam ad vurgusu ve Arapça font birliği R3
- Kullanıcı bağlayıcı şartı: Yalnız seçilen Esmâ adı kırmızı; üstün/esre/ötre ve tenvin i‘rab farkları, üstün tenvinli yazım elifinin eklenmesi ve başta ال/ٱل bulunması eşdeğer. Kökdeş başka sözcükler asla renklendirilmez. Asıl Arapça harf, hareke, Mushaf işareti ve boşluklar görüntüde byte düzeyinde olduğu gibi kalır.
- `index.html` commit `d6b763877a6110d518c70731df4ff580821c078a`, sürüm 2.8.2. Seçili kelime yalnız kırmızı, arka plan ve kalın font dayatması yok. Örnek PASS: بَصِيرٌ / بَصِيرٍ / بَصِيرًا / ٱلْبَصِيرُ; NEGATİF: بَصَرٌ / مُبْصِرٌ. ALÎY için ٱلْعَلِيُّ eşleşir.
- Tek CSS font yığını: `"Traditional Arabic","Amiri","Scheherazade New","Sakkal Majalla",serif`. Ana sayfa ve Esmâ; `mutesabih-public.css`; yönetim paneli `mutesabih-admin-r16.css` aynı yığın. Cihazda bu fontların yüklü oluşuna göre gerçek font düşümü değişebilir; ayrıca dosya gömülü webfontu kurulmadı.
- 114 kanonik `1-fatiha.html` … `114-nas.html` tek commit `a1eac67d13105d197e224d111f251640fc1e5c85` ile güncellendi; 114/114 kaynakta yalnız CSS tanımı eklendi.
- 114 eski `sure-1-fatiha.html` … `sure-114-nas.html` tek commit `094029aa5dae25507de119359e5bea879b6e854f` ile güncellendi; 114/114 kaynakta yalnız CSS tanımı eklendi.
- Toplam 228 bağımsız sûre HTML dosyasının içeriği ve bağlantı verileri korunarak font tanımı düzeltildi. Son örnek GitHub SHA doğrulamaları PASS (Bakara, Nâs ve eski URL'ler). Her mobil cihazda canlı görsel QA henüz yapılmadı.
- DO_NOT_REDO: 175.478 benzeşen bağlantısı, 5.574 ana, 8:58=30 hedef, Esmâ 99 ve 2.050 bağlantı değiştirilmedi; tüm sûreleri yeniden üretme veya Arapça metni normalize etme.
- Sonraki adım: telefonda özellikle 2.255 ALÎY ve seçili BASÎR örnekleriyle tam ad vurgusunu görsel doğrula; 1/2/114 sûre sayfaları ve müteşabih sayfasında yazı biçimini karşılaştır.

## 24.10.2026 — Esmâ URL ve günlük bildirim durumu R4
- `index.html` sürüm 2.8.3, commit `d6c3d62819330e3c734f073d03eed98806e5de6d`; dosya SHA `dcee13cbba7fcfd5df261345e62d77ea249a7130`.
- `showEsma(name)` artık geçerli 99 isimden biri seçilince `?esma=<tam kaynak adı>` adresini yazar, başlığı Esmâ ile günceller. `boot()` aynı URL'yi okuyup doğrudan ilgili Esmâ'yı açar. `adresGuncelle` ayet/sure/esma parametrelerinin birini tutar, diğerlerini temizler. Görünen isim ve kaynak adları değiştirilmedi.
- Günlük bildirim şu an YOK. `sw.js` yalnız önbellek/çevrimdışı çalışma içeriyor; `push`/bildirim aboneliği ve günlük sunucu zamanlayıcısı bulunmuyor. Ana sayfadaki Günün Âyeti günlük seçimdir ama telefona otomatik push göndermez. Kullanıcı açıkça istemeden bildirim izni istenmeyecek.
- Test: JavaScript sözdizimi PASS; GitHub dosyası tekrar okunarak SHA PASS. Telefon tarayıcısında tıklama ve URL yeniden yükleme QA bekliyor.

## 24.10.2026 — Yönetici arayüzü giriş öncesi gizleme R5
- Kullanıcı isteği: Yönetim panelini herkes görmesin. Depo GitHub Pages olduğundan kaynak HTML/JS dosyaları kamuya açıktır; gerçek sunucu tarafı URL erişim kontrolü yok. Bu değişiklik **arayüz görünürlüğü kapısıdır**, tam sunucu gizliliği değildir. Bu sınırlama kullanıcıya açıkça bildirilmeli.
- GitHub commit `3d39606334923a97ad00cf6bd09061aba294ea03` ile 4 dosya: `mutesabih-admin.html`, `mutesabih-admin.js`, `mutesabih-admin.css`, `mutesabih.html`.
- Başlangıçta yalnız GitHub erişim anahtarı giriş alanı gösterilir; önizleme, sûre/âyet, düzenleyici ve günlük MLOG ekranları gizlidir; veriler giriş öncesi yüklenmez.
- `api.github.com/user` sonucu `Musmur0606` doğrulanıp veri yüklenince `admin-authorized` sınıfı ile yönetim alanı görünür. Çıkışta token ve runtime verisi temizlenir, arayüz gizlenir. Dosya yazmaları ayrıca GitHub API erişim izniyle korunur.
- Herkese açık `mutesabih.html` üst bağlantısından yönetim paneli bağlantısı kaldırıldı; doğrudan /mutesabih-admin.html adresi çalışır. Kullanıcı admin panelinin URL'sini yer iminde tutabilir.
- Kaynak site ve benzeşen matris değişmedi. Güncel MLOG 3 olay: kabul edilmiş `8.18 → 5.12` ve kullanıcı tarafından ayrıca yapılmış iki `5.18` eklemesi. Son iki ekleme bu turda değiştirilmedi ve anlamsal kabul ataması yapılmadı.
- JavaScript sözdizimi PASS, GitHub commit 4/4 ve MLOG 3 olay bağımsız okuma PASS. Gizli pencerede login öncesi/sonrası görsel test kullanıcı tarafında AÇIK.
- Açık iş: tam sunucu tarafı gizlilik için GitHub Pages dışı yetkili barındırma/proxy gerekir; kullanıcı mevcut GitHub yetkilendirmesini tercih ettiğinden yeni ücretli servis kurulmadı.
