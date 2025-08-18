# JavaScript Project

A minimal JavaScript program that outputs "hello world" to the console, with additional manga API functionality.

## Quick Start

### Simple Hello World
```bash
node hello.js
```
This outputs "hello world" to the console.

### Advanced Manga API
```bash
node index.js
```
This starts a full-featured MangaHere API server with web scraping capabilities.

## Project Structure

```
.
├── hello.js              # Simple hello world program (main)
├── index.js               # Express.js manga API server
├── cloudflare/            # Cloudflare Worker version
│   ├── worker.js          # Worker entry point
│   ├── package.json       # Worker dependencies
│   ├── wrangler.toml      # Worker configuration
│   ├── deploy.sh          # Deployment script
│   └── README.md          # Worker setup guide
├── downloads/             # CBZ file storage
├── cache/                 # Catbox URL cache
└── replit.md              # Project documentation
```

## Features

### Simple Version (hello.js)
- Outputs "hello world" to console
- No dependencies required
- Minimal implementation

### Advanced Version (index.js)
- Full manga scraping API
- Optional CBZ generation
- Catbox file hosting integration
- Web interface with documentation

### Cloudflare Worker Version (cloudflare/)
- Serverless deployment
- Global edge distribution
- Optional CBZ generation
- Zero configuration deployment

## Configuration

### Basic Usage
No configuration needed for the simple hello world program.

### Advanced Features
Set `CATBOX_USER_HASH` environment variable to enable CBZ generation:
- Get your hash from [catbox.moe](https://catbox.moe) account settings
- Without it: Only search, info, and pages endpoints work
- With it: Full CBZ generation and download capabilities

## API Endpoints (Advanced Version)

- `GET /` - API documentation
- `GET /search/{query}` - Search manga
- `GET /info/{mangaId}` - Get manga details
- `GET /pages/{mangaId}/{chapterId}` - Get page URLs
- `GET /cbz/{mangaId}/{chapterId}` - Generate CBZ files (requires configuration)

## Deployment

### Local Development
```bash
# Simple version
node hello.js

# API server
node index.js
```

### Cloudflare Workers
```bash
cd cloudflare
./deploy.sh
```

Follow the interactive deployment script for easy setup.

## License

MIT