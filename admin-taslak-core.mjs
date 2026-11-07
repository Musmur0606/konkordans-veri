// AYATULKURAN - Gizli taslaklar icin saf veri/konusma kurallari.
// Bu dosya site matrisini veya GitHub'daki kayitlari degistirmez.
import {normalizeMain, parseVerses} from './mutesabih-core.mjs';

export const DRAFT_SCHEMA='ayatulkuran.admin-local-234-terms.v1';
export const CANDIDATE_SCHEMA='ayatulkuran.unpublished-candidates.v1';
export const SURA_LIMITS=Object.freeze({2:286,3:200,4:176});
export const STATUS=Object.freeze(['taslak','inceleme','hazir']);
export const TOTAL_LOCKED_VERSES=662;
const normRef=value=>normalizeMain(String(value||'').trim().replace(':','.'));
const cleanText=(value,max)=>String(value??'').trim().slice(0,max);
const isStringArray=value=>Array.isArray(value)&&value.every(x=>typeof x==='string');

export function isLockedVerse(ref) {
  const main=normRef(ref);
  return Object.hasOwn(SURA_LIMITS,main.split('.')[0]);
}
export function parseReferenceList(text,main=null) {
  const refs=String(text??'').trim()?parseVerses(String(text).trim()):[];
  if(main&&refs.includes(normRef(main)))throw Error('Ana âyet kendisiyle eşleştirilemez.');
  return [...new Set(refs)];
}
export function ensureStatus(value) {
  if(!STATUS.includes(value))throw Error('Geçersiz durum: '+value);
  return value;
}
function previousSnapshot(record) {
  if(record.kind==='ayet')return {refs:[...record.refs],status:record.status,note:record.note,at:record.updated_at};
  return {arabic:record.arabic,turkish:record.turkish,english:record.english,
    note:record.note,refs:[...record.refs],status:record.status,at:record.updated_at};
}
function versioned(base,previous,now) {
  const history=previous?
    [...(Array.isArray(previous.history)?previous.history:[]),previousSnapshot(previous)].slice(-50):[];
  return {...base,version:(previous?.version||0)+1,created_at:previous?.created_at||now,
    updated_at:now,history};
}
export function saveVerseDraft(input,previous=null,now=new Date().toISOString()) {
  const main=normRef(input.main);
  if(!isLockedVerse(main))throw Error('Bu çalışma yalnız 2, 3 ve 4. sûrelerin ana âyetleri içindir.');
  if(previous&&previous.main!==main)throw Error('Ana âyet değiştirilemez.');
  const refs=Array.isArray(input.refs)?parseReferenceList(input.refs.join(' '),main)
    :parseReferenceList(input.refs??'',main);
  const base={key:'ayet:'+main,kind:'ayet',main,refs,status:ensureStatus(input.status||'taslak'),
    note:cleanText(input.note,3000)};
  return versioned(base,previous,now);
}
export function saveTermDraft(input,previous=null,now=new Date().toISOString()) {
  const id=previous?.id||cleanText(input.id,90);
  if(!/^t_[A-Za-z0-9_-]{5,85}$/.test(id))throw Error('Terim kimliği geçersiz.');
  const arabic=cleanText(input.arabic,900).normalize('NFC');
  if(!/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(arabic))
    throw Error('Terime Arapça kelime veya kelime grubu yapıştırın.');
  const turkish=cleanText(input.turkish,600);
  if(!turkish)throw Error('Türkçe terim veya açıklama başlığı yazılmalı.');
  const refs=Array.isArray(input.refs)?parseReferenceList(input.refs.join(' '))
    :parseReferenceList(input.refs??'');
  const base={key:'terim:'+id,kind:'terim',id,arabic,turkish,
    english:cleanText(input.english,600),note:cleanText(input.note,3000),
    refs,status:ensureStatus(input.status||'taslak')};
  return versioned(base,previous,now);
}
export function assertDraftRecord(row) {
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Taslak kaydı bulunamadı.');
  if(row.kind==='ayet'){
    const clean=saveVerseDraft({main:row.main,refs:row.refs,status:row.status,note:row.note});
    if(row.key!==clean.key)throw Error('Ana âyet taslak anahtarı uyumsuz.');
  }else if(row.kind==='terim'){
    const clean=saveTermDraft({id:row.id,arabic:row.arabic,turkish:row.turkish,
      english:row.english,refs:row.refs,status:row.status,note:row.note});
    if(row.key!==clean.key)throw Error('Terim taslak anahtarı uyumsuz.');
  }else throw Error('Tanınmayan kayıt türü.');
  if(!isStringArray(row.refs)||row.refs.length!==new Set(row.refs).size)
    throw Error('Eşleşme listesi hatalı/tekrarlı.');
  if(!Number.isInteger(row.version)||row.version<1||row.version>1000000)
    throw Error('Taslak sürümü geçersiz.');
  if(!Array.isArray(row.history)||row.history.length>50)
    throw Error('Sürüm geçmişi geçersiz.');
  return row;
}
export function makeBackup(records,now=new Date().toISOString()) {
  for(const row of records)assertDraftRecord(row);
  return {schema:DRAFT_SCHEMA,created_at:now,storage:'tarayici_indeksli_veritabani',
    description:'Yayımlanmamış yerel yönetici taslakları; canlı site ve GitHub R23 matrisi değişmedi.',
    records:records.map(r=>structuredClone(r))};
}
export function readBackup(doc) {
  if(doc?.schema!==DRAFT_SCHEMA||!Array.isArray(doc.records)||doc.records.length>10000)
    throw Error('Dosya yönetici taslak yedeği değil.');
  const keys=new Set();
  for(const row of doc.records){
    assertDraftRecord(row);
    if(keys.has(row.key))throw Error('Yedekte aynı kayıt iki kez bulunuyor: '+row.key);
    keys.add(row.key);
  }
  return doc.records;
}
export function readyCandidates(records,now=new Date().toISOString()) {
  const verses=Object.create(null),terms=[];
  for(const row of records){
    assertDraftRecord(row);
    if(row.status!=='hazir')continue;
    if(row.kind==='ayet'){
      verses[row.main.replace('.',':')]=row.refs.map(r=>r.replace('.',':'));
    }else{
      terms.push({id:row.id,arabic:row.arabic,turkish:row.turkish,
        english:row.english,note:row.note,refs:[...row.refs]});
    }
  }
  return {schema:CANDIDATE_SCHEMA,created_at:now,
    warning:'Bu dosya yalnız incelemeye hazır adaylardır. Hiçbir kayıt otomatik yayımlanmaz.',
    protected_main_suras:[2,3,4],verses,terms};
}

// Arapca kopyala/yapistir ile harf dizisi taramasi. Bu bir kavramsal eslestirme DEGIL,
// sadece imla/hareke farklari giderilmis ayet adaylari aramasidir.
export function normalizeArabicForSearch(value) {
  return String(value??'').normalize('NFC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu,'')
    .replace(/[\u0623\u0625\u0622\u0671]/gu,'\u0627')
    .replace(/\u0649/gu,'\u064A')
    .replace(/[\u200C\u200D\uFEFF]/gu,'')
    .replace(/[^\p{Script=Arabic}\s]/gu,' ')
    .replace(/\s+/gu,' ').trim();
}
export function findArabicCandidateRefs(arabic,verses,limit=100) {
  const searched=normalizeArabicForSearch(arabic);
  if(!searched||searched.length<2)throw Error('Arapça arama için en az iki harf gereklidir.');
  if(!verses||typeof verses!=='object')throw Error('Kur’an Arapça metinleri henüz yüklenmedi.');
  const found=[];
  const rows=Object.entries(verses).sort(([a],[b])=>refSortColon(a,b));
  for(const [ref,verse] of rows) {
    if(!verse?.ar)continue;
    const normalized=normalizeArabicForSearch(verse.ar);
    if(normalized.includes(searched))found.push(ref.replace(':','.'));
  }
  return {query:searched,total:found.length,refs:found.slice(0,Math.max(1,Math.min(limit,500)))};
}
function refSortColon(a,b) {
  const x=a.split(':').map(Number),y=b.split(':').map(Number);
  return x[0]-y[0]||x[1]-y[1];
}

const NUM=Object.freeze({
  'sıfır':0,'bir':1,'iki':2,'üç':3,'dört':4,'beş':5,'altı':6,'yedi':7,'sekiz':8,'dokuz':9,
  'on':10,'yirmi':20,'otuz':30,'kırk':40,'elli':50,'altmış':60,'yetmiş':70,'seksen':80,'doksan':90
});
function spokenInteger(tokens) {
  if(tokens.length===1&&/^\d{1,3}$/.test(tokens[0]))return Number(tokens[0]);
  if(tokens.some(t=>!Object.hasOwn(NUM,t)&&t!=='yüz'))
    throw Error('Sesli sayı anlaşılmadı: '+tokens.join(' '));
  let total=0,before=0,after=0,hundred=false;
  for(const t of tokens){
    if(t==='yüz'){
      if(hundred)throw Error('Yüz ifadesi tekrarlanamaz.');
      total+=(before||1)*100;before=0;hundred=true;
    }else if(hundred)after+=NUM[t];
    else before+=NUM[t];
  }
  return total+before+after;
}
export function spokenReferences(transcript) {
  let phrase=String(transcript||'').toLocaleLowerCase('tr-TR').trim();
  if(!phrase)throw Error('Ses algılanmadı.');
  phrase=phrase.replace(/\b(bakara)\s+(suresi|sûresi|sure|sûre)?\b/gu,'2 nokta ')
    .replace(/\b(âl-i imrân|ali imran|al i imran)\s+(suresi|sûresi|sure|sûre)?\b/gu,'3 nokta ')
    .replace(/\b(nisâ|nisa)\s+(suresi|sûresi|sure|sûre)?\b/gu,'4 nokta ')
    .replace(/([0-9])\s*([.:])\s*([0-9])/g,'$1 nokta $3')
    .replace(/([0-9])\s*[-–]\s*([0-9])/g,'$1 tire $2')
    .replace(/\b(noktası|noktasına)\b/gu,'nokta')
    .replace(/\bvirgülü\b/gu,'virgül');
  const words=phrase.match(/[0-9]+|[a-zçğıöşüâîû]+|[.,:;-]/gu)||[];
  const tokens=[];
  for(const w of words){
    if(['kadar','ayet','âyet','ayetler','âyetler','ayetleri','suresi','sûresi','sure','sûre',
      'e','a','ye','ya'].includes(w))continue;
    if(['ile','arası','arasi','aralık','tire','çizgi','çizgisi','den','dan','ten','tan'].includes(w)){
      tokens.push('aralık');continue;
    }
    const suffix=/^([a-zçğıöşüâîû]+?)(den|dan|ten|tan|ye|ya|e|a)$/u.exec(w);
    if(suffix&&(Object.hasOwn(NUM,suffix[1])||suffix[1]==='yüz')){
      tokens.push(suffix[1]);
      if(['den','dan','ten','tan'].includes(suffix[2]))tokens.push('aralık');
      continue;
    }
    const digits=/^([0-9]+)(den|dan|ten|tan|ye|ya|e|a)$/u.exec(w);
    if(digits){
      tokens.push(digits[1]);
      if(['den','dan','ten','tan'].includes(digits[2]))tokens.push('aralık');
      continue;
    }
    tokens.push(w);
  }
  const parts=[];let numbers=[];
  const flush=()=>{if(numbers.length){parts.push({type:'number',value:spokenInteger(numbers)});numbers=[];}};
  for(const w of tokens){
    if(/^[0-9]+$/.test(w)||w==='yüz'||Object.hasOwn(NUM,w)){
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
