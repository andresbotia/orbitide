import { createGame } from '../../engine/createGame';
import { analyzeLevel } from '../../studio/analysis/analyzeLevel';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';

const report = process.env.REPORT_M4C ? test : test.skip;
const campaignReport = process.env.REPORT_CAMPAIGN ? test : test.skip;

report('prints the reproducible L61–100 analysis artifact', async () => {
  for (const level of LEVEL_DEFINITIONS.filter((candidate) => candidate.id >= 61)) {
    const started = Date.now();
    const analysis = await analyzeLevel(level, { nodeCap: 300_000 });
    const pixels = createGame(level).pixels;
    const modifiers = Object.values(level.modifiers ?? {});
    const groups = new Set(modifiers.filter((modifier) => modifier.kind === 'linked')
      .map((modifier) => modifier.group ?? modifier.linkId));
    console.log(JSON.stringify({
      id: level.id, title: level.title, world: level.themeId, pixels: pixels.length,
      frozen: modifiers.filter((modifier) => modifier.kind === 'frozen').length,
      shielded: modifiers.filter((modifier) => modifier.kind === 'shielded').length,
      linked: modifiers.filter((modifier) => modifier.kind === 'linked').length,
      groups: groups.size, authored: level.difficulty, suggested: analysis.suggestedDifficulty,
      score: analysis.difficultyScore, win: analysis.shortestWinningLength,
      peak: analysis.peakHoldingOnWinningLine, viable: analysis.viableFirstMoves,
      active: analysis.maxActiveOnWinningWitness, fail: analysis.failWitness?.length ?? null,
      held: analysis.heldRelaunches, nodes: analysis.exploredNodes,
      warnings: analysis.warnings.map((warning) => warning.code), ms: Date.now() - started,
    }));
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
  }
}, 900_000);

campaignReport('prints the reproducible L1-100 analysis audit', async () => {
  for (const level of LEVEL_DEFINITIONS) {
    const started = Date.now();
    const analysis = await analyzeLevel(level, { nodeCap: 300_000 });
    console.log(JSON.stringify({
      id: level.id,
      authored: level.difficulty,
      suggested: analysis.suggestedDifficulty,
      nodes: analysis.exploredNodes,
      solvable: analysis.solvable,
      complete: analysis.complete,
      ms: Date.now() - started,
    }));
    expect(analysis.complete).toBe(true);
    expect(analysis.solvable).toBe(true);
  }
}, 1_800_000);
