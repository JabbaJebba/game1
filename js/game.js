class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }
    
    create() {
        // World size (in tiles)
        this.worldWidth = 200;
        this.worldHeight = 300;  // 3x deeper
        this.tileSize = 32;
        
        // Generate world
        this.world = new WorldGenerator(this.worldWidth, this.worldHeight);
        
        // Create tile graphics container
        this.tileGraphics = this.add.graphics();
        this.renderWorld();
        
        // Input keys
        this.keys = {
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            mineLeft: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            mineDown: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            mineRight: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        
        // Find spawn point
        let spawnX = Math.floor(this.worldWidth / 2);
        let spawnY = this.world.getSurfaceY(spawnX) - 5;
        
        // Create player
        this.player = new Player(this, spawnX, spawnY);
        
        // Camera follows player
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.worldWidth * this.tileSize, this.worldHeight * this.tileSize);
        
        // Background color
        this.cameras.main.setBackgroundColor('#87CEEB');
        
        // Mouse input
        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 0) {
                // Left click - mine
            } else if (pointer.button === 2) {
                // Right click - place (prevent context menu)
            }
        });
        
        // Prevent context menu on right click
        this.input.mouse.disableContextMenu();
        
        // Cursor highlight
        this.cursorHighlight = this.add.rectangle(0, 0, 32, 32);
        this.cursorHighlight.setStrokeStyle(2, 0xffffff, 0.8);
        this.cursorHighlight.setFillStyle(0xffffff, 0.1);
        
        // UI text
        this.infoText = this.add.text(10, 10, '', {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.infoText.setScrollFactor(0);
        
        // Day/night cycle
        this.timeOfDay = 0;
        
        // Stars (only visible at night)
        this.stars = this.add.graphics();
        this.generateStars();
    }
    
    update(time, delta) {
        // Update player
        this.player.update(delta);
        
        // Update cursor highlight
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);
        this.cursorHighlight.x = tileX * 32 + 16;
        this.cursorHighlight.y = tileY * 32 + 16;
        
        // Day/night cycle
        this.timeOfDay += delta * 0.0001;
        const dayProgress = (Math.sin(this.timeOfDay) + 1) / 2;
        const darkness = 1 - dayProgress * 0.7;
        
        // Update background color based on time
        const r = Math.floor(135 * darkness);
        const g = Math.floor(206 * darkness);
        const b = Math.floor(235 * darkness);
        this.cameras.main.setBackgroundColor(`rgb(${r},${g},${b})`);
        
        // Stars opacity
        this.stars.setAlpha(1 - dayProgress);
        
        // Update UI
        const inventoryText = Object.entries(this.player.inventory)
            .map(([k, v]) => `${this.getTileName(parseInt(k))}: ${v}`)
            .join(' | ');
        
        this.infoText.setText(
            `Controls: Arrows=Move, Space/W=Jump, A=Mine Left, D=Mine Right, S=Mine Down, Right Click=Place\n` +
            `Time: ${dayProgress > 0.3 ? 'Day' : 'Night'} | ` +
            `Pos: ${Math.floor(this.player.x)}, ${Math.floor(this.player.y)}\n` +
            `Inventory: ${inventoryText || 'Empty'}`
        );
    }
    
    renderWorld() {
        this.tileGraphics.clear();
        
        const colors = {
            [this.world.TILE_AIR]: null,
            [this.world.TILE_DIRT]: 0x8B4513,
            [this.world.TILE_GRASS]: 0x228B22,
            [this.world.TILE_STONE]: 0x808080,
            [this.world.TILE_COPPER]: 0xB87333,    // Cu - copper
            [this.world.TILE_BEDROCK]: 0x333333,
            [this.world.TILE_IRON]: 0xC0C0C0,     // Fe - iron gray
            [this.world.TILE_GOLD]: 0xFFD700,    // Au - gold
            [this.world.TILE_RUBY]: 0xDC143C,    // red
            [this.world.TILE_SAPPHIRE]: 0x0F52BA, // blue
            [this.world.TILE_EMERALD]: 0x50C878,  // green
            [this.world.TILE_DIAMOND]: 0xB9F2FF,  // cyan
            [this.world.TILE_AMETHYST]: 0x9966CC, // purple
        };
        
        // Only render visible tiles would be better, but for simplicity render all
        // In a real game, use Phaser's tilemap system
        for (let x = 0; x < this.worldWidth; x++) {
            for (let y = 0; y < this.worldHeight; y++) {
                const tile = this.world.getTile(x, y);
                if (tile !== this.world.TILE_AIR) {
                    const color = colors[tile] || 0xffffff;
                    this.tileGraphics.fillStyle(color, 1);
                    this.tileGraphics.fillRect(x * 32, y * 32, 32, 32);
                    
                    // Add subtle border
                    this.tileGraphics.lineStyle(1, 0x000000, 0.1);
                    this.tileGraphics.strokeRect(x * 32, y * 32, 32, 32);
                }
            }
        }
    }
    
    updateTile(x, y) {
        // Redraw a single tile (for mining/placing)
        // For simplicity, we'll just redraw the area around it
        this.renderWorld();
    }
    
    getTileName(tile) {
        const names = {
            [this.world.TILE_AIR]: 'Air',
            [this.world.TILE_DIRT]: 'Dirt',
            [this.world.TILE_GRASS]: 'Grass',
            [this.world.TILE_STONE]: 'Stone',
            [this.world.TILE_COPPER]: 'Cu',
            [this.world.TILE_BEDROCK]: 'Bedrock',
            [this.world.TILE_IRON]: 'Fe',
            [this.world.TILE_GOLD]: 'Au',
            [this.world.TILE_RUBY]: 'Ruby',
            [this.world.TILE_SAPPHIRE]: 'Sapphire',
            [this.world.TILE_EMERALD]: 'Emerald',
            [this.world.TILE_DIAMOND]: 'Diamond',
            [this.world.TILE_AMETHYST]: 'Amethyst',
        };
        return names[tile] || 'Unknown';
    }
    
    generateStars() {
        this.stars.fillStyle(0xffffff, 1);
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * this.worldWidth * this.tileSize;
            const y = Math.random() * this.worldHeight * this.tileSize * 0.18; // only in sky
            const size = Math.random() * 2 + 1;
            this.stars.fillCircle(x, y, size);
        }
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: GameScene,
    pixelArt: true,
    roundPixels: true
};

// Start the game
const game = new Phaser.Game(config);

// Export for modules if needed
if (typeof window !== 'undefined') {
    window.GameScene = GameScene;
    window.game = game;
}
