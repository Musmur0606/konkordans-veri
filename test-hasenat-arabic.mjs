import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {test} from 'node:test';

const load=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const map=load('./sitemap.xml');
const pages=[...map.matchAll(/https:\/\/www\.ayatulkuran\.com\/(\d+-[a-z0-9-]+\.html)/g)].map(m=>m[1]);
const extra=[
  'index.html','sureler.html','mutesabih.html','mutesabih-admin.html',
  'kelime-kavram-deneme.html','draft_esma.html','guncel-286.html','guncel-287.html'
];
test('Bütün 114 ana sûre sayfası ve 114 alternatif sûre sayfası HASENAT stiline bağlı',()=>{
  assert.equal(pages.length,114);
  const all=[...pages,...pages.map(p=>'sure-'+p),...extra];
  assert.equal(all.length,236);
  for(const p of all){
    const html=load('./'+p);
    assert.equal((html.match(/\/assets\/hasenat-arabic\.css/g)||[]).length,1,p);
    assert.equal((html.match(/<\/head>/g)||[]).length,1,p);
    assert.equal((html.match(/<html\b/g)||[]).length,1,p);
  }
});
test('Stil dosyası font binary dağıtmadan yerel HASENAT kullanıyor',()=>{
  const css=load('./assets/hasenat-arabic.css');
  assert.match(css,/font-family:\s*"AyatulKuran Hasenat"/);
  assert.match(css,/src:\s*local\("HASENAT"\)/);
  assert.ok(css.includes('.ar,') && css.includes('.arabic,'));
  assert.ok(css.includes('.esma-ar,') && css.includes('.ar-k-keys button,'));
  assert.equal(existsSync(new URL('./assets/hasenat.ttf',import.meta.url)),false);
  assert.equal(existsSync(new URL('./assets/hasenat.woff2',import.meta.url)),false);
});
