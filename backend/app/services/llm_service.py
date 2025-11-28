"""
LLM Service - Handles local (Ollama) and cloud LLM providers
"""

import httpx
import json
from typing import Optional, List
from app.config import settings


class LLMService:
    """Service for interacting with LLM providers (Ollama, OpenAI, Anthropic)"""
    
    def __init__(self):
        self.provider = settings.llm_provider
        self.ollama_url = settings.ollama_base_url
        self.ollama_model = settings.ollama_model
        
    async def check_health(self) -> bool:
        """Check if the LLM service is available"""
        try:
            if self.provider == "ollama":
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{self.ollama_url}/api/tags", timeout=5.0)
                    return response.status_code == 200
            elif self.provider == "openai":
                return settings.openai_api_key is not None
            elif self.provider == "anthropic":
                return settings.anthropic_api_key is not None
            return False
        except Exception:
            return False
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate text using the configured LLM provider"""
        
        if self.provider == "ollama":
            return await self._generate_ollama(prompt, system_prompt, temperature)
        elif self.provider == "openai":
            return await self._generate_openai(prompt, system_prompt, temperature, max_tokens)
        elif self.provider == "anthropic":
            return await self._generate_anthropic(prompt, system_prompt, temperature, max_tokens)
        else:
            raise ValueError(f"Unknown LLM provider: {self.provider}")
    
    async def _generate_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ) -> str:
        """Generate using Ollama API"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=300.0  # 5 min timeout for long generations
            )
            response.raise_for_status()
            result = response.json()
            return result["message"]["content"]
    
    async def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate using OpenAI API"""
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.openai_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens
                },
                timeout=300.0
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    
    async def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096
    ) -> str:
        """Generate using Anthropic API"""
        if not settings.anthropic_api_key:
            raise ValueError("Anthropic API key not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": max_tokens,
                    "system": system_prompt or "",
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=300.0
            )
            response.raise_for_status()
            result = response.json()
            return result["content"][0]["text"]
    
    async def generate_clarifying_questions(self, topic: str) -> List[dict]:
        """Generate clarifying questions for a given topic"""
        
        system_prompt = """You are a helpful assistant that generates clarifying questions for podcast topics.
Your goal is to understand what specific aspects of the topic the user wants to explore.

Generate 3-5 multiple choice questions that will help narrow down:
1. The specific angle or subtopic they're interested in
2. Their knowledge level (beginner/intermediate/expert)
3. What they hope to learn or achieve

Format your response as JSON array:
[
  {
    "question_id": "q1",
    "question": "The question text",
    "options": [
      {"key": "A", "text": "Option A text"},
      {"key": "B", "text": "Option B text"},
      {"key": "C", "text": "Option C text"}
    ]
  }
]

Keep questions concise and options clear. Generate only valid JSON."""

        prompt = f"""Generate clarifying questions for this podcast topic: "{topic}"

The questions should help understand:
- What specific aspect the user wants to focus on
- Their background knowledge level
- What outcome they're hoping for

Return ONLY valid JSON array, no other text."""

        response = await self.generate(prompt, system_prompt, temperature=0.7)
        
        # Try to parse JSON from response
        try:
            # Clean up response if needed
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            questions = json.loads(response)
            return questions
        except json.JSONDecodeError:
            # Fallback to default questions
            return [
                {
                    "question_id": "q1",
                    "question": "What's your current knowledge level on this topic?",
                    "options": [
                        {"key": "A", "text": "Beginner - I'm new to this"},
                        {"key": "B", "text": "Intermediate - I know the basics"},
                        {"key": "C", "text": "Advanced - I want deep insights"}
                    ]
                },
                {
                    "question_id": "q2",
                    "question": "What would you like to focus on?",
                    "options": [
                        {"key": "A", "text": "Broad overview of the topic"},
                        {"key": "B", "text": "Practical applications"},
                        {"key": "C", "text": "Latest developments and trends"}
                    ]
                },
                {
                    "question_id": "q3",
                    "question": "What's your goal for this podcast?",
                    "options": [
                        {"key": "A", "text": "Learn something new"},
                        {"key": "B", "text": "Deepen existing knowledge"},
                        {"key": "C", "text": "Get different perspectives"}
                    ]
                }
            ]
