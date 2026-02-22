/**
 * Perplexity API 服務
 * 實現與 Perplexity API 的整合，用於研究、大綱生成和內容創建
 */

import { Dialogue, Outline, OutlineSection, ResearchResult, Script, ScriptSection, Source } from '../types';

const LOCAL_PERPLEXITY_PROXY_URL = '/pplx/chat';
const DEPLOY_PERPLEXITY_PROXY_URL = '/api/perplexity/chat';
const LOCAL_PERPLEXITY_SEARCH_PROXY_URL = '/pplx/search';
const DEPLOY_PERPLEXITY_SEARCH_PROXY_URL = '/api/perplexity/search';
const LARGE_ONLINE_MODEL = 'sonar-pro';
const MAX_PERPLEXITY_API_KEY_LENGTH = 512;
const PERPLEXITY_AUTH_ERROR_REGEX =
  /invalid[_\s-]?api[_\s-]?key|invalid[_\s-]?token|incorrect[_\s-]?api[_\s-]?key|authorization required|unauthorized/i;

type JsonRecord = Record<string, unknown>;
type SearchResultItem = { title: string; url: string; snippet: string };

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

const normalizeApiKeyWrapping = (value: string): string => {
  let normalized = value.trim();

  while (normalized.length >= 2) {
    const firstChar = normalized[0];
    const lastChar = normalized[normalized.length - 1];
    const isMatchingQuotePair =
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === '\'' && lastChar === '\'') ||
      (firstChar === '`' && lastChar === '`');

    if (!isMatchingQuotePair) {
      break;
    }

    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

export class PerplexityService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = normalizeApiKeyWrapping(apiKey).replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
  }

  private isLocalhostEnvironment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  private getProxyEndpoints(): string[] {
    if (this.isLocalhostEnvironment()) {
      return [LOCAL_PERPLEXITY_PROXY_URL];
    }

    return [DEPLOY_PERPLEXITY_PROXY_URL, LOCAL_PERPLEXITY_PROXY_URL];
  }

  private getSearchProxyEndpoints(): string[] {
    if (this.isLocalhostEnvironment()) {
      return [LOCAL_PERPLEXITY_SEARCH_PROXY_URL];
    }

    return [DEPLOY_PERPLEXITY_SEARCH_PROXY_URL, LOCAL_PERPLEXITY_SEARCH_PROXY_URL];
  }

  private isAuthFailure(status: number, errorText: string): boolean {
    if (status === 401 || status === 403) {
      return true;
    }

    return PERPLEXITY_AUTH_ERROR_REGEX.test(errorText);
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
    return `Perplexity API 錯誤: ${response.status} ${statusText}${detail ? ` - ${detail}` : ''}`;
  }

  private mapSearchResultArray(value: unknown): SearchResultItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item): SearchResultItem | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const itemObject = item as JsonRecord;
        const title = safeString(itemObject.title).trim();
        const url = safeString(itemObject.url).trim();
        const snippet = safeString(itemObject.snippet).trim();

        if (!title && !url && !snippet) {
          return null;
        }

        return {
          title: title || url || 'Untitled source',
          url,
          snippet
        };
      })
      .filter((item): item is SearchResultItem => item !== null);
  }

  private buildResearchFromSearch(topic: string, searchPayload: JsonRecord): ResearchResult {
    const results = this.mapSearchResultArray(searchPayload.results);
    if (results.length === 0) {
      throw new Error('Perplexity Search API 回傳空結果，請稍後再試。');
    }

    const sources: Source[] = results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet
    }));

    const snippetParagraphs = results
      .map((item) => item.snippet.trim())
      .filter((snippet) => snippet.length > 0)
      .slice(0, 8);

    const summary = [
      `以下是「${topic}」的最新研究整理：`,
      ...snippetParagraphs
    ].join('\n\n');

    const keyPoints = Array.from(new Set(
      results
        .flatMap((item) => {
          const snippetLead = item.snippet.split(/[。！？.!?]/)[0]?.trim() || '';
          return [item.title.trim(), snippetLead];
        })
        .filter((value) => value.length > 0)
    )).slice(0, 12);

    return {
      topic,
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : [`${topic} 的關鍵觀察請見來源列表。`],
      sources,
      timestamp: new Date()
    };
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
      let text = (speakerMatch[3] || '').trim();

      const pauseMatch = text.match(/\[(?:停頓|pause)\s*[:：]\s*(\d+)\]$/i);
      let pauseAfter: number | undefined;
      if (pauseMatch) {
        pauseAfter = Math.round(Number(pauseMatch[1]));
        text = text.replace(/\[(?:停頓|pause)\s*[:：]\s*\d+\]$/i, '').trim();
      }

      if (!text) {
        continue;
      }

      dialogues.push({
        id: `dialogue_${Date.now()}_${i + 1}`,
        speaker,
        text,
        pauseAfter
      });
    }
    return dialogues;
  }

  private async requestChatCompletions(payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<Response> {
    if (!this.apiKey || this.apiKey.length <= 10 || this.apiKey.length > MAX_PERPLEXITY_API_KEY_LENGTH) {
      throw new Error('Perplexity API 金鑰格式無效，請重新貼上有效金鑰。');
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
            apiKey: this.apiKey,
            payload
          }),
          signal: options?.signal
        });

        const isFromProxy = proxyResponse.headers.get('x-proxy-handled') === '1';
        if (!isFromProxy && (proxyResponse.status === 404 || proxyResponse.status === 405)) {
          unavailableCount += 1;
          continue;
        }

        return proxyResponse;
      } catch (error) {
        if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
        unavailableCount += 1;
        if (!this.isLocalhostEnvironment()) {
          console.warn(`Perplexity proxy ${endpoint} request failed:`, error);
        }
      }
    }

    if (unavailableCount >= proxyEndpoints.length) {
      throw new Error(
        'Perplexity proxy is unavailable. Please run through local Vite proxy or deploy `/api/perplexity/chat`.'
      );
    }

    throw new Error('Perplexity request failed via proxy.');
  }

  private async requestSearch(query: string, options?: { signal?: AbortSignal }): Promise<Response> {
    if (!this.apiKey || this.apiKey.length <= 10 || this.apiKey.length > MAX_PERPLEXITY_API_KEY_LENGTH) {
      throw new Error('Perplexity API 金鑰格式無效，請重新貼上有效金鑰。');
    }

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new Error('Perplexity Search query 不可為空。');
    }

    const proxyEndpoints = this.getSearchProxyEndpoints();
    let unavailableCount = 0;

    for (const endpoint of proxyEndpoints) {
      try {
        const proxyResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            query: normalizedQuery,
            max_results: 10,
            max_tokens_per_page: 2048
          }),
          signal: options?.signal
        });

        const isFromProxy = proxyResponse.headers.get('x-proxy-handled') === '1';
        if (!isFromProxy && (proxyResponse.status === 404 || proxyResponse.status === 405)) {
          unavailableCount += 1;
          continue;
        }

        return proxyResponse;
      } catch (error) {
        if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
        unavailableCount += 1;
        if (!this.isLocalhostEnvironment()) {
          console.warn(`Perplexity search proxy ${endpoint} request failed:`, error);
        }
      }
    }

    if (unavailableCount >= proxyEndpoints.length) {
      throw new Error(
        'Perplexity search proxy is unavailable. Please run through local Vite proxy or deploy `/api/perplexity/search`.'
      );
    }

    throw new Error('Perplexity search request failed via proxy.');
  }

  /**
   * 研究主題並收集資訊
   * @param topic 主題
   * @returns 研究結果
   */
  async researchTopic(topic: string, options?: { signal?: AbortSignal }): Promise<ResearchResult> {
    try {
      const payload = {
        model: LARGE_ONLINE_MODEL,
        messages: [
          {
            role: 'system',
            content:
              '你是一位資深播客研究員。請輸出 JSON 物件，欄位必須包含 summary、keyPoints、sources。' +
              'summary 需要是可直接寫稿的完整研究摘要，至少 8 個段落；keyPoints 至少 12 條；' +
              'sources 至少 8 筆，且每筆都要有 title、url、snippet。請不要輸出任何 JSON 以外的內容。'
          },
          {
            role: 'user',
            content: `研究以下主題並整理成可直接用於播客腳本的深入資料：${topic}`
          }
        ],
        max_tokens: 4000,
        return_related_questions: true,
        return_citations: true
      };

      const response = await this.requestChatCompletions(payload, options);
      if (response.ok) {
        const data = await response.json();
        const content = safeString(data?.choices?.[0]?.message?.content);
        const parsedContent = this.extractJsonRecord(content);

        const sourcesFromContent = safeSourceArray(parsedContent?.sources);
        const citationsFromUpstream = Array.isArray(data?.citations)
          ? (data.citations as unknown[]).map((citation): Source | null => {
              const url = safeString(citation).trim();
              if (!url) {
                return null;
              }

              return {
                title: url,
                url,
                snippet: ''
              };
            }).filter((item): item is Source => item !== null)
          : [];

        const mergedSources = [...sourcesFromContent];
        for (const citation of citationsFromUpstream) {
          if (!mergedSources.some((source) => source.url === citation.url)) {
            mergedSources.push(citation);
          }
        }

        return {
          topic,
          summary: safeString(parsedContent?.summary, content).trim(),
          keyPoints: safeStringArray(parsedContent?.keyPoints),
          sources: mergedSources,
          timestamp: new Date()
        };
      }

      const chatErrorText = await response.text().catch(() => '');
      if (this.isAuthFailure(response.status, chatErrorText)) {
        const searchResponse = await this.requestSearch(
          `請針對以下主題提供最新、可查證的研究資訊並附來源：${topic}`,
          options
        );

        if (!searchResponse.ok) {
          const searchErrorText = await searchResponse.text().catch(() => '');
          if (this.isAuthFailure(searchResponse.status, searchErrorText)) {
            throw new Error('Perplexity API 金鑰驗證失敗，請重新貼上金鑰後按「測試」。');
          }
          throw new Error(this.formatApiError(searchResponse, searchErrorText));
        }

        const searchData = await searchResponse.json().catch(() => ({}));
        return this.buildResearchFromSearch(topic, (searchData && typeof searchData === 'object' ? searchData : {}) as JsonRecord);
      }

      throw new Error(this.formatApiError(response, chatErrorText));
    } catch (error: unknown) {
      console.error('研究主題時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`研究主題失敗: ${error.message}`);
      } else {
        throw new Error('研究主題失敗: 發生未知錯誤');
      }
    }
  }

  /**
   * 根據研究結果生成播客大綱
   * @param research 研究結果
   * @returns 大綱結構
   */
  async generateOutline(research: ResearchResult, options?: { signal?: AbortSignal }): Promise<Outline> {
    try {
      const payload = {
        model: LARGE_ONLINE_MODEL,
        messages: [
          {
            role: 'system',
            content:
              '你是一位專業的播客製作人。請輸出 JSON 物件，欄位包含 title、description、sections。' +
              'sections 必須有 8-12 個段落，每個段落都要有 id、title、keyPoints、duration（秒）。' +
              '整集長度請控制在 15-30 分鐘，段落安排需具備清楚起承轉合。不要輸出 JSON 以外內容。'
          },
          {
            role: 'user',
            content:
              `主題: ${research.topic}\n\n` +
              `摘要: ${research.summary}\n\n` +
              `關鍵要點: ${research.keyPoints.join(', ')}`
          }
        ],
        max_tokens: 3000
      };

      const response = await this.requestChatCompletions(payload, options);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(this.formatApiError(response, errorText));
      }

      const data = await response.json();
      const content = safeString(data?.choices?.[0]?.message?.content);
      const parsedContent = this.extractJsonRecord(content);
      const sections = safeSectionArray(parsedContent?.sections);
      const fallbackSections: OutlineSection[] = sections.length > 0
        ? sections
        : (research.keyPoints.slice(0, 8).map((point, index) => ({
            id: `section-${index + 1}`,
            title: `重點 ${index + 1}`,
            keyPoints: [point],
            duration: 180
          })));

      return {
        title: safeString(parsedContent?.title, `關於 ${research.topic} 的播客`),
        description: safeString(parsedContent?.description, research.summary),
        sections: fallbackSections
      };
    } catch (error: unknown) {
      console.error('生成大綱時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成大綱失敗: ${error.message}`);
      } else {
        throw new Error('生成大綱失敗: 發生未知錯誤');
      }
    }
  }

  /**
   * 為特定段落生成詳細內容
   * @param section 大綱段落
   * @param research 研究結果
   * @returns 詳細內容
   */
  async generateSectionContent(section: OutlineSection, research: ResearchResult, options?: { signal?: AbortSignal }): Promise<string> {
    try {
      const payload = {
        model: LARGE_ONLINE_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一位專業內容作家。請產生可直接朗讀的完整段落內容，具體且細節充分。'
          },
          {
            role: 'user',
            content:
              `段落標題: ${section.title}\n` +
              `段落關鍵要點: ${section.keyPoints.join(', ')}\n` +
              `預估時長: ${section.duration} 秒\n` +
              `研究摘要: ${research.summary}`
          }
        ],
        max_tokens: 2500
      };

      const response = await this.requestChatCompletions(payload, options);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(this.formatApiError(response, errorText));
      }

      const data = await response.json();
      return safeString(data?.choices?.[0]?.message?.content);
    } catch (error: unknown) {
      console.error('生成段落內容時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成段落內容失敗: ${error.message}`);
      } else {
        throw new Error('生成段落內容失敗: 發生未知錯誤');
      }
    }
  }

  /**
   * 在 Gemini 配額耗盡時，使用 Perplexity 生成完整播客腳本（fallback）
   */
  async generatePodcastScript(
    outline: Outline,
    research: ResearchResult,
    options?: { signal?: AbortSignal; onProgress?: (text: string) => void }
  ): Promise<Script> {
    try {
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
          model: LARGE_ONLINE_MODEL,
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
          max_tokens: 4000
        };

        const response = await this.requestChatCompletions(payload, options);
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(this.formatApiError(response, errorText));
        }

        const data = await response.json();
        const content = safeString(data?.choices?.[0]?.message?.content);
        
        let parsedJson: JsonRecord | JsonRecord[] | null = null;
        try {
          const candidate = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/i)?.[1] || content;
          const firstBracket = candidate.indexOf('[');
          const lastBracket = candidate.lastIndexOf(']');
          if (firstBracket !== -1 && lastBracket >= firstBracket) {
            parsedJson = JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
          } else {
            const record = this.extractJsonRecord(content);
            if (record && Array.isArray(record.dialogues)) {
               parsedJson = record.dialogues;
            }
          }
        } catch (e) {
          console.error(`Failed to parse section ${i + 1} response JSON array:`, e);
        }

        let sectionDialogues = this.normalizeDialogues(parsedJson, idSeed + allDialogues.length);
        if (sectionDialogues.length === 0) {
          sectionDialogues = this.parseDialogues(content);
        }
        
        if (sectionDialogues.length === 0) {
          throw new Error(`Perplexity 腳本解析失敗 (段落: ${section.title})。請重試或更換提供商。`);
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
    } catch (error: unknown) {
      console.error('使用 Perplexity 生成腳本時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`Perplexity fallback 生成腳本失敗: ${error.message}`);
      }
      throw new Error('Perplexity fallback 生成腳本失敗: 發生未知錯誤');
    }
  }
}
