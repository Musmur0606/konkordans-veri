// DOCX/PDF dosya çıkarma + onay öncesi güvenlik senaryoları (GitHub yazması yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {wordXmlRows,extractConceptDocument,MAX_DOCUMENT_BYTES} from './mutesabih-kavramlar-document.mjs';
import {parseConceptImport,buildConceptImport} from './mutesabih-kavramlar-import.mjs';
import {emptyConceptHistory,assertConceptHistory} from './mutesabih-kavramlar-core.mjs';
import {compareConceptVerses} from './mutesabih-kavram-eslestirme.mjs';

const require=createRequire(import.meta.url),JSZip=require('jszip');
const DAY='2026-11-08T09:00:00.000Z';
const corpus={verses:{'1:2':{ar:'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'},'2:2':{ar:'رَبِّ الْعَالَمِينَ لَا رَيْبَ'},'3:9':{ar:'الْعَالَمِينَ لَا رَيْبَ'}}};
const xmlBody=body=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const paragraph=(text,style='')=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const cell=text=>`<w:tc>${paragraph(text)}</w:tc>`;
const tableRow=(value,note)=>`<w:tr>${cell(value)}${cell(note)}</w:tr>`;
async function docx(xml,extra={}){
  const zip=new JSZip();zip.file('word/document.xml',xml);
  for(const [name,value] of Object.entries(extra))zip.file(name,value);
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
const filename='kavram-listesi.docx';
const P1='رَبِّ الْعَالَمِينَ';

test('Word paragraf ve iki sütunlu tablo ibareyi tek kavram olarak alır',async()=>{
  const xml=xmlBody(paragraph('Kavram veri girişi','Title')+paragraph(P1)+
    `<w:tbl>${tableRow('Kavram','Not')}${tableRow('لَا رَيْبَ','İkinci kavram')}</w:tbl>`);
  const bytes=await docx(xml);
  const rows=await extractConceptDocument({fileName:filename,bytes},{zipLib:JSZip});
  assert.deepEqual(rows,[{value:P1,note:'',position:1},{value:'لَا رَيْبَ',note:'İkinci kavram',position:2}]);
  const parsed=parseConceptImport({fileName:filename,rows});
  assert.equal(parsed.format,'docx');assert.equal(parsed.entries.length,2);
  assert.equal(parsed.entries[0].arabicText,P1);
  const result=buildConceptImport(emptyConceptHistory(DAY),parsed,{
    sha256:'a'.repeat(64),actor:'Musmur0606',corpus,clock:'2026-11-08T09:01:00.000Z',
  });
  assert.equal(result.newCount,2);assertConceptHistory(result.doc,corpus);
  assert.deepEqual(result.doc.records[0].sources,[]);
  const compared=compareConceptVerses({main:'1.2',corpus,records:result.doc.records});
  assert.deepEqual(compared.links.map(x=>x.key),['2.2']);
  assert(compared.mainHighlights.some(r=>corpus.verses['1:2'].ar.slice(r.start,r.end)===P1));
});

test('Word XML biçim ve Unicode varlığı korunur; desteklenmeyen entity reddedilir',()=>{
  const xml=xmlBody(`<w:p><w:r><w:t>رَبِّ </w:t></w:r><w:r><w:t>الْعَالَمِينَ</w:t></w:r></w:p>`);
  assert.equal(wordXmlRows(xml)[0].value,P1);
  assert.throws(()=>wordXmlRows(xmlBody(paragraph('&madeup;'))),/XML kodlaması/);
  assert.throws(()=>wordXmlRows('<!DOCTYPE x>'+xml),/güvenli|geçersiz/);
  assert.throws(()=>wordXmlRows(xmlBody(paragraph('لا'))+'<w:p>'),/güvenli|bozuk|yarım|geçersiz/);
});

test('DOCX makrolu belge ve büyük açılmış metin reddedilir',async()=>{
  const bytes=await docx(xmlBody(paragraph(P1)),{'word/vbaProject.bin':'test'});
  await assert.rejects(()=>extractConceptDocument({fileName:'makro.docx',bytes},{zipLib:JSZip}),/Makro/);
  const huge=await docx(xmlBody(paragraph('ا'.repeat(1024*1024+15))));
  await assert.rejects(()=>extractConceptDocument({fileName:filename,bytes:huge},{zipLib:JSZip}),/büyük|boyutu/);
});

test('PDF metin katmanında iki kelime tek kavramdır; sayfa bilgisi notta kalır',async()=>{
  let destroyed=0;
  const pdfLib={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[
    {str:'الْعَالَمِينَ',dir:'rtl',transform:[1,0,0,1,250,700]},
    {str:'رَبِّ',dir:'rtl',transform:[1,0,0,1,400,700]},
    {str:'لَا رَيْبَ',dir:'rtl',transform:[1,0,0,1,400,650]},
  ]})}),destroy:async()=>{destroyed++;}})})};
  const bytes=new TextEncoder().encode('%PDF-1.7\nFAKE');
  const rows=await extractConceptDocument({fileName:'ibareler.pdf',bytes},{pdfLib});
  assert.deepEqual(rows,[{value:P1,note:'PDF sayfa 1',position:1},{value:'لَا رَيْبَ',note:'PDF sayfa 1',position:2}]);
  const parsed=parseConceptImport({fileName:'ibareler.pdf',rows});
  assert.equal(parsed.entries.length,2);assert.equal(destroyed,1);
});

test('Metin katmanı olmayan PDF, yanlıs uzantı ve PDF görünmeyen işaretler kapalı kalır',async()=>{
  const fake={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]})}),destroy:async()=>{}})})};
  await assert.rejects(()=>extractConceptDocument({fileName:'scan.pdf',bytes:new TextEncoder().encode('%PDF-1.5'),},{pdfLib:fake}),/OCR/);
  await assert.rejects(()=>extractConceptDocument({fileName:'fake.pdf',bytes:new TextEncoder().encode('not a pdf'),},{pdfLib:fake}),/PDF başlığı/);
  await assert.rejects(()=>extractConceptDocument({fileName:'fake.doc',bytes:new Uint8Array([1])},{zipLib:JSZip}),/DOCX veya PDF/);
  const broken={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[
    {str:'ر\u0001 ب',dir:'rtl',transform:[1,0,0,1,250,700]},
  ]})}),destroy:async()=>{}})})};
  await assert.rejects(()=>extractConceptDocument({fileName:'bozuk.pdf',bytes:new TextEncoder().encode('%PDF-1.5'),},{pdfLib:broken}),/metin katmanı bozuk/);
});

test('İçe aktarım belge satırlarını doğrular, Türkçe veya kaynak tahminini reddeder',()=>{
  const valid={fileName:'ibareler.pdf',rows:[{value:P1,note:'PDF sayfa 1',position:1}]};
  assert.equal(parseConceptImport(valid).entries[0].arabicText,P1);
  assert.throws(()=>parseConceptImport({fileName:'ibareler.pdf',rows:[{value:'Türkçe açıklama',note:'',position:1}]}),/Arapça/);
  assert.throws(()=>parseConceptImport({fileName:'ibareler.pdf',rows:[{value:P1,note:'',position:1,source:'1.2'}]}),/alanlar/);
  assert.throws(()=>parseConceptImport({fileName:'ibareler.pdf',text:P1}),/Dosya türü/);
  assert.throws(()=>parseConceptImport({fileName:'ibareler.pdf',rows:[],text:P1}),/Dosya türü/);
  assert.throws(()=>parseConceptImport({fileName:'kavramlar.txt',rows:[{value:P1,note:'',position:1}]}),/Dosya türü/);
  assert.equal(MAX_DOCUMENT_BYTES,10*1024*1024);
});
