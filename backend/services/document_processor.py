import io
import re
import uuid
from typing import Optional


class DocumentProcessor:
    """Handles text extraction and chunking for uploaded documents."""

    CHUNK_SIZE = 800
    CHUNK_OVERLAP = 150

    async def process(self, content: bytes, filename: str, content_type: Optional[str]) -> dict:
        """Extract text, chunk it, and return metadata."""
        text = await self._extract_text(content, filename, content_type)
        text = self._clean_text(text)
        chunks = self._chunk_text(text, filename)

        return {
            "full_text": text,
            "chunks": chunks,
            "metadata": {
                "filename": filename,
                "content_type": content_type,
                "char_count": len(text),
                "chunk_count": len(chunks),
            },
        }

    async def _extract_text(self, content: bytes, filename: str, content_type: Optional[str]) -> str:
        fn = filename.lower()

        if fn.endswith(".pdf") or content_type == "application/pdf":
            return self._extract_pdf(content)
        elif fn.endswith(".docx") or "wordprocessingml" in (content_type or ""):
            return self._extract_docx(content)
        else:
            # Plain text / markdown
            return content.decode("utf-8", errors="replace")

    def _extract_pdf(self, content: bytes) -> str:
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            pages = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
            return "\n\n".join(pages)
        except ImportError:
            raise RuntimeError("pypdf not installed. Run: pip install pypdf")

    def _extract_docx(self, content: bytes) -> str:
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except ImportError:
            raise RuntimeError("python-docx not installed. Run: pip install python-docx")

    def _clean_text(self, text: str) -> str:
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)
        return text.strip()

    def _chunk_text(self, text: str, source: str) -> list[dict]:
        """Split text with overlap, attaching metadata to each chunk."""
        words = text.split()
        chunks = []
        chunk_size_words = self.CHUNK_SIZE // 5  # approx 5 chars/word
        overlap_words = self.CHUNK_OVERLAP // 5

        i = 0
        chunk_idx = 0
        while i < len(words):
            end = min(i + chunk_size_words, len(words))
            chunk_words = words[i:end]
            chunk_text = " ".join(chunk_words)

            chunks.append({
                "id": f"{uuid.uuid4().hex}",
                "text": chunk_text,
                "metadata": {
                    "source": source,
                    "chunk_index": chunk_idx,
                    "char_start": len(" ".join(words[:i])),
                },
            })

            i += chunk_size_words - overlap_words
            chunk_idx += 1
            if end == len(words):
                break

        return chunks
