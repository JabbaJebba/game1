class Player {
    constructor(scene, x, y, data = {}) {
        this.scene = scene;
        this.world = scene.world;
        this.tileSize = 32;

        // Tile coordinates (source of truth)
        // Old physics code spawned at x_pixel = spawnX * 32 with origin at center,bottom.
        // Character is 2 tiles wide, 3 tiles tall.
        // Old left tile  = floor((x_pixel - 32) / 32) = spawnX - 1
        // Old bottom row = floor((y_pixel - 1) / 32) = spawnY - 1 (when y = spawnY * 32)
        this.tileX = x - 1;      // left column of the 2-wide character
        this.tileY = y - 1;      // bottom-most row the character occupies

        // Pixel position (derived, matches old physics spawn exactly)
        this.x = (this.tileX + 1) * this.tileSize; // center between the two columns
        this.y = (this.tileY + 1) * this.tileSize; // feet at boundary between tileY and tileY+1

        this.width = 64;
        this.height = 96;

        // Movement state
        this.facingRight = true;
        this.isMining = false;
        this.onGround = false;
        this.isMoving = false;   // true while a move tween is running

        // Tween reference
        this.moveTween = null;

        // Timing (ms)
        this.moveDuration = 100;      // tween duration for horizontal step
        this.fallDuration = 60;       // tween duration for falling one tile
        this.jumpDuration = 120;      // tween duration for jumping
        this.moveRepeatRate = 140;    // ms between auto-repeated steps when holding key
        this.lastMoveTime = -9999;    // ensures first press works immediately
        this.mineCooldown = 180;
        this.lastMineTime = 0;

        // Jump
        this.jumpHeight = 2;          // tiles to try to rise

        // Create graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, 0x3498db);
        this.sprite.setOrigin(0.5, 1);

        this.eyeLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 5, 0xffffff);
        this.eyeRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 5, 0xffffff);
        this.pupilLeft = scene.add.circle(this.x - 12, this.y - this.height + 18, 2.5, 0x000000);
        this.pupilRight = scene.add.circle(this.x + 12, this.y - this.height + 18, 2.5, 0x000000);

        // Mining indicator
        this.mineIndicator = scene.add.rectangle(0, 0, 32, 32);
        this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
        this.mineIndicator.setFillStyle(0xff0000, 0);

        // Fuel system
        this.maxFuel = data.fuel || 5000;
        this.fuel = this.maxFuel;
        this.fuelCosts = {
            [this.world.TILE_GRASS]: 10,
            [this.world.TILE_ROCK]: 10,
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

        // Key state (edge detection for jump)
        this.keyJumpWasDown = false;
    }

    // Character occupies columns tileX..tileX+1 and rows tileY-2..tileY
    canExistAt(tileX, tileY) {
        for (let y = tileY - 2; y <= tileY; y++) {
            for (let x = tileX; x <= tileX + 1; x++) {
                if (this.world.isSolid(x, y)) return false;
            }
        }
        return true;
    }

    updatePixelPosition(animate = false, durationMs = 100) {
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
                ease: 'Power2',
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

        // --- GRAVITY: fall one tile at a time ---
        if (!this.onGround && !this.isMoving) {
            if (this.canExistAt(this.tileX, this.tileY + 1)) {
                this.tileY++;
                this.updatePixelPosition(true, this.fallDuration);
            }
        }

        // --- JUMP (edge-triggered, only on ground) ---
        if ((keys.jump.isDown || keys.up.isDown) && this.onGround && !this.keyJumpWasDown) {
            let jumped = 0;
            for (let i = 0; i < this.jumpHeight; i++) {
                if (this.canExistAt(this.tileX, this.tileY - 1)) {
                    this.tileY--;
                    jumped++;
                } else {
                    break;
                }
            }
            if (jumped > 0) {
                this.updatePixelPosition(true, this.jumpDuration);
            }
        }
        this.keyJumpWasDown = keys.jump.isDown || keys.up.isDown;

        // --- LEFT: move or mine ---
        const leftDown = keys.mineLeft.isDown || keys.left.isDown;
        if (leftDown && !this.isMoving && now - this.lastMoveTime >= this.moveRepeatRate) {
            this.facingRight = false;
            const newTileX = this.tileX - 1;
            if (this.canExistAt(newTileX, this.tileY)) {
                // Move left one tile
                this.tileX = newTileX;
                this.lastMoveTime = now;
                this.updatePixelPosition(true, this.moveDuration);
            } else {
                // Blocked — mine the column to the left
                if (now - this.lastMineTime >= this.mineCooldown) {
                    const mineX = this.tileX - 1;
                    let minedAny = false;
                    for (let y = this.tileY - 2; y <= this.tileY; y++) {
                        if (this.tryMine(mineX, y)) minedAny = true;
                    }
                    if (minedAny) {
                        this.showMineIndicator(mineX * 32 + 16, (this.tileY - 2) * 32 + 48, 32, 96);
                        this.lastMineTime = now;
                        this.isMining = true;
                        this.lastMoveTime = now; // pacing between repeated mines
                    }
                }
            }
        }

        // --- RIGHT: move or mine ---
        const rightDown = keys.mineRight.isDown || keys.right.isDown;
        if (rightDown && !this.isMoving && now - this.lastMoveTime >= this.moveRepeatRate) {
            this.facingRight = true;
            const newTileX = this.tileX + 1;
            if (this.canExistAt(newTileX, this.tileY)) {
                // Move right one tile
                this.tileX = newTileX;
                this.lastMoveTime = now;
                this.updatePixelPosition(true, this.moveDuration);
            } else {
                // Blocked — mine the column to the right
                if (now - this.lastMineTime >= this.mineCooldown) {
                    const mineX = this.tileX + 2;
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

    tryMine(tileX, tileY) {
        const tile = this.world.getTile(tileX, tileY);
        if (tile === this.world.TILE_AIR || tile === this.world.TILE_BEDROCK) {
            return false;
        }

        const cost = this.fuelCosts[tile] || 10;
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
