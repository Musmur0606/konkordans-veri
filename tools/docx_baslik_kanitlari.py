#!/usr/bin/env python3
"""Original DOCX heading evidence reader. Read-only. Python standard library.

Usage: python tools/docx_baslik_kanitlari.py "Ma 1-10.zip" report.json
The archive itself is not copied into the GitHub repository.
"""
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

TARGETS = {7:(139,198), 11:(1,), 14:(25,), 15:(28,), 53:(29,), 56:(59,), 90:(12,)}
ACCEPTED = {"7:139":25,"7:198":58,"11:1":46,"14:25":11,
            "15:28":20,"53:29":24,"56:59":4,"90:12":19}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
P = re.compile(
    r"^\s*[-–—]*\s*(\d{1,3})\s*[-–—]\s*[^\n]{0,50}?"
    r"\s+Sures[iİıI]\s*[-–—]\s*Ayet\s*(\d{1,3})\b", re.I
)

def sha_file(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def scan(docx_blob):
    with zipfile.ZipFile(io.BytesIO(docx_blob)) as doc:
        root=ET.fromstring(doc.read("word/document.xml"))
    for index,p in enumerate(root.iter(W+"p"),1):
        value="".join(t.text or "" for t in p.iter(W+"t")).strip()
        m=P.match(value[:200])
        if m is None:
            continue
        first_color=None
        for run in p.iter(W+"r"):
            if not any(t.text for t in run.iter(W+"t")):
                continue
            rpr=run.find(W+"rPr")
            element=rpr.find(W+"color") if rpr is not None else None
            first_color=element.get(W+"val") if element is not None else None
            break
        leading=re.match(r"^\s*[-–—]*",value).group(0).strip()
        yield index,int(m.group(1)),int(m.group(2)),first_color,leading

def main():
    if len(sys.argv)!=3:
        raise SystemExit('Usage: python docx_baslik_kanitlari.py "Ma 1-10.zip" report.json')
    src,out=sys.argv[1:]
    records=[]
    with zipfile.ZipFile(src) as source:
        for sura,ayets in TARGETS.items():
            matches=[n for n in source.namelist()
                     if n.lower().endswith(".docx")
                     and re.match(r"^"+str(sura)+r"\s",Path(n).name)]
            if len(matches)!=1:
                raise RuntimeError(f"Source DOCX missing/ambiguous for sura {sura}: {matches}")
            filename=matches[0]
            found={a:[] for a in ayets}
            for idx,s,a,color,sep in scan(source.read(filename)):
                if s==sura and a in found:
                    found[a].append({"paragraph":idx,"first_run_color":color,"leading_separator":sep})
            for a in ayets:
                key=f"{sura}:{a}"
                heading=any(x["first_run_color"] and
                            x["first_run_color"].upper()=="FF0000" for x in found[a])
                records.append({
                    "main":key,"source":filename,
                    "r23_relation_count":ACCEPTED[key],
                    "source_headings":found[a],
                    "finding":"SOURCE_HEADING_CONFIRMED" if heading else "REVIEW_SOURCE_STRUCTURE"
                })
    if sum(x["r23_relation_count"] for x in records)!=207:
        raise RuntimeError("Expected 207 R23 links across the 8 source examples")
    report={
        "schema":"ayatulkuran.docx-heading-evidence.v1",
        "source_archive":Path(src).name,
        "source_archive_sha256":sha_file(src),
        "source_rule":"Colour and fixed dash width are not mandatory. Check Word hierarchy and sequential sura/ayah roles.",
        "total":len(records),
        "confirmed":sum(x["finding"]=="SOURCE_HEADING_CONFIRMED" for x in records),
        "review":[x["main"] for x in records if x["finding"]=="REVIEW_SOURCE_STRUCTURE"],
        "records":records
    }
    Path(out).parent.mkdir(parents=True,exist_ok=True)
    Path(out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="records"},ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
