import * as THREE from 'three';

export function createGhibliWaterMaterial() {
    const material = new THREE.MeshStandardMaterial({
        color: 0x00aaff, // Bright tropical blue
        transparent: true,
        opacity: 0.9,
        roughness: 0.1,
        metalness: 0.1,
    });
    
    const uniforms = {
        uTime: { value: 0 },
        uWindSpeed: { value: 12.0 },
        uChop: { value: 1.0 },
        uColorDeep: { value: new THREE.Color(0x004488) },
        uColorShallow: { value: new THREE.Color(0x00aaff) },
        uColorFoam: { value: new THREE.Color(0xffffff) },
    };
    
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
        shader.uniforms.uChop = uniforms.uChop;
        shader.uniforms.uColorDeep = uniforms.uColorDeep;
        shader.uniforms.uColorShallow = uniforms.uColorShallow;
        shader.uniforms.uColorFoam = uniforms.uColorFoam;

        shader.vertexShader = `
            uniform float uTime;
            uniform float uWindSpeed;
            uniform float uChop;
            varying float vHeight;
            
            // --- JONSWAP INJECTION ---
            float hash1(float n) { return fract(sin(n) * 43758.5453123); }
            
            float oceanHeight(vec2 pos, float t) {
                float gravity = 9.81;
                float omegaP = 0.13 * gravity / max(uWindSpeed, 1.0) * 6.28318;
                float h = 0.0;
                
                for(int i=0; i<32; i++) {
                    float t_val = float(i) / 31.0;
                    float theta = (t_val - 0.5) * 3.14159 * 0.9;
                    vec2 dir = vec2(cos(theta), sin(theta));
                    
                    float omegaMin = omegaP * 0.5;
                    float omegaMax = omegaP * 3.5;
                    float freq = omegaMin * pow(omegaMax / omegaMin, t_val);
                    
                    float sigma = (freq <= omegaP) ? 0.07 : 0.09;
                    float r = exp(-pow((freq - omegaP), 2.0) / (2.0 * sigma * sigma * omegaP * omegaP));
                    float alpha = 0.0081;
                    float gamma = 3.3;
                    float S = alpha * gravity * gravity / pow(freq, 5.0) * exp(-1.25 * pow(omegaP / freq, 4.0)) * pow(gamma, r);
                    
                    float dOmega = (omegaMax - omegaMin) / 32.0;
                    float amp = sqrt(2.0 * S * dOmega) * 0.35 * uWindSpeed / 12.0;
                    amp = clamp(amp, 0.0, 1.8);
                    
                    float phase = hash1(float(i) * 17.31 + 0.73) * 6.28318;
                    float k = freq * freq / gravity;
                    float proj = dot(dir, pos) * k;
                    
                    h += amp * sin(proj - freq * t + phase);
                }
                return h * uChop;
            }
            // -------------------------
            
            ${shader.vertexShader}
        `.replace(
            `#include <begin_vertex>`,
            `
            #include <begin_vertex>
            float h = oceanHeight(position.xy, uTime); // Plane is mapped to XY initially, rotated to XZ
            transformed.z += h; // because plane geometry is flat on Z before rotation
            vHeight = h;
            `
        ).replace(
            `#include <beginnormal_vertex>`,
            `
            #include <beginnormal_vertex>
            // compute analytical normals for lighting
            float eps = 0.1;
            float hc = oceanHeight(position.xy, uTime);
            float hx = oceanHeight(position.xy + vec2(eps, 0.0), uTime);
            float hy = oceanHeight(position.xy + vec2(0.0, eps), uTime);
            vec3 newNormal = normalize(vec3(-(hx - hc)/eps, -(hy - hc)/eps, 1.0));
            objectNormal = newNormal;
            `
        );

        shader.fragmentShader = `
            uniform vec3 uColorDeep;
            uniform vec3 uColorShallow;
            uniform vec3 uColorFoam;
            varying float vHeight;
            ${shader.fragmentShader}
        `.replace(
            `#include <color_fragment>`,
            `
            #include <color_fragment>
            // Studio Ghibli stylized banding
            float normalizedHeight = smoothstep(-1.0, 1.5, vHeight);
            
            // Mix colors based on height
            vec3 baseWater = mix(uColorDeep, uColorShallow, normalizedHeight);
            
            // Add foam at crests (peaks)
            float foamFactor = smoothstep(1.0, 1.3, vHeight); // Hard cutoff for graphic style
            diffuseColor.rgb = mix(baseWater, uColorFoam, foamFactor);
            `
        );
    };
    
    return { material, uniforms };
}
