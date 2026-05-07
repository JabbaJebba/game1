class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.world = scene.world;
        
        // Position (in pixels)
        this.x = x * 32;
        this.y = y * 32;
        
        // Size (slightly smaller than tile for collision feel)
        this.width = 24;
        this.height = 48;
        
        // Velocity
        this.vx = 0;
        this.vy = 0;
        
        // Movement constants
        this.speed = 200;
        this.jumpPower = 400;
        this.gravity = 1000;
        this.friction = 0.8;
        
        // State
        this.onGround = false;
        this.facingRight = true;
        
        // Create graphics
        this.sprite = scene.add.rectangle(this.x, this.y, this.width, this.height, 0x3498db);
        this.sprite.setOrigin(0.5, 1); // Bottom center origin
        
        // Eyes to show direction
        this.eyeLeft = scene.add.circle(this.x - 6, this.y - this.height + 10, 3, 0xffffff);
        this.eyeRight = scene.add.circle(this.x + 6, this.y - this.height + 10, 3, 0xffffff);
        this.pupilLeft = scene.add.circle(this.x - 6, this.y - this.height + 10, 1.5, 0x000000);
        this.pupilRight = scene.add.circle(this.x + 6, this.y - this.height + 10, 1.5, 0x000000);
        
        // Inventory
        this.inventory = {};
        this.selectedSlot = 0;
    }
    
    update(delta) {
        const dt = delta / 1000;
        const keys = this.scene.keys;
        
        // Horizontal movement
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
        
        // Jump
        if (keys.jump.isDown && this.onGround) {
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
        const eyeOffsetX = this.facingRight ? 2 : -2;
        this.eyeLeft.x = this.x - 6 + eyeOffsetX;
        this.eyeLeft.y = this.y - this.height + 10;
        this.eyeRight.x = this.x + 6 + eyeOffsetX;
        this.eyeRight.y = this.y - this.height + 10;
        this.pupilLeft.x = this.x - 6 + eyeOffsetX * 1.5;
        this.pupilLeft.y = this.y - this.height + 10;
        this.pupilRight.x = this.x + 6 + eyeOffsetX * 1.5;
        this.pupilRight.y = this.y - this.height + 10;
        
        // Mining / placing
        this.handleMining();
        this.handlePlacing();
        
        // Keep in world bounds
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x > this.world.width * 32) { this.x = this.world.width * 32; this.vx = 0; }
    }
    
    moveX(amount) {
        this.x += amount;
        
        // Check horizontal collision
        const left = Math.floor((this.x - this.width/2) / 32);
        const right = Math.floor((this.x + this.width/2 - 1) / 32);
        const top = Math.floor((this.y - this.height) / 32);
        const bottom = Math.floor((this.y - 1) / 32);
        
        for (let ty = top; ty <= bottom; ty++) {
            if (this.world.isSolid(left, ty)) {
                this.x = (left + 1) * 32 + this.width/2;
                this.vx = 0;
                break;
            }
            if (this.world.isSolid(right, ty)) {
                this.x = right * 32 - this.width/2;
                this.vx = 0;
                break;
            }
        }
    }
    
    moveY(amount) {
        this.y += amount;
        this.onGround = false;
        
        // Check vertical collision
        const left = Math.floor((this.x - this.width/2) / 32);
        const right = Math.floor((this.x + this.width/2 - 1) / 32);
        const top = Math.floor((this.y - this.height) / 32);
        const bottom = Math.floor((this.y) / 32);
        
        // Feet collision (landing)
        if (this.vy > 0) {
            for (let tx = left; tx <= right; tx++) {
                if (this.world.isSolid(tx, bottom)) {
                    this.y = bottom * 32;
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
    
    handleMining() {
        if (!this.scene.input.activePointer.leftButtonDown()) return;
        
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);
        
        // Check distance
        const dx = (tileX * 32 + 16) - this.x;
        const dy = (tileY * 32 + 16) - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 120) { // Mining reach
            const tile = this.world.getTile(tileX, tileY);
            if (tile !== this.world.TILE_AIR && tile !== this.world.TILE_BEDROCK) {
                this.world.setTile(tileX, tileY, this.world.TILE_AIR);
                this.addToInventory(tile);
                this.scene.updateTile(tileX, tileY);
            }
        }
    }
    
    handlePlacing() {
        if (!this.scene.input.activePointer.rightButtonDown()) return;
        
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / 32);
        const tileY = Math.floor(worldPoint.y / 32);
        
        // Check distance
        const dx = (tileX * 32 + 16) - this.x;
        const dy = (tileY * 32 + 16) - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 120) {
            const tile = this.world.getTile(tileX, tileY);
            if (tile === this.world.TILE_AIR) {
                // Don't place inside player
                const playerLeft = Math.floor((this.x - this.width/2) / 32);
                const playerRight = Math.floor((this.x + this.width/2) / 32);
                const playerTop = Math.floor((this.y - this.height) / 32);
                const playerBottom = Math.floor(this.y / 32);
                
                if (tileX < playerLeft || tileX > playerRight || tileY < playerTop || tileY > playerBottom) {
                    // Place dirt for now (will use inventory later)
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
