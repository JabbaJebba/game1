class Player {
    constructor(scene, x, y, data = {}) {
        this.scene = scene;
        this.world = scene.world;
        this.tileSize = 32;

        // Tile coordinates — character is 2 tiles wide, 3 tiles tall visually
        // Hitbox is 2 tiles tall (upper body). Bottom row is the "feet zone".
        this.tileX = x - 1;      // left column
        this.tileY = y - 1;      // bottom row (feet at boundary between tileY and tileY+1)

        // Pixel position
        this.x = (this.tileX + 1) * this.tileSize;
        this.y = (this.tileY + 1) * this.tileSize;

        this.width = 64;
        this.height = 96;

        // State
        this.facingRight = true;
        this.isMining = false;
        this.onGround = false;
        this.isMoving = false;
        this.moveTween = null;

        // Timing (ms)
        this.moveDuration = 160;
        this.fallDuration = 90;
        this.jumpRiseDuration = 280;    // base time for full jumpHeight
        this.jumpHangDuration = 140;    // brief pause at peak
        this.jumpFallDuration = 220;    // time to descend
        this.moveRepeatRate = 180;
        this.lastMoveTime = -9999;
        this.mineCooldown = 180;
        this.lastMineTime = 0;

        // Jump
        this.jumpHeight = 3;
        this.isJumping = false;
        this.jumpPhase = 'none'; // 'rising' | 'hanging' | 'falling' | 'none'

        // Graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, 0x3498db);
        this.sprite.setOrigin(0.5, 1);

        this.eyeLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 5, 0xffffff);
        this.eyeRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 5, 0xffffff);
        this.pupilLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 2.5, 0x000000);
        this.pupilRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 2.5, 0x000000);

        this.mineIndicator = scene.add.rectangle(0, 0, 32, 32);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
        this.mineIndicator.setFillStyle(0xff0000, 0);

        // Fuel
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

        this.inventory = {};
        this.selectedSlot = 0;
        this.keyJumpWasDown = false;
    }

    // Check if the full 2×3 body at (tileX, tileY) is clear
    // Character is 3 tiles tall: rows tileY-2 (head), tileY-1 (torso), tileY (legs)
    // The character stands on row tileY+1 (ground below feet)
    canExistAt(tileX, tileY) {
        for (let y = tileY - 2; y <= tileY; y++) {
            for (let x = tileX; x <= tileX + 1; x++) {
                if (this.world.isSolid(x, y)) return false;
            }
        }
        return true;
    }

    // Check only rows ABOVE current head for vertical rise
    // Head is at row tileY-2. Rising by N tiles enters rows tileY-2-1 .. tileY-2-N
    canRise(tiles) {
        for (let dy = 1; dy <= tiles; dy++) {
            const checkRow = this.tileY - 2 - dy;
            for (let x = this.tileX; x <= this.tileX + 1; x++) {
                if (this.world.isSolid(x, checkRow)) return false;
            }
        }
        return true;
    }

    // Check if we can land at (tileX, tileY) — body clear + ground below
    canLandAt(tileX, tileY) {
        if (!this.canExistAt(tileX, tileY)) return false;
        // Need ground below at least one foot
        return this.world.isSolid(tileX, tileY + 1) || this.world.isSolid(tileX + 1, tileY + 1);
    }

    updatePixelPosition(animate = false, durationMs = 100, ease = 'Power2') {
        const targetX = (this.tileX + 1) * this.tileSize;
        const targetY = (this.tileY + 1) * this.tileSize;

        if (animate && this.scene.tweens) {
            if (this.moveTween) this.moveTween.stop();
            this.isMoving = true;
            this.moveTween = this.scene.tweens.add({
                targets: this.sprite,
                x: targetX,
                y: targetY,
                duration: durationMs,
                ease: ease,
                onUpdate: () => {
                    this.x = this.sprite.x;
                    this.y = this.sprite.y;
                    this.updateEyesOnly();
                },
                onComplete: () => {
                    this.x = targetX;
                    this.y = targetY;
                    this.isMoving = false;
                    this.updateEyesOnly();
                }
            });
        } else {
            this.x = targetX;
            this.y = targetY;
            this.sprite.x = targetX;
            this.sprite.y = targetY;
            this.isMoving = false;
            this.updateEyesOnly();
        }
    }

    updateEyesOnly() {
        const eyeOffsetX = this.facingRight ? 3 : -3;
        this.eyeLeft.x = this.x - 12 + eyeOffsetX;
        this.eyeLeft.y = this.y - this.height + 18;
        this.eyeRight.x = this.x + 12 + eyeOffsetX;
        this.eyeRight.y = this.y - this.height + 18;
        this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5;
        this.pupilLeft.y = this.y - this.height + 18;
        this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5;
        this.pupilRight.y = this.y - this.height + 18;
    }

    update(delta) {
        const keys = this.scene.keys;
        const now = this.scene.time.now;

        this.isMining = false;

        // --- GROUND CHECK ---
        const groundLeft = this.world.isSolid(this.tileX, this.tileY + 1);
        const groundRight = this.world.isSolid(this.tileX + 1, this.tileY + 1);
        this.onGround = groundLeft || groundRight;

        if (this.onGround) {
            this.isJumping = false;
            this.jumpPhase = 'none';
        }

        // --- GRAVITY ---
        if (!this.onGround && !this.isMoving && !this.isJumping) {
            let drop = 0;
            const maxDrop = 6;
            while (drop < maxDrop && this.canExistAt(this.tileX, this.tileY + drop + 1)) {
                drop++;
            }
            if (drop > 0) {
                this.tileY += drop;
                const duration = Math.min(300, this.fallDuration * drop);
                this.updatePixelPosition(true, duration, drop > 2 ? 'Cubic.easeIn' : 'Power2');
            }
        }

        // --- JUMP (edge-triggered, only on ground) ---
        if ((keys.jump.isDown || keys.up.isDown) && this.onGround && !this.keyJumpWasDown) {
            let dx = 0;
            if (keys.mineLeft.isDown || keys.left.isDown) dx = -1;
            else if (keys.mineRight.isDown || keys.right.isDown) dx = 1;

            if (dx !== 0) {
                // DIAGONAL JUMP: find the smallest rise that gives a valid landing
                const targetX = this.tileX + dx;
                let diagonalSuccess = false;
                for (let rise = 1; rise <= this.jumpHeight; rise++) {
                    const targetY = this.tileY - rise;
                    if (this.canRise(rise) && this.canLandAt(targetX, targetY)) {
                        this.tileY = targetY;
                        this.tileX = targetX;
                        this.facingRight = dx > 0;
                        this.isJumping = true;
                        this.jumpPhase = 'rising';
                        this.animateJump(rise);
                        diagonalSuccess = true;
                        break;
                    }
                }
                if (!diagonalSuccess) {
                    // Fallback: pure vertical jump
                    this.doVerticalJump();
                }
            } else {
                // PURE VERTICAL JUMP
                this.doVerticalJump();
            }
        }
        this.keyJumpWasDown = keys.jump.isDown || keys.up.isDown;

        // --- HORIZONTAL: move or mine ---
        const leftDown = keys.mineLeft.isDown || keys.left.isDown;
        const rightDown = keys.mineRight.isDown || keys.right.isDown;

        if (leftDown && !this.isMoving && now - this.lastMoveTime >= this.moveRepeatRate) {
            this.handleHorizontal(-1, now);
        }
        if (rightDown && !this.isMoving && now - this.lastMoveTime >= this.moveRepeatRate) {
            this.handleHorizontal(1, now);
        }

        // --- DOWN: mine below (only on ground) ---
        if (keys.mineDown.isDown && this.onGround && !this.isMoving && now - this.lastMineTime >= this.mineCooldown) {
            const mineY = this.tileY + 1;
            let minedAny = false;
            for (let x = this.tileX; x <= this.tileX + 1; x++) {
                if (this.tryMine(x, mineY)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator((this.tileX + 1) * 32, mineY * 32 + 16, 64, 32);
                this.lastMineTime = now;
                this.isMining = true;
            }
        }

        // Hide mine indicator when not mining
        if (!this.isMining) {
            this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
            this.mineIndicator.setFillStyle(0xff0000, 0);
        }

        // --- WORLD BOUNDS ---
        if (this.tileX < 0) {
            this.tileX = 0;
            this.updatePixelPosition();
        }
        if (this.tileX > this.world.width - 2) {
            this.tileX = this.world.width - 2;
            this.updatePixelPosition();
        }
    }

    doVerticalJump() {
        let jumped = 0;
        for (let i = 0; i < this.jumpHeight; i++) {
            if (this.canRise(1)) {
                this.tileY--;
                jumped++;
            } else {
                break;
            }
        }
        if (jumped > 0) {
            this.isJumping = true;
            this.jumpPhase = 'rising';
            this.animateJump(jumped);
        }
    }

    handleHorizontal(dx, now) {
        this.facingRight = dx > 0;
        const newTileX = this.tileX + dx;

        if (this.canExistAt(newTileX, this.tileY)) {
            this.tileX = newTileX;
            this.lastMoveTime = now;
            this.updatePixelPosition(true, this.moveDuration);
        } else {
            // Blocked — mine the column
            if (now - this.lastMineTime >= this.mineCooldown) {
                const mineX = dx > 0 ? this.tileX + 2 : this.tileX - 1;
                let minedAny = false;
                for (let y = this.tileY - 2; y <= this.tileY; y++) {
                    if (this.tryMine(mineX, y)) minedAny = true;
                }
                if (minedAny) {
                    this.showMineIndicator(mineX * 32 + 16, (this.tileY - 2) * 32 + 48, 32, 96);
                    this.lastMineTime = now;
                    this.isMining = true;
                    this.lastMoveTime = now;
                }
            }
        }
    }

    animateJump(riseTiles) {
        if (this.moveTween) this.moveTween.stop();
        this.isMoving = true;

        const targetX = (this.tileX + 1) * this.tileSize;
        const targetY = (this.tileY + 1) * this.tileSize;

        // Scale duration by how many tiles we're actually jumping
        const duration = Math.max(120, this.jumpRiseDuration * riseTiles / this.jumpHeight);

        this.moveTween = this.scene.tweens.add({
            targets: this.sprite,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                this.x = this.sprite.x;
                this.y = this.sprite.y;
                this.updateEyesOnly();
            },
            onComplete: () => {
                this.x = targetX;
                this.y = targetY;
                this.isMoving = false;
                this.jumpPhase = 'falling';
                this.isJumping = false;
                this.updateEyesOnly();
            }
        });
    }

    tryMine(tileX, tileY) {
        const tile = this.world.getTile(tileX, tileY);
        if (tile === this.world.TILE_AIR || tile === this.world.TILE_BEDROCK) {
            return false;
        }

        const cost = this.fuelCosts[tile] || 0.05;
        if (this.fuel < cost) {
            return false;
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