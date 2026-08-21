type SplitMode = "mobile" | "desktop";

export interface ArchiveSplitOptions {
  mode: SplitMode;
  desktopParts?: number;
}

export interface ArchiveSplitPart {
  index: number;
  total: number;
  fileName: string;
  content: string;
  bytes: number;
}

export interface ArchiveSplitResult {
  parts: ArchiveSplitPart[];
  totalBytes: number;
  mode: SplitMode;
}

const MB = 1024 * 1024;
const MOBILE_TARGET_BYTES = 18 * MB;
const MIN_DESKTOP_PARTS = 2;
const DEFAULT_DESKTOP_PARTS = 3;
const MAX_DESKTOP_PARTS = 9;
const LONG_GAP_MS = 6 * 60 * 60 * 1000;
const SOFT_MIN_RATIO = 0.55;

function clampPartCount(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_DESKTOP_PARTS;
  return Math.min(MAX_DESKTOP_PARTS, Math.max(MIN_DESKTOP_PARTS, parsed));
}

function byteSize(value: string): number {
  return new Blob([value]).size;
}

function safeJsonSize(value: unknown): number {
  try {
    return byteSize(JSON.stringify(value));
  } catch {
    return 0;
  }
}

function isConversationTree(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return !!item.mapping || !!item.conversation_id || !!item.id;
}

function getConversationArray(raw: any): { root: any; rootKey: string | null; rows: any[] } {
  if (Array.isArray(raw)) return { root: raw, rootKey: null, rows: raw };
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.conversations)) return { root: raw, rootKey: "conversations", rows: raw.conversations };
    if (Array.isArray(raw.items)) return { root: raw, rootKey: "items", rows: raw.items };
    if (Array.isArray(raw.messages)) return { root: raw, rootKey: "messages", rows: raw.messages };
  }
  throw new Error("没有找到可切割的 JSON 数组。请确认文件是 ChatGPT 导出的 conversations.json。");
}

function materializeRoot(root: any, rootKey: string | null, rows: any[]): unknown {
  if (!rootKey) return rows;
  return { ...root, [rootKey]: rows };
}

function messageTime(entry: [string, any]): number {
  const raw = entry[1]?.message;
  const createTime = Number(raw?.create_time);
  if (Number.isFinite(createTime) && createTime > 0) return createTime * 1000;
  const timestamp = raw?.timestamp ? new Date(raw.timestamp).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function messageRole(entry: [string, any]): string {
  return String(entry[1]?.message?.author?.role || entry[1]?.message?.role || "").toLowerCase();
}

function splitMappingEntries(entries: Array<[string, any]>, targetBytes: number): Array<Array<[string, any]>> {
  if (!entries.length) return [];
  const sorted = [...entries].sort((left, right) => messageTime(left) - messageTime(right));
  const chunks: Array<Array<[string, any]>> = [];
  let current: Array<[string, any]> = [];
  let currentBytes = 2;

  const flush = () => {
    if (!current.length) return;
    chunks.push(current);
    current = [];
    currentBytes = 2;
  };

  sorted.forEach((entry, index) => {
    const entryBytes = safeJsonSize({ [entry[0]]: entry[1] }) + 2;
    const previous = sorted[index - 1];
    const gap = previous ? messageTime(entry) - messageTime(previous) : 0;
    const reachedSoftTarget = currentBytes >= targetBytes * SOFT_MIN_RATIO;
    const shouldSplitOnGap = current.length > 0 && gap > LONG_GAP_MS && reachedSoftTarget;
    if (shouldSplitOnGap) flush();

    current.push(entry);
    currentBytes += entryBytes;

    const role = messageRole(entry);
    const reachedTarget = currentBytes >= targetBytes;
    const isSafeRoleBoundary = role === "assistant" || role === "system";
    const next = sorted[index + 1];
    const nextGap = next ? messageTime(next) - messageTime(entry) : 0;
    if (reachedTarget && (isSafeRoleBoundary || nextGap > LONG_GAP_MS)) flush();
  });

  flush();
  return chunks;
}

function cloneConversationPart(conversation: any, entries: Array<[string, any]>, index: number, total: number): any {
  const mapping = Object.fromEntries(entries);
  const baseId = String(conversation?.conversation_id || conversation?.id || "conversation");
  const partNo = String(index + 1).padStart(2, "0");
  const originalTitle = String(conversation?.title || "Untitled Conversation");
  return {
    ...conversation,
    id: `${baseId}::kico-part-${partNo}`,
    conversation_id: `${baseId}::kico-part-${partNo}`,
    title: `${originalTitle} · Part ${partNo}`,
    mapping,
    kico_split_meta: {
      source: "KI-CO",
      originalConversationId: baseId,
      originalTitle,
      part: index + 1,
      total,
    },
  };
}

function splitLargeConversation(conversation: any, targetBytes: number): any[] {
  const mapping = conversation?.mapping;
  if (!mapping || typeof mapping !== "object") return [conversation];
  const entries = Object.entries(mapping);
  if (!entries.length) return [conversation];
  const chunks = splitMappingEntries(entries, targetBytes);
  if (chunks.length <= 1) return [conversation];
  return chunks.map((chunk, index) => cloneConversationPart(conversation, chunk, index, chunks.length));
}

function makePartName(index: number): string {
  return `KI-CO-GPT-memory-${String(index + 1).padStart(2, "0")}.json`;
}

function packRowsByTarget(root: any, rootKey: string | null, rows: any[], targetBytes: number): ArchiveSplitPart[] {
  const expandedRows = rows.flatMap((row) => {
    const rowSize = safeJsonSize(row);
    if (isConversationTree(row) && rowSize > targetBytes * 1.12) return splitLargeConversation(row, targetBytes);
    return [row];
  });

  const buckets: any[][] = [];
  let current: any[] = [];
  let currentBytes = 2;

  const flush = () => {
    if (!current.length) return;
    buckets.push(current);
    current = [];
    currentBytes = 2;
  };

  expandedRows.forEach((row) => {
    const rowBytes = safeJsonSize(row) + 2;
    if (current.length && currentBytes + rowBytes > targetBytes) flush();
    current.push(row);
    currentBytes += rowBytes;
  });
  flush();

  return buckets.map((bucket, index) => {
    const content = JSON.stringify(materializeRoot(root, rootKey, bucket), null, 2);
    return {
      index,
      total: buckets.length,
      fileName: makePartName(index),
      content,
      bytes: byteSize(content),
    };
  });
}

function packRowsByCount(root: any, rootKey: string | null, rows: any[], partCount: number): ArchiveSplitPart[] {
  const totalBytes = safeJsonSize(materializeRoot(root, rootKey, rows));
  const targetBytes = Math.max(1, Math.ceil(totalBytes / partCount));
  const buckets: any[][] = Array.from({ length: partCount }, () => []);
  const bucketBytes = Array.from({ length: partCount }, () => 2);
  const expandedRows = rows.flatMap((row) => {
    const rowSize = safeJsonSize(row);
    if (isConversationTree(row) && rowSize > targetBytes * 1.3) return splitLargeConversation(row, targetBytes);
    return [row];
  });

  expandedRows
    .map((row) => ({ row, size: safeJsonSize(row) + 2 }))
    .sort((left, right) => right.size - left.size)
    .forEach(({ row, size }) => {
      let targetIndex = 0;
      for (let index = 1; index < buckets.length; index += 1) {
        if (bucketBytes[index] < bucketBytes[targetIndex]) targetIndex = index;
      }
      buckets[targetIndex].push(row);
      bucketBytes[targetIndex] += size;
    });

  const nonEmptyBuckets = buckets.filter((bucket) => bucket.length);
  return nonEmptyBuckets.map((bucket, index) => {
    const content = JSON.stringify(materializeRoot(root, rootKey, bucket), null, 2);
    return {
      index,
      total: nonEmptyBuckets.length,
      fileName: makePartName(index),
      content,
      bytes: byteSize(content),
    };
  });
}

export function splitChatGptArchiveJson(jsonContent: string, options: ArchiveSplitOptions): ArchiveSplitResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonContent);
  } catch {
    throw new Error("JSON 解析失败。请确认文件没有损坏。");
  }

  const { root, rootKey, rows } = getConversationArray(raw);
  if (!rows.length) throw new Error("文件里没有可切割的对话记录。");

  const totalBytes = byteSize(jsonContent);
  const parts = options.mode === "mobile"
    ? packRowsByTarget(root, rootKey, rows, MOBILE_TARGET_BYTES)
    : packRowsByCount(root, rootKey, rows, clampPartCount(options.desktopParts));

  return {
    parts: parts.map((part) => ({ ...part, total: parts.length })),
    totalBytes,
    mode: options.mode,
  };
}

export function downloadArchiveSplitParts(parts: ArchiveSplitPart[]) {
  parts.forEach((part, index) => {
    window.setTimeout(() => {
      const blob = new Blob([part.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = part.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, index * 450);
  });
}
