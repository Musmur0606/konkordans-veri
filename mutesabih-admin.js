import { parseVerses, normalizeMain, canEditMain, otherVerseBase, cleanState, getMerged, applyEdit, undoOne, undoDay, dayInTurkey, eventLabel, assertHistory } from '/mutesabih-core.mjs?v=2';

const OWNER = 'Musmur0606';
const REPO = 'konkordans-veri';
const BRANCH = 'main';
const BASE_PATH = 'data/mutesabih-r14.json';
const HISTORY_PATH = 'data/mutesabih-degisiklikler.json';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;
const $ = (id) => document.getElementById(id);
const runtime = { token: '', actor: '', data: null, corpus: null, doc: null, sha: '', selected: '5.61', busy: false };

function githubHeaders(authToken = runtime.token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

function decodeBase64(text) {
  const decoded = atob(text.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(decoded, (char) => char.charCodeAt(0)));
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text), pieces=[];
  for (let i=0; i<bytes.length; i+=8192) {
    pieces.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  }
  return btoa(pieces.join(''));
}

async function ghResponse(response, label) {
  if (response.ok) return response.json();
  let message = '';
  try { message = (await response.json()).message || ''; } catch { /* text omitted */ }
  if (response.status===409 || response.status===422) throw Error('GitHub sürüm çakışması: kayıt değişmiş olabilir. Verileri yenileyip tekrar deneyin. '+message);
  if (response.status===401 || response.status===403) throw Error(label+': yetki reddedildi ('+response.status+'). GitHub hesabını ve sadece bu depoya Contents: Read and write yetkisini kontrol edin. '+message);
  throw Error(label+': GitHub hatası ('+response.status+'). '+message);
}

async function loadGitHubFile(path, authToken=runtime.token) {
  const url=API_ROOT+path+'?ref='+BRANCH;
  const response=await fetch(url,{headers:githubHeaders(authToken),cache:'no-store'});
  const payload=await ghResponse(response,'GitHub dosya okuma');
  if (payload.type!=='file' || !payload.content || !payload.sha) throw Error(path+' beklenen GitHub dosyası değil.');
  return {content:JSON.parse(decodeBase64(payload.content)),sha:payload.sha};
}

function showMessage(id,message,type='') {
  const node=$(id); node.textContent=message; node.className='message'+(type?' '+type:'');
}

function status(base,override) {
  if(!canEditMain(base.main))return ['Korumalı sûre','neutral'];
  const explicit=cleanState(override).status;
  if (explicit==='confirmed') return ['Doğrulandı','green'];
  if (explicit==='review') return ['Sarı inceleme','yellow'];
  if(base.status==='red')return ['Kırmızı kaynak başlığı','red'];
  if(base.status==='yellow')return ['Sarı inceleme','yellow'];
  return ['Mevcut site kaydı','neutral'];
}

function createText(tag,className,content) {
  const node=document.createElement(tag);
  if(className)node.className=className;
  node.textContent=String(content??'');
  return node;
}

function baseFor(key) {
  const word=runtime.data?.records.find(r=>r.main===key);
  if(word)return word;
  if(!runtime.corpus)return null;
  return otherVerseBase(key,runtime.corpus);
}

function currentBase() {return baseFor(runtime.selected);}

function allVisibleMains(search) {
  if(!runtime.data||!runtime.corpus)return [];
  const word=runtime.data.records;
  const known=new Set(word.map(r=>r.main));
  if(!search){
    const extra=Object.keys(runtime.doc?.overrides||{}).filter(key=>!known.has(key)).map(key=>{
      try{return baseFor(key);}catch{return null;}
    }).filter(Boolean);
    return [...word,...extra].slice(0,500);
  }
  const matches=Object.keys(runtime.corpus.verses).filter(key=>{
    const verse=runtime.corpus.verses[key];
    return key.replace(':','.').includes(search) || String(verse.sa||'').toLocaleLowerCase('tr').includes(search);
  });
  matches.sort((a,b)=>{
    const target=search.replace('.',':');
    return Number(b===target)-Number(a===target);
  });
  return matches.slice(0,100).map(x=>baseFor(x.replace(':','.')));
}

function renderList() {
  if(!runtime.data||!runtime.corpus)return;
  const search=$('main-search').value.trim().toLocaleLowerCase('tr');
  const list=$('main-list');list.replaceChildren();
  const found=allVisibleMains(search);
  for(const base of found) {
    const row=createText('button','main-item'+(base.main===runtime.selected?' active':''),'');
    row.type='button';row.setAttribute('role','option');row.setAttribute('aria-selected',String(base.main===runtime.selected));
    const verse=runtime.corpus.verses[base.main.replace('.',':')];
    row.append(createText('b','',base.main),createText('span','',status(base,runtime.doc?.overrides?.[base.main])[0]),createText('small','',verse?.sa ? verse.sa+' Sûresi · '+verse.a+'. Âyet' : base.heading.slice(0,83)));
    row.addEventListener('click',()=>{runtime.selected=base.main;renderAll();});list.append(row);
  }
  if(!found.length)list.append(createText('p','micro','Aradığınız âyet bulunamadı.'));
}

function openMain() {
  try {
    const main=normalizeMain($('direct-main').value);
    if(!runtime.corpus?.verses?.[main.replace('.',':')])throw Error('Kur’an metninde bulunmuyor.');
    runtime.selected=main;
    $('main-search').value=main;
    showMessage('main-message',main+' ana âyet olarak açıldı. Benzeşenler aşağıda.','success');
    renderAll();
  }catch(error){showMessage('main-message',error.message,'error');}
}

function renderSelected() {
  const base=currentBase();if(!base)return;
  const currentState=runtime.doc?.overrides?.[base.main];
  const [label,color]=status(base,currentState);
  $('main-key').textContent='ANA ÂYET · '+base.main;
  const verse=runtime.corpus?.verses?.[base.main.replace('.',':')];
  $('main-title').textContent=base.status==='site' && verse?.sa?verse.sa+' Sûresi · '+verse.a+'. Âyet':base.heading;
  $('main-source').textContent=base.status==='site'?'Kaynak: '+base.source.file+' · Mevcut site ilişkileri korunur.':'Kaynak: '+base.source.file+' · Sayfa '+base.source.page+' · Paragraf '+base.source.paragraph;
  $('source-note').textContent=base.status==='site'?'Mevcut sitenin Kur’an verisindeki benzeşme kayıtları başlangıç alınır; yönetici ekleme/çıkarma değişiklikleri ayrıdır. Otomatik adaylar anlam bakımından onaylanmış sayılmaz.':'Word kaynaklı benzeşenler yapısal adaylardır; anlam bakımından tek tek teyit edilmiş sayılmazlar.';
  if(!canEditMain(base.main))$('source-note').textContent='KORUMALI: Bakara (2), Âl-i İmrân (3) ve Nisâ (4) ana âyetleri görüntülenebilir; ancak bu üç sûrede ekleme/çıkarma kapalıdır. Başka ana âyetlerin benzeşen listelerinde bu sûrelere atıf serbesttir.';
  $('main-status').textContent=label;$('main-status').className='pill '+color;
  const links=getMerged(base,currentState);
  $('link-count').textContent=links.length+' ilişki ('+base.links.length+(base.status==='site'?' mevcut site':' Word')+' adayı)';
  const target=$('link-list');target.replaceChildren();
  for (const ref of links) {
    const pill=createText('span','link'+(ref.added?' added':''),'');
    pill.append(createText('strong','',ref.key));
    if(ref.added)pill.append(createText('small','source','Yönetici ekledi'));
    target.append(pill);
  }
  if(!links.length)target.append(createText('p','micro','Bu ana âyet için görünür benzeşen kayıt yok.'));
  updateParsed();
}

function renderHistory() {
  const target=$('history-list');target.replaceChildren();
  const all=[...(runtime.doc?.events||[])].reverse();
  const selectedDay=$('history-day').value;
  const filtered=selectedDay?all.filter(e=>dayInTurkey(e.at)===selectedDay):all;
  $('history-summary').textContent=selectedDay ? selectedDay+' gününe ait '+filtered.length+' MLOG işlemi; tüm kayıtlar GitHub’da korunuyor.' : 'Toplam '+all.length+' işlem; tarih seçerek günlük kayıtları ve geri alma seçeneğini açın.';
  if(!filtered.length) {target.append(createText('p','micro',selectedDay?'Seçilen tarihte bir işlem yok.':'Henüz yönetici işlemi yok.'));return;}
  for(const event of filtered.slice(0,300)) {
    const card=createText('article','history-entry','');
    card.append(createText('time','',new Date(event.at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})));
    card.append(createText('h4','',eventLabel(event)));
    card.append(createText('p','',event.changes.map(c=>c.main).join(', ')+' · '+event.actor));
    if(event.refs?.length)card.append(createText('p','',event.refs.join(', ')));
    if(event.note)card.append(createText('p','',event.note));
    const undo=createText('button','button outline small','Bu işlemi geri al');
    undo.type='button';undo.disabled=!runtime.token||runtime.busy||runtime.doc.events.some(e=>e.undo_of?.includes(event.id));
    undo.addEventListener('click',()=>submitUndoOne(event.id));card.append(undo);
    target.append(card);
  }
  if(filtered.length>300)target.append(createText('p','micro','En yeni 300 kayıt gösteriliyor; tamamı GitHub geçmişinde saklı.'));
}

function renderAuth() {
  const logged=!!runtime.token;
  const locked=!canEditMain(runtime.selected);
  $('auth-badge').textContent=logged?'GİRİŞ: '+runtime.actor:'GİRİŞ YAPILMADI';
  $('auth-badge').className='status '+(logged?'connected':'neutral');
  $('token').hidden=logged;$('login').hidden=logged;$('logout').hidden=!logged;
  $('editor').querySelectorAll('button,input,textarea').forEach(el=>{el.disabled=!logged||runtime.busy||locked;});
  $('rollback-day').disabled=!logged||runtime.busy||!$('history-day').value;
  $('download-day').disabled=!$('history-day').value;
}

function renderAll() {
  renderAuth(); renderList(); renderSelected(); renderHistory();
  if(runtime.data) $('stats').textContent='6.236 seçilebilir âyet · '+runtime.data.counts.main+' Word başlığı · '+runtime.data.counts.candidates+' Word adayı · '+(runtime.doc?.events?.length||0)+' MLOG işlemi';
}

function updateParsed() {
  const value=$('refs').value.trim();
  if(!value){$('parsed').textContent='';return;}
  try{const parsed=parseVerses(value);$('parsed').textContent='Seçilen âyetler ('+parsed.length+'): '+parsed.slice(0,22).join(' · ')+(parsed.length>22?' …':'');}
  catch(error){$('parsed').textContent='İfade hatası: '+error.message;}
}

async function refreshFiles(authToken=runtime.token) {
  // Public source is served by GitHub Pages; mutable state is ALWAYS read
  // from GitHub's contents API with SHA, never from service-worker caches.
  const [baseResponse,corpusResponse]=await Promise.all([
    fetch('/'+BASE_PATH+'?t='+Date.now(),{cache:'no-store'}),
    fetch('/app_data.json',{cache:'force-cache'}),
  ]);
  if(!baseResponse.ok)throw Error('R14 kaynak dosyası henüz yayına ulaşmadı ('+baseResponse.status+').');
  if(!corpusResponse.ok)throw Error('Kur’an metni ve benzeşme kaynağı yüklenemedi ('+corpusResponse.status+').');
  const [data,corpus]=await Promise.all([baseResponse.json(),corpusResponse.json()]);
  if(data.schema!=='ayatulkuran.word-r14-baseline.v1'||data.counts.main!==176||data.counts.candidates!==3683)throw Error('R14 kaynak veri doğrulaması başarısız.');
  if(!corpus.verses||Object.keys(corpus.verses).length!==6236)throw Error('Kur’an 6.236 âyet kaynağı beklenen biçimde değil.');
  const history=await loadGitHubFile(HISTORY_PATH,authToken);assertHistory(history.content);
  runtime.data=data;runtime.corpus=corpus;runtime.doc=history.content;runtime.sha=history.sha;
  renderAll();
}

async function authorize() {
  const input=$('token').value.trim();
  if(!input){showMessage('login-message','GitHub erişim anahtarını yapıştırınız.','error');return;}
  $('login').disabled=true;
  try{
    const response=await fetch('https://api.github.com/user',{headers:githubHeaders(input),cache:'no-store'});
    const user=await ghResponse(response,'GitHub giriş');
    if(user.login?.toLowerCase()!==OWNER.toLowerCase())throw Error('Bu panel yalnız Musmur0606 hesabına açıktır. Aktif hesap: '+(user.login||'bilinmiyor'));
    await refreshFiles(input);
    runtime.token=input;runtime.actor=user.login;
    $('token').value='';showMessage('login-message','Doğrulandı. Değişiklikler GitHub deposuna kaydedilecek.','success');
    renderAll();
  }catch(error){runtime.token='';runtime.actor='';$('token').value='';showMessage('login-message',error.message,'error');renderAll();}
  finally{$('login').disabled=false;}
}

function setBusy(value){runtime.busy=value;renderAuth();}

async function saveNext(result,commitMessage) {
  if(!runtime.token)throw Error('Önce giriş yapmalısınız.');
  if(!result.event)return {saved:false};
  // SHA compare prevents inadvertent overwrite of other editors' changes.
  const fresh=await loadGitHubFile(HISTORY_PATH);
  if(fresh.sha!==runtime.sha)throw Error('GitHub üzerinde sizden sonra değişiklik olmuş. Güvenliğiniz için kayıt yapılmadı. Sayfayı yenileyin.');
  const body={message:commitMessage,content:encodeBase64(JSON.stringify(result.doc,null,2)+'\n'),sha:runtime.sha,branch:BRANCH};
  let reply;
  try{
    const response=await fetch(API_ROOT+HISTORY_PATH,{method:'PUT',headers:{...githubHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    reply=await ghResponse(response,'GitHub kaydetme');
  }catch(error){throw Error(error.message+' Sonuç belirsizse GitHub geçmişini kontrol edin; otomatik tekrar yapılmadı.');}
  if(!reply.content?.sha||!reply.commit?.sha)throw Error('GitHub yanıtı eksik. İşlem yeniden gönderilmedi; geçmişi kontrol edin.');
  runtime.doc=result.doc;runtime.sha=reply.content.sha;
  renderAll();
  return {saved:true,commit:reply.commit.sha};
}

async function submitEdit(operation) {
  if(runtime.busy)return;
  const base=currentBase();if(!base)return;
  try {
    const result=applyEdit(runtime.doc,base,operation,$('refs').value,$('reason').value,runtime.actor);
    if(!result.event){showMessage('edit-message','Yeni bir değişiklik yok; mevcut kayıt korundu.');return;}
    if(operation==='add'||operation==='remove'){
      const word=operation==='add'?'EKLENECEK':'ÇIKARILACAK';
      const summary=result.changed.slice(0,45).join(', ')+(result.changed.length>45?' ...':'');
      const question='ANA ÂYET: '+base.main+'\nİŞLEM: '+word+'\n\n'+result.changed.length+' benzeşen âyet:\n'+summary+'\n\nİşlemi GitHub’a kaydetmek istediğinize EMİN MİSİNİZ?';
      if(!window.confirm(question)){
        showMessage('edit-message','İkinci onay verilmedi; hiçbir değişiklik kaydedilmedi.');
        return;
      }
    }
    setBusy(true);
    const refs=result.changed.length?' ('+result.changed.length+' âyet)':'';
    const saved=await saveNext(result,'AyetulKuran: '+base.main+' '+operation+refs);
    showMessage('edit-message','GitHub’a yazıldı. İşlem geçmişinde görülebilir. Commit: '+saved.commit.slice(0,9),'success');
    $('refs').value='';$('reason').value='';renderAll();
  }catch(error){showMessage('edit-message',error.message,'error');}
  finally{setBusy(false);}
}

function downloadDailyLog() {
  const day=$('history-day').value;
  if(!day||!runtime.doc){showMessage('edit-message','Günlük MLOG için önce bir tarih seçiniz.','error');return;}
  const events=runtime.doc.events.filter(event=>dayInTurkey(event.at)===day);
  const log={schema:'ayatulkuran.daily-mlog.v1',day_tr:day,source:'Musmur0606/konkordans-veri/data/mutesabih-degisiklikler.json',exported_at:new Date().toISOString(),count:events.length,events};
  const blob=new Blob([JSON.stringify(log,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='AYATULKURAN_MLOG_'+day+'.json';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function submitUndoOne(id) {
  if(!runtime.token||runtime.busy)return;
  if(!confirm('Bu işlemin etkileri tersine çevrilecek ve GitHub’a YENİ bir geri-alma sürümü yazılacak. Devam edilsin mi?'))return;
  setBusy(true);
  try{
    const result=undoOne(runtime.doc,id,runtime.actor);
    const saved=await saveNext(result,'AyetulKuran: islem geri al '+id.slice(0,8));
    showMessage('edit-message','İşlem geri alındı. GitHub commit: '+saved.commit.slice(0,9),'success');
  }catch(error){showMessage('edit-message',error.message,'error');}
  finally{setBusy(false);}
}

async function submitUndoDay() {
  const day=$('history-day').value;
  if(!runtime.token||runtime.busy||!day)return;
  const count=runtime.doc.events.filter(e=>dayInTurkey(e.at)===day).length;
  if(!count){showMessage('edit-message','Bu günde işlem yok.');return;}
  if(!confirm(day+' tarihinde yapılan '+count+' işlem geri alınacak ve GitHub’a YENİ bir sürüm kaydedilecek. Devam edilsin mi?'))return;
  setBusy(true);
  try{
    const result=undoDay(runtime.doc,day,runtime.actor);
    const saved=await saveNext(result,'AyetulKuran: '+day+' gununun islemleri geri alindi');
    showMessage('edit-message',day+' tarihindeki işlemler geri alındı. Commit: '+saved.commit.slice(0,9),'success');
  }catch(error){showMessage('edit-message',error.message,'error');}
  finally{setBusy(false);}
}

$('main-search').addEventListener('input',renderList);
$('open-main').addEventListener('click',openMain);
$('direct-main').addEventListener('keydown',(e)=>{if(e.key==='Enter')openMain();});
$('refs').addEventListener('input',updateParsed);
$('login').addEventListener('click',authorize);
$('token').addEventListener('keydown',(e)=>{if(e.key==='Enter')authorize();});
$('logout').addEventListener('click',()=>{runtime.token='';runtime.actor='';showMessage('login-message','Güvenli çıkış yapıldı. Erişim anahtarı bellekten silindi.');renderAll();});
for(const op of ['add','remove','confirm','review'])$(op).addEventListener('click',()=>submitEdit(op));
$('history-day').addEventListener('change',()=>{renderHistory();renderAuth();});
$('clear-day').addEventListener('click',()=>{$('history-day').value='';renderHistory();renderAuth();});
$('download-day').addEventListener('click',downloadDailyLog);
$('rollback-day').addEventListener('click',submitUndoDay);

refreshFiles('').catch(error=>{
  showMessage('login-message','Kaynak yüklenemedi: '+error.message,'error');
  $('stats').textContent='GitHub bağlantısı kontrol ediliyor.';
  $('main-list').replaceChildren(createText('p','micro',error.message));
});
