import * as THREE from 'three';
import { getOceanHeight } from './JonswapMath.js';

export const bobberPhysics = {
  velocity: new THREE.Vector3(0, 0, 0),
  acceleration: new THREE.Vector3(0, -9.81, 0),
  mass: 0.15,
  drag: 0.92,
  buoyancy: 12.0
};

export function updateBobberBuoyancy(bobberPosition, time, dt, windSpeed = 12.0, chop = 1.0) {
    const waterHeight = getOceanHeight(bobberPosition.x, bobberPosition.z, time, windSpeed, chop);
    const depth = waterHeight - bobberPosition.y;
    
    bobberPhysics.acceleration.set(0, -9.81, 0); // Gravity
    
    if (depth > 0) {
        const buoyantForce = bobberPhysics.buoyancy * depth;
        bobberPhysics.acceleration.y += buoyantForce;
        bobberPhysics.velocity.multiplyScalar(0.85); // Water drag
    }
    
    bobberPhysics.velocity.addScaledVector(bobberPhysics.acceleration, dt);
    bobberPhysics.velocity.multiplyScalar(bobberPhysics.drag); // Air drag
    bobberPosition.addScaledVector(bobberPhysics.velocity, dt);
}

// Verlet Line Integration
export class FishingLine {
    constructor(numSegments = 12, segmentLength = 0.5) {
        this.nodes = [];
        this.segmentLength = segmentLength;
        
        for (let i = 0; i < numSegments; i++) {
            this.nodes.push({
                pos: new THREE.Vector3(0, 10 - i * segmentLength, 0),
                oldPos: new THREE.Vector3(0, 10 - i * segmentLength, 0),
                locked: i === 0
            });
        }
    }
    
    simulate(dt, rodTipPos, bobberPos) {
        // 1. Lock ends
        this.nodes[0].pos.copy(rodTipPos);
        this.nodes[this.nodes.length - 1].pos.copy(bobberPos);
        
        // 2. Verlet integration
        for (let i = 1; i < this.nodes.length - 1; i++) {
            const node = this.nodes[i];
            const velocity = new THREE.Vector3().subVectors(node.pos, node.oldPos);
            velocity.multiplyScalar(0.98); // Air drag on the line
            
            node.oldPos.copy(node.pos);
            node.pos.add(velocity);
            node.pos.y -= 9.81 * dt * dt; // Gravity
        }
        
        // 3. Relaxation Constraints
        for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < this.nodes.length - 1; i++) {
                const n1 = this.nodes[i];
                const n2 = this.nodes[i + 1];
                
                const diff = new THREE.Vector3().subVectors(n2.pos, n1.pos);
                const currentDist = diff.length();
                if (currentDist === 0) continue;
                
                const correction = diff.multiplyScalar(1 - this.segmentLength / currentDist).multiplyScalar(0.5);
                
                if (!n1.locked) n1.pos.add(correction);
                if (!n2.locked && i + 1 !== this.nodes.length - 1) n2.pos.sub(correction); // Keep bobber free from strict constraint pull to allow casting, or let it pull the bobber
            }
        }
        
        // Ensure bobber feels the tension (pull back towards rod)
        const lastNode = this.nodes[this.nodes.length - 2];
        const distToBobber = lastNode.pos.distanceTo(bobberPos);
        if (distToBobber > this.segmentLength) {
            const pull = new THREE.Vector3().subVectors(lastNode.pos, bobberPos).normalize();
            pull.multiplyScalar((distToBobber - this.segmentLength) * 5.0 * dt);
            bobberPhysics.velocity.add(pull);
        }
    }
}
