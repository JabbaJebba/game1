## 2026-05-12 — Sell Celebration: Coin Sound + Credit Float Text
- **Audio/Game Feel:** Added a satisfying procedural coin sound when selling gems at the trade terminal
  - Two quick ascending sine pings: 880→1200Hz, then 1200→1600Hz, ~80ms each
  - Classic register "cha-ching" feel — bright, celebratory, low amplitude (0.06–0.08)
  - Fires on every successful sale alongside the existing credit update
  - Uses existing Web Audio infrastructure; auto-resumes suspended context (browser-safe)
- **QoL/UI:** Added floating "+Xcr" gold text that appears above the credits counter when selling
  - Text drifts upward 30px and fades over 900ms — same pattern as mining loot text
  - Gold color (`#c9a84c`) with black stroke for readability against the dark UI
  - Creates a satisfying sell feedback loop: mining has loot text, selling has profit text
  - Zero gameplay changes, zero new assets, zero save changes
- Status: ✅ Pushed. Commit: `TBD`

## 2026-05-12 — Mining Streak Milestones
- **QoL/Game Feel:** Added satisfying milestone celebrations for consecutive mining streaks
  - When the player reaches streak counts of 10, 25, or 50, a special celebration triggers
  - Extra screen shake (90ms/140ms/220ms at increasing intensity) — stronger than normal mining shake
  - Streak text briefly scales to 1.6× then bounces back with `Back.easeOut` tween for a juicy pop
  - Gold/orange gem sparkles spawn above the player for visual flair
  - Milestones only fire when the streak text is already showing (streak > 1), keeping the HUD clean
  - Celebration is layered on top of existing streak system — colors, size growth, and fade behavior are unchanged
  - Rewards players who find a mining rhythm and makes long streaks feel genuinely satisfying
  - Zero gameplay changes, zero new assets, zero save changes
- Status: ✅ Pushed. Commit: `59c6553`

## 2026-05-12 — Walking Bob Animation
- **QoL/Game Feel:** Added a subtle walk bob to the player character when moving on the ground
  - Body and eyes gently bob up and down based on horizontal position (`sin(x * 0.35) * 2.5px`)
  - Tied to distance traveled, not time — bob syncs naturally with step rhythm regardless of speed
  - Only activates when on ground and moving faster than 20 px/s; idle characters keep their existing breathing animation
  - Applies to body sprite, both eyes, and both pupils — the whole character bobs together
  - Shadow stays pinned to the ground (no bob) so it creates a clean "character moving over fixed shadow" effect
  - Zero gameplay changes: logical position (`this.x`/`this.y`) is untouched, collision and snapping are unaffected
  - Pairs with existing walk dust, speed lines, and idle breathing to make movement feel genuinely alive
- Status: ✅ Pushed. Commit: `fe06c2b`

## 2026-05-12 — Science Collection Sound
- **Audio/Game Feel:** Added a bright discovery chime when collecting science at depth milestones
  - Two ascending sine waves: primary 523Hz → 880Hz, secondary 784Hz → 1319Hz
  - Very low amplitude (0.06/0.04 gain) so it never becomes annoying during repeated deep runs
  - Fires alongside the existing floating "+X SCIENCE" text at 30m/60m/100m milestones
  - Completes the science feedback chain: visual notification + audio cue = milestone feels like a genuine achievement
  - Uses existing Web Audio infrastructure; auto-resumes suspended context (browser-safe)
  - Zero gameplay changes, zero visual changes, zero new assets
- Status: ✅ Pushed. Commit: `cb5ee28`

## 2026-05-12 — Jump Takeoff Sound
- **Audio/Game Feel:** Added a quick springy "whoosh" sound when the player jumps
  - Sine wave sweep: 320Hz → 580Hz → 180Hz over ~120ms — light, upward, energetic feel
  - Very low amplitude (0.06 gain) so it never grates during repeated platforming
  - Fires alongside existing `spawnJumpDust()` on both normal jumps and buffered jumps
  - Completes the jump feedback chain: takeoff dust + sound → fall trail → landing dust + sound + shake + squash
  - Uses existing Web Audio infrastructure; auto-resumes suspended context (browser-safe)
  - Zero gameplay changes, zero visual changes, zero new assets
- Status: ✅ Pushed. Commit: `0247c66`

## 2026-05-12 — Teleport Warp Sound
- **Audio/Game Feel:** Added a synthesized warp sound when teleporting back to the ship
  - Primary sine sweep: 180Hz → 900Hz over ~200ms — classic "beam me up" rising pitch
  - Secondary harmonic at double frequency for richness and sci-fi sheen
  - Brief bandpass-filtered noise burst (400Hz → 2000Hz) for materialization grit
  - Total duration ~280ms, very low amplitude (0.05–0.1 gain) so it never dominates
  - Fires at the start of `teleportBack()` — the moment you press T or click TELEPORT
  - Uses existing Web Audio infrastructure; auto-resumes suspended context (browser-safe)
  - Fills the last remaining audio gap: mining, landing, and denial sounds were all present, but teleport was completely silent
  - Zero gameplay changes, zero visual changes, zero new assets
- Status: ✅ Pushed. Commit: `a80e958`

## 2026-05-12 — Galaxy Science Indicators
- **QoL/UI:** Added per-planet science tracking display to the galaxy map
  - When selecting a planet, the info panel now shows `Science: X 🔬` if science has been collected from that planet's rock type
  - Planets with collected science get a blue (`0x44aaff`) selection ring instead of the default teal — at-a-glance visual distinction between "researched" and "new" destinations
  - Uses existing `mechState.science[rockType]` data — zero new data structures or save changes
  - Helps players avoid revisiting planet types they've already maxed out science from, making galaxy navigation more strategic
  - Science line only appears when >0 science has been collected; panel stays clean for unexplored planet types
  - Fills a genuine UI gap: science was tracked in ship scene but invisible when choosing your next mining destination
- Status: ✅ Pushed. Commit: `c5290a5`

## 2026-05-12 — Inventory Hotbar Value Sorting
- **QoL/UI:** Inventory hotbar now sorts items by value, with the most valuable resources always appearing leftmost
  - Gems appear first (Diamond → Emerald → Amethyst → Ruby → Sapphire), followed by metals (Gold → Iron → Copper), then rock
  - Previously items appeared in insertion order (first-mined first), pushing valuable gems far to the right where they could go off-screen
  - Zero visual changes to the bar itself — same colored squares, counts, and abbreviations; only the order changes
  - Sorting is recomputed every time the inventory hash changes, so newly mined gems instantly jump to the front
  - Helps players monitor their most valuable loot at a glance during deep mining runs
- Status: ✅ Pushed. Commit: `9cbf3ae`

## 2026-05-12 — Science Tracking in Run Stats
- **QoL/UI:** Added live science tracking to the run stats panel
  - `scienceGained` counter tracks total science collected during the current mining run
  - Counter increments at each depth milestone (30m/60m/100m) alongside the floating "+X SCIENCE" text
  - Displays as `Science: +X` on its own line in the run stats panel (top-right corner)
  - Line only appears when science has been collected this run — panel stays compact when science is at zero
  - Uses existing run stats infrastructure; zero new data structures or save changes
  - Pairs with the existing floating science notifications to make research progression feel more tangible and trackable
- Status: ✅ Pushed. Commit: `c0cb8e4`

## 2026-05-12 — Planet Atmosphere Colors
- **QoL/Atmosphere:** Each planet now has a unique sky/atmosphere color that tints the mining scene background
  - Asteroid Alpha: cool pale blue-gray (`0x8899aa`) — familiar starter sky with a colder asteroid feel
  - Asteroid Beta: warm pale gray (`0xbbccdd`) — dusty, larger body atmosphere
  - Planet Gamma: muted alien green (`0x99cc99`) — living-world atmospheric tint
  - Planet Delta: purple haze (`0xbb99cc`) — dense, exotic core world
  - Moon Epsilon: pale lunar gray (`0xccccdd`) — crisp, airless moonlight
  - Gas Giant Ring: amber dust (`0xddbb99`) — ancient debris field glow
  - Sky color is passed from `GalaxyScene` planet definitions via `skyColor` property
  - In `GameScene`, the base RGB is extracted from `this.planet.skyColor` (fallback to classic `#87CEEB` blue)
  - Depth-darkening and day/night cycle still apply on top — atmosphere tints get darker at night and deeper underground just like before
  - No gameplay changes, no save changes, no new assets — purely atmospheric identity per planet
- Status: ✅ Pushed. Commit: `e27acde`

## 2026-05-12 — Mining Preview Fuel Cost Tooltip
- **QoL/UI:** Added projected fuel cost display to the mining target preview
  - When holding A/S/D, the preview now shows `−XML` (e.g. `−150ml`) above the first target tile
  - Cost is calculated live from the actual tiles in the sweep: scans each target tile, skips air/bedrock, sums the per-tile fuel cost
  - Heavy mech mining down (2 tiles × 75ml) shows `−150ml`; Scout mining left (2 tiles × 30ml) shows `−60ml`
  - Text color matches the preview outline (orange when on cooldown, green when ready) with the same alpha
  - Only appears when there are mineable tiles with non-zero cost; hidden for empty swings or when no mine key is held
  - Helps players budget fuel in the tight economy — you see the cost before committing the swing
  - Zero gameplay changes — purely informational, no new assets, minimal performance impact
- Status: ✅ Pushed. Commit: `292f961`

## 2026-05-12 — Run Stats Chassis Label
- **QoL/UI:** Added active chassis name to the run stats panel header
  - The first line now reads `RUN STATS — SCOUT` / `RUN STATS — MINER` / `RUN STATS — HEAVY`
  - Uses the existing `mechState.activeChassis` value — zero new data structures or save changes
  - Uppercase formatting for consistency with the rest of the HUD
  - Fills a genuine UI gap: chassis body color was visible but the name was never shown during a mining run
  - Zero gameplay changes, zero new assets, zero performance impact
- Status: ✅ Pushed. Commit: `374da33`

## 2026-05-12 — Galaxy Planet Selection Ring
- **QoL/UI:** Added a visual selection ring around the currently selected planet in the galaxy map
  - Teal (`0x00d4aa`) dashed-style ellipse at 90×90px, positioned around the chosen planet when clicked
  - Gentle pulsing animation: scales 1.0 → 1.15 and alpha 0.6 → 0.2 over 900ms, looping infinitely with `Sine.easeInOut`
  - Appears only after a planet is selected; hidden initially
  - Planet objects are now stored in `this.planetObjects` array so the ring can lookup position by planet reference
  - Pairs with the existing hover scale effect to give the galaxy map clear visual state: idle → hover (scale up) → selected (persistent ring)
  - Purely visual — no gameplay, no data changes, no scene transition changes
- Status: ✅ Pushed. Commit: `d062ae8`

## 2026-05-12 — Chassis Max Depth Gauge Marker
- **QoL/UI:** Added a visual max-depth limit marker to the depth gauge
  - Shows the operational depth limit of the current mech chassis as an orange tick mark on the depth gauge
  - Positioned at `chassisMaxDepth / worldDepthRange` — a percentage marker, not an absolute block
  - Small triangle arrow pointing right at the marker line for visibility
  - When the player exceeds their chassis limit, the marker turns red and brightens — clear "you're past the safe zone" signal
  - Only appears when the chassis limit is shallower than the world bottom (relevant for Scout/Miner; Heavy usually reaches bedrock)
  - Zero gameplay enforcement — purely informational; the mech doesn't stop working, you just know you're outside design specs
  - Renamed local `maxDepth` variable to `worldDepthRange` to avoid shadowing the chassis property
- Status: ✅ Pushed. Commit: `8906e42`

## 2026-05-12 — Scene Transition Fades
- **QoL/Polish:** Added smooth camera fade transitions between all scenes
  - **Fade in:** Every scene (Ship, Galaxy, Game) now fades in from black over 150ms when entering
  - **Fade out:** Every scene transition now fades to black over 150ms before switching
  - Covers all 4 transition paths: Ship→Galaxy (mech config launch), Galaxy→Ship (back button), Galaxy→Game (planet launch), Game→Ship (teleport back)
  - Teleport back preserves its existing 400ms save-flash delay — the fade begins after the flash is visible, then transitions
  - Uses Phaser's built-in `cameras.main.fadeIn/fadeOut` with `camerafadeoutcomplete` event — zero custom animation code
  - Purely visual polish — no gameplay, collision, or timing changes; scenes remain functionally identical
  - Makes the game feel significantly more cohesive and professional by eliminating jarring instant cuts
- Status: ✅ Pushed. Commit: `b9d8d9f`

## 2026-05-12 — Ship Scene Science Counter
- **QoL/UI:** Added a live science total display to the ship command status bar
  - Positioned between fuel (left) and credits (right) at the top of the ship screen
  - Sums all per-planet-type science collected in `mechState.science` into a single readable number
  - Cyan/teal (`#00d4aa`) color with 🔬 icon for clear visual distinction from fuel (orange) and credits (gold)
  - Updates in real-time via `updateUI()` — refreshes whenever any ship action triggers a UI refresh
  - Fills a genuine UI gap: science was being collected during runs with floating "+X SCIENCE" text but had no persistent visibility in the ship scene
  - Zero gameplay changes — purely informational, no new assets, zero performance impact
- Status: ✅ Pushed. Commit: `3b0eaa8`

## 2026-05-12 — Player Ground Shadow
- **QoL/Visual:** Added a subtle elliptical shadow beneath the player character to ground them in the world
  - Shadow is a dark ellipse (`0x000000`, 22% alpha) sized to ~80% of character width
  - Stays pinned to the ground at the player's feet while walking/standing
  - When airborne, shadow shrinks in scale, fades in alpha, and drops slightly below — creating a sense of height
  - `airFactor` scales from 1.0 (ground) down to ~0.35 at high jumps, making the shadow respond to vertical distance
  - Follows mining recoil so it stays synced with body kickback
  - Set to depth 0 so it renders behind tiles and the player sprite, avoiding visual clutter
  - Purely visual — no gameplay, collision, or movement changes
- Status: ✅ Pushed. Commit: `dbcb9ea`

## 2026-05-12 — Depth Milestone Notifications
- **QoL/Game Feel:** Added floating text notifications when reaching depth milestones for the first time in a run
  - Milestones: 50m, 100m, 150m, 200m — each triggers once per mining run
  - Cyan (`#44ddff`) text at 18px font pops up above the player, larger than standard loot text for emphasis
  - Tracked in `runStats.depthMilestonesReached` so re-crossing a depth doesn't re-trigger
  - Uses existing `showFloatText()` with optional fontSize parameter (added for this feature)
  - Purely visual — no gameplay, scoring, or reward mechanics; just celebrates deep diving
  - Pairs with existing depth gauge and run stats max-depth tracker to make exploration feel progressive
- Status: ✅ Pushed. Commit: `d6cd5db`

## 2026-05-12 — Landing Squash-and-Stretch
- **QoL/Game Feel:** Added sprite squash-and-stretch animation on landing to sell the physical impact
  - Squash amount scales with impact velocity: gentle hops barely compress, hard falls noticeably squash
  - Formula: `squash = min(0.3, max(0, (impactVy - 150) / 1200))` — starts at ~150 px/s, caps at 0.3× compression
  - Horizontal stretch paired with vertical squash (scaleX = 1 + squash×0.5) preserves perceived volume
  - Uses `Back.easeOut` tween so the sprite bounces back with a slight overshoot — springy, physical feel
  - Duration scales with impact too: 100ms for tiny hops, up to ~200ms for heavy falls
  - Placed right after landing dust and before hard-landing shake/sound — completes the feedback chain
  - Zero gameplay changes, zero collision changes, purely visual animation on the existing body sprite
- Status: ✅ Pushed. Commit: `2fac621`

## 2026-05-12 — Directional Debris + Velocity Inheritance
- **QoL/Game Feel:** Mining debris now flies in a coherent direction — opposite to the swing, with player velocity inheritance
  - Left mine → debris bursts rightward; right mine → debris bursts leftward; down mine → debris sprays upward
  - Debris cone is ±60° around the opposite direction, keeping randomness but adding physical coherence
  - Inherits 35% of player velocity (`vx`, `vy`) — running fast and mining makes debris carry your momentum
  - Drones keep fully random debris (no swing direction), which feels correct for floating autonomous tools
  - Same particle count, lifetime, and fade — purely a trajectory change, zero performance impact
  - Pairs with existing screen shake + recoil + tile flash to make each mine hit feel physically grounded
- Status: ✅ Pushed. Commit: `8a698c2`

## 2026-05-12 — Ambient Dust Particles
- **QoL/Atmosphere:** Added 35 tiny drifting dust motes to the mining scene
  - Motes are 0.5–2px white circles with very low alpha (5%–20%), creating subtle atmospheric depth
  - Each mote drifts slowly in its own random direction (horizontal bias), wrapping around world edges for an infinite field
  - Alpha breathes via sine wave so motes softly appear and disappear — never static
  - Automatically dim at night (scaled by dayProgress) so they complement the torch lighting rather than cluttering it
  - Positioned at depth 2, behind tiles but above the background, so they feel embedded in the world
  - Pairs with existing starfield, torch system, and day/night cycle to make the world feel genuinely atmospheric
- Status: ✅ Pushed. Commit: `89cc2ab`

## 2026-05-11 — Chassis-Colored Player Sprites
- **QoL/Visual:** Each mech chassis now has a distinct body color so your loadout choice is visible during gameplay
  - **Scout:** Blue (`0x3498db`) — the original color, stays familiar for new players
  - **Miner:** Green (`0x27ae60`) — earthy, industrial feel fitting for a dedicated mining rig
  - **Heavy:** Red (`0xe74c3c`) — aggressive, heavy-machinery vibe for the bulky chassis
  - Eyes remain white/black across all chassis so facial expressions (blink, look direction) stay readable
  - Purely visual — no gameplay, collision, or movement changes
- Status: ✅ Pushed. Commit: `533127c`

## 2026-05-11 — Drone Mining: Full Feedback Suite
- **QoL/Game Feel:** Drone mining now has the same visual and audio feedback as player mining
  - **Fixed:** `spawnMineFlash` was receiving pixel coordinates instead of tile coordinates — the flash now appears at the correct tile position
  - **Floating loot text:** `+1 Ruby`, `+1 Copper Ore`, etc. appears above tiles mined by drones, color-coded by resource type
  - **Gem sparkles:** Drones trigger upward-floating colored sparkles when mining gem tiles
  - **Metal sparks:** Bright white flash particles spawn on copper/iron/gold hits from drones
  - **Procedural sound:** Mining sounds now fire for drone hits — gems chime, metals ping, everything crunches
  - Zero gameplay changes — purely making drones feel as satisfying as swinging the drill yourself
- Status: ✅ Pushed. Commit: `9e44e23`

## 2026-05-11 — Mining Streak Counter
- **QoL/Game Feel:** Added a combo streak counter that appears above the player when mining tiles in rapid succession
  - Counts consecutive mine swings within 800ms of each other — each swing increments by 1 regardless of how many tiles are mined
  - Displays as `×2`, `×3`, etc. above the character, growing slightly larger and shifting from white → yellow → orange → red as the streak builds
  - Text scales up to 1.5× at high streaks and gets a warm color shift to reward rapid drilling rhythm
  - Fades out 150ms before the 900ms streak window expires, giving a soft disappearance
  - Streak follows the player's position every frame so it stays anchored above the character
  - Purely visual — no gameplay, score, or reward mechanics attached; just satisfaction feedback
  - Pairs with existing cooldown ring, recoil, screen shake, and debris to make rapid mining feel genuinely rhythmic
- Status: ✅ Pushed. Commit: `d7e7b5d`

# Game Improvement Log

## 2026-05-11 — Horizontal Speed Lines
- **QoL/Game Feel:** Added thin white speed lines when running fast horizontally
  - Triggers when |vx| > 120 (about 2/3 of max run speed) and player is on ground
  - 2–3 thin horizontal streaks spawn behind the player, drifting opposite to facing direction
  - Very short lifetime (100–180ms) with fast fade — subtle but adds a sense of momentum
  - Spawn interval: 50–110ms while running fast, stops immediately when slowing or leaving ground
  - Pairs with existing walk dust (at feet, gray) — speed lines are at body level and purely horizontal
  - Purely visual: no gameplay, collision, or movement changes
  - Follows the same pattern as the existing fall trail system for consistency
- Status: ✅ Pushed. Commit: `31bc748`

## 2026-05-11 — Run Stats: Max Depth Reached Tracker
- **QoL/UI:** Added live max depth tracking to the run stats panel
  - Tracks the deepest point the player has reached during the current mining run
  - Updates in real-time — every frame checks current depth and updates the max if deeper
  - Displayed as `Max: Xm` on the fourth line of the run stats panel (top-right corner)
  - Helps players gauge their exploration progress and compare runs across different planets/chassis
  - Pairs nicely with the existing depth gauge — gauge shows current depth, run stats show the record for this session
  - Zero gameplay changes, zero new assets, zero performance impact
- Status: ✅ Pushed. Commit: `af623d8`

## 2026-05-11 — Mech Configuration System + Drones + Science
- **Major Feature:** Complete mech outfit system replacing direct galaxy launch
  - Clicking LAUNCH now opens a **Mech Configuration** modal before departure
  - Three chassis types with distinct stats:
    - **Scout** (1×2 tiles, 15L fuel, 180m max depth, 2 module slots) — free starting chassis
    - **Miner** (2×2 tiles, 25L fuel, 350m max depth, 3 slots) — unlock for 500cr
    - **Heavy** (2×3 tiles, 40L fuel, 700m max depth, 4 slots) — unlock for 500cr
  - **Modules:** Fuel Tank (+10L capacity) and Drone (auto-mines within 5 tiles, 30ml/cost)
  - Loadout persists across sessions via `mechState` in save data
- **Drones:** Small orbiting robots that automatically mine gems and ore near the player
  - One drone per module slot consumed; invincible (no health system)
  - Respects 2L fuel reserve — stops mining if player fuel drops too low
  - Visual: light blue 8×8 squares orbiting the player at varying radius
- **Science Collection:** Per-planet-type research at depth milestones
  - 30m = 5 science, 60m = 8 science, 100m = 12 science
  - Each planet/asteroid type tracks its own science pool
  - Visual notification: floating green "+X SCIENCE" text when milestones reached
- **Chassis affects gameplay:** Player sprite size, fuel burn rate (30/50/75ml per tile), and max depth all change based on selected chassis
- **Files touched:** `js/ship.js` (modal UI + launch flow), `js/game.js` (drones + science), `js/player.js` (chassis size + fuel burn), `js/galaxy.js` (pass mechState)
- Status: ✅ Pushed. Commit: `4c23bb9`

## 2026-05-11 — Hard Landing Impact Feedback
- **QoL/Game Feel:** Added camera shake + procedural thud sound when landing from a high fall
  - Triggers when impact velocity exceeds 450 px/s — falls from ~4+ tiles or fast drops
  - Camera shake: 80ms duration at 0.005 intensity — a brief, weighty jolt that sells the impact
  - Procedural sound: lowpass-filtered noise at 120–400Hz, scaled by fall intensity (0.08–0.18s duration)
  - Volume scales with fall speed: gentle drops barely whisper, long falls thud satisfyingly
  - Pairs with existing landing dust particles to complete the jump arc: takeoff dust → fall trail → impact shake/thud/dust
  - Captures `impactVy` before velocity is zeroed so the true fall speed is preserved
  - Zero gameplay changes, zero new assets, zero collision changes
- Status: ✅ Pushed. Commit: `842be25`

## 2026-05-11 — Teleport Hotkey (T)
- **QoL/UI:** Added keyboard shortcut 'T' to teleport back to ship from the mining scene
  - Press 'T' at any time during a mining run to instantly return to the ship — no mouse required
  - Useful when deep underground and needing a quick escape, or when fuel runs low
  - Updated on-screen controls hint to include `T=Teleport` so players discover it naturally
  - Uses `Phaser.Input.Keyboard.JustDown` so it only fires once per keypress, never accidental double-teleports
  - Zero gameplay changes — purely a convenience shortcut for an existing function
- Status: ✅ Pushed. Commit: `f1a0b19`

## 2026-05-11 — Low-Fuel Teleport Button Urgency Pulse
- **QoL/UI:** Added a pulsing red glow behind the TELEPORT button when player fuel drops below 5L
  - Red rectangle (142×40px) positioned behind the button with subtle pulsing alpha (0→25% fill, 0→70% stroke)
  - Activates at <5L fuel — a clear visual nudge before the critical <2L fuel-bar pulse kicks in
  - Sine-wave timing (speed=0.008) for a smooth, organic heartbeat feel — not jarring
  - Completely invisible when fuel is healthy; only appears when it matters
  - Helps prevent players from getting stranded deep underground in the tight fuel economy
  - Zero gameplay changes, zero new assets, zero performance impact
- Status: ✅ Pushed. Commit: `c993abe`

## 2026-05-11 — Denial Sound Effects
- **Audio/Game Feel:** Added distinct audio feedback for failed mining attempts using the existing Web Audio synthesizer
  - **Bedrock hit:** Sharp metallic clink (triangle wave, 180→80Hz, 80ms) — hitting impenetrable rock feels like striking metal, not muffled silence
  - **No fuel:** Dull low thud (lowpass noise at 120Hz, 100ms) — the drill is dead, machinery won't spin up
  - Both sounds are very low amplitude (0.08–0.1 gain) so they never grate; they provide clear audio contrast to successful mining sounds
  - Fires alongside existing visual feedback ("NO FUEL" floating text) so players get both channels of failure communication
  - Zero gameplay changes, zero new assets, zero performance impact
- Status: ✅ Pushed. Commit: `c52ff5e`

## 2026-05-11 — Save Confirmation Flash
- **QoL/UI:** Added a "💾 SAVED" flash notification that appears whenever the game auto-saves
  - Shows in bottom-right corner of both mining scene and ship scene
  - Green monospace text with black stroke for readability against any background
  - Fades in (200ms), holds (800ms), fades out (200ms) — total ~1.2s visible
  - On teleport back from mining: flash appears, then 400ms delay before scene transition so players actually see it
  - On ship save (launch, build, buy fuel, sell gems, queue jobs): flash appears immediately
  - Gives players confidence that their progress is safely persisted — no more silent saves
  - Zero gameplay changes, zero new assets, zero performance impact
- Status: ✅ Pushed. Commit: `154d5c6`

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
- Status: ✅ Pushed. Mining now has tactile visual feedback. Next: debris particles, sound effects, or save system.

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
- [x] Teleport hotkey — press T to instantly teleport back to ship from mining scene
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
