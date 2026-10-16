#!/usr/bin/env python3
"""
A polite fetcher shared by the chamber curation agents (data/chamber/curation/AGENT_BRIEF.md, "Sources and method").

About eight agents query the Apple Music catalogue (the iTunes Search API), MusicBrainz and IMSLP at the same time from one
machine, and each service answers 403, 429 or 503 when it is asked too fast. Requests that go through this file share one
clock per host, so that all agents together stay under each service's limit; a blocked answer pauses every agent for a
while instead of being hammered again; and an answer is fetched once and kept for the whole run.

  python3 scripts/chamber/fetch_throttled.py "<url>"             # prints the body (UTF-8); exit 1 after the last retry
  python3 scripts/chamber/fetch_throttled.py --no-cache "<url>"
  sys.path.insert(0, "<repo>/scripts/chamber"); from fetch_throttled import fetch, FetchError
  body = fetch(url)                                                # str; raises FetchError after the last retry

Request starts are spaced at least 3.3 s apart for itunes.apple.com (Apple documents about 20 calls a minute), 1.3 s for
musicbrainz.org (its limit is one a second), 1.2 s for imslp.org, 0.6 s for api.deezer.com (about 50 requests in 5 s) and 1.5 s for any other host. A 403/429/5xx answer is
retried after 20, 45, 90 and 180 s. Answers with HTTP 200 are cached in data/cache/chamber-lookups/ (git-ignored).
"""
import fcntl
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) catalogue research"
ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "data/cache/chamber-lookups"
INTERVAL = {"itunes.apple.com": 3.3, "musicbrainz.org": 1.3, "imslp.org": 1.2, "api.deezer.com": 0.6}
DEFAULT_INTERVAL = 1.5
BACKOFF = [20, 45, 90, 180]


class FetchError(Exception):
    pass


def _host(url):
    return urllib.parse.urlsplit(url).hostname or ""


def _locked_update(host, fn):
    """runs fn(state) under the host's file lock; state is the dict kept for the host; returns fn's result"""
    clock = DIR / "clock"
    clock.mkdir(parents=True, exist_ok=True)
    with open(clock / (host + ".lock"), "a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            path = clock / (host + ".json")
            try:
                state = json.loads(path.read_text())
            except (OSError, ValueError):
                state = {}
            result = fn(state)
            path.write_text(json.dumps(state))
            return result
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def _reserve(host):
    """claims the next start slot for the host (after the last claimed slot and any block) and returns its epoch time"""

    def claim(state):
        slot = max(time.time(), state.get("next", 0), state.get("blocked_until", 0))
        state["next"] = slot + INTERVAL.get(host, DEFAULT_INTERVAL)
        return slot

    return _locked_update(host, claim)


def _block(host, seconds):
    """a blocked answer: no agent starts a request to the host until the pause is over"""

    def block(state):
        state["blocked_until"] = max(state.get("blocked_until", 0), time.time() + seconds)

    _locked_update(host, block)


def fetch(url, cache=True, timeout=60):
    host = _host(url)
    key = hashlib.sha1(url.encode()).hexdigest()
    cached = DIR / "answers" / key[:2] / (key + ".txt")
    if cache and cached.exists():
        return cached.read_text(encoding="utf-8")
    last = ""
    for attempt in range(len(BACKOFF) + 1):
        wait = _reserve(host) - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=timeout) as r:
                body = r.read().decode("utf-8", "replace")
            if cache:
                cached.parent.mkdir(parents=True, exist_ok=True)
                tmp = cached.with_suffix(".tmp%d" % os.getpid())
                tmp.write_text(body, encoding="utf-8")
                tmp.replace(cached)
            return body
        except urllib.error.HTTPError as e:
            last = "HTTP %d" % e.code
            if e.code not in (403, 429, 500, 502, 503, 504):
                raise FetchError("%s: %s" % (url, last))
            if attempt < len(BACKOFF):
                _block(host, BACKOFF[attempt])
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = str(e)
            if attempt < len(BACKOFF):
                _block(host, 10)
    raise FetchError("%s: %s after %d tries" % (url, last, len(BACKOFF) + 1))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--no-cache"]
    if len(args) != 1:
        sys.exit(__doc__)
    try:
        sys.stdout.write(fetch(args[0], cache="--no-cache" not in sys.argv))
    except FetchError as e:
        sys.exit("fetch_throttled: %s" % e)
