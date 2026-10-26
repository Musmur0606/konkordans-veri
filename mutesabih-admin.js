import { parseVerses, normalizeMain, canEditMain, otherVerseBase, wordMatrixBaseline, cleanState, getMerged, applyEdit, undoOne, undoDay, dayInTurkey, eventLabel, assertHistory } from '/mutesabih-core.mjs?v=3';

const OWNER = 'Musmur0606';
const REPO = 'konkordans-veri';
const BRANCH = 'main';
const BASE_PATH = 'data/benzesen-matris.json';
const HISTORY_PATH = 'data/mutesabih-degisiklikler.json';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}/contents/`;
const $ = (id) => document.getElementById(id);
const runtime = { token: '', actor: '', data: null, corpus: null, doc: null, sha: '', selected: '5.61', busy: false, drafts: new Map() };

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
  if(base.status==='word')return ['Word matrisi','neutral'];
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

function pickerOption(value,label) {
  const option=document.createElement('option');option.value=String(value);option.textContent=label;return option;
}

function populateSuras() {
  const list=$('sura-picker');list.replaceChildren();
  for(let s=1;s<=114;s++) {
    const first=runtime.corpus?.verses?.[s+':1'];
    if(first)list.append(pickerOption(s,s+' — '+first.sa+' Sûresi'));
  }
}

function populateAyahs(sura) {
  const list=$('ayah-picker');list.replaceChildren();
  for(let ayah=1;runtime.corpus?.verses?.[sura+':'+ayah];ayah++) {
    list.append(pickerOption(ayah,ayah+'. Âyet'));
  }
}

function syncPickers(main) {
  const [sura,ayah]=main.split('.').map(Number);
  if($('sura-picker').value!==String(sura)){
    $('sura-picker').value=String(sura);
    populateAyahs(sura);
  }
  $('ayah-picker').value=String(ayah);
}

function showMain(main) {
  chooseMain(main,true);
}

function chooseMain(main,filterToMain=false) {
  const next=normalizeMain(main);
  if(next!==runtime.selected) {
    const oldDraft={refs:$('refs').value,reason:$('reason').value};
    if(oldDraft.refs||oldDraft.reason)runtime.drafts.set(runtime.selected,oldDraft);
    else runtime.drafts.delete(runtime.selected);
    const draft=runtime.drafts.get(next)||{refs:'',reason:''};
    $('refs').value=draft.refs;
    $('reason').value=draft.reason;
  }
  runtime.selected=next;
  if(filterToMain)$('main-search').value=next;
  showMessage('main-message',next+' ana âyet olarak açıldı. Arapça ve Türkçe meali sağda.','success');
  renderAll();
}

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
    row.addEventListener('click',()=>chooseMain(base.main));list.append(row);
  }
  if(!found.length)list.append(createText('p','micro','Aradığınız âyet bulunamadı.'));
}

function openMain() {
  try {
    const main=normalizeMain($('direct-main').value);
    if(!runtime.corpus?.verses?.[main.replace('.',':')])throw Error('Kur’an metninde bulunmuyor.');
    showMain(main);
  }catch(error){showMessage('main-message',error.message,'error');}
}

function renderSelected() {
  const base=currentBase();if(!base)return;
  syncPickers(base.main);
  $('direct-main').value=base.main;
  const currentState=runtime.doc?.overrides?.[base.main];
  const [label,color]=status(base,currentState);
  $('main-key').textContent='ANA ÂYET · '+base.main;
  const verse=runtime.corpus?.verses?.[base.main.replace('.',':')];
  $('main-title').textContent=base.status==='site' && verse?.sa?verse.sa+' Sûresi · '+verse.a+'. Âyet':base.heading;
  $('main-source').textContent=base.status==='site'?'Kaynak: '+base.source.file+' · Mevcut site ilişkileri korunur.':'Kaynak: '+base.source.file+' · 114 Word belgesinden çıkarılan sûre/âyet matrisi';
  $('main-arabic').textContent=verse?.ar||'Bu âyetin Arapça metni bulunamadı.';
  $('main-turkish').textContent=verse?.mb||'Bu âyetin Türkçe meali bulunamadı.';
  $('source-note').textContent=base.status==='site'?'Korumalı sûrenin mevcut site kayıtları gösterilir; bu ana âyet değiştirilemez.':'Word kaynaklı 175.478 bağlantı ayrı bir kaynak olarak korunur. Bu ana âyet için ekleme/çıkarma GitHub MLOG dosyasına ve ana sitenin görünümüne yansır. İlişkilerin anlamı ayrıca incelenebilir.';
  if(!canEditMain(base.main))$('source-note').textContent='KORUMALI: Bakara (2), Âl-i İmrân (3) ve Nisâ (4) ana âyetleri görüntülenebilir; ancak bu üç sûrede ekleme/çıkarma kapalıdır. Başka ana âyetlerin benzeşen listelerinde bu sûrelere atıf serbesttir.';
  $('main-status').textContent=label;$('main-status').className='pill '+color;
  const links=getMerged(base,currentState);
  $('link-count').textContent=links.length+' ilişki ('+base.links.length+(base.status==='site'?' mevcut site':' Word matrisi')+' kaydı)';
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
  document.body.classList.toggle('admin-authorized',logged);
  const locked=!canEditMain(runtime.selected);
  $('auth-badge').textContent=logged?'GİRİŞ: '+runtime.actor:'GİRİŞ YAPILMADI';
  $('auth-badge').className='status '+(logged?'connected':'neutral');
  $('token').hidden=logged;$('login').hidden=logged;$('logout').hidden=!logged;
  // Yönetim alanı yalnız doğrulanmış GitHub hesabında görünür.
  // GitHub API yazmaları ayrıca yetki anahtarıyla korunur.
  for (const id of ['refs','reason','add','remove','confirm','review','voice-refs']) {
    $(id).disabled=runtime.busy||locked;
  }
  $('editor-state').textContent=locked
    ? 'KORUMALI ANA ÂYET: Bakara (2), Âl-i İmrân (3) ve Nisâ (4) için ekleme/çıkarma yapılamaz. Diğer sûrelerden bir ana âyet seçin.'
    : logged
      ? 'Yönetici girişi açık. Ekleme ve çıkarma GitHub’a kaydedilmeden önce yeniden onayınız istenecek.'
      : 'Giriş yapılmadı. Yönetim ekranı gizlidir.';
  $('editor-state').className='editor-state'+(locked?' locked':logged?' ready':' preview');
  $('rollback-day').disabled=!logged||runtime.busy||!$('history-day').value;
  $('download-day').disabled=!$('history-day').value;
}

function renderAll() {
  renderAuth(); renderList(); renderSelected(); renderHistory();
  if(runtime.data) $('stats').textContent='6.236 seçilebilir âyet · '+runtime.data.counts.main+' Word ana âyeti · '+runtime.data.counts.candidates.toLocaleString('tr-TR')+' benzeşen bağlantı · '+(runtime.doc?.events?.length||0)+' MLOG işlemi';
}

function updateParsed() {
  const value=$('refs').value.trim();
  if(!value){$('parsed').textContent='';return;}
  try{const parsed=parseVerses(value);$('parsed').textContent='Seçilen âyetler ('+parsed.length+'): '+parsed.slice(0,22).join(' · ')+(parsed.length>22?' …':'');}
  catch(error){$('parsed').textContent='İfade hatası: '+error.message;}
}


const SPEECH_NUMBERS = Object.freeze({
  'sıfır':0,'bir':1,'iki':2,'üç':3,'dört':4,'beş':5,'altı':6,'yedi':7,'sekiz':8,'dokuz':9,
  'on':10,'yirmi':20,'otuz':30,'kırk':40,'elli':50,'altmış':60,'yetmiş':70,'seksen':80,'doksan':90
});
let speechReader = null;

function spokenInteger(tokens) {
  if(tokens.length===1 && /^\d{1,3}$/.test(tokens[0]))return Number(tokens[0]);
  if(tokens.some(t=>!Object.hasOwn(SPEECH_NUMBERS,t)&&t!=='yüz'))throw Error('Sesli sayı anlaşılmadı: '+tokens.join(' '));
  let total=0, beforeHundred=0, afterHundred=0, hasHundred=false;
  for(const t of tokens){
    if(t==='yüz'){
      if(hasHundred)throw Error('Yüz ifadesi tekrarlanamaz.');
      total+=(beforeHundred||1)*100;beforeHundred=0;hasHundred=true;
    }else if(hasHundred)afterHundred+=SPEECH_NUMBERS[t];
    else beforeHundred+=SPEECH_NUMBERS[t];
  }
  return total+beforeHundred+afterHundred;
}

function speechRefsToTemplate(transcript) {
  let phrase=String(transcript||'').toLocaleLowerCase('tr-TR').trim();
  if(!phrase)throw Error('Ses algılanmadı.');
  phrase=phrase.replace(/([0-9])\s*([.:])\s*([0-9])/g,'$1 nokta $3')
    .replace(/([0-9])\s*[-–]\s*([0-9])/g,'$1 tire $2')
    .replace(/\b(noktası|noktasına)\b/gu,'nokta')
    .replace(/\bvirgülü\b/gu,'virgül');
  const words=phrase.match(/[0-9]+|[a-zçğıöşü]+|[.,:;-]/gu)||[];
  const tokens=[];
  for(const w of words){
    if(['kadar','ayet','ayetler','ayetleri','e','a','ye','ya'].includes(w))continue;
    if(['ile','arası','arasi','aralık','tire','çizgi','çizgisi'].includes(w)){tokens.push('aralık');continue;}
    const suffix=/^([a-zçğıöşü]+?)(den|dan|ten|tan|ye|ya|e|a)$/u.exec(w);
    if(suffix && (Object.hasOwn(SPEECH_NUMBERS,suffix[1])||suffix[1]==='yüz')){
      tokens.push(suffix[1]);
      if(['den','dan','ten','tan'].includes(suffix[2]))tokens.push('aralık');
      continue;
    }
    const digitSuffix=/^([0-9]+)(den|dan|ten|tan|ye|ya|e|a)$/u.exec(w);
    if(digitSuffix){
      tokens.push(digitSuffix[1]);
      if(['den','dan','ten','tan'].includes(digitSuffix[2]))tokens.push('aralık');
      continue;
    }
    tokens.push(w);
  }
  const parts=[];let numbers=[];
  const flush=()=>{if(numbers.length){parts.push({type:'number',value:spokenInteger(numbers)});numbers=[];}};
  for(const w of tokens){
    if(/^[0-9]+$/.test(w)||w==='yüz'||Object.hasOwn(SPEECH_NUMBERS,w)){
      if(/^[0-9]+$/.test(w)&&numbers.length)flush();
      numbers.push(w);continue;
    }
    flush();
    if(['nokta','.',':'].includes(w))parts.push({type:'dot'});
    else if(['virgül',',',';'].includes(w))parts.push({type:'comma'});
    else if(['aralık','tire','çizgi','-'].includes(w))parts.push({type:'range'});
    else if(['ve','sonra'].includes(w))parts.push({type:'join'});
    else throw Error('Anlaşılamayan kelime: '+w);
  }
  flush();
  let output='',last='start';
  for(let i=0;i<parts.length;i++){
    const p=parts[i],next=parts[i+1];
    if(p.type==='number'){
      if(p.value<1||p.value>999)throw Error('Geçersiz sayı: '+p.value);
      if(last==='number')output+=next?.type==='dot'?' ':',';
      output+=String(p.value);last='number';
    }else if(p.type==='dot'){
      if(last!=='number'||next?.type!=='number')throw Error('Nokta ifadesi eksik.');
      output+='.';last='dot';
    }else if(p.type==='comma'){
      if(last!=='number'||next?.type!=='number')throw Error('Virgül ifadesi eksik.');
      output+=',';last='comma';
    }else if(p.type==='range'){
      if(last!=='number'||next?.type!=='number')throw Error('Aralık ifadesi eksik.');
      output+='-';last='range';
    }else if(p.type==='join'){
      if(last!=='number'||next?.type!=='number')throw Error('Bağlantı ifadesi eksik.');
      output+=parts[i+2]?.type==='dot'?' ':',';
      last='join';
    }
  }
  if(last!=='number')throw Error('Eksik âyet numarası.');
  parseVerses(output);
  return output;
}

function voiceMessage(message,isError=false){
  const area=$('voice-status');
  area.textContent=message;
  area.style.color=isError?'#a3341f':'';
}

let voiceActive=false;
let voiceRestartCount=0;
let voiceRestartTimer=null;
function stopVoiceRefs(){
  voiceActive=false;
  if(voiceRestartTimer){clearTimeout(voiceRestartTimer);voiceRestartTimer=null;}
  if(speechReader){try{speechReader.stop();}catch{}}
  $('voice-refs').textContent='🎙️ Sesle âyet gir';
  voiceMessage('Dinleme durduruldu. Girilen âyetleri kontrol edin.');
}
function startVoiceRefs(){
  if(voiceActive){stopVoiceRefs();return;}
  const SpeechAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechAPI){voiceMessage('Tarayıcı desteklemiyor. Windows + H veya klavye mikrofonunu kullanın.',true);return;}
  if(!runtime.token||runtime.busy||!canEditMain(runtime.selected)){voiceMessage('Önce yönetici girişi ve düzenlenebilir ana âyet seçimi gerekli.',true);return;}
  voiceActive=true;voiceRestartCount=0;
  $('voice-refs').textContent='■ Sesli girişi bitir';
  function listen(){
    if(!voiceActive)return;
    const reader=new SpeechAPI();
    speechReader=reader;
    reader.lang='tr-TR';reader.continuous=true;reader.interimResults=false;reader.maxAlternatives=1;
    reader.onresult=(event)=>{
      for(let i=event.resultIndex;i<event.results.length;i++){
        if(!event.results[i].isFinal)continue;
        const heard=event.results[i][0]?.transcript||'';
        try{
          const converted=speechRefsToTemplate(heard);
          const previous=$('refs').value.trim();
          const merged=(previous?previous+' ':'')+converted;
          parseVerses(merged);
          $('refs').value=merged;
          $('refs').dispatchEvent(new Event('input',{bubbles:true}));
          voiceMessage('Eklendi: '+converted+' · Dinleme sürüyor. Kaydetmeden önce kontrol edin.');
        }catch(error){voiceMessage('“'+heard+'” anlaşılmadı: '+error.message+' Dinleme sürüyor.',true);}
      }
      voiceRestartCount=0;
    };
    reader.onerror=(event)=>{
      if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)){
        voiceActive=false;voiceMessage('Mikrofon izni veya erişimi engellendi.',true);
      }else if(event.error==='network'){
        voiceActive=false;voiceMessage('Ses hizmeti bağlantısı kesildi. Yeniden başlatın.',true);
      }else if(event.error!=='no-speech'&&event.error!=='aborted'){
        voiceMessage('Ses algılama uyarısı: '+event.error,true);
      }
    };
    reader.onend=()=>{
      if(speechReader===reader)speechReader=null;
      if(!voiceActive){$('voice-refs').textContent='🎙️ Sesle âyet gir';return;}
      if(voiceRestartCount>=8){
        voiceActive=false;$('voice-refs').textContent='🎙️ Sesle âyet gir';
        voiceMessage('Tarayıcı art arda dinlemeyi sonlandırdı. Yeniden başlatın.',true);return;
      }
      voiceRestartCount++;
      voiceRestartTimer=setTimeout(()=>{voiceRestartTimer=null;listen();},350);
    };
    try{reader.start();voiceMessage('Dinliyorum… Art arda âyet söyleyin. Bitirmek için düğmeye basın.');}
    catch(error){voiceActive=false;speechReader=null;$('voice-refs').textContent='🎙️ Sesle âyet gir';voiceMessage('Mikrofon başlatılamadı: '+error.message,true);}
  }
  listen();
}

async function refreshFiles(authToken=runtime.token) {
  // Public source is served by GitHub Pages; mutable state is ALWAYS read
  // from GitHub's contents API with SHA, never from service-worker caches.
  const [baseResponse,corpusResponse]=await Promise.all([
    fetch('/'+BASE_PATH+'?t='+Date.now(),{cache:'no-store'}),
    fetch('/app_data.json',{cache:'force-cache'}),
  ]);
  if(!baseResponse.ok)throw Error('Yeni Word matrisi henüz yayına ulaşmadı ('+baseResponse.status+').');
  if(!corpusResponse.ok)throw Error('Kur’an metni ve benzeşme kaynağı yüklenemedi ('+corpusResponse.status+').');
  const [matrix,corpus]=await Promise.all([baseResponse.json(),corpusResponse.json()]);
  if(!corpus.verses||Object.keys(corpus.verses).length!==6236)throw Error('Kur’an 6.236 âyet kaynağı beklenen biçimde değil.');
  const data=wordMatrixBaseline(matrix,corpus);
  const history=await loadGitHubFile(HISTORY_PATH,authToken);assertHistory(history.content);
  runtime.data=data;runtime.corpus=corpus;runtime.doc=history.content;runtime.sha=history.sha;
  populateSuras();
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
  if(!canEditMain(base.main)){
    showMessage('edit-message','Bu ana âyet korumalıdır. Başka bir sûreden ana âyet seçiniz.','error');
    return;
  }
  if(!runtime.token){
    showMessage('edit-message','Ekleme/çıkarma için önce yukarıdaki GitHub yönetici girişini tamamlayınız. Yazdığınız âyetler silinmedi.','error');
    $('token').focus();
    return;
  }
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
    runtime.drafts.delete(base.main);
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
$('sura-picker').addEventListener('change',()=>{
  const sura=Number($('sura-picker').value);
  if(!sura)return;
  populateAyahs(sura);
  showMain(sura+'.1');
});
$('ayah-picker').addEventListener('change',()=>{
  const sura=Number($('sura-picker').value),ayah=Number($('ayah-picker').value);
  if(sura&&ayah)showMain(sura+'.'+ayah);
});
$('open-main').addEventListener('click',openMain);
$('direct-main').addEventListener('keydown',(e)=>{if(e.key==='Enter')openMain();});
$('refs').addEventListener('input',updateParsed);
$('voice-refs').addEventListener('click',startVoiceRefs);
$('login').addEventListener('click',authorize);
$('token').addEventListener('keydown',(e)=>{if(e.key==='Enter')authorize();});
$('logout').addEventListener('click',()=>{stopVoiceRefs();runtime.token='';runtime.actor='';runtime.data=null;runtime.corpus=null;runtime.doc=null;runtime.sha='';runtime.drafts.clear();$('main-list').replaceChildren();$('link-list').replaceChildren();showMessage('login-message','Güvenli çıkış yapıldı. Yönetim ekranı kapatıldı.','success');renderAll();});
for(const op of ['add','remove','confirm','review'])$(op).addEventListener('click',()=>submitEdit(op));
$('history-day').addEventListener('change',()=>{renderHistory();renderAuth();});
$('clear-day').addEventListener('click',()=>{$('history-day').value='';renderHistory();renderAuth();});
$('download-day').addEventListener('click',downloadDailyLog);
$('rollback-day').addEventListener('click',submitUndoDay);

renderAuth(); // Kaynaklar yetkili GitHub girişinden sonra yüklenir.
