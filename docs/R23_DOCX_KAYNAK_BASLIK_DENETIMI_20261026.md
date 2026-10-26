# R23 özgün DOCX kaynak başlığı kanıtları · 26.10.2026

**Kapsam:** Önceki V1.1'de boş görünen, R23'te dolu sekiz ana ayetin özgün Word kaynaklarının `word/document.xml` paragrafları incelendi. Bu denetim ayrı olarak kaydedilmiş **14 yöntemsel ayrışmanın tamamını çözmüş sayılmaz.**

## Değişmez kabuller

- Canlı kaynak `data/benzesen-matris.json`: **5.574 ana ayet, 175.478 yönlü ilişki** (R23).
- Yönetici ekleme/çıkarma otoritesi `data/mutesabih-degisiklikler.json`, kaynak matrisi geriye yazmadan uygulanır.
- Bakara (2), Âl-i İmrân (3), Nisâ (4) ana ayetleri eski kodlama ile korunur.
- Başlığın mutlaka **kırmızı renkte** veya mutlaka **beş tireyle** başlaması şart değildir. Word hiyerarşisi, sûre içi 1..N ayet sürekliliği ve bölüm pozisyonu değerlendirilir.
- Bir ana ayetin listesi otomatik ters bağlantıya dönüştürülmez, anlam temelli yeni eşleşme üretilmez.

## Kaynak paragraf denetimi

DOCX paragraf indeksleri **1'den başlar**. Kısa tire `-` ile uzun tire `–` farklıdır. Belgelerin tamamı aynı özgün ZIP'tedir (SHA256: `78c4f365bd60157519b72bc5302d6d5adb90508577af7394d4167035f2a7f0db`).

| Ana ayet | DOCX ana başlık paragrafı | Word başlığı kanıtı | R23 ilişkisi | Sonuç |
|---|---:|---|---:|---|
| A'râf **7:139** | 5649 | Başlık kırmızı; ilk ayraç **iki tire** | 25 | Kaynak başlık bulundu |
| A'râf **7:198** | 8694 | Başlık kırmızı; **başta tire yok** | 58 | Kaynak başlık bulundu |
| Hûd **11:1** | 6 | Başlık kırmızı; sûre numarasından sonra **uzun tire (–)** | 46 | Kaynak başlık bulundu |
| İbrâhîm **14:25** | 1067 | Başlık kırmızı; ilk ayraç **iki tire** | 11 | Kaynak başlık bulundu |
| Hicr **15:28** | — | 624. paragrafta benzeşen rolünde koyu renkli başlık var; ayrı kırmızı ana başlık bulunmadı | 20 | **İNCELEME** |
| Necm **53:29** | 644 | Başlık kırmızı; ilk ayraç **iki tire** | 24 | Kaynak başlık bulundu |
| Vâkıa **56:59** | 991 | Başlık kırmızı; **başta tire yok** | 4 | Kaynak başlık bulundu |
| Beled **90:12** | 171 | Başlık kırmızı; **başta tire yok** | 19 | Kaynak başlık bulundu |

**Toplam:** R23'te bu sekiz ana ayet altında 207 bağlantı bulunur; başlık kanıtı 7/8, açık kaynak biçimi incelemesi 1/8.

### Hicr 15:28 neden İNCELEME?

Özgün Hicr DOCX'te 15:28 için **benzeşen ayet olarak** işaretlenmiş bir başlık var (paragraf 624). Ancak ayrıca ana başlık olduğu renk/biçim açısından doğrudan doğrulanmadı. R23 dizisi 15:27 ve 15:29 arasındaki ardışıklığı kullandığından 15:28 için 20 bağlantı bulunduruyor. Bu, reddetmek için de otomatik kabulü genişletmek için de tek başına yeterli bir kanıt değil. **R23 mevcut 20 bağlantısı aynen korunur**; özgün Word sayfasındaki bölümleme ayrıca insan incelemesine açıktır.

### Rapor ve yeniden üretim

- Makine kayıtları: `data/r23_docx_heading_evidence_20261026.json`
- Bağımsız okuma aracı: `tools/docx_baslik_kanitlari.py`; yalnız kaynak ZIP'i okur, hiçbir GitHub/site dosyasını değiştirmez.
- Komut: `python tools/docx_baslik_kanitlari.py "Ma 1-10.zip" kaynak_baslik_kaniti.json`
- R23 ile eski V1.1 arasındaki **75 farklı ana ayet** karşılaştırması: `data/v1_1_ile_r23_fark_raporu_20261026.json`. Bu 75'lik fark kümesi, R23 kaynak notundaki 14 yöntemsel ayrışmayla özdeş kabul edilmemelidir.

**DO_NOT_REDO:** Eski V1.1 veri seti R23 üzerine yazılmaz. 2–3–4 korunur. Canlı site sürümü, `index.html`, `app_data.json`, `sw.js`, mevcut R23 matrisi ve yönetici geçmişi bu çalışma ile değiştirilmez.
