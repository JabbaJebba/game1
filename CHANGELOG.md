## 2026-05-13 — Scout Placement: Always Snap to Tile Centers
- **Bugfix/QoL:** Fixed the scout (1×2 chassis) "standing between 2 tiles" issue by removing the `holdingMoveKey` guard from the tile-grid snap logic
  - Previously, the scout only snapped to a tile center when you released all movement keys after landing
  - If you held A/D when landing (or were pressed against a wall), the scout stayed at a non-center x position — `getTileBounds()` then returned 2 horizontal tiles, making down-mining hit 2 tiles instead of 1
  - Now 1-tile characters snap to `tile*32+16` whenever `onGround && |vx| < 5`, regardless of key state
  - 2-tile characters are unaffected — their offset stays `0` and they naturally straddle boundaries
  - Shadow position is now also updated inside the snap block (was previously drifting one frame behind)
- Status: ✅ Pushed. Commit: `TBD`

---
