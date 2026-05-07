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
        this.TILE_ORE = 4;
        this.TILE_BEDROCK = 5;
        
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
        
        // Generate terrain using multiple octaves of noise
        for (let x = 0; x < this.width; x++) {
            // Surface height with multiple noise layers
            let nx = x * 0.01;
            let surfaceNoise = this.noise.noise2D(nx, 0) * 0.5 + 
                              this.noise.noise2D(nx * 2, 100) * 0.25 +
                              this.noise.noise2D(nx * 4, 200) * 0.125;
            
            let surfaceY = Math.floor(this.height * 0.3 + surfaceNoise * 15);
            
            for (let y = surfaceY; y < this.height; y++) {
                let depth = y - surfaceY;
                
                if (y === surfaceY) {
                    this.tiles[x][y] = this.TILE_GRASS;
                } else if (depth < 5 + Math.random() * 3) {
                    this.tiles[x][y] = this.TILE_DIRT;
                } else if (depth < 20) {
                    this.tiles[x][y] = this.TILE_STONE;
                    // Small chance for ore
                    if (Math.random() < 0.05 && depth > 8) {
                        this.tiles[x][y] = this.TILE_ORE;
                    }
                } else {
                    this.tiles[x][y] = this.TILE_STONE;
                    // More ore deeper down
                    if (Math.random() < 0.1) {
                        this.tiles[x][y] = this.TILE_ORE;
                    }
                }
                
                // Bedrock at bottom
                if (y >= this.height - 3) {
                    this.tiles[x][y] = this.TILE_BEDROCK;
                }
            }
            
            // Add caves using noise
            for (let y = surfaceY + 5; y < this.height - 5; y++) {
                let caveNoise = this.noise.noise2D(x * 0.05, y * 0.05);
                if (caveNoise > 0.3) {
                    this.tiles[x][y] = this.TILE_AIR;
                }
            }
        }
        
        // Add trees on surface
        for (let x = 5; x < this.width - 5; x++) {
            let surfaceY = this.getSurfaceY(x);
            if (surfaceY && Math.random() < 0.08) {
                this.placeTree(x, surfaceY - 1);
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
    
    placeTree(x, y) {
        // Simple tree: trunk + leaves
        let trunkHeight = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < trunkHeight && y - i >= 0; i++) {
            this.tiles[x][y - i] = 6; // Wood
        }
        
        // Leaves
        let leafY = y - trunkHeight;
        for (let lx = -2; lx <= 2; lx++) {
            for (let ly = -2; ly <= 1; ly++) {
                if (x + lx >= 0 && x + lx < this.width && leafY + ly >= 0) {
                    if (Math.abs(lx) + Math.abs(ly) < 3 && this.tiles[x + lx][leafY + ly] === this.TILE_AIR) {
                        this.tiles[x + lx][leafY + ly] = 7; // Leaves
                    }
                }
            }
        }
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
        return tile !== this.TILE_AIR && tile !== 7; // Leaves are not solid
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.WorldGenerator = WorldGenerator;
}
