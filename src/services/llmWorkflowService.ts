import {
  ApiKeys,
  Dialogue,
  LLMFallbackProvider,
  LLMProvider,
  Outline,
  OutlineSection,
  ResearchResult,
  Script,
  SessionConfig
} from '../types';
import { GeminiService } from './geminiService';
import { OpenAiCompatibleLlmService } from './openAiCompatibleLlmService';
import { PerplexityService } from './perplexityService';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-lite-preview-02-05:free';
const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';
const DEFAULT_OLLAMA_BASE_URL = 'https://api.ollama.com';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash-latest';
const DEFAULT_PERPLEXITY_MODEL = 'sonar-pro';

interface ProviderClient {
  researchTopic: (topic: string, options?: { signal?: AbortSignal }) => Promise<ResearchResult>;
  generateOutline: (research: ResearchResult, options?: { signal?: AbortSignal }) => Promise<Outline>;
  generatePodcastScript: (outline: Outline, research: ResearchResult, options?: { signal?: AbortSignal }) => Promise<Script>;
  generateSectionDialogue?: (
    section: OutlineSection,
    research: ResearchResult,
    previousContext?: string,
    options?: { signal?: AbortSignal }
  ) => Promise<Dialogue[]>;
  refineScript?: (script: Script, feedback: string, options?: { signal?: AbortSignal }) => Promise<Script>;
}

export interface LlmRunResult<T> {
  result: T;
  provider: LLMProvider;
  usedFallback: boolean;
}

export interface GenerateSectionDialogueInput {
  outline: Outline;
  section: OutlineSection;
  research: ResearchResult;
  previousContext?: string;
  currentScript?: Script;
}

export interface RefineScriptInput {
  outline: Outline;
  research: ResearchResult;
  script: Script;
  feedback: string;
}

const toDisplayName = (provider: LLMProvider): string => {
  switch (provider) {
    case 'gemini':
      return 'Google Gemini';
    case 'perplexity':
      return 'Perplexity';
    case 'openrouter':
      return 'OpenRouter';
    case 'ollama':
      return 'Ollama';
  }
};

const normalizeBaseUrl = (value: string): string =>
  value
    .trim()
    .replace(/\/+$/, '');

export const isLocalOllamaBaseUrl = (value: string): boolean => {
  const normalized = normalizeBaseUrl(value || DEFAULT_OLLAMA_BASE_URL);

  try {
    const parsed = new URL(normalized);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const providerNeedsApiKey = (provider: LLMProvider, config: SessionConfig): boolean => {
  if (provider !== 'ollama') {
    return true;
  }

  return !isLocalOllamaBaseUrl(config.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
};

const providerHasConfiguredKey = (provider: LLMProvider, apiKeys: ApiKeys): boolean => {
  switch (provider) {
    case 'gemini':
      return Boolean(apiKeys.geminiKey?.trim());
    case 'perplexity':
      return Boolean(apiKeys.perplexityKey?.trim());
    case 'openrouter':
      return Boolean(apiKeys.openrouterKey?.trim());
    case 'ollama':
      return Boolean(apiKeys.ollamaKey?.trim());
  }
};

const normalizeProviderChain = (
  primary: LLMProvider,
  fallback: LLMFallbackProvider
): LLMProvider[] => {
  if (fallback === 'none' || fallback === primary) {
    return [primary];
  }

  return [primary, fallback];
};

export const getProviderChain = (config: SessionConfig): LLMProvider[] =>
  normalizeProviderChain(config.llmPrimaryProvider, config.llmFallbackProvider);

export const getMissingProviderKeys = (apiKeys: ApiKeys, config: SessionConfig): LLMProvider[] => {
  return getProviderChain(config).filter((provider) => {
    if (!providerNeedsApiKey(provider, config)) {
      return false;
    }

    return !providerHasConfiguredKey(provider, apiKeys);
  });
};

const summarizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || 'Unknown error');
};

export class LlmWorkflowService {
  private apiKeys: ApiKeys;
  private config: SessionConfig;

  constructor(options: { apiKeys: ApiKeys; config: SessionConfig }) {
    this.apiKeys = options.apiKeys;
    this.config = options.config;
  }

  private getProviderChain(): LLMProvider[] {
    return getProviderChain(this.config);
  }

  private getProviderApiKey(provider: LLMProvider): string {
    switch (provider) {
      case 'gemini':
        return this.apiKeys.geminiKey?.trim() || '';
      case 'perplexity':
        return this.apiKeys.perplexityKey?.trim() || '';
      case 'openrouter':
        return this.apiKeys.openrouterKey?.trim() || '';
      case 'ollama':
        return this.apiKeys.ollamaKey?.trim() || '';
    }
  }

  private createClient(provider: LLMProvider): ProviderClient {
    if (provider === 'gemini') {
      const geminiKey = this.getProviderApiKey('gemini');
      if (!geminiKey) {
        throw new Error('Google Gemini API key is missing.');
      }

      const geminiService = new GeminiService(this.config.geminiModel || DEFAULT_GEMINI_MODEL);
      return {
        researchTopic: (topic, options) => geminiService.researchTopic(geminiKey, topic, options),
        generateOutline: (research, options) => geminiService.generateOutline(geminiKey, research, options),
        generatePodcastScript: (outline, research, options) =>
          geminiService.generatePodcastScript(geminiKey, outline, research, options),
        generateSectionDialogue: (section, research, previousContext, options) =>
          geminiService.generateSectionDialogue(geminiKey, section, research, previousContext, options),
        refineScript: (script, feedback, options) => geminiService.refineScript(geminiKey, script, feedback, options)
      };
    }

    if (provider === 'perplexity') {
      const perplexityKey = this.getProviderApiKey('perplexity');
      if (!perplexityKey) {
        throw new Error('Perplexity API key is missing.');
      }

      const perplexityService = new PerplexityService(perplexityKey, this.config.perplexityModel || DEFAULT_PERPLEXITY_MODEL);
      return {
        researchTopic: (topic, options) => perplexityService.researchTopic(topic, options),
        generateOutline: (research, options) => perplexityService.generateOutline(research, options),
        generatePodcastScript: (outline, research, options) =>
          perplexityService.generatePodcastScript(outline, research, options)
      };
    }

    if (provider === 'openrouter') {
      const openrouterKey = this.getProviderApiKey('openrouter');
      if (!openrouterKey) {
        throw new Error('OpenRouter API key is missing.');
      }

      const openrouterService = new OpenAiCompatibleLlmService({
        provider: 'openrouter',
        apiKey: openrouterKey,
        model: this.config.openrouterModel || DEFAULT_OPENROUTER_MODEL
      });

      return {
        researchTopic: (topic, options) => openrouterService.researchTopic(topic, options),
        generateOutline: (research, options) => openrouterService.generateOutline(research, options),
        generatePodcastScript: (outline, research, options) =>
          openrouterService.generatePodcastScript(outline, research, options)
      };
    }

    const ollamaBaseUrl = normalizeBaseUrl(this.config.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
    const ollamaApiKey = this.getProviderApiKey('ollama');
    const needsApiKey = !isLocalOllamaBaseUrl(ollamaBaseUrl);

    if (needsApiKey && !ollamaApiKey) {
      throw new Error('Ollama API key is missing.');
    }

    const ollamaService = new OpenAiCompatibleLlmService({
      provider: 'ollama',
      apiKey: ollamaApiKey,
      model: this.config.ollamaModel || DEFAULT_OLLAMA_MODEL,
      baseUrl: ollamaBaseUrl
    });

    return {
      researchTopic: (topic, options) => ollamaService.researchTopic(topic, options),
      generateOutline: (research, options) => ollamaService.generateOutline(research, options),
      generatePodcastScript: (outline, research, options) =>
        ollamaService.generatePodcastScript(outline, research, options)
    };
  }

  private async runWithFallback<T>(
    operationLabel: string,
    run: (provider: LLMProvider, client: ProviderClient) => Promise<T>,
    options?: { signal?: AbortSignal }
  ): Promise<LlmRunResult<T>> {
    const chain = this.getProviderChain();
    const primary = chain[0];
    const missingProviders = getMissingProviderKeys(this.apiKeys, this.config);

    if (missingProviders.length === chain.length) {
      throw new Error(
        `Missing API key for selected provider(s): ${missingProviders
          .map((provider) => toDisplayName(provider))
          .join(', ')}`
      );
    }

    const providerErrors: string[] = [];

    for (const provider of chain) {
      if (missingProviders.includes(provider)) {
        providerErrors.push(`${toDisplayName(provider)}: API key missing`);
        continue;
      }

      try {
        const client = this.createClient(provider);
        const result = await run(provider, client);
        return {
          result,
          provider,
          usedFallback: provider !== primary
        };
      } catch (error) {
        if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw error;
        }
        providerErrors.push(`${toDisplayName(provider)}: ${summarizeErrorMessage(error)}`);
      }
    }

    throw new Error(`${operationLabel} failed. ${providerErrors.join(' | ')}`);
  }

  async researchTopic(topic: string, options?: { signal?: AbortSignal }): Promise<LlmRunResult<ResearchResult>> {
    return this.runWithFallback('Research topic', (_provider, client) => client.researchTopic(topic, options), options);
  }

  async generateOutline(research: ResearchResult, options?: { signal?: AbortSignal }): Promise<LlmRunResult<Outline>> {
    return this.runWithFallback('Generate outline', (_provider, client) =>
      client.generateOutline(research, options),
      options
    );
  }

  async generatePodcastScript(
    outline: Outline,
    research: ResearchResult,
    options?: { signal?: AbortSignal }
  ): Promise<LlmRunResult<Script>> {
    return this.runWithFallback('Generate podcast script', (_provider, client) =>
      client.generatePodcastScript(outline, research, options),
      options
    );
  }

  async generateSectionDialogue(
    input: GenerateSectionDialogueInput,
    options?: { signal?: AbortSignal }
  ): Promise<LlmRunResult<Dialogue[]>> {
    return this.runWithFallback('Regenerate section', async (_provider, client) => {
      if (client.generateSectionDialogue) {
        return client.generateSectionDialogue(
          input.section,
          input.research,
          input.previousContext,
          options
        );
      }

      const regeneratedScript = await client.generatePodcastScript(input.outline, input.research, options);
      const sectionInRegenerated =
        regeneratedScript.sections.find((section) => section.id === input.section.id) ||
        regeneratedScript.sections.find((section) => section.title === input.section.title);

      if (!sectionInRegenerated) {
        throw new Error('Unable to find regenerated section in script output.');
      }

      const dialogueIdSet = new Set(sectionInRegenerated.dialogueIds);
      const sectionDialogues = regeneratedScript.dialogues.filter((dialogue) =>
        dialogueIdSet.has(dialogue.id)
      );

      if (sectionDialogues.length > 0) {
        return sectionDialogues;
      }

      if (input.currentScript) {
        const currentSection = input.currentScript.sections.find((section) => section.id === input.section.id);
        if (currentSection) {
          const currentDialogueIdSet = new Set(currentSection.dialogueIds);
          const currentSectionDialogues = input.currentScript.dialogues.filter((dialogue) =>
            currentDialogueIdSet.has(dialogue.id)
          );
          if (currentSectionDialogues.length > 0) {
            return currentSectionDialogues;
          }
        }
      }

      throw new Error('Regenerated section did not contain usable dialogues.');
    });
  }

  async refineScript(input: RefineScriptInput, options?: { signal?: AbortSignal }): Promise<LlmRunResult<Script>> {
    return this.runWithFallback('Refine script', async (_provider, client) => {
      if (client.refineScript) {
        return client.refineScript(input.script, input.feedback, options);
      }

      const refinedResearch: ResearchResult = {
        ...input.research,
        summary: `${input.research.summary}\n\nRefinement feedback:\n${input.feedback}`,
        keyPoints: [
          ...input.research.keyPoints,
          `Please refine the script with this feedback: ${input.feedback}`
        ],
        timestamp: new Date()
      };

      return client.generatePodcastScript(input.outline, refinedResearch, options);
    }, options);
  }
}

export const getProviderDisplayName = toDisplayName;
