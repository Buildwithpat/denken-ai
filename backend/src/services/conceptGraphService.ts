/**
 * Concept Graph Service — makes the ConceptGraph model actively useful.
 *
 * Provides:
 *  - Concept mastery maps (derived from topic weights via fuzzy matching)
 *  - Prerequisite chain traversal (DFS)
 *  - Root-cause weakness detection (which gaps block the most downstream concepts)
 *  - Unlockable concept discovery (prerequisites met, concept itself weak)
 *  - Topological learning sequence for a subject
 */

import ConceptGraph from '../models/ConceptGraph';
import type { IConceptNodeDocument } from '../models/ConceptGraph';
import type { TopicWeight } from '../types';
import type { IMistakePatternDocument } from '../models/MistakePattern';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConceptMasteryEntry {
  conceptId:                string;
  name:                     string;
  subject:                  string;
  chapter:                  string;
  topic:                    string;
  mastery:                  number;    // 0–100 derived from topic weights
  retention:                number;    // 0–100
  isPrerequisiteSatisfied:  boolean;
  prerequisiteIds:          string[];
  enablesIds:               string[];
  formulaLinks:             string[];
  estimatedStudyMinutes:    number;
  difficulty:               'foundational' | 'intermediate' | 'advanced';
}

export interface RootCauseGap {
  conceptId:        string;
  name:             string;
  subject:          string;
  chapter:          string;
  gapSeverity:      'critical' | 'moderate' | 'minor';
  affectedConcepts: string[];   // concept names blocked by this gap
  formulaLinks:     string[];
  mistakeTypes:     string[];
}

export interface LearningPath {
  conceptSequence:       ConceptMasteryEntry[];
  estimatedTotalMinutes: number;
  unlockableNow:         string[];   // conceptIds ready to learn
  blockedByGaps:         string[];   // conceptIds blocked by unmet prerequisites
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Fuzzy match concept topic/chapter to a topic-weight key. */
function matchTopicWeight(
  concept: IConceptNodeDocument,
  topicWeights: Map<string, TopicWeight>,
): TopicWeight | undefined {
  // 1. Exact topic match
  if (topicWeights.has(concept.topic)) return topicWeights.get(concept.topic);
  // 2. Exact chapter match
  if (topicWeights.has(concept.chapter)) return topicWeights.get(concept.chapter);
  // 3. Prefix/substring match (first 10 chars of topic)
  const prefix = concept.topic.toLowerCase().slice(0, 10);
  for (const [key, tw] of topicWeights) {
    if (key.toLowerCase().includes(prefix) || prefix.includes(key.toLowerCase().slice(0, 6))) {
      return tw;
    }
  }
  return undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a mastery map for all active concepts.
 * Mastery is derived by fuzzy-matching concept topic to topicWeights.
 * Prerequisites are resolved in order so isPrerequisiteSatisfied can be computed
 * accurately for the entire graph in a single pass.
 */
export async function buildConceptMasteryMap(
  topicWeights: Map<string, TopicWeight>,
  subject?: string,
): Promise<Map<string, ConceptMasteryEntry>> {
  const query: Record<string, unknown> = { isActive: true };
  if (subject) query['subject'] = subject;

  const concepts = await ConceptGraph.find(query).lean<IConceptNodeDocument[]>();
  const masteryMap = new Map<string, ConceptMasteryEntry>();

  // First pass: compute individual mastery (prerequisite satisfaction resolved in second pass)
  for (const c of concepts) {
    const tw        = matchTopicWeight(c, topicWeights);
    const mastery   = tw?.masteryScore   ?? 0;
    const retention = tw?.retentionScore ?? 0;

    masteryMap.set(c.conceptId, {
      conceptId:               c.conceptId,
      name:                    c.name,
      subject:                 c.subject,
      chapter:                 c.chapter,
      topic:                   c.topic,
      mastery,
      retention,
      isPrerequisiteSatisfied: false, // resolved below
      prerequisiteIds:         c.prerequisites ?? [],
      enablesIds:              c.enables ?? [],
      formulaLinks:            c.formulaLinks ?? [],
      estimatedStudyMinutes:   c.estimatedStudyMinutes ?? 30,
      difficulty:              c.difficulty,
    });
  }

  // Second pass: resolve prerequisite satisfaction (unknown prereqs treated as satisfied)
  for (const entry of masteryMap.values()) {
    entry.isPrerequisiteSatisfied = entry.prerequisiteIds.every((prereqId) => {
      const prereq = masteryMap.get(prereqId);
      return prereq ? prereq.mastery >= 50 : true;
    });
  }

  return masteryMap;
}

/**
 * DFS prerequisite chain traversal from a single concept upward.
 * Returns conceptIds in learning order (prerequisites first, excluding the start node).
 */
export async function getPrerequisiteChain(conceptId: string): Promise<string[]> {
  const visited = new Set<string>();
  const chain: string[] = [];

  async function dfs(id: string): Promise<void> {
    if (visited.has(id)) return;
    visited.add(id);
    const concept = await ConceptGraph.findOne({ conceptId: id, isActive: true }).lean<IConceptNodeDocument>();
    if (!concept) return;
    for (const prereqId of concept.prerequisites ?? []) {
      await dfs(prereqId);
    }
    chain.push(id);
  }

  await dfs(conceptId);
  return chain.slice(0, -1); // exclude the concept itself
}

/**
 * Find root-cause gaps: weak concepts that block the most downstream concepts.
 * These are the highest-leverage fixes — resolving one unlocks many others.
 */
export function detectRootCauseGaps(
  masteryMap:      Map<string, ConceptMasteryEntry>,
  mistakePatterns: IMistakePatternDocument[],
): RootCauseGap[] {
  const gaps: RootCauseGap[] = [];

  for (const [id, entry] of masteryMap) {
    if (entry.mastery >= 60) continue;

    // How many downstream concepts are blocked because prerequisites include this concept?
    const affectedConcepts = [...masteryMap.values()]
      .filter(c => c.prerequisiteIds.includes(id) && c.mastery < 50)
      .map(c => c.name);

    // Skip minor gaps with no downstream impact
    if (affectedConcepts.length === 0 && entry.mastery >= 45) continue;

    const severity: 'critical' | 'moderate' | 'minor' =
      entry.mastery < 25 ? 'critical' :
      entry.mastery < 45 ? 'moderate' :
      'minor';

    // Match mistake patterns for this concept's topic/chapter
    const matchingMistakeTypes = mistakePatterns
      .filter(m =>
        m.topic.toLowerCase().includes(entry.topic.toLowerCase().slice(0, 8)) ||
        entry.chapter.toLowerCase().includes(m.topic.toLowerCase().slice(0, 8))
      )
      .map(m => m.dominantType)
      .filter(Boolean);

    gaps.push({
      conceptId:        id,
      name:             entry.name,
      subject:          entry.subject,
      chapter:          entry.chapter,
      gapSeverity:      severity,
      affectedConcepts: affectedConcepts.slice(0, 5),
      formulaLinks:     entry.formulaLinks.slice(0, 3),
      mistakeTypes:     [...new Set(matchingMistakeTypes)],
    });
  }

  return gaps
    .sort((a, b) => {
      const order = { critical: 0, moderate: 1, minor: 2 };
      const byGap = order[a.gapSeverity] - order[b.gapSeverity];
      return byGap !== 0 ? byGap : b.affectedConcepts.length - a.affectedConcepts.length;
    })
    .slice(0, 15);
}

/**
 * Return concepts that are ready to learn now:
 * all prerequisites satisfied, but mastery still below 60.
 * These are the highest-ROI learning opportunities.
 */
export function getUnlockableConcepts(
  masteryMap: Map<string, ConceptMasteryEntry>,
): ConceptMasteryEntry[] {
  return [...masteryMap.values()]
    .filter(c => c.isPrerequisiteSatisfied && c.mastery < 60)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 10);
}

/**
 * Compute an optimal learning sequence for a subject using topological sort
 * (Kahn's algorithm), with weakest concepts prioritised within each tier.
 */
export function getLearningSequence(
  subject:    string,
  masteryMap: Map<string, ConceptMasteryEntry>,
): LearningPath {
  const concepts = [...masteryMap.values()].filter(c => c.subject === subject);

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const c of concepts) inDegree.set(c.conceptId, c.prerequisiteIds.length);

  // Priority queue: foundational concepts first, weakest mastery first within tier
  let queue = concepts
    .filter(c => (inDegree.get(c.conceptId) ?? 0) === 0)
    .sort((a, b) => a.mastery - b.mastery);

  const sequence: ConceptMasteryEntry[] = [];
  const visited  = new Set<string>();

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (visited.has(next.conceptId)) continue;
    visited.add(next.conceptId);
    sequence.push(next);

    // Unlock dependents whose prerequisites are all now visited
    for (const enabledId of next.enablesIds) {
      const enabled = masteryMap.get(enabledId);
      if (!enabled || visited.has(enabledId)) continue;
      const allPrereqsDone = enabled.prerequisiteIds.every(p => visited.has(p));
      if (allPrereqsDone) {
        queue.push(enabled);
        queue = queue.sort((a, b) => a.mastery - b.mastery);
      }
    }
  }

  return {
    conceptSequence:       sequence.slice(0, 20),
    estimatedTotalMinutes: sequence.reduce((s, c) => s + c.estimatedStudyMinutes, 0),
    unlockableNow:         concepts.filter(c => c.isPrerequisiteSatisfied && c.mastery < 60).map(c => c.conceptId),
    blockedByGaps:         concepts.filter(c => !c.isPrerequisiteSatisfied).map(c => c.conceptId),
  };
}
