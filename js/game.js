class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        console.log('[GameScene] init() called with data:', data);
        this.planet = data.planet || { name: 'Asteroid Alpha', depth: 300, size: 200, richness: 0.8 };
        this.shipGrid = data.shipGrid || [];
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel !== undefined ? data.shipFuel : 100;
        this.shipFuelCapacity = data.shipFuelCapacity !== undefined ? data.shipFuelCapacity : 100;
        this.rockType = data.rockType || { name: 'Stone' };
        this.rockCompositions = data.rockCompositions || {};
        this.techState = data.techState || { fuelTankLevel: 0, efficiencyLevel: 0, droneRangeLevel: 0, miningSpeedLevel: 0 };
        this.processingQueues = data.processingQueues || {};
        this.mechState = data.mechState || {
            unlockedChassis: ['scout'],
            activeChassis: 'scout',
            modules: [],
            science: {},
            visitedPlanets: {},
        };
        console.log('[GameScene] planet:', this.planet.name, 'size:', this.planet.size, 'depth:', this.planet.depth);
        console.log('[GameScene] rockType:', this.rockType.name);
        console.log('[GameScene] mechState.activeChassis:', this.mechState.activeChassis);
        // Backfill missing keys for old saves
        if (!this.mechState.modules) this.mechState.modules = [];
        if (!this.mechState.science) this.mechState.science = {};
        if (!this.mechState.visitedPlanets) this.mechState.visitedPlanets = {};
        if (!this.mechState.unlockedChassis) this.mechState.unlockedChassis = ['scout'];
        if (this.mechState.fuelCatalystUnlocked === undefined) this.mechState.fuelCatalystUnlocked = false;
        if (this.mechState.deepScanUnlocked === undefined) this.mechState.deepScanUnlocked = false;
        this.launchTime = data.launchTime || null;
    }

    create() {
        try {
            console.log('[GameScene] create() started');
        
        this.worldWidth = this.planet.size;
        this.worldHeight = this.planet.depth;
        this.tileSize = 32;
        
        if (!this.worldWidth || !this.worldHeight) {
            console.error('[GameScene] Invalid world dimensions:', this.worldWidth, this.worldHeight, this.planet);
            this.worldWidth = this.worldWidth || 200;
            this.worldHeight = this.worldHeight || 300;
        }
        
        console.log('[GameScene] World dimensions:', this.worldWidth, 'x', this.worldHeight);
        
        try {
            this.world = new WorldGenerator(this.worldWidth, this.worldHeight, this.rockType);
            console.log('[GameScene] WorldGenerator created');
        } catch (e) {
            console.error('[GameScene] WorldGenerator failed:', e);
            throw e;
        }

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
            [this.world.TILE_TITANIUM]: 0x778899,
            [this.world.TILE_PLATINUM]: 0xE5E4E2,
            [this.world.TILE_TOPAZ]: 0xFFAA00,
        };

        this.metalSymbols = {
            [this.world.TILE_COPPER]: 'Cu',
            [this.world.TILE_IRON]: 'Fe',
            [this.world.TILE_GOLD]: 'Au',
            [this.world.TILE_TITANIUM]: 'Ti',
            [this.world.TILE_PLATINUM]: 'Pt',
        };

        this.labelCache = new Map();
        this.drawnMetals = new Set();

        // Initialize tileAlpha before first renderWorld call to prevent NaN alpha values
        this.tileAlpha = 1;
        this.currentTime = 0;

        this.renderWorld();
        console.log('[GameScene] renderWorld() completed');

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
        let spawnY = this.world.getSurfaceY(spawnX);
        if (spawnY === null || spawnY === undefined) {
            console.error('[GameScene] getSurfaceY returned null/undefined for x=', spawnX);
            spawnY = Math.floor(this.worldHeight * 0.2);
        }
        spawnY -= 5;
        console.log('[GameScene] Spawn position:', spawnX, spawnY);

        // ── Mech Configuration ──
        const chassisDefs = {
            scout: { size: '1×2', baseFuel: 15, fuelBurn: 0.030, maxDepth: 180, slots: 2 },
            miner: { size: '2×2', baseFuel: 25, fuelBurn: 0.050, maxDepth: 350, slots: 3 },
            heavy: { size: '2×3', baseFuel: 40, fuelBurn: 0.075, maxDepth: 700, slots: 4 },
        };
        const mech = this.mechState;
        const chassisDef = chassisDefs[mech.activeChassis] || chassisDefs.scout;
        const fuelModBonus = mech.modules.filter(m => m === 'fuel').length * 10;
        const maxPlayerFuel = chassisDef.baseFuel + fuelModBonus;
        let fuelForRun = Math.min(maxPlayerFuel, this.shipFuel);
        this.shipFuel -= fuelForRun; // Deduct from ship tank
        this.speedModCount = mech.modules.filter(m => m === 'speed').length;
        
        console.log('[GameScene] Creating player with fuel:', fuelForRun, 'maxFuel:', maxPlayerFuel, 'chassis:', mech.activeChassis);
        
        this.player = new Player(this, spawnX, spawnY, {
            fuel: fuelForRun,
            efficiencyLevel: this.techState.efficiencyLevel || 0,
            miningSpeedLevel: this.techState.miningSpeedLevel || 0,
            chassis: mech.activeChassis,
            fuelBurn: chassisDef.fuelBurn,
            speedModCount: this.speedModCount,
            fuelCatalystUnlocked: this.mechState.fuelCatalystUnlocked || false,
        });
        console.log('[GameScene] Player created');
        this.maxDepth = chassisDef.maxDepth;
        this.fuelBurnRate = chassisDef.fuelBurn;
        this.droneCount = mech.modules.filter(m => m === 'drone').length;
        this.scannerCount = mech.modules.filter(m => m === 'scanner').length;
        this.scannerPulseTimer = 0;
        this.scannerPulsePhase = 0;
        this.scannerGraphics = this.add.graphics().setDepth(3);
        this.drones = [];

        // ── Science Tracking ──
        this.scienceCollected = false;
        this.scienceMilestones = [30, 60, 100];
        this.scienceAwarded = [];
        this.planetTypeName = this.rockType.name || 'Unknown';
        this.mechState.science[this.planetTypeName] = this.mechState.science[this.planetTypeName] || 0;

        // ── Drone Creation ──
        this.droneSprites = [];
        this.droneTimers = [];
        for (let i = 0; i < this.droneCount; i++) {
            const drone = this.add.rectangle(0, 0, 8, 8, 0x88ccff);
            drone.setStrokeStyle(1, 0xffffff);
            drone.setDepth(5);
            this.droneSprites.push(drone);
            this.droneTimers.push(0);
        }

        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.worldWidth * this.tileSize, this.worldHeight * this.tileSize);

        // Planet atmosphere — each planet has a unique sky tint
        const sc = this.planet.skyColor || 0x87CEEB;
        const sr = (sc >> 16) & 0xFF;
        const sg = (sc >> 8) & 0xFF;
        const sb = sc & 0xFF;
        this.cameras.main.setBackgroundColor(`rgb(${sr},${sg},${sb})`);

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
        this.fuelBarText = this.add.text(barX, barY, `FUEL: ${fuelForRun.toFixed(2)}L / ${maxPlayerFuel.toFixed(2)}L`, {
            fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0);

        this.input.on('pointerdown', (pointer) => {
            if (pointer.button === 0) {}
        });

        this.cursorHighlight = this.add.rectangle(0, 0, 32, 32);
        this.cursorHighlight.setStrokeStyle(2, 0xffffff, 0.8);
        this.cursorHighlight.setFillStyle(0xffffff, 0.1);

        // Tile hover tooltip
        this.tileTooltip = this.add.text(0, 0, '', {
            fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2, backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

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



        // Depth gauge
        this.depthGauge = this.add.graphics().setScrollFactor(0).setDepth(0);
        this.depthGaugeLabel = this.add.text(22, 185, 'DEPTH', {
            fontSize: '10px', fill: '#445566', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5).setScrollFactor(0);
        this.depthGaugeValue = this.add.text(36, 200, '0m', {
            fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1);

        this.timeOfDay = 0;
        this.stars = this.add.graphics();

        // Run statistics — track efficiency of current mining run
        this.runStats = { tilesMined: 0, fuelUsed: 0, startTime: Date.now(), maxDepthReached: 0, depthMilestonesReached: [], scienceGained: 0 };
        this.runStatsText = this.add.text(1100, 55, '', {
            fontSize: '12px', fill: '#aabbcc', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0).setScrollFactor(0);

        // Inventory hotbar — compact visual item display at bottom-left
        this.invBar = this.add.container(10, 655).setScrollFactor(0).setDepth(10);
        this.lastInvHash = '';

        this.gemPrices = {
            'Ruby': 50, 'Sapphire': 75, 'Emerald': 100, 'Diamond': 200, 'Amethyst': 80, 'Topaz': 125,
        };

        // Web Audio synthesizer for procedural sound effects (no external assets)
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.generateStars();

        // Ambient dust particles — tiny motes drifting through the air
        this.ambientDust = [];
        for (let i = 0; i < 35; i++) {
            const dx = Math.random() * this.worldWidth * this.tileSize;
            const dy = Math.random() * this.worldHeight * this.tileSize;
            const size = Math.random() * 1.5 + 0.5;
            const mote = this.add.circle(dx, dy, size, 0xffffff, Math.random() * 0.15 + 0.05);
            mote.setDepth(2);
            mote.driftX = (Math.random() - 0.5) * 0.15;
            mote.driftY = (Math.random() - 0.5) * 0.08;
            mote.phase = Math.random() * Math.PI * 2;
            mote.baseAlpha = Math.random() * 0.15 + 0.05;
            this.ambientDust.push(mote);
        }

        this.cameras.main.fadeIn(150, 0, 0, 0);
        console.log('[GameScene] create() completed successfully');
        } catch (e) {
            console.error('[GameScene] CRASH in create():', e);
            throw e;
        }
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

    playTeleportSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const dur = 0.28;

        // Primary sweep — low to high sine
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(180, now);
        osc1.frequency.exponentialRampToValueAtTime(900, now + dur * 0.7);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.1, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc1.connect(g1);
        g1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + dur);

        // Secondary harmonic sweep
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(360, now);
        osc2.frequency.exponentialRampToValueAtTime(1800, now + dur * 0.7);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.05, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + dur);

        // Brief noise texture for "materialization" grit
        const bufferSize = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nf = ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.setValueAtTime(400, now);
        nf.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.04, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(nf);
        nf.connect(ng);
        ng.connect(ctx.destination);
        noise.start(now);
    }

    showRunSummary() {
        const elapsedMs = Date.now() - this.runStats.startTime;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const runValue = this.runStatsText.text.split('\n').find(l => l.startsWith('Value:'))?.replace('Value: ', '') || '0cr';
        let lines = [
            `⛏  ${this.runStats.tilesMined} tiles mined`,
            `📏  ${this.runStats.maxDepthReached}m max depth`,
            `⛽  ${this.runStats.fuelUsed.toFixed(2)}L fuel consumed`,
        ];
        if (this.runStats.fuelUsed > 0) {
            const efficiency = (this.runStats.tilesMined / this.runStats.fuelUsed).toFixed(1);
            lines.push(`⚡  ${efficiency} tiles/L`);
        }
        if (this.runStats.scienceGained > 0) lines.push(`🔬  +${this.runStats.scienceGained} science`);
        lines.push(`⏱  ${elapsedSec}s on surface`);
        lines.push(`💰  ${runValue} in gems`);

        const panelW = 340;
        const panelH = 32 + lines.length * 26 + 24;
        const cx = 640;
        const cy = 360;

        const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x0c0c18, 0.95).setOrigin(0.5).setScrollFactor(0).setDepth(101);
        bg.setStrokeStyle(2, 0x00d4aa, 0.6);

        const title = this.add.text(cx, cy - panelH / 2 + 28, 'RUN COMPLETE', {
            fontSize: '18px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

        const sep = this.add.graphics().setScrollFactor(0).setDepth(101);
        sep.lineStyle(1, 0x222233, 1);
        sep.lineBetween(cx - panelW / 2 + 20, cy - panelH / 2 + 48, cx + panelW / 2 - 20, cy - panelH / 2 + 48);

        const statsText = this.add.text(cx, cy - panelH / 2 + 60 + (lines.length * 26) / 2 - 13, lines.join('\n'), {
            fontSize: '13px', fill: '#aabbcc', fontFamily: 'monospace', lineSpacing: 8, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

        // Fade in
        [bg, title, statsText].forEach(obj => obj.setAlpha(0));
        this.tweens.add({
            targets: [bg, title, statsText],
            alpha: 1,
            duration: 250,
            ease: 'Power1'
        });

        // Auto-fade out after 2 seconds
        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: [bg, title, statsText, sep],
                alpha: 0,
                duration: 400,
                ease: 'Power1',
                onComplete: () => {
                    bg.destroy();
                    title.destroy();
                    statsText.destroy();
                    sep.destroy();
                }
            });
        });
    }

    teleportBack() {
        this.playTeleportSound();
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
            mechState: this.mechState,
            launchTime: this.launchTime,
        };
        localStorage.setItem('miners_save', JSON.stringify(saveData));

        // Show save confirmation flash
        this.showSaveFlash();

        // Show run summary if the player actually did something
        const elapsedMs = Date.now() - this.runStats.startTime;
        if (this.runStats.tilesMined > 0 || elapsedMs > 5000) {
            this.showRunSummary();
        }

        // Delay so the flash + summary are visible before transition
        this.time.delayedCall(2600, () => {
            this.cameras.main.fadeOut(150, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('ShipScene', {
                    shipGrid: this.shipGrid,
                    shipInventory: this.shipInventory,
                    credits: this.credits,
                    shipFuel: this.shipFuel,
                    shipFuelCapacity: this.shipFuelCapacity,
                    rockCompositions: this.rockCompositions,
                    techState: this.techState,
                    processingQueues: this.processingQueues,
                    mechState: this.mechState,
                    launchTime: this.launchTime,
                });
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

        // Depth milestone notifications — celebrate first-time reaches per run
        [50, 100, 150, 200].forEach(m => {
            if (depth >= m && !this.runStats.depthMilestonesReached.includes(m)) {
                this.runStats.depthMilestonesReached.push(m);
                this.showFloatText(this.player.x, this.player.y - 80, `${m}m`, '#44ddff', '18px');
                this.playDepthMilestoneSound(m);
            }
        });

        this.runStats.maxDepthReached = Math.max(this.runStats.maxDepthReached, depth);

        // Depth-based sky darkening — background fades to near-black as you go deeper underground
        const sc = this.planet.skyColor || 0x87CEEB;
        const baseR = (sc >> 16) & 0xFF;
        const baseG = (sc >> 8) & 0xFF;
        const baseB = sc & 0xFF;
        const depthFactor = Math.min(1, depth / 200);
        const depthMult = 1 - depthFactor * 0.92;
        const r = Math.floor(baseR * darkness * depthMult);
        const g = Math.floor(baseG * darkness * depthMult);
        const b = Math.floor(baseB * darkness * depthMult);
        this.cameras.main.setBackgroundColor(`rgb(${r},${g},${b})`);

        this.stars.setAlpha(1 - dayProgress);

        // Ambient dust — drift, wrap, breathe, dim at night
        this.ambientDust.forEach(mote => {
            mote.x += mote.driftX;
            mote.y += mote.driftY;
            const worldW = this.worldWidth * this.tileSize;
            const worldH = this.worldHeight * this.tileSize;
            if (mote.x < 0) mote.x += worldW;
            if (mote.x > worldW) mote.x -= worldW;
            if (mote.y < 0) mote.y += worldH;
            if (mote.y > worldH) mote.y -= worldH;
            const breathe = Math.sin(time * 0.001 + mote.phase) * 0.5 + 0.5;
            mote.setAlpha(mote.baseAlpha * breathe * (0.4 + 0.6 * dayProgress));
        });

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
        const worldDepthRange = Math.max(1, this.worldHeight - surfaceY);
        const depthPct = Math.min(1, Math.max(0, depth / worldDepthRange));
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
        // Numeric depth readout — follows the marker tick
        this.depthGaugeValue.setPosition(gx + gw + 6, markerY);
        this.depthGaugeValue.setText(`${depth}m`);
        this.depthGaugeValue.setColor(depth < 20 ? '#88ff88' : depth < 80 ? '#ffff44' : depth < 150 ? '#ffaa44' : '#ff4444');
        // Chassis max depth limit marker
        const chassisMaxDepth = this.maxDepth || 9999;
        if (chassisMaxDepth < worldDepthRange) {
            const maxPct = Math.min(1, Math.max(0, chassisMaxDepth / worldDepthRange));
            const maxMarkerY = gy + gh - (gh * maxPct);
            const exceeded = depth > chassisMaxDepth;
            this.depthGauge.lineStyle(2, exceeded ? 0xff4444 : 0xffaa44, exceeded ? 0.9 : 0.6);
            this.depthGauge.lineBetween(gx - 6, maxMarkerY, gx + gw + 6, maxMarkerY);
            this.depthGauge.fillStyle(exceeded ? 0xff4444 : 0xffaa44, exceeded ? 0.9 : 0.6);
            this.depthGauge.fillTriangle(gx - 6, maxMarkerY - 3, gx - 6, maxMarkerY + 3, gx + 2, maxMarkerY);
        }
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

        // ── Drone Update ──
        const droneRange = 2 + (this.techState.droneRangeLevel || 0);
        this.droneSprites.forEach((drone, i) => {
            const angle = time * 0.002 + (i * Math.PI * 2 / this.droneSprites.length);
            const orbitRadius = 50 + Math.sin(time * 0.001 + i) * 10;
            drone.x = this.player.x + Math.cos(angle) * orbitRadius;
            drone.y = this.player.y - this.player.height / 2 + Math.sin(angle) * orbitRadius * 0.5;

            // Drone mining logic — circular radius around the player's bottom-center
            // (where the mining tool is), consistent for all chassis sizes
            if (this.droneTimers[i] <= 0 && this.player.fuel > 2.0) {
                const centerX = this.player.x / 32;
                const { bottom } = this.player.getTileBounds();
                const centerY = bottom + 0.5;
                let mined = false;
                const rSq = droneRange * droneRange;
                for (let ty = Math.floor(centerY - droneRange); ty <= Math.ceil(centerY + droneRange) && !mined; ty++) {
                    for (let tx = Math.floor(centerX - droneRange); tx <= Math.ceil(centerX + droneRange) && !mined; tx++) {
                        if (tx < 0 || tx >= this.worldWidth || ty < 0 || ty >= this.worldHeight) continue;
                        const dx = (tx + 0.5) - centerX;
                        const dy = (ty + 0.5) - centerY;
                        if (dx * dx + dy * dy > rSq) continue;
                        const tile = this.world.getTile(tx, ty);
                        // Target gems and metal ores only, skip rock and air
                        if (tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON ||
                            tile === this.world.TILE_GOLD || tile === this.world.TILE_TITANIUM || tile === this.world.TILE_PLATINUM || tile === this.world.TILE_RUBY ||
                            tile === this.world.TILE_SAPPHIRE || tile === this.world.TILE_EMERALD ||
                            tile === this.world.TILE_DIAMOND || tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ) {
                            // Mine it
                            this.world.setTile(tx, ty, this.world.TILE_AIR);
                            this.updateTile(tx, ty);
                            this.player.inventory[tile] = (this.player.inventory[tile] || 0) + 1;
                            // Cost: 30ml per drone mine
                            const droneCost = 0.030;
                            this.player.fuel -= droneCost;
                            this.runStats.fuelUsed += droneCost;
                            // Visual feedback — same full suite as player mining
                            this.spawnMineFlash(tx, ty);
                            this.spawnDebris(tx, ty, this.tileColors[tile]);
                            this.playMineSound(tile);
                            const itemName = this.getTileName(tile);
                            const itemColor = this.player.getItemColor(tile);
                            this.showFloatText(tx * 32 + 16, ty * 32 - 8, `+1 ${itemName}`, itemColor);
                            const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                                          tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                                          tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ;
                            if (isGem) this.spawnGemSparkle(tx * 32 + 16, ty * 32 + 16, this.tileColors[tile]);
                            const isMetal = tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON || tile === this.world.TILE_GOLD || tile === this.world.TILE_TITANIUM || tile === this.world.TILE_PLATINUM;
                            if (isMetal) this.spawnMetalSparks(tx, ty);
                            mined = true;
                        }
                    }
                }
                this.droneTimers[i] = mined ? 120 : 60; // 2s or 1s cooldown
            } else {
                this.droneTimers[i] -= delta;
            }
        });

        // ── Scanner Pulse ──
        if (this.scannerCount > 0) {
            this.scannerPulseTimer -= delta;
            if (this.scannerPulseTimer <= 0) {
                this.scannerPulseTimer = 3000; // pulse every 3s
                this.scannerPulsePhase = 1.0;
                this.playScannerPulseSound();
            }
            this.scannerPulsePhase = Math.max(0, this.scannerPulsePhase - delta / 1000);
        }

        // ── Science Collection ──
        const currentDepth = Math.max(0, Math.floor(this.player.y / 32) - (this.world.getSurfaceY(Math.floor(this.player.x / 32)) || 0));
        this.scienceMilestones.forEach(milestone => {
            if (currentDepth >= milestone && !this.scienceAwarded.includes(milestone)) {
                this.scienceAwarded.push(milestone);
                const scienceGain = milestone === 30 ? 5 : milestone === 60 ? 8 : 12;
                this.mechState.science[this.planetTypeName] = (this.mechState.science[this.planetTypeName] || 0) + scienceGain;
                this.runStats.scienceGained += scienceGain;
                // Visual notification
                const note = this.add.text(this.player.x, this.player.y - 60, `+${scienceGain} SCIENCE`, {
                    fontSize: '14px', fill: '#00d4aa', fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2
                }).setOrigin(0.5);
                this.tweens.add({ targets: note, y: note.y - 40, alpha: 0, duration: 1500, ease: 'Power1', onComplete: () => note.destroy() });
                // Science collection flash — brief teal glow around player
                const sciFlash = this.add.rectangle(this.player.x, this.player.y - this.player.height / 2, this.player.width + 20, this.player.height + 20, 0x00d4aa, 0.25);
                sciFlash.setDepth(10);
                this.tweens.add({ targets: sciFlash, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 500, ease: 'Power1', onComplete: () => sciFlash.destroy() });
                // Subtle screen shake for discovery feel
                this.cameras.main.shake(90, 0.003);
                // Audio notification — bright discovery chime
                this.playScienceSound();
            }
        });

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
        const chassisLabel = (this.mechState.activeChassis || 'scout').toUpperCase();
        let runStatsLines = [
            `RUN STATS — ${chassisLabel}`,
            `Mined: ${this.runStats.tilesMined}`,
            `Fuel: ${this.runStats.fuelUsed.toFixed(2)}L`,
        ];
        if (this.runStats.fuelUsed > 0) {
            const liveEfficiency = (this.runStats.tilesMined / this.runStats.fuelUsed).toFixed(1);
            runStatsLines.push(`Eff: ${liveEfficiency} tiles/L`);
        }
        runStatsLines.push(`Value: ${runValue}cr`);
        if (this.runStats.scienceGained > 0) {
            runStatsLines.push(`Science: +${this.runStats.scienceGained}`);
        }
        runStatsLines.push(`Max: ${this.runStats.maxDepthReached}m`);
        runStatsLines.push(`Time: ${timeStr}`);
        this.runStatsText.setText(runStatsLines.join('\n'));
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
        const entries = Object.entries(this.player.inventory)
            .filter(([k, v]) => v > 0)
            .sort((a, b) => {
                const priority = {
                    [this.world.TILE_DIAMOND]: 500, [this.world.TILE_EMERALD]: 400,
                    [this.world.TILE_TOPAZ]: 350, [this.world.TILE_AMETHYST]: 300, [this.world.TILE_RUBY]: 200,
                    [this.world.TILE_SAPPHIRE]: 100, [this.world.TILE_GOLD]: 50,
                    [this.world.TILE_TITANIUM]: 40, [this.world.TILE_PLATINUM]: 45, [this.world.TILE_IRON]: 30, [this.world.TILE_COPPER]: 20,
                    [this.world.TILE_ROCK]: 1, [this.world.TILE_GRASS]: 0,
                };
                return (priority[parseInt(b[0])] || 0) - (priority[parseInt(a[0])] || 0);
            });
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
        const camWidth = cam.width || 1280;
        const camHeight = cam.height || 720;
        const startX = Math.floor((cam.scrollX - margin * this.tileSize) / this.tileSize);
        const endX = Math.ceil((cam.scrollX + camWidth + margin * this.tileSize) / this.tileSize);
        const startY = Math.floor((cam.scrollY - margin * this.tileSize) / this.tileSize);
        const endY = Math.ceil((cam.scrollY + camHeight + margin * this.tileSize) / this.tileSize);

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
                                  tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ;
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

        // Scanner pulse — highlight ore/gem tiles within range
        this.scannerGraphics.clear();
        if (this.scannerPulsePhase > 0 && this.scannerCount > 0) {
            const scanRange = 4 + this.scannerCount * 3 + (this.mechState.deepScanUnlocked ? 3 : 0);
            const ptx = Math.floor(this.player.x / 32);
            const pty = Math.floor((this.player.y - this.player.height / 2) / 32);
            const scanAlpha = this.scannerPulsePhase * 0.5;
            for (let sx = Math.max(startX, ptx - scanRange); sx <= Math.min(endX - 1, ptx + scanRange); sx++) {
                for (let sy = Math.max(startY, pty - scanRange); sy <= Math.min(endY - 1, pty + scanRange); sy++) {
                    const tile = this.world.getTile(sx, sy);
                    const isOre = tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON ||
                                  tile === this.world.TILE_GOLD || tile === this.world.TILE_TITANIUM ||
                                  tile === this.world.TILE_PLATINUM;
                    const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                                  tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                                  tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ;
                    if (isOre || isGem) {
                        const scColor = this.tileColors[tile] || 0xffffff;
                        this.scannerGraphics.lineStyle(2, scColor, scanAlpha);
                        this.scannerGraphics.strokeRect(sx * 32, sy * 32, 32, 32);
                    }
                }
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
                          tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ;
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

    spawnDebris(tileX, tileY, color, swingDirX = 0, swingDirY = 0, playerVx = 0, playerVy = 0) {
        const px = tileX * 32 + 16;
        const py = tileY * 32 + 16;
        const count = 4 + Math.floor(Math.random() * 3);

        // Base angle opposite to swing direction — debris flies away from the drill
        let baseAngle;
        if (swingDirX !== 0 || swingDirY !== 0) {
            baseAngle = Math.atan2(-swingDirY, -swingDirX);
        } else {
            baseAngle = Math.random() * Math.PI * 2;
        }

        for (let i = 0; i < count; i++) {
            const size = 3 + Math.floor(Math.random() * 4);
            const particle = this.add.rectangle(px, py, size, size, color);
            particle.setDepth(5);

            // Directional spread: ±60° around base angle
            const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.7;
            const speed = 60 + Math.random() * 100;
            const vx = Math.cos(angle) * speed + playerVx * 0.35;
            const vy = Math.sin(angle) * speed - 50 + playerVy * 0.35;

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

    spawnSpeedLines(x, y, facingRight) {
        // Thin horizontal streaks when running fast — sense of momentum
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const w = 6 + Math.random() * 14;
            const h = 1 + Math.random() * 2;
            const drift = facingRight ? -1 : 1;
            const py = y + (Math.random() - 0.5) * 24;
            const px = x + drift * (18 + Math.random() * 12);
            const particle = this.add.rectangle(px, py, w, h, 0xffffff);
            particle.setDepth(1);
            particle.setAlpha(0.18 + Math.random() * 0.12);
            this.tweens.add({
                targets: particle,
                x: px + drift * (25 + Math.random() * 20),
                alpha: 0,
                scaleX: 0.1,
                duration: 100 + Math.random() * 80,
                ease: 'Power1',
                onComplete: () => particle.destroy()
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

    showFloatText(x, y, text, color = '#ffffff', fontSize = '14px') {
        const label = this.add.text(x, y, text, {
            fontSize, fill: color, stroke: '#000000', strokeThickness: 2, fontFamily: 'monospace'
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

    playJumpSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const dur = 0.12;

        // Quick springy "whoosh" — light, upward, energetic
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + dur * 0.4);
        osc.frequency.exponentialRampToValueAtTime(180, now + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
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
                      tile === this.world.TILE_AMETHYST || tile === this.world.TILE_TOPAZ;
        const isMetal = tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON || tile === this.world.TILE_GOLD || tile === this.world.TILE_TITANIUM || tile === this.world.TILE_PLATINUM;
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

    playStreakSound(streak) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const base = streak === 10 ? 523 : streak === 25 ? 659 : 880;

        // Ascending major triad — bright and victorious
        [0, 0.08, 0.16].forEach((delay, i) => {
            const freq = base * (i === 0 ? 1 : i === 1 ? 1.25 : 1.5);
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + delay);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.07, now + delay);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.18);
        });

        // Shimmer harmonic on top
        const shimmer = ctx.createOscillator();
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(base * 2, now + 0.12);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0.03, now + 0.12);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        shimmer.connect(sg);
        sg.connect(ctx.destination);
        shimmer.start(now + 0.12);
        shimmer.stop(now + 0.28);
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
            [this.world.TILE_TITANIUM]: 'Titanium Ore',
            [this.world.TILE_PLATINUM]: 'Platinum Ore',
            [this.world.TILE_TOPAZ]: 'Topaz',
        };
        return names[tile] || 'Unknown';
    }

    playScienceSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Primary: bright ascending sine — discovery feel
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.06, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(g1);
        g1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        // Secondary: higher harmonic for shimmer
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(784, now + 0.04);
        osc2.frequency.exponentialRampToValueAtTime(1319, now + 0.14);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.04, now + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.20);
    }

    playScannerPulseSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const dur = 0.12;

        // Quick ascending chirp — "ping" of discovery
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + dur * 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur);

        // Subtle harmonic echo
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200, now + 0.04);
        osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.02, now + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.12);
    }

    playDepthMilestoneSound(depth) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const base = 350 + (depth / 200) * 500; // 350Hz at 50m, 850Hz at 200m

        // Ascending sweep — brighter for deeper milestones
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.14);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.20);

        // Higher harmonic for shimmer
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(base * 2, now + 0.04);
        osc2.frequency.exponentialRampToValueAtTime(base * 3, now + 0.16);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.03, now + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.24);
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
