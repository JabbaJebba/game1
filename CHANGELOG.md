## 2026-05-13 — Depth Milestone Sound
- **QoL/Audio:** Added ascending procedural chimes when reaching depth milestones (50m, 100m, 150m, 200m)
  - Pitch scales with depth — 350Hz at 50m up to 850Hz at 200m
  - Ascending sweep with shimmer harmonic for a "discovery" feel
  - Complements the existing floating text notification with audio feedback
  - Uses the existing Web Audio synthesizer — no external assets needed
- Status: ✅ Pushed. Commit: `7e308b8`

---

## 2026-05-13 — Mining Streak Milestone Sound
- **QoL/Audio:** Added celebratory procedural chimes when mining streaks hit 10×, 25×, and 50×
  - Ascending major triad (sine tones) — brighter and higher for bigger milestones
  - Shimmer harmonic on top for extra sparkle
  - Completes the existing visual celebration (screen shake, text pulse, particle burst) with audio feedback
  - Uses the existing Web Audio synthesizer — no external assets needed
- Status: ✅ Pushed. Commit: `5407326`

---

## 2026-05-13 — Depth Gauge: Live Numeric Readout
- **QoL/UI:** Added a live numeric depth readout to the vertical depth gauge on the left edge of the screen
  - The value (e.g., `47m`, `156m`) now follows the white marker tick as you descend
  - Color-coded by danger level: green (surface), yellow, orange, red (deep)
  - Makes exact depth instantly glanceable without reading the top info bar
  - Text uses monospace font with black stroke for readability against any background
- Status: ✅ Pushed. Commit: `744ff8d`

---

## 2026-05-13 — Scout Placement: Always Snap to Tile Centers
- **Bugfix/QoL:** Fixed the scout (1×2 chassis) "standing between 2 tiles" issue by removing the `holdingMoveKey` guard from the tile-grid snap logic
  - Previously, the scout only snapped to a tile center when you released all movement keys after landing
  - If you held A/D when landing (or were pressed against a wall), the scout stayed at a non-center x position — `getTileBounds()` then returned 2 horizontal tiles, making down-mining hit 2 tiles instead of 1
  - Now 1-tile characters snap to `tile*32+16` whenever `onGround && |vx| < 5`, regardless of key state
  - 2-tile characters are unaffected — their offset stays `0` and they naturally straddle boundaries
  - Shadow position is now also updated inside the snap block (was previously drifting one frame behind)
- Status: ✅ Pushed. Commit: `0f8bd8d`

---
