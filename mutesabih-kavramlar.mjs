// Aynı yönetim panelinin ayrı kavram çalışma alanı.
// Anahtar yalnız getContext() üzerinden işlem anında alınır; saklanmaz/yayımlanmaz.
import {
  CONCEPTS_BRANCH, CONCEPTS_PATH, assertConceptHistory, assertConceptStorageTarget, conceptSearchKey,
  addConcept, archiveConcept, restoreConcept,
} from './mutesabih-kavramlar-core.mjs?v=1';
import {
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseConceptImport, buildConceptImport,
} from './mutesabih-kavramlar-import.mjs?v=1';

const OWNER = 'Musmur0606';
const REPO = 'konkordans-veri';
const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
const MAX_TEXT = 4096;
const MAX_NOTE = 4000;
const hasArabic = value => Array.from(String(value)).some(char =>
  /\p{Script=Arabic}/u.test(char) && /\p{L}/u.test(char));
const filterKey = value => String(value || '').normalize('NFKD')
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
  .replace(/[أإآٱ]/g, 'ا').toLocaleLowerCase('tr-TR');

function canonicalRef(value, corpus) {
  const match = /^(\d{1,3})[.:](\d{1,3})$/.exec(String(value || '').trim());
  if (!match) throw Error('Kaynak âyeti 2.255 biçiminde yazın veya alanı boş bırakın.');
  const verse = Number(match[1]) + '.' + Number(match[2]);
  if (!corpus?.verses?.[verse.replace('.', ':')]) throw Error('Belirtilen kaynak âyet bulunamadı.');
  return verse;
}

function sourceMatches(source, text, corpus) {
  if (!source) return false;
  const ar = corpus?.verses?.[source.verse?.replace('.', ':')]?.ar;
  return typeof ar === 'string' && Number.isInteger(source.start) &&
    Number.isInteger(source.end) && source.start >= 0 &&
    source.end > source.start && source.end <= ar.length &&
    ar.slice(source.start, source.end) === text;
}

function encode(text) {
  const bytes = new TextEncoder().encode(text), parts = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return btoa(parts.join(''));
}

function decode(text) {
  return new TextDecoder().decode(Uint8Array.from(
    atob(String(text).replace(/\s/g, '')), char => char.charCodeAt(0)));
}

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(text ?? '');
  return node;
}

export function initConceptPanel({ getContext, setBusy } = {}) {
  const ids = [
    'concepts-panel', 'concepts-context-menu', 'concepts-transfer', 'concepts-selection-note',
    'concepts-quick-status', 'concepts-text', 'concepts-source',
    'concepts-source-note', 'concepts-note', 'concepts-save', 'concepts-refresh',
    'concepts-export', 'concepts-filter', 'concepts-status-filter', 'concepts-count',
    'concepts-list', 'concepts-message', 'concepts-target', 'main-arabic',
    'concepts-file-add', 'concepts-file', 'concepts-import-preview',
    'concepts-import-summary', 'concepts-import-list', 'concepts-import-confirm',
    'concepts-import-cancel', 'concepts-import-message',
  ];
  const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  if (typeof getContext !== 'function' || typeof setBusy !== 'function' ||
      ids.some(id => !nodes[id])) {
    return Object.freeze({
      available: false,
      onAuthorized: async () => false, refresh: async () => false,
      onLogout() {}, syncAuth() {},
    });
  }
  const node = id => nodes[id];
  let doc = null, sha = '', loading = false, saving = false, needsRefresh = false;
  let epoch = 0, readSequence = 0, operationSequence = 0, activeOperation = null;
  let pendingSelection = null, editorSource = null, wasAuthorized = false;
  let readingFile = false, fileSequence = 0, pendingImport = null;
  let recordButtons = [];

  function context() { return getContext() || {}; }
  function authorized(ctx = context()) {
    return typeof ctx.token === 'string' && !!ctx.token && ctx.actor === OWNER;
  }
  function session() {
    const ctx = context();
    if (!authorized(ctx)) throw Error('Önce yönetici girişini tamamlayın.');
    return { token: ctx.token, actor: ctx.actor, epoch };
  }
  function sameSession(captured) {
    const ctx = context();
    return captured.epoch === epoch && ctx.token === captured.token &&
      ctx.actor === captured.actor && authorized(ctx);
  }
  function ensureSession(captured) {
    if (!sameSession(captured)) throw Error('Oturum değişti; eski işlem sürdürülmedi.');
  }
  function message(text, type = '') {
    node('concepts-message').textContent = text;
    node('concepts-message').className = 'concepts-message' + (type ? ' ' + type : '');
  }
  function quickMessage(text, type = '') {
    node('concepts-quick-status').textContent = text;
    node('concepts-quick-status').className = 'concepts-message concepts-quick-status' +
      (type ? ' ' + type : '');
  }
  function importMessage(text, type = '') {
    node('concepts-import-message').textContent = text;
    node('concepts-import-message').className = 'concepts-message' + (type ? ' ' + type : '');
  }
  function clearImport() {
    fileSequence++; readingFile = false; pendingImport = null;
    node('concepts-file').value = '';
    node('concepts-import-preview').hidden = true;
    node('concepts-import-summary').textContent = '';
    node('concepts-import-list').replaceChildren();
    importMessage('');
  }
  function correctLocation() {
    if (CONCEPTS_BRANCH !== 'calisma-kavramlar' ||
        CONCEPTS_PATH !== 'data/kavramlar-calisma.json') {
      throw Error('Kavram kayıt yeri beklenenden farklı. Hiçbir dosyaya yazılmadı.');
    }
  }
  const storage = () => ({ path: CONCEPTS_PATH, branch: CONCEPTS_BRANCH });
  const headers = captured => ({
    Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + captured.token,
  });
  async function responseJson(response, label) {
    if (response.ok) return response.json();
    if (response.status === 409 || response.status === 422) {
      throw Error('Sürüm çakışması. Kavramları yenileyip tekrar kontrol edin; otomatik tekrar yapılmadı.');
    }
    if (response.status === 401 || response.status === 403) {
      throw Error(label + ': erişim yetkisi reddedildi. Ana benzeşen veri setine geçiş yapılmadı.');
    }
    if (response.status === 404) {
      throw Error('Kavram çalışma dosyası/dalı bulunamadı. Canlı dosyaya yönlendirme yapılmadı.');
    }
    throw Error(label + ' başarısız (' + response.status + ').');
  }
  async function loadDocument(captured) {
    correctLocation(); ensureSession(captured);
    const url = API + '/contents/' + CONCEPTS_PATH + '?ref=' + encodeURIComponent(CONCEPTS_BRANCH);
    const response = await fetch(url, { headers: headers(captured), cache: 'no-store' });
    ensureSession(captured);
    const payload = await responseJson(response, 'Kavram dosyasını okuma');
    ensureSession(captured);
    if (payload.type !== 'file' || payload.path !== CONCEPTS_PATH ||
        !/^[a-f0-9]{40}$/.test(payload.sha || '')) {
      throw Error('Kavram dosyası ve sürümü doğrulanamadı; kayıt kapalı.');
    }
    let encoded = payload.encoding === 'base64' ? payload.content : '';
    if (!encoded) {
      const raw = await fetch(API + '/git/blobs/' + payload.sha,
        { headers: headers(captured), cache: 'no-store' });
      ensureSession(captured);
      const blob = await responseJson(raw, 'Büyük kavram dosyasını okuma');
      ensureSession(captured);
      if (blob.sha !== payload.sha || blob.encoding !== 'base64' ||
          typeof blob.content !== 'string' || !blob.content) {
        throw Error('Kavram içeriğinin sürümü değişti; kayıt yapılmadı.');
      }
      encoded = blob.content;
    }
    const content = JSON.parse(decode(encoded));
    assertConceptStorageTarget(storage(), content, context().corpus);
    return { doc: content, sha: payload.sha };
  }
  function updateSourceNote() {
    const text = node('concepts-text').value;
    if (editorSource && sourceMatches(editorSource, text, context().corpus)) {
      node('concepts-source-note').textContent = 'Doğrulanmış kaynak: ' +
        editorSource.verse + ' · seçilen Arapça metin konumu korunuyor.';
    } else if (node('concepts-source').value.trim()) {
      node('concepts-source-note').textContent =
        'Belirtilen kaynak âyette birebir ve tek konum eşleşmesi kayıt sırasında denetlenecek.';
    } else {
      node('concepts-source-note').textContent =
        'Kaynak belirtilmedi. Ekranda açık ana âyet kendiliğinden kaynak atanmaz.';
    }
  }
  function pendingIsCurrent() {
    if (!pendingSelection) return false;
    const ctx = context();
    let main;
    try { main = canonicalRef(ctx.selected, ctx.corpus); } catch { return false; }
    const ar = ctx.corpus.verses[main.replace('.', ':')].ar;
    return main === pendingSelection.source.verse &&
      node('main-arabic').textContent === ar &&
      sourceMatches(pendingSelection.source, pendingSelection.text, ctx.corpus);
  }
  function syncAuth() {
    const ctx = context(), logged = authorized(ctx);
    if (wasAuthorized && !logged) { onLogout(); return; }
    wasAuthorized = logged;
    const occupied = saving || readingFile || !!ctx.busy;
    const ready = logged && !!doc && !!sha && !loading && !needsRefresh;
    for (const id of ['concepts-text', 'concepts-source', 'concepts-note']) {
      node(id).disabled = !logged || occupied;
    }
    if (!pendingIsCurrent()) {
      pendingSelection = null;
      node('concepts-context-menu').hidden = true;
    }
    node('concepts-transfer').disabled = !ready || occupied || !pendingSelection;
    node('concepts-save').disabled = !ready || occupied ||
      !hasArabic(node('concepts-text').value);
    node('concepts-refresh').disabled = !logged || occupied || loading;
    node('concepts-export').disabled = !ready || occupied;
    node('concepts-file-add').disabled = !ready || occupied;
    node('concepts-file').disabled = !ready || occupied;
    node('concepts-import-confirm').disabled = !ready || occupied ||
      !pendingImport?.changed || pendingImport.baseSha !== sha ||
      pendingImport.epoch !== epoch || pendingImport.actor !== ctx.actor;
    node('concepts-import-cancel').disabled = saving;
    node('concepts-filter').disabled = !logged || !doc;
    node('concepts-status-filter').disabled = !logged || !doc;
    for (const button of recordButtons) button.disabled = !ready || occupied;
    node('concepts-panel').dataset.ready = ready ? 'true' : 'false';
    updateSourceNote();
  }
  function renderRecords() {
    const list = node('concepts-list');
    list.replaceChildren(); recordButtons = [];
    if (!doc) {
      node('concepts-count').textContent = loading ? 'Kayıtlar okunuyor…' : 'Kayıtlar yüklenmedi.';
      syncAuth(); return;
    }
    const query = filterKey(node('concepts-filter').value.trim());
    const status = node('concepts-status-filter').value;
    const filtered = doc.records.filter(record => {
      if (status !== 'all' && record.status !== status) return false;
      const terms = [record.arabic_text, record.search_key,
        ...record.sources.map(source => source.verse), ...record.notes.map(note => note.text)];
      return !query || terms.some(text => filterKey(text).includes(query));
    });
    node('concepts-count').textContent = filtered.length + ' eşleşme · ' +
      doc.records.length + ' toplam kayıt' + (filtered.length > 150 ? ' · ilk 150 gösteriliyor' : '');
    for (const record of filtered.slice(0, 150)) {
      const card = textNode('article', 'concepts-record', '');
      const head = textNode('div', 'concepts-record-head', '');
      const phrase = textNode('strong', 'concepts-arabic', record.arabic_text);
      phrase.lang = 'ar'; phrase.dir = 'rtl';
      head.append(phrase, textNode('span', 'concepts-state',
        record.status === 'archived' ? 'Arşivde' : 'Etkin'));
      const refs = [...new Set(record.sources.map(source => source.verse))];
      card.append(head, textNode('p', 'concepts-record-source',
        refs.length ? 'Kaynak âyetler: ' + refs.join(' · ') : 'Kaynak belirtilmedi'));
      if (record.notes.length) {
        card.append(textNode('p', 'concepts-record-note',
          record.notes.map(note => note.text).join(' · ')));
      }
      const button = textNode('button', 'button outline small',
        record.status === 'archived' ? 'Geri getir' : 'Arşivle');
      button.type = 'button';
      button.addEventListener('click', () => mutate(
        record.status === 'archived' ? 'restore' : 'archive', record.id));
      recordButtons.push(button); card.append(button); list.append(card);
    }
    if (!filtered.length) list.append(textNode('p', 'micro', 'Bu filtreye uygun kavram kaydı yok.'));
    syncAuth();
  }
  async function refresh() {
    if (saving) return false;
    clearImport();
    let captured;
    try { captured = session(); }
    catch (error) { message(error.message, 'error'); syncAuth(); return false; }
    const sequence = ++readSequence;
    loading = true; needsRefresh = true;
    message('Kavram çalışma dosyası okunuyor…');
    syncAuth();
    try {
      const result = await loadDocument(captured);
      if (!sameSession(captured) || sequence !== readSequence) return false;
      doc = result.doc; sha = result.sha; needsRefresh = false; loading = false;
      renderRecords();
      message('Kavram çalışma kayıtları yüklendi. Portal ve motor verisi değişmez.', 'success');
      return true;
    } catch (error) {
      if (!sameSession(captured) || sequence !== readSequence) return false;
      doc = null; sha = ''; loading = false;
      renderRecords();
      message('Kavram kaydı kapalı: ' + error.message, 'error');
      return false;
    }
  }
  function readSelection() {
    const ctx = context(), selection = window.getSelection?.();
    if (!authorized(ctx) || !selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
    const range = selection.getRangeAt(0), host = node('main-arabic');
    if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return null;
    let verse;
    try { verse = canonicalRef(ctx.selected, ctx.corpus); } catch { return null; }
    const ar = ctx.corpus.verses[verse.replace('.', ':')].ar;
    if (typeof ar !== 'string' || host.textContent !== ar) return null;
    const before = document.createRange();
    before.selectNodeContents(host); before.setEnd(range.startContainer, range.startOffset);
    const raw = range.toString();
    if (!raw.trim() || raw.length > MAX_TEXT) return null;
    try { conceptSearchKey(raw); } catch { return null; }
    const start = before.toString().length;
    const source = { verse, start, end: start + raw.length, origin: 'admin_selection' };
    return sourceMatches(source, raw, ctx.corpus) ? { text: raw, source } : null;
  }
  function closeContextMenu() {
    pendingSelection = null;
    node('concepts-context-menu').hidden = true;
  }
  function openContextMenu(event) {
    const captured = readSelection();
    // Yalnız geçerli Arapça seçimi üzerinde özel menü: diğer sağ tıklar değişmez.
    if (!captured) { closeContextMenu(); return; }
    event.preventDefault();
    pendingSelection = captured;
    node('concepts-selection-note').textContent = captured.source.verse + ' · seçilen Arapça ifade';
    const menu = node('concepts-context-menu');
    menu.hidden = false;
    const width = Number.isFinite(window.innerWidth) ? window.innerWidth : 1024;
    const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 768;
    menu.style.left = Math.min(Math.max(Number(event.clientX) || 8, 8), Math.max(8, width - 300)) + 'px';
    menu.style.top = Math.min(Math.max(Number(event.clientY) || 8, 8), Math.max(8, height - 120)) + 'px';
    syncAuth();
  }
  function transferSelection() {
    const ctx = context();
    if (!authorized(ctx) || saving || ctx.busy || !pendingIsCurrent()) {
      quickMessage('Seçim veya oturum değişti. Arapça metni yeniden seçip sağ tıklayın.', 'error');
      closeContextMenu(); return;
    }
    // Menü öğesi, yalnız bu anlık görüntüyü kaydeder. Formun metni/notu kullanılmaz.
    const captured = {
      text: pendingSelection.text, source: { ...pendingSelection.source },
    };
    closeContextMenu();
    return mutate('quick', '', captured);
  }
  function clearSource() {
    editorSource = null; node('concepts-source').value = '';
  }
  function resolveSource(text, corpus) {
    if (editorSource && sourceMatches(editorSource, text, corpus) &&
        node('concepts-source').value.trim() === editorSource.verse) {
      return { ...editorSource };
    }
    const typed = node('concepts-source').value.trim();
    if (!typed) return null;
    const verse = canonicalRef(typed, corpus), ar = corpus.verses[verse.replace('.', ':')].ar;
    const start = ar.indexOf(text);
    if (start < 0 || ar.indexOf(text, start + 1) >= 0) {
      throw Error('Metnin belirtilen âyette birebir ve tek konumu bulunamadı. ' +
        'Âyetten yeniden seçerek kopyalayın veya kaynak alanını boş bırakın.');
    }
    return { verse, start, end: start + text.length, origin: 'manual' };
  }
  function renderImport(parsed, fingerprint, result) {
    const summary = parsed.fileName + ' · ' + parsed.totalRows + ' satır/sıra · ' +
      result.newCount + ' yeni kavram · ' + result.updatedCount + ' mevcut kayda kaynak/not · ' +
      result.unchangedCount + ' değişiklik gerektirmeyen kayıt' +
      (parsed.duplicateRows ? ' · dosya içi ' + parsed.duplicateRows + ' tekrar birleştirildi' : '') +
      (result.archivedCount ? ' · ' + result.archivedCount + ' arşiv kaydı arşivde kalacak' : '');
    node('concepts-import-summary').textContent = summary;
    const list = node('concepts-import-list'); list.replaceChildren();
    for (const row of result.rows) {
      const item = textNode('div', 'concepts-import-row', '');
      const phrase = textNode('span', 'concepts-arabic', row.arabicText);
      phrase.lang = 'ar'; phrase.dir = 'rtl';
      const state = row.action === 'new' ? 'Yeni kavram' :
        row.action === 'update' ? 'Mevcut kavrama dosya kaynağı/notu eklenecek' : 'Zaten kayıtlı';
      item.append(phrase, textNode('span', 'micro', state + (row.archived ? ' · arşivde kalacak' : '')));
      list.append(item);
    }
    list.append(textNode('p', 'concepts-import-fingerprint', 'Dosya SHA-256: ' + fingerprint));
    node('concepts-import-preview').hidden = false;
    importMessage(result.changed
      ? 'Henüz kaydedilmedi. Listeyi kontrol edip “OK — Dosyadaki kavramları ekle” düğmesine basın.'
      : 'Bu dosyanın kavramları ve kaynak bilgisi zaten kayıtlı. Yeniden yazılmayacak.',
    result.changed ? '' : 'success');
  }
  async function previewFile() {
    const ctx = context();
    if (!authorized(ctx) || ctx.busy || saving || loading || readingFile ||
        !doc || !sha || needsRefresh) return;
    const files = Array.from(node('concepts-file').files || []);
    clearImport();
    if (!files.length) { syncAuth(); return; }
    const captured = session(), sequence = ++fileSequence, originalSha = sha;
    readingFile = true; importMessage('Dosya okunuyor ve Arapça kavramlar kontrol ediliyor…'); syncAuth();
    try {
      if (files.length !== 1) throw Error('Bir defada yalnız bir kavram dosyası seçin.');
      const file = files[0];
      if (!/\.(txt|csv|json)$/i.test(file.name || '')) throw Error('TXT, CSV veya JSON biçiminde bir kavram dosyası seçin.');
      if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
        throw Error('Dosya boş olmamalı ve en çok 1 MB olmalı.');
      }
      const buffer = await file.arrayBuffer();
      if (!sameSession(captured) || sequence !== fileSequence) return;
      const bytes = new Uint8Array(buffer);
      if (bytes.byteLength !== file.size || bytes.byteLength > MAX_IMPORT_BYTES) throw Error('Dosyanın boyutu doğrulanamadı.');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw Error('Dosya UTF-8 biçiminde okunamadı. Arapça harfleri koruyarak UTF-8 olarak kaydedin.'); }
      if (!globalThis.crypto?.subtle) throw Error('Dosya bütünlük kontrolü kullanılamıyor. Güvenli HTTPS bağlantısıyla yeniden açın.');
      const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      if (!sameSession(captured) || sequence !== fileSequence) return;
      if (sha !== originalSha || needsRefresh || loading || context().busy) throw Error('İşlem durumu değişti. Kavramları yenileyip dosyayı yeniden seçin.');
      const fingerprint = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
      const parsed = parseConceptImport({ fileName: file.name, text });
      const result = buildConceptImport(doc, parsed, {
        sha256: fingerprint, actor: captured.actor, corpus: context().corpus,
      });
      assertConceptStorageTarget(storage(), result.doc, context().corpus);
      pendingImport = { parsed, sha256: fingerprint, baseSha: originalSha,
        epoch: captured.epoch, actor: captured.actor, changed: result.changed };
      renderImport(parsed, fingerprint, result);
    } catch (error) {
      if (sameSession(captured) && sequence === fileSequence) {
        pendingImport = null;
        importMessage('Dosya eklenmedi: ' + error.message + ' Hiçbir kavram kaydedilmedi.', 'error');
      }
    } finally {
      if (sequence === fileSequence) { readingFile = false; syncAuth(); }
    }
  }
  async function mutate(operation, recordId = '', quickInput = null) {
    const ctx = context();
    const quick = operation === 'quick';
    const report = (text, type = '') => {
      message(text, type);
      if (quick) quickMessage(text, type);
      if (operation === 'import') importMessage(text, type);
    };
    if (!authorized(ctx) || ctx.busy || saving || loading || readingFile) return;
    if (!doc || !sha || needsRefresh) {
      report('Kavram çalışma dosyası hazır değil. Önce Kavramları yenile düğmesini kullanın.', 'error'); return;
    }
    let captured, result;
    const fieldSnapshot = {
      text: node('concepts-text').value, source: node('concepts-source').value,
      note: node('concepts-note').value,
    };
    try {
      captured = session();
      correctLocation(); assertConceptStorageTarget(storage(), doc, ctx.corpus);
      if (operation === 'add' || quick) {
        const text = quick ? quickInput?.text : fieldSnapshot.text;
        if (typeof text !== 'string' || !hasArabic(text) || text.length > MAX_TEXT) {
          throw Error('Arapça bir kelime veya kelime grubu girin (en çok 4.096 karakter).');
        }
        if (!quick && fieldSnapshot.note.length > MAX_NOTE) throw Error('Not en çok 4.000 karakter olabilir.');
        if (quick && !sourceMatches(quickInput.source, text, ctx.corpus)) {
          throw Error('Seçilen metin ile kaynak konumu uyuşmuyor. Yeniden seçin.');
        }
        result = addConcept(doc, {
          arabicText: text, note: quick ? '' : fieldSnapshot.note,
          source: quick ? { ...quickInput.source } : resolveSource(text, ctx.corpus),
        }, captured.actor, ctx.corpus);
      } else if (operation === 'import') {
        if (!pendingImport || pendingImport.baseSha !== sha || pendingImport.epoch !== epoch ||
            pendingImport.actor !== captured.actor) {
          throw Error('Dosya önizlemesi güncel değil. Dosyayı yeniden seçip kontrol edin.');
        }
        result = buildConceptImport(doc, pendingImport.parsed, {
          sha256: pendingImport.sha256, actor: captured.actor, corpus: ctx.corpus,
        });
      } else {
        if (!['archive', 'restore'].includes(operation)) throw Error('Geçersiz kavram işlemi.');
        const record = doc.records.find(item => item.id === recordId);
        if (!record) throw Error('Kavram kaydı bulunamadı.');
        if (!window.confirm(record.arabic_text + '\n\n' +
            (operation === 'archive' ? 'Bu kaydı arşive almak' : 'Bu kaydı geri getirmek') +
            ' istiyor musunuz? Kayıt geçmişi korunur.')) return;
        result = (operation === 'archive' ? archiveConcept : restoreConcept)(
          doc, recordId, '', captured.actor);
      }
      if (!result.changed) {
        report('Aynı kayıt zaten var; yeni kaynak/not veya durum değişikliği bulunmadı.' +
          (quick ? ' · ' + quickInput.source.verse : '')); return;
      }
      assertConceptStorageTarget(storage(), result.doc, ctx.corpus);
    } catch (error) { report(error.message, 'error'); return; }
    const originalSha = sha, operationId = ++operationSequence;
    activeOperation = operationId; saving = true;
    try {
      report('Kaydediliyor…');
      setBusy(true); syncAuth();
      const fresh = await loadDocument(captured);
      ensureSession(captured);
      if (fresh.sha !== originalSha) {
        throw Error('Kavram veri seti başka bir işlemde değişti. Yazılmadı; yenileyip tekrar kontrol edin.');
      }
      const body = {
        message: 'AyetulKuran: kavram çalışma ' + (quick ? 'add' : operation),
        branch: CONCEPTS_BRANCH, sha: originalSha,
        content: encode(JSON.stringify(result.doc, null, 2) + '\n'),
      };
      ensureSession(captured); correctLocation();
      const response = await fetch(API + '/contents/' + CONCEPTS_PATH, {
        method: 'PUT', headers: { ...headers(captured), 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store',
      });
      ensureSession(captured);
      const reply = await responseJson(response, 'Kavram kaydetme');
      ensureSession(captured);
      if (!/^[a-f0-9]{40}$/.test(reply.content?.sha || '') ||
          !/^[a-f0-9]{40}$/.test(reply.commit?.sha || '') ||
          reply.content.path !== CONCEPTS_PATH) {
        throw Error('Kayıt yanıtı doğrulanamadı. Sonuç belirsiz; otomatik tekrar yapılmadı.');
      }
      doc = result.doc; sha = reply.content.sha; needsRefresh = false;
      clearImport();
      if (operation === 'add' && node('concepts-text').value === fieldSnapshot.text &&
          node('concepts-source').value === fieldSnapshot.source &&
          node('concepts-note').value === fieldSnapshot.note) {
        node('concepts-text').value = ''; node('concepts-note').value = '';
        clearSource();
      }
      renderRecords();
      report(operation === 'import'
        ? result.newCount + ' yeni kavram ve ' + result.updatedCount +
          ' mevcut kayda dosya kaynağı/notu kaydedildi. Portala veya motora aktarılmadı.' :
        quick ? 'Kavram veri setine kaydedildi · ' + quickInput.source.verse :
        operation === 'archive' ? 'Kavram arşivlendi; geçmişi korunuyor.' :
        operation === 'restore' ? 'Kavram geri getirildi; geçmişi korunuyor.' :
        'Kavram çalışma veri setine kaydedildi. Portala veya motora aktarılmadı.', 'success');
    } catch (error) {
      if (sameSession(captured) && activeOperation === operationId) {
        needsRefresh = true;
        report(error.message + (quick
          ? ' Metin değişmedi. Kavramları yenileyip seçimi yeniden sağ tıkla aktarın.'
          : ' Girdi korunuyor. Tekrar kaydetmeden önce Kavramları yenile düğmesini kullanın.'), 'error');
      }
    } finally {
      if (activeOperation === operationId) {
        activeOperation = null; saving = false; setBusy(false); syncAuth();
      }
    }
  }
  function download() {
    if (!authorized() || !doc || saving || loading || needsRefresh) return;
    assertConceptHistory(doc, context().corpus);
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2) + '\n'],
      { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'KAVRAMLAR_CALISMA_' + new Date().toLocaleDateString('sv-SE',
      { timeZone: 'Europe/Istanbul' }) + '.json';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function onLogout() {
    epoch++; readSequence++; wasAuthorized = false;
    const release = activeOperation !== null;
    activeOperation = null; saving = false; loading = false;
    doc = null; sha = ''; needsRefresh = false;
    pendingSelection = null; editorSource = null;
    clearImport();
    for (const id of ['concepts-text', 'concepts-source', 'concepts-note', 'concepts-filter']) node(id).value = '';
    node('concepts-context-menu').hidden = true;
    node('concepts-list').replaceChildren(); recordButtons = [];
    node('concepts-count').textContent = 'Kayıtlar yüklenmedi.';
    message('Kavramlar için yönetici girişi bekleniyor.');
    quickMessage('');
    if (release) setBusy(false);
    syncAuth();
  }
  async function onAuthorized() {
    epoch++; readSequence++;
    const release = activeOperation !== null;
    activeOperation = null; saving = false; loading = false;
    doc = null; sha = ''; needsRefresh = true;
    clearImport();
    if (release) setBusy(false);
    return refresh();
  }

  node('main-arabic').addEventListener('contextmenu', openContextMenu);
  node('concepts-transfer').addEventListener('mousedown', event => {
    if (event.button === 0) event.preventDefault();
  });
  node('concepts-transfer').addEventListener('click', transferSelection);
  document.addEventListener('mousedown', event => {
    if (!node('concepts-context-menu').hidden && !node('concepts-context-menu').contains(event.target)) closeContextMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeContextMenu();
  });
  node('concepts-text').addEventListener('paste', () => {
    // Doğal Ctrl+V aynen sürer; açık ana âyet veya eski seçim kaynak atanmaz.
    clearSource(); updateSourceNote();
  });
  node('concepts-text').addEventListener('input', () => {
    clearSource(); syncAuth();
  });
  node('concepts-source').addEventListener('input', () => {
    editorSource = null; syncAuth();
  });
  node('concepts-save').addEventListener('click', () => mutate('add'));
  node('concepts-refresh').addEventListener('click', refresh);
  node('concepts-file-add').addEventListener('click', () => {
    if (!authorized() || !doc || !sha || saving || loading || readingFile || needsRefresh || context().busy) return;
    clearImport(); syncAuth(); node('concepts-file').click();
  });
  node('concepts-file').addEventListener('change', previewFile);
  node('concepts-import-confirm').addEventListener('click', () => mutate('import'));
  node('concepts-import-cancel').addEventListener('click', () => {
    if (saving) return;
    clearImport(); syncAuth(); importMessage('Dosya aktarımı iptal edildi. Hiçbir kavram kaydedilmedi.');
  });
  node('concepts-export').addEventListener('click', () => {
    try { download(); } catch (error) { message(error.message, 'error'); }
  });
  node('concepts-filter').addEventListener('input', renderRecords);
  node('concepts-status-filter').addEventListener('change', renderRecords);
  node('concepts-target').textContent =
    'Ayrı çalışma kaydı · ' + CONCEPTS_BRANCH + ' / ' + CONCEPTS_PATH +
    ' · Portal ve motor bu dosyayı okumaz.';
  message('Kavramlar için yönetici girişi bekleniyor.');
  syncAuth();
  return Object.freeze({ available: true, onAuthorized, refresh, onLogout, syncAuth });
}
