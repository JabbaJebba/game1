class GalaxyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GalaxyScene' });
    }

    init(data) {
        this.shipGrid = data.shipGrid || [];
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel !== undefined ? data.shipFuel : 100;
        this.shipFuelCapacity = data.shipFuelCapacity !== undefined ? data.shipFuelCapacity : 100;
        this.engineLevel = this.calculateEngineLevel();
        this.rockCompositions = data.rockCompositions || {};
        this.techState = data.techState || { fuelTankLevel: 0 };
    }

    calculateEngineLevel() {
        let count = 0;
        for (let x = 0; x < this.shipGrid.length; x++) {
            for (let y = 0; y < this.shipGrid[x].length; y++) {
                if (this.shipGrid[x][y]?.type === 'engine') count++;
            }
        }
        return count;
    }

    create() {
        this.cameras.main.setBackgroundColor('#0a0a1a');

        this.add.text(640, 30, 'GALAXY MAP', {
            fontSize: '32px', fill: '#FFD700', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.createButton(100, 40, '← BACK TO SHIP', () => {
            this.scene.start('ShipScene', {
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
                rockCompositions: this.rockCompositions,
                techState: this.techState,
            });
        }, 180, 36);

        // Rock type definitions - each location has unique rock with composition
        this.rockTypes = [
            { name: 'Basalt', copper: 0.30, iron: 0.25, gold: 0.08, gemChance: 0.03, color: 0x808080, desc: 'Volcanic rock. Rich in copper.' },
            { name: 'Granite', copper: 0.20, iron: 0.35, gold: 0.12, gemChance: 0.05, color: 0x9B9B7A, desc: 'Crystalline. Iron-rich.' },
            { name: 'Obsidian', copper: 0.10, iron: 0.15, gold: 0.25, gemChance: 0.02, color: 0x2D2D2D, desc: 'Glassy volcanic. Gold-heavy.' },
            { name: 'Pumice', copper: 0.35, iron: 0.10, gold: 0.05, gemChance: 0.08, color: 0xC0C0C0, desc: 'Light and porous. Gem-rich.' },
            { name: 'Slate', copper: 0.15, iron: 0.30, gold: 0.15, gemChance: 0.04, color: 0x556B2F, desc: 'Metamorphic. Balanced ores.' },
            { name: 'Marble', copper: 0.08, iron: 0.20, gold: 0.20, gemChance: 0.10, color: 0xF5F5DC, desc: 'Calcite crystal. Gem paradise.' },
        ];

        this.planets = [
            { name: 'Asteroid Alpha', depth: 300, size: 200, richness: 0.8, engineReq: 0, color: 0x888888, desc: 'Small rocky body. Basalt composition.' },
            { name: 'Asteroid Beta', depth: 400, size: 250, richness: 1.0, engineReq: 0, color: 0xAA8866, desc: 'Larger asteroid. Granite veins.' },
            { name: 'Planet Gamma', depth: 500, size: 300, richness: 1.2, engineReq: 1, color: 0x448844, desc: 'Small planet. Obsidian core.' },
            { name: 'Planet Delta', depth: 600, size: 300, richness: 1.3, engineReq: 1, color: 0x6644AA, desc: 'Dense core. Pumice mantle.' },
            { name: 'Moon Epsilon', depth: 700, size: 350, richness: 1.5, engineReq: 2, color: 0xCCCCCC, desc: 'Large moon. Slate deposits.' },
            { name: 'Gas Giant Ring', depth: 800, size: 400, richness: 1.8, engineReq: 2, color: 0xFFAA44, desc: 'Ancient ring debris. Marble.' },
        ];

        // Assign rock type to each planet
        this.planets.forEach((planet, i) => {
            planet.rockType = this.rockTypes[i % this.rockTypes.length];
        });

        const startX = 200;
        const startY = 150;
        const gapX = 220;
        const gapY = 140;

        this.planetObjects = [];

        this.planets.forEach((planet, i) => {
            const px = startX + (i % 3) * gapX;
            const py = startY + Math.floor(i / 3) * gapY;

            const circle = this.add.circle(px, py, 30, planet.color);
            circle.setStrokeStyle(2, 0xffffff, 0.5);

            if (this.engineLevel >= planet.engineReq) {
                circle.setInteractive();
                circle.on('pointerover', () => circle.setScale(1.2));
                circle.on('pointerout', () => circle.setScale(1));
                circle.on('pointerdown', () => this.selectPlanet(planet));
                this.add.ellipse(px, py, 70, 20, 0xffffff, 0).setStrokeStyle(1, 0xffffff, 0.2);
            } else {
                circle.setFillStyle(0x333333);
                this.add.text(px, py + 45, `Needs Engine ${planet.engineReq}`, {
                    fontSize: '10px', fill: '#ff4444'
                }).setOrigin(0.5);
            }

            this.add.text(px, py + 50, planet.name, {
                fontSize: '14px', fill: '#ffffff'
            }).setOrigin(0.5);

            // Rock type label below name
            this.add.text(px, py + 66, planet.rockType.name, {
                fontSize: '10px', fill: '#aaaaaa'
            }).setOrigin(0.5);
        });

        this.add.text(860, 120, 'SHIP STATUS', { fontSize: '18px', fill: '#00FF00' });
        this.add.text(860, 150, `Engine Level: ${this.engineLevel}`, { fontSize: '14px', fill: '#ffffff' });
        this.add.text(860, 180, `Fuel: ${this.shipFuel.toFixed(1)}L / ${this.shipFuelCapacity.toFixed(1)}L`, { fontSize: '14px', fill: '#ffffff' });
        this.add.text(860, 210, `Credits: ${this.credits}`, { fontSize: '14px', fill: '#ffffff' });

        this.infoPanel = this.add.text(860, 280, 'Select a planet', {
            fontSize: '14px', fill: '#aaaaaa', wordWrap: { width: 300 }
        });
    }

    selectPlanet(planet) {
        this.selectedPlanet = planet;
        const rt = planet.rockType;
        this.infoPanel.setText(
            `${planet.name}\n` +
            `Rock: ${rt.name}\n` +
            `  Cu: ${(rt.copper * 100).toFixed(0)}% | Fe: ${(rt.iron * 100).toFixed(0)}%\n` +
            `  Au: ${(rt.gold * 100).toFixed(0)}% | Gems: ${(rt.gemChance * 100).toFixed(0)}%\n` +
            `Depth: ${planet.depth} tiles | Size: ${planet.size}\n` +
            `Richness: ${(planet.richness * 100).toFixed(0)}%\n` +
            `\n${planet.desc}\n\nClick LAUNCH to begin mining run.`
        );

        if (this.launchBtn) {
            this.launchBtn.rect.destroy();
            this.launchBtn.text.destroy();
        }
        this.launchBtn = this.createButton(960, 500, 'LAUNCH', () => {
            if (this.shipFuel < 25) {
                this.infoPanel.setText('Not enough fuel! Need 25L to launch. Return to ship to buy fuel.');
                return;
            }
            // Store composition for this rock type
            this.rockCompositions[rt.name] = { ...rt };
            this.scene.start('GameScene', {
                planet: planet,
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
                rockType: rt,
                rockCompositions: this.rockCompositions,
                techState: this.techState,
            });
        }, 200, 50);
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
}

if (typeof window !== 'undefined') {
    window.GalaxyScene = GalaxyScene;
}
