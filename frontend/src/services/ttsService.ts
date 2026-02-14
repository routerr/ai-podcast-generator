import { Dialogue } from '../types';

// TTS 選項介面
interface TTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;  // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
}

// OpenAI TTS 選項介面
interface OpenAITTSOptions {
  model?: 'tts-1' | 'tts-1-hd';
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number; // 0.25 to 4.0
}

/**
 * TTS 服務類別
 */
export class TTSService {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * 使用瀏覽器內建語音合成 API 生成對話音訊
   * @param dialogue 對話內容
   * @param options TTS 選項
   * @returns 音訊 Blob
   */
  async synthesizeDialogueWithWebSpeech(
    dialogue: Dialogue,
    options: TTSOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // 創建語音合成實例
        const utterance = new SpeechSynthesisUtterance(dialogue.text);
        
        // 設置選項
        if (options.voice) utterance.voice = options.voice;
        if (options.rate) utterance.rate = options.rate;
        if (options.pitch) utterance.pitch = options.pitch;
        if (options.volume) utterance.volume = options.volume;
        
        // 創建媒體流目標來捕獲音訊
        if (!this.audioContext) {
          reject(new Error('AudioContext not supported'));
          return;
        }
        
        const destination = this.audioContext.createMediaStreamDestination();
        const mediaRecorder = new MediaRecorder(destination.stream);
        const audioChunks: Blob[] = [];
        
        // 設置錄製事件處理程序
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          resolve(audioBlob);
        };
        
        mediaRecorder.onerror = (error) => {
          reject(new Error(`MediaRecorder error: ${error}`));
        };
        
        // 連接語音合成到媒體流
        const source = this.audioContext.createMediaStreamSource(destination.stream);
        source.connect(destination);
        
        // 開始錄製和語音合成
        mediaRecorder.start();
        speechSynthesis.speak(utterance);
        
        // 在語音結束時停止錄製
        utterance.onend = () => {
          mediaRecorder.stop();
        };
        
        // 錯誤處理
        utterance.onerror = (error) => {
          mediaRecorder.stop();
          reject(new Error(`Speech synthesis error: ${error.error}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 使用 OpenAI TTS API 生成對話音訊
   * @param dialogue 對話內容
   * @param apiKey OpenAI API 金鑰
   * @param options TTS 選項
   * @returns 音訊 Blob
   */
  async synthesizeDialogueWithOpenAI(
    dialogue: Dialogue,
    apiKey: string,
    options: OpenAITTSOptions
  ): Promise<Blob> {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'tts-1',
          input: dialogue.text,
          voice: options.voice,
          response_format: options.response_format || 'mp3',
          speed: options.speed || 1.0
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS API error: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new Error(`Failed to synthesize speech with OpenAI: ${error}`);
    }
  }

  /**
   * 生成單個對話的音訊
   * @param dialogue 對話內容
   * @param apiKey OpenAI API 金鑰（可選，如果提供則使用 OpenAI TTS）
   * @param ttsOptions TTS 選項
   * @returns 音訊 Blob
   */
  async generateDialogueAudio(
    dialogue: Dialogue,
    apiKey?: string,
    ttsOptions?: TTSOptions | OpenAITTSOptions
  ): Promise<Blob> {
    if (apiKey) {
      // 使用 OpenAI TTS
      const openaiOptions = ttsOptions as OpenAITTSOptions || {
        voice: 'alloy',
        model: 'tts-1',
        response_format: 'mp3',
        speed: 1.0
      };
      
      return this.synthesizeDialogueWithOpenAI(dialogue, apiKey, openaiOptions);
    } else {
      // 使用瀏覽器內建語音合成
      const webSpeechOptions = ttsOptions as TTSOptions || {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };
      
      return this.synthesizeDialogueWithWebSpeech(dialogue, webSpeechOptions);
    }
  }

  /**
   * 生成整個播客的音訊
   * @param dialogues 對話列表
   * @param hostVoice 主持人聲音選項
   * @param expertVoice 專家聲音選項
   * @param onProgress 進度回調函數
   * @param openaiKey OpenAI API 金鑰（可選）
   * @returns 音訊 Blob 陣列
   */
  async generatePodcastAudio(
    dialogues: Dialogue[],
    hostVoice: string,
    expertVoice: string,
    onProgress?: (progress: number) => void,
    openaiKey?: string
  ): Promise<Blob[]> {
    const audioBlobs: Blob[] = [];
    const totalDialogues = dialogues.length;
    
    // 獲取可用的語音列表
    const availableVoices = speechSynthesis.getVoices();
    
    for (let i = 0; i < totalDialogues; i++) {
      const dialogue = dialogues[i];
      
      try {
        let audioBlob: Blob;
        
        if (openaiKey) {
          // 使用 OpenAI TTS
          audioBlob = await this.generateDialogueAudio(
            dialogue,
            openaiKey,
            {
              voice: dialogue.speaker === 'host' ? 'onyx' : 'nova', // 映射到 OpenAI 語音
              model: 'tts-1',
              response_format: 'mp3',
              speed: 1.0
            }
          );
        } else {
          // 使用瀏覽器內建語音合成
          // 找到匹配的語音
          let selectedVoice = availableVoices.find(voice => 
            voice.name.toLowerCase().includes(
              dialogue.speaker === 'host' ? hostVoice.toLowerCase() : expertVoice.toLowerCase()
            )
          );
          
          // 如果沒有找到特定語音，使用第一個可用的語音
          if (!selectedVoice && availableVoices.length > 0) {
            selectedVoice = availableVoices[0];
          }
          
          audioBlob = await this.generateDialogueAudio(
            dialogue,
            undefined,
            {
              voice: selectedVoice,
              rate: 1.0,
              pitch: 1.0,
              volume: 1.0
            }
          );
        }
        
        audioBlobs.push(audioBlob);
        
        // 更新進度
        if (onProgress) {
          onProgress(Math.round(((i + 1) / totalDialogues) * 100));
        }
      } catch (error) {
        console.error(`Error generating audio for dialogue ${i}:`, error);
        throw new Error(`Failed to generate audio for dialogue: ${error}`);
      }
    }
    
    return audioBlobs;
  }
}