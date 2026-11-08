// Yönetici ekranı için salt-okunur kavram benzeşmesi.
// Mevcut benzeşen matrisi ve çalışma geçmişine yazmaz.
// Yalnız ayrı kavram dosyasında kaydedilmiş ETKİN ifadeler kullanılır.

const WORDS = /[\p{Letter}\p{Mark}]+/gu;
const ARABIC_LETTER = /[\p{Script_Extensions=Arabic}]/u;
const indexCache = new WeakMap();

function wordKey(value) {
  return String(value).normalize('NFKC')
    .replace(/\p{Mark}/gu, '').replace(/\u0640/gu, '')
    .replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
    .replace(/[\u0649\u06CC]/gu, '\u064A')
    .replace(/\u06A9/gu, '\u0643').replace(/\u0629/gu, '\u0647');
}

export function arabicWordPositions(text) {
  const result = [];
  for (const hit of String(text || '').matchAll(WORDS)) {
    const key = wordKey(hit[0]);
    if (!key || !ARABIC_LETTER.test(key)) continue;
    result.push({ key, start: hit.index, end: hit.index + hit[0].length });
  }
  return result;
}

function phraseRanges(text, words, phrase) {
  if (!phrase.length || words.length < phrase.length) return [];
  const found = [];
  for (let i = 0; i <= words.length - phrase.length; i++) {
    if (words[i].key !== phrase[0]) continue;
    let ok = true;
    for (let j = 1; j < phrase.length; j++) {
      if (words[i + j].key !== phrase[j] ||
          !/^\s+$/u.test(text.slice(words[i + j - 1].end, words[i + j].start))) {
        ok = false; break;
      }
    }
    if (ok) found.push({start: words[i].start, end: words[i + phrase.length - 1].end});
  }
  return found;
}

function sourceIndex(corpus) {
  if (!corpus || typeof corpus !== 'object' || !corpus.verses) return null;
  if (indexCache.has(corpus)) return indexCache.get(corpus);
  const byRef = new Map(), byFirst = new Map();
  for (const [key, verse] of Object.entries(corpus.verses)) {
    const text = verse?.arh || verse?.ar;
    if (typeof text !== 'string' || !text) continue;
    const ref = key.replace(':', '.');
    const words = arabicWordPositions(text);
    byRef.set(ref, {text, words});
    const distinct = new Set(words.map(word => word.key));
    for (const word of distinct) {
      if (!byFirst.has(word)) byFirst.set(word, new Set());
      byFirst.get(word).add(ref);
    }
  }
  const index = {byRef, byFirst};
  indexCache.set(corpus, index);
  return index;
}

function refSort(a, b) {
  const aa = a.key.split('.').map(Number), bb = b.key.split('.').map(Number);
  return aa[0] - bb[0] || aa[1] - bb[1];
}

export function compareConceptVerses({main, existingLinks = [], corpus, records = []}) {
  const links = new Map();
  for (const link of existingLinks) {
    if (link.key !== main && !links.has(link.key)) {
      links.set(link.key, {...link, viaConcept: false, concepts: [], arabic: ''});
    }
  }
  const result = {mainHighlights: [], matchedConcepts: [], links: [], addedCount: 0, sharedCount: 0};
  const active = Array.isArray(records) ? records.filter(record => record?.status === 'active' &&
      typeof record.arabic_text === 'string' && record.arabic_text.trim())
      .sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];
  // Kayıtlı etkin kavram yoksa tam Kur’an kelime indeksini oluşturmaya gerek yok.
  const index = active.length ? sourceIndex(corpus) : null;
  const selected = index?.byRef.get(main);
  if (selected) {
    for (const record of active) {
      const pattern = arabicWordPositions(record.arabic_text).map(word => word.key);
      const mainRanges = phraseRanges(selected.text, selected.words, pattern);
      if (!mainRanges.length) continue; // Ana âyette bulunmayan kavram başka âyet aratamaz.
      const concept = {
        id: record.id, label: record.arabic_text, color: result.matchedConcepts.length % 6,
      };
      result.matchedConcepts.push(concept);
      for (const range of mainRanges) result.mainHighlights.push({...range, ...concept});
      for (const ref of index.byFirst.get(pattern[0]) || []) {
        if (ref === main) continue;
        const item = index.byRef.get(ref);
        const ranges = phraseRanges(item.text, item.words, pattern);
        if (!ranges.length) continue;
        let link = links.get(ref);
        if (!link) {
          link = {key: ref, added: false, viaConcept: true, concepts: [], arabic: item.text};
          links.set(ref, link);
        } else {
          link.arabic = item.text;
        }
        link.concepts.push({...concept, ranges});
      }
    }
  }
  result.links = [...links.values()].sort(refSort);
  result.addedCount = result.links.filter(link => link.viaConcept).length;
  result.sharedCount = result.links.filter(link => !link.viaConcept && link.concepts.length).length;
  return result;
}

// Arapça metne asla HTML eklemeyiz. Orijinal UTF-16 konumları korunur:
// kullanıcı fareyle birden fazla kelimeyi seçip kaynak konumunu kaydedebilir.
export function fillArabicHighlights(node, original, ranges = []) {
  const text = String(original || '');
  node.replaceChildren();
  const nonOverlapping = [];
  for (const range of ranges.filter(r => Number.isInteger(r.start) &&
      Number.isInteger(r.end) && r.start >= 0 && r.end <= text.length &&
      r.start < r.end).sort((a,b) => (b.end-b.start)-(a.end-a.start) || a.start-b.start)) {
    if (nonOverlapping.some(r => range.start < r.end && range.end > r.start)) continue;
    nonOverlapping.push(range);
  }
  nonOverlapping.sort((a,b) => a.start-b.start);
  let offset = 0;
  for (const hit of nonOverlapping) {
    if (hit.start > offset) node.append(document.createTextNode(text.slice(offset, hit.start)));
    const mark = document.createElement('mark');
    mark.className = 'concept-highlight concept-tone-' + hit.color;
    mark.title = 'Ortak kavram: ' + hit.label;
    mark.textContent = text.slice(hit.start, hit.end);
    node.append(mark);
    offset = hit.end;
  }
  if (offset < text.length) node.append(document.createTextNode(text.slice(offset)));
}
