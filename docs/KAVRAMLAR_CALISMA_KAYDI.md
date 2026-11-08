# Kavramlar — yayımlanmayan çalışma veri seti

Proje: ayatulkuran · Musmur0606/konkordans-veri  
Karar tarihi: 7 Kasım 2026  
Kullanıcının 8 Kasım 2026 tarihinde güncellediği bağlayıcı akış: Arapça kelime / kelime grubunu fareyle seç → kayıt önizlemesini gör → **OK — Veri setine kaydet**. İsteğe bağlı sağ tık menüsündeki **Kavram veri setine aktar** komutu da yalnız onay ekranını hazırlar.

## Kayıt yeri

- Yönetim paneli: https://www.ayatulkuran.com/mutesabih-admin.html
- Veri dalı: `calisma-kavramlar`
- Veri dosyası: `data/kavramlar-calisma.json`
- Veri şeması: `ayatulkuran.concepts-draft.v1`
- Yayın kilidi: `status: not_published`, `automatic: false`
- Kod: `mutesabih-kavramlar.mjs`, `mutesabih-kavramlar-core.mjs`
- Görünüm: `mutesabih-kavramlar.css`
- Bu dosya portalın yayımlanan `main` dalına eklenmez. Portal ve benzeşme motoru bu veriyi okumaz.
- Depo herkese açıktır. Ayrı dal portala aktarımı engeller; GitHub üzerinde gizlilik sağlamaz.

## Giriş ve kaynak kuralları

Aynı yönetim panelindeki seçili ana âyetin Arapça metninde kelime veya kelime grubu fareyle seçilir. Seçim, kaynak âyet numarası ve özgün tam ifade ile bekleyen önizlemeye alınır. Sağ tık yalnız menüyü açar; **Kavram veri setine aktar** öğesi seçimi onaya hazırlar. **Yalnız “OK — Veri setine kaydet” düğmesine basılması GitHub çalışma dosyası yazmasını başlatır.** Vazgeç veya Escape yazma yapmadan bekleyen seçimi iptal eder. Diğer alanlardaki olağan sağ tık menüsü korunur.

Kayıtla birlikte özgün Arapça metin, kaynak sûre/âyet, âyet içindeki seçim aralığı, ekleyen kişi ve zaman tutulur. Seçim, asıl âyet metninin tam dilimiyle doğrulanır. Harekeler, uzatmalar ve özgün yazım değiştirilmez. Ayrı bir arama anahtarı saklanır; bu anahtar kavram kayıtlarını otomatik birleştirmez.

8 Kasım 2026 kavram benzeşmesi: Yönetim paneli, seçili ana âyette geçen **etkin ve kaydedilmiş** kavramları bütün Kur’an âyetlerinde tam kelime / ardışık kelime grubu olarak, arama sırasında harekeleri eşitleyerek arar. Bulduğu diğer âyetler mevcut benzeşen listesine **yalnız görüntüde** eklenir. Sûre ve âyet numarasına göre mükerrer sonuç ve ana âyetin kendisi çıkarılır. Eşleşen çok kelimeli ifade ana âyet ve diğer âyette aynı renkle bütün olarak vurgulanır. Arşivdeki veya henüz OK ile kaydedilmemiş kavramlar kullanılmaz. Kavramdan bulunan ilişki **mevcut Word / site benzeşen veri setine yazılmaz**. Kod ayrı geliştirme dalında hazırlanır ve yayın onayı verilmeden `main` dalına alınmaz.

Elle kopyalayıp kavram kutusuna yapıştırma ve **OK** ile ekleme alternatif olarak kullanılabilir. Dışarıdan yapıştırılan metne açık ana âyet kendiliğinden kaynak atanmaz. Kullanıcı kaynak âyet yazarsa metin o âyetle doğrulanır. Arapça dışındaki harfler ve boş giriş reddedilir.

7 Kasım 2026 R2 ilavesi: **Dosya ekle** ile UTF-8 TXT, CSV veya basit JSON listesindeki Arapça kelime/kelime grupları alınabilir. Dosya seçimi yalnız önizlemedir; **OK — Dosyadaki kavramları ekle** ile tek işlemde ayrı çalışma dalına eklenir. Hatalı tek satır bütün aktarımı durdurur; geçerli satırlar sessizce kısmi kaydedilmez. Dosya adı, SHA-256 ve satır/sıra bilgisi mevcut `notes` alanında kaynak notu olarak korunur; v1 veri şeması ve önceki olaylar değişmez. Dosya içeriğine ekranda açık âyet kendiliğinden kaynak atanmaz. Biçimler ve sınırlar: [KAVRAM_DOSYA_EKLEME_R2.md](KAVRAM_DOSYA_EKLEME_R2.md).

8 Kasım 2026 V2 ilavesi (ayrı taslak özellik dalı): Word **DOCX** için bir paragraf bir kavram; iki sütunlu tabloda ilk sütun kavram, ikinci sütun isteğe bağlı not olarak okunur. Metin katmanlı **PDF** için bir metin satırı bir kavram olarak önizlenir. Bu biçimler en fazla 10 MiB/40 PDF sayfası, ortak sınır 200 kavramdır. Metin katmanı bozuk olan veya taranmış PDF'ler güvenli biçimde reddedilir; otomatik Arapça OCR ve sahte düzeltme yoktur. Dosya metni yalnız tarayıcı belleğinde okunur; kullanıcıya özgün ibareler gösterilerek **OK** beklenir. Orijinal Arapça korunur, yazı tipi farkı kaydı dönüştürmez; arama esnasında Unicode NFKC ve hareke/harf eşdeğerliği ayrı uygulanır. Detay: [DEVIR_2026-11-08_DOSYA_IMPORT_V2.md](DEVIR_2026-11-08_DOSYA_IMPORT_V2.md). Bu ekleme canlı yayına alınmış sayılmaz.

Aynı tam metin tek kavram kimliğinde kalır; yeni kaynaklar/notlar mevcut kaydı zenginleştirir. Farklı harekeli metinler otomatik birleştirilmez. Arşivleme kaydı silmez; geri getirme yeni bir işlem olarak korunur.

## Güvenlik ve önceki kabuller

GitHub yetki anahtarı yalnız açık sekmenin belleğindedir; dosyaya, tarayıcı depolamasına veya günlüğe yazılmaz. Eksik/bozuk çalışma dosyası başka bir dosyaya yönlendirilmez. SHA sürüm çakışmasında üzerine yazılmaz. Kayıt sürerken ana panelin başka bir kayıt başlatması engellenir.

Kavramlar bütün sûrelerden toplanabilir; bu akış 2/3/4 benzeşen girişinin ayrı kayıt yolu değildir. Önceki R234 ayrımı korunur:
- Ana sûre 2/3/4 benzeşenleri: `calisma-234 / data/mutesabih-calisma-234.json`
- Diğer sûrelerin benzeşenleri: mevcut `main / data/mutesabih-degisiklikler.json`
- Kavramlar: `calisma-kavramlar / data/kavramlar-calisma.json`

Kavram modülü yüklenemezse yalnız kavram bölümü hata gösterir; ana benzeşen/sesli giriş modülü çalışmaya devam eder. Bu aşama otomatik yayın veya benzeşme motoruna aktarım izni değildir.

## Kontrol ve devam

Önceki kontroller [kontrol noktasında](HASENAT_KAVRAMLAR_KONTROL_20261107.json) kayıtlıdır; 8 Kasım değişikliklerinin ayrı testi [yeni devirde](DEVIR_2026-11-08_KAVRAM_BENZESME_V1.md) tutulur. Sonraki güvenli adım: yetkili kullanıcı gerçek tarayıcıda bir Arapça kelime veya kelime grubunu fareyle seçer, bekleyen onay ekranını inceler, **OK** basınca kaydın doğru kaynak âyetle ayrı listede göründüğünü ve benzeşen âyetlerde ortak ibarenin aynı renkte işaretlendiğini doğrular. Deneme verisi portalın veri dosyalarına yazılmaz.
