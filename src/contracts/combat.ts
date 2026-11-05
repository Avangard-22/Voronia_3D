import type { DomainStatus } from './ports';

/** Public capability contract for the combat domain; implementation is intentionally deferred. */
export const COMBAT_DOMAIN_STATUS: DomainStatus = Object.freeze({
  domain: 'combat',
  status: 'NOT_IMPLEMENTED',
  stage: 8,
  note: 'боссы/стражи/коллапсы (planet.boss — вне среза)',
});
