// Kavram eşleşmesi için salt-okunur kabul denemesi; GitHub ve canlı veri yazması yok.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareConceptVerses, arabicWordPositions, fillArabicHighlights} from './mutesabih-kavram-eslestirme.mjs';

const corpus = {verses: {
  '2:2': {arh: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ'},
  '3:9': {arh: 'رَبَّنَا لَا رَيْبَ فِيهِ'},
  '4:7': {arh: 'الْكِتَابُ لَا رَيْبَ وَالْكِتَابُ'},
  '5:1': {arh: 'وَالْكِتَابُ'},
  '6:1': {arh: 'لَا رَيْبَ لَا رَيْبَ'},
  '7:1': {arh: 'اَلْكِتَابِيَّةُ'},
  '8:1': {arh: 'لَا، رَيْبَ'},
  '9:1': {arh: 'ذَٰلِكَ الْكِتَابُ'},
  '10:1': {arh: 'هَٰذَا كِتَابٌ'},
}};
const records = [
  {id:'kavram-00000002',arabic_text:'الْكِتَابُ',status:'active'},
  {id:'kavram-00000001',arabic_text:'لَا رَيْبَ',status:'active'},
  {id:'kavram-00000003',arabic_text:'ذَٰلِكَ',status:'archived'},
  {id:'kavram-00000004',arabic_text:'عِلْمٌ',status:'active'},
];
const existingLinks = [
  {key:'3.9',page:11,added:false}, {key:'4.7',page:12,added:true},
  {key:'3.9',page:11,added:false}, {key:'2.2',page:1,added:false},
];

function test(name, fn) {
  fn();console.log('PASS',name);
}

test('Kayıtsız durumda mevcut benzeşenler korunur; kaynak dizi değişmez',()=>{
  const before=JSON.stringify(existingLinks);
  const empty=compareConceptVerses({main:'2.2',existingLinks,corpus,records:[]});
  assert.deepEqual(empty.links.map(link=>link.key),['3.9','4.7']);
  assert.equal(empty.addedCount,0);assert.equal(empty.mainHighlights.length,0);
  assert.equal(JSON.stringify(existingLinks),before);
});

const result=compareConceptVerses({main:'2.2',existingLinks,corpus,records});
test('Yalnız ana âyette geçen etkin kavramlar eşleştirilir',()=>{
  assert.deepEqual(result.matchedConcepts.map(c=>c.label),['لَا رَيْبَ','الْكِتَابُ']);
  assert(result.mainHighlights.some(h=>corpus.verses['2:2'].arh.slice(h.start,h.end)==='لَا رَيْبَ'));
  assert(result.mainHighlights.some(h=>corpus.verses['2:2'].arh.slice(h.start,h.end)==='الْكِتَابُ'));
});

test('Mevcut liste birleşir, iki kavram tek âyet üretir, ana âyet dışarıda kalır',()=>{
  assert.deepEqual(result.links.map(link=>link.key),['3.9','4.7','6.1','9.1']);
  assert.equal(result.addedCount,2);assert.equal(result.sharedCount,2);
  assert.equal(new Set(result.links.map(link=>link.key)).size,result.links.length);
  assert(!result.links.some(link=>link.key==='2.2'));
  assert.equal(result.links.find(link=>link.key==='4.7').added,true);
  assert.equal(result.links.find(link=>link.key==='4.7').viaConcept,false);
  assert.equal(result.links.find(link=>link.key==='4.7').concepts.length,2);
  assert.equal(result.links.find(link=>link.key==='3.9').page,11);
});

test('Kelime grubu bütünüyle ve tekrarlı geçişler ayrı aralıklarla eşleşir',()=>{
  const phrase=result.matchedConcepts.find(c=>c.label==='لَا رَيْبَ');
  const repeated=result.links.find(link=>link.key==='6.1');
  const matched=repeated.concepts.find(c=>c.id===phrase.id);
  assert.equal(matched.ranges.length,2);
  for(const range of matched.ranges) {
    assert.equal(repeated.arabic.slice(range.start,range.end),'لَا رَيْبَ');
    assert.equal(matched.color,phrase.color);
  }
  assert(!result.links.some(link=>link.key==='7.1'||link.key==='8.1'||link.key==='10.1'));
});

test('Kavramların tamamı arşivlenirse yeni sonuç ve renk oluşmaz',()=>{
  const inactive=compareConceptVerses({main:'2.2',corpus,existingLinks,records:records.map(r=>({...r,status:'archived'}))});
  assert.equal(inactive.addedCount,0);assert.equal(inactive.mainHighlights.length,0);
  assert.deepEqual(inactive.links.map(l=>l.key),['3.9','4.7']);
});

test('Arapça kelime sınırları korunur ve noktalama kelime grubu sayılmaz',()=>{
  assert.deepEqual(arabicWordPositions('الْكِتَابُ، لا رَيْبَ').map(w=>w.key),['الكتاب','لا','ريب']);
  const matches=compareConceptVerses({main:'2.2',existingLinks:[],corpus,records:[records[0]]});
  assert(!matches.links.some(l=>l.key==='7.1'));
});

test('DOM işaretleri orijinal Arapça metni ve tüm kelime grubunu korur',()=>{
  class Node {
    constructor(tag='') {this.tagName=tag;this.childNodes=[];this.className='';this.title='';this._text='';}
    set textContent(value) {this._text=String(value);this.childNodes=[];}
    get textContent() {return this.childNodes.length?this.childNodes.map(n=>n.textContent).join(''):this._text;}
    append(node) {this.childNodes.push(node);}
    replaceChildren() {this._text='';this.childNodes=[];}
  }
  const previous=globalThis.document;
  globalThis.document={createTextNode:text=>{const n=new Node('#text');n.textContent=text;return n;},createElement:tag=>new Node(tag)};
  try {
    const main=new Node('p');
    fillArabicHighlights(main,corpus.verses['2:2'].arh,result.mainHighlights);
    assert.equal(main.textContent,corpus.verses['2:2'].arh);
    assert.deepEqual(main.childNodes.filter(n=>n.tagName==='mark').map(n=>n.textContent),['الْكِتَابُ','لَا رَيْبَ']);
    const other=new Node('p'),link=result.links.find(l=>l.key==='4.7');
    fillArabicHighlights(other,link.arabic,link.concepts.flatMap(c=>c.ranges.map(r=>({...r,...c}))));
    assert.equal(other.textContent,link.arabic);
    assert(other.childNodes.some(n=>n.tagName==='mark'&&n.textContent==='لَا رَيْبَ'&&n.title.includes('لَا رَيْبَ')));
    assert(other.childNodes.filter(n=>n.tagName==='mark').every(n=>/concept-tone-[0-5]/.test(n.className)));
  } finally {globalThis.document=previous;}
});

// 6.236 âyetin gerçek Hasenat yazımıyla tam ibare araması; veri dosyasına yazılmaz.
const fullCorpus=JSON.parse(await readFile(new URL('./app_data.json',import.meta.url),'utf8'));
const actual=compareConceptVerses({
  main:'2.2',corpus:fullCorpus,existingLinks:[{key:'3.9',added:true,page:9}],
  records:[{id:'kavram-fixture',status:'active',arabic_text:'لَا رَيْبَ'}]
});
test('Gerçek 6.236 âyet Hasenat verisinde ana âyet ve 3.9 ortak ifadeyi aynı renkte taşır',()=>{
  assert.equal(Object.keys(fullCorpus.verses).length,6236);
  assert.equal(actual.links.find(link=>link.key==='3.9').viaConcept,false);
  assert.equal(actual.links.find(link=>link.key==='3.9').concepts.length,1);
  assert(actual.addedCount>0);assert(actual.links.length>1);
  assert(!actual.links.some(link=>link.key==='2.2'));
  const main=fullCorpus.verses['2:2'].arh;
  assert(actual.mainHighlights.some(h=>main.slice(h.start,h.end).includes('رَيْبَ')));
  for(const link of actual.links) for(const concept of link.concepts) for(const range of concept.ranges) {
    assert.equal(arabicWordPositions(link.arabic.slice(range.start,range.end)).length,2);
    assert.equal(concept.color,actual.matchedConcepts[0].color);
  }
});

console.log('KAVRAM BENZEŞME QA: 8/8 PASS · canlı veri ve GitHub yazması: 0');
