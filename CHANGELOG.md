# Game Improvement Log

## 2026-05-10 — Depth Indicator
- Replaced useless raw pixel position with depth readout (meters below surface)
- Depth calculated from surface Y at current X, clamped to world bounds
- Color-coded depth: green (0-20m), yellow (21-80m), orange (81-150m), red (150m+)
- Cleaned up infoText layout: shorter controls line, cost abbreviated
- Status: ✅ Pushed. Commit: 5066880

## 2026-05-10 — Low Fuel Warning
- Added "NO FUEL" floating text when attempting to mine with insufficient fuel (red, above the tile)
- Added critical low fuel warning: fuel bar border pulses red when below 2L
- Fuel bar text turns red when critically low, returns to white when refueled
- Status: ✅ Pushed. Commit: a0f545e

## 2026-05-10 — Floating Loot Text
- Added floating text feedback when mining tiles (`+1 Copper Ore`, `+1 Ruby`, etc.)
- Text rises 40px and fades over 900ms, color-coded by resource type
- Rocks: gray, Copper: orange, Iron: silver, Gold: yellow, Gems: their respective colors
- Commit: 02cd75e
- Status: ✅ Pushed. Mining now tells you exactly what you got. Next: save/load system, sound, or auto-collect radius.

## 2026-05-10 — Debris Particles
- Added debris particles when mining tiles (4-6 colored squares fly outward and fade)
- Particles match the tile color (rock, metal, gem)
- 350-600ms lifetime with random trajectory and rotation
- Commit: da365ff
- Status: ✅ Pushed. Mining now has tactile visual feedback. Next: save/load system, sound, or auto-collect radius.

## 2026-05-09 — First Automated Update
- Added screen shake on mining (60ms, intensity 0.004)
- Added mine indicator flash animation (scale up/down on hit)
- Status: Mining now has visual feedback. Next: debris particles, sound effects, or save system.

## TODO Queue (prioritized)
1. **Better UI** - Cleaner inventory display, stats panel, depth colors
2. **More content** - Additional gem types, planet variety
3. **Audio** - Mining sounds, ambient music
4. **Graphics** - Tile sprites instead of colored rectangles
5. **Character sprite** - Replace blue rectangle with animated character
6. **Day/Night impact** - Visibility reduction at night, torch system
7. **Hazards** - Falling rocks, lava, enemies
8. **Quality of life** - Auto-collect radius, better teleport mechanics

## Completed
- [x] Auto-save/load via localStorage (auto-save on ship departure & return, auto-load on boot) — Commit: d920612
- [x] Restore original physics-based movement
- [x] Fix mining to use actual tile bounds
- [x] Fix fuel costs (liter-based system)
- [x] Add screen shake on mining
- [x] Add mine indicator flash
- [x] Add debris particles on mining
- [x] Add floating loot text
- [x] Low fuel warning: "NO FUEL" float text when mining empty + red pulsing fuel bar border below 2L
