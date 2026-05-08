class Player {
    constructor(scene, x, y) {
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

        // Fuel system
        this.maxFuel = 5000;
        this.fuel = this.maxFuel;
        this.fuelCosts = {
            [this.world.TILE_DIRT]: 10,
            [this.world.TILE_GRASS]: 10,
            [this.world.TILE_STONE]: 10,
            [this.world.TILE_COPPER]: 10,
            [this.world.TILE_IRON]: 10,
            [this.world.TILE_GOLD]: 10,
            [this.world.TILE_RUBY]: 10,
            [this.world.TILE_SAPPHIRE]: 10,
            [this.world.TILE_EMERALD]: 10,
            [this.world.TILE_DIAMOND]: 10,
            [this.world.TILE_AMETHYST]: 10,
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
            const mineX = left - 1;
            let minedAny = false;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom + 1) / 2 * 32, 32, (bottom - top + 1) * 32);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // --- D KEY: Mine right if movement was blocked ---
        if (keys.mineRight.isDown && Math.abs(this.x - oldX) < 1 && now - this.lastMineTime >= this.mineCooldown) {
            const { right, top, bottom } = this.getTileBounds();
            const mineX = right + 1;
            let minedAny = false;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom + 1) / 2 * 32, 32, (bottom - top + 1) * 32);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // --- S KEY: Mine down if on ground ---
        if (keys.mineDown.isDown && this.onGround && now - this.lastMineTime >= this.mineCooldown) {
            const { left, right, bottom } = this.getTileBounds();
            const mineY = bottom + 1;
            let minedAny = false;
            for (let x = left; x <= right; x++) {
                if (this.tryMine(x, mineY)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator((left + right + 1) / 2 * 32, mineY * 32 + 16, (right - left + 1) * 32, 32);
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

        // Placing removed
        // this.handlePlacing();

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
        
        const cost = this.fuelCosts[tile] || 10;
        if (this.fuel < cost) {
            return false; // not enough fuel
        }
        
        this.fuel -= cost;
        this.world.setTile(tileX, tileY, this.world.TILE_AIR);
        this.addToInventory(tile);
        this.scene.updateTile(tileX, tileY);
        return true;
    }

    showMineIndicator(x, y, w, h) {
        this.mineIndicator.x = x;
        this.mineIndicator.y = y;
        this.mineIndicator.setSize(w, h);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0.6);
        this.mineIndicator.setFillStyle(0xff0000, 0.15);
    }

    addToInventory(tile) {
        if (!this.inventory[tile]) this.inventory[tile] = 0;
        this.inventory[tile]++;
    }
}

if (typeof window !== 'undefined') {
    window.Player = Player;
}
