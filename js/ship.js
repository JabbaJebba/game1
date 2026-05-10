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
        this.techState = data.techState || { fuelTankLevel: 0, efficiencyLevel: 0 };
        this.processingQueues = data.processingQueues || {};
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

        // Title
        this.add.text(640, 28, 'SHIP COMMAND', {
            fontSize: '16px', fill: '#445566', fontFamily: 'monospace', letterSpacing: 6
        }).setOrigin(0.5);

        // Status bar
        this.statusFuel = this.add.text(80, 60, '', {
            fontSize: '13px', fill: '#cc8844', fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
        this.statusCredits = this.add.text(1200, 60, '', {
            fontSize: '13px', fill: '#c9a84c', fontFamily: 'monospace'
        }).setOrigin(1, 0.5);

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
            ]
        };

        this.recipes = {
            smelter: [
                { id: 'copper_ingot', name: 'Copper Ingot', input: { 'Copper Ore': 3 }, output: { 'Copper Ingot': 1 }, time: 3000 },
                { id: 'iron_ingot', name: 'Iron Ingot', input: { 'Iron Ore': 3 }, output: { 'Iron Ingot': 1 }, time: 3000 },
                { id: 'gold_ingot', name: 'Gold Ingot', input: { 'Gold Ore': 3 }, output: { 'Gold Ingot': 1 }, time: 3000 },
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
        this.createRoomControlsModal();
        this.createInventoryModal();
        this.createGhostGraphics();
        this.createResetConfirmPopup();

        this.calculatePower();
        this.updateUI();
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
            this.closeRoomControlsModal();
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
                    this.openRoomControlsModal(selRoom);
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

        // Refresh processing modal UI periodically so progress bar animates
        if (this.roomModal.visible && this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room && this.recipes[room.type]) {
                if (!this.lastModalRefresh || now - this.lastModalRefresh > 150) {
                    this.lastModalRefresh = now;
                    this.openRoomControlsModal(room);
                }
            }
        }
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
            launchTime: this.launchTime,
        };
        localStorage.setItem('miners_save', JSON.stringify(saveData));
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
        if (!this.buildMode || !this.selectedRoom) return;
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
    }

    handleGridClick(pointer) {
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
            this.drawShipGrid();
            this.openRoomControlsModal(room);
        } else {
            this.selectedRoomCell = null;
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
            this.launchTime = Date.now();
            this.saveGame();
            this.scene.start('GalaxyScene', {
                shipGrid: this.shipGrid, shipInventory: this.shipInventory,
                credits: this.credits, shipFuel: this.shipFuel, shipFuelCapacity: this.shipFuelCapacity,
                rockCompositions: this.rockCompositions,
                techState: this.techState,
                processingQueues: this.processingQueues,
                launchTime: this.launchTime,
            });
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
        closeBtn.on('pointerdown', () => this.closeInventoryModal());

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

    createRoomControlsModal() {
        this.roomModal = this.add.container(640, 360);
        this.roomModal.setVisible(false);
        this.roomModal.setDepth(10);

        this.roomModalBg = this.add.rectangle(0, 0, 420, 620, 0x0c0c18, 0.98).setOrigin(0.5);
        this.roomModalBg.setStrokeStyle(1, 0x222233);
        this.roomModalTitle = this.add.text(0, -240, '', {
            fontSize: '18px', fill: '#00d4aa', fontFamily: 'monospace', letterSpacing: 2
        }).setOrigin(0.5);
        this.roomModalSubtitle = this.add.text(0, -210, '', {
            fontSize: '11px', fill: '#555555', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.roomModalContent = this.add.text(0, -170, '', {
            fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace', lineSpacing: 4, align: 'center'
        }).setOrigin(0.5, 0);
        this.roomModalButtons = this.add.container(0, 0);

        const closeBtn = this.add.rectangle(0, 280, 120, 28, 0x1a1a28).setInteractive();
        const closeTxt = this.add.text(0, 280, 'CLOSE', {
            fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0x252535));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x1a1a28));
        closeBtn.on('pointerdown', () => this.closeRoomControlsModal());

        this.roomModal.add([
            this.roomModalBg, this.roomModalTitle, this.roomModalSubtitle,
            this.roomModalContent, this.roomModalButtons, closeBtn, closeTxt
        ]);
        this.roomModalControlBtns = [];
    }

    openRoomControlsModal(room) {
        const def = this.roomTypes[room.type];
        this.roomModalButtons.removeAll(true);
        this.roomModalControlBtns = [];

        this.roomModalTitle.setText(`${def.icon}  ${def.name.toUpperCase()}`);
        this.roomModalSubtitle.setText(`${def.size}×${def.size}  |  ${def.cost > 0 ? def.cost + 'cr' : 'Free'}  |  ${def.power > 0 ? '+' + def.power + ' power' : def.powerCap ? '+' + def.powerCap + ' storage' : def.fuelCap ? '+' + def.fuelCap + 'L fuel' : ''}`);
        this.roomModalContent.setText('');

        if (room.type === 'trade') {
            let lines = ['─ GEMS ─'];
            const gemNames = ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'];
            gemNames.forEach(gemName => {
                const count = this.shipInventory[gemName] || 0;
                const price = this.gemPrices[gemName];
                lines.push(`  ${gemName}: ${count}  @${price}cr`);
            });
            lines.push('');
            lines.push('─ FUEL ─');
            Object.entries(this.fuelPrices).forEach(([amount, cost]) => {
                lines.push(`  +${amount}L  —  ${cost}cr`);
            });
            this.roomModalContent.setText(lines.join('\n'));

            let y = 40;
            gemNames.forEach(gemName => {
                const count = this.shipInventory[gemName] || 0;
                if (count > 0) {
                    const price = this.gemPrices[gemName];
                    const btn = this.createModalButton(0, y, `SELL ${gemName}`, () => this.openSellPopup(gemName, count, price), 200, 28, 0x224422, '#88cc88');
                    this.roomModalControlBtns.push(btn);
                    y += 36;
                }
            });

            y += 8;
            Object.entries(this.fuelPrices).forEach(([amount, cost]) => {
                const btn = this.createModalButton(0, y, `BUY ${amount}L FUEL — ${cost}cr`, () => {
                    if (this.credits >= cost && this.shipFuel + parseInt(amount) <= this.shipFuelCapacity) {
                        this.credits -= cost;
                        this.shipFuel = Math.min(this.shipFuelCapacity, this.shipFuel + parseInt(amount));
                        this.updateUI();
                        this.openRoomControlsModal(room);
                    }
                }, 200, 28, 0x222244, '#8888cc');
                this.roomModalControlBtns.push(btn);
                y += 36;
            });

        } else if (room.type === 'fuelTank') {
            this.roomModalContent.setText(
                `Stored: ${this.shipFuel.toFixed(1)} / ${this.shipFuelCapacity.toFixed(1)}L\n` +
                `Bonus capacity: +${def.fuelCap}L`
            );

        } else if (room.type === 'crusher') {
            this.renderProcessingModal(room, 'crusher');

        } else if (room.type === 'smelter') {
            this.renderProcessingModal(room, 'smelter');

        } else if (room.type === 'refinery') {
            this.renderProcessingModal(room, 'refinery');

        } else if (room.type === 'drill') {
            this.roomModalContent.setText(
                `Fuel Tank Level: ${this.techState.fuelTankLevel || 0} / 6\n` +
                `Efficiency Level: ${this.techState.efficiencyLevel || 0} / 10`
            );
            const btn = this.createModalButton(0, 40, 'OPEN TECH TREE', () => {
                this.closeRoomControlsModal();
                this.openTechTreePopup();
            }, 200, 28, 0x152525, '#44aa88');
            this.roomModalControlBtns.push(btn);

        } else {
            this.roomModalContent.setText('No controls available.');
        }

        if (def.cost > 0) {
            const refund = Math.floor(def.cost * 0.5);
            const btn = this.createModalButton(0, 260, `DESTROY (+${refund}cr)`, () => {
                this.destroyRoom(room);
                this.closeRoomControlsModal();
            }, 200, 28, 0x2a1515, '#aa5555');
            this.roomModalControlBtns.push(btn);
        }

        this.roomModal.setVisible(true);
    }

    createModalButton(x, y, text, callback, w, h, color, textColor) {
        const rect = this.add.rectangle(x, y, w, h, color).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '11px', fill: textColor, fontFamily: 'monospace'
        }).setOrigin(0.5);
        rect.on('pointerover', () => { rect.setFillStyle(color + 0x111111); label.setFill('#ffffff'); });
        rect.on('pointerout', () => { rect.setFillStyle(color); label.setFill(textColor); });
        rect.on('pointerdown', callback);
        this.roomModalButtons.add([rect, label]);
        return { rect, text: label };
    }

    closeRoomControlsModal() {
        this.roomModal.setVisible(false);
        this.selectedRoomCell = null;
        this.drawShipGrid();
    }

    renderProcessingModal(room, machineType) {
        const recipes = this.recipes[machineType];
        const queue = this.getQueue(room);
        const now = Date.now();

        // ── Active job status ──
        let contentLines = [];
        if (queue.currentJob) {
            const job = queue.currentJob;
            const recipe = job.recipe || recipes.find(r => r.id === job.recipeId);
            const elapsed = now - job.startTime;
            const pct = Math.min(1, elapsed / recipe.time);
            const remaining = Math.ceil(Math.max(0, recipe.time - elapsed) / 1000);
            contentLines.push(`${recipe.name}  —  unit ${job.done + 1} / ${job.amount}`);
            contentLines.push(`${Math.floor(pct * 100)}%  ·  ${remaining}s remaining`);
        } else {
            contentLines.push('IDLE');
        }
        if (queue.pending.length > 0) {
            const totalPending = queue.pending.reduce((s, j) => s + j.amount, 0);
            contentLines.push(`Queue: ${totalPending} pending`);
        }
        this.roomModalContent.setText(contentLines.join('\n'));

        // ── Progress bar ──
        if (queue.currentJob) {
            const job = queue.currentJob;
            const recipe = job.recipe || recipes.find(r => r.id === job.recipeId);
            const elapsed = now - job.startTime;
            const pct = Math.min(1, elapsed / recipe.time);
            const barW = 260;
            const barH = 10;
            const barY = -155;
            const barX = -barW / 2;
            // Border / background
            const barBg = this.add.rectangle(0, barY, barW + 4, barH + 4, 0x111118).setOrigin(0.5);
            barBg.setStrokeStyle(1, 0x333344);
            // Dark fill (unfilled portion background)
            const barDark = this.add.rectangle(0, barY, barW, barH, 0x1a1a28).setOrigin(0.5);
            // Bright fill
            const fillColor = machineType === 'smelter' ? 0xcc8844 : machineType === 'crusher' ? 0xaa8866 : 0x6688aa;
            const barFill = this.add.rectangle(barX + (barW * pct) / 2, barY, barW * pct, barH, fillColor).setOrigin(0.5);
            // Percentage label centered on bar
            const barLabel = this.add.text(0, barY, `${Math.floor(pct * 100)}%`, {
                fontSize: '9px', fill: '#ffffff', fontFamily: 'monospace'
            }).setOrigin(0.5);
            this.roomModalButtons.add([barBg, barDark, barFill, barLabel]);
        }

        let y = -115;
        const rowHeight = 34;
        const maxRows = 7;
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

                    const label = this.add.text(-110, y, rockName, {
                        fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace'
                    }).setOrigin(0, 0.5);
                    const have = this.add.text(30, y, `×${count}`, {
                        fontSize: '10px', fill: '#555555', fontFamily: 'monospace'
                    }).setOrigin(0.5);

                    const minBtn = this.add.rectangle(70, y, 22, 22, 0x1a1a28).setInteractive();
                    const minTxt = this.add.text(70, y, '-', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);
                    const amtTxt = this.add.text(95, y, String(amt), {
                        fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    const plBtn = this.add.rectangle(120, y, 22, 22, 0x1a1a28).setInteractive();
                    const plTxt = this.add.text(120, y, '+', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);

                    minBtn.on('pointerdown', () => {
                        if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsModal(room); }
                    });
                    plBtn.on('pointerdown', () => {
                        if (this.modalAmounts[rowKey] < count) { this.modalAmounts[rowKey]++; this.openRoomControlsModal(room); }
                    });

                    const qBtn = this.createModalButton(165, y, 'QUEUE', () => {
                        const qAmt = this.modalAmounts[rowKey];
                        if (qAmt > 0 && qAmt <= count) {
                            if (this.queueJob(room, recipe, qAmt, { [rockName]: 1 })) {
                                this.modalAmounts[rowKey] = 1;
                                this.openRoomControlsModal(room);
                            }
                        }
                    }, 55, 22, 0x224422, '#88cc88');

                    this.roomModalButtons.add([label, have, minBtn, minTxt, amtTxt, plBtn, plTxt]);
                    this.roomModalControlBtns.push(qBtn);
                    y += rowHeight;
                });
                if (rockTypes.length > maxRows) {
                    const more = this.add.text(0, y, `... ${rockTypes.length - maxRows} more types ...`, {
                        fontSize: '10px', fill: '#444444', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    this.roomModalButtons.add(more);
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

                    const label = this.add.text(-110, y, crushedName, {
                        fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace'
                    }).setOrigin(0, 0.5);
                    const have = this.add.text(30, y, `×${count}`, {
                        fontSize: '10px', fill: '#555555', fontFamily: 'monospace'
                    }).setOrigin(0.5);

                    const minBtn = this.add.rectangle(70, y, 22, 22, 0x1a1a28).setInteractive();
                    const minTxt = this.add.text(70, y, '-', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);
                    const amtTxt = this.add.text(95, y, String(amt), {
                        fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    const plBtn = this.add.rectangle(120, y, 22, 22, 0x1a1a28).setInteractive();
                    const plTxt = this.add.text(120, y, '+', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);

                    minBtn.on('pointerdown', () => {
                        if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsModal(room); }
                    });
                    plBtn.on('pointerdown', () => {
                        if (this.modalAmounts[rowKey] < canMake) { this.modalAmounts[rowKey]++; this.openRoomControlsModal(room); }
                    });

                    const qBtn = this.createModalButton(165, y, 'QUEUE', () => {
                        const qAmt = this.modalAmounts[rowKey];
                        if (qAmt > 0 && qAmt <= canMake) {
                            if (this.queueJob(room, recipe, qAmt, { [crushedName]: 5 })) {
                                this.modalAmounts[rowKey] = 1;
                                this.openRoomControlsModal(room);
                            }
                        }
                    }, 55, 22, 0x224422, '#88cc88');

                    this.roomModalButtons.add([label, have, minBtn, minTxt, amtTxt, plBtn, plTxt]);
                    this.roomModalControlBtns.push(qBtn);
                    y += rowHeight;
                });
                if (crushedList.length > maxRows) {
                    const more = this.add.text(0, y, `... ${crushedList.length - maxRows} more types ...`, {
                        fontSize: '10px', fill: '#444444', fontFamily: 'monospace'
                    }).setOrigin(0.5);
                    this.roomModalButtons.add(more);
                }
                return;
            }

            // ── Smelter (normal recipes) ──
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

            const label = this.add.text(-110, y, recipe.name, {
                fontSize: '11px', fill: '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const inputTxt = Object.entries(recipe.input).map(([m, q]) => `${this.shipInventory[m] || 0}/${q} ${m}`).join('  ');
            const info = this.add.text(-110, y + 12, inputTxt, {
                fontSize: '9px', fill: '#444444', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            const minBtn = this.add.rectangle(70, y, 22, 22, 0x1a1a28).setInteractive();
            const minTxt = this.add.text(70, y, '-', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);
            const amtTxt = this.add.text(95, y, String(amt), {
                fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace'
            }).setOrigin(0.5);
            const plBtn = this.add.rectangle(120, y, 22, 22, 0x1a1a28).setInteractive();
            const plTxt = this.add.text(120, y, '+', { fontSize: '12px', fill: '#888888' }).setOrigin(0.5);

            minBtn.on('pointerdown', () => {
                if (this.modalAmounts[rowKey] > 1) { this.modalAmounts[rowKey]--; this.openRoomControlsModal(room); }
            });
            plBtn.on('pointerdown', () => {
                if (this.modalAmounts[rowKey] < canMake) { this.modalAmounts[rowKey]++; this.openRoomControlsModal(room); }
            });

            const qBtn = this.createModalButton(165, y, 'QUEUE', () => {
                const qAmt = Math.min(this.modalAmounts[rowKey], canMake);
                if (qAmt > 0 && this.queueJob(room, recipe, qAmt)) {
                    this.modalAmounts[rowKey] = 1;
                    this.openRoomControlsModal(room);
                }
            }, 55, 22, canMake > 0 ? 0x224422 : 0x151515, canMake > 0 ? '#88cc88' : '#444444');

            this.roomModalButtons.add([label, info, minBtn, minTxt, amtTxt, plBtn, plTxt]);
            this.roomModalControlBtns.push(qBtn);
            y += rowHeight;
        });
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
            rect.on('pointerdown', () => this.confirmSell(d.qty));
            this.sellQuickBtns.push({ rect, text: txt });
        });

        this.sellCustomLabel = this.add.text(70, -28, 'CUSTOM', {
            fontSize: '12px', fill: '#444444', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.sellCustomBg = this.add.rectangle(70, 8, 100, 28, 0x151520).setStrokeStyle(1, 0x333344);
        this.sellCustomText = this.add.text(70, 8, '0', {
            fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const minusBtn = this.add.rectangle(20, 8, 24, 24, 0x1a1a28).setInteractive();
        const minusTxt = this.add.text(20, 8, '-', { fontSize: '14px', fill: '#cccccc' }).setOrigin(0.5);
        minusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            if (val > 0) this.sellCustomText.setText(String(val - 1));
        });

        const plusBtn = this.add.rectangle(120, 8, 24, 24, 0x1a1a28).setInteractive();
        const plusTxt = this.add.text(120, 8, '+', { fontSize: '14px', fill: '#cccccc' }).setOrigin(0.5);
        plusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            const max = this.pendingSellGem ? (this.shipInventory[this.pendingSellGem] || 0) : 0;
            if (val < max) this.sellCustomText.setText(String(val + 1));
        });

        const sellCustomBtn = this.add.rectangle(70, 50, 100, 26, 0x224422).setInteractive();
        const sellCustomTxt = this.add.text(70, 50, 'SELL', {
            fontSize: '12px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);
        sellCustomBtn.on('pointerover', () => sellCustomBtn.setFillStyle(0x335533));
        sellCustomBtn.on('pointerout', () => sellCustomBtn.setFillStyle(0x224422));
        sellCustomBtn.on('pointerdown', () => {
            const qty = parseInt(this.sellCustomText.text) || 0;
            if (qty > 0) this.confirmSell(qty);
        });

        const cancelBtn = this.add.rectangle(0, 110, 120, 26, 0x1a1a28).setInteractive();
        const cancelTxt = this.add.text(0, 110, 'CLOSE', {
            fontSize: '12px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x252535));
        cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x1a1a28));
        cancelBtn.on('pointerdown', () => this.closeSellPopup());

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
        if (!this.pendingSellGem) return;
        const count = this.shipInventory[this.pendingSellGem] || 0;
        const price = this.gemPrices[this.pendingSellGem];
        if (qty === -1) qty = count;
        qty = Math.min(qty, count);
        if (qty <= 0) return;

        this.shipInventory[this.pendingSellGem] -= qty;
        if (this.shipInventory[this.pendingSellGem] <= 0) delete this.shipInventory[this.pendingSellGem];
        this.credits += qty * price;

        this.closeSellPopup();
        this.updateUI();
        if (this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room && room.type === 'trade') this.openRoomControlsModal(room);
        }
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

        this.techFuelTab = this.add.rectangle(-90, -182, 160, 26, 0x1a1a28).setInteractive();
        this.techFuelTabText = this.add.text(-90, -182, 'FUEL TANK', {
            fontSize: '11px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techEffTab = this.add.rectangle(90, -182, 160, 26, 0x111118).setInteractive();
        this.techEffTabText = this.add.text(90, -182, 'EFFICIENCY', {
            fontSize: '11px', fill: '#666666', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.techFuelTab.on('pointerdown', () => this.switchTechTab('fuelTank'));
        this.techEffTab.on('pointerdown', () => this.switchTechTab('efficiency'));

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
        closeBtn.on('pointerdown', () => this.closeTechTreePopup());

        this.techPopup.add([
            this.techBg, this.techTitle, this.techSubtitle, this.techContent,
            this.techFuelTab, this.techFuelTabText, this.techEffTab, this.techEffTabText,
            closeBtn, closeTxt
        ]);
        this.techTab = 'fuelTank';
    }

    switchTechTab(tab) {
        this.techTab = tab;
        if (tab === 'fuelTank') {
            this.techFuelTab.setFillStyle(0x1a1a28);
            this.techFuelTabText.setFill('#cccccc');
            this.techEffTab.setFillStyle(0x111118);
            this.techEffTabText.setFill('#666666');
        } else {
            this.techFuelTab.setFillStyle(0x111118);
            this.techFuelTabText.setFill('#666666');
            this.techEffTab.setFillStyle(0x1a1a28);
            this.techEffTabText.setFill('#cccccc');
        }
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
        } else {
            const baseCost = 50;
            const currentCost = Math.max(40, baseCost - currentLevel);
            this.techSubtitle.setText(`Efficiency: ${currentCost}ml/tile (base ${baseCost}ml − ${currentLevel})`);
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
            const bonusLabel = branch === 'fuelTank' ? `+${lvl.bonus}L` : `−${lvl.bonus}ml`;

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
                    btn.on('pointerdown', () => this.doUpgrade(branch, lvl));
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
        yesBtn.on('pointerdown', () => this.confirmReset());

        const noBtn = this.add.rectangle(70, 40, 110, 28, 0x1a1a28).setInteractive();
        const noTxt = this.add.text(70, 40, 'CANCEL', {
            fontSize: '11px', fill: '#888888', fontFamily: 'monospace'
        }).setOrigin(0.5);
        noBtn.on('pointerover', () => noBtn.setFillStyle(0x252535));
        noBtn.on('pointerout', () => noBtn.setFillStyle(0x1a1a28));
        noBtn.on('pointerdown', () => this.closeResetPopup());

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
        this.statusCredits.setText(`${this.credits.toLocaleString()} cr 💰`);
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
}

if (typeof window !== 'undefined') {
    window.ShipScene = ShipScene;
}
