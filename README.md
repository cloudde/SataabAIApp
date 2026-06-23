# SataabAIApp — RAG Intelligence Platform



![Python](https://img.shields.io/badge/Python-3.12-blue)




![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)


![React](https://img.shields.io/badge/React-18-61DAFB)


![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991)


![Pinecone](https://img.shields.io/badge/Pinecone-Vector%20DB-success)


![License](https://img.shields.io/badge/License-MIT-yellow)



A production-ready full-stack RAG (Retrieval-Augmented Generation) 
platform. Upload documents, chat with AI grounded in your content, 
and view real-time sentiment and readability analytics.

## Live Demo
> 🔗 [SataabAIApp Live](https://sataabaiapp.vercel.app)

## Screenshots
> Add screenshots of the app here after running it locally

## Features

- Upload PDF, DOCX, TXT, Markdown documents
- AI chat grounded in uploaded document context
- Streaming responses via Server-Sent Events
- Source attribution with relevance scores
- Real-time sentiment analysis per document
- Readability scoring (Flesch, Kincaid, Gunning Fog)
- Vocabulary analytics and keyword frequency charts
- Sentence-level sentiment timeline
- Multi-document context selection
- Conversation memory across chat turns

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Recharts |
| Backend | Python, FastAPI, Uvicorn |
| AI / LLM | OpenAI GPT-4o-mini, text-embedding-3-small |
| Vector DB | Pinecone Serverless |
| Document Parsing | pypdf, python-docx |
| Styling | Custom CSS design system |

## Architecture

──► Pinecone
│
├──► GPT-4o-mini (streaming SSE)
└──► Analytics Engine


SataabAIApp/
├── backend/
│ ├── main.py # FastAPI routes
│ ├── services/
│ │ ├── document_processor.py # Text extraction + chunking
│ │ ├── vector_store.py # Pinecone CRUD + embeddings
│ │ ├── rag_chain.py # RAG pipeline + streaming
│ │ └── analytics.py # Sentiment + readability
│ ├── requirements.txt
│ ├── Dockerfile
│ └── .env.example # Template for API keys
│
├── frontend/
│ ├── src/
│ │ ├── App.tsx # Root layout + state
│ │ ├── components/
│ │ │ ├── DocumentPanel.tsx # Upload + document management
│ │ │ ├── ChatPanel.tsx # Streaming chat UI
│ │ │ └── AnalyticsDashboard.tsx # Charts + metrics
│ │ └── utils/
│ │ └── api.ts # API client + SSE reader
│ ├── index.html
│ ├── package.json
│ └── vite.config.ts
│
├── docker-compose.yml
└── README.md


## Quick Start
### Prerequisites
- Python 3.12+
- Node.js 20+
- OpenAI API key
- Pinecone API key (free tier works)

### 1. Clone the repo
```bash
git clone https://github.com/cloudde/SataabAIApp.git
cd SataabAIApp

2. Configure backend
Bash
cd backend
cp .env.example .env

Edit .env and add your keys:
Code:
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=rag-documents
PINECONE_REGION=us-east-1

3. Run backend
Bash
python -m venv .venv
.venv\Scripts\activate.bat # Windows
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000

4. Run frontend
Bash
cd frontend
npm install
npm run dev

Open http://localhost:5173

Docker
Bash
cp backend/.env.example .env
# fill in your keys
docker-compose up --build


API Endpoints
Method
Endpoint
Description
POST
/documents/upload
Upload and index a document
GET
/documents
List all documents
DELETE
/documents/{id}
Delete a document
POST
/chat/stream
Stream RAG chat response
POST
/analytics
Analyze text sentiment + readability
GET
/health
Health check
How It Works
Upload — Document is parsed and split into overlapping chunks
Embed — OpenAI converts each chunk into a 1536-dimension vector
Store — Vectors are stored in Pinecone with metadata
Query — Your question is embedded and matched against stored vectors
Generate — Top matching chunks are sent to GPT-4o as context
Stream — Response streams back token by token via SSE


Environment Variables
Variable

Description
OPENAI_API_KEY
OpenAI API key
PINECONE_API_KEY
Pinecone API key
PINECONE_INDEX
Index name (default: rag-documents)
PINECONE_REGION
AWS region (default: us-east-1)


Author
Bashir Usman
AI Cloud Technology Specialist
4+ years experience in AI/Cloud transformation
AWS · Azure · MLOps · LLMOps · RAG

License
MIT



