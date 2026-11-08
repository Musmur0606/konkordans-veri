// node test-hasenat-display.mjs
// Gerçek kabul edilmiş arama/esmâ işlevleri + gerçek 6.236 âyet ile ağsız test.
// Kaynak dosya, Git, canlı site veya veri üzerinde yazma işlemi yapmaz.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { create } = require('./hasenat-display.js');
const cwd = fileURLToPath(new URL('.', import.meta.url));
const baseline = 'd7b9594c09c152943e90fe4d74fefbabb5ec611e';
const gitRead = path => execFileSync('git', ['show', baseline + ':' + path], {
  cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
});
const baselineHTML = gitRead('index.html');
const currentHTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const baselineData = JSON.parse(gitRead('app_data.json'));
const dataBytes = readFileSync(new URL('./app_data.json', import.meta.url));
const data = JSON.parse(dataBytes);
const esma = JSON.parse(readFileSync(new URL('./esma_index.json', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const dataHash = hash(dataBytes);
const memoryHash = hash(JSON.stringify(data));
const escape = value => String(value || '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const plain = html => html.replace(/<\/?(?:span|b)\b[^>]*>/g, '')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const markupWords = html => Array.from(html.matchAll(/<b class="esmahl">(.*?)<\/b>/g), part => part[1]);
const options = { whole: false, noharaka: true, affixes: false, mode: 'all' };
const evidence = { baseline, data_sha256: dataHash };
let passed = 0;

function extract(start, end, source = baselineHTML) {
  const a = source.indexOf('function ' + start + '(');
  const b = source.indexOf('function ' + end + '(', a);
  assert(a >= 0 && b > a, 'Kabul edilmiş gerçek işlev sınırları bulunmalı: ' + start);
  return source.slice(a, b);
}
const original = vm.createContext({ esc: escape });
vm.runInContext(extract('arNorm', 'runSearch') + '\n' + extract('esmaIskelet', 'hlTr'), original);
const current = vm.createContext({ esc: escape, HasenatDisplay: { create } });
vm.runInContext(extract('arNorm', 'runSearch', currentHTML) + '\n' +
  extract('esmaIskelet', 'hlArEsma', currentHTML), current);
const bridge = create({
  arMatch: current.arMatch, arToken: current.arToken, arEq: current.arEq,
  esmaIskelet: current.esmaIskelet, escape
});

function test(name, fn) {
  fn();
  passed++;
  console.log('PASS ' + name);
}

test('Entegre index gerçek arama işlevlerini ve R3 esmâ iskeletini aynen korur', () => {
  for (const name of ['arNorm', 'arToken', 'arEq', 'arMatch', 'esmaIskelet']) {
    assert.equal(current[name].toString(), original[name].toString(), name + ' kabul edilmiş kaynak değişti');
  }
});

test('Eski veri ve eksik/bozuk harita kaynak gösterimi ile aramayı birlikte korur', () => {
  const ar = 'قَالَ رَبِّي';
  for (const verse of [
    { ar },
    { ar, arh: 'قَالَ رَبّٖى' },
    { ar, arh: 'قَالَ رَبّٖى', arh_map: [[1], [0]] },
    { ar, arh: 'قَالَ رَبّٖى', arh_map: [[0], [9]] },
    { ar, arh: 'قَالَ رَبّٖى', arh_map: [[0], [0]] }
  ]) {
    assert.equal(bridge.text(verse), ar);
    assert.deepEqual(bridge.match(verse, 'رَبِّي', options).map(hit => hit.raw), ['رَبِّي']);
    assert.equal(plain(bridge.searchHTML(verse, 'رَبِّي', options)), ar);
  }
});

test('Boşluk indisleri arToken indisleriyle karışmaz; baştaki işaret ve çift boşluk korunur', () => {
  const verse = { ar: '۞قَالَ  رَبِّي', arh: '۞قَالَ  رَبّٖى', arh_map: [[0], [1], [2]] };
  assert.equal(original.arToken(verse.ar)[1].start, verse.ar.indexOf('رَبِّي'));
  assert.deepEqual(bridge.match(verse, 'رَبِّي', options).map(hit => hit.raw), ['رَبّٖى']);
  assert.deepEqual(bridge.match(verse, 'قَالَ', options).map(hit => hit.raw), ['قَالَ']);
  assert.equal(plain(bridge.searchHTML(verse, 'رَبِّي', options)), verse.arh);
  assert.equal(bridge.searchHTML(verse, 'قَالَ', options).startsWith('۞<span'), true);
});

test('Hasenat özel harfleri token başlangıcında da aranır, gösterim harfleri değiştirilmez', () => {
  for (const [ar, arh] of [['يٰسٓ', 'یٰسٓ'], ['شَيْئًا', 'شَيْپًا'], ['مُسْتَهْزِؤُنَ', 'مُسْتَهْزِٶُنَ'], ['هُمْ', 'ھُمْ']]) {
    const verse = { ar, arh, arh_map: [[0]] };
    const hits = bridge.match(verse, arh, { ...options, whole: true });
    assert.equal(hits.length, 1, arh);
    assert.equal(hits[0].raw, arh);
    assert.equal(plain(bridge.searchHTML(verse, arh, options)), arh);
  }
});

test('Tam kelime, hareke, ek ve sıralı kelime grubu seçenekleri çalışır', () => {
  const verse = { ar: 'قَالَ رَبِّي الْكِتَابُ', arh: 'قَالَ رَبّٖى الْكِتَابُ', arh_map: [[0], [1], [2]] };
  assert.equal(bridge.match(verse, 'قَالُ', { ...options, noharaka: false }).length, 0);
  assert(bridge.match(verse, 'قَالُ', options).length > 0);
  assert.equal(bridge.match(verse, 'كِتَاب', { ...options, whole: true }).length, 0);
  assert(bridge.match(verse, 'كِتَاب', { ...options, whole: true, affixes: true }).length > 0);
  assert(bridge.match(verse, 'قَالَ رَبّٖى', { ...options, mode: 'phrase' }).length > 0);
  assert.equal(bridge.match(verse, 'رَبّٖى قَالَ', { ...options, mode: 'phrase' }).length, 0);
  assert.equal(bridge.match(verse, 'قَالَ مُوسَى', { ...options, mode: 'all' }).length, 0);
  assert(bridge.match(verse, 'قَالَ مُوسَى', { ...options, mode: 'any' }).length > 0);
});

test('Esmâ R3 hareke/tenvin/tanımlık kabulü korunur; kökdeş başka kelimeler boyanmaz', () => {
  const ar = 'بَصِيرٌ بَصِيرٍ بَصِيرًا ٱلْبَصِيرُ بَصَرٌ مُبْصِرٌ';
  const arh = 'بَصٖيرٌ بَصٖيرٍ بَصٖيرًا الْبَصٖيرُ بَصَرٌ مُبْصِرٌ';
  const verse = { ar, arh, arh_map: [[0], [1], [2], [3], [4], [5]] };
  assert.deepEqual(markupWords(bridge.esmaHTML(verse, 'البَصِير')), arh.split(' ').slice(0, 4));
  assert.equal(plain(bridge.esmaHTML(verse, 'البَصِير')), arh);
});

test('Elif silme yok: ALİY/عَلَى, MALİK/الملك, HALLÂK/خلق ve HÂLİK/الخلق ayrı kalır', () => {
  const fixtures = [
    ['العَلِيّ', 'عَلَى عَلِيٌّ', 'عَلٰى عَلِيٌّ', 'عَلِيٌّ'],
    ['المَالِك', 'مَالِكَ الْمُلْكِ', 'مَالِكَ الْمُلْكِ', 'مَالِكَ'],
    ['الخَلَّاق', 'خَلَقَ الْخَلَّاقُ', 'خَلَقَ الْخَلَّاقُ', 'الْخَلَّاقُ'],
    ['الخَالِق', 'الْخَلْقُ خَالِقُ', 'الْخَلْقُ خَالِقُ', 'خَالِقُ']
  ];
  for (const [name, ar, arh, expected] of fixtures) {
    const verse = { ar, arh, arh_map: [[0], [1]] };
    assert.deepEqual(markupWords(bridge.esmaHTML(verse, name)), [expected], name);
  }
});

test('6.236 kaynak ar/kr kaydı kabul edilmiş Git sürümüyle aynıdır; bütün gösterim haritaları geçerlidir', () => {
  assert.equal(Object.keys(data.verses).length, 6236);
  assert.deepEqual(Object.keys(data.verses), Object.keys(baselineData.verses));
  for (const [ref, verse] of Object.entries(data.verses)) {
    assert.equal(verse.ar, baselineData.verses[ref].ar, ref + ' ar');
    assert.deepEqual(verse.kr, baselineData.verses[ref].kr, ref + ' kr');
    assert(verse.arh && Array.isArray(verse.arh_map), ref + ' yeni kaynak/harita gerekli');
    assert(['mapped', 'identical'].includes(bridge.mappingStatus(verse)), ref + ' eksik/bozuk harita');
    assert.equal(bridge.text(verse), verse.arh, ref);
  }
});

test('Bütün eski ve Hasenat kelime geçişleri kendi âyetini bulur; 6.339 kopuk geçiş giderilmiştir', () => {
  let legacyDisplayFailures = 0, sourceWordCount = 0, displayWordCount = 0;
  const affected = new Set();
  for (const [ref, verse] of Object.entries(data.verses)) {
    for (const word of verse.ar.split(' ').filter(Boolean)) {
      sourceWordCount++;
      assert(original.arMatch(verse.ar, word, options).length, ref + ' eski öz arama');
      assert(bridge.match(verse, word, options).length, ref + ' korunmayan eski sorgu: ' + word);
    }
    for (const word of verse.arh.split(' ').filter(Boolean)) {
      displayWordCount++;
      if (!original.arMatch(verse.ar, word, options).length) {
        legacyDisplayFailures++;
        affected.add(ref);
      }
      assert(bridge.match(verse, word, options).length, ref + ' yeni öz arama: ' + word);
    }
  }
  assert.equal(legacyDisplayFailures, 6339);
  assert.equal(affected.size, 3634);
  evidence.self_search = { source_words: sourceWordCount, display_words: displayWordCount,
    before_failed_words: legacyDisplayFailures, before_affected_verses: affected.size,
    after_failed_words: 0, old_query_losses: 0 };
});

test('Gerçek 2:54 çağrı ayrımı ve 8:29 birleşimi arama vurgusunu doğru kelimeye taşır', () => {
  const a = data.verses['2:54'];
  const noun = bridge.match(a, 'قَوْمِ', options).map(hit => hit.raw);
  assert(noun.includes('قَوْمِ'));
  assert(!noun.includes('يَا'));
  assert(bridge.match(a, 'يَا', { ...options, whole: true }).some(hit => hit.raw === 'يَا'));
  const fused = bridge.match(a, a.ar.split(' ')[4], { ...options, whole: true }).map(hit => hit.raw);
  assert(fused.includes('يَا') && fused.includes('قَوْمِ'));
  const b = data.verses['8:29'];
  assert(bridge.match(b, 'ذُو', { ...options, whole: true }).some(hit => hit.raw === 'ذُوالْفَضْلِ'));
  assert(bridge.match(b, b.ar.split(' ')[16], { ...options, whole: true }).some(hit => hit.raw === 'ذُوالْفَضْلِ'));
  for (const verse of [a, b, data.verses['2:255']]) {
    assert(bridge.match(verse, verse.arh, { ...options, mode: 'phrase' }).length);
    assert.equal(plain(bridge.searchHTML(verse, verse.arh, { ...options, mode: 'phrase' })), verse.arh);
  }
});

test('2:101 U+08D7 ve 7:8 U+08D9 işaretleri taban kelimeyle aynı vurgu içinde kalır', () => {
  for (const [ref, index, mark] of [['2:101', 14, '\u08D7'], ['7:8', 1, '\u08D9']]) {
    const verse = data.verses[ref];
    const word = verse.arh.split(' ')[index];
    assert(word.endsWith(mark), ref + ' doğrulanan gerçek işaret');
    assert.equal(original.arToken(word)[0].end, word.length - mark.length,
      ref + ' eski token aralığı işareti dışarıda bırakıyor');
    const sourceQuery = verse.ar.split(' ')[verse.arh_map[index][0]];
    for (const query of [sourceQuery, word]) {
      const hits = bridge.match(verse, query, options);
      assert(hits.some(hit => hit.raw === word), ref + ' tam kelime ve birleşen işaret');
      const html = bridge.searchHTML(verse, query, options);
      assert(html.includes(word + '</span>'), ref + ' işaret span dışında kalmamalı');
      assert.equal(plain(html), verse.arh, ref + ' kaynak metni aynı kalmalı');
    }
  }
});

test('Arama seçenekleriyle bütün korpusta eski sonuçlar kaybolmaz ve sonuç metni arh kalır', () => {
  const first = ref => original.arToken(data.verses[ref].ar).map(hit => hit.raw);
  const cases = [
    ['الله', options],
    ['عَلَى', { ...options, whole: true }],
    ['عَلِيّ', { ...options, whole: true }],
    ['خَلَقَ', { ...options, whole: true }],
    ['كِتَاب', { ...options, whole: true, affixes: true }],
    [first('1:2')[0], { ...options, whole: true, noharaka: false }],
    [first('1:2').slice(0, 2).join(' '), { ...options, mode: 'phrase' }],
    [first('2:54').slice(2, 5).join(' '), { ...options, mode: 'phrase', whole: true }],
    [first('2:255').slice(0, 3).join(' '), { ...options, mode: 'all', noharaka: false }],
    [first('1:2')[0] + ' ' + first('2:54')[0], { ...options, mode: 'any' }]
  ];
  const results = [];
  for (const [query, opts] of cases) {
    let oldCount = 0, newCount = 0;
    for (const [ref, verse] of Object.entries(data.verses)) {
      const oldHit = original.arMatch(verse.ar, query, opts).length > 0;
      const hits = bridge.match(verse, query, opts);
      if (oldHit) { oldCount++; assert(hits.length, ref + ' eski sorgu kaybı: ' + query); }
      if (hits.length) {
        newCount++;
        assert.equal(plain(bridge.searchHTML(verse, query, opts)), verse.arh, ref + ' gösterim değişti');
        for (const hit of hits) assert.equal(hit.raw, verse.arh.slice(hit.start, hit.end), ref + ' vurgu konumu');
      }
    }
    assert(oldCount > 0, 'Gerçek eski sonuçlu kontrol sorgusu gerekli: ' + query);
    results.push({ query, options: opts, old_count: oldCount, new_count: newCount, lost: 0 });
  }
  evidence.search_regressions = results;
});

test('2.050 esmâ–âyet bağlantısının eski eşleşme kararı ve gösterim metni korunur', () => {
  let pairs = 0, oldMarkedPairs = 0, newMarkedPairs = 0, oldWords = 0, newWords = 0;
  for (const [name, info] of Object.entries(esma.index)) {
    for (const ref of info.r) {
      pairs++;
      const verse = data.verses[ref];
      const before = markupWords(original.hlArEsma(verse, info.ar));
      const html = bridge.esmaHTML(verse, info.ar);
      const after = markupWords(html);
      oldMarkedPairs += before.length > 0;
      newMarkedPairs += after.length > 0;
      oldWords += before.length;
      newWords += after.length;
      assert.equal(after.length > 0, before.length > 0, name + ' ' + ref + ' karar değişti');
      assert.equal(plain(html), verse.arh, name + ' ' + ref + ' metin değişti');
      for (const hit of bridge.esmaMatches(verse, info.ar)) {
        let at = 0;
        const hitWords = verse.arh.split(' ').map((raw, index) => {
          const item = { raw, index, start: at, end: at + raw.length };
          at = item.end + 1;
          return item;
        }).filter(word => word.start < hit.end && hit.start < word.end);
        for (const word of hitWords) {
          assert(verse.arh_map[word.index].some(oldIndex =>
            original.esmaIskelet(verse.ar.split(' ')[oldIndex]) === original.esmaIskelet(info.ar)),
          name + ' ' + ref + ' kaynağında seçilmeyen sözcük boyandı: ' + word.raw);
        }
      }
    }
  }
  assert.equal(pairs, 2050);
  assert.equal(oldMarkedPairs, 1069);
  assert.equal(newMarkedPairs, oldMarkedPairs);
  assert.equal(oldWords, 1081);
  assert.equal(newWords, oldWords);
  evidence.esma = { pairs, old_marked_pairs: oldMarkedPairs, new_marked_pairs: newMarkedPairs,
    old_marked_words: oldWords, new_marked_words: newWords };
});

test('Gerçek yanlış esmâ vurguları yok; VELÎ 7:196 vurgusu geri gelmiştir', () => {
  for (const [name, ref] of [['ALİY', '4:34'], ['MALİK', '3:26'], ['HALLÂK', '36:81'], ['HÂLİK', '13:16']]) {
    // Bu örneklerde eski kabul edilmiş motorun kararı boş. Yeni yazımdan
    // keyfî bir eşleşme üretmeyiz; ayrı bir esmâ düzeltmesi bu işin kapsamı değil.
    assert.deepEqual(markupWords(bridge.esmaHTML(data.verses[ref], esma.index[name].ar)), [], name + ' ' + ref);
  }
  assert.deepEqual(markupWords(bridge.esmaHTML(data.verses['3:68'], esma.index['VELÎ'].ar)), ['وَلِىُّ']);
  assert.deepEqual(markupWords(bridge.esmaHTML(data.verses['7:196'], esma.index['VELÎ'].ar)), ['وَلِيِّىَ']);
});

test('Testler disk verisini veya bellekteki metin/kök/haritaları değiştirmemiştir', () => {
  assert.equal(hash(readFileSync(new URL('./app_data.json', import.meta.url))), dataHash);
  assert.equal(hash(JSON.stringify(data)), memoryHash);
});

console.log(JSON.stringify({ result: 'PASS_HASENAT_DISPLAY', tests: passed, ...evidence }, null, 2));
