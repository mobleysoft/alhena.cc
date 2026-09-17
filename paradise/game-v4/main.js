import * as THREE from 'three';
import { updateBobberBuoyancy, FishingLine, bobberPhysics } from '@alhena/mythal-engine/physics/VerletRope.js';
import { createGhibliWaterMaterial } from '@alhena/mythal-engine/materials/GhibliWaterMaterial.js';
import { AssetPipeline } from '@alhena/mythal-engine/core/AssetPipeline.js';
import { FishSwarm } from '@alhena/mythal-engine/behavior/FishAI.js';

// 1. Setup Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xaee2ff, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xfffaee, 1.5);
dirLight.position.set(15, 30, -10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

// 3. The Bobber & Fishing Line
const bobberGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const bobberMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.2 });
const bobber = new THREE.Mesh(bobberGeometry, bobberMaterial);
bobber.position.set(0, 10, 0); 
bobber.castShadow = true;
scene.add(bobber);

const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
const lineGeometry = new THREE.BufferGeometry();
const numSegments = 15;
const positions = new Float32Array(numSegments * 3);
lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
scene.add(lineMesh);

const fishingLine = new FishingLine(numSegments, 0.4);
const rodTipPos = new THREE.Vector3(0, 8, 8); 

// 4. Visual Ocean 
const oceanGeometry = new THREE.PlaneGeometry(80, 80, 256, 256);
oceanGeometry.rotateX(-Math.PI / 2);
const { material: ghibliWater, uniforms: waterUniforms } = createGhibliWaterMaterial();
const ocean = new THREE.Mesh(oceanGeometry, ghibliWater);
ocean.receiveShadow = true;
scene.add(ocean);

// 5. Biological Swarm (Fish AI)
const fishSwarm = new FishSwarm(30); // School of 30 fish
const fishMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
const fishGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
fishGeo.rotateX(Math.PI / 2); // Point forward
const fishMeshes = [];
for (let i = 0; i < fishSwarm.numFishes; i++) {
    const mesh = new THREE.Mesh(fishGeo, fishMaterial);
    scene.add(mesh);
    fishMeshes.push(mesh);
}

// 6. Kinetic Input
let isReeling = false;
window.addEventListener('mousedown', () => { isReeling = true; });
window.addEventListener('mouseup', () => { isReeling = false; });
window.addEventListener('touchstart', () => { isReeling = true; });
window.addEventListener('touchend', () => { isReeling = false; });

// 7. Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.1); 

    waterUniforms.uTime.value = time;

    if (isReeling) {
        const dir = new THREE.Vector3().subVectors(rodTipPos, bobber.position).normalize();
        bobberPhysics.velocity.add(dir.multiplyScalar(20.0 * dt));
    } else {
        bobberPhysics.velocity.x += Math.sin(time) * 0.1 * dt;
        bobberPhysics.velocity.z += Math.cos(time) * 0.1 * dt;
    }

    updateBobberBuoyancy(bobber.position, time, dt, 12.0, 1.0);
    fishingLine.simulate(dt, rodTipPos, bobber.position);
    
    for (let i = 0; i < fishingLine.nodes.length; i++) {
        const p = fishingLine.nodes[i].pos;
        positions[i*3] = p.x;
        positions[i*3+1] = p.y;
        positions[i*3+2] = p.z;
    }
    positions[(numSegments-1)*3] = bobber.position.x;
    positions[(numSegments-1)*3+1] = bobber.position.y;
    positions[(numSegments-1)*3+2] = bobber.position.z;
    lineGeometry.attributes.position.needsUpdate = true;

    // Update Biological Swarm
    fishSwarm.update(dt, bobber.position);
    for (let i = 0; i < fishSwarm.numFishes; i++) {
        const fish = fishSwarm.fishes[i];
        const mesh = fishMeshes[i];
        mesh.position.set(fish.position[0], fish.position[1], fish.position[2]);
        // Point mesh in velocity direction
        const target = new THREE.Vector3(
            fish.position[0] + fish.velocity[0],
            fish.position[1] + fish.velocity[1],
            fish.position[2] + fish.velocity[2]
        );
        mesh.lookAt(target);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
