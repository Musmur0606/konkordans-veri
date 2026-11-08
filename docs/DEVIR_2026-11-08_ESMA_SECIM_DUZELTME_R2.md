# AYATULKURAN — Esmâ sağ tık sorgu düzeltmesi R2

Tarih: 08.11.2026. Kaynak canlı yayın sürümü `cd82bd82b55d1a5a20bf599dc7ab4209ad69697d`.

## Yeni kabul edilen davranış

1. Sağ tıkla seçilen Arapça ifade 99 isimlik kabul edilmiş Esmâ veri setinde
   **hemen** aranır. Bir isim ve kaynak âyet eşleşirse o Esmânın ilgili bütün
   sûre/âyetleri ekranda görünür; tekrarlar, ana âyet ve mevcut benzeşenler
   ayıklanır. GitHub kaydı yapılmadan editör numara kutusunda hazırlanır.
2. Açılan 99 Esmâ seçim listesi korunur; doğrudan eşleşen isim işaretlenir.
   Başka bir isim manuel olarak seçilirse, seçilen Arapça ibareyle uyuşmadığı
   açıkça bildirilip ikinci tercihe ayrıca onay istenir.
3. Bir başka Esmâ seçilince yalnız önceki Esmâ işleminin eklediği numaralar
   silinir. Kullanıcının kendi yazdığı numaralar korunur. Eski Esmâ adayları
   alt benzeşen listesinde de kalkar.
4. Sonuç paneli sorgu sonrasında görünür konuma kaydırılır. Sorguya sonuç
   bulunmazsa sessiz kalmaz; seçilen ifade ve bulunamadı durumu gösterilir.
   Yönetici betiğinin önbellek sürümü `esma-only-2` yapılarak önceki hatalı
   betiğin tarayıcı önbelleğinden yüklenmesi önlenir.
5. `+ Benzeşen ekle` ve ikinci onay verilmeden kalıcı kayıt olmaz.
   2/3/4 ana âyetleri ayrı çalışma verisine yönlenir; portal veri seti değişmez.

## Doğrulanabilir örnekler

- `4.43`: `عَفُوًّا` → **AFUV**, Esmâ kaynak listesinde 5 âyet,
  seçilen ana âyet atlandıktan sonra 4 yeni aday: `4.99, 4.149, 22.60, 58.2`.
- `4.43`: `غَفُورًا` → **ĞAFÛR**, Esmâ kaynak listesinde 91 âyet;
  seçilen ana âyet ve mevcut benzeşenler ayıklanır.
- `2.96`: `بَصٖيرٌ` → **BASÎR**, 42 kaynak referansı.
- `5.61`: `اللّٰهُ` → **eşleşme yok**. Kabul edilmiş 99 isimlik `esma_index.json`
  dosyasında bağımsız `ALLAH` kaydı bulunmuyor. Bu kaynak eksikliği yazılım
  hatasıymış gibi sessizce tahmin/üretim yapılarak kapatılmayacak (REVIEW).

## Kabul / koruma / açık işler

- `ACCEPTED`: Esmâ 10/10, kavram modülü 78/78, yönetim paneli ve 2/3/4
  yönlendirme 23/23: **111/111 ağsız test PASS**.
- `DO_NOT_REDO`: `esma_index.json` 99/2050, `app_data.json` 6236 âyet,
  Word matrisi ve yayın benzeşen kaydı byte-eş korunur.
- `HOLD`: Gerçek GitHub yönetici oturumu ve kullanıcı fare tıklamasıyla görsel
  son kabul kullanıcı tarafından yapılacak.
- `REVIEW`: ALLAH ismi ve referansları, kullanıcı kabulünden sonra Esmâ veri
  setine ayrı kaydedilebilir; mevcut 99 isimlik tablo izinsiz değiştirilmez.
- Önceki açık işler: kavram aktarımı için ayrı OK onayı ve Word/PDF kavram içe
  aktarma hazırlıkları başka taslak dalında; bu R2 yaması onları yayımlamaz.

## Veri ve yayın sınırları

Yalnız yönetici HTML/JS, Esmâ sorgusu testleri, rapor ve devir kaydı değişir.
`data/mutesabih-degisiklikler.json`, `data/benzesen-matris.json`, `app_data.json`,
`esma_index.json`, 2/3/4 çalışma verisi ve Hasenat yazımı değiştirilmez.
Ana dal güncellendikten sonra canlı dosyalar yeniden indirilerek SHA-256
bütünlüğü doğrulanacak; doğrulanmadan canlı test PASS denmeyecek.
