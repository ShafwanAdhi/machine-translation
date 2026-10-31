# Web Machine Translation dan Benchmark

Standalone React/TypeScript/Vite + FastAPI/PyTorch CPU application. Both exported GRU models, all recorded benchmark results, live optional sentence BLEU, and Docker Compose for a public VPS. No changes to Numora or the training notebook. No training, database, login, or external inference service.

## Acceptance
- Translation: both models by default, optional English reference, BLEU 1–4 without smoothing, latency, OOV; 1,000 characters / 60 cleaned tokens, generation <=60.
- Benchmark: scores, training (20 epoch records, best checkpoint markers), length groups, errors, searchable/paginated predictions, qualitative review and three attention images. Download CSVs.
- Verify artifacts at startup. Load models once in one Uvicorn worker with two CPU threads. Global non-queued inference gate; 10 inference requests / minute / IP.
- Responsive light/teal UI, accessible keyboard controls, concise method-only copy. No persistence of visitor inputs.
- Portable non-root multi-stage Docker image, healthcheck, restart policy, .env example and HTTPS reverse-proxy instructions.
- Tests: real-model predictions match five notebook fixtures/model; score/metadata parity, validation, concurrency, rate limits, frontend build and browser QA; Docker validation and engine smoke when available.

## Ledger
- Setup: new repository on feat/mt-benchmark-web; independent checkout provides isolation. No worktree needed for an empty repository explicitly requested by user.
- Source: verified model ZIP; benchmark outputs and Machine_Translation_Group2.ipynb. Assets copied; source files untouched.
- Tasks: 1 backend/data; 2 responsive UI; 3 Docker/docs; 4 verification/review/package.
- Pre-flight: frontend and backend share stable /api interfaces, JSON benchmark data, model IDs no_attention/attention. Docker bundles frontend/dist and the same backend/assets.

## Progress
- Task 1 complete: assets verified/copied, portable CPU model loader, scoring/API/limits. Backend suite: 22 passed; ten real predictions match notebook.
- Task 2 complete: responsive React workspace and five benchmark tabs. Frontend: 3 passed; TypeScript + production build passed. Browser: desktop/mobile translation, sentence BLEU, clipboard, all tabs, CSV download, search, pagination, review/length filters, keyboard tabs, three images; no page overflow, no console errors.
- Task 3 complete: non-root CPU Dockerfile, Compose, environment and local/VPS/HTTPS documentation. docker compose config --quiet passed.
- Ruling: Docker Engine smoke deferred because startup exhausted Windows commit memory and crashed a CLI process; stopped only the Docker Desktop instance started for this test. No container build/run claim. Image must be smoke-tested on a host with available Docker Engine.
- Regression fixed: clear previous translations when source/reference/examples change, preventing stale output being associated with new input; watched test fail then pass.
- Final independent review complete: checksum portability blocker addressed and verified; no other concrete blocker reported. Container smoke remains the documented environment-dependent check.
- Cross-platform regression: Git autocrlf normalized hashed CSV/JSON assets in the first commit. Added .gitattributes to preserve byte-exact models/data; scripts/verify_git_assets.py checks committed blobs rather than only the working tree.
