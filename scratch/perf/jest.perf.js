module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/scratch/perf'],
  testMatch: ['**/*.perf.test.tsx'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/scratch/perf/stubs/react-native.tsx',
    '^react-native-reanimated$': '<rootDir>/scratch/perf/stubs/reanimated.tsx',
    '^@shopify/react-native-skia$': '<rootDir>/scratch/perf/stubs/skia.tsx',
    '^react-native-safe-area-context$': '<rootDir>/scratch/perf/stubs/react-native.tsx',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: { '^.+\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/scratch/perf/tsconfig.perf.json', diagnostics: false }] },
  globals: { __DEV__: false },
};
