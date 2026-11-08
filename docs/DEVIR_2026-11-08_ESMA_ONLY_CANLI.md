# AYATULKURAN — Esmâ sağ tık menüsü / seçici canlı düzenleme

Tarih: 08.11.2026 — Kaynak dal: `main` / `4cb4a1cb0a8aef3b85f7feb05345bb8205f3175e`.

## Bağlayıcı karar

- Ana âyette Arapça kelime veya kelime grubu seçilip sağ tıklandığında iki seçenek çıkar:
  `Kavram veri setine ekle` ve `Esmâ olarak sorgula`.
- Esmâ düğmesi `esma_index.json` dosyasındaki **99 isim / 2.050 kaynak sûre-âyet**
  kaydını içeren bir açılır liste açar. Ana âyetteki tam eşleşme öneri olarak
  belirtilir; otomatik seçim yapılmaz. Kullanıcı listeden istediği Esmâyı seçer.
- Seçilen Esmânın tüm kayıtlı sûre/âyetleri ayrı sonuç panelinde gösterilir;
  mevcut benzeşenler, tekrarlı numaralar ve ana âyet ayıklanır.
  Kalan numaralar **derhal ana benzeşen listesine kaydedilmemiş aday** olarak
  eklenir ve `Eklenecek veya çıkarılacak âyetler` kutusuna yazılır.
- Gerçek veri kaydı için mevcut `+ Benzeşen ekle` ve ikinci yönetici onayı
  gerekir. İptal düğmesi yalnız Esmâ nedeniyle eklenen adayları geri alır;
  önceden yazılmış metin ve mevcut benzeşenler korunur.
- 2., 3. ve 4. sûrelerdeki metin/sesli âyet **çalışma girişleri** canlı portal veri
  setine aktarılmaz; ayrı `calisma-234` kayıt hattı korunur.
- Önceki kavram ekleme davranışı bu küçük kapsamlı yayınla değiştirilmedi.
  Bekleyen-OK kavram aktarımı ve Word/PDF içe aktarma ayrı çalışma dalında; canlıya
  bu yayınla taşınmaz. Canlı kavram sağ tık yolunda OK beklenmemesi açık iştir.

## Dosyalar

Sınırlı canlı değişiklik:

1. `mutesabih-admin.html` — ikinci menü, 99 isim seçicisi ve ayrı sonuç alanı.
2. `mutesabih-admin.js` — Esmâ seçimi, tekrar ayıklama, geçici aday
   gösterimi, numara kutusuna ekleme ve seçim ömrü denetimi.
3. `mutesabih-kavramlar.mjs` — yeni sağ tık olayına bağlama.
4. `mutesabih-kavramlar.css` — sonuç alanı biçimi.
5. `mutesabih-esma-benzesme.mjs` — eşleşme, 99/2050 bütünlük denetimi,
   1.200 âyet / 5.000 karakter sınırıyla güvenli aday hazırlama.
6. `test-kavramlar-panel.mjs`, `test-esma-sagtik-live.mjs`,
   `test-r234-browser.mjs` ve `qa/R234_UI_BENZETIM_RAPORU.json` — ağsız benzetim kanıtı.

KAYNAK SHA-256:

- `esma_index.json`: `93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927`
- `app_data.json`: `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6`
- `data/benzesen-matris.json`: `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9`
- `data/mutesabih-degisiklikler.json`: `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa`

## Kabul ve sınırlar

- `ACCEPTED`: Esmâ 10/10; kavram paneli 78/78; 2/3/4 yönlendirme,
  Esmâ açılır kutusu ve ikinci onayla yalnız taslağa kayıt 21/21,
  sentaks denetimleri ve `git diff --check` — toplam **109 test** PASS.
- `DO_NOT_REDO`: 99/2050 veri seti, 6236 âyet metni, 175478 Word matrisi,
  kayıt geçmişi, Hasenat yazımı, 2/3/4 ayrı çalışma hattı.
- `HOLD`: Gerçek yönetici oturumunda fare/ekran kabulü kullanıcı tarafından
  yapılmadı; otomatik testler gerçek giriş anahtarıyla çalıştırılmadı.
- `REVIEW`: Görseldeki `اللّٰهُ` ifadesi, kabul edilmiş 99 isimlik `esma_index.json`
  dizisinde **ALLAH** adlı bağımsız bir kayıt değildir. Yine de 99 isimlik seçim
  kutusu açılır. Kullanıcı ALLAH için yeni bağımsız kayıt isterse kaynak âyet
  listesi ayrıca kabul edilmeli; mevcut veri seti sessizce değiştirilmemeli.

## Sonraki güvenli adım

Ana dala yalnız hedefli kod/test dosyaları, QA raporu ve bu devir kaydı aktarılır. Canlı
`mutesabih-admin.html`, `mutesabih-admin.js`, `mutesabih-kavramlar.mjs`, yeni
modül ve CSS tarayıcıdan doğrulanır. Kullanıcı Arapça ibareyi seçip sağ tıklayarak
iki menü öğesini ve sûre/âyet sonuçlarını kontrol eder. Bunun sonrasında kavram
ekleme onayının ve Word/PDF aktarmanın ayrıca yayına alınıp alınmayacağı kararlaştırılır.
