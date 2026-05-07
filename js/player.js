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

        // Mining cooldown (ms)
        this.mineCooldown = 180;
        this.lastMineTime = 0;

        // Create graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, 0x3498db);
        this.sprite.setOrigin(0.5, 1); // Bottom center origin

        // Eyes to show direction
        this.eyeLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 5, 0xffffff);
        this.eyeRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 5, 0xffffff);
        this.pupilLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 2.5, 0x000000);
        this.pupilRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 2.5, 0x000000);

        // Mining indicator
        this.mineIndicator = scene.add.rectangle(0, 0, 32, 32);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
        this.mineIndicator.setFillStyle(0xff0000, 0);

        // Inventory
        this.inventory = {};
        this.selectedSlot = 0;
    }

    update(delta) {
        const dt = delta / 1000;
        const keys = this.scene.keys;

        // Horizontal movement - Arrow keys only
        if (keys.left.isDown) {
            this.vx = -this.speed;
            this.facingRight = false;
        } else if (keys.right.isDown) {
            this.vx = this.speed;
            this.facingRight = true;
        } else {
            this.vx *= this.friction;
            if (Math.abs(this.vx) < 10) this.vx = 0;
        }

        // Jump - W or Space
        if ((keys.jump.isDown || keys.up.isDown) && this.onGround) {
            this.vy = -this.jumpPower;
            this.onGround = false;
        }

        // Apply gravity
        this.vy += this.gravity * dt;

        // Apply velocity with collision
        this.moveX(this.vx * dt);
        this.moveY(this.vy * dt);

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

        // Mining with A/S/D
        this.handleKeyboardMining();

        // Placing
        this.handlePlacing();

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

        // Feet collision (landing)
        if (this.vy > 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, feetRow)) {
                    this.y = feetRow * 32;
                    this.vy = 0;
                    this.onGround = true;
                    break;
                }
            }
        }
        // Head collision
        else if (this.vy < 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, top)) {
                    this.y = (top + 1) * 32 + this.height;
                    this.vy = 0;
                    break;
                }
            }
        }
    }

    handleKeyboardMining() {
        const keys = this.scene.keys;
        const now = this.scene.time.now;

        if (now - this.lastMineTime < this.mineCooldown) return;

        let mined = false;
        const { left, right, top, bottom } = this.getTileBounds();

        // Mine left (A key)
        if (keys.mineLeft.isDown) {
            const mineX = left - 1;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) mined = true;
            }
            this.showMineIndicator(mineX * 32 + 16, (top + bottom + 1) / 2 * 32, 32, (bottom - top + 1) * 32);
        }
        // Mine right (D key)
        else if (keys.mineRight.isDown) {
            const mineX = right + 1;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y)) mined = true;
            }
            this.showMineIndicator(mineX * 32 + 16, (top + bottom + 1) / 2 * 32, 32, (bottom - top + 1) * 32);
        }
        // Mine down (S key)
        else if (keys.mineDown.isDown) {
            const mineY = bottom + 1;
            for (let x = left; x <= right; x++) {
                if (this.tryMine(x, mineY)) mined = true;
            }
            this.showMineIndicator((left + right + 1) / 2 * 32, mineY * 32 + 16, (right - left + 1) * 32, 32);
        } else {
            // Hide indicator when not mining
            this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
            this.mineIndicator.setFillStyle(0xff0000, 0);
        }

        if (mined) {
            this.lastMineTime = now;
        }
    }

    tryMine(tileX, tileY) {
        const tile = this.world.getTile(tileX, tileY);
        if (tile !== this.world.TILE_AIR && tile !== this.world.TILE_BEDROCK) {
            this.world.setTile(tileX, tileY, this.world.TILE_AIR);
            this.addToInventory(tile);
            this.scene.updateTile(tileX, tileY);
            return true;
        }
        return false;
    }

    showMineIndicator(x, y, w, h) {
        this.mineIndicator.x = x;
        this.mineIndicator.y = y;
        this.mineIndicator.setSize(w, h);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0.6);
        this.mineIndicator.setFillStyle(0xff0000, 0.15);
    }

    handlePlacing() {
        if (!this.scene.input.activePointer.rightButtonDown()) return;

        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);

        const dx = (tileX * 32 + 16) - this.x;
        const dy = (tileY * 32 + 16) - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
            const tile = this.world.getTile(tileX, tileY);
            if (tile === this.world.TILE_AIR) {
                const { left, right, top, bottom } = this.getTileBounds();

                if (tileX < left || tileX > right || tileY < top || tileY > bottom) {
                    this.world.setTile(tileX, tileY, this.world.TILE_DIRT);
                    this.scene.updateTile(tileX, tileY);
                }
            }
        }
    }

    addToInventory(tile) {
        if (!this.inventory[tile]) this.inventory[tile] = 0;
        this.inventory[tile]++;
    }
}

if (typeof window !== 'undefined') {
    window.Player = Player;
}
