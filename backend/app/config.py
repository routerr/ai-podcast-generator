"""
Configuration settings for AI Podcast Generator
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # App settings
    app_name: str = "AI Podcast Generator"
    debug: bool = True
    
    # LLM Settings
    llm_provider: str = "ollama"  # "ollama", "openai", "anthropic"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"  # or "qwen2.5:7b" for better Chinese
    
    # OpenAI fallback (optional)
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    
    # Anthropic fallback (optional)
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-sonnet-4-20250514"
    
    # TTS Settings
    tts_provider: str = "edge"  # "edge", "openai", "coqui"
    openai_tts_model: str = "tts-1-hd"
    
    # Edge TTS voices (free, good quality)
    edge_voice_en_male: str = "en-US-GuyNeural"
    edge_voice_en_female: str = "en-US-JennyNeural"
    edge_voice_zh_male: str = "zh-TW-YunJheNeural"
    edge_voice_zh_female: str = "zh-TW-HsiaoChenNeural"
    
    # Research settings
    research_provider: str = "perplexity"  # "perplexity", "tavily", "searxng", "duckduckgo"
    perplexity_api_key: Optional[str] = None
    perplexity_model: str = "sonar-pro"  # "sonar", "sonar-pro", "sonar-deep-research"
    tavily_api_key: Optional[str] = None
    searxng_url: Optional[str] = None
    
    # Storage
    output_dir: str = "./output"
    temp_dir: str = "./temp"
    
    # Podcast settings
    words_per_minute: int = 150  # Average speaking rate
    
    # Length targets (in words, approximate)
    length_short_words: int = 750    # ~5 min
    length_medium_words: int = 2250  # ~15 min
    length_long_words: int = 4500    # ~30 min
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
os.makedirs(settings.output_dir, exist_ok=True)
os.makedirs(settings.temp_dir, exist_ok=True)
