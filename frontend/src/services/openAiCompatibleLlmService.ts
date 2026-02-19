import { Dialogue, Outline, OutlineSection, ResearchResult, Script, ScriptSection, Source } from '../types';

const LOCAL_LLM_PROXY_URL = '/llm/chat';
const DEPLOY_LLM_PROXY_URL = '/api/llm/chat';
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
    if (this.isLocalhostEnvironment()) {
      return [LOCAL_LLM_PROXY_URL];
    }

    return [DEPLOY_LLM_PROXY_URL, LOCAL_LLM_PROXY_URL];
  }

  private extractJsonRecord(content: string): JsonRecord | null {
    const codeBlockMatch = content.match(/```(?:json)?\s*({[\s\S]*})\s*```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : content;

    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
    } catch {
      const firstBraceIndex = candidate.indexOf('{');
      const lastBraceIndex = candidate.lastIndexOf('}');

      if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
        return null;
      }

      try {
        const parsed = JSON.parse(candidate.slice(firstBraceIndex, lastBraceIndex + 1));
        return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
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
    return `${this.provider.toUpperCase()} API 錯誤: ${response.status} ${statusText}${detail ? ` - ${detail}` : ''}`;
  }

  private async requestChatCompletions(payload: Record<string, unknown>): Promise<Response> {
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
    let unavailableCount = 0;

    for (const endpoint of proxyEndpoints) {
      try {
        const proxyResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: this.provider,
            apiKey: this.apiKey || '',
            baseUrl: this.provider === 'ollama' ? this.baseUrl : undefined,
            payload: {
              ...payload,
              model: this.model
            }
          })
        });

        if (proxyResponse.status === 404 || proxyResponse.status === 405) {
          unavailableCount += 1;
          continue;
        }

        return proxyResponse;
      } catch {
        unavailableCount += 1;
      }
    }

    if (unavailableCount >= proxyEndpoints.length) {
      throw new Error(
        `${this.provider.toUpperCase()} proxy is unavailable. Please run through local Vite proxy or deploy \`/api/llm/chat\`.`
      );
    }

    throw new Error(`${this.provider.toUpperCase()} request failed via proxy.`);
  }

  async researchTopic(topic: string): Promise<ResearchResult> {
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

    const response = await this.requestChatCompletions(payload);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(this.formatApiError(response, errorText));
    }

    const data = await response.json();
    const content = safeString(data?.choices?.[0]?.message?.content);
    const parsedContent = this.extractJsonRecord(content);

    return {
      topic,
      summary: safeString(parsedContent?.summary, content).trim(),
      keyPoints: safeStringArray(parsedContent?.keyPoints),
      sources: safeSourceArray(parsedContent?.sources),
      timestamp: new Date()
    };
  }

  async generateOutline(research: ResearchResult): Promise<Outline> {
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

    const response = await this.requestChatCompletions(payload);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(this.formatApiError(response, errorText));
    }

    const data = await response.json();
    const content = safeString(data?.choices?.[0]?.message?.content);
    const parsedContent = this.extractJsonRecord(content);
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

  async generatePodcastScript(outline: Outline, research: ResearchResult): Promise<Script> {
    const payload = {
      messages: [
        {
          role: 'system',
          content:
            '你是一位專業播客編劇。請輸出 JSON 物件，包含 title 與 sections。' +
            'sections 必須是陣列，每個元素包含 id、title、dialogues。' +
            'dialogues 每項包含 speaker(host/expert)、text、pauseAfter(可選)。' +
            '請輸出完整逐字稿，不可摘要化，不要輸出 JSON 以外內容。'
        },
        {
          role: 'user',
          content:
            `播客標題：${outline.title}\n` +
            `播客描述：${outline.description}\n` +
            `研究摘要：${research.summary}\n` +
            `研究關鍵要點：${research.keyPoints.join('；')}\n` +
            `大綱段落：\n${outline.sections.map((section, index) => `${index + 1}. id=${section.id}, title=${section.title}, keyPoints=${section.keyPoints.join('、')}, duration=${section.duration}s`).join('\n')}`
        }
      ],
      max_tokens: 4000
    };

    const response = await this.requestChatCompletions(payload);
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(this.formatApiError(response, errorText));
    }

    const data = await response.json();
    const content = safeString(data?.choices?.[0]?.message?.content);
    const parsed = this.extractJsonRecord(content);
    const idSeed = Date.now();

    let dialogues: Dialogue[] = [];
    let sections: ScriptSection[] = [];

    if (parsed && Array.isArray(parsed.sections)) {
      const parsedSections = parsed.sections
        .map((section): { sectionId: string; title: string; dialogues: Dialogue[] } | null => {
          if (!section || typeof section !== 'object') {
            return null;
          }
          const sectionObject = section as JsonRecord;
          const sectionId = safeString(sectionObject.id);
          const title = safeString(sectionObject.title);
          const sectionDialogues = this.normalizeDialogues(sectionObject.dialogues, idSeed + dialogues.length);
          if (!sectionId || sectionDialogues.length === 0) {
            return null;
          }
          return {
            sectionId,
            title: title || sectionId,
            dialogues: sectionDialogues
          };
        })
        .filter((section): section is { sectionId: string; title: string; dialogues: Dialogue[] } => section !== null);

      if (parsedSections.length > 0) {
        for (const section of parsedSections) {
          dialogues = dialogues.concat(section.dialogues);
        }

        sections = outline.sections.map((outlineSection) => {
          const matched = parsedSections.find((section) => section.sectionId === outlineSection.id) ||
            parsedSections.find((section) => section.title === outlineSection.title);
          return {
            id: outlineSection.id,
            title: outlineSection.title,
            dialogueIds: matched ? matched.dialogues.map((dialogue) => dialogue.id) : []
          };
        });
      }
    }

    if (dialogues.length === 0) {
      dialogues = this.parseDialogues(content);
    }

    if (dialogues.length === 0) {
      throw new Error(`${this.provider.toUpperCase()} 腳本解析失敗。`);
    }

    if (sections.length === 0) {
      sections = outline.sections.map((section, index) => {
        const start = Math.floor((index * dialogues.length) / outline.sections.length);
        const end = Math.floor(((index + 1) * dialogues.length) / outline.sections.length);
        return {
          id: section.id,
          title: section.title,
          dialogueIds: dialogues.slice(start, end).map((dialogue) => dialogue.id)
        };
      });
    }

    return {
      id: `script_${Date.now()}`,
      title: safeString(parsed?.title, outline.title),
      dialogues,
      sections,
      totalDuration: Math.max(600, outline.sections.reduce((sum, section) => sum + section.duration, 0))
    };
  }
}
