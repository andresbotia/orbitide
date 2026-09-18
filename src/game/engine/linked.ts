import { resolveMatchingHit } from './frozen';
import type { ModifierInstance, Pixel } from './types';

export function linkedGroupId(pixel: Pick<Pixel, 'modifier'>): string | undefined {
  const modifier = pixel.modifier;
  if (modifier?.kind !== 'linked') return undefined;
  return modifier.group ?? modifier.linkId;
}

export function isLinkedPrimed(pixel: Pick<Pixel, 'cleared' | 'modifier'>): boolean {
  return !pixel.cleared && pixel.modifier?.kind === 'linked'
    && (pixel.modifier.state === 'primed' || (pixel.modifier.linkProgress ?? 0) >= 1);
}

export interface BoardHitResult {
  pixels: Pixel[];
  clearedPixelIds: string[];
  frozenBreak: boolean;
  shieldBreak: boolean;
  linkedPrime: boolean;
  linkedGroupClear: boolean;
  linkedGroupId?: string;
}

/** Resolve one matching hit against the complete board, including atomic links. */
export function resolveBoardHit(pixels: readonly Pixel[], pixelId: string): BoardHitResult {
  let index = 0;
  while (index < pixels.length && pixels[index]!.id !== pixelId) index += 1;
  const target = pixels[index];
  if (!target) throw new Error(`Cannot hit missing pixel ${pixelId}`);

  const groupId = linkedGroupId(target);
  if (groupId !== undefined) {
    const members = pixels
      .filter((pixel) => !pixel.cleared && linkedGroupId(pixel) === groupId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const primedTarget: Pixel = {
      ...target,
      modifier: {
        ...(target.modifier as ModifierInstance),
        kind: 'linked',
        group: groupId,
        linkId: groupId,
        state: 'primed',
        progress: 1,
        linkProgress: 1,
      },
    };
    const allPrimed = members.length >= 2
      && members.every((member) => member.id === pixelId || isLinkedPrimed(member));
    const memberIds = new Set(members.map((member) => member.id));
    if (allPrimed) {
      return {
        pixels: pixels.map((pixel) => memberIds.has(pixel.id)
          ? { ...(pixel.id === pixelId ? primedTarget : pixel), cleared: true }
          : pixel),
        clearedPixelIds: members.map((member) => member.id),
        frozenBreak: false,
        shieldBreak: false,
        linkedPrime: false,
        linkedGroupClear: true,
        linkedGroupId: groupId,
      };
    }
    return {
      pixels: pixels.map((pixel) => pixel.id === pixelId ? primedTarget : pixel),
      clearedPixelIds: [],
      frozenBreak: false,
      shieldBreak: false,
      linkedPrime: true,
      linkedGroupClear: false,
      linkedGroupId: groupId,
    };
  }

  const resolved = resolveMatchingHit(target);
  // Pixel ids are unique, so only `index` changes: copy the array, swap one slot.
  const next = pixels.slice();
  next[index] = resolved.pixel;
  return {
    pixels: next,
    clearedPixelIds: resolved.cleared ? [pixelId] : [],
    frozenBreak: resolved.frozenBreak,
    shieldBreak: resolved.shieldBreak,
    linkedPrime: false,
    linkedGroupClear: false,
  };
}
