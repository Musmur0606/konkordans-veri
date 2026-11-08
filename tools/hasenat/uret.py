#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hasenat kaynaklarını doğrular ve ar→arh kelime eşleme metadatası üretir.

Yalnız --output dosyasını yazar; app_data.json ve kaynaklar değiştirilmez.
Python standart kütüphanesi yeterlidir. Kullanım için README.md dosyasına bakın.
"""
from __future__ import annotations

import argparse
from collections import Counter
from functools import lru_cache
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys
import unicodedata
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent
BASELINE_GIT = "d7b9594c09c152943e90fe4d74fefbabb5ec611e"
ZIP_SHA256 = "01c12bc3881c9e0ece9d0c10cd3f0ef033b9da8f48afeb137ac13dc66fec9b52"
PREPARED_SHA256 = "ea3e486ca1f263ba59e870c7cf01d0ed53d1d4094fb4ea04501bad3a63475b60"
OLD_TOKEN_SHA256 = "7753dd352f4b1ca2b9c2960331f71ebb5b1c70a7238c381d12fcb4f699540ebb"
SOURCE_SHA256 = {
    "diyanet_filtre.py": "66ce2e30cc8a58523235bb7fec882acb178fd2de8fac2a798d5f42b1433c6b3a",
    "site_donustur.py": "2981e5126a7621dc0cbfa832b143f6e7580a41456a0e0f261160f50358061924",
    "kaynak_diyanet/kuran.json": "da8b017dbdc5b568b54ed97472622d61ee82fcde6bbb6e25ff54210fa4fc3b83",
    "kaynak_diyanet/LICENSE": "9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
    "cikti/KURAN_HASENAT_YAZIMI.txt": "74a934db426bf60de735f55f9a6340c195d188208255508c0619b356cd93c2d0",
    "test/referans.txt": "11e7c1423a3e4af953d4e8738910763c3cfddd0011369541620df48d5922af28",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    # Sadece salt okunur fonksiyonları kullanıyoruz; __main__ blokları çalışmaz.
    spec.loader.exec_module(module)
    return module


def check_source_files():
    for relative, expected in SOURCE_SHA256.items():
        actual = sha256((ROOT / relative).read_bytes()).hexdigest()
        require(actual == expected, f"Kaynak SHA-256 değişti: {relative}: {actual}")
    manifest = json.loads((ROOT / "KAYNAK_KAYDI.json").read_text(encoding="utf-8"))
    require(manifest["source_zip"]["sha256"] == ZIP_SHA256, "Paket kaydı farklı sürüm.")
    for entry in manifest["superseded"]:
        require(sha256((ROOT / entry["backup"]).read_bytes()).hexdigest() == entry["sha256"],
                f"Önceki sürüm yedeği bozuk: {entry['backup']}")


def read_verses(path):
    result = {}
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split("|", 2)
        require(len(fields) == 3, f"Geçersiz satır: {path.name}:{number}")
        s, a, text = fields
        ref = f"{int(s)}:{int(a)}"
        require(ref not in result, f"Yinelenen ayet: {ref}")
        require(bool(text) and text == " ".join(text.split()), f"Geçersiz kelime aralığı: {ref}")
        result[ref] = text
    return result


def validate_map(mapping, old_count, new_count):
    """Her kelimeyi kapsayan, sıralı ve 1:1/1:2/2:1 biçimli eşlemeyi denetler."""
    require(type(mapping) is list and len(mapping) == new_count, "Yeni kelime sayısı uyuşmuyor.")
    previous_end = -1
    index_uses = Counter()
    for item in mapping:
        require(type(item) is list and 1 <= len(item) <= 2, "Her eşleme 1 veya 2 eski indis taşımalı.")
        require(all(type(i) is int and 0 <= i < old_count for i in item), "Eski indis türü/aralığı geçersiz.")
        require(item == list(range(item[0], item[-1] + 1)), "Birleşen eski indisler ardışık olmalı.")
        require(item[0] >= previous_end, "Eşleme sırası geriye gidiyor.")
        if item[0] == previous_end:
            require(len(item) == 1, "Yinelenen indis birleşme ile örtüşemez.")
        previous_end = item[-1]
        index_uses.update(item)
    require(set(index_uses) == set(range(old_count)), "En az bir eski kelime eşlenmemiş.")
    require(all(1 <= n <= 2 for n in index_uses.values()), "Eski kelime ikiden fazla kez eşlenmiş.")
    # 2→1 parçasının yanına aynı eski kelimeyi tekrar eklemeyi reddet.
    for item in mapping:
        if len(item) == 2:
            require(all(index_uses[i] == 1 for i in item), "Birleşen kelimenin tekrar kullanımı var.")


def align_with_map(old_words, new_words, roots, similarity):
    """Paketin hizala() geçiş/tie sırasını korur; traceback'e indisleri ekler.

    1→2 durumunda krh kökü ikinci kelimede kalır; arh_map iki yeni kelimeye de
    eski indis verir. Bunlar farklı amaçlıdır ve birbirinden türetilmez.
    """
    n, m = len(old_words), len(new_words)
    inf = 1e9
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    trace = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if dp[i][j] >= inf:
                continue
            if i < n and j < m:
                cost = dp[i][j] + (1 - similarity(old_words[i], new_words[j]))
                if cost < dp[i + 1][j + 1]:
                    dp[i + 1][j + 1], trace[i + 1][j + 1] = cost, (i, j, "11")
            if i < n and j + 1 < m:
                cost = dp[i][j] + (1 - similarity(old_words[i], new_words[j] + new_words[j + 1])) + 0.05
                if cost < dp[i + 1][j + 2]:
                    dp[i + 1][j + 2], trace[i + 1][j + 2] = cost, (i, j, "12")
            if i + 1 < n and j < m:
                cost = dp[i][j] + (1 - similarity(old_words[i] + old_words[i + 1], new_words[j])) + 0.05
                if cost < dp[i + 2][j + 1]:
                    dp[i + 2][j + 1], trace[i + 2][j + 1] = cost, (i, j, "21")
    require(trace[n][m] is not None, "Kelime dizileri izinli geçişlerle eşlenemedi.")
    aligned_roots = [""] * m
    mapping = [None] * m
    steps = Counter()
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, kind = trace[i][j]
        steps[kind] += 1
        if kind == "11":
            aligned_roots[pj] = roots[pi] if pi < len(roots) else ""
            mapping[pj] = [pi]
        elif kind == "12":
            aligned_roots[pj + 1] = roots[pi] if pi < len(roots) else ""
            mapping[pj], mapping[pj + 1] = [pi], [pi]
        else:
            aligned_roots[pj] = next((k for k in roots[pi:pi + 2] if k), "")
            mapping[pj] = [pi, pi + 1]
        i, j = pi, pj
    validate_map(mapping, n, m)
    return aligned_roots, mapping, dp[n][m], steps


def verse_mapping(verse, text, upstream):
    old_words, new_words = verse["ar"].split(" "), text.split(" ")
    roots = verse.get("kr") or []
    if len(old_words) == len(new_words):
        cost = sum(1 - upstream.benzerlik(x, y) for x, y in zip(old_words, new_words))
        if cost / max(len(new_words), 1) <= 0.2:
            aligned = (list(roots) + [""] * len(new_words))[:len(new_words)]
            mapping = [[i] for i in range(len(new_words))]
            validate_map(mapping, len(old_words), len(new_words))
            return aligned, mapping, cost, Counter({"11": len(new_words)}), "identity"
    aligned, mapping, cost, steps = align_with_map(old_words, new_words, roots, upstream.benzerlik)
    # Orijinal paket fonksiyonu ile bağımsız yol/maliyet denetimi.
    reference_roots, reference_cost = upstream.hizala(old_words, new_words, roots)
    require(aligned == reference_roots and cost == reference_cost, "Paketin hizalama sonucu değişti.")
    return aligned, mapping, cost, steps, "dp"


def load_prepared(zip_path, json_path, app_data):
    if zip_path:
        require(sha256(zip_path.read_bytes()).hexdigest() == ZIP_SHA256, "Hazır paket SHA-256 uyuşmuyor.")
        with ZipFile(zip_path) as archive:
            members = {name.replace("\\", "/"): name for name in archive.namelist()}
            raw = archive.read(members["GITHUB_YUKLE/app_data.json"])
        require(sha256(raw).hexdigest() == PREPARED_SHA256, "Hazır app_data.json SHA-256 uyuşmuyor.")
        return json.loads(raw)
    if json_path:
        return json.loads(json_path.read_text(encoding="utf-8"))
    return app_data


def generate(app_data, prepared):
    check_source_files()
    source_filter = load_module("hasenat_source_filter", ROOT / "diyanet_filtre.py")
    upstream = load_module("hasenat_upstream_alignment", ROOT / "site_donustur.py")
    upstream.benzerlik = lru_cache(maxsize=200000)(upstream.benzerlik)
    texts = read_verses(ROOT / "cikti/KURAN_HASENAT_YAZIMI.txt")
    references = read_verses(ROOT / "test/referans.txt")
    verses = app_data["verses"]
    expected_refs = {f"{s}:{a}" for s, info in app_data["sureler"].items()
                     for a in range(1, info["ayet"] + 1)}
    require(set(app_data["sureler"]) == {str(s) for s in range(1, 115)}, "Sure kimlikleri uyuşmuyor.")
    require(len(texts) == 6236 and set(texts) == set(verses) == set(prepared["verses"]) == expected_refs,
            "6236 ayet kimlikleri/kapsamı uyuşmuyor.")
    old_tokens = {ref: {"ar": v["ar"], "kr": v.get("kr")} for ref, v in verses.items()}
    require(sha256(json_bytes(old_tokens)).hexdigest() == OLD_TOKEN_SHA256,
            "ar/kr kabul edilmiş Git sürümünden farklı; eşleme üretimi durduruldu.")
    filtered = {}
    for s, a, text in source_filter.oku():
        ref = f"{s}:{a}"
        require(ref not in filtered, f"Diyanet kaynağında yinelenen ayet: {ref}")
        filtered[ref] = source_filter.ayet_yazimi(s, a, text)
    require(filtered == texts, "Yeni filtre çıktısı 6236 ayetlik kaynak metinle ham olarak aynı değil.")
    require(len(references) == 86 and set(references) <= set(texts), "86 referans ayet kapsamı değişti.")
    require({f"2:{a}" for a in range(1, 51)} <= set(references), "Bakara 1–50 referansları eksik.")
    raw_differences = []
    reference_words = raw_word_differences = 0
    for ref, sample in references.items():
        expected_words, actual_words = sample.split(" "), texts[ref].split(" ")
        reference_words += len(expected_words)
        require(len(expected_words) == len(actual_words), f"Referans kelime sayısı farklı: {ref}")
        require(all(unicodedata.normalize("NFC", a) == unicodedata.normalize("NFC", b)
                    for a, b in zip(expected_words, actual_words)), f"Referans NFC kelime farkı: {ref}")
        count = sum(a != b for a, b in zip(expected_words, actual_words))
        if count:
            raw_differences.append(ref)
            raw_word_differences += count
    require(set(raw_differences) == {"18:109", "2:30", "2:38"} and raw_word_differences == 3,
            "Ham referans farkları bilinen kanonik işaret sırası farklarından değişti.")

    output = {}
    branches, steps = Counter(), Counter()
    old_count = new_count = differing_counts = merged_words = repeated_old_words = 0
    worst_average, worst_ref = -1, None
    for ref, verse in verses.items():
        require(prepared["verses"][ref]["ar"] == verse["ar"]
                and prepared["verses"][ref].get("kr") == verse.get("kr"), f"Hazır kaynak ar/kr değişmiş: {ref}")
        require(prepared["verses"][ref].get("arh") == texts[ref], f"Hazır kaynak arh farklı: {ref}")
        aligned, mapping, cost, verse_steps, branch = verse_mapping(verse, texts[ref], upstream)
        require(prepared["verses"][ref].get("krh") == aligned, f"Hazır paket krh farklı: {ref}")
        output[ref] = {"arh_map": mapping}
        branches[branch] += 1
        steps.update(verse_steps)
        n, m = len(verse["ar"].split(" ")), len(mapping)
        old_count += n
        new_count += m
        differing_counts += n != m
        merged_words += sum(len(item) == 2 for item in mapping)
        uses = Counter(i for item in mapping for i in item)
        repeated_old_words += sum(count == 2 for count in uses.values())
        average = cost / max(m, 1)
        if average > worst_average:
            worst_average, worst_ref = average, ref
    require(branches == Counter({"identity": 5836, "dp": 400}), "Hizalama dal sayıları değişti.")
    require(differing_counts == 398 and worst_average <= 0.35, "Beklenmeyen hizalama maliyeti/sayısı.")
    require(output["2:54"]["arh_map"][4:7] == [[4], [4], [5]], "2:54 bölünme eşlemesi yanlış.")
    require(output["8:29"]["arh_map"][:2] == [[0], [0]], "8:29 ilk kelime bölünmesi yanlış.")
    require(output["8:29"]["arh_map"][16:] == [[15, 16], [17]], "8:29 birleşme eşlemesi yanlış.")
    return {
        "schema": "hasenat-arh-map-v1",
        "source": {"package_sha256": ZIP_SHA256, "prepared_app_data_sha256": PREPARED_SHA256,
                   "baseline_git": BASELINE_GIT, "ar_kr_sha256": OLD_TOKEN_SHA256,
                   "hasenat_text_sha256": SOURCE_SHA256["cikti/KURAN_HASENAT_YAZIMI.txt"]},
        "verification": {
            "verses": len(output), "surahs": 114, "filter_exact_matches": len(texts),
            "krh_exact_matches": len(output), "map_valid_verses": len(output),
            "reference_verses": len(references), "reference_words": reference_words,
            "reference_nfc_word_differences": 0, "reference_raw_word_differences": raw_word_differences,
            "reference_raw_difference_verses": sorted(raw_differences),
            "identity_verses": branches["identity"], "dp_verses": branches["dp"],
            "different_word_count_verses": differing_counts,
            "old_words": old_count, "new_words": new_count,
            "alignment_steps": dict(sorted(steps.items())), "merged_new_words": merged_words,
            "split_old_words": repeated_old_words,
            "maximum_average_cost": worst_average, "maximum_average_cost_verse": worst_ref,
            "limits": "Biçimsel eşleme denetimidir; dilbilimsel doğruluk veya font glif kapsamı kabulü değildir.",
        },
        "verses": output,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-data", type=Path, default=ROOT.parent.parent / "app_data.json")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--prepared-zip", type=Path, help="20261108 paketini doğrudan doğrula.")
    group.add_argument("--prepared-json", type=Path, help="arh/krh içeren hazırlanmış app_data.json.")
    parser.add_argument("--output", type=Path, required=True, help="Yalnız eşleme metadatası JSON çıktısı.")
    args = parser.parse_args(argv)
    protected = {args.app_data.resolve()}
    protected.update((ROOT / p).resolve() for p in SOURCE_SHA256)
    protected.update(p.resolve() for p in (args.prepared_zip, args.prepared_json) if p)
    require(args.output.resolve() not in protected, "Çıktı bir kaynak dosyasının üzerine yazamaz.")
    app_data = json.loads(args.app_data.read_text(encoding="utf-8"))
    prepared = load_prepared(args.prepared_zip, args.prepared_json, app_data)
    result = generate(app_data, prepared)
    raw = json_bytes(result) + b"\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(raw)
    print(json.dumps({"output": str(args.output), "sha256": sha256(raw).hexdigest(),
                      "verification": result["verification"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(f"HOLD: {error}", file=sys.stderr)
        raise SystemExit(1)
