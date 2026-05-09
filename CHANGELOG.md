# Game Improvement Log

## 2026-05-10 — Debris Particles
- Added debris particles when mining tiles (4-6 colored squares fly outward and fade)
- Particles match the tile color (rock, metal, gem)
- 350-600ms lifetime with random trajectory and rotation
- Status: Mining now has tactile visual feedback. Next: save/load system, sound, or auto-collect radius.

## 2026-05-09 — First Automated Update
- Added screen shake on mining (60ms, intensity 0.004)
- Added mine indicator flash animation (scale up/down on hit)
- Status: Mining now has visual feedback. Next: debris particles, sound effects, or save system.

## TODO Queue (prioritized)
1. **Debris particles** - Small colored squares fly out when mining
2. **Save/Load system** - localStorage persistence for ship, inventory, credits
3. **Better UI** - Cleaner inventory display, stats panel
4. **More content** - Additional gem types, planet variety
5. **Audio** - Mining sounds, ambient music
6. **Graphics** - Tile sprites instead of colored rectangles
7. **Character sprite** - Replace blue rectangle with animated character
8. **Day/Night impact** - Visibility reduction at night, torch system
9. **Hazards** - Falling rocks, lava, enemies
10. **Quality of life** - Auto-collect radius, better teleport mechanics

## Completed
- [x] Restore original physics-based movement
- [x] Fix mining to use actual tile bounds
- [x] Fix fuel costs (liter-based system)
- [x] Add screen shake on mining
- [x] Add mine indicator flash
