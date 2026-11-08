// Canlıya yönelik salt-okunur Esmâ veri testi; ağ ve GitHub yazması yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertEsmaDataset, esmaRanges, findSelectedEsma, stageEsmaReferences, formatEsmaRefs} from './mutesabih-esma-benzesme.mjs';
import {parseVerses} from './mutesabih-core.mjs';

const dataset=JSON.parse(readFileSync(new URL('./esma_index.json',import.meta.url),'utf8'));
const corpus=JSON.parse(readFileSync(new URL('./app_data.json',import.meta.url),'utf8'));
const before=JSON.stringify(dataset);

function selected(name, ref) {
  const arabic=corpus.verses[ref].arh||corpus.verses[ref].ar;
  const ranges=esmaRanges(arabic,dataset.index[name].ar);
  assert(ranges.length>0,`${name} ${ref}: Esmâ ifadesi bulunmalı`);
  const {start,end}=ranges[0];
  return {text:arabic.slice(start,end),source:{verse:ref.replace(':','.'),start,end,
    ...(corpus.verses[ref].arh?{text_field:'arh'}:{})}};
}

test('99 Esmâ ve 2050 özgün kaynak referansı aynı kalır',()=>{
  assert.equal(assertEsmaDataset(dataset,corpus),true);
  assert.equal(dataset.esmalar.length,99);
  assert.equal(dataset.esmalar.reduce((sum,name)=>sum+dataset.index[name].r.length,0),2050);
});

test('4.43 AFUV seçimi Esmâ veri setindeki beş âyeti verir',()=>{
  const match=findSelectedEsma({...selected('AFUV','4:43'),dataset,corpus});
  assert.equal(match.name,'AFUV');assert.equal(match.count,5);
  assert.deepEqual(dataset.index[match.name].r,['4:43','4:99','4:149','22:60','58:2']);
});

test('2.96 BASÎR 42 referansa ulaşır; yarım veya türemiş kelime kabul edilmez',()=>{
  const sel=selected('BASÎR','2:96');
  const match=findSelectedEsma({...sel,dataset,corpus});
  assert.equal(match.name,'BASÎR');assert.equal(match.count,42);
  assert.equal(findSelectedEsma({...sel,text:sel.text.slice(1),source:{...sel.source,start:sel.source.start+1},dataset,corpus}),null);
  assert.equal(esmaRanges('يُبْصِرُونَ',dataset.index.BASÎR.ar).length,0);
  assert.equal(esmaRanges('بَصِيرَةٌ',dataset.index.BASÎR.ar).length,0);
});

test('Çok kelimeli ذُو الجلال والإكرام tam grup hâlinde eşleşir',()=>{
  const name='ZU’L-CELÂL-İ VE’L-İKRÂM 2';
  for(const ref of ['55:27','55:78']) {
    const sel=selected(name,ref);
    assert(/\s/u.test(sel.text));
    assert.equal(findSelectedEsma({...sel,dataset,corpus})?.name,name);
  }
});

test('RAB seçimi tüm 832 sûre/âyet referansını getirir ve veri değişmez',()=>{
  const name='RAB', entry=dataset.index[name];
  assert.equal(entry.r.length,832);
  const ref=entry.r.find(key=>esmaRanges(corpus.verses[key].arh||corpus.verses[key].ar,entry.ar).length);
  assert(ref);
  assert.equal(findSelectedEsma({...selected(name,ref),dataset,corpus})?.count,832);
  assert.equal(JSON.stringify(dataset),before);
});

test('Bozuk Esmâ listesi veya yanlış kaynak âyet sonuç üretmez',()=>{
  const wrong=structuredClone(dataset);wrong.index.AFUV.r.push('500:1');
  assert.throws(()=>assertEsmaDataset(wrong,corpus));
  const sel=selected('AFUV','4:43');
  assert.equal(findSelectedEsma({...sel,source:{...sel.source,verse:'3.43'},dataset,corpus}),null);
});

test('Esmâ seçiminden sonra ana âyet ve mevcut benzeşenler atlanarak eksiksiz taslak oluşturulur',()=>{
  const staged=stageEsmaReferences({references:dataset.index.AFUV.r,main:'4.43',
    currentLinks:['22.60'],pendingText:'1.1 4.99'});
  assert.deepEqual(staged.candidates,['4.99','4.149','58.2']);
  assert.deepEqual(staged.inserted,['4.149','58.2']);
  assert.deepEqual(parseVerses(staged.mergedText),['1.1','4.99','4.149','58.2']);
});

test('İkinci Esmâ seçimi mükerrer numara eklemez; önceki elle giriş saklanır',()=>{
  const first=stageEsmaReferences({references:dataset.index.AFUV.r,main:'4.43',pendingText:'7.1'});
  const again=stageEsmaReferences({references:dataset.index.AFUV.r,main:'4.43',pendingText:first.mergedText});
  assert.equal(again.inserted.length,0);
  assert.deepEqual(parseVerses(again.mergedText),parseVerses(first.mergedText));
});

test('RAB Esmâsının 832 referansı 5000 karakter sınırına sığar ve birer kez listelenir',()=>{
  const refs=dataset.index.RAB.r;
  const staged=stageEsmaReferences({references:refs,main:refs[0].replace(':','.')});
  assert.equal(staged.candidates.length,new Set(refs.map(x=>x.replace(':','.'))).size-1);
  assert(staged.mergedText.length<=5000);
  assert.deepEqual(new Set(parseVerses(staged.mergedText)),new Set(staged.candidates));
});

test('Esmâya ait numaralar 1200 sınırını aşarsa önceki taslak korunur',()=>{
  const main=dataset.index.RAB.r[0].replace(':','.');
  const existing=Object.keys(corpus.verses).filter(key=>key.replace(':','.')!==main)
    .slice(0,950).map(key=>key.replace(':','.'));
  assert.throws(()=>stageEsmaReferences({references:dataset.index.RAB.r,main,
    pendingText:formatEsmaRefs(existing)}),/1.200|5.000/);
});
