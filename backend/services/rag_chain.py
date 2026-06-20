import os
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI
from services.vector_store import VectorStore

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CHAT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """You are a helpful AI assistant grounded in the documents the user has uploaded.

When answering:
- Base your response primarily on the provided context excerpts.
- If the context doesn't contain enough information, say so clearly.
- Cite sources by mentioning the document filename when relevant.
- Be concise yet thorough.
- Use markdown formatting for clarity (headers, bullet points, code blocks).

Context from uploaded documents:
{context}
"""


class RAGChain:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.openai = AsyncOpenAI(api_key=OPENAI_API_KEY)
        # Simple in-memory conversation store
        self._conversations: dict[str, list[dict]] = {}

    async def stream(
        self,
        message: str,
        document_ids: Optional[list[str]] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[dict, None]:
        """Retrieve context, build prompt, stream response."""

        # 1. Retrieve relevant chunks
        chunks = await self.vector_store.query(message, document_ids=document_ids, top_k=6)

        # 2. Build context string
        if chunks:
            context_parts = []
            for i, chunk in enumerate(chunks, 1):
                context_parts.append(
                    f"[{i}] Source: {chunk['source']} (relevance: {chunk['score']:.2f})\n{chunk['text']}"
                )
            context = "\n\n---\n\n".join(context_parts)
        else:
            context = "No relevant documents found. Please upload documents first or rephrase your query."

        # 3. Get/init conversation history
        if conversation_id and conversation_id in self._conversations:
            history = self._conversations[conversation_id]
        else:
            conversation_id = conversation_id or f"conv_{id(message)}"
            history = []

        # 4. Build messages
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT.format(context=context)}
        ] + history + [
            {"role": "user", "content": message}
        ]

        # 5. Yield sources first
        yield {
            "type": "sources",
            "sources": [
                {
                    "source": c["source"],
                    "score": round(c["score"], 3),
                    "document_id": c["document_id"],
                    "preview": c["text"][:200] + "..." if len(c["text"]) > 200 else c["text"],
                }
                for c in chunks
            ],
        }

        # 6. Stream the completion
        full_response = ""
        stream = await self.openai.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            stream=True,
            temperature=0.3,
            max_tokens=1500,
        )

        async for event in stream:
            delta = event.choices[0].delta
            if delta.content:
                full_response += delta.content
                yield {"type": "token", "content": delta.content}

        # 7. Update history
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": full_response})
        # Keep last 10 exchanges
        self._conversations[conversation_id] = history[-20:]

        yield {"type": "done", "conversation_id": conversation_id}
