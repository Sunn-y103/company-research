# AI-Powered Company Research Assistant

A full-stack web application that takes a company name or URL and automatically produces a comprehensive research report. The app searches the web, crawls the company's official website, and leverages AI to synthesize executive summaries, products and services, pain points, and a detailed competitor analysis. Users can also export the final report as a downloadable PDF.

### Live Demo URL
https://company-research-5iwy.onrender.com

## Features
- **Company Research Automation:** Automatically aggregates public data on any given company.
- **Web Search Integration:** Uses Serper.dev to find the official company website and latest search snippets.
- **Intelligent Website Crawling:** Automatically fetches and extracts clean text from key company pages (e.g., Home, About, Products, Services, Contact) while avoiding irrelevant boilerplate.
- **OpenRouter AI Integration:** Synthesizes the extracted data into a structured JSON report using advanced LLMs, complete with a UI model selector.
- **Competitor Analysis:** Identifies key competitors and specifically explains their product/service overlap.
- **PDF Generation:** Dynamically generates a beautifully formatted, multi-page PDF report server-side.
- **Clean UI Layout:** A responsive, polished interface featuring interactive data cards and source attribution.

## Tech Stack
### Frontend (Client)
- **React 19**
- **Vite**
- **Axios** (Configured for relative `/api` paths)
- **Custom CSS** (Premium dark-mode grid layout)

### Backend (Server)
- **Node.js & Express**
- **Cheerio** (HTML parsing and noise removal for the crawler)
- **PDFKit** (Server-side PDF document generation)
- **Axios** (For external API requests to Serper and OpenRouter)
- **Helmet & Compression** (Production security and performance)

## Project Structure
```text
/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── api/            # Centralised Axios client
│   │   ├── App.jsx         # Main React application
│   │   └── App.css         # Styling and layout
│   └── package.json        
├── server/                 # Express backend application
│   ├── src/
│   │   ├── controllers/    # Route handlers (e.g., researchController.js)
│   │   ├── routes/         # Express routers
│   │   ├── services/       # Core logic (crawlerService, openrouterService, pdfService)
│   │   └── index.js        # Express application entry point
│   ├── .env.example        # Environment variables template
│   └── package.json        
├── package.json            # Root package for monolithic deployment commands
└── .gitignore
```

## Setup Instructions

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd company-research-assistant
```

### 2. Install dependencies
You can install everything at once using the root orchestrator:
```bash
npm run install:all
```
*Alternatively, install them separately:*
```bash
cd client && npm install
cd ../server && npm install
```

### 3. Environment Configuration
Navigate to the `server` directory, copy the example environment file, and fill in your API keys:
```bash
cd server
cp .env.example .env
```

### 4. Run Locally (Development Mode)
Open two separate terminal windows.

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```
The application will be available at `http://localhost:5173`. All frontend API calls are automatically proxied to the backend at `http://localhost:5000`.

## Environment Variables
The application requires the following environment variables to be set in `server/.env`:

- `OPENROUTER_API_KEY` *(Required)*: Your API key for OpenRouter to perform the AI synthesis.
- `SERPER_API_KEY` *(Required)*: Your API key for Serper.dev to perform the Google search.
- `PORT` *(Optional)*: The port the Express server runs on. Defaults to `5000`.
- `NODE_ENV` *(Optional)*: Defines the environment (`development` or `production`). 
- `MOCK_MODE` *(Optional)*: Set to `true` to return rich mock data instantly without consuming real API quota during UI development.

> **Security Note:** API keys are exclusively loaded on the Node.js backend. They are never exposed to the React frontend or the browser.

## Deployment
This project is configured to be deployed as a **single unified Render Web Service**. 
The Express backend acts as the single origin, dynamically serving the compiled React static files from `/client/dist` while securely routing all `/api` traffic.

- **Build Command:** `npm run install:all && npm run build`
- **Start Command:** `npm start`
- **Root Directory:** `.`

