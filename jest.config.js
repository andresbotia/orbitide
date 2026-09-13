/**
 * The Pixel Arcadia engine is pure TypeScript with no React Native imports, so the
 * unit tests run through ts-jest in a plain Node environment and never touch a
 * simulator or the Expo/RN runtime.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // `src/theme` added in the Pixel Arcadia redesign (Milestone 1): the new
  // material/motion/world-skin foundations are pure TS (no React Native
  // imports), same as `src/game`, and need their own unit tests discovered.
  roots: ['<rootDir>/src/game', '<rootDir>/src/theme'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  collectCoverageFrom: [
    'src/game/engine/**/*.ts',
    'src/game/levels/**/*.ts',
    '!src/game/**/__tests__/**',
  ],
};
