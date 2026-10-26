import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {wordMatrixBaseline,applyEdit,undoOne,getMerged} from './mutesabih-core.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url));
const corpus=JSON.parse(read('./app_data.json').toString('utf8'));
const matrix=JSON.parse(read('./data/benzesen-matris.json').toString('utf8'));
const provenance=JSON.parse(read('./data/benzesen-matris-kaynak.json').toString('utf8'));
const changes=JSON.parse(read('./data/mutesabih-degisiklikler.json').toString('utf8'));

test('R23: CSV ve JSON aynı kaynaktan, SHA256 kaydı değişmemiş',()=>{
  for(const [file,key] of [['./data/benzesen-matris.json','json_sha256'],['./data/benzesen-matris.csv','csv_sha256']]){
    assert.equal(createHash('sha256').update(read(file)).digest('hex'),provenance[key]);
  }
});

test('R23: 5.574 ana âyet, 175.478 tekrarsız ilişki ve 2/3/4 koruma',()=>{
  const data=wordMatrixBaseline(matrix,corpus);
  assert.deepEqual(data.counts,{main:5574,candidates:175478});
  assert.equal(Object.keys(corpus.verses).length,6236);
  for(const s of [2,3,4])assert.equal(data.records.some(r=>r.main.startsWith(s+'.')),false);
  assert.ok(data.records.find(r=>r.main==='8.58').links.some(x=>x[0]==='2.100'));
});

test('R23: Enfal kullanıcı kontrol noktaları 8.1=96, 8.2=67 ve 8.58=30',()=>{
  for(const [main,count] of Object.entries(provenance.ornek_kontroller)){
    assert.equal(matrix[main].length,count,main);
  }
  assert.deepEqual(matrix['8:58'].slice(0,3),['2:100','2:101','2:190']);
});

test('R23: GitHub MLOG düzeltmesi doğrular; geri alma kaydı asıl veriyi değiştirmez',()=>{
  const base=wordMatrixBaseline(matrix,corpus).records.find(r=>r.main==='8.58');
  const doc={schema:'ayatulkuran.github-edits.v1',overrides:{},events:[]};
  const result=applyEdit(doc,base,'add','114.6','Test','Musmur0606','2026-10-24T10:00:00Z');
  assert.equal(result.changed[0],'114.6');
  assert.equal(result.doc.overrides['8.58'].status,'confirmed');
  assert.ok(getMerged(base,result.doc.overrides['8.58']).some(x=>x.key==='114.6'));
  const reverted=undoOne(result.doc,result.event.id,'Musmur0606','2026-10-24T10:30:00Z');
  assert.equal(reverted.doc.overrides['8.58'],undefined);
  assert.equal(reverted.doc.events.length,2);
  assert.equal(matrix['8:58'].length,30);
});

test('R23: ana site Word matrisini birleştirmeden uygular, 3 korumalı sûreyi bırakır',async()=>{
  const html=read('./index.html').toString('utf8');
  const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .find(x=>x[1].includes('// ===== YAPILANDIRMA ====='))[1];
  const fun=app.match(/async function benzesenMatrisiniUygula\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fun,'uygulayıcı bulundu');
  const V=structuredClone(corpus.verses);
  const prior8=V['8:58'].r.length,prior2=JSON.stringify(V['2:1'].r);
  const update={...changes,overrides:{'8.58':{added:['114.6'],removed:['2.100'],status:'confirmed'}}};
  const scope=vm.createContext({V,BENZESEN_URL:'/data/benzesen-matris.json',MLOG_URL:'https://raw.githubusercontent.com/example/mlog',BENZESEN_HAZIR:false,_sureIliski:{},Date,
    fetch:async(url)=>({ok:true,json:async()=>url.startsWith('/data/')?matrix:update})});
  vm.runInContext(fun,scope);
  assert.equal(prior8,1,'eski sitede 8.58 için tek bağlantı vardı');
  await vm.runInContext('benzesenMatrisiniUygula()',scope);
  assert.equal(V['8:58'].r.length,30);
  assert.ok(V['8:58'].r.includes('114:6'));
  assert.ok(!V['8:58'].r.includes('2:100'));
  assert.equal(JSON.stringify(V['2:1'].r),prior2);
  assert.equal(scope.BENZESEN_HAZIR,true);
});

test('R23: hatalı matriste kısmi kaydetme yok',async()=>{
  const html=read('./index.html').toString('utf8');
  const app=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .find(x=>x[1].includes('// ===== YAPILANDIRMA ====='))[1];
  const fun=app.match(/async function benzesenMatrisiniUygula\(\)\{[\s\S]*?\n\}/)?.[0];
  const V=structuredClone(corpus.verses),before=V['8:58'].r.slice();
  const damaged={...matrix,'8:58':['8:58',...matrix['8:58'].slice(1)]};
  const scope=vm.createContext({V,BENZESEN_URL:'/data/benzesen-matris.json',MLOG_URL:'https://raw.githubusercontent.com/example/mlog',BENZESEN_HAZIR:false,_sureIliski:null,Date,
    fetch:async(url)=>({ok:true,json:async()=>url.startsWith('/data/')?damaged:changes})});
  vm.runInContext(fun,scope);
  await assert.rejects(()=>vm.runInContext('benzesenMatrisiniUygula()',scope),/hatalı benzeşen/);
  assert.deepEqual(V['8:58'].r,before);
  assert.equal(scope.BENZESEN_HAZIR,false);
});
