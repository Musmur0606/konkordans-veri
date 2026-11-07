import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
  DRAFT_SCHEMA,CANDIDATE_SCHEMA,SURA_LIMITS,TOTAL_LOCKED_VERSES,
  isLockedVerse,parseReferenceList,saveVerseDraft,saveTermDraft,
  assertDraftRecord,makeBackup,readBackup,readyCandidates,spokenReferences,
  normalizeArabicForSearch,findArabicCandidateRefs
} from './admin-taslak-core.mjs';

test('662 ana ayet: sadece 2, 3 ve 4 açılır',()=>{
  assert.deepEqual(SURA_LIMITS,{2:286,3:200,4:176});
  assert.equal(Object.values(SURA_LIMITS).reduce((a,b)=>a+b,0),TOTAL_LOCKED_VERSES);
  assert.ok(isLockedVerse('2.1')&&isLockedVerse('3.200')&&isLockedVerse('4.176'));
  assert.equal(isLockedVerse('5.1'),false);
  assert.throws(()=>saveVerseDraft({main:'5.1',refs:'2.255',status:'taslak'}),/yalnız 2, 3 ve 4/);
  assert.throws(()=>saveVerseDraft({main:'2.287',refs:'3.1',status:'taslak'}),/Böyle bir âyet/);
});

test('Ayet referansları: geçerli 1..114, aynı ana âyet tekrar edilmez',()=>{
  assert.deepEqual(parseReferenceList('2.1,3,5-6 3.1'),['2.1','2.3','2.5','2.6','3.1']);
  assert.deepEqual(parseReferenceList('2.255 2.255 3.1'),['2.255','3.1']);
  assert.throws(()=>parseReferenceList('2.255', '2.255'),/kendisiyle/);
  assert.throws(()=>parseReferenceList('4.177'),/hatalı/);
  assert.throws(()=>parseReferenceList('150.1'),/arasında/);
});

test('Sesli giriş: mevcut yönetici panelindeki biçim korunur',()=>{
  assert.equal(spokenReferences('iki nokta beş'),'2.5');
  assert.equal(spokenReferences('iki nokta iki yüz elli beş'),'2.255');
  assert.equal(spokenReferences('2.255'),'2.255');
  assert.equal(spokenReferences('iki nokta beş virgül altı'),'2.5,6');
  assert.equal(spokenReferences('üç nokta iki yüz'),'3.200');
  assert.throws(()=>spokenReferences('iki nokta'),/Eksik|Nokta/);
});

test('Sürüm kaydı ve geri alma için önceki sürüm saklanır',()=>{
  const first=saveVerseDraft({
    main:'2.1',refs:'3.1 3.2',note:'İlk ses kaydı',status:'taslak'
  },null,'2026-11-07T16:00:00.000Z');
  const next=saveVerseDraft({
    main:'2.1',refs:'3.1 3.2 4.1',note:'Gözden geçirildi',status:'hazir'
  },first,'2026-11-07T16:10:00.000Z');
  assert.equal(first.version,1);
  assert.equal(next.version,2);
  assert.equal(next.history.length,1);
  assert.deepEqual(next.history[0].refs,['3.1','3.2']);
  assert.equal(next.status,'hazir');
  assertDraftRecord(next);
});

test('Arapça yapıştırıldığı gibi saklanır; terim/ayet veri setleri ayrıdır',()=>{
  const term=saveTermDraft({id:'t_example12345',arabic:'ٱلرَّحْمَٰنُ',
    turkish:'Rahmân',english:'The Most Merciful',refs:'1.3 2.163',
    note:'Kur’an terimi',status:'hazir'},null,'2026-11-07T16:10:00Z');
  assert.equal(term.arabic,'ٱلرَّحْمَٰنُ');
  assert.deepEqual(term.refs,['1.3','2.163']);
  assertDraftRecord(term);
  assert.throws(()=>saveTermDraft({id:'t_bad123',arabic:'abc',turkish:'Hamd'}),/Arapça/);
  assert.throws(()=>saveTermDraft({id:'t_bad123',arabic:'الله',turkish:''}),/Türkçe/);
});

test('Arapça kopyala-yapıştır: hareke farkını kaldırır, sonuçlar yalnız adaydır',()=>{
  assert.equal(normalizeArabicForSearch('ٱلرَّحْمَٰنُ'),'الرحمن');
  const corpus={
    '1:1':{ar:'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'},
    '2:1':{ar:'الٓمٓ'},
    '2:2':{ar:'ذَٰلِكَ ٱلْكِتَٰبُ'}
  };
  const result=findArabicCandidateRefs('الرَّحْمٰن',corpus);
  assert.deepEqual(result.refs,['1.1']);
  assert.equal(result.total,1);
  assert.deepEqual(findArabicCandidateRefs('الْكِتَاب',corpus).refs,['2.2']);
  assert.throws(()=>findArabicCandidateRefs('ا',corpus),/iki harf/);
});

test('Yedek okunur ama siteye otomatik yazılmaz',()=>{
  const a=saveVerseDraft({main:'4.1',refs:'2.1',status:'hazir'});
  const t=saveTermDraft({id:'t_example67890',arabic:'ٱلْكِتَابُ',
    turkish:'Kitap',refs:'2.2',status:'inceleme'});
  const draft=saveVerseDraft({main:'2.6',refs:'3.1',status:'taslak'});
  const pack=makeBackup([a,t,draft],'2026-11-07T12:00:00.000Z');
  assert.equal(pack.schema,DRAFT_SCHEMA);
  assert.equal(readBackup(pack).length,3);
  assert.throws(()=>readBackup({...pack,schema:'wrong'}),/yed[eğ]/i);
  assert.throws(()=>readBackup({...pack,records:[a,a]}),/iki kez/);
  const ready=readyCandidates([a,t,draft],'2026-11-07T12:00:00.000Z');
  assert.equal(ready.schema,CANDIDATE_SCHEMA);
  assert.deepEqual({...ready.verses},{'4:1':['2:1']});
  assert.deepEqual(ready.terms,[]);
  assert.match(ready.warning,/otomatik yayımlanmaz/);
});

test('HTML yöneticiye sekme ekler; mevcut kaynakların kimlikleri korunur',()=>{
  const html=readFileSync(new URL('./mutesabih-admin.html',import.meta.url),'utf8');
  assert.ok(html.includes('id="admin-current-workspace"'));
  for(const id of ['admin-draft-nav','admin-draft-234-workspace','admin-draft-terms-workspace',
      'draft-backup-export','draft-ready-export','draft-import-file','d234-voice','term-voice',
      'term-ar','term-ar-find','term-auto-list','d234-save','d234-refs']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.includes('src="/mutesabih-admin.js?v=8"'));
  assert.ok(html.includes('src="/admin-taslak-panel.mjs?v=1"'));
  assert.ok(html.includes('noindex,nofollow'));
});

test('Taslak panel scripti GitHub üzerinde yeni veri yazmaz',()=>{
  const script=readFileSync(new URL('./admin-taslak-panel.mjs',import.meta.url),'utf8');
  assert.ok(script.includes("indexedDB.open(DB_NAME,1)"));
  assert.ok(script.includes("classList.contains('connected')"));
  assert.ok(!/method\s*:\s*['"](?:PUT|POST|PATCH|DELETE)['"]/.test(script));
  assert.ok(!script.includes('mutesabih-degisiklikler.json'));
  assert.ok(!script.includes('benzesen-matris.json'));
});
