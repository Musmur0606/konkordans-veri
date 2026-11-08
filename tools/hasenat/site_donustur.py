# -*- coding: utf-8 -*-
"""
ayatulkuran sitesi için Hasenat yazımlı Arapça metin üretir.

Girdi : site_kaynak/app_data.json   (sitenin mevcut verisi; ar = Medine yazımı, kr = kelime başına kök)
        cikti/KURAN_HASENAT_YAZIMI.txt
Çıktı : site_cikti/app_data.json    (her âyete 'arh' = Hasenat metni, 'krh' = arh kelimelerine hizalanmış kökler)

'ar' ve 'kr' DEĞİŞTİRİLMEZ: sitenin arama, esmâ ve benzeşen motoru onları kullanmaya devam eder.
Ekranda gösterim için 'arh' / 'krh' kullanılır.
"""
import json
import re
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent
GIRDI = KOK / "site_kaynak" / "app_data.json"
METIN = KOK / "cikti" / "KURAN_HASENAT_YAZIMI.txt"
CIKTI = KOK / "site_cikti" / "app_data.json"


def iskelet(w: str) -> str:
    """Karşılaştırma için kelimenin harf iskeleti (iki yazımda da aynı çıkacak şekilde)."""
    w = re.sub("[ؐ-ًؚ-ٰٟۖ-ۭ࣐-ࣿـ]", "", w)
    w = w.translate(str.maketrans({
        "ٱ": "", "ا": "", "آ": "", "أ": "", "إ": "",   # elifler (Osmanî yazımda çoğu düşer)
        "ى": "ي", "ی": "ي", "پ": "ي", "ئ": "ي",
        "ؤ": "و", "ٶ": "و", "ء": "", "ة": "ه", "ھ": "ه",
    }))
    return w


def benzerlik(a: str, b: str) -> float:
    a, b = iskelet(a), iskelet(b)
    if not a or not b:
        return 1.0 if a == b else 0.0
    # en uzun ortak alt dizi oranı
    m = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a)):
        for j in range(len(b)):
            m[i + 1][j + 1] = m[i][j] + 1 if a[i] == b[j] else max(m[i][j + 1], m[i + 1][j])
    return m[-1][-1] / max(len(a), len(b))


def hizala(u_kelimeler, h_kelimeler, kr):
    """Medine yazımındaki kelimelere bağlı kökleri (kr) Hasenat kelimelerine taşır.
    Dinamik programlama: 1-1, 1-2 (bir Osmanî kelime iki Hasenat kelimesi), 2-1 eşleşmeleri."""
    n, m = len(u_kelimeler), len(h_kelimeler)
    INF = 1e9
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    yol = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] >= INF:
                continue
            if i < n and j < m:                       # 1-1
                c = dp[i][j] + (1 - benzerlik(u_kelimeler[i], h_kelimeler[j]))
                if c < dp[i + 1][j + 1]:
                    dp[i + 1][j + 1], yol[i + 1][j + 1] = c, (i, j, "11")
            if i < n and j + 1 < m:                   # 1-2  (يَٰقَوۡمِ -> يَا قَوْمِ)
                c = dp[i][j] + (1 - benzerlik(u_kelimeler[i], h_kelimeler[j] + h_kelimeler[j + 1])) + 0.05
                if c < dp[i + 1][j + 2]:
                    dp[i + 1][j + 2], yol[i + 1][j + 2] = c, (i, j, "12")
            if i + 1 < n and j < m:                   # 2-1
                c = dp[i][j] + (1 - benzerlik(u_kelimeler[i] + u_kelimeler[i + 1], h_kelimeler[j])) + 0.05
                if c < dp[i + 2][j + 1]:
                    dp[i + 2][j + 1], yol[i + 2][j + 1] = c, (i, j, "21")
    krh = [""] * m
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, tur = yol[i][j]
        if tur == "11":
            krh[pj] = kr[pi] if pi < len(kr) else ""
        elif tur == "12":
            # kök, hitap edatı (يَا) olmayan ikinci kelimeye gider
            krh[pj + 1] = kr[pi] if pi < len(kr) else ""
        else:  # 21
            krh[pj] = next((k for k in kr[pi:pi + 2] if k), "")
        i, j = pi, pj
    return krh, dp[n][m]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    veri = json.loads(GIRDI.read_text(encoding="utf-8"))
    h = {}
    for satir in METIN.read_text(encoding="utf-8").splitlines():
        if satir.startswith("#") or not satir.strip():
            continue
        s, a, t = satir.split("|", 2)
        h[f"{s}:{a}"] = t
    supheli = []
    for ref, v in veri["verses"].items():
        arh = h[ref]
        kr = v.get("kr") or []
        u, hs = v["ar"].split(" "), arh.split(" ")
        krh, maliyet = None, None
        if len(u) == len(hs):
            maliyet = sum(1 - benzerlik(x, y) for x, y in zip(u, hs))
            if maliyet / max(len(hs), 1) <= 0.2:     # kelimeler birebir örtüşüyor
                krh = (list(kr) + [""] * len(hs))[:len(hs)]
        if krh is None:                              # sayı farklı ya da kayma var (ör. 8:29 ذُوالْفَضْلِ)
            krh, maliyet = hizala(u, hs, kr)
        v["arh"] = arh
        v["krh"] = krh
        if maliyet / max(len(hs), 1) > 0.35:
            supheli.append((ref, round(maliyet, 2)))
    CIKTI.parent.mkdir(exist_ok=True)
    CIKTI.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(veri['verses'])} âyet işlendi -> {CIKTI}")
    print(f"hizalaması şüpheli âyet: {len(supheli)}", supheli[:15])


if __name__ == "__main__":
    main()
