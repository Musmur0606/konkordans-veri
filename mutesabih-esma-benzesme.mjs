// Ayrı Esmâ-i Hüsnâ veri setinin 99 isim / 2050 âyet referansı ile salt-okunur
// eşleşmesi. Hiçbir kavram veya benzeşen JSON dosyasına yazma yapmaz.
const ARABIC_WORDS = /[\p{Script=Arabic}\p{Mark}]+/gu;
const ARABIC_LETTER = /[\p{Script=Arabic}&&\p{Letter}]/v;

export function esmaIskelet(text, stripInitialArticle=true) {
  const original = String(text || '').normalize('NFC');
  const tanwin = original.includes('\u064B');
  let pure = original.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    .replace(/\u0640/gu, '').replace(/[^\u0621-\u064A\u0671]/gu, '');
  if(stripInitialArticle)pure = pure.replace(/^[\u0627\u0671]\u0644/u, '');
  if (tanwin && pure.endsWith('\u0627')) pure = pure.slice(0, -1);
  // Diyanet/Hasenat'ın kelime içindeki elif-hamze gösterim farkı yalnız
  // karşılaştırmada giderilir; orijinal Arapça metin kesinlikle değişmez.
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
    const entry = Object.hasOwn(dataset.index,name) ? dataset.index[name] : null;
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
    .filter(hit=>ARABIC_LETTER.test(hit[0]))
    .map(hit=>({start:hit.index,end:hit.index+hit[0].length,
      skeleton:esmaIskelet(hit[0]),withArticle:esmaIskelet(hit[0],false)}));
}

function sameEsmaSkeleton(selected, target) {
  if (selected === target) return true;
  // ذو الجلال والإكرام, i'râb sebebiyle ذي/ذى biçimine geçebilir.
  // Yalnız tam üç parçalı Esmâ ifadesinde tanımlı bu değişime izin verilir.
  const special = 'ذوالجلالوالاكرام';
  return target === special &&
    (selected === 'ذي' + special.slice(2) || selected === 'ذى' + special.slice(2));
}

function esmaTargets(arabicName) {
  const target=esmaIskelet(arabicName);
  return target==='ذوالجلالوالاكرام'
    ? [target,'ذي'+target.slice(2),'ذى'+target.slice(2)] : [target];
}

// Çok kelimeli Esmâ, mushaf yazımında bitişik ya da ayrı yazılmış olabilir.
// Her durumda yalnız *tam*, kesintisiz kelime/kelime grubu kabul edilir.
export function esmaRanges(text, arabicName) {
  const targets = esmaTargets(arabicName).filter(Boolean);
  if (!targets.length) return [];
  const words = wordRanges(text), result = [];
  for (let i=0; i<words.length; i++) {
    let skeleton = '';
    for (let j=i; j<Math.min(words.length, i+6); j++) {
      if (j>i && !/^\s+$/u.test(text.slice(words[j-1].end, words[j].start))) break;
      skeleton += j===i?words[j].skeleton:words[j].withArticle;
      if (targets.includes(skeleton)) result.push({start:words[i].start,end:words[j].end});
      if (!targets.some(target=>target.startsWith(skeleton))) break;
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
  if (typeof arabic !== 'string' || arabic.slice(source.start,source.end) !== text) return null;
  // Sağdan/ soldan yarım sözcük seçmek Esmâya dönüşmemeli.
  if (source.start>0 && /[\p{Script=Arabic}\p{Mark}]/u.test(arabic[source.start-1])) return null;
  if (source.end<arabic.length && /[\p{Script=Arabic}\p{Mark}]/u.test(arabic[source.end])) return null;
  const skeleton = esmaIskelet(text);
  if (!skeleton || !ARABIC_LETTER.test(text)) return null;
  for (const name of dataset.esmalar) {
    const entry = dataset.index[name];
    if (!sameEsmaSkeleton(skeleton,esmaIskelet(entry.ar)) ||
        !entry.r.includes(source.verse.replace('.', ':'))) continue;
    return {name,arabic:entry.ar,count:entry.r.length,main:source.verse};
  }
  return null;
}

