import type {
  ChargeSpec,
  GameRuleset,
  LevelDefinition,
  LevelDifficulty,
  LevelReveal,
  OrbColor,
  PixelModifierMap,
} from '@/game/engine/types';

/**
 * Structured authored level data format.
 * Designed for external generation (e.g. by ChatGPT or designers) without requiring
 * internal engine boilerplate. Supports flexible aliases (grid, holding, theme).
 */
export interface AuthoredLevel {
  id: number;
  title: string;
  themeId?: string;
  theme?: string;
  difficulty: LevelDifficulty | string;
  holdingCapacity?: number;
  holding?: number;
  pixelArt?: string[];
  grid?: string[];
  legend?: Record<string, OrbColor>;
  modifiers?: PixelModifierMap;
  tunnels: ChargeSpec[][];
  reveal?: LevelReveal;
  tutorial?: string;
  replacesLegacy?: boolean;
  ruleset?: GameRuleset;
  activeCapacity?: number;
  winningWitness?: string[];
  plannedBlockers?: { x: number; y: number }[];
}

/**
 * World packet container. Allows bundling an entire world or batch (e.g. 10 levels)
 * with shared world metadata, so individual levels can inherit themeId and replacesLegacy.
 */
export interface AuthoredWorldPacket {
  worldId?: string;
  world?: number | string;
  worldTitle?: string;
  themeId?: string;
  theme?: string;
  replacesLegacy?: boolean;
  levels: AuthoredLevel[];
}

/** Raw JSON format accepted by the loader. */
export type AuthoredInput = AuthoredLevel | AuthoredLevel[] | AuthoredWorldPacket;

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationDiagnostic {
  code: string;
  severity: ValidationSeverity;
  message: string;
  field?: string;
}

export interface LevelValidationResult {
  levelId: number;
  title: string;
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  definition: LevelDefinition | null;
  witnessLength?: number;
  width?: number;
  height?: number;
}

export interface BatchValidationSummary {
  total: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  results: LevelValidationResult[];
}

export type AntiSpamStatus = 'tutorial' | 'spam-resistant' | 'moderate' | 'vulnerable';

export interface AntiSpamAssessment {
  status: AntiSpamStatus;
  riskScore: number; // 0 (spam-proof) to 100 (high spam vulnerability)
  riskFlags: string[];
  recommendations: string[];
}

export interface LevelAnalysisReport {
  id: number;
  title: string;
  themeId: string;
  gridDimensions: string;
  pixelCount: number;
  colorCount: number;
  totalTunnelDepth: number;
  authoredDifficulty: LevelDifficulty;
  calculatedDifficulty: LevelDifficulty;
  difficultyScore: number;
  difficultyMismatch: boolean;
  minWinningHoldingPeak: number;
  maxHoldingObserved: number;
  requiredHeldLaunches: number;
  viableFirstMoves: number;
  totalFirstMoves: number;
  lossProbability: number;
  failPathLength: number | null;
  solvable: boolean;
  replaysSuccessfully: boolean;
  antiSpam: AntiSpamAssessment;
  /** Deterministic round-robin naive-policy outcome (M5.6E). Separate from the heuristic antiSpam score. */
  naiveSpamOutcome: 'won' | 'lost' | 'deadlocked' | 'step-cap';
  naiveSpamSteps: number;
  density: number;
  uniqueColors: number;
  maxLayerDepth: number;
  warnings: string[];
}
