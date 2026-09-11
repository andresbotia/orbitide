import { CAMPAIGN_MANIFEST } from '../campaign';
import { currentWorldId, levelSlotState, summarizeWorlds } from '../campaignProgress';
import { FIRST_LEVEL, TOTAL_LEVELS } from '../levels';

describe('levelSlotState', () => {
  it('classifies locked / current / complete around highestUnlockedLevel', () => {
    const progress = { highestUnlockedLevel: 5 };
    expect(levelSlotState(progress, 1)).toBe('complete');
    expect(levelSlotState(progress, 4)).toBe('complete');
    expect(levelSlotState(progress, 5)).toBe('current');
    expect(levelSlotState(progress, 6)).toBe('locked');
  });
});

describe('summarizeWorlds', () => {
  it('marks every world locked except the first for a fresh profile', () => {
    const progress = { highestUnlockedLevel: FIRST_LEVEL };
    const summaries = summarizeWorlds(CAMPAIGN_MANIFEST, progress);
    expect(summaries[0]!.state).toBe('active');
    expect(summaries[0]!.completedCount).toBe(0);
    for (const s of summaries.slice(1)) {
      expect(s.state).toBe('locked');
    }
  });

  it('assigns 1-based displayIndex in campaign order', () => {
    const summaries = summarizeWorlds(CAMPAIGN_MANIFEST, { highestUnlockedLevel: FIRST_LEVEL });
    summaries.forEach((s, i) => expect(s.displayIndex).toBe(i + 1));
  });

  it('marks a world complete once every one of its levels has been surpassed', () => {
    const firstWorld = CAMPAIGN_MANIFEST.worlds[0]!;
    const lastLevelOfFirstWorld = firstWorld.levelIds[firstWorld.levelIds.length - 1]!;
    const progress = { highestUnlockedLevel: lastLevelOfFirstWorld + 1 };
    const summaries = summarizeWorlds(CAMPAIGN_MANIFEST, progress);
    expect(summaries[0]!.state).toBe('complete');
    expect(summaries[0]!.completedCount).toBe(summaries[0]!.totalCount);
  });

  it('never marks the world containing the final campaign level complete (highestUnlockedLevel caps)', () => {
    const progress = { highestUnlockedLevel: TOTAL_LEVELS };
    const summaries = summarizeWorlds(CAMPAIGN_MANIFEST, progress);
    const last = summaries[summaries.length - 1]!;
    expect(last.state).toBe('active');
  });
});

describe('currentWorldId', () => {
  it('finds the world containing the next-to-play level', () => {
    const secondWorld = CAMPAIGN_MANIFEST.worlds[1]!;
    const progress = { highestUnlockedLevel: secondWorld.levelIds[0]! };
    expect(currentWorldId(CAMPAIGN_MANIFEST, progress)).toBe(secondWorld.id);
  });
});
