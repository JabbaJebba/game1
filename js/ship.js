class ShipScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShipScene' });
    }

    init(data) {
        const isFirstBoot = !data || Object.keys(data).length === 0;
        if (isFirstBoot) {
            const save = localStorage.getItem('miners_save');
            if (save) {
                try { data = JSON.parse(save); } catch (e) {}
            }
        }
        this.shipGrid = data.shipGrid || this.createEmptyGrid(4, 6);
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel !== undefined ? data.shipFuel : 100;
        this.shipFuelCapacity = data.shipFuelCapacity !== undefined ? data.shipFuelCapacity : 100;
        this.rockCompositions = data.rockCompositions || {};
        this.techState = data.techState || { fuelTankLevel: 0, efficiencyLevel: 0, droneRangeLevel: 0 };
        this.processingQueues = data.processingQueues || {};
        this.mechState = data.mechState || {
            unlockedChassis: ['scout'],
            activeChassis: 'scout',
            modules: [],
            science: {},
            visitedPlanets: {},
        };
        // Offline processing: if we were away, catch up
        const savedLaunchTime = data.launchTime || this.launchTime || null;
        if (savedLaunchTime) {
            const elapsed = Date.now() - savedLaunchTime;
            if (elapsed > 1000) {
                this.processOffline(elapsed);
            }
            this.launchTime = null;
        }
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerStored = 0;
        this.powerCapacity = 0;
        this.selectedRoomCell = null;
        this.pendingSellGem = null;
        this.buildMode = false;
        this.selectedRoom = null;
        this.ghostGraphics = null;
    }

    createEmptyGrid(w, h) {
        const grid = [];
        for (let x = 0; x < w; x++) {
            grid[x] = [];
            for (let y = 0; y < h; y++) grid[x][y] = null;
        }
        return grid;
    }

    create() {
        this.cameras.main.setBackgroundColor('#040408');

        // Ambient starfield — slow-drifting background particles
        this.ambientStars = [];
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 1280;
            const y = Math.random() * 720;
            const size = Math.random() * 1.5 + 0.5;
            const star = this.add.circle(x, y, size, 0xffffff, Math.random() * 0.3 + 0.1);
            star.setScrollFactor(0);
            star.speed = Math.random() * 0.25 + 0.05;
            star.wobble = Math.random() * 0.003 + 0.001;
            star.phase = Math.random() * Math.PI * 2;
            this.ambientStars.push(star);
        }
        this.tileSize = 52;
        this.gridW = 4;
        this.gridH = 6;
        this.gridOffsetX = (1280 - this.gridW * this.tileSize) / 2; // 512
        this.gridOffsetY = 160;

        // Decorative corner brackets around grid
        this.frameGraphics = this.add.graphics();
        const fw = this.gridW * this.tileSize + 24;
        const fh = this.gridH * this.tileSize + 24;
        const fx = this.gridOffsetX - 12;
        const fy = this.gridOffsetY - 12;
        this.frameGraphics.lineStyle(2, 0x00d4aa, 0.6);
        // Top-left corner
        this.frameGraphics.lineBetween(fx, fy + 20, fx, fy);
        this.frameGraphics.lineBetween(fx, fy, fx + 20, fy);
        // Top-right corner
        this.frameGraphics.lineBetween(fx + fw - 20, fy, fx + fw, fy);
        this.frameGraphics.lineBetween(fx + fw, fy, fx + fw, fy + 20);
        // Bottom-left corner
        this.frameGraphics.lineBetween(fx, fy + fh - 20, fx, fy + fh);
        this.frameGraphics.lineBetween(fx, fy + fh, fx + 20, fy + fh);
        // Bottom-right corner
        this.frameGraphics.lineBetween(fx + fw - 20, fy + fh, fx + fw, fy + fh);
        this.frameGraphics.lineBetween(fx + fw, fy + fh - 20, fx + fw, fy + fh);

        this.cameras.main.fadeIn(150, 0, 0, 0);

        // Web Audio for procedural UI sounds
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Title
        this.add.text(640, 28, 'SHIP COMMAND', {
            fontSize: '16px', fill: '#445566', fontFamily: 'monospace', letterSpacing: 6
        }).setOrigin(0.5);

        // Status bar
        this.statusFuel = this.add.text(80, 60, '', {
            fontSize: '13px', fill: '#cc8844', fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
        this.statusScience = this.add.text(640, 60, '', {
            fontSize: '13px', fill: '#00d4aa', fontFamily: 'monospace'
        }).setOrigin(0.5, 0.5);
        this.statusCredits = this.add.text(1200, 60, '', {
            fontSize: '13px', fill: '#c9a84c', fontFamily: 'monospace'
        }).setOrigin(1, 0.5);

        // Mech chassis indicator
        this.statusMech = this.add.text(640, 82, '', {
            fontSize: '11px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5, 0.5);

        // Ship fuel bar — visual horizontal bar matching the mining scene fuel bar
        const sBarX = 80;
        const sBarY = 76;
        const sBarW = 220;
        const sBarH = 10;
        this.shipFuelBarBg = this.add.rectangle(sBarX + sBarW / 2, sBarY, sBarW, sBarH, 0x1a1a2e).setOrigin(0.5);
        this.shipFuelBarBg.setStrokeStyle(1, 0x444466);
        this.shipFuelBarFill = this.add.rectangle(sBarX + 1, sBarY, sBarW - 2, sBarH - 2, 0xFF8C00).setOrigin(0, 0.5);

        // Thin separator
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x111122, 1);
        sep.lineBetween(60, 82, 1220, 82);

        this.roomTypes = {
            solar: { name: 'Solar Panel', size: 1, power: 0, cost: 0, color: 0xccaa44, icon: '☀' },
            battery: { name: 'Battery', size: 1, powerCap: 50, cost: 100, color: 0x4466cc, icon: '⚡' },
            fuelTank: { name: 'Fuel Tank', size: 1, fuelCap: 50, cost: 200, color: 0xcc6633, icon: '⛽' },
            refinery: { name: 'Refinery', size: 2, power: 0, cost: 500, color: 0x8b6f47, icon: '⚙' },
            trade: { name: 'Trade Terminal', size: 1, power: 0, cost: 300, color: 0x44aa66, icon: '💰' },
            smelter: { name: 'Smelter', size: 2, power: 0, cost: 500, color: 0xaa5555, icon: '🔥' },
            drill: { name: 'Mech Workshop', size: 2, power: 0, cost: 400, color: 0x999999, icon: '🔧' },
            engine: { name: 'Engine', size: 2, power: 0, cost: 1000, color: 0xcc5544, icon: '✈' },
            quarters: { name: 'Quarters', size: 1, power: 0, cost: 150, color: 0x8866bb, icon: '💤' },
            crusher: { name: 'Crusher', size: 2, power: 0, cost: 300, color: 0x777766, icon: '💥' },
        };

        this.gemPrices = {
            'Ruby': 50, 'Sapphire': 75, 'Emerald': 100, 'Diamond': 200, 'Amethyst': 80,
        };

        this.fuelPrices = { 5: 400, 25: 2000 };

        this.techTree = {
            fuelTank: [
                { level: 1, cost: { 'Copper Ingot': 50 }, bonus: 1 },
                { level: 2, cost: { 'Copper Ingot': 100 }, bonus: 1 },
                { level: 3, cost: { 'Copper Ingot': 150, 'Iron Ingot': 50 }, bonus: 1 },
                { level: 4, cost: { 'Copper Ingot': 200, 'Iron Ingot': 100 }, bonus: 1 },
                { level: 5, cost: { 'Copper Ingot': 250, 'Iron Ingot': 150, 'Gold Ingot': 50 }, bonus: 1 },
                { level: 6, cost: { 'Copper Ingot': 300, 'Iron Ingot': 200, 'Gold Ingot': 100 }, bonus: 1 },
            ],
            efficiency: [
                { level: 1, cost: { credits: 1000 }, bonus: 1 },
                { level: 2, cost: { credits: 2000 }, bonus: 1 },
                { level: 3, cost: { credits: 4000 }, bonus: 1 },
                { level: 4, cost: { credits: 8000 }, bonus: 1 },
                { level: 5, cost: { credits: 16000 }, bonus: 1 },
                { level: 6, cost: { credits: 32000 }, bonus: 1 },
                { level: 7, cost: { credits: 64000 }, bonus: 1 },
                { level: 8, cost: { credits: 128000 }, bonus: 1 },
                { level: 9, cost: { credits: 256000 }, bonus: 1 },
                { level: 10, cost: { credits: 512000 }, bonus: 1 },
            ],
            droneRange: [
                { level: 1, cost: { credits: 5000 }, bonus: 1 },
                { level: 2, cost: { credits: 10000 }, bonus: 1 },
                { level: 3, cost: { credits: 20000 }, bonus: 1 },
                { level: 4, cost: { credits: 40000 }, bonus: 1 },
                { level: 5, cost: { credits: 80000 }, bonus: 1 },
            ]
        };

        this.recipes = {
            smelter: [
                { id: 'copper_ingot', name: 'Copper Ingot', input: { 'Copper Ore': 3 }, output: { 'Copper Ingot': 1 }, time: 3000 },
                { id: 'iron_ingot', name: 'Iron Ingot', input: { 'Iron Ore': 3 }, output: { 'Iron Ingot': 1 }, time: 3000 },
                { id: 'gold_ingot', name: 'Gold Ingot', input: { 'Gold Ore': 3 }, output: { 'Gold Ingot': 1 }, time: 3000 },
                { id: 'titanium_ingot', name: 'Titanium Ingot', input: { 'Titanium Ore': 3 }, output: { 'Titanium Ingot': 1 }, time: 4000 },
            ],
            crusher: [
                { id: 'crush', name: 'Crush Rock', input: {}, output: {}, time: 2000, dynamic: true },
            ],
            refinery: [
                { id: 'extract', name: 'Extract', input: {}, output: {}, time: 5000, dynamic: true },
            ]
        };

        this.placeStarterRooms();
        this.drawShipGrid();
        this.createBottomDock();
        this.createSellPopup();
        this.createTechTreePopup();
        this.createBuildModal();
        this.createRoomControlsPanel();
        this.createInventoryModal();
        this.createGhostGraphics();
        this.createResetConfirmPopup();

        // Room hover tooltip — shows room name when hovering over ship grid cells
        this.roomTooltip = this.add.text(0, 0, '', {
            fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2, backgroundColor: '#00000088',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
        this.roomTooltip.setVisible(false);

        // Processing status indicators — small animated dots on working machines
        this.procIndicators = this.add.graphics().setDepth(3);

        this.calculatePower();
        this.updateUI();
        // Add modal click guard — prevents scene-level grid clicks from firing when clicking on popups
        this.justClickedModal = false;

        // Panel sell mode: when set to a gem name, trade panel shows sell UI for that gem
        this.panelSellMode = null;

        this.input.on('pointerdown', (pointer) => this.handleGridClick(pointer));
        this.input.on('pointermove', (pointer) => this.handleGridHover(pointer));

        // Add ESC key to cancel build mode
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.buildMode) {
                this.buildMode = false;
                this.selectedRoom = null;
                this.ghostGraphics.clear();
                if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
            }
            // Also close any open modals
            this.closeBuildModal();
            this.closeRoomControlsPanel();
            this.closeSellPopup();
            this.closeTechTreePopup();
            this.closeResetPopup();
            this.closeInventoryModal();
        });
    }

    createGhostGraphics() {
        if (this.ghostGraphics) this.ghostGraphics.destroy();
        this.ghostGraphics = this.add.graphics();
    }

    getQueueKey(room) {
        return `${room.masterX},${room.masterY}`;
    }

    getQueue(room) {
        const key = this.getQueueKey(room);
        if (!this.processingQueues[key]) {
            this.processingQueues[key] = { currentJob: null, pending: [] };
        }
        return this.processingQueues[key];
    }

    canAffordRecipe(recipe, dynamicInput) {
        const input = dynamicInput || recipe.input;
        for (const [mat, qty] of Object.entries(input)) {
            if ((this.shipInventory[mat] || 0) < qty) return false;
        }
        return true;
    }

    deductRecipeInput(recipe, dynamicInput) {
        const input = dynamicInput || recipe.input;
        for (const [mat, qty] of Object.entries(input)) {
            this.shipInventory[mat] -= qty;
            if (this.shipInventory[mat] <= 0) delete this.shipInventory[mat];
        }
    }

    queueJob(room, recipe, amount, dynamicInput) {
        if (!this.canAffordRecipe(recipe, dynamicInput)) return false;
        this.deductRecipeInput(recipe, dynamicInput);
        const queue = this.getQueue(room);
        queue.pending.push({ recipeId: recipe.id, amount, dynamicInput });
        // If nothing is running, start immediately
        if (!queue.currentJob) this.startNextJob(room);
        return true;
    }

    startNextJob(room) {
        const queue = this.getQueue(room);
        if (queue.pending.length === 0) {
            queue.currentJob = null;
            return;
        }
        const job = queue.pending.shift();
        const recipes = this.recipes[room.type];
        const recipe = recipes.find(r => r.id === job.recipeId);
        queue.currentJob = {
            recipeId: job.recipeId,
            startTime: Date.now(),
            amount: job.amount,
            done: 0,
            dynamicInput: job.dynamicInput,
            recipe: recipe,
        };
    }

    processJobTick(room, now) {
        const queue = this.getQueue(room);
        if (!queue.currentJob) return;
        const job = queue.currentJob;
        const recipe = job.recipe;
        const elapsed = now - job.startTime;
        if (elapsed >= recipe.time) {
            // Job unit complete
            job.done++;
            // Apply output
            const output = recipe.dynamic ? this.resolveDynamicOutput(room, recipe, job) : recipe.output;
            for (const [mat, qty] of Object.entries(output)) {
                this.shipInventory[mat] = (this.shipInventory[mat] || 0) + qty;
            }
            if (job.done >= job.amount) {
                // All units done
                queue.currentJob = null;
                this.startNextJob(room);
            } else {
                // Next unit
                job.startTime = now;
            }
            this.updateUI();
            // Refresh modal if this room is selected
            if (this.selectedRoomCell) {
                const selRoom = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
                if (selRoom && selRoom.masterX === room.masterX && selRoom.masterY === room.masterY) {
                    this.openRoomControlsPanel(selRoom);
                }
            }
        }
    }

    resolveDynamicOutput(room, recipe, job) {
        const type = room.type;
        if (type === 'crusher') {
            const rockName = job.dynamicInput ? Object.keys(job.dynamicInput)[0] : 'Rock';
            return { [`Crushed ${rockName}`]: 2 };
        }
        if (type === 'refinery') {
            const crushedName = job.dynamicInput ? Object.keys(job.dynamicInput)[0] : 'Crushed Rock';
            const rockName = crushedName.replace('Crushed ', '');
            const comp = this.rockCompositions[rockName];
            const out = {};
            if (Math.random() < comp.copper) out['Copper Ore'] = (out['Copper Ore'] || 0) + 1 + Math.floor(Math.random() * 2);
            if (Math.random() < comp.iron) out['Iron Ore'] = (out['Iron Ore'] || 0) + 1 + Math.floor(Math.random() * 2);
            if (Math.random() < comp.gold) out['Gold Ore'] = (out['Gold Ore'] || 0) + 1;
            if (Math.random() < comp.titanium) out['Titanium Ore'] = (out['Titanium Ore'] || 0) + 1;
            if (Math.random() < comp.gemChance) {
                const gems = ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'];
                const gem = gems[Math.floor(Math.random() * gems.length)];
                out[gem] = (out[gem] || 0) + 1;
            }
            if (Object.keys(out).length === 0) return { 'Rock Dust': 1 };
            return out;
        }
        return {};
    }

    processOffline(elapsedMs) {
        // Process all queues as if elapsedMs passed
        const now = Date.now();
        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const room = this.shipGrid[x][y];
                if (!room || room.masterX !== x || room.masterY !== y) continue;
                if (!this.recipes[room.type]) continue;
                const queue = this.getQueue(room);
                let remainingMs = elapsedMs;
                while (remainingMs > 0 && (queue.currentJob || queue.pending.length > 0)) {
                    if (!queue.currentJob) this.startNextJob(room);
                    if (!queue.currentJob) break;
                    const job = queue.currentJob;
                    const recipe = job.recipe || this.recipes[room.type].find(r => r.id === job.recipeId);
                    job.recipe = recipe;
                    const timeNeeded = recipe.time;
                    const timeIntoCurrent = now - job.startTime; // normally 0, but for offline we simulate
                    // For offline simulation, treat startTime as the moment we "resume"
                    // So we just consume remainingMs
                    const timeToComplete = timeNeeded; // fresh unit
                    if (remainingMs >= timeToComplete) {
                        remainingMs -= timeToComplete;
                        job.done++;
                        const output = recipe.dynamic ? this.resolveDynamicOutput(room, recipe, job) : recipe.output;
                        for (const [mat, qty] of Object.entries(output)) {
                            this.shipInventory[mat] = (this.shipInventory[mat] || 0) + qty;
                        }
                        if (job.done >= job.amount) {
                            queue.currentJob = null;
                        }
                    } else {
                        // Partial progress — set startTime back so it completes after remainingMs
                        job.startTime = now - (timeNeeded - remainingMs);
                        remainingMs = 0;
                    }
                }
                if (!queue.currentJob && queue.pending.length > 0) {
                    this.startNextJob(room);
                }
            }
        }
        this.saveGame();
    }

    update(time, delta) {
        // Drift ambient starfield
        this.ambientStars.forEach(star => {
            star.x -= star.speed;
            star.y += Math.sin(time * star.wobble + star.phase) * 0.25;
            star.alpha = 0.08 + Math.abs(Math.sin(time * 0.0008 + star.phase)) * 0.25;
            if (star.x < -5) {
                star.x = 1285;
                star.y = Math.random() * 720;
            }
        });

        // Process active jobs every frame
        const now = Date.now();
        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const room = this.shipGrid[x][y];
                if (!room || room.masterX !== x || room.masterY !== y) continue;
                if (!this.recipes[room.type]) continue;
                this.processJobTick(room, now);
            }
        }

        // Draw processing status indicators on working machines
        this.procIndicators.clear();
        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const room = this.shipGrid[x][y];
                if (!room || room.masterX !== x || room.masterY !== y) continue;
                if (!this.recipes[room.type]) continue;
                const queue = this.getQueue(room);
                const px = this.gridOffsetX + x * this.tileSize;
                const py = this.gridOffsetY + y * this.tileSize;
                if (queue.currentJob) {
                    const progress = Math.min(1, (now - queue.currentJob.startTime) / queue.currentJob.recipe.time);
                    const barW = this.tileSize - 8;
                    const barH = 3;
                    this.procIndicators.fillStyle(0x1a1a2a, 0.7);
                    this.procIndicators.fillRect(px + 4, py + this.tileSize - 8, barW, barH);
                    this.procIndicators.fillStyle(0x44ff88, 0.9);
                    this.procIndicators.fillRect(px + 4, py + this.tileSize - 8, barW * progress, barH);
                } else if (queue.pending.length > 0) {
                    const dotPulse = Math.abs(Math.sin(time * 0.003)) * 0.4 + 0.6;
                    this.procIndicators.fillStyle(0xffcc44, dotPulse);
                    this.procIndicators.fillCircle(px + this.tileSize - 8, py + 8, 3);
                }
            }
        }

        // Refresh processing modal UI periodically so progress bar animates
        if (this.roomPanel.visible && this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room && this.recipes[room.type]) {
                if (!this.lastModalRefresh || now - this.lastModalRefresh > 150) {
                    this.lastModalRefresh = now;
                    this.openRoomControlsPanel(room);
                }
            }
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

    saveGame() {
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
        this.showSaveFlash();
    }

    placeStarterRooms() {
        let hasRooms = false;
        for (let x = 0; x < this.gridW; x++)
            for (let y = 0; y < this.gridH; y++)
                if (this.shipGrid[x][y]) hasRooms = true;
        if (hasRooms) return;
        this.placeRoom(0, 0, 'solar');
        this.placeRoom(1, 0, 'solar');
        this.placeRoom(2, 0, 'fuelTank');
        this.placeRoom(3, 0, 'trade');
    }

    drawShipGrid() {
        if (this.gridGraphics) this.gridGraphics.destroy();
        if (this.highlightGraphics) this.highlightGraphics.destroy();
        if (this.roomIcons) this.roomIcons.forEach(i => i.destroy());
        this.roomIcons = [];
        this.gridGraphics = this.add.graphics();
        this.highlightGraphics = this.add.graphics();

        // Draw outer grid border
        const totalW = this.gridW * this.tileSize;
        const totalH = this.gridH * this.tileSize;
        this.gridGraphics.lineStyle(2, 0x00d4aa, 0.8);
        this.gridGraphics.strokeRect(this.gridOffsetX - 1, this.gridOffsetY - 1, totalW + 2, totalH + 2);

        // Draw inner grid lines
        this.gridGraphics.lineStyle(1, 0x1a2a3a, 0.6);
        for (let x = 1; x < this.gridW; x++) {
            const px = this.gridOffsetX + x * this.tileSize;
            this.gridGraphics.lineBetween(px, this.gridOffsetY, px, this.gridOffsetY + totalH);
        }
        for (let y = 1; y < this.gridH; y++) {
            const py = this.gridOffsetY + y * this.tileSize;
            this.gridGraphics.lineBetween(this.gridOffsetX, py, this.gridOffsetX + totalW, py);
        }

        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const px = this.gridOffsetX + x * this.tileSize;
                const py = this.gridOffsetY + y * this.tileSize;
                const room = this.shipGrid[x][y];
                if (room) {
                    const def = this.roomTypes[room.type];
                    // Main tile fill
                    this.gridGraphics.fillStyle(def.color, 0.9);
                    this.gridGraphics.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                    // Inner highlight (top-left)
                    this.gridGraphics.fillStyle(0xffffff, 0.15);
                    this.gridGraphics.fillRect(px + 1, py + 1, this.tileSize - 2, 3);
                    this.gridGraphics.fillRect(px + 1, py + 1, 3, this.tileSize - 2);
                    // Inner shadow (bottom-right)
                    this.gridGraphics.fillStyle(0x000000, 0.3);
                    this.gridGraphics.fillRect(px + 1, py + this.tileSize - 4, this.tileSize - 2, 3);
                    this.gridGraphics.fillRect(px + this.tileSize - 4, py + 1, 3, this.tileSize - 2);
                    // Border
                    this.gridGraphics.lineStyle(1, 0x000000, 0.4);
                    this.gridGraphics.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                    if (room.masterX === x && room.masterY === y) {
                        const icon = this.add.text(px + this.tileSize / 2, py + this.tileSize / 2,
                            def.icon, { fontSize: '24px' }).setOrigin(0.5);
                        icon.setDepth(2);
                        this.roomIcons.push(icon);
                    }
                } else {
                    // Empty tile — subtle fill
                    this.gridGraphics.fillStyle(0x0d0d18, 0.6);
                    this.gridGraphics.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                }
            }
        }

        if (this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room) {
                const def = this.roomTypes[room.type];
                const size = def.size;
                const px = this.gridOffsetX + room.masterX * this.tileSize;
                const py = this.gridOffsetY + room.masterY * this.tileSize;
                this.highlightGraphics.lineStyle(2, 0x00d4aa, 1);
                this.highlightGraphics.strokeRect(px - 3, py - 3, size * this.tileSize + 6, size * this.tileSize + 6);
                // Animated glow layer
                this.highlightGraphics.fillStyle(0x00d4aa, 0.08);
                this.highlightGraphics.fillRect(px - 3, py - 3, size * this.tileSize + 6, size * this.tileSize + 6);
            }
        }
    }

    handleGridHover(pointer) {
        if (this.buildMode && this.selectedRoom) {
            const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
            const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);
            this.ghostGraphics.clear();
            if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
            if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return;

            const def = this.roomTypes[this.selectedRoom];
            const size = def.size;
            let valid = true;
            if (gx + size > this.gridW || gy + size > this.gridH) valid = false;
            else {
                for (let dx = 0; dx < size; dx++) {
                    for (let dy = 0; dy < size; dy++) {
                        if (this.shipGrid[gx + dx][gy + dy]) valid = false;
                    }
                }
            }
            if (!valid) return;

            const px = this.gridOffsetX + gx * this.tileSize;
            const py = this.gridOffsetY + gy * this.tileSize;
            this.ghostGraphics.fillStyle(def.color, 0.25);
            this.ghostGraphics.fillRect(px, py, size * this.tileSize, size * this.tileSize);
            this.ghostGraphics.lineStyle(2, def.color, 0.8);
            this.ghostGraphics.strokeRect(px, py, size * this.tileSize, size * this.tileSize);
            this.ghostIcon = this.add.text(px + size * this.tileSize / 2, py + size * this.tileSize / 2,
                def.icon, { fontSize: '24px', fill: '#ffffff' }).setOrigin(0.5);
            this.ghostIcon.setAlpha(0.5);
            this.ghostIcon.setDepth(3);
            return;
        }

        // Room name tooltip on hover (non-build mode)
        const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
        const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);
        if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
            const room = this.shipGrid[gx][gy];
            if (room) {
                const def = this.roomTypes[room.type];
                this.roomTooltip.setText(`${def.icon} ${def.name}`);
                const px = this.gridOffsetX + gx * this.tileSize + this.tileSize / 2;
                const py = this.gridOffsetY + gy * this.tileSize - 6;
                this.roomTooltip.setPosition(px, py);
                this.roomTooltip.setVisible(true);
            } else {
                this.roomTooltip.setVisible(false);
            }
        } else {
            this.roomTooltip.setVisible(false);
        }
    }

    handleGridClick(pointer) {
        // Guard: if we just clicked a modal button this same frame, ignore — the modal already handled it
        if (this.justClickedModal) {
            this.justClickedModal = false;
            return;
        }
        // If we just selected a build card this same click, ignore it — wait for a fresh click on the grid
        if (this.justSelectedBuild) {
            this.justSelectedBuild = false;
            return;
        }

        const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
        const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);
        if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return;

        if (this.buildMode && this.selectedRoom) {
            const def = this.roomTypes[this.selectedRoom];
            if (this.credits >= def.cost) {
                if (this.placeRoom(gx, gy, this.selectedRoom)) {
                    this.credits -= def.cost;
                    this.playBuildSound();
                    this.calculatePower();
                    this.updateUI();
                    this.drawShipGrid();
                    this.ghostGraphics.clear();
                    if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
                }
            }
            return;
        }

        const room = this.shipGrid[gx][gy];
        if (room) {
            this.selectedRoomCell = { x: gx, y: gy };
            this.panelSellMode = null;
            this.panelSellCustom = 0;
            this.drawShipGrid();
            this.openRoomControlsPanel(room);
        } else {
            this.selectedRoomCell = null;
            this.panelSellMode = null;
            this.panelSellCustom = 0;
            this.drawShipGrid();
        }
    }

    createBottomDock() {
        const y = 660;
        const btnH = 38;
        const btnW = 160;
        const gap = 20;
        const totalW = 4 * btnW + 3 * gap;
        const startX = (1280 - totalW) / 2 + btnW / 2;

        this.createDockButton(startX, y, 'RESET', () => this.openResetPopup(), btnW, btnH, 0x2a1515, '#aa5555');
        this.createDockButton(startX + btnW + gap, y, 'INVENTORY', () => this.openInventoryModal(), btnW, btnH, 0x151525, '#8888aa');
        this.createDockButton(startX + 2 * (btnW + gap), y, 'BUILD', () => this.openBuildModal(), btnW, btnH, 0x152525, '#44aa88');
        this.createDockButton(startX + 3 * (btnW + gap), y, 'LAUNCH', () => {
            this.openMechConfigModal();
        }, btnW, btnH, 0x1a2a2a, '#44aa88');
    }

    createDockButton(x, y, text, callback, w, h, color, textColor) {
        const rect = this.add.rectangle(x, y, w, h, color).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '13px', fill: textColor, fontFamily: 'monospace', letterSpacing: 1
        }).setOrigin(0.5);
        rect.on('pointerover', () => { rect.setFillStyle(color + 0x111111); label.setFill('#ffffff'); });
        rect.on('pointerout', () => { rect.setFillStyle(color); label.setFill(textColor); });
        rect.on('pointerdown', callback);
    }

    createInventoryModal() {
        this.invModal = this.add.container(640, 360);
        this.invModal.setVisible(false);
        this.invModal.setDepth(10);

        const bg = this.add.rectangle(0, 0, 440, 480, 0x0c0c18, 0.98).setOrigin(0.5);
        bg.setStrokeStyle(1, 0x222233);
        const title = this.add.text(0, -220, 'INVENTORY', {
            fontSize: '18px', fill: '#8888aa', fontFamily: 'monospace', letterSpacing: 3
        }).setOrigin(0.5);

        this.invContent = this.add.text(0, 0, '', {
            fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace', lineSpacing: 6, align: 'center'
        }).setOrigin(0.5);

        const closeBtn = this.add.rectangle(0, 220, 120, 28, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(0, 220, 'CLOSE', {
            fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x252535));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeInventoryModal();
        });

        this.invModal.add([bg, title, this.invContent, closeBtn, closeTxt]);
    }

    openInventoryModal() {
        const entries = Object.entries(this.shipInventory);
        if (entries.length === 0) {
            this.invContent.setText('Empty');
        } else {
            // Group by category
            const ores = entries.filter(([k]) => k.includes('Ore') || k.includes('Ingot'));
            const gems = entries.filter(([k]) => this.gemPrices[k]);
            const crushed = entries.filter(([k]) => k.startsWith('Crushed'));
            const other = entries.filter(([k]) => !ores.find(o => o[0] === k) && !gems.find(g => g[0] === k) && !crushed.find(c => c[0] === k));
            
            let lines = [];
            if (ores.length > 0) {
                lines.push('─ ORES / METALS ─');
                ores.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
                lines.push('');
            }
            if (gems.length > 0) {
                lines.push('─ GEMS ─');
                gems.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
                lines.push('');
            }
            if (crushed.length > 0) {
                lines.push('─ CRUSHED ─');
                crushed.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
                lines.push('');
            }
            if (other.length > 0) {
                lines.push('─ OTHER ─');
                other.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
            }
            this.invContent.setText(lines.join('\n'));
        }
        this.invModal.setVisible(true);
    }

    closeInventoryModal() {
        this.invModal.setVisible(false);
    }

    createRoomControlsPanel() {
        const pw = 280;
        const ph = 560;
        const px = 1280 - pw / 2 - 20; // right side, 20px margin
        const py = 360;

        this.roomPanel = this.add.container(px, py);
        this.roomPanel.setVisible(false);
        this.roomPanel.setDepth(10);

        this.roomPanelBg = this.add.rectangle(0, 0, pw, ph, 0x0c0c18, 0.98).setOrigin(0.5);
        this.roomPanelBg.setStrokeStyle(1, 0x222233);

        this.roomPanelTitle = this.add.text(0, -ph / 2 + 24, '', {
            fontSize: '16px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);

        this.roomPanelSubtitle = this.add.text(0, -ph / 2 + 50, '', {
            fontSize: '10px', fill: '#555555', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.roomPanelContent = this.add.text(0, -ph / 2 + 80, '', {
            fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace', lineSpacing: 3, align: 'left'
        }).setOrigin(0.5, 0);

        this.roomPanelButtons = this.add.container(0, 0);

        const closeBtn = this.add.rectangle(pw / 2 - 28, -ph / 2 + 18, 40, 20, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(pw / 2 - 28, -ph / 2 + 18, '✕', {
            fontSize: '12px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x333344));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeRoomControlsPanel();
        });

        this.roomPanel.add([
            this.roomPanelBg, this.roomPanelTitle, this.roomPanelSubtitle,
            this.roomPanelContent, this.roomPanelButtons, closeBtn, closeTxt
        ]);
        this.roomPanelControlBtns = [];
    }

    openRoomControlsPanel(room) {
        const ph = 560;
        const def = this.roomTypes[room.type];
        this.roomPanelButtons.removeAll(true);
        this.roomPanelControlBtns = [];

        this.roomPanelTitle.setText(`${def.icon}  ${def.name.toUpperCase()}`);
        this.roomPanelSubtitle.setText(
            `${def.size}×${def.size}  |  ${def.cost > 0 ? def.cost + 'cr' : 'Free'}` +
            `  |  ${def.power > 0 ? '+' + def.power + ' power' : def.powerCap ? '+' + def.powerCap + ' storage' : def.fuelCap ? '+' + def.fuelCap + 'L fuel' : ''}`
        );
        this.roomPanelContent.setText('');

        let y = -ph / 2 + 130;

        if (room.type === 'trade') {
            // ── Inline sell mode ──
            if (this.panelSellMode) {
                const gemName = this.panelSellMode;
                const count = this.shipInventory[gemName] || 0;
                const price = this.gemPrices[gemName];
                this.roomPanelTitle.setText(`SELL  ${gemName.toUpperCase()}`);
                this.roomPanelSubtitle.setText(`${count} owned  ·  ${price}cr each  ·  max ${count * price}cr`);

                // Quick sell buttons
                const quick = [
                    { label: 'SELL 1', qty: 1, y: -ph / 2 + 140 },
                    { label: 'SELL 10', qty: 10, y: -ph / 2 + 178 },
                    { label: 'SELL 50', qty: 50, y: -ph / 2 + 216 },
                    { label: 'SELL ALL', qty: -1, y: -ph / 2 + 254 },
                ];
                quick.forEach(q => {
                    if (q.qty === -1 || count >= q.qty) {
                        const btn = this.createPanelButton(0, q.y, q.label, () => {
                            this.justClickedModal = true;
                            this.confirmSell(q.qty);
                        }, 220, 28, 0x224422, '#88cc88');
                        this.roomPanelControlBtns.push(btn);
                    }
                });

                // Custom amount
                const customY = -ph / 2 + 300;
                if (!this.panelSellCustom) this.panelSellCustom = 0;
                const customTxt = this.add.text(0, customY - 14, 'CUSTOM AMOUNT', {
                    fontSize: '10px', fill: '#555555', fontFamily: 'monospace'
                }).setOrigin(0.5);
                this.roomPanelButtons.add(customTxt);

                const minusBtn = this.add.rectangle(-50, customY + 18, 36, 36, 0x1a1a28).setInteractive();
                const minusTxt = this.add.text(-50, customY + 18, '-', { fontSize: '13px', fill: '#cccccc' }).setOrigin(0.5).setInteractive();
                const amtTxt = this.add.text(0, customY + 18, String(this.panelSellCustom), {
                    fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace'
                }).setOrigin(0.5);
                const plusBtn = this.add.rectangle(50, customY + 18, 36, 36, 0x1a1a28).setInteractive();
                const plusTxt = this.add.text(50, customY + 18, '+', { fontSize: '13px', fill: '#cccccc' }).setOrigin(0.5).setInteractive();

                const dec = () => {
                    this.justClickedModal = true;
                    if (this.panelSellCustom > 0) { this.panelSellCustom--; this.openRoomControlsPanel(room); }
                };
                const inc = () => {
                    this.justClickedModal = true;
                    if (this.panelSellCustom < count) { this.panelSellCustom++; this.openRoomControlsPanel(room); }
                };
                minusBtn.on('pointerdown', dec);
                minusTxt.on('pointerdown', dec);
                plusBtn.on('pointerdown', inc);
                plusTxt.on('pointerdown', inc);

                const sellCustomBtn = this.createPanelButton(0, customY + 58, `SELL ${this.panelSellCustom}`, () => {
                    this.justClickedModal = true;
                    if (this.panelSellCustom > 0) this.confirmSell(this.panelSellCustom);
                }, 120, 26, this.panelSellCustom > 0 ? 0x224422 : 0x151515, this.panelSellCustom > 0 ? '#88cc88' : '#444444');

                this.roomPanelButtons.add([minusBtn, minusTxt, amtTxt, plusBtn, plusTxt]);
                this.roomPanelControlBtns.push(sellCustomBtn);

                // Back button
                const backBtn = this.createPanelButton(0, ph / 2 - 70, '← BACK', () => {
                    this.justClickedModal = true;
                    this.panelSellMode = null;
                    this.panelSellCustom = 0;
                    this.openRoomControlsPanel(room);
                }, 220, 26, 0x1a1a28, '#888888');
                this.roomPanelControlBtns.push(backBtn);

            } else {
                // ── Normal trade view ──
                this.roomPanelContent.setText(
                    '─ GEMS ─\n' +
                    ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'].map(g => {
                        const c = this.shipInventory[g] || 0;
                        return `  ${g}: ${c}  @${this.gemPrices[g]}cr`;
                    }).join('\n') + '\n\n─ FUEL ─\n' +
                    Object.entries(this.fuelPrices).map(([amt, cost]) => `  +${amt}L  —  ${cost}cr`).join('\n')
                );

                y = -ph / 2 + 230;
                ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'].forEach(gemName => {
                    const count = this.shipInventory[gemName] || 0;
                    if (count > 0) {
                        const btn = this.createPanelButton(0, y, `SELL ${gemName}`, () => {
                            this.justClickedModal = true;
                            this.panelSellMode = gemName;
                            this.panelSellCustom = 0;
                            this.openRoomControlsPanel(room);
                        }, 220, 26, 0x224422, '#88cc88');
                        this.roomPanelControlBtns.push(btn);
                        y += 32;
                    }
                });

                y += 8;
                Object.entries(this.fuelPrices).forEach(([amount, cost]) => {
                    const btn = this.createPanelButton(0, y, `BUY ${amount}L — ${cost}cr`, () => {
                        this.justClickedModal = true;
                        if (this.credits >= cost && this.shipFuel + parseInt(amount) <= this.shipFuelCapacity) {
                            this.credits -= cost;
                            this.shipFuel = Math.min(this.shipFuelCapacity, this.shipFuel + parseInt(amount));
                            this.updateUI();
                            this.openRoomControlsPanel(room);
                        }
                    }, 220, 26, 0x222244, '#8888cc');
                    this.roomPanelControlBtns.push(btn);
                    y += 32;
                });
            }

        } else if (room.type === 'fuelTank') {
            this.roomPanelContent.setText(
                `Stored: ${this.shipFuel.toFixed(1)} / ${this.shipFuelCapacity.toFixed(1)}L\n` +
                `Bonus capacity: +${def.fuelCap}L`
            );

        } else if (room.type === 'crusher') {
            this.renderProcessingPanel(room, 'crusher', y);
            this.roomPanel.setVisible(true);
            return;

        } else if (room.type === 'smelter') {
            this.renderProcessingPanel(room, 'smelter', y);
            this.roomPanel.setVisible(true);
            return;

        } else if (room.type === 'refinery') {
            this.renderProcessingPanel(room, 'refinery', y);
            this.roomPanel.setVisible(true);
            return;

        } else if (room.type === 'drill') {
            this.roomPanelContent.setText(
                `Fuel Tank Level: ${this.techState.fuelTankLevel || 0} / 6\n` +
                `Efficiency Level: ${this.techState.efficiencyLevel || 0} / 10\n` +
                `Drone Range Level: ${this.techState.droneRangeLevel || 0} / 5`
            );
            const btn = this.createPanelButton(0, -ph / 2 + 190, 'OPEN TECH TREE', () => {
                this.closeRoomControlsPanel();
                this.openTechTreePopup();
            }, 220, 26, 0x152525, '#44aa88');
            this.roomPanelControlBtns.push(btn);

        } else {
            this.roomPanelContent.setText('No controls available.');
        }

        if (def.cost > 0) {
            const refund = Math.floor(def.cost * 0.5);
            const btn = this.createPanelButton(0, ph / 2 - 34, `DESTROY (+${refund}cr)`, () => {
                this.destroyRoom(room);
                this.closeRoomControlsPanel();
            }, 220, 26, 0x2a1515, '#aa5555');
            this.roomPanelControlBtns.push(btn);
        }

        this.roomPanel.setVisible(true);
    }

    createPanelButton(x, y, text, callback, w, h, color, textColor) {
        const rect = this.add.rectangle(x, y, w, h, color).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '11px', fill: textColor, fontFamily: 'monospace'
        }).setOrigin(0.5);
        const onClick = () => { this.justClickedModal = true; callback(); };
        rect.on('pointerover', () => { rect.setFillStyle(color + 0x111111); label.setFill('#ffffff'); });
        rect.on('pointerout', () => { rect.setFillStyle(color); label.setFill(textColor); });
        rect.on('pointerdown', onClick);
        label.setInteractive();
        label.on('pointerdown', onClick);
        this.roomPanelButtons.add([rect, label]);
        return { rect, text: label };
    }

    closeRoomControlsPanel() {
        this.roomPanel.setVisible(false);
        this.selectedRoomCell = null;
        this.panelSellMode = null;
        this.panelSellCustom = 0;
        this.drawShipGrid();
    }

    renderProcessingPanel(room, machineType, startY) {
        const recipes = this.recipes[machineType];
        const queue = this.getQueue(room);
        const now = Date.now();
        const ph = 560;

        // Active job status text
        let contentLines = [];
        if (queue.currentJob) {
            const job = queue.currentJob;
            const recipe = job.recipe || recipes.find(r => r.id === job.recipeId);
            const elapsed = now - job.startTime;
            const pct = Math.min(1, elapsed / recipe.time);
            const remaining = Math.ceil(Math.max(0, recipe.time - elapsed) / 1000);
            contentLines.push(`${recipe.name}  —  ${job.done + 1}/${job.amount}`);
            contentLines.push(`${Math.floor(pct * 100)}%  ·  ${remaining}s`);
        } else {
            contentLines.push('IDLE');
        }
        if (queue.pending.length > 0) {
            const totalPending = queue.pending.reduce((s, j) => s + j.amount, 0);
            contentLines.push(`Queue: ${totalPending} pending`);
        }
        this.roomPanelContent.setText(contentLines.join('\n'));

        // Progress bar
        if (queue.currentJob) {
            const job = queue.currentJob;
            const recipe = job.recipe || recipes.find(r => r.id === job.recipeId);
            const elapsed = now - job.startTime;
            const pct = Math.min(1, elapsed / recipe.time);
            const barW = 230;
            const barH = 8;
            const barY = -ph / 2 + 112;
            const barX = -barW / 2;
            const fillColor = machineType === 'smelter' ? 0xcc8844 : machineType === 'crusher' ? 0xaa8866 : 0x6688aa;

            const barBg = this.add.rectangle(0, barY, barW + 4, barH + 4, 0x111118).setOrigin(0.5);
            barBg.setStrokeStyle(1, 0x333344);
            const barDark = this.add.rectangle(0, barY, barW, barH, 0x1a1a28).setOrigin(0.5);
            const barFill = this.add.rectangle(barX + (barW * pct) / 2, barY, barW * pct, barH, fillColor).setOrigin(0.5);
            const barLabel = this.add.text(0, barY, `${Math.floor(pct * 100)}%`, {
                fontSize: '8px', fill: '#ffffff', fontFamily: 'monospace'
            }).setOrigin(0.5);
            this.roomPanelButtons.add([barBg, barDark, barFill, barLabel]);
        }

        let y = startY;
        const rowHeight = 32;
        const maxRows = 6;
        let rowCount = 0;

        if (!this.modalAmounts) this.modalAmounts = {};

        recipes.forEach(recipe => {
            if (machineType === 'crusher') {
                const rockTypes = Object.keys(this.shipInventory).filter(k =>
                    this.rockCompositions[k] && !k.startsWith('Crushed')
                );
                rockTypes.forEach(rockName => {
                    if (rowCount >= maxRows) return;
                    const count = this.shipInventory[rockName] || 0;
                    if (count <= 0) return;
                    rowCount++;
                    const rowKey = `${recipe.id}_${rockName}`;
                    if (this.modalAmounts[rowKey] === undefined) this.modalAmounts[rowKey] = 1;
                    const amt = Math.min(this.modalAmounts[rowKey], count);

                    const label = this.add.text(-90, y, rockName, {
                        fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace'
                    }).setOrigin(0, 0.5);
                    const have = this.add.text(28, y, `×${count}`, {
                        fontSize: '9px', fill: '#555555', fontFamily: 'monospace'
                    }).setOrigin(0.5);

                    const minBtn = this.add.rectangle(62, y, 28, 28, 0x1a1a28).setInteractive();
                    const minTxt = this.add.text(62, y, '-', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();
                    const amtTxt = this.add.text(84, y, String(amt), {
                        fontSize: '10px', fill: '#cccccc', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    const plBtn = this.add.rectangle(106, y, 28, 28, 0x1a1a28).setInteractive();
                    const plTxt = this.add.text(106, y, '+', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();

                    const dec = () => {
                        this.justClickedModal = true;
                        if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsPanel(room); }
                    };
                    const inc = () => {
                        this.justClickedModal = true;
                        if (this.modalAmounts[rowKey] < count) { this.modalAmounts[rowKey]++; this.openRoomControlsPanel(room); }
                    };
                    minBtn.on('pointerdown', dec);
                    minTxt.on('pointerdown', dec);
                    plBtn.on('pointerdown', inc);
                    plTxt.on('pointerdown', inc);

                    const qBtn = this.createPanelButton(145, y, 'QUEUE', () => {
                        const qAmt = this.modalAmounts[rowKey];
                        if (qAmt > 0 && qAmt <= count) {
                            if (this.queueJob(room, recipe, qAmt, { [rockName]: 1 })) {
                                this.modalAmounts[rowKey] = 1;
                                this.openRoomControlsPanel(room);
                            }
                        }
                    }, 50, 20, 0x224422, '#88cc88');

                    this.roomPanelButtons.add([label, have, minBtn, minTxt, amtTxt, plBtn, plTxt]);
                    this.roomPanelControlBtns.push(qBtn);
                    y += rowHeight;
                });
                if (rockTypes.length > maxRows) {
                    const more = this.add.text(0, y, `... ${rockTypes.length - maxRows} more ...`, {
                        fontSize: '9px', fill: '#444444', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    this.roomPanelButtons.add(more);
                }
                return;
            }

            if (machineType === 'refinery') {
                const crushedList = Object.keys(this.shipInventory).filter(k => k.startsWith('Crushed '));
                crushedList.forEach(crushedName => {
                    if (rowCount >= maxRows) return;
                    const count = this.shipInventory[crushedName] || 0;
                    const rockName = crushedName.replace('Crushed ', '');
                    const comp = this.rockCompositions[rockName];
                    if (!comp || count < 5) return;
                    rowCount++;
                    const canMake = Math.floor(count / 5);
                    const rowKey = `${recipe.id}_${crushedName}`;
                    if (this.modalAmounts[rowKey] === undefined) this.modalAmounts[rowKey] = 1;
                    const amt = Math.min(this.modalAmounts[rowKey], canMake);

                    const label = this.add.text(-90, y, crushedName, {
                        fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace'
                    }).setOrigin(0, 0.5);
                    const have = this.add.text(28, y, `×${count}`, {
                        fontSize: '9px', fill: '#555555', fontFamily: 'monospace'
                    }).setOrigin(0.5);

                    const minBtn = this.add.rectangle(62, y, 28, 28, 0x1a1a28).setInteractive();
                    const minTxt = this.add.text(62, y, '-', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();
                    const amtTxt = this.add.text(84, y, String(amt), {
                        fontSize: '10px', fill: '#cccccc', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    const plBtn = this.add.rectangle(106, y, 28, 28, 0x1a1a28).setInteractive();
                    const plTxt = this.add.text(106, y, '+', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();

                    const dec = () => {
                        this.justClickedModal = true;
                        if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsPanel(room); }
                    };
                    const inc = () => {
                        this.justClickedModal = true;
                        if (this.modalAmounts[rowKey] < canMake) { this.modalAmounts[rowKey]++; this.openRoomControlsPanel(room); }
                    };
                    minBtn.on('pointerdown', dec);
                    minTxt.on('pointerdown', dec);
                    plBtn.on('pointerdown', inc);
                    plTxt.on('pointerdown', inc);

                    const qBtn = this.createPanelButton(145, y, 'QUEUE', () => {
                        const qAmt = this.modalAmounts[rowKey];
                        if (qAmt > 0 && qAmt <= canMake) {
                            if (this.queueJob(room, recipe, qAmt, { [crushedName]: 5 })) {
                                this.modalAmounts[rowKey] = 1;
                                this.openRoomControlsPanel(room);
                            }
                        }
                    }, 50, 20, 0x224422, '#88cc88');

                    this.roomPanelButtons.add([label, have, minBtn, minTxt, amtTxt, plBtn, plTxt]);
                    this.roomPanelControlBtns.push(qBtn);
                    y += rowHeight;
                });
                if (crushedList.length > maxRows) {
                    const more = this.add.text(0, y, `... ${crushedList.length - maxRows} more ...`, {
                        fontSize: '9px', fill: '#444444', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    this.roomPanelButtons.add(more);
                }
                return;
            }

            // Smelter
            let canMake = Infinity;
            for (const [mat, qty] of Object.entries(recipe.input)) {
                const have = this.shipInventory[mat] || 0;
                canMake = Math.min(canMake, Math.floor(have / qty));
            }
            if (canMake === Infinity) canMake = 0;
            if (canMake <= 0) return;

            rowCount++;
            const rowKey = recipe.id;
            if (this.modalAmounts[rowKey] === undefined) this.modalAmounts[rowKey] = 1;
            const amt = Math.min(this.modalAmounts[rowKey], canMake);

            const label = this.add.text(-90, y, recipe.name, {
                fontSize: '10px', fill: '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const inputTxt = Object.entries(recipe.input).map(([m, q]) => `${this.shipInventory[m] || 0}/${q} ${m}`).join('  ');
            const info = this.add.text(-90, y + 10, inputTxt, {
                fontSize: '8px', fill: '#444444', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const minBtn = this.add.rectangle(62, y, 28, 28, 0x1a1a28).setInteractive();
            const minTxt = this.add.text(62, y, '-', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();
            const amtTxt = this.add.text(84, y, String(amt), {
                fontSize: '10px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0.5);
            const plBtn = this.add.rectangle(106, y, 28, 28, 0x1a1a28).setInteractive();
            const plTxt = this.add.text(106, y, '+', { fontSize: '11px', fill: '#888888' }).setOrigin(0.5).setInteractive();

            const dec = () => {
                this.justClickedModal = true;
                if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsPanel(room); }
            };
            const inc = () => {
                this.justClickedModal = true;
                if (this.modalAmounts[rowKey] < canMake) { this.modalAmounts[rowKey]++; this.openRoomControlsPanel(room); }
            };
            minBtn.on('pointerdown', dec);
            minTxt.on('pointerdown', dec);
            plBtn.on('pointerdown', inc);
            plTxt.on('pointerdown', inc);

            const qBtn = this.createPanelButton(145, y, 'QUEUE', () => {
                const qAmt = Math.min(this.modalAmounts[rowKey], canMake);
                if (qAmt > 0 && this.queueJob(room, recipe, qAmt)) {
                    this.modalAmounts[rowKey] = 1;
                    this.openRoomControlsPanel(room);
                }
            }, 50, 20, canMake > 0 ? 0x224422 : 0x151515, canMake > 0 ? '#88cc88' : '#444444');

            this.roomPanelButtons.add([label, info, minBtn, minTxt, amtTxt, plBtn, plTxt]);
            this.roomPanelControlBtns.push(qBtn);
            y += rowHeight;
        });

        // DESTROY button at bottom
        const def = this.roomTypes[room.type];
        if (def.cost > 0) {
            const refund = Math.floor(def.cost * 0.5);
            const btn = this.createPanelButton(0, ph / 2 - 34, `DESTROY (+${refund}cr)`, () => {
                this.destroyRoom(room);
                this.closeRoomControlsPanel();
            }, 220, 26, 0x2a1515, '#aa5555');
            this.roomPanelControlBtns.push(btn);
        }
    }

    extractFromCrushedRock(crushedName, comp) {
        const count = this.shipInventory[crushedName] || 0;
        if (count < 5) return;
        this.shipInventory[crushedName] -= 5;
        if (this.shipInventory[crushedName] <= 0) delete this.shipInventory[crushedName];

        let results = [];
        if (Math.random() < comp.copper) {
            const qty = 1 + Math.floor(Math.random() * 2);
            this.shipInventory['Copper Ore'] = (this.shipInventory['Copper Ore'] || 0) + qty;
            results.push(`${qty} Copper Ore`);
        }
        if (Math.random() < comp.iron) {
            const qty = 1 + Math.floor(Math.random() * 2);
            this.shipInventory['Iron Ore'] = (this.shipInventory['Iron Ore'] || 0) + qty;
            results.push(`${qty} Iron Ore`);
        }
        if (Math.random() < comp.gold) {
            const qty = 1;
            this.shipInventory['Gold Ore'] = (this.shipInventory['Gold Ore'] || 0) + qty;
            results.push(`${qty} Gold Ore`);
        }
        if (Math.random() < comp.gemChance) {
            const gems = ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'];
            const gem = gems[Math.floor(Math.random() * gems.length)];
            this.shipInventory[gem] = (this.shipInventory[gem] || 0) + 1;
            results.push(`1 ${gem}`);
        }
        if (results.length === 0) results.push('Nothing found');
    }

    createSellPopup() {
        this.sellPopup = this.add.container(640, 360);
        this.sellPopup.setVisible(false);
        this.sellPopup.setDepth(12);

        const bg = this.add.rectangle(0, 0, 360, 260, 0x0c0c18, 0.98).setOrigin(0.5);
        bg.setStrokeStyle(1, 0x222233);
        this.sellTitle = this.add.text(0, -105, 'SELL', {
            fontSize: '20px', fill: '#c9a84c', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);
        this.sellInfo = this.add.text(0, -72, '', {
            fontSize: '13px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const btnData = [
            { label: '1', qty: 1, y: -28 },
            { label: '10', qty: 10, y: 8 },
            { label: '50', qty: 50, y: 44 },
            { label: 'ALL', qty: -1, y: 80 },
        ];

        this.sellQuickBtns = [];
        btnData.forEach(d => {
            const rect = this.add.rectangle(-50, d.y, 80, 28, 0x1a1a28).setInteractive();
            const txt = this.add.text(-50, d.y, d.label, {
                fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0.5);
            rect.on('pointerover', () => rect.setFillStyle(0x252535));
            rect.on('pointerout', () => rect.setFillStyle(0x1a1a28));
            rect.on('pointerdown', () => {
                this.justClickedModal = true;
                this.confirmSell(d.qty);
            });
            this.sellQuickBtns.push({ rect, text: txt });
        });

        this.sellCustomLabel = this.add.text(70, -28, 'CUSTOM', {
            fontSize: '12px', fill: '#444444', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.sellCustomBg = this.add.rectangle(70, 8, 100, 28, 0x151520).setStrokeStyle(1, 0x333344);
        this.sellCustomText = this.add.text(70, 8, '0', {
            fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const minusBtn = this.add.rectangle(20, 8, 32, 32, 0x1a1a28).setInteractive();
        const minusTxt = this.add.text(20, 8, '-', { fontSize: '14px', fill: '#cccccc' }).setOrigin(0.5).setInteractive();
        const dec = () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            if (val > 0) this.sellCustomText.setText(String(val - 1));
        };
        minusBtn.on('pointerdown', dec);
        minusTxt.on('pointerdown', dec);

        const plusBtn = this.add.rectangle(120, 8, 32, 32, 0x1a1a28).setInteractive();
        const plusTxt = this.add.text(120, 8, '+', { fontSize: '14px', fill: '#cccccc' }).setOrigin(0.5).setInteractive();
        const inc = () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            const max = this.pendingSellGem ? (this.shipInventory[this.pendingSellGem] || 0) : 0;
            if (val < max) this.sellCustomText.setText(String(val + 1));
        };
        plusBtn.on('pointerdown', inc);
        plusTxt.on('pointerdown', inc);

        const sellCustomBtn = this.add.rectangle(70, 50, 100, 26, 0x224422).setInteractive();
        const sellCustomTxt = this.add.text(70, 50, 'SELL', {
            fontSize: '12px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);
        sellCustomBtn.on('pointerover', () => sellCustomBtn.setFillStyle(0x335533));
        sellCustomBtn.on('pointerout', () => sellCustomBtn.setFillStyle(0x224422));
        sellCustomBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            const qty = parseInt(this.sellCustomText.text) || 0;
            if (qty > 0) this.confirmSell(qty);
        });

        const cancelBtn = this.add.rectangle(0, 110, 120, 26, 0x1a1a28).setInteractive();
        const cancelTxt = this.add.text(0, 110, 'CLOSE', {
            fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x252535));
        cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x1a1a28));
        cancelBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeSellPopup();
        });

        this.sellPopup.add([
            bg, this.sellTitle, this.sellInfo,
            ...this.sellQuickBtns.map(b => [b.rect, b.text]).flat(),
            this.sellCustomLabel, this.sellCustomBg, this.sellCustomText,
            minusBtn, minusTxt, plusBtn, plusTxt,
            sellCustomBtn, sellCustomTxt,
            cancelBtn, cancelTxt
        ]);
    }

    openSellPopup(gemName, count, price) {
        this.pendingSellGem = gemName;
        this.sellTitle.setText(`SELL ${gemName.toUpperCase()}`);
        this.sellInfo.setText(`Have: ${count}  |  ${price}cr each  |  Max: ${count * price}cr`);
        this.sellCustomText.setText('0');
        this.sellPopup.setVisible(true);
    }

    closeSellPopup() {
        this.sellPopup.setVisible(false);
        this.pendingSellGem = null;
    }

    confirmSell(qty) {
        if (!this.panelSellMode) return;
        const gemName = this.panelSellMode;
        const count = this.shipInventory[gemName] || 0;
        const price = this.gemPrices[gemName];
        if (qty === -1) qty = count;
        qty = Math.min(qty, count);
        if (qty <= 0) return;

        this.shipInventory[gemName] -= qty;
        if (this.shipInventory[gemName] <= 0) delete this.shipInventory[gemName];
        const revenue = qty * price;
        this.credits += revenue;

        // Sell celebration — coin sound + floating credit text
        this.playSellSound();
        this.showSellFloatText(revenue);

        this.panelSellCustom = 0;
        if ((this.shipInventory[gemName] || 0) <= 0) {
            this.panelSellMode = null; // auto-exit sell mode if none left
        }
        this.updateUI();
        if (this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room && room.type === 'trade') this.openRoomControlsPanel(room);
        }
    }

    playSellSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Two quick ascending sine pings — classic coin register sound
        const ping1 = ctx.createOscillator();
        ping1.type = 'sine';
        ping1.frequency.setValueAtTime(880, now);
        ping1.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.08, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        ping1.connect(g1);
        g1.connect(ctx.destination);
        ping1.start(now);
        ping1.stop(now + 0.08);

        const ping2 = ctx.createOscillator();
        ping2.type = 'sine';
        ping2.frequency.setValueAtTime(1200, now + 0.06);
        ping2.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.06, now + 0.06);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        ping2.connect(g2);
        g2.connect(ctx.destination);
        ping2.start(now + 0.06);
        ping2.stop(now + 0.14);
    }

    playBuildSound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Low filtered noise — heavy mechanical thunk
        const bufferSize = Math.floor(ctx.sampleRate * 0.1);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nf = ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.value = 600;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.1, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        noise.connect(nf);
        nf.connect(ng);
        ng.connect(ctx.destination);
        noise.start(now);

        // Short descending triangle — metallic lock/clunk
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.08, now);
        og.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(og);
        og.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playDestroySound() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const dur = 0.18;

        // Low rumbling noise — structural collapse / debris falling
        const bufferSize = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nf = ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.setValueAtTime(400, now);
        nf.frequency.exponentialRampToValueAtTime(150, now + dur);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.12, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
        noise.connect(nf);
        nf.connect(ng);
        ng.connect(ctx.destination);
        noise.start(now);

        // Descending sawtooth — metallic structure tearing / groaning
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + dur * 0.7);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.06, now);
        og.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(og);
        og.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur);

        // Short highpass noise burst —碎片 / spark scatter
        const burstSize = Math.floor(ctx.sampleRate * 0.08);
        const burstBuf = ctx.createBuffer(1, burstSize, ctx.sampleRate);
        const burstData = burstBuf.getChannelData(0);
        for (let i = 0; i < burstSize; i++) {
            burstData[i] = (Math.random() * 2 - 1) * (1 - i / burstSize);
        }
        const burst = ctx.createBufferSource();
        burst.buffer = burstBuf;
        const burstF = ctx.createBiquadFilter();
        burstF.type = 'highpass';
        burstF.frequency.value = 2000;
        const burstG = ctx.createGain();
        burstG.gain.setValueAtTime(0.04, now);
        burstG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        burst.connect(burstF);
        burstF.connect(burstG);
        burstG.connect(ctx.destination);
        burst.start(now);
    }

    showSellFloatText(revenue) {
        const label = this.add.text(1200, 60, `+${revenue}cr`, {
            fontSize: '14px', fill: '#c9a84c', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
        this.tweens.add({
            targets: label,
            y: label.y - 30,
            alpha: 0,
            duration: 900,
            ease: 'Power1',
            onComplete: () => label.destroy()
        });
    }

    createTechTreePopup() {
        this.techPopup = this.add.container(640, 360);
        this.techPopup.setVisible(false);
        this.techPopup.setDepth(12);

        this.techBg = this.add.rectangle(0, 0, 460, 440, 0x0c0c18, 0.98).setOrigin(0.5);
        this.techBg.setStrokeStyle(1, 0x222233);
        this.techTitle = this.add.text(0, -210, 'TECH TREE', {
            fontSize: '20px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);

        this.techFuelTab = this.add.rectangle(-150, -182, 130, 26, 0x1a1a28).setInteractive();
        this.techFuelTabText = this.add.text(-150, -182, 'FUEL TANK', {
            fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techEffTab = this.add.rectangle(0, -182, 130, 26, 0x111118).setInteractive();
        this.techEffTabText = this.add.text(0, -182, 'EFFICIENCY', {
            fontSize: '11px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techDroneTab = this.add.rectangle(150, -182, 130, 26, 0x111118).setInteractive();
        this.techDroneTabText = this.add.text(150, -182, 'DRONE RANGE', {
            fontSize: '11px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.techFuelTab.on('pointerdown', () => {
            this.justClickedModal = true;
            this.switchTechTab('fuelTank');
        });
        this.techEffTab.on('pointerdown', () => {
            this.justClickedModal = true;
            this.switchTechTab('efficiency');
        });
        this.techDroneTab.on('pointerdown', () => {
            this.justClickedModal = true;
            this.switchTechTab('droneRange');
        });

        this.techSubtitle = this.add.text(0, -152, '', {
            fontSize: '12px', fill: '#c9a84c', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techContent = this.add.container(0, 0);

        const closeBtn = this.add.rectangle(0, 208, 120, 26, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(0, 208, 'CLOSE', {
            fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x252535));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeTechTreePopup();
        });

        this.techPopup.add([
            this.techBg, this.techTitle, this.techSubtitle, this.techContent,
            this.techFuelTab, this.techFuelTabText, this.techEffTab, this.techEffTabText,
            this.techDroneTab, this.techDroneTabText,
            closeBtn, closeTxt
        ]);
        this.techTab = 'fuelTank';
    }

    switchTechTab(tab) {
        this.techTab = tab;
        const tabs = {
            fuelTank: { btn: this.techFuelTab, text: this.techFuelTabText },
            efficiency: { btn: this.techEffTab, text: this.techEffTabText },
            droneRange: { btn: this.techDroneTab, text: this.techDroneTabText },
        };
        Object.entries(tabs).forEach(([key, { btn, text }]) => {
            if (key === tab) {
                btn.setFillStyle(0x1a1a28);
                text.setFill('#cccccc');
            } else {
                btn.setFillStyle(0x111118);
                text.setFill('#666666');
            }
        });
        this.openTechTreePopup();
    }

    openTechTreePopup() {
        this.techContent.removeAll(true);

        const branch = this.techTab;
        const currentLevel = this.techState[branch + 'Level'] || 0;
        const levels = this.techTree[branch];

        if (branch === 'fuelTank') {
            const baseFuel = 25;
            const currentMax = baseFuel + currentLevel;
            this.techSubtitle.setText(`Fuel Tank: ${currentMax}L (base ${baseFuel}L + ${currentLevel})`);
        } else if (branch === 'efficiency') {
            const baseCost = 50;
            const currentCost = Math.max(40, baseCost - currentLevel);
            this.techSubtitle.setText(`Efficiency: ${currentCost}ml/tile (base ${baseCost}ml − ${currentLevel})`);
        } else if (branch === 'droneRange') {
            const baseRange = 2;
            const currentRange = baseRange + currentLevel;
            this.techSubtitle.setText(`Drone Range: ${currentRange} cells (base ${baseRange} + ${currentLevel})`);
        }

        let y = -128;
        levels.forEach((lvl, i) => {
            const isUnlocked = i < currentLevel;
            const isNext = i === currentLevel;

            let costText = Object.entries(lvl.cost)
                .map(([mat, qty]) => `${mat}: ${qty.toLocaleString()}`)
                .join(', ');

            const statusText = isUnlocked ? '✓' : (isNext ? '→' : '−');
            const textColor = isUnlocked ? '#44aa66' : (isNext ? '#cccccc' : '#444444');
            const bonusLabel = branch === 'fuelTank' ? `+${lvl.bonus}L` : branch === 'efficiency' ? `−${lvl.bonus}ml` : `+${lvl.bonus} cell`;

            const label = this.add.text(-210, y, `Lv${lvl.level}  ${bonusLabel}`, {
                fontSize: '12px', fill: textColor, fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const cost = this.add.text(-130, y, costText, {
                fontSize: '10px', fill: isUnlocked ? '#44aa66' : '#888888', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            if (isNext) {
                const canAfford = this.canAffordTech(lvl.cost);
                const btnColor = canAfford ? 0x224422 : 0x151515;
                const btnText = canAfford ? 'UPGRADE' : 'CANT';
                const btnTxtColor = canAfford ? '#cccccc' : '#444444';

                const btn = this.add.rectangle(170, y, 90, 22, btnColor).setInteractive();
                const btnLabel = this.add.text(170, y, btnText, {
                    fontSize: '10px', fill: btnTxtColor, fontFamily: 'monospace'
                }).setOrigin(0.5);

                if (canAfford) {
                    btn.on('pointerover', () => btn.setFillStyle(0x335533));
                    btn.on('pointerout', () => btn.setFillStyle(0x224422));
                    btn.on('pointerdown', () => {
                        this.justClickedModal = true;
                        this.doUpgrade(branch, lvl);
                    });
                }

                this.techContent.add([label, cost, btn, btnLabel]);
            } else {
                const status = this.add.text(170, y, statusText, {
                    fontSize: '11px', fill: textColor, fontFamily: 'monospace'
                }).setOrigin(0.5);
                this.techContent.add([label, cost, status]);
            }

            y += 34;
        });

        this.techPopup.setVisible(true);
    }

    closeTechTreePopup() {
        this.techPopup.setVisible(false);
    }

    canAffordTech(cost) {
        for (const [mat, qty] of Object.entries(cost)) {
            if (mat === 'credits') {
                if (this.credits < qty) return false;
            } else {
                if ((this.shipInventory[mat] || 0) < qty) return false;
            }
        }
        return true;
    }

    doUpgrade(branch, level) {
        if (!this.canAffordTech(level.cost)) return;
        for (const [mat, qty] of Object.entries(level.cost)) {
            if (mat === 'credits') {
                this.credits -= qty;
            } else {
                this.shipInventory[mat] -= qty;
                if (this.shipInventory[mat] <= 0) delete this.shipInventory[mat];
            }
        }
        this.techState[branch + 'Level'] = level.level;
        this.updateUI();
        this.openTechTreePopup();
    }

    createBuildModal() {
        this.buildModal = this.add.container(640, 360);
        this.buildModal.setVisible(false);
        this.buildModal.setDepth(12);

        const bg = this.add.rectangle(0, 0, 520, 420, 0x0c0c18, 0.98).setOrigin(0.5);
        bg.setStrokeStyle(1, 0x222233);
        const title = this.add.text(0, -190, 'BUILD ROOMS', {
            fontSize: '18px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -164, 'Select a room, then click the grid to place', {
            fontSize: '11px', fill: '#444444', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.buildModalContent = this.add.container(0, 0);
        this.buildModal.add([bg, title, subtitle, this.buildModalContent]);

        const closeBtn = this.add.rectangle(220, -190, 50, 22, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(220, -190, 'X', {
            fontSize: '12px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x252535));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => this.closeBuildModal());
        this.buildModal.add([closeBtn, closeTxt]);
    }

    openBuildModal() {
        this.buildModalContent.removeAll(true);
        const buildables = Object.entries(this.roomTypes).filter(([_, def]) => def.cost > 0);
        const perRow = 3;
        const cardW = 150;
        const cardH = 70;
        const gapX = 12;
        const gapY = 12;
        const startX = -((perRow * cardW + (perRow - 1) * gapX) / 2) + cardW / 2;
        const startY = -140 + cardH / 2;

        buildables.forEach(([key, def], i) => {
            const row = Math.floor(i / perRow);
            const col = i % perRow;
            const cx = startX + col * (cardW + gapX);
            const cy = startY + row * (cardH + gapY);

            const card = this.add.rectangle(cx, cy, cardW, cardH, 0x151520).setInteractive();
            card.setStrokeStyle(1, 0x222233);

            const icon = this.add.text(cx - cardW / 2 + 14, cy - 10, def.icon, {
                fontSize: '22px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const name = this.add.text(cx - cardW / 2 + 36, cy - 10, def.name, {
                fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const cost = this.add.text(cx - cardW / 2 + 14, cy + 14, `${def.cost}cr  ${def.size}×${def.size}`, {
                fontSize: '10px', fill: '#c9a84c', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            card.on('pointerover', () => {
                card.setFillStyle(0x1e1e2e);
                card.setStrokeStyle(1, def.color);
            });
            card.on('pointerout', () => {
                card.setFillStyle(0x151520);
                card.setStrokeStyle(1, 0x222233);
            });
            card.on('pointerdown', (pointer) => {
                pointer.event.stopPropagation();
                this.selectedRoom = key;
                this.buildMode = true;
                this.selectedRoomCell = null;
                this.drawShipGrid();
                this.closeBuildModal();
                this.justSelectedBuild = true;
            });

            this.buildModalContent.add([card, icon, name, cost]);
        });

        this.buildModal.setVisible(true);
    }

    closeBuildModal() {
        this.buildModal.setVisible(false);
    }

    createResetConfirmPopup() {
        this.resetPopup = this.add.container(640, 360);
        this.resetPopup.setVisible(false);
        this.resetPopup.setDepth(15);

        const bg = this.add.rectangle(0, 0, 400, 170, 0x0c0c18, 0.98).setOrigin(0.5);
        bg.setStrokeStyle(1, 0x552222);

        const title = this.add.text(0, -50, 'RESET SAVE', {
            fontSize: '18px', fill: '#cc4444', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);

        const warning = this.add.text(0, -14, 'This erases all progress.\nShip, inventory, credits, tech.', {
            fontSize: '12px', fill: '#555555', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5);

        const yesBtn = this.add.rectangle(-70, 40, 110, 28, 0x442222).setInteractive();
        const yesTxt = this.add.text(-70, 40, 'ERASE', {
            fontSize: '11px', fill: '#cc8888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        yesBtn.on('pointerover', () => yesBtn.setFillStyle(0x553333));
        yesBtn.on('pointerout', () => yesBtn.setFillStyle(0x442222));
        yesBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.confirmReset();
        });

        const noBtn = this.add.rectangle(70, 40, 110, 28, 0x1a1a28).setInteractive();
        const noTxt = this.add.text(70, 40, 'CANCEL', {
            fontSize: '11px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        noBtn.on('pointerover', () => noBtn.setFillStyle(0x252535));
        noBtn.on('pointerout', () => noBtn.setFillStyle(0x1a1a28));
        noBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeResetPopup();
        });

        this.resetPopup.add([bg, title, warning, yesBtn, yesTxt, noBtn, noTxt]);
    }

    openResetPopup() {
        this.resetPopup.setVisible(true);
    }

    closeResetPopup() {
        this.resetPopup.setVisible(false);
    }

    confirmReset() {
        localStorage.removeItem('miners_save');
        this.closeResetPopup();
        this.scene.restart({});
    }

    createButton(x, y, text, callback, w = 280, h = 40) {
        const btn = this.add.rectangle(x, y, w, h, 0x444466);
        btn.setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(0x666688));
        btn.on('pointerout', () => btn.setFillStyle(0x444466));
        btn.on('pointerdown', callback);
        return { rect: btn, text: label };
    }

    updateUI() {
        this.statusFuel.setText(`⛽ ${this.shipFuel.toFixed(1)} / ${this.shipFuelCapacity.toFixed(1)}L  (~${Math.floor(this.shipFuel / 25)} runs)`);
        const totalScience = Object.values(this.mechState.science || {}).reduce((a, b) => a + (b || 0), 0);
        this.statusScience.setText(`🔬 ${totalScience} SCIENCE`);
        this.statusCredits.setText(`${this.credits.toLocaleString()} cr 💰`);
        const chassisNames = { scout: 'Scout', miner: 'Miner', heavy: 'Heavy' };
        const active = this.mechState.activeChassis || 'scout';
        this.statusMech.setText(`🦾 ${chassisNames[active]}`);
        // Update ship fuel bar fill
        const fuelPct = Math.max(0, Math.min(1, this.shipFuel / this.shipFuelCapacity));
        const maxFillW = 218;
        this.shipFuelBarFill.width = maxFillW * fuelPct;
        const r = Math.floor(255);
        const g = Math.floor(140 * fuelPct);
        this.shipFuelBarFill.setFillStyle(Phaser.Display.Color.GetColor(r, g, 0));
    }

    calculatePower() {
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerCapacity = 0;
        this.shipFuelCapacity = 100;

        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const room = this.shipGrid[x][y];
                if (!room) continue;
                const def = this.roomTypes[room.type];
                if (def.power) this.powerGen += def.power;
                if (def.power < 0) this.powerUse += Math.abs(def.power);
                if (def.powerCap) this.powerCapacity += def.powerCap;
                if (def.fuelCap) this.shipFuelCapacity += def.fuelCap;
            }
        }
        if (this.powerGen > this.powerUse) {
            this.powerStored = Math.min(this.powerCapacity, this.powerStored + (this.powerGen - this.powerUse));
        }
    }

    destroyRoom(room) {
        const def = this.roomTypes[room.type];
        const size = def.size;
        const mx = room.masterX;
        const my = room.masterY;
        const refund = Math.floor(def.cost * 0.5);

        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                this.shipGrid[mx + dx][my + dy] = null;
            }
        }

        this.credits += refund;
        this.playDestroySound();
        this.selectedRoomCell = null;
        this.calculatePower();
        this.updateUI();
        this.drawShipGrid();
    }

    placeRoom(gx, gy, type) {
        const def = this.roomTypes[type];
        if (!def) return false;
        const size = def.size;
        if (gx + size > this.gridW || gy + size > this.gridH) return false;
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                if (this.shipGrid[gx + dx][gy + dy]) return false;
            }
        }
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                this.shipGrid[gx + dx][gy + dy] = { type, masterX: gx, masterY: gy };
            }
        }
        return true;
    }

    // ─── MECH CONFIGURATION ───

    getChassisDefs() {
        return {
            scout: { name: 'Scout', size: '1×2', baseFuel: 15, fuelBurn: 0.030, maxDepth: 180, slots: 2, cost: 0, desc: 'Light and nimble' },
            miner: { name: 'Miner', size: '2×2', baseFuel: 25, fuelBurn: 0.050, maxDepth: 350, slots: 3, cost: 500, desc: 'Balanced workhorse' },
            heavy: { name: 'Heavy', size: '2×3', baseFuel: 40, fuelBurn: 0.075, maxDepth: 700, slots: 4, cost: 500, desc: 'Deep diver' },
        };
    }

    createMechConfigModal() {
        this.mechModal = this.add.container(640, 360);
        this.mechModal.setVisible(false);
        this.mechModal.setDepth(20);

        const bg = this.add.rectangle(0, 0, 560, 520, 0x0c0c18, 0.98).setOrigin(0.5);
        bg.setStrokeStyle(2, 0x00d4aa);
        const title = this.add.text(0, -240, 'MECH CONFIGURATION', {
            fontSize: '20px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 3
        }).setOrigin(0.5);

        this.mechContent = this.add.container(0, 0);
        this.mechModal.add([bg, title, this.mechContent]);

        // Close button
        const closeBtn = this.add.rectangle(250, -240, 40, 20, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(250, -240, '✕', { fontSize: '12px', fill: '#666666' }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x333344));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeMechConfigModal();
        });
        this.mechModal.add([closeBtn, closeTxt]);
    }

    openMechConfigModal() {
        if (this.mechModal) {
            this.mechModal.destroy();
            this.mechModal = null;
        }
        this.createMechConfigModal();
        this.renderMechConfig();
        this.mechModal.setVisible(true);
    }

    closeMechConfigModal() {
        if (this.mechModal) this.mechModal.setVisible(false);
    }

    renderMechConfig() {
        this.mechContent.removeAll(true);
        const defs = this.getChassisDefs();
        const state = this.mechState;
        const active = state.activeChassis;

        let y = -200;

        // ── Chassis Selection ──
        const chassisTitle = this.add.text(0, y, 'CHASSIS', {
            fontSize: '12px', fill: '#555555', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);
        this.mechContent.add(chassisTitle);
        y += 30;

        Object.entries(defs).forEach(([key, def], i) => {
            const x = -180 + i * 180;
            const unlocked = state.unlockedChassis.includes(key);
            const isActive = active === key;
            const canAfford = this.credits >= def.cost;

            const card = this.add.rectangle(x, y, 160, 90, isActive ? 0x1a2a2a : 0x151520).setInteractive();
            card.setStrokeStyle(2, isActive ? 0x00d4aa : 0x222233);

            const name = this.add.text(x, y - 28, def.name, {
                fontSize: '13px', fill: isActive ? '#00d4aa' : '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0.5);

            const stats = this.add.text(x, y - 2, `${def.size} | ${def.baseFuel}L | ${def.maxDepth}m`, {
                fontSize: '10px', fill: '#666666', fontFamily: 'monospace'
            }).setOrigin(0.5);

            const desc = this.add.text(x, y + 16, def.desc, {
                fontSize: '9px', fill: '#444444', fontFamily: 'monospace'
            }).setOrigin(0.5);

            let statusText;
            if (isActive) {
                statusText = this.add.text(x, y + 36, 'SELECTED', { fontSize: '10px', fill: '#00d4aa' }).setOrigin(0.5);
            } else if (!unlocked) {
                statusText = this.add.text(x, y + 36, `BUY ${def.cost}cr`, {
                    fontSize: '10px', fill: canAfford ? '#c9a84c' : '#554433'
                }).setOrigin(0.5);
            } else {
                statusText = this.add.text(x, y + 36, 'CLICK TO SELECT', {
                    fontSize: '10px', fill: '#666666'
                }).setOrigin(0.5);
            }

            card.on('pointerover', () => {
                if (!isActive) card.setFillStyle(0x1a1a2a);
            });
            card.on('pointerout', () => {
                card.setFillStyle(isActive ? 0x1a2a2a : 0x151520);
            });
            card.on('pointerdown', () => {
                this.justClickedModal = true;
                if (isActive) return;
                if (!unlocked) {
                    if (canAfford) {
                        this.credits -= def.cost;
                        state.unlockedChassis.push(key);
                        state.activeChassis = key;
                        state.modules = []; // reset modules on chassis change
                        this.updateUI();
                        this.saveGame();
                        this.renderMechConfig();
                    }
                    return;
                }
                state.activeChassis = key;
                state.modules = []; // reset modules on chassis change
                this.saveGame();
                this.renderMechConfig();
            });

            this.mechContent.add([card, name, stats, desc, statusText]);
        });

        y += 70;

        // ── Module Slots ──
        const activeDef = defs[active];
        const slotCount = activeDef.slots;
        const modTitle = this.add.text(0, y, `MODULES (${state.modules.length}/${slotCount})`, {
            fontSize: '12px', fill: '#555555', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);
        this.mechContent.add(modTitle);
        y += 30;

        // Module slot boxes
        for (let i = 0; i < slotCount; i++) {
            const x = -120 + i * 80;
            const mod = state.modules[i];
            const hasMod = !!mod;

            const slot = this.add.rectangle(x, y, 70, 50, hasMod ? 0x1a251a : 0x151515).setInteractive();
            slot.setStrokeStyle(2, hasMod ? 0x44aa44 : 0x222233);

            const label = this.add.text(x, y, hasMod ? (mod === 'fuel' ? '+10L' : 'DRONE') : 'EMPTY', {
                fontSize: hasMod ? '11px' : '10px',
                fill: hasMod ? '#88cc88' : '#333333',
                fontFamily: 'monospace'
            }).setOrigin(0.5);

            if (hasMod) {
                slot.on('pointerdown', () => {
                    this.justClickedModal = true;
                    state.modules.splice(i, 1);
                    this.saveGame();
                    this.renderMechConfig();
                });
                slot.on('pointerover', () => slot.setFillStyle(0x2a352a));
                slot.on('pointerout', () => slot.setFillStyle(0x1a251a));
            }

            this.mechContent.add([slot, label]);
        }

        y += 45;

        // ── Add Module Buttons ──
        if (state.modules.length < slotCount) {
            const fuelBtn = this.createMechModuleButton(-80, y, '⛽ FUEL TANK +10L', () => {
                state.modules.push('fuel');
                this.saveGame();
                this.renderMechConfig();
            }, 0x1a1a15, '#cc8844');
            const droneBtn = this.createMechModuleButton(80, y, '🤖 DRONE', () => {
                state.modules.push('drone');
                this.saveGame();
                this.renderMechConfig();
            }, 0x15151a, '#8888cc');
            this.mechContent.add([fuelBtn.rect, fuelBtn.text, droneBtn.rect, droneBtn.text]);
        }
        y += 45;

        // ── Stats Summary ──
        const totalFuel = activeDef.baseFuel + state.modules.filter(m => m === 'fuel').length * 10;
        const droneCount = state.modules.filter(m => m === 'drone').length;
        const summary = this.add.text(0, y,
            `Fuel Capacity: ${totalFuel}L  |  Drones: ${droneCount}  |  Burn: ${(activeDef.fuelBurn * 1000).toFixed(0)}ml/tile`, {
            fontSize: '11px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.mechContent.add(summary);
        y += 50;

        // ── Launch Button ──
        const launchBtn = this.add.rectangle(0, y, 200, 40, 0x1a2a2a).setInteractive();
        const launchTxt = this.add.text(0, y, 'PROCEED TO GALAXY', {
            fontSize: '13px', fill: '#44aa88', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);
        launchBtn.setStrokeStyle(2, 0x44aa88);
        launchBtn.on('pointerover', () => launchBtn.setFillStyle(0x2a3a3a));
        launchBtn.on('pointerout', () => launchBtn.setFillStyle(0x1a2a2a));
        launchBtn.on('pointerdown', () => {
            this.justClickedModal = true;
            this.closeMechConfigModal();
            this.launchTime = Date.now();
            this.saveGame();
            this.cameras.main.fadeOut(150, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('GalaxyScene', {
                    shipGrid: this.shipGrid, shipInventory: this.shipInventory,
                    credits: this.credits, shipFuel: this.shipFuel, shipFuelCapacity: this.shipFuelCapacity,
                    rockCompositions: this.rockCompositions,
                    techState: this.techState,
                    processingQueues: this.processingQueues,
                    mechState: this.mechState,
                    launchTime: this.launchTime,
                });
            });
        });
        this.mechContent.add([launchBtn, launchTxt]);
    }

    createMechModuleButton(x, y, text, callback, color, textColor) {
        const rect = this.add.rectangle(x, y, 140, 32, color).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '10px', fill: textColor, fontFamily: 'monospace'
        }).setOrigin(0.5);
        rect.on('pointerover', () => rect.setFillStyle(color + 0x111111));
        rect.on('pointerout', () => rect.setFillStyle(color));
        rect.on('pointerdown', () => {
            this.justClickedModal = true;
            callback();
        });
        return { rect, text: label };
    }
}

if (typeof window !== 'undefined') {
    window.ShipScene = ShipScene;
}
