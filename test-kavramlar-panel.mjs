// Ağsız DOM/API benzetimi. Gerçek tarayıcı, mikrofon veya GitHub yazması yoktur.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const TEST_DAY = '2026-11-07';
const results = [];
const jsonCopy = value => JSON.parse(JSON.stringify(value));

class FakeNode {
  constructor(type = 1, tag = '', ownerDocument = null) {
    this.nodeType = type;
    this.tagName = tag.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.id = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.checked = false;
    this.isConnected = true;
    this._text = '';
    this.innerHTMLWrites = [];
    this.clickInvocations = 0;
    this.files = [];
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(x => !names.includes(x)).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const use = force === undefined ? !this.classList.contains(name) : force;
        this.classList[use ? 'add' : 'remove'](name);
        return use;
      },
    };
  }
  get textContent() { return this.nodeType === 3 ? this._text : this.childNodes.map(x => x.textContent).join(''); }
  set textContent(value) {
    const text = String(value ?? '');
    if (this.nodeType === 3) this._text = text;
    else this.replaceChildren(...(text ? [this.ownerDocument.createTextNode(text)] : []));
  }
  get innerHTML() { return this.textContent; }
  set innerHTML(value) {
    this.innerHTMLWrites.push(String(value));
    if (value === '') this.replaceChildren();
    else throw new Error('QA: UI innerHTML kullanıyor; textContent bekleniyor');
  }
  get children() { return this.childNodes.filter(x => x.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get options() { return this.children.filter(x => x.tagName === 'OPTION'); }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  append(...children) {
    for (const child of children) this.appendChild(child instanceof FakeNode ? child : this.ownerDocument.createTextNode(String(child)));
  }
  prepend(...children) {
    for (const child of children.reverse()) {
      const node = child instanceof FakeNode ? child : this.ownerDocument.createTextNode(String(child));
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.unshift(node);
    }
  }
  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  replaceChildren(...children) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...children);
  }
  remove() { this.parentNode?.removeChild(this); }
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)); }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  matches(selector) {
    if (selector==='*') return this.nodeType===1;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]$/);
    if (attr) return this.getAttribute(attr[1]) !== null && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]);
    return this.tagName === selector.toUpperCase();
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1 && selector.split(',').some(s => child.matches(s.trim()))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(x => x !== listener)); }
  async fire(type, properties = {}) {
    const event = {
      type, target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {}, ...properties,
    };
    for (const listener of this.listeners.get(type) || []) await listener.call(this, event);
    return event;
  }
  async click() { this.clickInvocations++; if (!this.disabled) return this.fire('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  select() {}
  scrollIntoView() {}
  getBoundingClientRect() { return {top:0,left:0,right:400,bottom:80,width:400,height:80,x:0,y:0}; }
}

function plainOffset(root, target, offset) {
  let total = 0, answer = null;
  function visit(node) {
    if (answer !== null) return;
    if (node === target) {
      answer = total + (node.nodeType === 3 ? offset : node.childNodes.slice(0, offset).reduce((n,c) => n+c.textContent.length, 0));
      return;
    }
    if (node.nodeType === 3) total += node.textContent.length;
    else for (const child of node.childNodes) visit(child);
  }
  visit(root);
  if (answer === null) throw new Error('QA range target kök içinde değil');
  return answer;
}

class FakeRange {
  constructor(doc) { this.doc = doc; this.root = doc.body; this.startContainer = doc.body; this.startOffset = 0; this.endContainer = doc.body; this.endOffset = 0; }
  selectNodeContents(node) { this.root = node; this.startContainer = node; this.startOffset = 0; this.endContainer = node; this.endOffset = node.nodeType === 3 ? node.textContent.length : node.childNodes.length; }
  setStart(node, offset) { this.startContainer = node; this.startOffset = offset; }
  setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; }
  cloneRange() { return Object.assign(new FakeRange(this.doc), this); }
  get commonAncestorContainer() {
    let node = this.startContainer;
    while (node && !node.contains(this.endContainer)) node = node.parentNode;
    return node;
  }
  toString() { return this.root.textContent.slice(plainOffset(this.root, this.startContainer, this.startOffset), plainOffset(this.root, this.endContainer, this.endOffset)); }
}

class FakeDocument extends FakeNode {
  constructor() {
    super(9);
    this.ownerDocument = this;
    this.body = this.createElement('body');
    this.documentElement = this.createElement('html');
    this.documentElement.append(this.body);
    this.append(this.documentElement);
    this.activeElement = null;
    this.selection = {rangeCount: 0, toString: () => '', getRangeAt: () => {throw new Error('selection empty');}};
  }
  createElement(tag) { return new FakeNode(1, tag, this); }
  createTextNode(text) { const node = new FakeNode(3, '', this); node._text = String(text); return node; }
  createDocumentFragment() { return new FakeNode(11, '', this); }
  createRange() { return new FakeRange(this); }
  getElementById(id) { return this.querySelector('#' + id); }
  selectIn(node, start, end) {
    const range = this.createRange();
    range.selectNodeContents(node);
    range.setStart(node.firstChild, start);
    range.setEnd(node.firstChild, end);
    this.selection = {rangeCount:1, anchorNode:range.startContainer, anchorOffset:start,
      focusNode:range.endContainer, focusOffset:end, isCollapsed:start === end,
      getRangeAt: () => range, toString: () => range.toString()};
    return range;
  }
  clearSelection() { this.selection = {rangeCount:0,isCollapsed:true,toString:()=>''}; }
}

const CORPUS = { verses: {
  '1:1': {ar:'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'},
  '2:1': {ar:'الٓمٓ'},
  '2:2': {ar:'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ'},
  '3:1': {ar:'الٓمٓ'},
  '4:1': {ar:'يَا أَيُّهَا النَّاسُ اتَّقُوا رَبَّكُمُ'},
  '5:1': {ar:'يَا أَيُّهَا الَّذِينَ آمَنُوا'},
}};
const IDS = {
  'concepts-panel':'section','concepts-context-menu':'div','concepts-transfer':'button',
  'concepts-esma-show':'button','concepts-selection-note':'p',
  'concepts-quick-status':'p',
  'concepts-text':'textarea','concepts-source':'input','concepts-source-note':'p',
  'concepts-note':'textarea','concepts-save':'button','concepts-refresh':'button',
  'concepts-export':'button','concepts-filter':'input','concepts-status-filter':'select',
  'concepts-count':'span','concepts-list':'div','concepts-message':'p','concepts-target':'span',
  'concepts-file-add':'button','concepts-file':'input','concepts-import-preview':'section',
  'concepts-import-summary':'p','concepts-import-list':'div','concepts-import-confirm':'button',
  'concepts-import-cancel':'button','concepts-import-message':'p',
  'main-arabic':'p','main-translation':'p',
};

function makeRemote(initial, core) {
  const remote = {doc:jsonCopy(initial), getStatus:200, putStatus:200, requests:[], puts:[], getGate:null, payloadOverrides:{}, blobOverrides:{}};
  remote.sha = () => createHash('sha1').update(JSON.stringify(remote.doc)).digest('hex');
  remote.fetch = async (url, options = {}) => {
    const target = new URL(url);
    const method = options.method || 'GET';
    assert.equal(target.origin, 'https://api.github.com', 'Yalnız sahte GitHub API adresi kabul edilir');
    if (method==='GET' && target.pathname.startsWith('/repos/Musmur0606/konkordans-veri/git/blobs/')) {
      assert.equal(target.pathname,'/repos/Musmur0606/konkordans-veri/git/blobs/'+remote.sha());
      remote.requests.push({method,path:target.pathname,ref:null});
      return new Response(JSON.stringify({sha:remote.sha(),encoding:'base64',content:Buffer.from(JSON.stringify(remote.doc)).toString('base64'),...remote.blobOverrides}),{status:200});
    }
    assert.equal(target.pathname, '/repos/Musmur0606/konkordans-veri/contents/' + core.CONCEPTS_PATH, 'Yanlış kayıt yolu');
    const record = {method,path:target.pathname,ref:target.searchParams.get('ref')};
    remote.requests.push(record);
    if (method === 'GET') {
      assert.equal(target.searchParams.get('ref'), core.CONCEPTS_BRANCH, 'GET yanlış branch');
      if (remote.getGate) { const gate=remote.getGate; remote.getGate=null; await gate.promise; }
      if (remote.getStatus !== 200) return new Response(JSON.stringify({message:'Simulated read error'}), {status:remote.getStatus});
      return new Response(JSON.stringify({type:'file',path:core.CONCEPTS_PATH,sha:remote.sha(),encoding:'base64',content:Buffer.from(JSON.stringify(remote.doc)).toString('base64'),...remote.payloadOverrides}), {status:200});
    }
    assert.equal(method, 'PUT', 'Beklenmeyen ağ yöntemi');
    const body = JSON.parse(options.body);
    assert.equal(body.branch, core.CONCEPTS_BRANCH, 'PUT yanlış branch');
    assert.equal(body.sha, remote.sha(), 'PUT stale SHA');
    record.branch = body.branch;
    remote.puts.push({path:target.pathname,branch:body.branch,sha:body.sha,doc:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))});
    if (remote.putStatus !== 200) return new Response(JSON.stringify({message:'Simulated write conflict'}), {status:remote.putStatus});
    remote.doc = jsonCopy(remote.puts.at(-1).doc);
    return new Response(JSON.stringify({content:{sha:remote.sha(),path:core.CONCEPTS_PATH},commit:{sha:'b'.repeat(40)}}), {status:200});
  };
  remote.blockNextGet = () => {
    let resolve;
    const promise = new Promise(r=>{resolve=r;});
    remote.getGate = {promise,resolve};
    return resolve;
  };
  return remote;
}

let sessionNumber = 0;
let CORE;
async function harness({selected='2.2', initial=null, authorized=true, corpus=CORPUS, onEsmaSelected=null} = {}) {
  const doc = new FakeDocument();
  const nodes = {};
  for (const [id, tag] of Object.entries(IDS)) {
    const node=doc.createElement(tag); node.id=id; nodes[id]=node;
    if (id==='concepts-panel' || id.startsWith('main-')) doc.body.append(node);
    else nodes['concepts-panel'].append(node);
  }
  nodes['concepts-context-menu'].append(nodes['concepts-transfer'],nodes['concepts-esma-show'],nodes['concepts-selection-note']);
  nodes['concepts-import-preview'].append(nodes['concepts-import-summary'],nodes['concepts-import-list'],nodes['concepts-import-confirm'],nodes['concepts-import-cancel']);
  nodes['concepts-file'].type='file';nodes['concepts-import-preview'].hidden=true;
  nodes['concepts-status-filter'].value='all';
  nodes['concepts-context-menu'].hidden=true;
  const ctx={token:authorized?'FAKE_QA_KEY_DO_NOT_SEND':'',actor:authorized?'Musmur0606':'',corpus,selected,busy:false};
  const shownVerse=corpus.verses[selected.replace('.',':')];
  nodes['main-arabic'].textContent=shownVerse.arh||shownVerse.ar;
  nodes['main-translation'].textContent='Rahmân ve Rahîm olan Allah’ın adıyla';
  const remote=makeRemote(initial || CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z'),CORE);
  const win = new FakeNode(0,'',doc);
  win.getSelection = () => doc.selection;
  win.scrollX=0;win.scrollY=0;
  win.crypto=webcrypto;
  const confirmations=[];
  const confirm=message=>{confirmations.push(String(message));return true;};
  win.confirm=confirm;
  const clipboard={text:'',reads:0,writes:[],readDenied:false,writeDenied:false,readGate:null,writeGate:null};
  const clipboardAPI={
    async readText() {
      clipboard.reads+=1;
      const snapshot=clipboard.text;
      if(clipboard.readGate) {const gate=clipboard.readGate;clipboard.readGate=null;await gate.promise;}
      if(clipboard.readDenied) throw new Error('NotAllowedError: Clipboard read denied');
      return snapshot;
    },
    async writeText(text) {
      clipboard.writes.push(String(text));
      if(clipboard.writeGate) {const gate=clipboard.writeGate;clipboard.writeGate=null;await gate.promise;}
      if(clipboard.writeDenied) throw new Error('NotAllowedError: Clipboard write denied');
      clipboard.text=String(text);
    },
  };
  clipboard.blockRead=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});clipboard.readGate={promise,resolve};return resolve;};
  clipboard.blockWrite=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});clipboard.writeGate={promise,resolve};return resolve;};
  Object.assign(globalThis,{document:doc,window:win,fetch:remote.fetch,confirm,Node:{ELEMENT_NODE:1,TEXT_NODE:3},HTMLElement:FakeNode,Element:FakeNode});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:clipboardAPI}});
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
  const module=await import(pathToFileURL(join(DIR,'mutesabih-kavramlar.mjs')).href+'?qa='+ ++sessionNumber);
  const busyEvents=[];
  const panel=module.initConceptPanel({getContext:()=>ctx,setBusy:value=>{ctx.busy=value;busyEvents.push(value);},onEsmaSelected});
  const api={doc,nodes,ctx,remote,panel,confirmations,busyEvents,clipboard,
    $:id=>nodes[id],
    async input(id,value) { nodes[id].value=value; await nodes[id].fire('input'); },
    async select(text,host=nodes['main-arabic']) {
      const start=host.textContent.indexOf(text);
      assert(start>=0,'QA seçim metni kaynakta bulunmalı');
      doc.selectIn(host,start,start+text.length);
      await doc.fire('selectionchange');
      return host.fire('contextmenu',{button:2,clientX:160,clientY:100});
    },
    async transfer(text) {
      await api.select(text);
      await nodes['concepts-transfer'].click();await settle();
    },
    async switchVerse(value) {ctx.selected=value;const verse=corpus.verses[value.replace('.',':')];nodes['main-arabic'].textContent=verse.arh||verse.ar;doc.clearSelection();await panel.syncAuth();},
  };
  return api;
}

async function settle() { await new Promise(resolve=>setTimeout(resolve,0)); await new Promise(resolve=>setTimeout(resolve,0)); }

async function test(name, fn) {
  try { await fn(); results.push({name,status:'PASS'}); console.log('PASS',name); }
  catch (error) { results.push({name,status:'FAIL',message:error.message,stack:error.stack}); console.error('FAIL',name,error.message); }
}

// Önceki 41 sağtık/manuel senaryosu korunur; dosya aktarımı ayrı bölümde ölçülür.
async function main() {
  CORE = await import(pathToFileURL(join(DIR,'mutesabih-kavramlar-core.mjs')).href);
  await runTests();
  await runHasenatTests();
  const regressionCount=results.length;
  await runFileImportTests();
  const report={date:TEST_DAY,test_type:'AGSIZ_DOM_API_BENZETIMI',real_browser:'HOLD_NOT_RUN',real_github_writes:0,
    limitations:['Küçük DOM/Range/Selection benzetimidir; gerçek tarayıcı ve dosya seçicisi görsel testi değildir.','Tüm API istekleri bellekte karşılanır; gerçek dosya aktarımı, mikrofon ve canlı GitHub yazması yapılmaz.'],
    regression:{total:regressionCount,passed:results.slice(0,regressionCount).filter(r=>r.status==='PASS').length},
    file_import:{total:results.length-regressionCount,passed:results.slice(regressionCount).filter(r=>r.status==='PASS').length},
    product_hashes: Object.fromEntries(await Promise.all(['mutesabih-kavramlar-core.mjs','mutesabih-kavramlar.mjs','mutesabih-kavramlar-import.mjs'].map(async name=>[name,createHash('sha256').update(await readFile(join(DIR,name))).digest('hex')]))),
    passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,tests:results};
  report.run_at_utc=new Date().toISOString();
  const reportPath=process.env.HASENAT_QA_OUTPUT||join(DIR,'KAVRAMLAR_PANEL_DOSYA_R2_QA_RAPORU.json');
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,regression:report.regression,file_import:report.file_import,report:reportPath}));
  if(report.failed) process.exitCode=1;
}

async function runTests() {
  const authorize=async h=>{await h.panel.onAuthorized();await settle();assert.equal(h.panel.available,true);};
  const save=async h=>{await h.$('concepts-save').click();await settle();};
  const noPuts=h=>assert.equal(h.remote.puts.length,0);
  const input=h=>h.$('concepts-text').value;
  const snapshot=h=>({text:input(h),source:h.$('concepts-source').value,note:h.$('concepts-note').value});
  const msg=h=>h.$('concepts-message').textContent+' '+h.$('concepts-quick-status').textContent+' '+h.$('concepts-source-note').textContent;
  const listButton=(h,pattern)=>{
    const button=h.$('concepts-list').querySelectorAll('button').find(x=>pattern.test(x.textContent));
    assert(button,'Liste düğmesi bulunmalı: '+pattern);return button;
  };
  const changeRemote=h=>{
    h.remote.doc=CORE.addConcept(h.remote.doc,{arabicText:'الٓمٓ',note:'Başka oturum',source:null},'other-user',CORPUS).doc;
  };
  const fillDraft=async h=>{
    await h.input('concepts-text','لَا رَيْبَ');
    await h.input('concepts-source','2.2');
    await h.input('concepts-note','Elle girilen not korunmalı');
    return snapshot(h);
  };

  await test('Başlangıç ve yetkilendirme yazma veya clipboard erişimi başlatmaz',async()=>{
    const h=await harness();await authorize(h);
    noPuts(h);assert.equal(h.clipboard.reads,0);assert.equal(h.clipboard.writes.length,0);
    assert.equal(h.remote.requests.filter(x=>x.method==='GET').length,1);
  });
  await test('Eklenen tüm kavramlar: 150 sınırı yok, arşivle birlikte tam liste varsayılan görünür',async()=>{
    let initial=CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z');
    for(let i=1;i<=151;i++)initial=CORE.addConcept(initial,
      {arabicText:'كِتَاب '+i,note:'',source:null},'Musmur0606',CORPUS,
      TEST_DAY+'T12:01:00.000Z').doc;
    initial=CORE.archiveConcept(initial,initial.records[0].id,'','Musmur0606',
      TEST_DAY+'T12:02:00.000Z').doc;
    const h=await harness({initial});await authorize(h);
    assert.equal(h.$('concepts-status-filter').value,'all');
    assert.equal(h.$('concepts-list').querySelectorAll('article').length,151,
      '151 kavramın tamamı gösterilmeli; ilk 150 kesilmemeli');
    assert.match(h.$('concepts-count').textContent,/151 kavram gösteriliyor.*150 etkin, 1 arşivde/);
    assert(h.$('concepts-list').textContent.includes('كِتَاب 151'));
    assert(h.$('concepts-list').textContent.includes('Arşivde'));
    h.$('concepts-status-filter').value='active';await h.$('concepts-status-filter').fire('change');
    assert.equal(h.$('concepts-list').querySelectorAll('article').length,150);
    h.$('concepts-status-filter').value='all';await h.$('concepts-status-filter').fire('change');
    assert.equal(h.$('concepts-list').querySelectorAll('article').length,151);
    noPuts(h);
  });
  await test('Geçerli Arapça sağtık menüyü açar; yalnız menü açmak kayıt yapmaz',async()=>{
    const h=await harness();await authorize(h);const event=await h.select('الْكِتَابُ');
    assert.equal(event.defaultPrevented,true);assert.equal(h.$('concepts-context-menu').hidden,false);
    assert.match(h.$('concepts-transfer').textContent||'Kavram veri setine aktar',/Kavram/);
    noPuts(h);assert.equal(input(h),'');assert.equal(h.clipboard.reads,0);assert.equal(h.clipboard.writes.length,0);
  });
  await test('Esmâ seçeneği seçilen ibareyi ve ana âyeti iletir; hiçbir veri setine yazmaz',async()=>{
    const selections=[];
    const h=await harness({onEsmaSelected:async selection=>{selections.push(selection);return 'Esmâ sonuçları gösterildi.';}});
    await authorize(h);
    await h.select('الْكِتَابُ');
    assert.equal(h.$('concepts-esma-show').disabled,false);
    await h.$('concepts-esma-show').click();await settle();
    assert.equal(selections.length,1);
    assert.equal(selections[0].text,'الْكِتَابُ');
    assert.equal(selections[0].source.verse,'2.2');
    assert.equal(h.$('concepts-context-menu').hidden,true);
    assert.match(h.$('concepts-quick-status').textContent,/Esmâ sonuçları/);
    assert.equal(h.remote.puts.length,0);
  });
  await test('Aktar öğesi açık tıklamayla doğrudan kaydeder; OK gerekmez; kaynak UTF16 doğrudur',async()=>{
    const h=await harness();await authorize(h);const word='الْكِتَابُ';
    await h.transfer(word);assert.equal(h.remote.puts.length,1);assert.equal(h.remote.doc.records.length,1);
    const record=h.remote.doc.records[0],source=record.sources[0],start=CORPUS.verses['2:2'].ar.indexOf(word);
    assert.equal(record.arabic_text,word);assert.equal(source.verse,'2.2');assert.equal(source.start,start);
    assert.equal(source.end,start+word.length);assert.equal(source.origin,'admin_selection');
    assert.deepEqual(record.notes,[]);CORE.assertConceptHistory(h.remote.doc,CORPUS);
  });
  await test('Yeni eklenen kavram filtreye takılmaz; Tümü görünümünde kayıt en üstte görülür',async()=>{
    const h=await harness();await authorize(h);
    h.$('concepts-status-filter').value='archived';await h.$('concepts-status-filter').fire('change');
    await h.input('concepts-filter','eşleşmez');
    await h.transfer('الْكِتَابُ');
    assert.equal(h.$('concepts-status-filter').value,'all');
    assert.equal(h.$('concepts-filter').value,'');
    assert.match(h.$('concepts-count').textContent,/1 kavram gösteriliyor.*1 etkin, 0 arşivde/);
    assert.equal(h.$('concepts-list').querySelectorAll('article').length,1);
    assert.match(h.$('concepts-list').textContent,/الْكِتَابُ/);
    assert.equal(h.remote.puts.length,1);
  });
  await test('Sağtık aktarımı form metni/kaynağı/notunu kullanmaz veya silmez',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);await h.transfer('الْكِتَابُ');
    assert.equal(h.remote.puts.length,1);assert.deepEqual(snapshot(h),before);
    assert.equal(h.remote.doc.records[0].arabic_text,'الْكِتَابُ');assert.deepEqual(h.remote.doc.records[0].notes,[]);
  });
  await test('Türkçe meâl seçiminin sağtık menüsü yerel kalır; kavrama aktarılmaz',async()=>{
    const h=await harness();await authorize(h);const event=await h.select('Rahmân',h.$('main-translation'));
    assert.equal(event.defaultPrevented,false);assert.equal(h.$('concepts-context-menu').hidden,true);
    await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
  });
  await test('Seçim yokken sağtık özel menü açmaz ve yerel menüyü engellemez',async()=>{
    const h=await harness();await authorize(h);h.doc.clearSelection();
    const event=await h.$('main-arabic').fire('contextmenu',{button:2,clientX:30,clientY:30});
    assert.equal(event.defaultPrevented,false);assert.equal(h.$('concepts-context-menu').hidden,true);
    await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
  });
  await test('Kavram giriş kutusunun normal sağtık davranışı korunur',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الٓمٓ');
    const event=await h.$('concepts-text').fire('contextmenu',{button:2});
    assert.equal(event.defaultPrevented,false);noPuts(h);
  });
  await test('Escape ve menü dışına tıklama aktarımı iptal eder',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');
    await h.doc.fire('keydown',{key:'Escape'});assert.equal(h.$('concepts-context-menu').hidden,true);
    await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
    await h.select('الْكِتَابُ');await h.doc.fire('mousedown',{target:h.doc.body,button:0});
    assert.equal(h.$('concepts-context-menu').hidden,true);
    await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
  });
  await test('Menü açıldıktan sonra ana âyet değişirse eski seçim yeni âyete yazılmaz',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');await h.switchVerse('4.1');
    await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
  });
  await test('Aynı âyette seçim değişirse aktarılan kaynak menünün snapshotı dışında değişmez',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');
    const word='لَا رَيْبَ',start=h.$('main-arabic').textContent.indexOf(word);
    h.doc.selectIn(h.$('main-arabic'),start,start+word.length);await h.doc.fire('selectionchange');
    await h.$('concepts-transfer').fire('click');await settle();
    for(const record of h.remote.doc.records)assert.equal(record.arabic_text,'الْكِتَابُ');
    assert(h.remote.puts.length<=1);
  });
  await test('2,3,4 ve diğer sûrelerde tek kavram branch/path kullanılır; R234 yönünden bağımsızdır',async()=>{
    for(const selected of ['2.1','3.1','4.1','5.1']){
      const h=await harness({selected});await authorize(h);await h.transfer(CORPUS.verses[selected.replace('.',':')].ar);
      assert.equal(h.remote.puts.length,1,selected+' kaydı');
      assert.equal(h.remote.puts[0].branch,'calisma-kavramlar');
      assert.equal(h.remote.puts[0].path,'/repos/Musmur0606/konkordans-veri/contents/data/kavramlar-calisma.json');
      assert(h.remote.requests.every(x=>x.ref==='calisma-kavramlar'||x.method==='PUT'));
    }
  });
  await test('Yerel Ctrl+V engellenmez; dış metin eski veya açık âyet kaynağını taşımaz',async()=>{
    const h=await harness();await authorize(h);await fillDraft(h);
    const event=await h.$('concepts-text').fire('paste',{clipboardData:{getData:()=> 'الٓمٓ'}});
    h.$('concepts-text').value='الٓمٓ';await h.$('concepts-text').fire('input');await settle();
    assert.equal(event.defaultPrevented,false);assert.equal(h.$('concepts-source').value,'');noPuts(h);
    await save(h);assert.deepEqual(h.remote.doc.records[0].sources,[]);
  });
  await test('Elle giriş ve kutu tıklaması yazmaz; manuel OK kaynaksız kaydı açıkça oluşturur',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الٓمٓ');
    await h.$('concepts-text').fire('click',{button:0});noPuts(h);await save(h);
    assert.equal(h.remote.puts.length,1);assert.deepEqual(h.remote.doc.records[0].sources,[]);
  });
  await test('Elle belirtilen yanlış âyet metinle eşleşmeden kaydedilemez',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الٓمٓ');await h.input('concepts-source','2.2');
    await save(h);noPuts(h);assert.equal(input(h),'الٓمٓ');assert.match(msg(h),/eşleş|bulun|kaynak|Kaynak/u);
  });
  await test('Elle verilen doğru kaynak tek birebir konumla doğrulanır',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الْكِتَابُ');await h.input('concepts-source','2:2');await save(h);
    const source=h.remote.doc.records[0].sources[0];assert.equal(source.verse,'2.2');assert.equal(source.origin,'manual');
    CORE.assertConceptHistory(h.remote.doc,CORPUS);
  });
  await test('Eksik404 belge kapalı kalır; ana dal fallback veya dosya yaratma yoktur',async()=>{
    const h=await harness();h.remote.getStatus=404;await authorize(h);await h.input('concepts-text','الٓمٓ');
    await h.$('concepts-save').fire('click');await h.select('الْكِتَابُ');await h.$('concepts-transfer').fire('click');await settle();
    noPuts(h);assert.equal(h.$('concepts-save').disabled,true);assert.match(msg(h),/bulun|hazır|yenile/u);
  });
  await test('Yanlış şema ve açık yayın kilidi kapalı kalır',async()=>{
    for(const change of [doc=>{doc.schema='wrong.schema';},doc=>{doc.publication.automatic=true;}]){
      const h=await harness();change(h.remote.doc);await authorize(h);await h.input('concepts-text','الٓمٓ');
      await h.$('concepts-save').fire('click');await settle();noPuts(h);assert.equal(h.$('concepts-save').disabled,true);
    }
  });
  await test('Geçmişle uyuşmayan kayıt kapalı kalır',async()=>{
    const h=await harness();h.remote.doc.records=[{id:'forged'}];await authorize(h);
    await h.input('concepts-text','الٓمٓ');await h.$('concepts-save').fire('click');await settle();noPuts(h);assert.equal(h.$('concepts-save').disabled,true);
  });
  await test('SHA tazelik farkında sağtık aktarımı PUT yapmaz; manuel giriş korunur',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);changeRemote(h);await h.transfer('الْكِتَابُ');
    noPuts(h);assert.deepEqual(snapshot(h),before);assert.match(msg(h),/değiş|güncel|yenile|çakış/u);
  });
  await test('PUT409 kullanıcının metin/kaynak/notunu ve uzaktaki belgeyi korur',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);h.remote.putStatus=409;await save(h);
    assert.equal(h.remote.puts.length,1);assert.equal(h.remote.doc.records.length,0);assert.deepEqual(snapshot(h),before);
    assert.match(msg(h),/409|çakış|değiş|kayded/u);
  });
  await test('Arşivleme ve geri getirme kayıt/kaynak/not geçmişini silmez',async()=>{
    const h=await harness();await authorize(h);await fillDraft(h);await save(h);
    const original=jsonCopy(h.remote.doc.records[0]);await listButton(h,/Arşivle/i).click();await settle();
    assert.equal(h.remote.doc.records.length,1);assert.equal(h.remote.doc.records[0].status,'archived');
    assert.deepEqual(h.remote.doc.records[0].sources,original.sources);assert.deepEqual(h.remote.doc.records[0].notes,original.notes);
    h.$('concepts-status-filter').value='archived';await h.$('concepts-status-filter').fire('change');
    await listButton(h,/Geri getir/i).click();await settle();assert.equal(h.remote.doc.records[0].status,'active');
    assert.deepEqual(h.remote.doc.records[0].sources,original.sources);assert.deepEqual(h.remote.doc.records[0].notes,original.notes);
    assert.deepEqual(h.remote.doc.events.map(x=>x.type),['add','archive','restore']);CORE.assertConceptHistory(h.remote.doc,CORPUS);
  });
  await test('Ana yönetici meşgulken kavram yazması başlamaz',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الٓمٓ');h.ctx.busy=true;await h.panel.syncAuth();
    assert.equal(h.$('concepts-save').disabled,true);await h.$('concepts-save').fire('click');
    await h.select('الْكِتَابُ');await h.$('concepts-transfer').fire('click');await settle();noPuts(h);
  });
  await test('Kayıt sırasında alanlar ve aktarım kilitlenir; çifte yazma olmaz',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');const release=h.remote.blockNextGet();
    const saving=h.$('concepts-transfer').click();await settle();
    assert.equal(h.$('concepts-save').disabled,true);assert.equal(h.$('concepts-text').disabled,true);assert.equal(h.ctx.busy,true);
    await h.$('concepts-transfer').fire('click');await settle();release();await saving;await settle();
    assert.equal(h.remote.puts.length,1);assert.equal(h.ctx.busy,false);
  });
  await test('Yükleme sırasında çıkış geç cevabın paneli yeniden açmasını engeller',async()=>{
    const h=await harness();const release=h.remote.blockNextGet();const loading=h.panel.onAuthorized();await settle();
    h.ctx.token='';h.ctx.actor='';h.panel.onLogout();release();await loading;await settle();
    assert.equal(h.$('concepts-save').disabled,true);assert.equal(h.$('concepts-list').textContent,'');noPuts(h);
  });
  await test('Sağtık kayıt tazelik kontrolünde çıkış yapılırsa PUT gönderilmez',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');const release=h.remote.blockNextGet();
    const saving=h.$('concepts-transfer').click();await settle();h.ctx.token='';h.ctx.actor='';h.panel.onLogout();release();await saving;await settle();noPuts(h);
  });
  await test('Notlardaki HTML olay işleyicileri yalnız textContent ile görünür',async()=>{
    const h=await harness();await authorize(h);await h.input('concepts-text','الٓمٓ');
    const danger='<img src=x onerror="globalThis.QA_XSS=1"> <script>boom()</script>';
    await h.input('concepts-note',danger);await save(h);assert.equal(h.remote.doc.records[0].notes[0].text,danger);
    assert(h.$('concepts-list').textContent.includes(danger));assert.equal(h.$('concepts-list').querySelectorAll('img,script').length,0);
    assert.equal(globalThis.QA_XSS,undefined);assert.equal(h.doc.querySelectorAll('*').flatMap(x=>x.innerHTMLWrites).filter(Boolean).length,0);
  });
  await test('Yenileme kaydedilmemiş metin/kaynak/notu silmez',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);await h.panel.refresh();await settle();assert.deepEqual(snapshot(h),before);noPuts(h);
  });
  await test('Yetkisiz panel yazma veya okuma isteği oluşturmaz',async()=>{
    const h=await harness({authorized:false});await h.input('concepts-text','الٓمٓ');
    await h.$('concepts-save').fire('click');await h.select('الْكِتَابُ');await h.$('concepts-transfer').fire('click');await settle();
    assert.equal(h.remote.requests.length,0);assert.equal(h.$('concepts-save').disabled,true);noPuts(h);
  });
  await test('Türkçe veya karışık Latin kavram girişi kaydedilmez',async()=>{
    for(const value of ['rahmet','اللَّهُ test']){
      const h=await harness();await authorize(h);await h.input('concepts-text',value);await h.$('concepts-save').fire('click');await settle();noPuts(h);assert.equal(input(h),value);
    }
  });
  await test('İç içe Arapça DOM düğümlerinde seçim UTF16 sınırı doğrudur',async()=>{
    const h=await harness();await authorize(h);const main=h.$('main-arabic'),word='الْكِتَابُ',raw=main.textContent,start=raw.indexOf(word);
    const span=h.doc.createElement('span');span.textContent=word;
    main.replaceChildren(h.doc.createTextNode(raw.slice(0,start)),span,h.doc.createTextNode(raw.slice(start+word.length)));
    const range=h.doc.createRange();range.selectNodeContents(main);range.setStart(span.firstChild,0);range.setEnd(span.firstChild,word.length);
    h.doc.selection={rangeCount:1,isCollapsed:false,getRangeAt:()=>range,toString:()=>range.toString()};
    await main.fire('contextmenu',{button:2,clientX:120,clientY:100});await h.$('concepts-transfer').click();await settle();
    assert.equal(h.remote.doc.records[0].arabic_text,word);assert.equal(h.remote.doc.records[0].sources[0].start,start);
    assert.equal(h.remote.doc.records[0].sources[0].end,start+word.length);
  });
  await test('Sağtık raw seçim kenar boşluklarını ve kaynak dilimini birebir korur',async()=>{
    const h=await harness();await authorize(h);const text=' الْكِتَابُ ';await h.transfer(text);
    const record=h.remote.doc.records[0],start=CORPUS.verses['2:2'].ar.indexOf(text);
    assert.equal(record.arabic_text,text);assert.equal(record.sources[0].start,start);assert.equal(record.sources[0].end,start+text.length);
  });
  await test('Büyük belge contents boşsa aynı SHA blob üzerinden okunur',async()=>{
    const h=await harness();h.remote.payloadOverrides={encoding:'none',content:''};await authorize(h);
    assert.equal(h.$('concepts-panel').dataset.ready,'true');assert(h.remote.requests.some(x=>x.path.includes('/git/blobs/')));
    await h.transfer('الْكِتَابُ');assert.equal(h.remote.puts.length,1);
  });
  await test('Büyük belge blob SHA uyuşmazlığı kapalı kalır',async()=>{
    const h=await harness();h.remote.payloadOverrides={encoding:'none',content:''};h.remote.blobOverrides={sha:'f'.repeat(40)};
    await authorize(h);await h.input('concepts-text','الٓمٓ');await h.$('concepts-save').fire('click');await settle();noPuts(h);
    assert.equal(h.$('concepts-save').disabled,true);
  });
  await test('Yanlış metadata path veya kısa SHA kayıt açamaz',async()=>{
    for(const overrides of [{path:'data/mutesabih-degisiklikler.json'},{sha:'short'}]){
      const h=await harness();h.remote.payloadOverrides=overrides;await authorize(h);await h.input('concepts-text','الٓمٓ');
      await h.$('concepts-save').fire('click');await settle();noPuts(h);assert.equal(h.$('concepts-save').disabled,true);
    }
  });
  await test('Arşivleme onayı iptal edilirse kullanıcı kaydı korunur',async()=>{
    const h=await harness();await authorize(h);await h.transfer('الْكِتَابُ');const before=jsonCopy(h.remote.doc),puts=h.remote.puts.length;
    window.confirm=()=>false;await listButton(h,/Arşivle/i).click();await settle();assert.equal(h.remote.puts.length,puts);assert.deepEqual(h.remote.doc,before);
  });
  await test('Bekleyen kayıt sırasında ana âyet değişse bile kaynak başka âyete çevrilmez',async()=>{
    const h=await harness();await authorize(h);await h.select('الْكِتَابُ');const release=h.remote.blockNextGet();
    const saving=h.$('concepts-transfer').click();await settle();await h.switchVerse('4.1');release();await saving;await settle();
    for(const record of h.remote.doc.records){assert.equal(record.arabic_text,'الْكِتَابُ');assert.equal(record.sources[0].verse,'2.2');}
    assert(h.remote.puts.length<=1);
  });
  await test('Eksik clipboardAPI sağtık aktarımını etkilemez ve pano okunmaz',async()=>{
    const h=await harness();await authorize(h);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
    await h.transfer('الْكِتَابُ');assert.equal(h.remote.puts.length,1);assert.equal(h.clipboard.reads,0);assert.equal(h.clipboard.writes.length,0);
  });
  await test('Aynı Arapça ifade iki âyette tek kayıtta birikir; not ve eski kaynak kaybolmaz',async()=>{
    const h=await harness({selected:'2.1'});await authorize(h);await h.transfer('الٓمٓ');
    await h.input('concepts-text','الٓمٓ');await h.input('concepts-note','Araştırmacı notu korunmalı');await save(h);
    await h.switchVerse('3.1');await h.transfer('الٓمٓ');
    assert.equal(h.remote.doc.records.length,1);const record=h.remote.doc.records[0];
    assert.deepEqual(record.sources.map(x=>x.verse),['2.1','3.1']);
    assert.deepEqual(record.notes.map(x=>x.text),['Araştırmacı notu korunmalı']);
    const before=jsonCopy(h.remote.doc),puts=h.remote.puts.length;await h.transfer('الٓمٓ');
    assert.equal(h.remote.puts.length,puts);assert.deepEqual(h.remote.doc,before);CORE.assertConceptHistory(h.remote.doc,CORPUS);
  });
  await test('Erişim403 reddinde hiçbir hedefe yazma veya fallback yapılmaz',async()=>{
    const h=await harness();h.remote.getStatus=403;await authorize(h);await h.input('concepts-text','الٓمٓ');
    await h.$('concepts-save').fire('click');await h.select('الْكِتَابُ');await h.$('concepts-transfer').fire('click');await settle();
    noPuts(h);assert(h.remote.requests.every(x=>x.method==='GET'&&x.ref==='calisma-kavramlar'));
    assert.equal(h.$('concepts-save').disabled,true);
  });
  await test('Belgede kayıtlı kaynak güncel corpus dilimiyle uyuşmazsa yükleme kapalı kalır',async()=>{
    const h=await harness();const text='الْكِتَابُ',start=CORPUS.verses['2:2'].ar.indexOf(text);
    h.remote.doc=CORE.addConcept(h.remote.doc,{arabicText:text,note:'',source:{verse:'2.2',start,end:start+text.length,origin:'admin_selection'}},'Musmur0606',CORPUS).doc;
    h.ctx.corpus=jsonCopy(CORPUS);h.ctx.corpus.verses['2:2'].ar='مَتْنٌ مُخْتَلِفٌ';
    await authorize(h);await h.input('concepts-text','الٓمٓ');await h.$('concepts-save').fire('click');await settle();
    noPuts(h);assert.equal(h.$('concepts-save').disabled,true);
  });
  await test('JSON dışa aktarımı etkin/arşivdeki tüm kayıtları ve geçmişi korur; APIye yazmaz',async()=>{
    let initial=CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z');
    initial=CORE.addConcept(initial,{arabicText:'الٓمٓ',note:'İlk kayıt',source:null},'Musmur0606',CORPUS).doc;
    initial=CORE.addConcept(initial,{arabicText:'لَا رَيْبَ',note:'İkinci kayıt',source:null},'Musmur0606',CORPUS).doc;
    initial=CORE.archiveConcept(initial,initial.records[0].id,'Arşiv notu','Musmur0606').doc;
    const h=await harness({initial});await authorize(h);let captured=null;
    const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
    try {
      URL.createObjectURL=blob=>{captured=blob;return 'blob:qa-export';};URL.revokeObjectURL=()=>{};
      await h.$('concepts-export').click();await settle();assert(captured instanceof Blob);
      assert.deepEqual(JSON.parse(await captured.text()),initial);noPuts(h);
    }finally{URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
  });
}
function deferred() {
  let release;
  const promise=new Promise(resolve=>{release=resolve;});
  return {promise,release};
}

function dummyFile(name,content,{size,gate,readError}={}) {
  const bytes=typeof content==='string'?new TextEncoder().encode(content):Uint8Array.from(content);
  return {name,size:size??bytes.byteLength,readCalls:0,
    sha256:createHash('sha256').update(bytes).digest('hex'),
    async arrayBuffer(){this.readCalls++;if(gate)await gate.promise;if(readError)throw new Error(readError);return bytes.slice().buffer;}};
}

async function runHasenatTests() {
  const full=JSON.parse(await readFile(join(DIR,'app_data.json'),'utf8'));
  const corpus={verses:{'2:6':full.verses['2:6'],'2:219':full.verses['2:219']}};
  const shown='تُنْذِرْھُمْ',original=corpus.verses['2:6'].ar;
  const authorize=async h=>{await h.panel.onAuthorized();await settle();};
  await test('HASENAT: sağtık aktarımı görünen ham metni ve arh konumunu kaydeder',async()=>{
    const h=await harness({selected:'2.6',corpus});await authorize(h);
    await h.transfer(shown);
    assert.equal(h.remote.puts.length,1);
    const record=h.remote.doc.records[0],source=record.sources[0];
    assert.equal(record.arabic_text,shown);
    assert.equal(source.text_field,'arh');
    assert.equal(corpus.verses['2:6'].arh.slice(source.start,source.end),shown);
    CORE.assertConceptHistory(h.remote.doc,corpus);
    assert.equal(h.remote.puts[0].branch,CORE.CONCEPTS_BRANCH);
  });
  await test('HASENAT: eski ar kaynak kaydı yeni seçim eklenince aynen korunur',async()=>{
    const old=CORE.addConcept(CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z'),
      {arabicText:original,source:{verse:'2.6',start:0,end:original.length,origin:'manual'}},
      'Musmur0606',corpus,TEST_DAY+'T12:01:00.000Z').doc;
    const before=JSON.stringify(old.records[0]),event=JSON.stringify(old.events[0]);
    const h=await harness({selected:'2.6',corpus,initial:old});await authorize(h);await h.transfer(shown);
    assert.equal(h.remote.puts.length,1);
    assert.equal(JSON.stringify(h.remote.doc.records[0]),before);
    assert.equal(JSON.stringify(h.remote.doc.events[0]),event);
    CORE.assertConceptHistory(h.remote.doc,corpus);
  });
  await test('HASENAT: elle yapıştırılan yeni ifade tek konumuyla doğrulanır',async()=>{
    const h=await harness({selected:'2.6',corpus});await authorize(h);
    await h.input('concepts-text',shown);await h.input('concepts-source','2.6');
    await h.$('concepts-save').click();await settle();
    assert.equal(h.remote.puts.length,1);
    assert.equal(h.remote.doc.records[0].sources[0].text_field,'arh');
    CORE.assertConceptHistory(h.remote.doc,corpus);
  });
  await test('HASENAT: âyet değişince eski sağtık seçimi başka âyete kaydedilmez',async()=>{
    const h=await harness({selected:'2.6',corpus});await authorize(h);
    await h.select(shown);await h.switchVerse('2.219');
    await h.$('concepts-transfer').click();await settle();
    assert.equal(h.remote.puts.length,0);
  });
}

async function runFileImportTests() {
  const authorize=async h=>{await h.panel.onAuthorized();await settle();};
  const noPuts=h=>assert.equal(h.remote.puts.length,0);
  const input=h=>h.$('concepts-text').value;
  const snapshot=h=>({text:input(h),source:h.$('concepts-source').value,note:h.$('concepts-note').value});
  const preview=h=>h.$('concepts-import-preview');
  const confirm=h=>h.$('concepts-import-confirm');
  const importMsg=h=>h.$('concepts-import-message').textContent+' '+h.$('concepts-message').textContent;
  const selectFiles=(h,files)=>{
    h.$('concepts-file').files=files;h.$('concepts-file').value=files.length?'C:\\fakepath\\'+files[0].name:'';
    return h.$('concepts-file').fire('change');
  };
  const load=async(h,file)=>{await selectFiles(h,[file]);await settle();};
  const commit=async h=>{await confirm(h).click();await settle();};
  const fillDraft=async h=>{
    await h.input('concepts-text','لَا رَيْبَ');await h.input('concepts-source','2.2');
    await h.input('concepts-note','Başka formun korunacak notu');return snapshot(h);
  };
  const twoText='الْكِتَابُ\nلَا رَيْبَ';
  const assertNoSource=doc=>{for(const record of doc.records)assert.deepEqual(record.sources,[]);};
  const assertClosed=h=>{noPuts(h);assert.equal(confirm(h).disabled,true);assert.equal(preview(h).hidden,true);};

  await test('DOSYA: Dosya ekle yalnız açık tıklamayla dosya seçicisini çağırır; yazma yapmaz',async()=>{
    const h=await harness();await authorize(h);assert.equal(h.$('concepts-file').clickInvocations,0);
    await h.$('concepts-file-add').click();await settle();assert.equal(h.$('concepts-file').clickInvocations,1);
    assert.equal(preview(h).hidden,true);noPuts(h);
  });
  await test('DOSYA: TXT iki harekeli kelime grubu yalnız önizlenir; onay öncesi belge değişmez',async()=>{
    const h=await harness();await authorize(h);const before=jsonCopy(h.remote.doc),file=dummyFile('kavramlar.txt',twoText);
    await load(h,file);assert.equal(preview(h).hidden,false);assert.equal(confirm(h).disabled,false);noPuts(h);
    assert.equal(h.$('concepts-import-list').textContent.includes('الْكِتَابُ'),true);
    assert.equal(h.$('concepts-import-list').textContent.includes('لَا رَيْبَ'),true);
    assert(h.$('concepts-import-list').textContent.includes(file.sha256));assert.deepEqual(h.remote.doc,before);
    assert.match(importMsg(h),/Henüz|kontrol|OK|kaydedilmedi/u);
  });
  await test('DOSYA: Açık onay bütün TXT kavramlarını tek atomik PUT ile ayrı hedefe kaydeder',async()=>{
    const h=await harness();await authorize(h);const file=dummyFile('kavramlar.txt',twoText);await load(h,file);await commit(h);
    assert.equal(h.remote.puts.length,1);assert.deepEqual(h.remote.doc.records.map(x=>x.arabic_text),twoText.split('\n'));
    assertNoSource(h.remote.doc);assert.equal(preview(h).hidden,true);
    for(const record of h.remote.doc.records){assert(record.notes.some(x=>x.text.includes(file.name)&&x.text.includes(file.sha256)));}
    assert.equal(h.remote.puts[0].branch,'calisma-kavramlar');assert(h.remote.puts[0].path.endsWith('/data/kavramlar-calisma.json'));
    CORE.assertConceptHistory(h.remote.doc,CORPUS);
  });
  await test('DOSYA: CSV tırnaklı virgüllü notları Arapça metinle korur; âyet kaynağı uydurmaz',async()=>{
    const h=await harness();await authorize(h);const file=dummyFile('kavramlar.csv','kavram,not\nالْكِتَابُ,"Not, açıklama"\nلَا رَيْبَ,İkinci not');
    await load(h,file);noPuts(h);await commit(h);assert.equal(h.remote.puts.length,1);assertNoSource(h.remote.doc);
    assert(h.remote.doc.records[0].notes.some(x=>x.text.includes('Not, açıklama')));
    assert(h.remote.doc.records[1].notes.some(x=>x.text.includes('İkinci not')));
  });
  await test('DOSYA: JSON metin ve nesne dizileri ayrı örneklerde doğru alınır',async()=>{
    for(const text of [JSON.stringify(['الْكِتَابُ','لَا رَيْبَ']),JSON.stringify([{arabic_text:'الْكِتَابُ',note:'JSON özel notu'},{arabic_text:'لَا رَيْبَ'}])]){
      const h=await harness();await authorize(h);await load(h,dummyFile('kavramlar.json',text));noPuts(h);await commit(h);
      assert.deepEqual(h.remote.doc.records.map(x=>x.arabic_text),twoText.split('\n'));assertNoSource(h.remote.doc);assert.equal(h.remote.puts.length,1);
    }
  });
  await test('DOSYA: İptal önizlemeyi temizler; geç veya doğrudan onay olayı yazamaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('kavramlar.txt',twoText));
    await h.$('concepts-import-cancel').click();await settle();assertClosed(h);assert.equal(h.$('concepts-import-list').textContent,'');
    await confirm(h).fire('click');await settle();noPuts(h);
  });
  await test('DOSYA: Önizleme ve onay manuel metin/kaynak/notu değiştirmez veya dosyaya karıştırmaz',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);await load(h,dummyFile('kavramlar.txt',twoText));
    assert.deepEqual(snapshot(h),before);await commit(h);assert.deepEqual(snapshot(h),before);
    assertNoSource(h.remote.doc);assert(h.remote.doc.records.every(x=>x.notes.every(n=>!n.text.includes(before.note))));
  });
  await test('DOSYA: Aynı ad ve aynı baytların yeniden alınması yeni kayıt/olay/PUT oluşturmaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('tekrar.txt',twoText));await commit(h);
    const before=jsonCopy(h.remote.doc),puts=h.remote.puts.length;await load(h,dummyFile('tekrar.txt',twoText));
    assert.equal(preview(h).hidden,false);assert.equal(confirm(h).disabled,true);
    await confirm(h).fire('click');await settle();assert.equal(h.remote.puts.length,puts);assert.deepEqual(h.remote.doc,before);
  });
  await test('DOSYA: Dosya içi tam tekrar tek kimliğe birleşir; hareke farkı ayrı kalır',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('tekrarlar.txt','الْكِتَابُ\nالْكِتَابُ\nالكتاب'));await commit(h);
    assert.equal(h.remote.doc.records.length,2);assert.deepEqual(h.remote.doc.records.map(x=>x.arabic_text),['الْكِتَابُ','الكتاب']);
    assert(h.remote.doc.records[0].notes.some(x=>x.text.includes('1, 2')));assert.equal(h.remote.puts.length,1);
  });
  await test('DOSYA: Arşiv kaydı, önceki kaynakları ve notları korunur; otomatik geri açılmaz',async()=>{
    const text='الْكِتَابُ',start=CORPUS.verses['2:2'].ar.indexOf(text);
    let initial=CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z');
    initial=CORE.addConcept(initial,{arabicText:text,note:'Önceki kaynak notu',source:{verse:'2.2',start,end:start+text.length,origin:'admin_selection'}},'Musmur0606',CORPUS).doc;
    initial=CORE.archiveConcept(initial,initial.records[0].id,'Kullanıcı arşiv kararı','Musmur0606').doc;
    const old=jsonCopy(initial.records[0]),h=await harness({initial});await authorize(h);await load(h,dummyFile('arsiv.txt',twoText));await commit(h);
    const record=h.remote.doc.records.find(x=>x.id===old.id);assert(record);assert.equal(record.status,'archived');assert.deepEqual(record.sources,old.sources);
    for(const note of old.notes)assert(record.notes.some(x=>JSON.stringify(x)===JSON.stringify(note)));
    assert.equal(h.remote.doc.records.length,2);assert.equal(h.remote.doc.events.filter(x=>x.type==='restore').length,0);
  });
  await test('DOSYA: Tek geçersiz Arapça satır bütün dosyayı reddeder; ilk satır bile yazılmaz',async()=>{
    const h=await harness();await authorize(h);const before=jsonCopy(h.remote.doc);await load(h,dummyFile('gecersiz.txt','الْكِتَابُ\nTürkçe kavram'));
    assertClosed(h);assert.deepEqual(h.remote.doc,before);await confirm(h).fire('click');await settle();noPuts(h);
  });
  await test('DOSYA: Desteklenmeyen uzantı boş dosya ve yalnız boşluk ayrı ayrı reddedilir',async()=>{
    for(const file of [dummyFile('kavram.pdf',twoText),dummyFile('bos.txt',''),dummyFile('bosluk.txt','  \r\n\t\n')]){
      const h=await harness();await authorize(h);await load(h,file);assertClosed(h);assert.match(importMsg(h),/Dosya eklenmedi|boş|biçim|satır/u);
    }
  });
  await test('DOSYA: Geçersiz UTF8 hiçbir değiştirme karakteriyle sessiz alınmaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('utf8.txt',[0xD8,0xA7,0xC3,0x28]));
    assertClosed(h);assert.match(importMsg(h),/UTF-8/u);
  });
  await test('DOSYA: 1MB üzeri boyut okumadan engellenir; okunan bayt/bildirilen boyut farkı da reddedilir',async()=>{
    const oversized=dummyFile('buyuk.txt',twoText,{size:1048577});
    let h=await harness();await authorize(h);await load(h,oversized);assertClosed(h);assert.equal(oversized.readCalls,0);
    const mismatch=dummyFile('boyut.txt',twoText,{size:1});h=await harness();await authorize(h);await load(h,mismatch);assertClosed(h);assert.equal(mismatch.readCalls,1);
  });
  await test('DOSYA: Birden çok dosya seçimi sıfır okuma/sıfır yazmayla reddedilir',async()=>{
    const h=await harness();await authorize(h);const files=[dummyFile('a.txt','الحمد'),dummyFile('b.txt','الرحمن')];
    await selectFiles(h,files);await settle();assertClosed(h);assert(files.every(f=>f.readCalls===0));
  });
  await test('DOSYA: 201 dolu satır tekrar olsa bile reddedilir; 200 satır sınırı kabul edilir',async()=>{
    let h=await harness();await authorize(h);await load(h,dummyFile('cok.txt',Array(201).fill('الحمد').join('\n')));assertClosed(h);
    h=await harness();await authorize(h);await load(h,dummyFile('sinir.txt',Array(200).fill('الحمد').join('\n')));
    assert.equal(preview(h).hidden,false);noPuts(h);await commit(h);assert.equal(h.remote.doc.records.length,1);assert.equal(h.remote.puts.length,1);
  });
  await test('DOSYA: Bozuk CSV/JSON, ek kaynak alanı ve toplu çalışma belgesi failclosed reddedilir',async()=>{
    const files=[
      dummyFile('bozuk.csv','kavram,not\nالحمد,"kapanmayan'),
      dummyFile('bozuk.json','["الحمد",'),
      dummyFile('kaynak.json',JSON.stringify([{arabic_text:'الحمد',source:'2.1'}])),
      dummyFile('kaynak.csv','kavram,not,kaynak\nالحمد,Not,2.1'),
      dummyFile('gecmis.json',JSON.stringify(CORE.emptyConceptHistory(TEST_DAY+'T12:00:00.000Z'))),
    ];
    for(const file of files){const h=await harness();await authorize(h);await load(h,file);assertClosed(h);}
  });
  await test('DOSYA: UTF8BOM/CRLF ve noktalı virgüllü CSV güvenli biçimde alınır',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('bom.csv','\uFEFFkavram;not\r\nالحمد;Birinci not\r\nالرحمن;İkinci not\r\n'));
    assert.equal(preview(h).hidden,false);await commit(h);assert.deepEqual(h.remote.doc.records.map(x=>x.arabic_text),['الحمد','الرحمن']);assertNoSource(h.remote.doc);
  });
  await test('DOSYA: Dosyadan gelen HTML notları çalışmaz; textContent olarak saklanır/görünür',async()=>{
    const h=await harness();await authorize(h);const danger='<img src=x onerror=boom()>';
    await load(h,dummyFile('notlar.csv','kavram,not\nالحمد,'+danger));noPuts(h);await commit(h);
    assert(h.remote.doc.records[0].notes.some(x=>x.text.includes(danger)));assert(h.$('concepts-list').textContent.includes(danger));
    assert.equal(h.$('concepts-list').querySelectorAll('img,script').length,0);assert.equal(globalThis.QA_XSS,undefined);
  });
  await test('DOSYA: Okuma sürerken manuel/sağtık/onay kilitlenir; hiçbir eşzamanlı kayıt olmaz',async()=>{
    const h=await harness();await authorize(h);await fillDraft(h);const gate=deferred(),file=dummyFile('bekleyen.txt',twoText,{gate});
    const pending=selectFiles(h,[file]);await settle();
    assert.equal(h.$('concepts-file-add').disabled,true);assert.equal(h.$('concepts-file').disabled,true);assert.equal(h.$('concepts-save').disabled,true);assert.equal(h.$('concepts-text').disabled,true);
    await h.$('concepts-save').fire('click');await h.select('الْكِتَابُ');await h.$('concepts-transfer').fire('click');await confirm(h).fire('click');await settle();noPuts(h);
    gate.release();await pending;await settle();assert.equal(preview(h).hidden,false);assert.equal(h.$('concepts-file-add').disabled,false);noPuts(h);
  });
  await test('DOSYA: Kayıt sürerken başka dosya okunamaz; ikinci PUT başlamaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('ilk.txt',twoText));
    const release=h.remote.blockNextGet(),saving=confirm(h).click();await settle();const second=dummyFile('ikinci.txt','الرحمن');
    assert.equal(h.$('concepts-file-add').disabled,true);await selectFiles(h,[second]);await settle();assert.equal(second.readCalls,0);
    await confirm(h).fire('click');release();await saving;await settle();assert.equal(h.remote.puts.length,1);assert.equal(h.remote.doc.records.length,2);
  });
  await test('DOSYA: Bekleyen ArrayBuffer sırasında çıkış geç cevabın önizleme oluşturmasını engeller',async()=>{
    const h=await harness();await authorize(h);const gate=deferred(),pending=selectFiles(h,[dummyFile('gec.txt',twoText,{gate})]);await settle();
    h.ctx.token='';h.ctx.actor='';h.panel.onLogout();gate.release();await pending;await settle();assertClosed(h);assert.equal(h.$('concepts-import-list').textContent,'');
  });
  await test('DOSYA: Yeni oturum eski dosya okumasını veya hazır önizlemeyi devralmaz',async()=>{
    const h=await harness();await authorize(h);const gate=deferred(),pending=selectFiles(h,[dummyFile('eski.txt',twoText,{gate})]);await settle();
    h.ctx.token='FAKE_RELOGIN_KEY';await h.panel.onAuthorized();gate.release();await pending;await settle();assertClosed(h);
    await load(h,dummyFile('yeni.txt',twoText));assert.equal(preview(h).hidden,false);await h.panel.onAuthorized();await settle();assertClosed(h);
  });
  await test('DOSYA: Okuma sırasında İptal geç cevabı yok sayar; daha yeni dosyanın önizlemesi korunur',async()=>{
    const h=await harness();await authorize(h);const gate=deferred(),pending=selectFiles(h,[dummyFile('eski.txt','الحمد',{gate})]);await settle();
    await h.$('concepts-import-cancel').click();await load(h,dummyFile('yeni.txt','الرحمن'));
    assert(h.$('concepts-import-summary').textContent.includes('yeni.txt'));gate.release();await pending;await settle();
    assert(h.$('concepts-import-summary').textContent.includes('yeni.txt'));assert(!h.$('concepts-import-list').textContent.includes('الحمد'));noPuts(h);
    await commit(h);assert.deepEqual(h.remote.doc.records.map(x=>x.arabic_text),['الرحمن']);
  });
  await test('DOSYA: Yenile hazır önizlemeyi temizler; eski onay ile kayıt yapılamaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('yenile.txt',twoText));await h.panel.refresh();await settle();assertClosed(h);
    await confirm(h).fire('click');await settle();noPuts(h);
  });
  await test('DOSYA: StaleSHA toplu aktarımı durdurur; otomatik retry yok ve manuel giriş korunur',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);await load(h,dummyFile('cakisma.txt',twoText));
    h.remote.doc=CORE.addConcept(h.remote.doc,{arabicText:'الرحمن',note:'Başka kullanıcı',source:null},'other-user',CORPUS).doc;
    const remoteBefore=jsonCopy(h.remote.doc);await commit(h);noPuts(h);assert.deepEqual(h.remote.doc,remoteBefore);assert.deepEqual(snapshot(h),before);
    assert.equal(confirm(h).disabled,true);await confirm(h).fire('click');await settle();noPuts(h);
    await h.panel.refresh();await settle();assert.equal(preview(h).hidden,true);
  });
  await test('DOSYA: PUT409 dosyanın hiçbir kaydını kısmen yazmaz; önizleme/not korunur ve retry yapılmaz',async()=>{
    const h=await harness();await authorize(h);const before=await fillDraft(h);await load(h,dummyFile('409.txt',twoText));const list=h.$('concepts-import-list').textContent;
    h.remote.putStatus=409;await commit(h);assert.equal(h.remote.puts.length,1);assert.equal(h.remote.doc.records.length,0);assert.deepEqual(snapshot(h),before);
    assert.equal(h.$('concepts-import-list').textContent,list);assert.equal(confirm(h).disabled,true);await confirm(h).fire('click');await settle();assert.equal(h.remote.puts.length,1);
  });
  await test('DOSYA: Meşgul/yetkisiz/eksik belge durumunda dosya okuması başlamaz',async()=>{
    const scenarios=[async h=>{h.ctx.busy=true;h.panel.syncAuth();},async h=>{h.ctx.token='';h.ctx.actor='';h.panel.onLogout();},async h=>{h.remote.getStatus=404;await h.panel.refresh();}];
    for(const setup of scenarios){
      const h=await harness();await authorize(h);await setup(h);const file=dummyFile('kapali.txt',twoText);
      await h.$('concepts-file-add').fire('click');await selectFiles(h,[file]);await settle();assert.equal(file.readCalls,0);noPuts(h);assert.equal(confirm(h).disabled,true);
    }
  });
  await test('DOSYA: Başarılı manuel veya sağtık değişikliği eski dosya önizlemesini geçersiz kılar',async()=>{
    for(const method of ['manual','quick']){
      const h=await harness();await authorize(h);await load(h,dummyFile('bekleyen.txt','الرحمن'));
      if(method==='manual'){await h.input('concepts-text','الٓمٓ');await h.$('concepts-save').click();await settle();}
      else await h.transfer('الْكِتَابُ');
      assert.equal(h.remote.puts.length,1);assert.equal(preview(h).hidden,true);await confirm(h).fire('click');await settle();assert.equal(h.remote.puts.length,1);
    }
  });
  await test('DOSYA: Dosya okuma hatası ve WebCrypto yokluğu failclosed; eski taslak korunur',async()=>{
    let h=await harness();await authorize(h);let before=await fillDraft(h);await load(h,dummyFile('okunamadi.txt',twoText,{readError:'Synthetic read error'}));assertClosed(h);assert.deepEqual(snapshot(h),before);
    h=await harness();await authorize(h);before=await fillDraft(h);Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
    await load(h,dummyFile('crypto.txt',twoText));assertClosed(h);assert.deepEqual(snapshot(h),before);assert.match(importMsg(h),/bütünlük|HTTPS/u);
  });
  await test('DOSYA: Geçersiz yeni dosya önceki geçerli önizlemeyi kullanarak kayıt yaptıramaz',async()=>{
    const h=await harness();await authorize(h);await load(h,dummyFile('gecerli.txt',twoText));assert.equal(preview(h).hidden,false);
    await load(h,dummyFile('gecersiz.txt','Türkçe'));assertClosed(h);await confirm(h).fire('click');await settle();noPuts(h);
  });
  await test('DOSYA: Önizleme ve onay arasında ana âyet değişimi kaynak uydurmaz',async()=>{
    const h=await harness({selected:'2.2'});await authorize(h);await load(h,dummyFile('bagimsiz.txt',twoText));await h.switchVerse('4.1');await commit(h);
    assert.equal(h.remote.puts.length,1);assertNoSource(h.remote.doc);assert.equal(h.remote.puts[0].branch,'calisma-kavramlar');
  });
}

await main();
