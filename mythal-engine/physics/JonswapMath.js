export const GRAVITY = 9.81;
export const N_WAVES = 32;

function hash1(n) {
    const sin_n = Math.sin(n) * 43758.5453123;
    return sin_n - Math.floor(sin_n);
}

function waveDir(i) {
    const t = i / N_WAVES;
    const theta = (t - 0.5) * Math.PI * 0.9;
    return { x: Math.cos(theta), y: Math.sin(theta) };
}

function waveParms(i, windSpeed) {
    const omegaP = 0.13 * GRAVITY / Math.max(windSpeed, 1.0) * (Math.PI * 2);
    const t = i / (N_WAVES - 1);
    const omegaMin = omegaP * 0.5;
    const omegaMax = omegaP * 3.5;
    const freq = omegaMin * Math.pow(omegaMax / omegaMin, t);

    const sigma = (freq <= omegaP) ? 0.07 : 0.09;
    const r = Math.exp(-Math.pow(freq - omegaP, 2.0) / (2.0 * sigma * sigma * omegaP * omegaP));
    const alpha = 0.0081;
    const gamma = 3.3;
    
    let S = alpha * GRAVITY * GRAVITY / Math.pow(freq, 5.0) 
            * Math.exp(-1.25 * Math.pow(omegaP / freq, 4.0)) 
            * Math.pow(gamma, r);
            
    const dOmega = (omegaMax - omegaMin) / N_WAVES;
    let amp = Math.sqrt(2.0 * S * dOmega) * 0.35 * windSpeed / 12.0;
    amp = Math.max(0.0, Math.min(amp, 1.8)); // clamp 0 to 1.8

    const phase = hash1(i * 17.31 + 0.73) * (Math.PI * 2);
    return { freq, amp, phase };
}

export function getOceanHeight(x, z, time, windSpeed = 12.0, chop = 1.0) {
    let h = 0.0;
    for (let i = 0; i < N_WAVES; i++) {
        const { freq, amp, phase } = waveParms(i, windSpeed);
        const k = (freq * freq) / GRAVITY;
        const dir = waveDir(i);
        const proj = (dir.x * x + dir.y * z) * k;
        h += amp * Math.sin(proj - freq * time + phase);
    }
    return h * chop;
}
