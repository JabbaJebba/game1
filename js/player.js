class Player {
    constructor(scene, x, y, data = {}) {
        this.scene = scene;
        this.world = scene.world;
        this.tileSize = 32;

        // Tile-based position (source of truth)
        // Character is 2 tiles wide, 3 tiles tall
        // tileX = left column, tileY = feet row
        this.tileX = x; // spawn tile x
        this.tileY = y; // spawn tile y

        // Pixel position (derived from tile position)
        this.x = (this.tileX + 1) * this.tileSize; // center of 2 tiles
        this.y = this.tileY * this.tileSize; // feet on tile boundary

        // Size
        this.width = 64;
        this.height = 96;

        // Movement state
        this.facingRight = true;
        this.isMining = false;
        this.onGround = false;

        // Movement animation
        this.isMoving = false;
        this.moveTween = null;
        this.moveSpeed = 0.12; // seconds per tile move
        this.fallSpeed = 0.08; // seconds per tile fall

        // Jump
        this.jumpHeight = 2; // tiles to jump up
        this.isJumping = false;
        this.jumpTimer = 0;
        this.jumpDuration = 0.35; // seconds before gravity takes over

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

        // Input key tracking
        this.keyLeftWasDown = false;
        this.keyRightWasDown = false;
        this.keyDownWasDown = false;
        this.keyJumpWasDown = false;
    }

    getOccupiedTiles() {
        const tiles = [];
        for (let y = this.tileY - 2; y <= this.tileY; y++) {
            for (let x = this.tileX; x <= this.tileX + 1; x++) {
                tiles.push({ x, y });
            }
        }
        return tiles;
    }

    canExistAt(tileX, tileY) {
        // Check all tiles the character would occupy
        for (let y = tileY - 2; y <= tileY; y++) {
            for (let x = tileX; x <= tileX + 1; x++) {
                if (this.world.isSolid(x, y)) return false;
            }
        }
        return true;
    }

    canStandAt(tileX, tileY) {
        // Can exist AND has ground below
        if (!this.canExistAt(tileX, tileY)) return false;
        // Check if there's solid ground below feet
        const groundBelow = this.world.isSolid(tileX, tileY + 1) || this.world.isSolid(tileX + 1, tileY + 1);
        return groundBelow;
    }

    updatePixelPosition(animate = false, duration = 0.12) {
        const targetX = (this.tileX + 1) * this.tileSize;
        const targetY = this.tileY * this.tileSize;

        if (animate && this.scene.tweens) {
            if (this.moveTween) this.moveTween.stop();
            this.moveTween = this.scene.tweens.add({
                targets: this.sprite,
                x: targetX,
                y: targetY,
                duration: duration * 1000,
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
        const dt = delta / 1000;

        this.isMining = false;

        // Check ground state
        const groundLeft = this.world.isSolid(this.tileX, this.tileY + 1);
        const groundRight = this.world.isSolid(this.tileX + 1, this.tileY + 1);
        this.onGround = groundLeft || groundRight;

        // --- GRAVITY: fall if not on ground ---
        if (!this.onGround && !this.isMoving && !this.isJumping) {
            const canFall = this.canExistAt(this.tileX, this.tileY + 1);
            if (canFall) {
                this.tileY++;
                this.updatePixelPosition(true, this.fallSpeed);
            }
        }

        // --- JUMP: move up if jumping ---
        if (this.isJumping) {
            this.jumpTimer += dt;
            if (this.jumpTimer >= this.jumpDuration) {
                this.isJumping = false;
            } else if (!this.isMoving) {
                // Try to move up 1 tile
                const canRise = this.canExistAt(this.tileX, this.tileY - 1);
                if (canRise) {
                    this.tileY--;
                    this.updatePixelPosition(true, this.fallSpeed);
                }
            }
        }

        // --- JUMP INPUT ---
        if ((keys.jump.isDown || keys.up.isDown) && this.onGround && !this.keyJumpWasDown) {
            this.isJumping = true;
            this.jumpTimer = 0;
            // Jump up 2 tiles immediately (or as far as possible)
            for (let i = 0; i < this.jumpHeight; i++) {
                if (this.canExistAt(this.tileX, this.tileY - 1)) {
                    this.tileY--;
                } else {
                    break;
                }
            }
            this.updatePixelPosition(true, 0.15);
        }
        this.keyJumpWasDown = keys.jump.isDown || keys.up.isDown;

        // --- LEFT MOVEMENT / MINING ---
        if ((keys.mineLeft.isDown || keys.left.isDown) && !this.keyLeftWasDown && !this.isMoving) {
            this.facingRight = false;
            const newTileX = this.tileX - 1;
            
            // Check if we can move left
            if (this.canExistAt(newTileX, this.tileY)) {
                this.tileX = newTileX;
                this.isMoving = true;
                this.updatePixelPosition(true, this.moveSpeed);
            } else {
                // Blocked - try to mine
                if (now - this.lastMineTime >= this.mineCooldown) {
                    const mineX = this.tileX - 1;
                    let minedAny = false;
                    for (let y = this.tileY - 2; y <= this.tileY; y++) {
                        if (this.tryMine(mineX, y)) minedAny = true;
                    }
                    if (minedAny) {
                        this.showMineIndicator(mineX * 32 + 16, (this.tileY - 1) * 32, 32, 96);
                        this.lastMineTime = now;
                        this.isMining = true;
                    }
                }
            }
        }
        this.keyLeftWasDown = keys.mineLeft.isDown || keys.left.isDown;

        // --- RIGHT MOVEMENT / MINING ---
        if ((keys.mineRight.isDown || keys.right.isDown) && !this.keyRightWasDown && !this.isMoving) {
            this.facingRight = true;
            const newTileX = this.tileX + 1;
            
            // Check if we can move right
            if (this.canExistAt(newTileX, this.tileY)) {
                this.tileX = newTileX;
                this.isMoving = true;
                this.updatePixelPosition(true, this.moveSpeed);
            } else {
                // Blocked - try to mine
                if (now - this.lastMineTime >= this.mineCooldown) {
                    const mineX = this.tileX + 2;
                    let minedAny = false;
                    for (let y = this.tileY - 2; y <= this.tileY; y++) {
                        if (this.tryMine(mineX, y)) minedAny = true;
                    }
                    if (minedAny) {
                        this.showMineIndicator(mineX * 32 + 16, (this.tileY - 1) * 32, 32, 96);
                        this.lastMineTime = now;
                        this.isMining = true;
                    }
                }
            }
        }
        this.keyRightWasDown = keys.mineRight.isDown || keys.right.isDown;

        // --- DOWN: Mine down ---
        if (keys.mineDown.isDown && this.onGround && !this.keyDownWasDown && !this.isMoving) {
            if (now - this.lastMineTime >= this.mineCooldown) {
                const mineY = this.tileY + 1;
                let minedAny = false;
                for (let x = this.tileX; x <= this.tileX + 1; x++) {
                    if (this.tryMine(x, mineY)) minedAny = true;
                }
                if (minedAny) {
                    this.showMineIndicator((this.tileX + 1) * 32, mineY * 32 + 16, 64, 32);
                    this.lastMineTime = now;
                    this.isMining = true;
                    // After mining down, gravity will pull us down next frame
                }
            }
        }
        this.keyDownWasDown = keys.mineDown.isDown;

        // Hide mine indicator if not mining
        if (!this.isMining) {
            this.mineIndicator.setStrokeStyle(2, 0xff0000, 0);
            this.mineIndicator.setFillStyle(0xff0000, 0);
        }

        // Keep in world bounds
        if (this.tileX < 0) { this.tileX = 0; this.updatePixelPosition(); }
        if (this.tileX > this.world.width - 2) { this.tileX = this.world.width - 2; this.updatePixelPosition(); }
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
