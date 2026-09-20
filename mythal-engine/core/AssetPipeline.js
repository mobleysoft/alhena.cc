import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

class AssetPipeline {
  constructor() {
    this.cache = new Map();
    this.gltfLoader = new GLTFLoader();
    
    // Optional: Setup DRACOLoader if needed
    // const dracoLoader = new DRACOLoader();
    // dracoLoader.setDecoderPath('/draco/');
    // this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  /**
   * Loads a GLTF/GLB asset asynchronously.
   * @param {string} url - The URL of the asset to load.
   * @param {Object} config - Configuration options.
   * @param {boolean} [config.castShadow=true] - Whether the loaded meshes should cast shadows.
   * @param {boolean} [config.receiveShadow=true] - Whether the loaded meshes should receive shadows.
   * @param {boolean} [config.useCache=true] - Whether to use the internal cache for this asset.
   * @returns {Promise<THREE.Group>} - A promise that resolves to the root group of the loaded asset.
   */
  async loadAsset(url, config = {}) {
    const { castShadow = true, receiveShadow = true, useCache = true } = config;

    if (useCache && this.cache.has(url)) {
      // Clone the cached asset so multiple instances can be placed in the scene
      const cachedAsset = this.cache.get(url);
      const clonedAsset = this.cloneGltf(cachedAsset);
      this.applyShadowProperties(clonedAsset, castShadow, receiveShadow);
      return clonedAsset;
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          if (useCache) {
            this.cache.set(url, gltf.scene);
          }
          
          const scene = useCache ? this.cloneGltf(gltf.scene) : gltf.scene;
          this.applyShadowProperties(scene, castShadow, receiveShadow);
          resolve(scene);
        },
        undefined,
        (error) => {
          console.error(`Error loading asset from URL: ${url}`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Applies shadow properties recursively to all meshes within an object.
   * @param {THREE.Object3D} object - The object to traverse.
   * @param {boolean} castShadow - Cast shadow flag.
   * @param {boolean} receiveShadow - Receive shadow flag.
   */
  applyShadowProperties(object, castShadow, receiveShadow) {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });
  }

  /**
   * Clones a GLTF scene, preserving SkinnedMeshes and materials correctly.
   * Simple scene.clone() sometimes fails with complex rigged models in Three.js.
   */
  cloneGltf(source) {
    return source.clone(true);
  }
}

// Export a singleton instance for ease of use across Paradise V4
const assetPipeline = new AssetPipeline();
export default assetPipeline;
export { AssetPipeline };
