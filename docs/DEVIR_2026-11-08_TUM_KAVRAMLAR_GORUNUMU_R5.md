# AYATULKURAN — Tüm kavramların yönetici panelinde görünümü R5

**Tarih:** 08.11.2026  
**Önceki canlı kabul:** R4, `main` commit `5719d72bd4f528699c4b3be6ad2e179e82f615b4`.  
**Kapsam:** Yalnız yönetici paneli görünümü, durum metinleri ve test. Önceki R1–R4 kararları korunur.

## Kullanıcı kararı ve kesin anlam

1. Yönetici panelinde, **“Eklenen tüm kavramlar”** başlığı altında etkin ve arşivdeki kayıtların tamamı görünmelidir. Liste form ve dosyadan içe aktarma alanının **üstündedir**. Her kavramın Arapça aslı, kayıt durumu, varsa kaynak sûre.âyet numaraları ve notu gösterilir; kaynak yoksa bu açıkça belirtilir.
2. Varsayılan filtre **“Tümü”**; önceki `ilk 150` kesme sınırı kaldırıldı. Araç, gerçek kayıt sayısını, etkin ve arşiv sayısını gösterir. Son değişen kayıt en üste gelir; kayıt ardından filtreler sıfırlanır ve kayıt listesine kaydırılır. Arama ve yalnız etkin/arşiv filtresi ayrıca kullanılabilir.
3. **“Portala aktarılmadı”**, **“halka açık âyet web sayfalarında yayımlanmadı”** anlamına gelir. Veri silinmez; GitHub'da ilgili çalışma dalında saklanır ve yönetici panelinden görüntülenir. Bu **gizli veri** demek değildir: GitHub deposu herkese açıktır ve çalışma dalının içeriği GitHub'dan okunabilir.
4. Kavramlar `calisma-kavramlar` dalındaki `data/kavramlar-calisma.json` dosyasındadır. 2/3/4 ana âyet çalışmalarının kaydı ayrı `calisma-234` dalındaki `data/mutesabih-calisma-234.json` dosyasındadır. Her ikisinin `publication.status=not_published` / `automatic=false` kilidi korunur; hiçbiri otomatik olarak halkın gördüğü Kur'an/benzeşen portalına aktarılmaz.

## Gerçek kaynak kontrolü (salt okunur)

- `Musmur0606/konkordans-veri`, `calisma-kavramlar` dalındaki kavram dosyası GitHub üzerinden okundu: **5 kayıt, 5 etkin, 0 arşiv, 5 olay**.
- Kaynak blob SHA-1: `fe28a4509d8726ec6c67ca62a341d952f2b468e1`; bu R5 çalışmasında çalışma kaydının kendisi değiştirilmedi.
- `main` dalındaki `esma_index.json` SHA256 `93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927` (99/2050); `app_data.json` `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6` (6236 âyet); `data/benzesen-matris.json` `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9` (175478 bağlantı); `data/mutesabih-degisiklikler.json` `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa`.

## Doğrulama ve sınırlamalar

- **114/114 ağsız test PASS:** kavram paneli **80/80**, Esmâ **10/10**, yönetim/2-3-4 **24/24**.
- Yeni kavram testleri 151 kaydın tamamının gösterildiğini, bir arşiv kaydının varsayılan **Tümü** görünümüne dahil olduğunu, filtre değişimini ve yeni kaydın filtre yüzünden gizlenmediğini doğrular.
- **ACCEPTED:** Tüm kavramların görünümü, gerçek toplam/etkin/arşiv sayıları, son kaydın öne çıkması, portal-yönetici ayrımının açık Türkçe metinle anlatılması.
- **DO_NOT_REDO:** R4 kaydedilmiş benzeşen listesi, R3 yalnız Esmâ sorgusu, mevcut Hasenat yazımı, önceki veri setleri, 2/3/4 yayın kilidi.
- **HOLD:** Kullanıcı tarafından gerçek oturum ve fareyle görsel son kontrol. Word/PDF kavram içe alma ve sağ tıkta ayrı OK onayı henüz kabul edilmiş canlı özellik değildir.
- **Sonraki güvenli adım:** Canlı yönetici HTML/JS/CSS dosyalarını yayın SHA ile kontrol et; yetkili yönetici girişinde “Eklenen tüm kavramlar” alanında 5 kaydı görsel doğrula.
