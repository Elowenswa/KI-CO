import type { MemorySnippet } from "../types";

export type TopicGateDecision = "reuse" | "supplement" | "refresh";
export type RagAction = "none" | "reuse" | "supplement" | "refresh";
export type TopicRelation = "same" | "related" | "changed";

export interface TopicMemorySet {
  id: string;
  cacheScope: string;
  snippets: MemorySnippet[];
  memoryIds: string[];
  topicFingerprint: string[];
  lastMeaningfulQuery: string;
  turnCount: number;
  supplementCount: number;
  lastSupplementTurn?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TopicGateResult {
  decision: TopicGateDecision;
  ragAction: RagAction;
  relation: TopicRelation;
  reason: string;
  confidence: "high" | "medium" | "low";
  matchedRules: string[];
  winningRule: string;
  topicFingerprint: string[];
  currentStrongTokens: string[];
  noRagReason?: string;
  reuseReason?: string;
  supplementReason?: string;
  refreshReason?: string;
  ragSkippedBecauseLowSemantic?: boolean;
  ragSkippedBecauseIntimateContinuation?: boolean;
  ragReusedBecauseTaskContinuation?: boolean;
  supplementSkippedReason?: string;
  supplementCooldownRemaining?: number;
}

const TOPIC_MEMORY_SET_LIMIT = 32;
const TOPIC_MEMORY_REUSE_TURNS = 12;
const TOPIC_MEMORY_SUPPLEMENT_LIMIT = 3;
const TOPIC_MEMORY_SUPPLEMENT_COOLDOWN_TURNS = 3;
const topicMemorySetsByScope = new Map<string, TopicMemorySet>();

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "this", "that", "what", "why", "how", "can", "you", "me",
  "wo", "ni", "ta", "de", "le", "la", "ma", "ba", "ne", "a", "o", "en", "ok",
]);

const TECH_OR_TASK_PATTERN = /rag|cache|cached|prompt|token|api|glm|gpt|claude|opus|deepseek|openai|openrouter|embedding|vector|obsidian|indexeddb|localstorage|netlify|electron|debug|topic|gate|memory|backup|restore|import|export|html|css|ui|ux|vite|github|\u7f13\u5b58|\u547d\u4e2d|\u8bb0\u5fc6|\u8bb0\u5fc6\u5e93|\u65e5\u8bb0|\u65f6\u5149\u56de\u5eca|\u72b6\u6001\u5361|\u751f\u6d3b\u7ebf|\u5411\u91cf|\u7d22\u5f15|\u53ec\u56de|\u6ce8\u5165|\u8c03\u97f3\u53f0|\u5c0f\u5c4b|\u5907\u4efd|\u5bfc\u5165|\u5bfc\u51fa|\u5f00\u6e90|\u539f\u7248|\u7a97\u53e3/i;
const MEMORY_REQUEST_PATTERN = /\u8fd8\u8bb0\u5f97|\u8bb0\u5f97|\u8bb0\u4e0d\u8bb0\u5f97|\u4e4b\u524d|\u4ee5\u524d|\u4e0a\u6b21|\u90a3\u6b21|\u90a3\u7bc7|\u90a3\u6bb5|\u5f53\u521d|\u5f53\u65f6|\u90a3\u65f6\u5019|\u90a3\u4f1a\u513f|\u6700\u5f00\u59cb|\u4e00\u5f00\u59cb|\u66fe\u7ecf|\u65e9\u4e9b\u65f6\u5019|\u56de\u5fc6|\u5e2e\u6211\u627e|\u627e\u56de|\u627e\u4e00\u4e0b|\u7ffb\u4e00\u4e0b|\u65e7\u7a97\u53e3|remember|last time|previous|earlier|back then|at the time|originally/i;
const HISTORICAL_MEMORY_CUE_PATTERN = /\u5f53\u521d|\u5f53\u65f6|\u90a3\u65f6\u5019|\u90a3\u4f1a\u513f|\u6700\u5f00\u59cb|\u4e00\u5f00\u59cb|\u66fe\u7ecf|\u65e9\u4e9b\u65f6\u5019|back then|at the time|originally/i;
const DIRECT_MEMORY_ANCHOR_PATTERN = /(?:[a-z][a-z0-9_-]{2,}.*(?:\u90a3\u4e8b|\u90a3\u4ef6\u4e8b|\u4e8b\u60c5|\u4e8b\u4ef6|\u95ee\u9898|thing|issue|case))|(?:[\p{Script=Han}a-z0-9_-]{2,}(?:\u7eaa\u5143|\u8ba1\u5212|\u9879\u76ee|\u4e8b\u4ef6|\u4e8b\u60c5|\u90a3\u4e8b|\u90a3\u4ef6\u4e8b|\u8bbe\u5b9a|\u62a5\u4ef7|\u7a97\u53e3|\u65e5\u8bb0|\u8bb0\u5fc6|\u5c0f\u5c4b|\u7f13\u5b58|\u53ec\u56de|\u7d22\u5f15|\u5b89\u5168|safety))/iu;
const TOPIC_SHIFT_PATTERN = /\u5bf9\u4e86|\u53e6\u5916|\u6362\u4e2a\u8bdd\u9898|\u6362\u4e2a\u95ee\u9898|\u8bf4\u56de|\u56de\u5230|\u5148\u4e0d\u8bf4|\u8fd8\u6709\u4e2a\u95ee\u9898|\u6211\u7a81\u7136\u60f3\u5230|\u8bdd\u8bf4\u56de\u6765|\u8bf4\u4ef6\u4e8b|by the way|speaking of|back to/i;
const CONTINUATION_PATTERN = /\u7ee7\u7eed|\u63a5\u7740|\u521a\u624d|\u521a\u521a|\u8fd9\u4e2a|\u90a3\u4e2a|\u8fd9\u91cc|\u90a3\u91cc|\u4e0a\u9762|\u4e0b\u9762|\u6240\u4ee5|\u7136\u540e|\u4e3a\u4ec0\u4e48|\u600e\u4e48|\u54ea\u4e2a|\u4e0d\u662f|\u5bf9\u4e86|continue|same|above|that|this|then|so/i;
const INTIMATE_CONTINUATION_PATTERN = /\u4eb2\u4eb2|\u62b1\u62b1|\u62b1\u6211|\u54c4\u6211|\u4e0d\u60f3\u7761|\u665a\u5b89|\u60f3\u4f60|\u8001\u516c|\u8001\u5a46|kiss|hug|sleep/i;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function addHanNgrams(tokens: string[], value: string) {
  const source = value.replace(/\s+/g, "");
  if (!source) return;
  if (source.length <= 8) tokens.push(source);
  for (let size = 2; size <= 4; size += 1) {
    if (source.length < size) continue;
    for (let index = 0; index <= source.length - size; index += 1) {
      tokens.push(source.slice(index, index + size));
    }
  }
}

export function extractTopicTokens(text: string, limit = 28): string[] {
  const normalized = String(text || "").normalize("NFKC").toLowerCase();
  const tokens: string[] = [];
  const parts = normalized.match(/[\p{Script=Han}]+|[a-z0-9][a-z0-9_-]{1,}/gu) || [];
  for (const part of parts) {
    if (/^[\p{Script=Han}]+$/u.test(part)) {
      addHanNgrams(tokens, part);
    } else if (!STOP_WORDS.has(part) && part.length >= 2) {
      tokens.push(part);
    }
  }
  return unique(tokens).slice(0, limit);
}

function snippetFingerprint(snippets: MemorySnippet[]): string[] {
  return extractTopicTokens(
    snippets
      .slice(0, 8)
      .map((snippet) => `${snippet.title}\n${snippet.text.slice(0, 240)}`)
      .join("\n\n"),
    40,
  );
}

function overlap(left: string[], right: string[]): { count: number; ratio: number } {
  if (!left.length || !right.length) return { count: 0, ratio: 0 };
  const rightSet = new Set(right);
  const count = left.filter((item) => rightSet.has(item)).length;
  return { count, ratio: count / Math.max(1, Math.min(left.length, right.length)) };
}

export function getTopicMemorySet(scope: string): TopicMemorySet | undefined {
  return topicMemorySetsByScope.get(scope);
}

export function clearTopicMemorySet(scope: string) {
  topicMemorySetsByScope.delete(scope);
}

export function topicMemorySetHash(set?: TopicMemorySet): string {
  if (!set) return "";
  return hashText(set.memoryIds.join("|"));
}

export function evaluateTopicGate(
  scope: string,
  query: string,
  options: {
    recallGatePassed: boolean;
    hasAttachments?: boolean;
  },
): TopicGateResult {
  const existing = getTopicMemorySet(scope);
  const currentStrongTokens = extractTopicTokens(query);
  const existingFingerprint = existing?.topicFingerprint || [];
  const effectiveOverlap = overlap(currentStrongTokens, existingFingerprint);
  const matchedRules: string[] = [];
  const isDirectMemoryAnchor = DIRECT_MEMORY_ANCHOR_PATTERN.test(query);
  const isMemoryRequest = MEMORY_REQUEST_PATTERN.test(query) || isDirectMemoryAnchor;
  const isHistoricalMemoryCue = HISTORICAL_MEMORY_CUE_PATTERN.test(query);
  const isTaskLike = TECH_OR_TASK_PATTERN.test(query);
  const isContinuation = CONTINUATION_PATTERN.test(query);
  const isIntimateContinuation = INTIMATE_CONTINUATION_PATTERN.test(query);
  const isTopicShift = TOPIC_SHIFT_PATTERN.test(query) && !(isIntimateContinuation && !isTaskLike && !isMemoryRequest);
  const isLowSemantic = !options.recallGatePassed && !options.hasAttachments;

  if (isLowSemantic) matchedRules.push("low_semantic_reply");
  if (isMemoryRequest) matchedRules.push("specific_memory_request");
  if (isHistoricalMemoryCue) matchedRules.push("historical_memory_cue");
  if (isDirectMemoryAnchor) matchedRules.push("direct_memory_anchor");
  if (isTopicShift) matchedRules.push("topic_shift_signal");
  if (isTaskLike) matchedRules.push("task_or_project_terms");
  if (isContinuation) matchedRules.push("conversational_continuation");
  if (isIntimateContinuation) matchedRules.push("intimate_continuation");
  if (effectiveOverlap.count > 0) matchedRules.push("effective_overlap");

  if (isLowSemantic && !isMemoryRequest && !isTopicShift) {
    const reason = existing
      ? "low_semantic_continuation_without_rag"
      : "conversational_continuation_without_existing_set";
    return {
      decision: "reuse",
      ragAction: "none",
      relation: "same",
      reason,
      confidence: existing ? "high" : "medium",
      matchedRules,
      winningRule: "low_semantic_reply",
      topicFingerprint: existingFingerprint,
      currentStrongTokens,
      noRagReason: reason,
      ragSkippedBecauseLowSemantic: true,
      ragSkippedBecauseIntimateContinuation: isIntimateContinuation,
    };
  }

  if (!existing) {
    return {
      decision: "refresh",
      ragAction: "refresh",
      relation: "changed",
      reason: "no_existing_topic",
      confidence: "medium",
      matchedRules,
      winningRule: "no_existing_topic",
      topicFingerprint: currentStrongTokens,
      currentStrongTokens,
      refreshReason: "no_existing_topic",
    };
  }

  if (isMemoryRequest) {
    if (effectiveOverlap.count >= 2) {
      return {
        decision: "supplement",
        ragAction: "supplement",
        relation: "related",
        reason: "specific_memory_request_same_topic",
        confidence: "high",
        matchedRules,
        winningRule: "specific_memory_request",
        topicFingerprint: unique([...existingFingerprint, ...currentStrongTokens]).slice(0, 40),
        currentStrongTokens,
        supplementReason: "specific_memory_request_same_topic",
      };
    }
    return {
      decision: "refresh",
      ragAction: "refresh",
      relation: "changed",
      reason: "specific_memory_request_refresh",
      confidence: "high",
      matchedRules,
      winningRule: "specific_memory_request",
      topicFingerprint: currentStrongTokens,
      currentStrongTokens,
      refreshReason: "specific_memory_request_refresh",
    };
  }

  if (isTopicShift) {
    if (effectiveOverlap.count > 0) {
      return {
        decision: "supplement",
        ragAction: "supplement",
        relation: "related",
        reason: "topic_shift_with_overlap",
        confidence: "high",
        matchedRules,
        winningRule: "topic_shift_signal",
        topicFingerprint: unique([...existingFingerprint, ...currentStrongTokens]).slice(0, 40),
        currentStrongTokens,
        supplementReason: "topic_shift_with_overlap",
      };
    }
    return {
      decision: "refresh",
      ragAction: "refresh",
      relation: "changed",
      reason: "topic_shift_new_topic",
      confidence: "high",
      matchedRules,
      winningRule: "topic_shift_signal",
      topicFingerprint: currentStrongTokens,
      currentStrongTokens,
      refreshReason: "topic_shift_new_topic",
    };
  }

  if ((isTaskLike || isContinuation) && (effectiveOverlap.count > 0 || existing.turnCount < 3)) {
    const reason = isTaskLike ? "task_continuation" : "conversational_continuation";
    return {
      decision: "reuse",
      ragAction: "reuse",
      relation: "same",
      reason,
      confidence: effectiveOverlap.count >= 2 ? "high" : "medium",
      matchedRules,
      winningRule: reason,
      topicFingerprint: existingFingerprint,
      currentStrongTokens,
      reuseReason: reason,
      ragReusedBecauseTaskContinuation: isTaskLike,
    };
  }

  if (effectiveOverlap.count >= 2 || effectiveOverlap.ratio >= 0.22) {
    return {
      decision: "reuse",
      ragAction: "reuse",
      relation: "same",
      reason: "effective_overlap",
      confidence: "high",
      matchedRules,
      winningRule: "effective_overlap",
      topicFingerprint: existingFingerprint,
      currentStrongTokens,
      reuseReason: "effective_overlap",
    };
  }

  const supplementCooldownRemaining = existing.lastSupplementTurn
    ? Math.max(0, existing.lastSupplementTurn + TOPIC_MEMORY_SUPPLEMENT_COOLDOWN_TURNS - existing.turnCount)
    : 0;
  const supplementLimitReached = existing.supplementCount >= TOPIC_MEMORY_SUPPLEMENT_LIMIT;
  const shouldThrottleSupplement = supplementLimitReached || supplementCooldownRemaining > 0;
  const supplementThrottleReason = supplementLimitReached
    ? `supplement_limit_${TOPIC_MEMORY_SUPPLEMENT_LIMIT}`
    : `supplement_cooldown_${supplementCooldownRemaining}`;

  if (isTaskLike || isContinuation || effectiveOverlap.count === 1) {
    if (shouldThrottleSupplement) {
      return {
        decision: "reuse",
        ragAction: "reuse",
        relation: "same",
        reason: `${supplementThrottleReason}:same_topic_new_branch`,
        confidence: "medium",
        matchedRules: unique([...matchedRules, "supplement_throttle"]),
        winningRule: "supplement_throttle_reuse",
        topicFingerprint: existingFingerprint,
        currentStrongTokens,
        reuseReason: `${supplementThrottleReason}:same_topic_new_branch`,
        supplementSkippedReason: supplementThrottleReason,
        supplementCooldownRemaining,
        ragReusedBecauseTaskContinuation: isTaskLike,
      };
    }
    return {
      decision: "supplement",
      ragAction: "supplement",
      relation: "related",
      reason: "same_topic_new_branch",
      confidence: "medium",
      matchedRules,
      winningRule: "same_topic_new_branch",
      topicFingerprint: unique([...existingFingerprint, ...currentStrongTokens]).slice(0, 40),
      currentStrongTokens,
      supplementReason: "same_topic_new_branch",
    };
  }

  if (existing.turnCount >= TOPIC_MEMORY_REUSE_TURNS) {
    if (shouldThrottleSupplement) {
      return {
        decision: "reuse",
        ragAction: "reuse",
        relation: "same",
        reason: `${supplementThrottleReason}:reuse_turn_limit_soft_refresh`,
        confidence: "low",
        matchedRules: unique([...matchedRules, "reuse_turn_limit", "supplement_throttle"]),
        winningRule: "supplement_throttle_reuse",
        topicFingerprint: existingFingerprint,
        currentStrongTokens,
        reuseReason: `${supplementThrottleReason}:reuse_turn_limit_soft_refresh`,
        supplementSkippedReason: supplementThrottleReason,
        supplementCooldownRemaining,
      };
    }
    return {
      decision: "supplement",
      ragAction: "supplement",
      relation: "related",
      reason: "reuse_turn_limit_soft_refresh",
      confidence: "low",
      matchedRules: unique([...matchedRules, "reuse_turn_limit"]),
      winningRule: "reuse_turn_limit",
      topicFingerprint: existingFingerprint,
      currentStrongTokens,
      supplementReason: "reuse_turn_limit_soft_refresh",
    };
  }

  return {
    decision: "refresh",
    ragAction: "refresh",
    relation: "changed",
    reason: "new_topic_signal",
    confidence: "medium",
    matchedRules,
    winningRule: "new_topic_signal",
    topicFingerprint: currentStrongTokens,
    currentStrongTokens,
    refreshReason: "new_topic_signal",
  };
}

export function commitTopicMemorySet(
  scope: string,
  query: string,
  snippets: MemorySnippet[],
  gate: TopicGateResult,
): TopicMemorySet | undefined {
  const existing = getTopicMemorySet(scope);
  if (gate.ragAction === "none") return existing;

  const now = Date.now();
  const merged = gate.decision === "supplement" && existing
    ? [...existing.snippets, ...snippets.filter((snippet) => !existing.memoryIds.includes(snippet.id))]
    : snippets;
  const deduped = merged.filter((snippet, index, list) => list.findIndex((item) => item.id === snippet.id) === index).slice(0, 8);
  const mergedNewCount = Math.max(0, deduped.length - (existing?.memoryIds.length || 0));
  if (!deduped.length) {
    if (gate.decision === "refresh") topicMemorySetsByScope.delete(scope);
    return gate.decision === "refresh" ? undefined : existing;
  }

  const set: TopicMemorySet = {
    id: existing?.id || `topic-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    cacheScope: scope,
    snippets: deduped,
    memoryIds: deduped.map((snippet) => snippet.id),
    topicFingerprint: unique([
      ...extractTopicTokens(query, 24),
      ...snippetFingerprint(deduped),
      ...(gate.decision === "supplement" ? existing?.topicFingerprint || [] : []),
    ]).slice(0, 40),
    lastMeaningfulQuery: query,
    turnCount: gate.decision === "refresh" ? 0 : (existing?.turnCount || 0) + 1,
    supplementCount: gate.decision === "supplement"
      ? (existing?.supplementCount || 0) + mergedNewCount
      : gate.decision === "refresh"
        ? 0
        : existing?.supplementCount || 0,
    lastSupplementTurn: gate.decision === "supplement" && mergedNewCount > 0
      ? (existing?.turnCount || 0) + 1
      : existing?.lastSupplementTurn,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  topicMemorySetsByScope.delete(scope);
  topicMemorySetsByScope.set(scope, set);
  if (topicMemorySetsByScope.size > TOPIC_MEMORY_SET_LIMIT) {
    const oldestScope = topicMemorySetsByScope.keys().next().value;
    if (oldestScope) topicMemorySetsByScope.delete(oldestScope);
  }
  return set;
}
