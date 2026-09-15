import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

describe('gameplay screen cabinet redesign contracts', () => {
  const hud = read('src/components/Hud.tsx');
  const screen = read('src/screens/GameScreen.tsx');
  const rail = read('src/theme/coreV2Board.ts');

  it('places Home and Restart as adjacent HUD siblings', () => {
    expect(hud).toMatch(/accessibilityLabel="Home"/);
    expect(hud).toMatch(/accessibilityLabel="Restart level"/);
    expect(hud).toMatch(/styles\.actions/);
    expect(hud.indexOf('accessibilityLabel="Home"'))
      .toBeLessThan(hud.indexOf('accessibilityLabel="Restart level"'));
  });

  it('wires Home through the existing exit navigation', () => {
    expect(screen).toMatch(/onHome=\{onExit\}/);
    expect(screen).toMatch(/onRestart=\{session\.restart\}/);
  });

  it('does not restyle the Expo development gear', () => {
    expect(hud).not.toMatch(/Expo|dev-client|⚙/);
    expect(screen).not.toMatch(/Expo|dev-client/);
  });

  it('uses a navy/cyan rail, not a purple frame', () => {
    expect(rail).toMatch(/railBand: '#003057'/);
    expect(rail).toMatch(/railHighlight: '#01D8FD'/);
    expect(rail).not.toMatch(/#5C44D7/);
  });
});
