// Kavramlar: yalnız çalışma dalına ait, portala yayımlanmayan saf veri çekirdeği.
// Orijinal Arapça metin kimliktir; harekesiz anahtar otomatik birleştirme yapmaz.
export const CONCEPTS_SCHEMA = 'ayatulkuran.concepts-draft.v1';
export const CONCEPTS_BRANCH = 'calisma-kavramlar';
export const CONCEPTS_PATH = 'data/kavramlar-calisma.json';

const LIMITS = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const RECORD_KEYS = ['id','arabic_text','search_key','status','sources','notes','created_at','updated_at','created_by','updated_by'];
const EVENT_KEYS = ['id','type','at','actor','record_id','note','source','before','after'];
const SOURCE_KEYS = ['verse','start','end','origin'];
const SOURCE_META_KEYS = [...SOURCE_KEYS,'added_at','added_by','event_id'];
const NOTE_KEYS = ['text','at','actor','event_id'];
const SAFE_TEXT_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const LETTER = /\p{Letter}/u;
const ARABIC = /\p{Script_Extensions=Arabic}/u;
const TEXT_CHARACTER = /[\p{Mark}\p{Number}\p{Punctuation}\p{Separator}\n\r\t\u200C\u200D]/u;

function fail(message) { throw new Error(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys, label) {
  if (!object(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(`${label}: alanlar geçersiz.`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function equal(a, b) { return stable(a) === stable(b); }
function actorText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || SAFE_TEXT_CONTROL.test(value)) fail('İşlemi yapan kullanıcı belirtilmeli.');
  return value.trim();
}
function noteText(value = '') {
  if (typeof value !== 'string' || value.length > 4000 || SAFE_TEXT_CONTROL.test(value)) fail('Not metni geçersiz veya çok uzun.');
  return value.trim();
}
function timestamp(value, label = 'Tarih') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(`${label}: milisaniyeli ISO UTC biçimi gerekli.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail(`${label}: geçersiz tarih.`);
  return value;
}
function now(clock) { return timestamp(typeof clock === 'function' ? clock() : (clock === undefined ? new Date().toISOString() : clock)); }
function recordId(index) { return 'kavram-' + String(index).padStart(8, '0'); }
function eventId(index) { return 'kavram-olay-' + String(index).padStart(8, '0'); }

export function normalizeConceptVerse(value) {
  if (typeof value !== 'string') fail('Kaynak sûre ve âyeti metin olarak belirtilmeli.');
  const match = value.trim().match(/^(\d{1,3})[.:](\d{1,3})$/);
  if (!match) fail('Kaynak sûre ve âyeti 2.1 biçiminde belirtilmeli.');
  const surah = Number(match[1]), verse = Number(match[2]);
  if (surah < 1 || surah > 114 || verse < 1 || verse > LIMITS[surah]) fail('Kaynak sûre veya âyet numarası gerçek Kur’an sınırları dışında.');
  return `${surah}.${verse}`;
}

export function conceptSearchKey(text) {
  validateArabic(text);
  return text.replace(/[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/gu, '').replace(/\s+/gu, ' ').trim();
}

function validateArabic(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || SAFE_TEXT_CONTROL.test(value)) fail('Arapça kelime veya kelime grubu boş, geçersiz veya çok uzun.');
  let hasArabicLetter = false;
  for (const ch of value) {
    if (ch === '\u0640') continue;
    if (LETTER.test(ch)) {
      if (!ARABIC.test(ch)) fail('Kavram metninde Arapça dışındaki harfler bulunuyor.');
      hasArabicLetter = true;
    } else if (!ARABIC.test(ch) && !TEXT_CHARACTER.test(ch)) {
      fail('Kavram metninde desteklenmeyen karakter bulunuyor.');
    }
  }
  if (!hasArabicLetter) fail('Kavram metni en az bir Arapça harf içermeli.');
  return value;
}

function sourceShape(source, meta = false) {
  exactKeys(source, sourceKeys(source, meta), 'Kaynak');
  if (Object.hasOwn(source, 'text_field') && source.text_field !== 'arh') fail('Kaynak metin alanı geçersiz.');
  if (normalizeConceptVerse(source.verse) !== source.verse) fail('Kaynak âyet numarası standart noktalı biçimde olmalı.');
  if (!Number.isSafeInteger(source.start) || !Number.isSafeInteger(source.end) || source.start < 0 || source.end <= source.start) fail('Kaynak seçim sınırları geçersiz.');
  if (!['admin_selection','manual'].includes(source.origin)) fail('Kaynak giriş yöntemi geçersiz.');
  if (meta) {
    timestamp(source.added_at);
    if (actorText(source.added_by) !== source.added_by || typeof source.event_id !== 'string' || !source.event_id) fail('Kaynak işlem bilgisi geçersiz.');
  }
  return source;
}
// Önceki kaynaklar alan eklenmeden ar metnini işaretlemeye devam eder.
// Yeni Hasenat seçimleri kendi ham metin/konumlarını açıkça tanımlar.
function sourceKeys(source, meta = false) {
  const keys = meta ? SOURCE_META_KEYS : SOURCE_KEYS;
  return object(source) && Object.hasOwn(source, 'text_field') ? [...keys, 'text_field'] : keys;
}
function bareSource(source) {
  return {verse:source.verse,start:source.start,end:source.end,origin:source.origin,
    ...(source.text_field === 'arh' ? {text_field:'arh'} : {})};
}
function corpusArabic(corpus, verse, field = 'ar') {
  const item = corpus?.verses?.[verse.replace('.', ':')];
  if (!item || typeof item[field] !== 'string' || !item[field].length) fail('Kaynak âyetin asıl Arapça metni bulunamadı; kaynak atanmadı.');
  return item[field];
}
function verifySlice(source, arabicText, corpus) {
  const original = corpusArabic(corpus, source.verse, source.text_field || 'ar');
  if (source.end > original.length || original.slice(source.start, source.end) !== arabicText) fail('Seçilen metin, kaynak âyetin belirtilen Arapça dilimiyle birebir eşleşmiyor.');
}
function inputSource(source, arabicText, corpus) {
  if (source === undefined || source === null) return null;
  exactKeys(source, sourceKeys(source), 'Kaynak');
  const result = {...source, verse:normalizeConceptVerse(source.verse)};
  sourceShape(result);
  verifySlice(result, arabicText, corpus);
  return result;
}
function sourceExists(record, source) { return source !== null && record.sources.some(item => equal(bareSource(item), source)); }
function noteExists(record, note) { return !note || record.notes.some(item => item.text === note); }
function appendProvenance(record, source, note, actor, at, id) {
  if (source && !sourceExists(record, source)) record.sources.push({...source,added_at:at,added_by:actor,event_id:id});
  if (!noteExists(record, note)) record.notes.push({text:note,at,actor,event_id:id});
}

export function emptyConceptHistory(clock) {
  const at = now(clock);
  return {schema:CONCEPTS_SCHEMA,publication:{status:'not_published',automatic:false},created_at:at,updated_at:at,records:[],events:[]};
}

function expectedAfter(before, event, newRecordIndex) {
  const {type,at,actor,id,note,source} = event;
  let result;
  if (type === 'add') {
    if (before !== null || event.record_id !== recordId(newRecordIndex)) fail('Yeni kavram kimliği veya başlangıç kaydı geçersiz.');
    const text = validateArabic(event.after?.arabic_text);
    result = {id:event.record_id,arabic_text:text,search_key:conceptSearchKey(text),status:'active',sources:[],notes:[],created_at:at,updated_at:at,created_by:actor,updated_by:actor};
  } else {
    if (!before) fail('İşlem yapılacak kavram bulunamadı.');
    result = clone(before);
    if (type === 'enrich') {
      if ((!source || sourceExists(before, source)) && noteExists(before, note)) fail('Yinelenen kayıtta yeni kaynak veya not yok.');
    } else if (type === 'archive') {
      if (source !== null || before.status !== 'active') fail('Yalnız etkin kavram arşivlenebilir.');
      result.status = 'archived';
    } else if (type === 'restore') {
      if (source !== null || before.status !== 'archived') fail('Yalnız arşivdeki kavram geri getirilebilir.');
      result.status = 'active';
    } else fail('Bilinmeyen kavram işlemi.');
    result.updated_at = at;
    result.updated_by = actor;
  }
  appendProvenance(result, source, note, actor, at, id);
  return result;
}

function validateRecord(record, corpus) {
  exactKeys(record, RECORD_KEYS, 'Kavram kaydı');
  validateArabic(record.arabic_text);
  if (record.search_key !== conceptSearchKey(record.arabic_text)) fail('Kavram arama anahtarı orijinal metinle uyuşmuyor.');
  if (!['active','archived'].includes(record.status) || !Array.isArray(record.sources) || !Array.isArray(record.notes)) fail('Kavram durumu veya kaynak/not listeleri geçersiz.');
  timestamp(record.created_at); timestamp(record.updated_at);
  if (actorText(record.created_by) !== record.created_by || actorText(record.updated_by) !== record.updated_by) fail('Kavram kullanıcı bilgisi geçersiz.');
  for (const source of record.sources) {
    sourceShape(source, true);
    if (source.end - source.start !== record.arabic_text.length) fail('Kaynak dilim uzunluğu orijinal metinle uyuşmuyor.');
    if (corpus !== undefined) verifySlice(source, record.arabic_text, corpus);
  }
  if (new Set(record.sources.map(item => stable(bareSource(item)))).size !== record.sources.length) fail('Kavramda yinelenen kaynak kaydı var.');
  for (const note of record.notes) {
    exactKeys(note, NOTE_KEYS, 'Kavram notu');
    if (!note.text || noteText(note.text) !== note.text || actorText(note.actor) !== note.actor || typeof note.event_id !== 'string' || !note.event_id) fail('Kavram not bilgisi geçersiz.');
    timestamp(note.at);
  }
  if (new Set(record.notes.map(item => item.text)).size !== record.notes.length) fail('Kavramda yinelenen not var.');
}

// Olaylar boş sicilden yeniden oynatılır. Kaynak, not veya eski kayıt silinirse
// ya da before/after zinciri değişirse belge kabul edilmez. Corpus verilirse
// kayıtlı tüm âyet dilimleri ayrıca asıl Arapça metinle yeniden doğrulanır.
export function assertConceptHistory(doc, corpus) {
  exactKeys(doc, ['schema','publication','created_at','updated_at','records','events'], 'Kavram çalışma belgesi');
  if (doc.schema !== CONCEPTS_SCHEMA) fail('Bu dosya kavram çalışma veri seti değil.');
  exactKeys(doc.publication, ['status','automatic'], 'Yayın kilidi');
  if (doc.publication.status !== 'not_published' || doc.publication.automatic !== false) fail('Kavram veri setinin portal yayın kilidi korunmalı.');
  timestamp(doc.created_at); timestamp(doc.updated_at);
  if (!Array.isArray(doc.records) || !Array.isArray(doc.events)) fail('Kavram kayıtları veya işlem geçmişi geçersiz.');
  const replay = new Map();
  const texts = new Set();
  let previousAt = doc.created_at;
  for (let i = 0; i < doc.events.length; i += 1) {
    const event = doc.events[i];
    exactKeys(event, EVENT_KEYS, 'Kavram işlemi');
    if (event.id !== eventId(i + 1)) fail('Kavram işlem sırası veya kimliği bozulmuş.');
    timestamp(event.at);
    if (event.at < previousAt) fail('Kavram işlem tarihi önceki işlemden eski olamaz.');
    previousAt = event.at;
    if (actorText(event.actor) !== event.actor || noteText(event.note) !== event.note) fail('İşlem kullanıcı veya not bilgisi geçersiz.');
    if (event.source !== null) sourceShape(event.source);
    const before = replay.has(event.record_id) ? replay.get(event.record_id) : null;
    if (!equal(event.before, before)) fail('Kavram önceki kayıt zinciri uyuşmuyor.');
    validateRecord(event.after, corpus);
    const after = expectedAfter(before, event, replay.size + 1);
    if (!equal(event.after, after)) fail('Kavram sonraki kayıt zinciri uyuşmuyor; geçmiş değiştirilemez.');
    if (event.type === 'add') {
      if (texts.has(after.arabic_text)) fail('Aynı tam Arapça metin için yinelenen kavram oluşturulamaz.');
      texts.add(after.arabic_text);
    }
    replay.set(event.record_id, after);
  }
  if (doc.updated_at !== previousAt) fail('Belge güncelleme tarihi son işlemle uyuşmuyor.');
  if (!equal(doc.records, [...replay.values()])) fail('Kavram kayıtları eklemeli geçmişin sonucuyla uyuşmuyor.');
  return doc;
}

export function assertConceptStorageTarget(target, doc, corpus) {
  if (!object(target) || target.path !== CONCEPTS_PATH || target.branch !== CONCEPTS_BRANCH) fail('Kavramlar yalnız ayrı çalışma dalındaki kendi dosyasına kaydedilebilir.');
  return assertConceptHistory(doc, corpus);
}

function prepare(doc, actor, clock) {
  assertConceptHistory(doc);
  const by = actorText(actor), at = now(clock);
  if (at < doc.updated_at) fail('Yeni işlem tarihi son kayıttan eski olamaz.');
  return {next:clone(doc),actor:by,at};
}
function result(doc, event, record, duplicate) {
  return {doc,event:event ? clone(event) : null,record:clone(record),duplicate,changed:event !== null};
}
function commit(next, type, before, source, note, actor, at, id, newText) {
  const event = {id:eventId(next.events.length + 1),type,at,actor,record_id:id,note,source,before:clone(before),after:null};
  if (type === 'add') event.after = {arabic_text:newText};
  event.after = expectedAfter(before, event, next.records.length + 1);
  if (before === null) next.records.push(clone(event.after));
  else next.records[next.records.findIndex(item => item.id === id)] = clone(event.after);
  next.events.push(event);
  next.updated_at = at;
  assertConceptHistory(next);
  return result(next, event, event.after, type === 'enrich');
}

export function addConcept(doc, input, actor, corpus, clock) {
  if (!object(input)) fail('Kavram giriş bilgisi eksik.');
  const text = validateArabic(input.arabicText);
  const note = noteText(input.note);
  const source = inputSource(input.source, text, corpus);
  const prepared = prepare(doc, actor, clock);
  const {next,at} = prepared;
  const before = next.records.find(item => item.arabic_text === text) || null;
  if (before && (!source || sourceExists(before, source)) && noteExists(before, note)) return result(next, null, before, true);
  return commit(next, before ? 'enrich' : 'add', before, source, note, prepared.actor, at, before?.id || recordId(next.records.length + 1), text);
}

function setArchived(doc, id, note, actor, clock, archived) {
  const prepared = prepare(doc, actor, clock);
  const cleanNote = noteText(note);
  const before = prepared.next.records.find(item => item.id === id);
  if (!before) fail('Kavram kimliği bulunamadı.');
  const status = archived ? 'archived' : 'active';
  if (before.status === status) return result(prepared.next, null, before, false);
  return commit(prepared.next, archived ? 'archive' : 'restore', before, null, cleanNote, prepared.actor, prepared.at, id, false);
}

export function archiveConcept(doc, recordId, note, actor, clock) {
  return setArchived(doc, recordId, note, actor, clock, true);
}

export function restoreConcept(doc, recordId, note, actor, clock) {
  return setArchived(doc, recordId, note, actor, clock, false);
}
