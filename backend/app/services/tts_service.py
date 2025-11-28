"""
TTS Service - Text-to-Speech generation using Edge TTS or OpenAI
"""

import asyncio
import os
from pathlib import Path
from typing import Dict, List, Optional
import edge_tts
from pydub import AudioSegment
from app.config import settings


class TTSService:
    """Service for text-to-speech generation"""
    
    def __init__(self):
        self.provider = settings.tts_provider
        self.output_dir = Path(settings.output_dir)
        self.temp_dir = Path(settings.temp_dir)
        
        # Voice mappings
        self.voices = {
            "en": {
                "narrator": settings.edge_voice_en_male,
                "host": settings.edge_voice_en_female,
                "expert": settings.edge_voice_en_male
            },
            "zh-TW": {
                "narrator": settings.edge_voice_zh_male,
                "host": settings.edge_voice_zh_female,
                "expert": settings.edge_voice_zh_male
            }
        }
        
    async def check_health(self) -> bool:
        """Check if TTS service is available"""
        try:
            if self.provider == "edge":
                # Edge TTS is always available (free service)
                return True
            elif self.provider == "openai":
                return settings.openai_api_key is not None
            return False
        except Exception:
            return False
    
    async def generate_audio(
        self,
        script: Dict,
        format: str,  # "solo" or "dialogue"
        language: str,  # "en" or "zh-TW"
        session_id: str
    ) -> str:
        """
        Generate audio from podcast script.
        
        Returns:
            Path to the generated MP3 file
        """
        
        segments = script.get("segments", [])
        if not segments:
            raise ValueError("Script has no segments")
        
        # Generate audio for each segment
        audio_files = []
        
        for i, segment in enumerate(segments):
            speaker = segment.get("speaker", "narrator")
            text = segment.get("text", "")
            
            if not text.strip():
                continue
            
            # Get appropriate voice
            voice = self._get_voice(speaker, language)
            
            # Generate audio file for this segment
            segment_file = self.temp_dir / f"{session_id}_segment_{i}.mp3"
            
            if self.provider == "edge":
                await self._generate_edge_tts(text, voice, str(segment_file))
            elif self.provider == "openai":
                await self._generate_openai_tts(text, voice, str(segment_file))
            
            audio_files.append(str(segment_file))
        
        # Combine all segments into final audio
        output_file = self.output_dir / f"podcast_{session_id}.mp3"
        await self._combine_audio_files(audio_files, str(output_file))
        
        # Clean up temp files
        for f in audio_files:
            try:
                os.remove(f)
            except:
                pass
        
        return str(output_file)
    
    def _get_voice(self, speaker: str, language: str) -> str:
        """Get the appropriate voice for a speaker"""
        lang_voices = self.voices.get(language, self.voices["en"])
        return lang_voices.get(speaker, lang_voices["narrator"])
    
    async def _generate_edge_tts(
        self,
        text: str,
        voice: str,
        output_path: str
    ) -> None:
        """Generate audio using Microsoft Edge TTS (free)"""
        
        # Edge TTS requires text to be broken into chunks for very long text
        max_chunk_size = 3000  # Characters
        
        if len(text) <= max_chunk_size:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_path)
        else:
            # Split into chunks and combine
            chunks = self._split_text_into_chunks(text, max_chunk_size)
            chunk_files = []
            
            for i, chunk in enumerate(chunks):
                chunk_file = output_path.replace(".mp3", f"_chunk_{i}.mp3")
                communicate = edge_tts.Communicate(chunk, voice)
                await communicate.save(chunk_file)
                chunk_files.append(chunk_file)
            
            # Combine chunks
            await self._combine_audio_files(chunk_files, output_path)
            
            # Clean up chunk files
            for f in chunk_files:
                try:
                    os.remove(f)
                except:
                    pass
    
    async def _generate_openai_tts(
        self,
        text: str,
        voice: str,
        output_path: str
    ) -> None:
        """Generate audio using OpenAI TTS API"""
        import httpx
        
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        # Map our voice names to OpenAI voices
        openai_voice_map = {
            settings.edge_voice_en_male: "onyx",
            settings.edge_voice_en_female: "nova",
            settings.edge_voice_zh_male: "onyx",
            settings.edge_voice_zh_female: "nova"
        }
        openai_voice = openai_voice_map.get(voice, "alloy")
        
        # OpenAI TTS has a 4096 character limit
        max_chunk_size = 4000
        
        if len(text) <= max_chunk_size:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": settings.openai_tts_model,
                        "input": text,
                        "voice": openai_voice,
                        "response_format": "mp3"
                    },
                    timeout=120.0
                )
                response.raise_for_status()
                
                with open(output_path, "wb") as f:
                    f.write(response.content)
        else:
            # Split into chunks
            chunks = self._split_text_into_chunks(text, max_chunk_size)
            chunk_files = []
            
            async with httpx.AsyncClient() as client:
                for i, chunk in enumerate(chunks):
                    chunk_file = output_path.replace(".mp3", f"_chunk_{i}.mp3")
                    
                    response = await client.post(
                        "https://api.openai.com/v1/audio/speech",
                        headers={
                            "Authorization": f"Bearer {settings.openai_api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": settings.openai_tts_model,
                            "input": chunk,
                            "voice": openai_voice,
                            "response_format": "mp3"
                        },
                        timeout=120.0
                    )
                    response.raise_for_status()
                    
                    with open(chunk_file, "wb") as f:
                        f.write(response.content)
                    
                    chunk_files.append(chunk_file)
            
            # Combine chunks
            await self._combine_audio_files(chunk_files, output_path)
            
            # Clean up
            for f in chunk_files:
                try:
                    os.remove(f)
                except:
                    pass
    
    def _split_text_into_chunks(self, text: str, max_size: int) -> List[str]:
        """Split text into chunks at sentence boundaries"""
        sentences = []
        current = ""
        
        # Simple sentence splitting (handles . ! ? followed by space)
        import re
        parts = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        
        for part in parts:
            if len(current_chunk) + len(part) + 1 <= max_size:
                current_chunk += (" " if current_chunk else "") + part
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = part
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def _combine_audio_files(
        self,
        input_files: List[str],
        output_file: str
    ) -> None:
        """Combine multiple audio files into one"""
        
        if not input_files:
            raise ValueError("No input files to combine")
        
        if len(input_files) == 1:
            # Just copy the single file
            import shutil
            shutil.copy(input_files[0], output_file)
            return
        
        # Use pydub to combine (runs in thread pool to not block)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._combine_audio_sync,
            input_files,
            output_file
        )
    
    def _combine_audio_sync(
        self,
        input_files: List[str],
        output_file: str
    ) -> None:
        """Synchronous audio combination using pydub"""
        
        combined = AudioSegment.empty()
        
        # Add a small pause between segments (300ms)
        pause = AudioSegment.silent(duration=300)
        
        for i, file_path in enumerate(input_files):
            try:
                segment = AudioSegment.from_mp3(file_path)
                combined += segment
                
                # Add pause between segments (not after the last one)
                if i < len(input_files) - 1:
                    combined += pause
            except Exception as e:
                print(f"Error loading audio file {file_path}: {e}")
        
        # Export combined audio
        combined.export(output_file, format="mp3", bitrate="192k")
    
    async def list_available_voices(self, language: Optional[str] = None) -> List[Dict]:
        """List available Edge TTS voices"""
        voices = await edge_tts.list_voices()
        
        result = []
        for voice in voices:
            if language:
                if voice["Locale"].startswith(language.replace("-", "_")):
                    result.append({
                        "name": voice["ShortName"],
                        "gender": voice["Gender"],
                        "locale": voice["Locale"]
                    })
            else:
                result.append({
                    "name": voice["ShortName"],
                    "gender": voice["Gender"],
                    "locale": voice["Locale"]
                })
        
        return result
