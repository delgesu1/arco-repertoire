#!/usr/bin/env python3
"""Stage and apply reviewed ensemble additions without replaying the legacy census merge.

prepare --batch <name> --research <files...> --reviews <files...>
apply --batch <name>

Only explicit, independently reviewed changes are staged. Grade disagreements need
a third opinion. Apply checks source/input hashes, validates the complete catalogue,
takes rollback snapshots, and rebuilds details and both catalogues under a file lock.
"""
import argparse
import copy
import fcntl
import hashlib
import json
from pathlib import Path
import re
import statistics
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/chamber/same-instrument"
SOURCE = {
    "works": "data/chamber/works.json", "composers": "data/chamber/composers.json",
    "registry": "data/chamber/id-registry.json", "sources": "data/chamber/sources.json",
    "details": "data/details/overrides.json", "recordings": "data/chamber/recordings-judged.json",
}
GENERATED = ["data/build/catalogue.json", "public/data/catalogue.json", "data/build/chamber.json",
             "public/data/chamber.json", "data/details/works.json", "public/data/details.json",
             "lib/advisor/catalogue-text.ts", "lib/advisor/chamber-catalogue-text.ts",
             "lib/chamber/chamber-only-composers.ts"]
DETAIL_FIELDS = {"movements", "kind", "composed", "dedication", "firstPerformance", "published", "otherTitles"}
IDENTITY_FIELDS = {"id", "violinId", "composer", "title"}


def read(path, fallback=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.exists() else copy.deepcopy(fallback)


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n")
    temp.replace(path)


def digest(path):
    path = Path(path)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def url(value):
    return isinstance(value, str) and value.startswith(("https://", "http://"))


def resolve_grade(entry, reviews):
    """Two matching independent estimates suffice; otherwise take three with spread <=1."""
    opinions = []
    guess = entry.get("work", {}).get("level")
    if type(guess) is int and 1 <= guess <= 10 and entry.get("researcherGrade", {}).get("confidence") in ("medium", "high"):
        opinions.append(guess)
    for review in reviews:
        grade = review.get("grade", {})
        if review.get("status") == "approved" and grade.get("confidence") in ("medium", "high") and type(grade.get("level")) is int and 1 <= grade["level"] <= 10:
            opinions.append(grade["level"])
    if len(opinions) < 2:
        return None, opinions, "Two supported independent grades are required"
    if len(opinions) == 2:
        return (opinions[0], opinions, None) if opinions[0] == opinions[1] else (None, opinions, "Third blind grade required")
    # A fresh third review resolves the first disagreement, rather than counting repeated research guesses.
    chosen = opinions[:3]
    if max(chosen) - min(chosen) > 1:
        return None, opinions, "Grade spread exceeds one level; resolve with score/anchor evidence"
    return int(statistics.median(chosen)), opinions, None


def adjudicate_grade(resolution, opinions):
    """Explicit source-based editorial resolution; retain all conflicting votes."""
    if not resolution or resolution.get("status") != "approved":
        return None
    level = resolution.get("level")
    considered = resolution.get("consideredOpinions", [])
    sources = resolution.get("sources", [])
    if (len(opinions) < 3 or not isinstance(considered, list)
            or any(type(n) is not int for n in considered)
            or sorted(considered) != sorted(opinions)
            or type(level) is not int or not 1 <= level <= 10
            or not min(opinions) <= level <= max(opinions)
            or resolution.get("confidence") not in ("medium", "high")
            or not isinstance(resolution.get("basis"), str) or not resolution["basis"].strip()
            or not isinstance(resolution.get("hardestPart"), str) or not resolution["hardestPart"].strip()
            or not isinstance(sources, list) or not sources
            or not all(url(s.get("url") if isinstance(s, dict) else s) for s in sources)):
        raise ValueError("Invalid source-based grade adjudication: requires three supported opinions, exact vote history, in-band grade and source evidence")
    return level


def detail_patch(entry, review):
    fields, sources, skipped = {}, {}, []
    proposed = {k: v for k, v in entry.get("details", {}).items() if k in review.get("approvedDetailFields", [])}
    proposed.update(review.get("detailCorrections", {}))
    evidence = entry.get("evidence", {}).get("fieldSources", {})
    for field, value in proposed.items():
        source = review.get("detailSources", {}).get(field) or evidence.get("details." + field)
        if field not in DETAIL_FIELDS or not url(source):
            skipped.append(field)
            continue
        if value is not None and ((field in ("movements", "otherTitles") and (not isinstance(value, list) or not all(isinstance(x, str) for x in value))) or (field not in ("movements", "otherTitles") and not isinstance(value, str))):
            raise ValueError(f"Invalid detail override value: {entry['key']}.{field}")
        fields[field], sources[field] = value, source
    return fields, sources, skipped


def merge_reviews(reviews):
    """A later blind grade must not erase earlier independently approved facts."""
    combined = {"approvedWorkFields": [], "workCorrections": {}, "approvedDetailFields": [], "detailCorrections": {}, "detailSources": {}}
    for review in reviews:
        for field in ("approvedWorkFields", "approvedDetailFields"):
            combined[field] = list(dict.fromkeys(combined[field] + review.get(field, [])))
        for field in ("workCorrections", "detailCorrections", "detailSources"):
            combined[field].update(review.get(field, {}))
        if review.get("grade", {}).get("confidence") in ("medium", "high"):
            combined["grade"] = review["grade"]
    combined.setdefault("grade", reviews[-1].get("grade", {}))
    return combined


def selected_recording(entry, reviews):
    candidates = {}
    for raw in entry.get("recordingResearch", {}).get("candidates", []):
        video_id = raw.get("id") or raw.get("youtubeId")
        if not isinstance(video_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            continue
        candidate = {**raw, "id": video_id, "description": raw.get("description") or raw.get("descriptionRelevant", ""),
                     "performerCredits": raw.get("performerCredits") or raw.get("performer") or raw.get("performers", "")}
        metadata_file = raw.get("sourceMetadataFile")
        if metadata_file:
            path = (RUN / metadata_file).resolve()
            if RUN.resolve() not in path.parents:
                raise ValueError("Recording metadata path must stay inside this research run")
            metadata = read(path, {})
            if metadata.get("id") == video_id:
                candidate["description"] = metadata.get("description") or candidate["description"]
        candidates[video_id] = candidate
    approved = []
    for review in reviews:
        for choice in review.get("recordingDecisions", []):
            if choice.get("decision") != "approved" or choice.get("id") not in candidates:
                continue
            checks = choice.get("checks", {})
            # A narrative approval is retained as evidence but does not bypass the explicit checks.
            if not all(checks.get(k) is True for k in ("exactVersion", "wholeWork", "humanPerformance", "embedVerified")) or not (checks.get("excludedPerformersChecked") is True or checks.get("excludedPerformersClear") is True):
                continue
            candidate = candidates[choice["id"]]
            if not candidate.get("title") or not candidate.get("channel"):
                continue
            approved.append((candidate, choice))
    if not approved:
        return None
    # Reuse the canonical performer rule, including the full inspected description/credits and all alternates.
    script = 'import {readFileSync} from "node:fs"; import {featuresExcludedPerformer} from "./scripts/recording-rules"; const xs=JSON.parse(readFileSync(0,"utf8")); if(xs.some(x=>featuresExcludedPerformer(x.title,x.channel,x.description,JSON.stringify(x.performerCredits??x.performers??"")))) throw new Error("Excluded performer in reviewed recording");'
    result = subprocess.run([str(ROOT / "node_modules/.bin/tsx"), "-e", script], cwd=ROOT, input=json.dumps([c for c, _ in approved]), text=True, capture_output=True)
    if result.returncode:
        raise ValueError(result.stderr)
    video, choice = approved[0]
    return {"confidence": "medium", "reason": choice["reason"],
            "video": {"id": video["id"], "title": video["title"], "channel": video["channel"], "seconds": choice.get("seconds") or video.get("seconds"), "views": video.get("views")},
            "alternates": list(dict.fromkeys(c["id"] for c, _ in approved[1:] if c["id"] != video["id"])),
            "compilation": bool(choice.get("compilation", False))}


def prepare(batch, research_paths, review_paths, release_held=(), adjudications_path=None):
    if (RUN / "PAUSE").exists():
        raise RuntimeError("Run is paused")
    state = {k: read(ROOT / p, [] if k == "works" else {}) for k, p in SOURCE.items()}
    before = copy.deepcopy(state)
    inputs = {str(Path(p).resolve()): digest(p) for p in research_paths + review_paths + ([adjudications_path] if adjudications_path else [])}
    hashes = {p: digest(ROOT / p) for p in list(SOURCE.values()) + ["data/source/all-repertoire.json", "data/build/catalogue.json"]}
    violin = read(ROOT / "data/build/catalogue.json")["pieces"]
    violin_composers = {w["composer"] for w in violin}
    violin_by_id = {w["id"]: w for w in violin}
    excluded = read(ROOT / "data/chamber/excluded-composers.json", {})
    reviews = {}
    adjudications = {}
    if adjudications_path:
        for item in read(adjudications_path)["entries"]:
            if item["key"] in adjudications:
                raise ValueError(f"Duplicate adjudication key: {item['key']}")
            adjudications[item["key"]] = {**item, "adjudicationFile": str(adjudications_path)}
    if len(set(review_paths)) != len(review_paths):
        raise ValueError("Do not count the same review file twice")
    for path in review_paths:
        for item in read(path)["entries"]:
            item = {**item, "reviewFile": str(Path(path).relative_to(ROOT) if Path(path).is_absolute() else path)}
            reviews.setdefault(item["key"], []).append(item)
    by_title = {f"{w['composer']}|{w['title']}": w for w in state["works"]}
    by_public = {w.get("violinId", w["id"]): w for w in state["works"]}
    used_ids = {w["id"] for w in state["works"]}
    next_id = max(used_ids | set(state["registry"].values())) + 1
    report = {"batch": batch, "accepted": [], "held": []}
    seen = set()
    for path in research_paths:
        for entry in read(path)["entries"]:
            key = entry["key"]
            if key in seen:
                raise ValueError(f"Duplicate research key: {key}")
            seen.add(key)
            rs = [r for r in reviews.get(key, []) if r.get("status") == "approved"]
            if not rs:
                report["held"].append({"key": key, "reason": "No independent approval"})
                continue
            if entry.get("requiresFactReview") and not any(r.get("factsVerified") is True for r in rs):
                report["held"].append({"key": key, "reason": "First-pass extraction still requires independent factual verification"})
                continue
            review = merge_reviews(rs)
            work = copy.deepcopy(entry["work"])
            work.update(review.get("workCorrections", {}))
            if work.get("composer") in excluded:
                report["held"].append({"key": key, "reason": "Composer is excluded; requires evidence resolving prior exclusion"})
                continue
            title_key = f"{work['composer']}|{work['title']}"
            old = by_public.get(entry.get("existingPublicId")) or by_title.get(title_key)
            if old and (old["composer"] != work["composer"] or old["title"] != work["title"]):
                report["held"].append({"key": key, "reason": "Existing id does not match composer/title; identity corrections require a separate reviewed migration"})
                continue
            grade, opinions, grade_issue = resolve_grade(entry, rs)
            grade_resolution = None
            if grade is None and key in adjudications:
                grade = adjudicate_grade(adjudications[key], opinions)
                if grade is not None:
                    grade_resolution = adjudications[key]
                    review["grade"] = {**review.get("grade", {}), **{field: grade_resolution[field] for field in ("level", "hardestPart", "confidence")}}
            if old:
                # Never collapse two playable versions merely because they have the same composer/title.
                if not entry.get("existingPublicId") and (old["instruments"] != work["instruments"] or old.get("arranger") != work.get("arranger")):
                    report["held"].append({"key": key, "reason": "Title collision with a different scoring/arranger"})
                    continue
                allowed = (set(review.get("approvedWorkFields", [])) | set(review.get("workCorrections", {}))) - IDENTITY_FIELDS
                for field in allowed:
                    if field in ("level", "hardestPart", "partLevels"):
                        continue
                    if field in work:
                        old[field] = work[field]
                if grade is not None and "level" in allowed:
                    old["level"] = grade
                if grade is not None and "hardestPart" in allowed:
                    old["hardestPart"] = review["grade"]["hardestPart"]
                if grade is not None:
                    for field in ("mode", "pace", "character"):
                        if field in allowed and field not in review.get("workCorrections", {}) and field in review["grade"]:
                            value = review["grade"][field]
                            old[field] = None if value == "unsure" else value
                work = old
                action = "reviewed-existing"
            else:
                if (entry.get("decision") != "include" and key not in release_held) or grade is None:
                    report["held"].append({"key": key, "reason": grade_issue or "Researcher has not released the held proposal", "opinions": opinions})
                    continue
                if work.get("violinId") and (work["violinId"] not in violin_by_id or violin_by_id[work["violinId"]]["level"] != grade):
                    report["held"].append({"key": key, "reason": "Cross-listed violin level mismatch; separately graded parts required"})
                    continue
                work["level"], work["hardestPart"] = grade, review["grade"]["hardestPart"]
                if not work.get("violinId"):
                    for field in ("mode", "pace", "character"):
                        value = review["grade"].get(field, work.get(field))
                        work[field] = None if value == "unsure" else value
                work["id"] = state["registry"].get(title_key, next_id)
                if work["id"] in used_ids:
                    raise ValueError(f"Registry id collision for {key}")
                next_id = max(next_id, work["id"] + 1)
                used_ids.add(work["id"])
                state["registry"][title_key] = work["id"]
                if work["composer"] not in violin_composers and work["composer"] not in state["composers"]:
                    if not entry.get("composerMetadata"):
                        raise ValueError(f"Missing new composer metadata: {key}")
                    state["composers"][work["composer"]] = entry["composerMetadata"]
                state["works"].append(work)
                by_title[title_key] = work
                by_public[work.get("violinId", work["id"])] = work
                action = "cross-listed" if work.get("violinId") else "added"
            public_id = str(work.get("violinId", work["id"]))
            fields, urls, skipped = detail_patch(entry, review)
            if fields:
                override = state["details"].setdefault(public_id, {"fields": {}, "sources": {}})
                override["fields"].update(fields)
                override["sources"].update(urls)
            recording = selected_recording(entry, rs)
            if recording and not work.get("violinId"):
                state["recordings"][public_id] = recording
            source = state["sources"].setdefault(str(work["id"]), {})
            source.setdefault("sameInstrumentExpansions", {})[key] = {"research": entry["evidence"], "reviews": rs, "gradeOpinions": opinions, "gradeIssue": grade_issue, "recordingResearch": entry.get("recordingResearch", {})}
            if grade_resolution:
                source["sameInstrumentExpansions"][key]["gradeResolution"] = grade_resolution
            if action in ("added", "cross-listed"):
                source.update(slice="same-instrument/" + batch, confidence="medium", sources=[s["url"] if isinstance(s, dict) else s for s in entry["evidence"]["sources"]], levelGuess=entry["work"].get("level"), levelBasis=entry["researcherGrade"]["basis"], floor=entry["evidence"]["floor"])
            report["accepted"].append({"key": key, "id": work["id"], "publicId": int(public_id), "action": action, "releasedHeldProposal": key in release_held, "gradeOpinions": opinions, "gradeIssue": grade_issue, "details": list(fields), "unsourcedDetailFieldsSkipped": skipped, "recording": recording["video"]["id"] if recording else None})
            if grade_resolution:
                report["accepted"][-1]["gradeResolution"] = grade_resolution
    stage = RUN / "staging" / batch
    stage.mkdir(parents=True, exist_ok=True)
    changes = []
    for kind, path in SOURCE.items():
        if before[kind] != state[kind]:
            target = stage / (kind + ".next.json")
            write(target, state[kind])
            changes.append({"path": path, "staged": str(target.relative_to(ROOT)), "sha256": digest(target)})
    write(stage / "report.json", report)
    write(stage / "manifest.json", {"batch": batch, "sourceHashes": hashes, "inputHashes": inputs, "changes": changes, "applied": False})
    check_stage(stage)
    print(json.dumps({"batch": batch, "accepted": len(report["accepted"]), "held": len(report["held"]), "changedFiles": len(changes), "report": str((stage / 'report.json').relative_to(ROOT))}))


def check_stage(stage):
    manifest = read(stage / "manifest.json")
    by_path = {item["path"]: item["staged"] for item in manifest["changes"]}
    command = [str(ROOT / "node_modules/.bin/tsx"), "scripts/chamber/check.ts", "--works", by_path.get(SOURCE["works"], SOURCE["works"]), "--composers", by_path.get(SOURCE["composers"], SOURCE["composers"])]
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise ValueError(result.stdout + "\n" + result.stderr)


def apply(batch):
    if (RUN / "PAUSE").exists():
        raise RuntimeError("Run is paused")
    stage = RUN / "staging" / batch
    manifest = read(stage / "manifest.json")
    if manifest["applied"]:
        print("Already applied; no writes")
        return
    lock_path = ROOT / "data/cache/same-instrument-import/import.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_path, "a+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for path, expected in {**manifest["sourceHashes"], **manifest["inputHashes"]}.items():
            if digest(ROOT / path) != expected:
                raise ValueError(f"Stale proposal; prepare again: {path}")
        for item in manifest["changes"]:
            if item["path"] not in SOURCE.values() or digest(ROOT / item["staged"]) != item["sha256"]:
                raise ValueError("Invalid staged path or changed staged contents")
        check_stage(stage)
        if not manifest["changes"]:
            print("No changes; no rebuild required")
            return
        backup = lock_path.parent / batch
        backup.mkdir(exist_ok=True)
        paths = [item["path"] for item in manifest["changes"]] + GENERATED
        originals = {path: (ROOT / path).read_bytes() if (ROOT / path).exists() else None for path in paths}
        for path, contents in originals.items():
            if contents is not None:
                target = backup / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(contents)
        try:
            for item in manifest["changes"]:
                write(ROOT / item["path"], read(ROOT / item["staged"]))
            for command in [[sys.executable, "scripts/details_merge.py"], [str(ROOT / "node_modules/.bin/tsx"), "scripts/build-data.ts"], [str(ROOT / "node_modules/.bin/tsx"), "scripts/chamber/check.ts"], [str(ROOT / "node_modules/.bin/tsx"), "scripts/build-chamber.ts"]]:
                result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
                if result.returncode:
                    raise RuntimeError(result.stdout + "\n" + result.stderr)
        except BaseException:
            for path, contents in originals.items():
                target = ROOT / path
                if contents is None:
                    target.unlink(missing_ok=True)
                else:
                    target.write_bytes(contents)
            raise
        manifest["applied"] = True
        manifest["rollbackSnapshot"] = str(backup.relative_to(ROOT))
        write(stage / "manifest.json", manifest)
        write(RUN / "imports" / (batch + ".json"), {**read(stage / "report.json"), "sourceHashesBefore": manifest["sourceHashes"], "inputHashes": manifest["inputHashes"], "rollbackSnapshot": manifest["rollbackSnapshot"]})
        print(f"Applied {batch}; rebuilt details and both catalogues; rollback snapshot {backup.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "apply"])
    parser.add_argument("--batch", required=True)
    parser.add_argument("--research", nargs="+", default=[])
    parser.add_argument("--reviews", nargs="+", default=[])
    parser.add_argument("--release-held", nargs="*", default=[], help="Coordinator explicitly releases resolved holds; independent grade gates still apply")
    parser.add_argument("--adjudications", help="Explicit source/anchor editorial resolutions of three supported conflicting grades")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.batch):
        parser.error("Batch must be a short lowercase name")
    if args.command == "prepare":
        if not args.research or not args.reviews:
            parser.error("prepare requires --research and --reviews")
        prepare(args.batch, args.research, args.reviews, args.release_held, args.adjudications)
    else:
        apply(args.batch)
