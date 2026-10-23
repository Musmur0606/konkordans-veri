# Ayet Benzeşme Kaynak Kuralı — 23.10.2026

## Kesin kullanıcı kararı

- Sure 2 Bakara, 3 Âl-i İmrân, 4 Nisâ: mevcut site kodlaması ve ilişki listeleri korunur.
- Diğer surelerde ayet benzeşmelerinin **tek kaynağı** kullanıcının `Ma 1-10(1).zip` içindeki 114 özgün DOCX dosyasıdır.
- GitHub'daki eski `verses[*].r` bağlantıları bu surelerde kaynakla doğrulanmadan taşınmaz, birleştirilmez veya eklenmez.
- Arapça, Türkçe ve İngilizce ayet metinleri mevcut `app_data.json` alanlarından okunur. Bu alanlar yeni benzeşme üretim kaynağı değildir.
- DOCX'teki yönlü ana ayet → referans listesi korunur; otomatik karşılıklılık, ek tema ilişkisi veya güven puanı oluşturulmaz.
- Kırmızı ana ayet bölümü belirlenemeyen kayıtlara tahminî ilişki eklenmez; boş aday listesi ile `REVIEW_RED_PRIMARY_NOT_IDENTIFIED` ayrımı korunur.

## İnceleme kaydı

- V2 taraması 173.183 yönlü aday; korunan üç surenin kaynak adayları çıkarıldığında 173.182.
- V2'de bağımsız kırmızı ana ayet bölümü tespit edilemeyen **176** ayet:
  - 63 ayette ilgili sure/ayet başlığı başka renkle geçiyor (çoğunlukla referans başlığı olarak).
  - 113 ayet için kaynak dosyada beklenen biçimde başlık bulunamadı.
- Bu, Kur'an ayetinin eksik olduğu anlamına gelmez; yalnız DOCX kaynakta ana blok tespitinin açık durumudur.

## Yayın sınırı

Yeni ilişki parçaları `REVIEW_NOT_FOR_LIVE_SITE` statüsündedir. `main`, çalışan site ve 2/3/4 korunur. Doğrulama ve kontrollü testten önce canlı entegrasyon yapılmaz.
