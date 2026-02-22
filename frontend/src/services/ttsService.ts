import { Dialogue } from '../types';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface OpenAITTSOptions {
  model?: 'tts-1' | 'tts-1-hd';
  voice: OpenAIVoice;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
  speed?: number;
}

const LOCAL_OPENAI_SPEECH_ENDPOINT = '/openai/speech';
const DEPLOY_OPENAI_SPEECH_ENDPOINT = '/api/openai/speech';
const MAX_API_KEY_LENGTH = 512;
const OPENAI_VOICES: OpenAIVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * TTS 服務類別
 */
export class TTSService {
  private webSpeechCancelled = false;

  private isLocalhostEnvironment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  private getSpeechEndpoints(): string[] {
    if (this.isLocalhostEnvironment()) {
      return [LOCAL_OPENAI_SPEECH_ENDPOINT];
    }

    return [DEPLOY_OPENAI_SPEECH_ENDPOINT, LOCAL_OPENAI_SPEECH_ENDPOINT];
  }

  private normalizeVoice(voice: string | undefined, fallback: OpenAIVoice): OpenAIVoice {
    if (!voice) {
      return fallback;
    }

    const normalized = voice.toLowerCase();
    return OPENAI_VOICES.includes(normalized as OpenAIVoice) ? (normalized as OpenAIVoice) : fallback;
  }

  private async synthesizeDialogueWithOpenAI(
    dialogue: Dialogue,
    apiKey: string,
    options: OpenAITTSOptions,
    signal?: AbortSignal
  ): Promise<Blob> {
    const normalizedApiKey = apiKey.trim().replace(/^Bearer\s+/i, '');
    if (!normalizedApiKey || normalizedApiKey.length <= 10 || normalizedApiKey.length > MAX_API_KEY_LENGTH) {
      throw new Error('OpenAI API key format is invalid.');
    }

    const payload = {
      model: options.model || 'tts-1',
      input: dialogue.text,
      voice: options.voice,
      response_format: options.response_format || 'mp3',
      speed: options.speed || 1.0
    };

    const endpoints = this.getSpeechEndpoints();
    let unavailableCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: normalizedApiKey,
            payload
          })
        });

        const isFromProxy = response.headers.get('x-proxy-handled') === '1';
        if (!isFromProxy && (response.status === 404 || response.status === 405)) {
          unavailableCount += 1;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
        }

        return await response.blob();
      } catch (error) {
        unavailableCount += 1;
        if (unavailableCount >= endpoints.length) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('OpenAI speech proxy request failed.');
        }
      }
    }

    throw new Error('OpenAI speech proxy is unavailable.');
  }

  /**
   * 使用瀏覽器 Web Speech 進行線上播放（不產生可下載檔案）
   */
  async playDialoguesWithWebSpeech(
    dialogues: Dialogue[],
    hostVoiceId: string,
    expertVoiceId: string,
    rate = 1.0,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (typeof window === 'undefined' || typeof speechSynthesis === 'undefined') {
      throw new Error('Web Speech API is not supported in this environment.');
    }

    this.stopWebSpeechPlayback();
    this.webSpeechCancelled = false;

    const availableVoices = speechSynthesis.getVoices();
    const hostVoice =
      availableVoices.find((voice) => voice.voiceURI === hostVoiceId || voice.name === hostVoiceId) ||
      availableVoices[0];
    const expertVoice =
      availableVoices.find((voice) => voice.voiceURI === expertVoiceId || voice.name === expertVoiceId) ||
      availableVoices[Math.min(1, availableVoices.length - 1)] ||
      availableVoices[0];

    for (let i = 0; i < dialogues.length; i++) {
      if (this.webSpeechCancelled) {
        return;
      }

      const dialogue = dialogues[i];
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(dialogue.text);
        const selectedVoice = dialogue.speaker === 'host' ? hostVoice : expertVoice;
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = Math.max(0.5, Math.min(2, rate));
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('Web Speech synthesis failed.'));
        speechSynthesis.speak(utterance);
      });

      if (dialogue.pauseAfter && dialogue.pauseAfter > 0) {
        await sleep(dialogue.pauseAfter);
      }

      if (onProgress) {
        onProgress(Math.round(((i + 1) / dialogues.length) * 100));
      }
    }
  }

  stopWebSpeechPlayback(): void {
    this.webSpeechCancelled = true;
    if (typeof window !== 'undefined' && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  /**
   * 生成整個播客的可下載音訊（OpenAI TTS）
   */
  async generatePodcastAudio(
    dialogues: Dialogue[],
    hostVoice: string,
    expertVoice: string,
    onProgress?: (progress: number) => void,
    openaiKey?: string,
    rate = 1.0,
    signal?: AbortSignal
  ): Promise<Blob[]> {
    if (!openaiKey) {
      throw new Error('OpenAI API key is required for downloadable podcast audio.');
    }

    const audioBlobs: Blob[] = [];
    const totalDialogues = dialogues.length;

    const hostOpenAiVoice = this.normalizeVoice(hostVoice, 'onyx');
    const expertOpenAiVoice = this.normalizeVoice(expertVoice, 'nova');

    for (let i = 0; i < totalDialogues; i++) {
      const dialogue = dialogues[i];
      const selectedVoice = dialogue.speaker === 'host' ? hostOpenAiVoice : expertOpenAiVoice;
      const audioBlob = await this.synthesizeDialogueWithOpenAI(dialogue, openaiKey, {
        voice: selectedVoice,
        model: 'tts-1',
        response_format: 'mp3',
        speed: Math.max(0.5, Math.min(2, rate))
      }, signal);

      audioBlobs.push(audioBlob);

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalDialogues) * 100));
      }
    }

    return audioBlobs;
  }
}
