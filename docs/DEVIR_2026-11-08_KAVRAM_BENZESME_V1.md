# AYATULKURAN — Kavram Benzeşmesi ve Seçim Onayı — Devir V1

Tarih: 8 Kasım 2026 (UTC)

Standart: **Tüm Projeler İçin Kalıcı Hafıza ve Kesintisiz Devir Standardı V1**

Proje / depo: `ayatulkuran` / `Musmur0606/konkordans-veri`

Canlı portal: `https://www.ayatulkuran.com/`

Yönetici paneli: `mutesabih-admin.html`

Temel kabul edilmiş `main`: `4cb4a1cb0a8aef3b85f7feb05345bb8205f3175e` (v2.8.23, Hasenat kabulü)
Geliştirme dalı: `feat/admin-kavram-benzesme-20261108` (**main dalına birleştirilmedi; yayın izni yok**)

## Kullanıcının bağlayıcı kararları

1. **ANA sûre 2, 3 veya 4 için sesli ve metin girişli âyet ekleme canlı portalda yayımlanmayacak.** Bu çalışma tamamlanıp Murat açık yayın onayı verince ayrıca portala alınabilir. Taslak/çalışma onayı yayın izni değildir.
2. Yönetici panelindeki mevcut benzeşen âyet listesi korunur. Kavram çalışma dosyasındaki **etkin, önceden kaydedilmiş** Arapça kelimeler ve ardışık kelime grupları ana âyette geçiyorsa, bunların geçtiği başka âyetler görünür listeye eklenir.
3. Eşleşme sûre+âyet numarasıyla tekildir; ana âyet kendi listesinden çıkarılır. Birden çok kavramın aynı âyete ulaşması mükerrer kayıt oluşturmaz.
4. Ortak kelime veya **tüm kelime grubu**, hem ana âyette hem bulunan âyette **aynı renkte** işaretlenir; eşleşmenin nedeni kavram etiketiyle görünür.
5. Fareyle metin seçilince yalnız **bekleyen onay kartı** açılır. Sağ tık aktarım komutu da henüz yazmaz. Yalnız **OK — Veri setine kaydet** açık tıklamasıyla, seçimin özgün Arapça metni ve sûre/âyet kaynak konumu `calisma-kavramlar` dosyasına kaydedilir. Vazgeç / Escape yazmaz.

## Kesin veri yönlendirmesi ve yayın kilitleri

| Veri | Dal | Dosya | Değiştirildi mi? |
| --- | --- | --- | --- |
| 2/3/4 sesli/metin âyet ekleme | `calisma-234` | `data/mutesabih-calisma-234.json` | **Hayır; HOLD yayın** |
| Kavramlar, kelime grupları | `calisma-kavramlar` | `data/kavramlar-calisma.json` | **Hayır; mevcut çalışma dosyası korunur** |
| Kabul edilmiş Word benzeşen matrisi | `main` | `data/benzesen-matris.json` | **Hayır** |
| Yayımlanan ilişki değişiklik günlüğü | `main` | `data/mutesabih-degisiklikler.json` | **Hayır** |
| Arapça / Hasenat corpus | `main` | `app_data.json` | **Hayır** |

Dal ref'leri 8 Kasımda uzaktan okundu: `main=4cb4a1cb0a8aef3b85f7feb05345bb8205f3175e`, `calisma-234=315740e5b5ab4699e046e07b418b90adc19ceace`, `calisma-kavramlar=6bbf0849c73e3f9868214a1b33d902c1b7ab52f6`. Bu sürümde gerçek GitHub veri PUT işlemi **0**. Kavram eşleştirme salt okunurdur; site motoru ve portal veri kayıtları değiştirilmez.

## Değişen dosya envanteri, SHA-256

Yollar depo köküne göredir; SHA-256 son test edilen dosyayı tanımlar.

| Yol | İşlev | SHA-256 |
| --- | --- | --- |
| `mutesabih-admin.html` | Onay kartı, eşleşme durumu, metin kılavuzu | `1f18a365d8d06d7826cde5a288afeae7b66f17bcc7c328b521f89a66ef662397` |
| `mutesabih-admin.js` | Var olan liste ve kavram adaylarını ekranda birleştirme | `79ef3c716fd479f987c32a695daef66c8f5427dc4056e049295f4b45b5e62e18` |
| `mutesabih-kavramlar.mjs` | Fare seçimi, bekleyen onay, yalnız OK ile yazma | `b13d92d50f6fc6b8ed285893b45b57c4d3398bb8f4146b38087c96510dcea9ce` |
| `mutesabih-kavramlar.css` | Onay ve ibare renkleri | `814030b1872257414784b51402b1dfa12ac66aa10158471956c99cf8898cf21c` |
| `mutesabih-kavram-eslestirme.mjs` | Yeni, salt okunur bütün âyet tarama ve güvenli DOM vurgulama | `f729ac009c89fa0d0e1885f200dc70a5add86eae90814fb0c3aee9e3b494caad` |
| `test-kavram-benzesme.mjs` | Yeni, gerçek corpus ve ibare eşleştirme testi | `1d4d3b14ad9e009e6e15b57800aa65539b525a72594257073c45099c016fb0a5` |
| `test-kavramlar-panel.mjs` | OK öncesi sıfır PUT, iptal ve kaynak eşleşmesi senaryoları | `08bb049bb7c45fca49151397edffb404b0f869dddbde04ade1761c486e512d67` |
| `test-r234-browser.mjs` | Yeni salt-okunur modül bağımlılığını mevcut DOM benzetimine ekleme | `436f6e0051d2828a1eed70f2ca9777e8cbf68ea4be54dc7e295a6929d5369fe6` |
| `docs/KAVRAMLAR_CALISMA_KAYDI.md` | Bağlayıcı OK ve arama kuralını güncelleme | `babbd1492d21a3cb7344985bcd86842616cc32dbbd8132d4944d556bc58b8c15` |

### Değişmeyen kabul edilmiş kaynakların SHA-256 değeri

- `app_data.json`: `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6`; **6.236 âyet**.
- `data/benzesen-matris.json`: `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9`.
- `data/mutesabih-degisiklikler.json`: `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa`.

## Test / kabul kontrol noktası

- `node test-kavram-benzesme.mjs`: **8/8 PASS**. Tam kelime/kelime grubu, tekrar önleme, arşiv dışlama, renk, gerçek 6.236 âyetlik Hasenat corpus.
- `HASENAT_QA_OUTPUT=/tmp/ayatulkuran-kavram-panel-qa.json node test-kavramlar-panel.mjs`: **78/78 PASS**. Seçim/sağ tık öncesi sıfır yazma, açık OK, iptal, kaynak konumu, SHA çakışması ve dosya aktarımının korunması.
- `node test-r234-browser.mjs`: **19/19 PASS**. 2/3/4 ayrı çalışma hedefi, siteye yazılmaması, sesli girdi ve geri alma.
- `node test-kavramlar-core.mjs`: **37/37 PASS**.
- `node test-kavramlar-import.mjs`: **51/51 PASS**.
- **Toplam yeni ve ilgili regresyon kontrolü: 193 PASS, 0 FAIL.** `git diff --check` ve üç yeni/değişen JS sözdizimi de başarılı.
- Bütün otomatik GitHub çağrıları test içinde sahte API ile karşılandı; canlı veri kaydı **0**.

## ACCEPTED / DO_NOT_REDO

- `main` v2.8.23 Hasenat yazımı, eski benzeşen Word matrisi ve 2/3/4 ayrı kayıt rotası korunur.
- Çalışma kavramları kaynaklarıyla ayrı şemada kalır. `publication.status=not_published`, `automatic=false` değişmez.
- Kullanıcı OK basmadan kavram PUT yapılmaz; salt okunur eşleşme hiçbir benzeşen veri dosyasına kendiliğinden kayıt yazmaz.
- Kabul edilmiş 2/3/4 kuralı: sesli/metin girişi yayına alınmaz; yalnız açık, sonradan verilecek onayla yayın hazırlanabilir.
- Yukarıdaki otomatik PASS sonuçları aynı commit ve veri SHA'larında gereksiz tekrarlanmaz.

## HOLD / REVIEW ve sonraki güvenli adım

- **HOLD_PUBLICATION**: Bu özellik ve **özellikle 2/3/4 sesli/metin girişleri** main dalına birleştirilmeyecek, GitHub Pages yayını tetiklenmeyecek. Kullanıcı açık yayın onayı gereklidir.
- **REVIEW_REAL_BROWSER**: Gerçek Chromium, ortamda socket/başlatma kısıtı nedeniyle doğrulanamadı. DOM benzetimi ve gerçek corpus testleri başarılı; gerçek fare seçimi, RTL vurgular ve GitHub yetkili oturumu görsel kontrolü bekler.
- **REVIEW_DATASET**: `calisma-kavramlar` veri dosyasına gerçek kullanıcı kavramı yazılmadı. Gelecek kullanıcı OK işleminden sonra aynı kaydın eşleşmede görünmesi gerçek oturumda kontrol edilmeli.
- Güvenli sonraki adım: remote özellik dalındaki kod ve taslak PR incelenir; gerçek tarayıcıda kullanıcı izniyle bir Arapça iki kelimeli ibare seçilir ve onaylanır; ilgili ayetler/renkler görülür. **Bunun kendisi 2/3/4 veya kavram özelliğini portala yayımlama yetkisi sayılmaz.**
