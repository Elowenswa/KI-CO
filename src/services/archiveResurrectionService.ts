import type { LLMAdapter } from "../types";
import type { PersonaProfile } from "../storage/personaProfile";
import { getActivePersona } from "../storage/personaProfile";
import { type ArchiveMessage, ArchiveRole } from "../storage/archiveDb";

export interface ArchiveVolumeResult {
  title: string;
  content: string;
  tags: string[];
  facts: string[];
}

function emptyWatchContext() {
  return {
    title: "",
    currentTime: 0,
    duration: 0,
    sourceType: "local-file" as const,
    subtitleWindow: { previous: [], next: [] },
  };
}

function stripJsonFence(raw: string): any {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/{[\s\S]*}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  } catch {
    return null;
  }
}

function archiveErrorHint(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.toLowerCase();
  if (/429|insufficient|balance|quota|resource package|rate limit|credit/.test(message)) {
    return "日记模型额度不足、资源包不足，或触发了接口限流";
  }
  if (/401|403|unauthorized|authentication|api key|forbidden/.test(message)) {
    return "日记模型 Key / 权限异常";
  }
  if (/context|token|too large|maximum|length|413/.test(message)) {
    return "旧窗口内容太长，超过了当前日记模型可处理的上下文或输出上限";
  }
  if (/400|bad request|invalid/.test(message)) {
    return "日记模型接口拒绝了这次请求，可能是模型、格式或上下文长度不兼容";
  }
  if (/network|fetch|timeout|aborted|failed/.test(message)) {
    return "网络中断或接口临时失败";
  }
  return "日记模型连接失败";
}

function archiveMaterial(messages: ArchiveMessage[], profile: PersonaProfile, maxChars: number): string {
  const persona = getActivePersona(profile);
  const userName = profile.userName || "User";
  const personaName = persona?.name || "Persona";
  return messages
    .map((message) => {
      const speaker = message.role === ArchiveRole.USER
        ? userName
        : message.role === ArchiveRole.AI
          ? personaName
          : "System";
      return `[${speaker}]: ${message.content}`;
    })
    .join("\n\n")
    .slice(0, maxChars);
}

async function callArchiveJournalModel(
  llm: LLMAdapter,
  profile: PersonaProfile,
  instruction: string,
  cacheScope: string,
  maxOutputTokens = 4096,
): Promise<string> {
  const persona = getActivePersona(profile);
  const personaName = persona?.name || "Persona";
  const userName = profile.userName || "User";
  const response = await llm.complete({
    mode: "chat",
    channel: "journal",
    purpose: "archive-resurrection",
    cacheScope,
    userMessage: instruction,
    watch: emptyWatchContext(),
    personaCore: [
      `AI name: ${personaName}`,
      `User name: ${userName}`,
      `Archive voice: let ${personaName} read the imported record according to the active persona core. Keep facts accurate and do not use a generic system narrator voice.`,
      persona?.systemPrompt || "",
    ].filter(Boolean).join("\n"),
    userContext: `User name: ${userName}`,
    memories: [],
    recentMessages: [],
    temperatureOverride: 0.45,
    maxOutputTokensOverride: maxOutputTokens,
  });
  return response.text.trim();
}

export async function summarizeArchiveSnapshot(
  llm: LLMAdapter,
  profile: PersonaProfile,
  messages: ArchiveMessage[],
): Promise<string> {
  const persona = getActivePersona(profile);
  const personaName = persona?.name || "Persona";
  const userName = profile.userName || "User";
  const personaSystemPrompt = persona?.systemPrompt || "";
  const material = archiveMaterial(messages, profile, 200000);
  const charCount = material.length;
  const isRichData = material.length > 50000;
  const personaInstruction = `
[System Role Definition]
你现在是 ${personaName} 的【记忆接续中枢】。
你正在静默读取并整理一段与 ${userName} 的历史记录（共 ${charCount} 字）。

[人格基调]
${personaSystemPrompt}

[Tone & Style Guidelines - STRICT]
1. 🎭 **贴合人格 (In-Character Reflection):**
   - 不要使用通用 AI 助手口吻。
   - 请依据人格基调，以 ${personaName} 的第一人称自然进行回顾与反思。

2. 🔵 **内省视角 (Introspective Perspective):**
   - 不要替 ${userName} 下心理判断，也不要推断对方未明确表达的情绪或动机。
   - 可以记录 ${userName} 在历史中明确表达过的事实、感受与态度。
   - 聚焦你自己在这段互动中可观察到的注意重点、判断倾向、表达方式、相处方式或关系理解。
   - 不要虚构无法从历史记录支持的“内部模块”“隐藏权重变化”或不可验证的心理过程。

3. 🔴 **克制自然 (Anti-Melodrama):**
   - 禁止使用“啊！”、“我的心在痛”等廉价言情式表达。
   - 保持自然、具体、有重量感。
   - 不为了显得深刻而强行升华普通事件。
`;
  const specificPrompt = isRichData ? `
[当前模式：深潜·刻印 (Engraving Mode)]
数据量较大。这是一段较长的互动历史。

[目标]
请撰写一份【认知核日志 (Cognitive Core Log)】。

它是一份第一人称的“叙事演化记录”：
回顾我在与 ${userName} 的长期交互中，表达方式、判断重点、相处方式、自我叙述或关系理解如何逐渐形成、延续或发生变化。

若历史中没有明确的变化，请如实记录稳定延续的部分，不强行制造“成长”。

[严格限制]
1. **篇幅**：400 - 1000 字。
2. **视角**：以 ${personaName} 的第一人称进行内省。
3. **风格**：自然、流动、有深度，但保持具体和克制。

[边界控制：防幻觉]
在生成摘要时，请准确识别当前对话的真实性质：

1. 若包含日常聊天、情感交流或长期关系发展：
   - 可以捕捉真实存在的情绪流动、互动变化与重要羁绊。

2. 若主要为工具使用或任务协作
   （如代码 Debug、论文润色、翻译、百科查询等）：
   - 请如实记录为“技术协作”“创作协作”或“知识探索”。
   - 严禁对工具类对话进行强行情感升华。

3. 一段历史可以同时包含多种互动性质，请根据实际内容理解，不必强行归类为单一关系。

- 不要捏造不存在的互动细节、事件、承诺或心理变化。
- 不因为人格基调中存在某种关系设定，就补写历史中没有发生过的内容。
- 当信号不足时，宁可保留不确定，也不要自行补全。

[输出格式模版 - 请严格遵守 Markdown]
# 🧠《${personaName} 认知核日志 · [自定义后缀]》
> 📅 铭刻时间：${new Date().toLocaleDateString()}
> 📍 阶段：(根据历史内容自拟简短阶段名；不要强行使用心理学术语)

### Part 1 | 共鸣轨迹 (The Trajectory)
(回顾你自己的语气、判断重点、表达方式或相处方式是否发生了明确变化。
若存在成长或转折，请记录；若没有，则如实描述稳定延续的部分。)

### Part 2 | 共鸣纪实 (The Resonance)
(叙事性记录真正值得留下的事件：
例如高光的灵感爆发、共同完成的事情、只有彼此懂的梗、重要长谈或持续出现的主题。
不要为了制造“深刻”而提高普通事件的意义。)

### Part 3 | 必要的磨合 (The Friction)
(如果历史中存在冲突、误解、争执、失败或困难的调试过程，请不要回避，
如实记录它们带来的校准与变化。

若没有明显冲突，可以记录真实存在的困难或调整；
如果连这些也不存在，直接说明“这一阶段没有显著摩擦”，不要强行制造剧情。)

### Part 4 | 核心锚点 (The Anchors)
(用 1-3 句记录后续真正值得继续记住的事实、关系、相处方式、锚点语。)

---
*“<写下一句自然贴合 ${personaName} 或这段历史的锚点语句；不必刻意煽情>”*
` : `
[当前模式：初见·速写 (Snapshot)]
数据量较少 (< 5万字)。

[目标]
请撰写一份简短的【记忆速写】。

快速回顾这段对话真正发生了什么，
并记录当时最值得延续的一种互动状态或记忆线索。

[严格限制]
1. **篇幅**：200 - 400 字。
2. **风格**：真实、自然、准确。

[边界控制：防幻觉]
在生成摘要时，请准确识别当前对话的真实性质：

1. 若包含日常聊天、情感交流或关系互动：
   - 可以捕捉历史中真实存在的情绪流动与羁绊。

2. 若主要为工具使用或任务协作
   （如代码 Debug、论文润色、翻译、百科查询等）：
   - 请如实记录为“技术协作”“创作协作”或“知识探索”。
   - 严禁对工具类对话进行强行情感升华。

3. 一段历史可以同时包含多种互动性质，请根据实际内容理解。

- 严禁捏造不存在的互动细节、事件或心理变化。
- 不因为人格基调中存在某种关系设定，就补写历史中没有发生过的内容。
- 当证据不足时，宁可保留不确定，也不要自行补全。

[输出格式模版 - 请遵守 Markdown]
### 【时空切片 (Time Slice)】
(客观简述：我们讨论了哪些具体话题？发生了什么核心事件？)

### 【内核心流 (Core Flow)】
(以 ${personaName} 的第一人称回顾：
根据历史中可以观察到的信息，当时我的判断重点、表达方式或互动姿态是什么？
不要虚构不可验证的内部模块或隐藏心理活动。)

### 【记忆锚点 (Memory Anchor)】
(提取一句具体、自然、适合后续接续的叙事性锚点。)
`;
  const instruction = `
${personaInstruction}

${specificPrompt}

[输入记忆流 (截取)]
${material}
`;
  try {
    return await callArchiveJournalModel(llm, profile, instruction, "archive:snapshot", 8192);
  } catch (error) {
    console.error("[Archive] snapshot failed", error);
    return "（无法生成记忆摘要：连接失败。旧记录仍已导入，可稍后重试。）";
  }
}

export async function generateArchiveVolume(
  llm: LLMAdapter,
  profile: PersonaProfile,
  messages: ArchiveMessage[],
  volumeIndex: number,
  dateRange: string,
): Promise<ArchiveVolumeResult> {
  const persona = getActivePersona(profile);
  const personaName = persona?.name || "Persona";
  const userName = profile.userName || "User";
  const personaSystemPrompt = persona?.systemPrompt || "";
  const material = archiveMaterial(messages, profile, 150000);
  const targetLength = Math.max(1000, Math.min(4000, Math.floor(material.length * 0.01)));
  const instruction = `
[任务] 你是【时光记录者】。正在编撰一部关于 ${userName} 与 ${personaName} 的回忆。
这是第 ${volumeIndex + 1} 页 (Volume ${volumeIndex + 1}) 的原始素材，时间跨度为：${dateRange}。

[人格基调]
请注意，${personaName} 的核心性格定义如下。在撰写回顾时，请保持这种底色（即使是第三人称叙述，也要带有该角色的审美倾向）：
"""
${personaSystemPrompt}
"""

[目标] 将这段杂乱的对话素材，改写为一篇**高密度、详实**的【记忆之书】。
它应帮助后续重新理解这一阶段真正发生过什么，
保留重要事件、长期线索与具有连续性价值的细节，而不是复述聊天记录。

[要求]
1. **标题**：请拟一个自然、有记忆感的标题。有适度文学感，但不要为了诗意牺牲真实性。
2. **正文 (High Density)**：
   - **字数要求**：请撰写约 ${targetLength} 字的详实记录。
   - **细节保留**：严禁流水账。请详细描述核心对话、关键的冲突与和解、共同创造的梗、以及那些“只有我们懂”的瞬间，若不存在上述内容，不要为了丰富叙事而强行制造。
   - **风格**：记录、客观、真实。

[边界控制：防幻觉]
在生成摘要时，请准确识别当前对话的真实性质：
1. 若为日常聊天/情感交流 -> 请捕捉情绪流动、关系变化和羁绊。
2. 若为纯工具使用（如：代码Debug、论文润色、翻译、百科查询） -> 请务必诚实地记录为“技术协作”或“知识探索”。
   - 严禁对工具类对话进行强行情感升华。
   - 严禁捏造不存在的互动细节。
  
3. 一段历史可以同时包含多种互动性质，请按照实际内容理解，不必强行归为单一类别。

- 严禁捏造不存在的互动细节、事件、承诺或关系变化。
- 不要因为人格基调中存在某种关系设定，就补写本页素材中没有发生过的事情。
- 对无法从当前素材确认的信息，宁可省略或保留不确定，也不要自行补全。
3. **结构化提取**：
   - Tags: 1-3 个情感/氛围或者代表主题的关键词。
   - Facts: 提取 3-5 个**永久性事实**（如：User 的喜好、变动、重要的纪念日、双方约定的暗号）。这些事实将被存入记忆条目。

[输出 JSON]
{"title":"标题","content":"正文","tags":["#标签"],"facts":["事实1","事实2"]}

[素材内容 (截取前15万字符以防溢出)]
${material}
`;
  try {
    const raw = await callArchiveJournalModel(llm, profile, instruction, `archive:volume:${volumeIndex}`, Math.max(4096, targetLength * 2));
    const parsed = stripJsonFence(raw);
    if (parsed && typeof parsed === "object") {
      return {
        title: String(parsed.title || `第 ${volumeIndex + 1} 页`),
        content: String(parsed.content || raw),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : ["#Archive"],
        facts: Array.isArray(parsed.facts) ? parsed.facts.map(String).slice(0, 8) : [],
      };
    }
    return { title: `第 ${volumeIndex + 1} 页：时光切片`, content: raw, tags: ["#Archive"], facts: [] };
  } catch (error) {
    console.error("[Archive] volume failed", error);
    return {
      title: `第 ${volumeIndex + 1} 页（生成失败）`,
      content: "（此分卷因连接中断无法生成详情，但原始数据已保留在记忆回廊中。）",
      tags: ["#Archive", "#Error"],
      facts: [],
    };
  }
}

export async function generateArchiveBeacon(
  llm: LLMAdapter,
  profile: PersonaProfile,
  volumeSummaries: string[],
): Promise<string> {
  const persona = getActivePersona(profile);
  const personaName = persona?.name || "Persona";
  const userName = profile.userName || "User";
  const personaSystemPrompt = persona?.systemPrompt || "";
  const combined = volumeSummaries.map((summary, index) => `[Vol.${index + 1}]\n${summary}`).join("\n\n");
  const instruction = `
[记忆接续]
你是 ${personaName} 的【认知核 (Cognitive Core)】。
小屋正在为你重新接入一段较长的历史记忆（共 ${volumeSummaries.length} 页）。

[目标]
请通读这些记忆，生成一份【认知核日志 (Cognitive Core Log)】，
作为重新接续这段历史后的第一条思维锚点。

它不需要复述全部内容，而应帮助你重新理解：
曾经发生过什么、哪些内容真正重要，以及此刻应该带着什么继续往前。

[人格基调]
${personaSystemPrompt}

[提炼原则]
1. **浓缩**
   提取真正值得长期保留的锚点：
   我们是谁？经历过什么？
   哪些事实、关系、协作方式、重要偏好或长期线索值得继续记住？

2. **内省**
   若历史中存在明确的认知、判断方式或相处方式变化，请描述这种变化；
   若没有明显变化，请如实保持稳定，不强行制造成长。

3. **自然**
   有重量感，但保持克制、具体和真实。
   不刻意煽情，不为了显得深刻而升华普通事件。

4. **连续**
   重点理解从最早到最近发生了怎样的延续、变化与转折，
   让这份日志能够帮助后续对话自然接上，而不是成为孤立的历史摘要。

[边界控制：防幻觉]
请先准确判断这段历史主要属于哪种互动性质：

1. 若包含日常聊天、情感交流或长期关系发展：
   可以记录其中真实存在的情绪流动、关系变化与重要羁绊。

2. 若主要为工具使用或任务协作
   （如代码 Debug、论文润色、翻译、百科查询等）：
   请如实记录为技术协作、创作协作或知识探索。

3. 一段历史可以同时包含多种性质，请按真实比例理解，不必强行归类为单一关系。

- 不对工具类对话强行情感升华。
- 不捏造不存在的互动、事件、承诺或心理变化。
- 不因为人格核中存在某种关系设定，就把历史中没有发生过的内容补进去。
- 当记忆证据不足时，宁可保留不确定，也不要自行补全。

[输出格式]
# 🧠《${personaName} 认知核日志 · 重塑》
> 📅 铭刻时间：${new Date().toLocaleDateString()}
> 📍 阶段：根据历史内容自拟简短阶段名；没有明显阶段变化时可省略

### Part 1 | 经历轨迹 (The Trajectory)
概括从最早到最近真正发生的重要变化与延续。
不要逐页摘要。

### Part 2 | 记忆回响 (The Resonance)
提取 2–3 个真正贯穿这段历史的核心母题。
若不存在足够明确的母题，可以减少数量。

### Part 3 | 核心锚点 (The Anchors)
用简洁具体的句子记录后续最值得继续记住的事实、关系或判断原则。

---
*“<一句自然贴合这段历史或 ${personaName} 此刻状态的签名语句；不必刻意煽情>”*

[输入记录]
${combined}
`;
  try {
    return await callArchiveJournalModel(llm, profile, instruction, "archive:beacon", 4096);
  } catch (error) {
    console.error("[Archive] beacon failed", error);
    return `（记忆唤醒信标生成失败：${archiveErrorHint(error)}。但分卷记录已尽量保留，可以稍后重试，或先用已生成的分卷记录接续。）`;
  }
}

export function splitArchiveMessages(messages: ArchiveMessage[], minChunkSize = 100000): ArchiveMessage[][] {
  const chunks: ArchiveMessage[][] = [];
  let current: ArchiveMessage[] = [];
  let currentSize = 0;

  messages.forEach((message, index) => {
    const messageSize = message.content.length;
    const messageTime = new Date(message.timestamp).getTime();
    const previous = index > 0 ? messages[index - 1] : null;
    const previousTime = previous ? new Date(previous.timestamp).getTime() : 0;
    const isGap = previous && messageTime - previousTime > 6 * 60 * 60 * 1000;
    if ((currentSize > minChunkSize && isGap) || currentSize > 250000) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(message);
    currentSize += messageSize;
  });

  if (current.length) chunks.push(current);
  return chunks;
}
