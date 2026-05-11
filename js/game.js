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
        this.processingQueues = data.processingQueues || {};
        this.launchTime = data.launchTime || null;
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
            teleport: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
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

        // Low-fuel urgency pulse behind teleport button
        this.teleportBtnPulse = this.add.rectangle(1100, 20, 142, 40, 0xff0000, 0).setScrollFactor(0);
        this.teleportBtnPulse.setStrokeStyle(0);
        this.teleportBtn.setDepth(1);

        // Planet name display
        this.planetText = this.add.text(640, 20, this.planet.name.toUpperCase(), {
            fontSize: '18px',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0);

        // Rock type subtitle
        this.rockText = this.add.text(640, 42, this.planet.rockType?.name || '', {
            fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 1
        }).setOrigin(0.5).setScrollFactor(0);

        // Tile hover tooltip
        this.tileTooltip = this.add.text(0, 0, '', {
            fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2, backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

        // Depth gauge
        this.depthGauge = this.add.graphics().setScrollFactor(0).setDepth(0);
        this.depthGaugeLabel = this.add.text(22, 185, 'DEPTH', {
            fontSize: '10px', fill: '#445566', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5).setScrollFactor(0);

        this.timeOfDay = 0;
        this.stars = this.add.graphics();

        // Run statistics — track efficiency of current mining run
        this.runStats = { tilesMined: 0, fuelUsed: 0, startTime: Date.now() };
        this.runStatsText = this.add.text(1100, 55, '', {
            fontSize: '12px', fill: '#aabbcc', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0);

        // Inventory hotbar — compact visual item display at bottom-left
        this.invBar = this.add.container(10, 655).setScrollFactor(0).setDepth(10);
        this.lastInvHash = '';

        this.gemPrices = {
            'Ruby': 50, 'Sapphire': 75, 'Emerald': 100, 'Diamond': 200, 'Amethyst': 80,
        };

        // Web Audio synthesizer for procedural sound effects (no external assets)
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.generateStars();
    }

    showSaveFlash() {
        const flash = this.add.text(1220, 690, '\uD83D\uDCBE SAVED', {
            fontSize: '11px', fill: '#44aa66', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);
        flash.setAlpha(0);
        this.tweens.add({
            targets: flash,
            alpha: { from: 0, to: 1 },
            duration: 200,
            ease: 'Power1',
            yoyo: true,
            hold: 800,
            onComplete: () => flash.destroy()
        });
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
            processingQueues: this.processingQueues,
            launchTime: this.launchTime,
        };
        localStorage.setItem('miners_save', JSON.stringify(saveData));

        // Show save confirmation flash
        this.showSaveFlash();

        // Brief delay so the flash is visible before transition
        this.time.delayedCall(400, () => {
            // Return to ship scene
            this.scene.start('ShipScene', {
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
                rockCompositions: this.rockCompositions,
                techState: this.techState,
                processingQueues: this.processingQueues,
                launchTime: this.launchTime,
            });
        });
    }

    update(time, delta) {
        this.currentTime = time;
        this.player.update(delta);
        this.renderWorld();

        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);
        this.cursorHighlight.x = tileX * 32 + 16;
        this.cursorHighlight.y = tileY * 32 + 16;

        // Tile hover tooltip
        const hoverTile = this.world.getTile(tileX, tileY);
        if (hoverTile !== this.world.TILE_AIR) {
            this.tileTooltip.setText(this.getTileName(hoverTile));
            this.tileTooltip.setPosition(pointer.x, pointer.y + 24);
            this.tileTooltip.setVisible(true);
        } else {
            this.tileTooltip.setVisible(false);
        }

        // Teleport hotkey
        if (Phaser.Input.Keyboard.JustDown(this.keys.teleport)) {
            this.teleportBack();
        }

        this.timeOfDay += delta * 0.0001;
        const dayProgress = (Math.sin(this.timeOfDay) + 1) / 2;
        const darkness = 1 - dayProgress * 0.7;
        this.tileAlpha = 0.6 + dayProgress * 0.4; // tiles dim at night (0.6→1.0)

        const inventoryText = Object.entries(this.player.inventory)
            .map(([k, v]) => `${this.getTileName(parseInt(k))}: ${v}`)
            .join(' | ');

        const playerTileX = Math.max(0, Math.min(this.worldWidth - 1, Math.floor(this.player.x / 32)));
        const surfaceY = this.world.getSurfaceY(playerTileX) || 0;
        const depth = Math.max(0, Math.floor(this.player.y / 32) - surfaceY);
        const depthColor = depth < 20 ? '#88ff88' : depth < 80 ? '#ffff44' : depth < 150 ? '#ffaa44' : '#ff4444';

        // Depth-based sky darkening — background fades to near-black as you go deeper underground
        const depthFactor = Math.min(1, depth / 200);
        const depthMult = 1 - depthFactor * 0.92;
        const r = Math.floor(135 * darkness * depthMult);
        const g = Math.floor(206 * darkness * depthMult);
        const b = Math.floor(235 * darkness * depthMult);
        this.cameras.main.setBackgroundColor(`rgb(${r},${g},${b})`);

        this.stars.setAlpha(1 - dayProgress);

        this.infoText.setText(
            `Controls: Arrows=Move, Space/W=Jump, A/D=Mine, S=Mine Down, T=Teleport\n` +
            `Time: ${dayProgress > 0.3 ? 'Day' : 'Night'} | ` +
            `Depth: ${depth}m | ` +
            `Fuel: ${this.player.fuel.toFixed(2)}L / ${this.player.maxFuel.toFixed(2)}L | ` +
            `Cost: ${((this.player.fuelCosts[this.world.TILE_ROCK] || 0.05) * 1000).toFixed(0)}ml`
        );

        // Update inventory hotbar if inventory changed
        const invHash = this.getInventoryHash();
        if (invHash !== this.lastInvHash) {
            this.lastInvHash = invHash;
            this.updateInventoryBar();
        }

        // Depth gauge — vertical bar on left edge showing depth progress
        const maxDepth = Math.max(1, this.worldHeight - surfaceY);
        const depthPct = Math.min(1, Math.max(0, depth / maxDepth));
        this.depthGauge.clear();
        const gx = 16, gy = 200, gh = 280, gw = 10;
        // Background
        this.depthGauge.fillStyle(0x1a1a2e, 0.85);
        this.depthGauge.fillRect(gx, gy, gw, gh);
        this.depthGauge.lineStyle(1, 0x334455, 0.5);
        this.depthGauge.strokeRect(gx, gy, gw, gh);
        // Fill — color by danger level
        const dColor = depth < 20 ? 0x44aa66 : depth < 80 ? 0xccaa44 : depth < 150 ? 0xcc7744 : 0xcc4444;
        this.depthGauge.fillStyle(dColor, 0.9);
        const fillH = Math.max(1, gh * depthPct);
        this.depthGauge.fillRect(gx, gy + gh - fillH, gw, fillH);
        // Current depth marker tick
        const markerY = gy + gh - fillH;
        this.depthGauge.fillStyle(0xffffff, 1);
        this.depthGauge.fillRect(gx - 4, markerY - 1, gw + 8, 3);
        // Hide label when at surface
        this.depthGaugeLabel.setAlpha(depth > 0 ? 1 : 0.3);

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

        // Low-fuel teleport button urgency glow
        if (this.player.fuel < 5) {
            const tpPulse = Math.abs(Math.sin(time * 0.008));
            this.teleportBtnPulse.setFillStyle(0xff2200, tpPulse * 0.25);
            this.teleportBtnPulse.setStrokeStyle(2, 0xff4444, tpPulse * 0.7);
        } else {
            this.teleportBtnPulse.setFillStyle(0xff2200, 0);
            this.teleportBtnPulse.setStrokeStyle(0);
        }

        // Run stats display — compact corner panel tracking session efficiency
        const elapsedMin = Math.floor((Date.now() - this.runStats.startTime) / 60000);
        const elapsedSec = Math.floor((Date.now() - this.runStats.startTime) / 1000) % 60;
        const timeStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`;
        let runValue = 0;
        for (const [tileId, count] of Object.entries(this.player.inventory)) {
            const name = this.getTileName(parseInt(tileId));
            const price = this.gemPrices[name];
            if (price) runValue += count * price;
        }
        this.runStatsText.setText(
            `RUN STATS\n` +
            `Mined: ${this.runStats.tilesMined}\n` +
            `Fuel: ${this.runStats.fuelUsed.toFixed(2)}L\n` +
            `Value: ${runValue}cr\n` +
            `Time: ${timeStr}`
        );
    }

    getInventoryHash() {
        return Object.entries(this.player.inventory)
            .filter(([k, v]) => v > 0)
            .map(([k, v]) => `${k}:${v}`)
            .join('|');
    }

    updateInventoryBar() {
        this.invBar.removeAll(true);
        let x = 0;
        const entries = Object.entries(this.player.inventory).filter(([k, v]) => v > 0);
        if (entries.length === 0) return;
        entries.forEach(([tileId, count]) => {
            const tile = parseInt(tileId);
            const color = this.tileColors[tile] || 0xffffff;
            const name = this.getTileName(tile);
            const short = name.replace(' Ore', '').substring(0, 2).toUpperCase();
            // Item color square
            const bg = this.add.rectangle(x + 8, 6, 18, 18, color).setOrigin(0);
            bg.setStrokeStyle(1, 0x000000, 0.3);
            // Count text to the right of the square
            const countTxt = this.add.text(x + 28, 6, String(count), {
                fontSize: '10px', fill: '#ffffff', fontFamily: 'monospace',
                stroke: '#000000', strokeThickness: 2
            }).setOrigin(0, 0);
            // Abbreviation below the square
            const label = this.add.text(x + 8, 26, short, {
                fontSize: '8px', fill: '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0, 0);
            this.invBar.add([bg, countTxt, label]);
            x += 48;
        });
    }

    getTileVariedColor(baseColor, x, y) {
        // Deterministic pseudo-random brightness variation so the same tile always looks the same
        const hash = ((x * 73856093) ^ (y * 19349663)) & 0xFFFF;
        const variation = 0.88 + (hash / 0xFFFF) * 0.24; // ±12% brightness
        const r = Math.min(255, Math.floor(((baseColor >> 16) & 0xFF) * variation));
        const g = Math.min(255, Math.floor(((baseColor >> 8) & 0xFF) * variation));
        const b = Math.min(255, Math.floor((baseColor & 0xFF) * variation));
        return (r << 16) | (g << 8) | b;
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
                    const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                                  tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                                  tile === this.world.TILE_AMETHYST;
                    const pulse = isGem ? Math.sin((this.currentTime || 0) * 0.003 + x * 0.3 + y * 0.3) * 0.12 + 0.88 : 1;
                    let alpha = isGem ? pulse * this.tileAlpha : this.tileAlpha;
                    // Player torch — brighten tiles near player at night
                    if (this.tileAlpha < 1) {
                        const dx = x * 32 + 16 - this.player.x;
                        const dy = y * 32 + 16 - this.player.y;
                        const distSq = dx * dx + dy * dy;
                        const torchRadius = 180;
                        if (distSq < torchRadius * torchRadius) {
                            const dist = Math.sqrt(distSq);
                            const boost = (1 - dist / torchRadius) * 0.55;
                            alpha = Math.min(1, alpha + boost);
                        }
                    }
                    const isBoring = tile === this.world.TILE_ROCK || tile === this.world.TILE_GRASS || tile === this.world.TILE_BEDROCK;
                    let drawColor = isBoring ? this.getTileVariedColor(color, x, y) : color;
                    this.tileGraphics.fillStyle(drawColor, alpha);
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
            const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                          tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                          tile === this.world.TILE_AMETHYST;
            let alpha = isGem ? (Math.sin((this.currentTime || 0) * 0.003 + x * 0.3 + y * 0.3) * 0.12 + 0.88) * this.tileAlpha : this.tileAlpha;
            // Player torch — brighten tiles near player at night
            if (this.tileAlpha < 1) {
                const dx = x * 32 + 16 - this.player.x;
                const dy = y * 32 + 16 - this.player.y;
                const distSq = dx * dx + dy * dy;
                const torchRadius = 180;
                if (distSq < torchRadius * torchRadius) {
                    const dist = Math.sqrt(distSq);
                    const boost = (1 - dist / torchRadius) * 0.55;
                    alpha = Math.min(1, alpha + boost);
                }
            }
            const isBoring = tile === this.world.TILE_ROCK || tile === this.world.TILE_GRASS || tile === this.world.TILE_BEDROCK;
            let drawColor = isBoring ? this.getTileVariedColor(color, x, y) : color;
            this.tileGraphics.fillStyle(drawColor, alpha);
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

    spawnWalkDust(x, y) {
        const size = 2 + Math.floor(Math.random() * 3);
        const particle = this.add.rectangle(x + (Math.random() - 0.5) * 24, y, size, size, 0xaaaaaa);
        particle.setDepth(3);
        this.tweens.add({
            targets: particle,
            x: particle.x + (Math.random() - 0.5) * 15,
            y: particle.y - 4,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 250 + Math.random() * 150,
            ease: 'Power2',
            onComplete: () => particle.destroy()
        });
    }

    spawnJumpDust(x, y) {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const size = 2 + Math.floor(Math.random() * 3);
            const particle = this.add.rectangle(x + (Math.random() - 0.5) * 48, y, size, size, 0xbbbbbb);
            particle.setDepth(3);
            const angle = Math.random() * Math.PI;
            const speed = 30 + Math.random() * 50;
            this.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * speed * 0.3,
                y: particle.y + Math.sin(angle) * speed * 0.2,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 250 + Math.random() * 150,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }

    spawnMineFlash(tileX, tileY) {
        const px = tileX * 32 + 16;
        const py = tileY * 32 + 16;
        const flash = this.add.rectangle(px, py, 32, 32, 0xffffff);
        flash.setDepth(4);
        flash.setAlpha(0.55);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 110,
            ease: 'Power1',
            onComplete: () => flash.destroy()
        });
    }

    spawnGemSparkle(x, y, color) {
        // Small colored sparkles that float upward and fade — celebration for gem finds
        const count = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const size = 2 + Math.floor(Math.random() * 3);
            const p = this.add.rectangle(x + (Math.random() - 0.5) * 24, y, size, size, color);
            p.setDepth(7);
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
            const speed = 30 + Math.random() * 60;
            this.tweens.add({
                targets: p,
                x: p.x + Math.cos(angle) * speed * 0.5,
                y: p.y - 20 + Math.sin(angle) * speed * 0.4,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 500 + Math.random() * 400,
                ease: 'Sine.easeOut',
                onComplete: () => p.destroy()
            });
        }
    }

    spawnFallTrail(x, y, facingRight) {
        // Thin white streaks that drift opposite to facing direction
        const sizeW = 2 + Math.floor(Math.random() * 3);
        const sizeH = 12 + Math.floor(Math.random() * 8);
        const drift = facingRight ? -1 : 1;
        const particle = this.add.rectangle(x + drift * (18 + Math.random() * 12), y + (Math.random() - 0.5) * 30, sizeW, sizeH, 0xffffff);
        particle.setDepth(2);
        particle.setAlpha(0.35);
        this.tweens.add({
            targets: particle,
            x: particle.x + drift * (20 + Math.random() * 30),
            y: particle.y + 10 + Math.random() * 15,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.5,
            duration: 180 + Math.random() * 120,
            ease: 'Power1',
            onComplete: () => particle.destroy()
        });
    }

    spawnMetalSparks(tileX, tileY) {
        // Bright metallic sparks when mining copper, iron, or gold
        const px = tileX * 32 + 16;
        const py = tileY * 32 + 16;
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const size = 2 + Math.floor(Math.random() * 2);
            const p = this.add.rectangle(px, py, size, size, 0xffffee);
            p.setDepth(6);
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 100;
            this.tweens.add({
                targets: p,
                x: px + Math.cos(angle) * speed * 0.3,
                y: py + Math.sin(angle) * speed * 0.3 - 10,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 150 + Math.random() * 100,
                ease: 'Power1',
                onComplete: () => p.destroy()
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

    playLandingSound(vy) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const intensity = Math.min(1, (vy - 450) / 500);
        const dur = 0.08 + intensity * 0.1;
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * intensity;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120 + intensity * 280;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1 * intensity, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    }

    playDenialSound(reason) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        if (reason === 'bedrock') {
            // Sharp metallic clink — hitting impenetrable rock
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } else {
            // Dull low thud — no fuel, machinery dead
            const bufferSize = Math.floor(ctx.sampleRate * 0.1);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 120;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(now);
        }
    }

    playMineSound(tile) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                      tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                      tile === this.world.TILE_AMETHYST;
        const isMetal = tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON || tile === this.world.TILE_GOLD;
        const dur = isGem ? 0.12 : 0.08;
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // tapering noise
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = isGem ? 'highpass' : (isMetal ? 'bandpass' : 'lowpass');
        filter.frequency.value = isGem ? 2500 : (isMetal ? 1800 : 500);
        filter.Q.value = isMetal ? 6 : 0.7;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(isGem ? 0.14 : (isMetal ? 0.11 : 0.13), ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();

        if (isGem) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.08);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.07, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } else if (isMetal) {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.06, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        }
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
