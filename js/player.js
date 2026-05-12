class Player {
    constructor(scene, x, y, data = {}) {
        this.scene = scene;
        this.world = scene.world;

        // Position (in pixels)
        this.x = x * 32;
        this.y = y * 32;

        // Size based on chassis
        const chassis = data.chassis || 'scout';
        const chassisSizes = {
            scout: { w: 32, h: 64 },   // 1×2
            miner: { w: 64, h: 64 },   // 2×2
            heavy: { w: 64, h: 96 },  // 2×3
        };
        const size = chassisSizes[chassis] || chassisSizes.scout;
        this.width = size.w;
        this.height = size.h;

        // Align 1-tile-wide characters to tile centers so they don't straddle boundaries
        if (this.width === 32) {
            this.x += 16;
        }

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

        const chassisColors = {
            scout: 0x3498db,
            miner: 0x27ae60,
            heavy: 0xe74c3c,
        };
        const bodyColor = chassisColors[chassis] || chassisColors.scout;

        // Create graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, bodyColor);
        this.sprite.setOrigin(0.5, 1);

        // Shadow — small dark ellipse under the player for grounding
        this.shadow = scene.add.ellipse(this.x, this.y + 2, this.width * 0.8, 8, 0x000000, 0.22);
        this.shadow.setOrigin(0.5, 0.5);
        this.shadow.setDepth(0); // behind everything

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
        const baseCost = data.fuelBurn || 0.05;
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

        // Speed lines — streaks when running fast horizontally
        this.speedLineTimer = 0;

        // Mining streak counter
        this.miningStreak = 0;
        this.streakText = null;
        this.streakTimer = 0;
        this.streakedThisSwing = false;

        // Mining target preview outlines
        this.minePreview = scene.add.graphics();
        this.minePreview.setDepth(5);

        // Mine cost preview text — shows projected fuel cost for the swing
        this.mineCostText = scene.add.text(0, 0, '', {
            fontSize: '10px', fill: '#ffaa44', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5, 1).setDepth(6).setVisible(false);

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
            this.scene.playJumpSound();
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
            this.scene.playJumpSound();
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
                if (this.tryMine(mineX, y, -1, 0)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom) / 2 * 32 + 16, 32, 96);
                this.lastMineTime = now;
                this.streakedThisSwing = false;
                this.isMining = true;
            }
        }

        // --- D KEY: Mine right if movement was blocked ---
        if (keys.mineRight.isDown && Math.abs(this.x - oldX) < 1 && now - this.lastMineTime >= this.mineCooldown) {
            const { right, top, bottom } = this.getTileBounds();
            const mineX = right + 1; // one tile right of player's right edge
            let minedAny = false;
            for (let y = top; y <= bottom; y++) {
                if (this.tryMine(mineX, y, 1, 0)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator(mineX * 32 + 16, (top + bottom) / 2 * 32 + 16, 32, 96);
                this.lastMineTime = now;
                this.streakedThisSwing = false;
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
                if (this.tryMine(x, mineY, 0, 1)) minedAny = true;
            }
            if (minedAny) {
                this.showMineIndicator((left + right) / 2 * 32 + 16, mineY * 32 + 16, 64, 32);
                this.lastMineTime = now;
                this.streakedThisSwing = false;
                this.isMining = true;
            }
        }

        // Idle breathing when standing still on ground
        const breathY = (this.onGround && Math.abs(this.vx) < 5)
            ? Math.sin(this.scene.time.now * 0.003) * 1.2
            : 0;

        // Walk bob — subtle up-down step motion when moving on ground
        const walkBob = (this.onGround && Math.abs(this.vx) > 20)
            ? Math.sin(this.x * 0.35) * 2.5
            : 0;

        // Update sprite position
        this.sprite.x = this.x + this.mineRecoilX;
        this.sprite.y = this.y + breathY + walkBob + this.mineRecoilY;

        // Update shadow — stays at ground level, shrinks when airborne
        this.shadow.x = this.x + this.mineRecoilX;
        if (this.onGround) {
            this.shadow.y = this.y + 2;
            this.shadow.setAlpha(0.22);
            this.shadow.scaleX = 1;
        } else {
            // Shadow shrinks and fades as player rises; offset follows height
            const height = Math.max(0, -this.vy * 0.02); // rough height above ground
            const airFactor = Math.max(0.35, 1 - height * 0.03);
            this.shadow.y = this.y + 2 + height * 0.15;
            this.shadow.setAlpha(0.22 * airFactor);
            this.shadow.scaleX = airFactor;
        }

        // Update eyes
        const eyeOffsetX = this.facingRight ? 3 : -3;
        this.eyeLeft.x = this.x - 12 + eyeOffsetX + this.mineRecoilX;
        this.eyeLeft.y = this.y - this.height + 18 + breathY + walkBob + this.mineRecoilY;
        this.eyeRight.x = this.x + 12 + eyeOffsetX + this.mineRecoilX;
        this.eyeRight.y = this.y - this.height + 18 + breathY + walkBob + this.mineRecoilY;
        this.pupilLeft.x = this.x - 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
        this.pupilLeft.y = this.y - this.height + 18 + breathY + walkBob + this.mineRecoilY;
        this.pupilRight.x = this.x + 12 + eyeOffsetX * 1.5 + this.mineRecoilX;
        this.pupilRight.y = this.y - this.height + 18 + breathY + walkBob + this.mineRecoilY;

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
        // Snap when on ground and nearly stopped — 1-tile chars ALWAYS snap to centers
        if (this.onGround && Math.abs(this.vx) < 5) {
            // 1-tile characters snap to tile centers (+16), 2-tile to tile boundaries
            const offset = this.width === 32 ? 16 : 0;
            const snapX = Math.round((this.x - offset) / 32) * 32 + offset;
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
                    this.shadow.x = this.x + this.mineRecoilX;
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

        // Speed lines when running fast horizontally
        if (this.onGround && Math.abs(this.vx) > 120) {
            this.speedLineTimer -= delta;
            if (this.speedLineTimer <= 0) {
                this.scene.spawnSpeedLines(this.x, this.y - this.height * 0.3, this.facingRight);
                this.speedLineTimer = 50 + Math.random() * 60;
            }
        } else {
            this.speedLineTimer = 0;
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

        // Mining target preview — shows which tiles will be hit + projected fuel cost
        this.minePreview.clear();
        let targetTiles = [];
        let costForSwing = 0;
        const miningKeyHeld = keys.mineLeft.isDown || keys.mineRight.isDown || keys.mineDown.isDown;
        if (miningKeyHeld) {
            if (keys.mineLeft.isDown) {
                const { left, top, bottom } = this.getTileBounds();
                for (let y = top; y <= bottom; y++) {
                    targetTiles.push({ x: left - 1, y });
                    const t = this.world.getTile(left - 1, y);
                    if (t !== this.world.TILE_AIR && t !== this.world.TILE_BEDROCK) costForSwing += this.fuelCosts[t] || 0.05;
                }
            } else if (keys.mineRight.isDown) {
                const { right, top, bottom } = this.getTileBounds();
                for (let y = top; y <= bottom; y++) {
                    targetTiles.push({ x: right + 1, y });
                    const t = this.world.getTile(right + 1, y);
                    if (t !== this.world.TILE_AIR && t !== this.world.TILE_BEDROCK) costForSwing += this.fuelCosts[t] || 0.05;
                }
            } else if (keys.mineDown.isDown && this.onGround) {
                const { left, right, bottom } = this.getTileBounds();
                for (let x = left; x <= right; x++) {
                    targetTiles.push({ x, y: bottom + 1 });
                    const t = this.world.getTile(x, bottom + 1);
                    if (t !== this.world.TILE_AIR && t !== this.world.TILE_BEDROCK) costForSwing += this.fuelCosts[t] || 0.05;
                }
            }
            const progress = Math.min(1, (now - this.lastMineTime) / this.mineCooldown);
            const alpha = 0.25 + progress * 0.45;
            const color = progress < 1 ? 0xffaa44 : (costForSwing > this.fuel ? 0xff4444 : 0x44ff88);
            this.minePreview.lineStyle(2, color, alpha);
            targetTiles.forEach(t => {
                this.minePreview.strokeRect(t.x * 32, t.y * 32, 32, 32);
            });
            // Show projected cost near the first target tile
            if (targetTiles.length > 0 && costForSwing > 0) {
                const first = targetTiles[0];
                this.mineCostText.setText(`−${(costForSwing * 1000).toFixed(0)}ml`);
                this.mineCostText.setPosition(first.x * 32 + 16, first.y * 32 - 4);
                this.mineCostText.setVisible(true);
                this.mineCostText.setAlpha(alpha + 0.2);
                this.mineCostText.setColor(progress < 1 ? '#ffaa44' : (costForSwing > this.fuel ? '#ff4444' : '#44ff88'));
            } else {
                this.mineCostText.setVisible(false);
            }
        } else {
            this.mineCostText.setVisible(false);
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

        // Mining streak — fade out and follow player
        this.streakTimer -= delta;
        if (this.streakTimer <= 0) {
            this.miningStreak = 0;
            this.streakedThisSwing = false;
            if (this.streakText) {
                this.streakText.destroy();
                this.streakText = null;
            }
        } else if (this.streakText) {
            this.streakText.x = this.x;
            this.streakText.y = this.y - this.height - 24;
            this.streakText.setAlpha(Math.min(1, this.streakTimer / 150));
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
                        // Squash-and-stretch on landing — more intense for harder impacts
                        const squash = Math.min(0.3, Math.max(0, (impactVy - 150) / 1200));
                        if (squash > 0.03) {
                            this.sprite.scaleY = 1 - squash;
                            this.sprite.scaleX = 1 + squash * 0.5;
                            this.scene.tweens.add({
                                targets: this.sprite,
                                scaleY: 1,
                                scaleX: 1,
                                duration: 100 + squash * 300,
                                ease: 'Back.easeOut',
                            });
                        }
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

    tryMine(tileX, tileY, swingDirX = 0, swingDirY = 0) {
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

        // Debris particles — directional, inheriting player velocity
        const tileColor = this.scene.tileColors[tile] || 0xffffff;
        this.scene.spawnDebris(tileX, tileY, tileColor, swingDirX, swingDirY, this.vx, this.vy);

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

        // Streak tracking — only count once per swing
        if (!this.streakedThisSwing) {
            const t = this.scene.time.now;
            if (t - this.lastMineTime < 800) {
                this.miningStreak++;
            } else {
                this.miningStreak = 1;
            }
            this.streakTimer = 900;
            if (this.streakText) this.streakText.destroy();
            if (this.miningStreak > 1) {
                const s = Math.min(1.5, 1 + (this.miningStreak - 1) * 0.05);
                const colors = ['#ffffff', '#ffffcc', '#ffdd66', '#ffaa44', '#ff6644', '#ff2244'];
                const c = colors[Math.min(this.miningStreak - 2, colors.length - 1)];
                this.streakText = this.scene.add.text(this.x, this.y - this.height - 24, `×${this.miningStreak}`, {
                    fontSize: `${12 * s}px`, fill: c, fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2
                }).setOrigin(0.5).setDepth(10);

                // Milestone celebration: extra shake + pulse + sparkles at 10/25/50
                if (this.miningStreak === 10 || this.miningStreak === 25 || this.miningStreak === 50) {
                    const intensity = this.miningStreak === 10 ? 0.006 : this.miningStreak === 25 ? 0.009 : 0.014;
                    const duration = this.miningStreak === 10 ? 90 : this.miningStreak === 25 ? 140 : 220;
                    this.scene.cameras.main.shake(duration, intensity);
                    this.streakText.setScale(1.6);
                    this.scene.tweens.add({
                        targets: this.streakText,
                        scaleX: 1,
                        scaleY: 1,
                        duration: 300,
                        ease: 'Back.easeOut'
                    });
                    const sparkleColor = this.miningStreak >= 50 ? 0xffd700 : 0xffaa44;
                    this.scene.spawnGemSparkle(this.x, this.y - this.height * 0.5, sparkleColor);
                }
            }
            this.streakedThisSwing = true;
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
