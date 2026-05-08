class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.planet = data.planet || { name: 'Asteroid Alpha', depth: 300, size: 200, richness: 0.8 };
        this.shipGrid = data.shipGrid || [];
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel || 20000;
        this.shipFuelCapacity = data.shipFuelCapacity || 20000;
    }

    create() {
        this.worldWidth = this.planet.size;
        this.worldHeight = this.planet.depth;
        this.tileSize = 32;

        this.world = new WorldGenerator(this.worldWidth, this.worldHeight);

        this.tileGraphics = this.add.graphics();

        this.tileColors = {
            [this.world.TILE_AIR]: null,
            [this.world.TILE_DIRT]: 0x8B4513,
            [this.world.TILE_GRASS]: 0x228B22,
            [this.world.TILE_STONE]: 0x808080,
            [this.world.TILE_COPPER]: 0xB87333,
            [this.world.TILE_BEDROCK]: 0x333333,
            [this.world.TILE_IRON]: 0xA0A0A0,
            [this.world.TILE_GOLD]: 0xFFD700,
            [this.world.TILE_RUBY]: 0xDC143C,
            [this.world.TILE_SAPPHIRE]: 0x0F52BA,
            [this.world.TILE_EMERALD]: 0x50C878,
            [this.world.TILE_DIAMOND]: 0xB9F2FF,
            [this.world.TILE_AMETHYST]: 0x9966CC,
        };

        this.metalSymbols = {
            [this.world.TILE_COPPER]: 'Cu',
            [this.world.TILE_IRON]: 'Fe',
            [this.world.TILE_GOLD]: 'Au',
        };

        this.labelCache = new Map();
        this.drawnMetals = new Set();

        this.renderWorld();

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

        let spawnX = Math.floor(this.worldWidth / 2);
        let spawnY = this.world.getSurfaceY(spawnX) - 5;

        let fuelForRun = Math.min(5000, this.shipFuel);
        this.player = new Player(this, spawnX, spawnY, { fuel: fuelForRun });

        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.worldWidth * this.tileSize, this.worldHeight * this.tileSize);
        this.cameras.main.setBackgroundColor('#87CEEB');

        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 0) {}
        });

        this.cursorHighlight = this.add.rectangle(0, 0, 32, 32);
        this.cursorHighlight.setStrokeStyle(2, 0xffffff, 0.8);
        this.cursorHighlight.setFillStyle(0xffffff, 0.1);

        this.infoText = this.add.text(10, 10, '', {
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.infoText.setScrollFactor(0);

        // TELEPORT button
        this.teleportBtn = this.add.text(1100, 20, 'TELEPORT', {
            fontSize: '20px',
            fill: '#FF4444',
            stroke: '#000000',
            strokeThickness: 3,
            backgroundColor: '#330000',
            padding: { x: 10, y: 5 }
        }).setScrollFactor(0).setInteractive();

        this.teleportBtn.on('pointerdown', () => this.teleportBack());
        this.teleportBtn.on('pointerover', () => this.teleportBtn.setStyle({ fill: '#FF6666' }));
        this.teleportBtn.on('pointerout', () => this.teleportBtn.setStyle({ fill: '#FF4444' }));

        // Planet name display
        this.planetText = this.add.text(640, 20, this.planet.name.toUpperCase(), {
            fontSize: '18px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0);

        this.timeOfDay = 0;
        this.stars = this.add.graphics();
        this.generateStars();
    }

    teleportBack() {
        // Merge player inventory into ship inventory
        for (const [tile, count] of Object.entries(this.player.inventory)) {
            if (!this.shipInventory[tile]) this.shipInventory[tile] = 0;
            this.shipInventory[tile] += count;
        }

        // Return to ship scene
        this.scene.start('ShipScene', {
            shipGrid: this.shipGrid,
            shipInventory: this.shipInventory,
            credits: this.credits,
            shipFuel: this.shipFuel,
            shipFuelCapacity: this.shipFuelCapacity,
        });
    }

    update(time, delta) {
        this.player.update(delta);
        this.renderWorld();

        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);
        this.cursorHighlight.x = tileX * 32 + 16;
        this.cursorHighlight.y = tileY * 32 + 16;

        this.timeOfDay += delta * 0.0001;
        const dayProgress = (Math.sin(this.timeOfDay) + 1) / 2;
        const darkness = 1 - dayProgress * 0.7;

        const r = Math.floor(135 * darkness);
        const g = Math.floor(206 * darkness);
        const b = Math.floor(235 * darkness);
        this.cameras.main.setBackgroundColor(`rgb(${r},${g},${b})`);

        this.stars.setAlpha(1 - dayProgress);

        const inventoryText = Object.entries(this.player.inventory)
            .map(([k, v]) => `${this.getTileName(parseInt(k))}: ${v}`)
            .join(' | ');

        this.infoText.setText(
            `Controls: Arrows=Move, Space/W=Jump, A=Mine Left, D=Mine Right, S=Mine Down\n` +
            `Time: ${dayProgress > 0.3 ? 'Day' : 'Night'} | ` +
            `Pos: ${Math.floor(this.player.x)}, ${Math.floor(this.player.y)}\n` +
            `Fuel: ${this.player.fuel}/${this.player.maxFuel} | ` +
            `Inventory: ${inventoryText || 'Empty'}`
        );
    }

    getVisibleTileRange() {
        const cam = this.cameras.main;
        const margin = 2;
        const startX = Math.floor((cam.scrollX - margin * this.tileSize) / this.tileSize);
        const endX = Math.ceil((cam.scrollX + cam.width + margin * this.tileSize) / this.tileSize);
        const startY = Math.floor((cam.scrollY - margin * this.tileSize) / this.tileSize);
        const endY = Math.ceil((cam.scrollY + cam.height + margin * this.tileSize) / this.tileSize);

        return {
            startX: Math.max(0, startX),
            endX: Math.min(this.worldWidth, endX),
            startY: Math.max(0, startY),
            endY: Math.min(this.worldHeight, endY)
        };
    }

    renderWorld() {
        this.tileGraphics.clear();

        const { startX, endX, startY, endY } = this.getVisibleTileRange();
        const visibleMetals = new Set();

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tile = this.world.getTile(x, y);
                if (tile !== this.world.TILE_AIR) {
                    const color = this.tileColors[tile] || 0xffffff;
                    const px = x * 32;
                    const py = y * 32;
                    this.tileGraphics.fillStyle(color, 1);
                    this.tileGraphics.fillRect(px, py, 32, 32);
                    this.tileGraphics.lineStyle(1, 0x000000, 0.1);
                    this.tileGraphics.strokeRect(px, py, 32, 32);

                    if (this.metalSymbols[tile]) {
                        const key = `${x},${y}`;
                        visibleMetals.add(key);

                        let label = this.labelCache.get(key);
                        if (!label) {
                            label = this.add.text(px + 16, py + 16, this.metalSymbols[tile], {
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                fill: '#000000',
                                stroke: '#ffffff',
                                strokeThickness: 2,
                            }).setOrigin(0.5);
                            this.labelCache.set(key, label);
                        }
                        label.setVisible(true);
                        label.setPosition(px + 16, py + 16);
                    }
                }
            }
        }

        for (const [key, label] of this.labelCache) {
            if (!visibleMetals.has(key)) {
                label.setVisible(false);
            }
        }
    }

    updateTile(x, y) {
        const tile = this.world.getTile(x, y);
        const px = x * 32;
        const py = y * 32;

        this.tileGraphics.fillStyle(0x87CEEB, 1);
        this.tileGraphics.fillRect(px, py, 32, 32);

        if (tile !== this.world.TILE_AIR) {
            const color = this.tileColors[tile] || 0xffffff;
            this.tileGraphics.fillStyle(color, 1);
            this.tileGraphics.fillRect(px, py, 32, 32);
            this.tileGraphics.lineStyle(1, 0x000000, 0.1);
            this.tileGraphics.strokeRect(px, py, 32, 32);

            if (this.metalSymbols[tile]) {
                const key = `${x},${y}`;
                let label = this.labelCache.get(key);
                if (!label) {
                    label = this.add.text(px + 16, py + 16, this.metalSymbols[tile], {
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fill: '#000000',
                        stroke: '#ffffff',
                        strokeThickness: 2,
                    }).setOrigin(0.5);
                    this.labelCache.set(key, label);
                }
                label.setVisible(true);
                label.setPosition(px + 16, py + 16);
            } else {
                const key = `${x},${y}`;
                const label = this.labelCache.get(key);
                if (label) label.setVisible(false);
            }
        } else {
            const key = `${x},${y}`;
            const label = this.labelCache.get(key);
            if (label) label.setVisible(false);
        }
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
            const y = Math.random() * this.worldHeight * this.tileSize * 0.18;
            const size = Math.random() * 2 + 1;
            this.stars.fillCircle(x, y, size);
        }
    }
}

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
    scene: [ShipScene, GalaxyScene, GameScene],
    pixelArt: true,
    roundPixels: true
};

const game = new Phaser.Game(config);

if (typeof window !== 'undefined') {
    window.GameScene = GameScene;
    window.game = game;
}
