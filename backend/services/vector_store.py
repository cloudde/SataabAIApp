import os
import uuid
from typing import Optional
from openai import AsyncOpenAI
from pinecone import Pinecone, ServerlessSpec

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "rag-documents")
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536


class VectorStore:
    def __init__(self):
        self.openai = AsyncOpenAI(api_key=OPENAI_API_KEY)
        self._pc = None
        self._index = None
        # In-memory document registry (replace with DB in production)
        self._documents: dict[str, dict] = {}

    def _get_index(self):
        if self._index is None:
            pc = Pinecone(api_key=PINECONE_API_KEY)
            existing = [i.name for i in pc.list_indexes()]
            if PINECONE_INDEX not in existing:
                pc.create_index(
                    name=PINECONE_INDEX,
                    dimension=EMBEDDING_DIM,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region=PINECONE_REGION),
                )
            self._index = pc.Index(PINECONE_INDEX)
        return self._index

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        response = await self.openai.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
        return [item.embedding for item in response.data]

    async def upsert_chunks(self, chunks: list[dict], doc_metadata: dict) -> str:
        """Embed and upsert chunks; return a document_id."""
        doc_id = uuid.uuid4().hex
        texts = [c["text"] for c in chunks]
        embeddings = await self._embed(texts)

        vectors = []
        for chunk, emb in zip(chunks, embeddings):
            vectors.append({
                "id": chunk["id"],
                "values": emb,
                "metadata": {
                    **chunk["metadata"],
                    "document_id": doc_id,
                    "text": chunk["text"],
                },
            })

        index = self._get_index()
        # Upsert in batches of 100
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            index.upsert(vectors=vectors[i:i + batch_size])

        self._documents[doc_id] = {
            "document_id": doc_id,
            "filename": doc_metadata["filename"],
            "chunk_count": doc_metadata["chunk_count"],
            "char_count": doc_metadata["char_count"],
            "analytics": None,
        }
        return doc_id

    async def query(self, query_text: str, document_ids: Optional[list[str]] = None, top_k: int = 6) -> list[dict]:
        """Semantic search; optionally filter to specific document_ids."""
        embeddings = await self._embed([query_text])
        query_vec = embeddings[0]

        filter_dict = {}
        if document_ids:
            filter_dict = {"document_id": {"$in": document_ids}}

        index = self._get_index()
        results = index.query(
            vector=query_vec,
            top_k=top_k,
            include_metadata=True,
            filter=filter_dict if filter_dict else None,
        )

        return [
            {
                "text": match.metadata.get("text", ""),
                "source": match.metadata.get("source", ""),
                "score": match.score,
                "document_id": match.metadata.get("document_id", ""),
                "chunk_index": match.metadata.get("chunk_index", 0),
            }
            for match in results.matches
        ]

    async def list_documents(self) -> list[dict]:
        return list(self._documents.values())

    async def delete_document(self, document_id: str):
        index = self._get_index()
        # Fetch IDs with this document_id and delete
        results = index.query(
            vector=[0.0] * EMBEDDING_DIM,
            top_k=10000,
            filter={"document_id": {"$eq": document_id}},
            include_metadata=False,
        )
        ids = [m.id for m in results.matches]
        if ids:
            index.delete(ids=ids)
        self._documents.pop(document_id, None)

    async def get_document_analytics(self, document_id: str) -> dict:
        doc = self._documents.get(document_id)
        if not doc:
            raise ValueError(f"Document {document_id} not found")
        return doc.get("analytics") or {}

    def store_analytics(self, document_id: str, analytics: dict):
        if document_id in self._documents:
            self._documents[document_id]["analytics"] = analytics
