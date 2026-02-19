/**
 * Google Gemini API 服務
 * 實現與 Google Gemini API 的整合，用於生成對話式播客腳本
 */

import { Dialogue, Outline, OutlineSection, ResearchResult, Script, ScriptSection, Source } from '../types';

const LOCAL_GEMINI_GENERATE_ENDPOINT = '/gemini/generate';
const DEPLOY_GEMINI_GENERATE_ENDPOINT = '/api/gemini/generate';
const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const MAX_API_KEY_LENGTH = 512;

type JsonRecord = Record<string, unknown>;

const safeString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

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
      const rawDuration = safeNumber(sectionObject.duration);

      return {
        id: safeString(sectionObject.id) || `section-${index + 1}`,
        title: safeString(sectionObject.title) || `Section ${index + 1}`,
        keyPoints: safeStringArray(sectionObject.keyPoints),
        duration: rawDuration && rawDuration > 0 ? Math.round(rawDuration) : 180
      };
    })
    .filter((item): item is OutlineSection => item !== null);
};

const safeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const countWords = (text: string): number => {
  const latinWords = text.trim().split(/\s+/).filter(Boolean).length;
  const cjkChars = (text.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  const cjkWordEstimate = Math.ceil(cjkChars / 2);
  return Math.max(latinWords, cjkWordEstimate, 1);
};

const normalizeSpeaker = (value: unknown): 'host' | 'expert' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['host', '主持人', '主持', 'speaker1', 'anchor'].includes(normalized)) {
    return 'host';
  }
  if (['expert', '專家', '嘉賓', 'speaker2', 'guest'].includes(normalized)) {
    return 'expert';
  }

  return null;
};

const normalizeEmotion = (value: unknown): Dialogue['emotion'] => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['curious', '好奇'].includes(normalized)) return 'curious';
  if (['excited', '興奮'].includes(normalized)) return 'excited';
  if (['thoughtful', '深思'].includes(normalized)) return 'thoughtful';
  if (['neutral', '中性'].includes(normalized)) return 'neutral';
  return undefined;
};

type NormalizedSectionDialogue = {
  title: string;
  sectionId: string;
  dialogues: Dialogue[];
};

export class GeminiService {
  private isLocalhostEnvironment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  private getGenerateEndpoints(): string[] {
    if (this.isLocalhostEnvironment()) {
      // Local dev should use Vite middleware route only. Falling back to /api/*
      // can hit Vite proxy target (:8000) and cause ECONNREFUSED.
      return [LOCAL_GEMINI_GENERATE_ENDPOINT];
    }

    return [DEPLOY_GEMINI_GENERATE_ENDPOINT, LOCAL_GEMINI_GENERATE_ENDPOINT];
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

  private extractJsonArray(content: string): unknown[] | null {
    const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : content;

    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      const firstBracketIndex = candidate.indexOf('[');
      const lastBracketIndex = candidate.lastIndexOf(']');
      if (firstBracketIndex === -1 || lastBracketIndex <= firstBracketIndex) {
        return null;
      }

      try {
        const parsed = JSON.parse(candidate.slice(firstBracketIndex, lastBracketIndex + 1));
        return Array.isArray(parsed) ? parsed : null;
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
        const pauseAfterRaw = safeNumber(item.pauseAfter);

        return {
          id: `dialogue_${idSeed}_${sequence}`,
          speaker,
          text,
          emotion: normalizeEmotion(item.emotion),
          pauseAfter: pauseAfterRaw && pauseAfterRaw > 0 ? Math.round(pauseAfterRaw) : undefined
        };
      })
      .filter((dialogue): dialogue is Dialogue => dialogue !== null);
  }

  private parseDialogues(content: string): Dialogue[] {
    const dialogues: Dialogue[] = [];
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const speakerRegex = /^(?:[\-\*\d\.\)\s]*)?(?:\[(主持人|專家|Host|Expert)\]|(主持人|專家|Host|Expert)\s*[:：])\s*(.*)$/i;

    let currentSpeaker: 'host' | 'expert' | null = null;
    let currentText = '';
    let currentEmotion: Dialogue['emotion'];
    let currentPauseAfter: number | undefined;

    const pushCurrentDialogue = () => {
      const text = currentText.trim();
      if (!currentSpeaker || !text) {
        return;
      }

      dialogues.push({
        id: `dialogue_${Date.now()}_${dialogues.length + 1}`,
        speaker: currentSpeaker,
        text,
        emotion: currentEmotion,
        pauseAfter: currentPauseAfter
      });
    };

    for (const line of lines) {
      const speakerMatch = line.match(speakerRegex);

      if (speakerMatch) {
        pushCurrentDialogue();

        const speakerToken = (speakerMatch[1] || speakerMatch[2] || '').toLowerCase();
        currentSpeaker = ['主持人', 'host'].includes(speakerToken) ? 'host' : 'expert';
        let body = (speakerMatch[3] || '').trim();

        const emotionMatch = body.match(/\[(好奇|興奮|深思|中性|curious|excited|thoughtful|neutral)\]$/i);
        if (emotionMatch) {
          currentEmotion = normalizeEmotion(emotionMatch[1]);
          body = body.replace(/\[(好奇|興奮|深思|中性|curious|excited|thoughtful|neutral)\]$/i, '').trim();
        } else {
          currentEmotion = undefined;
        }

        const pauseMatch = body.match(/\[(?:停頓|pause)\s*[:：]\s*(\d+)\]$/i);
        if (pauseMatch) {
          currentPauseAfter = Math.round(Number(pauseMatch[1]));
          body = body.replace(/\[(?:停頓|pause)\s*[:：]\s*\d+\]$/i, '').trim();
        } else {
          currentPauseAfter = undefined;
        }

        currentText = body;
      } else if (currentSpeaker) {
        currentText = `${currentText}\n${line}`.trim();
      }
    }

    pushCurrentDialogue();
    return dialogues;
  }

  private estimateTotalDuration(dialogues: Dialogue[], fallbackSeconds: number): number {
    const wordCount = dialogues.reduce((sum, dialogue) => sum + countWords(dialogue.text), 0);
    const estimatedByWords = Math.round((wordCount / 150) * 60);
    const pauseSeconds = Math.round(
      dialogues.reduce((sum, dialogue) => sum + (dialogue.pauseAfter || 0), 0) / 1000
    );
    return Math.max(fallbackSeconds, estimatedByWords + pauseSeconds, 60);
  }

  private partitionDialoguesBySectionCounts(dialogues: Dialogue[], sectionCounts: number[]): ScriptSection[] {
    const safeCounts = sectionCounts.map((count) => Math.max(1, count));
    const totalCount = safeCounts.reduce((sum, count) => sum + count, 0);
    const result: ScriptSection[] = [];
    let cursor = 0;

    for (let i = 0; i < safeCounts.length; i++) {
      const count = safeCounts[i];
      const ratio = count / totalCount;
      const remainingDialogues = dialogues.length - cursor;
      const bucketSize = i === safeCounts.length - 1 ? remainingDialogues : Math.max(1, Math.round(dialogues.length * ratio));
      const sectionDialogues = dialogues.slice(cursor, cursor + bucketSize);
      cursor += bucketSize;

      result.push({
        id: `section-${i + 1}`,
        title: `Section ${i + 1}`,
        dialogueIds: sectionDialogues.map((dialogue) => dialogue.id)
      });
    }

    return result;
  }

  private async requestGeminiContent(
    apiKey: string,
    prompt: string,
    maxOutputTokens: number,
    temperature = 0.7
  ): Promise<string> {
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey || normalizedApiKey.length <= 10 || normalizedApiKey.length > MAX_API_KEY_LENGTH) {
      throw new Error('Gemini API 金鑰格式無效。');
    }

    const payload = {
      model: GEMINI_MODEL,
      requestBody: {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens
        }
      }
    };

    const endpoints = this.getGenerateEndpoints();
    let unavailableCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: normalizedApiKey,
            payload
          })
        });

        if (response.status === 404 || response.status === 405) {
          unavailableCount += 1;
          continue;
        }

        const responseBody = await response.text();
        if (!response.ok) {
          if (response.status === 429) {
            const retryDelayMatch = responseBody.match(/retry(?:\s+in)?\s+([\d.]+)s/i);
            const retryHint = retryDelayMatch ? `（建議 ${retryDelayMatch[1]} 秒後重試）` : '';
            throw new Error(`Gemini 配額已達上限 ${retryHint}`);
          }
          throw new Error(`Gemini API 錯誤: ${response.status} ${response.statusText} - ${responseBody}`);
        }

        const parsed = JSON.parse(responseBody) as JsonRecord;
        const candidates = Array.isArray(parsed.candidates) ? (parsed.candidates as JsonRecord[]) : [];
        const firstCandidate = candidates[0];
        const candidateContent =
          firstCandidate && typeof firstCandidate === 'object'
            ? (firstCandidate.content as JsonRecord | undefined)
            : undefined;
        const parts =
          candidateContent && Array.isArray(candidateContent.parts)
            ? (candidateContent.parts as JsonRecord[])
            : [];
        const content = safeString(parts[0]?.text);

        if (!content) {
          throw new Error('Gemini response did not contain content.');
        }

        return content;
      } catch (error) {
        unavailableCount += 1;
        if (unavailableCount >= endpoints.length) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Gemini proxy request failed.');
        }
      }
    }

    throw new Error(
      'Gemini proxy is unavailable. In local dev, restart `frontend` dev server and retry.'
    );
  }

  /**
   * 研究主題並回傳結構化結果
   */
  async researchTopic(apiKey: string, topic: string): Promise<ResearchResult> {
    try {
      const prompt = `
你是一位資深播客研究員。請輸出 JSON 物件，且只輸出 JSON（不要 Markdown）：
{
  "summary": "string",
  "keyPoints": ["string"],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "snippet": "string"
    }
  ]
}

要求：
1. summary 需完整、可直接用於寫稿（至少 6 段）。
2. keyPoints 至少 10 條。
3. sources 至少 6 筆，需附標題、網址、摘要。

研究主題：${topic}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.5);
      const parsed = this.extractJsonRecord(content);

      return {
        topic,
        summary: safeString(parsed?.summary, content).trim(),
        keyPoints: safeStringArray(parsed?.keyPoints),
        sources: safeSourceArray(parsed?.sources),
        timestamp: new Date()
      };
    } catch (error: unknown) {
      console.error('研究主題時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`研究主題失敗: ${error.message}`);
      }
      throw new Error('研究主題失敗: 發生未知錯誤');
    }
  }

  /**
   * 根據研究結果生成大綱
   */
  async generateOutline(apiKey: string, research: ResearchResult): Promise<Outline> {
    try {
      const prompt = `
你是一位專業播客製作人。請輸出 JSON 物件，且只輸出 JSON（不要 Markdown）：
{
  "title": "string",
  "description": "string",
  "sections": [
    {
      "id": "string",
      "title": "string",
      "keyPoints": ["string"],
      "duration": 180
    }
  ]
}

要求：
1. sections 至少 8 個、至多 12 個。
2. 每段 duration 60~300 秒，整體長度約 15~30 分鐘。
3. 結構需包含開場、主體多段、總結與行動建議。

主題：${research.topic}
研究摘要：${research.summary}
關鍵要點：${research.keyPoints.join('；')}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.6);
      const parsed = this.extractJsonRecord(content);
      const sections = safeSectionArray(parsed?.sections);

      return {
        title: safeString(parsed?.title, `關於 ${research.topic} 的播客`),
        description: safeString(parsed?.description, research.summary),
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
    } catch (error: unknown) {
      console.error('生成大綱時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成大綱失敗: ${error.message}`);
      }
      throw new Error('生成大綱失敗: 發生未知錯誤');
    }
  }

  /**
   * 生成對話腳本
   */
  async generatePodcastScript(apiKey: string, outline: Outline, research: ResearchResult): Promise<Script> {
    try {
      const totalOutlineDuration = outline.sections.reduce(
        (sum, section) => sum + (Number.isFinite(section.duration) && section.duration > 0 ? section.duration : 180),
        0
      );
      const targetDurationSeconds = totalOutlineDuration > 0 ? totalOutlineDuration : 1200;
      const targetWordCount = Math.max(1400, Math.round((targetDurationSeconds / 60) * 150));
      const idSeed = Date.now();

      const prompt = `
你是一位資深播客編劇，請產生「完整逐字稿」而非摘要。

請根據以下資訊生成 JSON，且只輸出 JSON（不要 Markdown）：
{
  "title": "string",
  "sections": [
    {
      "id": "與輸入大綱一致",
      "title": "string",
      "dialogues": [
        {
          "speaker": "host 或 expert",
          "text": "完整可朗讀句子，至少 2-5 句，不可只有摘要",
          "emotion": "neutral|curious|excited|thoughtful (可選)",
          "pauseAfter": 0-2500 (可選，毫秒)
        }
      ]
    }
  ]
}

內容要求：
1. 整體長度目標約 ${targetWordCount} 字詞。
2. 每個段落都要有主持人與專家互動，不能只有單一角色。
3. 每個段落至少 6 句對話。
4. 要包含清楚的開場、段落過渡、總結、行動建議。
5. 優先使用研究資料中的具體事實和來源線索。

播客標題：${outline.title}
播客描述：${outline.description}
研究摘要：${research.summary}
研究關鍵要點：${research.keyPoints.join('；')}
研究來源：
${research.sources.slice(0, 15).map((source, index) => `${index + 1}. ${source.title} (${source.url}) - ${source.snippet}`).join('\n')}

大綱段落：
${outline.sections.map((section, index) => `${index + 1}. id=${section.id}, title=${section.title}, keyPoints=${section.keyPoints.join('、')}, duration=${section.duration}s`).join('\n')}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 8192, 0.7);
      const parsed = this.extractJsonRecord(content);

      let normalizedSectionDialogues: NormalizedSectionDialogue[] = [];
      if (parsed && Array.isArray(parsed.sections)) {
        let dialogueSequence = 0;
        normalizedSectionDialogues = parsed.sections
          .map((section): NormalizedSectionDialogue | null => {
            if (!section || typeof section !== 'object') {
              return null;
            }

            const sectionObject = section as JsonRecord;
            const sectionId = safeString(sectionObject.id);
            const sectionTitle = safeString(sectionObject.title);
            const dialogues = this.normalizeDialogues(sectionObject.dialogues, idSeed + dialogueSequence);
            dialogueSequence += dialogues.length + 1;

            if (!sectionId || dialogues.length === 0) {
              return null;
            }

            return {
              sectionId,
              title: sectionTitle || sectionId,
              dialogues
            };
          })
          .filter((section): section is NormalizedSectionDialogue => section !== null);
      }

      let dialogues: Dialogue[] = [];
      let sections: ScriptSection[] = [];

      if (normalizedSectionDialogues.length > 0) {
        for (const section of normalizedSectionDialogues) {
          dialogues = dialogues.concat(section.dialogues);
        }

        sections = outline.sections.map((outlineSection) => {
          const matchedSection =
            normalizedSectionDialogues.find((section) => section.sectionId === outlineSection.id) ||
            normalizedSectionDialogues.find((section) => section.title === outlineSection.title);

          return {
            id: outlineSection.id,
            title: outlineSection.title,
            dialogueIds: matchedSection ? matchedSection.dialogues.map((dialogue) => dialogue.id) : []
          };
        });
      } else {
        dialogues = this.parseDialogues(content);
        if (dialogues.length === 0) {
          throw new Error('Gemini 回應無法解析為完整逐字稿。');
        }

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

      const totalDuration = this.estimateTotalDuration(dialogues, targetDurationSeconds);

      return {
        id: `script_${Date.now()}`,
        title: safeString(parsed?.title, outline.title),
        dialogues,
        totalDuration,
        sections
      };
    } catch (error: unknown) {
      console.error('生成播客腳本時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成播客腳本失敗: ${error.message}`);
      } else {
        throw new Error('生成播客腳本失敗: 發生未知錯誤');
      }
    }
  }

  /**
   * 為特定段落生成對話
   */
  async generateSectionDialogue(
    apiKey: string,
    section: OutlineSection,
    research: ResearchResult,
    previousContext?: string
  ): Promise<Dialogue[]> {
    try {
      const targetWordCount = Math.max(280, Math.round((section.duration / 60) * 150));
      const idSeed = Date.now();

      const prompt = `
請為以下播客段落生成完整逐字稿，輸出 JSON 陣列，且只輸出 JSON：
[
  {
    "speaker": "host 或 expert",
    "text": "完整可朗讀句子",
    "emotion": "neutral|curious|excited|thoughtful (可選)",
    "pauseAfter": 0-2500 (可選)
  }
]

要求：
1. 目標字詞約 ${targetWordCount}。
2. 主持人與專家都要發言，至少各 3 句。
3. 要有自然銜接，不可條列摘要化。

段落標題：${section.title}
段落關鍵要點：${section.keyPoints.join('、')}
預估時長：${section.duration} 秒
研究摘要：${research.summary}
研究關鍵要點：${research.keyPoints.join('；')}
${previousContext ? `前文上下文：${previousContext}` : ''}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.7);
      const parsedArray = this.extractJsonArray(content);
      const normalized = this.normalizeDialogues(parsedArray, idSeed);

      if (normalized.length > 0) {
        return normalized;
      }

      const fallback = this.parseDialogues(content);
      if (fallback.length === 0) {
        throw new Error('段落對話解析失敗。');
      }

      return fallback;
    } catch (error: unknown) {
      console.error('生成段落對話時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成段落對話失敗: ${error.message}`);
      } else {
        throw new Error('生成段落對話失敗: 發生未知錯誤');
      }
    }
  }

  /**
   * 根據反饋優化腳本
   */
  async refineScript(apiKey: string, script: Script, feedback: string): Promise<Script> {
    try {
      const sectionContext = script.sections.map((section) => {
        const sectionDialogues = script.dialogues.filter((dialogue) => section.dialogueIds.includes(dialogue.id));
        return {
          id: section.id,
          title: section.title,
          dialogues: sectionDialogues.map((dialogue) => ({
            speaker: dialogue.speaker,
            text: dialogue.text,
            emotion: dialogue.emotion,
            pauseAfter: dialogue.pauseAfter
          }))
        };
      });

      const prompt = `
請根據回饋修改以下播客逐字稿，輸出 JSON 物件且只輸出 JSON：
{
  "title": "string",
  "sections": [
    {
      "id": "沿用原段落 id",
      "title": "string",
      "dialogues": [
        {
          "speaker": "host 或 expert",
          "text": "完整可朗讀句子",
          "emotion": "neutral|curious|excited|thoughtful (可選)",
          "pauseAfter": 0-2500 (可選)
        }
      ]
    }
  ]
}

回饋：${feedback}
原始標題：${script.title}
原始段落與逐字稿：
${JSON.stringify(sectionContext)}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 8192, 0.65);
      const parsed = this.extractJsonRecord(content);
      const idSeed = Date.now();

      let dialogues: Dialogue[] = [];
      let sections: ScriptSection[] = [];

      if (parsed && Array.isArray(parsed.sections)) {
        let sequenceOffset = 0;
        const parsedSections = parsed.sections
          .map((section): NormalizedSectionDialogue | null => {
            if (!section || typeof section !== 'object') {
              return null;
            }
            const sectionObject = section as JsonRecord;
            const sectionId = safeString(sectionObject.id);
            const sectionTitle = safeString(sectionObject.title);
            const sectionDialogues = this.normalizeDialogues(sectionObject.dialogues, idSeed + sequenceOffset);
            sequenceOffset += sectionDialogues.length + 1;

            if (!sectionId || sectionDialogues.length === 0) {
              return null;
            }

            return {
              sectionId,
              title: sectionTitle || sectionId,
              dialogues: sectionDialogues
            };
          })
          .filter((section): section is NormalizedSectionDialogue => section !== null);

        if (parsedSections.length > 0) {
          for (const section of parsedSections) {
            dialogues = dialogues.concat(section.dialogues);
          }

          sections = script.sections.map((section) => {
            const matchedSection =
              parsedSections.find((parsedSection) => parsedSection.sectionId === section.id) ||
              parsedSections.find((parsedSection) => parsedSection.title === section.title);

            return {
              id: section.id,
              title: section.title,
              dialogueIds: matchedSection ? matchedSection.dialogues.map((dialogue) => dialogue.id) : []
            };
          });
        }
      }

      if (dialogues.length === 0) {
        dialogues = this.parseDialogues(content);
      }

      if (dialogues.length === 0) {
        throw new Error('優化後腳本解析失敗。');
      }

      if (sections.length === 0) {
        const sectionCounts = script.sections.map((section) => Math.max(section.dialogueIds.length, 1));
        sections = this.partitionDialoguesBySectionCounts(dialogues, sectionCounts).map((section, index) => ({
          ...section,
          id: script.sections[index]?.id || section.id,
          title: script.sections[index]?.title || section.title
        }));
      }

      return {
        ...script,
        title: safeString(parsed?.title, script.title),
        dialogues,
        sections,
        totalDuration: this.estimateTotalDuration(dialogues, script.totalDuration)
      };
    } catch (error: unknown) {
      console.error('優化播客腳本時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`優化播客腳本失敗: ${error.message}`);
      } else {
        throw new Error('優化播客腳本失敗: 發生未知錯誤');
      }
    }
  }
}
