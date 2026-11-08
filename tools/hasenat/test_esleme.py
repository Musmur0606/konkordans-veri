#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eşleme sözleşmesi ve gerçek bölünme/birleşme kabul kontrolleri."""
import argparse
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("uret", ROOT / "uret.py")
uret = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uret)


class MappingContract(unittest.TestCase):
    def test_supported_shapes(self):
        for mapping, old_count in [([[0], [1]], 2), ([[0], [0], [1]], 2), ([[0, 1], [2]], 3)]:
            with self.subTest(mapping=mapping):
                uret.validate_map(mapping, old_count, len(mapping))

    def test_rejects_missing_or_invalid_old_positions(self):
        cases = [
            ([[0], [2]], 3),             # Eski kelime 1 kaybolmuş.
            ([[0], [2]], 2),             # İndis sınır dışında.
            ([[0], [True]], 2),          # bool, int gibi kabul edilemez.
            ([[0], ["1"]], 2),         # Metin indis kabul edilemez.
            ([[0], []], 2),              # Boş eşleme.
            ([[1], [0]], 2),             # Sıra ters.
            ([[0, 2]], 3),               # Ardışık olmayan birleşme.
            ([[0], [0], [0]], 1),        # İkiden fazla bölünme.
            ([[0, 1], [1]], 2),          # Birleşen kelime yeniden kullanılmış.
        ]
        for mapping, old_count in cases:
            with self.subTest(mapping=mapping):
                with self.assertRaises(ValueError):
                    uret.validate_map(mapping, old_count, len(mapping))
        with self.assertRaises(ValueError):
            uret.validate_map([[0]], 1, 2)

    def test_all_real_verses_cover_every_old_position(self):
        self.assertEqual(set(CANDIDATE["verses"]), set(APP_DATA["verses"]))
        self.assertEqual(len(CANDIDATE["verses"]), 6236)
        for ref, item in CANDIDATE["verses"].items():
            with self.subTest(ref=ref):
                verse = APP_DATA["verses"][ref]
                mapping = item["arh_map"]
                uret.validate_map(mapping, len(verse["ar"].split(" ")), len(verse["arh"].split(" ")))
                self.assertEqual(set(i for part in mapping for i in part), set(range(len(verse["ar"].split(" ")))))

    def test_vocative_split_keeps_root_on_second_word(self):
        verse = APP_DATA["verses"]["2:54"]
        mapping = CANDIDATE["verses"]["2:54"]["arh_map"]
        self.assertEqual(verse["arh"].split(" ")[4:6], ["يَا", "قَوْمِ"])
        self.assertEqual(mapping[4:7], [[4], [4], [5]])
        self.assertEqual(verse["krh"][4:6], ["", verse["kr"][4]])

    def test_equal_total_count_still_tracks_split_and_merge(self):
        verse = APP_DATA["verses"]["8:29"]
        mapping = CANDIDATE["verses"]["8:29"]["arh_map"]
        self.assertEqual(len(verse["ar"].split(" ")), len(verse["arh"].split(" ")))
        self.assertEqual(mapping[:2], [[0], [0]])
        self.assertEqual(verse["arh"].split(" ")[16], "ذُوالْفَضْلِ")
        self.assertEqual(mapping[16:], [[15, 16], [17]])
        self.assertEqual(verse["krh"][16], verse["kr"][16])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--app-data", type=Path, default=ROOT.parent.parent / "app_data.json")
    args = parser.parse_args()
    CANDIDATE = json.loads(args.candidate.read_text(encoding="utf-8"))
    APP_DATA = json.loads(args.app_data.read_text(encoding="utf-8"))
    unittest.main(argv=[str(__file__)], verbosity=2)
