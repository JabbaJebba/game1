class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.planet = data.planet || { name: 'Asteroid Alpha', depth: 300, size: 200, richness: 0.8 };
        this.shipGrid = data.shipGrid || [];
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel !== undefined ? data.shipFuel : 100;
        this.shipFuelCapacity = data.shipFuelCapacity !== undefined ? data.shipFuelCapacity : 100;
        this.rockType = data.rockType || { name: 'Stone' };
        this.rockCompositions = data.rockCompositions || {};
        this.techState = data.techState || { fuelTankLevel: 0, efficiencyLevel: 0 };
    }

    create() {
        this.worldWidth = this.planet.size;
        this.worldHeight = this.planet.depth;
        this.tileSize = 32;

        this.world = new WorldGenerator(this.worldWidth, this.worldHeight, this.rockType);

        this.tileGraphics = this.add.graphics();

        this.tileColors = {
            [this.world.TILE_AIR]: null,
            [this.world.TILE_GRASS]: 0x228B22,
            [this.world.TILE_ROCK]: 0x808080,
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

        const baseFuel = 25;
        const maxPlayerFuel = baseFuel + (this.techState.fuelTankLevel || 0);
        let fuelForRun = Math.min(maxPlayerFuel, this.shipFuel);
        this.shipFuel -= fuelForRun; // Deduct from ship tank
        this.player = new Player(this, spawnX, spawnY, { fuel: fuelForRun, efficiencyLevel: this.techState.efficiencyLevel || 0 });

        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.worldWidth * this.tileSize, this.worldHeight * this.tileSize);
        this.cameras.main.setBackgroundColor('#87CEEB');

        // FUEL BAR UI
        const barX = 640;
        const barY = 690;
        const barW = 320;
        const barH = 20;
        this.fuelBarX = barX - barW / 2 + 2;
        this.fuelBarMaxW = barW - 4;
        this.fuelBarBg = this.add.rectangle(barX, barY, barW, barH, 0x1a1a2e).setScrollFactor(0);
        this.fuelBarBg.setStrokeStyle(2, 0x444466);
        this.fuelBarFill = this.add.rectangle(this.fuelBarX, barY, this.fuelBarMaxW, barH - 4, 0xFF8C00).setOrigin(0, 0.5).setScrollFactor(0);
        this.fuelBarText = this.add.text(barX, barY, 'FUEL: 25.00L / 25.00L', {
            fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0);

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
        // Merge player inventory into ship inventory (convert tile IDs to names)
        for (const [tileId, count] of Object.entries(this.player.inventory)) {
            const name = this.getTileName(parseInt(tileId));
            if (!this.shipInventory[name]) this.shipInventory[name] = 0;
            this.shipInventory[name] += count;
        }

        // Return unused player fuel to ship tank
        this.shipFuel += this.player.fuel;

        // Store rock composition for this type
        if (this.rockType && this.rockType.name) {
            this.rockCompositions[this.rockType.name] = { ...this.rockType };
        }

        // Auto-save before returning to ship
        const saveData = {
            shipGrid: this.shipGrid,
            shipInventory: this.shipInventory,
            credits: this.credits,
            shipFuel: this.shipFuel,
            shipFuelCapacity: this.shipFuelCapacity,
            rockCompositions: this.rockCompositions,
            techState: this.techState,
        };
        localStorage.setItem('miners_save', JSON.stringify(saveData));

        // Return to ship scene
        this.scene.start('ShipScene', {
            shipGrid: this.shipGrid,
            shipInventory: this.shipInventory,
            credits: this.credits,
            shipFuel: this.shipFuel,
            shipFuelCapacity: this.shipFuelCapacity,
            rockCompositions: this.rockCompositions,
            techState: this.techState,
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

        const playerTileX = Math.max(0, Math.min(this.worldWidth - 1, Math.floor(this.player.x / 32)));
        const surfaceY = this.world.getSurfaceY(playerTileX) || 0;
        const depth = Math.max(0, Math.floor(this.player.y / 32) - surfaceY);
        const depthColor = depth < 20 ? '#88ff88' : depth < 80 ? '#ffff44' : depth < 150 ? '#ffaa44' : '#ff4444';

        this.infoText.setText(
            `Controls: Arrows=Move, Space/W=Jump, A/D=Mine, S=Mine Down\n` +
            `Time: ${dayProgress > 0.3 ? 'Day' : 'Night'} | ` +
            `Depth: ${depth}m | ` +
            `Fuel: ${this.player.fuel.toFixed(2)}L / ${this.player.maxFuel.toFixed(2)}L | ` +
            `Cost: ${((this.player.fuelCosts[this.world.TILE_ROCK] || 0.05) * 1000).toFixed(0)}ml\n` +
            `Inventory: ${inventoryText || 'Empty'}`
        );

        // Update fuel bar
        const fuelPct = Math.max(0, this.player.fuel / this.player.maxFuel);
        this.fuelBarFill.width = this.fuelBarMaxW * fuelPct;
        const fillColor = Phaser.Display.Color.GetColor(255, Math.floor(140 * fuelPct), 0);
        this.fuelBarFill.setFillStyle(fillColor);
        this.fuelBarText.setText(`FUEL: ${this.player.fuel.toFixed(2)}L / ${this.player.maxFuel.toFixed(2)}L`);

        // Critical low fuel warning pulse
        if (this.player.fuel < 2) {
            const pulse = Math.abs(Math.sin(time * 0.01));
            this.fuelBarBg.setStrokeStyle(2 + Math.floor(pulse * 4), 0xff0000, 0.6 + pulse * 0.4);
            this.fuelBarText.setColor('#ff4444');
        } else {
            this.fuelBarBg.setStrokeStyle(2, 0x444466);
            this.fuelBarText.setColor('#ffffff');
        }
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

    spawnDebris(tileX, tileY, color) {
        const px = tileX * 32 + 16;
        const py = tileY * 32 + 16;
        const count = 4 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            const size = 3 + Math.floor(Math.random() * 4);
            const particle = this.add.rectangle(px, py, size, size, color);
            particle.setDepth(5);

            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 100;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 50;

            this.tweens.add({
                targets: particle,
                x: px + vx * 0.5,
                y: py + vy * 0.5,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                angle: Math.random() * 180 - 90,
                duration: 350 + Math.random() * 250,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }

    spawnLandingDust(x, y) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const size = 2 + Math.floor(Math.random() * 3);
            const particle = this.add.rectangle(x + (Math.random() - 0.5) * 40, y, size, size, 0xcccccc);
            particle.setDepth(4);
            const angle = (Math.random() * Math.PI) + Math.PI; // upward arc
            const speed = 40 + Math.random() * 60;
            this.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * speed * 0.4,
                y: particle.y + Math.sin(angle) * speed * 0.3,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: 300 + Math.random() * 200,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }

    showFloatText(x, y, text, color = '#ffffff') {
        const label = this.add.text(x, y, text, {
            fontSize: '14px', fill: color, stroke: '#000000', strokeThickness: 2, fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({
            targets: label,
            y: y - 40,
            alpha: 0,
            duration: 900,
            ease: 'Power1',
            onComplete: () => label.destroy()
        });
    }

    getTileName(tile) {
        const names = {
            [this.world.TILE_AIR]: 'Air',
            [this.world.TILE_GRASS]: 'Grass',
            [this.world.TILE_ROCK]: this.rockType.name || 'Rock',
            [this.world.TILE_COPPER]: 'Copper Ore',
            [this.world.TILE_BEDROCK]: 'Bedrock',
            [this.world.TILE_IRON]: 'Iron Ore',
            [this.world.TILE_GOLD]: 'Gold Ore',
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
