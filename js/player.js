class Player {
    constructor(scene, x, y, data = {}) {
        this.scene = scene;
        this.world = scene.world;

        // Position (in pixels)
        this.x = x * 32;
        this.y = y * 32;

        // Size: 2 tiles wide, 3 tiles tall
        this.width = 64;
        this.height = 96;

        // Velocity
        this.vx = 0;
        this.vy = 0;

        // Movement constants
        this.speed = 180;
        this.jumpPower = 420;
        this.gravity = 1100;
        this.friction = 0.82;

        // State
        this.onGround = false;
        this.facingRight = true;
        this.isMining = false;

        // Mining cooldown (ms)
        this.mineCooldown = 180;
        this.lastMineTime = 0;

        // Create graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, 0x3498db);
        this.sprite.setOrigin(0.5, 1);

        // Eyes to show direction
        this.eyeLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 5, 0xffffff);
        this.eyeRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 5, 0xffffff);
        this.pupilLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 2.5, 0x000000);
        this.pupilRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 2.5, 0x000000);

        // Mining indicator
        this.mineIndicator = scene.add.rectangle(0, 0, 32, 32);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
        this.mineIndicator.setFillStyle(0xff0000, 0);

        // Fuel system (liters, 1 unit = 5ml)
        this.maxFuel = data.fuel || 25;
        this.fuel = this.maxFuel;
        const effLevel = data.efficiencyLevel || 0;
        const baseCost = 0.05;
        const effReduction = effLevel * 0.001;
        const miningCost = Math.max(0.04, baseCost - effReduction);
        this.fuelCosts = {
            [this.world.TILE_GRASS]: miningCost,
            [this.world.TILE_ROCK]: miningCost,
            [this.world.TILE_COPPER]: miningCost,
            [this.world.TILE_IRON]: miningCost,
            [this.world.TILE_GOLD]: miningCost,
            [this.world.TILE_RUBY]: miningCost,
            [this.world.TILE_SAPPHIRE]: miningCost,
            [this.world.TILE_EMERALD]: miningCost,
            [this.world.TILE_DIAMOND]: miningCost,
            [this.world.TILE_AMETHYST]: miningCost,
        };

        // Inventory
        this.inventory = {};
        this.selectedSlot = 0;
    }

    update(delta) {
        const dt = delta / 1000;
        const keys = this.scene.keys;
        const now = this.scene.time.now;

        this.isMining = false;

        // Remember position before movement
        const oldX = this.x;
        const oldY = this.y;

        // Horizontal movement - A/D and Arrow keys
        if (keys.mineLeft.isDown || keys.left.isDown) {
            this.vx = -this.speed;
            this.facingRight = false;
        } else if (keys.mineRight.isDown || keys.right.isDown) {
            this.vx = this.speed;
            this.facingRight = true;
        } else {
            this.vx *= this.friction;
            if (Math.abs(this.vx) < 10) this.vx = 0;
        }

        // Jump
        if ((keys.jump.isDown || keys.up.isDown) && this.onGround) {
            this.vy = -this.jumpPower;
            this.onGround = false;
        }

        // Apply gravity
        this.vy += this.gravity * dt;

        // Apply movement
        this.moveX(this.vx * dt);
        this.moveY(this.vy * dt);

        // --- A KEY: Mine left if movement was blocked ---
        if (keys.mineLeft.isDown && Math.abs(this.x - oldX) < 1 && now - this.lastMineTime >= this.mineCooldown) {
            const { left, top, bottom } = this.getTileBounds();
            const mineX = left - 1; // one tile left of player's left edge
            let minedAny = false;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom) / 2 * 32 + 16, 32, 96);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // --- D KEY: Mine right if movement was blocked ---
        if (keys.mineRight.isDown && Math.abs(this.x - oldX) < 1 && now - this.lastMineTime >= this.mineCooldown) {
            const { right, top, bottom } = this.getTileBounds();
            const mineX = right + 1; // one tile right of player's right edge
            let minedAny = false;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom) / 2 * 32 + 16, 32, 96);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // --- S KEY: Mine down if on ground ---
        if (keys.mineDown.isDown && this.onGround && now - this.lastMineTime >= this.mineCooldown) {
            const { left, right, bottom } = this.getTileBounds();
            const mineY = bottom + 1;
            let minedAny = false;
            // Mine exactly the tiles under the character's width
            for (let x = left; x <= right; x++) {
                if (this.tryMine(x, mineY)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator((left + right) / 2 * 32 + 16, mineY * 32 + 16, 64, 32);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // Update sprite position
        this.sprite.x = this.x;
        this.sprite.y = this.y;

        // Update eyes
        const eyeOffsetX = this.facingRight ? 3 : -3;
        this.eyeLeft.x = this.x - 12 + eyeOffsetX;
        this.eyeLeft.y = this.y - this.height + 18;
        this.eyeRight.x = this.x + 12 + eyeOffsetX;
        this.eyeRight.y = this.y - this.height + 18;
        this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5;
        this.pupilLeft.y = this.y - this.height + 18;
        this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5;
        this.pupilRight.y = this.y - this.height + 18;

        // Hide mine indicator if not mining
        if (!this.isMining) {
            this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
            this.mineIndicator.setFillStyle(0xff0000, 0);
        }

        // --- SNAP TO TILE GRID ---
        // Only snap when on ground, nearly stopped, and not holding movement keys
        const holdingMoveKey = keys.mineLeft.isDown || keys.left.isDown || keys.mineRight.isDown || keys.right.isDown;
        if (this.onGround && !holdingMoveKey && Math.abs(this.vx) < 5) {
            const snapX = Math.round(this.x / 32) * 32;
            if (Math.abs(snapX - this.x) > 0.5) {
                const oldX = this.x;
                this.x = snapX;
                const { left, right, top, bottom } = this.getTileBounds();
                let blocked = false;
                for (let ty = top; ty <= bottom; ty++) {
                    if (this.world.isSolid(left, ty) || this.world.isSolid(right, ty)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) {
                    this.x = oldX;
                } else {
                    this.sprite.x = this.x;
                    const eyeOffsetX = this.facingRight ? 3 : -3;
                    this.eyeLeft.x = this.x - 12 + eyeOffsetX;
                    this.eyeRight.x = this.x + 12 + eyeOffsetX;
                    this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5;
                    this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5;
                }
            }
        }

        // Keep in world bounds
        const worldWidthPx = this.world.width * 32;
        if (this.x < this.width / 2) { this.x = this.width / 2; this.vx = 0; }
        if (this.x > worldWidthPx - this.width / 2) { this.x = worldWidthPx - this.width / 2; this.vx = 0; }
    }

    getTileBounds() {
        const left = Math.floor((this.x - this.width / 2) / 32);
        const right = Math.floor((this.x + this.width / 2 - 1) / 32);
        const top = Math.floor((this.y - this.height) / 32);
        const bottom = Math.floor((this.y - 1) / 32);
        return { left, right, top, bottom };
    }

    moveX(amount) {
        this.x += amount;

        const { left, right, top, bottom } = this.getTileBounds();

        for (let ty = top; ty <= bottom; ty++) {
            if (this.world.isSolid(left, ty)) {
                this.x = (left + 1) * 32 + this.width / 2;
                this.vx = 0;
                break;
            }
            if (this.world.isSolid(right, ty)) {
                this.x = right * 32 - this.width / 2;
                this.vx = 0;
                break;
            }
        }
    }

    moveY(amount) {
        this.y += amount;
        this.onGround = false;

        const { left, right, top, bottom } = this.getTileBounds();
        const feetRow = Math.floor(this.y / 32);

        if (this.vy > 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, feetRow)) {
                    this.y = feetRow * 32;
                    this.vy = 0;
                    this.onGround = true;
                    break;
                }
            }
        } else if (this.vy < 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, top)) {
                    this.y = (top + 1) * 32 + this.height;
                    this.vy = 0;
                    break;
                }
            }
        }
    }

    tryMine(tileX, tileY) {
        const tile = this.world.getTile(tileX, tileY);
        if (tile === this.world.TILE_AIR || tile === this.world.TILE_BEDROCK) {
            return false;
        }
        
        const cost = this.fuelCosts[tile] || 0.05;
        if (this.fuel < cost) {
            return false; // not enough fuel
        }
        
        this.fuel -= cost;
        this.world.setTile(tileX, tileY, this.world.TILE_AIR);
        this.addToInventory(tile);
        this.scene.updateTile(tileX, tileY);
        
        // Screen shake on successful mine
        this.scene.cameras.main.shake(60, 0.004);

        // Debris particles
        const tileColor = this.scene.tileColors[tile] || 0xffffff;
        this.scene.spawnDebris(tileX, tileY, tileColor);

        // Floating loot text
        const itemName = this.getItemName(tile);
        const itemColor = this.getItemColor(tile);
        this.scene.showFloatText(tileX * 32 + 16, tileY * 32 - 8, `+1 ${itemName}`, itemColor);
        
        return true;
    }

    getItemName(tile) {
        if (tile === this.world.TILE_ROCK) return this.world.rockType?.name || 'Rock';
        if (tile === this.world.TILE_COPPER) return 'Copper Ore';
        if (tile === this.world.TILE_IRON) return 'Iron Ore';
        if (tile === this.world.TILE_GOLD) return 'Gold Ore';
        if (tile === this.world.TILE_RUBY) return 'Ruby';
        if (tile === this.world.TILE_SAPPHIRE) return 'Sapphire';
        if (tile === this.world.TILE_EMERALD) return 'Emerald';
        if (tile === this.world.TILE_DIAMOND) return 'Diamond';
        if (tile === this.world.TILE_AMETHYST) return 'Amethyst';
        return 'Unknown';
    }

    getItemColor(tile) {
        if (tile === this.world.TILE_ROCK) return '#aaaaaa';
        if (tile === this.world.TILE_COPPER) return '#ffaa55';
        if (tile === this.world.TILE_IRON) return '#cccccc';
        if (tile === this.world.TILE_GOLD) return '#ffdd44';
        if (tile === this.world.TILE_RUBY) return '#ff4444';
        if (tile === this.world.TILE_SAPPHIRE) return '#4488ff';
        if (tile === this.world.TILE_EMERALD) return '#44ff88';
        if (tile === this.world.TILE_DIAMOND) return '#88eeff';
        if (tile === this.world.TILE_AMETHYST) return '#cc88ff';
        return '#ffffff';
    }

    showMineIndicator(x, y, w, h) {
        this.mineIndicator.x = x;
        this.mineIndicator.y = y;
        this.mineIndicator.setSize(w, h);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0.6);
        this.mineIndicator.setFillStyle(0xff0000, 0.15);
        // Flash effect
        this.scene.tweens.add({
            targets: this.mineIndicator,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 80,
            yoyo: true,
            ease: 'Quad.easeOut'
        });
    }

    addToInventory(tile) {
        let itemName;
        if (tile === this.world.TILE_ROCK) {
            itemName = this.world.rockType?.name || 'Rock';
        } else if (tile === this.world.TILE_COPPER) {
            itemName = 'Copper Ore';
        } else if (tile === this.world.TILE_IRON) {
            itemName = 'Iron Ore';
        } else if (tile === this.world.TILE_GOLD) {
            itemName = 'Gold Ore';
        } else if (tile === this.world.TILE_RUBY) {
            itemName = 'Ruby';
        } else if (tile === this.world.TILE_SAPPHIRE) {
            itemName = 'Sapphire';
        } else if (tile === this.world.TILE_EMERALD) {
            itemName = 'Emerald';
        } else if (tile === this.world.TILE_DIAMOND) {
            itemName = 'Diamond';
        } else if (tile === this.world.TILE_AMETHYST) {
            itemName = 'Amethyst';
        } else {
            itemName = String(tile);
        }
        if (!this.inventory[tile]) this.inventory[tile] = 0;
        this.inventory[tile]++;
    }
}

if (typeof window !== 'undefined') {
    window.Player = Player;
}
