/**
 * Google Gemini API Service
 * Generates conversational podcast scripts using Google Gemini
 */

import { Outline, ResearchResult, Script, Dialogue, ScriptSection, OutlineSection, SessionConfig } from '../types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-1.5-flash';

export class GeminiService {
  /**
   * Generate a full podcast dialogue script
   */
  async generatePodcastScript(
    apiKey: string,
    outline: Outline,
    research: ResearchResult,
    config?: Partial<SessionConfig>
  ): Promise<Script> {
    const language = config?.language ?? 'en';
    const format = config?.format ?? 'dialogue';
    const length = config?.length ?? 'medium';
    const isZh = language === 'zh-TW';
    const isSolo = format === 'solo';

    const lengthGuide = { short: '~5 minutes', medium: '~15 minutes', long: '~30 minutes' }[length];

    const systemPrompt = isSolo
      ? this.buildSoloSystemPrompt(isZh, lengthGuide)
      : this.buildDialogueSystemPrompt(isZh, lengthGuide);

    const userPrompt = isZh
      ? `請根據以下大綱和研究內容創建完整的播客腳本：\n\n播客標題：${outline.title}\n描述：${outline.description}\n\n研究摘要：${research.summary}\n關鍵要點：${research.keyPoints.join('、')}\n\n大綱段落：\n${outline.sections.map((s, i) => `${i + 1}. ${s.title}（約 ${s.duration} 秒）\n   要點：${s.keyPoints.join('、')}`).join('\n')}`
      : `Create a complete podcast script based on this outline and research:\n\nTitle: ${outline.title}\nDescription: ${outline.description}\n\nResearch summary: ${research.summary}\nKey points: ${research.keyPoints.join(', ')}\n\nOutline sections:\n${outline.sections.map((s, i) => `${i + 1}. ${s.title} (~${s.duration}s)\n   Key points: ${s.keyPoints.join(', ')}`).join('\n')}`;

    try {
      const content = await this.callGemini(apiKey, systemPrompt + '\n\n' + userPrompt, 8192);
      const dialogues = this.parseDialogues(content, isSolo, isZh);

      // Distribute dialogues evenly across sections
      const sections: ScriptSection[] = outline.sections.map((section, index) => ({
        id: section.id,
        title: section.title,
        dialogueIds: dialogues
          .slice(
            Math.floor((index * dialogues.length) / outline.sections.length),
            Math.floor(((index + 1) * dialogues.length) / outline.sections.length)
          )
          .map(d => d.id),
      }));

      // Better duration estimate: average words / speaking rate
      const totalWords = dialogues.reduce((sum, d) => sum + d.text.split(/\s+/).length, 0);
      const totalDuration = Math.ceil((totalWords / 150) * 60); // ~150 words/min

      return {
        id: `script_${Date.now()}`,
        title: outline.title,
        dialogues,
        totalDuration,
        sections,
      };
    } catch (error: unknown) {
      throw new Error(`Script generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Regenerate dialogue for a single section
   */
  async generateSectionDialogue(
    apiKey: string,
    section: OutlineSection,
    research: ResearchResult,
    previousContext?: string,
    config?: Partial<SessionConfig>
  ): Promise<Dialogue[]> {
    const language = config?.language ?? 'en';
    const format = config?.format ?? 'dialogue';
    const isZh = language === 'zh-TW';
    const isSolo = format === 'solo';

    const systemPrompt = isSolo
      ? this.buildSoloSystemPrompt(isZh, '')
      : this.buildDialogueSystemPrompt(isZh, '');

    const userPrompt = isZh
      ? `請為以下段落創建對話：\n\n段落標題：${section.title}\n關鍵要點：${section.keyPoints.join('、')}\n預估時長：${section.duration} 秒\n\n相關研究：${research.summary}${previousContext ? `\n\n先前對話上下文：\n${previousContext}` : ''}`
      : `Create dialogue for this podcast section:\n\nSection: ${section.title}\nKey points: ${section.keyPoints.join(', ')}\nEstimated duration: ${section.duration}s\n\nResearch: ${research.summary}${previousContext ? `\n\nPrevious context:\n${previousContext}` : ''}`;

    try {
      const content = await this.callGemini(apiKey, systemPrompt + '\n\n' + userPrompt, 4096);
      return this.parseDialogues(content, isSolo, isZh);
    } catch (error: unknown) {
      throw new Error(`Section dialogue generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Refine an existing script based on user feedback
   */
  async refineScript(
    apiKey: string,
    script: Script,
    feedback: string,
    config?: Partial<SessionConfig>
  ): Promise<Script> {
    const language = config?.language ?? 'en';
    const format = config?.format ?? 'dialogue';
    const isZh = language === 'zh-TW';
    const isSolo = format === 'solo';

    const systemPrompt = isZh
      ? '你是一位專業的播客腳本編輯。根據用戶反饋修改腳本，保持相同格式。'
      : 'You are a professional podcast script editor. Revise the script based on feedback, keeping the same format.';

    const scriptText = script.dialogues
      .map(d => {
        const speaker = isSolo ? '' : (isZh ? (d.speaker === 'host' ? '[主持人] ' : '[專家] ') : (d.speaker === 'host' ? '[Host] ' : '[Expert] '));
        return `${speaker}${d.text}`;
      })
      .join('\n');

    const userPrompt = isZh
      ? `根據以下反饋修改播客腳本：\n\n反饋：${feedback}\n\n原始腳本：\n${scriptText}`
      : `Revise the podcast script based on this feedback:\n\nFeedback: ${feedback}\n\nOriginal script:\n${scriptText}`;

    try {
      const content = await this.callGemini(apiKey, systemPrompt + '\n\n' + userPrompt, 8192);
      const dialogues = this.parseDialogues(content, isSolo, isZh);

      // Re-distribute dialogues evenly across sections (fixes the empty-section bug)
      const sections: ScriptSection[] = script.sections.map((section, index) => ({
        ...section,
        dialogueIds: dialogues
          .slice(
            Math.floor((index * dialogues.length) / script.sections.length),
            Math.floor(((index + 1) * dialogues.length) / script.sections.length)
          )
          .map(d => d.id),
      }));

      const totalWords = dialogues.reduce((sum, d) => sum + d.text.split(/\s+/).length, 0);

      return {
        ...script,
        dialogues,
        sections,
        totalDuration: Math.ceil((totalWords / 150) * 60),
      };
    } catch (error: unknown) {
      throw new Error(`Script refinement failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildDialogueSystemPrompt(isZh: boolean, lengthGuide: string): string {
    if (isZh) {
      return `你是一位專業的播客腳本作家。創建主持人與專家的對話腳本${lengthGuide ? `，目標長度約 ${lengthGuide}` : ''}。
規則：
- 每行以 [主持人] 或 [專家] 開頭
- 使用自然、口語化的語言
- 可在行末加入情感標記：[好奇]、[興奮]、[深思]
- 例：[主持人] 今天我們來談談人工智慧。[好奇]
      `.trim();
    }
    return `You are a professional podcast scriptwriter. Create a host-and-expert dialogue script${lengthGuide ? ` targeting ${lengthGuide}` : ''}.
Rules:
- Each line starts with [Host] or [Expert]
- Use natural, conversational language
- Optionally add emotion tags at end of line: [curious], [excited], [thoughtful]
- Example: [Host] Today we explore artificial intelligence. [curious]
    `.trim();
  }

  private buildSoloSystemPrompt(isZh: boolean, lengthGuide: string): string {
    if (isZh) {
      return `你是一位專業的播客腳本作家。創建單一主持人的獨白式播客腳本${lengthGuide ? `，目標長度約 ${lengthGuide}` : ''}。
規則：
- 每行以 [主持人] 開頭
- 使用自然、吸引人的敘述語言
- 例：[主持人] 今天我們來探討人工智慧的未來。
      `.trim();
    }
    return `You are a professional podcast scriptwriter. Create a solo narrator podcast script${lengthGuide ? ` targeting ${lengthGuide}` : ''}.
Rules:
- Each line starts with [Narrator]
- Use natural, engaging narrative language
- Example: [Narrator] Today we explore the future of artificial intelligence.
    `.trim();
  }

  private async callGemini(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
    const response = await fetch(
      `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private parseDialogues(content: string, isSolo: boolean, isZh: boolean): Dialogue[] {
    const dialogues: Dialogue[] = [];
    const lines = content.split('\n').filter(l => l.trim());

    // Patterns for both language variants
    const hostPatterns = isZh
      ? /^\[(主持人|Host)\]\s*(.*)/
      : /^\[(Host|Narrator)\]\s*(.*)/;
    const anyPattern = isZh
      ? /^\[(主持人|Host|專家|Expert|Narrator)\]\s*(.*)/
      : /^\[(Host|Expert|Narrator)\]\s*(.*)/;

    const emotionMap: Record<string, Dialogue['emotion']> = {
      '好奇': 'curious', curious: 'curious',
      '興奮': 'excited', excited: 'excited',
      '深思': 'thoughtful', thoughtful: 'thoughtful',
      '中性': 'neutral', neutral: 'neutral',
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(anyPattern);
      if (!match) continue;

      const speakerRaw = match[1].toLowerCase();
      let text = match[2].trim();
      let emotion: Dialogue['emotion'];
      let pauseAfter: number | undefined;

      // Extract emotion tag: text [emotion]
      const emotionMatch = text.match(/\[([^\]]+)\]$/);
      if (emotionMatch) {
        const tag = emotionMatch[1].trim();
        if (emotionMap[tag]) {
          emotion = emotionMap[tag];
          text = text.replace(/\[[^\]]+\]$/, '').trim();
        }
      }

      // Extract pause tag: text [pause:N] or [停頓:N]
      const pauseMatch = text.match(/\[(?:pause|停頓):(\d+)\]$/i);
      if (pauseMatch) {
        pauseAfter = parseInt(pauseMatch[1], 10);
        text = text.replace(/\[(?:pause|停頓):\d+\]$/i, '').trim();
      }

      const isHost = hostPatterns.test(line) || speakerRaw === 'narrator';
      const speaker: Dialogue['speaker'] = isSolo ? 'host' : (isHost ? 'host' : 'expert');

      if (!text) continue;

      dialogues.push({
        id: `dialogue_${Date.now()}_${i}`,
        speaker,
        text,
        emotion,
        pauseAfter,
      });
    }

    return dialogues;
  }
}
