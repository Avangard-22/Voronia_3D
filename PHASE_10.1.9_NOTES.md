# Phase 10.1.9 — V1 Timed Effects, Surge Scheduling & Cooldown Recovery Parity

## Implemented
- Added an explicit post-offline reconciliation pass for the active planet's V1 auto-surge timers.
- A surge whose deadline elapsed while the game was closed is skipped. It is never replayed, never grants an offline energy buff, and never increments the surge session counter.
- The next surge opportunity is re-armed from the recovered game clock using the original V1 type-specific intervals: 45–120 seconds for type 1 and 90–240 seconds for type 2.
- Expired `surgeUntil` state is cleared. Manual charge cooldowns remain deadline-based and naturally become available when the recovered game clock passes their deadline.
- Future surge deadlines are preserved unchanged. Recovery is only run after an offline interval meeting the V1 minimum threshold and only for the active planet, matching the active-planet scheduler scope.
- No new economy formulas, bonuses, resources, or progression systems were introduced. V1 balance constants remain authoritative.

## Verification
- Added Vitest coverage for missed-surge suppression, expired effect cleanup, cooldown expiry, and preservation of future schedules.
- Added `npm run check:phase10.1.9` static contract validation.
