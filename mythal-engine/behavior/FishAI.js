/**
 * FishAI - Biological Architect / Mythal Engine
 * Implements a highly optimized Boids algorithm (Separation, Alignment, Cohesion)
 * and a Finite State Machine for fish behavior within the JONSWAP water environment.
 */

const STATE_WANDER = 0;
const STATE_INVESTIGATE = 1;
const STATE_STRIKE = 2;

class Fish {
    constructor(id, x, y, z) {
        this.id = id;
        this.position = new Float32Array([x, y, z]);
        this.velocity = new Float32Array([
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 2.0
        ]);
        this.acceleration = new Float32Array([0, 0, 0]);
        this.state = STATE_WANDER;
        
        // Biological parameters
        this.baseMaxSpeed = 4.0 + Math.random() * 2.0;
        this.maxSpeed = this.baseMaxSpeed;
        this.maxForce = 8.0;
        
        // Timer for states
        this.stateTimer = 0;
    }
}

export class FishSwarm {
    /**
     * @param {number} count Number of fish in the swarm
     */
    constructor(count = 150) {
        this.fishes = [];
        this.numFishes = count;
        
        // Boids perception
        this.perceptionRadius = 10.0;
        this.separationDistance = 3.0;
        
        // Biological weights
        this.weights = {
            separation: 1.8,
            alignment: 1.2,
            cohesion: 1.0,
            bobberAttraction: 3.0,
            wander: 0.2
        };

        // Environment bounds
        this.surfaceY = -1.0; // Under the JONSWAP surface
        this.floorY = -40.0;
        this.boundaryXZ = 80.0;
        
        this.initFishes();
    }
    
    initFishes() {
        for (let i = 0; i < this.numFishes; i++) {
            const x = (Math.random() - 0.5) * this.boundaryXZ * 2;
            const y = this.floorY + Math.random() * (this.surfaceY - this.floorY);
            const z = (Math.random() - 0.5) * this.boundaryXZ * 2;
            this.fishes.push(new Fish(i, x, y, z));
        }
    }
    
    _distanceSq(p1, p2) {
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        const dz = p1[2] - p2[2];
        return dx*dx + dy*dy + dz*dz;
    }
    
    _normalize(vec, max) {
        const mag = Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2]);
        if (mag > 0) {
            vec[0] /= mag;
            vec[1] /= mag;
            vec[2] /= mag;
            if (max !== undefined) {
                vec[0] *= max;
                vec[1] *= max;
                vec[2] *= max;
            }
        }
        return vec;
    }

    _limit(vec, max) {
        const magSq = vec[0]*vec[0] + vec[1]*vec[1] + vec[2]*vec[2];
        if (magSq > max * max) {
            this._normalize(vec, max);
        }
    }

    /**
     * The core mathematical biological loop.
     * @param {number} dt Delta time in seconds
     * @param {Object} bobberPosition {x, y, z} or null
     */
    updateFishSwarm(dt, bobberPosition) {
        const perceptionSq = this.perceptionRadius * this.perceptionRadius;
        const separationSq = this.separationDistance * this.separationDistance;
        
        // Calculate behaviors
        for (let i = 0; i < this.numFishes; i++) {
            const fish = this.fishes[i];
            
            // Reset acceleration for this frame
            fish.acceleration[0] = (Math.random() - 0.5) * this.weights.wander;
            fish.acceleration[1] = (Math.random() - 0.5) * this.weights.wander;
            fish.acceleration[2] = (Math.random() - 0.5) * this.weights.wander;
            
            let sep = new Float32Array([0,0,0]);
            let ali = new Float32Array([0,0,0]);
            let coh = new Float32Array([0,0,0]);
            
            let sepCount = 0;
            let aliCount = 0;
            
            // Optimization: Unrolling or spatial hash is better, but nested loop is OK for < 500 entity count in JS.
            for (let j = 0; j < this.numFishes; j++) {
                if (i === j) continue;
                
                const other = this.fishes[j];
                const dSq = this._distanceSq(fish.position, other.position);
                
                if (dSq > 0 && dSq < perceptionSq) {
                    // Separation (steer away from crowded flockmates)
                    if (dSq < separationSq) {
                        const dist = Math.sqrt(dSq);
                        sep[0] += (fish.position[0] - other.position[0]) / dist;
                        sep[1] += (fish.position[1] - other.position[1]) / dist;
                        sep[2] += (fish.position[2] - other.position[2]) / dist;
                        sepCount++;
                    }
                    
                    // Alignment (steer towards average heading of flockmates)
                    ali[0] += other.velocity[0];
                    ali[1] += other.velocity[1];
                    ali[2] += other.velocity[2];
                    
                    // Cohesion (steer to move towards average position of flockmates)
                    coh[0] += other.position[0];
                    coh[1] += other.position[1];
                    coh[2] += other.position[2];
                    
                    aliCount++;
                }
            }
            
            if (sepCount > 0) {
                sep[0] /= sepCount; sep[1] /= sepCount; sep[2] /= sepCount;
                this._normalize(sep, fish.maxSpeed);
                sep[0] -= fish.velocity[0]; sep[1] -= fish.velocity[1]; sep[2] -= fish.velocity[2];
                this._limit(sep, fish.maxForce);
                fish.acceleration[0] += sep[0] * this.weights.separation;
                fish.acceleration[1] += sep[1] * this.weights.separation;
                fish.acceleration[2] += sep[2] * this.weights.separation;
            }
            
            if (aliCount > 0) {
                ali[0] /= aliCount; ali[1] /= aliCount; ali[2] /= aliCount;
                this._normalize(ali, fish.maxSpeed);
                ali[0] -= fish.velocity[0]; ali[1] -= fish.velocity[1]; ali[2] -= fish.velocity[2];
                this._limit(ali, fish.maxForce);
                fish.acceleration[0] += ali[0] * this.weights.alignment;
                fish.acceleration[1] += ali[1] * this.weights.alignment;
                fish.acceleration[2] += ali[2] * this.weights.alignment;
                
                coh[0] /= aliCount; coh[1] /= aliCount; coh[2] /= aliCount;
                let steer = new Float32Array([coh[0] - fish.position[0], coh[1] - fish.position[1], coh[2] - fish.position[2]]);
                this._normalize(steer, fish.maxSpeed);
                steer[0] -= fish.velocity[0]; steer[1] -= fish.velocity[1]; steer[2] -= fish.velocity[2];
                this._limit(steer, fish.maxForce);
                fish.acceleration[0] += steer[0] * this.weights.cohesion;
                fish.acceleration[1] += steer[1] * this.weights.cohesion;
                fish.acceleration[2] += steer[2] * this.weights.cohesion;
            }
            
            // Apply Finite State Machine
            this._updateState(fish, bobberPosition, dt);
            
            // Apply physical pool bounds
            this._applyBoundaries(fish);
        }
        
        // Euler Integration
        for (let i = 0; i < this.numFishes; i++) {
            const fish = this.fishes[i];
            
            fish.velocity[0] += fish.acceleration[0] * dt;
            fish.velocity[1] += fish.acceleration[1] * dt;
            fish.velocity[2] += fish.acceleration[2] * dt;
            
            this._limit(fish.velocity, fish.maxSpeed);
            
            fish.position[0] += fish.velocity[0] * dt;
            fish.position[1] += fish.velocity[1] * dt;
            fish.position[2] += fish.velocity[2] * dt;
        }
    }
    
    _updateState(fish, bobberPosition, dt) {
        fish.stateTimer += dt;
        
        let distToBobberSq = Infinity;
        if (bobberPosition) {
            distToBobberSq = this._distanceSq(fish.position, [bobberPosition.x, bobberPosition.y, bobberPosition.z]);
        }
        
        switch(fish.state) {
            case STATE_WANDER:
                // Organic observation threshold
                if (bobberPosition && distToBobberSq < 1200) { 
                    if (Math.random() < 0.05) { // 5% chance per frame to notice the bobber
                        fish.state = STATE_INVESTIGATE;
                        fish.stateTimer = 0;
                    }
                }
                break;
                
            case STATE_INVESTIGATE:
                if (bobberPosition) {
                    let dir = new Float32Array([
                        bobberPosition.x - fish.position[0],
                        bobberPosition.y - fish.position[1],
                        bobberPosition.z - fish.position[2]
                    ]);
                    this._normalize(dir, fish.maxSpeed);
                    dir[0] -= fish.velocity[0]; dir[1] -= fish.velocity[1]; dir[2] -= fish.velocity[2];
                    this._limit(dir, fish.maxForce);
                    
                    fish.acceleration[0] += dir[0] * this.weights.bobberAttraction;
                    fish.acceleration[1] += dir[1] * this.weights.bobberAttraction;
                    fish.acceleration[2] += dir[2] * this.weights.bobberAttraction;
                    
                    if (distToBobberSq < 30) { 
                        // Close enough to attempt a strike
                        fish.state = STATE_STRIKE;
                        fish.stateTimer = 0;
                        fish.maxSpeed = fish.baseMaxSpeed * 2.5; // Kinetic burst
                    } else if (distToBobberSq > 2000 || fish.stateTimer > 8.0) {
                        // Lost interest
                        fish.state = STATE_WANDER;
                        fish.stateTimer = 0;
                        fish.maxSpeed = fish.baseMaxSpeed;
                    }
                } else {
                    fish.state = STATE_WANDER;
                    fish.maxSpeed = fish.baseMaxSpeed;
                }
                break;
                
            case STATE_STRIKE:
                if (bobberPosition) {
                    let dir = new Float32Array([
                        bobberPosition.x - fish.position[0],
                        bobberPosition.y - fish.position[1],
                        bobberPosition.z - fish.position[2]
                    ]);
                    this._normalize(dir, fish.maxSpeed);
                    dir[0] -= fish.velocity[0]; dir[1] -= fish.velocity[1]; dir[2] -= fish.velocity[2];
                    this._limit(dir, fish.maxForce * 1.5);
                    
                    fish.acceleration[0] += dir[0] * this.weights.bobberAttraction * 2.0;
                    fish.acceleration[1] += dir[1] * this.weights.bobberAttraction * 2.0;
                    fish.acceleration[2] += dir[2] * this.weights.bobberAttraction * 2.0;
                }
                
                // Strike duration is short and exhausting
                if (fish.stateTimer > 1.5) {
                    fish.state = STATE_WANDER;
                    fish.stateTimer = 0;
                    fish.maxSpeed = fish.baseMaxSpeed;
                }
                break;
        }
    }
    
    _applyBoundaries(fish) {
        // Soft avoidance steering to keep organic fluid motion
        const margin = 8.0;
        const turnForce = 6.0;
        
        if (fish.position[0] < -this.boundaryXZ + margin) fish.acceleration[0] += turnForce;
        if (fish.position[0] > this.boundaryXZ - margin) fish.acceleration[0] -= turnForce;
        
        if (fish.position[2] < -this.boundaryXZ + margin) fish.acceleration[2] += turnForce;
        if (fish.position[2] > this.boundaryXZ - margin) fish.acceleration[2] -= turnForce;
        
        // Critical: Maintain submersion below the JONSWAP plane
        if (fish.position[1] > this.surfaceY - margin) {
            fish.acceleration[1] -= turnForce * 2.0;
        }
        if (fish.position[1] < this.floorY + margin) {
            fish.acceleration[1] += turnForce;
        }
        
        // Hard physical clamp as a final safety check
        if (fish.position[1] > this.surfaceY) {
            fish.position[1] = this.surfaceY;
            fish.velocity[1] *= -0.8; 
        }
        if (fish.position[1] < this.floorY) {
            fish.position[1] = this.floorY;
            fish.velocity[1] *= -0.8;
        }
    }
}
