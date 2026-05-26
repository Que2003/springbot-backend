import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI(title="SpringBot Backend")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    return {"status": "SpringBot backend is running"}

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": req.message}
            ]
        )

        return {"reply": completion.choices[0].message.content}

    except Exception as e:
        return {"reply": f"Server error: {str(e)}"}
