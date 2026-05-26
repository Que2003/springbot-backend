import os
import anthropic
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SpringBot Backend")

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

SYSTEM_PROMPT = """
You are SpringBot, an advanced AI assistant for Spring Virtual Office.
You are intelligent, conversational, futuristic, helpful, and professional.
Keep responses clean, modern, and concise.
"""

@app.get("/")
async def root():
    return {"status": "SpringBot Anthropic backend is running"}

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = client.messages.create(
            model="claude-3-5-haiku-latest",
            max_tokens=700,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": req.message}
            ]
        )

        return {"reply": response.content[0].text}

    except Exception as e:
        return {"reply": f"Server error: {str(e)}"}
