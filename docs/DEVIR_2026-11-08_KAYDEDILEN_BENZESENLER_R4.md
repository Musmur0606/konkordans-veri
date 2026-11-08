# AYATULKURAN — Kaydedilen benzeşen âyetlerin ayrı listesi R4

**Tarih:** 08.11.2026  
**Önceki canlı sürüm:** R3, GitHub `main` SHA `0ee7e77d05d6eba86a451fc026edcce3239f68e7`.  
**Kapsam:** Yönetici panelinde görünüm ve ağsız kabul testi. Önceki R1/R2/R3 kararları korunur.

## Bağlayıcı davranış

Yönetici `+ Benzeşen ekle` işlemini ikinci onayla gerçekten kaydettiğinde, sayfadaki **“Kaydedilen benzeşen âyetler”** bölümünde iki ayrı liste görünür:

1. **Son ekleme işlemi:** En yakın tarihli başarılı `add` olayında eklenen sûre.âyet numaraları ve işlem tarihi. Daha sonra çıkarılan/geri alınan numaralar üstü çizili olarak görünür.
2. **Halen listede bulunan yönetici eklemeleri:** Seçili ana âyet için kalıcı olarak eklenmiş ve bugün de mevcut olan sûre.âyet numaraları; sayı özetiyle birlikte.

Listeler yönetici belleğine değil, seçili ana âyetin **mevcut veri setindeki kayıt geçmişine ve güncel durumuna** dayanır. Başka âyet seçilirse onun bilgileri görünür; sayfa kapatılıp açılınca kaybolmaz. Onaysız Esmâ adayları ve zaten mevcut Word/site bağlantıları yeni ekleme olarak sunulmaz. İşlem iptali, hata veya başarısız kayıt son ekleme listesini değiştirmez. Her kaydın sûre ve âyet numarası açıkça yazılır (`4.99`, `22.60` gibi).

## Veri seti ve yayın ayrımı

- Ana âyet 2/3/4 ise yalnız `calisma-234` dalındaki `data/mutesabih-calisma-234.json` üzerinden çalışma eklemeleri gösterilir. Bu çalışma portalda yayımlanmaz.
- Diğer sûreler için `main` dalındaki `data/mutesabih-degisiklikler.json` geçmişi ve güncel durumu gösterilir.
- `esma_index.json` 99 Esmâ / 2.050 kaynak, `app_data.json` 6.236 âyet, 175.478 Word bağlantı matrisi ve canlı değişiklik belgelerinin içeriği bu geliştirme sırasında değiştirilmedi. Yalnız panel HTML/JS/CSS, test ve bu devir kaydı güncellendi.

## Kontrol ve kabul

- Ağsız Esmâ 10/10, kavram paneli 78/78, yönetim+2/3/4 24/24: **112/112 PASS**.
- Yeni test koşulları: Esmâ taslağı kaydedilmeden listede yok; AFUV kaynakları gerçekten kaydedildikten sonra doğru 4 sûre/âyet görünüyor; sayfa yeniden açıldığında hâlâ görünüyor; ana âyet değişince liste de değişiyor; sonradan çıkarılan ve geri alınan âyetler ayırt ediliyor; 2/3/4 çalışma eklemesi `main` dalına taşınmıyor.
- **ACCEPTED:** Kaydedilen son ekleme ve halen etkin yönetici eklemelerinin iki listede gösterilmesi; adayların ayrı tutulması ve geçmişten yeniden kurulması.
- **DO_NOT_REDO:** Esmâ eşleşme yok R3, Esmâ 99/2050, Hasenat yazımı, önceki benzeşen kaynakları ve 2/3/4 izolasyonunun tamamı.
- **HOLD:** Gerçek GitHub yönetici oturumu ile fare üzerinden son görsel kabul; bu testler ağsız benzetimdir. 2/3/4 taslakların tamamlanıp ayrıca kararlaştırılmadan yayınlanması yasaktır.
- **Sonraki güvenli adım:** Canlı HTML, JS, CSS yayın SHA karşılaştırması; kayıt yapılmış bir ana âyet açılarak iki listenin kullanıcı tarafından görülmesi.

## Korunan kaynak SHA-256

| Dosya | SHA-256 |
| --- | --- |
| `esma_index.json` | `93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927` |
| `app_data.json` | `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6` |
| `data/benzesen-matris.json` | `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9` |
| `data/mutesabih-degisiklikler.json` | `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa` |
