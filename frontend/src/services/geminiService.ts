/**
 * Google Gemini API 服務
 * 實現與 Google Gemini API 的整合，用於生成對話式播客腳本
 */

import { Outline, ResearchResult, Script, Dialogue, ScriptSection, OutlineSection } from '../types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-1.5-flash';

export class GeminiService {
  constructor() {
    // 不再需要儲存 apiKey，因為每個方法都會接收 apiKey 參數
  }

  /**
   * 生成對話腳本
   * @param apiKey API 金鑰
   * @param outline 大綱
   * @param research 研究結果
   * @returns 對話腳本
   */
  async generatePodcastScript(
    apiKey: string,
    outline: Outline,
    research: ResearchResult
  ): Promise<Script> {
    try {
      // 系統提示詞，定義播客腳本的格式和規則
      const systemPrompt = `
        你是一位專業的播客腳本作家。你的任務是創建一個引人入勝的對話式內容，由主持人和專家進行互動。
        
        規則：
        1. 主持人負責引入話題和提出問題
        2. 専家提供詳細、有見地的回答
        3. 使用自然、口語化的語言
        4. 包含話題之間的過渡
        5. 在適當的地方加入情感標記 [好奇]、[興奮]、[深思]
        6. 保持對話簡潔但內容豐富
        7. 維持專業但友善的語調
        
        格式要求：
        - 每行以 [主持人] 或 [專家] 開頭
        - 每行後面跟著對話內容
        - 可以在對話後添加情感標記，如：[主持人] 今天我們有一個非常有趣的話題要討論。[興奮]
        - 可以指定停頓時間，如：[主持人] 讓我們先來聽聽專家的看法。[停頓:2000]
        
        範例格式：
        [主持人] 歡迎收聽今天的播客節目。我是您的主持人。[興奮]
        [專家] 很高興能來到這裡與大家分享知識。[友善]
        [主持人] 今天我們要討論的是人工智慧的未來發展。[好奇]
      `.trim();

      // 使用者提示詞，包含具體的大綱和研究內容
      const userPrompt = `
        請根據以下大綱和研究內容創建一個完整的播客對話腳本：
        
        播客標題：${outline.title}
        播客描述：${outline.description}
        
        研究內容：
        摘要：${research.summary}
        關鍵要點：${research.keyPoints.join(', ')}
        
        大綱段落：
        ${outline.sections.map((section, index) => `
        ${index + 1}. ${section.title}
           關鍵要點：${section.keyPoints.join(', ')}
           預估時長：${section.duration} 秒
        `).join('\n')}
        
        請創建一個完整的對話腳本，涵蓋所有大綱段落。
      `.trim();

      const response = await fetch(
        `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: systemPrompt + '\n\n' + userPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // 解析生成的對話內容
      const dialogues = this.parseDialogues(content);
      
      // 創建腳本段落結構
      const sections: ScriptSection[] = outline.sections.map((section, index) => ({
        id: section.id,
        title: section.title,
        // 為簡單起見，將對話平均分配給各段落
        dialogueIds: dialogues
          .slice(Math.floor(index * dialogues.length / outline.sections.length), 
                 Math.floor((index + 1) * dialogues.length / outline.sections.length))
          .map(d => d.id)
      }));
      
      // 計算總時長（簡化計算，假設平均每句話需要 5 秒）
      const totalDuration = dialogues.length * 5;

      return {
        id: `script_${Date.now()}`,
        title: outline.title,
        dialogues,
        totalDuration,
        sections
      };
    } catch (error: unknown) {
      console.error('生成播客腳本時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成播客腳本失敗: ${error.message}`);
      } else {
        throw new Error(`生成播客腳本失敗: 發生未知錯誤`);
      }
    }
  }

  /**
   * 為特定段落生成對話
   * @param apiKey API 金鑰
   * @param section 大綱段落
   * @param research 研究結果
   * @param previousContext 先前的對話上下文（可選）
   * @returns 對話列表
   */
  async generateSectionDialogue(
    apiKey: string,
    section: OutlineSection,
    research: ResearchResult,
    previousContext?: string
  ): Promise<Dialogue[]> {
    try {
      const systemPrompt = `
        你是一位專業的播客腳本作家。你的任務是為播客的一個特定段落創建對話內容。
        
        規則：
        1. 主持人負責引入話題和提出問題
        2. 専家提供詳細、有見地的回答
        3. 使用自然、口語化的語言
        4. 加入情感標記 [好奇]、[興奮]、[深思] 使對話更生動
        5. 保持對話簡潔但內容豐富
        
        格式要求：
        - 每行以 [主持人] 或 [專家] 開頭
        - 每行後面跟著對話內容
        - 可以在對話後添加情感標記，如：[主持人] 今天我們有一個非常有趣的話題要討論。[興奮]
      `.trim();

      const userPrompt = `
        請為以下播客段落創建對話內容：
        
        段落標題：${section.title}
        段落關鍵要點：${section.keyPoints.join(', ')}
        預估時長：${section.duration} 秒
        
        相關研究內容：
        摘要：${research.summary}
        關鍵要點：${research.keyPoints.join(', ')}
        
        ${previousContext ? `先前對話上下文：${previousContext}` : ''}
        
        請創建一段適合這個段落的對話，通常包含 3-5 輪交談。
      `.trim();

      const response = await fetch(
        `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: systemPrompt + '\n\n' + userPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return this.parseDialogues(content);
    } catch (error: unknown) {
      console.error('生成段落對話時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`生成段落對話失敗: ${error.message}`);
      } else {
        throw new Error(`生成段落對話失敗: 發生未知錯誤`);
      }
    }
  }

  /**
   * 根據反饋優化腳本
   * @param apiKey API 金鑰
   * @param script 原始腳本
   * @param feedback 用戶反饋
   * @returns 優化後的腳本
   */
  async refineScript(
    apiKey: string,
    script: Script,
    feedback: string
  ): Promise<Script> {
    try {
      const systemPrompt = `
        你是一位專業的播客腳本編輯。你的任務是根據用戶反饋對現有的播客對話腳本進行修改和完善。
        
        規則：
        1. 保持原有的對話結構和格式
        2. 根據反饋進行相應的調整
        3. 確保修改後的對話仍然自然流暢
        4. 可以調整對話內容、情感標記或停頓時間
        5. 保持主持人和專家的角色特點
        
        格式要求：
        - 每行以 [主持人] 或 [專家] 開頭
        - 每行後面跟著對話內容
        - 可以包含情感標記和停頓時間
      `.trim();

      const userPrompt = `
        請根據以下反饋對播客腳本進行修改：
        
        播客標題：${script.title}
        
        用戶反饋：${feedback}
        
        原始腳本：
        ${script.dialogues.map(d => `[${d.speaker === 'host' ? '主持人' : '專家'}] ${d.text}${d.emotion ? `[${d.emotion}]` : ''}${d.pauseAfter ? `[停頓:${d.pauseAfter}]` : ''}`).join('\n')}
        
        請提供修改後的完整腳本。
      `.trim();

      const response = await fetch(
        `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: systemPrompt + '\n\n' + userPrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API 錯誤: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // 解析生成的對話內容
      const dialogues = this.parseDialogues(content);
      
      // 保持原有的段落結構，但更新對話內容
      const sections = script.sections.map(section => ({
        ...section,
        dialogueIds: section.dialogueIds.filter(id => dialogues.some(d => d.id === id))
      }));

      return {
        ...script,
        dialogues,
        sections
      };
    } catch (error: unknown) {
      console.error('優化播客腳本時發生錯誤:', error);
      if (error instanceof Error) {
        throw new Error(`優化播客腳本失敗: ${error.message}`);
      } else {
        throw new Error(`優化播客腳本失敗: 發生未知錯誤`);
      }
    }
  }

  /**
   * 解析對話內容
   * @param content 原始內容字串
   * @returns 對話物件陣列
   */
  private parseDialogues(content: string): Dialogue[] {
    const dialogues: Dialogue[] = [];
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 匹配 [主持人] 或 [專家] 開頭的行
      const speakerMatch = line.match(/^\[(主持人|專家)\]\s*(.*)/);
      if (speakerMatch) {
        let text = speakerMatch[2];
        const emotionMatch = text.match(/\[(好奇|興奮|深思|中性)\]$/);
        let emotion: 'neutral' | 'curious' | 'excited' | 'thoughtful' | undefined;
        
        if (emotionMatch) {
          text = text.replace(/\[(好奇|興奮|深思|中性)\]$/, '').trim();
          emotion = emotionMatch[1] === '好奇' ? 'curious' : 
                   emotionMatch[1] === '興奮' ? 'excited' : 
                   emotionMatch[1] === '深思' ? 'thoughtful' : 'neutral';
        }
        
        const pauseMatch = text.match(/\[停頓:(\d+)\]$/);
        let pauseAfter: number | undefined;
        
        if (pauseMatch) {
          text = text.replace(/\[停頓:(\d+)\]$/, '').trim();
          pauseAfter = parseInt(pauseMatch[1], 10);
        }
        
        dialogues.push({
          id: `dialogue_${Date.now()}_${i}`,
          speaker: speakerMatch[1] === '主持人' ? 'host' : 'expert',
          text,
          emotion,
          pauseAfter
        });
      }
    }
    
    return dialogues;
  }
}