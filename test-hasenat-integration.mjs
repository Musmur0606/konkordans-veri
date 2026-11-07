// HASENAT R2: ağsız kaynak/bağlantı/bütünlük testi; gerçek tarayıcı testi değildir.
// Çalıştırma: node test-hasenat-integration.mjs
// Dosya veya GitHub verisi yazmaz; sonucu yalnız standart çıktıya verir.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL(path,import.meta.url));
const text=path=>read(path).toString('utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const expectedFontSha='1d37c471fcd5afc126a925c1b18f7727fa944692558a17c12da890abd8ae384c';
const fontURL='/assets/fonts/hasenat.ttf?v=1d37c471';
const cssURL='/amiri-site.css?v=hasenat-2';
const css=text('./amiri-site.css').replace(/\/\*[\s\S]*?\*\//g,'');
const compact=value=>value.replace(/\s+/g,'');
const index=text('./index.html'), admin=text('./mutesabih-admin.html');
const wordPage=text('./kelime-kavram-deneme.html'), sw=text('./sw.js');
const faces=[...css.matchAll(/@font-face\s*\{([^}]*)\}/g)];
const face=faces[0]?.[1]||'';
const unicode=face.match(/unicode-range\s*:\s*([^;]+);/)?.[1]||'';
const ranges=[...unicode.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi)]
  .map(([,a,b])=>[parseInt(a,16),parseInt(b||a,16)]);
const covered=char=>ranges.some(([a,b])=>char.codePointAt(0)>=a&&char.codePointAt(0)<=b);
const rows=[], evidence={};
function test(name,fn){
  try{fn();rows.push({test:name,durum:'PASS'});console.log('PASS '+name);}
  catch(error){rows.push({test:name,durum:'FAIL',hata:error.message});console.error('FAIL '+name+': '+error.message);}
}

test('Özgün Hasenat dosyası 512.196 bayt ve SHA-256 ile birebir',()=>{
  const bytes=read('./assets/fonts/hasenat.ttf');
  assert.equal(bytes.length,512196);
  assert.equal(sha256(bytes),expectedFontSha);
  assert.equal(bytes.readUInt32BE(0),0x00010000,'TrueType başlığı');
  const tables=new Set();
  for(let i=0;i<bytes.readUInt16BE(4);i++)tables.add(bytes.toString('ascii',12+16*i,16+16*i));
  for(const name of ['cmap','GSUB','GPOS','GDEF'])assert.ok(tables.has(name),name+' korunur');
  evidence.font_sha256=sha256(bytes);
});

test('Tek Hasenat yüzü aynı kökten yüklenir; yerel kurulum şartı yok',()=>{
  assert.equal(faces.length,1);
  assert.match(face,/font-family\s*:\s*'AyatulKuran Hasenat'/);
  assert.ok(face.includes("url('"+fontURL+"') format('truetype')"));
  assert.doesNotMatch(face,/local\s*\(/i);
  assert.match(face,/font-weight\s*:\s*400\s*;/);
  assert.match(face,/font-display\s*:\s*swap\s*;/);
  assert.match(css,/@import[^;]*family=Amiri/);
});

test('6.236 âyetteki bütün harf ve harekeler CSS Arapça aralığına girer',()=>{
  const corpus=JSON.parse(text('./app_data.json'));
  assert.equal(Object.keys(corpus.verses).length,6236);
  const chars=new Set();let count=0;
  for(const verse of Object.values(corpus.verses))for(const char of verse.ar){chars.add(char);count++;}
  assert.equal(chars.size,73);assert.equal(count,700236);
  const missing=[...chars].filter(char=>!/^\s$/u.test(char)&&!covered(char));
  assert.deepEqual(missing,[]);
  evidence.kaynak_ayet_sayisi=6236;evidence.farkli_karakter_sayisi=chars.size;
  evidence.fallback_bosluklar=[...chars].filter(char=>!covered(char)).map(char=>'U+'+char.codePointAt(0).toString(16).toUpperCase().padStart(4,'0'));
});

test('Latin harfleri Hasenat aralığına girmez; genel Türkçe alanlar seçilmez',()=>{
  for(const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÇĞİÖŞÜçğıöşü0123456789')assert.equal(covered(char),false,char);
  const allowed=new Set(['.ar','.arabic','.arabic-text','.esma-ar','.esma-ar-big','.esma-side-ar','[lang|="ar"]','.ar-k-keys button','#arabic-keys button','#keys button','#term']);
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([,selector,body])=>!selector.trim().startsWith('@')&&/font-family\s*:/.test(body));
  assert.equal(rules.length,2);
  for(const [,selector] of rules)for(const item of selector.split(',').map(s=>s.trim()))assert.ok(allowed.has(item),'Daraltılmamış font seçicisi: '+item);
  assert.match(css,/#term\s*\{[^}]*font-family\s*:\s*'AyatulKuran Hasenat',system-ui,'Segoe UI',sans-serif!important/);
});

test('Yalnız Arapça klavye harfleri biçimlenir; Türkçe eylem düğmeleri korunur',()=>{
  for(const selector of ['.ar-k-keys button','#arabic-keys button','#keys button'])assert.ok(css.includes(selector));
  assert.doesNotMatch(css,/(?:\.ar-keyboard|\.ar-k-actions|\.key-actions)\s+button\s*[,\{]/);
  assert.match(index,/id="arabic-keys" class="ar-k-keys"/);
  assert.match(wordPage,/class="keys" id="keys"/);
  assert.match(index,/input\.lang=on\?'ar':'tr'/,'Arapça arama girişi [lang|="ar"] kapsamına alınır');
});

test('Admin Arapça âyet yönü/etiketi ve 2/3/4 çalışma bağlantısı korunur',()=>{
  assert.match(admin,/<p\b[^>]*id="main-arabic"[^>]*lang="ar"[^>]*dir="rtl"/);
  assert.match(admin,/<p\b[^>]*id="main-turkish"[^>]*lang="tr"/);
  assert.ok(admin.includes('/mutesabih-draft234.css?v=1'));
  const csp=admin.match(/Content-Security-Policy" content="([^"]*)"/)?.[1]||'';
  assert.match(csp,/font-src[^;]*'self'/);
});

test('Üç giriş sayfası aynı sürümlü ortak CSS dosyasını yalnız bir kez yükler',()=>{
  for(const [name,html] of [['index',index],['admin',admin],['kelime-kavram',wordPage]]){
    const links=[...html.matchAll(/<link\b[^>]*href="([^"<>]*amiri-site\.css[^"<>]*)"[^>]*>/g)];
    assert.equal(links.length,1,name);assert.equal(links[0][1],cssURL,name);
  }
});

const enlarged=[
  ['.maincard .ar,.maincard .ar.amiri-deneme',44,38],
  ['.rel .ar',32,30],['.arow .ar',32,28],
  ['.welcome-example .ar',35,32],['.esma-verse .ar',35,32],
  ['.ayet .ar',38,35],['.admin-main-verse #main-arabic',40,36],
  ['.concepts-panel textarea[lang="ar"],.concepts-arabic',36,34],
  ['.arabic',35,33],['.rec-name.ar',37,35],
];
const mediaAt=css.indexOf('@media(max-width:760px)');
const desktopCSS=compact(css.slice(0,mediaAt));
const mobileCSS=compact(css.slice(mediaAt));
test('R2 büyük masaüstü/dar ekran boyutları uygulanır; okunuş gizleme korunur',()=>{
  assert.ok(mediaAt>0,'Dar ekran kuralı bulunmalı');
  for(const [selector,desktop,mobile] of enlarged){
    assert.ok(desktopCSS.includes(compact(selector)+'{font-size:'+desktop+'px;'),selector+' masaüstü');
    assert.ok(mobileCSS.includes(compact(selector)+'{font-size:'+mobile+'px;'),selector+' dar ekran');
  }
  assert.ok(compact(css).includes('.ayet>.ok{display:none!important}'));
  assert.match(css,/font-synthesis\s*:\s*none/);
  evidence.arapca_boyutlari_px=enlarged.map(([alan,masaustu,dar_ekran])=>({alan,masaustu,dar_ekran}));
});

test('Esmâ adları büyür; yeni boyutlar Türkçe/klavye/karma kutuya taşmaz',()=>{
  const esma=[['.esma-ar',28],['.esma-ar-big',42],['.esma-side-ar',25]];
  for(const [selector,size] of esma)assert.ok(desktopCSS.includes(selector+'{font-size:'+size+'px;line-height:1.65}'));
  const allowed=new Set([...enlarged.map(([selector])=>selector),...esma.map(([selector])=>selector)]);
  for(const [,rawSelector,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(!/font-size\s*:/.test(body))continue;
    const selector=rawSelector.trim();
    assert.ok(allowed.has(selector),'Beklenmeyen boyut seçicisi: '+selector);
    const height=body.match(/line-height\s*:\s*([\d.]+)/)?.[1];
    assert.ok(Number(height)>=1.5,'Harekeler için satır aralığı: '+selector);
    assert.doesNotMatch(body,/(?:^|;)\s*(?:height|max-height)\s*:|overflow\s*:\s*hidden/);
  }
  assert.doesNotMatch(css,/#term\s*\{[^}]*font-size\s*:/);
});

test('Site/önbellek 2.8.22 eşleşir; ortak stil ve özgün font önbelleğe eklenir',()=>{
  assert.match(index,/const SITE_SURUM\s*=\s*'2\.8\.22'/);
  assert.match(sw,/const SURUM\s*=\s*'v2\.8\.22'/);
  assert.ok(index.includes("register('/sw.js?v=2.8.22', {updateViaCache:'none'})"));
  const core=sw.match(/const CEKIRDEK\s*=\s*\[([\s\S]*?)\];/)?.[1]||'';
  assert.ok(core.includes("'"+cssURL+"'"));assert.ok(core.includes("'"+fontURL+"'"));
  assert.match(sw,/x\s*!==\s*AD/,'Eski önbellek sürümü bırakılmaz');
});

test('Font yayını kavram çalışma verisini portal okuyucularına bağlamaz',()=>{
  for(const path of ['./index.html','./sw.js','./kelime-kavram-deneme.html','./mutesabih-public.js']){
    assert.doesNotMatch(text(path),/calisma-kavramlar|kavramlar-calisma\.json|mutesabih-kavramlar(?:-core)?\.mjs/,path);
  }
});

const failed=rows.filter(row=>row.durum==='FAIL');
console.log(JSON.stringify({sonuc:failed.length?'FAIL_HASENAT_STATIC':'PASS_HASENAT_STATIC',test_sayisi:rows.length,basarili:rows.length-failed.length,basarisiz:failed.length,testler:rows,kanit:evidence,gercek_ag_cagrisi:0,gercek_github_yazimi:0,gercek_tarayici_testi:false,not:'Bu test CSS kaynağı, bağlantılar ve özgün font bütünlüğünü kontrol eder. Fontun tarayıcıda indirilmesi, gerçek CSS yerleşimi ve boşluk fallback görünümü ayrıca kullanıcı tarayıcısında kabul gerektirir.'}));
if(failed.length)process.exitCode=1;
