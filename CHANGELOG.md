# Game Improvement Log

## 2026-05-10 — Falling Wind Trail
- **QoL/Game Feel:** Added thin white streaks that spawn behind the player when falling fast (vy > 250)
  - Particles drift opposite to the player's facing direction (falling right → streaks trail left)
  - Spawn rate: 40–90ms when falling fast, stops immediately on landing
  - Thin vertical rectangles (2–5px wide, 12–20px tall) with 35% initial alpha
  - Fade + drift outward over 180–300ms, giving a sense of wind rushing past
  - Purely visual, purely additive — no gameplay or collision changes
  - Pairs with existing landing dust to complete the jump arc: takeoff dust → fall trail → landing dust
- Status: ✅ Pushed. Commit: 17b784b

## 2026-05-10 — Mining Recoil Animation
- **QoL/Game Feel:** Added body recoil when mining — the character's entire sprite (body + eyes) briefly kicks in the opposite direction of the mine swing
  - Left mine → body recoils right 5px; Right mine → body recoils left 5px; Down mine → body recoils up 4px
  - 70ms tween with yoyo, ease-out curve for a snappy, weighty feel
  - Cooldown ring follows the recoil so it stays visually anchored to the player
  - Cancels previous recoil tween if a new mine fires before the old one finishes — no visual fighting
  - Purely visual: logical position (this.x/this.y) never changes, so collision and snapping are unaffected
  - Pairs with existing screen shake + debris particles to make each mine hit feel genuinely physical
- Status: ✅ Pushed. Commit: `d1eae9c`

## 2026-05-10 — Mining Target Preview
- **QoL/Game Feel:** Added mining target preview outlines — when holding A/S/D, the exact tiles that will be mined are outlined with a pulsing border
  - Color transitions from orange (on cooldown) to green (ready to mine)
  - Alpha brightens from 25% to 70% as the 180ms cooldown refreshes
  - Draws individual tile outlines for each tile in the mining sweep (left/right = 3 tiles, down = 2 tiles)
  - Pairs with the existing cooldown ring to make mining rhythm completely transparent
  - No gameplay change — purely informational visual feedback
- Status: ✅ Pushed. Commit: `b00e7ef`

## 2026-05-10 — Nighttime Tile Dimming
- **QoL/Atmosphere:** Tiles now darken at night as the day/night cycle progresses
  - Tile brightness scales from 60% at full night → 100% at full day
  - Gem pulse alpha multiplies with the night factor (gems still shimmer, just dimmer)
  - Makes the day/night cycle visually cohesive — sky darkens AND the world darkens
  - No gameplay impact, purely atmospheric; mining and movement unchanged
- Status: ✅ Pushed. Commit: `62283fa`

## 2026-05-10 — Inline Sell Mode + Modal Click Guard
- **Bugfix:** Eliminated sell popup jumping to wrong room — root cause was scene-level `pointerdown` leaking through popup buttons to the grid, selecting a different room tile
- **UI:** Trade room panel now uses inline sell mode instead of a centered popup — click SELL → panel switches to sell view with quick buttons (1/10/50/ALL) and custom amount
- **Guard:** All panel/modal buttons now auto-set `justClickedModal` flag; `handleGridClick()` checks it at entry and consumes the click before it can hit the grid
- **Consistency:** Sell flow stays entirely within the right-side panel — no more popup/panel visual clash
- Status: ✅ Pushed. Commit: `22de797`

## 2026-05-10 — Mine Cooldown Ring
- **QoL:** Added a circular cooldown ring around the player when holding a mine key (A/S/D)
  - Ring fills from 0% → 100% over the 180ms mining cooldown
  - Color transitions from orange (just mined) to green (ready to mine again)
  - Only visible while holding a mine key and on cooldown — unobtrusive
  - Makes the mining rhythm tangible; players can see exactly when the next swing is ready
- Status: ✅ Pushed. Commit: 30e2358

## 2026-05-10 — Fixed Right-Side Room Control Panel
- **UI:** Room controls are now a fixed panel on the right side of the screen instead of a centered popup modal
- Panel sits at `x=1180, y=360` with dimensions `280×560`
- Shows room title, subtitle, controls, and DESTROY button
- Processing rooms (crusher, smelter, refinery) show live progress bar + recipe rows
- Clicking a different room swaps the panel contents; clicking empty space or ✕ hides it
- Status: ✅ Pushed. Commit: b3a3c8d

## 2026-05-10 — Gem Tile Pulse Glow
- **QoL:** Gem tiles now have a subtle pulsing glow — they softly breathe with a sine-wave alpha oscillation (±12%, ~3.5s cycle)
- Each gem tile has a slightly different phase based on its grid position, creating a living, organic shimmer across veins
- Makes valuable tiles visually distinct from plain rock and draws the player's eye naturally
- Applied in both `renderWorld()` (batch draw) and `updateTile()` (single-tile redraw after mining)
- Status: ✅ Pushed. Commit: 80ea04e

## 2026-05-10 — Jump Takeoff Dust
- **QoL:** Added dust burst at the player's feet when jumping (3-5 gray particles spray outward and fade)
- Symmetrically pairs with existing landing dust — jump now has both a takeoff and landing feel
- Triggers on all jump paths: normal jump, coyote-time jump, and buffered jump
- Status: ✅ Pushed. Commit: 827ca50

## 2026-05-10 — Eye Blinking
- **QoL:** Added eye blinking animation — pupils briefly close and reopen when standing still on ground
- Blink triggers every 1.5–5 seconds while idle (on ground, not moving, not mining)
- Close → hold → open cycle: 70ms / 50ms / 70ms, scales pupil Y from 1 → 0.1 → 1
- Pairs with idle breathing to make the character feel genuinely alive during quiet moments
- Status: ✅ Pushed. Commit: 3c57153

## 2026-05-10 — Jump Buffering
- **QoL:** Added 120ms jump buffer — pressing jump slightly before landing queues the jump
- Jump fires the exact frame the player touches ground, pairing with existing coyote time
- Makes rapid platforming sequences feel responsive and intentional
- Status: ✅ Pushed. Commit: b588df0

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
6. **Day/Night impact** - Torch/light system for player
7. **Hazards** - Falling rocks, lava, enemies
8. **Quality of life** - Auto-collect radius, better teleport mechanics

## Completed
- [x] Falling wind trail — thin white streaks spawn behind the player when falling fast (vy > 250), drifting opposite to facing direction, 40-90ms spawn rate, 180-300ms fade
- [x] Mine cooldown ring — circular arc around player showing mining cooldown progress, color shifts orange→green
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
