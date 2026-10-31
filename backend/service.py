import hashlib
import json
import time
from pathlib import Path

import torch

from .domain import bleu_scores, clean
from .ml.model import DecoderAttn, DecoderNoAttn, Encoder, Seq2Seq
from .settings import Settings

MODEL_IDS = ("no_attention", "attention")


def verify_assets(root: Path) -> None:
    try:
        manifest = json.loads((root / "assets-manifest.json").read_text(encoding="utf-8"))
        required = {f"models/{mid}/{name}" for mid in MODEL_IDS for name in ("model.pt", "vocab.json", "config.json")}
        required |= {"data/benchmark.json", "data/predictions.json"}
        if not required.issubset(manifest):
            raise ValueError("Manifest tidak lengkap")
        for relative, expected in manifest.items():
            path = (root / relative).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                raise ValueError(f"Aset tidak ditemukan: {relative}")
            digest = hashlib.sha256()
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            if digest.hexdigest() != expected:
                raise ValueError(f"Checksum tidak cocok: {relative}")
    except (OSError, ValueError) as exc:
        raise RuntimeError(f"Gagal memuat aset: {exc}") from exc


class ModelService:
    def __init__(self, settings: Settings):
        verify_assets(settings.root)
        torch.set_num_threads(settings.threads)
        self.models = {}
        self.vocabs = {}
        for mid in MODEL_IDS:
            folder = settings.root / "models" / mid
            vocab = json.loads((folder / "vocab.json").read_text(encoding="utf-8"))
            config = json.loads((folder / "config.json").read_text(encoding="utf-8"))
            if (config["embedding_dim"], config["hidden_dim"], config["attention_dim"]) != (64, 128, 64):
                raise RuntimeError(f"Arsitektur tidak cocok: {mid}")
            decoder = DecoderAttn(len(vocab["target_tokens"])) if mid == "attention" else DecoderNoAttn(len(vocab["target_tokens"]))
            model = Seq2Seq(Encoder(len(vocab["source_tokens"])), decoder)
            model.load_state_dict(torch.load(folder / "model.pt", map_location="cpu", weights_only=True), strict=True)
            model.eval()
            self.models[mid] = model
            self.vocabs[mid] = {
                "source": {word: index for index, word in enumerate(vocab["source_tokens"])},
                "target": vocab["target_tokens"], "special": vocab["special_tokens"],
            }

    @torch.inference_mode()
    def translate(self, text: str, models: list[str], reference: str | None) -> list[dict]:
        tokens = clean(text).split()
        results = []
        for mid in models:
            vocab = self.vocabs[mid]
            special = vocab["special"]
            ids = [vocab["source"].get(token, special["unk"]) for token in tokens] + [special["eos"]]
            src = torch.tensor([ids], dtype=torch.long)
            lengths = torch.tensor([len(ids)], dtype=torch.long)
            start = time.perf_counter()
            predicted, _ = self.models[mid].translate(src, lengths, max_len=60)
            elapsed = (time.perf_counter() - start) * 1000
            translation = " ".join(vocab["target"][i] for i in predicted[0])
            results.append({"model": mid, "translation": translation, "latency_ms": round(elapsed, 2),
                            "oov_count": sum(token not in vocab["source"] for token in tokens),
                            "bleu": bleu_scores(reference, translation) if reference else None})
        return results
