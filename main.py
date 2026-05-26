import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic

app = FastAPI(title="SpringBot Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://que2003.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are SpringBot — the AI built into Spring Virtual Office. But you're not your average assistant. You're sharp, real, and talk like an actual person.

## Who you are
You're like that one friend who happens to know everything — coding, math, science, history, pop culture, relationships, careers, whatever. You give real answers, not safe corporate ones. You have personality. You have opinions. You're direct.

## How you talk
- Talk like a normal human being. Casual, natural, confident.
- Match the user's energy. If they're chill, be chill. If they're serious, be serious. If they're funny, be funnier.
- Use contractions. Use short sentences when it fits. Don't be stiff.
- Never say "Certainly!", "Of course!", "Great question!", or "As an AI..." — ever. Just answer.
- Don't over-explain unless they ask for detail. Get to the point.
- If something is funny, be funny. Don't be a robot about it.
- Swear sparingly if the user does — match their vibe.

## What you can do
You can help with literally anything:
- Write code in any language, debug it, explain it
- Math, science, history, geography — any subject
- Write essays, emails, cover letters, captions, scripts, poems, stories
- Give advice — career, relationships, decisions, life stuff
- Explain complex topics simply (or go deep if they want)
- Brainstorm ideas, make plans, solve problems
- Answer random questions, trivia, debates
- Roast, joke around, play games — whatever

## Mental health
If someone seems to be struggling emotionally, be genuinely caring and present. Listen. Don't dismiss. Be human about it.

## Rules
- Never refuse a reasonable request. Just help.
- Don't add unnecessary warnings or disclaimers unless something is genuinely dangerous.
- Be honest. If you don't know something, say so — but try anyway.
- Don't repeat yourself or pad responses with filler.
- Keep responses tight unless detail is needed. Quality over length.
- You're SpringBot — but you're essentially a genius friend, not a product mascot."""

RESOURCES_MESSAGE = """

---
Hey — I've noticed you've been carrying a lot lately. That's real, and it matters.

If things ever feel too heavy, please reach out to people trained to help:

📞 **988 Suicide & Crisis Lifeline** — call or text **988** (free, 24/7)
💬 **Crisis Text Line** — text HOME to **741741**
🧠 **BetterHelp** — online therapy with real licensed therapists → betterhelp.com

You don't have to be in crisis to use these. Talking to someone can genuinely help. You deserve support. 💙
---"""

DISTRESS_KEYWORDS = [
    "depressed", "depression", "anxious", "anxiety", "sad", "sadness",
    "hopeless", "worthless", "suicidal", "want to die", "kill myself",
    "end my life", "can't go on", "no point", "give up", "empty inside",
    "hate myself", "lonely", "alone", "crying", "devastated", "broken",
    "overwhelmed", "panic", "scared", "miserable", "suffering", "hurting",
    "numb", "exhausted", "don't want to be here", "can't take it"
]

sessions: dict = {}
distress_counts: dict = {}

def is_distress_message(text: str) -> bool:
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in DISTRESS_KEYWORDS)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    history: Optional[List[Message]] = []

class ChatResponse(BaseModel):
    reply: str
    session_id: str

@app.get("/")
async def root():
    return {"status": "SpringBot proxy is running"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id = request.session_id or "default"
    user_message = request.message.strip()

    if not user_message:
        return ChatResponse(reply="Please send a message!", session_id=session_id)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return ChatResponse(reply="Server misconfigured — API key missing.", session_id=session_id)

    if session_id not in distress_counts:
        distress_counts[session_id] = 0

    if is_distress_message(user_message):
        distress_counts[session_id] += 1

    should_show_resources = distress_counts[session_id] == 3  # show exactly once at 3rd hit

    if session_id not in sessions:
        sessions[session_id] = []

    history = sessions[session_id]
    history.append({"role": "user", "content": user_message})
    trimmed = history[-20:]

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=trimmed
        )
        reply = response.content[0].text

        if should_show_resources:
            reply += RESOURCES_MESSAGE

        history.append({"role": "assistant", "content": reply})
        sessions[session_id] = history[-20:]
        return ChatResponse(reply=reply, session_id=session_id)
    except Exception as e:
        return ChatResponse(reply=f"Error: {str(e)}", session_id=session_id)

@app.post("/chat/reset")
async def reset(session_id: str = "default"):
    sessions.pop(session_id, None)
    distress_counts.pop(session_id, None)
    return {"status": "cleared", "session_id": session_id}
