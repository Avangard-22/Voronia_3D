import { describe, expect, it } from 'vitest';
import { COMBAT_DOMAIN_STATUS } from '../src/contracts/combat';

describe('Stage 9.7 quick-action capability contract', () => {
  it('keeps combat events explicitly unavailable until the combat domain is implemented', () => {
    expect(COMBAT_DOMAIN_STATUS.domain).toBe('combat');
    expect(COMBAT_DOMAIN_STATUS.status).toBe('NOT_IMPLEMENTED');
    expect(COMBAT_DOMAIN_STATUS.stage).toBe(8);
    expect(COMBAT_DOMAIN_STATUS.note).toContain('Страж');
  });
});
