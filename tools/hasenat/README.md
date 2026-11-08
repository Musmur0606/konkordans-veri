# Hasenat R3 kaynakları ve kelime eşlemesi

Bu dizin, `AI_DEVIR_PAKETI_20261108.zip` içindeki kabul için incelenen sürümü ve
`arh_map` üreticisini içerir. Kaynak dosyalarının SHA-256 değerleri
`KAYNAK_KAYDI.json` içinde kayıtlıdır. Önceki filtre silinmemiştir;
`onceki_surum/` altında kendi SHA-256 değeriyle yedeklenmiştir.

## Tek sürücüyle üretim

Depo kökünden, hazırlanmış `app_data.json` içindeki `arh` ve `krh` ile:

```sh
python -I tools/hasenat/uret.py --output /tmp/hasenat_mapping_candidate.json
python -I tools/hasenat/test_esleme.py --candidate /tmp/hasenat_mapping_candidate.json
```

Hazır alanları orijinal ZIP üzerinden doğrulamak için:

```sh
python -I tools/hasenat/uret.py --prepared-zip /path/to/AI_DEVIR_PAKETI_20261108.zip --output /tmp/hasenat_mapping_candidate.json
```

`--app-data` ile başka bir eski motor verisi, `--prepared-json` ile başka bir
hazır JSON yolu belirtilebilir. Kabul edilmiş `ar`/`kr` içeriğinin hash değeri
kontrol edilir; değişmiş bir motor sürümünde işlem `HOLD` ile durur. Mutlak
Windows yolu veya üçüncü taraf Python bağımlılığı yoktur. Üretici yalnız
`--output` dosyasını yazar; site verisini ya da canlı siteyi değiştirmez.

## Şema ve kullanım

Çıktı bir metadata belgesidir; tüm `app_data.json` dosyasının yerine geçmez:

```json
{"schema":"hasenat-arh-map-v1","verses":{"2:54":{"arh_map":[[0],[1],[2],[3],[4],[4],[5]]}}}
```

Örnek, yalnız dizinin başlangıcını gösterir. Her ayetin gerçek `arh_map`
uzunluğu `arh.split(' ')` kelime sayısına eşittir. Listedeki her öğe, ilgili
ekran kelimesine karşılık gelen `ar.split(' ')` dizisinin sıfır tabanlı
indislerini taşır. `1→1` eşleşmesi `[i]`, `1→2` eşleşmesi iki ayrı `[i]`,
`2→1` eşleşmesi `[i, i+1]` üretir. Bütün eski indisler kapsanır.

`krh`, paketin kök yerleştirme kararlarını aynen korur. Örneğin `2:54`
ayetindeki hitap bölünmesinde `يَا` ve `قَوْمِ`, aynı eski kelimeye bağlıdır;
paketin kökü yalnız ikinci yeni kelimededir. Bu nedenle arama ve esmâ
vurgularının eski kelime konumları `arh_map` üzerinden aktarılmalıdır.

## Kabul kontrolleri

Üretici önce kaynak dosyalarını ve eski filtre yedeğini SHA-256 ile doğrular.
Ardından 114 sure / 6.236 ayet kimliklerini, yeni filtrenin tam ham metin
eşitliğini, 86 referansın kelime sayısını ve NFC kelime eşitliğini denetler.
Üç ham fark (`18:109`, `2:30`, `2:38`) yalnız kanonik işaret sırasındadır;
çıktı metni normalize edilmez.

Eşleme, paketin `site_donustur.py` kodundaki koşullar ve DP geçiş/tie sırası
ile üretilir. 5.836 ayet doğrudan indisleri korur; 400 ayet DP ile eşlenir.
DP kullanılan her ayetin kök dizisi ve maliyeti orijinal paket fonksiyonuyla
tekrar karşılaştırılır. Sonuçtaki 6.236 `krh` dizisi, hazır paket dizileriyle
aynı olmalıdır. Bütün eşlemeler tür, uzunluk, aralık, sıra ve eksiksiz eski
indis kapsamı açısından kontrol edilir. `2:54` bölünmesi ve toplam kelime
sayısı aynı kaldığı hâlde hem bölünme hem birleşme içeren `8:29` ayrıca
sınanır.

Bu kontroller biçimsel veri ve konum tutarlılığını gösterir. Tam metnin
dilbilimsel doğruluğunun veya fontun bütün glifleri çizdiğinin kanıtı değildir.
Kaynakta bulunan Unicode işaretleri eşleme üreticisi tarafından silinmez.
