# AYATULKURAN — Dış dosyadan kavram aktarma — Devir V2

Tarih: 8 Kasım 2026 · Proje `ayatulkuran` · Depo `Musmur0606/konkordans-veri`.
Standart: **Tüm Projeler İçin Kalıcı Hafıza ve Kesintisiz Devir Standardı V1**.

## İşin sonucu ve yetki sınırı

- Yönetici panelinin taslak `feat/admin-kavram-benzesme-20261108` dalına Word **DOCX**, metin tabakalı **PDF** alma kodu eklendi; eski TXT/CSV/JSON, elle kopyalama ve fareyle seçme akışı korundu.
- Bir Word paragrafı veya tablonun ilk sütunundaki **bütün Arapça ibare** tek kavramdır. `رَبِّ الْعَالَمِينَ`, `رَبِّ` ve `الْعَالَمِينَ` diye parçalanmaz. Her PDF metin satırı, metin katmanı doğruysa tek ibaredir.
- Yükleme dosyası bilgisayardan doğrudan tarayıcıda okunur; dosya ayrıca sunucuya veya üçüncü kişiye gönderilmez. Dosyaya SHA-256 hesaplanır; **önizleme ve OK** olmadan GitHub'a kayıt yapılmaz. Kayıtta dosya adı, SHA-256, satır/sıra ve isteğe bağlı not korunur.
- Dosya içeriği ana âyetteki kelimeye kendiliğinden kaynak bağlamaz. Kavram ilişkisinin gerçek sûre/âyet taraması yalnız yönetici görünümünde etkin, kaydedilmiş kavramlarla yapılır; mevcut benzeşen listesi, yayın matrisi ve motor değişmez.
- **Canlı portala yayımlanmadı.** 2, 3 ve 4. sûrelerle ilgili sesli/metin girişli benzeşen ekleme de canlı portalda bulunmamalı; ayrı kullanıcı yayın onayı olmadan merge/deploy yok.

## Biçimler, görüntüleme ve font farkı

| Biçim | Veri alma biçimi | Sınır / çekince |
| --- | --- | --- |
| `.docx` | Normal Word paragrafı veya iki sütunlu `Kavram` / `Not` tablosu | 10 MiB dosya, açılmış ana XML 2 MiB; en çok 200 kavram; `.doc`, makro ve tehlikeli Word yapıları kabul edilmez |
| `.pdf` | Sayfa koordinatına göre satır grubu, okunabilen Arapça metin katmanı | 10 MiB, 40 sayfa, 200 satır; PDF görüntüsü doğru olsa bile metin kodları bozuksa hata verilir; taranmış PDF/otomatik OCR HOLD |
| `.txt` | UTF-8 ile satır başına tek kavram | En çok 1 MiB ve 200 kavram |
| `.csv` | `kavram,not` veya `kavram;not` başlıklı iki sütun | En çok 1 MiB ve 200 kavram |
| `.json` | Arapça ibare dizisi veya `arabic_text` ve isteğe bağlı `note` nesne dizisi | En çok 1 MiB ve 200 kavram; tam çalışma JSON'u doğrudan içe alınmaz |

**Font kuralı:** Arapça yazı tipinin adı (Hasenat, Word fontu, Naskh vb.) veri kimliği değildir. Word'de seçilen özgün Unicode ibare ve harekeleri aynen kaydedilir. Âyet aramasında Unicode NFKC, hareke çıkarma ve denetlenmiş harf eşdeğerliği uygulanır; kelime sayısı ve **kelime sırası korunur**. İfadeye rastlanmadığında sessizce ayrı kelimelerle eşleştirme yapılmaz. PDF'nin Unicode metin katmanı bozuksa belge eklenmez; özgün DOCX tercih edilir veya kullanıcı metni düzeltip tekrar önizler.

Kullanıcı için boş Word şablonu: `KAVRAM_WORD_GIRIS_SABLONU.docx` (indirilebilir sürümlü devir ZIP'inin kökünde). Şablon başlığı ve sütun başlığı içe aktarılmaz; boş satırlar atlanır.

## Kesin çalışma veri depoları

- Kavram kelimeleri ve kelime grupları: dal `calisma-kavramlar`, dosya `data/kavramlar-calisma.json`, şema `ayatulkuran.concepts-draft.v1`; uzak kaynak doğrulamasında **0 gerçek kayıt, 0 olay**.
- Ana sûre 2/3/4 benzeşen girişleri: dal `calisma-234`, dosya `data/mutesabih-calisma-234.json`, şema `ayatulkuran.draft234.v1`; **0 override, 0 olay**. Sesli/metin girişleri yalnız bu özel taslakta çalışmalıdır.
- Mevcut kabul edilmiş benzeşen matrisi: `main/data/benzesen-matris.json`; canlı ilişki işlemleri: `main/data/mutesabih-degisiklikler.json`; Hasenat corpus: `main/app_data.json` (**6.236 âyet**). **Bu dosyalar değiştirilmedi.**

8 Kasım 2026 kaynak ref'leri: `main=4cb4a1cb0a8aef3b85f7feb05345bb8205f3175e`, `calisma-234=315740e5b5ab4699e046e07b418b90adc19ceace`, `calisma-kavramlar=6bbf0849c73e3f9868214a1b33d902c1b7ab52f6`. Başlangıç özellik commit'i `131bf71e41bd61155d4907b57deefad58777e0cf`, taslak PR [#6](https://github.com/Musmur0606/konkordans-veri/pull/6). Yeni dosya içe aktarımı sonraki commit'te gönderilmişse sürümü devir envanterinden teyit edin.

## Testler, ACCEPTED, HOLD

- **200 PASS, 0 FAIL**: kavram benzeşmesi gerçek 6.236 âyet corpus'u üzerinde 8; panel DOM/API benzetimi 79; kavram çekirdeği 37; dosya içe aktarımı 51; yeni DOCX/PDF ayrıştırma 6; R234 sesli/metin işlev benzetimi 19. Bu testler hiçbir gerçek GitHub PUT yapmadı.
- Gerçek Word şablonunun birinci boş veri hücresine iki kelimelik Arapça ibare eklenerek, `.docx` kaydı önizlemede tek kavram olarak ayrıca doğrulandı.
- Gerçek Word'den üretilmiş, görselde **doğru Arapça** olan PDF'nin metin katmanı bozuk çıktı; sistem metni yanlış yazmadan durdurdu. Bu örnek **HOLD_PDF_TEXT_LAYER** kanıtıdır; OCR veya bütün PDF'lere koşulsuz başarı iddiası yoktur.
- **HOLD_REAL_BROWSER**: Gerçek tarayıcı, yetkili hesap, seçilmiş dosya ve RTL görünümü üzerinde son kontrol bekler (çalışma ortamında Chromium socket EPERM).
- **HOLD_PUBLICATION**: 2/3/4 girişleri ve kavram özelliği kullanıcının sonraki açık izni olmadan canlıya aktarılmaz. GitHub PR taslak kalır.
- **HOLD_USER_RECORDS**: Gerçek kavram kaydı yok; kullanıcı onayı olmadan örnek/sahte kavram yazılmaz.
- **ACCEPTED / DO_NOT_REDO**: Hasenat kabulü v2.8.23, mevcut Word benzeşen matrisi, önceki 2/3/4 yönlendirmesi, tüm geçmiş ve kaynak kilitleri byte eş korunur.

## Sonraki güvenli adım

Yetkili kullanıcı `mutesabih-admin.html` sayfasının **taslak/geliştirme sürümünde** Word şablonunu doldurur; **Dosya ekle → önizleme → OK** ile gerçek kavramları kaydeder. Sonra ana âyet seçildiğinde o ibarenin geçtiği diğer âyetlerin aynı renkte ve mükerrersiz listelendiğini kontrol eder. Gerçek Chromium ve PDF türleri için ayrı kabul kaydı tutulur; yayın ancak bundan sonra Murat'ın açık talimatıyla yapılır.
