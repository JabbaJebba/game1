// Simplex Noise implementation for terrain generation
// Ported for simplicity - single file, no dependencies
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        
        // Shuffle with seed
        let s = seed * 12345;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = s % (i + 1);
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }
    
    grad3 = [
        [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
        [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
        [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    
    dot3(g, x, y, z) {
        return g[0]*x + g[1]*y + g[2]*z;
    }
    
    noise2D(xin, yin) {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        
        let n0, n1, n2;
        let s = (xin + yin) * F2;
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        let t = (i + j) * G2;
        let X0 = i - t;
        let Y0 = j - t;
        let x0 = xin - X0;
        let y0 = yin - Y0;
        
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        
        let x1 = x0 - i1 + G2;
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1.0 + 2.0 * G2;
        let y2 = y0 - 1.0 + 2.0 * G2;
        
        let ii = i & 255;
        let jj = j & 255;
        
        let gi0 = this.permMod12[ii + this.perm[jj]];
        let gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        let gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
        
        let t0 = 0.5 - x0*x0 - y0*y0;
        if (t0 < 0) n0 = 0.0;
        else { t0 *= t0; n0 = t0 * t0 * this.dot3(this.grad3[gi0], x0, y0, 0); }
        
        let t1 = 0.5 - x1*x1 - y1*y1;
        if (t1 < 0) n1 = 0.0;
        else { t1 *= t1; n1 = t1 * t1 * this.dot3(this.grad3[gi1], x1, y1, 0); }
        
        let t2 = 0.5 - x2*x2 - y2*y2;
        if (t2 < 0) n2 = 0.0;
        else { t2 *= t2; n2 = t2 * t2 * this.dot3(this.grad3[gi2], x2, y2, 0); }
        
        return 70.0 * (n0 + n1 + n2);
    }
}

// World generation class
class WorldGenerator {
    constructor(width, height, seed = Math.random()) {
        this.width = width;
        this.height = height;
        this.noise = new SimplexNoise(seed);
        this.tiles = [];
        
        // Tile types
        this.TILE_AIR = 0;
        this.TILE_DIRT = 1;
        this.TILE_GRASS = 2;
        this.TILE_STONE = 3;
        this.TILE_COPPER = 4;   // Cu
        this.TILE_BEDROCK = 5;
        this.TILE_IRON = 6;     // Fe
        this.TILE_GOLD = 7;     // Au
        this.TILE_RUBY = 8;
        this.TILE_SAPPHIRE = 9;
        this.TILE_EMERALD = 10;
        this.TILE_DIAMOND = 11;
        this.TILE_AMETHYST = 12;
        
        this.generate();
    }
    
    generate() {
        // Initialize empty world
        for (let x = 0; x < this.width; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < this.height; y++) {
                this.tiles[x][y] = this.TILE_AIR;
            }
        }
        
        // Flat surface at ~20% down
        const surfaceY = Math.floor(this.height * 0.2);
        
        // Pass 1: Base terrain (grass, dirt, stone, bedrock)
        for (let x = 0; x < this.width; x++) {
            let variation = (this.noise.noise2D(x * 0.02, 0) * 2);
            let localSurface = surfaceY + Math.floor(variation);
            
            for (let y = localSurface; y < this.height; y++) {
                let depth = y - surfaceY;
                
                if (y === localSurface) {
                    this.tiles[x][y] = this.TILE_GRASS;
                } else if (depth < 4 + Math.random() * 3) {
                    this.tiles[x][y] = this.TILE_DIRT;
                } else if (y >= this.height - 5) {
                    this.tiles[x][y] = this.TILE_BEDROCK;
                } else {
                    this.tiles[x][y] = this.TILE_STONE;
                }
            }
        }
        
        // Pass 2: Ore veins
        this.generateVeins(surfaceY);
        
        // Pass 3: Caves (carve through everything including ore - realistic)
        for (let x = 0; x < this.width; x++) {
            for (let y = surfaceY + 8; y < this.height - 8; y++) {
                let caveNoise = this.noise.noise2D(x * 0.05, y * 0.05);
                if (caveNoise > 0.35) {
                    this.tiles[x][y] = this.TILE_AIR;
                }
            }
        }
    }
    
    generateVeins(surfaceY) {
        // Metal veins - shorter, more numerous
        // Copper: shallow, small scattered veins
        this.createVeins(this.TILE_COPPER, 30, surfaceY + 8, surfaceY + 90, 8, 15, 2, 3);
        // Iron: mid-depth, modest veins
        this.createVeins(this.TILE_IRON, 25, surfaceY + 40, surfaceY + 160, 6, 12, 2, 3);
        // Gold: deep, tight small clusters
        this.createVeins(this.TILE_GOLD, 18, surfaceY + 100, surfaceY + 285, 5, 10, 1, 2);
        
        // Gem veins - tiny pockets, 2-7 tiles max per vein
        this.createVeins(this.TILE_RUBY, 20, surfaceY + 10, surfaceY + 120, 2, 4, 1, 1);
        this.createVeins(this.TILE_SAPPHIRE, 18, surfaceY + 30, surfaceY + 160, 2, 4, 1, 1);
        this.createVeins(this.TILE_EMERALD, 15, surfaceY + 50, surfaceY + 190, 2, 4, 1, 1);
        this.createVeins(this.TILE_DIAMOND, 12, surfaceY + 120, surfaceY + 285, 2, 3, 1, 1);
        this.createVeins(this.TILE_AMETHYST, 15, surfaceY + 70, surfaceY + 250, 2, 4, 1, 1);
    }
    
    createVeins(type, count, yMin, yMax, lengthMin, lengthMax, thicknessMin, thicknessMax) {
        for (let i = 0; i < count; i++) {
            let x = Math.floor(Math.random() * this.width);
            let y = yMin + Math.floor(Math.random() * (yMax - yMin));
            let length = lengthMin + Math.floor(Math.random() * (lengthMax - lengthMin));
            let baseThickness = thicknessMin + Math.floor(Math.random() * (thicknessMax - thicknessMin));
            
            // Direction bias: horizontal for metals, more meandering for gems
            let horizontalBias = (lengthMax > 15) ? 0.7 : 0.5;
            
            for (let step = 0; step < length; step++) {
                // Random walk with horizontal bias
                let dx, dy;
                if (Math.random() < horizontalBias) {
                    dx = (Math.random() < 0.5) ? 1 : -1;
                    dy = (Math.random() < 0.3) ? ((Math.random() < 0.5) ? 1 : -1) : 0;
                } else {
                    dx = (Math.random() < 0.3) ? ((Math.random() < 0.5) ? 1 : -1) : 0;
                    dy = (Math.random() < 0.5) ? 1 : -1;
                }
                
                x += dx;
                y += dy;
                
                // Wrap horizontally for continuous world feel
                if (x < 0) x = this.width + x;
                if (x >= this.width) x = x - this.width;
                // Clamp vertically
                if (y < 5) y = 5;
                if (y >= this.height - 8) y = this.height - 9;
                
                // Thickness varies along the vein
                let thickness = baseThickness + Math.floor((Math.random() - 0.5) * 2);
                if (thickness < 1) thickness = 1;
                
                this.paintVeinPoint(x, y, thickness, type);
            }
        }
    }
    
    paintVeinPoint(cx, cy, radius, type) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                let x = cx + dx;
                let y = cy + dy;
                
                // Wrap horizontally
                if (x < 0) x = this.width + x;
                if (x >= this.width) x = x - this.width;
                if (y < 0 || y >= this.height) continue;
                
                // Only replace stone (not grass, dirt, bedrock, or already-ore)
                if (this.tiles[x][y] !== this.TILE_STONE) continue;
                
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;
                
                // Falloff: center = 100% chance, edge = ~25% chance
                // This creates soft edges and gaps within veins
                let chance = 1.0 - (dist / radius) * 0.75;
                if (Math.random() < chance) {
                    this.tiles[x][y] = type;
                }
            }
        }
    }
    
    getSurfaceY(x) {
        for (let y = 0; y < this.height; y++) {
            if (this.tiles[x][y] !== this.TILE_AIR) {
                return y;
            }
        }
        return null;
    }
    
    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return this.TILE_AIR;
        }
        return this.tiles[x][y];
    }
    
    setTile(x, y, tile) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tiles[x][y] = tile;
        }
    }
    
    isSolid(x, y) {
        let tile = this.getTile(x, y);
        return tile !== this.TILE_AIR;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.WorldGenerator = WorldGenerator;
}
