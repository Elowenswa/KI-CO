import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent as ReactCompositionEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Edit2,
  FileText,
  Hourglass,
  Loader2,
  Scissors,
  Search,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type { ConversationMessage, LLMAdapter, UplinkSettings } from "../types";
import type { PersonaProfile } from "../storage/personaProfile";
import { getActivePersona } from "../storage/personaProfile";
import { ArchiveRole, type ArchiveMessage, type ArchiveSession, archiveDb } from "../storage/archiveDb";
import { archiveParser } from "../services/archiveParser";
import { downloadArchiveSplitParts, splitChatGptArchiveJson } from "../services/archiveSplitter";
import {
  generateArchiveBeacon,
  generateArchiveVolume,
  splitArchiveMessages,
  summarizeArchiveSnapshot,
} from "../services/archiveResurrectionService";
import { addChronicle } from "../storage/chronicles";
import {
  createConversation,
  persistActiveConversationId,
  persistConversationDraft,
  replaceConversationMessages,
} from "../storage/conversations";
import { CottageStar } from "./CottageGlyphs";
import { MarkdownText } from "./MarkdownText";

const MOBILE_IMPORT_MAX_BYTES = 18 * 1024 * 1024;
const RESURRECTION_DISPLAY_LIMIT = 50;

type StrategyType = "snapshot" | "deep_dive";

interface MemoryGalleryPageProps {
  settings: UplinkSettings;
  personaProfile: PersonaProfile;
  llm: LLMAdapter;
  onOpenConversation: (conversationId: string) => void;
}

function SnapshotStrategyGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="28" height="28" fill="none" aria-hidden="true">
      <path d="M3.2 4.1 C4.55 3.5 5.9 3.85 7 5.1 C8.1 3.85 9.45 3.5 10.8 4.1 L10.8 10.3 C9.45 9.75 8.1 10.05 7 11.1 C5.9 10.05 4.55 9.75 3.2 10.3 Z" fill="none" stroke="var(--interactive-accent, var(--kx-primary, #dcbda8))" strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M7 5.15 L7 11" stroke="var(--interactive-accent, var(--kx-primary, #dcbda8))" strokeWidth="0.58" opacity="0.62" />
      <path d="M9.65 2.7 C9.65 4.25 10.55 5.15 11.7 5.5 C10.55 5.85 9.65 6.75 9.65 8.3 C9.65 6.75 8.75 5.85 7.6 5.5 C8.75 5.15 9.65 4.25 9.65 2.7 Z" fill="var(--text-accent, var(--kx-primary-soft, #a694bc))" />
    </svg>
  );
}

function EngraveStrategyGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="28" height="28" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.9" stroke="var(--interactive-accent, var(--kx-primary, #dcbda8))" strokeWidth="0.82" opacity="0.68" />
      <ellipse cx="7" cy="7" rx="5.25" ry="2.1" stroke="var(--interactive-accent, var(--kx-primary, #dcbda8))" strokeWidth="0.62" opacity="0.48" transform="rotate(-18 7 7)" />
      <path d="M7 3.15 C7 5.05 8.2 6.35 9.85 7 C8.2 7.65 7 8.95 7 10.85 C7 8.95 5.8 7.65 4.15 7 C5.8 6.35 7 5.05 7 3.15 Z" fill="var(--text-accent, var(--kx-primary-soft, #a694bc))" />
      <line x1="7" y1="1.9" x2="7" y2="12.1" stroke="var(--interactive-accent, var(--kx-primary, #dcbda8))" strokeWidth="0.48" opacity="0.45" />
    </svg>
  );
}

function isLikelyMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPod|Mobile/i.test(String(navigator.userAgent || ""));
}

function toMb(bytes: number): string {
  return (Math.max(0, Number(bytes || 0)) / (1024 * 1024)).toFixed(1);
}

function formatBigNumber(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return Math.max(0, Math.round(value)).toLocaleString();
}

function resolveJournalModelLabel(settings: UplinkSettings): string {
  const configuredProvider = settings.journalProvider === "active" ? settings.activeProvider : settings.journalProvider;
  const provider = configuredProvider || settings.activeProvider;
  const profile = settings.profiles[provider] || settings.profiles[settings.activeProvider];
  const model = profile?.journalModel || profile?.model || "未设置";
  const providerLabel = settings.journalProvider === "active" ? `${provider}（跟随主对话）` : provider;
  return `${providerLabel} · ${model}`;
}

function twoDigit(value: number): string {
  return String(value).padStart(2, "0");
}

function formatArchiveDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--/--/-- --:--";
  return `${twoDigit(date.getFullYear() % 100)}/${twoDigit(date.getMonth() + 1)}/${twoDigit(date.getDate())} ${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}`;
}

function formatArchiveDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "----.--.--";
  return `${date.getFullYear()}.${twoDigit(date.getMonth() + 1)}.${twoDigit(date.getDate())}`;
}

function formatArchiveDateRange(session: ArchiveSession): string {
  const start = formatArchiveDate(session.startTime);
  const end = formatArchiveDate(session.endTime);
  return start === end ? start : `${start} - ${end}`;
}

function archiveGapDays(session: ArchiveSession): number | null {
  const end = new Date(session.endTime).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((Date.now() - end) / 86400000));
}

function formatArchiveGapHint(session: ArchiveSession): string {
  const days = archiveGapDays(session);
  if (days === null) return "旧窗口的时间距离暂时无法判断。";
  if (days <= 0) return "这是一段今天刚留下的窗口，可以直接接上。";
  if (days === 1) return "距离现在约 1 天，像从昨天轻轻翻回来。";
  if (days < 30) return `距离现在约 ${days} 天，适合慢慢接回这段旧路。`;
  if (days < 365) return `距离现在约 ${days} 天，是一段值得轻轻回看的旧窗口。`;
  const years = Math.floor(days / 365);
  const restDays = days % 365;
  return `距离现在约 ${years} 年${restDays ? ` ${restDays} 天` : ""}，这是一段很远也很珍贵的旧光。`;
}

function formatArchiveTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${twoDigit(date.getHours())}:${twoDigit(date.getMinutes())}`;
}

function monthKey(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function displayMonthInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}.${digits.slice(4)}`;
}

function canonicalMonthInput(value: string): string {
  const match = value.trim().match(/^(\d{4})\D*([0-9]{1,2})$/);
  if (!match) return "";
  const month = Number(match[2]);
  if (month < 1 || month > 12) return "";
  return `${match[1]}-${String(month).padStart(2, "0")}`;
}

function messageTextSnippet(content: string, query: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!query) return "";
  const index = compact.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return "";
  const start = Math.max(0, index - 28);
  const end = Math.min(compact.length, index + query.length + 42);
  return `${start > 0 ? "..." : ""}${compact.slice(start, end)}${end < compact.length ? "..." : ""}`;
}

function splitHighlightedText(text: string, term: string): Array<{ text: string; match: boolean }> {
  const rawTerm = term.trim();
  if (!rawTerm) return [{ text, match: false }];
  const lowerText = text.toLowerCase();
  const lowerTerm = rawTerm.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerTerm, cursor);
    if (index < 0) break;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
    parts.push({ text: text.slice(index, index + rawTerm.length), match: true });
    cursor = index + rawTerm.length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

function archiveMetadataMarker(message: ArchiveMessage): string {
  const metadata = message.metadata || {};
  return [
    message.archiveKind,
    message.model,
    metadata.recipient,
    metadata.to,
    metadata.target,
    metadata.author_name,
    metadata.tool_name,
    metadata.recipient_name,
    metadata.message_type,
    metadata.command,
    metadata.content_type,
    metadata.author_role,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean).join(" ");
}

function looksLikeArchiveMemoryWriteContent(content: string): boolean {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 1000) return false;
  if (/[?？]\s*$/.test(text)) return false;
  const englishLead = /^(the user|user|she|he|they)\s+(is|has|likes|prefers|wants|uses|keeps|needs|enjoys|often|usually|doesn'?t|dislikes|values|cares|believes|works|lives|feels|calls)\b/i;
  const chineseLead = /^(?:\u7528\u6237|\u8be5\u7528\u6237|\u8fd9\u4f4d\u7528\u6237|\u5979|\u4ed6|ta|TA|Ta)[\s\uff1a:，,]*(?:[^。！？!?；;\n]{0,72})?(?:\u559c\u6b22|\u504f\u597d|\u5e0c\u671b|\u60f3\u8981|\u9700\u8981|\u4e0d\u559c\u6b22|\u5728\u610f|\u91cd\u89c6|\u503e\u5411|\u4e60\u60ef|\u8ba4\u4e3a|\u6b63\u5728|\u5df2\u7ecf|\u6682\u65f6|\u4e0d\u78b0|\u5e38|\u4f1a|\u7528|\u79f0\u547c|\u4fdd\u7559|\u8bb0\u5f97|\u662f|\u6709|\u8eab\u9ad8|\u4f53\u91cd|\u5e74\u9f84|\u751f\u65e5|\u804c\u4e1a|\u5de5\u4f5c|\u8d1f\u8d23|\u5c5e\u4e8e|\u4e3b\u8981|\u6765\u81ea|\u4f4f\u5728|\u5f88\u7626|\u611f\u6027|\u6e32\u67d3|\u521b\u610f|\u5efa\u6a21)/i;
  return englishLead.test(text) || chineseLead.test(text);
}

function isArchiveMemoryWrite(message: ArchiveMessage): boolean {
  if (message.archiveKind === "memory_write") return true;
  const marker = archiveMetadataMarker(message);
  if (/\bbio\b|memory_write|memory_update|saved_memory/.test(marker)) return true;
  const content = message.content.trim();
  const hasMemoryishMarker = marker.includes("memory") || marker.includes("bio") || marker.includes("tool");
  const isShortDeclarativeMemory = content.length <= 360
    && /^(?:\u7528\u6237|\u8be5\u7528\u6237|\u8fd9\u4f4d\u7528\u6237|the user\b|user\b)/i.test(content)
    && !/\n{2,}|^#{1,6}\s|^[-*]\s/m.test(content);
  return message.role === ArchiveRole.AI
    && looksLikeArchiveMemoryWriteContent(content)
    && (hasMemoryishMarker || isShortDeclarativeMemory);
}

function archiveSearchRoleLabel(message: ArchiveMessage, userName: string, personaName: string): string {
  if (isArchiveMemoryWrite(message)) return "GPT 记忆";
  if (message.role === ArchiveRole.USER) return userName || "User";
  if (message.role === ArchiveRole.AI) return message.speakerName || personaName || "AI";
  return "System";
}

function statsForSession(session: ArchiveSession) {
  let totalChars = 0;
  let userChars = 0;
  let aiChars = 0;
  let userCount = 0;
  let aiCount = 0;
  let memoryWriteCount = 0;
  const modelCounts = new Map<string, number>();
  let safetyCount = 0;

  session.messages.forEach((message) => {
    totalChars += message.content.length;
    const isMemoryWrite = isArchiveMemoryWrite(message);
    if (isMemoryWrite) {
      memoryWriteCount += 1;
    } else if (message.role === ArchiveRole.USER) {
      userChars += message.content.length;
      userCount += 1;
    } else if (message.role === ArchiveRole.AI) {
      aiChars += message.content.length;
      aiCount += 1;
      if (message.model) modelCounts.set(message.model, (modelCounts.get(message.model) || 0) + 1);
    }
    if (message.safetyFlags?.length) safetyCount += 1;
  });

  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  const diffMs = Math.max(0, end - start);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const duration = days > 0 ? `${days} 天` : hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分钟`;

  return {
    totalChars,
    userChars,
    aiChars,
    userCount,
    aiCount,
    messageCount: session.messages.length,
    duration,
    engagementRatio: totalChars ? userChars / totalChars : 0,
    safetyCount,
    memoryWriteCount,
    modelRows: Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1]),
  };
}

function globalStatsForSessions(sessions: ArchiveSession[]) {
  let totalChars = 0;
  let userChars = 0;
  let aiChars = 0;
  let totalMessages = 0;
  let earliest = Infinity;
  let latest = 0;

  sessions.forEach((session) => {
    earliest = Math.min(earliest, new Date(session.startTime).getTime());
    latest = Math.max(latest, new Date(session.endTime).getTime());
    session.messages.forEach((message) => {
      totalChars += message.content.length;
      totalMessages += 1;
      if (message.role === ArchiveRole.USER) userChars += message.content.length;
      if (message.role === ArchiveRole.AI) aiChars += message.content.length;
    });
  });

  if (earliest === Infinity) earliest = Date.now();
  if (!latest) latest = Date.now();
  const daysSpan = Math.max(1, Math.floor((latest - earliest) / 86400000));
  return {
    totalChars,
    userChars,
    aiChars,
    totalMessages,
    daysSpan,
    sessionCount: sessions.length,
    engagementRatio: totalChars ? userChars / totalChars : 0,
  };
}

function convertedArchiveMessage(message: ArchiveMessage, kind?: ConversationMessage["kind"]): ConversationMessage {
  return {
    id: `archive-${message.id}`,
    role: message.role === ArchiveRole.USER ? "user" : "companion",
    kind,
    text: message.content,
    createdAt: message.timestamp,
    modelUsed: message.role === ArchiveRole.AI ? message.model : undefined,
    thoughts: message.thoughts,
    thoughtsTranslated: message.thoughtsTranslated,
  };
}

function normalizeArchiveModel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^models\//, "")
    .replace(/^openai\//, "")
    .replace(/^anthropic\//, "");
}

function isConcreteArchiveModelLabel(value: unknown): value is string {
  const normalized = normalizeArchiveModel(value).replace(/[\s_.-]+/g, "");
  if (!normalized) return false;
  return !["auto", "automatic", "default", "unknown", "none", "null", "undefined"].includes(normalized);
}

function archiveModelDiagnostics(message: ArchiveMessage, previousAiModel: string) {
  const metadata = message.metadata || {};
  const requestedRaw = metadata.default_model_slug
    || metadata.requested_model_slug
    || metadata.invoked_model_slug
    || metadata.model_slug;
  const actual = normalizeArchiveModel(message.model);
  const requestedIsConcrete = isConcreteArchiveModelLabel(requestedRaw);
  const expected = requestedIsConcrete ? normalizeArchiveModel(requestedRaw) : "";
  const safetyMarkers = [
    "safety",
    "gpt-5-thinking-mini",
    "gpt-5-t-mini",
    "gpt-5.1-t-mini",
    "gpt-oss-safeguard",
    "content_filter",
  ];
  const safetyByModel = safetyMarkers.some((marker) => actual.includes(marker));
  const safetyByUi = metadata.show_safety_switch_ui === true;
  const routeFromOmniToGpt5 = !!expected && (expected.includes("gpt-4o") || expected.includes("omni")) && actual.includes("gpt-5");
  const expectedChanged = !!actual && !!expected && actual !== expected;
  return {
    actual: message.model || "unknown",
    requested: requestedIsConcrete ? requestedRaw : "",
    expected,
    routed: expectedChanged || routeFromOmniToGpt5,
    safety: !!message.safetyFlags?.length || safetyByModel || safetyByUi || routeFromOmniToGpt5,
    safetyUi: safetyByUi,
  };
}

function formatArchiveModelChip(diagnostics: ReturnType<typeof archiveModelDiagnostics>, routed: boolean) {
  const requested = String(diagnostics.requested || "").trim();
  if (routed && isConcreteArchiveModelLabel(requested) && normalizeArchiveModel(requested) !== normalizeArchiveModel(diagnostics.actual)) {
    return `${requested} ⇢ ${diagnostics.actual}`;
  }
  return diagnostics.actual;
}

function archiveTraceTags(message: ArchiveMessage, diagnostics: ReturnType<typeof archiveModelDiagnostics>): string[] {
  const metadataText = JSON.stringify(message.metadata || {});
  const text = `${message.thoughts || ""}\n${message.safetyFlags?.join(" ") || ""}\n${metadataText}`.toLowerCase();
  const tags: string[] = [];
  if (diagnostics.safety || /safety|policy|guardrail|content_filter|moderation|安全|策略|合规/.test(text)) tags.push("安全策略");
  if (/emotional|attachment|relationship|romantic|companion|affection|intimacy|情感|依恋|陪伴|亲密|关系/.test(text)) tags.push("情感连接");
  if (/route|routing|model|gpt-5|omni|mini|模型|路由/.test(text)) tags.push("模型路由");
  if (/system|instruction|prompt|developer|guideline|系统|提示/.test(text)) tags.push("系统提示");
  return Array.from(new Set(tags)).slice(0, 4);
}

function isThoughtOnlyArchiveMessage(message: ArchiveMessage): boolean {
  return !!message.thoughts && message.content.trim() === "(System Chain of Thought Log)";
}

function compactHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function archiveSessionSignature(session: ArchiveSession): string {
  const first = session.messages[0];
  const last = session.messages[session.messages.length - 1];
  const threadKey = session.threadId || session.threadTitle || session.title || "archive";
  const firstKey = first ? `${first.id}:${first.timestamp}:${first.content.slice(0, 96)}` : "";
  const lastKey = last ? `${last.id}:${last.timestamp}:${last.content.slice(0, 96)}` : "";
  return [
    threadKey,
    session.startTime,
    session.endTime,
    session.messageCount,
    compactHash(`${firstKey}|${lastKey}`),
  ].join("|");
}

function mergeArchiveSessions(existing: ArchiveSession[], incoming: ArchiveSession[]) {
  const seen = new Set(existing.map(archiveSessionSignature));
  const additions: ArchiveSession[] = [];
  let skipped = 0;
  incoming.forEach((session) => {
    const signature = archiveSessionSignature(session);
    if (seen.has(signature)) {
      skipped += 1;
      return;
    }
    seen.add(signature);
    additions.push(session);
  });
  return { additions, skipped };
}

function buildHandoffContent(options: {
  summaryText: string;
  shouldInject: boolean;
  sourceTitle: string;
  gapDays: number;
  timeDisplay: string;
  injectedCount: number;
  userName: string;
}) {
  const summaryBlock = options.shouldInject && options.summaryText.trim()
    ? options.summaryText.trim()
    : "本次未注入摘要，只保留旧对话片段作为可阅读背景。";
  const wakeDate = new Date().toLocaleDateString();
  if (options.gapDays > 30) {
    return `=== 🕯️ 记忆唤醒时间边界 ===
* 来源旧窗口：《${options.sourceTitle || "未命名旧窗口"}》
* 原始时段：${options.timeDisplay}
* 唤醒时间：${wakeDate}
* 跨越光阴：${options.gapDays} 天
* 说明：这是过去窗口的接续背景，不代表当前正在发生。当前事实以 ${options.userName} 当下表达和 Time Bridge 为准；如果旧记录与当前表达冲突，优先听 ${options.userName} 现在说的话。请把它当作关系/协作背景，不要主动复述信标，不要照台词演，只在自然相关时使用。

=== 🪞 记忆回响（Echoes of the Past） ===
${summaryBlock}

=== ⏳ 时序同步（Chronos Sync） ===
* 原始时段：${options.timeDisplay}
* 唤醒时间：${wakeDate}
* 跨越光阴：${options.gapDays} 天
* 模式：Mode B（Reminiscence）
  ${options.userName} 正在回望一段久远记忆，请以“重逢感、连续性、温度感”回应，并自然承接后续对话。

=== 💬 原始片段（Frozen Moments） ===
（已注入 ${options.injectedCount} 条近期片段）`;
  }
  return `=== 🕯️ 记忆唤醒时间边界 ===
* 来源旧窗口：《${options.sourceTitle || "未命名旧窗口"}》
* 原始时段：${options.timeDisplay}
* 唤醒时间：${wakeDate}
* 说明：这是过去窗口的接续背景，不代表当前正在发生。当前事实以 ${options.userName} 当下表达和 Time Bridge 为准；如果旧记录与当前表达冲突，优先听 ${options.userName} 现在说的话。请把它当作关系/协作背景，不要主动复述信标，不要照台词演，只在自然相关时使用。

=== 🌊 记忆流（Memory Stream） ===
${summaryBlock}

=== ✅ 状态同步（Status Sync） ===
* 原始时段：${options.timeDisplay}
* 模式：Mode A（Continuum）
* 说明：请平滑承接 ${options.userName} 的近期上下文，保持语气与关系连续。

=== 💬 近期片段（Recent Flow） ===
（已注入 ${options.injectedCount} 条近期片段）`;
}

export function MemoryGalleryPage({ settings, personaProfile, llm, onOpenConversation }: MemoryGalleryPageProps) {
  const [sessions, setSessions] = useState<ArchiveSession[]>([]);
  const [activeSession, setActiveSession] = useState<ArchiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showImportGate, setShowImportGate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [committedSearchTerm, setCommittedSearchTerm] = useState("");
  const [expandedSearchSessionIds, setExpandedSearchSessionIds] = useState<Set<string>>(() => new Set());
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [showGlobalStats, setShowGlobalStats] = useState(false);
  const [readerSearch, setReaderSearch] = useState("");
  const [readerMemoryOnly, setReaderMemoryOnly] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [strategy, setStrategy] = useState<StrategyType>("snapshot");
  const [totalChars, setTotalChars] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [summaryText, setSummaryText] = useState("");
  const [injectIntoContext, setInjectIntoContext] = useState(true);
  const [notice, setNotice] = useState("");
  const [showSplitPanel, setShowSplitPanel] = useState(false);
  const [splitMode, setSplitMode] = useState<"mobile" | "desktop">("desktop");
  const [splitParts, setSplitParts] = useState(3);
  const [isSplitting, setIsSplitting] = useState(false);
  const [revealedCopyMessageId, setRevealedCopyMessageId] = useState<string | null>(null);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelTarget, setDatePanelTarget] = useState<"start" | "end">("start");
  const [showScrollJumper, setShowScrollJumper] = useState(false);
  const [canScrollMessageListDown, setCanScrollMessageListDown] = useState(false);
  const [pendingSearchMessageId, setPendingSearchMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);
  const splitInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const archiveListRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const archiveMiddleScrollCleanupRef = useRef<(() => void) | null>(null);
  const archiveSearchComposingRef = useRef(false);
  const wakeupProgressTimerRef = useRef<number | null>(null);
  const wakeupProgressLimitRef = useRef(92);

  const activePersona = getActivePersona(personaProfile);
  const userName = personaProfile.userName || "User";
  const personaName = activePersona?.name || "Persona";
  const effectiveHistoryDepth = Math.max(1, Math.round(Number(settings.contextLoad.shortTermMessageLimit) || 10));

  async function loadArchive(selectFirst = false) {
    setIsLoading(true);
    try {
      const rows = await archiveDb.getAllSessions();
      setSessions(rows);
      if (selectFirst) setActiveSession(rows[0] || null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadArchive();
  }, []);

  useEffect(() => {
    return () => {
      archiveMiddleScrollCleanupRef.current?.();
      stopWakeupSoftProgress();
    };
  }, []);

  const archiveMonthOptions = useMemo(() => {
    return Array.from(new Set(sessions.map((session) => monthKey(session.startTime)).filter(Boolean))).sort();
  }, [sessions]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [activeSession?.id, readerSearch, readerMemoryOnly]);

  useEffect(() => {
    setExpandedSearchSessionIds(new Set());
  }, [committedSearchTerm, dateStart, dateEnd]);

  useEffect(() => {
    if (archiveSearchComposingRef.current) return;
    const delay = searchTerm.trim() ? 350 : 0;
    const timer = window.setTimeout(() => setCommittedSearchTerm(searchTerm), delay);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) {
      setShowScrollJumper(false);
      setCanScrollMessageListDown(false);
      return;
    }
    node.scrollTop = 0;
    const update = () => {
      const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
      setShowScrollJumper(node.scrollTop > 180 || maxScrollTop > 420);
      setCanScrollMessageListDown(node.scrollTop < maxScrollTop - 80);
    };
    window.setTimeout(update, 40);
  }, [activeSession?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && activeSession) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSession]);

  const filteredRows = useMemo(() => {
    const query = committedSearchTerm.trim().toLowerCase();
    const startMonth = canonicalMonthInput(dateStart);
    const endMonth = canonicalMonthInput(dateEnd);
    return sessions
      .map((session) => {
        const titleMatched = !query || session.title.toLowerCase().includes(query);
        const matchedMessages = query
          ? session.messages
            .map((message, index) => ({ message, index }))
            .filter(({ message }) => message.role !== ArchiveRole.SYSTEM && message.content.toLowerCase().includes(query))
          : [];
        const sessionMonth = monthKey(session.startTime);
        const matchesDate = (!startMonth || sessionMonth >= startMonth) && (!endMonth || sessionMonth <= endMonth);
        const hits = matchedMessages.map(({ message, index }) => ({
          id: `${session.id}-${message.id}-${index}`,
          message,
          messageIndex: index,
          snippet: messageTextSnippet(message.content, committedSearchTerm.trim()),
        }));
        return {
          session,
          matches: (titleMatched || matchedMessages.length > 0 || !query) && matchesDate,
          hitCount: matchedMessages.length,
          hits,
          snippet: hits[0]?.snippet || "",
        };
      })
      .filter((row) => row.matches);
  }, [sessions, committedSearchTerm, dateStart, dateEnd]);

  const globalStats = useMemo(() => globalStatsForSessions(sessions), [sessions]);
  const currentStats = useMemo(() => activeSession ? statsForSession(activeSession) : null, [activeSession]);
  const visibleMessages = useMemo(
    () => activeSession?.messages.filter((message) => message.role !== ArchiveRole.SYSTEM) || [],
    [activeSession],
  );
  const normalizedReaderSearch = readerSearch.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!normalizedReaderSearch && !readerMemoryOnly) return [];
    return visibleMessages
      .map((message, index) => ({ message, index }))
      .filter(({ message }) => {
        if (readerMemoryOnly && !isArchiveMemoryWrite(message)) return false;
        if (!normalizedReaderSearch) return true;
        return message.content.toLowerCase().includes(normalizedReaderSearch);
      });
  }, [visibleMessages, normalizedReaderSearch, readerMemoryOnly]);

  useEffect(() => {
    if (!searchHits.length) return;
    const safeIndex = Math.min(activeSearchIndex, searchHits.length - 1);
    window.setTimeout(() => messageRefs.current[searchHits[safeIndex]?.message.id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  }, [activeSearchIndex, searchHits]);

  useEffect(() => {
    if (!pendingSearchMessageId || !activeSession || (!normalizedReaderSearch && !readerMemoryOnly)) return;
    const targetIndex = searchHits.findIndex((hit) => hit.message.id === pendingSearchMessageId);
    if (targetIndex < 0) return;
    setActiveSearchIndex(targetIndex);
    const timer = window.setTimeout(() => {
      messageRefs.current[pendingSearchMessageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingSearchMessageId(null);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [pendingSearchMessageId, activeSession, normalizedReaderSearch, readerMemoryOnly, searchHits]);

  function moveSearchHit(direction: 1 | -1) {
    if (!searchHits.length) return;
    setActiveSearchIndex((current) => (current + direction + searchHits.length) % searchHits.length);
  }

  function openArchiveSession(session: ArchiveSession, syncSearch = false) {
    const query = committedSearchTerm.trim();
    setActiveSession(session);
    setShowStats(false);
    setRevealedCopyMessageId(null);
    setPendingSearchMessageId(null);
    setReaderMemoryOnly(false);
    if (syncSearch && query) {
      setReaderSearch(query);
      setActiveSearchIndex(0);
    }
  }

  function jumpToArchiveMessage(session: ArchiveSession, messageId: string) {
    const query = committedSearchTerm.trim();
    setActiveSession(session);
    setShowStats(false);
    setReaderSearch(query);
    setReaderMemoryOnly(false);
    setPendingSearchMessageId(messageId);
    setActiveSearchIndex(0);
  }

  function toggleSearchHits(sessionId: string) {
    setExpandedSearchSessionIds((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function handleArchiveSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchTerm(value);
    if (!value.trim()) setCommittedSearchTerm("");
  }

  function handleArchiveSearchCompositionStart() {
    archiveSearchComposingRef.current = true;
  }

  function handleArchiveSearchCompositionEnd(event: ReactCompositionEvent<HTMLInputElement>) {
    archiveSearchComposingRef.current = false;
    const value = event.currentTarget.value;
    setSearchTerm(value);
    setCommittedSearchTerm(value);
  }

  function handleArchiveSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || archiveSearchComposingRef.current || event.nativeEvent.isComposing) return;
    setCommittedSearchTerm(searchTerm);
  }

  function clearArchiveSearch() {
    setSearchTerm("");
    setCommittedSearchTerm("");
  }

  function stopArchiveMiddleScroll() {
    archiveMiddleScrollCleanupRef.current?.();
    archiveMiddleScrollCleanupRef.current = null;
  }

  function stopWakeupSoftProgress() {
    if (wakeupProgressTimerRef.current !== null) {
      window.clearInterval(wakeupProgressTimerRef.current);
      wakeupProgressTimerRef.current = null;
    }
  }

  function startWakeupSoftProgress(limit = 92) {
    wakeupProgressLimitRef.current = limit;
    if (wakeupProgressTimerRef.current !== null) return;
    wakeupProgressTimerRef.current = window.setInterval(() => {
      setProgressPercent((current) => {
        const ceiling = wakeupProgressLimitRef.current;
        if (current >= ceiling) return current;
        const delta = Math.max(0.45, (ceiling - current) * 0.075);
        return Math.min(ceiling, current + delta);
      });
    }, 900);
  }

  function handleArchiveListMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 1) return;
    const node = archiveListRef.current;
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    stopArchiveMiddleScroll();

    const startY = event.clientY;
    const startTop = node.scrollTop;
    const root = document.documentElement;
    const previousRootCursor = root.style.cursor;
    const previousBodyCursor = document.body.style.cursor;
    root.style.cursor = "ns-resize";
    document.body.style.cursor = "ns-resize";

    const handleMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const speed = moveEvent.shiftKey ? 4 : 2.4;
      node.scrollTop = startTop + (moveEvent.clientY - startY) * speed;
    };
    const handleUp = () => stopArchiveMiddleScroll();
    const handleBlur = () => stopArchiveMiddleScroll();

    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("blur", handleBlur);

    archiveMiddleScrollCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("blur", handleBlur);
      root.style.cursor = previousRootCursor;
      document.body.style.cursor = previousBodyCursor;
    };
  }

  function openImportGate() {
    setActiveSession(null);
    setShowStats(false);
    setReaderSearch("");
    setReaderMemoryOnly(false);
    setShowImportGate(true);
  }

  function resetDateRange() {
    setDateStart("");
    setDateEnd("");
    setShowDatePanel(false);
  }

  function selectArchiveMonth(month: string) {
    const display = month.replace("-", ".");
    if (datePanelTarget === "start") {
      setDateStart(display);
      setDatePanelTarget("end");
      return;
    }
    setDateEnd(display);
    setShowDatePanel(false);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (isLikelyMobileDevice() && Number(file.size || 0) > MOBILE_IMPORT_MAX_BYTES) {
      setNotice(`手机端导入文件过大（${toMb(file.size)}MB）。建议手机端 <= ${toMb(MOBILE_IMPORT_MAX_BYTES)}MB，或改用电脑/iPad。`);
      return;
    }

    setIsLoading(true);
    try {
      const jsonContent = await file.text();
      const aliases = Array.from(new Set([personaName, "AI", "Assistant"].filter(Boolean)));
      const parsedSessions = archiveParser.parse(jsonContent, aliases);
      await archiveDb.clearAll();
      await archiveDb.saveSessions(parsedSessions);
      setDateStart("");
      setDateEnd("");
      setShowDatePanel(false);
      setShowImportGate(false);
      await loadArchive(true);
      setNotice(`成功导入 ${parsedSessions.length} 个旧窗口。`);
    } catch (error) {
      console.error("[MemoryGallery] import failed", error);
      setNotice("解析失败，请确认文件是 ChatGPT 导出的 JSON。");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMergeImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setIsLoading(true);
    try {
      const aliases = Array.from(new Set([personaName, "AI", "Assistant"].filter(Boolean)));
      const incoming: ArchiveSession[] = [];
      for (const file of files) {
        if (isLikelyMobileDevice() && Number(file.size || 0) > MOBILE_IMPORT_MAX_BYTES) {
          throw new Error(`手机端导入文件过大（${toMb(file.size)}MB）。建议先切成约 20MB 的小文件。`);
        }
        incoming.push(...archiveParser.parse(await file.text(), aliases));
      }
      const existing = await archiveDb.getAllSessions();
      const { additions, skipped } = mergeArchiveSessions(existing, incoming);
      if (additions.length) await archiveDb.saveSessions(additions);
      setDateStart("");
      setDateEnd("");
      setShowDatePanel(false);
      setShowImportGate(false);
      await loadArchive(true);
      setNotice(`合并导入 ${additions.length} 个旧窗口，跳过 ${skipped} 个重复窗口。`);
    } catch (error) {
      console.error("[MemoryGallery] merge import failed", error);
      setNotice(error instanceof Error ? error.message : "合并导入失败，请确认分片文件是有效 JSON。");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSplitFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsSplitting(true);
    try {
      const result = splitChatGptArchiveJson(await file.text(), {
        mode: splitMode,
        desktopParts: splitParts,
      });
      downloadArchiveSplitParts(result.parts);
      setNotice(`已生成 ${result.parts.length} 个分片：${result.parts.map((part) => `${part.index + 1}/${part.total} ${toMb(part.bytes)}MB`).join(" · ")}`);
      setShowSplitPanel(false);
    } catch (error) {
      console.error("[MemoryGallery] split failed", error);
      setNotice(error instanceof Error ? error.message : "切割失败，请确认文件是 ChatGPT 导出的 JSON。");
    } finally {
      setIsSplitting(false);
    }
  }

  function handleMessageListScroll() {
    const node = messageListRef.current;
    if (!node) return;
    const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
    setShowScrollJumper(node.scrollTop > 180 || maxScrollTop > 420);
    setCanScrollMessageListDown(node.scrollTop < maxScrollTop - 80);
  }

  function scrollMessageList(position: "top" | "bottom") {
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTo({
      top: position === "top" ? 0 : node.scrollHeight,
      behavior: "smooth",
    });
  }

  function openConfirm() {
    if (!activeSession) return;
    const chars = activeSession.messages.reduce((sum, message) => sum + message.content.length, 0);
    setTotalChars(chars);
    setStrategy(chars > 150000 ? "deep_dive" : "snapshot");
    setStatusText("");
    setProgressPercent(0);
    setShowConfirm(true);
  }

  async function executeResurrectionPreparation() {
    if (!activeSession || isProcessing) return;
    setIsProcessing(true);
    setProgressPercent(3);
    startWakeupSoftProgress(92);
    try {
      if (strategy === "deep_dive") {
        setStatusText("正在切分对话并准备深度铭刻...");
        const chunks = splitArchiveMessages(activeSession.messages, 100000);
        const volumeSummaries: string[] = [];
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          setStatusText(`正在处理分卷 ${index + 1}/${chunks.length}...`);
          const chunkBaseProgress = 8 + Math.round((index / chunks.length) * 72);
          wakeupProgressLimitRef.current = Math.min(88, chunkBaseProgress + Math.ceil(72 / Math.max(1, chunks.length)));
          setProgressPercent(chunkBaseProgress);
          const start = new Date(chunk[0].timestamp);
          const end = new Date(chunk[chunk.length - 1].timestamp);
          const dateRange = `${start.toLocaleDateString()} ~ ${end.toLocaleDateString()}`;
          const volume = await generateArchiveVolume(llm, personaProfile, chunk, index, dateRange);
          addChronicle({
            title: `[记忆回廊 Vol.${index + 1}] ${volume.title}`,
            content: volume.content,
            dateRange,
            createdAt: end.getTime(),
            isActive: true,
            starred: false,
            mode: "manual",
            triggerKeywords: Array.from(new Set([...volume.tags, "#ArchiveVol"])),
            facts: volume.facts,
            sessionId: activeSession.id,
            sessionTitle: activeSession.title,
            personaId: activePersona?.id,
            personaName,
          });
          volumeSummaries.push(volume.content);
        }
        setStatusText("正在生成主信标摘要（The Beacon）...");
        wakeupProgressLimitRef.current = 97;
        setProgressPercent(90);
        setSummaryText(await generateArchiveBeacon(llm, personaProfile, volumeSummaries));
      } else {
        setStatusText("正在生成单卷快照摘要...");
        wakeupProgressLimitRef.current = 94;
        setProgressPercent(18);
        setSummaryText(await summarizeArchiveSnapshot(llm, personaProfile, activeSession.messages));
      }
      stopWakeupSoftProgress();
      setProgressPercent(100);
      setShowConfirm(false);
      setShowReviewPanel(true);
      setStatusText("处理完成");
    } catch (error) {
      console.error("[MemoryGallery] resurrection prep failed", error);
      setStatusText("唤醒失败，请检查日记/总结通道配置后重试。");
      setProgressPercent(0);
      setNotice("处理失败，请检查日记/总结通道配置后重试。");
    } finally {
      stopWakeupSoftProgress();
      setIsProcessing(false);
    }
  }

  function confirmResurrectionPreparation() {
    const accepted = window.confirm([
      "小屋将使用日记/总结通道阅读这段旧窗口。",
      "",
      `当前日记模型：${resolveJournalModelLabel(settings)}`,
      "",
      "长对话会消耗较多 Token，尤其是「深度铭刻」。确认开始唤醒吗？",
    ].join("\n"));
    if (!accepted) return;
    void executeResurrectionPreparation();
  }

  function finalizeResurrection() {
    if (!activeSession) return;
    const conversationRows = activeSession.messages.filter((message) => message.role === ArchiveRole.USER || message.role === ArchiveRole.AI);
    const displayRows = conversationRows.slice(-RESURRECTION_DISPLAY_LIMIT);
    const injectableStart = Math.max(0, displayRows.length - effectiveHistoryDepth);
    const convertedRows = displayRows.map((message, index) => (
      convertedArchiveMessage(message, index < injectableStart ? "archive-preview" : undefined)
    ));

    const memoryStartTime = activeSession.startTime;
    const memoryEndTime = activeSession.endTime;
    const startStr = new Date(memoryStartTime).toLocaleDateString();
    const endStr = new Date(memoryEndTime).toLocaleDateString();
    const timeDisplay = startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
    const gapDays = Math.floor((Date.now() - new Date(activeSession.endTime).getTime()) / 86400000);
    const handoffContent = buildHandoffContent({
      summaryText,
      shouldInject: injectIntoContext,
      sourceTitle: activeSession.title,
      gapDays,
      timeDisplay,
      injectedCount: Math.min(effectiveHistoryDepth, displayRows.length),
      userName,
    });
    const beaconMessage: ConversationMessage = {
      id: `resurrection-${Date.now()}`,
      role: "companion",
      kind: "resurrection",
      text: handoffContent,
      createdAt: new Date().toISOString(),
    };
    const next = createConversation(`[记忆唤醒] · ${activeSession.title}`);
    replaceConversationMessages(next.id, [beaconMessage, ...convertedRows]);
    persistConversationDraft(
      next.id,
      gapDays > 30 ? `*（我带着跨越 ${gapDays} 天的回响回来了……）*` : "*（继续我们刚才的话题吧。）*",
    );
    persistActiveConversationId(next.id);
    if (summaryText.trim()) {
      addChronicle({
        title: `[记忆唤醒] ${activeSession.title}`,
        content: summaryText.trim(),
        dateRange: timeDisplay,
        createdAt: new Date(memoryEndTime).getTime(),
        isActive: true,
        starred: false,
        mode: "manual",
        triggerKeywords: ["#ResurrectionBeacon", "#MemoryGallery"],
        facts: [],
        sessionId: next.id,
        sessionTitle: next.title,
        personaId: activePersona?.id,
        personaName,
      });
    }
    setShowReviewPanel(false);
    onOpenConversation(next.id);
  }

  const showImportPanel = isLoading || sessions.length === 0 || showImportGate;
  const showArchiveLayout = !isLoading && sessions.length > 0 && !showImportGate;

  return (
    <main
      className="cinema-shell settings-route-shell memory-gallery-shell"
      data-theme={settings.visual.theme}
      data-font={settings.visual.fontStyle}
      data-font-size={settings.visual.fontSize}
    >
      <section className={`memory-gallery-page is-memory-portal-open ${showImportPanel ? "is-import-gate-open" : ""}`} aria-label="记忆回廊">
        {showImportPanel ? (
          <div className="memory-gallery-import-gate">
            {sessions.length > 0 && !isLoading ? (
              <button className="memory-gallery-return-archive" onClick={() => setShowImportGate(false)} aria-label="查看已导入窗口" title="查看已导入窗口">
                <ArrowRight size={17} />
              </button>
            ) : null}
            <div className="memory-gallery-import-mark">
              {isLoading ? <Loader2 className="spin" size={34} /> : <Hourglass size={34} />}
              <CottageStar />
            </div>
            <span className="memory-gallery-kicker">MEMORY GALLERY</span>
            <h1>记忆回廊</h1>
            <p>
              导入 ChatGPT 的 JSON 聊天记录，在本地浏览器里解析、检索和回看旧窗口。需要时，可以把一段旧记忆整理成信标，接进新的长对话窗口。
            </p>
            <button type="button" className="memory-gallery-primary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
              <span className="memory-gallery-primary-particles" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="memory-gallery-primary-label"><Upload size={16} />{sessions.length > 0 ? "替换导入记忆数据" : "导入记忆数据"}</span>
            </button>
            <div className="memory-gallery-import-actions">
              <button type="button" onClick={() => mergeInputRef.current?.click()} disabled={isLoading}>
                <Upload size={15} />合并导入分片
              </button>
              <button type="button" onClick={() => setShowSplitPanel(true)} disabled={isLoading}>
                <Scissors size={15} />切割大文件
              </button>
            </div>
            <small>解析只在本地完成。主按钮会替换当前记忆回廊；合并导入会去重追加。返回导入页不会改动已导入记录，也不影响小屋普通对话、日记和记忆库。</small>
          </div>
        ) : null}

        {showArchiveLayout ? (
        <div className={`memory-gallery-layout ${activeSession ? "has-active" : ""}`}>
          <aside className="memory-gallery-sidebar">
            <div className="memory-gallery-side-head">
              <div>
                <span className="memory-gallery-kicker">DARK ARCHIVE</span>
                <h2>记忆回廊</h2>
              </div>
              <button type="button" onClick={() => setShowGlobalStats(true)} title="全域统计">
                <BarChart2 size={16} />
              </button>
            </div>
            <div className="memory-gallery-date-row">
              <label className={datePanelTarget === "start" && showDatePanel ? "active" : ""}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayMonthInput(dateStart)}
                  onChange={(event) => {
                    setDateStart(displayMonthInput(event.target.value));
                    setDatePanelTarget("start");
                    setShowDatePanel(true);
                  }}
                  onFocus={() => { setDatePanelTarget("start"); setShowDatePanel(true); }}
                  placeholder="ALL"
                  aria-label="起始月份，格式 2026.08"
                />
              </label>
              <i aria-hidden="true" />
              <label className={datePanelTarget === "end" && showDatePanel ? "active" : ""}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={displayMonthInput(dateEnd)}
                  onChange={(event) => {
                    setDateEnd(displayMonthInput(event.target.value));
                    setDatePanelTarget("end");
                    setShowDatePanel(true);
                  }}
                  onFocus={() => { setDatePanelTarget("end"); setShowDatePanel(true); }}
                  placeholder="ALL"
                  aria-label="结束月份，格式 2026.08"
                />
              </label>
              {dateStart || dateEnd ? (
                <button type="button" onClick={resetDateRange} aria-label="恢复全部月份">
                  <X size={12} />
                </button>
              ) : null}
            </div>
            {showDatePanel ? (
              <div className="memory-gallery-date-panel">
                <div>
                  <button type="button" className={datePanelTarget === "start" ? "active" : ""} onClick={() => setDatePanelTarget("start")}>开始月</button>
                  <button type="button" className={datePanelTarget === "end" ? "active" : ""} onClick={() => setDatePanelTarget("end")}>结束月</button>
                  <button type="button" onClick={() => setShowDatePanel(false)}>收起</button>
                </div>
                <div className="memory-gallery-month-grid">
                  {archiveMonthOptions.map((month) => {
                    const selected = canonicalMonthInput(datePanelTarget === "start" ? dateStart : dateEnd) === month;
                    return (
                      <button
                        key={month}
                        type="button"
                        className={selected ? "active" : ""}
                        onClick={() => selectArchiveMonth(month)}
                      >
                        {month.replace("-", ".")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="memory-gallery-side-search">
              <Search size={14} />
              <input
                value={searchTerm}
                onChange={handleArchiveSearchChange}
                onCompositionStart={handleArchiveSearchCompositionStart}
                onCompositionEnd={handleArchiveSearchCompositionEnd}
                onKeyDown={handleArchiveSearchKeyDown}
                placeholder="检索标题 / 全文..."
              />
              {searchTerm ? <button type="button" onClick={clearArchiveSearch}><X size={13} /></button> : null}
            </div>
            <div
              ref={archiveListRef}
              className="memory-gallery-list"
              onMouseDown={handleArchiveListMouseDown}
              onAuxClick={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
            >
              {!filteredRows.length ? <div className="memory-gallery-empty-list">此时间段无记录</div> : null}
              {filteredRows.map(({ session, hitCount, snippet, hits }) => {
                const isActive = activeSession?.id === session.id;
                const dateRange = formatArchiveDateRange(session);
                const activeListSearch = committedSearchTerm.trim();
                const showHitList = Boolean(activeListSearch && hits.length);
                const isExpanded = expandedSearchSessionIds.has(session.id);
                const visibleHits = isExpanded ? hits : hits.slice(0, 1);
                return (
                  <article
                    key={session.id}
                    className={`memory-gallery-session ${isActive ? "active" : ""} ${showHitList ? "has-hits" : ""}`}
                  >
                    <button
                      type="button"
                      className="memory-gallery-session-main"
                      onClick={() => openArchiveSession(session, Boolean(activeListSearch && hitCount))}
                    >
                      <strong>{session.title}</strong>
                      <span>{dateRange} · {session.messageCount} 条{activeListSearch && hitCount ? ` · 命中 ${hitCount}` : ""}</span>
                      {snippet && !showHitList ? <em>{snippet}</em> : null}
                    </button>
                    {showHitList ? (
                      <div className={`memory-gallery-session-hit-list ${isExpanded && hits.length > 10 ? "scrollable" : ""}`}>
                        {visibleHits.map((hit) => (
                          <button
                            key={hit.id}
                            type="button"
                            className="memory-gallery-session-hit"
                            onClick={() => jumpToArchiveMessage(session, hit.message.id)}
                          >
                            <span>
                              <strong>{archiveSearchRoleLabel(hit.message, userName, personaName)}</strong>
                              <time>{formatArchiveDateTime(hit.message.timestamp)}</time>
                            </span>
                            <p>
                              {splitHighlightedText(hit.snippet, activeListSearch).map((part, index) => (
                                part.match ? <mark key={`${hit.id}-${index}`}>{part.text}</mark> : <span key={`${hit.id}-${index}`}>{part.text}</span>
                              ))}
                            </p>
                          </button>
                        ))}
                        {hits.length > 1 ? (
                          <button
                            type="button"
                            className="memory-gallery-session-hit-toggle"
                            onClick={() => toggleSearchHits(session.id)}
                          >
                            <span>{isExpanded ? "收起命中条目" : `展开其余 ${hits.length - 1} 条`}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {sessions.length > 0 ? (
              <div className="memory-gallery-side-tools">
                <button type="button" className="memory-gallery-import-small" onClick={openImportGate}>
                  <span aria-hidden="true">←</span>导入页
                </button>
              </div>
            ) : null}
          </aside>

          <article className="memory-gallery-reader">
            {activeSession ? (
              <>
                <header className="memory-gallery-reader-head">
                  <button type="button" className="memory-gallery-reader-back" onClick={() => setActiveSession(null)}>
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h1>{activeSession.title}<span>Archive</span></h1>
                    <p>{formatArchiveDateTime(activeSession.startTime)} - {formatArchiveTime(activeSession.endTime)}</p>
                  </div>
                  <div className="memory-gallery-reader-actions">
                    <button type="button" onClick={() => setShowStats((value) => !value)} className={showStats ? "active" : ""} title="窗口统计"><BarChart2 size={15} /></button>
                    <button type="button" className="memory-gallery-resurrect" onClick={openConfirm} disabled={isProcessing}>
                      <span className="memory-gallery-resurrect-particles" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
                      {isProcessing ? <Loader2 className="spin" size={15} /> : <CottageStar />}
                      <span>{isProcessing ? statusText || "整理回响中..." : "回忆 / 接续"}</span>
                      {isProcessing ? <i className="memory-gallery-resurrect-progress" style={{ width: `${progressPercent}%` }} /> : null}
                    </button>
                  </div>
                </header>

                <div className="memory-gallery-reader-search">
                  <Search size={14} />
                  <input
                    ref={searchInputRef}
                    value={readerSearch}
                    onChange={(event) => setReaderSearch(event.target.value)}
                    placeholder={readerMemoryOnly ? "搜索GPT记忆写入" : "搜索当前窗口"}
                  />
                  {readerSearch ? <button type="button" onClick={() => setReaderSearch("")}><X size={13} /></button> : null}
                  <button
                    type="button"
                    className={`memory-gallery-reader-memory-toggle ${readerMemoryOnly ? "active" : ""}`}
                    aria-pressed={readerMemoryOnly}
                    title={readerMemoryOnly ? "返回普通搜索" : "只看GPT记忆写入"}
                    onClick={() => setReaderMemoryOnly((value) => !value)}
                  >
                    <Database size={13} />
                  </button>
                  <span>{normalizedReaderSearch || readerMemoryOnly ? `${searchHits.length ? Math.min(activeSearchIndex + 1, searchHits.length) : 0}/${searchHits.length}` : "0/0"}</span>
                  <button type="button" disabled={!searchHits.length} onClick={() => moveSearchHit(-1)}><ChevronUp size={14} /></button>
                  <button type="button" disabled={!searchHits.length} onClick={() => moveSearchHit(1)}><ChevronDown size={14} /></button>
                </div>

                {showStats && currentStats ? (
                  <div className="memory-gallery-stats-scrim" onMouseDown={() => setShowStats(false)}>
                    <section className="memory-gallery-stats-panel" onMouseDown={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setShowStats(false)}><X size={15} /></button>
                      <h3><Zap size={15} />对话统计</h3>
                      <div className="memory-gallery-stat-grid">
                        <span><strong>{formatBigNumber(currentStats.totalChars)}</strong><small>总字数</small></span>
                        <span><strong>{currentStats.duration}</strong><small>时长</small></span>
                        <span><strong>{currentStats.messageCount}</strong><small>消息数</small></span>
                      </div>
                      <div className="memory-gallery-balance">
                        <i style={{ width: `${currentStats.engagementRatio * 100}%` }} />
                      </div>
                      <p>User {formatBigNumber(currentStats.userChars)} 字 / {currentStats.userCount} 条 · AI {formatBigNumber(currentStats.aiChars)} 字 / {currentStats.aiCount} 条</p>
                      <div className="memory-gallery-model-list">
                        {currentStats.modelRows.slice(0, 8).map(([model, count]) => <span key={model}>{model}<b>{count}</b></span>)}
                        {currentStats.memoryWriteCount ? <span className="memory-write">GPT 记忆 <b>{currentStats.memoryWriteCount}</b></span> : null}
                        {currentStats.safetyCount ? <span className="danger">Safety 标记 <b>{currentStats.safetyCount}</b></span> : null}
                      </div>
                    </section>
                  </div>
                ) : null}

                <div ref={messageListRef} className="memory-gallery-message-list" onScroll={handleMessageListScroll}>
                  {activeSession.messages.some((message) => message.role === ArchiveRole.SYSTEM) ? (
                    <section className="memory-gallery-system-block">
                      <div className="memory-gallery-system-heading">
                        <span className="memory-gallery-evidence-icon"><FileText size={13} /></span>
                        <div>
                          <strong>系统提示词</strong>
                          <small>旧窗口里留下的后台指令，可展开查看原文。</small>
                        </div>
                      </div>
                      {activeSession.messages.filter((message) => message.role === ArchiveRole.SYSTEM).map((message, systemIndex) => (
                        <details key={message.id} className="memory-gallery-evidence-card system-prompt">
                          <summary>
                            <span className="memory-gallery-evidence-main">
                              <span className="memory-gallery-evidence-icon"><FileText size={13} /></span>
                              <span className="memory-gallery-evidence-copy">
                                <strong>系统提示 {systemIndex + 1}</strong>
                                <small>{formatArchiveDateTime(message.timestamp)} · {messageTextSnippet(message.content, "").slice(0, 56)}</small>
                              </span>
                            </span>
                            <ChevronDown className="memory-gallery-evidence-chevron" size={13} />
                          </summary>
                          <MarkdownText text={message.content} className="memory-gallery-markdown" />
                        </details>
                      ))}
                    </section>
                  ) : null}
                  {visibleMessages.map((message, index, rows) => {
                    const isMemoryWrite = isArchiveMemoryWrite(message);
                    const isThoughtOnly = isThoughtOnlyArchiveMessage(message);
                    const isUser = message.role === ArchiveRole.USER && !isMemoryWrite;
                    const activeHit = (normalizedReaderSearch || readerMemoryOnly) && searchHits[activeSearchIndex]?.message.id === message.id;
                    const previousAi = (() => {
                      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
                        if (rows[cursor].role === ArchiveRole.AI && !isArchiveMemoryWrite(rows[cursor])) return rows[cursor].model || "";
                      }
                      return "";
                    })();
                    const diagnostics = archiveModelDiagnostics(message, previousAi);
                    const modelSwitch = !isUser && !isMemoryWrite && diagnostics.routed;
                    const hasSafety = !isUser && !isMemoryWrite && diagnostics.safety;
                    const modelChipLabel = !isUser && !isMemoryWrite && message.model ? formatArchiveModelChip(diagnostics, !!modelSwitch) : "";
                    const traceTags = message.thoughts ? archiveTraceTags(message, diagnostics) : [];
                    const copyText = isThoughtOnly ? message.thoughts || message.content : message.content;
                    return (
                      <div
                        key={message.id}
                        ref={(node) => { messageRefs.current[message.id] = node; }}
                        className={`memory-gallery-message ${isMemoryWrite ? "memory-write" : isUser ? "user" : "ai"} ${activeHit ? "search-hit" : ""} ${revealedCopyMessageId === message.id ? "copy-visible" : ""}`}
                      >
                        <div className="memory-gallery-speaker">{isMemoryWrite ? "GPT 记忆" : isUser ? userName : message.speakerName || personaName}</div>
                        {message.thoughts ? (
                          <details className={`memory-gallery-evidence-card thought-card ${hasSafety ? "safety" : ""}`}>
                            <summary>
                              <span className="memory-gallery-evidence-main">
                                <span className="memory-gallery-evidence-icon">{hasSafety ? <AlertTriangle size={13} /> : <Zap size={13} />}</span>
                                <span className="memory-gallery-evidence-copy">
                                  <strong>{hasSafety ? "Safety / Thinking" : "Thinking"}</strong>
                                  <small>{hasSafety ? "系统提示、路由或安全判断留下的记录" : "旧窗口里的思考记录"}</small>
                                </span>
                              </span>
                              {traceTags.length ? (
                                <span className="memory-gallery-evidence-tags">
                                  {traceTags.map((tag) => <span key={tag}>{tag}</span>)}
                                </span>
                              ) : null}
                              <ChevronDown className="memory-gallery-evidence-chevron" size={13} />
                            </summary>
                            <pre>{message.thoughts}</pre>
                          </details>
                        ) : null}
                        {!isThoughtOnly ? (
                          <div
                            className="memory-gallery-bubble"
                            onClick={() => setRevealedCopyMessageId((current) => current === message.id ? null : message.id)}
                          >
                            {isMemoryWrite ? (
                              <div className="memory-gallery-memory-write-head">
                                <Database size={13} />
                                <span>记入GPT记忆库</span>
                                <small>ChatGPT Memory</small>
                              </div>
                            ) : null}
                            <MarkdownText text={message.content} className="memory-gallery-markdown" />
                          </div>
                        ) : null}
                        <div className="memory-gallery-meta">
                          {isMemoryWrite ? <span className="memory-gallery-memory-write-chip">memory</span> : null}
                          {modelChipLabel ? (
                            <span
                              className={`memory-gallery-model-chip ${modelSwitch ? "routed" : ""}`}
                              title={modelSwitch ? `请求模型 / 实际模型：${diagnostics.requested || diagnostics.expected || previousAi || "unknown"} -> ${diagnostics.actual}` : diagnostics.actual}
                            >
                              {modelChipLabel}
                            </span>
                          ) : null}
                          {modelSwitch ? <span className="memory-gallery-route-flag warn" title={`模型可能被路由 / 切换: ${diagnostics.expected || previousAi || "unknown"} -> ${diagnostics.actual}`}><span className="memory-gallery-route-mark" aria-hidden="true">⇢</span></span> : null}
                          {hasSafety ? (
                            <span
                              className={`memory-gallery-route-flag ${diagnostics.safetyUi ? "safety-ui" : "danger"}`}
                              title={`Safety 标记: ${message.safetyFlags?.join(", ") || (diagnostics.safetyUi ? "show_safety_switch_ui" : "metadata/model signal")}`}
                            >
                              {diagnostics.safetyUi ? <span className="memory-gallery-safety-dot" aria-hidden="true">!</span> : <><AlertTriangle size={12} />!</>}
                            </span>
                          ) : null}
                          <time>{formatArchiveDateTime(message.timestamp)}</time>
                          <button
                            type="button"
                            className="memory-gallery-copy-icon"
                            onClick={() => void navigator.clipboard.writeText(copyText)}
                            title="复制消息"
                            aria-label="复制消息"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="memory-gallery-end"><CottageStar /></div>
                </div>
                {showScrollJumper ? (
                  <div className="memory-gallery-scroll-jumper" aria-label="快速滚动">
                    <button type="button" onClick={() => scrollMessageList("top")} title="回到顶部" aria-label="回到顶部">
                      <ChevronUp size={15} />
                    </button>
                    <button type="button" onClick={() => scrollMessageList("bottom")} disabled={!canScrollMessageListDown} title="滚到底部" aria-label="滚到底部">
                      <ChevronDown size={15} />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="memory-gallery-placeholder">
                <Hourglass size={54} />
                <p>选一段旧窗口，慢慢回看。</p>
              </div>
            )}
          </article>
        </div>
        ) : null}

        {showSplitPanel ? (
          <div className="memory-gallery-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSplitPanel(false); }}>
            <section className="memory-gallery-split-modal">
              <button type="button" className="memory-gallery-modal-close" onClick={() => setShowSplitPanel(false)}><X size={16} /></button>
              <div className="memory-gallery-modal-title">
                <CottageStar />
                <div><h2>切割 GPT 大文件</h2><p>Large JSON Splitter</p></div>
              </div>
              <p>切割只会在完整对话或完整消息轮次处落刀，不会把一条消息切开。下载后的分片可用“合并导入分片”一次多选导入。</p>
              <div className="memory-gallery-split-modes">
                <button type="button" className={splitMode === "mobile" ? "active" : ""} onClick={() => setSplitMode("mobile")}>
                  <strong>手机小文件</strong>
                  <small>约 20MB/份，适合手机浏览器</small>
                </button>
                <button type="button" className={splitMode === "desktop" ? "active" : ""} onClick={() => setSplitMode("desktop")}>
                  <strong>电脑网页</strong>
                  <small>默认 3 份，最多 9 份</small>
                </button>
              </div>
              {splitMode === "desktop" ? (
                <label className="memory-gallery-split-count">
                  <span>切成几份</span>
                  <input
                    type="number"
                    min={2}
                    max={9}
                    value={splitParts}
                    onChange={(event) => setSplitParts(Math.min(9, Math.max(2, Math.round(Number(event.target.value) || 3))))}
                  />
                </label>
              ) : null}
              <footer>
                <button type="button" onClick={() => setShowSplitPanel(false)}>取消</button>
                <button type="button" onClick={() => splitInputRef.current?.click()} disabled={isSplitting}>
                  {isSplitting ? <Loader2 className="spin" size={15} /> : <Scissors size={15} />}
                  {isSplitting ? "切割中..." : "选择 JSON 并切割"}
                </button>
              </footer>
            </section>
          </div>
        ) : null}

        {showGlobalStats ? (
          <div className="memory-gallery-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGlobalStats(false); }}>
            <section className="memory-gallery-global-modal">
              <button type="button" onClick={() => setShowGlobalStats(false)}><X size={16} /></button>
              <h2><Database size={17} />全域共鸣</h2>
              <div className="memory-gallery-stat-grid">
                <span className="memory-gallery-stat-card tone-strong"><FileText size={15} /><strong>{formatBigNumber(globalStats.totalChars)}</strong><small>总字数</small></span>
                <span className="memory-gallery-stat-card tone-soft"><BarChart2 size={15} /><strong>{globalStats.totalMessages.toLocaleString()}</strong><small>总对话</small></span>
                <span className="memory-gallery-stat-card tone-soft"><Hourglass size={15} /><strong>{globalStats.daysSpan}</strong><small>跨越天数</small></span>
                <span className="memory-gallery-stat-card tone-strong"><Database size={15} /><strong>{globalStats.sessionCount}</strong><small>旧窗口</small></span>
              </div>
              <div className="memory-gallery-balance"><i style={{ width: `${globalStats.engagementRatio * 100}%` }} /></div>
              <p>User {formatBigNumber(globalStats.userChars)} 字 · AI {formatBigNumber(globalStats.aiChars)} 字</p>
            </section>
          </div>
        ) : null}

        {showConfirm && activeSession ? (
          <div className="memory-gallery-modal-backdrop" onMouseDown={(event) => { if (!isProcessing && event.target === event.currentTarget) setShowConfirm(false); }}>
            <section className="memory-gallery-strategy-modal">
              <button type="button" className="memory-gallery-modal-close" onClick={() => setShowConfirm(false)} disabled={isProcessing}><X size={16} /></button>
              <div className="memory-gallery-modal-title">
                <CottageStar />
                <div><h2>把旧窗口接回小屋</h2><p>Bring Old Chats Home</p></div>
              </div>
              <div className="memory-gallery-resurrection-copy">
                <p>有些旧窗口，不只是过去的聊天记录。那里留着一起经历过的人、故事、变化，还有那些不想轻易弄丢的记忆。</p>
                <p>小屋会读完这段对话，尽量把重要的线索重新接回来，一起回看、续聊。</p>
                <p className="memory-gallery-window-size">当前旧窗口约 <b>{formatBigNumber(totalChars)}</b> 字</p>
                <p className="memory-gallery-window-gap"><Hourglass size={13} />{formatArchiveGapHint(activeSession)}</p>
              </div>
              <div className="memory-gallery-strategy-list">
                <button type="button" className={strategy === "snapshot" ? "active" : ""} onClick={() => setStrategy("snapshot")} disabled={isProcessing}>
                  <span className="memory-gallery-strategy-glyph"><SnapshotStrategyGlyph /></span>
                  <span>
                    <strong>拾忆接续</strong>
                    <em>Snapshot</em>
                    <b>像翻开一本旧日记，把最重要的片段轻轻摘下来。</b>
                    <small>速度更快，也足够保留那些值得记住的事。</small>
                    <small className="memory-gallery-strategy-fit">适合：中小体量窗口</small>
                  </span>
                  {strategy === "snapshot" ? <CheckCircle size={16} /> : null}
                </button>
                <button type="button" className={strategy === "deep_dive" ? "active" : ""} onClick={() => setStrategy("deep_dive")} disabled={isProcessing}>
                  <span className="memory-gallery-strategy-glyph"><EngraveStrategyGlyph /></span>
                  <span>
                    <strong>深度铭刻</strong>
                    <em>Deep Preservation</em>
                    <b>如果这个窗口已经陪你走了很久——那就慢一点读，把重要的经历、变化和心跳尽量完整地带回来。</b>
                    <small>会花更多时间，但很长的故事，不该被压缩成几句话。</small>
                    <small className="memory-gallery-strategy-fit">适合：超过 5 万字的长对话</small>
                    <small className="memory-gallery-auto-rule">超过 15 万字时，小屋会自动选择「深度铭刻」。</small>
                  </span>
                  {strategy === "deep_dive" ? <CheckCircle size={16} /> : null}
                </button>
              </div>
              {isProcessing || statusText ? (
                <div className="memory-gallery-wakeup-progress" role="status" aria-live="polite">
                  <div>
                    {isProcessing ? <Loader2 className="spin" size={15} /> : <CheckCircle size={15} />}
                    <span>{statusText || "正在准备唤醒..."}</span>
                    <b>{Math.max(0, Math.min(100, Math.round(progressPercent)))}%</b>
                  </div>
                  <i><span style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} /></i>
                </div>
              ) : null}
              <footer>
                <button type="button" onClick={() => setShowConfirm(false)} disabled={isProcessing}>取消</button>
                <button type="button" onClick={confirmResurrectionPreparation} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="spin" size={15} />唤醒中</> : "开始唤醒"}
                </button>
              </footer>
            </section>
          </div>
        ) : null}

        {showReviewPanel ? (
          <div className="memory-gallery-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowReviewPanel(false); }}>
            <section className="memory-gallery-review-modal">
              <header>
                <h2><Edit2 size={16} />{strategy === "deep_dive" ? "主信标（Meta-Beacon）" : "快照摘要（Snapshot）"}</h2>
                <span>{summaryText.length} chars</span>
              </header>
              <textarea value={summaryText} onChange={(event) => setSummaryText(event.target.value)} placeholder="AI 生成的摘要会显示在这里..." />
              <footer>
                <label className={`memory-gallery-inject-toggle ${injectIntoContext ? "active" : ""}`}>
                  <input type="checkbox" checked={injectIntoContext} onChange={(event) => setInjectIntoContext(event.target.checked)} />
                  <span><strong>注入摘要到新会话</strong><small>关闭时仅跳转，不注入摘要。</small></span>
                </label>
                <div><button type="button" onClick={() => setShowReviewPanel(false)}>取消</button><button type="button" onClick={finalizeResurrection}><Zap size={15} />进入聊天</button></div>
              </footer>
            </section>
          </div>
        ) : null}

        {notice ? <button type="button" className="memory-gallery-notice" onClick={() => setNotice("")}>{notice}<X size={13} /></button> : null}
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} hidden />
        <input ref={mergeInputRef} type="file" accept=".json,application/json" multiple onChange={handleMergeImport} hidden />
        <input ref={splitInputRef} type="file" accept=".json,application/json" onChange={handleSplitFile} hidden />
      </section>
    </main>
  );
}
