import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { TTSService } from '../services/ttsService';
import { AudioService } from '../services/audioService';
import { VoiceOption } from '../types';

const AudioPanel: React.FC = () => {
  const {
    apiKeys,
    podcastState,
    audioState,
    dispatch
  } = useAppContext();
  const { t } = useI18n();

  const [hostVoice, setHostVoice] = useState<string>('');
  const [expertVoice, setExpertVoice] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [isBrowserPreviewPlaying, setIsBrowserPreviewPlaying] = useState<boolean>(false);
  const [browserPreviewProgress, setBrowserPreviewProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: 'SET_AUDIO_STATE', payload: { isGenerating: false, error: null } });
  }, [dispatch]);

  useEffect(() => {
    const initializeVoices = () => {
      const browserVoices = speechSynthesis.getVoices().map((voice) => ({
        id: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        source: 'web-speech' as const
      }));

      const openaiVoices: VoiceOption[] = [
        { id: 'alloy', name: 'Alloy (OpenAI)', source: 'openai' },
        { id: 'echo', name: 'Echo (OpenAI)', source: 'openai' },
        { id: 'fable', name: 'Fable (OpenAI)', source: 'openai' },
        { id: 'onyx', name: 'Onyx (OpenAI)', source: 'openai' },
        { id: 'nova', name: 'Nova (OpenAI)', source: 'openai' },
        { id: 'shimmer', name: 'Shimmer (OpenAI)', source: 'openai' }
      ];

      const allVoices = [...browserVoices, ...openaiVoices];
      setAvailableVoices(allVoices);

      if (browserVoices.length > 0) {
        setHostVoice(browserVoices[0].id);
        setExpertVoice(browserVoices[Math.min(1, browserVoices.length - 1)]?.id || browserVoices[0].id);
      } else if (openaiVoices.length > 0) {
        setHostVoice(openaiVoices[0].id);
        setExpertVoice(openaiVoices[Math.min(1, openaiVoices.length - 1)]?.id || openaiVoices[0].id);
      }
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = initializeVoices;
    }

    initializeVoices();
  }, []);

  const generateAudio = useCallback(async () => {
    if (!podcastState.script) {
      dispatch({ type: 'SET_ERROR', payload: t('audio.error.noScript') });
      return;
    }

    if (!apiKeys.openaiKey) {
      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          error: 'OpenAI API key is required for downloadable audio. You can still use browser preview.'
        }
      });
      return;
    }

    dispatch({ type: 'SET_AUDIO_STATE', payload: { isGenerating: true, progress: 0, error: null } });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const ttsService = new TTSService();
      const audioService = new AudioService();

      const audioBlobs = await ttsService.generatePodcastAudio(
        podcastState.script.dialogues,
        hostVoice,
        expertVoice,
        (progress) => {
          dispatch({ type: 'SET_AUDIO_STATE', payload: { progress } });
        },
        apiKeys.openaiKey,
        rate,
        abortController.signal
      );

      const sequenceBlobs: Blob[] = [];
      for (let i = 0; i < podcastState.script.dialogues.length; i++) {
        if (abortController.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        sequenceBlobs.push(audioBlobs[i]);
        // Note: We intentionally skip adding WAV PCM pauses here to allow
        // clean byte-by-byte concatenation of the native OpenAI MP3 blobs.
      }

      // Concatenate the MP3 chunks directly into a single valid MP3 file
      const mergedAudioBlob = new Blob(sequenceBlobs, { type: 'audio/mpeg' });
      const duration = await audioService.getAudioDuration(mergedAudioBlob);
      const audioUrl = URL.createObjectURL(mergedAudioBlob);

      if (audioState.audioUrl) {
        URL.revokeObjectURL(audioState.audioUrl);
      }

      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          isGenerating: false,
          progress: 100,
          audioBlob: mergedAudioBlob,
          audioUrl,
          duration,
          error: null
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Audio generation canceled by user');
        return;
      }
      console.error('Error generating audio:', err);
      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          isGenerating: false,
          error: err instanceof Error ? err.message : t('audio.error.unknown')
        }
      });
    }
  }, [apiKeys.openaiKey, audioState.audioUrl, dispatch, expertVoice, hostVoice, podcastState.script, rate, t]);

  const stopBrowserPreview = useCallback(() => {
    const ttsService = new TTSService();
    ttsService.stopWebSpeechPlayback();
    setBrowserPreviewProgress(0);
    setIsBrowserPreviewPlaying(false);
  }, []);

  const startBrowserPreview = useCallback(async () => {
    if (!podcastState.script || audioState.isGenerating) {
      return;
    }

    setIsBrowserPreviewPlaying(true);
    setBrowserPreviewProgress(0);
    dispatch({ type: 'SET_AUDIO_STATE', payload: { error: null } });

    try {
      const ttsService = new TTSService();
      await ttsService.playDialoguesWithWebSpeech(
        podcastState.script.dialogues,
        hostVoice,
        expertVoice,
        rate,
        (progress) => {
          setBrowserPreviewProgress(progress);
        }
      );
    } catch (error) {
      dispatch({
        type: 'SET_AUDIO_STATE',
        payload: {
          error: error instanceof Error ? error.message : t('audio.error.unknown')
        }
      });
    } finally {
      setIsBrowserPreviewPlaying(false);
    }
  }, [audioState.isGenerating, dispatch, expertVoice, hostVoice, podcastState.script, rate, t]);

  const downloadPodcast = () => {
    if (!audioState.audioBlob || !podcastState.script) return;

    const audioService = new AudioService();
    // Fallback to topic if title is somehow missing
    const rawTitle = podcastState.script.title || podcastState.topic || 'podcast';
    // Remove invalid filename characters, replace spaces with underscores, but preserve multilingual text
    const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
    const filename = `${safeTitle}.mp3`;

    audioService.createDownloadLink(audioState.audioBlob, filename);
  };

  const goToScriptStep = () => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'script' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      const ttsService = new TTSService();
      ttsService.stopWebSpeechPlayback();
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('audio.title')}</h1>
        <p className="espresso-muted">
          {t('audio.subtitle')}
        </p>
      </div>

      {audioState.error && (
        <div className="mb-6 p-4 rounded-xl espresso-error">
          <div className="flex justify-between items-center">
            <span>{audioState.error}</span>
            <button
              onClick={() => dispatch({ type: 'SET_AUDIO_STATE', payload: { error: null } })}
              className="espresso-muted hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="espresso-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">{t('audio.settingsTitle')}</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium espresso-muted mb-2">
                  {t('audio.hostVoice')}
                </label>
                <select
                  value={hostVoice}
                  onChange={(e) => setHostVoice(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 focus:outline-none espresso-select"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.source === 'openai' && t('audio.highQualityTag')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium espresso-muted mb-2">
                  {t('audio.expertVoice')}
                </label>
                <select
                  value={expertVoice}
                  onChange={(e) => setExpertVoice(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 focus:outline-none espresso-select"
                  disabled={audioState.isGenerating}
                >
                  {availableVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} {voice.source === 'openai' && t('audio.highQualityTag')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium espresso-muted mb-2">
                  {t('audio.rate', { rate: rate.toFixed(1) })}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#fab387] bg-[#4a3b35]"
                  disabled={audioState.isGenerating}
                />
                <div className="flex justify-between text-xs espresso-muted mt-1">
                  <span>{t('audio.slow')}</span>
                  <span>{t('audio.fast')}</span>
                </div>
              </div>

              {podcastState.script && (
                <div className="espresso-card-soft rounded-lg p-4 border">
                  <div className="flex justify-between items-center">
                    <span className="text-[#fab387]">{t('audio.estimatedDuration')}</span>
                    <span className="text-white font-medium">
                      {formatDuration(podcastState.script.totalDuration)}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={generateAudio}
                disabled={audioState.isGenerating || !podcastState.script}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  audioState.isGenerating || !podcastState.script
                    ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                    : 'espresso-btn-primary'
                }`}
              >
                {t('audio.generate')}
              </button>

              <button
                onClick={isBrowserPreviewPlaying ? stopBrowserPreview : startBrowserPreview}
                disabled={!podcastState.script || audioState.isGenerating}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  !podcastState.script || audioState.isGenerating
                    ? 'espresso-btn-secondary cursor-not-allowed opacity-70'
                    : 'espresso-btn-secondary'
                }`}
              >
                {isBrowserPreviewPlaying
                  ? `Stop Browser Preview (${browserPreviewProgress}%)`
                  : 'Play with Browser Preview (No download)'}
              </button>

              {!apiKeys.openaiKey && (
                <p className="text-sm text-[#f9e2af]">
                  Add OpenAI API key to generate downloadable podcast audio.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="espresso-card rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">{t('audio.previewTitle')}</h2>

            {audioState.audioBlob ? (
              <div className="space-y-6">
                <div className="espresso-card-soft rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">{t('audio.podcastAudio')}</h3>
                      <p className="espresso-muted text-sm">
                        {t('audio.duration', { duration: formatDuration(audioState.duration) })}
                      </p>
                    </div>

                    <span className="text-sm espresso-muted">Stored in browser</span>
                  </div>

                  <audio controls src={audioState.audioUrl || undefined} className="w-full" />
                </div>

                <button
                  onClick={downloadPodcast}
                  className="w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center espresso-btn-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {t('audio.download')}
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-[#a58f83] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">{t('audio.notGeneratedTitle')}</h3>
                <p className="espresso-muted">
                  {t('audio.notGeneratedDescription')}
                </p>
              </div>
            )}

            <div className="mt-8 pt-6 border-t espresso-divider">
              <button
                onClick={goToScriptStep}
                className="px-4 py-2 rounded-lg font-medium transition-all espresso-btn-secondary"
              >
                {`← ${t('audio.backToScript')}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {audioState.isGenerating && (
        <div 
          className="fixed inset-0 espresso-overlay backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCancelGeneration}
        >
          <div 
            className="espresso-card rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-[#fab387] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">
                {t('audio.generating', { progress: audioState.progress })}
              </h3>
              <p className="espresso-muted text-center mb-6">
                {t('script.modal.processingDescription')}
              </p>
              
              <button
                onClick={handleCancelGeneration}
                className="px-6 py-2 rounded-lg font-medium transition-all espresso-btn-danger"
              >
                {t('script.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioPanel;
