"""Focused safety checks for incremental research ingestion; no network requests."""
import importlib.util
import contextlib
import io
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ensemble_import", Path(__file__).with_name("same_instrument_import.py"))
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def entry(level=5, confidence="medium"):
    return {"key": "example", "work": {"level": level}, "researcherGrade": {"confidence": confidence}}


def review(level, confidence="medium"):
    return {"status": "approved", "grade": {"level": level, "confidence": confidence}}


class GradeSafety(unittest.TestCase):
    def test_agreement(self):
        self.assertEqual(pipeline.resolve_grade(entry(), [review(5)])[0], 5)

    def test_disagreement_needs_a_third_blind_grade(self):
        self.assertIsNone(pipeline.resolve_grade(entry(), [review(6)])[0])
        self.assertEqual(pipeline.resolve_grade(entry(), [review(6), review(6)])[0], 6)

    def test_large_spread_stays_held(self):
        self.assertIsNone(pipeline.resolve_grade(entry(3), [review(5), review(4)])[0])

    def test_unsupported_and_missing_guesses_do_not_count_as_votes(self):
        self.assertIsNone(pipeline.resolve_grade(entry(5, "low"), [review(6)])[0])
        self.assertIsNone(pipeline.resolve_grade(entry(None), [review(6)])[0])
        self.assertEqual(pipeline.resolve_grade(entry(None), [review(6), review(6)])[0], 6)

    def test_unapproved_review_does_not_vote(self):
        held = review(5)
        held["status"] = "held"
        self.assertIsNone(pipeline.resolve_grade(entry(), [held])[0])


class AdjudicationSafety(unittest.TestCase):
    def resolution(self, **changes):
        return {"status": "approved", "level": 4, "confidence": "medium",
                "hardestPart": "cello 1", "consideredOpinions": [3, 5, 2],
                "basis": "Score register and sustained upper-position demands support the anchor comparison.",
                "sources": [{"url": "https://example.invalid/score", "finding": "Complete score"}], **changes}

    def test_source_resolution_preserves_conflicting_opinions(self):
        opinions = [3, 5, 2]
        self.assertEqual(pipeline.adjudicate_grade(self.resolution(), opinions), 4)
        self.assertEqual(opinions, [3, 5, 2])

    def test_cannot_substitute_for_missing_supported_votes(self):
        with self.assertRaises(ValueError):
            pipeline.adjudicate_grade(self.resolution(consideredOpinions=[3, 5]), [3, 5])

    def test_rejects_changed_vote_history_and_out_of_band_grade(self):
        for changes in ({"consideredOpinions": [3, 5, 3]}, {"level": 6}, {"level": True}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                pipeline.adjudicate_grade(self.resolution(**changes), [3, 5, 2])

    def test_requires_supported_source_reason_and_part(self):
        for changes in ({"sources": []}, {"sources": ["local.pdf"]}, {"confidence": "low"},
                        {"basis": ""}, {"hardestPart": ""}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                pipeline.adjudicate_grade(self.resolution(**changes), [3, 5, 2])

    def test_unapproved_resolution_does_not_release(self):
        self.assertIsNone(pipeline.adjudicate_grade(self.resolution(status="held"), [3, 5, 2]))


class DetailSafety(unittest.TestCase):
    def test_later_grade_retains_earlier_approved_detail_corrections(self):
        original = {"approvedDetailFields": ["kind"], "detailCorrections": {"published": None}, "detailSources": {"published": "https://example.invalid/work"}, "workCorrections": {"year": "1976"}}
        later = {"grade": {"level": 6, "confidence": "medium"}, "approvedWorkFields": ["level"]}
        combined = pipeline.merge_reviews([original, later])
        self.assertEqual(combined["detailCorrections"], {"published": None})
        self.assertEqual(combined["workCorrections"], {"year": "1976"})
        self.assertEqual(combined["grade"]["level"], 6)

    def test_only_reviewed_sourced_fields_survive(self):
        item = {"key": "example", "details": {"composed": "1907", "published": "1922"},
                "evidence": {"fieldSources": {"details.composed": "https://example.invalid/composition"}}}
        result = pipeline.detail_patch(item, {"approvedDetailFields": ["composed"]})
        self.assertEqual(result[0], {"composed": "1907"})
        self.assertNotIn("published", result[0])

    def test_explicit_null_removes_shared_page_contamination(self):
        result = pipeline.detail_patch({"key": "example"}, {
            "detailCorrections": {"movements": None},
            "detailSources": {"movements": "https://example.invalid/correct-version"},
        })
        self.assertEqual(result[0], {"movements": None})

    def test_missing_source_is_skipped_instead_of_guessed(self):
        result = pipeline.detail_patch({"key": "example"}, {"detailCorrections": {"published": None}})
        self.assertEqual(result[0], {})
        self.assertEqual(result[2], ["published"])

    def test_wrong_field_types_fail_before_apply(self):
        with self.assertRaises(ValueError):
            pipeline.detail_patch({"key": "example"}, {
                "detailCorrections": {"movements": "Not an array"},
                "detailSources": {"movements": "https://example.invalid/score"},
            })


class RecordingSafety(unittest.TestCase):
    def test_alias_id_and_relevant_description_still_obey_performer_rule(self):
        item = {"recordingResearch": {"candidates": [{"youtubeId": "abcdefghijk", "title": "Work", "channel": "Ensemble", "descriptionRelevant": "With Sarah Chang"}]}}
        checks = dict.fromkeys(["exactVersion", "wholeWork", "humanPerformance", "excludedPerformersChecked", "embedVerified"], True)
        opinion = {"recordingDecisions": [{"id": "abcdefghijk", "decision": "approved", "checks": checks, "reason": "Fixture"}]}
        with self.assertRaises(ValueError):
            pipeline.selected_recording(item, [opinion])

    def test_narrative_approval_alone_cannot_publish_a_video(self):
        item = {"recordingResearch": {"candidates": [{"id": "abcdefghijk", "title": "Work", "channel": "Ensemble"}]}}
        opinion = {"recordingDecisions": [{"id": "abcdefghijk", "decision": "approved", "reason": "Looks plausible"}]}
        self.assertIsNone(pipeline.selected_recording(item, [opinion]))

    def test_each_explicit_check_is_required(self):
        item = {"recordingResearch": {"candidates": [{"id": "abcdefghijk", "title": "Work", "channel": "Ensemble"}]}}
        checks = dict.fromkeys(["exactVersion", "wholeWork", "humanPerformance", "excludedPerformersChecked", "embedVerified"], True)
        for missing in checks:
            partial = {**checks, missing: False}
            opinion = {"recordingDecisions": [{"id": "abcdefghijk", "decision": "approved", "checks": partial}]}
            self.assertIsNone(pipeline.selected_recording(item, [opinion]))

    def test_central_performer_rule_still_blocks_an_approved_description(self):
        item = {"recordingResearch": {"candidates": [{"id": "abcdefghijk", "title": "Work", "channel": "Ensemble", "description": "With guest Joshua Bell"}]}}
        checks = dict.fromkeys(["exactVersion", "wholeWork", "humanPerformance", "excludedPerformersChecked", "embedVerified"], True)
        opinion = {"recordingDecisions": [{"id": "abcdefghijk", "decision": "approved", "checks": checks, "reason": "Fixture"}]}
        with self.assertRaises(ValueError):
            pipeline.selected_recording(item, [opinion])


class ApplySafety(unittest.TestCase):
    def test_first_pass_grades_cannot_bypass_independent_fact_review(self):
        with tempfile.TemporaryDirectory(prefix="atlas-first-pass-") as temp:
            root = Path(temp)
            run = root / "run"
            pipeline.write(root / "data/build/catalogue.json", {"pieces": []})
            pipeline.write(root / "data/chamber/id-registry.json", {"reserved": 100})
            draft = {**entry(), "requiresFactReview": True}
            research = run / "research.json"
            reviews = run / "reviews.json"
            pipeline.write(research, {"entries": [draft]})
            approved = {**review(5), "key": "example"}
            held_facts = {**approved, "status": "held", "factsVerified": True}
            pipeline.write(reviews, {"entries": [approved, held_facts]})
            adjudications = run / "adjudications.json"
            pipeline.write(adjudications, {"entries": [{"key": "example", **AdjudicationSafety().resolution()}]})
            with patch.object(pipeline, "ROOT", root), patch.object(pipeline, "RUN", run), patch.object(pipeline, "check_stage"), contextlib.redirect_stdout(io.StringIO()):
                pipeline.prepare("batch", [str(research)], [str(reviews)], adjudications_path=str(adjudications))
            report = pipeline.read(run / "staging/batch/report.json")
            self.assertEqual(report["accepted"], [])
            self.assertIn("factual verification", report["held"][0]["reason"])
            manifest = pipeline.read(run / "staging/batch/manifest.json")
            self.assertEqual(manifest["inputHashes"][str(adjudications.resolve())], pipeline.digest(adjudications))

    def test_stale_source_is_rejected_before_any_write_or_rebuild(self):
        with tempfile.TemporaryDirectory(prefix="atlas-stale-proposal-") as temp:
            root = Path(temp)
            run = root / "run"
            stage = run / "staging/batch"
            stage.mkdir(parents=True)
            source = root / "source.json"
            source.write_text('{"newer":true}')
            pipeline.write(stage / "manifest.json", {"applied": False, "sourceHashes": {"source.json": "old-digest"}, "inputHashes": {}, "changes": []})
            with patch.object(pipeline, "ROOT", root), patch.object(pipeline, "RUN", run), patch.object(pipeline.subprocess, "run") as subprocess:
                with self.assertRaisesRegex(ValueError, "Stale proposal"):
                    pipeline.apply("batch")
                subprocess.assert_not_called()
            self.assertEqual(source.read_text(), '{"newer":true}')


if __name__ == "__main__":
    unittest.main()
