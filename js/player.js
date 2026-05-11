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

        // Walk dust timer
        this.walkDustTimer = 0;
        this.coyoteTimer = 0;
        this.jumpBuffer = 0;

        // Eye blinking
        this.isBlinking = false;
        this.blinkStartTime = 0;
        this.nextBlinkTime = 2000 + Math.random() * 3000;

        // Mining recoil — body kicks opposite to the swing direction
        this.mineRecoilX = 0;
        this.mineRecoilY = 0;
        this.recoilTween = null;

        // Falling wind trail — when dropping fast, streaks spawn behind the player
        this.fallTrailTimer = 0;

        // Mining target preview outlines
        this.minePreview = scene.add.graphics();
        this.minePreview.setDepth(5);

        // Mine cooldown ring
        this.cooldownRing = scene.add.graphics();
        this.cooldownRing.setDepth(6);
    }

    update(delta) {
        const dt = delta / 1000;
        const keys = this.scene.keys;
        const now = this.scene.time.now;

        this.isMining = false;

        // Remember position before movement
        const oldX = this.x;
        const oldY = this.y;

        const wasOnGround = this.onGround;

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

        // Coyote time — brief jump grace period after leaving ground
        if ((keys.jump.isDown || keys.up.isDown) && (this.onGround || this.coyoteTimer > 0)) {
            this.vy = -this.jumpPower;
            this.onGround = false;
            this.coyoteTimer = 0;
            this.jumpBuffer = 0;
            this.scene.spawnJumpDust(this.x, this.y);
        }

        // Jump buffering — if jump pressed in air, queue it for landing
        if (Phaser.Input.Keyboard.JustDown(keys.jump) || Phaser.Input.Keyboard.JustDown(keys.up)) {
            if (!this.onGround && this.coyoteTimer <= 0) {
                this.jumpBuffer = 120;
            }
        }

        // Apply gravity
        this.vy += this.gravity * dt;

        // Apply movement
        this.moveX(this.vx * dt);
        this.moveY(this.vy * dt);

        // Buffered jump fires immediately on landing
        if (this.onGround && this.jumpBuffer > 0) {
            this.vy = -this.jumpPower;
            this.onGround = false;
            this.jumpBuffer = 0;
            this.coyoteTimer = 0;
            this.scene.spawnJumpDust(this.x, this.y);
        }

        // Start coyote window when walking off a ledge
        if (wasOnGround && !this.onGround) {
            this.coyoteTimer = 100;
        }
        this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
        this.jumpBuffer = Math.max(0, this.jumpBuffer - delta);

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

        // Idle breathing when standing still on ground
        const breathY = (this.onGround && Math.abs(this.vx) < 5)
            ? Math.sin(this.scene.time.now * 0.003) * 1.2
            : 0;

        // Update sprite position
        this.sprite.x = this.x + this.mineRecoilX;
        this.sprite.y = this.y + breathY + this.mineRecoilY;

        // Update eyes
        const eyeOffsetX = this.facingRight ? 3 : -3;
        this.eyeLeft.x = this.x - 12 + eyeOffsetX + this.mineRecoilX;
        this.eyeLeft.y = this.y - this.height + 18 + breathY + this.mineRecoilY;
        this.eyeRight.x = this.x + 12 + eyeOffsetX + this.mineRecoilX;
        this.eyeRight.y = this.y - this.height + 18 + breathY + this.mineRecoilY;
        this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
        this.pupilLeft.y = this.y - this.height + 18 + breathY + this.mineRecoilY;
        this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
        this.pupilRight.y = this.y - this.height + 18 + breathY + this.mineRecoilY;

        // Eye blinking
        const nowBlink = this.scene.time.now;
        if (!this.isBlinking && nowBlink > this.nextBlinkTime && this.onGround && Math.abs(this.vx) < 5 && !this.isMining) {
            this.isBlinking = true;
            this.blinkStartTime = nowBlink;
        }
        if (this.isBlinking) {
            const elapsed = nowBlink - this.blinkStartTime;
            const closeDur = 70;
            const holdDur = 50;
            const openDur = 70;
            if (elapsed < closeDur) {
                const s = 1 - (elapsed / closeDur) * 0.9;
                this.pupilLeft.scaleY = s;
                this.pupilRight.scaleY = s;
            } else if (elapsed < closeDur + holdDur) {
                this.pupilLeft.scaleY = 0.1;
                this.pupilRight.scaleY = 0.1;
            } else if (elapsed < closeDur + holdDur + openDur) {
                const t = (elapsed - closeDur - holdDur) / openDur;
                const s = 0.1 + t * 0.9;
                this.pupilLeft.scaleY = s;
                this.pupilRight.scaleY = s;
            } else {
                this.pupilLeft.scaleY = 1;
                this.pupilRight.scaleY = 1;
                this.isBlinking = false;
                this.nextBlinkTime = nowBlink + 1500 + Math.random() * 3500;
            }
        }

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
                    this.sprite.x = this.x + this.mineRecoilX;
                    const eyeOffsetX = this.facingRight ? 3 : -3;
                    this.eyeLeft.x = this.x - 12 + eyeOffsetX + this.mineRecoilX;
                    this.eyeRight.x = this.x + 12 + eyeOffsetX + this.mineRecoilX;
                    this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
                    this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
                }
            }
        }

        // Keep in world bounds
        const worldWidthPx = this.world.width * 32;
        if (this.x < this.width / 2) { this.x = this.width / 2; this.vx = 0; }
        if (this.x > worldWidthPx - this.width / 2) { this.x = worldWidthPx - this.width / 2; this.vx = 0; }

        // Walking dust
        if (this.onGround && Math.abs(this.vx) > 20) {
            this.walkDustTimer -= delta;
            if (this.walkDustTimer <= 0) {
                this.scene.spawnWalkDust(this.x, this.y);
                this.walkDustTimer = 100 + Math.random() * 80;
            }
        } else {
            this.walkDustTimer = 0;
        }

        // Falling wind trail — streaks when dropping fast
        if (!this.onGround && this.vy > 250) {
            this.fallTrailTimer -= delta;
            if (this.fallTrailTimer <= 0) {
                this.scene.spawnFallTrail(this.x, this.y - this.height * 0.6, this.facingRight);
                this.fallTrailTimer = 40 + Math.random() * 50;
            }
        } else {
            this.fallTrailTimer = 0;
        }

        // Mining target preview — shows which tiles will be hit
        this.minePreview.clear();
        const miningKeyHeld = keys.mineLeft.isDown || keys.mineRight.isDown || keys.mineDown.isDown;
        if (miningKeyHeld) {
            let targetTiles = [];
            if (keys.mineLeft.isDown) {
                const { left, top, bottom } = this.getTileBounds();
                for (let y = top; y <= bottom; y++) targetTiles.push({ x: left - 1, y });
            } else if (keys.mineRight.isDown) {
                const { right, top, bottom } = this.getTileBounds();
                for (let y = top; y <= bottom; y++) targetTiles.push({ x: right + 1, y });
            } else if (keys.mineDown.isDown && this.onGround) {
                const { left, right, bottom } = this.getTileBounds();
                for (let x = left; x <= right; x++) targetTiles.push({ x, y: bottom + 1 });
            }
            const progress = Math.min(1, (now - this.lastMineTime) / this.mineCooldown);
            const alpha = 0.25 + progress * 0.45;
            const color = progress < 1 ? 0xffaa44 : 0x44ff88;
            this.minePreview.lineStyle(2, color, alpha);
            targetTiles.forEach(t => {
                this.minePreview.strokeRect(t.x * 32, t.y * 32, 32, 32);
            });
        }

        // Mine cooldown ring — shows when holding a mine key and on cooldown
        const miningKeysHeld = keys.mineLeft.isDown || keys.mineRight.isDown || keys.mineDown.isDown;
        const cooldownProgress = Math.min(1, (now - this.lastMineTime) / this.mineCooldown);
        this.cooldownRing.clear();
        if (miningKeysHeld && cooldownProgress < 1) {
            const cx = this.x + this.mineRecoilX;
            const cy = this.y - this.height / 2 + this.mineRecoilY;
            const radius = 48;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + cooldownProgress * Math.PI * 2;
            // Color transitions from orange (just mined) to green (ready)
            const r = Math.floor(255 * (1 - cooldownProgress));
            const g = Math.floor(200 * cooldownProgress + 55);
            const color = Phaser.Display.Color.GetColor(r, g, 0);
            this.cooldownRing.lineStyle(3, color, 0.8);
            this.cooldownRing.beginPath();
            this.cooldownRing.arc(cx, cy, radius, startAngle, endAngle);
            this.cooldownRing.strokePath();
        }
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
        const wasOnGround = this.onGround;
        this.onGround = false;

        const { left, right, top, bottom } = this.getTileBounds();
        const feetRow = Math.floor(this.y / 32);

        if (this.vy > 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, feetRow)) {
                    const impactVy = this.vy;
                    this.y = feetRow * 32;
                    this.vy = 0;
                    this.onGround = true;
                    if (!wasOnGround) {
                        this.scene.spawnLandingDust(this.x, this.y);
                        if (impactVy > 450) {
                            this.scene.cameras.main.shake(80, 0.005);
                            this.scene.playLandingSound(impactVy);
                        }
                    }
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
            if (tile === this.world.TILE_BEDROCK) this.scene.playDenialSound('bedrock');
            return false;
        }
        
        const cost = this.fuelCosts[tile] || 0.05;
        if (this.fuel < cost) {
            this.scene.playDenialSound('nofuel');
            this.scene.showFloatText(tileX * 32 + 16, tileY * 32 - 24, 'NO FUEL', '#ff3333');
            return false;
        }
        
        this.fuel -= cost;
        this.world.setTile(tileX, tileY, this.world.TILE_AIR);
        this.addToInventory(tile);
        this.scene.updateTile(tileX, tileY);
        this.scene.playMineSound(tile);
        
        // Track run statistics
        this.scene.runStats.tilesMined++;
        this.scene.runStats.fuelUsed += cost;
        
        // Flash effect on mined tile
        this.scene.spawnMineFlash(tileX, tileY);

        // Screen shake on successful mine
        this.scene.cameras.main.shake(60, 0.004);

        // Debris particles
        const tileColor = this.scene.tileColors[tile] || 0xffffff;
        this.scene.spawnDebris(tileX, tileY, tileColor);

        // Floating loot text
        const itemName = this.getItemName(tile);
        const itemColor = this.getItemColor(tile);
        this.scene.showFloatText(tileX * 32 + 16, tileY * 32 - 8, `+1 ${itemName}`, itemColor);

        // Gem sparkle — upward floating particles on gem finds
        const isGem = tile === this.world.TILE_RUBY || tile === this.world.TILE_SAPPHIRE ||
                      tile === this.world.TILE_EMERALD || tile === this.world.TILE_DIAMOND ||
                      tile === this.world.TILE_AMETHYST;
        if (isGem) {
            this.scene.spawnGemSparkle(this.x, this.y - this.height * 0.6, tileColor);
        }

        // Metal sparks — bright white flash on copper/iron/gold hits
        const isMetal = tile === this.world.TILE_COPPER || tile === this.world.TILE_IRON || tile === this.world.TILE_GOLD;
        if (isMetal) {
            this.scene.spawnMetalSparks(tileX, tileY);
        }
        
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
        // Mining recoil — body kicks opposite to the swing direction
        if (this.recoilTween) this.recoilTween.stop();
        const recoilDirX = x < this.x ? 1 : (x > this.x ? -1 : 0);
        const recoilDirY = y > this.y ? -1 : 0;
        this.recoilTween = this.scene.tweens.add({
            targets: this,
            mineRecoilX: recoilDirX * 5,
            mineRecoilY: recoilDirY * 4,
            duration: 70,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.mineRecoilX = 0;
                this.mineRecoilY = 0;
            }
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
