# AYATULKURAN — Esmâ sorgusunda eşleşme yok bildirimi R3

Tarih: 08.11.2026. Önceki yayımlanmış başlık: `35f378fc541af0d3d2d3dbbd2c2104a070d22959` (R2). Bu kayıt R2'nin yerine geçmez; devamıdır.

## Bağlayıcı kullanıcı kararı

- Sağ tık menüsünde **“Esmâ olarak sorgula”** yalnız kabul edilmiş `esma_index.json` dosyasındaki **99 Esmâyı / 2.050 kaynak bağlantısını** sorgular.
- Seçilen kelime veya kelime grubu kayıttaki Esmâ ile eşleşmiyorsa **“Esmâ veri setinde EŞLEŞME YOK”** sonucu görünür. Genel Kur'an kelime araması, kök araması, başka bir veri setinden otomatik tamamlama **yapılmaz**.
- Eşleşmeyen sorguda yeni âyet önerilmez veya kaydedilmez. Önceki Esmâ sorgusunun otomatik hazırladığı numaralar silinir; kullanıcının elle yazdığı numaralar ve yayımlanmış benzeşenler korunur.
- Kayıtlı bir Esmâ ile eşleşme varsa o Esmânın sûre/âyet numaraları gösterilir; ayrı manuel Esmâ seçimi mevcut açık onay şartıyla korunur. Kalıcı benzeşen kayıtları yalnız `+ Benzeşen ekle` ve ikinci onayla değişir.
- 2., 3. ve 4. sûrelerin çalışması yayımlanan portal veri setinden **ayrı** kalır; sesli/metin girdili taslaklar `calisma-234` dalında tutulur.

## R3 kapsamı

Yalnız `mutesabih-admin.js`, `mutesabih-admin.html`, `mutesabih-kavramlar.css`, `test-r234-browser.mjs`, `qa/R234_UI_BENZETIM_RAPORU.json` ve bu R3 devir kaydı değişti. “EŞLEŞME YOK” metni Esmâ sonuç panelinde ayrı vurgulanır ve ana âyetin altındaki hızlı durum satırında da bildirilir. Yönetici betik/biçim önbellek sürümü `esma-only-3` olarak yükseltildi.

## Doğrulama

- `5.61` âyetinden `اللّٰهُ` seçilirse mevcut kabul edilmiş 99 isim arasında eşleşme bulunmadığı için **eşleşme yok** bilgisi ve sıfır yeni aday gösterilir. Bu, `ALLAH` için yeni Esmâ kaydı üretme yetkisi vermez.
- `4.43` âyetinde `عَفُوًّا` eşleşmesi ve Esmâ kaynakları aynı şekilde çalışır.
- `4.43` âyetinde önce `عَفُوًّا`, sonra eşleşmeyen `سُكَارٰى` seçilirse eski otomatik adaylar temizlenir; örnekte elle yazılmış `77.1` korunur. Esmâ dışı arama/API isteği ve GitHub kayıt işlemi oluşmaz.
- Ağsız testler: Esmâ **10/10**, kavramlar **78/78**, yönetim/2-3-4 **24/24**; toplam **112/112 PASS**. Bu testler gerçek tarayıcı fare kullanımı ve gerçek GitHub yazma testi değildir.

## ACCEPTED / DO_NOT_REDO / HOLD

- **ACCEPTED:** Yalnız Esmâ sorgusu; bulunmayan ifadede açık eşleşmeme bildirimi; önceki otomatik önerilerin temizlenmesi ve manuel numaraların korunması.
- **DO_NOT_REDO:** `esma_index.json` SHA256 `93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927`; `app_data.json` SHA256 `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6`; `data/benzesen-matris.json` SHA256 `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9`; `data/mutesabih-degisiklikler.json` SHA256 `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa`.
- **HOLD:** Yönetici girişli gerçek fare/tarayıcı testi kullanıcı tarafından teyit edilecek. Önceki açık işler: kavram kaydına ayrı onay, Word/PDF dosya içe aktarması, 2-3-4 taslakların tamamlanması ve yalnız sonradan kararlaştırılmış yayımlanması.
- **Güvenli sonraki adım:** Kod yayına alındıktan sonra canlı yönetici HTML/JS/CSS SHA doğrulaması; 5.61'de eşleşmeme, 4.43'te AFUV eşleşmesi kullanıcı kontrolü.
