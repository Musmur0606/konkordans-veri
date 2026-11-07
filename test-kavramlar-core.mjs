import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONCEPTS_SCHEMA, CONCEPTS_BRANCH, CONCEPTS_PATH,
  emptyConceptHistory, assertConceptHistory, assertConceptStorageTarget,
  normalizeConceptVerse, conceptSearchKey, addConcept, archiveConcept, restoreConcept
} from './mutesabih-kavramlar-core.mjs';

const T0 = '2026-11-07T12:00:00.000Z';
const T1 = '2026-11-07T12:01:00.000Z';
const T2 = '2026-11-07T12:02:00.000Z';
const T3 = '2026-11-07T12:03:00.000Z';
const T4 = '2026-11-07T12:04:00.000Z';
const ACTOR = 'Murat';
const TEXT = 'ٱلْحَمْدُ';
const CORPUS = {verses:{
  '1:1': {ar:'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'},
  '1:2': {ar:'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'},
  '2:1': {ar:'الٓمٓ'},
  '2:2': {ar:'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ'},
  '6:1': {ar:'ٱلْحَمْدُ لِلَّهِ ٱلَّذِي خَلَقَ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ'},
  '114:6': {ar:'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ'}
}};
const SOURCE = {verse:'1.2',start:0,end:TEXT.length,origin:'admin_selection'};
const copy = value => JSON.parse(JSON.stringify(value));
const empty = () => emptyConceptHistory(T0);
const add = (doc = empty(), input = {arabicText:TEXT,source:SOURCE}, actor = ACTOR, at = T1) => addConcept(doc,input,actor,CORPUS,at);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

test('Boş sicil ve sabit dal/yol yayın dışı başlar', () => {
  const doc = empty();
  assert.equal(CONCEPTS_SCHEMA,'ayatulkuran.concepts-draft.v1');
  assert.equal(CONCEPTS_BRANCH,'calisma-kavramlar');
  assert.equal(CONCEPTS_PATH,'data/kavramlar-calisma.json');
  assert.deepEqual(doc.publication,{status:'not_published',automatic:false});
  assert.deepEqual(doc.records,[]);
  assert.deepEqual(doc.events,[]);
  assert.equal(doc.created_at,T0);
  assert.equal(doc.updated_at,T0);
  assert.equal(assertConceptHistory(doc),doc);
});

test('Sûre/âyet gerçek alt-üst sınırları ve noktalı standart', () => {
  for (const verse of ['1.7','2.286','3.200','4.176','9.129','114.6']) assert.equal(normalizeConceptVerse(verse),verse);
  assert.equal(normalizeConceptVerse('002:001'),'2.1');
  for (const bad of ['0.1','115.1','1.0','1.8','2.287','3.201','4.177','9.130','114.7','2.1ek','2','2.1.2','NaN.1','-1.1']) assert.throws(() => normalizeConceptVerse(bad));
  assert.throws(() => normalizeConceptVerse(2.1));
});

test('Kaynaksız yapıştırma seçili ana âyete kendiliğinden bağlanmaz', () => {
  const loadedCorpus = {...CORPUS,selected:'2.2'};
  const out = addConcept(empty(),{arabicText:TEXT,source:null},ACTOR,loadedCorpus,T1);
  assert.deepEqual(out.record.sources,[]);
  assert.equal(out.event.source,null);
  assert.equal(out.record.arabic_text,TEXT);
  assert.equal(out.changed,true);
  assert.equal(out.duplicate,false);
});

test('Kaynak alanı verilmemiş yapıştırma da açıkça kaynaksızdır', () => {
  const out = addConcept(empty(),{arabicText:TEXT},ACTOR,undefined,T1);
  assert.deepEqual(out.record.sources,[]);
  assert.equal(out.event.source,null);
});

test('Yönetim seçimi asıl Arapça dilimi ve ekleyen bilgisiyle kaydedilir', () => {
  const out = add();
  assert.deepEqual(out.record.sources,[{...SOURCE,added_at:T1,added_by:ACTOR,event_id:out.event.id}]);
  assert.deepEqual(out.event.source,SOURCE);
  assert.equal(out.record.created_by,ACTOR);
  assert.equal(out.record.updated_by,ACTOR);
  assert.equal(out.record.created_at,T1);
  assert.equal(out.record.updated_at,T1);
  assert.equal(out.event.type,'add');
  assert.equal(out.event.before,null);
  assert.deepEqual(out.event.after,out.record);
  assertConceptHistory(out.doc,CORPUS);
});

test('Elle doğrulanmış kaynak kabul edilir; iki nokta girişte standartlaştırılır', () => {
  const source = {...SOURCE,verse:'001:002',origin:'manual'};
  const out = add(empty(),{arabicText:TEXT,source});
  assert.equal(out.record.sources[0].verse,'1.2');
  assert.equal(out.record.sources[0].origin,'manual');
});

test('Tüm sûrelere kaynak verilebilir; yalnız 2/3/4 ile sınırlanmaz', () => {
  const text = CORPUS.verses['114:6'].ar;
  const out = add(empty(),{arabicText:text,source:{verse:'114.6',start:0,end:text.length,origin:'manual'}});
  assert.equal(out.record.sources[0].verse,'114.6');
});

test('Kaynak aralığı bir karakter kaymışsa veya yazı farklıysa reddedilir', () => {
  for (const source of [{...SOURCE,start:1,end:TEXT.length+1},{...SOURCE,end:TEXT.length-1},{...SOURCE,end:10000}]) {
    assert.throws(() => add(empty(),{arabicText:TEXT,source}),/eşleşmiyor/);
  }
  assert.throws(() => add(empty(),{arabicText:'الحمد',source:SOURCE}),/eşleşmiyor/);
  assert.throws(() => add(empty(),{arabicText:TEXT,source:{...SOURCE,verse:'2.2'}}),/eşleşmiyor/);
});

test('Kaynak dilimi yalnız gerçek corpus metniyle doğrulanabilir', () => {
  assert.throws(() => addConcept(empty(),{arabicText:TEXT,source:SOURCE},ACTOR,undefined,T1),/bulunamadı/);
  assert.throws(() => addConcept(empty(),{arabicText:TEXT,source:SOURCE},ACTOR,{verses:{}},T1),/bulunamadı/);
  assert.throws(() => addConcept(empty(),{arabicText:TEXT,source:SOURCE},ACTOR,{verses:{'1:2':{ar:null}}},T1),/bulunamadı/);
});

test('Eksik, kesirli veya sahte giriş yöntemli kaynak reddedilir', () => {
  const badSources = [
    {...SOURCE,start:-1}, {...SOURCE,start:0.5}, {...SOURCE,end:0},
    {...SOURCE,origin:'engine'}, {...SOURCE,verse:'2.287'},
    {verse:'1.2',origin:'manual'}, {...SOURCE,current_main:'2.2'},
    {...SOURCE,start:NaN}, {...SOURCE,end:Infinity}
  ];
  for (const source of badSources) assert.throws(() => add(empty(),{arabicText:TEXT,source}));
});

test('Orijinal Arapça, harekeler, boşluk ve satır sonları birebir korunur', () => {
  const original = '  ٱلْحَمْدُ\r\nلِلَّهِ  ';
  const out = add(empty(),{arabicText:original,source:null});
  assert.equal(out.record.arabic_text,original);
  assert.equal(out.record.search_key,'ٱلحمد لله');
});

test('Latin veya karışık Latin metin, yalnız sayı/işaret ve denetim karakteri reddedilir', () => {
  for (const arabicText of ['', '   ', 'Allah', 'الحمد Allah', '123', 'َُِ', 'ـــ', 'ٱلْحَمْدُ😀', 'الحمد\u0000', 'الحمد\u202E']) {
    assert.throws(() => add(empty(),{arabicText,source:null}));
  }
});

test('Metin/not üst sınırları uygulanır ve yazı kesilmez', () => {
  const out = add(empty(),{arabicText:'ا'.repeat(4096),note:'n'.repeat(4000),source:null});
  assert.equal(out.record.arabic_text.length,4096);
  assert.equal(out.record.notes[0].text.length,4000);
  assert.throws(() => add(empty(),{arabicText:'ا'.repeat(4097),source:null}));
  assert.throws(() => add(empty(),{arabicText:TEXT,note:'n'.repeat(4001),source:null}));
});

test('Birebir yinelenen metin ve kaynak no-op; geçmiş büyümez', () => {
  const first = add();
  const out = add(first.doc,{arabicText:TEXT,source:SOURCE},ACTOR,T2);
  assert.equal(out.duplicate,true);
  assert.equal(out.changed,false);
  assert.equal(out.event,null);
  assert.equal(out.doc.records.length,1);
  assert.equal(out.doc.events.length,1);
  assert.deepEqual(out.doc,first.doc);
  assert.notEqual(out.doc,first.doc);
});

test('Harekeleri farklı metinler aynı arama anahtarı olsa bile birleşmez', () => {
  const first = add(empty(),{arabicText:'الْحَمْدُ',source:null});
  const second = add(first.doc,{arabicText:'الحمد',source:null},ACTOR,T2);
  assert.equal(first.record.search_key,second.record.search_key);
  assert.notEqual(first.record.id,second.record.id);
  assert.equal(second.doc.records.length,2);
  assert.equal(second.duplicate,false);
});

test('Aynı metne ikinci âyet kaynağı eklenir; ilk kaynak kaybolmaz', () => {
  const first = add();
  const source = {...SOURCE,verse:'6.1'};
  const second = add(first.doc,{arabicText:TEXT,source},'İkinci kullanıcı',T2);
  assert.equal(second.duplicate,true);
  assert.equal(second.doc.records.length,1);
  assert.equal(second.record.sources.length,2);
  assert.deepEqual(second.record.sources[0],first.record.sources[0]);
  assert.equal(second.record.sources[1].verse,'6.1');
  assert.equal(second.record.sources[1].added_by,'İkinci kullanıcı');
  assert.equal(second.event.type,'enrich');
  assert.equal(second.record.created_at,T1);
  assert.equal(second.record.updated_at,T2);
});

test('Aynı konumdaki farklı doğrulanmış giriş yöntemi korunur', () => {
  const first = add();
  const second = add(first.doc,{arabicText:TEXT,source:{...SOURCE,origin:'manual'}},ACTOR,T2);
  assert.equal(second.record.sources.length,2);
  assert.deepEqual(second.record.sources.map(s => s.origin),['admin_selection','manual']);
});

test('Kaynaksız kayda sonradan gerçek kaynak eklenir', () => {
  const first = add(empty(),{arabicText:TEXT,source:null});
  const second = add(first.doc,{arabicText:TEXT,source:SOURCE},ACTOR,T2);
  assert.equal(second.record.id,first.record.id);
  assert.equal(second.record.sources.length,1);
  assert.equal(second.doc.events[0].source,null);
  assert.equal(second.doc.events.length,2);
});

test('Yeni not önceki notların üzerine yazılmaz; aynı not yinelenmez', () => {
  const first = add(empty(),{arabicText:TEXT,note:' İlk not ',source:SOURCE});
  const second = add(first.doc,{arabicText:TEXT,note:'İkinci not',source:null},'Araştırmacı',T2);
  assert.deepEqual(second.record.notes.map(n => n.text),['İlk not','İkinci not']);
  assert.deepEqual(second.record.notes[0],{text:'İlk not',at:T1,actor:ACTOR,event_id:first.event.id});
  const third = add(second.doc,{arabicText:TEXT,note:'İkinci not',source:null},ACTOR,T3);
  assert.equal(third.event,null);
  assert.deepEqual(third.doc,second.doc);
});

test('Arşivleme ve geri getirme silmeden eklemeli geçmişle yapılır', () => {
  const first = add();
  const archived = archiveConcept(first.doc,first.record.id,'Yanlış bağlam',ACTOR,T2);
  assert.equal(archived.record.status,'archived');
  assert.equal(archived.doc.records.length,1);
  assert.equal(archived.doc.events.length,2);
  assert.deepEqual(archived.doc.events[0],first.doc.events[0]);
  assert.deepEqual(archived.event.before,first.record);
  const restored = restoreConcept(archived.doc,first.record.id,'Yeniden incelendi','İnceleyen',T3);
  assert.equal(restored.record.status,'active');
  assert.equal(restored.doc.events.length,3);
  assert.deepEqual(restored.record.sources,first.record.sources);
  assert.deepEqual(restored.record.notes.map(n => n.text),['Yanlış bağlam','Yeniden incelendi']);
  assert.equal(restored.record.updated_by,'İnceleyen');
  assertConceptHistory(restored.doc,CORPUS);
});

test('Arşivli metni tekrar eklemek onu kendiliğinden etkinleştirmez', () => {
  const first = add();
  const archived = archiveConcept(first.doc,first.record.id,'',ACTOR,T2);
  const enriched = add(archived.doc,{arabicText:TEXT,note:'Ek kaynak notu',source:{...SOURCE,verse:'6.1'}},ACTOR,T3);
  assert.equal(enriched.record.status,'archived');
  assert.equal(enriched.record.sources.length,2);
  assert.equal(enriched.doc.records.length,1);
  const repeated = add(enriched.doc,{arabicText:TEXT,source:SOURCE},ACTOR,T4);
  assert.equal(repeated.event,null);
  assert.equal(repeated.record.status,'archived');
});

test('Arşiv/geri getir işleminin yinelenmesi no-op', () => {
  const first = add();
  const alreadyActive = restoreConcept(first.doc,first.record.id,'',ACTOR,T2);
  assert.equal(alreadyActive.event,null);
  const archived = archiveConcept(first.doc,first.record.id,'',ACTOR,T2);
  const repeated = archiveConcept(archived.doc,first.record.id,'',ACTOR,T3);
  assert.equal(repeated.event,null);
  assert.deepEqual(repeated.doc,archived.doc);
});

test('Olmayan kayıt kimliği arşivlenmez ve geri getirilmez', () => {
  assert.throws(() => archiveConcept(empty(),'bilinmiyor','',ACTOR,T1),/bulunamadı/);
  assert.throws(() => restoreConcept(empty(),'bilinmiyor','',ACTOR,T1),/bulunamadı/);
});

test('Geçersiz veya geri tarihli işlemler reddedilir', () => {
  for (const bad of ['2026-02-30T00:00:00.000Z','tarih','2026-11-07','2026-11-07T12:00:00Z',new Date(T0),null]) {
    assert.throws(() => emptyConceptHistory(bad));
  }
  const first = add();
  assert.throws(() => add(first.doc,{arabicText:'الحمد',source:null},ACTOR,T0),/eski/);
  assert.throws(() => archiveConcept(first.doc,first.record.id,'',ACTOR,T0),/eski/);
});

test('ISO saat işlevi desteklenir ve bir kez çağrılır', () => {
  let calls = 0;
  const doc = emptyConceptHistory(() => { calls += 1; return T0; });
  assert.equal(calls,1);
  const out = addConcept(doc,{arabicText:TEXT,source:null},ACTOR,undefined,() => { calls += 1; return T1; });
  assert.equal(calls,2);
  assert.equal(out.event.at,T1);
});

test('Kullanıcı adı boş veya denetim karakterli olamaz', () => {
  for (const bad of ['', ' ', null, 'x\u0000']) assert.throws(() => add(empty(),{arabicText:TEXT,source:null},bad));
});

test('Girdi belgesi, giriş nesnesi ve corpus hiçbir mutasyonda değişmez', () => {
  const doc = freeze(empty());
  const input = freeze({arabicText:TEXT,note:'Not',source:copy(SOURCE)});
  const corpus = freeze(copy(CORPUS));
  const oldDoc = copy(doc), oldInput = copy(input), oldCorpus = copy(corpus);
  const first = addConcept(doc,input,ACTOR,corpus,T1);
  assert.deepEqual(doc,oldDoc);
  assert.deepEqual(input,oldInput);
  assert.deepEqual(corpus,oldCorpus);
  const protectedFirst = freeze(first.doc);
  const snapshot = copy(protectedFirst);
  const archived = archiveConcept(protectedFirst,first.record.id,'',ACTOR,T2);
  const restored = restoreConcept(freeze(archived.doc),first.record.id,'',ACTOR,T3);
  assert.deepEqual(protectedFirst,snapshot);
  assert.equal(restored.record.status,'active');
});

test('Dönüş kayıt ve event nesneleri girdiyle referans paylaşmaz', () => {
  const first = add();
  const snapshot = copy(first.doc);
  const repeated = add(first.doc,{arabicText:TEXT,source:SOURCE},ACTOR,T2);
  repeated.record.arabic_text = 'تغيير';
  repeated.doc.records[0].notes.push({text:'dış müdahale'});
  assert.deepEqual(first.doc,snapshot);
});

test('Yayın kilidi değiştirilen belge hiçbir yazma işlemine geçemez', () => {
  for (const publication of [
    {status:'published',automatic:false}, {status:'not_published',automatic:true},
    {status:'not_published',automatic:false,published_at:T0}, {}
  ]) {
    const doc = {...empty(),publication};
    assert.throws(() => assertConceptHistory(doc));
    assert.throws(() => add(doc,{arabicText:TEXT,source:null}));
  }
});

test('Başka veri seti şeması veya kayıp üst alanlar kabul edilmez', () => {
  for (const schema of ['ayatulkuran.draft234.v1','ayatulkuran.overrides.v1','']) assert.throws(() => assertConceptHistory({...empty(),schema}));
  const doc = empty();
  delete doc.events;
  assert.throws(() => assertConceptHistory(doc));
  assert.throws(() => assertConceptHistory({...empty(),overrides:{}}));
});

test('Dal/yol kontrolü main veya R234 veri dosyasına kaydı engeller', () => {
  const doc = add().doc;
  assertConceptStorageTarget({path:CONCEPTS_PATH,branch:CONCEPTS_BRANCH},doc,CORPUS);
  for (const target of [
    {path:CONCEPTS_PATH,branch:'main'}, {path:'data/mutesabih-calisma-234.json',branch:CONCEPTS_BRANCH},
    {path:'data/mutesabih-degisiklikler.json',branch:'main'}, {path:CONCEPTS_PATH}, null
  ]) assert.throws(() => assertConceptStorageTarget(target,doc));
});

test('Sicil kayıtlarının geçmiş dışında değiştirilmesi reddedilir', () => {
  const good = add().doc;
  for (const mutate of [
    d => { d.records[0].status = 'archived'; },
    d => { d.records[0].arabic_text = 'الحمد'; },
    d => { d.records[0].sources = []; },
    d => { d.records = []; },
    d => { d.records[0].updated_by = 'başkası'; },
    d => { d.updated_at = T2; }
  ]) {
    const doc = copy(good); mutate(doc);
    assert.throws(() => assertConceptHistory(doc));
  }
});

test('Olay zinciri before/after, sırası ve işlemleri korunur', () => {
  const first = add();
  const second = add(first.doc,{arabicText:TEXT,note:'Not',source:null},ACTOR,T2);
  for (const mutate of [
    d => { d.events[1].before = null; },
    d => { d.events[1].after.sources = []; },
    d => { d.events[1].id = d.events[0].id; },
    d => { d.events.reverse(); },
    d => { d.events.splice(0,1); },
    d => { d.events[1].type = 'publish'; },
    d => { d.events[1].at = T0; },
    d => { d.events[1].record_id = 'yeni-kimlik'; }
  ]) {
    const doc = copy(second.doc); mutate(doc);
    assert.throws(() => assertConceptHistory(doc));
  }
});

test('Sicili geçmişsiz oluşturmak veya sonradan kayıt silmek yasak', () => {
  const first = add();
  const doc = copy(first.doc);
  doc.events = [];
  doc.updated_at = T0;
  assert.throws(() => assertConceptHistory(doc));
});

test('Kaynakların yeniden doğrulanması değişmiş corpus metnini yakalar', () => {
  const out = add();
  const wrongCorpus = copy(CORPUS);
  wrongCorpus.verses['1:2'].ar = 'الحمد لله';
  assert.throws(() => assertConceptHistory(out.doc,wrongCorpus),/eşleşmiyor/);
  assertConceptHistory(out.doc,CORPUS);
});

test('Yayın kilidi ekleme, zenginleştirme, arşiv ve geri getirmede değişmez', () => {
  let state = add().doc;
  state = add(state,{arabicText:TEXT,note:'İncelendi',source:null},ACTOR,T2).doc;
  state = archiveConcept(state,state.records[0].id,'',ACTOR,T3).doc;
  state = restoreConcept(state,state.records[0].id,'',ACTOR,T4).doc;
  assert.deepEqual(state.publication,{status:'not_published',automatic:false});
  assert.equal(state.events.length,4);
  assert.deepEqual(state.events.map(e => e.type),['add','enrich','archive','restore']);
});

test('Arama anahtarı metin kimliği değildir; orijinal ve arama ayrıdır', () => {
  assert.equal(conceptSearchKey('الْحَمْدُ'),'الحمد');
  assert.equal(conceptSearchKey('الـحمد'),'الحمد');
  const a = add(empty(),{arabicText:'الـحمد',source:null});
  const b = add(a.doc,{arabicText:'الحمد',source:null},ACTOR,T2);
  assert.equal(b.doc.records.length,2);
});
