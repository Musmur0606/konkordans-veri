# AYATULKURAN — Sağ tıkta Kavram / Esmâ ayrımı — Devir V3

Tarih: 8 Kasım 2026 · Proje: `ayatulkuran` · Depo: `Musmur0606/konkordans-veri`.

Standart: **Tüm Projeler İçin Kalıcı Hafıza ve Kesintisiz Devir Standardı V1**.

## Kullanıcının son bağlayıcı tercihi

Ana âyetin Arapçasında bir kelime veya ibare seçilip **sağ tıklandığında iki ayrı tercih** sunulur:

1. **Kavram veri setine ekle:** Mevcut akışın aynısı; özgün tam ibare ve kaynak konumu önizlenir. **OK onayı olmadan hiçbir kavram kaydı oluşturulmaz.** Kelime grupları parçalanmaz.
2. **Esmâ olarak sorgula:** Seçilen ifade, yalnız kabul edilmiş Esmâ-i Hüsnâ veri setindeki gerçek isimlerle karşılaştırılır. Eşleşirse **bu Esmâ için veri setinde kayıtlı bütün sûre/âyet numaraları** ayrı, geçici ve kaydırılabilir listede gösterilir. Esmâ olmayan seçimde açıkça "kayıt bulunamadı" denir. Listeyi **Kapat** düğmesi kapatır. Bu işlem hiçbir GitHub PUT yapmaz; kavram veya mevcut benzeşen matrisi kayıtlarını değiştirmez.

Esmâ için kök türetme yoktur. Yalnız kayıtlı isim ile izin verilen i‘rab / elif / baştaki `ال` varyantları kabul edilir. `ذُو الجَلَالِ وَالإِكْرَام` gibi çok sözcüklü tek Esmâ, `ذِى الْجَلَالِ وَالْاِكْرَامِ` biçiminde de **bütün ifade** olarak okunur. Hasenat Arapçası veya PDF/Word kökeni kalıcı isim verisini değiştirmez.

## Kaynak otoriteleri ve SHA-256

- Kabul edilmiş Esmâ kaynağı: **`main/esma_index.json`**. **99 isim / 2.050 sûre-âyet bağı**. SHA-256: `93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927`.
- Hasenat 6.236 âyet kaynağı: `main/app_data.json`, SHA-256 `2db8fe12e83a141a4a9e2876f44c7f2ccfddb71f21dfa287db43cdb20408a4b6`.
- Kavram taslağı: **`calisma-kavramlar/data/kavramlar-calisma.json`**; son doğrulamada **0 kayıt / 0 olay**. **Esmâ listesi bu dosyaya eklenmeyecek.**
- Sûre 2, 3, 4 benzeşen taslağı: **`calisma-234/data/mutesabih-calisma-234.json`**; son doğrulamada **0 override / 0 olay**.
- Ana Word ilişkileri: `main/data/benzesen-matris.json`, SHA-256 `ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9`.
- Canlı düzenleme günlüğü: `main/data/mutesabih-degisiklikler.json`, SHA-256 `e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa`.
- Özellik dalı: `feat/admin-kavram-benzesme-20261108`; [taslak PR #6](https://github.com/Musmur0606/konkordans-veri/pull/6). Önceki özellik commit'i `18c4e75008fb1774e2891e0a20c278ea3e6bb58d`. Sonraki V3 commit kimliği yeni devir envanterinde teyit edilir.

## Değişiklikler ve test

- Yeni `mutesabih-esma-benzesme.mjs`: Esmâ veri yapısı, tam isim, kaynak âyet ve kelime grubu eşleştirmesi. 99 isim ve 2.050 bağlantı doğrulanmazsa liste kapatılır.
- `mutesabih-kavramlar.mjs` ve `mutesabih-admin.html`: sağ tık menüsünde iki ayrı işlem; Esmâ sorgusu hiçbir veri setine yazmaz.
- `mutesabih-admin.js`: Esmâ JSON'u yalnız sorguda salt okunur yükler, âyet numaralarını ayrı listede gösterir; sûre/âyet değişince eski sonucu temizler.
- `mutesabih-kavramlar.css`: Esmâ numara listesi ve durum işaretleri.
- `test-esma-sagtik.mjs`: **6/6 PASS** gerçek 99/2050 Esmâ ve Hasenat kaynağıyla. AFUV 4.43→5 âyet, BASÎR 2.96→42 âyet, RAB→832 âyet, tam i‘rablı çok kelimeli Esmâ, yarım sözcük reddi, bozuk veri kapatma.
- Yönetici paneli DOM/API benzetimi: **81/81 PASS** (önceki 79 + 2 yeni, OK ve Esmâ sorgusunun ayrılması).
- Sûre 2/3/4 ve admin DOM benzetimi: **20/20 PASS** (önceki 19 + Esmâ 5 kaydının ekranı ve 0 PUT).
- Diğer kabul: kavram çekirdeği 37, TXT/CSV/JSON 51, DOCX/PDF 6, kavram/benzeşme 8. **İlgili toplam: 209 PASS / 0 FAIL.** Gerçek Chromium/fare/RTL/HSM oturumu kontrolü **HOLD_REAL_BROWSER**.
- Bütün benzetimler ağsız, gerçek GitHub veri PUT'u **0**.

## ACCEPTED / DO_NOT_REDO / HOLD

- **ACCEPTED / DO_NOT_REDO**: Hasenat v2.8.23, 99 Esmâ / 2050 bağ, mevcut Word benzeşenleri, eski kavram çalışması, geri alma ve 2/3/4 ayrımı korunur.
- **HOLD_PUBLICATION**: **2., 3. ve 4. sûrelerle sesli/metin benzeşen girişi kesinlikle canlı sitede olmayacak**. Özellik taslak PR'da durur; açık Murat yayın onayı olmadan merge/deploy yok.
- **HOLD_REAL_BROWSER**: Açık oturumda gerçek fare seçimi/sağ tık, Esmâya göre 832'ye kadar numaranın kaydırılarak görünmesi ve mobil RTL kullanımı görsel olarak henüz doğrulanmadı.
- **HOLD_PDF_TEXT_LAYER**: Esmâ sorgusuyla ilgisiz önceki Word/PDF kavram aktarımındaki bozuk Arapça PDF metin katmanı kontrolü korunur.
- **HOLD_USER_RECORDS**: Kullanıcıdan onaylı kavram veri girişi gelmedi; sahte kayıt eklenmedi.

**Sonraki güvenli adım:** Taslak özellik dalının güncel SHA'sını, testleri ve kaynakları doğrula; yetkili kullanıcıyla ana âyette bir Esmâ seç, iki menü yolunu ve Esmâ numaralarını gerçek tarayıcıda kontrol et. Esmâ listesi benzeşen matrisine kalıcı olarak yazılmayacak. Kullanıcı ayrıca açıkça yayın izni vermedikçe main sürümü değiştirme.
