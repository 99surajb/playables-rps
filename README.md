# Stone Paper Scissors — YouTube Playables Starter

A simple, mobile-friendly HTML5 game built to submit to **YouTube Playables**.  
Single-file, no build step, works on phone + desktop.

## How to play
- Tap 🪨 Stone, 📄 Paper, or ✂️ Scissors.
- First to 3 wins the match.
- Keyboard: `1`/`s` Stone, `2`/`p` Paper, `3`/`c` Scissors.

## YouTube Playables readiness
- ✅ HTML5 single-file (`index.html`), WebGL/Canvas-free
- ✅ Mouse + touch input supported
- ✅ Responsive, fast-loading (under 10 KB)
- ✅ No external calls — all assets bundled (emoji are system fonts)
- ⚠️ To publish: fill out the [YouTube Playables interest form](https://developers.google.com/youtube/gaming/playables), wait for invite, then upload via the Playables Developer Portal as a ZIP bundle.

## Publish to GitHub
```bash
git init
git add .
git commit -m "Initial: Stone Paper Scissors Playable"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/playables-rps.git
git push -u origin main
```

## License
MIT — use freely, including for YouTube Playables submission.
