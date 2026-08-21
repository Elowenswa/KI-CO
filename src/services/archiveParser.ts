import { ArchiveRole, type ArchiveMessage, type ArchiveSession } from "../storage/archiveDb";

function pickFirstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function safeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeMarker(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function looksLikeMemoryWriteContent(content: string): boolean {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 1000) return false;
  if (/[?？]\s*$/.test(text)) return false;
  const englishLead = /^(the user|user|she|he|they)\s+(is|has|likes|prefers|wants|uses|keeps|needs|enjoys|often|usually|doesn'?t|dislikes|values|cares|believes|works|lives|feels|calls)\b/i;
  const chineseLead = /^(?:\u7528\u6237|\u8be5\u7528\u6237|\u8fd9\u4f4d\u7528\u6237|\u5979|\u4ed6|ta|TA|Ta)[\s\uff1a:，,]*(?:[^。！？!?；;\n]{0,72})?(?:\u559c\u6b22|\u504f\u597d|\u5e0c\u671b|\u60f3\u8981|\u9700\u8981|\u4e0d\u559c\u6b22|\u5728\u610f|\u91cd\u89c6|\u503e\u5411|\u4e60\u60ef|\u8ba4\u4e3a|\u6b63\u5728|\u5df2\u7ecf|\u6682\u65f6|\u4e0d\u78b0|\u5e38|\u4f1a|\u7528|\u79f0\u547c|\u4fdd\u7559|\u8bb0\u5f97|\u662f|\u6709|\u8eab\u9ad8|\u4f53\u91cd|\u5e74\u9f84|\u751f\u65e5|\u804c\u4e1a|\u5de5\u4f5c|\u8d1f\u8d23|\u5c5e\u4e8e|\u4e3b\u8981|\u6765\u81ea|\u4f4f\u5728|\u5f88\u7626|\u611f\u6027|\u6e32\u67d3|\u521b\u610f|\u5efa\u6a21)/i;
  return englishLead.test(text) || chineseLead.test(text);
}

function isReasoningLikeKind(value: unknown): boolean {
  const kind = normalizeMarker(value);
  if (!kind) return false;
  if (kind === "reasoning" || kind === "thought" || kind === "thoughts") return true;
  return kind.includes("reasoning")
    || kind.includes("chain_of_thought")
    || kind.includes("system_chain")
    || kind.includes("system_intervention")
    || kind.includes("safety_switch")
    || kind.includes("safety_log");
}

export class ArchiveParser {
  parse(jsonContent: string, customPersonas: string[] = []): ArchiveSession[] {
    let rawData: unknown;
    try {
      rawData = JSON.parse(jsonContent);
    } catch (error) {
      console.error("[ArchiveParser] JSON parse failed", error);
      throw new Error("Invalid JSON format");
    }

    let sessions: ArchiveSession[] = [];
    if (
      Array.isArray(rawData)
      && rawData.length > 0
      && ((rawData[0] as any)?.mapping || (rawData[0] as any)?.conversation_id)
    ) {
      rawData.forEach((conversation: any) => {
        const threadId = String(conversation?.conversation_id || conversation?.id || safeId("thread"));
        const threadTitle = String(conversation?.title || "Untitled Conversation");
        const messages = this.extractMessagesFromTree(conversation, customPersonas);
        if (!messages.length) return;
        messages.sort((left, right) => (left.timestampObj?.getTime() || 0) - (right.timestampObj?.getTime() || 0));
        sessions.push(this.commitSession(messages, threadId, threadTitle));
      });
    } else {
      const messages = this.normalizeLegacyMessages(rawData, customPersonas);
      messages.sort((left, right) => (left.timestampObj?.getTime() || 0) - (right.timestampObj?.getTime() || 0));
      if (messages.length) sessions = [this.commitSession(messages)];
    }

    return sessions.sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime());
  }

  private extractMessagesFromTree(conversation: any, customPersonas: string[]): ArchiveMessage[] {
    const mapping = conversation?.mapping;
    const defaultModel = conversation?.default_model_slug || conversation?.model_slug || "unknown";
    if (!mapping || typeof mapping !== "object") return [];
    return Object.values(mapping)
      .map((item: any) => item?.message)
      .filter(Boolean)
      .map((message: any) => this.parseSingleMessage(message, customPersonas, defaultModel))
      .filter(Boolean) as ArchiveMessage[];
  }

  private normalizeLegacyMessages(data: any, customPersonas: string[]): ArchiveMessage[] {
    const rawList = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
    return rawList
      .map((raw: any, index: number) => {
        const next = { ...raw };
        if (!next.create_time && !next.timestamp) next.timestamp = Date.now() - (rawList.length - index) * 1000;
        return this.parseSingleMessage(next, customPersonas);
      })
      .filter(Boolean) as ArchiveMessage[];
  }

  private parseSingleMessage(raw: any, customPersonas: string[], defaultModel?: string): ArchiveMessage | null {
    const effectiveRole = String(raw?.author?.role || raw?.role || "").toLowerCase();
    let role = ArchiveRole.SYSTEM;
    if (["user", "human"].includes(effectiveRole)) role = ArchiveRole.USER;
    else if (["assistant", "model", "ai", "bot"].includes(effectiveRole)) role = ArchiveRole.AI;
    else if (effectiveRole === "system") role = ArchiveRole.SYSTEM;
    else if (effectiveRole === "tool" || effectiveRole === "browser") {
      const toolContent = this.extractText(raw).trim();
      if (!this.isMemoryWriteMessage(raw, toolContent)) return null;
      role = ArchiveRole.AI;
    }

    const thoughts = this.extractThoughts(raw);
    let content = this.extractText(raw).trim();
    if (!content) {
      if (thoughts) content = "(System Chain of Thought Log)";
      else return null;
    }

    const timestamp = raw?.create_time
      ? new Date(Number(raw.create_time) * 1000)
      : raw?.timestamp
        ? new Date(raw.timestamp)
        : new Date();

    let speakerName = role === ArchiveRole.USER ? "User" : role === ArchiveRole.AI ? "AI" : "System";
    if (role === ArchiveRole.AI) {
      speakerName = this.detectPersonaInContent(content, customPersonas) || customPersonas[0] || "AI";
    }

    const model = this.extractModelSlug(raw, defaultModel);
    const safetyFlags = this.extractSafetyFlags(raw, model);
    const metadata = this.extractMetadata(raw);
    const archiveKind = this.isMemoryWriteMessage(raw, content) ? "memory_write" : undefined;

    return {
      id: String(raw?.id || safeId("archive-message")),
      role,
      content,
      timestamp: timestamp.toISOString(),
      timestampObj: timestamp,
      speakerName,
      model,
      archiveKind,
      metadata,
      thoughts,
      safetyFlags,
    };
  }

  private extractMetadata(raw: any): Record<string, unknown> {
    const metadata = { ...(raw?.metadata || {}) };
    const recipient = pickFirstNonEmpty(raw?.recipient, raw?.to, raw?.target, raw?.metadata?.recipient);
    const authorRole = pickFirstNonEmpty(raw?.author?.role, raw?.role, raw?.metadata?.author_role);
    const authorName = pickFirstNonEmpty(raw?.author?.name, raw?.name, raw?.metadata?.author_name);
    const contentType = pickFirstNonEmpty(raw?.content?.content_type, raw?.content_type);
    if (recipient && metadata.recipient === undefined) metadata.recipient = recipient;
    if (authorRole && metadata.author_role === undefined) metadata.author_role = authorRole;
    if (authorName && metadata.author_name === undefined) metadata.author_name = authorName;
    if (contentType && metadata.content_type === undefined) metadata.content_type = contentType;
    return metadata;
  }

  private isMemoryWriteMessage(raw: any, content: string): boolean {
    const metadata = raw?.metadata || {};
    const markers = [
      raw?.recipient,
      raw?.to,
      raw?.target,
      raw?.author?.name,
      raw?.name,
      raw?.content?.content_type,
      metadata?.recipient,
      metadata?.to,
      metadata?.target,
      metadata?.tool_name,
      metadata?.recipient_name,
      metadata?.message_type,
      metadata?.command,
      metadata?.author_role,
      metadata?.content_type,
    ].map(normalizeMarker);
    if (markers.some((marker) => marker === "bio" || marker.includes("memory_write") || marker.includes("memory_update") || marker.includes("saved_memory"))) {
      return true;
    }
    const normalizedContent = content.trim();
    return markers.some((marker) => marker.includes("memory") || marker.includes("bio") || marker === "tool")
      && looksLikeMemoryWriteContent(normalizedContent);
  }

  private extractModelSlug(raw: any, defaultModel?: string): string {
    const metadata = raw?.metadata || {};
    const modelObj = metadata?.model || raw?.model_info || {};
    return pickFirstNonEmpty(
      raw?._injected_model_slug,
      raw?.model_slug,
      raw?.model,
      metadata?.model_slug,
      metadata?.default_model_slug,
      metadata?.requested_model_slug,
      metadata?.invoked_model_slug,
      metadata?.model_name,
      modelObj?.slug,
      modelObj?.name,
      raw?.recipient,
      defaultModel,
    ) || "unknown";
  }

  private extractText(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.content === "string") return node.content;

    const parts = Array.isArray(node?.content?.parts)
      ? node.content.parts
      : Array.isArray(node?.parts)
        ? node.parts
        : null;
    if (parts) {
      return parts
        .map((part: any) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const kind = String(part.content_type || part.type || "").toLowerCase();
          if (isReasoningLikeKind(kind)) return "";
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    if (isReasoningLikeKind(node?.content?.content_type || node?.content_type || node?.type)) return "";
    if (typeof node?.content?.content === "string") return node.content.content;
    if (typeof node?.text === "string") return node.text;
    if (typeof node?.message === "string") return node.message;
    return "";
  }

  private extractThoughts(node: any): string | undefined {
    const chunks: string[] = [];
    const thoughts = node?.content?.thoughts;
    if (Array.isArray(thoughts)) {
      chunks.push(...thoughts.map((item: any) => [item?.summary ? `[SUMMARY]: ${item.summary}` : "", item?.content || ""].filter(Boolean).join("\n")).filter(Boolean));
    }

    const partSources = [
      ...(Array.isArray(node?.content?.parts) ? node.content.parts : []),
      ...(Array.isArray(node?.parts) ? node.parts : []),
    ];
    partSources.forEach((part: any) => {
      if (!part || typeof part !== "object") return;
      const kind = String(part.content_type || part.type || "").toLowerCase();
      if (!isReasoningLikeKind(kind)) return;
      const body = typeof part.text === "string" ? part.text : typeof part.content === "string" ? part.content : "";
      if (body.trim()) chunks.push(body.trim());
    });

    const contentKind = node?.content?.content_type || node?.content_type || node?.type;
    if (isReasoningLikeKind(contentKind) && typeof node?.content?.content === "string" && node.content.content.trim()) {
      chunks.push(node.content.content.trim());
    }
    if (isReasoningLikeKind(contentKind) && typeof node?.text === "string" && node.text.trim()) {
      chunks.push(node.text.trim());
    }

    const joined = chunks.join("\n\n").trim();
    return joined || undefined;
  }

  private normalizeModelSlug(value: unknown): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^models\//, "")
      .replace(/^openai\//, "")
      .replace(/^anthropic\//, "");
  }

  private extractSafetyFlags(raw: any, model?: string): string[] {
    const finishDetails = raw?.finish_details || raw?.metadata?.finish_details || {};
    const finishReason = pickFirstNonEmpty(
      raw?.finish_reason,
      raw?.metadata?.finish_reason,
      finishDetails?.type,
      finishDetails?.finish_reason,
    );
    const reasons: string[] = [];
    if (finishReason) reasons.push(finishReason);
    if (Array.isArray(finishDetails?.reasons)) {
      finishDetails.reasons.forEach((reason: unknown) => {
        if (typeof reason === "string" && reason.trim()) reasons.push(reason.trim());
      });
    }

    const normalized = reasons.map((reason) => reason.toLowerCase());
    const flags: string[] = [];
    if (normalized.some((reason) => reason.includes("safety"))) flags.push("safety");
    if (normalized.some((reason) => reason.includes("content_filter") || reason.includes("content-filter"))) flags.push("content_filter");
    if (normalized.some((reason) => reason.includes("recitation"))) flags.push("recitation");
    const metadata = raw?.metadata || {};
    const actualModel = this.normalizeModelSlug(model || raw?._injected_model_slug || raw?.model || metadata?.model_slug);
    const expectedModel = this.normalizeModelSlug(metadata?.default_model_slug || metadata?.requested_model_slug);
    const safetyModelMarkers = [
      "safety",
      "gpt-5-thinking-mini",
      "gpt-5-t-mini",
      "gpt-5.1-t-mini",
      "gpt-oss-safeguard",
    ];
    if (metadata?.show_safety_switch_ui === true) flags.push("safety_ui");
    if (safetyModelMarkers.some((marker) => actualModel.includes(marker))) flags.push("safety_model");
    if (expectedModel && (expectedModel.includes("gpt-4o") || expectedModel.includes("omni")) && actualModel.includes("gpt-5")) {
      flags.push("route_mismatch");
    }
    return Array.from(new Set(flags));
  }

  private detectPersonaInContent(content: string, customPersonas: string[]): string | undefined {
    const trimmed = content.trim();
    for (const name of customPersonas.filter(Boolean)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        `^\\s*[【\\(\\[]${escaped}[】\\)\\]][:：]?`,
        `^\\s*${escaped}[:：]`,
        `^\\s*${escaped}\\s`,
      ];
      if (patterns.some((pattern) => new RegExp(pattern, "i").test(trimmed))) return name;
    }
    return undefined;
  }

  private commitSession(messages: ArchiveMessage[], threadId?: string, threadTitle?: string): ArchiveSession {
    const first = messages[0];
    const last = messages[messages.length - 1];
    const startTime = first.timestampObj || new Date(first.timestamp);
    const endTime = last.timestampObj || new Date(last.timestamp);
    return {
      id: `archive-${threadId ? "thread" : "legacy"}-${startTime.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
      title: threadTitle || `Conversation ${startTime.toLocaleDateString()}`,
      date: startTime.toLocaleDateString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      messages: [...messages],
      messageCount: messages.length,
      threadId,
      threadTitle,
    };
  }
}

export const archiveParser = new ArchiveParser();
