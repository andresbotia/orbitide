import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PRODUCT_NAME, PRODUCT_WORDMARK, STUDIO_NAME } from '@/theme/appIdentity';

const repoRoot = resolve(__dirname, '../../..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

describe('product identity', () => {
  it('uses the final consumer-facing name and wordmark', () => {
    expect(PRODUCT_NAME).toBe('Pixel Arcadia');
    expect(PRODUCT_WORDMARK).toBe('PIXEL ARCADIA');
  });

  it('brands the Studio from the central identity', () => {
    expect(STUDIO_NAME).toBe('Pixel Arcadia Level Studio');

    const studioSource = readFileSync(join(repoRoot, 'src/screens/LevelStudioScreen.tsx'), 'utf8');
    expect(studioSource).toContain('{STUDIO_NAME}');
  });

  it('sets the Expo display name without changing technical identifiers', () => {
    const appConfig = JSON.parse(readFileSync(join(repoRoot, 'app.json'), 'utf8')) as {
      expo: { name: string; slug: string; scheme: string; ios: { bundleIdentifier: string } };
    };

    expect(appConfig.expo.name).toBe('Pixel Arcadia');
    expect(appConfig.expo.slug).toBe('orbitide');
    expect(appConfig.expo.scheme).toBe('orbitide');
    expect(appConfig.expo.ios.bundleIdentifier).toBe('com.andresbotia.orbitide');
  });

  it('has no legacy product wordmark in active UI source', () => {
    const uiRoots = ['app', 'src/components', 'src/screens'].map((path) => join(repoRoot, path));
    const legacyReferences = uiRoots.flatMap(sourceFiles).filter((path) =>
      /ORBITIDE/.test(readFileSync(path, 'utf8')),
    );

    expect(legacyReferences).toEqual([]);
  });
});
