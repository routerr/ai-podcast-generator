"""
Research Service - Deep web research for podcast content
"""

import httpx
import asyncio
import json
from typing import Optional, List, Dict
from app.config import settings
from app.services.llm_service import LLMService


class ResearchService:
    """Service for conducting deep web research on topics"""
    
    def __init__(self):
        self.provider = settings.research_provider
        self.llm = LLMService()
        
    async def deep_research(
        self,
        topic: str,
        qa_context: dict,
        language: str = "en"
    ) -> Dict:
        """
        Conduct deep research on a topic.
        
        Returns:
            Dict containing:
            - summary: Overall summary
            - key_points: List of main points
            - sources: List of sources used
            - sections: Organized content sections
        """
        
        # Use Perplexity's end-to-end deep research if configured
        if self.provider == "perplexity" and settings.perplexity_api_key:
            return await self._perplexity_deep_research(topic, qa_context, language)
        
        # Fallback to multi-step research process
        # Step 1: Generate search queries based on topic and context
        queries = await self._generate_search_queries(topic, qa_context, language)
        
        # Step 2: Execute searches
        all_results = []
        for query in queries:
            results = await self._search(query)
            all_results.extend(results)
        
        # Step 3: Deduplicate and rank results
        unique_results = self._deduplicate_results(all_results)
        
        # Step 4: Extract and summarize content from top results
        content_extracts = await self._extract_content(unique_results[:10])  # Top 10
        
        # Step 5: Synthesize research into structured format
        research_synthesis = await self._synthesize_research(
            topic, qa_context, content_extracts, language
        )
        
        return research_synthesis
    
    async def _perplexity_deep_research(
        self,
        topic: str,
        qa_context: dict,
        language: str
    ) -> Dict:
        """
        Use Perplexity's API for end-to-end deep research.
        Perplexity combines LLM + web search in a single API call.
        
        Models:
        - sonar: Fast, cost-effective search
        - sonar-pro: More comprehensive search with better reasoning
        - sonar-deep-research: Multi-step research agent (best for podcasts)
        """
        
        context_str = "\n".join([f"- {k}: {v}" for k, v in qa_context.items()])
        lang_instruction = "Respond in English." if language == "en" else "Respond in Traditional Chinese (繁體中文)."
        
        system_prompt = f"""You are a research analyst preparing comprehensive research for a podcast.
{lang_instruction}

Your research should be thorough, well-organized, and include:
1. An executive summary (2-3 paragraphs)
2. Key points and insights (5-7 bullet points)
3. Multiple content sections with detailed information
4. Different perspectives or controversies if any
5. Specific facts, statistics, and examples

Format your response as valid JSON with this structure:
{{
    "summary": "Executive summary here",
    "key_points": ["point 1", "point 2", ...],
    "sections": [
        {{"title": "Section Title", "content": "Detailed content..."}},
        ...
    ],
    "controversies": "Any debates or different viewpoints",
    "statistics": ["stat 1", "stat 2", ...]
}}"""

        user_prompt = f"""Research this topic comprehensively for a podcast:

Topic: {topic}

User Context:
{context_str}

Provide thorough, well-researched information with citations where possible."""

        try:
            async with httpx.AsyncClient() as client:
                # Determine which model to use
                model = settings.perplexity_model
                
                # For deep research model, use different endpoint pattern
                if model == "sonar-deep-research":
                    return await self._perplexity_deep_research_agent(
                        client, topic, qa_context, language, system_prompt, user_prompt
                    )
                
                # Standard sonar/sonar-pro models
                response = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.perplexity_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.2,
                        "return_citations": True,
                        "return_related_questions": True
                    },
                    timeout=120.0
                )
                response.raise_for_status()
                data = response.json()
                
                # Extract response content
                content = data["choices"][0]["message"]["content"]
                citations = data.get("citations", [])
                related_questions = data.get("related_questions", [])
                
                # Parse the JSON response
                parsed = self._safe_parse_json(content)
                
                # Build sources from citations
                sources = []
                for i, citation in enumerate(citations):
                    if isinstance(citation, str):
                        sources.append({"title": f"Source {i+1}", "url": citation})
                    elif isinstance(citation, dict):
                        sources.append({
                            "title": citation.get("title", f"Source {i+1}"),
                            "url": citation.get("url", "")
                        })
                
                return {
                    "raw_synthesis": content,
                    "parsed": parsed,
                    "sources": sources,
                    "related_questions": related_questions,
                    "provider": "perplexity",
                    "model": model
                }
                
        except Exception as e:
            print(f"Perplexity research error: {e}")
            # Fallback to other providers
            return await self._fallback_research(topic, qa_context, language)
    
    async def _perplexity_deep_research_agent(
        self,
        client: httpx.AsyncClient,
        topic: str,
        qa_context: dict,
        language: str,
        system_prompt: str,
        user_prompt: str
    ) -> Dict:
        """
        Use Perplexity's sonar-deep-research model for multi-step research.
        This model conducts multiple search iterations for comprehensive research.
        """
        
        try:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.perplexity_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar-deep-research",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.1,
                    "return_citations": True
                },
                timeout=300.0  # Deep research may take longer
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            citations = data.get("citations", [])
            
            # Parse the JSON response
            parsed = self._safe_parse_json(content)
            
            # Build sources from citations
            sources = []
            for i, citation in enumerate(citations):
                if isinstance(citation, str):
                    sources.append({"title": f"Source {i+1}", "url": citation})
                elif isinstance(citation, dict):
                    sources.append({
                        "title": citation.get("title", f"Source {i+1}"),
                        "url": citation.get("url", "")
                    })
            
            return {
                "raw_synthesis": content,
                "parsed": parsed,
                "sources": sources,
                "provider": "perplexity",
                "model": "sonar-deep-research"
            }
            
        except Exception as e:
            print(f"Perplexity deep research error: {e}")
            # Fall back to standard sonar-pro
            settings.perplexity_model = "sonar-pro"
            return await self._perplexity_deep_research(topic, qa_context, language)
    
    async def _fallback_research(
        self,
        topic: str,
        qa_context: dict,
        language: str
    ) -> Dict:
        """Fallback to traditional multi-step research when Perplexity fails"""
        
        queries = await self._generate_search_queries(topic, qa_context, language)
        
        all_results = []
        for query in queries:
            results = await self._search(query)
            all_results.extend(results)
        
        unique_results = self._deduplicate_results(all_results)
        content_extracts = await self._extract_content(unique_results[:10])
        
        return await self._synthesize_research(topic, qa_context, content_extracts, language)
    
    async def _generate_search_queries(
        self,
        topic: str,
        qa_context: dict,
        language: str
    ) -> List[str]:
        """Generate diverse search queries for comprehensive research"""
        
        context_str = "\n".join([f"- {k}: {v}" for k, v in qa_context.items()])
        
        prompt = f"""Generate 5-7 diverse search queries to research this topic comprehensively.

Topic: {topic}
User Context:
{context_str}

Language preference: {"English" if language == "en" else "Traditional Chinese (繁體中文)"}

Generate queries that cover:
1. Basic overview/definition
2. Recent developments/news
3. Expert opinions/analysis  
4. Practical applications
5. Different perspectives/controversies
6. Statistics/data
7. Case studies/examples

Return ONLY the queries, one per line, no numbering or bullets."""

        response = await self.llm.generate(prompt, temperature=0.5)
        queries = [q.strip() for q in response.strip().split("\n") if q.strip()]
        
        # Always include the original topic
        if topic not in queries:
            queries.insert(0, topic)
        
        return queries[:7]  # Max 7 queries
    
    async def _search(self, query: str) -> List[Dict]:
        """Execute a search using configured provider"""
        
        if self.provider == "perplexity":
            return await self._search_perplexity(query)
        elif self.provider == "tavily":
            return await self._search_tavily(query)
        elif self.provider == "duckduckgo":
            return await self._search_duckduckgo(query)
        else:
            # Fallback to DuckDuckGo
            return await self._search_duckduckgo(query)
    
    async def _search_perplexity(self, query: str) -> List[Dict]:
        """Search using Perplexity API for individual queries"""
        if not settings.perplexity_api_key:
            return await self._search_duckduckgo(query)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.perplexity_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "sonar",  # Use fast model for individual searches
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a helpful research assistant. Provide factual, concise information with sources."
                            },
                            {
                                "role": "user", 
                                "content": query
                            }
                        ],
                        "return_citations": True
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"]
                citations = data.get("citations", [])
                
                results = [{
                    "title": f"Perplexity: {query}",
                    "url": "",
                    "content": content,
                    "score": 1.0
                }]
                
                # Add citations as separate results
                for i, citation in enumerate(citations[:5]):
                    if isinstance(citation, str):
                        results.append({
                            "title": f"Source {i+1}",
                            "url": citation,
                            "content": "",
                            "score": 0.8
                        })
                
                return results
                
        except Exception as e:
            print(f"Perplexity search error: {e}")
            return await self._search_duckduckgo(query)
    
    async def _search_tavily(self, query: str) -> List[Dict]:
        """Search using Tavily API (recommended for deep research)"""
        if not settings.tavily_api_key:
            return await self._search_duckduckgo(query)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.tavily_api_key,
                        "query": query,
                        "search_depth": "advanced",
                        "include_answer": True,
                        "include_raw_content": False,
                        "max_results": 5
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                
                results = []
                for r in data.get("results", []):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "content": r.get("content", ""),
                        "score": r.get("score", 0)
                    })
                
                # Include the AI answer if available
                if data.get("answer"):
                    results.insert(0, {
                        "title": f"AI Summary: {query}",
                        "url": "",
                        "content": data["answer"],
                        "score": 1.0
                    })
                
                return results
                
        except Exception as e:
            print(f"Tavily search error: {e}")
            return await self._search_duckduckgo(query)
    
    async def _search_duckduckgo(self, query: str) -> List[Dict]:
        """Search using DuckDuckGo (free, no API key needed)"""
        try:
            # Using DuckDuckGo Instant Answer API
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q": query,
                        "format": "json",
                        "no_html": 1,
                        "skip_disambig": 1
                    },
                    timeout=15.0
                )
                data = response.json()
                
                results = []
                
                # Abstract
                if data.get("Abstract"):
                    results.append({
                        "title": data.get("Heading", query),
                        "url": data.get("AbstractURL", ""),
                        "content": data["Abstract"],
                        "score": 0.9
                    })
                
                # Related topics
                for topic in data.get("RelatedTopics", [])[:5]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append({
                            "title": topic.get("Text", "")[:100],
                            "url": topic.get("FirstURL", ""),
                            "content": topic.get("Text", ""),
                            "score": 0.7
                        })
                
                return results
                
        except Exception as e:
            print(f"DuckDuckGo search error: {e}")
            return []
    
    def _deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicate results based on URL and content similarity"""
        seen_urls = set()
        unique = []
        
        for r in results:
            url = r.get("url", "")
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            unique.append(r)
        
        # Sort by score
        unique.sort(key=lambda x: x.get("score", 0), reverse=True)
        return unique
    
    async def _extract_content(self, results: List[Dict]) -> List[Dict]:
        """Extract and clean content from search results"""
        # For now, we use the content from search results directly
        # In production, you might want to fetch and parse full pages
        
        extracts = []
        for r in results:
            if r.get("content"):
                extracts.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", "")[:2000],  # Limit content length
                    "score": r.get("score", 0)
                })
        
        return extracts
    
    async def _synthesize_research(
        self,
        topic: str,
        qa_context: dict,
        extracts: List[Dict],
        language: str
    ) -> Dict:
        """Synthesize research extracts into structured content"""
        
        extracts_text = "\n\n".join([
            f"Source: {e['title']}\nURL: {e['url']}\nContent: {e['content']}"
            for e in extracts
        ])
        
        context_str = "\n".join([f"- {k}: {v}" for k, v in qa_context.items()])
        
        lang_instruction = "in English" if language == "en" else "in Traditional Chinese (繁體中文)"
        
        system_prompt = f"""You are a research analyst synthesizing information for a podcast.
Analyze the provided sources and create a comprehensive research summary {lang_instruction}.

Structure your output as JSON with these fields:
- summary: A 2-3 paragraph executive summary
- key_points: Array of 5-7 most important points
- sections: Array of content sections, each with "title" and "content"
- controversies: Any debates or different viewpoints
- sources: List of main sources used

Be thorough but organized. Include specific facts, statistics, and examples."""

        prompt = f"""Topic: {topic}

User Context:
{context_str}

Research Sources:
{extracts_text}

Synthesize this research into a comprehensive summary. Return valid JSON only."""

        response = await self.llm.generate(prompt, system_prompt, temperature=0.3)
        
        try:
            # Clean and parse JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            return {
                "raw_synthesis": response,
                "parsed": self._safe_parse_json(response),
                "sources": [{"title": e["title"], "url": e["url"]} for e in extracts if e.get("url")]
            }
        except Exception as e:
            return {
                "raw_synthesis": response,
                "parsed": None,
                "sources": [{"title": e["title"], "url": e["url"]} for e in extracts if e.get("url")],
                "error": str(e)
            }
    
    def _safe_parse_json(self, text: str) -> Optional[Dict]:
        """Safely parse JSON with error handling"""
        import json
        try:
            return json.loads(text)
        except:
            return None
