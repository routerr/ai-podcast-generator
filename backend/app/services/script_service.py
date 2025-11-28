"""
Script Service - Generate podcast scripts (solo or dialogue format)
"""

from typing import Dict, List, Optional
from app.config import settings
from app.services.llm_service import LLMService


class ScriptService:
    """Service for generating podcast scripts"""
    
    def __init__(self):
        self.llm = LLMService()
        
    async def generate_script(
        self,
        topic: str,
        research: Dict,
        qa_context: dict,
        format: str,  # "solo" or "dialogue"
        length: str,  # "short", "medium", "long"
        language: str  # "en" or "zh-TW"
    ) -> Dict:
        """
        Generate a podcast script based on research.
        
        Returns:
            Dict containing:
            - format: "solo" or "dialogue"
            - segments: List of script segments
            - word_count: Approximate word count
            - estimated_duration: In minutes
        """
        
        # Determine target word count
        word_targets = {
            "short": settings.length_short_words,
            "medium": settings.length_medium_words,
            "long": settings.length_long_words
        }
        target_words = word_targets.get(length, settings.length_medium_words)
        
        if format == "solo":
            script = await self._generate_solo_script(
                topic, research, qa_context, target_words, language
            )
        else:
            script = await self._generate_dialogue_script(
                topic, research, qa_context, target_words, language
            )
        
        return script
    
    async def _generate_solo_script(
        self,
        topic: str,
        research: Dict,
        qa_context: dict,
        target_words: int,
        language: str
    ) -> Dict:
        """Generate a single-narrator podcast script"""
        
        research_content = self._format_research_for_prompt(research)
        context_str = "\n".join([f"- {k}: {v}" for k, v in qa_context.items()])
        
        lang_instruction = "in English" if language == "en" else "in Traditional Chinese (繁體中文)"
        
        system_prompt = f"""You are an expert podcast scriptwriter creating engaging solo narration scripts {lang_instruction}.

Your scripts should:
1. Start with a compelling hook that draws listeners in
2. Have clear structure: Introduction → Main Content → Conclusion
3. Use conversational, engaging language (not academic)
4. Include transitions between sections
5. Add rhetorical questions to keep listeners engaged
6. Include specific examples, stories, and analogies
7. End with a memorable conclusion and call-to-action

Target length: approximately {target_words} words.

Format output as JSON:
{{
  "title": "Episode title",
  "segments": [
    {{
      "type": "intro|main|conclusion",
      "speaker": "narrator",
      "text": "The spoken text"
    }}
  ],
  "word_count": number
}}"""

        prompt = f"""Create a solo podcast script about: {topic}

User preferences:
{context_str}

Research content:
{research_content}

Generate an engaging, well-structured podcast script of approximately {target_words} words.
Make it conversational and interesting to listen to.

Return valid JSON only."""

        response = await self.llm.generate(prompt, system_prompt, temperature=0.8, max_tokens=8000)
        
        return self._parse_script_response(response, "solo")
    
    async def _generate_dialogue_script(
        self,
        topic: str,
        research: Dict,
        qa_context: dict,
        target_words: int,
        language: str
    ) -> Dict:
        """Generate a two-person dialogue podcast script (host + expert)"""
        
        research_content = self._format_research_for_prompt(research)
        context_str = "\n".join([f"- {k}: {v}" for k, v in qa_context.items()])
        
        lang_instruction = "in English" if language == "en" else "in Traditional Chinese (繁體中文)"
        
        # Define personas
        if language == "en":
            host_name = "Alex"
            expert_name = "Dr. Morgan"
            host_desc = "Alex is a curious, enthusiastic podcast host who asks great questions"
            expert_desc = "Dr. Morgan is a knowledgeable expert who explains complex topics accessibly"
        else:
            host_name = "小明"
            expert_name = "陳博士"
            host_desc = "小明是一位充滿好奇心的主持人，善於提出好問題"
            expert_desc = "陳博士是一位知識淵博的專家，能夠深入淺出地解釋複雜話題"
        
        system_prompt = f"""You are creating a two-person podcast dialogue script {lang_instruction}.

Characters:
- {host_name}: {host_desc}
- {expert_name}: {expert_desc}

The dialogue should:
1. Feel like a natural, engaging conversation
2. Have {host_name} ask questions that the audience would want to know
3. Have {expert_name} provide insightful, detailed answers with examples
4. Include moments of humor, surprise, or "aha!" realizations
5. Have natural back-and-forth, not just Q&A
6. Use appropriate discourse markers ("Exactly!", "That's interesting...", "Let me give you an example...")
7. Build progressively from basics to more complex ideas

Target length: approximately {target_words} words.

Format as JSON:
{{
  "title": "Episode title",
  "host": "{host_name}",
  "expert": "{expert_name}",
  "segments": [
    {{
      "type": "intro|discussion|conclusion",
      "speaker": "host|expert",
      "text": "The spoken text"
    }}
  ],
  "word_count": number
}}"""

        prompt = f"""Create a dialogue podcast script about: {topic}

User preferences:
{context_str}

Research content:
{research_content}

Generate an engaging conversation between {host_name} (host) and {expert_name} (expert).
Target approximately {target_words} words total.
Make the conversation feel natural, with good chemistry between the speakers.

Return valid JSON only."""

        response = await self.llm.generate(prompt, system_prompt, temperature=0.8, max_tokens=8000)
        
        return self._parse_script_response(response, "dialogue")
    
    def _format_research_for_prompt(self, research: Dict) -> str:
        """Format research results for inclusion in prompt"""
        
        parts = []
        
        # Try to get parsed synthesis
        if research.get("parsed"):
            parsed = research["parsed"]
            if parsed.get("summary"):
                parts.append(f"Summary:\n{parsed['summary']}")
            if parsed.get("key_points"):
                points = "\n".join([f"- {p}" for p in parsed["key_points"]])
                parts.append(f"Key Points:\n{points}")
            if parsed.get("sections"):
                for section in parsed["sections"]:
                    parts.append(f"\n{section.get('title', 'Section')}:\n{section.get('content', '')}")
        
        # Fallback to raw synthesis
        if not parts and research.get("raw_synthesis"):
            parts.append(research["raw_synthesis"][:3000])
        
        # Add sources
        if research.get("sources"):
            sources = "\n".join([f"- {s['title']}: {s['url']}" for s in research["sources"][:5]])
            parts.append(f"\nSources:\n{sources}")
        
        return "\n\n".join(parts)[:4000]  # Limit total length
    
    def _parse_script_response(self, response: str, format: str) -> Dict:
        """Parse the LLM response into a structured script"""
        import json
        
        try:
            # Clean response
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            script = json.loads(response)
            
            # Calculate word count if not provided
            if not script.get("word_count"):
                total_words = sum(
                    len(seg.get("text", "").split())
                    for seg in script.get("segments", [])
                )
                script["word_count"] = total_words
            
            # Estimate duration
            script["estimated_duration"] = round(
                script["word_count"] / settings.words_per_minute, 1
            )
            script["format"] = format
            
            return script
            
        except json.JSONDecodeError:
            # Fallback: treat entire response as single segment
            word_count = len(response.split())
            return {
                "format": format,
                "title": "Podcast Episode",
                "segments": [
                    {
                        "type": "main",
                        "speaker": "narrator" if format == "solo" else "host",
                        "text": response
                    }
                ],
                "word_count": word_count,
                "estimated_duration": round(word_count / settings.words_per_minute, 1),
                "parse_error": True
            }
