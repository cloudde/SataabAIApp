
from dotenv import load_dotenv
load_dotenv()


from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json

from services.document_processor import DocumentProcessor
from services.vector_store import VectorStore
from services.rag_chain import RAGChain
from services.analytics import AnalyticsService

app = FastAPI(title="RAG Application API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://sataabaiapp.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

doc_processor = DocumentProcessor()
vector_store = VectorStore()
rag_chain = RAGChain(vector_store)
analytics = AnalyticsService()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    document_ids: Optional[list[str]] = None


class AnalyticsRequest(BaseModel):
    text: str


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a document into the vector store."""
    allowed_types = ["application/pdf", "text/plain", "text/markdown",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    
    if file.content_type not in allowed_types and not file.filename.endswith(('.pdf', '.txt', '.md', '.docx')):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    
    content = await file.read()
    
    try:
        result = await doc_processor.process(content, file.filename, file.content_type)
        doc_id = await vector_store.upsert_chunks(result["chunks"], result["metadata"])
        
        analytics_result = await analytics.analyze_text(result["full_text"][:5000])
        
        return {
            "document_id": doc_id,
            "filename": file.filename,
            "chunk_count": len(result["chunks"]),
            "character_count": len(result["full_text"]),
            "analytics": analytics_result,
            "status": "processed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents")
async def list_documents():
    """List all uploaded documents."""
    try:
        docs = await vector_store.list_documents()
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document from the vector store."""
    try:
        await vector_store.delete_document(document_id)
        return {"status": "deleted", "document_id": document_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream a RAG-grounded chat response."""
    async def generate():
        try:
            async for chunk in rag_chain.stream(
                message=request.message,
                document_ids=request.document_ids,
                conversation_id=request.conversation_id
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'type': 'error'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/analytics")
async def analyze_text(request: AnalyticsRequest):
    """Analyze sentiment and readability of text."""
    try:
        result = await analytics.analyze_text(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/document/{document_id}")
async def get_document_analytics(document_id: str):
    """Get cached analytics for a document."""
    try:
        result = await vector_store.get_document_analytics(document_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
