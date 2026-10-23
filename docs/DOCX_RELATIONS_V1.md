# Ayet benzeşmeleri: DOCX veri seti V1.1

Kaynak: `Ma 1-10.zip` içindeki 114 DOCX belge.
Amaç: Ana ayet referansını, DOCX'te altında gösterilen eşleşen ayet referanslarına bağlamak.

## GitHub'a yüklenen dosyalar

- `data/ayet_benzesme_site_v1_1.json`: **5574 ana ayet, 175375 yönlü benzeşme**. Örn. `"5.120":["2.116",...]`.
- `data/ayet_benzesme_edges_v1_1.csv`: aynı bağların `ana_sure,ana_ayet,eslesen_sure,eslesen_ayet,sira` sütunlarıyla satır bazlı denetimi.
- `data/ayet_benzesme_manifest_v1_1.json`: kaynak SHA-256, kapsam, kalite kontrol ve istisnalar.

GitHub'daki dosyaların blob SHA-1 değerleri yerel V1.1 dosyalarıyla birebir doğrulandı.

## Değişmez kurallar

- **2 Bakara, 3 Âl-i İmrân ve 4 Nisâ:** mevcut site verisi korunur.
- **1 Fâtiha ve 5–114:** DOCX ilişki verisi yeni kaynak otoritesidir.
- Arapça, Türkçe ve İngilizce ayet metinleri bu dosyalara kopyalanmaz; sitenin mevcut verisi kullanılır.
- Aynı sûreye ait kırmızı fakat numarası daha küçük/eşit tekrarlar yeni ana ayet olarak yorumlanmaz (V1.1 düzeltmesi).
- Word kaynağındaki ilişki sırası korunur; ters ilişki veya yapay ilişki üretilmez.
- Kırmızı ana başlığı eksik olan `7.139, 7.198, 11.1, 14.25, 15.28, 53.29, 56.59, 90.12` için mevcut ilişki alanı korunur; yeni kaynağın boş listesiyle otomatik silme yapılmaz.

## Mevcut siteye uygulama — **henüz yapılmadı**

Bu dalda `index.html` ve `app_data.json` **değiştirilmedi**.

Bağımsız bir önizleme üretmek için depo kökünde:

```bash
node tools/import_docx_relations.mjs app_data.json data/ayet_benzesme_site_v1_1.json app_data.docx-preview.json
```

Araç, tüm kaynak referanslarının `db.verses` içinde var olduğunu denetler, 2–4 sûreleri değişmeden bırakır, kaynakta ana başlığı eksik 8 ayetin mevcut ilişkilerini korur ve yalnız ayrı önizleme dosyası üretir.

Yayıma almadan önce eşleşmelerin ekranda doğruluğu, site davranışı, mevcut 2–4 sûreleri ve test çıktıları incelenmelidir. Bu PR bir **taslaktır**; ana dala otomatik birleştirme yapılmamalıdır.
