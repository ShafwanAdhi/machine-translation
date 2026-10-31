import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    root: Path = ROOT
    static_dir: Path = field(default_factory=lambda: ROOT / "frontend" / "dist")
    threads: int = field(default_factory=lambda: int(os.getenv("TORCH_THREADS", "2")))
    rate_limit: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MINUTE", "10")))

    def __post_init__(self):
        if not 1 <= self.threads <= 8 or not 1 <= self.rate_limit <= 100:
            raise ValueError("TORCH_THREADS harus 1–8 dan RATE_LIMIT_PER_MINUTE harus 1–100.")
