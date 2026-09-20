# Paradise V4: The Unified Sovereign Architecture

## The Mythal (Core Philosophy)
The current V3 architecture is a Frankenstein composite. The water, the characters, and the UI exist in isolated iframes and canvases. Because they do not share a mathematical depth buffer, the dog cannot cast a shadow on the water, and the bobber cannot truly displace the volumetric lighting. 

To spark immense joy, a game must feel tactile. It must feel like a single, unbreakable world. V4 is a scorched-earth rewrite targeting a unified, single-canvas WebGPU substrate.

## 1. The Aesthetic Vector (The "Studio Ghibli" Attractor)
Hyper-realism in browser games usually results in the uncanny valley. Joy is sparked by exaggerated, beautiful stylization. 
*   **Visual Target:** A blend of *The Legend of Zelda: Wind Waker* and a premium vinyl toybox. 
*   **Lighting:** Painterly, soft-filtered shadows with heavy volumetric God rays piercing the water.
*   **Water:** JONSWAP physics but stylized with a vibrant, tropical color palette and thick white foam crests (gerstner wave intersections).

## 2. The Sovereign Engine (Three.js WebGPU Node System)
We abandon the iframe hacks and the legacy PlayCanvas bundles. We adopt the bleeding-edge `THREE.WebGPURenderer` and its Node Material system.
*   **Unified Depth:** The fishing line, the bobber, and the fish exist in the exact same render pass as the ocean. When the fish strikes, it displaces the actual water mesh, not a simulated 2D plane.
*   **Zero-Overhead Physics:** By utilizing WebGPU Compute Shaders, we can run the Verlet rope simulation and the fluid dynamics directly on the GPU, allowing 60FPS on mobile devices without burning thermal capital.

## 3. The Recirclant Gameplay Loop
We don't need 100 features. We need 3 flawless, deeply satisfying mechanics.
1.  **The Cast (Kinetic Joy):** A haptic-driven, physics-based cast where the player feels the weight of the lure.
2.  **The Strike (Visual Reward):** When the fish bites, the water violently erupts in stylized foam, and the camera dynamically punches in (tilt-shift depth of field).
3.  **The Fight (Tactile Resistance):** The line tension physically bends the rod geometry. If the tension snaps, the line violently recoils.

## Execution Path
1.  **Apoptosis:** We archive V3 into a legacy folder. We do not try to patch it anymore.
2.  **The Seed:** We establish `paradise/game-v4/` with a pristine Three.js WebGPU boilerplate.
3.  **Fecundity Swarm:** We unleash the Ouroboros engine to port the JONSWAP math strictly into a Three.js Node Material, ensuring the exact fluid dynamics are maintained but wrapped in a beautiful, stylized shader.
