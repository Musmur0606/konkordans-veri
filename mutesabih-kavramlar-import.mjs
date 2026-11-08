// Dosyadan kavram içe aktarma: yalnız önizleme ve kopya üzerinde eklemeli kayıt.
// Dosyanın dış boşlukları kırpılır; Arapça harfler, harekeler ve iç boşluklar
// değiştirilmez. Kaynak âyet tahmin edilmez; dosya izi ayrı notta tutulur.
import {addConcept, conceptSearchKey, assertConceptHistory} from './mutesabih-kavramlar-core.mjs?v=hasenat-3';

export const MAX_IMPORT_BYTES = 1048576;
export const MAX_IMPORT_ROWS = 200;

const BAD_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const BAD_FILENAME = /[\u0000-\u001F\u007F-\u009F/\\<>:"|?*\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const HASH_PLACEHOLDER = '0'.repeat(64);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function fail(message) { throw new Error(message); }
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && own(Object.getOwnPropertyDescriptor(value, key), 'value'));
}
function list(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === value.length + 1 && keys.every(key => typeof key === 'string' && (key === 'length' || /^(0|[1-9]\d*)$/u.test(key)) && own(Object.getOwnPropertyDescriptor(value,key),'value'));
}
function fields(value, required, optional, label) {
  if (!plain(value) || required.some(key => !own(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail(`${label}: alanlar veya veri türü geçersiz.`);
}
function wellFormed(text) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return false;
      i += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) return false;
  }
  return true;
}
function fileInfo(fileName) {
  if (typeof fileName !== 'string' || !fileName || fileName.length > 255 || fileName !== fileName.trim() || BAD_FILENAME.test(fileName) || !wellFormed(fileName)) fail('Dosya adı geçersiz; yalnız yolu içermeyen, en çok 255 karakterlik dosya adı kullanılabilir.');
  const match = fileName.match(/^(.+)\.(txt|csv|json|docx|pdf)$/iu);
  if (!match || /^\.+$/u.test(match[1])) fail('Yalnız .txt, .csv, .json, .docx veya .pdf uzantılı kavram dosyaları alınabilir.');
  return {fileName,format:match[2].toLowerCase()};
}
function location(format, position) { return `${format === 'json' ? 'JSON sıra' : format.toUpperCase() + ' satır'} ${position}`; }
function noteText(value, label) {
  if (typeof value !== 'string' || value.length > 4000 || BAD_CONTROL.test(value) || !wellFormed(value)) fail(`${label}: not metni geçersiz veya 4000 karakterden uzun.`);
  return value.trim();
}
function arabicText(value, label) {
  if (typeof value !== 'string' || !wellFormed(value)) fail(`${label}: Arapça kavram metin türünde olmalı.`);
  const trimmed = value.trim();
  try { conceptSearchKey(trimmed); }
  catch (error) { fail(`${label}: ${error.message}`); }
  return trimmed;
}
function importNote(fileName, format, entry, hash) {
  const lines = [
    'Dosyadan içe aktarma',
    `Dosya: ${fileName}`,
    `SHA-256: ${hash}`,
    `${format === 'json' ? 'Sıralar' : 'Satırlar'}: ${entry.positions.join(', ')}`
  ];
  if (entry.notes.length) lines.push('Dosya notları:', ...entry.notes.map((note, index) => `${index + 1}. ${note}`));
  const note = lines.join('\n');
  if (note.length > 4000) fail(`${location(format, entry.positions[0])}: dosya izi ve biriken notlar 4000 karakterlik kayıt notu sınırını aşıyor; notlar kısaltılmalı.`);
  return note;
}

function csvRecords(text, delimiter, headerOnly = false) {
  const records = [];
  let cells = [], field = '', state = 'start', nonblank = false;
  let line = 1, startLine = 1;
  function finishField() { cells.push(field); field = ''; state = 'start'; }
  function finishRecord() {
    finishField();
    if (nonblank) {
      records.push({cells,position:startLine});
      if (!headerOnly && records.length > MAX_IMPORT_ROWS + 1) fail(`CSV satır ${startLine}: bir dosyada en çok ${MAX_IMPORT_ROWS} veri satırı olabilir.`);
    }
    cells = []; nonblank = false;
    return headerOnly && records.length > 0;
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\r' || ch === '\n') {
      const newline = ch === '\r' && text[i + 1] === '\n' ? '\r\n' : ch;
      if (newline.length === 2) i += 1;
      if (state === 'quoted') field += newline;
      else if (finishRecord()) return records;
      line += 1;
      if (state !== 'quoted') startLine = line;
      continue;
    }
    if (!/\s/u.test(ch)) nonblank = true;
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else state = 'closed';
      } else field += ch;
    } else if (state === 'closed') {
      if (ch === delimiter) finishField();
      else if (ch !== ' ' && ch !== '\t') fail(`CSV satır ${line}: kapanan tırnaktan sonra yalnız ayraç veya satır sonu gelebilir.`);
    } else if (ch === delimiter) finishField();
    else if (ch === '"') {
      if (state !== 'start') fail(`CSV satır ${line}: tırnaklı hücre doğrudan tırnakla başlamalı; iç tırnaklar çift yazılmalı.`);
      state = 'quoted';
    } else { field += ch; state = 'unquoted'; }
  }
  if (state === 'quoted') fail(`CSV satır ${startLine}: tırnaklı hücre kapatılmamış.`);
  finishRecord();
  return records;
}
function csvRows(text) {
  let delimiter = null;
  const firstLine = text.split(/\r\n|\r|\n/u).findIndex(line => line.trim()) + 1 || 1;
  for (const candidate of [',',';']) {
    try {
      const header = csvRecords(text, candidate, true)[0];
      if (header && header.cells.length === 2 && header.cells.map(cell => cell.trim().toLowerCase()).join('|') === 'kavram|not') { delimiter = candidate; break; }
    } catch { /* Diğer izinli ayraç denenir; hiçbir içerik çalıştırılmaz. */ }
  }
  if (!delimiter) fail(`CSV satır ${firstLine}: başlık kavram,not veya kavram;not olmalı; başka sütun alınmaz.`);
  return csvRecords(text, delimiter).slice(1).map(row => {
    if (row.cells.length !== 2) fail(`CSV satır ${row.position}: tam iki sütun (kavram ve not) gerekli.`);
    return {value:row.cells[0],note:row.cells[1],position:row.position};
  });
}
function jsonRows(text) {
  let input;
  try { input = JSON.parse(text); }
  catch { fail('JSON sıra 1: dosya geçerli JSON değil; tırnak, virgül ve köşeli parantezler kontrol edilmeli.'); }
  if (!Array.isArray(input)) {
    if (plain(input) && ['schema','records','events','publication','overrides'].some(key => own(input,key))) fail('JSON sıra 1: tam çalışma JSON geçmişi içe alınamaz; mevcut veri setinin üzerine yazılmaz. Yalnız kavram dizisi kullanılabilir.');
    fail('JSON sıra 1: kök değer kelime dizisi veya arabic_text/not nesneleri dizisi olmalı.');
  }
  if (input.length > MAX_IMPORT_ROWS) fail(`JSON sıra ${MAX_IMPORT_ROWS + 1}: bir dosyada en çok ${MAX_IMPORT_ROWS} kayıt olabilir.`);
  const kind = typeof input[0] === 'string' ? 'string' : 'object';
  return input.map((item,index) => {
    const label = location('json',index + 1);
    if (kind === 'string') {
      if (typeof item !== 'string') fail(`${label}: metin ve nesne türleri aynı dizide karıştırılamaz.`);
      return {value:item,note:'',position:index + 1};
    }
    fields(item,['arabic_text'],['note'],label);
    return {value:item.arabic_text,note:own(item,'note') ? item.note : '',position:index + 1};
  });
}

export function parseConceptImport(input) {
  fields(input,['fileName'],['text','rows'],'Dosya girişi');
  const {fileName,format} = fileInfo(input.fileName);
  const binary = format === 'docx' || format === 'pdf';
  if (binary !== own(input,'rows') || binary === own(input,'text')) fail('Dosya türüne uygun metin veya çıkarılmış belge satırları gerekli.');
  let rows;
  if (binary) {
    if (!list(input.rows) || input.rows.length > MAX_IMPORT_ROWS ||
        new TextEncoder().encode(JSON.stringify(input.rows)).byteLength > MAX_IMPORT_BYTES) {
      fail('Word/PDF dosyasından en çok 200 kavram satırı ve 1 MiB çıkarılmış metin alınabilir.');
    }
    let previous = 0;
    rows = input.rows.map((row,index) => {
      fields(row,['value','note','position'],[],`${format.toUpperCase()} kayıt ${index + 1}`);
      if (!Number.isSafeInteger(row.position) || row.position <= previous ||
          row.position > MAX_IMPORT_BYTES || typeof row.value !== 'string' || typeof row.note !== 'string') {
        fail(`${format.toUpperCase()} kayıt ${index + 1}: satır sırası veya veri türü geçersiz.`);
      }
      previous = row.position;
      return {value:row.value,note:row.note,position:row.position};
    });
  } else {
    if (typeof input.text !== 'string' || !wellFormed(input.text)) fail('Dosya içeriği geçerli UTF-8 metni olarak okunmalı.');
    if (new TextEncoder().encode(input.text).byteLength > MAX_IMPORT_BYTES) fail(`Dosya ${MAX_IMPORT_BYTES} baytlık (1 MiB) sınırı aşıyor.`);
    // UTF-8 BOM yalnız okuma sırasında ayrılır; dosya SHA'sı özgün baytlar üzerindendir.
    const text = input.text.startsWith('\uFEFF') ? input.text.slice(1) : input.text;
    if (format === 'txt') rows = text.split(/\r\n|\r|\n/u).map((value,index) => ({value,note:'',position:index + 1})).filter(row => row.value.trim());
    else if (format === 'csv') rows = csvRows(text);
    else rows = jsonRows(text);
  }
  if (!rows.length) fail(`${format.toUpperCase()} ${format === 'json' ? 'sıra' : 'satır'} 1: dosyada alınabilecek kavram yok.`);
  if (rows.length > MAX_IMPORT_ROWS) fail(`${location(format, rows[MAX_IMPORT_ROWS].position)}: bir dosyada en çok ${MAX_IMPORT_ROWS} veri satırı olabilir.`);
  const byText = new Map();
  for (const row of rows) {
    const label = location(format,row.position);
    const value = arabicText(row.value,label);
    const note = noteText(row.note,label);
    let entry = byText.get(value);
    if (!entry) { entry = {arabicText:value,positions:[],notes:[]}; byText.set(value,entry); }
    entry.positions.push(row.position);
    if (note && !entry.notes.includes(note)) entry.notes.push(note);
  }
  const entries = [...byText.values()];
  for (const entry of entries) importNote(fileName,format,entry,HASH_PLACEHOLDER);
  return {fileName,format,totalRows:rows.length,duplicateRows:rows.length - entries.length,entries};
}

function validateParsed(parsed) {
  fields(parsed,['fileName','format','totalRows','duplicateRows','entries'],[],'İçe aktarma önizlemesi');
  const info = fileInfo(parsed.fileName);
  if (parsed.format !== info.format || !Number.isSafeInteger(parsed.totalRows) || parsed.totalRows < 1 || parsed.totalRows > MAX_IMPORT_ROWS || !Number.isSafeInteger(parsed.duplicateRows) || !list(parsed.entries) || !parsed.entries.length || parsed.entries.length > parsed.totalRows) fail('İçe aktarma önizlemesinin biçimi veya satır sayıları geçersiz.');
  const texts = new Set(), positions = new Set();
  let firstPosition = 0;
  for (const entry of parsed.entries) {
    fields(entry,['arabicText','positions','notes'],[],'Önizleme kaydı');
    if (!list(entry.positions) || !entry.positions.length || entry.positions.length > parsed.totalRows || !list(entry.notes) || entry.notes.length > entry.positions.length) fail('Önizleme kaydı: konum veya not listesi geçersiz.');
    const label = location(parsed.format,entry.positions[0]);
    if (arabicText(entry.arabicText,label) !== entry.arabicText || texts.has(entry.arabicText)) fail(`${label}: önizleme metni standart dışı veya yinelenmiş.`);
    texts.add(entry.arabicText);
    let previous = 0;
    for (const position of entry.positions) {
      if (!Number.isSafeInteger(position) || position <= previous || position > MAX_IMPORT_BYTES + 1 || positions.has(position) || (parsed.format === 'json' && position > parsed.totalRows) || (parsed.format === 'csv' && position < 2)) fail(`${label}: önizleme satır/sıra konumları geçersiz.`);
      positions.add(position); previous = position;
    }
    if (entry.positions[0] <= firstPosition) fail(`${label}: önizleme kayıt sırası değiştirilmiş.`);
    firstPosition = entry.positions[0];
    if (parsed.format === 'txt' && entry.notes.length) fail(`${label}: düz metin önizlemesine dışarıdan not eklenemez.`);
    const notes = new Set();
    for (const note of entry.notes) {
      if (!note || noteText(note,label) !== note || notes.has(note)) fail(`${label}: önizleme notları geçersiz veya yinelenmiş.`);
      notes.add(note);
    }
    importNote(parsed.fileName,parsed.format,entry,HASH_PLACEHOLDER);
  }
  if (positions.size !== parsed.totalRows || parsed.duplicateRows !== parsed.totalRows - parsed.entries.length) fail('Önizlemedeki toplam ve yinelenen satır sayıları uyuşmuyor.');
}
function actorText(actor) {
  if (typeof actor !== 'string' || !actor.trim() || actor.length > 200 || BAD_CONTROL.test(actor) || !wellFormed(actor)) fail('İçe aktaran kullanıcı adı geçersiz.');
  return actor.trim();
}
function importClock(clock) {
  const at = typeof clock === 'function' ? clock() : (clock === undefined ? new Date().toISOString() : clock);
  if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(at) || !Number.isFinite(new Date(at).getTime()) || new Date(at).toISOString() !== at) fail('İçe aktarma tarihi geçerli, milisaniyeli ISO UTC biçiminde olmalı.');
  return at;
}

export function buildConceptImport(doc, parsed, options) {
  fields(options,['sha256','actor'],['corpus','clock'],'İçe aktarma seçenekleri');
  if (typeof options.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/u.test(options.sha256)) fail('Dosyanın SHA-256 değeri tam 64 onaltılık karakter olmalı.');
  const hash = options.sha256.toLowerCase(), actor = actorText(options.actor), at = importClock(options.clock);
  validateParsed(parsed);
  if (!plain(doc)) fail('Mevcut kavram belgesinin veri türü geçersiz.');
  assertConceptHistory(doc,options.corpus);
  if (at < doc.updated_at) fail('İçe aktarma tarihi son kavram işleminden eski olamaz.');
  let next = JSON.parse(JSON.stringify(doc));
  const rows = [];
  let newCount = 0, updatedCount = 0, unchangedCount = 0, archivedCount = 0;
  // Geçerli bütün girişler aynı kopyada uygulanır; hata halinde hiçbir sonuç
  // dönmez. Çağıran, yalnız tamamlanmış sonucu tek SHA-korumalı yazmayla kaydeder.
  for (const entry of parsed.entries) {
    const existed = next.records.some(record => record.arabic_text === entry.arabicText);
    const note = importNote(parsed.fileName,parsed.format,entry,hash);
    const out = addConcept(next,{arabicText:entry.arabicText,note,source:null},actor,options.corpus,at);
    next = out.doc;
    const action = out.changed ? (existed ? 'update' : 'new') : 'unchanged';
    if (action === 'new') newCount += 1;
    else if (action === 'update') updatedCount += 1;
    else unchangedCount += 1;
    const archived = out.record.status === 'archived';
    if (archived) archivedCount += 1;
    rows.push({arabicText:entry.arabicText,action,archived});
  }
  assertConceptHistory(next,options.corpus);
  return {doc:next,changed:newCount + updatedCount > 0,newCount,updatedCount,unchangedCount,archivedCount,rows};
}
