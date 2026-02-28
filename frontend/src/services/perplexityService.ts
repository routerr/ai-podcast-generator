/**
 * Perplexity API 服務
 * 實現與 Perplexity API 的整合，用於研究、大綱生成和內容創建
 */

import { ResearchResult, Outline, OutlineSection } from '../types';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const ONLINE_MODEL = 'llama-3.1-sonar-small-128k-online';
const LARGE_ONLINE_MODEL = 'llama-3.1-sonar-large-128k-online';

export class PerplexityService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Research a topic and collect information
   * @param topic Topic to research
   * @param language Language for output ('en' | 'zh-TW')
   * @returns Research result
   */
  async researchTopic(topic: string, language: 'en' | 'zh-TW' = 'en'): Promise<ResearchResult> {
    const isZh = language === 'zh-TW';
    const systemPrompt = isZh
      ? '你是一個播客內容創作的研究助手。請提供關於主題的深入研究，包括摘要、關鍵要點和可靠來源。回應格式應為 JSON，包含 summary、keyPoints 和 sources 欄位。sources 應包含 title、url 和 snippet。所有內容請使用繁體中文。'
      : 'You are a research assistant for podcast content creation. Provide in-depth research on the topic, including a summary, key points, and reliable sources. Respond in JSON format with fields: summary (string), keyPoints (string array), and sources (array of {title, url, snippet}). All content should be in English.';
    const userPrompt = isZh ? `研究以下主題：${topic}` : `Research the following topic: ${topic}`;

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: ONLINE_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 2000,
          return_related_questions: true,
          return_citations: true
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Extract JSON from response (handle markdown code blocks)
      let parsedContent;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        parsedContent = JSON.parse(jsonMatch ? jsonMatch[1] : content);
      } catch {
        parsedContent = {
          summary: content.substring(0, 500) + (content.length > 500 ? '…' : ''),
          keyPoints: [],
          sources: []
        };
      }

      return {
        topic,
        summary: parsedContent.summary || '',
        keyPoints: Array.isArray(parsedContent.keyPoints) ? parsedContent.keyPoints : [],
        sources: Array.isArray(parsedContent.sources) ? parsedContent.sources : [],
        timestamp: new Date()
      };
    } catch (error: unknown) {
      console.error('研究主題時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`研究主題失敗: ${error.message}`);
      } else {
        throw new Error(`研究主題失敗: 發生未知錯誤`);
      }
    }
  }

  /**
   * Generate a podcast outline from research results
   * @param research Research results
   * @param language Language for output
   * @returns Outline structure
   */
  async generateOutline(research: ResearchResult, language: 'en' | 'zh-TW' = 'en'): Promise<Outline> {
    const isZh = language === 'zh-TW';
    const systemPrompt = isZh
      ? '你是一位專業的播客大綱創作者。基於提供的研究結果，創建一個結構良好的播客大綱。回應格式應為 JSON，包含 title、description 和 sections 欄位。sections 應是一個陣列，每個元素包含 id（唯一字串）、title、keyPoints（字串陣列）和 duration（秒數整數）。請使用繁體中文。'
      : 'You are a professional podcast outline creator. Based on the research provided, create a well-structured podcast outline. Respond in JSON format with fields: title (string), description (string), and sections (array of {id: string, title: string, keyPoints: string[], duration: number}). Use English throughout.';
    const userPrompt = isZh
      ? `基於以下研究結果創建播客大綱：\n\n主題: ${research.topic}\n\n摘要: ${research.summary}\n\n關鍵要點: ${research.keyPoints.join(', ')}`
      : `Create a podcast outline based on the following research:\n\nTopic: ${research.topic}\n\nSummary: ${research.summary}\n\nKey Points: ${research.keyPoints.join(', ')}`;

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: LARGE_ONLINE_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from response (handle markdown code blocks)
      let parsedContent;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        parsedContent = JSON.parse(jsonMatch ? jsonMatch[1] : content);
      } catch {
        parsedContent = {
          title: `Podcast about ${research.topic}`,
          description: research.summary.substring(0, 200) + (research.summary.length > 200 ? '…' : ''),
          sections: []
        };
      }

      // Ensure every section has a unique id
      const rawSections: OutlineSection[] = (parsedContent.sections || []).map(
        (s: Partial<OutlineSection>, idx: number) => ({
          id: s.id || `section-${Date.now()}-${idx}`,
          title: s.title || `Section ${idx + 1}`,
          keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
          duration: typeof s.duration === 'number' ? s.duration : 120,
        })
      );

      return {
        title: parsedContent.title || `Podcast about ${research.topic}`,
        description: parsedContent.description || '',
        sections: rawSections,
      };
    } catch (error: unknown) {
      console.error('生成大綱時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成大綱失敗: ${error.message}`);
      } else {
        throw new Error(`生成大綱失敗: 發生未知錯誤`);
      }
    }
  }

  /**
   * 為特定段落生成詳細內容
   * @param section 大綱段落
   * @param research 研究結果
   * @returns 詳細內容
   */
  async generateSectionContent(section: OutlineSection, research: ResearchResult): Promise<string> {
    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: LARGE_ONLINE_MODEL,
          messages: [
            {
              role: 'system',
              content: '你是一位專業的內容作家。基於提供的大綱段落和研究結果，創建詳細且引人入勝的內容。'
            },
            {
              role: 'user',
              content: `基於以下資訊為播客段落創建詳細內容：\n\n段落標題: ${section.title}\n\n段落關鍵要點: ${section.keyPoints.join(', ')}\n\n相關研究: ${research.summary}`
            }
          ],
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error: unknown) {
      console.error('生成段落內容時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成段落內容失敗: ${error.message}`);
      } else {
        throw new Error(`生成段落內容失敗: 發生未知錯誤`);
      }
    }
  }
}