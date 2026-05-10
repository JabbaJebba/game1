# Game Improvement Log

## 2026-05-10 — Resource Processing (Timed Smelting, Crusher, Refinery)
- **Feature:** Machines now process resources over time with a queue system
  - Smelter: 3 ore → 1 ingot in 3 seconds per ingot (copper, iron, gold)
  - Crusher: 1 rock → 2 crushed rock in 2 seconds per unit
  - Refinery: 5 crushed rock → random ores/gems in 5 seconds per batch
- **Queue system:** Select amount with +/- buttons, queue jobs one-by-one
  - Each machine has independent queue keyed by grid position
  - Active job shows live progress bar + "X / Y completed"
  - Pending jobs listed below active job
- **Offline processing:** Ship machines keep working while you're on mining missions
  - `launchTime` saved when you leave; on return, elapsed time is applied to all queues
  - Partial job completion handled correctly
- **UI:** Room modals redesigned for processing rooms
  - Active job progress bar fills in real-time
  - Amount selector per recipe with Queue button
  - Input resource counts displayed for each recipe
- **Save/load:** `processingQueues` and `launchTime` persist in save data
- Status: ✅ Pushed. Commit: ca18ca6

## 2026-05-10 — Idle Breathing
- **QoL:** Added idle breathing animation — when standing still on ground, the character subtly bobs up and down (±1.2px, ~3s sine cycle)
- Eyes stay synced with the body bob so nothing looks detached
- Makes the character feel alive during those quiet moments between mining
- Status: ✅ Pushed. Commit: e1d77f2

## 2026-05-10 — Coyote Time
- **QoL:** Added 100ms coyote time — you can still jump for a brief window after walking off a ledge
- Makes platforming feel more forgiving without changing tile-snapping or movement precision
- Status: ✅ Pushed. Commit: 036ac42

## 2026-05-10 — Landing Dust + Syntax Fix
- **Fix:** `const tileX` redeclaration in `update()` (depth indicator commit) caused SyntaxError — renamed second declaration to `playerTileX`
- **QoL:** Added landing dust particles when player hits the ground after a jump (3-5 gray particles spray upward and fade)
- Status: ✅ Pushed. 

## 2026-05-10 — Walking Dust Particles
- Added tiny dust puffs at the player's feet while walking on ground
- Spawns every 100-180ms when |vx| > 20, random horizontal spread
- Small (2-4px), gray, short 250-400ms fade — subtle but adds life
- Pairs with landing dust to ground the character in the world
- Status: ✅ Pushed. Commit: 5076182

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
- [x] Idle breathing animation — character subtly bobs up/down when standing still on ground (±1.2px, ~3s cycle)
- [x] Coyote time — 100ms jump grace period after walking off a ledge (platformer feel)
- [x] Auto-save/load via localStorage (auto-save on ship departure & return, auto-load on boot) — Commit: d920612
- [x] Restore original physics-based movement
- [x] Fix mining to use actual tile bounds
- [x] Fix fuel costs (liter-based system)
- [x] Add screen shake on mining
- [x] Add mine indicator flash
- [x] Add debris particles on mining
- [x] Add floating loot text
- [x] Low fuel warning: "NO FUEL" float text when mining empty + red pulsing fuel bar border below 2L
