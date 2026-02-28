/**
 * Google Gemini API 服務
 * 實現與 Google Gemini API 的整合，用於生成對話式播客腳本
 */

import { Dialogue, Outline, OutlineSection, ResearchResult, Script, ScriptSection } from '../types';

const GEMINI_BASE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
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

// safeSourceArray was removed as it is no longer used in `researchTopic`.
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
  private model: string;

  constructor(model = GEMINI_MODEL) {
    const normalizedModel = model.trim();
    this.model = normalizedModel || GEMINI_MODEL;
  }

  private getGenerateEndpoints(): string[] {
    return [GEMINI_BASE_API_URL];
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
    temperature = 0.7,
    options?: { signal?: AbortSignal }
  ): Promise<string> {
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey || normalizedApiKey.length <= 10 || normalizedApiKey.length > MAX_API_KEY_LENGTH) {
      throw new Error('Gemini API 金鑰格式無效。');
    }

    const payload = {
      model: this.model,
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
        const response = await fetch(`${endpoint}/${this.model}:generateContent`, {
          method: 'POST',
          headers: {
            'x-goog-api-key': normalizedApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: options?.signal
        });

        const isFromProxy = response.headers.get('x-proxy-handled') === '1';
        if (!isFromProxy && (response.status === 404 || response.status === 405)) {
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
   * 根據主題進行研究並摘要
   */
  async researchTopic(apiKey: string, topic: string, options?: { signal?: AbortSignal }): Promise<ResearchResult> {
    try {
      const prompt = `
請針對主題「${topic}」進行研究，並輸出以下 JSON 格式（不要包含 markdown code blocks 等其他文字）：
{
  "summary": "約 300字的綜合摘要，適合直接念。",
  "keyPoints": ["關鍵要點1", "關鍵要點2", "關鍵要點3", "關鍵要點4", "關鍵要點5"],
  "sources": [
    {
      "title": "資料來源標題",
      "url": "資料來源網址 (如果沒有可以給 'gemini-knowledge')",
      "snippet": "資料來源的簡短說明"
    }
  ]
}

要求：
1. 請盡可能提供具體、深入的知識，而非泛泛而談。
2. keyPoints 請給 5 點以上，每點至少 30 字，需包含具體細節。
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.7, options);
      const parsed = this.extractJsonRecord(content);

      if (!parsed) {
        throw new Error('研究結果回傳的不是有效的 JSON 格式。');
      }

      return {
        topic,
        summary: safeString(parsed.summary, '無法整理出摘要，請稍後重試。'),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map((kp: unknown) => String(kp))
          : ['缺乏足夠的重點資訊'],
        sources: Array.isArray(parsed.sources)
          ? parsed.sources.map((src: unknown) => {
              const srcObj = (typeof src === 'object' && src !== null ? src : {}) as Record<string, unknown>;
              return {
                title: safeString(srcObj.title, '無標題'),
                url: safeString(srcObj.url, '#'),
                snippet: safeString(srcObj.snippet, '無說明')
              };
            })
          : [],
        timestamp: new Date()
      };
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
   */
  async generateOutline(apiKey: string, research: ResearchResult, options?: { signal?: AbortSignal }): Promise<Outline> {
    try {
      const prompt = `
請根據以下研究結果，設計一個長度約 20 分鐘的播客節目大綱。
輸出 JSON 物件：
{
  "title": "播客標題",
  "description": "吸引人的播客簡介",
  "sections": [
    {
      "id": "intro",
      "title": "開場與背景介紹",
      "keyPoints": ["要點1", "要點2"],
      "duration": 180
    },
    ...
  ]
}

提示：
- 總共切分 5-7 個 sections（包含 intro 和 outro）。
- 每個 section 的 duration（秒數）大約在 180 到 480 之間，使得總時長約 1200 秒（20分鐘）。
- 必須只輸出 JSON。

主題：${research.topic}
研究摘要：${research.summary}
研究關鍵重點：
${research.keyPoints.map((kp, i) => `${i + 1}. ${kp}`).join('\n')}
      `.trim();

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.7, options);
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
  async generatePodcastScript(
    apiKey: string,
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

        const prompt = `
你是一位專業播客編劇。請嚴格輸出 JSON 陣列，包含該段落的對話。不要有 JSON 以外的文字。
陣列中每個元素必須包含 speaker(host/expert)、text、pauseAfter(可選)。
請輸出完整逐字稿，不可摘要化。

播客標題：${outline.title}
研究摘要：${research.summary}
目前段落：${section.title}
本段重點：${section.keyPoints.join('；')}
預計長度：${section.duration} 秒
${previousContext ? `前一段結尾：\n${previousContext}\n\n請順暢接續上一段。` : ''}
`.trim();

        const content = await this.requestGeminiContent(apiKey, prompt, 8192, 0.7, options);

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
          throw new Error(`Gemini 腳本解析失敗 (段落: ${section.title})。請重試或更換提供商。`);
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
      console.error('撰寫腳本發發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`撰寫腳本失敗: ${error.message}`);
      }
      throw new Error('撰寫腳本失敗: 發生未知錯誤');
    }
  }

  /**
   * 為特定段落生成對話
   */
  async generateSectionDialogue(
    apiKey: string,
    section: OutlineSection,
    research: ResearchResult,
    previousContext?: string,
    options?: { signal?: AbortSignal }
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

      const content = await this.requestGeminiContent(apiKey, prompt, 4096, 0.7, options);
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
  async refineScript(apiKey: string, script: Script, feedback: string, options?: { signal?: AbortSignal }): Promise<Script> {
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

      const content = await this.requestGeminiContent(apiKey, prompt, 8192, 0.65, options);
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
