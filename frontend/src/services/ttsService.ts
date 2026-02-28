import { Dialogue } from '../types';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface OpenAITTSOptions {
  model?: 'tts-1' | 'tts-1-hd';
  voice: OpenAIVoice;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

/**
 * TTS Service
 *
 * Two modes:
 *  1. OpenAI TTS (requires openaiKey) — high-quality, downloadable MP3
 *  2. Web Speech API fallback — browser built-in, playback only (cannot be recorded or downloaded)
 */
export class TTSService {
  /**
   * Synthesize a single dialogue line using OpenAI TTS.
   */
  async synthesizeWithOpenAI(
    dialogue: Dialogue,
    apiKey: string,
    options: OpenAITTSOptions
  ): Promise<Blob> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? 'tts-1',
        input: dialogue.text,
        voice: options.voice,
        response_format: options.response_format ?? 'mp3',
        speed: Math.max(0.25, Math.min(4.0, options.speed ?? 1.0)),
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`OpenAI TTS error ${response.status}: ${err}`);
    }

    return response.blob();
  }

  /**
   * Speak a dialogue line using the browser's Web Speech API (playback only).
   * Returns a promise that resolves when speech ends.
   * NOTE: Web Speech API output goes directly to the speaker and cannot be captured
   * as a Blob — no recording or download is possible through this path.
   */
  speakWithWebSpeech(
    dialogue: Dialogue,
    voiceURI: string,
    rate: number = 1.0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(dialogue.text);
      utterance.rate = Math.max(0.1, Math.min(10, rate));

      const voices = speechSynthesis.getVoices();
      const matched = voices.find(v => v.voiceURI === voiceURI);
      if (matched) utterance.voice = matched;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(`Speech synthesis error: ${e.error}`));

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Generate audio for an entire podcast's dialogue list.
   *
   * - With openaiKey: synthesizes each line via OpenAI TTS and returns Blobs (downloadable).
   * - Without openaiKey: plays each line through Web Speech API sequentially and returns
   *   a single empty Blob placeholder (no recording is possible).
   */
  async generatePodcastAudio(
    dialogues: Dialogue[],
    hostVoiceId: string,
    expertVoiceId: string,
    onProgress?: (progress: number) => void,
    openaiKey?: string,
    rate: number = 1.0,
    hostOpenAIVoice: OpenAIVoice = 'onyx',
    expertOpenAIVoice: OpenAIVoice = 'nova'
  ): Promise<Blob[]> {
    const audioBlobs: Blob[] = [];
    const total = dialogues.length;

    if (openaiKey) {
      // ── OpenAI TTS path ─────────────────────────────────────────────────────
      for (let i = 0; i < total; i++) {
        const dialogue = dialogues[i];
        const voice: OpenAIVoice = dialogue.speaker === 'host' ? hostOpenAIVoice : expertOpenAIVoice;

        const blob = await this.synthesizeWithOpenAI(dialogue, openaiKey, {
          voice,
          model: 'tts-1',
          response_format: 'mp3',
          speed: rate,
        });

        audioBlobs.push(blob);
        onProgress?.(Math.round(((i + 1) / total) * 100));

        // Respect any pauseAfter between dialogues
        if (dialogue.pauseAfter && dialogue.pauseAfter > 0 && i < total - 1) {
          // Pause is handled by AudioService.addPause() at merge time if needed.
          // For simplicity here we just let the natural gap from sequential synthesis serve as pause.
        }
      }
    } else {
      // ── Web Speech API path (playback only, no downloadable blobs) ───────────
      for (let i = 0; i < total; i++) {
        const dialogue = dialogues[i];
        const voiceURI = dialogue.speaker === 'host' ? hostVoiceId : expertVoiceId;
        await this.speakWithWebSpeech(dialogue, voiceURI, rate);
        onProgress?.(Math.round(((i + 1) / total) * 100));
      }

      // Return a single empty placeholder Blob so callers don't have to special-case this path
      audioBlobs.push(new Blob([], { type: 'audio/wav' }));
    }

    return audioBlobs;
  }
}
