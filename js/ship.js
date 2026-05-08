class ShipScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShipScene' });
    }

    init(data) {
        // Persisted ship state (would be saved to localStorage in real game)
        this.shipGrid = data.shipGrid || this.createEmptyGrid(4, 6);
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel || 20000; // starting fuel in ship tank
        this.shipFuelCapacity = data.shipFuelCapacity || 20000;
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerStored = 0;
        this.powerCapacity = 0;
    }

    createEmptyGrid(w, h) {
        const grid = [];
        for (let x = 0; x < w; x++) {
            grid[x] = [];
            for (let y = 0; y < h; y++) {
                grid[x][y] = null;
            }
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

        // Title
        this.add.text(640, 20, 'SPACE SHIP', {
            fontSize: '32px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Room definitions
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

        // Pre-place starter rooms if grid is empty
        this.placeStarterRooms();

        // Draw grid
        this.drawShipGrid();

        // Side panels
        this.createSidePanels();

        // Build mode button
        this.buildMode = false;
        this.selectedRoom = null;

        this.createBuildPanel();

        // Buttons
        this.createButton(640, 600, 'LAUNCH TO GALAXY', () => {
            this.scene.start('GalaxyScene', {
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
            });
        });

        // Recalculate power
        this.calculatePower();
        this.updateUI();
    }

    placeStarterRooms() {
        // Check if grid has anything
        let hasRooms = false;
        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                if (this.shipGrid[x][y]) hasRooms = true;
            }
        }
        if (hasRooms) return;

        // Place 2 solar panels
        this.placeRoom(0, 0, 'solar');
        this.placeRoom(1, 0, 'solar');
        // Place 1 fuel tank
        this.placeRoom(2, 0, 'fuelTank');
    }

    drawShipGrid() {
        if (this.gridGraphics) this.gridGraphics.destroy();
        this.gridGraphics = this.add.graphics();

        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const px = this.gridOffsetX + x * this.tileSize;
                const py = this.gridOffsetY + y * this.tileSize;
                const room = this.shipGrid[x][y];

                // Draw cell background
                if (room) {
                    const def = this.roomTypes[room.type];
                    this.gridGraphics.fillStyle(def.color, 1);
                    this.gridGraphics.fillRect(px, py, this.tileSize, this.tileSize);
                    this.gridGraphics.lineStyle(2, 0xffffff, 0.5);
                    this.gridGraphics.strokeRect(px, py, this.tileSize, this.tileSize);
                } else {
                    this.gridGraphics.fillStyle(0x333344, 0.5);
                    this.gridGraphics.fillRect(px, py, this.tileSize, this.tileSize);
                    this.gridGraphics.lineStyle(1, 0x666677, 0.3);
                    this.gridGraphics.strokeRect(px, py, this.tileSize, this.tileSize);
                }
            }
        }
    }

    createSidePanels() {
        // Left panel: Resources
        this.add.text(20, 60, 'SHIP INVENTORY', { fontSize: '18px', fill: '#FFD700' });
        this.inventoryText = this.add.text(20, 90, '', { fontSize: '14px', fill: '#ffffff' });

        // Right panel: Ship stats
        this.add.text(860, 60, 'SHIP STATUS', { fontSize: '18px', fill: '#00FF00' });
        this.powerText = this.add.text(860, 90, '', { fontSize: '14px', fill: '#ffffff' });
        this.fuelText = this.add.text(860, 150, '', { fontSize: '14px', fill: '#ffffff' });
        this.creditsText = this.add.text(860, 210, '', { fontSize: '14px', fill: '#ffffff' });
    }

    createBuildPanel() {
        this.add.text(20, 320, 'BUILD ROOMS', { fontSize: '18px', fill: '#00FFFF' });
        this.buildButtons = [];

        let y = 350;
        Object.entries(this.roomTypes).forEach(([key, def]) => {
            if (def.cost === 0) return; // starter rooms only
            const btn = this.createButton(120, y, `${def.name} (${def.cost}cr)`, () => {
                this.selectedRoom = key;
                this.buildMode = true;
            }, 240, 30);
            this.buildButtons.push(btn);
            y += 38;
        });

        // Toggle build mode off
        this.createButton(120, y + 10, 'CANCEL BUILD', () => {
            this.buildMode = false;
            this.selectedRoom = null;
        }, 240, 30);
    }

    createButton(x, y, text, callback, w = 280, h = 40) {
        const btn = this.add.rectangle(x, y, w, h, 0x444466);
        btn.setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '14px', fill: '#ffffff'
        }).setOrigin(0.5);

        btn.on('pointerover', () => btn.setFillStyle(0x666688));
        btn.on('pointerout', () => btn.setFillStyle(0x444466));
        btn.on('pointerdown', callback);

        return { rect: btn, text: label };
    }

    updateUI() {
        // Inventory
        const invText = Object.entries(this.shipInventory)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') || 'Empty';
        this.inventoryText.setText(invText);

        // Power
        const netPower = this.powerGen - this.powerUse;
        this.powerText.setText(
            `Power Gen: ${this.powerGen}\n` +
            `Power Use: ${this.powerUse}\n` +
            `Net: ${netPower > 0 ? '+' : ''}${netPower}\n` +
            `Stored: ${this.powerStored}/${this.powerCapacity}`
        );

        // Fuel
        this.fuelText.setText(
            `Ship Fuel: ${this.shipFuel}/${this.shipFuelCapacity}\n` +
            `Runs available: ~${Math.floor(this.shipFuel / 5000)}`
        );

        // Credits
        this.creditsText.setText(`Credits: ${this.credits}`);
    }

    calculatePower() {
        this.powerGen = 0;
        this.powerUse = 0;
        this.powerCapacity = 0;
        this.shipFuelCapacity = 20000; // base

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

        // Simple power model: stored power fills up over time, capped by capacity
        // For now, just say you have enough if net > 0
        if (this.powerGen > this.powerUse) {
            this.powerStored = Math.min(this.powerCapacity, this.powerStored + (this.powerGen - this.powerUse));
        }
    }

    placeRoom(gx, gy, type) {
        const def = this.roomTypes[type];
        if (!def) return false;
        const size = def.size;

        // Check bounds
        if (gx + size > this.gridW || gy + size > this.gridH) return false;

        // Check overlap
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                if (this.shipGrid[gx + dx][gy + dy]) return false;
            }
        }

        // Place
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                this.shipGrid[gx + dx][gy + dy] = { type, masterX: gx, masterY: gy };
            }
        }
        return true;
    }

    update() {
        // Handle grid clicks for building
        if (this.buildMode && this.selectedRoom && this.input.activePointer.justDown) {
            const pointer = this.input.activePointer;
            const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
            const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);

            if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
                const def = this.roomTypes[this.selectedRoom];
                if (this.credits >= def.cost) {
                    if (this.placeRoom(gx, gy, this.selectedRoom)) {
                        this.credits -= def.cost;
                        this.calculatePower();
                        this.updateUI();
                        this.drawShipGrid();
                    }
                }
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.ShipScene = ShipScene;
}
