// Gerçek kabul edilmiş 99 Esmâ / 2050 referans ve Hasenat corpus denemesi.
// Salt-okunur: dosya yazma, GitHub PUT veya yayın yok.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertEsmaDataset, esmaRanges, findSelectedEsma} from './mutesabih-esma-benzesme.mjs';

const dataset=JSON.parse(readFileSync(new URL('./esma_index.json',import.meta.url),'utf8'));
const corpus=JSON.parse(readFileSync(new URL('./app_data.json',import.meta.url),'utf8'));
const before=JSON.stringify(dataset);

function selected(name, ref) {
  const arabic=corpus.verses[ref].arh || corpus.verses[ref].ar;
  const ranges=esmaRanges(arabic,dataset.index[name].ar);
  assert(ranges.length>0,`${name} ${ref}: Esmâ ifadesi bulunmalı`);
  const {start,end}=ranges[0];
  return {text:arabic.slice(start,end),source:{verse:ref.replace(':','.'),start,end,
    ...(corpus.verses[ref].arh?{text_field:'arh'}:{})}};
}

test('Esma veri seti 99 isim, 2050 eşsiz ve geçerli sûre/âyet referansı içeriyor',()=>{
  assert.equal(assertEsmaDataset(dataset,corpus),true);
  assert.equal(dataset.esmalar.length,99);
  assert.equal(dataset.esmalar.reduce((total,name)=>total+dataset.index[name].r.length,0),2050);
});

test('Ana âyet 4.43 üzerinde seçilen AFUV, 5 Esmâ referansına bağlanır',()=>{
  const match=findSelectedEsma({...selected('AFUV','4:43'),dataset,corpus});
  assert.equal(match.name,'AFUV');assert.equal(match.count,5);assert.equal(match.main,'4.43');
  assert.deepEqual(dataset.index[match.name].r,['4:43','4:99','4:149','22:60','58:2']);
});

test('BASÎR isim olarak eşleşir, türemiş ve yarım sözcük eşleşmez',()=>{
  const sel=selected('BASÎR','2:96');
  const match=findSelectedEsma({...sel,dataset,corpus});
  assert.equal(match.name,'BASÎR');assert.equal(match.count,42);
  const short={text:sel.text.slice(1),source:{...sel.source,start:sel.source.start+1}};
  assert.equal(findSelectedEsma({...short,dataset,corpus}),null);
  assert.equal(esmaRanges('يُبْصِرُونَ',dataset.index.BASÎR.ar).length,0);
  assert.equal(esmaRanges('بَصِيرَةٌ',dataset.index.BASÎR.ar).length,0);
});

test('Çok kelimeli Esmâ hem ذُو hem i‘rablı ذِى biçiminde tek isimdir',()=>{
  const name='ZU’L-CELÂL-İ VE’L-İKRÂM 2';
  for(const ref of ['55:27','55:78']) {
    const sel=selected(name,ref);
    assert(/\s/u.test(sel.text));
    assert.equal(findSelectedEsma({...sel,dataset,corpus})?.name,name);
  }
});

test('Bir Esmâ seçimi tüm veri seti referanslarına erişir; ayet verisi değiştirilmez',()=>{
  const name='RAB';
  const target=dataset.index[name];
  assert.equal(target.r.length,832);
  const ref=target.r.find(key=>esmaRanges(corpus.verses[key].arh||corpus.verses[key].ar,target.ar).length);
  assert(ref);
  assert.equal(findSelectedEsma({...selected(name,ref),dataset,corpus})?.count,832);
  assert.equal(JSON.stringify(dataset),before);
});

test('Veri seti değişirse veya sûre/âyet kaydı bozulursa otomatik sonuç kapatılır',()=>{
  const changed=structuredClone(dataset);changed.index.AFUV.r.push('500:1');
  assert.throws(()=>assertEsmaDataset(changed,corpus),/referansları|adı|2.050/);
  const wrong=structuredClone(dataset);wrong.index.AFUV.ar='بَصِير';
  assert.throws(()=>assertEsmaDataset(wrong,corpus),/belirsiz/);
  const sel=selected('AFUV','4:43');
  assert.equal(findSelectedEsma({...sel,source:{...sel.source,verse:'3.43'},dataset,corpus}),null);
});
