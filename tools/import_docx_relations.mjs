#!/usr/bin/env node
/**
 * DOCX kaynakli ayet benzesme iliskilerini mevcut app_data.json'a uygular.
 * 2, 3 ve 4. surelerin r alanlari korunur. Bu dosya tek basina siteyi degistirmez.
 *
 * Kullanim:
 * node tools/import_docx_relations.mjs app_data.json ayet_benzesme_site.json app_data.docx-preview.json
 */
import fs from 'node:fs';
import path from 'node:path';

const [input, relationsFile, output] = process.argv.slice(2);
if (!input || !relationsFile || !output) {
  console.error('Kullanim: node tools/import_docx_relations.mjs <app_data.json> <ayet_benzesme_site.json> <cikti.json>');
  process.exit(2);
}
if (path.resolve(input) === path.resolve(output)) {
  throw new Error('Canli kaynak dosyasi uzerine yazmak yasak.');
}
const db = JSON.parse(fs.readFileSync(input, 'utf8'));
const mapping = JSON.parse(fs.readFileSync(relationsFile, 'utf8'));
if (!db || !db.verses || typeof db.verses !== 'object' || Array.isArray(db.verses))
  throw new Error('app_data.json: verses nesnesi bulunamadi.');
const keys = Object.keys(mapping);
if (keys.length !== 5574) throw new Error('Ana ayet sayisi beklenen 5574 degil: ' + keys.length);
const pattern = /^([1-9]\d{0,2})\.([1-9]\d{0,2})$/;
let edgeCount=0, changed=0;
const protectedBefore = {};
for (const [ref, verse] of Object.entries(db.verses)) {
  const sura=Number(ref.split('.')[0]);
  if ([2,3,4].includes(sura)) protectedBefore[ref]=JSON.stringify(verse);
}
for (const [main, matches] of Object.entries(mapping)) {
  const match=main.match(pattern);
  if (!match) throw new Error('Gecersiz ana referans: ' + main);
  const sura=Number(match[1]);
  if ([2,3,4].includes(sura)) throw new Error('Korunan sure kaynaga girmis: '+main);
  if (sura>114) throw new Error('Gecersiz sure: '+main);
  if (!db.verses[main]) throw new Error('Depoda ana ayet eksik: ' + main);
  if (!Array.isArray(matches)) throw new Error('Eslesmeler dizi olmali: '+main);
  const unique = new Set();
  for (const ref of matches) {
    const m=typeof ref==='string' && ref.match(pattern);
    if (!m || Number(m[1])>114 || !db.verses[ref]) throw new Error('Depoda eslesen ayet eksik/gecersiz: ' + main + ' -> ' + ref);
    if (ref===main || unique.has(ref)) throw new Error('Tekrar/oz-eslesme: ' + main + ' -> ' + ref);
    unique.add(ref);
  }
  edgeCount+=matches.length;
  db.verses[main].r=[...matches]; // Kaynak DOCX sirasi korunur
  changed++;
}
if (edgeCount!==175318) throw new Error('Baglanti sayisi beklenen 175318 degil: '+edgeCount);
for (const [ref, original] of Object.entries(protectedBefore)) {
  if (JSON.stringify(db.verses[ref])!==original) throw new Error('Korunan ayet degisti: '+ref);
}
const parent=path.dirname(path.resolve(output));
if (!fs.existsSync(parent)) throw new Error('Cikti klasoru yok: '+parent);
fs.writeFileSync(output, JSON.stringify(db), 'utf8');
console.log(JSON.stringify({result:'PASS',changed_main:changed,edges:edgeCount,protected_suras:[2,3,4],output},null,2));
