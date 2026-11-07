// Portal dışında tutulan 2/3/4 çalışması. Canlı çekirdeğin kapsam kilidi korunur.
import { parseVerses, normalizeMain, canEditMain, cleanState, dayInTurkey, assertHistory } from './mutesabih-core.mjs?v=3';

export const DRAFT234_PATH = 'data/mutesabih-calisma-234.json';
export const PUBLIC_HISTORY_PATH = 'data/mutesabih-degisiklikler.json';
export const DRAFT234_BRANCH = 'calisma-234';
export const PUBLIC_HISTORY_BRANCH = 'main';
const SCHEMA = 'ayatulkuran.draft234.v1';
const OPERATIONS = new Set(['add','remove','confirm','review','rollback_event','rollback_day']);
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a,b) => JSON.stringify(cleanState(a)) === JSON.stringify(cleanState(b));
const state = (doc,main) => cleanState(doc.overrides[main]);

export function isDraftMain(input) {
  return [2,3,4].includes(Number(normalizeMain(input).split('.')[0]));
}

export function historyPathForMain(input) {
  return isDraftMain(input) ? DRAFT234_PATH : PUBLIC_HISTORY_PATH;
}

export function storageForMain(input) {
  const draft=isDraftMain(input);
  return {path:draft?DRAFT234_PATH:PUBLIC_HISTORY_PATH,
    branch:draft?DRAFT234_BRANCH:PUBLIC_HISTORY_BRANCH,draft};
}

function validClock(clock) {
  if (typeof clock !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(clock) || !Number.isFinite(Date.parse(clock))) {
    throw Error('İşlem tarihi geçerli bir ISO tarih-saat olmalı.');
  }
  return clock;
}

export function emptyDraftHistory(clock=new Date().toISOString()) {
  validClock(clock);
  return {
    schema:SCHEMA,
    scope:[2,3,4],
    publication:{status:'not_published',automatic:false},
    created_at:clock,
    updated_at:clock,
    overrides:{},
    events:[],
  };
}

function storedRef(raw) {
  if (typeof raw !== 'string' || normalizeMain(raw) !== raw) throw Error('Kayıtlı âyet kimliği geçersiz: '+String(raw));
  return raw;
}

function storedMain(raw,draft) {
  const main=storedRef(raw);
  if (isDraftMain(main)!==draft) throw Error('Ana âyet yanlış kayıt yerinde: '+main);
  return main;
}

function checkState(value,main) {
  if (!object(value) || !Array.isArray(value.added) || !Array.isArray(value.removed) || ![null,'review','confirmed'].includes(value.status)) {
    throw Error(main+' taslak durumu beklenen biçimde değil.');
  }
  // Taslağın başlangıç listesi boştur; motor listesi ve ona ait çıkarma katmanı yoktur.
  if (value.removed.length) throw Error('Taslak veri motor/başlangıç listesinden çıkarma kaydı içeremez.');
  const seen=new Set();
  for (const raw of value.added) {
    const ref=storedRef(raw);
    if (ref===main || seen.has(ref)) throw Error(main+' için tekrar veya kendine bağlantı var.');
    seen.add(ref);
  }
  return value;
}

function storeState(doc,main,value) {
  const next=cleanState(value);
  if (!next.added.length && !next.removed.length && !next.status) delete doc.overrides[main];
  else doc.overrides[main]=next;
}

export function assertDraftHistory(doc) {
  if (!object(doc) || doc.schema!==SCHEMA || !object(doc.overrides) || !Array.isArray(doc.events)) {
    throw Error('2/3/4 çalışma dosyası beklenen biçimde değil. Canlı dosyaya geçiş yapılmadı.');
  }
  if (!Array.isArray(doc.scope) || doc.scope.length!==3 || doc.scope.some((s,i)=>s!==[2,3,4][i])) {
    throw Error('Taslak ana sûre kapsamı yalnız 2, 3 ve 4 olmalı.');
  }
  if (!object(doc.publication) || Object.keys(doc.publication).sort().join(',')!=='automatic,status' ||
      doc.publication.status!=='not_published' || doc.publication.automatic!==false) {
    throw Error('Taslak yayın kilidi değiştirilemez; otomatik yayın yoktur.');
  }
  validClock(doc.created_at);validClock(doc.updated_at);
  for (const [main,value] of Object.entries(doc.overrides)) checkState(value,storedMain(main,true));
  const replay={overrides:{}}, ids=new Set();
  for (const event of doc.events) {
    if (!object(event) || typeof event.id!=='string' || !event.id || ids.has(event.id) ||
        event.scope!=='draft234' || event.source!=='kullanici_calismasi' || !OPERATIONS.has(event.action) ||
        typeof event.actor!=='string' || !event.actor.trim() || typeof event.note!=='string' ||
        !Array.isArray(event.refs) || !Array.isArray(event.changes) || !event.changes.length) {
      throw Error('Taslak işlem geçmişi beklenen biçimde değil.');
    }
    validClock(event.at);
    if (event.day_tr!==dayInTurkey(event.at)) throw Error('Taslak işlem günü tarih ile uyuşmuyor.');
    for (const ref of event.refs) storedRef(ref);
    if (event.action.startsWith('rollback_')) {
      if (!Array.isArray(event.undo_of) || !event.undo_of.length || new Set(event.undo_of).size!==event.undo_of.length ||
          event.undo_of.some(id=>typeof id!=='string'||!ids.has(id))) throw Error('Geri alma kaynağı bu taslak geçmişinde bulunamadı.');
    } else if (Object.hasOwn(event,'undo_of')) throw Error('Normal taslak işlemi geri alma bilgisi içeremez.');
    const mains=new Set();
    for (const change of event.changes) {
      if (!object(change)) throw Error('Taslak değişiklik kaydı geçersiz.');
      const main=storedMain(change.main,true);
      if (mains.has(main)) throw Error('Aynı işlemde bir ana âyet iki kez değiştirilemez.');
      mains.add(main);
      checkState(change.before,main);checkState(change.after,main);
      if (!same(state(replay,main),change.before)) throw Error(main+' geçmiş zincirinin önceki durumu uyuşmuyor.');
      storeState(replay,main,change.after);
    }
    ids.add(event.id);
  }
  const allMains=new Set([...Object.keys(doc.overrides),...Object.keys(replay.overrides)]);
  for (const main of allMains) {
    if (!same(doc.overrides[main],replay.overrides[main])) throw Error(main+' güncel taslağı ile işlem geçmişi uyuşmuyor.');
  }
  return doc;
}

export function assertRouteDocument(path,doc) {
  if (path===DRAFT234_PATH) return assertDraftHistory(doc);
  if (path!==PUBLIC_HISTORY_PATH) throw Error('Tanımsız kayıt yolu; kayıt yapılmadı.');
  assertHistory(doc);
  if (Object.hasOwn(doc,'scope') || Object.hasOwn(doc,'publication')) throw Error('Taslak üst bilgisi canlı değişiklik dosyasına yazılamaz.');
  if (!object(doc.overrides)) throw Error('Canlı değişiklik sözlüğü geçersiz.');
  for (const main of Object.keys(doc.overrides)) storedMain(main,false);
  for (const event of doc.events) {
    if (!object(event) || !Array.isArray(event.changes) || event.scope==='draft234') throw Error('Canlı işlem kapsamı geçersiz.');
    for (const change of event.changes) {
      if (!object(change)) throw Error('Canlı işlem değişikliği geçersiz.');
      storedMain(change.main,false);
    }
  }
  return doc;
}

export function assertStorageTarget(target,doc) {
  if (!object(target)) throw Error('Kayıt hedefi bulunamadı.');
  const draft=target.path===DRAFT234_PATH;
  if (target.path!==DRAFT234_PATH && target.path!==PUBLIC_HISTORY_PATH) throw Error('Tanımsız kayıt yolu; kayıt yapılmadı.');
  if (target.branch!==(draft?DRAFT234_BRANCH:PUBLIC_HISTORY_BRANCH) ||
      (Object.hasOwn(target,'draft') && target.draft!==draft)) {
    throw Error('Kayıt yolu ve dalı uyuşmuyor. Taslak portal dalına yazılamaz.');
  }
  return assertRouteDocument(target.path,doc);
}

export function draftBase(input,corpus) {
  const main=normalizeMain(input);
  if (!isDraftMain(main)) throw Error('Çalışma veri seti yalnız 2, 3 ve 4. sûrelerin ana âyetleri içindir.');
  const verse=corpus?.verses?.[main.replace('.',':')];
  if (!verse) throw Error(main+' için Kur’an metni bulunamadı.');
  // Bilerek verse.r okunmaz. Motor sonuçları yeni kullanıcı çalışmasına kopyalanmaz.
  return {
    main,
    heading:(verse.sa||main.split('.')[0]+'. Sûre')+' Sûresi - Ayet '+main.split('.')[1],
    status:'draft234',
    links:[],
    source:{file:DRAFT234_PATH,branch:DRAFT234_BRANCH,page:'—',paragraph:'—'},
  };
}

function eventMeta(action,actor,note,clock) {
  validClock(clock);
  if (typeof actor!=='string' || !actor.trim()) throw Error('Yönetici kimliği gerekli.');
  return {id:crypto.randomUUID(),at:clock,day_tr:dayInTurkey(clock),actor,action,
    scope:'draft234',source:'kullanici_calismasi',note:String(note||'').trim().slice(0,500)};
}

export function applyDraftEdit(doc,base,operation,refs,note,actor,clock=new Date().toISOString()) {
  assertDraftHistory(doc);
  if (!['add','remove','confirm','review'].includes(operation)) throw Error('Geçersiz taslak işlemi.');
  if (!base || !isDraftMain(base.main) || base.main!==normalizeMain(base.main) || base.status!=='draft234' ||
      !Array.isArray(base.links) || base.links.length || base.source?.file!==DRAFT234_PATH) {
    throw Error('Taslak ana âyeti veya boş başlangıç listesi geçersiz.');
  }
  const main=base.main, before=state(doc,main), after=cleanState(before);
  const chosen=operation==='add'||operation==='remove'?parseVerses(refs):[];
  if (chosen.includes(main)) throw Error('Ana âyet kendisiyle ilişkilendirilemez.');
  const changed=[];
  for (const ref of chosen) {
    const exists=after.added.includes(ref);
    if (operation==='add' && !exists) {after.added.push(ref);changed.push(ref);}
    if (operation==='remove' && exists) {after.added=after.added.filter(key=>key!==ref);changed.push(ref);}
  }
  if (changed.length) after.status='review';
  if (operation==='confirm') after.status='confirmed';
  if (operation==='review') after.status='review';
  if (same(before,after)) return {doc,event:null,changed:[]};
  const event={...eventMeta(operation,actor,note,clock),refs:changed,changes:[]};
  const next=clone(doc);
  storeState(next,main,after);
  event.changes.push({main,before,after:state(next,main)});
  next.events.push(event);next.updated_at=clock;
  assertDraftHistory(next);
  return {doc:next,event,changed};
}

function undoDraftEvents(doc,events,action,note,actor,clock) {
  assertDraftHistory(doc);
  const next=clone(doc), old=new Map();
  for (const event of [...events].reverse()) {
    for (const change of [...event.changes].reverse()) {
      const main=change.main,current=state(next,main);
      if (!same(current,change.after)) throw Error(main+' âyeti daha sonra değiştirilmiş. Önce kayıtları kontrol edin. Geri alma yapılmadı.');
      if (!old.has(main)) old.set(main,current);
      storeState(next,main,change.before);
    }
  }
  const changes=[...old].map(([main,before])=>({main,before,after:state(next,main)})).filter(c=>!same(c.before,c.after));
  if (!changes.length) throw Error('Geri alınacak bir değişiklik kalmadı.');
  const event={...eventMeta(action,actor,note,clock),refs:[],undo_of:events.map(e=>e.id),changes};
  next.events.push(event);next.updated_at=clock;
  assertDraftHistory(next);
  return {doc:next,event,changed:changes.map(c=>c.main)};
}

export function undoDraftOne(doc,id,actor,clock=new Date().toISOString()) {
  assertDraftHistory(doc);
  const event=doc.events.find(e=>e.id===id);
  if (!event) throw Error('Bu taslak veri setinde işlem bulunamadı.');
  if (doc.events.some(e=>e.undo_of?.includes(id))) throw Error('Bu işlem zaten geri alınmış.');
  return undoDraftEvents(doc,[event],'rollback_event','Taslak işlemi geri alındı: '+id,actor,clock);
}

export function undoDraftDay(doc,day,actor,clock=new Date().toISOString()) {
  assertDraftHistory(doc);
  if (typeof day!=='string' || !/^\d{4}-\d\d-\d\d$/.test(day) || !Number.isFinite(Date.parse(day+'T00:00:00Z'))) throw Error('Geçerli bir gün seçiniz.');
  if (new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day) throw Error('Geçerli bir gün seçiniz.');
  const events=doc.events.filter(e=>dayInTurkey(e.at)===day);
  if (!events.length) throw Error('Seçilen tarihte taslak işlemi bulunamadı.');
  return undoDraftEvents(doc,events,'rollback_day',day+' tarihindeki '+events.length+' taslak işlemi geri alındı.',actor,clock);
}

// Canlı kodun 2/3/4 kilidi bu modülle açılmaz. Bu kontrol gelecekteki yanlış
// entegrasyonu görünür kılar; yalnız ana sûreye göre hedef seçimi kullanılır.
if ([2,3,4].some(s=>canEditMain(s+'.1'))) throw Error('Canlı 2/3/4 koruması beklenen durumda değil.');
