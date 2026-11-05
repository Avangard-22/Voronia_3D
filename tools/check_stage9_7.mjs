import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/ui/styles.ts', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../src/contracts/combat.ts', import.meta.url), 'utf8');
const requiredActions = ['sonar', 'map', 'fullscreen', 'combat'];
const missing = requiredActions.filter((action) => !app.includes(`data-quick-action="${action}"`) || !app.includes(`action === '${action}'`));
if (missing.length) throw new Error(`Missing quick action integration: ${missing.join(', ')}`);
if (!styles.includes('.hud-quick-actions') || !styles.includes('@media(max-width:700px)')) throw new Error('Quick action responsive styles missing');
if (!contract.includes("status: 'NOT_IMPLEMENTED'")) throw new Error('Combat capability status must remain explicit');
console.log('PASS: Stage 9.7 quick actions, responsive styles, and combat capability status validated.');
