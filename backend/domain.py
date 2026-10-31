import collections
import math
import re


def clean(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r"([.,!?])", r" \1 ", text)
    return re.sub(r"\s+", " ", text).strip()


def bleu_scores(reference: str, hypothesis: str) -> dict[str, float]:
    ref, hyp = clean(reference).split(), clean(hypothesis).split()
    precision = []
    for n in range(1, 5):
        rn = collections.Counter(tuple(ref[i:i + n]) for i in range(len(ref) - n + 1))
        hn = collections.Counter(tuple(hyp[i:i + n]) for i in range(len(hyp) - n + 1))
        total = max(len(hyp) - n + 1, 0)
        clipped = sum(min(count, rn[gram]) for gram, count in hn.items())
        precision.append(clipped / total if total else 0.0)
    bp = 0.0 if not hyp else (1.0 if len(hyp) > len(ref) else math.exp(1 - len(ref) / len(hyp)))
    return {
        f"BLEU-{n}": (bp * math.exp(sum(math.log(x) for x in precision[:n]) / n)
                      if min(precision[:n]) > 0 else 0.0)
        for n in range(1, 5)
    }
