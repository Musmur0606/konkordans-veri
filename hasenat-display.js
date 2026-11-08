/* Hasenat gösterimi: ar/kr kararlarını değiştirmeden arh/arh_map üzerine taşır.
 * arh_map[newSpaceIndex] = [oldSpaceIndex, ...]. Kaynak indisleri arToken
 * indisleri değildir; işaretlerin önündeki/arasındaki karakter konumları korunur.
 * Bu dosya kaynak metni, kökleri, eşleştirme seçeneklerini veya veriyi değiştirmez.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HasenatDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Hasenat fontundaki dört harf kodunun arama eşdeğerleri. Hepsi tek UTF-16
  // birimidir: arMatch'in döndürdüğü konumlar özgün gösterimde de geçerlidir.
  // Elif/hareke kaldırma veya kök tahmini burada yapılmaz.
  const glyphs = { '\u06CC': '\u064A', '\u067E': '\u0626', '\u0676': '\u0624', '\u06BE': '\u0647' };
  const forSearch = value => String(value || '').replace(/[\u06CC\u067E\u0676\u06BE]/g, char => glyphs[char]);
  const escapeHTML = value => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function spaceWords(value) {
    let at = 0;
    return value.split(' ').map(raw => {
      const word = { raw, start: at, end: at + raw.length };
      at = word.end + 1;
      return word;
    });
  }

  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }

  function vocative(raw) {
    const plain = forSearch(raw).normalize('NFC')
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
    return plain === '\u064A\u0627' || plain === '\u0648\u064A\u0627';
  }

  function create(dependencies) {
    const { arMatch, arToken, arEq, esmaIskelet } = dependencies || {};
    const escape = dependencies?.escape || escapeHTML;
    for (const [name, fn] of Object.entries({ arMatch, arToken, arEq, esmaIskelet, escape })) {
      if (typeof fn !== 'function') throw new TypeError('HasenatDisplay: ' + name + ' işlevi gerekli.');
    }
    const cache = new WeakMap();

    function view(verse) {
      const source = String(verse?.ar || '');
      const requested = String(verse?.arh || source);
      const supplied = verse?.arh_map;
      const cached = verse && typeof verse === 'object' ? cache.get(verse) : null;
      if (cached && cached.source === source && cached.requested === requested && cached.supplied === supplied) return cached;

      const oldWords = spaceWords(source);
      let display = requested;
      let words = spaceWords(display);
      let map = supplied;
      let status = 'mapped';
      if (display === source) {
        map = words.map((_, i) => [i]);
        status = verse?.arh ? 'identical' : 'source';
      } else {
        let previous = -1;
        const seen = new Set();
        const valid = Array.isArray(map) && map.length === words.length && map.every(ids => {
          if (!Array.isArray(ids) || !ids.length) return false;
          let within = -1;
          for (const id of ids) {
            if (!Number.isInteger(id) || id < 0 || id >= oldWords.length || id <= within || id < previous) return false;
            within = id;
            seen.add(id);
          }
          previous = within;
          return true;
        }) && oldWords.every((word, i) => !word.raw || seen.has(i));
        if (!valid) {
          // Önbellekte eski/yarım veri varsa indis tahminiyle yanlış sözcük
          // boyamayız. Kaynak görünümü ve eski arama sonucu birlikte korunur.
          display = source;
          words = oldWords;
          map = words.map((_, i) => [i]);
          status = 'source-fallback';
        }
      }
      const reverse = oldWords.map(() => []);
      map.forEach((ids, i) => ids.forEach(id => reverse[id].push(i)));
      const tokens = arToken(forSearch(display)).map(token => ({
        raw: display.slice(token.start, token.end), start: token.start, end: token.end
      }));
      const value = { source, requested, supplied, display, oldWords, words, map, reverse, tokens, status };
      if (verse && typeof verse === 'object') cache.set(verse, value);
      return value;
    }

    function ranges(text, hits) {
      const sorted = hits.filter(hit => Number.isInteger(hit.start) && Number.isInteger(hit.end) &&
        hit.start >= 0 && hit.end > hit.start && hit.end <= text.length)
        .map(hit => {
          let end = hit.end;
          // Eski arToken U+08D7/U+08D9 gibi sonraki birleşen işaretleri
          // kapsamıyor. Yalnız HTML sınırını uzat: taban harf ve işareti
          // farklı span'lere bölme, özgün metin veya arama kuralını değiştirme.
          while (end < text.length) {
            const next = String.fromCodePoint(text.codePointAt(end));
            if (!/\p{Mark}/u.test(next)) break;
            end += next.length;
          }
          return { start: hit.start, end };
        })
        .sort((a, b) => a.start - b.start || a.end - b.end);
      const merged = [];
      for (const hit of sorted) {
        const last = merged[merged.length - 1];
        if (last && hit.start < last.end) last.end = Math.max(last.end, hit.end);
        else merged.push(hit);
      }
      return merged.map(hit => ({ ...hit, raw: text.slice(hit.start, hit.end) }));
    }

    function project(v, sourceHits, { query = '', options = {}, esma = false } = {}) {
      if (v.display === v.source) return sourceHits;
      const oldIds = new Set();
      v.oldWords.forEach((word, i) => {
        if (sourceHits.some(hit => overlaps(word, hit))) oldIds.add(i);
      });
      const queryWords = esma ? [] : arToken(forSearch(query)).map(word => word.raw);
      const selected = [];
      v.words.forEach((word, i) => {
        const ids = v.map[i].filter(id => oldIds.has(id));
        if (!ids.length) return;
        // 1→2 dönüşümde يا köksüz çağrı parçasıdır. قوم aramasını يا'ya
        // yaymayız; يا açıkça aranırsa veya eski birleşik sözcüğün tamamı
        // seçilirse aramanın kapsadığı iki parçayı da gösteririz.
        if (vocative(word.raw) && ids.some(id => v.reverse[id].length > 1)) {
          const explicit = !esma && queryWords.some(term =>
            arEq(forSearch(word.raw), term, options) || ids.some(id =>
              arEq(v.oldWords[id].raw, term, { ...options, whole: true, affixes: false })));
          if (!explicit) return;
        }
        if (esma) selected.push(word);
        else {
          const parts = v.tokens.filter(token => overlaps(word, token));
          selected.push(...parts);
        }
      });
      return selected;
    }

    function match(verse, query, options) {
      const v = view(verse);
      const sourceHits = arMatch(v.source, query, options);
      if (v.display === v.source) return ranges(v.display, sourceHits);
      const displayHits = arMatch(forSearch(v.display), forSearch(query), options);
      return ranges(v.display, [...project(v, sourceHits, { query, options }), ...displayHits]);
    }

    function render(text, hits, opening, closing) {
      let result = '', at = 0;
      for (const hit of ranges(text, hits)) {
        result += escape(text.slice(at, hit.start)) + opening + escape(text.slice(hit.start, hit.end)) + closing;
        at = hit.end;
      }
      return result + escape(text.slice(at));
    }

    function searchHTML(verse, query, options) {
      return render(view(verse).display, match(verse, query, options), '<span class="arama-kirmizi">', '</span>');
    }

    function esmaMatches(verse, name) {
      const v = view(verse);
      const target = esmaIskelet(name);
      if (!target) return [];
      // Kabul edilmiş R3 kararı yalnız eski kaynakta alınır. Yeni yazımın
      // eliflerini silmek ALİY/عَلَى ve HALLÂK/خَلَقَ gibi adları karıştırır.
      const sourceHits = Array.from(v.source.matchAll(/\S+/gu))
        .filter(part => esmaIskelet(part[0]) === target)
        .map(part => ({ raw: part[0], start: part.index, end: part.index + part[0].length }));
      return ranges(v.display, project(v, sourceHits, { esma: true }));
    }

    function esmaHTML(verse, name) {
      return render(view(verse).display, esmaMatches(verse, name), '<b class="esmahl">', '</b>');
    }

    return Object.freeze({
      text: verse => view(verse).display,
      mappingStatus: verse => view(verse).status,
      match, searchHTML, esmaMatches, esmaHTML
    });
  }

  return Object.freeze({ create });
});
