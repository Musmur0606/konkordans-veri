#!/usr/bin/env node
/**
 * READ-ONLY comparison between the historical DOCX V1.1 snapshot (dot keys)
 * and the accepted R23 Word matrix (colon keys). No live data is overwritten.
 *
 * node tools/compare_legacy_v1_1_to_r23.mjs [legacy.json] [active.json] [corpus.json] [report.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [legacyPath='data/ayet_benzesme_site_v1_1.json',
  activePath='data/benzesen-matris.json',
  corpusPath='app_data.json',
  reportPath] = process.argv.slice(2);
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const corpus=read(corpusPath);
if (!corpus?.verses || Object.keys(corpus.verses).length!==6236)
  throw Error('Kur’an metni: 6236 âyet veya verses tablosu bulunamadı.');
const source=read('data/benzesen-matris-kaynak.json');
if (sha(activePath)!==source.json_sha256)
  throw Error('Kabul edilmiş R23 matrisinin SHA256 değeri değişmiş; karşılaştırma durduruldu.');
const norm=(str)=>{
  const m=/^(\d{1,3})[.:](\d{1,3})$/.exec(String(str));
  if (!m) throw Error('Geçersiz ayet kimliği: '+str);
  const s=+m[1],a=+m[2];
  if (s<1||s>114||a<1) throw Error('Geçersiz ayet kimliği: '+str);
  const ref=s+':'+a;
  if (!Object.hasOwn(corpus.verses,ref)) throw Error('Kur’an metninde bulunmuyor: '+str);
  return ref;
};
function validate(obj,label){
  if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error(label+': veri haritası yok');
  const out=new Map();
  let edges=0,empties=0;
  for(const [raw,arr] of Object.entries(obj)){
    const main=norm(raw);
    if([2,3,4].includes(Number(main.split(':')[0])))
      throw Error(label+': korunan sûre kaynak olarak yer alıyor: '+main);
    if(main!==raw.replace('.',':'))throw Error(label+': normalleştirilmemiş kimlik: '+raw);
    if(out.has(main))throw Error(label+': tekrar eden ana: '+main);
    if(!Array.isArray(arr))throw Error(label+': eşleşen dizi değil: '+main);
    const refs=[],seen=new Set();
    for(const v of arr){
      const other=norm(v);
      if(other===main||seen.has(other))throw Error(label+': tekrar/kendine bağlantı: '+main+' -> '+other);
      seen.add(other);refs.push(other);
    }
    if(!refs.length)empties++;
    edges+=refs.length;
    out.set(main,refs);
  }
  return {map:out,mains:out.size,edges,empties};
}
const old=validate(read(legacyPath),'V1.1');
const active=validate(read(activePath),'R23');
if(old.mains!==5574||old.edges!==175375)
  throw Error('V1.1 beklenen 5574/175375 sayıları sağlanmadı: '+old.mains+'/'+old.edges);
if(active.mains!==5574||active.edges!==175478)
  throw Error('R23 beklenen 5574/175478 sayıları sağlanmadı: '+active.mains+'/'+active.edges);
const differences=[];let onlyR23=0,onlyV11=0,orderOnly=0;
for(const [main,oldList] of old.map){
  const currentList=active.map.get(main);
  if(!currentList)throw Error('R23 kaynakta eksik ana ayet: '+main);
  const a=new Set(oldList),b=new Set(currentList);
  const added=currentList.filter(x=>!a.has(x));
  const removed=oldList.filter(x=>!b.has(x));
  const orderDifferent=!added.length&&!removed.length&&oldList.join('|')!==currentList.join('|');
  if(added.length||removed.length||orderDifferent){
    onlyR23+=added.length;onlyV11+=removed.length;
    if(orderDifferent)orderOnly++;
    differences.push({main,old:oldList.length,r23:currentList.length,
      only_r23:added,only_v1_1:removed,order_only:orderDifferent});
  }
}
for(const main of active.map.keys())if(!old.map.has(main))
  throw Error('V1.1 kaynakta eksik ana ayet: '+main);
const sortRefs=(a,b)=>{const x=a.split(':').map(Number),y=b.split(':').map(Number);return x[0]-y[0]||x[1]-y[1]};
differences.sort((a,b)=>sortRefs(a.main,b.main));
const top=[...differences].sort((a,b)=>
  (b.only_r23.length+b.only_v1_1.length)-(a.only_r23.length+a.only_v1_1.length)
  ||sortRefs(a.main,b.main)).slice(0,20)
  .map(x=>({main:x.main,only_r23:x.only_r23.length,only_v1_1:x.only_v1_1.length,order_only:x.order_only}));
const report={
  schema:'ayatulkuran.v1_1-vs-r23-audit.v1',
  note:'Salt-okunur fark denetimi. R23/175478 kabul edilmiş kaynak korunur; GitHub added/removed yöneticilik düzeltmeleri ayrı otoritedir.',
  files:{historical:legacyPath,accepted:activePath},
  sha256:{historical:sha(legacyPath),accepted:sha(activePath)},
  totals:{historical_main:old.mains,historical_edges:old.edges,historical_empty:old.empties,
    accepted_main:active.mains,accepted_edges:active.edges,accepted_empty:active.empties,
    net_difference:active.edges-old.edges,
    only_in_accepted:onlyR23,only_in_historical:onlyV11,
    differing_main: differences.length,order_only_main:orderOnly},
  most_changed:top,differences
};
if(reportPath){
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({...report,differences:undefined},null,2));
