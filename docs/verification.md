# Verification

- Backend: 22 tests passed, including five exact saved predictions per real model, BLEU/preprocessing, validation, concurrent busy rejection, responsive health, rate limiting, bounded bodies, downloads, filters, and asset corruption.
- Frontend: 3 tests passed; TypeScript checking and Vite production build passed.
- Browser: real model comparison and reference BLEU, clipboard, CSV download, all five benchmark tabs, keyboard tab navigation, search, pagination, length/review filters, unscored manual review, and all three attention images passed.
- Desktop 1280×900 and mobile 390×844 checked. No page overflow; prediction table scrolls within its container. No browser console warnings/errors.
- SHA256: all 19 committed model/data assets verified against Git blobs and a real Git archive. Binary-preserving attributes prevent Windows/Linux line-ending changes. Training notebook source hash unchanged.
- Independent review: identified the Git checksum portability problem; corrected in commit 8ec9138 and verified with the regression script. No other concrete blocker reported.
- Docker: `docker compose config --quiet` passed. Docker Desktop startup exhausted host Windows commit memory; stopped the Docker Desktop instance started for this test. **Image build, container startup, Linux memory use and VPS deployment have not been tested.** Run `docker compose up -d --build` and verify `/health` on a host with a working Docker Engine before deployment.
