class GalaxyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GalaxyScene' });
    }

    init(data) {
        this.shipGrid = data.shipGrid || [];
        this.shipInventory = data.shipInventory || {};
        this.credits = data.credits || 0;
        this.shipFuel = data.shipFuel || 20000;
        this.shipFuelCapacity = data.shipFuelCapacity || 20000;
        this.engineLevel = this.calculateEngineLevel();
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

        // Title
        this.add.text(640, 30, 'GALAXY MAP', {
            fontSize: '32px', fill: '#FFD700', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Back button
        this.createButton(100, 40, '← BACK TO SHIP', () => {
            this.scene.start('ShipScene', {
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
            });
        }, 180, 36);

        // Planet definitions
        this.planets = [
            { name: 'Asteroid Alpha', depth: 300, size: 200, richness: 0.8, engineReq: 0, color: 0x888888, desc: 'Small rocky body. Basic ores.' },
            { name: 'Asteroid Beta', depth: 400, size: 250, richness: 1.0, engineReq: 0, color: 0xAA8866, desc: 'Larger asteroid. Better gem rates.' },
            { name: 'Planet Gamma', depth: 500, size: 300, richness: 1.2, engineReq: 1, color: 0x448844, desc: 'Small planet. Deeper, richer.' },
            { name: 'Planet Delta', depth: 600, size: 300, richness: 1.3, engineReq: 1, color: 0x6644AA, desc: 'Dense core. Rare gems common.' },
            { name: 'Moon Epsilon', depth: 700, size: 350, richness: 1.5, engineReq: 2, color: 0xCCCCCC, desc: 'Large moon. Deep mining.' },
            { name: 'Gas Giant Ring', depth: 800, size: 400, richness: 1.8, engineReq: 2, color: 0xFFAA44, desc: 'Ancient ring debris. Legendary ores.' },
        ];

        // Draw planets
        const startX = 200;
        const startY = 150;
        const gapX = 220;
        const gapY = 140;

        this.planets.forEach((planet, i) => {
            const px = startX + (i % 3) * gapX;
            const py = startY + Math.floor(i / 3) * gapY;

            // Planet circle
            const circle = this.add.circle(px, py, 30, planet.color);
            circle.setStrokeStyle(2, 0xffffff, 0.5);

            if (this.engineLevel >= planet.engineReq) {
                circle.setInteractive();
                circle.on('pointerover', () => circle.setScale(1.2));
                circle.on('pointerout', () => circle.setScale(1));
                circle.on('pointerdown', () => this.selectPlanet(planet));

                // Orbital ring
                this.add.ellipse(px, py, 70, 20, 0xffffff, 0).setStrokeStyle(1, 0xffffff, 0.2);
            } else {
                circle.setFillStyle(0x333333);
                this.add.text(px, py + 45, `Needs Engine ${planet.engineReq}`, {
                    fontSize: '10px', fill: '#ff4444'
                }).setOrigin(0.5);
            }

            // Name
            this.add.text(px, py + 50, planet.name, {
                fontSize: '14px', fill: '#ffffff'
            }).setOrigin(0.5);
        });

        // Stats
        this.add.text(860, 120, 'SHIP STATUS', { fontSize: '18px', fill: '#00FF00' });
        this.add.text(860, 150, `Engine Level: ${this.engineLevel}`, { fontSize: '14px', fill: '#ffffff' });
        this.add.text(860, 180, `Fuel: ${this.shipFuel}`, { fontSize: '14px', fill: '#ffffff' });
        this.add.text(860, 210, `Credits: ${this.credits}`, { fontSize: '14px', fill: '#ffffff' });

        // Planet info panel (updates on selection)
        this.infoPanel = this.add.text(860, 280, 'Select a planet', {
            fontSize: '14px', fill: '#aaaaaa', wordWrap: { width: 300 }
        });
    }

    selectPlanet(planet) {
        this.selectedPlanet = planet;
        this.infoPanel.setText(
            `${planet.name}\n` +
            `Depth: ${planet.depth} tiles\n` +
            `Map size: ${planet.size} wide\n` +
            `Ore richness: ${(planet.richness * 100).toFixed(0)}%\n` +
            `\n${planet.desc}\n\n` +
            `Click LAUNCH to begin mining run.`
        );

        // Show launch button
        if (this.launchBtn) {
            this.launchBtn.rect.destroy();
            this.launchBtn.text.destroy();
        }
        this.launchBtn = this.createButton(960, 500, 'LAUNCH', () => {
            if (this.shipFuel < 5000) {
                this.infoPanel.setText('Not enough fuel! Need 5000 units.\nReturn to ship to refuel.');
                return;
            }
            this.shipFuel -= 5000;
            this.scene.start('GameScene', {
                planet: planet,
                shipGrid: this.shipGrid,
                shipInventory: this.shipInventory,
                credits: this.credits,
                shipFuel: this.shipFuel,
                shipFuelCapacity: this.shipFuelCapacity,
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
