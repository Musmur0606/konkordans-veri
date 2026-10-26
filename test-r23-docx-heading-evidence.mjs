import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const evidence=load('./data/r23_docx_heading_evidence_20261026.json');
const matrix=load('./data/benzesen-matris.json');
const source=load('./data/benzesen-matris-kaynak.json');
const history=load('./data/mutesabih-degisiklikler.json');

test('8 historical missing heads are represented without any source mutation',()=>{
  assert.equal(evidence.schema,'ayatulkuran.docx-heading-evidence.v1');
  assert.equal(evidence.totals.main_checked,8);
  assert.equal(evidence.totals.heading_confirmed,7);
  assert.equal(evidence.totals.source_review,1);
  assert.deepEqual(evidence.review,['15:28']);
  assert.equal(evidence.source_archive_sha256,'78c4f365bd60157519b72bc5302d6d5adb90508577af7394d4167035f2a7f0db');
  assert.deepEqual(evidence.protected_main_suras,[2,3,4]);
  assert.equal(evidence.records.length,8);
  const refs=evidence.records.map(r=>r.main);
  assert.equal(new Set(refs).size,8);
  let total=0;
  for(const row of evidence.records){
    assert.ok(Object.hasOwn(matrix,row.main),'R23 missing '+row.main);
    assert.equal(matrix[row.main].length,row.r23_relation_count,row.main);
    assert.ok(![2,3,4].includes(+row.main.split(':')[0]));
    assert.ok(row.source_headings.length>0);
    const evidenceRed=row.source_headings.some(h=>h.first_run_color?.toUpperCase()==='FF0000');
    assert.equal(row.finding,evidenceRed?'SOURCE_HEADING_CONFIRMED':'REVIEW_SOURCE_STRUCTURE');
    total+=row.r23_relation_count;
  }
  assert.equal(total,207);
  assert.equal(evidence.totals.r23_links_covered,total);
});

test('Accepted R23 candidate count, historical difference record and GitHub edit log unaffected',()=>{
  assert.equal(Object.keys(matrix).length,5574);
  assert.equal(Object.values(matrix).reduce((n,a)=>n+a.length,0),175478);
  assert.equal(source.benzesen_baglanti_sayisi,175478);
  assert.equal(history.schema,'ayatulkuran.github-edits.v1');
  assert.ok(Array.isArray(history.events));
});
