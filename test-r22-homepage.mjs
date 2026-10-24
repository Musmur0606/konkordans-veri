import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const app = scripts.find((match) => match[1].includes('// ===== YAPILANDIRMA ====='))?.[1];

test('R22: ana uygulama JavaScript söz dizimi geçerli', () => {
  assert.ok(app, 'uygulama betiği mevcut');
  assert.doesNotThrow(() => new vm.Script(app, { filename: 'index.html' }));
});

test('R23: sürüm ana uygulama ve çevrimdışı önbellekte aynı', () => {
  assert.match(app, /const SITE_SURUM = '2\.7\.0'/);
  assert.match(sw, /const SURUM = 'v2\.7\.0'/);
});

test('R22: günün âyeti sabit, seçilebilir ve kök verisini değiştirmez', () => {
  const helpers = [
    /function gununAyetSec\(\)\{[\s\S]*?\n\}/,
    /function rastgeleAyetAc\(\)\{[\s\S]*?\n\}/,
    /function gosterimMeali\(metin\)\{[\s\S]*?\n\}/,
  ].map((pattern) => {
    const matched = app.match(pattern);
    assert.ok(matched, `yardımcı fonksiyon bulundu: ${pattern}`);
    return matched[0];
  });
  const V = {
    '8:58': { ar: 'وَإِمَّا', mb: 'Bir âyet.' },
    '5:61': { ar: 'وَإِذَا', mb: 'Bir başka âyet.' },
    '2:1': { ar: 'الم', mb: 'Elif lâm mîm.' },
  };
  const before = JSON.stringify(V);
  let selected = '';
  const context = vm.createContext({ V, Date, Intl, Math, openRef: (key) => { selected = key; } });
  vm.runInContext(helpers.join('\n'), context);
  const daily = vm.runInContext('gununAyetSec()', context);
  assert.ok(Object.hasOwn(V, daily));
  assert.equal(vm.runInContext('gununAyetSec()', context), daily);
  vm.runInContext('rastgeleAyetAc()', context);
  assert.ok(Object.hasOwn(V, selected));
  assert.equal(JSON.stringify(V), before);
});

test('R22: paylaşım, seçili olmayan günün âyeti için de adres oluşturur', () => {
  assert.match(app, /async function paylasAyet\(ayetRef=curRef\)/);
  assert.match(app, /u\.searchParams\.set\('ayet',gr\(ayetRef\)\)/);
  assert.match(app, /Günün âyetini paylaş/);
  assert.match(app, /rastgeleAyetAc\(\)/);
});

test('R22: kaynak sûre/âyet verisi farklılaştırılmaz', () => {
  assert.match(app, /function gosterimMeali\(metin\)/);
  assert.match(app, /Quran Translation/);
});
