// Hasenat R3: eski veri alanları, kaynak metin, eşleme ve statik sayfa kabulü.
// node test-hasenat-data.mjs [--write-report]
// Ağ erişimi ve site verisine yazma yoktur. --write-report yalnız qa raporunu yazar.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'd7b9594c09c152943e90fe4d74fefbabb5ec611e';
const SOURCE = 'tools/hasenat/cikti/KURAN_HASENAT_YAZIMI.txt';
const REPORT_PATH = join(ROOT, 'qa/HASENAT_R3_VERI_KABUL.json');
const SHA = {
  package: '01c12bc3881c9e0ece9d0c10cd3f0ef033b9da8f48afeb137ac13dc66fec9b52',
  baselineApp: 'c63a37e900054e56fcb10fff688954a11289b1d98fd300e1b217c129d600169e',
  source: '74a934db426bf60de735f55f9a6340c195d188208255508c0619b356cd93c2d0',
  preparedArhKrh: 'b5686640b852d4a54c5fdcf01faa322fee440f76fc0965eb2502c659a654106f',
  generatedMap: 'aa5e8c6f6873e3314a4fae344ce9b4c9b2a1c2386dd54d3f39544bcb08a4395e',
  mappingCandidate: 'e1924bc329f7747dd81ceb5678bf84329d856e1493f3f31ce32af780c072cfed',
  // Orijinal ZIP'teki 228 dosyanın {yol: sha256} sıralı envanterinin hash'i.
  packageStaticInventory: '5ef042845488f5f8e4c0feeb02ad4c71918b5659c47f34c3964fed7bce9f63fe',
  installedStaticInventory: '0252ed425555903ad1f7f7d252f864644924c6c62d5dd954033c420a76d58246',
};
const PROTECTED = {
  'data/benzesen-matris-kaynak.json': 'd3f14d2b024b0e861c65bde16632d5f3ca407f2d8ecea7a9451752be87487e62',
  'data/benzesen-matris.json': 'ebda17bae6e873f15b096b160d48ca57536541d1216760fbfbd29ad5ce325da9',
  'data/benzesen-matris.csv': 'f0c48d2247015a630d4c7c50bc7fa233a38f0508c391b32bc0e58e59f4836c9a',
  'data/mutesabih-degisiklikler.json': 'e551be4f5cce459fae3875cd3b861fcbcb71182a3eef966207932c9394c742aa',
  'data/mutesabih-r14.json': '9bef53893270bf0055fa91afaf7a9f97e001863b4532f96d4244052a86d2c935',
  'esma_index.json': '93b58164440f0ee9b2f603de873adc479cb57abb432923d42499cc66bf826927',
  'data/kelime-kavram-deneme/kayitlar.json': 'ad94184a5af5ce764fe7c380062201b3d8b97a3e313b2b3b17b6ad248fad7a78',
  'data/kelime-kavram-deneme/kelime_ayet_harekeli.json': 'fe1901046ab875c1b4d5ae71212ce4ca508ec8351d73c5763fcab31d90320f7d',
};
const WORK_DATA = ['data/mutesabih-calisma-234.json', 'data/kavramlar-calisma.json'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = path => readFileSync(join(ROOT, path));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const baseline = path => git('show', `${BASE}:${path}`);
const sortedObject = obj => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
const objectHash = obj => sha256(JSON.stringify(sortedObject(obj)));
const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, status: 'PASS' });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, status: 'FAIL', error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const baseAppRaw = baseline('app_data.json');
const baseApp = JSON.parse(baseAppRaw);
const appRaw = read('app_data.json');
const app = JSON.parse(appRaw);
const sourceRaw = read(SOURCE);
const source = Object.fromEntries(sourceRaw.toString('utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#'))
  .map(line => { const [s, a, ...text] = line.split('|'); return [`${s}:${a}`, text.join('|')]; }));
let preservedFields = 0;
const protectedFiles = [];
const staticInventory = {};
const packageStaticInventory = {};
let staticDivs = 0;
let oldWords = 0;
let newWords = 0;
let splitWords = 0;
let mergedWords = 0;

check('Kabul edilmiş Git tabanı ve Hasenat kaynak hashleri', () => {
  assert.equal(sha256(baseAppRaw), SHA.baselineApp);
  assert.equal(sha256(sourceRaw), SHA.source);
  assert.equal(Object.keys(source).length, 6236);
  assert.deepEqual(Object.keys(source).sort(), Object.keys(baseApp.verses).sort());
  const manifest = JSON.parse(read('tools/hasenat/KAYNAK_KAYDI.json'));
  assert.equal(manifest.source_zip.sha256, SHA.package);
});

check('Eski bütün JSON alanları korunur; yalnız arh/krh/arh_map eklenir', () => {
  assert.deepEqual(Object.keys(app).sort(), Object.keys(baseApp).sort());
  for (const key of Object.keys(baseApp).filter(key => key !== 'verses')) {
    assert.deepEqual(app[key], baseApp[key], `Üst düzey alan değişti: ${key}`);
  }
  assert.deepEqual(Object.keys(app.verses).sort(), Object.keys(baseApp.verses).sort());
  for (const [ref, oldVerse] of Object.entries(baseApp.verses)) {
    const verse = app.verses[ref];
    assert.deepEqual(Object.keys(verse).sort(), [...Object.keys(oldVerse), 'arh', 'krh', 'arh_map'].sort(), ref);
    for (const key of Object.keys(oldVerse)) {
      assert.deepEqual(verse[key], oldVerse[key], `${ref}.${key} değişti`);
      preservedFields++;
    }
  }
  assert.equal(preservedFields, 65604);
});

check('6236 arh/krh paketle aynı ve metin kaynağı birebir', () => {
  const fields = {};
  for (const [ref, verse] of Object.entries(app.verses)) {
    assert.equal(verse.arh, source[ref], `${ref}.arh`);
    assert(Array.isArray(verse.krh), `${ref}.krh dizi değil`);
    assert.equal(verse.krh.length, verse.arh.split(' ').length, `${ref}.krh uzunluğu`);
    assert(verse.krh.every(value => typeof value === 'string'), `${ref}.krh kök türü`);
    fields[ref] = { arh: verse.arh, krh: verse.krh };
  }
  assert.equal(objectHash(fields), SHA.preparedArhKrh);
});

check('6236 eşleme kabul edilmiş üretimle aynı ve eski kelimeleri eksiksiz kapsar', () => {
  const maps = {};
  for (const [ref, verse] of Object.entries(app.verses)) {
    const words = verse.ar.split(' ');
    const mapping = verse.arh_map;
    assert(Array.isArray(mapping), `${ref}.arh_map dizi değil`);
    assert.equal(mapping.length, verse.arh.split(' ').length, ref);
    const uses = new Array(words.length).fill(0);
    let previous = -1;
    for (const item of mapping) {
      assert(Array.isArray(item) && item.length >= 1 && item.length <= 2, `${ref}: öğe biçimi`);
      assert(item.every(i => Number.isInteger(i) && i >= 0 && i < words.length), `${ref}: indis aralığı`);
      assert(item[0] >= previous, `${ref}: indis sırası`);
      if (item.length === 2) assert.equal(item[1], item[0] + 1, `${ref}: birleşme ardışıklığı`);
      previous = item.at(-1);
      for (const index of item) uses[index]++;
      if (item.length === 2) mergedWords++;
    }
    assert(uses.every(count => count === 1 || count === 2), `${ref}: kayıp/tekrarlı eski indis`);
    for (const item of mapping.filter(item => item.length === 2)) {
      assert(item.every(i => uses[i] === 1), `${ref}: birleşme yeniden kullanılmış`);
    }
    oldWords += words.length;
    newWords += mapping.length;
    splitWords += uses.filter(count => count === 2).length;
    maps[ref] = { arh_map: mapping };
  }
  assert.equal(objectHash(maps), SHA.generatedMap);
  assert.deepEqual(app.verses['2:54'].arh_map.slice(4, 7), [[4], [4], [5]]);
  assert.deepEqual(app.verses['8:29'].arh_map.slice(0, 2), [[0], [0]]);
  assert.deepEqual(app.verses['8:29'].arh_map.slice(16), [[15, 16], [17]]);
  assert.deepEqual([oldWords, newWords, splitWords, mergedWords], [77428, 77773, 375, 30]);
});

check('228 statik sayfa: paket Arapçası ve yalnız CSS hasenat-3 sürüm farkı', () => {
  const pageName = /^(?:sure-)?\d+-[^/]+\.html$/;
  const pages = git('ls-tree', '--name-only', BASE).toString('utf8').trim().split('\n').filter(name => pageName.test(name)).sort();
  assert.equal(pages.length, 228);
  assert.deepEqual(readdirSync(ROOT).filter(name => pageName.test(name)).sort(), pages);
  for (const path of pages) {
    const sure = Number(path.match(/^(?:sure-)?(\d+)-/)[1]);
    const old = baseline(path).toString('utf8');
    const currentRaw = read(path);
    const current = currentRaw.toString('utf8');
    let ayet = 0;
    const prepared = old.replace(/(<div class="ar">)[\s\S]*?(<\/div>)/g,
      (_, start, end) => `${start}${source[`${sure}:${++ayet}`]}${end}`);
    assert.equal(ayet, baseApp.sureler[String(sure)].ayet, `${path}: ayet sayısı`);
    assert.equal((prepared.match(/\/amiri-site\.css\?v=[^"\s<>]+/g) || []).length, 1, `${path}: kaynak CSS bağı`);
    assert.equal((current.match(/\/amiri-site\.css\?v=hasenat-3(?=")/g) || []).length, 1, `${path}: yeni CSS bağı`);
    const expected = prepared.replace(/\/amiri-site\.css\?v=[^"\s<>]+/g, '/amiri-site.css?v=hasenat-3');
    assert.equal(current, expected, `${path}: izin verilen Arapça/CSS dışında fark`);
    staticDivs += ayet;
    packageStaticInventory[path] = sha256(prepared);
    staticInventory[path] = sha256(currentRaw);
  }
  assert.equal(staticDivs, 12472);
  assert.equal(objectHash(packageStaticInventory), SHA.packageStaticInventory);
  assert.equal(objectHash(staticInventory), SHA.installedStaticInventory);
});

check('Matris, MLOG, esmâ ve önceki çalışma veri dosyaları bayt düzeyinde korunur', () => {
  for (const [path, expectedHash] of Object.entries(PROTECTED)) {
    const current = read(path);
    const old = baseline(path);
    assert.equal(sha256(old), expectedHash, `${path}: taban hash`);
    assert(current.equals(old), `${path}: disk içeriği değişti`);
    protectedFiles.push({ path, bytes: current.length, sha256: sha256(current), baseline_equal: true });
  }
  assert.equal(git('diff', '--name-only', BASE, '--', ...Object.keys(PROTECTED)).toString('utf8').trim(), '');
});

check('234 ve kavram çalışma verileri main çalışma ağacına veya Git indexine eklenmez', () => {
  for (const path of WORK_DATA) {
    assert.equal(existsSync(join(ROOT, path)), false, `${path}: çalışma ağacında bulunmamalı`);
  }
  assert.equal(git('ls-files', '--', ...WORK_DATA).toString('utf8').trim(), '');
  assert.equal(git('ls-tree', '--name-only', BASE, '--', ...WORK_DATA).toString('utf8').trim(), '');
});

const previousReport = existsSync(REPORT_PATH) ? JSON.parse(readFileSync(REPORT_PATH, 'utf8')) : {};
const remoteReference = process.env.HASENAT_REMOTE_REFERENCE
  ? JSON.parse(process.env.HASENAT_REMOTE_REFERENCE)
  : previousReport.remote_work_branch_reference || null;
const report = {
  schema: 'ayatulkuran.hasenat-r3-data-acceptance.v1',
  project: 'ayatulkuran',
  standard: 'Tüm Projeler İçin Kalıcı Hafıza ve Kesintisiz Devir Standardı V1',
  verified_at_utc: new Date().toISOString(),
  status: checks.every(item => item.status === 'PASS') ? 'PASS_LOCAL_DATA' : 'HOLD',
  scope: 'Hasenat R3 yerel veri kabulü; yayın ve font/UI kabulü ayrıca doğrulanır.',
  baseline_git: BASE,
  package_sha256: SHA.package,
  current_app_data: { bytes: appRaw.length, sha256: sha256(appRaw), preserved_verse_fields: preservedFields,
    verses: Object.keys(app.verses).length, allowed_added_fields: ['arh', 'krh', 'arh_map'],
    arh_krh_sha256: SHA.preparedArhKrh, arh_map_sha256: SHA.generatedMap },
  mapping: { old_words: oldWords, new_words: newWords, split_old_words: splitWords, merged_new_words: mergedWords,
    candidate_sha256: SHA.mappingCandidate },
  static_pages: { count: Object.keys(staticInventory).length, arabic_divs: staticDivs,
    package_inventory_sha256: objectHash(packageStaticInventory), disk_inventory_sha256: objectHash(staticInventory),
    only_change_outside_arabic: '/amiri-site.css?v=<önceki sürüm> → /amiri-site.css?v=hasenat-3' },
  protected_files: protectedFiles,
  private_work_data_separation: { paths_absent_from_worktree_and_index: WORK_DATA,
    disk_sha256: null, disk_sha256_reason: 'Bu iki ayrı dal verisi yerel ana dal ağacında bulunmuyor; dosya hashleri uydurulmadı.' },
  local_git_evidence: {
    head: git('rev-parse', 'HEAD').toString('utf8').trim(),
    branch: git('branch', '--show-current').toString('utf8').trim(),
    refs: git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/remotes').toString('utf8').trim().split('\n'),
    protected_data_diff: [],
    network_calls_by_this_test: 0, remote_write_calls_by_this_test: 0,
  },
  remote_work_branch_reference: remoteReference,
  remote_verification_limit: 'Uzak dal başları yayın öncesi salt okunur referanstır. Yayın sonrası aynı başlarla karşılaştırma ayrıca gerekir; bu yerel test uzak durumu yeniden okumaz.',
  tests: { passed: checks.filter(item => item.status === 'PASS').length, failed: checks.filter(item => item.status === 'FAIL').length, checks },
  accepted_do_not_redo: ['Eski JSON alanlarının d7b959 ile tam değer eşitliği.', '228 statik sayfada yalnız kaynak Arapçası ve CSS sürümü değişimi.', 'Korunan veri dosyalarının Git tabanı ve sabit SHA-256 ile bayt eşitliği.'],
  hold_review: ['Font/UI kabulü bu testin kapsamı dışındadır.', 'Uzak çalışma dalı başlarının yayın sonrası karşılaştırması henüz bu rapora ait değildir.'],
  last_action: 'Salt okunur yerel veri kontrolleri; yalnız istenirse bu QA raporu yazılır.',
  next_safe_step: 'Ana dal yayını sonrası calisma-234 ve calisma-kavramlar başlarını yayın öncesi referanslarla karşılaştır.',
};
if (process.argv.includes('--write-report')) {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
  console.log(`RAPOR ${REPORT_PATH}`);
}
console.log(`${report.tests.passed}/${checks.length} kontrol PASS; ${report.tests.failed} FAIL`);
if (report.tests.failed) process.exitCode = 1;
