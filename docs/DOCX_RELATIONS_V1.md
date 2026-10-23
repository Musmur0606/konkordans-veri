# DOCX benzeşme veri seti entegrasyonu (taslak)

Kaynak: Kullanıcının `Ma 1-10.zip` içindeki 114 DOCX dosyasından türetilmiş `ayet_benzesme_site.json`. Kaynakta ana ayet kırmızı başlık, altındaki referanslar eşleşen ayetlerdir. Ayet metinleri JSON'a tekrar konmaz.

- 2 Bakara, 3 Âl-i İmrân ve 4 Nisâ'nın ilişkileri ve metinleri **değişmeyecek**.
- 1 Fâtiha ve 5–114 sûrelerin ilişkileri yeni DOCX veri setinden gelecek.
- Yeni veri kümesi: 5574 ana kayıt, 175318 benzersiz yönlü ilişki.
- Eksik kırmızı başlıklar, tekrarlar ve kaynak anormallikleri `qa_report.json` içindedir; otomatik anlam temelli ilişki eklenmez.

## Uygulama

Bu dal henüz canlı siteyi değiştirmez. Önce kullanıcıdan alınmış `ayet_benzesme_site.json` dosyası aynı klasörde hazır bulunmalı. Aşağıdaki komut bir **önizleme** üretir:

```bash
node tools/import_docx_relations.mjs app_data.json ayet_benzesme_site.json app_data.docx-preview.json
```

İşlem mevcut `app_data.json` üzerine yazmaz. Referansların tamamını `db.verses` içerisinde doğrular ve 2/3/4. sûrelere dokunulmadığını kontrol eder. Yalnız doğrulama tamamlanırsa ayrı bir çıktı oluşturur. Bu yeni çıktı yayımlanmadan önce kaynakla ve sitenin mevcut görünümüyle karşılaştırılmalıdır.

**Dikkat:** Kaynak DOCX'in 9 ayetinde kırmızı ana bölüm eksik olduğu için ilgili diziler boş olabilir; veri seti elle tamamlanmış gibi kabul edilmemelidir. İlişki yönü otomatik olarak tersine çevrilmez.
