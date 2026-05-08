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
        
        for (let x = 0; x < this.width; x++) {
            // Slight variation for visual texture, but flat overall
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
                    
                    // Soft depth-based ore generation
                    // Convert depth to 0-1 range (excluding bedrock zone)
                    let depthRatio = depth / (this.height - surfaceY - 10);
                    if (depthRatio > 1) depthRatio = 1;
                    
                    // Metals - soft zones with overlap
                    // Copper: starts shallow, fades mid
                    let copperChance = 0;
                    if (depthRatio < 0.6) {
                        copperChance = 0.03 * (1 - depthRatio);
                    }
                    
                    // Iron: peaks mid-depth
                    let ironChance = 0;
                    if (depthRatio > 0.15 && depthRatio < 0.75) {
                        let ironPeak = Math.abs(depthRatio - 0.45);
                        ironChance = 0.04 * (1 - ironPeak * 2);
                    }
                    
                    // Gold: deep only
                    let goldChance = 0;
                    if (depthRatio > 0.4) {
                        goldChance = 0.03 * depthRatio;
                    }
                    
                    // Gems - rarer, any depth but deeper = more valuable
                    let rubyChance = depthRatio > 0.1 ? 0.008 * depthRatio : 0;
                    let sapphireChance = depthRatio > 0.2 ? 0.007 * Math.min(depthRatio * 1.2, 1) : 0;
                    let emeraldChance = depthRatio > 0.3 ? 0.006 * Math.min(depthRatio * 1.3, 1) : 0;
                    let diamondChance = depthRatio > 0.5 ? 0.005 * depthRatio : 0;
                    let amethystChance = depthRatio > 0.4 ? 0.006 * (0.8 + depthRatio * 0.5) : 0;
                    
                    // Apply noise for natural clustering
                    let oreNoise = this.noise.noise2D(x * 0.08, y * 0.08);
                    let clusterMult = 1 + oreNoise * 0.5; // 0.5 to 1.5x multiplier
                    
                    // Pick one resource per block, metals prioritized over gems
                    let rand = Math.random();
                    
                    if (rand < copperChance * clusterMult) {
                        this.tiles[x][y] = this.TILE_COPPER;
                    } else if (rand < (copperChance + ironChance) * clusterMult) {
                        this.tiles[x][y] = this.TILE_IRON;
                    } else if (rand < (copperChance + ironChance + goldChance) * clusterMult) {
                        this.tiles[x][y] = this.TILE_GOLD;
                    } else {
                        // Gems compete separately (rarer)
                        let gemRand = Math.random();
                        if (gemRand < rubyChance * clusterMult * 2) {
                            this.tiles[x][y] = this.TILE_RUBY;
                        } else if (gemRand < (rubyChance + sapphireChance) * clusterMult * 2) {
                            this.tiles[x][y] = this.TILE_SAPPHIRE;
                        } else if (gemRand < (rubyChance + sapphireChance + emeraldChance) * clusterMult * 2) {
                            this.tiles[x][y] = this.TILE_EMERALD;
                        } else if (gemRand < (rubyChance + sapphireChance + emeraldChance + diamondChance) * clusterMult * 2) {
                            this.tiles[x][y] = this.TILE_DIAMOND;
                        } else if (gemRand < (rubyChance + sapphireChance + emeraldChance + diamondChance + amethystChance) * clusterMult * 2) {
                            this.tiles[x][y] = this.TILE_AMETHYST;
                        }
                    }
                }
            }
            
            // Add caves using noise
            for (let y = surfaceY + 8; y < this.height - 8; y++) {
                let caveNoise = this.noise.noise2D(x * 0.05, y * 0.05);
                if (caveNoise > 0.35) {
                    this.tiles[x][y] = this.TILE_AIR;
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
