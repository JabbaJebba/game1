# Boss's Terraria-like Game

A 2D browser game inspired by Terraria, built with Phaser 3.

## How to Play

- **A / D or Arrow Keys** — Move left/right
- **Space** — Jump
- **Left Click** — Mine blocks
- **Right Click** — Place blocks
- **Mouse** — Aim cursor

## Deployment to GitHub Pages

1. Create a new GitHub repository
2. Upload all files from this folder to the repo
3. Go to **Settings → Pages**
4. Under "Source", select **Deploy from a branch**
5. Select **main** branch and **/(root)** folder
6. Click Save
7. Your game will be live at `https://yourusername.github.io/your-repo-name/`

## Controls

- Mining reach: 120 pixels
- Placing: Right-click on empty space
- Day/night cycle happens automatically

## Tech Stack

- Phaser 3 (via CDN)
- Vanilla JavaScript
- No build step required

## File Structure

```
├── index.html      # Game entry point
├── js/
│   ├── world.js    # World generation (noise-based terrain, caves, trees)
│   ├── player.js   # Player movement, mining, inventory
│   └── game.js     # Main game scene, rendering, day/night cycle
└── README.md       # This file
```
