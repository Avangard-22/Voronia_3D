/** Planet-specific atmospheric rendering profiles. Pure data/functions; no Three.js dependency. */
export interface PlanetAtmosphereProfile {
  readonly biome: string;
  readonly color: number;
  readonly cloudColor: number;
  readonly opacity: number;
  readonly cloudOpacity: number;
  readonly altitude: number;
  readonly cloudCoverage: number;
  readonly cloudSpeed: number;
  readonly scattering: number;
}

const PROFILES: Readonly<Record<string, Omit<PlanetAtmosphereProfile, 'biome'>>> = Object.freeze({
  ferrum:  { color: 0xc77f62, cloudColor: 0xd9b9a2, opacity: 0.34, cloudOpacity: 0.25, altitude: 1.055, cloudCoverage: 0.48, cloudSpeed: 0.018, scattering: 1.0 },
  krios:   { color: 0x83c9ef, cloudColor: 0xd9f2ff, opacity: 0.42, cloudOpacity: 0.34, altitude: 1.068, cloudCoverage: 0.58, cloudSpeed: 0.012, scattering: 1.18 },
  volcanic:{ color: 0xe78c63, cloudColor: 0x8d7774, opacity: 0.28, cloudOpacity: 0.20, altitude: 1.048, cloudCoverage: 0.36, cloudSpeed: 0.009, scattering: 0.82 },
  ocean:   { color: 0x55bce8, cloudColor: 0xe8f8ff, opacity: 0.46, cloudOpacity: 0.38, altitude: 1.064, cloudCoverage: 0.66, cloudSpeed: 0.014, scattering: 1.24 },
  desert:  { color: 0xe7b978, cloudColor: 0xf3dfbd, opacity: 0.25, cloudOpacity: 0.13, altitude: 1.052, cloudCoverage: 0.24, cloudSpeed: 0.008, scattering: 0.72 },
  ice:     { color: 0xa9e6f5, cloudColor: 0xf3fcff, opacity: 0.44, cloudOpacity: 0.30, altitude: 1.066, cloudCoverage: 0.54, cloudSpeed: 0.010, scattering: 1.16 },
  gas:     { color: 0xc4a5e8, cloudColor: 0xe4d8fa, opacity: 0.50, cloudOpacity: 0.52, altitude: 1.075, cloudCoverage: 0.72, cloudSpeed: 0.022, scattering: 1.32 },
});

export function getPlanetAtmosphereProfile(biome: string): PlanetAtmosphereProfile {
  const key = biome.trim().toLowerCase();
  const base = PROFILES[key] ?? { color: 0x91b8d8, cloudColor: 0xd9e8f5, opacity: 0.30, cloudOpacity: 0.20, altitude: 1.055, cloudCoverage: 0.38, cloudSpeed: 0.012, scattering: 0.9 };
  return { biome: key || 'unknown', ...base };
}

export function atmosphereQualityScale(tier: 'low' | 'balanced' | 'high'): number {
  return tier === 'low' ? 0.62 : tier === 'balanced' ? 0.82 : 1;
}

/** Deterministic local stellar cycle used by the surface renderer. */
export interface PlanetarySolarState {
  readonly direction: readonly [number, number, number];
  readonly intensity: number;
  readonly ambient: number;
  readonly color: number;
  readonly terminatorSoftness: number;
}

const SOLAR_COLORS: Readonly<Record<string, number>> = Object.freeze({
  ferrum: 0xffd7ad, krios: 0xc9e5ff, volcanic: 0xffa77c,
  ocean: 0xffe8c8, desert: 0xffd09a, ice: 0xd7efff, gas: 0xe1d0ff,
});

/** A slow apparent stellar orbit; direction is normalized in planet-local space. */
export function getPlanetarySolarState(timeMs: number, biome: string): PlanetarySolarState {
  const key = biome.trim().toLowerCase();
  const phase = timeMs * 0.000035 + 0.72;
  const tilt = key === 'gas' ? 0.48 : key === 'ice' ? 0.34 : 0.22;
  const x = Math.cos(phase);
  const y = Math.sin(phase) * tilt + 0.18;
  const z = Math.sin(phase) * 0.92 + 0.36;
  const length = Math.hypot(x, y, z) || 1;
  const daylight = 0.5 + 0.5 * Math.sin(phase + 0.35);
  return {
    direction: [x / length, y / length, z / length],
    intensity: 0.82 + daylight * 0.42,
    ambient: 0.22 + (1 - daylight) * 0.12,
    color: SOLAR_COLORS[key] ?? 0xffe2bd,
    terminatorSoftness: key === 'gas' ? 0.24 : 0.16,
  };
}


/** Stage 9.12.6: cosmetic weather profile; weather does not alter gameplay/economy. */
export interface PlanetWeatherProfile {
  readonly stormIntensity: number;
  readonly lightningRate: number;
  readonly turbulence: number;
  readonly haze: number;
  readonly aurora: number;
}
const WEATHER: Readonly<Record<string, PlanetWeatherProfile>> = Object.freeze({
  ferrum: { stormIntensity: 0.32, lightningRate: 0.12, turbulence: 0.42, haze: 0.18, aurora: 0.02 },
  krios: { stormIntensity: 0.22, lightningRate: 0.08, turbulence: 0.30, haze: 0.10, aurora: 0.24 },
  volcanic: { stormIntensity: 0.72, lightningRate: 0.58, turbulence: 0.82, haze: 0.52, aurora: 0.01 },
  ocean: { stormIntensity: 0.64, lightningRate: 0.42, turbulence: 0.76, haze: 0.22, aurora: 0.04 },
  desert: { stormIntensity: 0.48, lightningRate: 0.16, turbulence: 0.68, haze: 0.46, aurora: 0.01 },
  ice: { stormIntensity: 0.28, lightningRate: 0.06, turbulence: 0.34, haze: 0.12, aurora: 0.42 },
  gas: { stormIntensity: 0.88, lightningRate: 0.34, turbulence: 0.94, haze: 0.34, aurora: 0.08 },
});
export function getPlanetWeatherProfile(biome: string): PlanetWeatherProfile {
  return WEATHER[biome.trim().toLowerCase()] ?? { stormIntensity: 0.24, lightningRate: 0.08, turbulence: 0.32, haze: 0.16, aurora: 0.03 };
}
export interface PlanetWeatherState {
  readonly storm: number;
  readonly lightning: number;
  readonly haze: number;
  readonly aurora: number;
}
/** Stable procedural weather envelope: no random frame-to-frame flicker. */
export function getPlanetWeatherState(timeMs: number, biome: string): PlanetWeatherState {
  const profile = getPlanetWeatherProfile(biome);
  const t = Math.max(0, timeMs) * 0.001;
  const stormWave = 0.72 + 0.28 * Math.sin(t * (0.035 + profile.turbulence * 0.025) + 1.7);
  const lightningWave = Math.pow(Math.max(0, Math.sin(t * (0.31 + profile.lightningRate) + 2.1)), 28);
  const auroraWave = 0.55 + 0.45 * Math.sin(t * 0.075 + 0.8);
  return {
    storm: Math.min(1, Math.max(0, profile.stormIntensity * stormWave)),
    lightning: Math.min(1, Math.max(0, lightningWave * profile.lightningRate)),
    haze: profile.haze,
    aurora: Math.min(1, Math.max(0, profile.aurora * auroraWave)),
  };
}
