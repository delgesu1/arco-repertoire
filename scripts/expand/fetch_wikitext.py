"""Fetch the IMSLP wikitext of the violin-relevant pages and keep only what we need:
the WORK INFO block (key, year, movements, average duration…) and the violin entries of the
"Arrangements and Transcriptions" section (who arranged it for violin).

Reads   data/cache/imslp-digest.json
Writes  data/cache/imslp-wiki/<pageid>.json   (resumable: existing files are skipped)

  python3 scripts/expand/fetch_wikitext.py            # all orig pages + arr pages with a notable arranger
  python3 scripts/expand/fetch_wikitext.py --all-arr  # every arr page
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIGEST = ROOT / "data" / "cache" / "imslp-digest.json"
OUT = ROOT / "data" / "cache" / "imslp-wiki"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) catalogue research"

# Violinists, pedagogues and arrangers whose violin transcriptions count as "established".
NOTABLE = """kreisler heifetz auer joachim elman zimbalist szigeti kochanski kochański milstein francescatti wilhelmj burmester hubay
sarasate ysaÿe ysaye hartmann franko spalding press achron seidel dushkin kubelik kubelík thibaud marteau flesch szeryng oistrakh
tsyganov cyganov székely szekely gertler kocian ševčík sevcik sauret ernst alard dancla bériot beriot david laub ondříček ondricek
nachéz nachez hellmesberger vieuxtemps wieniawski léonard leonard halir hegedüs persinger rosand totenberg gingold zukerman perlman
stern menuhin roques roelens choisnel hermann sitt hauser kotek kneisel powell parlow brahms mendelssohn schumann saint-saëns
dvořák dvorak grieg sibelius prokofiev shostakovich bartók bartok stravinsky debussy ravel fauré faure elgar strauss korngold falla
granados chaminade massenet moszkowski drdla monti sinding tchaikovsky rachmaninoff rachmaninov glazunov cui scott godard suk
fibich szymanowski glière gliere schütt schutt friedberg kroll sammons nadien nathan milstein dont tertis primrose cassadó cassado
fortunatov atovmyan atovmian fichtenholz grünes grunes garban catherine lambert lemoine perolari ricci stokowski godowsky busoni
bauer goldmark hasselmans thomson bachmann hellmann wolfsohn schubert beethoven mozart handel vivaldi bach""".split()
NOTABLE = {n.lower() for n in NOTABLE}


def api(**kw):
    kw["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(kw)
    err = None
    for attempt in range(5):
        try:
            time.sleep(0.4)
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"api failed: {err}")


FIELDS = [
    "Work Title", "Alternative Title", "Opus/Catalogue Number", "Key", "Number of Movements/Sections", "Dedication",
    "Year/Date of Composition", "Year of First Publication", "Piece Style", "Average Duration", "Instrumentation",
    "InstrDetail", "Tags", "Language",
]


def clean(v):
    v = re.sub(r"<br\s*/?>", "; ", v)
    v = re.sub(r"\{\{[^{}|]*\|([^{}]*)\}\}", r"\1", v)  # {{key|g}} -> g
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)
    v = re.sub(r"'''?", "", v)
    return re.sub(r"\s+", " ", v).strip()


def work_info(text):
    m = re.search(r"\*{5}WORK INFO\*{5}(.*?)\*{5}COMMENTS\*{5}", text, re.S)
    if not m:
        return {}
    block = m.group(1)
    parts = re.split(r"\n\|([A-Za-z/ ]+)=", "\n" + block)
    info = {}
    for i in range(1, len(parts) - 1, 2):
        k, v = parts[i].strip(), clean(parts[i + 1])
        if k in FIELDS and v:
            info[k] = v[:400]
    return info


def violin_arrangements(text):
    m = re.search(r"===\s*Arrangements and Transcriptions\s*===(.*)", text, re.S)
    if not m:
        return []
    sect = m.group(1)
    sect = re.split(r"\n\| \*{5}WORK INFO", sect)[0]
    out = []
    # headings at any level: "=====For Violin and Piano (Kreisler)====="
    for h in re.finditer(r"\n={3,6}\s*([^=\n]+?)\s*={3,6}\s*\n(.*?)(?=\n={3,6}\s*[^=\n]+?\s*={3,6}\s*\n|\Z)", "\n" + sect, re.S):
        title, body = h.group(1), h.group(2)
        if not re.search(r"violin", title, re.I):
            continue
        arrs = [clean(a) for a in re.findall(r"\|Arranger=([^\n]*)", body)]
        arrs = [re.sub(r"\(\d{4}[^)]*\)", "", a).strip() for a in arrs if a]
        out.append({"heading": clean(title), "arrangers": sorted(set(a for a in arrs if a))[:4]})
    return out


def fetch(batch):
    titles = [b["title"] for b in batch]
    d = api(action="query", titles="|".join(titles), prop="revisions", rvprop="content")
    for p in d["query"]["pages"].values():
        if "revisions" not in p:
            continue
        text = p["revisions"][0]["*"]
        rec = {"title": p["title"], "info": work_info(text), "arrs": violin_arrangements(text)}
        (OUT / f"{p['pageid']}.json").write_text(json.dumps(rec, ensure_ascii=False))
    return len(titles)


def main():
    all_arr = "--all-arr" in sys.argv
    digest = json.load(open(DIGEST))
    todo = []
    for comp, res in digest.items():
        for x in res["orig"]:
            todo.append(x)
        for x in res["arr"]:
            sur = {a.split(",")[0].strip().lower() for a in x["arrangers"]}
            if all_arr or sur & NOTABLE:
                todo.append(x)
    todo = [x for x in todo if not (OUT / f"{x['pageid']}.json").exists()]
    print(f"{len(todo)} pages to fetch", flush=True)
    batches = [todo[i : i + 5] for i in range(0, len(todo), 5)]
    done = 0
    with ThreadPoolExecutor(2) as ex:
        for n in ex.map(fetch, batches):
            done += n
            if done % 100 < 5:
                print(f"{done}/{len(todo)}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
