/**
 * Discovery-reveal validation. Pure, centralised. Structural-integrity problems
 * (a line pointing at a missing node, a self-line, a duplicate line, an accent
 * pointing at a missing node) are errors — the reveal renderer's `validAuthored`
 * guard would reject the whole reveal. Cosmetic issues (no name, a far-out node,
 * two nodes on the same point, too few nodes) are warnings.
 */
import type { StudioLevel, ValidationIssue } from './types';

/** How far outside the grid a reveal node may sit before it is suspicious. */
const NODE_MARGIN = 3;

export function checkReveal(level: StudioLevel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = level.reveal;
  if (!r) return issues;

  const err = (code: string, message: string, part: 'name' | 'node' | 'line' | 'accent', index?: number) =>
    issues.push({ code, severity: 'error', message, where: { kind: 'reveal', part, ...(index !== undefined ? { index } : {}) } });
  const warn = (code: string, message: string, part: 'name' | 'node' | 'line' | 'accent', index?: number) =>
    issues.push({ code, severity: 'warning', message, where: { kind: 'reveal', part, ...(index !== undefined ? { index } : {}) } });

  if (r.name.trim() === '') warn('reveal/name', 'The reveal has no discovery name.', 'name');
  if (r.nodes.length < 2) {
    warn('reveal/too-few-nodes', `The reveal has ${r.nodes.length} node(s); the renderer needs ≥ 2 or it falls back.`, 'node');
  }

  // Duplicate node positions (geometrically redundant, not fatal).
  for (let i = 0; i < r.nodes.length; i += 1) {
    for (let j = i + 1; j < r.nodes.length; j += 1) {
      if (r.nodes[i]!.x === r.nodes[j]!.x && r.nodes[i]!.y === r.nodes[j]!.y) {
        warn('reveal/dup-node', `Nodes ${i} and ${j} are at the same point (${r.nodes[i]!.x}, ${r.nodes[i]!.y}).`, 'node', j);
      }
    }
    const n = r.nodes[i]!;
    if (n.x < -NODE_MARGIN || n.y < -NODE_MARGIN || n.x > level.width + NODE_MARGIN || n.y > level.height + NODE_MARGIN) {
      warn('reveal/node-oob', `Node ${i} at (${n.x}, ${n.y}) is well outside the ${level.width}×${level.height} grid.`, 'node', i);
    }
  }

  // Lines.
  const seen = new Set<string>();
  r.lines.forEach(([a, b], i) => {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= r.nodes.length || b >= r.nodes.length) {
      err('reveal/line-ref', `Line ${i} references a node that does not exist ([${a}, ${b}]; ${r.nodes.length} nodes).`, 'line', i);
      return;
    }
    if (a === b) {
      err('reveal/self-line', `Line ${i} joins node ${a} to itself.`, 'line', i);
      return;
    }
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) err('reveal/dup-line', `Line ${i} duplicates an earlier line between nodes ${a} and ${b}.`, 'line', i);
    seen.add(key);
  });
  if (r.nodes.length >= 2 && r.lines.length === 0) {
    warn('reveal/no-lines', 'The reveal has nodes but no lines connecting them.', 'line');
  }

  // Accents.
  (r.accentNodes ?? []).forEach((idx, i) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= r.nodes.length) {
      err('reveal/accent-ref', `Accent ${i} points at node ${idx}, which does not exist.`, 'accent', i);
    }
  });

  return issues;
}
