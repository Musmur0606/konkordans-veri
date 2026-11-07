// R234 gerileme kanıtı: Ürün kodu değiştirilmez, canlı GitHub/mikrofon kullanılmaz.
// Test edilen yardımcılar gerçek mutesabih-admin.js dosyasından alınır;
// ürünün yükleme veya ses oturumu davranışı burada yeniden yazılmaz.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import vm from 'node:vm';
import {
  DRAFT234_PATH, DRAFT234_BRANCH,
  PUBLIC_HISTORY_PATH, PUBLIC_HISTORY_BRANCH,
} from './mutesabih-draft234.mjs';

const adminPath = new URL('./mutesabih-admin.js', import.meta.url);
const sourceBytes = readFileSync(adminPath);
const source = sourceBytes.toString('utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const originalAdminSha = sha256(sourceBytes);
const gitBlobSha = text => createHash('sha1')
  .update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
let passed = 0;

function extract(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start,
    'Ürün kodu sınırları bulunamadı; test sessizce atlanamaz: ' + startMarker);
  return source.slice(start, end);
}

async function test(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}

const loaderSource = extract('function githubHeaders', 'function showMessage');
const speechSource = extract('let voiceActive=false;', 'async function refreshFiles');
const largeDocument = JSON.stringify({ schema: 'ayt.test', pad: 'ö'.repeat(600000) });
const largeSha = gitBlobSha(largeDocument);
const largeEncoded = Buffer.from(largeDocument).toString('base64');

function loaderHarness(responder) {
  const calls = [];
  const context = {
    runtime: { token: 'TEST_ANAHTARI' },
    HISTORY_PATH: PUBLIC_HISTORY_PATH,
    DRAFT234_PATH,
    DRAFT234_BRANCH,
    BRANCH: PUBLIC_HISTORY_BRANCH,
    OWNER: 'Musmur0606',
    REPO: 'konkordans-veri',
    API_ROOT: 'https://api.github.com/repos/Musmur0606/konkordans-veri/contents/',
    TextDecoder, TextEncoder, Uint8Array, atob, btoa,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responder(calls.length, url, options);
    },
  };
  vm.createContext(context);
  vm.runInContext(loaderSource + '\nglobalThis.load = loadGitHubFile;', context);
  return { context, calls };
}

const jsonResponse = value => ({ ok: true, status: 200, json: async () => value });

await test('1 MB üstü içerik aynı SHA blob yolundan okunuyor', async () => {
  assert(Buffer.byteLength(largeDocument) > 1024 * 1024);
  const { context, calls } = loaderHarness(number => jsonResponse(number === 1
    ? { type: 'file', size: Buffer.byteLength(largeDocument), sha: largeSha,
        encoding: 'none', content: '' }
    : { sha: largeSha, encoding: 'base64', content: largeEncoded }));
  const result = await context.load(DRAFT234_PATH, 'TEST_ANAHTARI', DRAFT234_BRANCH);
  assert.equal(result.content.pad.length, 600000);
  assert.equal(result.sha, largeSha);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url,
    'https://api.github.com/repos/Musmur0606/konkordans-veri/contents/' +
    DRAFT234_PATH + '?ref=' + DRAFT234_BRANCH);
  assert.equal(calls[1].url,
    'https://api.github.com/repos/Musmur0606/konkordans-veri/git/blobs/' + largeSha);
  assert(calls.every(call => call.options.headers.Authorization === 'Bearer TEST_ANAHTARI'));
  assert(calls.every(call => !call.options.method || call.options.method === 'GET'));
});

await test('Fallback farklı blob SHA yanıtını reddediyor', async () => {
  const { context, calls } = loaderHarness(number => jsonResponse(number === 1
    ? { type: 'file', sha: largeSha, encoding: 'none', content: '' }
    : { sha: 'b'.repeat(40), encoding: 'base64', content: largeEncoded }));
  await assert.rejects(
    () => context.load(DRAFT234_PATH, 'TEST_ANAHTARI', DRAFT234_BRANCH),
    /doğrulanamadı/);
  assert.equal(calls.length, 2);
});

await test('Normal base64 içerik tek istekle korunuyor', async () => {
  const document = JSON.stringify({ schema: 'ayt.test', value: 'küçük dosya' });
  const sha = gitBlobSha(document);
  const { context, calls } = loaderHarness(() => jsonResponse({
    type: 'file', sha, encoding: 'base64', content: Buffer.from(document).toString('base64'),
  }));
  const result = await context.load(PUBLIC_HISTORY_PATH, 'TEST_ANAHTARI', PUBLIC_HISTORY_BRANCH);
  assert.equal(result.content.value, 'küçük dosya');
  assert.equal(result.sha, sha);
  assert.equal(calls.length, 1);
  assert(calls[0].url.endsWith('?ref=' + PUBLIC_HISTORY_BRANCH));
});

await test('Taslak main dalı ağ isteğinden önce reddediliyor', async () => {
  const { context, calls } = loaderHarness(() => {
    throw Error('Bu senaryoda ağ isteği yapılmamalı.');
  });
  await assert.rejects(
    () => context.load(DRAFT234_PATH, 'TEST_ANAHTARI', PUBLIC_HISTORY_BRANCH),
    /uyuşmuyor/);
  assert.equal(calls.length, 0);
});

function voiceHarness() {
  const readers = [], timers = [], nodes = new Map();
  const context = {
    runtime: { token: 'TEST_ANAHTARI', busy: false, selected: '2.1' },
    canWriteSelected: () => true,
    $: id => {
      if (!nodes.has(id)) nodes.set(id, {
        textContent: '', value: '', style: {}, dispatchEvent() {},
      });
      return nodes.get(id);
    },
    voiceMessage: () => {},
    Speech: class {
      constructor() { readers.push(this); }
      start() {}
      stop() {}
    },
    setTimeout: callback => { timers.push(callback); return timers.length; },
    // Bilerek callback listeden silinmez: iptal sonrası gecikmiş olay zorlanır.
    clearTimeout() {},
    // Ayrıştırıcı değil, oturum yalıtımı test ediliyor. Bu girdiler zaten geçerli.
    parseVerses: () => [],
    speechRefsToTemplate: value => value,
    Event: class {},
    speechReader: null,
  };
  context.window = { SpeechRecognition: context.Speech };
  vm.createContext(context);
  vm.runInContext(speechSource +
    '\nglobalThis.start = startVoiceRefs; globalThis.stop = stopVoiceRefs;', context);
  const emit = (reader, transcript) => reader.onresult({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript } }],
  });
  return { context, readers, timers, emit };
}

await test('Sure değişiminde eski end/error/result yeni sesi bozmuyor', () => {
  const { context, readers, timers, emit } = voiceHarness();
  context.start();
  const old = readers[0];
  context.stop();
  context.runtime.selected = '3.1';
  context.start();
  const fresh = readers[1];
  old.onend();
  old.onerror({ error: 'network' });
  emit(old, '6.1');
  for (const callback of [...timers]) callback();
  emit(fresh, '5.1');
  assert.equal(readers.length, 2);
  assert.equal(context.$('refs').value, '5.1');
});

await test('Geçerli oturum normal yeniden başlatmayı sürdürüyor', () => {
  const { context, readers, timers, emit } = voiceHarness();
  context.start();
  emit(readers[0], '5.1');
  readers[0].onend();
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(readers.length, 2);
  emit(readers[1], '7.1');
  assert.equal(context.$('refs').value, '5.1 7.1');
});

await test('Eski yeniden başlatma zamanlayıcısı oturum sınırını aşmıyor', () => {
  const { context, readers, timers, emit } = voiceHarness();
  context.start();
  readers[0].onend();
  assert.equal(timers.length, 1);
  const staleTimer = timers[0];
  context.stop();
  context.runtime.selected = '4.1';
  context.start();
  staleTimer();
  assert.equal(readers.length, 2);
  emit(readers[1], '8.1');
  assert.equal(context.$('refs').value, '8.1');
});

await test('Aynı ana ayette hızlı durdur/başlat eski oturumdan ayrılıyor', () => {
  const { context, readers, emit } = voiceHarness();
  context.start();
  const old = readers[0];
  context.stop();
  context.start();
  old.onend();
  old.onerror({ error: 'network' });
  emit(old, '6.1');
  emit(readers[1], '9.1');
  assert.equal(context.$('refs').value, '9.1');
  assert.equal(readers.length, 2);
});

assert.equal(sha256(readFileSync(adminPath)), originalAdminSha,
  'Test sırasında ürün kaynak dosyası değişmiş; kanıt tek sürüme ait değil.');
console.log(JSON.stringify({
  sonuc: 'PASS_R234_FIX_REGRESSION',
  test_sayisi: passed,
  admin_sha256: originalAdminSha,
  urun_dosyasi_degismedi: true,
  github_yazmasi: false,
  gercek_mikrofon_testi: false,
}));
