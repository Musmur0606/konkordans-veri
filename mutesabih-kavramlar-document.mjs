// Dosyadan Arapça kavram çıkarma: yalnız yerel tarayıcı belleğinde çalışır.
// PDF/DOCX içeriğinden tahmini âyet kaynağı üretilmez; çıktı onay bekler.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_TEXT_BYTES = 1024 * 1024;
const MAX_DOCX_XML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_PAGES = 40;
const MAX_ROWS = 200;
const BAD_PDF_EXTRACTION = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFFFD]/u;

function fail(message) { throw new Error(message); }

function utf8Length(text) { return new TextEncoder().encode(text).byteLength; }

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/giu, (_, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const num = entity.toLowerCase().startsWith('#x')
      ? Number.parseInt(entity.slice(2),16) : Number.parseInt(entity.slice(1),10);
    if (!Number.isInteger(num) || num < 1 || num > 0x10FFFF ||
        (num >= 0xD800 && num <= 0xDFFF)) fail('Word belgesinde geçersiz XML karakteri var.');
    return String.fromCodePoint(num);
  }).replace(/&[a-z#][^;\s<]*;/giu, () => fail('Word belgesinde tanınmayan XML kodlaması var.'));
}

// DOCX WordprocessingML: her normal paragraf bir kavram; iki sütunlu
// tablolarda ilk hücre kavram, ikinci hücre not. Biçimlendirme yazıyı değiştirmez.
export function wordXmlRows(xml) {
  if (typeof xml !== 'string' || utf8Length(xml) > MAX_DOCX_XML_BYTES ||
      /<!DOCTYPE|<!ENTITY/iu.test(xml) ||
      !/<w:document(?:\s|>)/u.test(xml) || !/<w:body(?:\s|>)/u.test(xml) ||
      !/<\/w:body\s*>/u.test(xml) ||
      !/<\/w:document\s*>\s*$/u.test(xml)) {
    fail('Word belge yapısı veya güvenli metin boyutu geçersiz.');
  }
  const rows = [];
  let inText = false, inParagraph = false, paragraph = '', paragraphStyle = '';
  let inTable = false, inRow = false, inCell = false, cells = [], cellParagraphs = [];
  const append = (value, note='') => {
    const candidate = value.trim(), annotation = note.trim();
    if (!candidate && !annotation) return;
    rows.push({value:candidate,note:annotation,position:rows.length + 1});
    if (rows.length > MAX_ROWS) fail('Word belgesinde en çok 200 kavram satırı olabilir.');
  };
  for (const token of xml.match(/<[^>]*>|[^<]+/gu) || []) {
    if (token.startsWith('<!--')) continue;
    if (/^<w:tbl(?:\s|>)/u.test(token)) {
      if (inTable || inParagraph) fail('Word iç içe tablo içeriyor; düz kavram listesi kullanın.');
      inTable = true;
    } else if (/^<\/w:tbl\s*>/u.test(token)) {
      if (!inTable || inRow) fail('Word tablo yapısı bozuk.');
      inTable = false;
    } else if (/^<w:tr(?:\s|>)/u.test(token)) {
      if (!inTable || inRow) fail('Word tablo satırı bozuk.');
      inRow = true; cells = [];
    } else if (/^<\/w:tr\s*>/u.test(token)) {
      if (!inRow || inCell || !cells.length || cells.length > 2) {
        fail('Word tablosunda bir kavram ve isteğe bağlı bir not sütunu olmalı.');
      }
      if (!(cells[0].trim().toLocaleLowerCase('tr-TR') === 'kavram' &&
          (cells[1] || '').trim().toLocaleLowerCase('tr-TR') === 'not')) append(cells[0],cells[1] || '');
      inRow = false;
    } else if (/^<w:tc(?:\s|>)/u.test(token)) {
      if (!inRow || inCell) fail('Word tablo hücresi bozuk.');
      inCell = true;cellParagraphs = [];
    } else if (/^<\/w:tc\s*>/u.test(token)) {
      if (!inCell || inParagraph) fail('Word tablo hücresi kapatılamadı.');
      cells.push(cellParagraphs.join(' ').trim());inCell = false;
    } else if (/^<w:p(?:\s|>)/u.test(token)) {
      if (inParagraph) fail('Word paragraf yapısı bozuk.');
      inParagraph = true;paragraph = '';paragraphStyle = '';
    } else if (/^<w:pStyle\s/u.test(token) && inParagraph) {
      paragraphStyle = /w:val="([^"]+)"/u.exec(token)?.[1] || '';
    } else if (/^<\/w:p\s*>/u.test(token)) {
      if (!inParagraph || inText) fail('Word paragrafı kapanmadı.');
      if (inCell) cellParagraphs.push(paragraph);
      else if (!/^(?:title|subtitle|heading[1-9])$/iu.test(paragraphStyle)) append(paragraph);
      inParagraph = false;
    } else if (/^<w:t(?:\s|>)/u.test(token)) {
      if (inParagraph && !/\/\s*>$/u.test(token)) inText = true;
    } else if (/^<\/w:t\s*>/u.test(token)) {
      inText = false;
    } else if (/^<w:tab(?:\s|\/>)/u.test(token) && inParagraph) {
      paragraph += ' ';
    } else if (/^<w:(?:br|cr)(?:\s|\/>)/u.test(token) && inParagraph) {
      paragraph += '\n';
    } else if (!token.startsWith('<') && inParagraph && inText) {
      paragraph += decodeXml(token);
    }
  }
  if (inText || inParagraph || inTable || inRow || inCell || !rows.length) {
    fail('Word belgesinde okunabilir kavram paragrafı bulunamadı veya belge yarım.');
  }
  return rows;
}

async function extractDocx(bytes, zipLib) {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) fail('DOCX dosyası geçerli ZIP/Word yapısında değil.');
  if (!zipLib || typeof zipLib.loadAsync !== 'function') fail('Word okuma bileşeni yüklenemedi.');
  const archive = await zipLib.loadAsync(bytes);
  if (Object.keys(archive.files).length > 1500) fail('Word belgesinde çok fazla ek dosya var.');
  if (Object.keys(archive.files).some(path => /vbaProject\.bin$/iu.test(path))) {
    fail('Makro içeren Word dosyası kabul edilmez; DOCX biçiminde kaydedin.');
  }
  const member = archive.file('word/document.xml');
  if (!member || member._data?.uncompressedSize > MAX_DOCX_XML_BYTES) {
    fail('Word ana metni bulunamadı veya çok büyük.');
  }
  const xml = await member.async('string');
  return wordXmlRows(xml);
}

async function extractPdf(bytes, pdfLib) {
  if (String.fromCharCode(...bytes.subarray(0,5)) !== '%PDF-') fail('Dosya geçerli PDF başlığı taşımıyor.');
  if (!pdfLib?.getDocument) fail('PDF metin okuma bileşeni yüklenemedi.');
  if (typeof window !== 'undefined' && pdfLib.GlobalWorkerOptions) {
    pdfLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs?v=kavram-2';
  }
  const task = pdfLib.getDocument({data:bytes.slice(),isEvalSupported:false,stopAtErrors:true});
  let doc;
  try {
    doc = await task.promise;
    if (!Number.isSafeInteger(doc.numPages) || doc.numPages < 1 || doc.numPages > MAX_PDF_PAGES) {
      fail('PDF en çok 40 sayfa olabilir; büyük belgeleri parçalara ayırın.');
    }
    const rows = [];
    for (let pageNumber=1; pageNumber<=doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = [];
      for (const item of content.items || []) {
        if (typeof item.str !== 'string' || !item.str.trim()) continue;
        const y = Number(item.transform?.[5]);
        let line = lines.find(line => Number.isFinite(y) && Math.abs(line.y-y) < 2);
        if (!line) {line={y:Number.isFinite(y)?y:-lines.length,items:[]};lines.push(line);}
        line.items.push(item);
      }
      lines.sort((a,b)=>b.y-a.y);
      for (const line of lines) {
        const rtl = line.items.some(item=>item.dir==='rtl'||/\p{Script=Arabic}/u.test(item.str));
        line.items.sort((a,b)=>rtl?(b.transform?.[4]||0)-(a.transform?.[4]||0):
          (a.transform?.[4]||0)-(b.transform?.[4]||0));
        const value=line.items.map(item=>item.str.trim()).filter(Boolean).join(' ').replace(/\s+/gu,' ').trim();
        if (!value) continue;
        // Bir PDF'nin görsel Arapça yazısı, metin katmanında bozuk harf kodlarına
        // karşılık gelebilir. Hatalı ibareyi doğru kavrammış gibi kaydetmeyiz.
        if (BAD_PDF_EXTRACTION.test(value) || /(?:^|\s)\p{Mark}/u.test(value)) {
          fail(`PDF sayfa ${pageNumber}: Arapça metin katmanı bozuk veya harf sırası çözülemedi. ` +
            'Özgün Word belgesini kullanın; PDF için önce metni denetleyip düzeltin.');
        }
        rows.push({value,note:`PDF sayfa ${pageNumber}`,position:rows.length+1});
        if (rows.length > MAX_ROWS) fail('PDF en çok 200 kavram satırı içerebilir.');
      }
    }
    if (!rows.length) fail('PDF içinde seçilebilir metin yok. Taranmış görseller için Arapça OCR ve insan kontrolü gereklidir.');
    return rows;
  } finally {
    if (doc?.destroy) await doc.destroy();
    else if (task?.destroy) await task.destroy();
  }
}

export async function extractConceptDocument({fileName, bytes}, dependencies={}) {
  if (typeof fileName !== 'string' || !(bytes instanceof Uint8Array) ||
      !bytes.length || bytes.length > MAX_DOCUMENT_BYTES) fail('Word/PDF dosyasının türü veya boyutu geçersiz.');
  const ext=fileName.split('.').at(-1).toLowerCase();
  if (!['docx','pdf'].includes(ext)) fail('Yalnız DOCX veya PDF dönüştürülür.');
  let rows;
  if (ext === 'docx') rows=await extractDocx(bytes,dependencies.zipLib||globalThis.JSZip);
  else {
    const lib=dependencies.pdfLib || await import('/vendor/pdfjs/pdf.mjs?v=kavram-2');
    rows=await extractPdf(bytes,lib);
  }
  if (utf8Length(JSON.stringify(rows)) > MAX_DOCUMENT_TEXT_BYTES) {
    fail('Word/PDF dosyasından çıkarılan metin 1 MiB sınırını aşıyor.');
  }
  return rows;
}
