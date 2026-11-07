import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_IMPORT_BYTES,MAX_IMPORT_ROWS,parseConceptImport,buildConceptImport} from './mutesabih-kavramlar-import.mjs';
import {emptyConceptHistory,addConcept,archiveConcept,assertConceptHistory} from './mutesabih-kavramlar-core.mjs';

const T0 = '2026-11-07T12:00:00.000Z';
const T1 = '2026-11-07T12:01:00.000Z';
const T2 = '2026-11-07T12:02:00.000Z';
const T3 = '2026-11-07T12:03:00.000Z';
const T4 = '2026-11-07T12:04:00.000Z';
const SHA = 'a'.repeat(64), SHA2 = 'b'.repeat(64);
const TEXT = 'الْحَمْدُ', OTHER = 'الرَّحْمَٰنِ';
const CORPUS = {verses:{'1:2':{ar:'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'}}};
const SOURCE = {verse:'1.2',start:0,end:TEXT.length,origin:'admin_selection'};
const clone = value => JSON.parse(JSON.stringify(value));
const empty = () => emptyConceptHistory(T0);
const parse = (text = TEXT, fileName = 'kavramlar.txt') => parseConceptImport({fileName,text});
const options = overrides => ({sha256:SHA,actor:'Murat',corpus:CORPUS,clock:T1,...overrides});
const build = (parsed = parse(), doc = empty(), overrides) => buildConceptImport(doc,parsed,options(overrides));
const freeze = value => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};

test('Sınırlar sabittir: 1 MiB ve 200 veri satırı', () => {
  assert.equal(MAX_IMPORT_BYTES,1048576);
  assert.equal(MAX_IMPORT_ROWS,200);
});

test('TXT boş satırları atlar, fiziksel konumları ve tekrarları korur', () => {
  const out = parse(`\r\n  ${TEXT}  \r\n \t\r\n${OTHER}\r\n${TEXT}\r\n`);
  assert.equal(out.format,'txt');
  assert.equal(out.totalRows,3);
  assert.equal(out.duplicateRows,1);
  assert.deepEqual(out.entries,[{arabicText:TEXT,positions:[2,5],notes:[]},{arabicText:OTHER,positions:[4],notes:[]}]);
});

test('Dış boşluklar kırpılır; hareke ve iç boşluklar değiştirilmez', () => {
  const out = parse('  الْحَمْدُ  لله  \nالْحَمْدُ لله\nالحمد  لله');
  assert.deepEqual(out.entries.map(e => e.arabicText),['الْحَمْدُ  لله','الْحَمْدُ لله','الحمد  لله']);
  assert.equal(out.duplicateRows,0);
});

test('Tatweel ve hareke farkı farklı giriş olarak kalır', () => {
  const out = parse('الحمد\nالـحمد\nالْحَمْدُ');
  assert.equal(out.entries.length,3);
  assert.equal(build(out).newCount,3);
});

test('UTF-8 BOM, büyük uzantı ve tek CR satır sonu kabul edilir', () => {
  const out = parse(`\uFEFF${TEXT}\r${OTHER}`,'KAVRAMLAR.TXT');
  assert.equal(out.fileName,'KAVRAMLAR.TXT');
  assert.equal(out.format,'txt');
  assert.deepEqual(out.entries.map(e => e.positions),[[1],[2]]);
});

test('CSV virgül ayıracı ve boş not hücresi', () => {
  const out = parse(`kavram,not\n${TEXT},İlk not\n${OTHER},`,'liste.csv');
  assert.equal(out.totalRows,2);
  assert.deepEqual(out.entries,[{arabicText:TEXT,positions:[2],notes:['İlk not']},{arabicText:OTHER,positions:[3],notes:[]}]);
});

test('CSV noktalı virgül, tırnaklı ayraç ve kaçan çift tırnak', () => {
  const out = parse(`"kavram";"not"\r\n"${TEXT}";"Not, açıklama; ""alıntı"""`,'liste.csv');
  assert.deepEqual(out.entries[0].notes,['Not, açıklama; "alıntı"']);
});

test('CSV tırnak içindeki satır sonları korunur ve fiziksel satır doğru sayılır', () => {
  const out = parse(`kavram,not\n"${TEXT}\nلله","birinci\nikinci"\n${OTHER},son`,'liste.csv');
  assert.equal(out.entries[0].arabicText,`${TEXT}\nلله`);
  assert.deepEqual(out.entries[0].notes,['birinci\nikinci']);
  assert.deepEqual(out.entries.map(e => e.positions),[[2],[5]]);
});

test('CSV CRLF tırnak içi içeriği aynen korur', () => {
  const out = parse(`kavram,not\r\n${TEXT},"a\r\nb"\r\n${OTHER},c`,'liste.csv');
  assert.deepEqual(out.entries[0].notes,['a\r\nb']);
  assert.deepEqual(out.entries[1].positions,[4]);
});

test('CSV boş satır, BOM ve başlıktaki dış boşluklar', () => {
  const out = parse(`\uFEFF\n\n KAVRAM , NOT \n\n${TEXT},Not\n \n`,'liste.csv');
  assert.equal(out.totalRows,1);
  assert.deepEqual(out.entries[0].positions,[5]);
});

test('CSV aynı kavramın bütün satırları ve farklı notları birikir', () => {
  const out = parse(`kavram,not\n${TEXT},A\n${TEXT},B\n${TEXT},A`,'liste.csv');
  assert.equal(out.totalRows,3);
  assert.equal(out.duplicateRows,2);
  assert.deepEqual(out.entries[0],{arabicText:TEXT,positions:[2,3,4],notes:['A','B']});
});

test('CSV bilinmeyen/ters/eksik/çift başlık ve kaynak sütunu reddedilir', () => {
  for (const header of ['kavram','not,kavram','kavram,kavram','kavram,not,kaynak','arabic_text,note','kavram;not;source','kavram,source']) {
    assert.throws(() => parse(`${header}\n${TEXT},Not`,'liste.csv'),/CSV satır 1/);
  }
});

test('CSV yanlış hücre sayısı, boş kavram ve fazladan ayraç reddedilir', () => {
  for (const row of [TEXT,`${TEXT},Not,fazla`,`${TEXT},Not,`,',Not',',']) {
    assert.throws(() => parse(`kavram,not\n${row}`,'liste.csv'),/CSV satır 2/);
  }
});

test('CSV bozuk tırnakların hepsi kapalı biçimde reddedilir', () => {
  for (const row of [`"${TEXT},Not`,`${TEXT},"A"ek`,`${TEXT},A"B`,`${TEXT}, "Not"`,`"${TEXT}"x,Not`]) {
    assert.throws(() => parse(`kavram,not\n${row}`,'liste.csv'),/CSV satır 2/);
  }
  assert.throws(() => parse('"kavram,not\nالحمد,Not','liste.csv'),/CSV satır 1/);
});

test('CSV formül görünen notu yalnız düz metin olarak korur', () => {
  const out = parse(`kavram,not\n${TEXT},"=HYPERLINK(""https://example.test"",""Başlık"")"`,'liste.csv');
  assert.deepEqual(out.entries[0].notes,['=HYPERLINK("https://example.test","Başlık")']);
  const built = build(out);
  assert.ok(built.doc.records[0].notes[0].text.includes('=HYPERLINK('));
  assert.throws(() => parse('kavram,not\n=الحمد,Not','liste.csv'),/CSV satır 2/);
});

test('JSON metin dizisi ve sıra numaraları', () => {
  const out = parse(JSON.stringify([TEXT,OTHER,TEXT]),'liste.json');
  assert.equal(out.totalRows,3);
  assert.equal(out.duplicateRows,1);
  assert.deepEqual(out.entries,[{arabicText:TEXT,positions:[1,3],notes:[]},{arabicText:OTHER,positions:[2],notes:[]}]);
});

test('JSON nesne dizisi notları kaybetmeden birleştirir', () => {
  const out = parse(JSON.stringify([{arabic_text:` ${TEXT} `,note:' İlk '},{arabic_text:OTHER},{arabic_text:TEXT,note:'İkinci'}]),'liste.json');
  assert.deepEqual(out.entries[0],{arabicText:TEXT,positions:[1,3],notes:['İlk','İkinci']});
  assert.deepEqual(out.entries[1].notes,[]);
});

test('JSON karışık dizi ve yanlış alan türleri ilgili sırada reddedilir', () => {
  for (const value of [
    [TEXT,{arabic_text:OTHER}], [{arabic_text:TEXT},OTHER],
    [{arabic_text:TEXT},null], [{arabic_text:TEXT},{arabic_text:12}],
    [{arabic_text:TEXT},{arabic_text:OTHER,note:42}],
    [{arabic_text:TEXT},[OTHER]], [TEXT,false]
  ]) assert.throws(() => parse(JSON.stringify(value),'liste.json'),/JSON sıra 2/);
});

test('JSON fazladan source/verse alanları ve prototip anahtarları reddedilir', () => {
  for (const text of [
    '[{"arabic_text":"الحمد","source":"2.1"}]',
    '[{"arabic_text":"الحمد","verse":"2.1"}]',
    '[{"arabic_text":"الحمد","__proto__":{"polluted":true}}]',
    '[{"arabic_text":"الحمد","constructor":{"prototype":{}}}]',
    '[{"arabic_text":"الحمد","prototype":{}}]'
  ]) assert.throws(() => parse(text,'liste.json'),/JSON sıra 1/);
  assert.equal({}.polluted,undefined);
});

test('Tam çalışma JSON geçmişi doğrudan alınmaz ve üzerine yazılmaz', () => {
  assert.throws(() => parse(JSON.stringify(empty()),'kavramlar-calisma.json'),/tam çalışma JSON geçmişi içe alınamaz/);
  assert.throws(() => parse('{"schema":"eski","overrides":{}}','liste.json'),/üzerine yazılmaz/);
});

test('JSON bozuk sözdizimi, nesne kök ve boş dizi reddedilir', () => {
  for (const text of ['["الحمد",]','["الحمد"','[','null','42','"الحمد"','{}','[]']) assert.throws(() => parse(text,'liste.json'),/JSON sıra 1/);
});

test('Tek geçersiz veri satırı tüm TXT/CSV/JSON önizlemesini engeller', () => {
  assert.throws(() => parse(`${TEXT}\nAllah\n${OTHER}`),/TXT satır 2/);
  assert.throws(() => parse(`kavram,not\n${TEXT},Not\nAllah,Not\n${OTHER},Not`,'liste.csv'),/CSV satır 3/);
  assert.throws(() => parse(JSON.stringify([TEXT,'Allah',OTHER]),'liste.json'),/JSON sıra 2/);
});

test('Boş dosya ve yalnız boş satırlar alınmaz', () => {
  for (const text of ['', ' \n\t\r\n', '\uFEFF']) assert.throws(() => parse(text),/alınabilecek kavram yok/);
  assert.throws(() => parse('kavram,not\n\n','liste.csv'),/alınabilecek kavram yok/);
});

test('200 sınırı tekilleştirmeden önce veri satırlarına uygulanır', () => {
  const accepted = parse(Array(200).fill(TEXT).join('\n'));
  assert.equal(accepted.totalRows,200);
  assert.equal(accepted.entries.length,1);
  assert.throws(() => parse(Array(201).fill(TEXT).join('\n')),/TXT satır 201/);
  assert.throws(() => parse('kavram,not\n'+Array(201).fill(TEXT+',').join('\n'),'liste.csv'),/CSV satır 202/);
  assert.throws(() => parse(JSON.stringify(Array(201).fill(TEXT)),'liste.json'),/JSON sıra 201/);
});

test('Boş satırlar 200 kotasına katılmaz; büyük fiziksel konum korunur', () => {
  const out = parse('\n'.repeat(250)+TEXT);
  assert.equal(out.totalRows,1);
  assert.deepEqual(out.entries[0].positions,[251]);
});

test('1 MiB sınırı karakter değil UTF-8 bayt sayısıdır', () => {
  const beginning = TEXT+'\n';
  const exact = beginning+' '.repeat(MAX_IMPORT_BYTES-new TextEncoder().encode(beginning).byteLength);
  assert.equal(new TextEncoder().encode(exact).byteLength,MAX_IMPORT_BYTES);
  assert.equal(parse(exact).totalRows,1);
  assert.throws(() => parse(exact+' '),/baytlık/);
  assert.throws(() => parse('ا'.repeat(MAX_IMPORT_BYTES/2+1)),/baytlık/);
});

test('Geçersiz UTF-16 veya JSON kaçışından gelen tekil surrogate reddedilir', () => {
  assert.throws(() => parse(TEXT+'\uD800'),/UTF-8/);
  assert.throws(() => parse('[{"arabic_text":"الحمد","note":"\\ud800"}]','liste.json'),/JSON sıra 1/);
});

test('Not sınırı aşımı veya denetim karakteri sessizce kırpılmaz', () => {
  assert.throws(() => parse(JSON.stringify([{arabic_text:TEXT,note:'x'.repeat(4001)}]),'liste.json'),/JSON sıra 1/);
  assert.throws(() => parse(JSON.stringify([{arabic_text:TEXT,note:'x'.repeat(3900)}]),'liste.json'),/dosya izi ve biriken notlar/);
  assert.throws(() => parse(JSON.stringify([{arabic_text:TEXT,note:'Not\u0000'}]),'liste.json'),/JSON sıra 1/);
  assert.throws(() => parse(JSON.stringify([{arabic_text:TEXT,note:'a'.repeat(2000)},{arabic_text:TEXT,note:'b'.repeat(2000)}]),'liste.json'),/dosya izi ve biriken notlar/);
});

test('Dosya adı güvenli ve yalnız desteklenen uzantılı olmalı', () => {
  for (const fileName of ['', '../liste.txt','D:\\liste.txt','/liste.txt','a/b.txt','a\\b.txt','a\n.txt','a\u202E.txt','a.txt ',' a.txt','a.exe','liste','.txt','..txt','a<script>.txt','a'.repeat(256)+'.txt']) {
    assert.throws(() => parse(TEXT,fileName));
  }
  assert.equal(parse(TEXT,'Kavram listesi (1).TXT').format,'txt');
});

test('Giriş türleri ve prototip/accessor girdileri reddedilir', () => {
  for (const input of [null,[],TEXT,{fileName:'a.txt'},{fileName:'a.txt',text:123},{fileName:'a.txt',text:TEXT,source:'2.1'},Object.create({fileName:'a.txt',text:TEXT})]) assert.throws(() => parseConceptImport(input));
  let touched = false;
  const input = {fileName:'a.txt',get text() { touched = true; return TEXT; }};
  assert.throws(() => parseConceptImport(input));
  assert.equal(touched,false);
});

test('İçe aktarma kaynaksızdır; dosya adı/SHA/satır/not izini saklar', () => {
  const parsed = parse(`kavram,not\n${TEXT},Açıklama\n${TEXT},İkinci`,'anahtarlar.csv');
  const out = build(parsed);
  assert.equal(out.changed,true);
  assert.equal(out.newCount,1);
  assert.equal(out.updatedCount,0);
  assert.equal(out.unchangedCount,0);
  assert.deepEqual(out.doc.records[0].sources,[]);
  assert.equal(out.doc.events[0].source,null);
  assert.equal(out.doc.records[0].notes[0].text,`Dosyadan içe aktarma\nDosya: anahtarlar.csv\nSHA-256: ${SHA}\nSatırlar: 2, 3\nDosya notları:\n1. Açıklama\n2. İkinci`);
  assert.deepEqual(out.rows,[{arabicText:TEXT,action:'new',archived:false}]);
});

test('JSON kaynak notunda fiziksel satır yerine dizi sırası yazılır', () => {
  const out = build(parse(JSON.stringify([TEXT,TEXT]),'liste.json'));
  assert.ok(out.doc.records[0].notes[0].text.includes('Sıralar: 1, 2'));
});

test('Aynı dosya adı/SHA içe aktarımı yeniden kaydetmez', () => {
  const parsed = parse(TEXT+'\n'+OTHER);
  const first = build(parsed);
  const second = build(parsed,first.doc,{clock:T2});
  assert.equal(second.changed,false);
  assert.equal(second.newCount,0);
  assert.equal(second.updatedCount,0);
  assert.equal(second.unchangedCount,2);
  assert.deepEqual(second.doc,first.doc);
  assert.deepEqual(second.rows.map(r => r.action),['unchanged','unchanged']);
});

test('SHA harf büyüklüğü yinelenme denetimini bozmaz', () => {
  const first = build(parse(),empty(),{sha256:SHA.toUpperCase()});
  const second = build(parse(),first.doc,{clock:T2});
  assert.equal(second.changed,false);
  assert.ok(first.doc.records[0].notes[0].text.includes(SHA));
});

test('Farklı SHA veya yeniden adlandırılmış dosya yeni iz ekler', () => {
  const first = build();
  const changedBytes = build(parse(),first.doc,{sha256:SHA2,clock:T2});
  assert.equal(changedBytes.updatedCount,1);
  assert.equal(changedBytes.doc.records[0].notes.length,2);
  const renamed = build(parse(TEXT,'yeniden.txt'),first.doc,{clock:T2});
  assert.equal(renamed.updatedCount,1);
  assert.equal(renamed.doc.records[0].notes.length,2);
});

test('Mevcut kaynak, kullanıcı notu ve eski olaylar aynen korunur', () => {
  const manual = addConcept(empty(),{arabicText:TEXT,note:'Kullanıcı notu',source:SOURCE},'Önceki kullanıcı',CORPUS,T1);
  const out = build(parse(TEXT+'\n'+OTHER),manual.doc,{clock:T2});
  assert.equal(out.newCount,1);
  assert.equal(out.updatedCount,1);
  assert.deepEqual(out.doc.records[0].sources,manual.record.sources);
  assert.deepEqual(out.doc.records[0].notes[0],manual.record.notes[0]);
  assert.deepEqual(out.doc.events.slice(0,manual.doc.events.length),manual.doc.events);
  assert.equal(out.doc.records[0].created_at,T1);
  assert.equal(out.doc.records[0].created_by,'Önceki kullanıcı');
  assert.equal(out.doc.events[1].source,null);
});

test('Arşivli kavram yalnız zenginleşir; otomatik geri getirilmez', () => {
  const manual = addConcept(empty(),{arabicText:TEXT,source:SOURCE},'Murat',CORPUS,T1);
  const archived = archiveConcept(manual.doc,manual.record.id,'Beklet','Murat',T2);
  const out = build(parse(),archived.doc,{clock:T3});
  assert.equal(out.archivedCount,1);
  assert.equal(out.updatedCount,1);
  assert.equal(out.doc.records[0].status,'archived');
  assert.deepEqual(out.doc.records[0].sources,manual.record.sources);
  assert.deepEqual(out.rows,[{arabicText:TEXT,action:'update',archived:true}]);
  const repeated = build(parse(),out.doc,{clock:T4});
  assert.equal(repeated.archivedCount,1);
  assert.equal(repeated.unchangedCount,1);
  assert.equal(repeated.doc.records[0].status,'archived');
});

test('Yayın kilidi, şema ve oluşturulma tarihi değişmez', () => {
  const doc = empty(), out = build(parse(),doc);
  assert.deepEqual(out.doc.publication,{status:'not_published',automatic:false});
  assert.equal(out.doc.schema,doc.schema);
  assert.equal(out.doc.created_at,doc.created_at);
  assertConceptHistory(out.doc,CORPUS);
});

test('Bozuk mevcut belge veya açık yayın kilidi işlemi bloke eder', () => {
  for (const mutate of [d => { d.publication.automatic = true; },d => { d.schema = 'başka'; },d => { d.records = [{}]; }]) {
    const doc = empty(); mutate(doc);
    assert.throws(() => build(parse(),doc));
  }
});

test('Geçersiz hash ve kullanıcı tek kayıt bile üretmeden reddedilir', () => {
  const doc = empty(), snapshot = clone(doc);
  for (const sha256 of ['',null,123,'a'.repeat(63),'a'.repeat(65),'g'.repeat(64),' '+SHA]) assert.throws(() => build(parse(),doc,{sha256}));
  for (const actor of ['', ' ', null,42,'x\u0000','x'.repeat(201)]) assert.throws(() => build(parse(),doc,{actor}));
  assert.deepEqual(doc,snapshot);
});

test('Geçersiz ve geriye giden saat reddedilir; saat işlevi bir kez çağrılır', () => {
  for (const clock of [null,'bad','2026-02-30T00:00:00.000Z','2026-11-07T12:00:00Z',new Date(T1)]) assert.throws(() => build(parse(),empty(),{clock}));
  const first = build();
  assert.throws(() => build(parse(),first.doc,{clock:T0}),/eski/);
  let calls = 0;
  const out = build(parse(TEXT+'\n'+OTHER),empty(),{clock:() => { calls += 1; return T1; }});
  assert.equal(calls,1);
  assert.ok(out.doc.events.every(event => event.at === T1));
});

test('Hatalı seçenek türü/prototipi/accessor çalıştırılmadan reddedilir', () => {
  for (const invalid of [null,[],{},Object.create(options()),{...options(),source:'2.1'}]) assert.throws(() => buildConceptImport(empty(),parse(),invalid));
  let touched = false;
  assert.throws(() => buildConceptImport(empty(),parse(),{actor:'Murat',get sha256() { touched = true; return SHA; }}));
  assert.equal(touched,false);
});

test('Sahte önizleme sayıları, türleri, tekrarları ve alanları reddedilir', () => {
  const good = parse(TEXT+'\n'+OTHER);
  const mutations = [
    p => { p.format = 'json'; }, p => { p.totalRows = 3; }, p => { p.duplicateRows = 1; },
    p => { p.entries[1].arabicText = p.entries[0].arabicText; },
    p => { p.entries[1].arabicText = 'Allah'; },
    p => { p.entries[0].arabicText = ' '+TEXT; },
    p => { p.entries[1].positions = [1]; }, p => { p.entries[0].positions = [-1]; },
    p => { p.entries[0].positions = [1.1]; }, p => { p.entries[0].positions = [MAX_IMPORT_BYTES+2]; },
    p => { p.entries.reverse(); }, p => { p.entries[0].notes = ['Dış not']; },
    p => { p.entries[0].source = '2.1'; }, p => { p.entries[0].positions = '1'; },
    p => { p.entries[0].notes = null; }, p => { p.entries = []; },
    p => { p.entries[0].positions = Array(1); }
  ];
  const doc = empty(), snapshot = clone(doc);
  for (const mutate of mutations) { const parsed = clone(good); mutate(parsed); assert.throws(() => build(parsed,doc)); }
  assert.deepEqual(doc,snapshot);
});

test('Önizleme prototipi, sembolleri ve getter dizileri reddedilir', () => {
  const inherited = Object.create(parse());
  assert.throws(() => build(inherited));
  const protoArray = parse();
  Object.setPrototypeOf(protoArray.entries,{});
  assert.throws(() => build(protoArray));
  const symbolEntry = parse(); symbolEntry.entries[0][Symbol('extra')] = true;
  assert.throws(() => build(symbolEntry));
  const getterArray = parse(); let touched = false;
  Object.defineProperty(getterArray.entries,'0',{get() { touched = true; return {}; }});
  assert.throws(() => build(getterArray));
  assert.equal(touched,false);
});

test('JSON önizlemesinin sıra alanı kopuk veya sınır dışında olamaz', () => {
  const parsed = parse(JSON.stringify([TEXT,OTHER]),'liste.json');
  parsed.entries[1].positions = [3];
  assert.throws(() => build(parsed));
});

test('Sahte CSV/JSON not listeleri ve toplam not sınırı reddedilir', () => {
  const good = parse(JSON.stringify([{arabic_text:TEXT,note:'Not'}]),'liste.json');
  for (const notes of [[''],[' Not '],['Not','Not'],[42],['a'.repeat(4000)],['Not\u0000']]) {
    const parsed = clone(good); parsed.entries[0].notes = notes;
    assert.throws(() => build(parsed));
  }
});

test('İşlem donmuş girdileri değiştirmez; sonuç bağımsız kopyadır', () => {
  const doc = freeze(empty()), parsed = freeze(parse(TEXT+'\n'+OTHER)), opts = freeze(options());
  const beforeDoc = clone(doc), beforeParsed = clone(parsed), beforeOpts = clone(opts);
  const out = buildConceptImport(doc,parsed,opts);
  assert.deepEqual(doc,beforeDoc);
  assert.deepEqual(parsed,beforeParsed);
  assert.deepEqual(opts,beforeOpts);
  out.doc.records[0].notes[0].text = 'sonuç değişikliği';
  assert.deepEqual(doc,beforeDoc);
});

test('Geçersiz ikinci önizleme kaydı ilk kaydı da uygulamaz', () => {
  const parsed = parse(TEXT+'\n'+OTHER);
  parsed.entries[1].arabicText = 'Latin';
  const doc = empty(), snapshot = clone(doc);
  assert.throws(() => build(parsed,doc));
  assert.deepEqual(doc,snapshot);
  assert.equal(doc.events.length,0);
});

test('Eski kaynak corpus ile uyuşmuyorsa toplu kayıt da bloke edilir', () => {
  const manual = addConcept(empty(),{arabicText:TEXT,source:SOURCE},'Murat',CORPUS,T1);
  const snapshot = clone(manual.doc);
  assert.throws(() => build(parse(OTHER),manual.doc,{clock:T2,corpus:{verses:{'1:2':{ar:'başka'}}}}));
  assert.deepEqual(manual.doc,snapshot);
});

test('HTML/JS görünen dosya notu hiçbir biçimde çalıştırılmaz', () => {
  const note = '<script>globalThis.__kavramImportExecuted = true</script>';
  const parsed = parse(JSON.stringify([{arabic_text:TEXT,note}]),'liste.json');
  const out = build(parsed);
  assert.equal(globalThis.__kavramImportExecuted,undefined);
  assert.ok(out.doc.records[0].notes[0].text.includes(note));
});

test('Azami 200 farklı kavram tek sonuçta ve sıralı geçmişte oluşur', () => {
  const parsed = parse(Array.from({length:200},(_,index) => 'كلمة '+(index+1)).join('\n'));
  const out = build(parsed);
  assert.equal(out.newCount,200);
  assert.equal(out.doc.records.length,200);
  assert.equal(out.doc.events.length,200);
  assert.ok(out.doc.records.every(record => record.sources.length === 0));
  assert.deepEqual(out.doc.publication,{status:'not_published',automatic:false});
  assertConceptHistory(out.doc,CORPUS);
});
