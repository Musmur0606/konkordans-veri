// Ağsız yönetim-paneli davranış testi. Gerçek DOM/tarayıcı görsel testi DEĞİLDİR.
// Chromium bu ortamda socket() EPERM nedeniyle açılamadığından gerçek admin
// betiği küçük bir DOM + GitHub API benzetimi içinde çalıştırılır.
// fetch uygulaması hiç ağ açmaz; bütün PUT'lar yalnız bu sürecin belleğindedir.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import * as publicCore from './mutesabih-core.mjs';
import * as draftCore from './mutesabih-draft234.mjs';
import {compareConceptVerses,fillArabicHighlights} from './mutesabih-kavram-eslestirme.mjs';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const html=read('./mutesabih-admin.html');
const source=read('./mutesabih-admin.js');
const corpus=JSON.parse(read('./app_data.json'));
const matrix=JSON.parse(read('./data/benzesen-matris.json'));
const publicInitial=JSON.parse(read('./data/mutesabih-degisiklikler.json'));
const draftInitial=draftCore.emptyDraftHistory('2026-11-07T19:00:00.000Z');
const copy=value=>structuredClone(value);
const hash=value=>createHash('sha1').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const PUBLIC=draftCore.PUBLIC_HISTORY_BRANCH+':'+draftCore.PUBLIC_HISTORY_PATH;
const DRAFT=draftCore.DRAFT234_BRANCH+':'+draftCore.DRAFT234_PATH;
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const tests=[];
async function test(name,fn){await fn();tests.push(name);console.log('PASS '+name);}

function harness(options={}) {
  const elements=new Map(), calls=[], puts=[], failures=[], confirmations=[], exports=[];
  const timers=new Map(), speech=[], pending=[], errors=[];
  const store=new Map([
    [PUBLIC,{doc:copy(publicInitial),sha:hash(publicInitial)}],
    [DRAFT,{doc:copy(options.draftDoc||draftInitial),sha:hash(options.draftDoc||draftInitial)}],
  ]);
  let timerId=0,commitNumber=0;
  const controls={confirm:true,delayNextDraft:false,releaseDraft:null};
  class FakeEvent {constructor(type,options={}){this.type=type;Object.assign(this,options);}}
  class Element {
    constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.handlers=new Map();this.attributes={};this.dataset={};this.style={};this.disabled=false;this.hidden=false;this._value='';this._text='';this.className='';this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};}
    set value(v){this._value=String(v);}get value(){return this._value;}
    set textContent(v){this._text=String(v??'');this.children=[];}
    get textContent(){return this._text+this.children.map(c=>c?.textContent??String(c)).join('');}
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
    replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
    setAttribute(k,v){this.attributes[k]=String(v);}
    addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);}
    dispatchEvent(event){for(const fn of this.handlers.get(event.type)||[]){const x=fn(event);if(x?.then)pending.push(x);}return true;}
    async fire(type,event={}){if(this.disabled&&(type==='click'||type==='input'||type==='change'))return;for(const fn of this.handlers.get(type)||[])await fn({type,target:this,...event});}
    click(){if(this.tagName==='A'&&this.href?.startsWith('blob:test-'))exports.push({name:this.download,blob:blobMap.get(this.href)});return this.dispatchEvent(new FakeEvent('click'));}
    focus(){this.focused=true;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  }
  for(const id of ids)elements.set(id,new Element('div',id));
  const document={getElementById(id){if(!elements.has(id))throw Error('HTML kimliği yok: '+id);return elements.get(id);},createElement(tag){return new Element(tag);},createTextNode(text){return {textContent:String(text)};},body:new Element('body')};
  const blobMap=new Map();
  class FakeURL extends URL {}
  FakeURL.createObjectURL=blob=>{const url='blob:test-'+blobMap.size;blobMap.set(url,blob);return url;};
  FakeURL.revokeObjectURL=()=>{};
  class SpeechAPI {
    constructor(){speech.push(this);}
    start(){this.started=true;}
    stop(){this.stopped=true;/* native onend may arrive later: deliberately asynchronous */}
  }
  const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>copy(body)});
  async function fetchMock(raw,init={}) {
    const u=new URL(raw,'https://ayatulkuran.test');
    const method=init.method||'GET';
    calls.push({method,url:u.href});
    if(u.origin==='https://ayatulkuran.test'&&method==='GET'){
      if(u.pathname==='/app_data.json')return response(200,corpus);
      if(u.pathname==='/data/benzesen-matris.json')return response(200,matrix);
    }
    if(u.origin==='https://api.github.com'&&u.pathname==='/user'&&method==='GET')return response(200,{login:'Musmur0606'});
    const prefix='/repos/Musmur0606/konkordans-veri/contents/';
    const blobPrefix='/repos/Musmur0606/konkordans-veri/git/blobs/';
    if(u.origin==='https://api.github.com'&&u.pathname.startsWith(blobPrefix)&&method==='GET'){
      const sha=u.pathname.slice(blobPrefix.length);
      const item=[...store.values()].find(x=>x.sha===sha);
      if(!item)return response(404,{message:'Blob not found'});
      return response(200,{sha:options.badBlobSha?'f'.repeat(40):sha,encoding:'base64',content:Buffer.from(JSON.stringify(item.doc)).toString('base64')});
    }
    if(u.origin==='https://api.github.com'&&u.pathname.startsWith(prefix)){
      const path=u.pathname.slice(prefix.length);
      if(method==='GET'){
        const branch=u.searchParams.get('ref');
        const key=branch+':'+path;
        if(!store.has(key))throw Error('Beklenmeyen GET dal/yol: '+key);
        if(key===DRAFT&&controls.delayNextDraft){controls.delayNextDraft=false;await new Promise(resolve=>{controls.releaseDraft=resolve;});}
        if(key===DRAFT&&options.missingDraft)return response(404,{message:'Not Found'});
        const item=store.get(key);
        return response(200,{type:'file',sha:item.sha,encoding:options.contentsOmit?'none':'base64',content:options.contentsOmit?'':Buffer.from(JSON.stringify(item.doc)).toString('base64')});
      }
      if(method==='PUT'){
        const body=JSON.parse(init.body),key=body.branch+':'+path;
        if(!store.has(key))throw Error('Beklenmeyen PUT dal/yol: '+key);
        const current=store.get(key);
        if(body.sha!==current.sha)return response(409,{message:'Conflict'});
        const doc=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));
        draftCore.assertStorageTarget({path,branch:body.branch,draft:key===DRAFT},doc);
        const entry={path,branch:body.branch,sha:body.sha,doc};
        puts.push(entry);store.set(key,{doc:copy(doc),sha:hash(doc)});commitNumber++;
        return response(200,{content:{sha:hash(doc)},commit:{sha:hash('test-commit-'+commitNumber)}});
      }
    }
    failures.push({method,url:u.href});
    throw Error('Test ağı dışı istek engellendi: '+method+' '+u.origin+u.pathname);
  }
  const highlightForFakeDocument=(node,text,ranges)=>{
    const previous=globalThis.document;globalThis.document=document;
    try{return fillArabicHighlights(node,text,ranges);}finally{globalThis.document=previous;}
  };
  const scope={...publicCore,...draftCore,compareConceptVerses,fillArabicHighlights:highlightForFakeDocument,document,console:{log:()=>{},error:e=>errors.push(String(e))},fetch:fetchMock,TextEncoder,TextDecoder,Blob,URL:FakeURL,Event:FakeEvent,crypto:webcrypto,Date,Map,Set,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),SpeechRecognition:SpeechAPI,confirm:message=>{confirmations.push(message);return controls.confirm;}};
  scope.window=scope;
  vm.createContext(scope);
  vm.runInContext(source.replace(/^import[^\n]+\n/gm,''),scope,{filename:'mutesabih-admin.js'});
  const api=vm.runInContext('({runtime,historyForMain,chooseMain,authorize,startVoiceRefs,stopVoiceRefs,submitEdit,submitUndoOne,submitUndoDay,downloadDailyLog,loadGitHubFile,saveNext,renderAll})',scope);
  const get=id=>elements.get(id);
  async function login(){get('token').value='TEST_ONLY_NOT_A_REAL_KEY';await get('login').fire('click');assert.equal(api.runtime.actor,'Musmur0606',get('login-message').textContent);assert.ok(api.runtime.token);}
  function select(main){api.chooseMain(main,true);assert.equal(api.runtime.selected,main);}
  function heard(reader,text){const result=[{transcript:text}];result.isFinal=true;reader.onresult({resultIndex:0,results:[result]});}
  function routesClean(){assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);}
  return {api,get,login,select,heard,calls,puts,store,controls,confirmations,exports,timers,speech,routesClean,pending};
}

const state=h=>({public:JSON.stringify(h.store.get(PUBLIC).doc),draft:JSON.stringify(h.store.get(DRAFT).doc)});
const links=h=>h.get('link-list').children.filter(n=>n.className.split(' ').includes('link')).map(n=>n.children.find(x=>x.tagName==='STRONG').textContent);
const today=()=>publicCore.dayInTurkey(new Date().toISOString());
const lastPut=h=>h.puts.at(-1);
const assertDraftPut=h=>{assert.equal(lastPut(h).path,draftCore.DRAFT234_PATH);assert.equal(lastPut(h).branch,draftCore.DRAFT234_BRANCH);};
async function edit(h,main,operation,refs=''){h.select(main);h.get('refs').value=refs;h.get('reason').value='Yalnız ağsız benzetim testi';await h.get(operation).fire('click');assert.ok(!h.get('edit-message').className.includes('error'),h.get('edit-message').textContent);}
function missingPublicTargets(h,main){const base=h.api.runtime.data.records.find(x=>x.main===main);const existing=new Set(publicCore.getMerged(base,h.api.runtime.doc.overrides[main]).map(x=>x.key));return [2,3,4].map(s=>{for(let v=1;v<=10;v++)if(!existing.has(s+'.'+v))return s+'.'+v;throw Error('Uygun test referansı bulunamadı');});}

let h;
try {
  await test('HTML kimlikleri ve giriş akışı; iki veri seti doğru daldan okunur',async()=>{
    h=harness();await h.login();
    assert.equal(h.api.runtime.selected,'5.61');
    assert.ok(h.get('save-target').textContent.includes('main / '+draftCore.PUBLIC_HISTORY_PATH));
    assert.ok(h.calls.some(x=>x.url.endsWith(draftCore.DRAFT234_PATH+'?ref=calisma-234')));
    assert.ok(h.calls.some(x=>x.url.endsWith(draftCore.PUBLIC_HISTORY_PATH+'?ref=main')));
    assert.equal(h.puts.length,0);h.routesClean();
  });
  await test('2/3/4 başlangıç listeleri motor verisi olsa da boş',async()=>{
    for(const s of [2,3,4]){
      assert.ok(corpus.verses[s+':1'].r.length>0,'Kaynak motor listesi test için dolu olmalı');
      h.select(s+'.1');assert.deepEqual(links(h),[]);
      assert.ok(h.get('save-target').textContent.includes('calisma-234'));
      assert.equal(h.get('add').disabled,false);
      assert.ok(h.get('source-note').textContent.includes('mevcut motor sonuçları değişmez'));
    }
    assert.equal(h.puts.length,0);
  });
  await test('Ses yalnız kutuyu doldurur; ikinci onay yoksa yazı yok',async()=>{
    h.select('2.1');await h.get('voice-refs').fire('click');
    h.heard(h.speech.at(-1),'yüz on dört nokta altı');
    assert.equal(h.get('refs').value,'114.6');assert.equal(h.puts.length,0);
    h.controls.confirm=false;await h.get('add').fire('click');
    assert.equal(h.puts.length,0);assert.equal(h.get('refs').value,'114.6');
    assert.ok(h.get('edit-message').textContent.includes('İkinci onay verilmedi'));
    h.controls.confirm=true;
  });
  await test('Bakara sesli girdisi yalnız taslağa kaydedilir; canlı veri byte-eş korunur',async()=>{
    const before=state(h).public;await h.get('add').fire('click');
    assert.equal(h.puts.length,1);assertDraftPut(h);
    assert.deepEqual(links(h),['114.6']);
    assert.equal(state(h).public,before);
    assert.equal(lastPut(h).doc.overrides['2.1'].status,'review');
    assert.deepEqual(lastPut(h).doc.publication,{status:'not_published',automatic:false});
    assert.ok(h.get('edit-message').textContent.includes('Portala aktarılmadı'));
  });
  await test('Âl-i İmrân ve Nisâ eklemeleri aynı ayrı çalışma dosyasında kalır',async()=>{
    const before=state(h).public;
    for(const main of ['3.1','4.1']){await edit(h,main,'add','1.1 5.1 114.6');assertDraftPut(h);assert.deepEqual(links(h),['1.1','5.1','114.6']);}
    assert.equal(state(h).public,before);
  });
  await test('Taslak doğrulama yayın yapmaz; çıkarma ve geri alma yalnız taslakta',async()=>{
    const before=state(h).public;
    await edit(h,'4.1','confirm');assertDraftPut(h);
    assert.equal(lastPut(h).doc.overrides['4.1'].status,'confirmed');
    assert.deepEqual(lastPut(h).doc.publication,{status:'not_published',automatic:false});
    await edit(h,'4.1','remove','5.1');assert.deepEqual(links(h),['1.1','114.6']);
    const removedId=lastPut(h).doc.events.at(-1).id;
    await h.api.submitUndoOne(removedId,draftCore.DRAFT234_PATH);assertDraftPut(h);
    assert.deepEqual(links(h),['1.1','5.1','114.6']);assert.equal(state(h).public,before);
  });
  await test('Diğer ana sûre canlı dosyaya yazılır; 2/3/4 hedef olabilir',async()=>{
    const before=state(h).draft;
    const targets=missingPublicTargets(h,'5.1');await edit(h,'5.1','add',targets.join(' '));
    assert.equal(lastPut(h).path,draftCore.PUBLIC_HISTORY_PATH);assert.equal(lastPut(h).branch,'main');
    for(const target of targets)assert.ok(links(h).includes(target));
    assert.equal(state(h).draft,before);
    assert.equal(h.get('history-title').textContent,'Günlük MLOG');
  });
  await test('Geçmiş ve günlük dışa aktarma seçilen ana sûrenin dosyasına bağlı',async()=>{
    for(const [main,key,branch,scope] of [['2.1',DRAFT,'calisma-234','draft234'],['5.1',PUBLIC,'main','public']]){
      h.select(main);h.get('history-day').value=today();await h.get('history-day').fire('change');
      assert.ok(h.get('history-summary').textContent.includes(scope==='draft234'?'Yalnız çalışma veri seti':'Yalnız yayımlanan veri seti'));
      await h.get('download-day').fire('click');
      const exported=h.exports.at(-1);const log=JSON.parse(await exported.blob.text());
      assert.equal(log.branch,branch);assert.equal(log.scope,scope);
      assert.equal(log.count,h.store.get(key).doc.events.filter(e=>e.day_tr===today()).length);
      if(scope==='draft234')assert.ok(log.events.every(e=>e.scope==='draft234'));
    }
    h.get('history-day').value='';await h.get('history-day').fire('change');
  });
  await test('Canlı işlem geri alma taslağı etkilemez; eski taslak düğmesi başka dosyada reddedilir',async()=>{
    const before=state(h).draft;
    const id=h.store.get(PUBLIC).doc.events.at(-1).id;
    await h.api.submitUndoOne(id,draftCore.PUBLIC_HISTORY_PATH);
    assert.equal(lastPut(h).branch,'main');assert.equal(state(h).draft,before);
    const count=h.puts.length;
    await h.api.submitUndoOne(h.store.get(DRAFT).doc.events.at(-1).id,draftCore.DRAFT234_PATH);
    assert.equal(h.puts.length,count);assert.ok(h.get('edit-message').textContent.includes('Kayıt yeri değişti'));
  });
  await test('Taslak günlük geri alma canlı veri setine dokunmaz',async()=>{
    const before=state(h).public;h.select('2.1');h.get('history-day').value=today();
    await h.api.submitUndoDay();assertDraftPut(h);
    assert.deepEqual(lastPut(h).doc.overrides,{});assert.equal(state(h).public,before);
    assert.deepEqual(lastPut(h).doc.publication,{status:'not_published',automatic:false});
    h.routesClean();
  });
  await test('Taslak dosyası yoksa kapalı kalır; canlıya fallback yapılmaz',async()=>{
    const x=harness({missingDraft:true});await x.login();x.select('2.1');
    assert.equal(x.get('add').disabled,true);x.get('refs').value='114.6';await x.api.submitEdit('add');
    assert.equal(x.puts.length,0);assert.ok(x.get('edit-message').textContent.includes('Başka bir dosyaya yazılmayacak'));
    await edit(x,'5.1','add',missingPublicTargets(x,'5.1').join(' '));assert.equal(lastPut(x).branch,'main');
    x.routesClean();
  });
  await test('Taslak şeması yanlışsa kayıt kapalı; public şemaya yönlendirme yok',async()=>{
    const x=harness({draftDoc:publicInitial});await x.login();x.select('3.1');
    assert.equal(x.get('add').disabled,true);assert.equal(x.api.runtime.draftDoc,null);
    assert.ok(x.get('source-note').textContent.includes('okunamadı'));assert.equal(x.puts.length,0);x.routesClean();
  });
  await test('SHA çakışmasında PUT yok; yazılan giriş korunur',async()=>{
    const x=harness();await x.login();x.select('2.1');
    x.store.get(DRAFT).sha=hash('different-server-version');
    x.get('refs').value='114.6';await x.get('add').fire('click');
    assert.equal(x.puts.length,0);assert.equal(x.get('refs').value,'114.6');
    assert.ok(x.get('edit-message').textContent.includes('sizden sonra değişiklik olmuş'));x.routesClean();
  });
  await test('Kayıt sürerken seçim kilitli; gecikmiş okuma doğru dosyaya yazar',async()=>{
    const x=harness();await x.login();x.select('2.1');x.get('refs').value='114.6';
    x.controls.delayNextDraft=true;const saving=x.api.submitEdit('add');
    await Promise.resolve();await Promise.resolve();
    assert.equal(x.api.runtime.busy,true);assert.equal(x.get('sura-picker').disabled,true);assert.equal(x.get('logout').disabled,true);
    x.api.chooseMain('5.1',true);assert.equal(x.api.runtime.selected,'2.1');
    assert.equal(typeof x.controls.releaseDraft,'function');x.controls.releaseDraft();await saving;
    assertDraftPut(x);assert.equal(x.api.runtime.busy,false);assert.equal(x.get('sura-picker').disabled,false);x.routesClean();
  });
  await test('Sûre değişince önceki mikrofonun geç sonucu yeni âyete eklenmez',async()=>{
    const x=harness();await x.login();x.select('2.1');await x.get('voice-refs').fire('click');
    const old=x.speech.at(-1);x.select('3.1');assert.equal(old.stopped,true);
    x.heard(old,'beş nokta bir');assert.equal(x.get('refs').value,'');assert.equal(x.puts.length,0);x.routesClean();
  });
  await test('Eski mikrofon bitiş/hata olayı yeni dinlemeyi bozamaz',async()=>{
    const x=harness();await x.login();x.select('2.1');await x.get('voice-refs').fire('click');
    const old=x.speech.at(-1);x.select('3.1');await x.get('voice-refs').fire('click');
    const current=x.speech.at(-1);assert.notEqual(old,current);
    old.onend();
    assert.equal([...x.timers.values()].filter(t=>t.ms===350).length,0,'Eski oturum yeniden başlatma zamanlayıcısı kurmamalı');
    old.onerror({error:'not-allowed'});
    x.heard(current,'beş nokta bir');assert.equal(x.get('refs').value,'5.1');assert.equal(x.puts.length,0);x.routesClean();
  });
  await test('Contents 1 MB içeriği atladığında aynı SHA blob fallback okunur',async()=>{
    const x=harness({contentsOmit:true});await x.login();x.select('2.1');assert.equal(x.get('add').disabled,false);
    assert.ok(x.calls.some(c=>c.url.includes('/git/blobs/')));
    await edit(x,'2.1','add','114.6');assertDraftPut(x);x.routesClean();
  });
  await test('Blob SHA uyuşmazlığı girişi engeller; hiçbir dosyaya yazı yok',async()=>{
    const x=harness({contentsOmit:true,badBlobSha:true});x.get('token').value='TEST_ONLY_NOT_A_REAL_KEY';await x.get('login').fire('click');
    assert.equal(x.api.runtime.token,'');assert.equal(x.puts.length,0);
    assert.ok(x.get('login-message').className.includes('error'));x.routesClean();
  });
  await test('Hatalı dal/yol yükleme API isteği yapılmadan reddedilir',async()=>{
    const x=harness();const before=x.calls.length;
    await assert.rejects(()=>x.api.loadGitHubFile(draftCore.DRAFT234_PATH,'TEST_ONLY_NOT_A_REAL_KEY','main'));
    assert.equal(x.calls.length,before);assert.equal(x.puts.length,0);x.routesClean();
  });
  const report={sonuc:'PASS_R234_UI_BENZETIM',test_sayisi:tests.length,testler:tests,gercek_ag_cagrisi:0,gercek_github_yazimi:0,gercek_tarayici:'HOLD_SOCKET_EPERM',gorsel_kontrol:'YAPILAMADI',mikrofon:'Yapay SpeechRecognition olayı; gerçek ses doğrulanmadı'};
  mkdirSync(new URL('./qa/',import.meta.url),{recursive:true});writeFileSync(new URL('./qa/R234_UI_BENZETIM_RAPORU.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} catch(error) {
  console.error('FAIL',error.stack||error.message);console.log(JSON.stringify({sonuc:'FAIL_R234_UI_BENZETIM',gecen:tests.length,testler:tests,gercek_github_yazimi:0}));process.exitCode=1;
}
