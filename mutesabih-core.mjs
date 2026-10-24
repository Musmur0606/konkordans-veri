// Shared, testable rules for the independent GitHub-backed editor.
// The R14 baseline is immutable; only a separate override/history JSON changes.
const LIMITS = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

export function parseVerses(input) {
  const cleaned = String(input).trim().replace(/\s*,\s*/g, ',');
  if (!cleaned || cleaned.length > 5000) throw Error('1–5.000 karakter arasında âyet ifadesi yazınız.');
  const out = [], seen = new Set();
  for (const group of cleaned.split(/\s+/)) {
    const match = /^(\d{1,3})\.(\d{1,3}(?:-\d{1,3})?(?:,\d{1,3}(?:-\d{1,3})?)*)$/.exec(group);
    if (!match) throw Error('Anlaşılamayan ifade: ' + group + '. Örnek: 2.1,3,5,67  2.5-15  5.6 8.15');
    const s = Number(match[1]);
    if (!LIMITS[s]) throw Error('Sûre 1–114 arasında olmalı: ' + s);
    for (const part of match[2].split(',')) {
      const ends = part.split('-').map(Number);
      const first = ends[0], last = ends.length > 1 ? ends[1] : first;
      if (first < 1 || last < first || last > LIMITS[s]) throw Error(s + '.' + part + ' hatalı; sûrede ' + LIMITS[s] + ' âyet var.');
      for (let v = first; v <= last; v++) {
        const key = s + '.' + v;
        if (!seen.has(key)) { seen.add(key); out.push(key); }
        if (out.length > 1200) throw Error('Bir işlemde en fazla 1.200 âyet olabilir.');
      }
    }
  }
  return out;
}

export function normalizeMain(input) {
  const text = String(input).trim().replace(':','.');
  const match = /^(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (!match) throw Error('Ana âyet için 5.61 biçimini kullanın.');
  const s=Number(match[1]), v=Number(match[2]);
  if (!LIMITS[s] || v<1 || v>LIMITS[s]) throw Error('Böyle bir âyet bulunamadı.');
  return s+'.'+v;
}

// Previously accepted AyetulKuran R13 scope: Bakara, Âl-i İmrân and Nisâ
// remain protected when they themselves are selected as the MAIN verse.
// They may still be referenced as MATCHING verses under another main verse.
export const LOCKED_MAIN_SURAS = Object.freeze([2,3,4]);
export function canEditMain(input) {
  return !LOCKED_MAIN_SURAS.includes(Number(normalizeMain(input).split('.')[0]));
}

// R14 contains only the Word-derived main verses. Any of the 6,236 Quran
// verses may also be selected as a main verse, using the existing site's
// corresponding `r` links as its read-only starting point.
export function otherVerseBase(input, corpus) {
  const main = normalizeMain(input);
  const item = corpus?.verses?.[main.replace('.',':')];
  if (!item) throw Error(main + ' için Kur’an metni bulunamadı.');
  const seen = new Set(), links = [];
  for (const raw of (Array.isArray(item.r) ? item.r : [])) {
    try {
      const target = normalizeMain(String(raw).replace(':','.'));
      if (target!==main && !seen.has(target)) { seen.add(target); links.push([target,null]); }
    } catch { /* Preserve source, ignore malformed old-site references. */ }
  }
  return {
    main,
    heading: (item.sa||item.s+'. Sûre') + ' Sûresi - Ayet ' + item.a,
    status: 'site',
    links,
    source: {file:'Mevcut site verisi (app_data.json)',page:'—',paragraph:'—'},
  };
}

export function cleanState(state) {
  const normalized = state && typeof state === 'object' ? state : {};
  const added = [...new Set(Array.isArray(normalized.added) ? normalized.added : [])].sort(verseSort);
  const removed = [...new Set(Array.isArray(normalized.removed) ? normalized.removed : [])].sort(verseSort);
  const status = normalized.status === 'confirmed' || normalized.status === 'review' ? normalized.status : null;
  return {added,removed,status};
}

function verseSort(a,b) {const [s1,v1]=a.split('.').map(Number),[s2,v2]=b.split('.').map(Number);return s1-s2||v1-v2;}
function same(a,b) {return JSON.stringify(cleanState(a))===JSON.stringify(cleanState(b));}
function state(doc,key) {return cleanState(doc.overrides[key]);}
function store(doc,key,value) {const x=cleanState(value);if(!x.added.length&&!x.removed.length&&!x.status)delete doc.overrides[key];else doc.overrides[key]=x;}
function clone(doc) {return JSON.parse(JSON.stringify(doc));}

export function getMerged(base,stateInput) {
  const state = cleanState(stateInput), links = new Map(base.links.map(a=>[a[0],a[1]]));
  for (const removed of state.removed) links.delete(removed);
  for (const added of state.added) links.set(added,null);
  return [...links].map(([key,page])=>({key,page,added:state.added.includes(key)})).sort((a,b)=>verseSort(a.key,b.key));
}

export function applyEdit(doc,base,operation,refs,note,actor,clock=new Date().toISOString()) {
  if (!['add','remove','confirm','review'].includes(operation)) throw Error('Geçersiz işlem.');
  if (!base) throw Error('Seçilen ana âyet bulunamadı.');
  if (!canEditMain(base.main)) throw Error('Bakara (2), Âl-i İmrân (3) ve Nisâ (4) ana âyetleri korumalıdır; bu sûrelere yeni düzenleme yapılamaz. Başka sûrelerin benzeşenleri arasında yine kullanılabilirler.');
  const next = clone(doc), main = base.main, before = state(next,main);
  const newer = cleanState(before);
  const inBase = new Set(base.links.map(x=>x[0]));
  const chosen = operation==='add'||operation==='remove'?parseVerses(refs):[];
  if(chosen.includes(main))throw Error('Ana âyet kendisiyle ilişkilendirilemez.');
  const changed = [];
  for (const key of chosen) {
    const effective = newer.added.includes(key) || (inBase.has(key)&&!newer.removed.includes(key));
    if ((operation==='add'&&effective)||(operation==='remove'&&!effective))continue;
    newer.added=newer.added.filter(x=>x!==key);
    newer.removed=newer.removed.filter(x=>x!==key);
    if (operation==='add'&&!inBase.has(key)) newer.added.push(key);
    if (operation==='remove'&&inBase.has(key)) newer.removed.push(key);
    changed.push(key);
  }
  // Once the editor genuinely adds/removes a relation, a previously yellow
  // source heading is no longer pending review. Explicit manual REVIEW remains
  // available for genuinely unresolved cases.
  if (changed.length && (base.status==='yellow' || base.status==='site' || newer.status==='review')) {
    newer.status='confirmed';
  }
  if (operation==='confirm') newer.status='confirmed';
  if (operation==='review') newer.status='review';
  if (same(before,newer))return {doc,event:null,changed:[]};
  store(next,main,newer);
  const event={id:crypto.randomUUID(),at:clock,day_tr:dayInTurkey(clock),actor,action:operation,refs:changed,note:String(note||'').trim().slice(0,500),changes:[{main,before,after:state(next,main)}]};
  next.events.push(event);
  return {doc:next,event,changed};
}

function validateHistory(doc) {
  if (doc?.schema!=='ayatulkuran.github-edits.v1'||!doc.overrides||!Array.isArray(doc.events))throw Error('GitHub değişiklik dosyası beklenen biçimde değil.');
}
export function assertHistory(doc){validateHistory(doc);return doc;}

function undoEvents(doc,events,action,note,actor,clock) {
  validateHistory(doc);
  const next=clone(doc), old=new Map();
  for(const event of [...events].reverse()) {
    for(const change of [...event.changes].reverse()){
      const main=change.main,current=state(next,main);
      if(!same(current,change.after))throw Error(main+' âyeti daha sonra değiştirilmiş. Önce kayıtları kontrol edin. Geri alma yapılmadı.');
      if(!old.has(main))old.set(main,current);
      store(next,main,change.before);
    }
  }
  const changes=[...old].map(([main,before])=>({main,before,after:state(next,main)})).filter(x=>!same(x.before,x.after));
  if(!changes.length)throw Error('Geri alınacak bir değişiklik kalmadı.');
  const event={id:crypto.randomUUID(),at:clock,day_tr:dayInTurkey(clock),actor,action,refs:[],note,undo_of:events.map(e=>e.id),changes};
  next.events.push(event);
  return {doc:next,event,changed:changes.map(c=>c.main)};
}

export function undoOne(doc,id,actor,clock=new Date().toISOString()) {
  validateHistory(doc);
  const original=doc.events.find(e=>e.id===id);
  if(!original)throw Error('İşlem bulunamadı.');
  if(doc.events.some(e=>e.undo_of?.includes(id)))throw Error('Bu işlem zaten geri alınmış.');
  return undoEvents(doc,[original],'rollback_event','İşlem geri alındı: '+id,actor,clock);
}

export function dayInTurkey(iso){return new Date(iso).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});}
export function undoDay(doc,day,actor,clock=new Date().toISOString()) {
  validateHistory(doc);
  if(!/^\d{4}-\d\d-\d\d$/.test(day))throw Error('Gün seçiniz.');
  const events=doc.events.filter(e=>dayInTurkey(e.at)===day);
  if(!events.length)throw Error('Seçilen tarihte işlem bulunamadı.');
  return undoEvents(doc,events,'rollback_day',day+' tarihindeki '+events.length+' işlem geri alındı.',actor,clock);
}

export function eventLabel(event){return ({add:'Eklendi',remove:'Çıkarıldı',confirm:'Başlık doğrulandı',review:'Sarı incelemeye alındı',rollback_event:'İşlem geri alındı',rollback_day:'Günün işlemleri geri alındı'})[event.action]||event.action;}
