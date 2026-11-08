// Kaynak alanı geriye uyumluluğu; gerçek çalışma verisi veya ağ yazımı yoktur.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyConceptHistory,addConcept,assertConceptHistory,assertConceptStorageTarget,
  CONCEPTS_BRANCH,CONCEPTS_PATH} from './mutesabih-kavramlar-core.mjs';
import {parseConceptImport,buildConceptImport} from './mutesabih-kavramlar-import.mjs';

const corpus=JSON.parse(readFileSync(new URL('./app_data.json',import.meta.url),'utf8'));
const v=corpus.verses['2:6'],word='تُنْذِرْھُمْ';
const at0='2026-11-08T00:00:00.000Z',at1='2026-11-08T00:01:00.000Z';
const source={verse:'2.6',start:v.arh.indexOf(word),end:v.arh.indexOf(word)+word.length,
  origin:'admin_selection',text_field:'arh'};
const add=(src=source,text=word)=>addConcept(emptyConceptHistory(at0),
  {arabicText:text,source:src},'Murat',corpus,at1);

test('Hasenat kaynağı ham karakter ve UTF16 konumlarıyla doğrulanır',()=>{
  assert.ok(source.start>=0);
  const out=add();
  assert.equal(out.record.arabic_text,word);
  assert.equal(out.event.source.text_field,'arh');
  assert.equal(out.record.sources[0].text_field,'arh');
  assertConceptHistory(out.doc,corpus);
  assertConceptStorageTarget({branch:CONCEPTS_BRANCH,path:CONCEPTS_PATH},out.doc,corpus);
});

test('Eski alanı belirtilmemiş kaynak ar metnine bağlı kalır',()=>{
  const oldSource={verse:'2.6',start:0,end:v.ar.length,origin:'manual'};
  const out=add(oldSource,v.ar);
  assert.deepEqual(out.event.source,oldSource);
  assert.equal(Object.hasOwn(out.record.sources[0],'text_field'),false);
  assertConceptHistory(out.doc,corpus);
});

test('Kaynak alanı eksik, yanlış veya dilim kaymışsa yeni metin reddedilir',()=>{
  const {text_field,...oldShape}=source;
  assert.throws(()=>add(oldShape),/eşleşmiyor/);
  for(const field of ['ar','other','__proto__',null])assert.throws(()=>add({...source,text_field:field}),/alanı geçersiz/);
  assert.throws(()=>add({...source,start:source.start+1,end:source.end+1}),/eşleşmiyor/);
});

test('arh kaynağı yokken veya değişmişken eski ar ile sessiz doğrulama yapılmaz',()=>{
  const doc=add().doc;
  const missing={verses:{'2:6':{ar:v.ar}}};
  assert.throws(()=>assertConceptHistory(doc,missing),/bulunamadı/);
  const changed={verses:{'2:6':{ar:v.ar,arh:'ا'+v.arh}}};
  assert.throws(()=>assertConceptHistory(doc,changed),/eşleşmiyor/);
});

test('Yeni gösterim kaynaklı belge de yalnız kavram çalışma dalına kabul edilir',()=>{
  assert.throws(()=>assertConceptStorageTarget({branch:'main',path:CONCEPTS_PATH},add().doc,corpus),/ayrı çalışma/);
  assert.deepEqual(add().doc.publication,{status:'not_published',automatic:false});
});

test('Dosyadan ekleme yeni kaynak alanını ve önceki olayları korur',()=>{
  const before=add().doc,serialized=JSON.stringify(before);
  const parsed=parseConceptImport({fileName:'ornek.txt',text:'الْحَمْدُ'});
  const result=buildConceptImport(before,parsed,{sha256:'a'.repeat(64),actor:'Murat',corpus,
    clock:'2026-11-08T00:02:00.000Z'});
  assert.equal(JSON.stringify(before),serialized);
  assert.deepEqual(result.doc.records[0],before.records[0]);
  assert.deepEqual(result.doc.events[0],before.events[0]);
  assertConceptHistory(result.doc,corpus);
});
