import pytest

from backend.domain import bleu_scores, clean


def test_preprocessing_matches_notebook():
    assert clean("  Saya,BISA!\n ") == "saya , bisa !"


def test_bleu_without_smoothing():
    assert list(bleu_scores("one two three four", "one two three four").values()) == [1.0] * 4
    short = bleu_scores("one two", "one two")
    assert short == {"BLEU-1": 1.0, "BLEU-2": 1.0, "BLEU-3": 0.0, "BLEU-4": 0.0}
    assert all(v == 0 for v in bleu_scores("one two", "").values())


def test_brevity_penalty():
    assert bleu_scores("one two three four", "one two")["BLEU-1"] == pytest.approx(0.36787944117)
