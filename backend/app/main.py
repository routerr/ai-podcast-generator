"""
AI Voice Podcast Generator - Backend API
A self-hosted alternative to NotebookLM's Audio Overview
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Literal
from enum import Enum
import asyncio
import uuid
import json
from datetime import datetime

from app.services.llm_service import LLMService
from app.services.research_service import ResearchService
from app.services.script_service import ScriptService
from app.services.tts_service import TTSService
from app.config import settings

app = FastAPI(
    title="AI Podcast Generator",
    description="Generate AI-powered podcasts from any topic",
    version="0.1.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage (use Redis in production)
sessions: dict = {}
generation_tasks: dict = {}


class Language(str, Enum):
    ENGLISH = "en"
    CHINESE = "zh-TW"


class PodcastFormat(str, Enum):
    SOLO = "solo"  # Single narrator
    DIALOGUE = "dialogue"  # Host + Expert conversation


class PodcastLength(str, Enum):
    SHORT = "short"  # ~5 min
    MEDIUM = "medium"  # ~15 min
    LONG = "long"  # ~30 min


class TopicInput(BaseModel):
    topic: str
    session_id: Optional[str] = None


class SessionConfig(BaseModel):
    session_id: str
    language: Language = Language.ENGLISH
    format: PodcastFormat = PodcastFormat.DIALOGUE
    length: PodcastLength = PodcastLength.MEDIUM
    answers: dict = {}  # User's answers to clarifying questions


class QAQuestion(BaseModel):
    question_id: str
    question: str
    options: List[dict]  # [{"key": "A", "text": "..."}, ...]


class QAAnswer(BaseModel):
    session_id: str
    question_id: str
    answer: str  # "A", "B", "C", etc.


class GenerationStatus(BaseModel):
    session_id: str
    status: str
    progress: int  # 0-100
    current_step: str
    message: str
    audio_url: Optional[str] = None
    transcript: Optional[str] = None


# Initialize services
llm_service = LLMService()
research_service = ResearchService()
script_service = ScriptService()
tts_service = TTSService()


@app.get("/")
async def root():
    return {
        "message": "AI Podcast Generator API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.post("/api/session/start")
async def start_session(topic_input: TopicInput) -> dict:
    """Start a new podcast generation session with a topic"""
    session_id = topic_input.session_id or str(uuid.uuid4())
    
    sessions[session_id] = {
        "id": session_id,
        "topic": topic_input.topic,
        "created_at": datetime.now().isoformat(),
        "status": "awaiting_config",
        "config": None,
        "qa_answers": {},
        "research_results": None,
        "script": None,
        "audio_path": None
    }
    
    # Generate clarifying questions based on the topic
    questions = await llm_service.generate_clarifying_questions(topic_input.topic)
    
    return {
        "session_id": session_id,
        "topic": topic_input.topic,
        "questions": questions,
        "message": "Session started. Please answer the questions and configure your podcast."
    }


@app.post("/api/session/{session_id}/answer")
async def submit_answer(session_id: str, answer: QAAnswer) -> dict:
    """Submit an answer to a clarifying question"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    sessions[session_id]["qa_answers"][answer.question_id] = answer.answer
    
    return {
        "session_id": session_id,
        "recorded": True,
        "answers_count": len(sessions[session_id]["qa_answers"])
    }


@app.post("/api/session/{session_id}/configure")
async def configure_session(session_id: str, config: SessionConfig) -> dict:
    """Configure podcast settings (language, format, length)"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    sessions[session_id]["config"] = {
        "language": config.language,
        "format": config.format,
        "length": config.length
    }
    sessions[session_id]["status"] = "configured"
    
    return {
        "session_id": session_id,
        "configured": True,
        "ready_to_generate": True
    }


@app.post("/api/session/{session_id}/generate")
async def start_generation(session_id: str, background_tasks: BackgroundTasks) -> dict:
    """Start the podcast generation process"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    if session["status"] not in ["configured", "error"]:
        raise HTTPException(status_code=400, detail=f"Session not ready. Current status: {session['status']}")
    
    sessions[session_id]["status"] = "generating"
    
    # Start background generation task
    background_tasks.add_task(generate_podcast_task, session_id)
    
    return {
        "session_id": session_id,
        "status": "generating",
        "message": "Podcast generation started. Connect to WebSocket for progress updates."
    }


async def generate_podcast_task(session_id: str):
    """Background task for podcast generation"""
    session = sessions[session_id]
    
    try:
        # Step 1: Deep Research (40% of progress)
        sessions[session_id]["status"] = "researching"
        await broadcast_progress(session_id, 5, "researching", "Starting deep web research...")
        
        research_results = await research_service.deep_research(
            topic=session["topic"],
            qa_context=session["qa_answers"],
            language=session["config"]["language"]
        )
        sessions[session_id]["research_results"] = research_results
        await broadcast_progress(session_id, 40, "researching", "Research completed!")
        
        # Step 2: Script Generation (30% of progress)
        sessions[session_id]["status"] = "scripting"
        await broadcast_progress(session_id, 45, "scripting", "Generating podcast script...")
        
        script = await script_service.generate_script(
            topic=session["topic"],
            research=research_results,
            qa_context=session["qa_answers"],
            format=session["config"]["format"],
            length=session["config"]["length"],
            language=session["config"]["language"]
        )
        sessions[session_id]["script"] = script
        await broadcast_progress(session_id, 70, "scripting", "Script completed!")
        
        # Step 3: Audio Generation (30% of progress)
        sessions[session_id]["status"] = "synthesizing"
        await broadcast_progress(session_id, 75, "synthesizing", "Generating audio with TTS...")
        
        audio_path = await tts_service.generate_audio(
            script=script,
            format=session["config"]["format"],
            language=session["config"]["language"],
            session_id=session_id
        )
        sessions[session_id]["audio_path"] = audio_path
        await broadcast_progress(session_id, 100, "completed", "Podcast ready!")
        
        sessions[session_id]["status"] = "completed"
        
    except Exception as e:
        sessions[session_id]["status"] = "error"
        sessions[session_id]["error"] = str(e)
        await broadcast_progress(session_id, -1, "error", f"Error: {str(e)}")


# WebSocket connections for progress updates
active_connections: dict[str, list[WebSocket]] = {}


async def broadcast_progress(session_id: str, progress: int, step: str, message: str):
    """Broadcast progress to all connected WebSocket clients"""
    if session_id in active_connections:
        data = {
            "session_id": session_id,
            "progress": progress,
            "step": step,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        for connection in active_connections[session_id]:
            try:
                await connection.send_json(data)
            except:
                pass


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time progress updates"""
    await websocket.accept()
    
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)
    
    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()
            # Echo back status if requested
            if data == "status":
                session = sessions.get(session_id, {})
                await websocket.send_json({
                    "session_id": session_id,
                    "status": session.get("status", "unknown")
                })
    except WebSocketDisconnect:
        active_connections[session_id].remove(websocket)


@app.get("/api/session/{session_id}/status")
async def get_session_status(session_id: str) -> dict:
    """Get current status of a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    return {
        "session_id": session_id,
        "status": session["status"],
        "topic": session["topic"],
        "config": session.get("config"),
        "has_audio": session.get("audio_path") is not None
    }


@app.get("/api/session/{session_id}/audio")
async def get_audio(session_id: str):
    """Download the generated podcast audio"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    if not session.get("audio_path"):
        raise HTTPException(status_code=404, detail="Audio not yet generated")
    
    return FileResponse(
        session["audio_path"],
        media_type="audio/mpeg",
        filename=f"podcast_{session_id}.mp3"
    )


@app.get("/api/session/{session_id}/transcript")
async def get_transcript(session_id: str) -> dict:
    """Get the podcast transcript/script"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    if not session.get("script"):
        raise HTTPException(status_code=404, detail="Script not yet generated")
    
    return {
        "session_id": session_id,
        "script": session["script"]
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "llm_available": await llm_service.check_health(),
        "tts_available": await tts_service.check_health()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
