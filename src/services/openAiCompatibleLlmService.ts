import { Dialogue, Outline, OutlineSection, ResearchResult, Script, ScriptSection, Source } from '../types';

const MAX_API_KEY_LENGTH = 512;

type JsonRecord = Record<string, unknown>;
type OpenAiCompatibleProvider = 'openrouter' | 'ollama';

const safeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const safeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => safeString(item)).filter((item) => item.length > 0);
};

const safeSourceArray = (value: unknown): Source[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((source): Source | null => {
      if (!source || typeof source !== 'object') {
        return null;
      }

      const sourceObject = source as JsonRecord;
      const title = safeString(sourceObject.title).trim();
      const url = safeString(sourceObject.url).trim();
      const snippet = safeString(sourceObject.snippet).trim();

      if (!title && !url && !snippet) {
        return null;
      }

      return {
        title: title || url || 'Untitled source',
        url,
        snippet
      };
    })
    .filter((item): item is Source => item !== null);
};

const safeSectionArray = (value: unknown): OutlineSection[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section, index): OutlineSection | null => {
      if (!section || typeof section !== 'object') {
        return null;
      }

      const sectionObject = section as JsonRecord;
      const rawDuration = Number(sectionObject.duration);

      return {
        id: safeString(sectionObject.id) || `section-${index + 1}`,
        title: safeString(sectionObject.title) || `Section ${index + 1}`,
        keyPoints: safeStringArray(sectionObject.keyPoints),
        duration: Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : 180
      };
    })
    .filter((item): item is OutlineSection => item !== null);
};

const normalizeSpeaker = (value: unknown): 'host' | 'expert' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['host', '主持人', '主持', 'anchor'].includes(normalized)) {
    return 'host';
  }
  if (['expert', '專家', '嘉賓', 'guest'].includes(normalized)) {
    return 'expert';
  }

  return null;
};

const repairIncompleteJson = (jsonStr: string): string => {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  let repaired = jsonStr;
  if (inString) {
    repaired += '"';
  }

  // clean trailing comma or colon
  repaired = repaired.replace(/,\s*$/, '');
  repaired = repaired.replace(/:\s*$/, ': null');

  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
};

export class OpenAiCompatibleLlmService {
  private provider: OpenAiCompatibleProvider;
  private apiKey: string;
  private model: string;
  private baseUrl?: string;

  constructor(options: {
    provider: OpenAiCompatibleProvider;
    apiKey: string;
    model: string;
    baseUrl?: string;
  }) {
    this.provider = options.provider;
    this.apiKey = options.apiKey.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
    this.model = options.model.trim();
    this.baseUrl = options.baseUrl?.trim().replace(/\/+$/, '');
  }

  private isLocalOllamaBaseUrl(): boolean {
    if (this.provider !== 'ollama') {
      return false;
    }

    const normalizedBaseUrl = this.baseUrl || 'https://api.ollama.com';
    try {
      const parsed = new URL(normalizedBaseUrl);
      return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    } catch {
      return false;
    }
  }

  private isLocalhostEnvironment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  private getProxyEndpoints(): string[] {
    return this.isLocalhostEnvironment() ? ['/llm/chat'] : ['/api/llm/chat'];
  }

  private extractJsonRecord(content: string): JsonRecord | null {
    const codeBlockMatch = content.match(/```(?:json)?\s*({[\s\S]*})\s*```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : content;

    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
    } catch {
      try {
        const repaired = repairIncompleteJson(candidate);
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === 'object') return parsed as JsonRecord;
      } catch {
        // Continue to fallback
      }

      const firstBraceIndex = candidate.indexOf('{');
      const lastBraceIndex = candidate.lastIndexOf('}');

      if (firstBraceIndex === -1) {
        return null;
      }

      try {
        if (lastBraceIndex > firstBraceIndex) {
          const substring = candidate.slice(firstBraceIndex, lastBraceIndex + 1);
          const parsed = JSON.parse(substring);
          if (parsed && typeof parsed === 'object') return parsed as JsonRecord;
        }
        
        // Final fallback: try to repair from first opening brace to the end
        const substringToEnd = candidate.slice(firstBraceIndex);
        const repairedSubstring = repairIncompleteJson(substringToEnd);
        const parsed = JSON.parse(repairedSubstring);
        if (parsed && typeof parsed === 'object') return parsed as JsonRecord;
        
        return null;
      } catch {
        return null;
      }
    }
  }

  private normalizeDialogues(rawDialogues: unknown, idSeed: number): Dialogue[] {
    if (!Array.isArray(rawDialogues)) {
      return [];
    }

    let sequence = 0;
    return rawDialogues
      .map((rawItem): Dialogue | null => {
        if (!rawItem || typeof rawItem !== 'object') {
          return null;
        }

        const item = rawItem as JsonRecord;
        const speaker = normalizeSpeaker(item.speaker);
        const text = safeString(item.text).trim();

        if (!speaker || !text) {
          return null;
        }

        sequence += 1;
        const pauseAfterRaw = Number(item.pauseAfter);
        return {
          id: `dialogue_${idSeed}_${sequence}`,
          speaker,
          text,
          pauseAfter: Number.isFinite(pauseAfterRaw) && pauseAfterRaw > 0 ? Math.round(pauseAfterRaw) : undefined
        };
      })
      .filter((dialogue): dialogue is Dialogue => dialogue !== null);
  }

  private parseDialogues(content: string): Dialogue[] {
    const dialogues: Dialogue[] = [];
    const lines = content.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    const speakerRegex = /^(?:[\-\*\d\.\)\s]*)?(?:\[(主持人|專家|Host|Expert)\]|(主持人|專家|Host|Expert)\s*[:：])\s*(.*)$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const speakerMatch = line.match(speakerRegex);
      if (!speakerMatch) {
        continue;
      }

      const speakerToken = (speakerMatch[1] || speakerMatch[2] || '').toLowerCase();
      const speaker: 'host' | 'expert' = ['主持人', 'host'].includes(speakerToken) ? 'host' : 'expert';
      const text = (speakerMatch[3] || '').trim();

      if (!text) {
        continue;
      }

      dialogues.push({
        id: `dialogue_${Date.now()}_${i + 1}`,
        speaker,
        text
      });
    }

    return dialogues;
  }

  private summarizeErrorBody(errorText: string): string {
    const trimmed = errorText.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('<')) {
      const titleMatch = trimmed.match(/<title>([^<]+)<\/title>/i);
      const h1Match = trimmed.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      const details = [titleMatch?.[1], h1Match?.[1]]
        .map((value) => (value ? value.trim() : ''))
        .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
      return details.length > 0 ? details.join(' - ') : 'upstream_html_error';
    }

    return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
  }

  private formatApiError(response: Response, errorText: string): string {
    const detail = this.summarizeErrorBody(errorText);
    const statusText = response.statusText || 'Request Failed';
    
    if (response.status === 400 && errorText.includes('missing_or_invalid_api_key')) {
      return `${this.provider.toUpperCase()} API 金鑰缺失或無效，請於設定面板輸入有效的 API 金鑰。`;
    }
    
    return `${this.provider.toUpperCase()} API 錯誤: ${response.status} ${statusText}${detail ? ` - ${detail}` : ''}`;
  }

  private async requestChatCompletions(payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<Response> {
    const allowAnonymousLocalOllama = this.isLocalOllamaBaseUrl();

    if (
      !allowAnonymousLocalOllama &&
      (!this.apiKey || this.apiKey.length <= 10 || this.apiKey.length > MAX_API_KEY_LENGTH)
    ) {
      throw new Error(`${this.provider.toUpperCase()} API 金鑰格式無效，請重新貼上有效金鑰。`);
    }

    if (!this.model) {
      throw new Error(`${this.provider.toUpperCase()} model 未設定。`);
    }

    const proxyEndpoints = this.getProxyEndpoints();

    for (const endpoint of proxyEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: this.provider,
            apiKey: this.apiKey,
            baseUrl: this.provider === 'ollama' ? this.baseUrl || 'https://api.ollama.com' : undefined,
            payload: {
              ...payload,
              model: this.model
            }
          }),
          signal: options?.signal
        });

        return response;
      } catch (error) {
        if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`${this.provider.toUpperCase()} request failed.`);
      }
    }

    throw new Error(`${this.provider.toUpperCase()} request failed.`);
  }

  async researchTopic(topic: string, options?: { signal?: AbortSignal }): Promise<ResearchResult> {
    const payload = {
      messages: [
        {
          role: 'system',
          content:
            '你是一位資深播客研究員。請輸出 JSON 物件，欄位必須包含 summary、keyPoints、sources。' +
            'summary 需要是可直接寫稿的完整研究摘要；keyPoints 至少 10 條；' +
            'sources 至少 6 筆，且每筆都要有 title、url、snippet。請不要輸出任何 JSON 以外的內容。'
        },
        {
          role: 'user',
          content: `研究以下主題並整理成可直接用於播客腳本的深入資料：${topic}`
        }
      ],
      max_tokens: 4000
    };

    const response = await this.requestChatCompletions(payload, options);
    const errorText = await response.text().catch(() => '');

    if (!response.ok) {
      throw new Error(this.formatApiError(response, errorText));
    }

    let parsedContent: JsonRecord | null = null;
    let content = '';
    
    try {
       const data = JSON.parse(errorText);
       content = safeString(data?.choices?.[0]?.message?.content);
       parsedContent = this.extractJsonRecord(content);
    } catch {
       // Ignore parse error, fallback to extracted/default content
    }

    return {
      topic,
      summary: safeString(parsedContent?.summary, content).trim(),
      keyPoints: safeStringArray(parsedContent?.keyPoints),
      sources: safeSourceArray(parsedContent?.sources),
      timestamp: new Date()
    };
  }

  async generateOutline(research: ResearchResult, options?: { signal?: AbortSignal }): Promise<Outline> {
    const payload = {
      messages: [
        {
          role: 'system',
          content:
            '你是一位專業的播客製作人。請輸出 JSON 物件，欄位包含 title、description、sections。' +
            'sections 必須有 8-12 個段落，每個段落都要有 id、title、keyPoints、duration（秒）。' +
            '不要輸出 JSON 以外內容。'
        },
        {
          role: 'user',
          content:
            `主題: ${research.topic}\n\n` +
            `摘要: ${research.summary}\n\n` +
            `關鍵要點: ${research.keyPoints.join(', ')}`
        }
      ],
      max_tokens: 3200
    };

    const response = await this.requestChatCompletions(payload, options);
    const errorText = await response.text().catch(() => '');

    if (!response.ok) {
      throw new Error(this.formatApiError(response, errorText));
    }

    let parsedContent: JsonRecord | null = null;
    let content = '';

    try {
      const data = JSON.parse(errorText);
      content = safeString(data?.choices?.[0]?.message?.content);
      parsedContent = this.extractJsonRecord(content);
    } catch {
      // Ignore parse error
    }
    
    const sections = safeSectionArray(parsedContent?.sections);

    return {
      title: safeString(parsedContent?.title, `關於 ${research.topic} 的播客`),
      description: safeString(parsedContent?.description, research.summary),
      sections:
        sections.length > 0
          ? sections
          : research.keyPoints.slice(0, 8).map((point, index) => ({
              id: `section-${index + 1}`,
              title: `重點 ${index + 1}`,
              keyPoints: [point],
              duration: 180
            }))
    };
  }

  async generatePodcastScript(
    outline: Outline,
    research: ResearchResult,
    options?: { signal?: AbortSignal; onProgress?: (text: string) => void }
  ): Promise<Script> {
    const idSeed = Date.now();
    let allDialogues: Dialogue[] = [];
    const scriptSections: ScriptSection[] = [];

    let previousContext = '';

    for (let i = 0; i < outline.sections.length; i++) {
      const section = outline.sections[i];
      
      if (options?.onProgress) {
        options.onProgress(`正在撰寫段落 ${i + 1}/${outline.sections.length}: ${section.title}`);
      }

      const payload = {
        messages: [
          {
            role: 'system',
            content:
              '你是一位專業播客編劇。請嚴格輸出 JSON 陣列，包含該段落的對話。不要有 JSON 以外的文字。' +
              '陣列中每個元素必須包含 speaker(host/expert)、text、pauseAfter(可選)。' +
              '請輸出完整逐字稿，不可摘要化。'
          },
          {
            role: 'user',
            content:
              `播客標題：${outline.title}\n` +
              `研究摘要：${research.summary}\n` +
              `目前段落：${section.title}\n` +
              `本段重點：${section.keyPoints.join('；')}\n` +
              `預計長度：${section.duration} 秒\n` +
              (previousContext ? `前一段結尾：\n${previousContext}\n\n請順暢接續上一段。` : '')
          }
        ],
        max_tokens: 3000
      };

      const response = await this.requestChatCompletions(payload, options);
      const errorText = await response.text().catch(() => '');

      if (!response.ok) {
        throw new Error(this.formatApiError(response, errorText));
      }

      let content = '';
      try {
        const data = JSON.parse(errorText);
        content = safeString(data?.choices?.[0]?.message?.content);
      } catch {
        // Ignore parse error
      }
      
      let parsedJson: JsonRecord | JsonRecord[] | null = null;
      try {
        const candidate = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/i)?.[1] || content;
        
        const firstBracket = candidate.indexOf('[');
        const lastBracket = candidate.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket >= firstBracket) {
          try {
            parsedJson = JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
          } catch {
            const repaired = repairIncompleteJson(candidate.slice(firstBracket));
            parsedJson = JSON.parse(repaired);
          }
        } else {
          const record = this.extractJsonRecord(content);
          if (record && Array.isArray(record.dialogues)) {
             parsedJson = record.dialogues;
          }
        }
      } catch {
        // Ignore parse error
      }

      let sectionDialogues = this.normalizeDialogues(parsedJson, idSeed + allDialogues.length);
      if (sectionDialogues.length === 0) {
        sectionDialogues = this.parseDialogues(content);
      }
      
      if (sectionDialogues.length === 0) {
        throw new Error(`${this.provider.toUpperCase()} 腳本解析失敗 (段落: ${section.title})。請重試或更換提供商。`);
      }

      const startIndex = allDialogues.length + 1;
      sectionDialogues = sectionDialogues.map((d, idx) => ({ ...d, id: `dialogue_${idSeed}_${startIndex + idx}` }));
      
      allDialogues = allDialogues.concat(sectionDialogues);
      
      scriptSections.push({
        id: section.id,
        title: section.title,
        dialogueIds: sectionDialogues.map((d) => d.id)
      });
      
      const lastDialogues = sectionDialogues.slice(-3);
      previousContext = lastDialogues.map((d) => `${d.speaker === 'host' ? '主持人' : '專家'}: ${d.text}`).join('\n');
      
      if (i < outline.sections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return {
      id: `script_${Date.now()}`,
      title: outline.title,
      sections: scriptSections,
      dialogues: allDialogues,
      totalDuration: Math.max(600, outline.sections.reduce((sum, section) => sum + section.duration, 0))
    };
  }
}
