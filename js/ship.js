class ShipScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShipScene' });
    }

    init(data) {
        this.shipGrid = data.shipGrid || this.createEmptyGrid(4, 6);
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel || 20000;
        this.shipFuelCapacity = data.shipFuelCapacity || 20000;
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerStored = 0;
        this.powerCapacity = 0;
        this.selectedRoomCell = null;
        this.pendingSellGem = null;
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
        this.cameras.main.setBackgroundColor('#1a1a2e');
        this.tileSize = 48;
        this.gridW = 4;
        this.gridH = 6;
        this.gridOffsetX = 500;
        this.gridOffsetY = 80;

        this.add.text(640, 20, 'SPACE SHIP', {
            fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.roomTypes = {
            solar: { name: 'Solar Panel', size: 1, power: 20, cost: 0, color: 0xFFD700 },
            battery: { name: 'Battery', size: 1, powerCap: 50, cost: 100, color: 0x4169E1 },
            fuelTank: { name: 'Fuel Tank', size: 1, fuelCap: 10000, cost: 200, color: 0xFF4500 },
            refinery: { name: 'Refinery', size: 2, power: -15, cost: 500, color: 0x8B4513 },
            trade: { name: 'Trade Terminal', size: 1, power: -5, cost: 300, color: 0x00FF00 },
            drill: { name: 'Drill Workshop', size: 2, power: -10, cost: 400, color: 0xA9A9A9 },
            engine: { name: 'Engine', size: 2, power: -20, cost: 1000, color: 0xFF6347 },
            quarters: { name: 'Quarters', size: 1, power: -2, cost: 150, color: 0x9370DB },
        };

        this.gemPrices = {
            'Ruby': 50, 'Sapphire': 75, 'Emerald': 100, 'Diamond': 200, 'Amethyst': 80,
        };

        // Fuel prices: balanced so gem sales ~ break even per run
        this.fuelPrices = { 1000: 400, 5000: 2000 };

        this.placeStarterRooms();
        this.drawShipGrid();
        this.createSidePanels();
        this.createRoomControlsPanel();
        this.createBuildPanel();
        this.createSellPopup();

        this.createButton(640, 600, 'LAUNCH TO GALAXY', () => {
            this.scene.start('GalaxyScene', {
                shipGrid: this.shipGrid, shipInventory: this.shipInventory,
                credits: this.credits, shipFuel: this.shipFuel, shipFuelCapacity: this.shipFuelCapacity,
            });
        });

        this.calculatePower();
        this.updateUI();
        this.input.on('pointerdown', (pointer) => this.handleGridClick(pointer));
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
        this.gridGraphics = this.add.graphics();
        this.highlightGraphics = this.add.graphics();

        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const px = this.gridOffsetX + x * this.tileSize;
                const py = this.gridOffsetY + y * this.tileSize;
                const room = this.shipGrid[x][y];
                if (room) {
                    const def = this.roomTypes[room.type];
                    this.gridGraphics.fillStyle(def.color, 1);
                    this.gridGraphics.fillRect(px, py, this.tileSize, this.tileSize);
                    this.gridGraphics.lineStyle(2, 0xffffff, 0.5);
                    this.gridGraphics.strokeRect(px, py, this.tileSize, this.tileSize);
                    if (room.masterX === x && room.masterY === y) {
                        const icon = this.add.text(px + this.tileSize / 2, py + this.tileSize / 2,
                            def.name.charAt(0), { fontSize: '20px', fill: '#ffffff' }).setOrigin(0.5);
                        icon.setDepth(1);
                        if (!this.roomIcons) this.roomIcons = [];
                        this.roomIcons.push(icon);
                    }
                } else {
                    this.gridGraphics.fillStyle(0x333344, 0.5);
                    this.gridGraphics.fillRect(px, py, this.tileSize, this.tileSize);
                    this.gridGraphics.lineStyle(1, 0x666677, 0.3);
                    this.gridGraphics.strokeRect(px, py, this.tileSize, this.tileSize);
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
                this.highlightGraphics.lineStyle(3, 0x00FFFF, 1);
                this.highlightGraphics.strokeRect(px - 2, py - 2, size * this.tileSize + 4, size * this.tileSize + 4);
            }
        }
    }

    handleGridClick(pointer) {
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
                }
            }
            return;
        }

        const room = this.shipGrid[gx][gy];
        if (room) {
            this.selectedRoomCell = { x: gx, y: gy };
            this.drawShipGrid();
            this.showRoomControls(room);
        } else {
            this.selectedRoomCell = null;
            this.drawShipGrid();
            this.hideRoomControls();
        }
    }

    createSidePanels() {
        this.add.text(20, 60, 'SHIP INVENTORY', { fontSize: '18px', fill: '#FFD700' });
        this.inventoryText = this.add.text(20, 90, '', { fontSize: '14px', fill: '#ffffff' });
        this.add.text(860, 60, 'SHIP STATUS', { fontSize: '18px', fill: '#00FF00' });
        this.powerText = this.add.text(860, 90, '', { fontSize: '14px', fill: '#ffffff' });
        this.fuelText = this.add.text(860, 150, '', { fontSize: '14px', fill: '#ffffff' });
        this.creditsText = this.add.text(860, 210, '', { fontSize: '14px', fill: '#ffffff' });
    }

    createRoomControlsPanel() {
        this.controlsPanel = this.add.container(860, 280);
        this.controlsBg = this.add.rectangle(0, 0, 380, 320, 0x222233, 0.9).setOrigin(0);
        this.controlsTitle = this.add.text(10, 10, 'ROOM CONTROLS', { fontSize: '16px', fill: '#00FFFF' });
        this.controlsContent = this.add.text(10, 40, 'Click a room to interact', { fontSize: '14px', fill: '#aaaaaa' });
        this.controlsPanel.add([this.controlsBg, this.controlsTitle, this.controlsContent]);
        this.controlsPanel.setVisible(true);
        this.controlButtons = [];
    }

    showRoomControls(room) {
        const def = this.roomTypes[room.type];
        this.controlButtons.forEach(b => { if (b.rect) b.rect.destroy(); if (b.text) b.text.destroy(); });
        this.controlButtons = [];

        let content = `Selected: ${def.name}\nSize: ${def.size}x${def.size} | Power: ${def.power > 0 ? '+' : ''}${def.power}\n\n`;

        if (room.type === 'trade') {
            content += '--- CLICK GEM TO SELL ---\n';
            this.controlsContent.setText(content);
            let y = 110;
            const gemNames = ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'];
            gemNames.forEach(gemName => {
                const count = this.shipInventory[gemName] || 0;
                const price = this.gemPrices[gemName];
                const btn = this.createControlButton(10, y, `${gemName} (${count}) — ${price}cr/ea`, () => {
                    if (count > 0) this.openSellPopup(gemName, count, price);
                }, 360, 28);
                this.controlButtons.push(btn);
                y += 34;
            });

            y += 10;
            Object.entries(this.fuelPrices).forEach(([amount, cost]) => {
                const fuelBtn = this.createControlButton(10, y, `BUY ${amount} FUEL — ${cost}cr`, () => {
                    if (this.credits >= cost && this.shipFuel + parseInt(amount) <= this.shipFuelCapacity) {
                        this.credits -= cost;
                        this.shipFuel = Math.min(this.shipFuelCapacity, this.shipFuel + parseInt(amount));
                        this.updateUI();
                        this.showRoomControls(room);
                    }
                }, 360, 32);
                this.controlButtons.push(fuelBtn);
                y += 38;
            });

        } else if (room.type === 'fuelTank') {
            content += `Ship Fuel: ${this.shipFuel} / ${this.shipFuelCapacity}\nCapacity bonus: +${def.fuelCap}\n`;
            this.controlsContent.setText(content);
        } else if (room.type === 'refinery') {
            content += 'Refinery active.\n(Processing recipes coming soon)\n';
            this.controlsContent.setText(content);
        } else {
            content += 'No special controls for this room.';
            this.controlsContent.setText(content);
        }

        // DESTROY button (for all rooms except starter rooms)
        if (def.cost > 0) {
            const refund = Math.floor(def.cost * 0.5);
            const destroyBtn = this.createControlButton(10, 280, `DESTROY ROOM — Refund ${refund}cr`, () => {
                this.destroyRoom(room);
            }, 360, 32);
            this.controlButtons.push(destroyBtn);
        }
    }

    destroyRoom(room) {
        const def = this.roomTypes[room.type];
        const size = def.size;
        const mx = room.masterX;
        const my = room.masterY;
        const refund = Math.floor(def.cost * 0.5);

        // Remove from grid
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
        this.hideRoomControls();
    }

    createControlButton(x, y, text, callback, w = 360, h = 30) {
        const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x444466).setOrigin(0.5);
        rect.setInteractive();
        const label = this.add.text(x + w / 2, y + h / 2, text, { fontSize: '12px', fill: '#ffffff' }).setOrigin(0.5);
        rect.on('pointerover', () => rect.setFillStyle(0x666688));
        rect.on('pointerout', () => rect.setFillStyle(0x444466));
        rect.on('pointerdown', callback);
        this.controlsPanel.add([rect, label]);
        return { rect, text: label };
    }

    hideRoomControls() {
        this.controlButtons.forEach(b => { if (b.rect) b.rect.destroy(); if (b.text) b.text.destroy(); });
        this.controlButtons = [];
        this.controlsContent.setText('Click a room to interact');
    }

    // Sell quantity popup
    createSellPopup() {
        this.sellPopup = this.add.container(640, 360);
        this.sellPopup.setVisible(false);
        this.sellPopup.setDepth(10);

        // Dark overlay background
        this.sellBg = this.add.rectangle(0, 0, 400, 280, 0x111122, 0.95).setOrigin(0.5);
        this.sellTitle = this.add.text(0, -110, 'SELL', { fontSize: '20px', fill: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5);
        this.sellInfo = this.add.text(0, -70, '', { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);

        // Quick buttons
        const btnData = [
            { label: '1', qty: 1, y: -30 },
            { label: '10', qty: 10, y: 10 },
            { label: '50', qty: 50, y: 50 },
            { label: 'ALL', qty: -1, y: 90 },
        ];

        this.sellQuickBtns = [];
        btnData.forEach(d => {
            const rect = this.add.rectangle(-60, d.y, 100, 32, 0x444466).setInteractive();
            const txt = this.add.text(-60, d.y, d.label, { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);
            rect.on('pointerover', () => rect.setFillStyle(0x666688));
            rect.on('pointerout', () => rect.setFillStyle(0x444466));
            rect.on('pointerdown', () => this.confirmSell(d.qty));
            this.sellQuickBtns.push({ rect, text: txt });
        });

        // Custom input area
        this.sellCustomLabel = this.add.text(80, -30, 'CUSTOM:', { fontSize: '14px', fill: '#aaaaaa' }).setOrigin(0.5);
        this.sellCustomBg = this.add.rectangle(80, 10, 120, 32, 0x222233).setStrokeStyle(1, 0x666688);
        this.sellCustomText = this.add.text(80, 10, '0', { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);

        // Custom +/- buttons
        const minusBtn = this.add.rectangle(20, 10, 28, 28, 0x444466).setInteractive();
        const minusTxt = this.add.text(20, 10, '-', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
        minusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            if (val > 0) this.sellCustomText.setText(String(val - 1));
        });

        const plusBtn = this.add.rectangle(140, 10, 28, 28, 0x444466).setInteractive();
        const plusTxt = this.add.text(140, 10, '+', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
        plusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            const max = this.pendingSellGem ? (this.shipInventory[this.pendingSellGem] || 0) : 0;
            if (val < max) this.sellCustomText.setText(String(val + 1));
        });

        // Sell custom button
        const sellCustomBtn = this.add.rectangle(80, 60, 120, 32, 0x228822).setInteractive();
        const sellCustomTxt = this.add.text(80, 60, 'SELL CUSTOM', { fontSize: '13px', fill: '#ffffff' }).setOrigin(0.5);
        sellCustomBtn.on('pointerover', () => sellCustomBtn.setFillStyle(0x44aa44));
        sellCustomBtn.on('pointerout', () => sellCustomBtn.setFillStyle(0x228822));
        sellCustomBtn.on('pointerdown', () => {
            const qty = parseInt(this.sellCustomText.text) || 0;
            if (qty > 0) this.confirmSell(qty);
        });

        // Cancel button
        const cancelBtn = this.add.rectangle(0, 120, 160, 32, 0x882222).setInteractive();
        const cancelTxt = this.add.text(0, 120, 'CANCEL', { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xaa4444));
        cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x882222));
        cancelBtn.on('pointerdown', () => this.closeSellPopup());

        this.sellPopup.add([
            this.sellBg, this.sellTitle, this.sellInfo,
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
        this.sellInfo.setText(`Available: ${count} | Price: ${price}cr each | Total value: ${count * price}cr`);
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
        if (qty === -1) qty = count; // ALL
        qty = Math.min(qty, count);
        if (qty <= 0) return;

        this.shipInventory[this.pendingSellGem] -= qty;
        if (this.shipInventory[this.pendingSellGem] <= 0) delete this.shipInventory[this.pendingSellGem];
        this.credits += qty * price;

        this.closeSellPopup();
        this.updateUI();

        // Refresh trade panel if open
        if (this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room && room.type === 'trade') this.showRoomControls(room);
        }
    }

    createBuildPanel() {
        this.add.text(20, 320, 'BUILD ROOMS', { fontSize: '18px', fill: '#00FFFF' });
        this.buildButtons = [];
        let y = 350;
        Object.entries(this.roomTypes).forEach(([key, def]) => {
            if (def.cost === 0) return;
            const btn = this.createButton(120, y, `${def.name} (${def.cost}cr)`, () => {
                this.selectedRoom = key;
                this.buildMode = true;
                this.selectedRoomCell = null;
                this.drawShipGrid();
                this.hideRoomControls();
            }, 240, 30);
            this.buildButtons.push(btn);
            y += 38;
        });
        this.createButton(120, y + 10, 'CANCEL BUILD', () => {
            this.buildMode = false;
            this.selectedRoom = null;
        }, 240, 30);
    }

    createButton(x, y, text, callback, w = 280, h = 40) {
        const btn = this.add.rectangle(x, y, w, h, 0x444466);
        btn.setInteractive();
        const label = this.add.text(x, y, text, { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setFillStyle(0x666688));
        btn.on('pointerout', () => btn.setFillStyle(0x444466));
        btn.on('pointerdown', callback);
        return { rect: btn, text: label };
    }

    updateUI() {
        const invText = Object.entries(this.shipInventory)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') || 'Empty';
        this.inventoryText.setText(invText);

        const netPower = this.powerGen - this.powerUse;
        this.powerText.setText(
            `Power Gen: ${this.powerGen}\n` +
            `Power Use: ${this.powerUse}\n` +
            `Net: ${netPower > 0 ? '+' : ''}${netPower}\n` +
            `Stored: ${this.powerStored}/${this.powerCapacity}`
        );

        this.fuelText.setText(
            `Ship Fuel: ${this.shipFuel}/${this.shipFuelCapacity}\n` +
            `Runs available: ~${Math.floor(this.shipFuel / 5000)}`
        );
        this.creditsText.setText(`Credits: ${this.credits}`);
    }

    calculatePower() {
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerCapacity = 0;
        this.shipFuelCapacity = 20000;

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
