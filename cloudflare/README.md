# MangaHere API - Cloudflare Worker Version

This folder contains the Cloudflare Worker version of the MangaHere API scraper with optional CBZ generation capabilities.

## Features

- **Complete Manga Scraping**: Search, get info, and fetch page URLs
- **Optional CBZ Generation**: Generate downloadable comic book archives (requires configuration)
- **Catbox Integration**: File hosting without complex R2 setup
- **Zero Configuration Deployment**: Works out of the box for basic functionality

## Quick Start

### 1. Install Dependencies

```bash
cd cloudflare
npm install
```

### 2. Deploy (Basic - No CBZ Generation)

```bash
npx wrangler deploy
```

This deploys the worker with `/search`, `/info`, and `/pages` endpoints working immediately.

### 3. Enable CBZ Generation (Optional)

To enable CBZ file generation via the `/cbz` endpoint:

1. Get a Catbox user hash from [catbox.moe](https://catbox.moe):
   - Create an account
   - Go to account settings
   - Copy your user hash

2. Set the environment variable:
   ```bash
   npx wrangler secret put CATBOX_USER_HASH
   # Enter your catbox user hash when prompted
   ```

3. Redeploy:
   ```bash
   npx wrangler deploy
   ```

## API Endpoints

### Always Available (No Configuration Required)

- `GET /` - API documentation
- `GET /search/{query}` - Search manga
- `GET /info/{mangaId}` - Get manga details
- `GET /pages/{mangaId}/{chapterId}` - Get page URLs
- `GET /health` - Health check

### Requires Storage Configuration

- `GET /cbz/{mangaId}/{chapterId}` - Generate and download CBZ files
- `GET /rename` - Custom filename downloads from Catbox

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CATBOX_USER_HASH` | Optional | Enables CBZ generation and file hosting |

## Configuration Files

- `package.json` - Dependencies and scripts
- `wrangler.toml` - Cloudflare Worker configuration
- `worker.js` - Main application entry point
- `mangahere-scraper.js` - Core scraping logic
- `cbz-generator.js` - CBZ file creation utilities

## Usage Examples

### Search for manga:
```
GET https://your-worker.your-subdomain.workers.dev/search/one%20piece
```

### Get manga info:
```
GET https://your-worker.your-subdomain.workers.dev/info/one_piece_oda_eiichiro
```

### Get page URLs:
```
GET https://your-worker.your-subdomain.workers.dev/pages/one_piece_oda_eiichiro/c001
```

### Generate CBZ (requires CATBOX_USER_HASH):
```
GET https://your-worker.your-subdomain.workers.dev/cbz/one_piece_oda_eiichiro/c001
```

## Development

### Local Development
```bash
npm run dev
```

### Deploy to Production
```bash
npm run deploy
```

## Compatibility

This Cloudflare Worker version maintains full compatibility with the Express.js version while being optimized for serverless deployment. The scraping functionality works identically, with CBZ generation being optional based on storage configuration.