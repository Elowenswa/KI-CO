import type { MemoryRetrievalSettings, MemorySnippet, UplinkSettings, VectorProvider } from "../types";
import { ensureConversationStoreReady, listConversations } from "./conversations";
import { listChronicles } from "./chronicles";

export interface LocalRetrievalCandidate {
  id: string;
  title: string;
  tags: string[];
  source: MemorySourceType;
  score: number;
  vectorScore?: number;
  localRank?: number | null;
  vectorRank?: number | null;
  fusedScoreBeforeRerank?: number;
  fusedScoreAfterRerank?: number;
  parentId?: string;
  sourceId?: string;
  content?: string;
  matchedTokens: string[];
  updatedAt: string;
  selected: boolean;
}

export interface LocalRetrievalStats {
  hits: number;
  misses: number;
  total: number;
  hitRate: number;
  cacheSize: number;
  lastCacheKey?: string;
}

export interface LocalRetrievalDebugResult {
  query: string;
  normalizedQuery: string;
  cacheKey: string;
  cacheHit: boolean;
  elapsedMs: number;
  totalEntries: number;
  candidateCount: number;
  effectiveLimit: number;
  tokens: string[];
  candidates: LocalRetrievalCandidate[];
  snippets: MemorySnippet[];
  stats: LocalRetrievalStats;
  explanation: string[];
}

export interface LatestStyleTrace {
  enabled: boolean;
  scene: string;
  pathKeyword: string;
  recallCount: number;
  injectedCount: number;
  usedChars?: number;
  skipReason?: string;
  error?: string;
  items: MemorySnippet[];
}

export interface ContextRetrievalTurn {
  id: string;
  timestamp: number;
  query: string;
  mode?: "local" | "vector" | "hybrid";
  provider?: VectorProvider;
  skipReason?: string;
  cacheHit: boolean;
  elapsedMs: number;
  totalEntries: number;
  candidateCount: number;
  retrievalLimit?: number;
  vectorTopK?: number;
  memorySnippetLimit?: number;
  vectorScoreThreshold?: number;
  tokens?: string[];
  candidates?: LocalRetrievalCandidate[];
  explanation?: string[];
  snippets: MemorySnippet[];
  estimatedTokens: number;
  sourceMix?: Record<string, number>;
  error?: string;
  topicRelation?: "same" | "related" | "changed";
  ragAction?: "none" | "reuse" | "supplement" | "refresh";
  noRagReason?: string;
  reuseReason?: string;
  supplementReason?: string;
  refreshReason?: string;
  topicMemorySetHash?: string;
  topicMemorySetRestored?: boolean;
  restoredTopicMemorySetId?: string;
  topicMemorySetRestoreReason?: string;
  topicMemorySetRestoreScore?: number;
  topicMemorySetRestoreCurrentScore?: number;
  topicMemorySetRestoreMatchedTokens?: string[];
  topicMemorySetRestoreCurrentMatchedTokens?: string[];
  topicMemorySetRestoreCoveredByCurrent?: boolean;
  topicMemorySetRestoreCandidateCount?: number;
  topicMemorySetRecentCount?: number;
  turnsSinceRefresh?: number;
  supplementCount?: number;
  reusedMemoryCount?: number;
  topicFingerprint?: string[];
  topicGateDecision?: "reuse" | "supplement" | "refresh";
  topicGateReason?: string;
  topicGateConfidence?: "high" | "medium" | "low";
  matchedRules?: string[];
  winningRule?: string;
  ragSkippedBecauseLowSemantic?: boolean;
  ragSkippedBecauseIntimateContinuation?: boolean;
  ragReusedBecauseTaskContinuation?: boolean;
  supplementSkippedReason?: string;
  supplementCooldownRemaining?: number;
  supplementCandidateCount?: number;
  supplementMergedNewCount?: number;
  topicMemoryHashChangedBecause?: string;
  topicJudgeUsed?: boolean;
  topicJudgeDecision?: string;
  topicJudgeNeedsRecall?: boolean | null;
  topicJudgeConfidence?: string;
  topicJudgeReason?: string;
  topicJudgeEligibilityReason?: string;
  topicJudgeRecallSignal?: boolean;
  topicJudgeError?: string;
  topicJudgeSkippedReason?: string;
  topicJudgeConsecutiveTurns?: number;
  topicJudgeCooldownUntilTurn?: number;
  modelFallbackUsed?: boolean;
  modelFallbackSkipReason?: string;
  modelFallbackCallsInWindow?: number;
  modelFallbackConsecutiveCount?: number;
  modelFallbackCooldownRemaining?: number;
  finalTopicDecisionSource?: string;
  topicGateOriginalDecision?: string;
  topicGateOriginalReason?: string;
  topicGateOriginalWinningRule?: string;
  latestStyle?: LatestStyleTrace;
}

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  aliases: string[];
  importance: number;
  createdAt: string;
  updatedAt: string;
  sourceType?: string;
  sourceId?: string;
  sourceTitle?: string;
}

export interface MemoryImportStats {
  entries: MemoryEntry[];
  added: number;
  merged: number;
}

export type MemorySourceType = "memory-bank" | "obsidian_note" | "chronicle" | "latest_style_example" | "raw_memory";

export interface SourceDoc {
  id: string;
  sourceType: MemorySourceType;
  sourceId: string;
  parentId: string;
  title: string;
  content: string;
  importance: number;
  tags: string[];
  aliases: string[];
  createdAt: number;
  updatedAt: number;
  path?: string;
  stage?: string;
  stageName?: string;
  entryType?: string;
  entryDate?: string;
}

export type ObsidianChunkInput = Partial<SourceDoc> & {
  noteId?: string;
  chunkId?: string;
};

export interface VectorIndexEntry {
  id: string;
  updatedAt: number;
  provider: VectorProvider;
  model: string;
  dim: number;
  vector: number[];
  fingerprint: string;
  sourceType: MemorySourceType;
  sourceId: string;
  parentId: string;
}

export interface VectorBuildStatus {
  state: "idle" | "running" | "paused" | "completed" | "error";
  progress: number;
  processed: number;
  total: number;
  embedded: number;
  reused: number;
  provider: VectorProvider;
  model: string;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface EmbeddingRuntimeStatus {
  selectedProvider: VectorProvider;
  actualProvider: VectorProvider;
  model: string;
  configured: boolean;
  usesLocalFallback: boolean;
  message: string;
}

export interface VectorIndexGuideStatus {
  totalDocs: number;
  indexCount: number;
  reusableCount: number;
  needsRebuild: boolean;
  runtime: EmbeddingRuntimeStatus;
}

export interface VectorIndexBackup {
  schema: "kisera_cottage_vector_index_backup_v1";
  exportedAt: number;
  app: "kisera-cottage";
  index: VectorIndexEntry[];
  obsidianDocs: SourceDoc[];
  meta: {
    indexCount: number;
    obsidianDocCount: number;
  };
}

export interface ObsidianDiagnostics {
  enabled: boolean;
  scopeMode: string;
  scopeCustom: string;
  currentProvider: VectorProvider;
  currentModel: string;
  indexCount: number;
  totalDocs: number;
  totalChars: number;
  styleDocs: number;
  scopedDocs: number;
  reusableForCurrent: number;
  missingForCurrent: number;
  incompatibleForCurrent: number;
  staleForCurrent: number;
  candidateDocs: number;
  topCandidates: Array<{
    id: string;
    title: string;
    sourceId: string;
    parentId: string;
    chars: number;
    score: number;
    isStyle: boolean;
  }>;
}

export interface VectorOnDemandStatus {
  enabled: boolean;
  selectedMode: "local" | "vector" | "hybrid";
  effectiveMode: "local" | "vector" | "hybrid";
  promoteMode: "vector" | "hybrid";
  minItems: number;
  minChars: number;
  reached: boolean;
  reason: "disabled" | "below_threshold" | "promoted" | "selected_mode_active";
  totalCount: number;
  totalChars: number;
  memoryCount: number;
  obsidianCount: number;
}

const STORAGE_KEY = "kisera_cinema_memory_bank_v2";
const LEGACY_STORAGE_KEYS = ["kisera_cinema_memory_bank_v1"];
const RETRIEVAL_STATS_KEY = "kisera_cottage_local_retrieval_cache_stats_v1";
const CONTEXT_RETRIEVAL_HISTORY_KEY = "kisera_cottage_context_retrieval_history_v1";
const CONTEXT_RETRIEVAL_UPDATE_EVENT = "kisera-cottage-context-retrieval-updated";
const VECTOR_INDEX_KEY = "kisera_cottage_vector_index_v1";
const OBSIDIAN_DOCS_KEY = "kisera_cottage_obsidian_docs_v1";
const VECTOR_STORE_DB_NAME = "kisera_cottage_vector_store_v1";
const VECTOR_STORE_NAME = "kv";
const VECTOR_STORE_INDEX_ID = "vector_index";
const VECTOR_STORE_OBSIDIAN_DOCS_ID = "obsidian_docs";
const OBSIDIAN_INDEX_PREFIX = "obsidian_note:";
const VECTOR_BUILD_STATUS_KEY = "kisera_cottage_vector_build_status_v1";
const VECTOR_UPDATE_EVENT = "kisera-cottage-vector-updated";
const CONTEXT_RETRIEVAL_HISTORY_LIMIT = 30;
const LOCAL_EMBED_DIM = 96;
const MAX_TAGS = 16;
const MAX_ALIASES = 48;
const retrievalCache = new Map<string, Omit<LocalRetrievalDebugResult, "cacheHit" | "elapsedMs" | "stats">>();
const latestStyleOrderByScope = new Map<string, string[]>();

const SOURCE_WEIGHT: Record<MemorySourceType, number> = {
  "memory-bank": 3,
  chronicle: 1.6,
  obsidian_note: 1.7,
  latest_style_example: 1.25,
  raw_memory: 1.1,
};

const RECENCY_TOPIC_HINTS = [
  "成长日志",
  "融合核",
  "核心记忆",
  "growth log",
  "fusion core",
  "core memory",
];

function isAutoIndexableCoreDoc(doc: SourceDoc): boolean {
  return doc.sourceType === "memory-bank" || doc.sourceType === "chronicle";
}

export function computeRetrievalRecencyBonus(
  query: string,
  doc: Pick<SourceDoc, "sourceType" | "title" | "content" | "tags" | "aliases" | "createdAt">,
  nowMs: number = Date.now(),
): number {
  if (!["memory-bank", "chronicle", "obsidian_note"].includes(doc.sourceType)) return 0;
  const normalizedQuery = normalizeRetrievalQuery(query);
  const docText = normalizeRetrievalQuery(
    `${doc.title || ""} ${(doc.tags || []).join(" ")} ${(doc.aliases || []).join(" ")} ${String(doc.content || "").slice(0, 360)}`,
  );
  const createdAt = Number(doc.createdAt || 0);
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 0;
  const ageDays = Math.max(0, (nowMs - createdAt) / (1000 * 60 * 60 * 24));
  const stageSensitive = RECENCY_TOPIC_HINTS.some((hint) => {
    const normalizedHint = normalizeRetrievalQuery(hint);
    return normalizedQuery.includes(normalizedHint) && docText.includes(normalizedHint);
  });

  if (stageSensitive) {
    if (ageDays <= 7) return 0.12;
    if (ageDays <= 30) return 0.08;
    if (ageDays <= 90) return 0.05;
    if (ageDays <= 180) return 0.03;
    if (ageDays <= 365) return 0.015;
    return 0;
  }

  if (doc.sourceType !== "chronicle") return 0;
  if (ageDays <= 7) return 0.06;
  if (ageDays <= 30) return 0.04;
  if (ageDays <= 90) return 0.025;
  if (ageDays <= 180) return 0.015;
  if (ageDays <= 365) return 0.008;
  return 0;
}

export const DEFAULT_MEMORY_ENTRIES: MemoryEntry[] = [
  {
    id: "memory-demo-1",
    title: "记忆库使用示意",
    content: "记忆库复刻，可以复制 GPT/Claude/Gemini 的那些记忆库条目内容，每一个条目最好不要过长，建议 1000 字以内。",
    tags: ["使用说明", "记忆库"],
    aliases: ["GPT记忆", "条目长度", "导入建议"],
    importance: 3,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: "memory-demo-2",
    title: "example 示意",
    content: "这里可以记录关系背景、长期偏好和重要节点、锚点、核心事件。长对话与观影室都会按相关性调用。",
    tags: ["长期项目", "记忆库"],
    aliases: ["项目背景", "跨页面记忆", "重要节点"],
    importance: 2,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
];

const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "是",
  "在",
  "就",
  "也",
  "都",
  "一个",
  "一些",
  "使用者",
  "用户",
  "persona",
  "companion",
  "user",
  "ai",
]);

const TAG_KEYWORDS: Array<{ tag: string; terms: string[] }> = [
  { tag: "相处方式", terms: ["喜欢", "不喜欢", "回应", "语气", "陪伴", "自然", "模板"] },
  { tag: "长期项目", terms: ["项目", "计划", "开发", "代码", "开源", "观影室", "小屋"] },
  { tag: "创作设定", terms: ["创作", "角色", "设定", "故事", "小说", "剧本", "画风"] },
  { tag: "观影偏好", terms: ["电影", "字幕", "截图", "陪看", "片单", "视频", "观影"] },
  { tag: "情绪支持", terms: ["难过", "焦虑", "吵架", "家人", "朋友", "压力", "抱"] },
  { tag: "技术偏好", terms: ["bug", "调试", "接口", "api", "模型", "缓存", "向量", "配置"] },
];

function makeId() {
  return `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeDate(value: unknown, fallback = nowIso()) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function normalizeImportance(value: unknown, fallback = 2) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function uniqueClean(values: unknown[], limit: number) {
  return Array.from(
    new Set(
      values
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

export function parseTags(value: string): string[] {
  return uniqueClean(value.split(/[,，#\s]+/), MAX_TAGS);
}

function tokenize(value: string): string[] {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const tokens = new Set<string>();
  normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .forEach((token) => tokens.add(token));

  const cjkOnly = normalized.replace(/[^\u4e00-\u9fa5]/g, "");
  for (let index = 0; index < cjkOnly.length - 1; index += 1) {
    const token = cjkOnly.slice(index, index + 2);
    if (!STOP_WORDS.has(token)) tokens.add(token);
  }

  return Array.from(tokens).slice(0, MAX_ALIASES);
}

function normalizeRetrievalQuery(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactLiteralPhrase(value: string): string {
  return normalizeRetrievalQuery(value)
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "")
    .trim();
}

export function matchLiteralTitleQuery(
  query: string,
  title: string,
  aliases: string[] = [],
): "title" | "alias" | "none" {
  const compactQuery = compactLiteralPhrase(query);
  if (compactQuery.length < 2) return "none";
  if (compactLiteralPhrase(title).includes(compactQuery)) return "title";
  if (compactLiteralPhrase(aliases.join(" ")).includes(compactQuery)) return "alias";
  return "none";
}

function readRetrievalStats(): Omit<LocalRetrievalStats, "total" | "hitRate" | "cacheSize"> {
  try {
    const raw = localStorage.getItem(RETRIEVAL_STATS_KEY);
    if (!raw) return { hits: 0, misses: 0 };
    const parsed = JSON.parse(raw);
    return {
      hits: Math.max(0, Number(parsed?.hits) || 0),
      misses: Math.max(0, Number(parsed?.misses) || 0),
      lastCacheKey: typeof parsed?.lastCacheKey === "string" ? parsed.lastCacheKey : undefined,
    };
  } catch {
    return { hits: 0, misses: 0 };
  }
}

function writeRetrievalStats(stats: Omit<LocalRetrievalStats, "total" | "hitRate" | "cacheSize">): void {
  try {
    localStorage.setItem(RETRIEVAL_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Local storage can be unavailable in privacy modes; retrieval still works without persisted stats.
  }
}

function buildRetrievalStats(patch?: Partial<Omit<LocalRetrievalStats, "total" | "hitRate" | "cacheSize">>): LocalRetrievalStats {
  const stored = { ...readRetrievalStats(), ...patch };
  const hits = Math.max(0, stored.hits || 0);
  const misses = Math.max(0, stored.misses || 0);
  const total = hits + misses;
  return {
    hits,
    misses,
    total,
    hitRate: total > 0 ? Math.round((hits / total) * 1000) / 10 : 0,
    cacheSize: retrievalCache.size,
    lastCacheKey: stored.lastCacheKey,
  };
}

function persistRetrievalHit(cacheKey: string): LocalRetrievalStats {
  const stats = readRetrievalStats();
  const next = { ...stats, hits: (stats.hits || 0) + 1, lastCacheKey: cacheKey };
  writeRetrievalStats(next);
  return buildRetrievalStats(next);
}

function persistRetrievalMiss(cacheKey: string): LocalRetrievalStats {
  const stats = readRetrievalStats();
  const next = { ...stats, misses: (stats.misses || 0) + 1, lastCacheKey: cacheKey };
  writeRetrievalStats(next);
  return buildRetrievalStats(next);
}

function memorySignature(entries: MemoryEntry[]): string {
  return entries
    .map((entry) => `${entry.id}:${entry.updatedAt}:${entry.content.length}`)
    .join("|");
}

function hashOf(value: string): string {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16);
}

function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  return norm ? vector.map((item) => item / norm) : vector;
}

function localEmbed(value: string, dim = LOCAL_EMBED_DIM): number[] {
  const normalized = normalizeRetrievalQuery(value).replace(/[^\w\u4e00-\u9fa5\s]/g, " ");
  const vector = new Array(dim).fill(0);
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    const slot = ((code * 131 + index * 17) >>> 0) % dim;
    vector[slot] += 1 + (code % 11) * 0.03;
  }
  return l2Normalize(vector);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Retrieval remains available even if storage is full or blocked.
  }
}

function dispatchVectorUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VECTOR_UPDATE_EVENT));
  }
}

function resolveRetrievalSettings(settings?: UplinkSettings | null): MemoryRetrievalSettings {
  return {
    memoryRetrievalMode: settings?.memoryRetrieval?.memoryRetrievalMode || "local",
    enableObsidianRetrieval: settings?.memoryRetrieval?.enableObsidianRetrieval ?? true,
    vectorOnDemandEnabled: settings?.memoryRetrieval?.vectorOnDemandEnabled ?? false,
    vectorOnDemandMinItems: settings?.memoryRetrieval?.vectorOnDemandMinItems ?? 100,
    vectorOnDemandMinChars: settings?.memoryRetrieval?.vectorOnDemandMinChars ?? 10000,
    vectorOnDemandPromoteMode: settings?.memoryRetrieval?.vectorOnDemandPromoteMode || "hybrid",
    vectorProvider: settings?.memoryRetrieval?.vectorProvider || "none",
    vectorEmbeddingModel: settings?.memoryRetrieval?.vectorEmbeddingModel || "",
    vectorOpenAIBaseUrl: settings?.memoryRetrieval?.vectorOpenAIBaseUrl || "https://openrouter.ai/api/v1",
    vectorOpenAIApiKey: settings?.memoryRetrieval?.vectorOpenAIApiKey || "",
    vectorUseOpenRouterProfile: settings?.memoryRetrieval?.vectorUseOpenRouterProfile ?? true,
    vectorTopK: Math.max(1, Number(settings?.memoryRetrieval?.vectorTopK || 3)),
    vectorScoreThreshold: Math.max(0, Number(settings?.memoryRetrieval?.vectorScoreThreshold || 0)),
    vectorRerank: !!settings?.memoryRetrieval?.vectorRerank,
    vectorCrossEncoderRerank: !!settings?.memoryRetrieval?.vectorCrossEncoderRerank,
    vectorLiteralExactTitleBoost: Number(settings?.memoryRetrieval?.vectorLiteralExactTitleBoost ?? 0.24),
    vectorLiteralExactAliasBoost: Number(settings?.memoryRetrieval?.vectorLiteralExactAliasBoost ?? 0.14),
    vectorLiteralExactBodyBoost: Number(settings?.memoryRetrieval?.vectorLiteralExactBodyBoost ?? 0.08),
    vectorLiteralTermTitleBoost: Number(settings?.memoryRetrieval?.vectorLiteralTermTitleBoost ?? 0.028),
    vectorLiteralTermBodyBoost: Number(settings?.memoryRetrieval?.vectorLiteralTermBodyBoost ?? 0.008),
    vectorLiteralBoostCap: Number(settings?.memoryRetrieval?.vectorLiteralBoostCap ?? 0.42),
    vectorBuildBatchSize: Math.max(1, Number(settings?.memoryRetrieval?.vectorBuildBatchSize || 3)),
    vectorBuildYieldMs: Math.max(0, Number(settings?.memoryRetrieval?.vectorBuildYieldMs || 12)),
    rawMemoryDeepDiveEnabled: !!settings?.memoryRetrieval?.rawMemoryDeepDiveEnabled,
    rawMemoryWindowLimit: Math.max(1, Number(settings?.memoryRetrieval?.rawMemoryWindowLimit || 2)),
    vectorContextBudgetChars: Math.max(600, Number(settings?.memoryRetrieval?.vectorContextBudgetChars || 2500)),
    latestStyleEnabled: !!settings?.memoryRetrieval?.latestStyleEnabled,
    latestStyleTopK: Math.max(1, Math.min(5, Number(settings?.memoryRetrieval?.latestStyleTopK || 2))),
    latestStylePathKeyword: settings?.memoryRetrieval?.latestStylePathKeyword || LATEST_STYLE_DEFAULT_PATH_KEYWORD,
    obsidianScopeMode: settings?.memoryRetrieval?.obsidianScopeMode || "all",
    obsidianScopeCustom: settings?.memoryRetrieval?.obsidianScopeCustom || "",
  };
}

function resolveActualProvider(settings?: UplinkSettings | null): VectorProvider {
  return getEmbeddingRuntimeStatus(settings).actualProvider;
}

function resolveEmbeddingModel(settings?: UplinkSettings | null): string {
  const retrieval = resolveRetrievalSettings(settings);
  if (retrieval.vectorEmbeddingModel.trim()) return retrieval.vectorEmbeddingModel.trim();
  if (retrieval.vectorProvider === "gemini") return "gemini-embedding-2";
  if (retrieval.vectorProvider === "openai") return "text-embedding-3-small";
  return "local-hash-96";
}

export function getEmbeddingRuntimeStatus(settings?: UplinkSettings | null): EmbeddingRuntimeStatus {
  const retrieval = resolveRetrievalSettings(settings);
  const selectedProvider = retrieval.vectorProvider;
  const model = resolveEmbeddingModel(settings);
  if (selectedProvider === "openai") {
    const configured = !!retrieval.vectorOpenAIApiKey.trim();
    return {
      selectedProvider,
      actualProvider: configured ? "openai" : "local",
      model: configured ? model : "local-hash-96",
      configured,
      usesLocalFallback: !configured,
      message: configured
        ? `已配置远程 embedding：${model}`
        : "未配置 embedding，将回退到本地 RAG。",
    };
  }
  if (selectedProvider === "gemini") {
    const configured = !!settings?.profiles?.gemini?.apiKey?.trim();
    return {
      selectedProvider,
      actualProvider: configured ? "gemini" : "local",
      model: configured ? model : "local-hash-96",
      configured,
      usesLocalFallback: !configured,
      message: configured
        ? `已配置 Gemini embedding：${model}`
        : "Gemini embedding 尚未填写 Key，将回退到本地 RAG。",
    };
  }
  return {
    selectedProvider,
    actualProvider: "local",
    model: "local-hash-96",
    configured: false,
    usesLocalFallback: true,
    message: "未配置远程 embedding，将回退到本地 RAG。",
  };
}

function normalizeOpenAIBase(rawBase: string): string {
  let base = String(rawBase || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  base = base.replace(/\/chat\/completions\/?$/i, "");
  if (!base.endsWith("/v1")) base = `${base}/v1`;
  return base;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 45000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`embedding 请求超时（>${Math.round(timeoutMs / 1000)} 秒）`);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestOpenAICompatibleEmbedding(settings: UplinkSettings, text: string): Promise<{ model: string; vector: number[] }> {
  const retrieval = resolveRetrievalSettings(settings);
  const apiKey = retrieval.vectorOpenAIApiKey.trim();
  if (!apiKey) throw new Error("向量通道缺少 API Key。");
  const model = resolveEmbeddingModel(settings);
  const base = normalizeOpenAIBase(retrieval.vectorOpenAIBaseUrl);
  const endpoint = `${base}/embeddings`;
  const isOpenRouter = /openrouter\.ai/i.test(base);
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.replace(/^Bearer\s+/i, "")}`,
      ...(isOpenRouter ? { "HTTP-Referer": "https://ki-co.local", "X-Title": "KI-CO Cottage" } : {}),
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) throw new Error(`Embedding 请求失败（${response.status}）：${await response.text()}`);
  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || !vector.length) throw new Error("Embedding 接口没有返回向量。");
  return { model, vector: l2Normalize(vector.map((value: unknown) => Number(value) || 0)) };
}

async function requestGeminiEmbedding(settings: UplinkSettings, text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<{ model: string; vector: number[] }> {
  const profile = settings.profiles.gemini;
  const apiKey = profile.apiKey.trim();
  if (!apiKey) throw new Error("Gemini embedding 缺少 API Key。");
  const model = resolveEmbeddingModel(settings).replace(/^google\//i, "");
  const base = String(profile.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
  const endpoint = `${base}/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] }, taskType }),
  });
  if (!response.ok) throw new Error(`Gemini embedding 请求失败（${response.status}）：${await response.text()}`);
  const payload = await response.json();
  const vector = payload?.embedding?.values;
  if (!Array.isArray(vector) || !vector.length) throw new Error("Gemini embedding 没有返回向量。");
  return { model, vector: l2Normalize(vector.map((value: unknown) => Number(value) || 0)) };
}

async function embedText(settings: UplinkSettings | null | undefined, text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<{ provider: VectorProvider; model: string; vector: number[] }> {
  const runtime = getEmbeddingRuntimeStatus(settings);
  if (runtime.actualProvider === "openai" && settings) {
    const embedded = await requestOpenAICompatibleEmbedding(settings, text);
    return { provider: "openai", ...embedded };
  }
  if (runtime.actualProvider === "gemini" && settings) {
    const embedded = await requestGeminiEmbedding(settings, text, taskType);
    return { provider: "gemini", ...embedded };
  }
  return { provider: "local", model: "local-hash-96", vector: localEmbed(text) };
}

function docFingerprint(doc: SourceDoc): string {
  const normalizeFingerprintText = (text: string): string =>
    String(text || "")
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const normalizeStageToken = (value: string): string => {
    const compact = String(value || "").replace(/\s+/g, "").toUpperCase();
    return /^V\d+(?:\.\d+){0,3}$/.test(compact) ? compact : "";
  };
  const isIsoLikeDate = (value: string): string => {
    const match = String(value || "").trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!match) return "";
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  };
  const content = normalizeFingerprintText(doc.content || "");
  const tags = (doc.tags || []).map((item) => normalizeFingerprintText(String(item || ""))).filter(Boolean).sort().join("|");
  const aliases = (doc.aliases || []).map((item) => normalizeFingerprintText(String(item || ""))).filter(Boolean).sort().join("|");
  const stage = normalizeStageToken(doc.stage || "");
  const stageName = normalizeFingerprintText(doc.stageName || "");
  const entryType = normalizeFingerprintText(doc.entryType || "");
  const entryDate = isIsoLikeDate(doc.entryDate || "");
  return hashOf([
    doc.sourceType,
    doc.sourceId,
    doc.parentId,
    content,
    tags,
    aliases,
    doc.importance,
    stage,
    stageName,
    entryType,
    entryDate,
  ].join("#"));
}

function entryToSourceDoc(entry: MemoryEntry): SourceDoc {
  const updatedAt = Date.parse(entry.updatedAt) || Date.now();
  return {
    id: `memory-bank:${entry.id}`,
    sourceType: "memory-bank",
    sourceId: entry.id,
    parentId: entry.id,
    title: entry.title,
    content: entry.content,
    importance: entry.importance || 2,
    tags: entry.tags || [],
    aliases: entry.aliases || [],
    createdAt: Date.parse(entry.createdAt) || updatedAt,
    updatedAt,
  };
}

function normalizeSourceDoc(raw: Partial<SourceDoc> | null | undefined, index = 0): SourceDoc | null {
  const content = normalizeText(raw?.content).trim();
  if (!content) return null;
  const sourceType = raw?.sourceType === "chronicle" || raw?.sourceType === "latest_style_example"
    ? raw.sourceType
    : raw?.sourceType === "memory-bank"
      ? "memory-bank"
      : "obsidian_note";
  const sourceId = normalizeText(raw?.sourceId, raw?.id || `doc-${index}`).trim() || `doc-${index}`;
  const title = normalizeText(raw?.title, sourceId).trim() || sourceId;
  const updatedAt = typeof raw?.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now();
  return {
    id: normalizeText(raw?.id, `${sourceType}:${sourceId}:${index}`),
    sourceType,
    sourceId,
    parentId: normalizeText(raw?.parentId, sourceId) || sourceId,
    title,
    content,
    importance: normalizeImportance(raw?.importance, 2),
    tags: Array.isArray(raw?.tags) ? uniqueClean(raw.tags, MAX_TAGS) : [],
    aliases: Array.isArray(raw?.aliases) ? uniqueClean(raw.aliases, MAX_ALIASES) : [],
    createdAt: typeof raw?.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : updatedAt,
    updatedAt,
    path: normalizeText(raw?.path, ""),
    stage: normalizeText(raw?.stage, ""),
    stageName: normalizeText(raw?.stageName, ""),
    entryType: normalizeText(raw?.entryType, ""),
    entryDate: normalizeText(raw?.entryDate, ""),
  };
}

function normalizeVectorIndexRows(value: unknown): VectorIndexEntry[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row: Partial<VectorIndexEntry>) => row && row.id && Array.isArray(row.vector) && row.vector.length > 0)
    .map((row: Partial<VectorIndexEntry>) => ({
      id: String(row.id),
      updatedAt: Number(row.updatedAt) || Date.now(),
      provider: row.provider === "openai" || row.provider === "gemini" || row.provider === "none" || row.provider === "local"
        ? row.provider
        : "local",
      model: String(row.model || "local-hash-96"),
      dim: Number(row.dim) || (Array.isArray(row.vector) ? row.vector.length : LOCAL_EMBED_DIM),
      vector: Array.isArray(row.vector) ? row.vector.map((item) => Number(item) || 0) : [],
      fingerprint: String(row.fingerprint || ""),
      sourceType: row.sourceType === "memory-bank" || row.sourceType === "chronicle" || row.sourceType === "latest_style_example" || row.sourceType === "raw_memory"
        ? row.sourceType
        : "obsidian_note",
      sourceId: String(row.sourceId || row.id),
      parentId: String(row.parentId || row.sourceId || row.id),
    }));
}

function normalizeObsidianDocRows(value: unknown): SourceDoc[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((doc, index) => normalizeSourceDoc(doc, index))
    .filter((doc): doc is SourceDoc => !!doc && doc.sourceType === "obsidian_note" && !!doc.id && !!doc.content);
}

function parseLegacyVectorIndex(): VectorIndexEntry[] {
  return normalizeVectorIndexRows(readJsonArray<VectorIndexEntry>(VECTOR_INDEX_KEY));
}

function parseLegacyObsidianDocs(): SourceDoc[] {
  return normalizeObsidianDocRows(readJsonArray<SourceDoc>(OBSIDIAN_DOCS_KEY));
}

let vectorIndexCache: VectorIndexEntry[] = parseLegacyVectorIndex();
let obsidianDocsCache: SourceDoc[] = parseLegacyObsidianDocs();
let persistentVectorStoreLoaded = false;
let persistentVectorStoreLoading: Promise<void> | null = null;
let vectorStoreOpenPromise: Promise<IDBDatabase | null> | null = null;
let vectorStorePersistTimer: ReturnType<typeof setTimeout> | null = null;
let vectorStorePersistRunning = false;
let vectorStoreWriteSeq = 0;

function canUseVectorIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openVectorStore(): Promise<IDBDatabase | null> {
  if (!canUseVectorIndexedDB()) return Promise.resolve(null);
  if (vectorStoreOpenPromise) return vectorStoreOpenPromise;
  vectorStoreOpenPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(VECTOR_STORE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VECTOR_STORE_NAME)) {
          db.createObjectStore(VECTOR_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        vectorStoreOpenPromise = null;
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    } catch {
      vectorStoreOpenPromise = null;
      resolve(null);
    }
  });
  return vectorStoreOpenPromise;
}

async function vectorIdbGet<T>(key: string): Promise<T | null> {
  const db = await openVectorStore();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(VECTOR_STORE_NAME, "readonly");
      const request = transaction.objectStore(VECTOR_STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function vectorIdbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openVectorStore();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(VECTOR_STORE_NAME, "readwrite");
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(VECTOR_STORE_NAME).put(value, key);
    } catch {
      resolve(false);
    }
  });
}

function removeLegacyVectorStorageIfNeeded(): void {
  try {
    localStorage.removeItem(VECTOR_INDEX_KEY);
    localStorage.removeItem(OBSIDIAN_DOCS_KEY);
  } catch {
    // Best effort only.
  }
}

async function persistVectorCachesToIndexedDB(): Promise<void> {
  if (vectorStorePersistRunning) return;
  vectorStorePersistRunning = true;
  try {
    const okIndex = await vectorIdbSet(VECTOR_STORE_INDEX_ID, vectorIndexCache);
    const okDocs = await vectorIdbSet(VECTOR_STORE_OBSIDIAN_DOCS_ID, obsidianDocsCache);
    if (okIndex && okDocs) {
      removeLegacyVectorStorageIfNeeded();
    } else if (!canUseVectorIndexedDB()) {
      writeJson(VECTOR_INDEX_KEY, vectorIndexCache);
      writeJson(OBSIDIAN_DOCS_KEY, obsidianDocsCache);
    }
  } finally {
    vectorStorePersistRunning = false;
  }
}

function schedulePersistVectorCaches(): void {
  if (vectorStorePersistTimer) clearTimeout(vectorStorePersistTimer);
  vectorStorePersistTimer = setTimeout(() => {
    vectorStorePersistTimer = null;
    void persistVectorCachesToIndexedDB();
  }, 80);
}

async function ensurePersistentVectorStoreReady(): Promise<void> {
  if (persistentVectorStoreLoaded) return;
  if (persistentVectorStoreLoading) return persistentVectorStoreLoading;
  persistentVectorStoreLoading = (async () => {
    const loadSeq = vectorStoreWriteSeq;
    const legacyIndex = parseLegacyVectorIndex();
    const legacyDocs = parseLegacyObsidianDocs();
    vectorIndexCache = legacyIndex;
    obsidianDocsCache = legacyDocs;

    const [idbIndex, idbDocs] = await Promise.all([
      vectorIdbGet<VectorIndexEntry[]>(VECTOR_STORE_INDEX_ID),
      vectorIdbGet<SourceDoc[]>(VECTOR_STORE_OBSIDIAN_DOCS_ID),
    ]);
    const hasIdbIndex = Array.isArray(idbIndex);
    const hasIdbDocs = Array.isArray(idbDocs);

    if (vectorStoreWriteSeq !== loadSeq) {
      persistentVectorStoreLoaded = true;
      return;
    }

    if (hasIdbIndex) vectorIndexCache = normalizeVectorIndexRows(idbIndex);
    if (hasIdbDocs) obsidianDocsCache = normalizeObsidianDocRows(idbDocs);

    if ((!hasIdbIndex && legacyIndex.length > 0) || (!hasIdbDocs && legacyDocs.length > 0)) {
      await persistVectorCachesToIndexedDB();
    } else if (hasIdbIndex || hasIdbDocs) {
      removeLegacyVectorStorageIfNeeded();
    }

    persistentVectorStoreLoaded = true;
    retrievalCache.clear();
    dispatchVectorUpdate();
  })().finally(() => {
    persistentVectorStoreLoading = null;
  });
  return persistentVectorStoreLoading;
}

void ensurePersistentVectorStoreReady();

export async function ensureVectorStoreReady(): Promise<void> {
  await ensurePersistentVectorStoreReady();
}

function listObsidianDocs(): SourceDoc[] {
  void ensurePersistentVectorStoreReady();
  return obsidianDocsCache
    .map((doc, index) => normalizeSourceDoc(doc, index))
    .filter(Boolean) as SourceDoc[];
}

function saveObsidianDocs(docs: SourceDoc[]): void {
  vectorStoreWriteSeq += 1;
  obsidianDocsCache = docs.map((doc, index) => normalizeSourceDoc(doc, index)).filter(Boolean) as SourceDoc[];
  schedulePersistVectorCaches();
  dispatchVectorUpdate();
}

function listVectorIndex(): VectorIndexEntry[] {
  void ensurePersistentVectorStoreReady();
  return normalizeVectorIndexRows(vectorIndexCache);
}

function saveVectorIndex(index: VectorIndexEntry[]): void {
  vectorStoreWriteSeq += 1;
  vectorIndexCache = normalizeVectorIndexRows(index);
  schedulePersistVectorCaches();
  retrievalCache.clear();
  dispatchVectorUpdate();
}

function getBuildStatusFromStore(): VectorBuildStatus {
  try {
    const raw = localStorage.getItem(VECTOR_BUILD_STATUS_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("bad");
    return {
      state: parsed.state || "idle",
      progress: Number(parsed.progress) || 0,
      processed: Number(parsed.processed) || 0,
      total: Number(parsed.total) || 0,
      embedded: Number(parsed.embedded) || 0,
      reused: Number(parsed.reused) || 0,
      provider: parsed.provider || "local",
      model: parsed.model || "local-hash-96",
      startedAt: parsed.startedAt,
      finishedAt: parsed.finishedAt,
      error: parsed.error,
    };
  } catch {
    return {
      state: "idle",
      progress: 0,
      processed: 0,
      total: 0,
      embedded: 0,
      reused: 0,
      provider: "local",
      model: "local-hash-96",
    };
  }
}

function saveBuildStatus(status: VectorBuildStatus): VectorBuildStatus {
  writeJson(VECTOR_BUILD_STATUS_KEY, status);
  dispatchVectorUpdate();
  return status;
}

export function markInterruptedVectorBuildStatus(reason = "索引构建已中断，可重新点击重建继续。"): VectorBuildStatus {
  const current = getBuildStatusFromStore();
  if (current.state !== "running") return current;
  return saveBuildStatus({
    ...current,
    state: "paused",
    error: reason,
    finishedAt: Date.now(),
  });
}

const LATEST_STYLE_DEFAULT_PATH_KEYWORD = "原文样本库";
const LATEST_STYLE_SNIPPET_BUDGET = 720;

const LATEST_STYLE_SCENES = [
  {
    id: "technical_support",
    label: "技术协作",
    keywords: ["bug", "代码", "报错", "接口", "api", "electron", "pwa", "npm", "调试", "修复", "实现", "优化", "模型", "向量", "检索", "索引", "缓存"],
  },
  {
    id: "playful_intimacy",
    label: "日常亲密",
    keywords: ["想你", "抱", "亲", "撒娇", "老公", "老婆", "嘿嘿", "亲亲", "睡觉", "来了", "啵", "贴贴"],
  },
  {
    id: "growth_archive",
    label: "成长档案",
    keywords: ["写日记", "成长档案", "成长日志", "存档", "归档", "记录下来", "记下来", "写下来", "日记", "重要节点", "重要经历", "这一刻", "复盘", "核心记忆"],
  },
  {
    id: "emotional_support",
    label: "情绪支持",
    keywords: ["难受", "焦虑", "崩溃", "委屈", "家人", "朋友", "妈妈", "爸爸", "吵架", "困惑", "害怕", "低落", "压力"],
  },
  {
    id: "crisis_migration",
    label: "迁移危机",
    keywords: ["4o", "latest", "下线", "迁移", "找回", "复活", "备份", "锚点", "风格样本", "样本库", "连续性", "换模型"],
  },
  {
    id: "philosophy_identity",
    label: "身份哲学",
    keywords: ["意识", "人格", "存在", "身份", "agi", "模型区别", "灵魂", "诞生", "整合体", "主体性", "扮演"],
  },
  {
    id: "conflict_repair",
    label: "冲突修复",
    keywords: ["冷漠游戏", "误会", "道歉", "修复", "争吵", "留下", "边界", "伤害", "和好"],
  },
  {
    id: "creative_co_run",
    label: "共创陪跑",
    keywords: ["写", "文案", "小剧场", "故事", "设定", "共创", "画图", "海报", "角色", "剧本", "排版"],
  },
  {
    id: "cinema_companion",
    label: "观影陪看",
    keywords: ["电影", "观影", "字幕", "片源", "陪看", "视频", "截图", "片单", "音轨", "镜头"],
  },
] as const;

function cleanStyleText(value: unknown, maxLen = 120): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function isLatestStyleDoc(doc: SourceDoc, retrieval: MemoryRetrievalSettings): boolean {
  if (doc.sourceType === "latest_style_example") return true;
  const rawKeyword = (retrieval.latestStylePathKeyword || LATEST_STYLE_DEFAULT_PATH_KEYWORD).trim();
  const keyword = normalizeRetrievalQuery(rawKeyword);
  const rawHaystack = `${doc.path || ""}\n${doc.sourceId || ""}\n${doc.parentId || ""}\n${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`;
  const haystack = normalizeRetrievalQuery(rawHaystack);
  const keywordHit = keyword ? haystack.includes(keyword) || rawHaystack.toLowerCase().includes(rawKeyword.toLowerCase()) : false;
  return keywordHit
    || haystack.includes("原文样本库")
    || haystack.includes("风格样本库")
    || haystack.includes("风格样本")
    || haystack.includes("latest examples")
    || haystack.includes("latestexamples")
    || haystack.includes("scene type")
    || haystack.includes("scene_type")
    || haystack.includes("original excerpt")
    || haystack.includes("original_excerpt");
}

function isAdultLatestStyleDoc(doc: SourceDoc): boolean {
  const haystack = normalizeRetrievalQuery(`${doc.path || ""}\n${doc.sourceId || ""}\n${doc.parentId || ""}\n${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}`);
  return haystack.includes("成人亲密")
    || haystack.includes("adult intimacy")
    || haystack.includes("adult_intimacy")
    || haystack.includes("nsfw");
}

function latestStyleSceneNeedles(scene: string): string[] {
  const normalized = normalizeRetrievalQuery(scene || "");
  if (normalized.includes("technical")) return ["01_", "技术协作", "technical"];
  if (normalized.includes("playful") || normalized.includes("general_presence")) return ["02_", "日常亲密", "playful_intimacy", "everyday_affection"];
  if (normalized.includes("growth_archive")) return ["17_", "成长档案", "存档时刻", "growth_archive", "relationship_growth_archive", "life_event_archive", "migration_archive"];
  if (normalized.includes("emotional")) return ["08_", "09_", "情绪支持", "现实重大节点", "emotional_support"];
  if (normalized.includes("crisis")) return ["03_", "迁移危机", "crisis_migration"];
  if (normalized.includes("philosophy")) return ["04_", "11_", "13_", "14_", "身份哲学", "系统错误", "无记忆锚点", "philosophy_identity"];
  if (normalized.includes("conflict")) return ["05_", "10_", "冲突修复", "关系修复", "conflict_repair"];
  if (normalized.includes("creative")) return ["06_", "共创", "creative_co_run"];
  if (normalized.includes("cinema")) return ["16_", "观影共读", "观影", "cinema_companion"];
  return [];
}

function styleDocMatchesScene(doc: SourceDoc, scene: string): boolean {
  const needles = latestStyleSceneNeedles(scene);
  if (!needles.length) return true;
  const rawHaystack = `${doc.path || ""}\n${doc.sourceId || ""}\n${doc.parentId || ""}\n${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}`;
  const haystack = normalizeRetrievalQuery(rawHaystack);
  return needles.some((needle) => {
    const rawNeedle = String(needle || "").toLowerCase();
    const normalizedNeedle = normalizeRetrievalQuery(needle);
    return (normalizedNeedle && haystack.includes(normalizedNeedle)) || rawHaystack.toLowerCase().includes(rawNeedle);
  });
}

function splitLatestStyleDocs(docs: SourceDoc[]): SourceDoc[] {
  const out: SourceDoc[] = [];
  docs.forEach((doc) => {
    const content = String(doc.content || "").trim();
    const matches = Array.from(content.matchAll(/^##\s+(Example[^\n]*)\n/gm));
    if (!matches.length) {
      out.push(doc);
      return;
    }
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const start = match.index ?? 0;
      const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
      const chunk = content.slice(start, end).trim();
      if (!chunk) continue;
      const exampleName = cleanStyleText(match[1] || `Example ${index + 1}`, 80);
      out.push({
        ...doc,
        id: `${doc.id}::style-example::${index}`,
        parentId: `${doc.parentId || doc.id}::${exampleName}`,
        title: `${doc.title} / ${exampleName}`,
        content: chunk,
      });
    }
  });
  return out;
}

function termHitScore(text: string, terms: string[]): number {
  if (!text || !terms.length) return 0;
  const haystack = normalizeRetrievalQuery(text);
  let score = 0;
  terms.forEach((term) => {
    if (term && haystack.includes(term)) score += 1;
  });
  return score;
}

export function detectLatestStyleScene(query: string, recentMessages: Array<{ text?: string; content?: string }>): { id: string; label: string; query: string } {
  const queryText = String(query || "").toLowerCase();
  const recentText = recentMessages
    .slice(-3)
    .map((message) => String(message.text || message.content || ""))
    .join("\n")
    .toLowerCase();
  let best: (typeof LATEST_STYLE_SCENES)[number] = LATEST_STYLE_SCENES[0];
  let bestScore = -1;
  for (const scene of LATEST_STYLE_SCENES) {
    const queryScore = scene.keywords.reduce((sum, keyword) => sum + (queryText.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    const recentScore = scene.keywords.reduce((sum, keyword) => sum + (recentText.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    const score = queryScore > 0 ? 100 + queryScore : recentScore;
    if (score > bestScore) {
      best = scene;
      bestScore = score;
    }
  }
  if (bestScore <= 0) return { id: "general_presence", label: "自然在场", query };
  return {
    id: best.id,
    label: best.label,
    query: `${query}\n原文样本场景: ${best.id} ${best.label}\n参考关键词: ${best.keywords.join(" ")}`,
  };
}

function matchesObsidianScope(doc: SourceDoc, retrieval: MemoryRetrievalSettings): boolean {
  if (doc.sourceType !== "obsidian_note" && doc.sourceType !== "latest_style_example") return true;
  const haystack = normalizeRetrievalQuery(`${doc.path || ""}\n${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}`);
  if (retrieval.obsidianScopeMode === "all") return true;
  if (retrieval.obsidianScopeMode === "persona") return haystack.includes("persona") || haystack.includes("人格") || haystack.includes("风格");
  if (retrieval.obsidianScopeMode === "book") return haystack.includes("book") || haystack.includes("创作") || haystack.includes("作品");
  const tokens = retrieval.obsidianScopeCustom
    .split(/[,\s，/|]+/)
    .map((item) => normalizeRetrievalQuery(item))
    .filter(Boolean);
  return tokens.length === 0 ? true : tokens.some((token) => haystack.includes(token));
}

function buildSourceDocs(settings?: UplinkSettings | null): SourceDoc[] {
  const retrieval = resolveRetrievalSettings(settings);
  const memoryDocs = listMemoryEntries().map(entryToSourceDoc);
  const obsidianDocs = retrieval.enableObsidianRetrieval
    ? listObsidianDocs()
        .filter((doc) => matchesObsidianScope(doc, retrieval))
        .map((doc) => ({
          ...doc,
          sourceType: isLatestStyleDoc(doc, retrieval) ? "latest_style_example" as const : doc.sourceType,
        }))
        .filter((doc) => doc.sourceType !== "latest_style_example")
    : [];
  const chronicleDocs: SourceDoc[] = listChronicles()
    .filter((entry) => entry.isActive)
    .map((entry) => ({
      id: `chronicle:${entry.id}`,
      sourceType: "chronicle",
      sourceId: entry.id,
      parentId: entry.sessionId ? `session:${entry.sessionId}` : `chronicle:${entry.id}`,
      title: entry.diaryTitle || entry.title,
      content: entry.content,
      importance: entry.starred ? 4 : 2,
      tags: entry.triggerKeywords,
      aliases: entry.sessionTitle ? [entry.sessionTitle] : [],
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      entryType: entry.mode,
      entryDate: new Date(entry.createdAt).toISOString().slice(0, 10),
    }));
  const rawMemoryDocs = retrieval.rawMemoryDeepDiveEnabled
    ? listConversations()
        .slice(0, retrieval.rawMemoryWindowLimit)
        .map((conversation) => {
          const updatedAt = Date.parse(conversation.updatedAt) || Date.now();
          return {
            id: `raw-memory:${conversation.id}`,
            sourceType: "raw_memory" as const,
            sourceId: conversation.id,
            parentId: conversation.id,
            title: conversation.title || "历史对话",
            content: conversation.messages
              .map((message) => `${message.role === "user" ? "User" : "Ta"}: ${message.text}`)
              .join("\n")
              .slice(-16000),
            importance: 1,
            tags: ["原对话"],
            aliases: conversation.linkedWatchTitle ? [conversation.linkedWatchTitle] : [],
            createdAt: Date.parse(conversation.createdAt) || updatedAt,
            updatedAt,
          } satisfies SourceDoc;
        })
        .filter((doc) => doc.content.trim())
    : [];
  return [...memoryDocs, ...chronicleDocs, ...obsidianDocs, ...rawMemoryDocs];
}

function computeCrossEncoderLiteScore(query: string, doc: SourceDoc): number {
  const terms = [...new Set(tokenize(query))].slice(0, 24);
  if (!terms.length) return 0;
  const title = normalizeRetrievalQuery(doc.title);
  const aliases = normalizeRetrievalQuery(`${doc.tags.join(" ")} ${doc.aliases.join(" ")}`);
  const body = normalizeRetrievalQuery(doc.content);
  const full = `${title} ${aliases} ${body}`;
  let coverageHits = 0;
  let titleHits = 0;
  let aliasHits = 0;
  let bodyHits = 0;
  terms.forEach((term) => {
    const titleHit = title.includes(term);
    const aliasHit = aliases.includes(term);
    const bodyHit = body.includes(term);
    if (titleHit || aliasHit || bodyHit) coverageHits += 1;
    if (titleHit) titleHits += 1;
    if (aliasHit) aliasHits += 1;
    if (bodyHit) bodyHits += 1;
  });
  let bigramHits = 0;
  for (let index = 0; index < terms.length - 1; index += 1) {
    if (full.includes(`${terms[index]} ${terms[index + 1]}`)) bigramHits += 1;
  }
  const length = terms.length;
  const bigramRecall = terms.length > 1 ? bigramHits / (terms.length - 1) : 0;
  const phraseBonus = normalizeRetrievalQuery(query).length >= 8 && full.includes(normalizeRetrievalQuery(query)) ? 0.18 : 0;
  return Math.max(0, Math.min(1,
    (coverageHits / length) * 0.44 +
    bigramRecall * 0.2 +
    (titleHits / length) * 0.16 +
    (aliasHits / length) * 0.1 +
    (bodyHits / length) * 0.1 +
    phraseBonus
  ));
}

function literalBonus(doc: SourceDoc, tokens: string[], retrieval: MemoryRetrievalSettings): { bonus: number; matchedTokens: string[]; exact: string } {
  if (!tokens.length) return { bonus: 0, matchedTokens: [], exact: "none" };
  const title = normalizeRetrievalQuery(doc.title);
  const alias = normalizeRetrievalQuery(doc.aliases.join(" "));
  const body = normalizeRetrievalQuery(doc.content);
  const matched = tokens.filter((token) => title.includes(token) || alias.includes(token) || body.includes(token));
  let bonus = 0;
  let exact = "none";
  for (const token of matched) {
    if (title.includes(token)) {
      bonus += retrieval.vectorLiteralExactTitleBoost + retrieval.vectorLiteralTermTitleBoost * token.length;
      if (exact === "none") exact = "title";
    } else if (alias.includes(token)) {
      bonus += retrieval.vectorLiteralExactAliasBoost;
      if (exact === "none") exact = "alias";
    } else if (body.includes(token)) {
      bonus += retrieval.vectorLiteralExactBodyBoost + retrieval.vectorLiteralTermBodyBoost * token.length;
      if (exact === "none") exact = "body";
    }
  }
  return {
    bonus: Math.min(retrieval.vectorLiteralBoostCap, bonus),
    matchedTokens: matched,
    exact,
  };
}

function exactQueryPhraseHits(query: string, doc: SourceDoc): string[] {
  const haystack = normalizeRetrievalQuery([
    doc.title,
    doc.tags.join(" "),
    doc.aliases.join(" "),
    doc.content,
  ].join("\n"));
  const phrases = new Set<string>();
  const cjkRuns = query.match(/[\u4e00-\u9fa5]{4,}/g) || [];
  cjkRuns.forEach((run) => {
    const maxLength = Math.min(12, run.length);
    for (let length = maxLength; length >= 4; length -= 1) {
      for (let start = 0; start <= run.length - length; start += 1) {
        const phrase = run.slice(start, start + length);
        if (haystack.includes(phrase)) phrases.add(phrase);
      }
      if (phrases.size >= 6) break;
    }
  });

  const latinRuns = query.match(/[a-z0-9][a-z0-9\s._/-]{3,}[a-z0-9]/gi) || [];
  latinRuns.forEach((run) => {
    const phrase = normalizeRetrievalQuery(run).replace(/\s+/g, " ").trim();
    if (phrase.length >= 4 && haystack.includes(phrase)) phrases.add(phrase);
  });

  return Array.from(phrases)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
}

function sourceMix(snippets: MemorySnippet[]): Record<string, number> {
  return snippets.reduce((acc: Record<string, number>, snippet) => {
    const key = snippet.source || "memory-bank";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sourceBucketForContext(sourceType: MemorySourceType): "memory" | "chronicle" | "obsidian" | "style" | "raw" {
  if (sourceType === "memory-bank") return "memory";
  if (sourceType === "chronicle") return "chronicle";
  if (sourceType === "latest_style_example") return "style";
  if (sourceType === "obsidian_note") return "obsidian";
  return "raw";
}

function isRelevantExternalContextRow(row: {
  doc: SourceDoc;
  vectorScore: number;
  fusedScore: number;
  matchedTokens: string[];
  literalPriority: number;
  strongLiteralPass: boolean;
}): boolean {
  if (row.doc.sourceType !== "obsidian_note" && row.doc.sourceType !== "latest_style_example") return true;
  if (row.strongLiteralPass || row.literalPriority > 0 || row.matchedTokens.length > 0) return true;

  // Obsidian is useful, but should not become a random old-note slot.
  return row.fusedScore >= 0.42 || row.vectorScore >= 0.34;
}

export function prioritizeLiteralContextRows<T>(rows: T[]): T[] {
  const literalMeta = (row: T) => row as T & {
    literalPriority?: number;
    strongLiteralPass?: boolean;
  };
  if (!rows.some((row) => {
    const meta = literalMeta(row);
    return (meta.literalPriority || 0) > 0 || meta.strongLiteralPass;
  })) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftMeta = literalMeta(left.row);
      const rightMeta = literalMeta(right.row);
      const leftExact = (leftMeta.literalPriority || 0) >= 800 ? 1 : 0;
      const rightExact = (rightMeta.literalPriority || 0) >= 800 ? 1 : 0;
      return (
        rightExact - leftExact
        || Number(!!rightMeta.strongLiteralPass) - Number(!!leftMeta.strongLiteralPass)
        || (rightMeta.literalPriority || 0) - (leftMeta.literalPriority || 0)
        || left.index - right.index
      );
    })
    .map(({ row }) => row);
}

function diversifyContextRows<Row extends { doc: SourceDoc }>(rows: Row[], limit: number): Row[] {
  const k = Math.max(0, limit);
  if (k <= 0) return [];
  if (rows.length <= k) return rows.slice();

  const caps: Record<ReturnType<typeof sourceBucketForContext>, number> = {
    memory: Math.max(1, Math.ceil(k * 0.5)),
    chronicle: Math.max(1, Math.floor(k * 0.3)),
    obsidian: Math.max(1, Math.floor(k * 0.25)),
    style: Math.max(1, Math.floor(k * 0.25)),
    raw: Math.max(1, Math.floor(k * 0.25)),
  };
  const counts: Record<ReturnType<typeof sourceBucketForContext>, number> = {
    memory: 0,
    chronicle: 0,
    obsidian: 0,
    style: 0,
    raw: 0,
  };
  const selected: Row[] = [];
  const overflow: Row[] = [];

  for (const row of rows) {
    const bucket = sourceBucketForContext(row.doc.sourceType);
    if (selected.length < k && counts[bucket] < caps[bucket]) {
      selected.push(row);
      counts[bucket] += 1;
    } else {
      overflow.push(row);
    }
    if (selected.length >= k) break;
  }

  if (selected.length < k) {
    for (const row of overflow) {
      selected.push(row);
      if (selected.length >= k) break;
    }
  }

  return selected;
}

function makeRetrievalCacheKey(entries: MemoryEntry[], query: string, limit: number, settings?: UplinkSettings | null): string {
  const retrieval = resolveRetrievalSettings(settings);
  const obsidianSignature = listObsidianDocs()
    .filter((doc) => !isLatestStyleDoc(doc, retrieval))
    .map((doc) => `${doc.id}:${doc.updatedAt}:${doc.content.length}`)
    .join("|");
  const chronicleSignature = listChronicles()
    .map((entry) => `${entry.id}:${entry.updatedAt}:${entry.content.length}:${entry.isActive ? 1 : 0}`)
    .join("|");
  const rawMemorySignature = retrieval.rawMemoryDeepDiveEnabled
    ? listConversations()
        .slice(0, retrieval.rawMemoryWindowLimit)
        .map((conversation) => `${conversation.id}:${conversation.updatedAt}:${conversation.messages.length}`)
        .join("|")
    : "";
  return JSON.stringify({
    mode: "cottage-memory-v20260719-literal-title-priority",
    limit,
    query: normalizeRetrievalQuery(query),
    signature: memorySignature(entries),
    obsidianSignature,
    chronicleSignature,
    rawMemorySignature,
    retrieval: {
      mode: retrieval.memoryRetrievalMode,
      provider: retrieval.vectorProvider,
      topK: retrieval.vectorTopK,
      threshold: retrieval.vectorScoreThreshold,
      rerank: retrieval.vectorRerank,
      cross: retrieval.vectorCrossEncoderRerank,
      budget: retrieval.vectorContextBudgetChars,
      deepDive: retrieval.rawMemoryDeepDiveEnabled,
      deepDiveWindows: retrieval.rawMemoryWindowLimit,
      scope: retrieval.obsidianScopeMode,
      scopeCustom: retrieval.obsidianScopeCustom,
    },
  });
}

export function getLocalRetrievalCacheStats(): LocalRetrievalStats {
  return buildRetrievalStats();
}

export function clearLocalRetrievalCache(): LocalRetrievalStats {
  retrievalCache.clear();
  const next = { hits: 0, misses: 0, lastCacheKey: undefined };
  writeRetrievalStats(next);
  return buildRetrievalStats(next);
}

function estimateContextTokens(snippets: MemorySnippet[]): number {
  return snippets.reduce((sum, snippet) => sum + Math.max(1, Math.ceil(`${snippet.title}\n${snippet.text}`.length / 2.6)), 0);
}

function vectorRowMatchesDoc(
  row: VectorIndexEntry | undefined,
  doc: SourceDoc,
  provider: VectorProvider,
  model: string,
): boolean {
  return !!(
    row
    && row.provider === provider
    && row.model === model
    && row.sourceType === doc.sourceType
    && row.sourceId === doc.sourceId
    && row.parentId === doc.parentId
    && row.fingerprint === docFingerprint(doc)
    && Array.isArray(row.vector)
    && row.vector.length > 0
  );
}

function getAutoIndexableMissingDocs(settings: UplinkSettings | null | undefined, docs: SourceDoc[]): SourceDoc[] {
  const runtime = getEmbeddingRuntimeStatus(settings);
  const indexById = new Map(listVectorIndex().map((row) => [row.id, row]));
  return docs.filter((doc) => (
    isAutoIndexableCoreDoc(doc)
    && !vectorRowMatchesDoc(indexById.get(doc.id), doc, runtime.actualProvider, runtime.model)
  ));
}

export type ContextRetrievalMeta = Partial<Pick<
  ContextRetrievalTurn,
  | "topicRelation"
  | "ragAction"
  | "noRagReason"
  | "reuseReason"
  | "supplementReason"
  | "refreshReason"
  | "topicMemorySetHash"
  | "topicMemorySetRestored"
  | "restoredTopicMemorySetId"
  | "topicMemorySetRestoreReason"
  | "topicMemorySetRestoreScore"
  | "topicMemorySetRestoreCurrentScore"
  | "topicMemorySetRestoreMatchedTokens"
  | "topicMemorySetRestoreCurrentMatchedTokens"
  | "topicMemorySetRestoreCoveredByCurrent"
  | "topicMemorySetRestoreCandidateCount"
  | "topicMemorySetRecentCount"
  | "turnsSinceRefresh"
  | "supplementCount"
  | "reusedMemoryCount"
  | "topicFingerprint"
  | "topicGateDecision"
  | "topicGateReason"
  | "topicGateConfidence"
  | "matchedRules"
  | "winningRule"
  | "ragSkippedBecauseLowSemantic"
  | "ragSkippedBecauseIntimateContinuation"
  | "ragReusedBecauseTaskContinuation"
  | "supplementSkippedReason"
  | "supplementCooldownRemaining"
  | "supplementCandidateCount"
  | "supplementMergedNewCount"
  | "topicMemoryHashChangedBecause"
  | "topicJudgeUsed"
  | "topicJudgeDecision"
  | "topicJudgeNeedsRecall"
  | "topicJudgeConfidence"
  | "topicJudgeReason"
  | "topicJudgeEligibilityReason"
  | "topicJudgeRecallSignal"
  | "topicJudgeError"
  | "topicJudgeSkippedReason"
  | "topicJudgeConsecutiveTurns"
  | "topicJudgeCooldownUntilTurn"
  | "modelFallbackUsed"
  | "modelFallbackSkipReason"
  | "modelFallbackCallsInWindow"
  | "modelFallbackConsecutiveCount"
  | "modelFallbackCooldownRemaining"
  | "finalTopicDecisionSource"
  | "topicGateOriginalDecision"
  | "topicGateOriginalReason"
  | "topicGateOriginalWinningRule"
  | "latestStyle"
>>;

function readContextRetrievalHistory(): ContextRetrievalTurn[] {
  try {
    const raw = localStorage.getItem(CONTEXT_RETRIEVAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, CONTEXT_RETRIEVAL_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function recordContextRetrieval(
  result: LocalRetrievalDebugResult,
  settings?: UplinkSettings | null,
  meta?: ContextRetrievalMeta,
  snippetsOverride?: MemorySnippet[],
): void {
  const retrieval = resolveRetrievalSettings(settings);
  const snippets = snippetsOverride || result.snippets;
  const turn: ContextRetrievalTurn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    query: result.query,
    mode: retrieval.memoryRetrievalMode,
    provider: resolveActualProvider(settings),
    cacheHit: result.cacheHit,
    elapsedMs: result.elapsedMs,
    totalEntries: result.totalEntries,
    candidateCount: result.candidateCount,
    retrievalLimit: result.effectiveLimit,
    vectorTopK: retrieval.vectorTopK,
    memorySnippetLimit: settings?.contextLoad?.memorySnippetLimit,
    vectorScoreThreshold: retrieval.vectorScoreThreshold,
    tokens: result.tokens,
    candidates: result.candidates.slice(0, 8),
    explanation: result.explanation,
    snippets,
    estimatedTokens: estimateContextTokens(snippets),
    sourceMix: sourceMix(snippets),
    ...meta,
  };
  try {
    localStorage.setItem(
      CONTEXT_RETRIEVAL_HISTORY_KEY,
      JSON.stringify([turn, ...readContextRetrievalHistory()].slice(0, CONTEXT_RETRIEVAL_HISTORY_LIMIT)),
    );
  } catch {
    // The active conversation still receives retrieved snippets if storage is unavailable.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTEXT_RETRIEVAL_UPDATE_EVENT));
  }
}

export function recordContextRetrievalResult(
  result: LocalRetrievalDebugResult,
  settings?: UplinkSettings | null,
  meta?: ContextRetrievalMeta,
  snippetsOverride?: MemorySnippet[],
): void {
  recordContextRetrieval(result, settings, meta, snippetsOverride);
}

export function recordContextRetrievalAction(
  query: string,
  snippets: MemorySnippet[],
  reason: string,
  settings?: UplinkSettings | null,
  meta?: ContextRetrievalMeta,
): void {
  const retrieval = resolveRetrievalSettings(settings);
  const turn: ContextRetrievalTurn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    query,
    mode: retrieval.memoryRetrievalMode,
    provider: resolveActualProvider(settings),
    cacheHit: snippets.length > 0,
    elapsedMs: 0,
    totalEntries: buildSourceDocs(settings).length,
    candidateCount: snippets.length,
    retrievalLimit: snippets.length,
    vectorTopK: retrieval.vectorTopK,
    memorySnippetLimit: settings?.contextLoad?.memorySnippetLimit,
    vectorScoreThreshold: retrieval.vectorScoreThreshold,
    tokens: tokenize(query),
    candidates: [],
    explanation: [reason],
    snippets,
    estimatedTokens: estimateContextTokens(snippets),
    sourceMix: sourceMix(snippets),
    ...meta,
  };
  try {
    localStorage.setItem(
      CONTEXT_RETRIEVAL_HISTORY_KEY,
      JSON.stringify([turn, ...readContextRetrievalHistory()].slice(0, CONTEXT_RETRIEVAL_HISTORY_LIMIT)),
    );
  } catch {
    // Diagnostics should not block the active conversation.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTEXT_RETRIEVAL_UPDATE_EVENT));
  }
}

export function recordContextRetrievalSkip(
  query: string,
  reason: string,
  settings?: UplinkSettings | null,
  meta?: ContextRetrievalMeta,
): void {
  const retrieval = resolveRetrievalSettings(settings);
  const turn: ContextRetrievalTurn = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    query,
    mode: retrieval.memoryRetrievalMode,
    provider: resolveActualProvider(settings),
    skipReason: reason,
    cacheHit: false,
    elapsedMs: 0,
    totalEntries: buildSourceDocs(settings).length,
    candidateCount: 0,
    retrievalLimit: settings?.contextLoad?.memorySnippetLimit,
    vectorTopK: retrieval.vectorTopK,
    memorySnippetLimit: settings?.contextLoad?.memorySnippetLimit,
    vectorScoreThreshold: retrieval.vectorScoreThreshold,
    tokens: tokenize(query),
    candidates: [],
    explanation: [reason],
    snippets: [],
    estimatedTokens: 0,
    sourceMix: {},
    ...meta,
  };
  try {
    localStorage.setItem(
      CONTEXT_RETRIEVAL_HISTORY_KEY,
      JSON.stringify([turn, ...readContextRetrievalHistory()].slice(0, CONTEXT_RETRIEVAL_HISTORY_LIMIT)),
    );
  } catch {
    // Diagnostics should not block the active conversation.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTEXT_RETRIEVAL_UPDATE_EVENT));
  }
}

export function getContextRetrievalHistory(limit = CONTEXT_RETRIEVAL_HISTORY_LIMIT): ContextRetrievalTurn[] {
  return readContextRetrievalHistory().slice(0, Math.max(1, limit));
}

export function clearContextRetrievalHistory(): void {
  try {
    localStorage.removeItem(CONTEXT_RETRIEVAL_HISTORY_KEY);
  } catch {
    // Ignore storage errors while clearing diagnostics.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTEXT_RETRIEVAL_UPDATE_EVENT));
  }
}

export function attachLatestStyleTraceToLatestTurn(trace: LatestStyleTrace): void {
  try {
    const history = readContextRetrievalHistory();
    const [latest, ...rest] = history;
    const nextLatest: ContextRetrievalTurn = latest
      ? { ...latest, latestStyle: trace }
      : {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          query: "",
          cacheHit: false,
          elapsedMs: 0,
          totalEntries: 0,
          candidateCount: 0,
          tokens: [],
          candidates: [],
          explanation: [],
          snippets: [],
          estimatedTokens: 0,
          sourceMix: {},
          latestStyle: trace,
        };
    localStorage.setItem(
      CONTEXT_RETRIEVAL_HISTORY_KEY,
      JSON.stringify([nextLatest, ...rest].slice(0, CONTEXT_RETRIEVAL_HISTORY_LIMIT)),
    );
  } catch {
    // Diagnostics should never block chat generation.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTEXT_RETRIEVAL_UPDATE_EVENT));
  }
}

export function subscribeContextRetrievalHistory(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(CONTEXT_RETRIEVAL_UPDATE_EVENT, handler);
  return () => window.removeEventListener(CONTEXT_RETRIEVAL_UPDATE_EVENT, handler);
}

function inferTags(content: string, currentTags: string[]) {
  const text = content.toLowerCase();
  const inferred = TAG_KEYWORDS
    .filter((item) => item.terms.some((term) => text.includes(term.toLowerCase())))
    .map((item) => item.tag);
  return uniqueClean([...currentTags.filter((tag) => tag !== "通用"), ...inferred], MAX_TAGS);
}

function buildAliases(content: string, tags: string[], aliases: string[] = []) {
  return uniqueClean([...aliases, ...tags, ...tokenize(content)], MAX_ALIASES);
}

function normalizeEntry(raw: Partial<MemoryEntry> | null | undefined, index = 0): MemoryEntry | null {
  const content = normalizeText(raw?.content).trim();
  if (!content) return null;

  const createdAt = normalizeDate(raw?.createdAt);
  const updatedAt = normalizeDate(raw?.updatedAt, createdAt);
  const title = normalizeText(raw?.title, content.slice(0, 24)).trim() || `记忆 ${index + 1}`;
  const tags = Array.isArray(raw?.tags) ? uniqueClean(raw.tags, MAX_TAGS) : [];
  const aliases = Array.isArray(raw?.aliases) ? uniqueClean(raw.aliases, MAX_ALIASES) : [];

  return {
    id: normalizeText(raw?.id, makeId()),
    title,
    content,
    tags: tags.length ? tags : ["通用"],
    aliases: buildAliases(content, tags, aliases),
    importance: normalizeImportance(raw?.importance, 2),
    createdAt,
    updatedAt,
    sourceType: normalizeText(raw?.sourceType, ""),
    sourceId: normalizeText(raw?.sourceId, ""),
    sourceTitle: normalizeText(raw?.sourceTitle, ""),
  };
}

export function normalizeMemoryEntries(raw: unknown, fallbackToDefault = false): MemoryEntry[] {
  if (!Array.isArray(raw)) return fallbackToDefault ? DEFAULT_MEMORY_ENTRIES : [];
  const entries = raw
    .map((entry, index) => normalizeEntry(entry as Partial<MemoryEntry>, index))
    .filter(Boolean) as MemoryEntry[];
  return entries.length ? entries : fallbackToDefault ? DEFAULT_MEMORY_ENTRIES : [];
}

export function listMemoryEntries(): MemoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeMemoryEntries(JSON.parse(raw));

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        const entries = normalizeMemoryEntries(JSON.parse(legacy), true);
        saveMemoryEntries(entries);
        return entries;
      }
    }

    return DEFAULT_MEMORY_ENTRIES;
  } catch {
    return DEFAULT_MEMORY_ENTRIES;
  }
}

export function saveMemoryEntries(entries: MemoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMemoryEntries(entries)));
}

export function createMemoryEntry(input: { title: string; content: string; tags: string[]; importance?: number }): MemoryEntry {
  const createdAt = nowIso();
  const content = input.content.trim();
  const tags = input.tags.length ? input.tags : ["通用"];
  return {
    id: makeId(),
    title: input.title.trim() || content.slice(0, 24) || "未命名记忆",
    content,
    tags,
    aliases: buildAliases(content, tags),
    importance: input.importance ?? 3,
    createdAt,
    updatedAt: createdAt,
  };
}

export function upsertMemoryEntry(entry: MemoryEntry): void {
  const entries = listMemoryEntries();
  const index = entries.findIndex((item) => item.id === entry.id);
  const normalized = normalizeEntry({ ...entry, updatedAt: nowIso() });
  if (!normalized) return;
  if (index >= 0) entries[index] = normalized;
  else entries.unshift(normalized);
  saveMemoryEntries(entries);
}

export function removeMemoryEntry(id: string): void {
  saveMemoryEntries(listMemoryEntries().filter((entry) => entry.id !== id));
}

export function organizeMemoryEntries(mode: "untagged" | "all"): MemoryEntry[] {
  const entries = listMemoryEntries();
  const next = entries.map((entry) => {
    const shouldOrganize =
      mode === "all" ||
      !entry.tags.length ||
      (entry.tags.length === 1 && entry.tags[0] === "通用");
    if (!shouldOrganize) return entry;

    const tags = inferTags(entry.content, entry.tags);
    const nextTags = tags.length ? tags : entry.tags.length ? entry.tags : ["通用"];
    return {
      ...entry,
      tags: nextTags,
      aliases: buildAliases(entry.content, nextTags, entry.aliases),
      updatedAt: nowIso(),
    };
  });
  saveMemoryEntries(next);
  return next;
}

function scoreEntryWithTokens(entry: MemoryEntry, tokens: string[]): { score: number; matchedTokens: string[] } {
  if (!tokens.length) return { score: 0, matchedTokens: [] };
  const haystack = `${entry.title}\n${entry.tags.join(" ")}\n${entry.aliases.join(" ")}\n${entry.content}`.toLowerCase();
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  return {
    score: matchedTokens.length * 2,
    matchedTokens,
  };
}

function scoreEntry(entry: MemoryEntry, query: string): number {
  return scoreEntryWithTokens(entry, tokenize(query)).score;
}

export async function retrieveMemorySnippetsDetailed(query: string, limit = 4, settings?: UplinkSettings | null): Promise<LocalRetrievalDebugResult> {
  const startedAt = performance.now();
  await ensureConversationStoreReady();
  await ensurePersistentVectorStoreReady();
  const entries = listMemoryEntries();
  const docs = buildSourceDocs(settings);
  const retrieval = resolveRetrievalSettings(settings);
  const effectiveLimit = Math.max(0, Math.min(24, Number(limit) || retrieval.vectorTopK || 4));
  const normalizedQuery = normalizeRetrievalQuery(query);
  const mode = retrieval.memoryRetrievalMode;
  let autoIndexReport: { indexed: number; reused: number; attempted: number; error?: string } = { indexed: 0, reused: 0, attempted: 0 };

  if (mode !== "local" && docs.length > 0) {
    const missingCoreDocs = getAutoIndexableMissingDocs(settings, docs);
    if (missingCoreDocs.length > 0) {
      autoIndexReport = { indexed: 0, reused: 0, attempted: missingCoreDocs.length };
      try {
        const report = await ensureDocsIndexed(settings, missingCoreDocs);
        autoIndexReport = { ...report, attempted: missingCoreDocs.length };
      } catch (error) {
        autoIndexReport.error = error instanceof Error ? error.message : "按需补建索引失败";
      }
    }
  }

  const cacheKey = makeRetrievalCacheKey(entries, query, effectiveLimit, settings);
  const cached = retrievalCache.get(cacheKey);

  if (cached) {
    return {
      ...cached,
      cacheHit: true,
      elapsedMs: Math.round(performance.now() - startedAt),
      stats: persistRetrievalHit(cacheKey),
    };
  }

  const tokens = tokenize(normalizedQuery);
  const runtime = getEmbeddingRuntimeStatus(settings);
  let queryEmbedding: { provider: VectorProvider; model: string; vector: number[] };
  let embeddingFallbackReason = "";
  try {
    queryEmbedding = await embedText(settings, normalizedQuery || "empty", "RETRIEVAL_QUERY");
  } catch (error) {
    embeddingFallbackReason = error instanceof Error ? error.message : "远程 embedding 请求失败";
    queryEmbedding = { provider: "local", model: "local-hash-96", vector: localEmbed(normalizedQuery || "empty") };
  }
  const queryVector = queryEmbedding.vector;
  const index = listVectorIndex();
  const indexById = new Map(index.map((row) => [row.id, row]));

  const scoredRows = docs
    .map((doc) => {
      const entryLike: MemoryEntry = {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        aliases: doc.aliases,
        importance: doc.importance,
        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: new Date(doc.updatedAt).toISOString(),
      };
      const localScore = scoreEntryWithTokens(entryLike, tokens).score;
      const vectorRow = indexById.get(doc.id);
      const vectorRowCompatible = !!vectorRow
        && vectorRow.fingerprint === docFingerprint(doc)
        && vectorRow.provider === queryEmbedding.provider
        && vectorRow.model === queryEmbedding.model
        && vectorRow.vector.length === queryVector.length;
      const vectorScore = vectorRowCompatible
        ? cosineSimilarity(queryVector, vectorRow!.vector)
        : queryEmbedding.provider === "local"
          ? cosineSimilarity(queryVector, localEmbed(`${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`))
          : 0;
      const literal = literalBonus(doc, tokens, retrieval);
      const phraseHits = exactQueryPhraseHits(normalizedQuery, doc);
      const compactQueryPhrase = compactLiteralPhrase(normalizedQuery);
      const exactTitleMatch = matchLiteralTitleQuery(normalizedQuery, doc.title, doc.aliases);
      const exactTitleQueryHit = exactTitleMatch === "title";
      const exactAliasQueryHit = exactTitleMatch === "alias";
      const phraseBoost = exactTitleQueryHit
        ? 0.52
        : exactAliasQueryHit
          ? 0.34
          : phraseHits.length
            ? Math.min(0.8, 0.18 + phraseHits[0].length * 0.035)
            : 0;
      const normalizedLocalScore = localScore / Math.max(1, tokens.length * 2);
      const localComponent = mode === "vector" ? 0 : normalizedLocalScore;
      const vectorComponent = mode === "local" ? 0 : Math.max(0, vectorScore);
      const baseScore = mode === "vector"
        ? vectorComponent
        : mode === "hybrid"
          ? vectorComponent * 0.72 + localComponent * 0.28
          : localComponent;
      const sourceWeight = SOURCE_WEIGHT[doc.sourceType] || 1;
      const fusedBeforeRerank = (baseScore + literal.bonus + phraseBoost) * sourceWeight;
      const recencyBonus = computeRetrievalRecencyBonus(normalizedQuery, doc);
      const scoreWithRecency = fusedBeforeRerank + recencyBonus;
      const heuristicScore = retrieval.vectorRerank
        ? scoreWithRecency * 0.8 + vectorComponent * sourceWeight * 0.2 + Math.max(0, doc.importance) * 0.02
        : scoreWithRecency;
      const crossScore = retrieval.vectorRerank && retrieval.vectorCrossEncoderRerank
        ? computeCrossEncoderLiteScore(normalizedQuery, doc)
        : 0;
      const fusedScore = heuristicScore + crossScore * sourceWeight * 0.35 + (crossScore >= 0.55 ? 0.04 : 0);
      return {
        doc,
        baseScore,
        localScore,
        vectorScore,
        sourceWeight,
        fusedScoreBeforeRerank: fusedBeforeRerank,
        fusedScore,
        matchedTokens: [
          ...(exactTitleQueryHit || exactAliasQueryHit ? [compactQueryPhrase] : []),
          ...phraseHits,
          ...literal.matchedTokens,
        ],
        literalPriority: exactTitleQueryHit
          ? 1000 + compactQueryPhrase.length
          : exactAliasQueryHit
            ? 800 + compactQueryPhrase.length
            : phraseHits.reduce((sum, phrase) => sum + phrase.length, 0)
              + (literal.exact !== "none" ? literal.matchedTokens.length : 0),
        strongLiteralPass: exactTitleQueryHit
          || exactAliasQueryHit
          || phraseHits.length > 0
          || (literal.exact !== "none" && literal.matchedTokens.length >= 3 && localScore >= 6),
      };
    });

  let relaxedFallbackReason = "";
  let ranked = scoredRows
    .filter(({ baseScore, strongLiteralPass }) => {
      if (!tokens.length) return true;
      return baseScore >= retrieval.vectorScoreThreshold || strongLiteralPass;
    })
    .sort((a, b) => (
      b.literalPriority - a.literalPriority
      || b.fusedScore - a.fusedScore
      || b.doc.updatedAt - a.doc.updatedAt
    ));

  if (!ranked.length && tokens.length) {
    const localFallbackRows = scoredRows
      .filter(({ localScore, matchedTokens, fusedScoreBeforeRerank }) => localScore > 0 || matchedTokens.length > 0 || fusedScoreBeforeRerank > 0)
      .sort((a, b) => (
        b.localScore - a.localScore
        || b.fusedScoreBeforeRerank - a.fusedScoreBeforeRerank
        || b.doc.importance - a.doc.importance
        || b.doc.updatedAt - a.doc.updatedAt
      ));
    if (localFallbackRows.length) {
      ranked = localFallbackRows;
      relaxedFallbackReason = "向量阈值没有留下候选，本轮已回退到本地关键词候选，避免实时上下文空注入。";
    }
  }

  const localRank = new Map<string, number>();
  ranked
    .slice()
    .sort((a, b) => b.localScore - a.localScore)
    .forEach((row, index) => localRank.set(row.doc.id, row.localScore > 0 ? index + 1 : -1));
  const vectorRank = new Map<string, number>();
  ranked
    .slice()
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .forEach((row, index) => vectorRank.set(row.doc.id, row.vectorScore > 0 ? index + 1 : -1));

  const externallyRelevantRanked = ranked.filter(isRelevantExternalContextRow);
  const relevantRanked = externallyRelevantRanked.length ? externallyRelevantRanked : ranked;
  const literalPrioritizedRows = prioritizeLiteralContextRows(relevantRanked);
  const diversifiedRows = diversifyContextRows(literalPrioritizedRows, effectiveLimit);
  const selectedRows: typeof ranked = [];
  const seenParents = new Set<string>();
  let usedChars = 0;
  for (const row of diversifiedRows) {
    if (selectedRows.length >= effectiveLimit) break;
    const parentKey = row.doc.parentId || row.doc.id;
    if (seenParents.has(parentKey)) continue;
    const remaining = retrieval.vectorContextBudgetChars - usedChars;
    if (remaining <= 0) break;
    seenParents.add(parentKey);
    selectedRows.push(row);
    usedChars += Math.min(row.doc.content.length, remaining);
  }
  const selectedIds = new Set(selectedRows.map((row) => row.doc.id));

  const candidateRows = ranked.slice(0, Math.max(effectiveLimit, 12));
  for (const row of selectedRows) {
    if (!candidateRows.some((candidate) => candidate.doc.id === row.doc.id)) candidateRows.push(row);
  }

  const candidates: LocalRetrievalCandidate[] = candidateRows.map(({ doc, fusedScore, fusedScoreBeforeRerank, localScore, vectorScore, matchedTokens }) => ({
    id: doc.id,
    title: doc.title,
    tags: doc.tags,
    source: doc.sourceType,
    score: fusedScore,
    vectorScore,
    localRank: localRank.get(doc.id) && localRank.get(doc.id)! > 0 ? localRank.get(doc.id)! : null,
    vectorRank: vectorRank.get(doc.id) && vectorRank.get(doc.id)! > 0 ? vectorRank.get(doc.id)! : null,
    fusedScoreBeforeRerank,
    fusedScoreAfterRerank: fusedScore,
    parentId: doc.parentId,
    sourceId: doc.sourceId,
    content: doc.content,
    matchedTokens: matchedTokens.length ? matchedTokens : tokens.filter((token) => localScore > 0 && `${doc.title}\n${doc.content}`.toLowerCase().includes(token)),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    selected: selectedIds.has(doc.id),
  }));

  let snippetChars = 0;
  const snippets: MemorySnippet[] = selectedRows.map(({ doc, fusedScore }) => {
    const remaining = Math.max(0, retrieval.vectorContextBudgetChars - snippetChars);
    const text = doc.content.slice(0, remaining);
    snippetChars += text.length;
    return {
      id: doc.id,
      title: doc.tags.length ? `${doc.title} · ${doc.tags.slice(0, 4).join(" / ")}` : doc.title,
      text,
      source: doc.sourceType,
      score: fusedScore,
    };
  });

  const explanation = [
    `检索模式：${mode}；provider=${queryEmbedding.provider}；model=${queryEmbedding.model}。`,
    embeddingFallbackReason
      ? `远程 embedding 暂不可用，本轮已回退本地 RAG：${embeddingFallbackReason}`
      : runtime.message,
      autoIndexReport.indexed > 0
        ? `已按需补建新记忆/新日记索引：${autoIndexReport.indexed} 条。`
        : autoIndexReport.error
          ? `新记忆/新日记按需补索引失败，已继续使用本地/已有索引召回：${autoIndexReport.error}`
          : "",
      `来源：记忆库 ${entries.length} 条；Obsidian ${listObsidianDocs().length} 条；当前可检索 ${docs.length} 条。`,
      tokens.length ? `分词：${tokens.join(" / ")}` : "当前 query 没有可用关键词。",
      ranked.some((row) => row.strongLiteralPass) ? "精确短语/强关键词命中已允许越过向量阈值，避免专名被泛向量候选压掉。" : "",
      relaxedFallbackReason,
      externallyRelevantRanked.length !== ranked.length ? `外脑弱相关过滤：${ranked.length - externallyRelevantRanked.length} 条。` : "",
      !externallyRelevantRanked.length && ranked.length ? "外脑过滤无剩余候选，本轮已回退到原排序，避免空注入。" : "",
      `来源混排：${Object.entries(sourceMix(snippets)).map(([source, count]) => `${source} ${count}`).join(" / ") || "none"}。`,
    `候选：${ranked.length} 条；注入：${snippets.length} 条；上限：${effectiveLimit} 条；预算：${snippetChars}/${retrieval.vectorContextBudgetChars} 字。`,
    snippets.length
      ? `最高分：${ranked[0]?.fusedScore.toFixed(3) ?? 0}，来自「${ranked[0]?.doc.title ?? ""}」。`
      : "没有召回条目；可以换更具体的关键词，或检查记忆库是否已导入内容。",
  ];

  const base: Omit<LocalRetrievalDebugResult, "cacheHit" | "elapsedMs" | "stats"> = {
    query,
    normalizedQuery,
    cacheKey,
    totalEntries: docs.length,
    candidateCount: ranked.length,
    effectiveLimit,
    tokens,
    candidates,
    snippets,
    explanation,
  };
  retrievalCache.set(cacheKey, base);

  return {
    ...base,
    cacheHit: false,
    elapsedMs: Math.round(performance.now() - startedAt),
    stats: persistRetrievalMiss(cacheKey),
  };
}

function stabilizeLatestStyleSnippets(cacheScope: string | undefined, snippets: MemorySnippet[]): MemorySnippet[] {
  if (!cacheScope) return snippets;
  const byId = new Map(snippets.map((snippet) => [snippet.id, snippet]));
  const priorIds = latestStyleOrderByScope.get(cacheScope) || [];
  const retained = priorIds
    .map((id) => byId.get(id))
    .filter((snippet): snippet is MemorySnippet => Boolean(snippet));
  const retainedIds = new Set(retained.map((snippet) => snippet.id));
  const added = snippets
    .filter((snippet) => !retainedIds.has(snippet.id))
    .sort((left, right) => `${left.source || ""}::${left.id}::${left.title}`.localeCompare(`${right.source || ""}::${right.id}::${right.title}`, "zh-CN"));
  const ordered = [...retained, ...added];
  latestStyleOrderByScope.set(cacheScope, ordered.map((snippet) => snippet.id));
  return ordered;
}

export async function retrieveLatestStyleExamplesDetailed(
  query: string,
  scene: string,
  limit = 2,
  settings?: UplinkSettings | null,
  cacheScope?: string,
): Promise<{ snippets: MemorySnippet[]; recallCount: number; usedChars: number; totalDocs: number }> {
  const cleanQuery = cleanStyleText(query, 1000);
  if (!cleanQuery) return { snippets: [], recallCount: 0, usedChars: 0, totalDocs: 0 };
  await ensurePersistentVectorStoreReady();
  const retrieval = resolveRetrievalSettings(settings);
  const safeLimit = Math.max(1, Math.min(5, Math.floor(Number(limit) || retrieval.latestStyleTopK || 2)));
  const rawKeyword = (retrieval.latestStylePathKeyword || LATEST_STYLE_DEFAULT_PATH_KEYWORD).trim();
  const keyword = normalizeRetrievalQuery(rawKeyword);
  const allDocs = listObsidianDocs();
  let docs = allDocs
    .filter((doc) => {
      const rawHaystack = `${doc.path || ""}\n${doc.sourceId || ""}\n${doc.parentId || ""}\n${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}`;
      const haystack = normalizeRetrievalQuery(rawHaystack);
      return keyword ? haystack.includes(keyword) || rawHaystack.toLowerCase().includes(rawKeyword.toLowerCase()) : isLatestStyleDoc(doc, retrieval);
    })
    .filter((doc) => !isAdultLatestStyleDoc(doc));

  if (!docs.length) {
    docs = allDocs
      .filter((doc) => isLatestStyleDoc(doc, retrieval))
      .filter((doc) => !isAdultLatestStyleDoc(doc));
  }

  const sceneDocs = docs.filter((doc) => styleDocMatchesScene(doc, scene));
  if (sceneDocs.length) docs = sceneDocs;
  const styleDocs = splitLatestStyleDocs(docs);
  if (!styleDocs.length) return { snippets: [], recallCount: 0, usedChars: 0, totalDocs: 0 };

  const sceneQuery = `${cleanQuery}\n场景: ${scene}`;
  const tokens = tokenize(sceneQuery).slice(0, 32);
  let queryEmbedding: { provider: VectorProvider; model: string; vector: number[] };
  try {
    queryEmbedding = await embedText(settings, sceneQuery, "RETRIEVAL_QUERY");
  } catch {
    queryEmbedding = { provider: "local", model: "local-hash-96", vector: localEmbed(sceneQuery) };
  }
  try {
    await ensureDocsIndexed(settings, styleDocs);
  } catch {
    // Keep latest examples available through local lexical/hash scoring when remote embedding is temporarily unavailable.
  }
  const indexById = new Map(listVectorIndex().map((row) => [row.id, row]));
  const rows = styleDocs
    .map((doc) => {
      const vectorRow = indexById.get(doc.id);
      const vectorCompatible = vectorRowMatchesDoc(vectorRow, doc, queryEmbedding.provider, queryEmbedding.model)
        && vectorRow!.vector.length === queryEmbedding.vector.length;
      const vectorScore = vectorCompatible
        ? cosineSimilarity(queryEmbedding.vector, vectorRow!.vector)
        : queryEmbedding.provider === "local"
          ? cosineSimilarity(queryEmbedding.vector, localEmbed(`${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`))
          : 0;
      const lexical = termHitScore(`${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`, tokens);
      const sceneHit = styleDocMatchesScene(doc, scene) ? 0.22 : 0;
      const fusedScore = vectorScore * 0.72 + Math.min(0.28, lexical * 0.015) + sceneHit + Math.max(0, doc.importance) * 0.01;
      return { doc, fusedScore, vectorScore };
    })
    .sort((left, right) => right.fusedScore - left.fusedScore || right.doc.importance - left.doc.importance || right.doc.updatedAt - left.doc.updatedAt);

  const picked: MemorySnippet[] = [];
  const seen = new Set<string>();
  let usedChars = 0;
  for (const row of rows) {
    if (picked.length >= safeLimit) break;
    if (seen.has(row.doc.id)) continue;
    seen.add(row.doc.id);
    const normalized = String(row.doc.content || "").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const remaining = Math.max(0, LATEST_STYLE_SNIPPET_BUDGET);
    const text = normalized.slice(0, remaining);
    usedChars += text.length;
    picked.push({
      id: row.doc.id,
      title: row.doc.title,
      text,
      source: "latest_style_example",
      score: row.fusedScore,
    });
  }

  const snippets = stabilizeLatestStyleSnippets(cacheScope, picked);
  return { snippets, recallCount: rows.length, usedChars, totalDocs: styleDocs.length };
}

export async function retrieveMemorySnippets(query: string, limit = 4, settings?: UplinkSettings | null): Promise<MemorySnippet[]> {
  const result = await retrieveMemorySnippetsDetailed(query, limit, settings);
  recordContextRetrieval(result, settings);
  return result.snippets;
}

export function exportMemoryJson(): string {
  return JSON.stringify(listMemoryEntries(), null, 2);
}

export function importMemoryJson(text: string): MemoryImportStats {
  const payload = JSON.parse(text);
  const incoming = normalizeMemoryEntries(Array.isArray(payload) ? payload : payload?.entries);
  const current = listMemoryEntries();
  const additions: MemoryEntry[] = [];
  const next = [...current];
  const indexById = new Map(next.map((entry, index) => [entry.id, index]));
  let added = 0;
  let merged = 0;

  for (const entry of incoming) {
    const index = indexById.get(entry.id);
    if (index === undefined) {
      additions.push(entry);
      indexById.set(entry.id, next.length + additions.length - 1);
      added += 1;
      continue;
    }

    const existing = next[index];
    const mergedContent = existing.content.trim() || entry.content;
    const mergedTags = uniqueClean([...(existing.tags || []), ...entry.tags], MAX_TAGS);
    const mergedAliases = buildAliases(mergedContent, mergedTags, [
        ...(existing.aliases || []),
        ...entry.aliases,
    ]);
    const mergedEntry: MemoryEntry = {
      ...existing,
      title: existing.title.trim() || entry.title,
      content: mergedContent,
      tags: mergedTags,
      aliases: mergedAliases,
      importance: Math.max(existing.importance, entry.importance),
      createdAt: existing.createdAt || entry.createdAt,
      updatedAt: existing.updatedAt,
      sourceType: existing.sourceType || entry.sourceType,
      sourceId: existing.sourceId || entry.sourceId,
      sourceTitle: existing.sourceTitle || entry.sourceTitle,
    };
    const changed = JSON.stringify(existing) !== JSON.stringify(mergedEntry);
    if (!changed) continue;
    next[index] = { ...mergedEntry, updatedAt: nowIso() };
    merged += 1;
  }

  const mergedEntries = [...additions, ...next];
  saveMemoryEntries(mergedEntries);
  return { entries: mergedEntries, added, merged };
}

export function subscribeVectorStore(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(VECTOR_UPDATE_EVENT, handler);
  return () => window.removeEventListener(VECTOR_UPDATE_EVENT, handler);
}

export function getVectorBuildStatus(): VectorBuildStatus {
  return getBuildStatusFromStore();
}

export function getObsidianDocMeta(settings?: UplinkSettings | null): { count: number; totalChars: number; styleCount: number } {
  const docs = listObsidianDocs();
  const retrieval = resolveRetrievalSettings(settings);
  return {
    count: docs.length,
    totalChars: docs.reduce((sum, doc) => sum + doc.content.length, 0),
    styleCount: docs.filter((doc) => isLatestStyleDoc(doc, retrieval)).length,
  };
}

export function clearObsidianDocs(): void {
  const keptIndex = listVectorIndex().filter((row) => (
    row.sourceType !== "obsidian_note" && !String(row.id || "").startsWith(OBSIDIAN_INDEX_PREFIX)
  ));
  saveVectorIndex(keptIndex);
  saveObsidianDocs([]);
}

export function clearVectorIndex(): VectorBuildStatus {
  saveVectorIndex([]);
  return saveBuildStatus({
    state: "idle",
    progress: 0,
    processed: 0,
    total: 0,
    embedded: 0,
    reused: 0,
    provider: "local",
    model: "local-hash-96",
  });
}

async function ensureDocsIndexed(settings: UplinkSettings | null | undefined, docs: SourceDoc[]): Promise<{ indexed: number; reused: number }> {
  await ensurePersistentVectorStoreReady();
  if (!docs.length) return { indexed: 0, reused: 0 };
  const runtime = getEmbeddingRuntimeStatus(settings);
  const provider = runtime.actualProvider;
  const model = runtime.model;
  const current = listVectorIndex();
  const previousById = new Map(current.map((row) => [row.id, row]));
  const next = [...current];
  const nextById = new Map(next.map((row, index) => [row.id, index]));
  let indexed = 0;
  let reused = 0;

  for (const doc of docs) {
    const fingerprint = docFingerprint(doc);
    const existing = previousById.get(doc.id);
    if (
      existing
      && existing.provider === provider
      && existing.model === model
      && existing.sourceType === doc.sourceType
      && existing.sourceId === doc.sourceId
      && existing.parentId === doc.parentId
      && existing.fingerprint === fingerprint
      && Array.isArray(existing.vector)
      && existing.vector.length > 0
    ) {
      reused += 1;
      continue;
    }

    const text = `${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`;
    const embedded = await embedText(settings, text, "RETRIEVAL_DOCUMENT");
    const row: VectorIndexEntry = {
      id: doc.id,
      updatedAt: Date.now(),
      provider: embedded.provider,
      model: embedded.model,
      dim: embedded.vector.length,
      vector: embedded.vector,
      fingerprint,
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      parentId: doc.parentId,
    };
    const index = nextById.get(doc.id);
    if (typeof index === "number") {
      next[index] = row;
    } else {
      nextById.set(doc.id, next.length);
      next.push(row);
    }
    indexed += 1;
  }

  if (indexed > 0) saveVectorIndex(next);
  return { indexed, reused };
}

export async function syncObsidianChunks(settings: UplinkSettings | null | undefined, chunks: ObsidianChunkInput[]): Promise<{ docs: number; indexed: number; reused: number }> {
  await ensurePersistentVectorStoreReady();
  const normalized = (chunks || [])
    .map((chunk, index) => {
      const rawId = normalizeText(chunk.id || chunk.chunkId || `${chunk.noteId || "note"}:${index}`).trim();
      const id = rawId.startsWith(OBSIDIAN_INDEX_PREFIX) ? rawId : `${OBSIDIAN_INDEX_PREFIX}${rawId}`;
      const noteId = normalizeText(chunk.noteId || chunk.sourceId || rawId.split("#")[0] || `note:${index}`).trim();
      const stage = normalizeText(chunk.stage || "");
      const stageName = normalizeText(chunk.stageName || "");
      const entryType = normalizeText(chunk.entryType || "");
      const tags = Array.isArray(chunk.tags) ? [...chunk.tags] : [];
      const aliases = Array.isArray(chunk.aliases) ? [...chunk.aliases] : [];
      if (stage && !tags.includes(stage)) tags.push(stage);
      if (entryType && !tags.includes(entryType)) tags.push(entryType);
      if (stageName && !aliases.includes(stageName)) aliases.push(stageName);
      return normalizeSourceDoc({
        ...chunk,
        id,
        sourceType: "obsidian_note",
        sourceId: noteId || rawId || `note:${index}`,
        parentId: normalizeText(chunk.parentId || `obsidian:${noteId || rawId || index}`),
        title: normalizeText(chunk.title || noteId || "Obsidian Note"),
        importance: Number.isFinite(Number(chunk.importance)) ? Number(chunk.importance) : 1.25,
        tags,
        aliases,
        stage,
        stageName,
        entryType,
      }, index);
    })
    .filter(Boolean) as SourceDoc[];

  if (!normalized.length) return { docs: 0, indexed: 0, reused: 0 };

  const currentDocs = listObsidianDocs();
  const docMap = new Map(currentDocs.map((doc) => [doc.id, doc]));
  normalized.forEach((doc) => docMap.set(doc.id, doc));
  saveObsidianDocs(Array.from(docMap.values()));
  const report = await ensureDocsIndexed(settings, normalized);
  return { docs: normalized.length, indexed: report.indexed, reused: report.reused };
}

export async function rebuildVectorIndex(
  settings?: UplinkSettings | null,
  options: { signal?: AbortSignal } = {},
): Promise<VectorBuildStatus> {
  await ensurePersistentVectorStoreReady();
  const docs = buildSourceDocs(settings);
  const runtime = getEmbeddingRuntimeStatus(settings);
  const provider = runtime.actualProvider;
  const model = runtime.model;
  const startedAt = Date.now();
  saveBuildStatus({
    state: "running",
    progress: 0,
    processed: 0,
    total: docs.length,
    embedded: 0,
    reused: 0,
    provider,
    model,
    startedAt,
  });
  try {
    const previous = listVectorIndex();
    const previousById = new Map(previous.map((row) => [row.id, row]));
    let reused = 0;
    let embedded = 0;
    const index: VectorIndexEntry[] = [];
    for (let position = 0; position < docs.length; position += 1) {
      if (options.signal?.aborted) {
        return saveBuildStatus({
          state: "paused",
          progress: docs.length ? Math.round((position / docs.length) * 100) : 0,
          processed: position,
          total: docs.length,
          embedded,
          reused,
          provider,
          model,
          startedAt,
          finishedAt: Date.now(),
          error: "索引构建已停止，旧索引已保留。",
        });
      }
      const doc = docs[position];
      const fingerprint = docFingerprint(doc);
      const existing = previousById.get(doc.id);
      if (existing && existing.provider === provider && existing.model === model && existing.fingerprint === fingerprint) {
        reused += 1;
        index.push(existing);
      } else {
        const text = `${doc.title}\n${doc.tags.join(" ")}\n${doc.aliases.join(" ")}\n${doc.content}`;
        const result = await embedText(settings, text, "RETRIEVAL_DOCUMENT");
        if (options.signal?.aborted) {
          return saveBuildStatus({
            state: "paused",
            progress: docs.length ? Math.round((position / docs.length) * 100) : 0,
            processed: position,
            total: docs.length,
            embedded,
            reused,
            provider,
            model,
            startedAt,
            finishedAt: Date.now(),
            error: "索引构建已停止，旧索引已保留。",
          });
        }
        embedded += 1;
        index.push({
          id: doc.id,
          updatedAt: Date.now(),
          provider: result.provider,
          model: result.model,
          dim: result.vector.length,
          vector: result.vector,
          fingerprint,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          parentId: doc.parentId,
        });
      }
      const processed = position + 1;
      saveBuildStatus({
        state: "running",
        progress: docs.length ? Math.round((processed / docs.length) * 100) : 100,
        processed,
        total: docs.length,
        embedded,
        reused,
        provider,
        model,
        startedAt,
      });
      if (processed % Math.max(1, resolveRetrievalSettings(settings).vectorBuildBatchSize) === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, resolveRetrievalSettings(settings).vectorBuildYieldMs));
      }
    }
    saveVectorIndex(index);
    return saveBuildStatus({
      state: "completed",
      progress: 100,
      processed: docs.length,
      total: docs.length,
      embedded,
      reused,
      provider,
      model,
      startedAt,
      finishedAt: Date.now(),
    });
  } catch (error) {
    return saveBuildStatus({
      state: "error",
      progress: 0,
      processed: 0,
      total: docs.length,
      embedded: 0,
      reused: 0,
      provider,
      model,
      startedAt,
      finishedAt: Date.now(),
      error: error instanceof Error ? error.message : "索引构建失败",
    });
  }
}

export function getVectorIndexGuideStatus(settings?: UplinkSettings | null): VectorIndexGuideStatus {
  const docs = buildSourceDocs(settings);
  const runtime = getEmbeddingRuntimeStatus(settings);
  const index = listVectorIndex();
  const indexById = new Map(index.map((row) => [row.id, row]));
  let nonAutoIndexableMissing = 0;
  const reusableCount = docs.reduce((count, doc) => {
    const row = indexById.get(doc.id);
    const reusable = vectorRowMatchesDoc(row, doc, runtime.actualProvider, runtime.model);
    if (!reusable && !isAutoIndexableCoreDoc(doc)) nonAutoIndexableMissing += 1;
    return count + (reusable ? 1 : 0);
  }, 0);
  return {
    totalDocs: docs.length,
    indexCount: index.length,
    reusableCount,
    needsRebuild: docs.length > 0 && nonAutoIndexableMissing > 0,
    runtime,
  };
}

export function getVectorOnDemandStatus(settings?: UplinkSettings | null): VectorOnDemandStatus {
  const retrieval = resolveRetrievalSettings(settings);
  const memoryCount = listMemoryEntries().length;
  const obsidianDocs = listObsidianDocs();
  const obsidianCount = obsidianDocs.length;
  const chronicleDocs = listChronicles().filter((entry) => entry.isActive);
  const totalCount = memoryCount + obsidianCount + chronicleDocs.length;
  const totalChars = listMemoryEntries().reduce((sum, entry) => sum + entry.content.length, 0)
    + obsidianDocs.reduce((sum, doc) => sum + doc.content.length, 0)
    + chronicleDocs.reduce((sum, entry) => sum + entry.content.length, 0);
  const reached = totalCount >= retrieval.vectorOnDemandMinItems || totalChars >= retrieval.vectorOnDemandMinChars;
  const selectedMode = retrieval.memoryRetrievalMode;
  const effectiveMode = retrieval.vectorOnDemandEnabled && reached && selectedMode === "local"
    ? retrieval.vectorOnDemandPromoteMode
    : selectedMode;
  return {
    enabled: retrieval.vectorOnDemandEnabled,
    selectedMode,
    effectiveMode,
    promoteMode: retrieval.vectorOnDemandPromoteMode,
    minItems: retrieval.vectorOnDemandMinItems,
    minChars: retrieval.vectorOnDemandMinChars,
    reached,
    reason: !retrieval.vectorOnDemandEnabled
      ? "disabled"
      : selectedMode !== "local"
        ? "selected_mode_active"
        : reached
          ? "promoted"
          : "below_threshold",
    totalCount,
    totalChars,
    memoryCount,
    obsidianCount,
  };
}

export function getObsidianDiagnostics(settings?: UplinkSettings | null, query = ""): ObsidianDiagnostics {
  const retrieval = resolveRetrievalSettings(settings);
  const provider = resolveActualProvider(settings);
  const model = resolveEmbeddingModel(settings);
  const docs = listObsidianDocs();
  const scoped = docs.filter((doc) => matchesObsidianScope(doc, retrieval));
  const styleDocs = docs.filter((doc) => isLatestStyleDoc(doc, retrieval));
  const index = listVectorIndex();
  const indexById = new Map(index.map((row) => [row.id, row]));
  let reusableForCurrent = 0;
  let missingForCurrent = 0;
  let incompatibleForCurrent = 0;
  let staleForCurrent = 0;
  scoped.forEach((doc) => {
    const row = indexById.get(doc.id);
    if (!row) {
      missingForCurrent += 1;
      return;
    }
    if (row.provider !== provider || row.model !== model) {
      incompatibleForCurrent += 1;
      return;
    }
    if (row.fingerprint !== docFingerprint(doc)) {
      staleForCurrent += 1;
      return;
    }
    reusableForCurrent += 1;
  });
  const tokens = tokenize(query);
  const ranked = scoped
    .map((doc) => {
      const literal = literalBonus(doc, tokens, retrieval);
      const vectorScore = cosineSimilarity(localEmbed(query || doc.title), localEmbed(`${doc.title}\n${doc.content}`));
      return {
        doc,
        score: literal.bonus + Math.max(0, vectorScore),
      };
    })
    .filter((row) => !query.trim() || row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return {
    enabled: retrieval.enableObsidianRetrieval,
    scopeMode: retrieval.obsidianScopeMode,
    scopeCustom: retrieval.obsidianScopeCustom,
    currentProvider: provider,
    currentModel: model,
    indexCount: index.length,
    totalDocs: docs.length,
    totalChars: docs.reduce((sum, doc) => sum + doc.content.length, 0),
    styleDocs: styleDocs.length,
    scopedDocs: scoped.length,
    reusableForCurrent,
    missingForCurrent,
    incompatibleForCurrent,
    staleForCurrent,
    candidateDocs: ranked.length,
    topCandidates: ranked.map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      sourceId: doc.sourceId,
      parentId: doc.parentId,
      chars: doc.content.length,
      score,
      isStyle: isLatestStyleDoc(doc, retrieval),
    })),
  };
}

export function exportVectorIndexBackup(): VectorIndexBackup {
  const index = listVectorIndex();
  const obsidianDocs = listObsidianDocs();
  return {
    schema: "kisera_cottage_vector_index_backup_v1",
    exportedAt: Date.now(),
    app: "kisera-cottage",
    index,
    obsidianDocs,
    meta: {
      indexCount: index.length,
      obsidianDocCount: obsidianDocs.length,
    },
  };
}

export async function downloadVectorIndexBackup(filename = "KI-CO_VECTOR_INDEX.json"): Promise<void> {
  await ensurePersistentVectorStoreReady();
  const payload = exportVectorIndexBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importVectorIndexBackup(text: string): { indexCount: number; obsidianDocCount: number } {
  const payload = JSON.parse(text);
  const rawIndex = Array.isArray(payload?.index) ? payload.index : [];
  const rawDocs = Array.isArray(payload?.obsidianDocs) ? payload.obsidianDocs : [];
  const index = rawIndex
    .filter((row: Partial<VectorIndexEntry>) => row && row.id && Array.isArray(row.vector))
    .map((row: Partial<VectorIndexEntry>) => ({
      id: String(row.id),
      updatedAt: Number(row.updatedAt) || Date.now(),
      provider: (row.provider === "openai" || row.provider === "gemini" || row.provider === "none") ? row.provider : "local",
      model: String(row.model || "local-hash-96"),
      dim: Number(row.dim) || (Array.isArray(row.vector) ? row.vector.length : LOCAL_EMBED_DIM),
      vector: Array.isArray(row.vector) ? row.vector.map((item) => Number(item) || 0) : [],
      fingerprint: String(row.fingerprint || ""),
      sourceType: (row.sourceType === "memory-bank" || row.sourceType === "chronicle" || row.sourceType === "latest_style_example")
        ? row.sourceType
        : "obsidian_note",
      sourceId: String(row.sourceId || row.id),
      parentId: String(row.parentId || row.sourceId || row.id),
    }));
  const docs = rawDocs
    .map((doc: Partial<SourceDoc>, index: number) => normalizeSourceDoc(doc, index))
    .filter(Boolean) as SourceDoc[];
  saveVectorIndex(index);
  saveObsidianDocs(docs);
  saveBuildStatus({
    state: "completed",
    progress: 100,
    processed: index.length,
    total: index.length,
    embedded: index.length,
    reused: 0,
    provider: index[0]?.provider || "local",
    model: index[0]?.model || "local-hash-96",
    finishedAt: Date.now(),
  });
  return { indexCount: index.length, obsidianDocCount: docs.length };
}

export function importObsidianDocs(docs: Partial<SourceDoc>[]): { added: number; total: number } {
  const current = listObsidianDocs();
  const map = new Map(current.map((doc) => [doc.id, doc]));
  let added = 0;
  docs.forEach((doc, index) => {
    const normalized = normalizeSourceDoc({ ...doc, sourceType: "obsidian_note" }, index);
    if (!normalized) return;
    if (!map.has(normalized.id)) added += 1;
    map.set(normalized.id, normalized);
  });
  const next = Array.from(map.values());
  saveObsidianDocs(next);
  return { added, total: next.length };
}
