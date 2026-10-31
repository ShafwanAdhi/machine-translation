# MT Lab

Web Indonesia–Inggris: GRU Seq2Seq tanpa attention dan Bahdanau attention. React + FastAPI, inference PyTorch CPU.

## Docker

Linux x86-64, Docker Engine + Compose; target awal 2 vCPU / 4 GB RAM.

```sh
cp .env.example .env
docker compose up -d --build
curl http://localhost:8080/health
```

Buka `http://localhost:8080`. Model sudah disertakan; tidak perlu training atau mengunduh model saat startup.

```sh
docker compose logs --tail=100 web
docker compose down
```

## Lokal

Python 3.11 dan Node 24. Jalankan dari root proyek:

```sh
python -m venv .venv
# Linux: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
cd frontend
npm ci
npm run build
cd ..
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8080 --workers 1
```

Untuk frontend development, jalankan `npm run dev` di folder frontend; API tetap berjalan pada port 8080.

## Metode

- OPUS-100 en-id, split internal 80/10/10, seed 42; vocabulary word-level train-only.
- Preprocessing lowercase, spasi tanda baca `.,!?`, normalisasi whitespace. Greedy decoding maksimal 60 token.
- Batch 16, 10 epoch, Adam lr 0.002, teacher forcing 0.5, gradient clipping 1.0. Training CUDA + AMP; inference web FP32 CPU.
- Checkpoint terbaik: epoch 3 tanpa attention, epoch 2 Bahdanau. BLEU-4 test: 0.024826 dan 0.064133.
- BLEU 1–4 skala 0–1 tanpa smoothing. BLEU input dihitung terhadap referensi opsional, terpisah dari corpus BLEU test. Input pendek dapat menghasilkan BLEU-4 nol.
- Input maksimal 1.000 karakter / 60 token setelah preprocessing. Referensi memiliki batas yang sama. Satu inference aktif; maksimal 10 permintaan / menit / IP. Teks pengunjung tidak disimpan.

`models/` berisi bobot, vocabulary, dan konfigurasi. `data/` berisi benchmark dan artefak. `assets-manifest.json` diverifikasi saat startup; perubahan aset yang disengaja harus disertai pembaruan manifest.

## API

Dokumentasi interaktif: `/api/docs`.

```sh
curl -X POST http://localhost:8080/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"kau lihat ?","models":["no_attention","attention"],"reference":"you look ?"}'
```

`GET /api/benchmark`, `GET /api/predictions`, `GET /api/artifacts/{key}`, dan `GET /health`.

## VPS dan HTTPS

Push repo ini ke remote milikmu, clone di VPS, lalu jalankan Compose. Tidak ada remote yang dibuat otomatis.

Untuk reverse proxy Nginx di host, set `HOST_BIND=127.0.0.1` agar port aplikasi tidak terbuka langsung. Contoh proxy:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8k;
    proxy_read_timeout 60s;
}
```

Pasang sertifikat TLS untuk domain melalui reverse proxy. Di bridge Docker, koneksi proxy host biasanya terlihat sebagai gateway bridge; temukan dengan `docker network inspect <nama-network-compose>`, lalu set `FORWARDED_ALLOW_IPS` ke IP proxy yang benar dan jalankan ulang Compose. Percayai hanya proxy yang dikendalikan sendiri. Jika tidak dikonfigurasi, pengguna melalui proxy akan berbagi satu rate limit.

Jangan menambah Uvicorn worker: setiap worker memuat salinan model dan limiter tersendiri. Tidak ada database atau volume persisten yang dibutuhkan.

## Pengujian

```sh
python -m pytest -q
cd frontend
npm test
npm run build
cd ..
docker compose config --quiet
python scripts/verify_git_assets.py
```

Tes model membandingkan lima input per model dengan prediksi notebook. Benchmark bersumber dari ekspor model dan hasil `Machine_Translation_Group2.ipynb`; checksum sumber dicatat di `data/provenance.json`.

Status pengujian dan batas verifikasi container: [docs/verification.md](docs/verification.md).
