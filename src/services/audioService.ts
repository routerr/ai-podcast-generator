// @ts-ignore
import * as lamejs from 'lamejs';

// Polyfill for lamejs in Vite/ES environments
if (typeof window !== 'undefined') {
  (window as any).MPEGMode = (lamejs as any).MPEGMode || function (ordinal: number) {
    return { ordinal: () => ordinal };
  };
}

/**
 * 音訊處理服務類別
 */
export class AudioService {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  /**
   * 合併多個音訊 Blob 成一個真正的 MP3
   * @param audioBlobs 音訊 Blob 陣列
   * @returns MP3 格式的音訊 Blob
   */
  async mergeAudioBlobs(audioBlobs: Blob[]): Promise<Blob> {
    try {
      // 將所有 Blob 转換為 ArrayBuffer
      const arrayBuffers = await Promise.all(
        audioBlobs.map(blob => blob.arrayBuffer())
      );

      // 解碼所有音訊資料
      const audioBuffers = await Promise.all(
        arrayBuffers.map(buffer => this.audioContext.decodeAudioData(buffer))
      );

      // 計算總長度
      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      
      // 創建新的音訊緩衝區
      const sampleRate = audioBuffers[0].sampleRate;
      const numberOfChannels = audioBuffers[0].numberOfChannels;
      const mergedBuffer = this.audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

      // 合併所有音訊資料
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const mergedChannelData = mergedBuffer.getChannelData(channel);
        let offset = 0;
        
        for (const buffer of audioBuffers) {
          // Fallback to mono if a buffer has fewer channels than the target mix
          const sourceChannel = channel < buffer.numberOfChannels ? channel : 0;
          const channelData = buffer.getChannelData(sourceChannel);
          mergedChannelData.set(channelData, offset);
          offset += channelData.length;
        }
      }

      // Convert the perfectly mixed PCM AudioBuffer out to a real MP3 file
      return this.audioBufferToMp3Blob(mergedBuffer);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 將 AudioBuffer 轉換為 MP3 格式的 Blob
   * @param audioBuffer AudioBuffer 物件
   * @returns MP3 格式的 Blob
   */
  private audioBufferToMp3Blob(audioBuffer: AudioBuffer): Blob {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const kbps = 128; // 標準語音品質
    
    // 初始化 LAME 編碼器
    // @ts-ignore
    const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data: Int8Array[] = [];
    
    const leftRaw = audioBuffer.getChannelData(0);
    const rightRaw = channels > 1 ? audioBuffer.getChannelData(1) : leftRaw;
    
    const sampleBlockSize = 1152; // LAME 的固定處理塊
    const left16 = new Int16Array(leftRaw.length);
    const right16 = new Int16Array(rightRaw.length);
    
    // Float32 轉 Int16
    for (let i = 0; i < leftRaw.length; i++) {
        left16[i] = leftRaw[i] < 0 ? leftRaw[i] * 32768 : leftRaw[i] * 32767;
        right16[i] = rightRaw[i] < 0 ? rightRaw[i] * 32768 : rightRaw[i] * 32767;
    }
    
    for (let i = 0; i < left16.length; i += sampleBlockSize) {
        const leftChunk = left16.subarray(i, i + sampleBlockSize);
        const rightChunk = right16.subarray(i, i + sampleBlockSize);
        
        let mp3buf;
        if (channels === 2) {
            mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
        } else {
            mp3buf = encoder.encodeBuffer(leftChunk);
        }
        
        if (mp3buf.length > 0) {
            mp3Data.push(new Int8Array(mp3buf));
        }
    }
    
    const mp3Last = encoder.flush();
    if (mp3Last.length > 0) {
        mp3Data.push(new Int8Array(mp3Last));
    }
    
    // Cast to any to bypass strict TS DOM typings for ArrayBufferLike
    return new Blob(mp3Data as any, { type: 'audio/mpeg' });
  }

  /**
   * 添加暫停音訊
   * @param duration 暫停時間（毫秒）
   * @returns 暫停音訊的 Blob (WAV)
   */
  async addPause(duration: number): Promise<Blob> {
    try {
      // 創建靜音音訊緩衝區
      const sampleRate = this.audioContext.sampleRate;
      const numSamples = (duration / 1000) * sampleRate;
      const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
      
      // 填充靜音數據（全為 0）
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < numSamples; i++) {
        channelData[i] = 0;
      }
      
      // 轉換為 WAV 格式的 Blob
      return this.audioBufferToWavBlob(buffer);
    } catch (error) {
      throw new Error(`Failed to create pause audio: ${error}`);
    }
  }

  /**
   * 將音訊轉換為 MP3 格式
   * 注意：瀏覽器原生不支援直接轉換為 MP3，這裡返回原始音訊
   * 實際應用中可能需要使用第三方庫如 lamejs
   * @param audioBlob 音訊 Blob
   * @returns MP3 格式的音訊 Blob
   */
  async convertToMp3(audioBlob: Blob): Promise<Blob> {
    // 為了簡化實現，這裡直接返回原始音訊
    // 實際應用中可以使用第三方庫進行轉換
    console.warn('MP3 conversion not implemented, returning original audio');
    return audioBlob;
  }

  /**
   * 獲取音訊持續時間
   * @param audioBlob 音訊 Blob
   * @returns 音訊持續時間（秒）
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
   * 創建下載連結
   * @param audioBlob 音訊 Blob
   * @param filename 檔案名稱
   * @returns 下載連結
   */
  createDownloadLink(audioBlob: Blob, filename: string): string {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return url;
  }

  /**
   * 將 AudioBuffer 轉換為 WAV 格式的 Blob
   * @param audioBuffer AudioBuffer 物件
   * @returns WAV 格式的 Blob
   */
  private audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    
    // WAV 檔頭大小為 44 bytes
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // RIFF 標識
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt 子塊
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 子塊大小
    view.setUint16(20, 1, true); // 音訊格式 (1 = PCM)
    view.setUint16(22, numberOfChannels, true); // 頻道數
    view.setUint32(24, sampleRate, true); // 採樣率
    view.setUint32(28, sampleRate * numberOfChannels * 2, true); // 位元組率
    view.setUint16(32, numberOfChannels * 2, true); // 區塊對齊
    view.setUint16(34, 16, true); // 位元深度
    
    // data 子塊
    this.writeString(view, 36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // 寫入音訊資料
    this.floatTo16BitPCM(view, 44, audioBuffer);
    
    return new Blob([view], { type: 'audio/wav' });
  }

  /**
   * 寫入字串到 DataView
   * @param view DataView 物件
   * @param offset 偏移量
   * @param string 字串
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * 將浮點數轉換為 16 位 PCM
   * @param view DataView 物件
   * @param offset 偏移量
   * @param audioBuffer AudioBuffer 物件
   */
  private floatTo16BitPCM(view: DataView, offset: number, audioBuffer: AudioBuffer): void {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;

    // WAV PCM needs interleaved channel samples: frame0(ch1,ch2), frame1(ch1,ch2), ...
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
  }
}
