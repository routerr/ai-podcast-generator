/**
 * Audio processing service
 */
export class AudioService {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  /**
   * Merge multiple audio Blobs into a single Blob by concatenating their decoded PCM data.
   */
  async mergeAudioBlobs(audioBlobs: Blob[]): Promise<Blob> {
    if (audioBlobs.length === 0) {
      throw new Error('No audio blobs to merge.');
    }

    try {
      const arrayBuffers = await Promise.all(audioBlobs.map(b => b.arrayBuffer()));
      const audioBuffers = await Promise.all(
        arrayBuffers.map(ab => this.audioContext.decodeAudioData(ab))
      );

      const sampleRate = audioBuffers[0].sampleRate;
      const numberOfChannels = audioBuffers[0].numberOfChannels;
      const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);

      const mergedBuffer = this.audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

      for (let channel = 0; channel < numberOfChannels; channel++) {
        const mergedData = mergedBuffer.getChannelData(channel);
        let offset = 0;
        for (const buf of audioBuffers) {
          mergedData.set(buf.getChannelData(channel), offset);
          offset += buf.length;
        }
      }

      return this.audioBufferToWavBlob(mergedBuffer);
    } catch (error) {
      throw new Error(`Failed to merge audio blobs: ${error}`);
    }
  }

  /**
   * Create a silent audio Blob of the given duration (milliseconds).
   */
  async addPause(duration: number): Promise<Blob> {
    try {
      const sampleRate = this.audioContext.sampleRate;
      const numSamples = Math.ceil((duration / 1000) * sampleRate);
      const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
      // Channel data is already zeroed by default
      return this.audioBufferToWavBlob(buffer);
    } catch (error) {
      throw new Error(`Failed to create pause audio: ${error}`);
    }
  }

  /**
   * Get the duration (in seconds) of an audio Blob.
   */
  async getAudioDuration(audioBlob: Blob): Promise<number> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer.duration;
    } catch (error) {
      throw new Error(`Failed to get audio duration: ${error}`);
    }
  }

  /**
   * Trigger a browser download for the given audio Blob.
   */
  createDownloadLink(audioBlob: Blob, filename: string): void {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a short delay so the browser can initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * Encode an AudioBuffer as a WAV Blob.
   * Samples are properly interleaved for multi-channel audio.
   */
  private audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const dataBytes = numFrames * blockAlign;

    // WAV header is 44 bytes
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // sub-chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);          // bits per sample

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataBytes, true);

    // Interleave channel data: frame0-ch0, frame0-ch1, frame1-ch0, frame1-ch1, …
    const channelData = Array.from({ length: numChannels }, (_, c) =>
      audioBuffer.getChannelData(c)
    );
    let offset = 44;
    for (let frame = 0; frame < numFrames; frame++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
        const pcm = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
        view.setInt16(offset, pcm, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
