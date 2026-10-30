#!/usr/bin/env python3
"""Resolve observed IMSLP download links and cache verified PDF bytes for researchers.

--page TITLE lists the page's actual download indexes; --index ID downloads one.
Only the normal disclaimer is accepted. Bot checks and non-PDF answers stop the run.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import html
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

from fetch_throttled import UA, _host, _reserve, fetch

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/cache/same-instrument-imslp/scores"
PAUSE = ROOT / "data/chamber/same-instrument/PAUSE"


def request(url, disclaimer=False):
    if PAUSE.exists():
        raise RuntimeError("Research is paused")
    delay = _reserve(_host(url)) - time.time()
    if delay > 0:
        time.sleep(delay)
    headers = {"User-Agent": UA, "Accept-Encoding": "identity"}
    if disclaimer:
        headers["Cookie"] = "imslpdisclaimeraccepted=yes"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
        body, actual = response.read(), response.geturl()
    if body.startswith(b"\x1f\x8b"):
        body = gzip.decompress(body)
    return body, actual


def download(index, output=None):
    target = Path(output).resolve() if output else CACHE / f"{index}.pdf"
    if (ROOT / "data/cache").resolve() not in target.parents:
        raise ValueError("Score outputs must stay under data/cache")
    sidecar = target.with_suffix(".source.json")
    if target.exists() and target.read_bytes().startswith(b"%PDF") and sidecar.exists():
        return {**json.loads(sidecar.read_text()), "cached": True}
    handler = f"https://imslp.org/index.php?title=Special:IMSLPImageHandler/{index}"
    body, actual = request(handler, disclaimer=True)
    if not body.startswith(b"%PDF"):
        match = re.search(r'id=[\"\']sm_dl_wait[\"\'][^>]*data-id=[\"\']([^\"\']+)', body.decode("utf-8", "replace"))
        if not match:
            raise RuntimeError("Handler exposed no normal download link; do not guess mirrors or bypass bot checks")
        observed = html.unescape(match[1])
        if urllib.parse.urlsplit(observed).scheme not in ("http", "https"):
            raise ValueError("Invalid observed download URL")
        body, actual = request(observed)
    if not body.startswith(b"%PDF"):
        raise RuntimeError("Download is not a PDF; no score file written")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    result = {"index": index, "handler": handler, "url": actual,
              "path": str(target.relative_to(ROOT)), "bytes": len(body),
              "sha256": hashlib.sha256(body).hexdigest(), "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat()}
    sidecar.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--page")
    group.add_argument("--index", type=int)
    parser.add_argument("--out")
    args = parser.parse_args()
    if PAUSE.exists():
        raise RuntimeError("Research is paused")
    if args.page:
        params = {"action": "parse", "page": args.page, "prop": "text", "format": "json"}
        data = json.loads(fetch("https://imslp.org/api.php?" + urllib.parse.urlencode(params)))
        rendered = data.get("parse", {}).get("text", {}).get("*", "")
        print(json.dumps({"page": args.page, "indexes": list(dict.fromkeys(map(int, re.findall(r'Special:ImagefromIndex/(\d+)', rendered))))}))
    else:
        print(json.dumps(download(args.index, args.out)))
