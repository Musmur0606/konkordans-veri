import {getMerged,cleanState,canEditMain,otherVerseBase} from '/mutesabih-core.mjs?v=2';

const $=id=>document.getElementById(id);
const STATE={baseline:null,overrides:{},corpus:null,selected:'5.61'};
function text(tag,content,className=''){const x=document.createElement(tag);x.textContent=String(content??'');if(className)x.className=className;return x;}
function label(base){if(!canEditMain(base.main))return ['Korumalı sûre','neutral'];const s=cleanState(STATE.overrides[base.main]).status;if(s==='confirmed')return ['Doğrulandı','green'];if(s==='review')return ['Sarı inceleme','yellow'];if(base.status==='red')return ['Kırmızı kaynak','red'];if(base.status==='yellow')return ['Sarı inceleme','yellow'];return ['Mevcut site kaydı','neutral'];}
function verseData(key){return STATE.corpus?.verses?.[key.replace('.',':')];}
function verseName(key){const v=verseData(key);return v?.sa?`${v.sa} Sûresi · ${v.a}. Âyet`:key;}
function baseFor(key){return STATE.baseline.records.find(r=>r.main===key)||otherVerseBase(key,STATE.corpus);}

function findMainVerses(search){
  const source=STATE.baseline.records;
  if(!search){
    const known=new Set(source.map(r=>r.main));
    const added=Object.keys(STATE.overrides).filter(key=>!known.has(key)).map(key=>{
      try{return baseFor(key);}catch{return null;}
    }).filter(Boolean);
    return [...source,...added];
  }
  const keys=Object.keys(STATE.corpus.verses).filter(key=>{
    const v=STATE.corpus.verses[key];
    return key.replace(':','.').includes(search)||String(v.sa||'').toLocaleLowerCase('tr').includes(search);
  });
  keys.sort((a,b)=>Number(b===search.replace('.',':'))-Number(a===search.replace('.',':')));
  return keys.slice(0,100).map(key=>baseFor(key.replace(':','.')));
}

function renderList(){
  const target=$('public-list');target.replaceChildren();if(!STATE.baseline)return;
  const search=$('public-search').value.trim().toLocaleLowerCase('tr');
  for(const r of findMainVerses(search)){
    const button=text('button','', 'main-item'+(r.main===STATE.selected?' active':''));
    button.type='button';button.append(text('b',r.main),text('span',label(r)[0]),text('small',verseName(r.main)));
    button.addEventListener('click',()=>{STATE.selected=r.main;renderList();renderDetail();});target.append(button);
  }
}

function renderDetail(){
  if(!STATE.baseline||!STATE.corpus)return;
  const base=baseFor(STATE.selected);if(!base)return;
  const item=verseData(base.main);const [name,color]=label(base);
  $('public-key').textContent='ANA ÂYET · '+base.main;
  $('public-heading').textContent=verseName(base.main);
  $('public-status').className='pill '+color;$('public-status').textContent=name;
  $('public-arabic').textContent=item?.ar||'Arapça metin bulunamadı.';
  $('public-turkish').textContent=item?.mb||'Türkçe meal bulunamadı.';
  $('public-english').textContent=item?.me||'English translation not found.';
  const matches=getMerged(base,STATE.overrides[base.main]);
  $('public-count').textContent=matches.length+' benzeşen âyet';
  const root=$('public-matches');root.replaceChildren();
  for(const match of matches){
    const details=document.createElement('details');
    const summary=document.createElement('summary');summary.append(text('span',match.key+' · '+verseName(match.key)));
    if(match.added)summary.append(text('span','Yönetici ekledi','match-added'));
    const inside=text('div','','inside');const v=verseData(match.key);
    inside.append(text('div',v?.ar||'Arapça bulunamadı.','arabic'));
    inside.append(text('h3','Türkçe meal'),text('p',v?.mb||'Türkçe meal bulunamadı.'));
    inside.append(text('h3','English'),text('p',v?.me||'English translation not found.'));
    if(match.page)inside.append(text('p','Kaynak Word sayfası: '+match.page,'public-hint'));
    details.append(summary,inside);root.append(details);
  }
  if(!matches.length)root.append(text('p','Bu ana âyet için listelenen benzeşme yok.','public-hint'));
}

async function load(){
  // Read the current override log from the public GitHub raw source so it
  // remains the source of truth independently of any ChatGPT site database.
  const stamp=Date.now();
  const responses=await Promise.all([
    fetch('/data/mutesabih-r14.json?cb='+stamp,{cache:'no-store'}),
    fetch('https://raw.githubusercontent.com/Musmur0606/konkordans-veri/main/data/mutesabih-degisiklikler.json?cb='+stamp,{cache:'no-store'}),
    fetch('/app_data.json',{cache:'force-cache'}),
  ]);
  for(let i=0;i<responses.length;i++)if(!responses[i].ok)throw Error(['Ana âyet verisi','GitHub güncelleme geçmişi','Kur’an metinleri'][i]+' yüklenemedi ('+responses[i].status+').');
  const [baseline,changed,corpus]=await Promise.all(responses.map(r=>r.json()));
  if(baseline.schema!=='ayatulkuran.word-r14-baseline.v1'||baseline.counts.main!==176)throw Error('Ana âyet sicili beklenen biçimde değil.');
  if(changed.schema!=='ayatulkuran.github-edits.v1')throw Error('GitHub güncelleme verisi beklenen biçimde değil.');
  if(!corpus.verses||!corpus.verses['5:61']||!corpus.verses['56:59'])throw Error('Kur’an metinleri eksik.');
  STATE.baseline=baseline;STATE.overrides=changed.overrides;STATE.corpus=corpus;
  $('public-stats').textContent='6.236 seçilebilir âyet · '+baseline.counts.main+' Word başlığı · '+baseline.counts.candidates+' Word adayı · '+changed.events.length+' yönetici işlemi';
  renderList();renderDetail();
}

$('public-search').addEventListener('input',renderList);
load().catch(error=>{$('public-stats').textContent='Kayıtlar açılamadı.';$('public-warning').replaceChildren(text('p',error.message,'public-error'));});
