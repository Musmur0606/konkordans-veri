# DOCX V1.1 – TARİHSEL KAYIT / R23 KORUMA

**Durum: ARŞİV / karşılaştırma. Canlı sitede kullanılmaz.**

Depodaki aktif ve daha yeni Word matrisi:
- `data/benzesen-matris.json` (2026-10-24 R23)
- **5.574 ana ayet, 175.478 benzeşme bağlantısı**
- `data/benzesen-matris-kaynak.json` içindeki SHA-256 ve test-r23-word-matrix.mjs kontrolleri kaynak otoritesidir.
- `data/mutesabih-degisiklikler.json` yöneticinin tarihli ekleme/çıkarma düzeltmelerini ayrı tutar.

Bu dala önceden yüklenmiş **daha eski** kaynak:
- `data/ayet_benzesme_site_v1_1.json`
- 5.574 ana ayet, 175.375 bağlantı
- Noktalı anahtar: `"5.120":["2.116", ...]`
- Çıkarıldığı kaynak: `Ma 1-10.zip`; V1 üstüne dört gömülü kaynak bölümüne ilişkin tarihsel düzeltme.

**Uyarı:** Sırf bağlantı sayısı daha büyük veya daha küçük diye ilişki doğruluğu kabul edilmez. İki kaynak aynı tarihli/aynı yöntemli sürüm değildir. R23 kabulü korunur; eski veri R23 üzerine otomatik kopyalanmaz.

## 26.10.2026 gerçek karşılaştırma sonucu

`data/v1_1_ile_r23_fark_raporu_20261026.json` iki GitHub JSON'unun **birebir liste karşılaştırmasıyla** üretilmiştir.

| Ölçüt | Tarihsel V1.1 | Kabul edilmiş R23 |
|---|---:|---:|
| Ana âyet | 5.574 | 5.574 |
| Bağlantı | 175.375 | 175.478 |
| Boş eşleşme listesi | 19 | 11 |

- **75 ana âyetin** eşleşmesi farklı; sıra-only farkı yok.
- R23'e özgü **264** ilişki; V1.1'e özgü **161** ilişki; **net fark +103**.
- Önemli bölünme kaynakları: `7:198` (eski boş, R23 58), `11:1` (eski boş, R23 46); `7:197` (81 → 27), `7:139` (0 → 25), `53:29` (0 → 24). Bunlar otomatik değişiklik talebi değil, sürümler arası bulgulardır.
- **8:58** için R23 kaynak matrisinde 30 benzeşen ve 1 ana ayet vardır; gösterimde toplam 31 âyet söz konusudur. Bu sayım, tarihsel V1.1'in otomatik yayımlanma gerekçesi olamaz.
- R23 kaynak manifestindeki 14 yöntemsel ayrışma ayrı İNCELEME konusudur. Yönetici ekleme/çıkarma kayıtları bu raporda V1.1 ya da R23 kaynağına geri yazılmadı.

## Korumalar
1. Ana ayet olarak 2 Bakara, 3 Âl-i İmrân, 4 Nisâ eski kodlamaya bağlıdır; yeni matrise ana ayet olarak girmez. Başka sûrelerin listelerinde eşleşen ayet olabilirler.
2. Arapça, Türkçe, İngilizce metinler `app_data.json` otoritesindedir; benzeşme haritasına yeniden yazılmaz.
3. Word matrisindeki sıralı bağlantılar tek yönlüdür; tersine otomatik yayılmaz.
4. Canlı `main`, `index.html`, `app_data.json`, `data/benzesen-matris.json`, `data/mutesabih-degisiklikler.json` **bu PR ile değişmez**.
5. 14 yöntemsel fark ve sarı/inceleme durumları R23 sicili dışına otomatik çıkarılmaz.

## Salt-okunur kaynak fark denetimi

```bash
node tools/compare_legacy_v1_1_to_r23.mjs
node tools/compare_legacy_v1_1_to_r23.mjs data/ayet_benzesme_site_v1_1.json data/benzesen-matris.json app_data.json reports/v1_1_vs_r23.json
```

Karşılaştırma R23 dosyasının kabul edilmiş SHA-256 değerini denetler; ayet referansları ve 2–3–4 korumasını kontrol eder; yeni/eski matrise özgü bağlantıları, sıradan kaynak sıralaması farklarını ve boş listeleri raporlar. **Mevcut dosyaların hiçbirini değiştirmez.** GitHub edit logundaki güncel yönetici düzeltmeleri bu karşılaştırmadan ayrıca izlenir.

**BİRLEŞTİRME/HOLD:** Bu çalışma `main` dalına gönderilmek üzere onaylanmış bir entegrasyon değildir; öncelik mevcut kabul edilmiş R23 uygulamasındadır. Rapor bulguları karar verilmeden üretim verisine uygulanamaz.
