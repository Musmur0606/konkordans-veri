import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canEditMain, applyEdit, getMerged } from './mutesabih-core.mjs';
import {
  DRAFT234_PATH, PUBLIC_HISTORY_PATH, DRAFT234_BRANCH, PUBLIC_HISTORY_BRANCH,
  isDraftMain, historyPathForMain, storageForMain, assertStorageTarget,
  emptyDraftHistory, assertDraftHistory, assertRouteDocument, draftBase,
  applyDraftEdit, undoDraftOne, undoDraftDay,
} from './mutesabih-draft234.mjs';

let pass=0;
function test(name,fn) {fn();pass++;console.log('PASS '+name);}
const clock='2026-11-07T19:00:00.000Z';
const nextDay='2026-11-08T09:00:00.000Z';
const actor='Musmur0606';
const corpus={verses:{
  '2:1':{sa:'Bakara',a:1,r:['5:1','9:7']},
  '2:2':{sa:'Bakara',a:2,r:['3:6']},
  '3:1':{sa:'Âl-i İmrân',a:1,r:['1:1']},
  '4:1':{sa:'Nisâ',a:1,r:['5:2']},
}};
const empty=()=>emptyDraftHistory(clock);
const base=main=>draftBase(main,corpus);
const edit=(doc,main,op='add',refs='5.1',at=clock)=>applyDraftEdit(doc,base(main),op,refs,'Kontrol kaydı',actor,at);
const copy=value=>JSON.parse(JSON.stringify(value));
const publicDoc={schema:'ayatulkuran.github-edits.v1',overrides:{},events:[]};
const emptyState={added:[],removed:[],status:null};

test('Ana sûreye göre iki ayrı kayıt yolu',()=>{
  for (const s of [2,3,4]) {assert.equal(isDraftMain(s+'.1'),true);assert.equal(historyPathForMain(s+':1'),DRAFT234_PATH);}
  for (const s of [1,5,114]) {assert.equal(isDraftMain(s+'.1'),false);assert.equal(historyPathForMain(s+'.1'),PUBLIC_HISTORY_PATH);}
  assert.throws(()=>historyPathForMain('2.287'));assert.throws(()=>historyPathForMain('115.1'));
});
test('Boş taslak ve varsa çalışma JSON dosyası yayın kilitli',()=>{
  const seed=new URL('./'+DRAFT234_PATH,import.meta.url);
  if (existsSync(seed)) {
    const initial=JSON.parse(readFileSync(seed,'utf8'));
    assertDraftHistory(initial);
  }
  assertDraftHistory(empty());assert.deepEqual(empty().overrides,{});assert.deepEqual(empty().events,[]);
  assert.deepEqual(empty().publication,{status:'not_published',automatic:false});
});
test('Dal ve dosya birlikte yönlendirilir; taslak main dalına yazılamaz',()=>{
  const live={path:PUBLIC_HISTORY_PATH,branch:PUBLIC_HISTORY_BRANCH,draft:false};
  const draft={path:DRAFT234_PATH,branch:DRAFT234_BRANCH,draft:true};
  assert.deepEqual(storageForMain('2.1'),draft);assert.deepEqual(storageForMain('3:1'),draft);assert.deepEqual(storageForMain('4.176'),draft);
  assert.deepEqual(storageForMain('5.1'),live);
  assertStorageTarget(draft,empty());assertStorageTarget(live,publicDoc);
  assertStorageTarget({path:DRAFT234_PATH,branch:DRAFT234_BRANCH},empty());
  assert.throws(()=>assertStorageTarget({...draft,branch:PUBLIC_HISTORY_BRANCH},empty()));
  assert.throws(()=>assertStorageTarget({...live,branch:DRAFT234_BRANCH},publicDoc));
  assert.throws(()=>assertStorageTarget({...draft,draft:false},empty()));
  assert.throws(()=>assertStorageTarget({...draft,branch:'main-old'},empty()));
  assert.throws(()=>assertStorageTarget(draft,publicDoc));
  assert.throws(()=>assertStorageTarget(live,empty()));
});
test('Taslak başlangıcı motor ilişkilerini okumaz',()=>{
  const sensitive={verses:{'2:1':{sa:'Bakara',a:1,get r(){throw Error('Motor okunmamalı');}}}};
  assert.deepEqual(draftBase('2:1',sensitive).links,[]);
  assert.equal(base('2.1').source.file,DRAFT234_PATH);
  for (const main of ['1.1','5.1','114.1']) assert.throws(()=>draftBase(main,corpus));
});
test('Yalnız 2/3/4 ana yazılabilir; benzeşen tüm sûrelerden',()=>{
  for (const main of ['2.1','3.1','4.1']) {
    const out=edit(empty(),main,'add','1.1 2.255 3.200 4.176 5.120 114.6');
    assert.equal(out.changed.length,6);assert.equal(out.doc.overrides[main].status,'review');
    assert.deepEqual(getMerged(base(main),out.doc.overrides[main]).map(r=>r.key),['1.1','2.255','3.200','4.176','5.120','114.6']);
    assert.equal(out.event.scope,'draft234');assert.equal(out.event.source,'kullanici_calismasi');
  }
  for (const main of ['1.1','5.1','114.1']) assert.throws(()=>applyDraftEdit(empty(),{...base('2.1'),main},'add','2.2','',actor));
});
test('Kendine bağlantı, hatalı referans ve motorlu başlangıç reddi',()=>{
  for (const refs of ['2.1','2.287','3.201','114.7','0.1','115.1','5.0','5.2-1','bozuk']) assert.throws(()=>edit(empty(),'2.1','add',refs));
  assert.throws(()=>applyDraftEdit(empty(),{...base('2.1'),links:[['5.1',null]]},'add','5.2','',actor));
  assert.throws(()=>applyDraftEdit(empty(),{...base('2.1'),status:'site'},'add','5.2','',actor));
});
test('Tekilleştirme, no-op ve girdi dokümanı korunur',()=>{
  const doc=empty(),original=JSON.stringify(doc);
  const first=edit(doc,'2.1','add','5.1,1 5.1');
  assert.equal(JSON.stringify(doc),original);assert.deepEqual(first.changed,['5.1']);
  const second=edit(first.doc,'2.1','add','5.1');assert.equal(second.doc,first.doc);assert.equal(second.event,null);
  const missing=edit(first.doc,'2.1','remove','6.2');assert.equal(missing.event,null);
});
test('Doğrulama yayın değildir; yeni değişiklik taslağa döner',()=>{
  const added=edit(empty(),'2.1');
  const checked=edit(added.doc,'2.1','confirm','');
  assert.equal(checked.doc.overrides['2.1'].status,'confirmed');
  assert.deepEqual(checked.doc.publication,empty().publication);
  const changed=edit(checked.doc,'2.1','add','6.1');
  assert.equal(changed.doc.overrides['2.1'].status,'review');
  assert.deepEqual(changed.doc.publication,empty().publication);
  assert.throws(()=>edit(changed.doc,'2.1','publish',''));
});
test('Çıkarma ve geri alma append-only; diğer ana âyet korunur',()=>{
  const a=edit(empty(),'2.1','add','5.1 6.1');
  const b=edit(a.doc,'3.1','add','8.1');
  const before=JSON.stringify(b.doc), c=edit(b.doc,'2.1','remove','5.1');
  assert.equal(JSON.stringify(b.doc),before);
  assert.deepEqual(c.doc.overrides['2.1'].added,['6.1']);
  assert.deepEqual(c.doc.overrides['2.1'].removed,[]);
  const restored=undoDraftOne(c.doc,c.event.id,actor,clock);
  assert.deepEqual(restored.doc.overrides['2.1'].added,['5.1','6.1']);
  assert.deepEqual(restored.doc.overrides['3.1'],b.doc.overrides['3.1']);
  assert.equal(restored.doc.events.length,4);assert.deepEqual(restored.doc.events.slice(0,3),c.doc.events);
  assert.throws(()=>undoDraftOne(restored.doc,c.event.id,actor,clock));
});
test('Daha yeni aynı ana âyet değişikliğinde geri alma durur',()=>{
  const a=edit(empty(),'2.1','add','5.1');
  const b=edit(a.doc,'2.1','add','6.1',nextDay);
  const saved=JSON.stringify(b.doc);
  assert.throws(()=>undoDraftOne(b.doc,a.event.id,actor,nextDay),/daha sonra/);
  assert.throws(()=>undoDraftDay(b.doc,'2026-11-07',actor,nextDay),/daha sonra/);
  assert.equal(JSON.stringify(b.doc),saved);
});
test('Gün geri alma Türkiye tarihini ve ayrı ana âyetleri izler',()=>{
  const a=edit(empty(),'2.1','add','5.1',clock);
  const b=edit(a.doc,'3.1','add','6.1',clock);
  const c=edit(b.doc,'4.1','add','7.1',nextDay);
  const undone=undoDraftDay(c.doc,'2026-11-07',actor,nextDay);
  assert.equal(undone.doc.overrides['2.1'],undefined);assert.equal(undone.doc.overrides['3.1'],undefined);
  assert.deepEqual(undone.doc.overrides['4.1'],c.doc.overrides['4.1']);
  assert.equal(undone.event.undo_of.length,2);
  assert.deepEqual(undone.doc.publication,empty().publication);
  assert.throws(()=>undoDraftDay(c.doc,'2026-11-06',actor,nextDay));
  assert.throws(()=>undoDraftOne(c.doc,'canli-dosyadaki-id',actor));
});
test('Yol, şema, kapsam ve yayın kilidi çapraz yazmayı engeller',()=>{
  assertRouteDocument(DRAFT234_PATH,empty());assertRouteDocument(PUBLIC_HISTORY_PATH,publicDoc);
  assert.throws(()=>assertRouteDocument(PUBLIC_HISTORY_PATH,empty()));
  assert.throws(()=>assertRouteDocument(PUBLIC_HISTORY_PATH,{...empty(),schema:publicDoc.schema}));
  assert.throws(()=>assertRouteDocument(DRAFT234_PATH,publicDoc));
  assert.throws(()=>assertRouteDocument('data/bilinmeyen.json',empty()));
  for (const mutate of [d=>d.scope.push(5),d=>d.publication.status='published',d=>d.publication.automatic=true,d=>d.overrides['5.1']=copy(emptyState)]) {
    const bad=empty();mutate(bad);assert.throws(()=>assertDraftHistory(bad));
  }
  for (const main of ['2.1','3.1','4.1']) {
    assert.throws(()=>assertRouteDocument(PUBLIC_HISTORY_PATH,{...publicDoc,overrides:{[main]:copy(emptyState)}}));
    assert.throws(()=>assertRouteDocument(PUBLIC_HISTORY_PATH,{...publicDoc,events:[{changes:[{main}]}]}));
  }
});
test('Bozulmuş geçmiş, durum ve sahte ana âyet reddi',()=>{
  const a=edit(empty(),'2.1','add','5.1');
  for (const mutate of [
    d=>d.overrides['2.1'].added.push('5.2'),
    d=>d.events[0].changes[0].before.added.push('5.2'),
    d=>d.events[0].changes[0].main='5.1',
    d=>d.events[0].scope='public',
    d=>d.events[0].source='motor',
    d=>d.events.push(copy(d.events[0])),
    d=>d.overrides['2.1'].added.push('2.1'),
    d=>d.overrides['2.1'].removed.push('6.1'),
    d=>d.events[0].day_tr='2026-11-06',
  ]) {const bad=copy(a.doc);mutate(bad);assert.throws(()=>assertDraftHistory(bad));}
});
test('Canlı çekirdeğin 2/3/4 ana kilidi değişmedi',()=>{
  for (const main of ['2.1','3.1','4.1']) {
    assert.equal(canEditMain(main),false);
    assert.throws(()=>applyEdit(publicDoc,base(main),'add','5.1','',actor,clock));
  }
  const liveBase={main:'5.1',links:[]};
  const live=applyEdit(publicDoc,liveBase,'add','2.1 3.1 4.1','Mevcut davranış',actor,clock);
  assert.equal(live.changed.length,3);assertRouteDocument(PUBLIC_HISTORY_PATH,live.doc);
});
test('Mevcut gerçek canlı geçmişi salt okunur geçer',()=>{
  const file=new URL('./'+PUBLIC_HISTORY_PATH,import.meta.url);
  const raw=readFileSync(file);const before=createHash('sha256').update(raw).digest('hex');
  const actual=JSON.parse(raw);assertRouteDocument(PUBLIC_HISTORY_PATH,actual);
  console.log('CANLI_KAYNAK '+JSON.stringify({ana_kayit:Object.keys(actual.overrides).length,islem:actual.events.length}));
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),before);
});
console.log(JSON.stringify({sonuc:'PASS_R234_DRAFT_CORE',test_sayisi:pass,canli_dosya_degisti:false,yayin:false}));
