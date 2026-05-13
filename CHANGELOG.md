---

## 2026-05-13 — Science Collection: Visual Flash & Screen Shake
- **QoL/Game Feel:** Added visual and haptic feedback to science collection for a more satisfying discovery moment
  - Brief teal glow flash expands around the player when science is awarded
  - Subtle 90ms screen shake (0.003 intensity) — lighter than mining, discovery-themed
  - Flash uses the same `#00d4aa` science color for visual consistency
  - Complements the existing floating text and audio chime without competing with them
- Status: ✅ Pushed. Commit: `c8963d2`

---

## 2026-05-13 — Run Efficiency Metric
- **QoL/UI:** Added live fuel efficiency tracking to both the in-run stats panel and the return summary
  - Shows `tiles/L` — how many tiles you mine per liter of fuel consumed
  - Updates live during the run so players can see their efficiency in real-time
  - Helps players compare different chassis builds and mining strategies
  - Only appears once fuel has actually been consumed (no premature "0.0" clutter)
- Status: ✅ Pushed. Commit: `8194701`

---

## 2026-05-13 — Ship Status: Active Mech Chassis Display
- **QoL/UI:** Added an active mech chassis indicator to the ship status bar
  - Shows `🦾 Scout`, `🦾 Miner`, or `🦾 Heavy` below the science/credits line
  - Updates automatically when switching chassis in the Mech Configuration modal
  - Helps players quickly confirm their loadout before launching
- Status: ✅ Pushed. Commit: `89b0bc4`

---

## 2026-05-13 — Drone Mining: Circular Radius Fix
- **Bugfix/QoL:** Fixed drone mining range to use proper circular radius from the player's bottom-center (drill position)
  - Old: square scan from body center — heavy mechs (2×3) couldn't mine tiles below their feet
  - New: circular scan from bottom-center — all chassis sizes mine consistently
  - Tiles beyond `droneRange` Euclidean distance are now properly skipped (no more corner mining)
  - Scout (1×2), Miner (2×2), and Heavy (2×3) all benefit from accurate targeting
- Status: ✅ Pushed. Commit: `55fa5f3`

---

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