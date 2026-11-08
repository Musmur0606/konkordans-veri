// Kabul edilmiş 99 Esmâ / 2.050 sûre-âyet referansı üzerinde salt-okunur sorgu.
// Kavram veya benzeşen veri tabanına yazma yetkisi yoktur.
import {parseVerses} from './mutesabih-core.mjs?v=3';
const ARABIC_WORDS = /[\p{Script=Arabic}\p{Mark}]+/gu;
const ARABIC_LETTER = /[\p{Script=Arabic}&&\p{Letter}]/v;

export function esmaIskelet(text, stripInitialArticle = true) {
  const original = String(text || '').normalize('NFC');
  const tanwin = original.includes('\u064B');
  let pure = original.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    .replace(/\u0640/gu, '').replace(/[^\u0621-\u064A\u0671]/gu, '');
  if (stripInitialArticle) pure = pure.replace(/^[\u0627\u0671]\u0644/u, '');
  if (tanwin && pure.endsWith('\u0627')) pure = pure.slice(0, -1);
  // Hasenat/Diyanet hamze farkı yalnız arama anahtarında ele alınır.
  pure = pure.replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627');
  return pure;
}

function fail(message) { throw Error(message); }

export function assertEsmaDataset(dataset, corpus) {
  if (!dataset || !Array.isArray(dataset.esmalar) || dataset.esmalar.length !== 99 ||
      !dataset.index || typeof dataset.index !== 'object' || Array.isArray(dataset.index) ||
      Object.keys(dataset.index).length !== 99 || !corpus?.verses) {
    fail('Esmâ veri setinin 99 isimlik kaynak yapısı doğrulanamadı.');
  }
  const names = new Set(), skeletons = new Set();
  let total = 0;
  for (const name of dataset.esmalar) {
    const entry = Object.hasOwn(dataset.index, name) ? dataset.index[name] : null;
    if (typeof name !== 'string' || !name || names.has(name) ||
        !entry || typeof entry.ar !== 'string' || !entry.ar ||
        !Array.isArray(entry.r) || entry.r.length < 1 || entry.n !== entry.r.length) {
      fail('Esmâ adı veya ilgili âyetler geçersiz.');
    }
    names.add(name);
    const skeleton = esmaIskelet(entry.ar);
    if (!skeleton || skeletons.has(skeleton)) fail('Esmâ ismi belirsiz; eşleşme kapalı.');
    skeletons.add(skeleton);
    const refs = new Set();
    for (const ref of entry.r) {
      if (typeof ref !== 'string' || !/^(?:[1-9]|[1-9]\d|1[01]\d|11[0-4]):[1-9]\d{0,2}$/u.test(ref) ||
          !corpus.verses[ref] || refs.has(ref)) fail('Esmâ sûre/âyet referansları doğrulanamadı.');
      refs.add(ref);
    }
    total += entry.r.length;
  }
  if (total !== 2050) fail('Esmâ 2.050 bağlantılık kabul sürümüyle uyuşmuyor.');
  return true;
}

function wordRanges(text) {
  return [...String(text || '').matchAll(ARABIC_WORDS)]
    .filter(hit => ARABIC_LETTER.test(hit[0]))
    .map(hit => ({start: hit.index, end: hit.index + hit[0].length,
      skeleton: esmaIskelet(hit[0]), withArticle: esmaIskelet(hit[0], false)}));
}

function sameEsmaSkeleton(selected, target) {
  if (selected === target) return true;
  // Çok kelimeli ذُو الجلال والإكرام adında i'râb kaynaklı ذِى/ذى kabul edilir.
  const special = 'ذوالجلالوالاكرام';
  return target === special &&
    (selected === 'ذي' + special.slice(2) || selected === 'ذى' + special.slice(2));
}

function esmaTargets(arabicName) {
  const target = esmaIskelet(arabicName);
  return target === 'ذوالجلالوالاكرام'
    ? [target, 'ذي' + target.slice(2), 'ذى' + target.slice(2)] : [target];
}

// Kelime veya kelime grubunun tam sınırını bul; kök, ek ve yarım kelime eşleşmesin.
export function esmaRanges(text, arabicName) {
  const targets = esmaTargets(arabicName).filter(Boolean);
  if (!targets.length) return [];
  const words = wordRanges(text), result = [];
  for (let i = 0; i < words.length; i++) {
    let skeleton = '';
    for (let j = i; j < Math.min(words.length, i + 6); j++) {
      if (j > i && !/^\s+$/u.test(text.slice(words[j - 1].end, words[j].start))) break;
      skeleton += j === i ? words[j].skeleton : words[j].withArticle;
      if (targets.includes(skeleton)) result.push({start: words[i].start, end: words[j].end});
      if (!targets.some(target => target.startsWith(skeleton))) break;
    }
  }
  return result;
}

export function findSelectedEsma({text, source, dataset, corpus}) {
  if (!dataset || typeof text !== 'string' || !text.trim() || !source ||
      !Number.isInteger(source.start) || !Number.isInteger(source.end) ||
      source.start < 0 || source.end <= source.start ||
      typeof source.verse !== 'string' || !/^\d{1,3}\.\d{1,3}$/u.test(source.verse) ||
      !corpus?.verses) return null;
  const verse = corpus.verses[source.verse.replace('.', ':')];
  const arabic = verse?.[source.text_field || 'ar'];
  if (typeof arabic !== 'string' || arabic.slice(source.start, source.end) !== text) return null;
  if (source.start > 0 && /[\p{Script=Arabic}\p{Mark}]/u.test(arabic[source.start - 1])) return null;
  if (source.end < arabic.length && /[\p{Script=Arabic}\p{Mark}]/u.test(arabic[source.end])) return null;
  const skeleton = esmaIskelet(text);
  if (!skeleton || !ARABIC_LETTER.test(text)) return null;
  for (const name of dataset.esmalar) {
    const entry = dataset.index[name];
    if (!sameEsmaSkeleton(skeleton, esmaIskelet(entry.ar)) ||
        !entry.r.includes(source.verse.replace('.', ':'))) continue;
    return {name, arabic: entry.ar, count: entry.r.length, main: source.verse};
  }
  return null;
}

export function formatEsmaRefs(refs) {
  const grouped = new Map();
  for (const ref of refs) {
    const [sura, ayah] = ref.split('.');
    if (!grouped.has(sura)) grouped.set(sura, []);
    grouped.get(sura).push(ayah);
  }
  return [...grouped].map(([sura, ayahs]) => sura + '.' + ayahs.join(',')).join(' ');
}

// Seçim numaraları anlık listede ve editörde hazırlanır; hiçbir API yazısı yok.
// Hem ana âyet hem mevcut benzeşenler tekilleştirilerek atlanır.
export function stageEsmaReferences({references, main, currentLinks = [], pendingText = ''}) {
  if (!Array.isArray(references) || typeof main !== 'string') throw Error('Esmâ kaynak numaraları geçersiz.');
  const existing = new Set(currentLinks);
  const candidates = [];
  const encountered = new Set();
  for (const raw of references) {
    if (typeof raw !== 'string' || !/^\d{1,3}:\d{1,3}$/u.test(raw)) throw Error('Esmâ kaynak numarası geçersiz.');
    const key = raw.replace(':', '.');
    if (key === main || existing.has(key) || encountered.has(key)) continue;
    encountered.add(key);
    candidates.push(key);
  }
  const pending = String(pendingText).trim() ? parseVerses(pendingText) : [];
  if (pending.includes(main)) throw Error('Numara alanında ana âyet bulunuyor. Önce onu kaldırın.');
  const previously = new Set(pending);
  const inserted = candidates.filter(key => !previously.has(key));
  const merged = [...pending, ...inserted];
  if (merged.length > 1200) throw Error('Bir işlemde en fazla 1.200 âyet olabilir. Eski numaraları kaydedip yeniden deneyin.');
  const mergedText = formatEsmaRefs(merged);
  if (mergedText.length > 5000) throw Error('Bir işlemde en fazla 5.000 karakter olabilir.');
  return {candidates, inserted, mergedText};
}
