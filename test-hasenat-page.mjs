// Aktif ekran bağlantıları, deneme dizinine aktarım ve veri önbelleği.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const index=read('./index.html'),demo=read('./kelime-kavram-deneme.html');
const corpus=JSON.parse(read('./app_data.json'));

test('Ana uygulama ve bağımsız dizin betikleri sözdizimi bakımından geçerli',()=>{
  for(const html of [index,demo]){
    const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    for(const [,attrs,body] of scripts){
      if(/application\/ld\+json/.test(attrs)||!body.trim())continue;
      assert.doesNotThrow(()=>new vm.Script(body));
    }
  }
});

test('Arama ve esmâ gösterimi yeni köprüye, veri aynı site sürümüne bağlı',()=>{
  assert.ok(index.indexOf('src="/hasenat-display.js?v=hasenat-3"')<index.indexOf('// ===== YAPILANDIRMA'));
  assert.ok(existsSync(new URL('./hasenat-display.js',import.meta.url)));
  assert.match(index,/const DATA_URL = "\/app_data\.json"/);
  assert.match(index,/HASENAT\.match\(V\[ref\],q,o\)/);
  assert.match(index,/return HASENAT\.searchHTML\(ayet,aranan,arOpts\(\)\)/);
  assert.match(index,/return HASENAT\.esmaHTML\(v,esmaAr\)/);
});

test('Dizine aktarım Hasenat özel harflerini ve eski sorguları tam kelime grubuyla bulur',()=>{
  const context=vm.createContext({verses:corpus.verses,corpusTokens:[],Set});
  vm.runInContext(demo.slice(demo.indexOf('function cleanToken('),demo.indexOf('function safe(')),context);
  vm.runInContext(demo.slice(demo.indexOf(' corpusTokens=Object.entries('),demo.indexOf(' let saved;')),context);
  const cases=[['2.6','تُنْذِرْھُمْ'],['2.14','مُسْتَهْزِٶُنَ'],['2.219','يَسْپَلُونَكَ'],
    ['2.255','بِشَیْءٍ'],['10.3','السَّمٰوَاتِ'],['2.54','يَا قَوْمِ']];
  for(const [ref,query] of cases){
    const hits=context.calculate([query]).map(v=>v.join('.'));
    assert.ok(hits.includes(ref),ref+' '+query);
  }
  const old=corpus.verses['2:219'].ar.split(' ')[0];
  assert.ok(context.calculate([old]).some(v=>v.join('.')==='2.219'));
});

async function requestData({offline=false}={}){
  const handlers=new Map();let response,network=0;
  const saved=new Response('{"verses":{}}',{headers:{'Content-Type':'application/json'}});
  const context=vm.createContext({
    self:{addEventListener:(name,fn)=>handlers.set(name,fn)},
    location:{origin:'https://www.ayatulkuran.com'},URL,Request,Response,Headers,
    caches:{open:async()=>({put:async()=>{}}),match:async()=>saved.clone()},
    fetch:async()=>{network++;if(offline)throw Error('offline');return new Response('{"new":true}');}
  });
  vm.runInContext(read('./sw.js'),context);
  handlers.get('fetch')({request:new Request('https://www.ayatulkuran.com/app_data.json?v=hasenat-3&t=123'),
    respondWith:value=>{response=Promise.resolve(value);}});
  const result=await response;
  return {network,result};
}

test('Yerel app_data isteğinde eski önbellekten önce ağdaki yeni veri kullanılır',async()=>{
  const {network,result}=await requestData();
  assert.equal(network,1);
  assert.deepEqual(await result.json(),{new:true});
});

test('Bağlantı yokken kayıtlı veri çevrimdışı işaretiyle kullanılabilir',async()=>{
  const {network,result}=await requestData({offline:true});
  assert.equal(network,1);
  assert.equal(result.headers.get('X-Onbellek'),'1');
  assert.deepEqual(await result.json(),{verses:{}});
});
