#!/usr/bin/env python3
"""Resumable exact-scoring IMSLP membership census. No canonical catalogue writes.

python3 scripts/chamber/same_instrument_harvest.py members
python3 scripts/chamber/same_instrument_harvest.py pages [--limit N]
python3 scripts/chamber/same_instrument_harvest.py summary

Uses the cross-agent host clock/cache, follows both API continuation formats,
and checks the run's PAUSE flag between requests. Raw responses stay git-ignored.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import signal
import sys
import urllib.parse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_throttled import fetch  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/chamber/same-instrument"
CACHE = ROOT / "data/cache/same-instrument-imslp"
STOP = False


def stop(_signum, _frame):
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)


def paused():
    return STOP or (RUN / "PAUSE").exists()


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".tmp-{os.getpid()}")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n")
    temp.replace(path)


def call(params):
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    result = json.loads(fetch(url))
    if result.get("error") or "query" not in result:
        raise RuntimeError(f"IMSLP API error: {result.get('error', result)}")
    return result


def continuation(result):
    if "continue" in result:
        return result["continue"]
    return {key: value for item in result.get("query-continue", {}).values() for key, value in item.items()}


def categories():
    jobs = json.loads((RUN / "jobs.json").read_text())["jobs"]
    return [cat for job in jobs for cat in job["categories"]]


def member_path(category):
    return CACHE / "members" / (urllib.parse.quote(category, safe="") + ".json")


def members():
    cats = categories()
    for index, cat in enumerate(cats):
        if paused():
            print("Paused before next category; saved responses are resumable.", flush=True)
            break
        path = member_path(cat["title"])
        state = json.loads(path.read_text()) if path.exists() else {
            "category": cat["title"], "complete": False, "members": [], "continuation": {},
        }
        if state["complete"]:
            continue
        while not state["complete"] and not paused():
            result = call({"action": "query", "list": "categorymembers", "cmtitle": cat["title"],
                           "cmnamespace": 0, "cmlimit": 500, **state["continuation"]})
            if "categorymembers" not in result["query"]:
                raise RuntimeError(f"No categorymembers in response for {cat['title']}")
            found = {m["pageid"]: m for m in state["members"]}
            found.update({m["pageid"]: m for m in result["query"]["categorymembers"]})
            state.update(members=list(found.values()), continuation=continuation(result), fetchedAt=now())
            state["complete"] = not state["continuation"]
            write(path, state)
        print(f"{index + 1}/{len(cats)} {cat['title']}: {len(state['members'])}, complete={state['complete']}", flush=True)
    summary()


def summary():
    found, complete, memberships = {}, 0, 0
    for cat in categories():
        path = member_path(cat["title"])
        if not path.exists():
            continue
        state = json.loads(path.read_text())
        complete += int(state["complete"])
        memberships += len(state["members"])
        for member in state["members"]:
            row = found.setdefault(member["pageid"], {"pageId": member["pageid"], "title": member["title"], "categories": []})
            row["categories"].append(cat["title"])
    rows = sorted(found.values(), key=lambda item: item["title"])
    report = {"generatedAt": now(), "purpose": "Discovery only; no eligibility or exact-version approval implied",
              "categoriesComplete": complete, "categoriesTotal": len(categories()),
              "categoryMemberships": memberships, "uniquePages": len(rows), "pages": rows}
    write(RUN / "census.json", report)
    print(json.dumps({key: report[key] for key in ("categoriesComplete", "categoriesTotal", "categoryMemberships", "uniquePages")}), flush=True)
    return rows


def pages(limit):
    rows = summary()
    todo = [row for row in rows if not (CACHE / "pages" / f"{row['pageId']}.json").exists()]
    if limit is not None:
        todo = todo[:limit]
    count = 0
    for offset in range(0, len(todo), 20):
        if paused():
            break
        batch = todo[offset:offset + 20]
        pending = {}
        pages_found = {}
        while True:
            result = call({"action": "query", "pageids": "|".join(str(row["pageId"]) for row in batch),
                           "prop": "revisions|categories", "rvprop": "ids|timestamp|content", "cllimit": "max", **pending})
            for page in result["query"].get("pages", {}).values():
                if "missing" in page:
                    raise RuntimeError(f"Missing census page: {page}")
                target = pages_found.setdefault(page["pageid"], {**page, "categories": []})
                target["categories"].extend(page.get("categories", []))
            pending = continuation(result)
            if not pending:
                break
            if paused():
                break
        # Do not checkpoint incomplete page-category pagination as a complete fetch.
        if pending:
            break
        if len(pages_found) != len(batch):
            raise RuntimeError("Incomplete page batch; refusing a false complete checkpoint")
        for pageid, page in pages_found.items():
            write(CACHE / "pages" / f"{pageid}.json", {"fetchedAt": now(), "page": page})
        count += len(batch)
        print(f"Full page revisions saved: {count}/{len(todo)}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("step", choices=["members", "pages", "summary"])
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if args.step == "members":
        members()
    elif args.step == "pages":
        pages(args.limit)
    else:
        summary()
