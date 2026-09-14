import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PRODUCT_NAME } from '@/theme/appIdentity';
import {
  brandColor,
  brandGradient,
  brandInk,
  brandMotion,
  WORDMARK_LABEL,
  wordmark,
} from '@/theme/brand';
import { orbColors } from '@/theme/colors';

const repoRoot = resolve(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

describe('Pixel Arcadia brand token layer', () => {
  it('exposes exactly the 11 approved colour tokens with the approved hex values', () => {
    // NORTH-STAR REBUILD — retinted from a near-black purple foundation to a
    // brighter royal-blue/indigo one (`theme/brand.ts`); these are the new
    // approved values, not a regression against the old ones.
    expect(brandColor).toEqual({
      background: '#0E1442',
      backgroundAlt: '#182055',
      indigo: '#5450D6',
      violet: '#A98CFF',
      portalWarm: '#FFB24D',
      cyanAccent: '#3FE4FF',
      textPrimary: '#F1EFFB',
      textSecondary: '#ABA7D0',
      surface: '#212A6E',
      border: '#3D49A8',
      glow: '#FFB24D',
    });
    expect(Object.keys(brandColor)).toHaveLength(11);
    expect(brandInk).toBe('#2A1405');
  });

  it('defines exactly the four approved gradients and no more', () => {
    expect(Object.keys(brandGradient).sort()).toEqual(['background', 'core', 'cta', 'surface']);
    expect(brandGradient.cta.stops.map((s) => s.color)).toEqual(['#FFD98A', '#FFB24D', '#F0871F']);
    expect(brandGradient.core.stops.map((s) => s.color)).toEqual([
      '#FFFFFF',
      '#FFF0B8',
      '#FFC94D',
      '#F2662E',
    ]);
    expect(brandGradient.surface.stops.map((s) => s.color)).toEqual(['#2C3578', '#1A2158']);
    expect(brandGradient.background.kind).toBe('radial');
  });

  it('defines the five additive brand-motion tokens, each with a reduced-motion resolution', () => {
    expect(Object.keys(brandMotion).sort()).toEqual([
      'corePulse',
      'iconEntrance',
      'particleArrival',
      'portalBreathe',
      'wordmarkReveal',
    ]);
    for (const token of Object.values(brandMotion)) {
      expect(token.durationMs).toBeGreaterThan(0);
      expect(['end-state', 'static-hold']).toContain(token.reducedMotion);
    }
    expect(brandMotion.corePulse.durationMs).toBe(1400);
  });

  it('keeps brand colours separate from the 15 gameplay colours', () => {
    const gameplay = new Set(Object.values(orbColors).map((c) => c.toUpperCase()));
    for (const c of Object.values(brandColor)) {
      expect(gameplay.has(c.toUpperCase())).toBe(false);
    }
    // the brand module must not import the gameplay palette
    expect(read('src/theme/brand.ts')).not.toMatch(/from '\.\/colors'/);
    expect(read('src/theme/brand.ts')).not.toMatch(/OrbColor/);
  });

  it('carries the wordmark contract: equal weight, colour split, Space Grotesk 700', () => {
    expect(wordmark.words).toEqual({ primary: 'PIXEL', accent: 'ARCADIA' });
    expect(wordmark.color.primary).toBe(brandColor.textPrimary);
    expect(wordmark.color.accent).toBe(brandColor.portalWarm);
    expect(wordmark.fontFamily).toBe('SpaceGrotesk_700Bold');
    expect(wordmark.fontWeight).toBe('700');
    expect(wordmark.minFontSize).toBeGreaterThanOrEqual(15);
    expect(WORDMARK_LABEL).toBe('PIXEL ARCADIA');
  });
});

describe('Home wordmark integration', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const marquee = read('src/components/home/HomeMarquee.tsx');
  const environment = read('src/components/home/HomeEnvironment.tsx');

  it('renders the live PixelArcadiaWordmark component, not a raw styled Text', () => {
    expect(marquee).toMatch(/<PixelArcadiaWordmark/);
    expect(home).not.toMatch(/\{PRODUCT_WORDMARK\}/);
    expect(home).not.toMatch(/color:\s*palette\.textSecondary/);
  });

  it('uses a tiled looping background, not a plaza or board preview', () => {
    expect(home).not.toMatch(/HomeCenterpiece/);
    expect(home).not.toMatch(/HomeMotes/);
    expect(home).not.toMatch(/PICTURES RESTORED/);
    expect(home).not.toMatch(/LogoMark|portal arch|ArchMotif/);
    expect(environment).not.toMatch(/LogoMark|portal arch|ArchMotif/);
    expect(environment).toMatch(/reanimateloop/);
    expect(environment).toMatch(/resizeMode="repeat"/);
    expect(marquee).not.toMatch(/spill/);
    expect(read('src/theme/homeV2.ts')).toMatch(/#002662/);
  });
});

describe('primary CTA + font loading wiring', () => {
  it('routes PLAY and the result-screen actions through the shared PrimaryCta', () => {
    expect(read('src/components/PlayButton.tsx')).toMatch(/PrimaryCta/);
    expect(read('src/components/ResultOverlay.tsx')).toMatch(/PrimaryCta/);
  });

  it('loads Space Grotesk 700 at the app root without blocking startup', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toMatch(/SpaceGrotesk_700Bold/);
    expect(layout).toMatch(/useFonts/);
    expect(layout).toMatch(/hideAsync/);
  });
});

describe('app config — display name over untouched technical identifiers', () => {
  const cfg = JSON.parse(read('app.json')) as {
    expo: {
      name: string;
      slug: string;
      scheme: string;
      backgroundColor: string;
      icon: string;
      ios: { bundleIdentifier: string };
      android: { adaptiveIcon: { backgroundColor: string; foregroundImage: string } };
      web: { name?: string; favicon: string };
      plugins: unknown[];
      extra: { eas: { projectId: string } };
      updates: { url: string };
    };
  };

  it('presents "Pixel Arcadia" everywhere consumer-facing', () => {
    expect(cfg.expo.name).toBe('Pixel Arcadia');
    expect(cfg.expo.web.name).toBe('Pixel Arcadia');
    expect(PRODUCT_NAME).toBe('Pixel Arcadia');
  });

  it('preserves every technical identifier', () => {
    expect(cfg.expo.slug).toBe('orbitide');
    expect(cfg.expo.scheme).toBe('orbitide');
    expect(cfg.expo.ios.bundleIdentifier).toBe('com.andresbotia.orbitide');
    expect(cfg.expo.extra.eas.projectId).toBe('07cb395c-b299-49d3-9100-f360874eaea5');
    expect(cfg.expo.updates.url).toContain('07cb395c-b299-49d3-9100-f360874eaea5');
  });

  it('wires the approved icon / splash / adaptive-icon brand colours', () => {
    expect(cfg.expo.backgroundColor).toBe('#0E1442');
    expect(cfg.expo.icon).toBe('./assets/icon.png');
    expect(cfg.expo.android.adaptiveIcon.backgroundColor).toBe('#182055');
    const splash = cfg.expo.plugins.find(
      (p): p is [string, { backgroundColor: string }] =>
        Array.isArray(p) && p[0] === 'expo-splash-screen',
    );
    expect(splash?.[1].backgroundColor).toBe('#0E1442');
  });
});

describe('web metadata + favicon', () => {
  const html = read('app/+html.tsx');

  it('titles the document "Pixel Arcadia"', () => {
    expect(html).toMatch(/<title>\{PRODUCT_NAME\}<\/title>/);
    expect(html).toMatch(/name="theme-color" content="#0E1442"/);
    expect(html).toMatch(/apple-touch-icon/);
  });

  it('points web.favicon at the simplified core-only source (drives favicon.ico 16/32/48)', () => {
    const cfg = JSON.parse(read('app.json')) as { expo: { web: { favicon: string } } };
    expect(cfg.expo.web.favicon).toBe('./assets/favicon.png');
    // standalone sizes also shipped for manual linking
    expect(existsSync(join(repoRoot, 'public/favicon-16.png'))).toBe(true);
    expect(existsSync(join(repoRoot, 'public/favicon-32.png'))).toBe(true);
  });
});

describe('brand assets are present', () => {
  const files = [
    'assets/icon.png',
    'assets/adaptive-icon.png',
    'assets/android-icon-foreground.png',
    'assets/android-icon-background.png',
    'assets/splash-icon.png',
    'assets/favicon.png',
    'assets/favicon-16.png',
    'assets/favicon-32.png',
    'assets/brand/logo-mark.svg',
    'assets/brand/logo-mark-mono-light.svg',
    'assets/brand/logo-mark-mono-dark.svg',
    'assets/brand/wordmark.svg',
    'assets/brand/wordmark-stacked.svg',
    'assets/brand/logo-horizontal.svg',
    'assets/brand/logo-stacked.svg',
    'public/favicon.png',
    'public/favicon-16.png',
    'public/favicon-32.png',
  ];

  it.each(files)('%s exists', (rel) => {
    expect(existsSync(join(repoRoot, rel))).toBe(true);
  });

  it('ships the vector mark without embedded raster or filters', () => {
    const svg = read('assets/brand/logo-mark.svg');
    expect(svg).not.toMatch(/<image|xlink:href|filter=/);
    expect(svg).toMatch(/viewBox="0 0 120 120"/);
  });
});

describe('reduced-motion fallbacks', () => {
  it('the core pulse resolves to a static core under reduce-motion', () => {
    const src = read('src/components/brand/CorePulse.tsx');
    expect(src).toMatch(/useReducedMotion/);
    expect(src).toMatch(/reduced\s*\?\s*1\s*:\s*0/);
  });

  it('the loader stays understandable without animation (accessibility label)', () => {
    const src = read('src/components/brand/BrandLoader.tsx');
    expect(src).toMatch(/accessibilityLabel = 'Loading'/);
    expect(src).toMatch(/accessibilityRole="progressbar"/);
  });
});

describe('no newly-introduced consumer-facing legacy branding', () => {
  const brandSurfaces = [
    'src/theme/brand.ts',
    'src/components/brand/LogoMark.tsx',
    'src/components/brand/PixelArcadiaWordmark.tsx',
    'src/components/brand/PrimaryCta.tsx',
    'src/components/brand/BrandEmptyState.tsx',
  ];
  it.each(brandSurfaces)('%s contains no "Orbitide" wordmark', (rel) => {
    expect(read(rel)).not.toMatch(/Orbitide/i);
  });
});
