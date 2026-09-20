export const JONSWAP_GLSL = `
/* ── JONSWAP peak frequency (Pierson-Moskowitz) ──── */
// f_p = 0.13g/U (Hz), ω_p = 2π f_p
// Deep-water dispersion: ω² = g·k → k = ω²/g
float gravity = 9.81;

#ifndef PI
#define PI 3.14159265359
#endif
#ifndef TAU
#define TAU 6.28318530718
#endif
#ifndef N_WAVES
#define N_WAVES 32
#endif

float hash1(float n) { return fract(sin(n) * 43758.5453123); }

/* ── Wave component parameters from spectrum ──────── */
vec2 waveDir(int i) {
  float t = float(i) / float(N_WAVES);
  // spread directions ±45° around wind direction (0°=+x)
  float theta = (t - 0.5) * PI * 0.9;
  return vec2(cos(theta), sin(theta));
}

float waveParms(int i, float windSpeed, out float freq, out float amp, out float phase) {
  float omegaP = 0.13 * gravity / max(windSpeed, 1.0) * TAU;
  float t = float(i) / float(N_WAVES - 1);
  // log-spaced frequencies
  float omegaMin = omegaP * 0.5;
  float omegaMax = omegaP * 3.5;
  freq = omegaMin * pow(omegaMax / omegaMin, t);

  // JONSWAP spectrum S(omega)
  float sigma = (freq <= omegaP) ? 0.07 : 0.09;
  float r = exp(-pow((freq - omegaP), 2.0) / (2.0 * sigma * sigma * omegaP * omegaP));
  float alpha = 0.0081;
  float gamma = 3.3;
  float S = alpha * gravity * gravity / pow(freq, 5.0)
            * exp(-1.25 * pow(omegaP / freq, 4.0))
            * pow(gamma, r);

  // amplitude from spectrum: A = sqrt(2·S·Δω)
  float dOmega = (omegaMax - omegaMin) / float(N_WAVES);
  amp = sqrt(2.0 * S * dOmega) * 0.35 * windSpeed / 12.0;
  amp = clamp(amp, 0.0, 1.8);

  // random phase
  phase = hash1(float(i) * 17.31 + 0.73) * TAU;
  return freq;
}

/* ── Surface height h(x,y,t) ──────────────────────── */
float oceanHeight(vec2 pos, float t, float windSpeed, float chop) {
  float h = 0.0;
  float omegaP = 0.13 * gravity / max(windSpeed, 1.0) * TAU;

  for (int i = 0; i < N_WAVES; i++) {
    float freq, amp, phase;
    waveParms(i, windSpeed, freq, amp, phase);
    float k = freq * freq / gravity;  // deep-water dispersion
    vec2 dir = waveDir(i);
    float proj = dot(dir, pos) * k;
    h += amp * sin(proj - freq * t + phase);
  }
  return h * chop;
}

/* ── Analytical gradient → normal ────────────────── */
vec3 oceanNormal(vec2 pos, float t, float windSpeed, float chop) {
  float eps = 0.04;
  float hc  = oceanHeight(pos, t, windSpeed, chop);
  float hx  = oceanHeight(pos + vec2(eps, 0.0), t, windSpeed, chop);
  float hy  = oceanHeight(pos + vec2(0.0, eps), t, windSpeed, chop);
  vec3 N = normalize(vec3(-(hx - hc) / eps, 1.0, -(hy - hc) / eps));
  return N;
}

/* ── Laplacian (for SSS) ─────────────────────────── */
float laplacian(vec2 pos, float t, float windSpeed, float chop) {
  float eps = 0.08;
  float hc = oceanHeight(pos, t, windSpeed, chop);
  float hx1 = oceanHeight(pos + vec2( eps, 0.0), t, windSpeed, chop);
  float hx2 = oceanHeight(pos + vec2(-eps, 0.0), t, windSpeed, chop);
  float hy1 = oceanHeight(pos + vec2(0.0,  eps), t, windSpeed, chop);
  float hy2 = oceanHeight(pos + vec2(0.0, -eps), t, windSpeed, chop);
  return (hx1 + hx2 + hy1 + hy2 - 4.0 * hc) / (eps * eps);
}
`;
