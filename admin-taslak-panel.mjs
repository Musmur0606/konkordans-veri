// Bu panel sadece mevcut GitHub yonetici oturumu dogrulandiktan sonra acilir.
// Taslaklar YALNIZ bu tarayicinin IndexedDB deposuna yazilir. GitHub'a POST/PUT yapmaz.
import {DRAFT_SCHEMA,SURA_LIMITS,TOTAL_LOCKED_VERSES,parseReferenceList,
  saveVerseDraft,saveTermDraft,assertDraftRecord,makeBackup,readBackup,
  readyCandidates,spokenReferences,findArabicCandidateRefs} from './admin-taslak-core.mjs';

const $=id=>document.getElementById(id);
const DB_NAME='ayatulkuran_unpublished_admin_work_v1';
const STORE='drafts';
const controller={authenticated:false,db:null,records:new Map(),corpus:null,
  verse:null,term:null,termCandidates:[],voice:null,voiceRunning:false,voiceRetry:0,voiceTimer:null};
let authTransition=Promise.resolve();
const LIMITS={...SURA_LIMITS};
const STATUS_LABELS={taslak:'Taslak',inceleme:'İncelemede',hazir:'Yayına hazır (henüz yayınlanmadı)'};
const text=(tag,className,value)=>{
  const el=document.createElement(tag);if(className)el.className=className;
  el.textContent=value??'';return el;
};
const refSort=(a,b)=>{
  const x=a.split('.').map(Number),y=b.split('.').map(Number);
  return x[0]-y[0]||x[1]-y[1];
};
function message(note,error=false) {
  $('draft-message').textContent=note;
  $('draft-message').className='draft-message '+(error?'error':'');
}
function downloadJson(name,data) {
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),8000);
}
function connectLocalDB() {
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(Error('Tarayıcı yerel veri tabanını desteklemiyor.'));
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))
      db.createObjectStore(STORE,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('Yerel kayıt deposu açılamadı.'));
  });
}
function readAllLocal() {
  return new Promise((resolve,reject)=>{
    const req=controller.db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||Error('Yerel taslak okunamadı.'));
  });
}
function putLocal(rows) {
  return new Promise((resolve,reject)=>{
    const tx=controller.db.transaction(STORE,'readwrite');
    for(const row of rows)tx.objectStore(STORE).put(row);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error('Yerel kayıt yazılamadı.'));
    tx.onabort=()=>reject(tx.error||Error('Yerel kayıt yarıda kesildi.'));
  });
}
function removeLocal(key) {
  return new Promise((resolve,reject)=>{
    const tx=controller.db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error('Kayıt silinemedi.'));
  });
}
function currentVerseKey(){
  return LIMITS[$('d234-sure').value]?$('d234-sure').value+'.'+$('d234-ayet').value:null;
}
function currentVerseData() {
  return controller.corpus?.verses?.[currentVerseKey()?.replace('.',':')]||null;
}
function populateAyahs(sure) {
  const picker=$('d234-ayet'),before=Number(picker.value)||1;
  picker.replaceChildren();
  for(let n=1;n<=LIMITS[sure];n++){
    const el=text('option','',String(n));el.value=String(n);picker.append(el);
  }
  picker.value=String(Math.min(before,LIMITS[sure]));
}
function activateFirstVerse() {
  if(!LIMITS[$('d234-sure').value])$('d234-sure').value='2';
  populateAyahs(+$('d234-sure').value);
  renderVerse();
}
function renderVerse() {
  if(!controller.authenticated)return;
  const key=currentVerseKey();if(!key)return;
  controller.verse=controller.records.get('ayet:'+key)||null;
  const verse=currentVerseData();
  $('d234-title').textContent=(verse?.sa||({2:'Bakara',3:'Âl-i İmrân',4:'Nisâ'}[+$('d234-sure').value]))
    +' · '+$('d234-ayet').value+'. âyet ('+key+')';
  $('d234-ar').textContent=verse?.ar||'Kur’an metni yüklenemedi; numaraları yine kaydedebilirsiniz.';
  $('d234-tr').textContent=verse?.mb||'';
  $('d234-en').textContent=verse?.me||'';
  $('d234-site-count').textContent=Array.isArray(verse?.r)?
    'Mevcut sitenin eski listesi: '+verse.r.length+' benzeşen. Bu liste taslağa otomatik alınmaz.':
    'Mevcut site listesi henüz okunamadı.';
  $('d234-refs').value=controller.verse?.refs.join(' ')||'';
  $('d234-note').value=controller.verse?.note||'';
  $('d234-status').value=controller.verse?.status||'taslak';
  $('d234-version').textContent=controller.verse
    ?'Yerel sürüm '+controller.verse.version+' · '+new Date(controller.verse.updated_at).toLocaleString('tr-TR')
    :'Bu âyet için henüz yerel taslak oluşturulmadı.';
  $('d234-undo').disabled=!(controller.verse?.history?.length);
  $('d234-delete').disabled=!controller.verse;
  renderRefsPreview('d234-ref-preview',$('d234-refs').value,key);
}
function renderRefsPreview(id,raw,main=null){
  const node=$(id);
  try{
    const refs=parseReferenceList(raw,main);
    node.textContent=refs.length
      ?refs.length+' eşleşme: '+refs.slice(0,20).join(' · ')+(refs.length>20?' …':'')
      :'Henüz benzeşen âyet numarası girilmedi.';
    node.className='draft-hint';
  }catch(e){node.textContent='Kontrol: '+e.message;node.className='draft-hint error';}
}
async function saveVerse() {
  if(!controller.authenticated)return;
  try{
    const main=currentVerseKey(),previous=controller.records.get('ayet:'+main)||null;
    const row=saveVerseDraft({main,refs:$('d234-refs').value,
      status:$('d234-status').value,note:$('d234-note').value},previous);
    await putLocal([row]);controller.records.set(row.key,row);
    renderVerse();renderStats();renderVerseList();
    message(main+' kaydedildi. '+row.refs.length+' eşleşme · '+STATUS_LABELS[row.status]+
      '. Yalnız bu tarayıcıya yazıldı. Yedek indirmeniz önerilir.');
  }catch(e){message(e.message,true);}
}
async function deleteVerse() {
  const main=currentVerseKey(),row=controller.records.get('ayet:'+main);
  if(!row||!confirm(main+' taslağı ve yerel geçmişi silinecek. Devam edilsin mi?'))return;
  try{
    await removeLocal(row.key);controller.records.delete(row.key);
    renderVerse();renderStats();renderVerseList();message(main+' yerel taslağı silindi.');
  }catch(e){message(e.message,true);}
}
async function undoVerse() {
  const main=currentVerseKey(),previous=controller.records.get('ayet:'+main);
  if(!previous?.history?.length)return;
  const last=previous.history.at(-1);
  if(!confirm(main+' son sürümüne dönülsün mü? Mevcut girdi değiştirilecek.'))return;
  try{
    const row=saveVerseDraft({main,refs:last.refs,status:last.status,note:last.note},previous);
    row.history=previous.history.slice(0,-1);
    await putLocal([row]);controller.records.set(row.key,row);
    renderVerse();renderStats();renderVerseList();message(main+' bir önceki sürüme döndü.');
  }catch(e){message(e.message,true);}
}
async function copySiteBase() {
  const verse=currentVerseData(),main=currentVerseKey();
  if(!Array.isArray(verse?.r)){message('Mevcut site listesi okunamadı.',true);return;}
  if(!$('d234-refs').value.trim()||confirm(
    main+' için yazdığınız taslak numaraları, eski site listesinin '+verse.r.length+' ilişkisiyle değiştirilsin mi?')){
    $('d234-refs').value=verse.r.map(x=>x.replace(':','.')).join(' ');
    renderRefsPreview('d234-ref-preview',$('d234-refs').value,main);
    message('Eski liste taslak kutusuna alındı. Kaydetmeden önce gözden geçirin; GitHub değişmedi.');
  }
}
function renderVerseList() {
  const all=[...controller.records.values()].filter(x=>x.kind==='ayet')
    .sort((a,b)=>refSort(a.main,b.main));
  const root=$('d234-progress-list');root.replaceChildren();
  for(const row of all){
    const btn=text('button','draft-list-button',
      row.main+' · '+row.refs.length+' eşleşme · '+STATUS_LABELS[row.status]);
    btn.type='button';
    btn.addEventListener('click',()=>{
      const [s,a]=row.main.split('.');
      $('d234-sure').value=s;populateAyahs(+s);$('d234-ayet').value=a;renderVerse();
    });
    root.append(btn);
  }
  if(!all.length)root.append(text('p','draft-hint','Henüz üzerinde çalışılan ana âyet yok.'));
}
function renderStats() {
  const verses=[...controller.records.values()].filter(x=>x.kind==='ayet');
  const terms=[...controller.records.values()].filter(x=>x.kind==='terim');
  const count=code=>verses.filter(x=>x.status===code).length;
  $('d234-count').textContent=verses.length+' / '+TOTAL_LOCKED_VERSES+' âyet üzerinde çalışıldı · '+
    count('hazir')+' yayına hazır · '+count('inceleme')+' incelemede · '+count('taslak')+' taslak';
  $('draft-terms-count').textContent=terms.length+' yerel terim kaydı · '+
    terms.filter(x=>x.status==='hazir').length+' yayına hazır';
}
function resetTerm() {
  controller.term=null;
  for(const id of ['term-ar','term-tr','term-en','term-note','term-refs'])$(id).value='';
  $('term-status').value='taslak';
  $('term-selected').textContent='Yeni terim';
  $('term-delete').disabled=true;
  $('term-undo').disabled=true;
  renderRefsPreview('term-ref-preview','');

  controller.termCandidates=[];$('term-auto-list').replaceChildren();
  $('term-auto-count').textContent='Arapça metin yapıştırın; ardından ayetlerde aramayı başlatın.';
  $('term-ar').focus();
}
function selectTerm(key) {
  const row=controller.records.get(key);
  if(!row||row.kind!=='terim')return;
  controller.term=row;
  $('term-ar').value=row.arabic;$('term-tr').value=row.turkish;
  $('term-en').value=row.english;$('term-note').value=row.note;
  $('term-refs').value=row.refs.join(' ');$('term-status').value=row.status;
  $('term-selected').textContent='Yerel terim sürüm '+row.version+' · '+
    new Date(row.updated_at).toLocaleString('tr-TR');
  $('term-delete').disabled=false;$('term-undo').disabled=!row.history.length;
  renderRefsPreview('term-ref-preview',$('term-refs').value);
  controller.termCandidates=[];$('term-auto-list').replaceChildren();
  $('term-auto-count').textContent='Bu terimin Arapça imla adaylarını yeniden arayabilirsiniz.';
}
async function saveTerm() {
  if(!controller.authenticated)return;
  try{
    const old=controller.term;
    const id=old?.id||('t_'+(crypto.randomUUID?.()||String(Date.now())+'_'+Math.random().toString(36).slice(2)));
    const row=saveTermDraft({id,arabic:$('term-ar').value,turkish:$('term-tr').value,
      english:$('term-en').value,note:$('term-note').value,
      refs:$('term-refs').value,status:$('term-status').value},old);
    await putLocal([row]);controller.records.set(row.key,row);
    selectTerm(row.key);renderTerms();renderStats();
    message('Terim kaydedildi. '+row.refs.length+' ayet bağlantısı. Yalnız tarayıcıya yazıldı.');
  }catch(e){message(e.message,true);}
}
async function deleteTerm() {
  const row=controller.term;
  if(!row||!confirm('“'+row.turkish+'” terimi ve geçmişi silinsin mi?'))return;
  try{
    await removeLocal(row.key);controller.records.delete(row.key);
    resetTerm();renderTerms();renderStats();message('Terim yerel depodan silindi.');
  }catch(e){message(e.message,true);}
}
async function undoTerm() {
  const row=controller.term;
  if(!row?.history?.length||!confirm('Terim son önceki sürüme döndürülsün mü?'))return;
  try{
    const prev=row.history.at(-1);
    const clean=saveTermDraft({id:row.id,arabic:prev.arabic,turkish:prev.turkish,
      english:prev.english,note:prev.note,refs:prev.refs,status:prev.status},row);
    clean.history=row.history.slice(0,-1);
    await putLocal([clean]);controller.records.set(clean.key,clean);
    selectTerm(clean.key);renderTerms();renderStats();
    message('Terimin önceki sürümü geri alındı.');
  }catch(e){message(e.message,true);}
}

function addSuggestedTermRefs(refs) {
  try{
    if(!refs.length)return;
    const existing=$('term-refs').value.trim();
    const all=parseReferenceList((existing+' '+refs.join(' ')).trim());
    $('term-refs').value=all.join(' ');
    renderRefsPreview('term-ref-preview',$('term-refs').value);
    message(refs.length+' aday ayet kutuya alındı. Kavramsal uygunluk kontrolü ve kaydetme size aittir.');
  }catch(e){message(e.message,true);}
}
function scanArabicTerm() {
  if(!controller.authenticated)return;
  try{
    const result=findArabicCandidateRefs($('term-ar').value,controller.corpus?.verses,100);
    controller.termCandidates=result.refs;
    const root=$('term-auto-list');root.replaceChildren();
    for(const ref of result.refs){
      const w=controller.corpus.verses[ref.replace('.',':')];
      const button=text('button','draft-term-button','');
      button.type='button';
      button.append(text('b','',ref+' · '+(w?.sa||'')),
        text('span','draft-arabic',(w?.ar||'').slice(0,180)));
      button.title=ref+' ayet numarasını terim listesine ekle';
      button.addEventListener('click',()=>addSuggestedTermRefs([ref]));
      root.append(button);
    }
    const extra=result.total>result.refs.length?' · İlk '+result.refs.length+' gösteriliyor.':'';
    $('term-auto-count').textContent=result.total+' olası ayette imla/hareke toleranslı metin eşleşmesi bulundu'+extra+
      ' Bunlar yalnız kelime/kelime grubu adaylarıdır; otomatik kavram kabulü yok.';
    if(!result.total)root.append(text('p','draft-hint','Bu yazımla sonuç bulunamadı. İlgili ayetleri elle yazabilirsiniz.'));
  }catch(e){
    controller.termCandidates=[];
    $('term-auto-count').textContent='Arama yapılamadı: '+e.message;
    $('term-auto-list').replaceChildren();
  }
}
function renderTerms() {
  const query=$('term-search').value.toLocaleLowerCase('tr-TR').trim();
  const all=[...controller.records.values()].filter(x=>x.kind==='terim')
    .filter(x=>!query||[x.arabic,x.turkish,x.english,x.note].some(v=>v.toLocaleLowerCase('tr-TR').includes(query)))
    .sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  const root=$('term-list');root.replaceChildren();
  for(const row of all){
    const btn=text('button','draft-term-button','');btn.type='button';
    btn.append(text('span','draft-arabic',row.arabic),
      text('span','',row.turkish+' · '+row.refs.length+' âyet · '+STATUS_LABELS[row.status]));
    btn.addEventListener('click',()=>selectTerm(row.key));root.append(btn);
  }
  if(!all.length)root.append(text('p','draft-hint','Kayıt bulunamadı.'));
}
async function importBackupFile() {
  const file=$('draft-import-file').files?.[0];
  if(!file){message('Önce bir JSON yedek dosyası seçin.',true);return;}
  try{
    if(file.size>25*1024*1024)throw Error('25 MB üzerinde yedek kabul edilmiyor.');
    const doc=JSON.parse(await file.text()),rows=readBackup(doc);
    const collisions=rows.filter(r=>controller.records.has(r.key)).length;
    if(!confirm(rows.length+' taslak yedekten alınacak. '+collisions+
      ' kayıt mevcut yerel kayıtla aynı anahtara sahip; bunlar yedekteki sürümle değiştirilecek. Devam edilsin mi?'))return;
    await putLocal(rows);
    for(const row of rows)controller.records.set(row.key,row);
    $('draft-import-file').value='';
    renderVerse();renderVerseList();renderTerms();renderStats();
    message(rows.length+' kayıt yedekten alındı. Başka kayıtlar silinmedi.');
  }catch(e){message('Yedek alınamadı: '+e.message,true);}
}
async function fetchCorpus() {
  if(controller.corpus)return;
  const response=await fetch('/app_data.json',{cache:'force-cache'});
  if(!response.ok)throw Error('Mevcut Kur’an metinleri okunamadı (HTTP '+response.status+').');
  const json=await response.json();
  if(!json?.verses||Object.keys(json.verses).length!==6236)
    throw Error('Kur’an metni beklenen 6.236 âyet biçiminde değil.');
  controller.corpus=json;
}
function stopVoice(showMessage=true) {
  controller.voiceRunning=false;
  if(controller.voiceTimer){clearTimeout(controller.voiceTimer);controller.voiceTimer=null;}
  if(controller.voice){try{controller.voice.abort();}catch(e){} controller.voice=null;}
  for(const id of ['d234-voice','term-voice'])$(id).textContent='🎙️ Sesle âyet gir';
  if(showMessage)$('draft-voice-message').textContent='Sesli giriş durduruldu. Kaydetmeden önce kontrol edin.';
}
function voiceStart(target) {
  if(controller.voiceRunning){stopVoice();return;}
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){message('Bu tarayıcı mikrofon konuşma tanımayı desteklemiyor. Windows + H kullanabilirsiniz.',true);return;}
  if(!controller.authenticated)return;
  controller.voiceRunning=true;controller.voiceRetry=0;
  const inputId=target==='term'?'term-refs':'d234-refs';
  $('d234-voice').textContent='■ Dinlemeyi bitir';
  $('term-voice').textContent='■ Dinlemeyi bitir';
  function listen(){
    if(!controller.voiceRunning)return;
    const rec=new Speech();controller.voice=rec;rec.lang='tr-TR';
    rec.continuous=true;rec.interimResults=false;rec.maxAlternatives=1;
    rec.onresult=e=>{
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(!e.results[i].isFinal)continue;
        const said=e.results[i][0]?.transcript||'';
        try{
          const converted=spokenReferences(said);
          const combined=($(inputId).value.trim()+' '+converted).trim();
          parseReferenceList(combined,target==='term'?null:currentVerseKey());
          $(inputId).value=combined;
          $(inputId).dispatchEvent(new Event('input',{bubbles:true}));
          $('draft-voice-message').textContent='Algılandı: '+converted+' · Dinleme devam ediyor.';
        }catch(err){$('draft-voice-message').textContent='“'+said+'” anlaşılamadı: '+err.message;}
      }
      controller.voiceRetry=0;
    };
    rec.onerror=e=>{
      if(['not-allowed','service-not-allowed','audio-capture','network'].includes(e.error)){
        stopVoice(false);message('Ses hizmeti/mikrofon kullanılamıyor: '+e.error,true);
      }
    };
    rec.onend=()=>{
      if(controller.voice===rec)controller.voice=null;
      if(!controller.voiceRunning)return;
      if(controller.voiceRetry++>=6){stopVoice(false);message('Tarayıcı dinlemeyi sonlandırdı. Tekrar basın.',true);return;}
      controller.voiceTimer=setTimeout(listen,400);
    };
    try{rec.start();$('draft-voice-message').textContent='Dinliyorum… Örnek: “iki nokta iki yüz elli beş”.';}
    catch(e){stopVoice(false);message('Mikrofon başlatılamadı: '+e.message,true);}
  }
  listen();
}
function route() {
  const permitted=controller.authenticated;
  const hash=location.hash.replace('#','');
  const tab=hash==='taslak-234'?'verses':hash==='terimler'?'terms':'current';
  $('admin-draft-backups').hidden=!permitted||tab==='current';
  $('admin-current-workspace').hidden=permitted&&tab!=='current';
  $('admin-draft-234-workspace').hidden=!permitted||tab!=='verses';
  $('admin-draft-terms-workspace').hidden=!permitted||tab!=='terms';
  for(const [id,key] of [['admin-link-current','current'],['admin-link-234','verses'],['admin-link-terms','terms']]){
    const a=$(id);a.classList.toggle('active',permitted&&tab===key);
    a.setAttribute('aria-current',permitted&&tab===key?'page':'false');
  }
  if(!permitted&&tab!=='current')$('draft-message').textContent='Önce GitHub yönetici girişini tamamlayın.';
}
async function authenticatedStart() {
  try{
    controller.db=await connectLocalDB();
    const rows=await readAllLocal();
    controller.records=new Map(rows.filter(x=>{try{assertDraftRecord(x);return true;}catch{return false;}})
      .map(x=>[x.key,x]));
    await fetchCorpus();
    activateFirstVerse();renderVerseList();renderTerms();renderStats();
    message('Yönetici taslakları yerel tarayıcıda hazır. GitHub’a veya canlı siteye yazılmaz.');
  }catch(e){
    message('Taslak çalışma alanı başlatılamadı: '+e.message,true);
  }
}
function watchLogin() {
  const authenticated=$('auth-badge')?.classList.contains('connected')&&
    $('auth-badge')?.textContent?.includes('Musmur0606');
  if(authenticated===controller.authenticated){route();return;}
  controller.authenticated=authenticated;
  $('admin-draft-nav').hidden=!authenticated;
  if(authenticated){
    authTransition=authTransition.then(authenticatedStart);
  }else{
    stopVoice(false);
    controller.records.clear();controller.corpus=null;
    if(controller.db){controller.db.close();controller.db=null;}
    message('Taslaklar bu tarayıcıda saklı. GitHub girişi yapılınca tekrar açılabilir.');
  }
  route();
}
function bind() {
  for(const id of ['d234-sure','d234-ayet']) {
    $(id).addEventListener('change',()=>{
      stopVoice(false);
      if(id==='d234-sure')populateAyahs(+$('d234-sure').value);
      renderVerse();
    });
  }
  $('d234-refs').addEventListener('input',()=>renderRefsPreview('d234-ref-preview',$('d234-refs').value,currentVerseKey()));
  $('term-refs').addEventListener('input',()=>renderRefsPreview('term-ref-preview',$('term-refs').value));
  $('d234-save').addEventListener('click',saveVerse);
  $('d234-copy-site').addEventListener('click',copySiteBase);
  $('d234-delete').addEventListener('click',deleteVerse);
  $('d234-undo').addEventListener('click',undoVerse);
  $('d234-voice').addEventListener('click',()=>voiceStart('verse'));
  $('term-voice').addEventListener('click',()=>voiceStart('term'));
  $('term-save').addEventListener('click',saveTerm);
  $('term-new').addEventListener('click',resetTerm);
  $('term-delete').addEventListener('click',deleteTerm);
  $('term-undo').addEventListener('click',undoTerm);
  $('term-search').addEventListener('input',renderTerms);
  $('term-ar-find').addEventListener('click',scanArabicTerm);
  $('term-auto-add-all').addEventListener('click',()=>{
    const candidates=controller.termCandidates||[];
    if(!candidates.length)return message('Önce Arapça arama yapın.',true);
    if(confirm(candidates.length+' olası ayet numarası kutuya alınacak. Yalnız kelime eşleşmesi olduğu için anlam uygunluğunu tek tek kontrol edecek misiniz?'))
      addSuggestedTermRefs(candidates);
  });
  $('term-ar').addEventListener('input',()=>{
    controller.termCandidates=[];$('term-auto-list').replaceChildren();
    $('term-auto-count').textContent='Yeni Arapça metin girildi. Ayetlerde aramak için arama düğmesine basın.';
  });
  $('draft-backup-export').addEventListener('click',()=>{
    try{downloadJson('AYATULKURAN_234_TERIMLER_YEDEK_'+new Date().toISOString().slice(0,10)+'.json',
      makeBackup([...controller.records.values()]));
      message('Tam taslak yedeği indirildi. Bu dosyayı güvenli bir yerde saklayın.');}
    catch(e){message(e.message,true);}
  });
  $('draft-ready-export').addEventListener('click',()=>{
    try{
      const pack=readyCandidates([...controller.records.values()]);
      const num=Object.keys(pack.verses).length;
      if(num===0&&pack.terms.length===0)return message('Yayına hazır durumunda kayıt yok.',true);
      downloadJson('AYATULKURAN_YAYINA_HAZIR_ADAYLAR.json',pack);
      message(num+' âyet ve '+pack.terms.length+' terim için incelemeye sunulacak dosya indirildi. Kendiliğinden yayımlanmaz.');
    }catch(e){message(e.message,true);}
  });
  $('draft-import').addEventListener('click',importBackupFile);
  $('admin-link-234').addEventListener('click',()=>stopVoice(false));
  $('admin-link-terms').addEventListener('click',()=>stopVoice(false));
  $('admin-link-current').addEventListener('click',()=>stopVoice(false));
  window.addEventListener('hashchange',route);
  const badge=$('auth-badge');
  new MutationObserver(watchLogin).observe(badge,{attributes:true,childList:true,subtree:true,characterData:true});
  watchLogin();
}
bind();
