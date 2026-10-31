import csv
import hashlib
import json

import pytest

from backend.service import ModelService, verify_assets
from backend.settings import ROOT, Settings


@pytest.fixture(scope="module")
def engine():
    return ModelService(Settings())


def test_real_models_match_notebook(engine):
    rows = json.loads((ROOT / "tests/fixtures/predictions.json").read_text(encoding="utf-8"))
    for row in rows:
        for result in engine.translate(row["source"], ["no_attention", "attention"], None):
            assert result["translation"] == row["translations"][result["model"]]
            assert result["latency_ms"] >= 0
    assert len(rows) == 5


def test_unknown_tokens_and_reference(engine):
    result = engine.translate("zzzznotaword", ["attention"], "one two three four")[0]
    assert result["oov_count"] == 1 and set(result["bleu"]) == {f"BLEU-{i}" for i in range(1, 5)}


def test_checksum_failure(tmp_path):
    names = [f"models/{mid}/{f}" for mid in ("attention", "no_attention") for f in ("model.pt", "vocab.json", "config.json")]
    names += ["data/benchmark.json", "data/predictions.json"]
    manifest = {}
    for name in names:
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"original")
        manifest[name] = hashlib.sha256(b"original").hexdigest()
    (tmp_path / "assets-manifest.json").write_text(json.dumps(manifest))
    verify_assets(tmp_path)
    (tmp_path / names[0]).write_bytes(b"tampered")
    with pytest.raises(RuntimeError, match="Checksum"):
        verify_assets(tmp_path)
    (tmp_path / names[0]).unlink()
    with pytest.raises(RuntimeError, match="tidak ditemukan"):
        verify_assets(tmp_path)


def test_benchmark_matches_source_csv():
    data = json.loads((ROOT / "data/benchmark.json").read_text(encoding="utf-8"))
    with (ROOT / "data/artifacts/benchmark_dosen_summary.csv").open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for model, row in zip(data["models"], rows):
        for n in range(1, 5):
            assert model["bleu"][f"BLEU-{n}"] == float(row[f"BLEU-{n}"])
        assert model["training_seconds"] == float(row["Training (detik)"])
        assert model["parameters"] == int(row["Parameter"])
        config = json.loads((ROOT / "models" / model["id"] / "config.json").read_text(encoding="utf-8"))
        assert model["selected_epoch"] == config["selected_epoch"]
        assert model["validation_loss"] == config["validation_loss"]
        assert [x["epoch"] for x in data["history"][model["id"]]] == list(range(1, 11))
