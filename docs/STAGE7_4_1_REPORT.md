# Stage 7.4.1 — Orbital Discovery & Planet Activation

## Scope

Implemented the first playable orbital-research loop on top of the Stage 7.4 deterministic `StarSystemCatalog`.

## Domain behavior

- `scanOrbitalBody` is available only when the host system is discovered and unlocked.
- Only catalogued non-host orbital bodies can be scanned.
- A body can be scanned once. The scan costs **500 energy + 100 research**.
- `activateOrbitalBody` requires a previously scanned body and an unlocked host system.
- Activation costs **2,000 energy + 500 research**.
- Activation runs the existing planet generator/discovery pipeline (`runDiscovery`), creates a real `PlanetRuntime`, applies its starting state, adds it to the unlocked planet list and emits the existing `planet:discovered` event.
- Activation is idempotency-guarded: an already activated body cannot create a second planet.
- Candidate seed is derived deterministically from the host catalog seed and orbit index. Body class maps to an initial biome profile; host geometry is reused.

## Persistence

Added optional `orbitalExploration` to SaveGameV2. It stores scanned body IDs and body-to-planet activation mappings. Existing saves remain compatible because the field is optional. Activated worlds are replayed from the existing `discoveredSpecs` sequence (ADR-017), then the orbital mapping is restored.

## UI

The galaxy system panel now offers `ИССЛЕДОВАТЬ` and, after a successful scan, `АКТИВИРОВАТЬ` actions. A scanned candidate reveals its body class; unscanned candidates remain unidentified. Newly activated planets enter the galaxy graph through the existing discovery pipeline.

## Verification performed

- Strict TypeScript check passed for the modified domain/persistence dependency graph:
  `tsc --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --noEmit src/core/game.ts src/galaxy/starSystems.ts src/galaxy/systemExploration.ts src/persistence/schema.ts src/contracts/commands.ts`
- TypeScript syntax transpilation passed for all changed TS files and the new test file.
- `node tools/check_arch.mjs` passed: 86 files, architecture boundaries clean.

## Verification not performed

- Vitest was not run: project dependencies are not installed in this workspace.
- Full application typecheck and production Vite build were not run (`vite/client` type package is unavailable).
- Browser/WebGL and Android runtime tests were not run.

## Known limitation

An activated orbital body is materialized as a generated playable planet and connected to the existing galaxy graph by the current `discoverPlanet` pipeline. It is not yet represented as a nested child node with a physical parent-star/orbit relation in the galaxy graph. The orbital catalog retains the host/body association. A later data-model pass can promote that association into first-class graph topology without discarding this save data.
