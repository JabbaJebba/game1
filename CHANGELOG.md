---

## 2026-05-14 — Deep Scan: Science-Purchased Permanent Upgrade
- **Content Expansion / Science Currency:** Added the first science spending mechanic — **Deep Scan** upgrade in the Mech Workshop
  - Costs **20 science points** (one-time permanent unlock)
  - Effect: **+3 base scanner pulse range** — even without scanner modules equipped, the pulse reaches 7 tiles instead of 4
  - With 4 scanner modules: range goes from 16 tiles → **19 tiles** (massive coverage)
  - Mech Workshop UI: shows total accumulated science, unlock button when affordable, locked message when not, checkmark when active
  - Science total is computed across all visited planet types automatically
- Why: Science had no purpose — it was collected and displayed but never spent. Deep Scan gives players a meaningful decision: hoard science or spend it early for better ore discovery.
- Status: ✅ Pushed. Commit: `TBD`

---

## 2026-05-14 — Speed Booster Mech Module
- **Content Expansion / Mech Configuration:** Added the ⚡ **Speed Booster** as a new mech loadout option in the Mech Workshop
  - Install up to 4 speed modules (one per slot), each increasing movement agility
  - Every speed module grants **+15% movement speed** and **+8% jump power**
    - 1 module: 207 speed / 454 jump (scout feels noticeably quicker)
    - 4 modules: 288 speed / 554 jump (heavy can actually move)
  - Mech Workshop UI: new ⚡ SPEED button alongside FUEL/SCANNER/DRONE; slot boxes show "SPD"
  - Stats line shows `Spd: N` alongside fuel/drone/scan counts
  - Ship status bar shows `⚡×N` next to the active chassis name
  - Player constructor reads `speedModCount` and scales `speed`/`jumpPower` multiplicatively
- Why: Fills the final gap in the mech module system — players can now choose between range (fuel), automation (drones), discovery (scanner), and mobility (speed). Speed modules make the Heavy chassis feel less sluggish and give Scouts a new role as fast prospectors.
- Status: ✅ Pushed. Commit: `18ee123`

---

## 2026-05-13 — Auric Ingot: Premium Platinum-Gold Alloy
- **Content Expansion / Processing Chain:** Added a fourth alloy recipe to the Smelter — the endgame premium alloy that gives Platinum economic value
  - **Auric Ingot** — 1 Platinum Ore + 2 Gold Ore → 1 Auric Ingot (6.0s)
    - Sell price: 180cr
    - Bridges the gap between Starsteel (120cr) and Diamond (200cr)
    - Turns Platinum — previously only useful for tech tree upgrades — into the most profitable smelter product
  - Trade Terminal now lists Auric alongside Bronze, Electrum, and Starsteel under "─ ALLOYS ─"
  - Longest cook time (6.0s) reflects the premium nature and rarity of inputs
- Why: Platinum had no sellable product. Players who push deep for Pt now have a high-value alloy to justify the effort, completing the alloy rarity ladder.
- Status: ✅ Pushed. Commit: `f1b7aba`

---

## 2026-05-13 — Starsteel Alloy
- **Content Expansion / Processing Chain:** Added a third alloy recipe to the Smelter, completing the mid-tier alloy line and giving Titanium economic value beyond tech tree upgrades
  - **Starsteel Ingot** — 2 Titanium Ore + 1 Iron Ore → 1 Starsteel Ingot (5.0s)
    - Sell price: 120cr
    - Bridges the gap between Electrum (90cr) and raw gems like Emerald (100cr)
    - Turns Titanium — previously only useful for tech tree upgrades — into a profitable smelter product
  - Trade Terminal now lists Starsteel alongside Bronze and Electrum under "─ ALLOYS ─"
  - Uses the existing multi-input smelter UI — ingredient counts display automatically
- Why: Titanium had no sellable product. Players who pushed deep for Ti now have a reason to run their smelters for profit, not just progression.
- Status: ✅ Pushed. Commit: `13aca36`

---

## 2026-05-13 — Alloy Smelting: Bronze & Electrum
- **Content Expansion / Processing Chain:** Added two alloy recipes to the Smelter, creating a new economic path for metal ores
  - **Bronze Ingot** — 2 Copper Ore + 1 Iron Ore → 1 Bronze Ingot (2.5s)
    - Sell price: 35cr
    - Turns common surface metals into a sellable product
  - **Electrum Ingot** — 1 Gold Ore + 1 Copper Ore → 1 Electrum Ingot (3.0s)
    - Sell price: 90cr
    - Premium alloy leveraging rare gold veins
  - Trade Terminal now lists alloys alongside gems under a new "─ ALLOYS ─" section
  - Multi-input recipe support already existed in the smelter UI — alloys display their ingredient counts correctly
- Why: Metals had no economic value beyond tech tree upgrades. Alloys give players a reason to stockpile ore and run their smelters for profit, not just progression.
- Status: ✅ Pushed. Commit: `ffee76a`

---

## 2026-05-13 — Platinum (Pt) Ore Tier
- **Content Expansion:** Added **Platinum (Pt)** — 5th metal tier, silvery-white (#E5E4E2), "Pt" symbol on tiles
  - Spawns very deep: only below 260m from surface, in tiny veins (1-2 tiles per vein, max 6 vein size), very rare
  - Requires 4 Platinum Ore → 1 Platinum Ingot in Smelter (5s cook time) — more expensive than Titanium's 3:1
  - Mining Speed tech tree extended to **level 7** — requires 50 Platinum Ingots + 250 Cu + 200 Fe + 150 Au + 100 Ti + 80,000cr
  - Drones, scanner pulse, inventory hotbar, metal sparkles, and all ore-detection systems recognize Platinum
  - Sound effects properly classify Platinum as metal (bandpass filter, metallic triangle oscillator)
- Why: Gives Heavy mech (and deep-pushing Miner/Scout) exclusive endgame content; creates a new resource pyramid peak
- Status: ✅ Pushed. Commit: `2cf865e`

---

## 2026-05-13 — Mech Scanner Module
- **Content Expansion:** Added the 🔍 **Scanner Module** as a new mech loadout option in the Mech Workshop
  - Install up to 4 scanner modules (one per slot), each expanding pulse range
  - Every 3 seconds, a visual pulse sweeps outward from the player, highlighting ore and gem tiles within range with colored outlines
  - Base range: 4 tiles + 3 tiles per scanner module (4 → 7 → 10 → 13 tiles)
  - Colored outlines match the tile's natural color — no new UI chrome, just the world lighting up
  - Fades over 1 second for a smooth "ping" feel
  - Accompanied by a procedural ascending chirp (600Hz → 1200Hz, 120ms) for audio feedback
  - Mech Workshop UI: new 🔍 SCANNER button between FUEL and DRONE; slot boxes show "SCAN"; stats line shows `Scan: N`
  - Ship status bar shows scan count alongside fuel/drone stats
- Why: Fills a gap in the mech module system — drones mine autonomously, fuel extends range, scanner helps FIND the good stuff
- Status: ✅ Pushed. Commit: `25c836e`

---

## 2026-05-13 — Tech Tree Expansion: Mining Speed Branch
- **Tech Tree Expansion:** Added a 4th branch — `miningSpeed` — to the Tech Tree popup
  - 6 levels total, each reducing player mining cooldown by 10ms
  - Base: 180ms → L6: 120ms (33% faster mining at max)
  - Cost progression: credits early → Copper/Iron/Gold/Titanium ingots + credits at higher tiers
    - L1: 1,000cr | L2: 2,500cr | L3: 50 Cu + 5,000cr | L4: 100 Cu + 50 Fe + 10,000cr
    - L5: 150 Cu + 100 Fe + 50 Au + 20,000cr | L6: 200 Cu + 150 Fe + 100 Au + 50 Ti + 40,000cr
  - New tab button "MINING SPD" in the tech tree popup alongside Fuel Tank / Efficiency / Drone Range
  - Bonus label shows `−10ms` per level in the upgrade list
  - Subtitle displays current cooldown: `Mining Speed: 150ms (base 180ms − 30)`
  - Drill room panel now shows Mining Speed Level alongside Fuel Tank / Efficiency / Drone Range
  - Player constructor reads `miningSpeedLevel` and computes `mineCooldown = max(120, 180 - level*10)`
- Why: Boss wanted tech tree expansion; this gives players a direct way to invest resources for faster mining
- Status: ✅ Pushed. Commit: `5ea81af`

---

## 2026-05-13 — Titanium (Ti): Fourth Metal Tier
- **Content Expansion:** Added Titanium (Ti) as a rare, deep-depth metal tier
  - Spawns in small veins (4-8 tiles, thickness 1-2) starting at 75% depth, below Gold
  - Slate gray color (`#778899`) with `Ti` element symbol rendered on ore tiles
  - Health: 120 (harder than Gold's 100) — rewards Heavy mech's deeper reach
  - Fuel cost: same base rate as other ores (scaled by efficiency tech)
  - Processed in Smelter: 3 Titanium Ore → 1 Titanium Ingot (4s, slower than Gold)
  - Extracted from crushed rock via Refinery if the planet's composition supports it
  - Drones will target and mine Titanium ore automatically
  - Inventory sorting priority: 40 (between Gold 50 and Iron 30)
  - Sound profile: bandpass filter at 1800Hz (metallic, like Cu/Fe/Au)
- Why: Gives Heavy mech a reason to exist — only chassis that can reach 700m+ where Ti spawns
- Status: ✅ Pushed. Commit: `398b45e` + fix `85a10c5`

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