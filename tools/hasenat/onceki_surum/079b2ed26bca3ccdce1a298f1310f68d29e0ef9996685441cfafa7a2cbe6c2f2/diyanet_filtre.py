# -*- coding: utf-8 -*-
"""
Diyanet mushaf yazımından Hasenat görünümüne dönüştürücü.

Kaynak: kaynak_diyanet/kuran.json  (github.com/alperenugus/Kuran, CC BY 4.0;
        metnin kaynağı Diyanet İşleri Başkanlığı, kuran.diyanet.gov.tr/mushaf)
Çıktı : cikti/KURAN_HASENAT_YAZIMI.txt   (sure|ayet|metin)  -- ANA METİN

Diyanet metni Hasenat'la aynı imladadır (Türk mushafı). Fark yalnızca işaretler ve
bazı karakterlerin kodlanmasındadır; bu betik onları Hasenat'taki gibi yapar.

Kullanım:
    python -I diyanet_filtre.py                -> tüm metni üretir
    python -I diyanet_filtre.py 2:255 36:82    -> sadece bu ayetleri ekrana basar
"""
import json
import re
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent
KAYNAK = KOK / "kaynak_diyanet" / "kuran.json"
CIKTI = KOK / "cikti" / "KURAN_HASENAT_YAZIMI.txt"

KASRA, SHADDA, SUKUN = "ِ", "ّ", "ْ"
DAGGER, SUB_ALEF, HAMZA_UST = "ٰ", "ٖ", "ٔ"
YA, ALEF_MAKSURA, FARSI_YA, PE = "ي", "ى", "ی", "پ"
HAREKE = "ً-ْٖ"            # hareke, tenvin, cezm, şedde, alttan elif
ISARET = "ً-ْٰٖ"      # + üstten küçük elif

# Hasenat'ın göstermediği işaretler: secavendler, med, sessiz harf halkaları, vakıf işaretleri
GOSTERILMEYEN = "[ؕؗۖ-ۜ۞۩࣑࣒ࣕࣖࣞ࣢ٓـ]"


def _ye(kelime: str) -> str:
    """Diyanet her ye'yi U+06CC ile yazar. Hasenat:
    - kelime sonunda esreden sonra ى (U+0649), diğer son ye'lerde ی (U+06CC)
    - sondaki hemzeden önce, hemze kürsüsü olarak ve küçük eliften sonra ی
    - diğer yerlerde (kelime içi) noktalı ي (U+064A)"""
    harfler = list(kelime)
    for i, c in enumerate(harfler):
        if c != FARSI_YA:
            continue
        sonrasi = kelime[i + 1:]
        oncesi = kelime[:i]
        isaretsiz_sonrasi = re.sub("[" + ISARET + "]", "", sonrasi)
        if isaretsiz_sonrasi == "":                                   # kelime sonu
            harfler[i] = ALEF_MAKSURA if re.search("[" + KASRA + SUB_ALEF + "]" + SHADDA + "?$", oncesi) else FARSI_YA
        elif isaretsiz_sonrasi.startswith("ء") and len(isaretsiz_sonrasi) == 1:   # شَیْءٍ ، يُضٖیءُ
            harfler[i] = FARSI_YA
        elif sonrasi.startswith(HAMZA_UST):                           # hemze kürsüsü: اِسْرَایٖٔلَ
            harfler[i] = FARSI_YA
        elif oncesi.endswith(DAGGER) and not oncesi.endswith("ا" + DAGGER):   # تَرٰینٖى ، التَّوْرٰیةَ (اٰيَات hariç)
            harfler[i] = FARSI_YA
        else:
            harfler[i] = YA
    return "".join(harfler)


def hasenat_gorunumu(t: str, ilk_ayetler: bool = False) -> str:
    t = re.sub(GOSTERILMEYEN, "", t)

    k = t.split()
    # Mukattaa harfleri (الم ، كهيعص ...): Hasenat işaretsiz yazar
    if ilk_ayetler and k and not re.search("[" + HAREKE + "]", k[0]):
        k[0] = re.sub("[" + ISARET + "]", "", k[0])

    yeni = []
    for w in k:
        w = _ye(w)
        # Kürsüsüz (dişli) hemze -> پ :  يَسْـَٔلُونَ -> يَسْپَلُونَ , شَيْـًٔا -> شَيْپًا , سَيِّـَٔاتِ -> سَيِّپَاتِ
        w = re.sub("(?<=[" + ISARET + "])" + HAMZA_UST, PE, w)
        # Kürsülü hemzede alttan elif önce gelir:  ی ٔ ٖ -> ی ٖ ٔ
        w = w.replace(HAMZA_UST + SUB_ALEF, SUB_ALEF + HAMZA_UST)
        # Kelime sonunda ye + alttan elif -> ardına noktasız ye:  يَسْتَحْيٖ -> يَسْتَحْيٖى
        w = re.sub("(" + YA + SUB_ALEF + ")$", "\\1" + ALEF_MAKSURA, w)
        # Şedde sırası: önce hareke sonra şedde
        w = re.sub(SHADDA + "([ً-ِ])", "\\1" + SHADDA, w)
        yeni.append(w)
    return " ".join(yeni)


def oku():
    veri = json.loads(KAYNAK.read_text(encoding="utf-8"))
    for s in veri["surahs"]:
        for a in s["ayahs"]:
            yield s["number"], a["ayah"], a["text_unicode"]


def ayet_yazimi(sure: int, ayet: int, metin: str) -> str:
    return hasenat_gorunumu(metin, ilk_ayetler=ayet <= 2)


def main(argv):
    if argv:
        istenen = {tuple(map(int, x.split(":"))) for x in argv}
        for s, a, m in oku():
            if (s, a) in istenen:
                print(f"{s}:{a}  {ayet_yazimi(s, a, m)}")
        return
    CIKTI.parent.mkdir(exist_ok=True)
    satirlar = [f"{s}|{a}|{ayet_yazimi(s, a, m)}" for s, a, m in oku()]
    baslik = [
        "# Hasenat görünümüne dönüştürülmüş Kur'an metni (Türk mushafı imlası).",
        "# Metnin kaynağı: Diyanet İşleri Başkanlığı, kuran.diyanet.gov.tr/mushaf",
        "# Veri seti: github.com/alperenugus/Kuran (CC BY 4.0)",
    ]
    CIKTI.write_text("\n".join(baslik + satirlar) + "\n", encoding="utf-8")
    print(f"{len(satirlar)} ayet yazıldı -> {CIKTI}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
