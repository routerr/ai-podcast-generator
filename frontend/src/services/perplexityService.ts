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
   * 研究主題並收集資訊
   * @param topic 主題
   * @returns 研究結果
   */
  async researchTopic(topic: string): Promise<ResearchResult> {
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
            {
              role: 'system',
              content: '你是一個播客內容創作的研究助手。請提供關於主題的深入研究，包括摘要、關鍵要點和可靠來源。回應格式應為 JSON，包含 summary、keyPoints 和 sources 欄位。sources 應包含 title、url 和 snippet。'
            },
            {
              role: 'user',
              content: `研究以下主題：${topic}`
            }
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
      
      // 解析回應中的 JSON 內容
      let parsedContent;
      try {
        // 如果內容被包在 Markdown 代碼塊中，提取 JSON 部分
        const jsonMatch = content.match(/```(?:json)?\s*({.*?})\s*```/s);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[1]);
        } else {
          parsedContent = JSON.parse(content);
        }
      } catch (parseError) {
        // 如果解析失敗，創建一個基本結構
        parsedContent = {
          summary: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          keyPoints: [],
          sources: []
        };
      }

      return {
        topic,
        summary: parsedContent.summary || '',
        keyPoints: parsedContent.keyPoints || [],
        sources: parsedContent.sources || [],
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
   * 根據研究結果生成播客大綱
   * @param research 研究結果
   * @returns 大綱結構
   */
  async generateOutline(research: ResearchResult): Promise<Outline> {
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
              content: '你是一位專業的播客大綱創作者。基於提供的研究結果，創建一個結構良好的播客大綱。回應格式應為 JSON，包含 title、description 和 sections 欄位。sections 應是一個陣列，每個元素包含 id、title、keyPoints 和 duration。'
            },
            {
              role: 'user',
              content: `基於以下研究結果創建播客大綱：\n\n主題: ${research.topic}\n\n摘要: ${research.summary}\n\n關鍵要點: ${research.keyPoints.join(', ')}`
            }
          ],
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // 解析回應中的 JSON 內容
      let parsedContent;
      try {
        // 如果內容被包在 Markdown 代碼塊中，提取 JSON 部分
        const jsonMatch = content.match(/```(?:json)?\s*({.*?})\s*```/s);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[1]);
        } else {
          parsedContent = JSON.parse(content);
        }
      } catch (parseError) {
        // 如果解析失敗，創建一個基本結構
        parsedContent = {
          title: `關於 ${research.topic} 的播客`,
          description: research.summary.substring(0, 200) + (research.summary.length > 200 ? '...' : ''),
          sections: []
        };
      }

      return {
        title: parsedContent.title || `關於 ${research.topic} 的播客`,
        description: parsedContent.description || '',
        sections: parsedContent.sections || []
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