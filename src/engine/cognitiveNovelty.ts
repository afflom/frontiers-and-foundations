import type { StoryEdge, StoryNode } from './verdantModel';

export interface StoryVerificationReport {
  deadlockFree: boolean;
  reachableFromOrigin: string[];
  unreachableNodes: string[];
  deadEndNodes: string[];
  shortestPathToResolution: Record<string, number>;
  conservationNetDelta: number;
  conservationLawValid: boolean;
  diagnostic: string;
}

export interface AntiTropeAuditResult {
  verdict: 'original' | 'needs_revision';
  clicheHits: string[];
  repeatedMotifs: string[];
  distinctiveSignals: string[];
  summary: string;
}

/**
 * Tropical (min, +) shortest-path closure over the StoryAutomaton graph.
 * Proves every non-resolution node has a finite path to at least one resolution node
 * and verifies that charter + frontier entropy shifts conserve across the narrative arc.
 */
export function verifyStoryAutomaton(
  nodes: StoryNode[],
  edges: StoryEdge[],
): StoryVerificationReport {
  const nodeIds = nodes.map((n) => n.id);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const INF = 1_000_000;

  // Floyd-Warshall over tropical (min, +) semiring
  const dist = new Map<string, Map<string, number>>();
  for (const u of nodeIds) {
    const row = new Map<string, number>();
    for (const v of nodeIds) {
      row.set(v, u === v ? 0 : INF);
    }
    dist.set(u, row);
  }

  for (const edge of edges) {
    if (dist.has(edge.from) && dist.get(edge.from)!.has(edge.to)) {
      const current = dist.get(edge.from)!.get(edge.to)!;
      dist.get(edge.from)!.set(edge.to, Math.min(current, Math.max(1, edge.cost)));
    }
  }

  for (const k of nodeIds) {
    for (const i of nodeIds) {
      const dik = dist.get(i)!.get(k)!;
      if (dik >= INF) continue;
      for (const j of nodeIds) {
        const dkj = dist.get(k)!.get(j)!;
        if (dkj >= INF) continue;
        const candidate = dik + dkj;
        if (candidate < dist.get(i)!.get(j)!) {
          dist.get(i)!.set(j, candidate);
        }
      }
    }
  }

  const origins = nodes.filter((n) => n.kind === 'origin');
  const resolutions = nodes.filter((n) => n.kind === 'resolution');

  const reachableFromOrigin: string[] = [];
  const unreachableNodes: string[] = [];

  for (const id of nodeIds) {
    const reached = origins.some((o) => (dist.get(o.id)?.get(id) ?? INF) < INF);
    if (reached) {
      reachableFromOrigin.push(id);
    } else {
      unreachableNodes.push(id);
    }
  }

  const shortestPathToResolution: Record<string, number> = {};
  const deadEndNodes: string[] = [];

  for (const id of nodeIds) {
    let best = INF;
    for (const r of resolutions) {
      const d = dist.get(id)?.get(r.id) ?? INF;
      if (d < best) best = d;
    }
    if (best < INF) {
      shortestPathToResolution[id] = best;
    } else {
      deadEndNodes.push(id);
    }
  }

  // Conservation Ledger invariant: net (charterDelta + frontierEntropyDelta) across each node
  // and cumulative charter delta across the closed chronicle must equal 0.
  let conservationNetDelta = 0;
  let pairwiseValid = true;
  for (const node of nodes) {
    conservationNetDelta += node.charterDelta;
    if (node.charterDelta + node.frontierEntropyDelta !== 0) {
      pairwiseValid = false;
    }
  }
  const conservationLawValid = pairwiseValid && conservationNetDelta === 0;
  const deadlockFree =
    origins.length > 0 &&
    resolutions.length > 0 &&
    unreachableNodes.length === 0 &&
    deadEndNodes.length === 0;

  let diagnostic = 'StoryAutomaton verified: every node reaches a resolution with zero deadlocks and balanced conservation.';
  if (!deadlockFree) {
    const parts: string[] = [];
    if (unreachableNodes.length > 0) parts.push(`unreachable: ${unreachableNodes.join(', ')}`);
    if (deadEndNodes.length > 0) parts.push(`dead-end: ${deadEndNodes.join(', ')}`);
    diagnostic = `Deadlock or isolation detected (${parts.join('; ')}).`;
  } else if (!conservationLawValid) {
    diagnostic = `Graph is deadlock-free, but ConservationLedger is unbalanced (net charter delta ${conservationNetDelta}).`;
  }

  return {
    deadlockFree,
    reachableFromOrigin,
    unreachableNodes,
    deadEndNodes,
    shortestPathToResolution,
    conservationNetDelta,
    conservationLawValid,
    diagnostic,
  };
}

/**
 * Audits newly drafted or autonomously generated NPCs, quests, items, or lore
 * against banned fantasy clichés and previously used motifs to prevent repetition.
 */
export function auditAntiTropeNovelty(
  candidateText: string,
  bannedTropes: string[],
  usedMotifs: string[],
): AntiTropeAuditResult {
  const normalized = candidateText.toLowerCase();
  const clicheHits: string[] = [];
  for (const trope of bannedTropes) {
    const t = trope.trim().toLowerCase();
    if (t.length >= 4 && normalized.includes(t)) {
      clicheHits.push(trope);
    }
  }

  const repeatedMotifs: string[] = [];
  for (const motif of usedMotifs) {
    const words = motif
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    if (words.length >= 2 && words.every((w) => normalized.includes(w))) {
      repeatedMotifs.push(motif);
    }
  }

  const craftKeywords = [
    'basalt',
    'lodestone',
    'charter',
    'tide',
    'acoustic',
    'silicate',
    'survey',
    'stitch',
    'federated',
    'kiln',
    'astrolabe',
    'viaduct',
    'resonance',
    'aquifer',
    'ironwood',
  ];
  const distinctiveSignals = craftKeywords.filter((kw) => normalized.includes(kw));

  const verdict: 'original' | 'needs_revision' =
    clicheHits.length === 0 && repeatedMotifs.length === 0 ? 'original' : 'needs_revision';

  const summary =
    verdict === 'original'
      ? `Original Frontiers & Foundations voice confirmed (${distinctiveSignals.length} world-grounded craft signals, 0 clichés).`
      : `Revision advised: detected ${clicheHits.length} banned trope(s) and ${repeatedMotifs.length} repeated motif(s).`;

  return {
    verdict,
    clicheHits,
    repeatedMotifs,
    distinctiveSignals,
    summary,
  };
}
