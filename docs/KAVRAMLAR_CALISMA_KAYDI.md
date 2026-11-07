# Kavramlar — yayımlanmayan çalışma veri seti

Proje: ayatulkuran · Musmur0606/konkordans-veri  
Karar tarihi: 7 Kasım 2026  
Kullanıcının son ve bağlayıcı akışı: Arapça kelime / kelime grubunu seç → sağ tık → **Kavram veri setine aktar**.

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

Aynı yönetim panelindeki seçili ana âyetin Arapça metninde kelime veya kelime grubu seçilir. Sağ tık yalnız menüyü açar. **Kavram veri setine aktar** öğesine tıklamak ayrı çalışma dosyasına kaydı başlatır; ikinci kopyala/yapıştır veya OK gerekmez. Diğer alanlardaki olağan sağ tık menüsü korunur.

Kayıtla birlikte özgün Arapça metin, kaynak sûre/âyet, âyet içindeki seçim aralığı, ekleyen kişi ve zaman tutulur. Seçim, asıl âyet metninin tam dilimiyle doğrulanır. Harekeler, uzatmalar ve özgün yazım değiştirilmez. Ayrı bir arama anahtarı ilerideki arama için saklanır; bu anahtar kavramları otomatik birleştirmez veya yeni benzeşen ilişkiler üretmez.

Elle kopyalayıp kavram kutusuna yapıştırma ve **OK** ile ekleme alternatif olarak kullanılabilir. Dışarıdan yapıştırılan metne açık ana âyet kendiliğinden kaynak atanmaz. Kullanıcı kaynak âyet yazarsa metin o âyetle doğrulanır. Arapça dışındaki harfler ve boş giriş reddedilir.

7 Kasım 2026 R2 ilavesi: **Dosya ekle** ile UTF-8 TXT, CSV veya basit JSON listesindeki Arapça kelime/kelime grupları alınabilir. Dosya seçimi yalnız önizlemedir; **OK — Dosyadaki kavramları ekle** ile tek işlemde ayrı çalışma dalına eklenir. Hatalı tek satır bütün aktarımı durdurur; geçerli satırlar sessizce kısmi kaydedilmez. Dosya adı, SHA-256 ve satır/sıra bilgisi mevcut `notes` alanında kaynak notu olarak korunur; v1 veri şeması ve önceki olaylar değişmez. Dosya içeriğine ekranda açık âyet kendiliğinden kaynak atanmaz. Biçimler ve sınırlar: [KAVRAM_DOSYA_EKLEME_R2.md](KAVRAM_DOSYA_EKLEME_R2.md).

Aynı tam metin tek kavram kimliğinde kalır; yeni kaynaklar/notlar mevcut kaydı zenginleştirir. Farklı harekeli metinler otomatik birleştirilmez. Arşivleme kaydı silmez; geri getirme yeni bir işlem olarak korunur.

## Güvenlik ve önceki kabuller

GitHub yetki anahtarı yalnız açık sekmenin belleğindedir; dosyaya, tarayıcı depolamasına veya günlüğe yazılmaz. Eksik/bozuk çalışma dosyası başka bir dosyaya yönlendirilmez. SHA sürüm çakışmasında üzerine yazılmaz. Kayıt sürerken ana panelin başka bir kayıt başlatması engellenir.

Kavramlar bütün sûrelerden toplanabilir; bu akış 2/3/4 benzeşen girişinin ayrı kayıt yolu değildir. Önceki R234 ayrımı korunur:
- Ana sûre 2/3/4 benzeşenleri: `calisma-234 / data/mutesabih-calisma-234.json`
- Diğer sûrelerin benzeşenleri: mevcut `main / data/mutesabih-degisiklikler.json`
- Kavramlar: `calisma-kavramlar / data/kavramlar-calisma.json`

Kavram modülü yüklenemezse yalnız kavram bölümü hata gösterir; ana benzeşen/sesli giriş modülü çalışmaya devam eder. Bu aşama otomatik yayın veya benzeşme motoruna aktarım izni değildir.

## Kontrol ve devam

Kabul ve gerçek tarayıcıda bekleyen kontroller [kontrol noktasında](HASENAT_KAVRAMLAR_KONTROL_20261107.json) kayıtlıdır. Sonraki güvenli adım: yetkili kullanıcı gerçek tarayıcıda bir Arapça kelimeyi sağ tıkla aktarır, kaydın ayrı listede ve doğru kaynak âyetle göründüğünü kontrol eder. Deneme verisi portalın veri dosyalarına yazılmaz.
