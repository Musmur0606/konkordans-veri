# Arapça kavramlar — elle ve dosyadan ekleme R2

Proje: ayatulkuran · Musmur0606/konkordans-veri  
Karar: 7 Kasım 2026 · Site sürümü: 2.8.22

## Kullanım

Yönetim panelinde GitHub yetkisini doğrulayın ve **Kavramlar — çalışma veri seti** bölümüne gidin.

1. Tek kavram için Arapça kelimeyi veya kelime grubunu yazın/yapıştırın; **OK** düğmesine basın. Kaynak âyet alanı isteğe bağlıdır, yazılırsa birebir dilim doğrulanır.
2. Bir liste için **Dosya ekle** düğmesini kullanın. Dosya seçimi veri setine yazmaz.
3. Önizlemede yeni, mevcut ve arşivde kalacak kavramları kontrol edin.
4. **OK — Dosyadaki kavramları ekle** düğmesi listeyi tek GitHub dosya güncellemesiyle kaydeder. **Vazgeç** hiçbir kaydı değiştirmez.

Sağ tıkla **Kavram veri setine aktar** kısa yolu ve olağan kopyala/yapıştır davranışı korunur. Elle giriş alanındaki bekleyen metin/not, dosya aktarımında kullanılmaz veya silinmez.

## Desteklenen dosyalar

UTF-8 kodlama, en fazla 1.048.576 bayt (1 MB) ve 200 dolu veri satırı/sırası. Bir defada bir dosya seçilir. TXT/CSV boş satırları ve CSV başlığı kavram sayılmaz. Word, PDF, XLS/XLSX doğrudan okunmaz; liste önce UTF-8 TXT veya uygun CSV olarak kaydedilmelidir.

TXT — her satır bir kavram; birden fazla kelimelik ifade parçalanmaz:

```text
العلم
الصبر
الحياة الدنيا
```

CSV — başlıklar `kavram,not`; virgül veya noktalı virgül ayırıcı ve tırnaklı hücreler desteklenir:

```csv
kavram,not
العلم,Bilgi ile ilgili çalışma
الحياة الدنيا,Kelime grubu olarak sakla
```

JSON — Arapça metin dizisi:

```json
["العلم", "الصبر", "الحياة الدنيا"]
```

Veya notlu kayıt dizisi:

```json
[{"arabic_text":"العلم","note":"Çalışma notu"}]
```

Panelin **JSON indir** düğmesinin ürettiği tam geçmiş/yedek belgesi bu basit listeyle aynı biçim değildir. Tam geçmişi içe aktarıp mevcut sicilin üzerine yazma bu özelliğin kapsamında değildir; böyle bir dosya açık hatayla reddedilir. Örnek kavramlar açıklama içindir; uygulama kurulurken veri setine eklenmez.

## Veri ve kaynak koruması

- Kayıt yeri değişmez: `calisma-kavramlar / data/kavramlar-calisma.json`.
- Portal, benzeşen motoru ve yayımlanan benzeşen sicili bu dosyayı okumaz; otomatik yayın yoktur.
- Mevcut repo herkese açıktır. Çalışma dalı portala dahil değildir fakat GitHub üzerinde gizli değildir.
- Harekeler, harfler ve iç boşluklar korunur. Dosyadaki kavramın başındaki/sonundaki boşluklar temizlenir. Farklı harekeli yazımlar otomatik birleştirilmez.
- Birebir aynı Arapça kavram tek kayıt kimliğinde kalır. Yeni dosya kaynağı/not mevcut kayda eklenebilir; arşivdeki kayıt kendiliğinden etkinleştirilmez.
- Aynı ad ve aynı içerikli dosya tekrar onaylandığında aynı kaynak notu ikinci kez eklenmez.
- Dosya adı, özgün baytların SHA-256 değeri ve TXT/CSV satır numarası veya JSON sıra numarası kaynak notuna yazılır. İşlemi yapan kullanıcı ve zaman mevcut eklemeli işlem geçmişinde tutulur.
- Dosya kaynağı, kaynak âyet değildir. Açık ana âyet dosya kavramlarına otomatik atanmaz; âyet kaynağı uydurulmaz.
- Boş, bozuk, sınırı aşan, desteklenmeyen veya Arapça dışı kavram içeren dosya tamamen reddedilir. Sessiz satır atlama/kısmi kayıt yoktur.
- Önizleme metni HTML olarak çalıştırılmaz. Dosya yalnız kullanıcının seçimiyle okunur; dosya seçildiğinde ağa gönderilmez. Onayda yalnız oluşturulan kavram kayıtları kendi çalışma dalına gider.
- Oturum değişirse bekleyen okuma/önizleme kapanır. Güncel SHA değişmişse yazma durur; otomatik tekrar veya üzerine yazma yoktur.

## Kod, test ve devam

- Ekran: `mutesabih-admin.html`, `mutesabih-kavramlar.css`
- Ekran akışı: `mutesabih-kavramlar.mjs`
- Saf dosya ayrıştırma/toplu ekleme: `mutesabih-kavramlar-import.mjs`
- Değiştirilmeyen veri çekirdeği: `mutesabih-kavramlar-core.mjs`
- Testler: `test-kavramlar-import.mjs`, `test-kavramlar-panel.mjs`
- Kontrol noktası: [HASENAT_KAVRAM_DOSYA_R2_20261107.json](HASENAT_KAVRAM_DOSYA_R2_20261107.json)

Kavramların benzeşen âyet sonuçlarına katılması, ayet numarasıyla tekilleştirilmesi ve iki tarafta aynı kavramın renklendirilmesi daha sonraki ayrı iştir. Bu sürüm bu arama/yayın işini başlatmaz.
