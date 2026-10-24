# AYATULKURAN — DEVİR NOTU (24.10.2026, Esmâ R1)

## Korunacak kabul
- Depo: Musmur0606/konkordans-veri; site: https://www.ayatulkuran.com/.
- Benzeşen matris ayrı otorite: 111 sûre, 5.574 ana âyet, 175.478 bağlantı; 8:58 için 30 benzeşen + ana âyet = 31. Kaynağı sessizce değiştirme.
- 2, 3, 4. sûreler benzeşen matrisinde ana kayıt olarak korunur; hedef olarak kullanılabilir.
- Önceden işlenmiş Kur’an metinleri ve ses/video özellikleri değiştirilmedi.

## Bu tur kabul ve işlemler
- Kullanıcı kaynakları: ESMAU'L-HUSNA VE MANALARI.docx ve Esma_Veri_Seti_Paketi.zip.
- Word: 99 Esmâ ismine Türkçe anlam; Word'de VEHHÂB sıra numarası 85 yazılmış olsa da isimle eşleştirildi. Site isimleri ve Arapçaları olduğu gibi tutuldu.
- Esmâ ZIP: 99 isim, 2.050 tekil isim→âyet bağlantısı, 1.465 tekil âyet. Eski site 2.049; tek içerik farkı VELÎ 41:31 (eklendi).
- esma_index.json SHA 889df97349043ce44211f60dd471106fa3e323bf, commit 7b61fa5161494ae224271b972ef03736094c1808.
- index.html son SHA 04adb2c903e54165f349090c499f64d743a29ce9, commit 20bfeeb37c376e817eb47b8fec8acd22f287950a; arayüz sürümü 2.8.0.
- Esmâ yan menüsünde Arapça, mevcut Esmâ adı, Türkçe anlam ve adet; ayrıntı başlığında anlam.
- Mobil sûre okumada âyet numarası seçicisi eklendi; masaüstü kenar çubuğu ayet kutusu korundu.
- Esmâ Arapça renklendirmede sadece seçilen adın hareke/tenvin farkları ve isteğe uygun baştaki ال varyantı; kökten gelen diğer kelimeler boyanmayacak; âyetin gerçek Arapça metni değiştirilmez.
- Benzeşen hedefe tıklama zaten goto(ref)→openRef(ref)→selectVerse(ref) akışıyla kendi ekranını açıyor.

## Açık inceleme ve sınırlar
- ZIP kaynak notunda altı kaynak tutarsızlığı işaretli (İLAH, MUHÎT, TEVVÂB, VELÎ, CÂMİ’, RAZZÂK) ve başlıksız 14 işaret. Bunlar keyfî yeni eşleşmeye dönüştürülmemeli.
- Benzeşen Word ilişkilerindeki 14 sınır kaydı ayrıca incelemeye açık.
- Son kod GitHub'da doğrulandı; mobil cihazda ve yayındaki statik site dağıtımında son görsel/tıklama kabulü yapılmalı.
- Yönetim paneli için güvenli kullanıcı adı/şifre, oturum denetimi, zorunlu tarih/gerekçe, ikinci onay ve sunucu tarafı erişim kontrolü önceki taleplerden açık; bunların tamamlanmış olduğu iddia edilmemeli.

## Sonraki adım
1. Cep telefonu görünümünde sûre→âyet seçme ve benzeşen→kendi benzeşenleri akışını elle test et.
2. Esmâ'da besîr örneği gibi i‘rab varyantlarını ve kökdeş ama başka kelimeleri ayırma testleri yap.
3. Kullanıcı onayıyla altı Esmâ kaynak tutarsızlığını ve açık kayıtları ayrı incele.
4. Admin güvenlik mimarisi ve sunucu tarafı yetkilendirme işine dön.
