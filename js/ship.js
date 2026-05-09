class ShipScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShipScene' });
    }

    init(data) {
        this.shipGrid = data.shipGrid || this.createEmptyGrid(4, 6);
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel !== undefined ? data.shipFuel : 100;
        this.shipFuelCapacity = data.shipFuelCapacity !== undefined ? data.shipFuelCapacity : 100;
        this.rockCompositions = data.rockCompositions || {};
        this.techState = data.techState || { fuelTankLevel: 0 };
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
        this.cameras.main.setBackgroundColor('#0d0d1a');
        this.tileSize = 52;
        this.gridW = 4;
        this.gridH = 6;
        this.gridOffsetX = 540;
        this.gridOffsetY = 100;

        // Title
        this.add.text(640, 18, '═══ SPACE SHIP ═══', {
            fontSize: '28px', fill: '#ffffff', fontStyle: 'bold',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Decorative line
        const titleLine = this.add.graphics();
        titleLine.lineStyle(1, 0x444466, 1);
        titleLine.lineBetween(200, 45, 1080, 45);

        // All rooms: power set to 0 for now (per Boss request)
        this.roomTypes = {
            solar: { name: 'Solar Panel', size: 1, power: 0, cost: 0, color: 0xFFD700, icon: 'S' },
            battery: { name: 'Battery', size: 1, powerCap: 50, cost: 100, color: 0x4169E1, icon: 'B' },
            fuelTank: { name: 'Fuel Tank', size: 1, fuelCap: 50, cost: 200, color: 0xFF4500, icon: 'F' },
            refinery: { name: 'Refinery', size: 2, power: 0, cost: 500, color: 0x8B4513, icon: 'R' },
            trade: { name: 'Trade Terminal', size: 1, power: 0, cost: 300, color: 0x00FF00, icon: 'T' },
            smelter: { name: 'Smelter', size: 2, power: 0, cost: 500, color: 0xCD5C5C, icon: 'm' },
            drill: { name: 'Mech Workshop', size: 2, power: 0, cost: 400, color: 0xA9A9A9, icon: 'W' },
            engine: { name: 'Engine', size: 2, power: 0, cost: 1000, color: 0xFF6347, icon: 'E' },
            quarters: { name: 'Quarters', size: 1, power: 0, cost: 150, color: 0x9370DB, icon: 'Q' },
            crusher: { name: 'Crusher', size: 2, power: 0, cost: 300, color: 0x8B8B83, icon: 'C' },
            smelter: { name: 'Smelter', size: 2, power: 0, cost: 500, color: 0xCD5C5C, icon: 'M' },
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
            ]
        };

        this.placeStarterRooms();
        this.drawShipGrid();
        this.createSidePanels();
        this.createRoomControlsPanel();
        this.createBuildPanel();
        this.createSellPopup();
        this.createTechTreePopup();
        this.createGhostGraphics();

        this.createButton(640, 640, 'LAUNCH TO GALAXY', () => {
            this.scene.start('GalaxyScene', {
                shipGrid: this.shipGrid, shipInventory: this.shipInventory,
                credits: this.credits, shipFuel: this.shipFuel, shipFuelCapacity: this.shipFuelCapacity,
                rockCompositions: this.rockCompositions,
                techState: this.techState,
            });
        });

        this.calculatePower();
        this.updateUI();
        this.input.on('pointerdown', (pointer) => this.handleGridClick(pointer));
        this.input.on('pointermove', (pointer) => this.handleGridHover(pointer));
    }

    createGhostGraphics() {
        if (this.ghostGraphics) this.ghostGraphics.destroy();
        this.ghostGraphics = this.add.graphics();
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

        const gridW = this.gridW * this.tileSize;
        const gridH = this.gridH * this.tileSize;
        const cx = this.gridOffsetX + gridW / 2;
        const cy = this.gridOffsetY + gridH / 2;

        // Ship hull outline
        this.gridGraphics.lineStyle(3, 0x555577, 1);
        this.gridGraphics.strokeRect(this.gridOffsetX - 8, this.gridOffsetY - 8, gridW + 16, gridH + 16);
        this.gridGraphics.fillStyle(0x1a1a2e, 0.8);
        this.gridGraphics.fillRect(this.gridOffsetX - 8, this.gridOffsetY - 8, gridW + 16, gridH + 16);

        for (let x = 0; x < this.gridW; x++) {
            for (let y = 0; y < this.gridH; y++) {
                const px = this.gridOffsetX + x * this.tileSize;
                const py = this.gridOffsetY + y * this.tileSize;
                const room = this.shipGrid[x][y];
                if (room) {
                    const def = this.roomTypes[room.type];
                    // Room background
                    this.gridGraphics.fillStyle(def.color, 0.9);
                    this.gridGraphics.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                    // Room border
                    this.gridGraphics.lineStyle(2, 0xffffff, 0.4);
                    this.gridGraphics.strokeRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);
                    // Room icon (only on master cell)
                    if (room.masterX === x && room.masterY === y) {
                        const icon = this.add.text(px + this.tileSize / 2, py + this.tileSize / 2,
                            def.icon, { fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
                        icon.setDepth(2);
                        this.roomIcons.push(icon);
                    }
                } else {
                    // Empty cell
                    this.gridGraphics.fillStyle(0x2a2a3e, 0.5);
                    this.gridGraphics.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                    this.gridGraphics.lineStyle(1, 0x444466, 0.3);
                    this.gridGraphics.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
                }
            }
        }

        // Selection highlight
        if (this.selectedRoomCell) {
            const room = this.shipGrid[this.selectedRoomCell.x][this.selectedRoomCell.y];
            if (room) {
                const def = this.roomTypes[room.type];
                const size = def.size;
                const px = this.gridOffsetX + room.masterX * this.tileSize;
                const py = this.gridOffsetY + room.masterY * this.tileSize;
                this.highlightGraphics.lineStyle(3, 0x00FFFF, 0.9);
                this.highlightGraphics.strokeRect(px - 3, py - 3, size * this.tileSize + 6, size * this.tileSize + 6);
            }
        }
    }

    handleGridHover(pointer) {
        if (!this.buildMode || !this.selectedRoom) return;

        const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
        const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);

        // Clear previous ghost graphics and text
        this.ghostGraphics.clear();
        if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }

        if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return;

        const def = this.roomTypes[this.selectedRoom];
        const size = def.size;

        // Check if valid placement
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

        // Draw ghost preview
        const px = this.gridOffsetX + gx * this.tileSize;
        const py = this.gridOffsetY + gy * this.tileSize;
        this.ghostGraphics.fillStyle(def.color, 0.35);
        this.ghostGraphics.fillRect(px, py, size * this.tileSize, size * this.tileSize);
        this.ghostGraphics.lineStyle(2, def.color, 0.8);
        this.ghostGraphics.strokeRect(px, py, size * this.tileSize, size * this.tileSize);
        // Ghost icon
        this.ghostIcon = this.add.text(px + size * this.tileSize / 2, py + size * this.tileSize / 2,
            def.icon, { fontSize: '22px', fill: '#ffffff' }).setOrigin(0.5);
        this.ghostIcon.setAlpha(0.5);
        this.ghostIcon.setDepth(3);
    }

    handleGridClick(pointer) {
        const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
        const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);
        if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return;

        // Build mode: click to confirm placement
        if (this.buildMode && this.selectedRoom) {
            const def = this.roomTypes[this.selectedRoom];
            if (this.credits >= def.cost) {
                if (this.placeRoom(gx, gy, this.selectedRoom)) {
                    this.credits -= def.cost;
                    this.calculatePower();
                    this.updateUI();
                    this.drawShipGrid();
                    // Clear ghost
                    this.ghostGraphics.clear();
                    if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
                    // Stay in build mode for multi-placement
                }
            }
            return;
        }

        // Normal mode: select room
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
        // Left panel - Inventory (shortened to make room for build panel)
        const leftBg = this.add.graphics();
        leftBg.fillStyle(0x151525, 0.9);
        leftBg.fillRoundedRect(10, 70, 260, 290, 8);
        leftBg.lineStyle(1, 0x444466, 0.5);
        leftBg.strokeRoundedRect(10, 70, 260, 290, 8);

        this.add.text(20, 80, 'INVENTORY', {
            fontSize: '16px', fill: '#FFD700', fontStyle: 'bold', fontFamily: 'monospace'
        });
        this.inventoryText = this.add.text(20, 110, '', { fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace' });

        // Right panel - Ship Status
        const rightBg = this.add.graphics();
        rightBg.fillStyle(0x151525, 0.9);
        rightBg.fillRoundedRect(1010, 70, 260, 280, 8);
        rightBg.lineStyle(1, 0x444466, 0.5);
        rightBg.strokeRoundedRect(1010, 70, 260, 280, 8);

        this.add.text(1020, 80, 'SHIP STATUS', {
            fontSize: '16px', fill: '#00FF00', fontStyle: 'bold', fontFamily: 'monospace'
        });
        this.powerText = this.add.text(1020, 110, '', { fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace' });
        this.fuelText = this.add.text(1020, 190, '', { fontSize: '13px', fill: '#cccccc', fontFamily: 'monospace' });
        this.creditsText = this.add.text(1020, 260, '', { fontSize: '16px', fill: '#FFD700', fontStyle: 'bold', fontFamily: 'monospace' });
    }

    createRoomControlsPanel() {
        const panelX = 1010;
        const panelY = 370;

        this.controlsPanel = this.add.container(panelX, panelY);
        this.controlsBg = this.add.rectangle(0, 0, 260, 320, 0x1a1a2e, 0.95).setOrigin(0);
        this.controlsBg.setStrokeStyle(1, 0x444466);
        this.controlsTitle = this.add.text(10, 10, 'ROOM CONTROLS', {
            fontSize: '15px', fill: '#00FFFF', fontStyle: 'bold', fontFamily: 'monospace'
        });
        this.controlsContent = this.add.text(10, 40, 'Click a room to interact', {
            fontSize: '13px', fill: '#aaaaaa', fontFamily: 'monospace'
        });
        this.controlsPanel.add([this.controlsBg, this.controlsTitle, this.controlsContent]);
        this.controlsPanel.setVisible(true);
        this.controlButtons = [];
    }

    showRoomControls(room) {
        const def = this.roomTypes[room.type];
        this.controlButtons.forEach(b => { if (b.rect) b.rect.destroy(); if (b.text) b.text.destroy(); });
        this.controlButtons = [];

        let content = `${def.icon}  ${def.name}\nSize: ${def.size}×${def.size}\n\n`;

        if (room.type === 'trade') {
            content += '─ CLICK GEM TO SELL ─\n';
            this.controlsContent.setText(content);
            let y = 95;
            const gemNames = ['Ruby', 'Sapphire', 'Emerald', 'Diamond', 'Amethyst'];

            gemNames.forEach(gemName => {
                const count = this.shipInventory[gemName] || 0;
                const price = this.gemPrices[gemName];
                const btn = this.createControlButton(10, y, `${gemName} (${count}) — ${price}cr/ea`, () => {
                    if (count > 0) this.openSellPopup(gemName, count, price);
                }, 240, 26);
                this.controlButtons.push(btn);
                y += 32;
            });

            y += 6;
            Object.entries(this.fuelPrices).forEach(([amount, cost]) => {
                const fuelBtn = this.createControlButton(10, y, `BUY ${amount}L FUEL — ${cost}cr`, () => {
                    if (this.credits >= cost && this.shipFuel + parseInt(amount) <= this.shipFuelCapacity) {
                        this.credits -= cost;
                        this.shipFuel = Math.min(this.shipFuelCapacity, this.shipFuel + parseInt(amount));
                        this.updateUI();
                        this.showRoomControls(room);
                    }
                }, 240, 30);
                this.controlButtons.push(fuelBtn);
                y += 36;
            });

        } else if (room.type === 'fuelTank') {
            content += `Fuel: ${this.shipFuel.toFixed(1)}L / ${this.shipFuelCapacity.toFixed(1)}L\nCapacity: +${def.fuelCap}L\n`;
            this.controlsContent.setText(content);

        } else if (room.type === 'crusher') {
            this.controlsContent.setText(content + '─ CRUSHER ─\n');
            let y = 95;

            const rockTypesInInv = Object.keys(this.shipInventory).filter(k =>
                this.rockCompositions[k] && !k.startsWith('Crushed')
            );

            if (rockTypesInInv.length === 0) {
                const noneBtn = this.createControlButton(10, y, 'No rocks in inventory', () => {}, 240, 26);
                noneBtn.rect.removeInteractive();
                this.controlButtons.push(noneBtn);
                y += 32;
            } else {
                rockTypesInInv.forEach(rockName => {
                    const count = this.shipInventory[rockName] || 0;
                    const crushBtn = this.createControlButton(10, y, `Crush ${rockName} (${count}) → 2 Crushed`, () => {
                        if (count >= 1) {
                            this.shipInventory[rockName]--;
                            if (this.shipInventory[rockName] <= 0) delete this.shipInventory[rockName];
                            const crushedName = `Crushed ${rockName}`;
                            this.shipInventory[crushedName] = (this.shipInventory[crushedName] || 0) + 2;
                            this.updateUI();
                            this.showRoomControls(room);
                        }
                    }, 240, 26);
                    this.controlButtons.push(crushBtn);
                    y += 32;
                });
            }

            y += 6;
            const crushedTypes = Object.keys(this.shipInventory).filter(k => k.startsWith('Crushed '));
            if (crushedTypes.length > 0) {
                this.controlsContent.setText(this.controlsContent.text + '\n─ EXTRACT ORES ─\n');
                crushedTypes.forEach(crushedName => {
                    const count = this.shipInventory[crushedName] || 0;
                    const rockName = crushedName.replace('Crushed ', '');
                    const comp = this.rockCompositions[rockName];
                    if (comp && count >= 5) {
                        const extractBtn = this.createControlButton(10, y, `Extract ${crushedName} (${count})`, () => {
                            this.extractFromCrushedRock(crushedName, comp);
                            this.updateUI();
                            this.showRoomControls(room);
                        }, 240, 30);
                        this.controlButtons.push(extractBtn);
                        y += 36;
                    } else if (comp) {
                        const needBtn = this.createControlButton(10, y, `${crushedName}: need 5 (have ${count})`, () => {}, 240, 26);
                        needBtn.rect.removeInteractive();
                        this.controlButtons.push(needBtn);
                        y += 32;
                    }
                });
            }

        } else if (room.type === 'smelter') {
            this.controlsContent.setText(content + '─ SMELTER (3 → 1) ─\n');
            let y = 95;
            const recipes = [
                { ore: 'Copper Ore', ingot: 'Copper Ingot' },
                { ore: 'Iron Ore', ingot: 'Iron Ingot' },
                { ore: 'Gold Ore', ingot: 'Gold Ingot' },
            ];
            recipes.forEach(r => {
                const count = this.shipInventory[r.ore] || 0;
                const canSmelt = count >= 3;
                const smeltBtn = this.createControlButton(10, y,
                    `${r.ore}: ${count} ${canSmelt ? '→ SMELT' : '(need 3)'}`, () => {
                        if (count >= 3) {
                            this.shipInventory[r.ore] -= 3;
                            if (this.shipInventory[r.ore] <= 0) delete this.shipInventory[r.ore];
                            this.shipInventory[r.ingot] = (this.shipInventory[r.ingot] || 0) + 1;
                            this.updateUI();
                            this.showRoomControls(room);
                        }
                    }, 240, 26);
                if (!canSmelt) smeltBtn.rect.removeInteractive();
                this.controlButtons.push(smeltBtn);
                y += 32;
            });

        } else if (room.type === 'refinery') {
            content += 'Refinery active.\n(Advanced processing coming soon)\n';
            this.controlsContent.setText(content);

        } else if (room.type === 'drill') {
            content += `Mech Workshop active.\nFuel Tank Level: ${this.techState.fuelTankLevel}/6\n`;
            this.controlsContent.setText(content);

            const upgradeBtn = this.createControlButton(10, 95, 'OPEN TECH TREE', () => {
                this.openTechTreePopup();
            }, 240, 30);
            this.controlButtons.push(upgradeBtn);

        } else {
            content += 'No special controls for this room.';
            this.controlsContent.setText(content);
        }

        // DESTROY button
        if (def.cost > 0) {
            const refund = Math.floor(def.cost * 0.5);
            const destroyBtn = this.createControlButton(10, 278, `DESTROY — Refund ${refund}cr`, () => {
                this.destroyRoom(room);
            }, 240, 30);
            this.controlButtons.push(destroyBtn);
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

        if (results.length === 0) {
            results.push('Nothing found this time');
        }
    }

    createControlButton(x, y, text, callback, w = 240, h = 28) {
        const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x333355).setOrigin(0.5);
        rect.setInteractive();
        const label = this.add.text(x + w / 2, y + h / 2, text, {
            fontSize: '11px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        rect.on('pointerover', () => { rect.setFillStyle(0x555577); label.setFill('#ffffff'); });
        rect.on('pointerout', () => { rect.setFillStyle(0x333355); label.setFill('#ffffff'); });
        rect.on('pointerdown', callback);
        this.controlsPanel.add([rect, label]);
        return { rect, text: label };
    }

    hideRoomControls() {
        this.controlButtons.forEach(b => { if (b.rect) b.rect.destroy(); if (b.text) b.text.destroy(); });
        this.controlButtons = [];
        this.controlsContent.setText('Click a room to interact');
    }

    createSellPopup() {
        this.sellPopup = this.add.container(640, 360);
        this.sellPopup.setVisible(false);
        this.sellPopup.setDepth(10);

        this.sellBg = this.add.rectangle(0, 0, 380, 270, 0x111122, 0.98).setOrigin(0.5);
        this.sellBg.setStrokeStyle(2, 0x444466);
        this.sellTitle = this.add.text(0, -110, 'SELL', {
            fontSize: '22px', fill: '#FFD700', fontStyle: 'bold', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.sellInfo = this.add.text(0, -75, '', {
            fontSize: '14px', fill: '#cccccc', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const btnData = [
            { label: '1', qty: 1, y: -30 },
            { label: '10', qty: 10, y: 10 },
            { label: '50', qty: 50, y: 50 },
            { label: 'ALL', qty: -1, y: 90 },
        ];

        this.sellQuickBtns = [];
        btnData.forEach(d => {
            const rect = this.add.rectangle(-60, d.y, 90, 30, 0x444466).setInteractive();
            const txt = this.add.text(-60, d.y, d.label, {
                fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
            }).setOrigin(0.5);
            rect.on('pointerover', () => rect.setFillStyle(0x666688));
            rect.on('pointerout', () => rect.setFillStyle(0x444466));
            rect.on('pointerdown', () => this.confirmSell(d.qty));
            this.sellQuickBtns.push({ rect, text: txt });
        });

        this.sellCustomLabel = this.add.text(80, -30, 'CUSTOM:', {
            fontSize: '14px', fill: '#aaaaaa', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.sellCustomBg = this.add.rectangle(80, 10, 110, 30, 0x222233).setStrokeStyle(1, 0x666688);
        this.sellCustomText = this.add.text(80, 10, '0', {
            fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const minusBtn = this.add.rectangle(20, 10, 26, 26, 0x444466).setInteractive();
        const minusTxt = this.add.text(20, 10, '-', {
            fontSize: '16px', fill: '#ffffff'
        }).setOrigin(0.5);
        minusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            if (val > 0) this.sellCustomText.setText(String(val - 1));
        });

        const plusBtn = this.add.rectangle(140, 10, 26, 26, 0x444466).setInteractive();
        const plusTxt = this.add.text(140, 10, '+', {
            fontSize: '16px', fill: '#ffffff'
        }).setOrigin(0.5);
        plusBtn.on('pointerdown', () => {
            let val = parseInt(this.sellCustomText.text) || 0;
            const max = this.pendingSellGem ? (this.shipInventory[this.pendingSellGem] || 0) : 0;
            if (val < max) this.sellCustomText.setText(String(val + 1));
        });

        const sellCustomBtn = this.add.rectangle(80, 55, 110, 30, 0x228822).setInteractive();
        const sellCustomTxt = this.add.text(80, 55, 'SELL', {
            fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        sellCustomBtn.on('pointerover', () => sellCustomBtn.setFillStyle(0x44aa44));
        sellCustomBtn.on('pointerout', () => sellCustomBtn.setFillStyle(0x228822));
        sellCustomBtn.on('pointerdown', () => {
            const qty = parseInt(this.sellCustomText.text) || 0;
            if (qty > 0) this.confirmSell(qty);
        });

        const cancelBtn = this.add.rectangle(0, 115, 140, 30, 0x882222).setInteractive();
        const cancelTxt = this.add.text(0, 115, 'CANCEL', {
            fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
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
        this.sellInfo.setText(`Available: ${count}  |  ${price}cr each  |  Total: ${count * price}cr`);
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
            if (room && room.type === 'trade') this.showRoomControls(room);
        }
    }

    createTechTreePopup() {
        this.techPopup = this.add.container(640, 360);
        this.techPopup.setVisible(false);
        this.techPopup.setDepth(10);

        this.techBg = this.add.rectangle(0, 0, 480, 420, 0x111122, 0.98).setOrigin(0.5);
        this.techBg.setStrokeStyle(2, 0x444466);
        this.techTitle = this.add.text(0, -190, 'TECH TREE', {
            fontSize: '22px', fill: '#00FFFF', fontStyle: 'bold', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techSubtitle = this.add.text(0, -165, 'Fuel Tank Capacity', {
            fontSize: '14px', fill: '#FFD700', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.techContent = this.add.container(0, 0);

        const closeBtn = this.add.rectangle(0, 190, 140, 30, 0x882222).setInteractive();
        const closeTxt = this.add.text(0, 190, 'CLOSE', {
            fontSize: '14px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xaa4444));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x882222));
        closeBtn.on('pointerdown', () => this.closeTechTreePopup());

        this.techPopup.add([this.techBg, this.techTitle, this.techSubtitle, this.techContent, closeBtn, closeTxt]);
    }

    openTechTreePopup() {
        this.techContent.removeAll(true);

        const currentLevel = this.techState.fuelTankLevel;
        const baseFuel = 25;
        const currentMax = baseFuel + currentLevel;

        this.techSubtitle.setText(`Fuel Tank Capacity — Current: ${currentMax}L (Base ${baseFuel}L + ${currentLevel} upgrades)`);

        const levels = this.techTree.fuelTank;
        let y = -135;

        levels.forEach((lvl, i) => {
            const isUnlocked = i < currentLevel;
            const isNext = i === currentLevel;

            let costText = Object.entries(lvl.cost)
                .map(([mat, qty]) => `${mat}: ${qty}`)
                .join(', ');

            const statusText = isUnlocked ? '✓ UNLOCKED' : (isNext ? 'AVAILABLE' : 'LOCKED');
            const rowColor = isUnlocked ? 0x228822 : (isNext ? 0x444466 : 0x222233);
            const textColor = isUnlocked ? '#44ff44' : (isNext ? '#ffffff' : '#666666');

            // Level label
            const label = this.add.text(-220, y, `Lv${lvl.level}: +${lvl.bonus}L`, {
                fontSize: '13px', fill: textColor, fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            // Cost text
            const cost = this.add.text(-140, y, costText, {
                fontSize: '11px', fill: isUnlocked ? '#44ff44' : '#aaaaaa', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            // Status / button
            let btn;
            if (isNext) {
                const canAfford = this.canAfford(lvl.cost);
                const btnColor = canAfford ? 0x228822 : 0x333333;
                const btnText = canAfford ? 'UPGRADE' : 'INSUFFICIENT';
                const btnTxtColor = canAfford ? '#ffffff' : '#666666';

                btn = this.add.rectangle(180, y, 100, 24, btnColor).setInteractive();
                const btnLabel = this.add.text(180, y, btnText, {
                    fontSize: '11px', fill: btnTxtColor, fontFamily: 'monospace'
                }).setOrigin(0.5);

                if (canAfford) {
                    btn.on('pointerover', () => btn.setFillStyle(0x44aa44));
                    btn.on('pointerout', () => btn.setFillStyle(0x228822));
                    btn.on('pointerdown', () => this.doUpgrade(lvl));
                }

                this.techContent.add([label, cost, btn, btnLabel]);
            } else {
                const status = this.add.text(180, y, statusText, {
                    fontSize: '11px', fill: textColor, fontFamily: 'monospace'
                }).setOrigin(0.5);
                this.techContent.add([label, cost, status]);
            }

            y += 36;
        });

        this.techPopup.setVisible(true);
    }

    closeTechTreePopup() {
        this.techPopup.setVisible(false);
    }

    canAfford(cost) {
        for (const [mat, qty] of Object.entries(cost)) {
            if ((this.shipInventory[mat] || 0) < qty) return false;
        }
        return true;
    }

    doUpgrade(level) {
        if (!this.canAfford(level.cost)) return;

        for (const [mat, qty] of Object.entries(level.cost)) {
            this.shipInventory[mat] -= qty;
            if (this.shipInventory[mat] <= 0) delete this.shipInventory[mat];
        }

        this.techState.fuelTankLevel = level.level;
        this.updateUI();
        this.openTechTreePopup();
    }

    createBuildPanel() {
        const panelX = 10;
        const panelY = 370;
        const panelH = 340;

        const buildBg = this.add.graphics();
        buildBg.fillStyle(0x151525, 0.9);
        buildBg.fillRoundedRect(panelX, panelY, 260, panelH, 8);
        buildBg.lineStyle(1, 0x444466, 0.5);
        buildBg.strokeRoundedRect(panelX, panelY, 260, panelH, 8);

        this.add.text(panelX + 10, panelY + 10, 'BUILD ROOMS', {
            fontSize: '16px', fill: '#00FFFF', fontStyle: 'bold', fontFamily: 'monospace'
        });

        this.buildButtons = [];
        let y = panelY + 38;
        Object.entries(this.roomTypes).forEach(([key, def]) => {
            if (def.cost === 0) return;
            const btn = this.createBuildButton(panelX + 130, y, `${def.icon} ${def.name}`, def.cost, key, () => {
                this.selectedRoom = key;
                this.buildMode = true;
                this.selectedRoomCell = null;
                this.drawShipGrid();
                this.hideRoomControls();
                this.buildStatusText.setText(`Building: ${def.icon} ${def.name}\nHover grid to preview, click to place`);
            });
            this.buildButtons.push(btn);
            y += 30;
        });

        this.buildStatusText = this.add.text(panelX + 10, panelY + 310, 'Select a room to build', {
            fontSize: '12px', fill: '#aaaaaa', fontFamily: 'monospace'
        });

        // Cancel build button
        const cancelBtn = this.createButton(panelX + 130, panelY + 335, 'CANCEL BUILD', () => {
            this.buildMode = false;
            this.selectedRoom = null;
            this.ghostGraphics.clear();
            if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
            this.buildStatusText.setText('Select a room to build');
        }, 240, 26);
    }

    createBuildButton(x, y, text, cost, roomKey, callback) {
        const rect = this.add.rectangle(x, y, 240, 30, 0x333355).setInteractive();
        const label = this.add.text(x, y, text, {
            fontSize: '12px', fill: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        const costLabel = this.add.text(x + 100, y, `${cost}cr`, {
            fontSize: '11px', fill: '#FFD700', fontFamily: 'monospace'
        }).setOrigin(0.5);

        rect.on('pointerover', () => rect.setFillStyle(0x555577));
        rect.on('pointerout', () => rect.setFillStyle(0x333355));
        rect.on('pointerdown', () => {
            if (this.buildMode && this.selectedRoom === roomKey) {
                // Toggle off
                this.buildMode = false;
                this.selectedRoom = null;
                this.ghostGraphics.clear();
                if (this.ghostIcon) { this.ghostIcon.destroy(); this.ghostIcon = null; }
                if (this.buildStatusText) this.buildStatusText.setText('Select a room to build');
            } else {
                callback();
            }
        });

        return { rect, text: label, costLabel };
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
            `Fuel: ${this.shipFuel.toFixed(1)}L / ${this.shipFuelCapacity.toFixed(1)}L\n` +
            `Runs: ~${Math.floor(this.shipFuel / 25)}`
        );
        this.creditsText.setText(`Credits: ${this.credits}`);
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
        this.hideRoomControls();
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
