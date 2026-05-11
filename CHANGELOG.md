# Game Improvement Log

## 2026-05-11 — Ship Scene Visual Fuel Bar
- **QoL/UI:** Added a visual horizontal fuel bar to the ship command screen
  - Positioned just below the status text at the top-left (x=80, y=76)
  - 220×10px bar with dark background and orange→red fill gradient matching the mining scene fuel bar
  - Fill width scales with `shipFuel / shipFuelCapacity` — full tank = bright orange, nearly empty = deep red
  - Updates live via `updateUI()` every time fuel or credits change (build, buy, return from mining)
  - Pairs with the existing text readout (`⛽ 50.0 / 100.0L`) so players get both precise numbers and at-a-glance visual feedback
  - Zero gameplay changes — purely informational consistency between mining and ship scenes
- Status: ✅ Pushed. Commit: `787397f`

## 2026-05-11 — Processing Machine Status Indicators
- **QoL/UI:** Added live status indicators on processing rooms (smelter, crusher, refinery) in the ship grid
  - Active jobs show a small green progress bar at the bottom of the room tile (fills in real-time)
  - Queued-but-idle machines show a pulsing yellow dot in the top-right corner
  - No indicator on empty/non-processing rooms — keeps the grid clean
  - Updates every frame, tied to the existing `update()` loop with zero extra overhead
  - Helps players see at a glance which machines are working without opening each room's panel
- Status: ✅ Pushed. Commit: `807586b`

## 2026-05-11 — Ship Room Hover Tooltips
- **QoL/UI:** Added room name tooltips that appear when hovering over ship grid cells
  - Tooltip shows the room's icon + name (e.g., "☀ Solar Panel", "⚙ Refinery") positioned just above the hovered cell
  - Only appears on occupied cells; hidden when hovering over empty tiles or outside the grid
  - Uses the same tooltip style as the mining scene: dark background, white monospace text, black stroke
  - Stays fixed to screen coordinates (setScrollFactor 0) so it follows the viewport
  - Does not interfere with build mode ghost preview — build mode takes priority and the tooltip is suppressed
  - Works on any tile of a multi-tile room (2×2 rooms show the same tooltip on all 4 cells)
  - Helps players quickly identify rooms without clicking, especially useful before learning the color/icon mapping
- Status: ✅ Pushed. Commit: `d7578f6`

## 2026-05-11 — Compact Inventory Hotbar
- **QoL/UI:** Replaced the cluttered `Inventory: ...` text line in infoText with a compact visual inventory hotbar at the bottom-left (x=10, y=655)
  - Small 18×18 colored squares matching each item's tile color (copper = orange, iron = silver, gems = respective colors)
  - 2-letter uppercase abbreviation below each square (CU, FE, AU, RU, SA, EM, DI, AM, plus rock type abbreviation)
  - White count number to the right of each colored square, with dark stroke for readability
  - Items arranged horizontally with 48px spacing; bar only appears when inventory is non-empty
  - Updates only when inventory actually changes (hash-based diffing) — no per-frame recreation waste
  - Clears the infoText from 3 cluttered lines down to 2 clean lines: controls + status
- Status: ✅ Pushed. Commit: `0917b28`

## 2026-05-11 — Procedural Mining Sound Effects
- **Audio/Game Feel:** Added synthesized mining sounds via Web Audio API (no external assets)
  - Rock/Grass: low filtered noise crunch (~80ms, 500Hz lowpass, tapering amplitude)
  - Metal ores (Cu, Fe, Au): bandpass noise at 1800Hz with sharp Q + descending triangle ping (1200→600Hz)
  - Gems (Ruby, Sapphire, Emerald, Diamond, Amethyst): highpass noise at 2500Hz + bright ascending sine chime (880→1600Hz)
  - Audio context auto-resumes if suspended (browser autoplay policy safe)
  - Tied to every successful mine hit — sound fires before particles so the audio feedback is immediate
  - Very low amplitude (0.06–0.14 gain) so it never dominates; subtle tactile reinforcement
- Status: ✅ Pushed. Commit: TBD

## 2026-05-11 — Rock Type Subtitle + Tile Hover Tooltip
- **QoL/UI:** Added rock type name subtitle under the planet name on the mining screen
  - Shows the current planet's rock type (Basalt, Granite, Obsidian, etc.) in small gray monospace text below the gold planet name
  - Helps players remember which composition they're mining — critical for refinery planning since different rock types yield different ore/gem distributions
  - Updates automatically per planet; hidden if no rock type data is available
- **QoL/UI:** Added tile name tooltip that follows the mouse cursor when hovering over tiles
  - Displays the human-readable tile name (e.g., "Copper Ore", "Ruby", "Bedrock") in a small dark tooltip box
  - Only appears on non-air tiles; hides when cursor moves over empty space
  - Positioned 24px below the cursor so it never covers the tile being inspected
  - Uses `setScrollFactor(0)` and screen coordinates so it stays pinned to the viewport while the camera moves
  - Helps new players learn tile types and helps experienced players confirm what they're about to mine
- Status: ✅ Pushed. Commit: `57d581b`

## 2026-05-11 — Run Statistics Panel
- **QoL/UI:** Added a compact RUN STATS panel in the top-right corner of the mining screen
  - Tracks tiles mined, fuel consumed, and time spent on current planet
  - Updates live — every successful mine increments the counter, every fuel cost adds to the total
  - Time formatted as `Xs` under a minute, `Xm Xs` after that
  - Positioned at x=1100, y=55, right-aligned so it stays tidy in the corner
  - Monospace font with dark stroke for readability against any background
  - Helps players optimize their runs — see exactly how much fuel each dive costs and how long it took
  - Resets automatically on each new planet launch (fresh stats per run)
- Status: ✅ Pushed. Commit: `155cd37`

## 2026-05-11 — Metal Ore Spark Particles
- **QoL/Game Feel:** Added bright metallic spark particles when mining copper, iron, or gold ore tiles
  - 3–5 tiny white/yellow sparks spawn at the mined tile and shoot outward in random directions
  - Very short lifetime (150–250ms) with fast fade — a brief, satisfying flash
  - Layered at depth 6, above regular debris but below gem sparkles
  - Only triggers on metal ores (Cu, Fe, Au) — rock mining is unchanged, gem mining keeps its colored sparkles
  - Creates clear visual hierarchy: rock = debris, metal = sparks + debris, gem = colored sparkles + debris
- Status: ✅ Pushed. Commit: `37789db`

## 2026-05-11 — Ship Scene Ambient Starfield
- **QoL/Atmosphere:** Added a slow-drifting ambient starfield to the ship command screen
  - 50 tiny white particles (0.5–2px) with randomized drift speed (0.05–0.3 px/frame) and subtle vertical sine wobble
  - Alpha breathes gently (0.08 → 0.33) via sine wave so stars twinkle organically
  - Stars wrap from left edge to right edge when they drift off-screen, creating an infinite field
  - `setScrollFactor(0)` so they stay fixed to the viewport — the ship is the frame, not the camera
  - Purely visual, no gameplay impact; turns the previously static black void into a living space backdrop
  - Pairs with the dark UI theme to make ship management feel like you're actually in a spaceship
- Status: ✅ Pushed. Commit: `c9fdf21`

## 2026-05-11 — Rock Tile Color Variation
- **QoL/Visual:** Added deterministic per-tile brightness variation for rock, grass, and bedrock tiles
  - Uses a pseudo-random hash based on tile coordinates so the same tile always renders the same shade
  - ±12% brightness variation — subtle enough to not distract, strong enough to break the flat grid monotony
  - Applies in both `renderWorld()` (batch draw) and `updateTile()` (single-tile redraw after mining)
  - Gem and metal tiles are left untouched — they already have their own visual identity (pulse glow, symbol labels)
  - No gameplay impact; purely visual polish that makes the world feel more organic and less "programmer art"
- Status: ✅ Pushed. Commit: `cb61d56`

## 2026-05-11 — Gem Sparkle Particles
- **QoL/Game Feel:** Added upward-floating sparkle particles when mining gem tiles
  - 4–8 small colored squares spawn at the player's upper body and drift upward in a cone
  - Color matches the gem type (ruby = red, sapphire = blue, etc.)
  - 500–900ms fade with `Sine.easeOut` for a gentle, magical feel
  - Layered at depth 7, above debris but below floating loot text
  - Only triggers on gem tiles — rock/metal mining is unchanged
  - Pairs with existing gem tile pulse glow + floating loot text to make gem finds feel genuinely special
- Status: ✅ Pushed. Commit: `c007bcb`

## 2026-05-10 — Depth Gauge
- **QoL/UI:** Added a vertical depth gauge bar on the left edge of the screen
  - Thin bar (10×280px) at x=16, y=200 with color-coded fill: green (0-20m), yellow (20-80m), orange (80-150m), red (150m+)
  - Fill grows from bottom as player descends, giving instant visual read of how deep they are
  - White tick marker shows exact current depth position on the bar
  - "DEPTH" label fades to 30% opacity when at surface (depth=0), stays fully visible underground
  - No gameplay change — purely informational, replaces the text-only depth readout with something you can read at a glance
- Status: ✅ Pushed. Commit: `75164cf`

## 2026-05-10 — Player Torch / Night Lighting
- **QoL/Atmosphere:** Added a player-carried torch that brightens tiles near the character at night
  - Circular light radius of ~180px (≈5–6 tiles) around the player
  - Brightness boost falls off linearly from center (55% max boost at player's feet → 0% at edge)
  - Applies to both batch tile rendering (`renderWorld`) and single-tile redraws (`updateTile`)
  - Only active when `tileAlpha < 1` (night/dusk), so daytime is unchanged
  - Makes night mining feel intimate and atmospheric — the world is dark, but your immediate workspace is lit
  - Pairs with existing nighttime tile dimming to complete the day/night cycle
- Status: ✅ Pushed. Commit: `c660082`

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

## 2026-05-11 — Depth-Based Sky Darkening
- **QoL/Atmosphere:** Background now darkens progressively as the player descends deeper underground
  - At surface (0m): sky renders at full day/night brightness — unchanged
  - At 100m depth: sky is roughly 50% darker, creating a "shallow cave" feel
  - At 200m+ depth: sky fades to near-black (~8% brightness), making deep mining feel genuinely subterranean
  - Multiplies existing day/n cycle darkness so both depth and time of day stack naturally
  - No gameplay impact — purely atmospheric depth cue that makes the world feel more dimensional
- Status: ✅ Pushed. Commit: `bf20833`
1. **Better UI** - Cleaner inventory display, stats panel, depth colors
2. **More content** - Additional gem types, planet variety
3. **Audio** - Mining sounds, ambient music
4. **Graphics** - Tile sprites instead of colored rectangles
5. **Character sprite** - Replace blue rectangle with animated character
6. **Day/Night impact** - Torch/light system for player
7. **Hazards** - Falling rocks, lava, enemies
8. **Quality of life** - Auto-collect radius, better teleport mechanics

## 2026-05-11 — Run Stats: Live Gem Value Estimate
- **QoL/UI:** Added live gem value estimate to the run stats panel
  - Calculates total sell value of all gems currently in player inventory using existing trade prices
  - Updates in real-time — every gem mined instantly bumps the value counter
  - Helps players evaluate run profitability on the fly for the tight economy design
  - Format: `Value: Xcr` on the fourth line of the run stats panel
  - No new assets, no gameplay changes — purely informational
- Status: ✅ Pushed. Commit: `ff44f29`

## 2026-05-10 — Tile Mine Flash
- **QoL/Game Feel:** Added a bright white flash on tiles when they are mined
  - White rectangle spawns at the tile position with 55% alpha
  - Scales up to 1.25× and fades to zero over 110ms
  - Layered at depth 4, above debris but below floating text
  - Pairs with existing screen shake + debris + recoil to make each mine hit feel more destructive
  - Purely visual — no gameplay or collision changes
- Status: ✅ Pushed. Commit: `acf60da`

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
