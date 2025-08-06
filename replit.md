# Project Documentation

## Overview

This is a MangaHere API server built with Express.js that provides endpoints for searching manga, getting detailed information, viewing page URLs, and downloading chapters as CBZ files. The API has been restructured to separate page viewing from CBZ generation functionality for better modularity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Structure
- **Entry Point**: `index.js` - Express.js server with MangaHere scraper
- **Runtime Environment**: Node.js 20 with Express.js framework
- **Architecture Pattern**: REST API server with web scraping capabilities
- **Port**: Server runs on port 5000 (0.0.0.0 for external access)

### API Endpoints
- **GET /** - HTML documentation page with examples
- **GET /search/{query}** - Search manga by title with pagination support
- **GET /info/{mangaId}** - Get detailed manga information and chapter list
- **GET /pages/{mangaId}/{chapterId}** - Get all page URLs for a chapter (NEW: separated from CBZ generation)
- **GET /cbz/{mangaId}/{chapterId}** - Generate CBZ file and return download link (NEW: dedicated CBZ endpoint)
- **GET /download/{fileName}** - Direct download endpoint for CBZ files
- **GET /health** - Server health check endpoint

### Design Decisions
- **Separated Concerns**: Pages endpoint now only returns URLs, CBZ generation moved to dedicated endpoint
- **MangaHere Integration**: Uses custom scraper class based on consumet.ts MangaHere provider
- **CBZ File Generation**: Converts chapter images to downloadable CBZ comic book archives
- **File Management**: Stores CBZ files locally with 48-hour expiration and automatic cleanup
- **Download Links**: Returns JSON with download URLs instead of direct file streaming
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Web Scraping**: Uses Cheerio for HTML parsing and Axios for HTTP requests
- **Stream Processing**: Efficient image downloading and archive creation using Node.js streams

## External Dependencies

### NPM Packages
- **express**: Web server framework
- **axios**: HTTP client for API requests and image downloads
- **cheerio**: Server-side jQuery implementation for HTML parsing
- **archiver**: ZIP archive creation for CBZ files
- **path, fs, multer**: File system and path utilities

### Third-Party Services
- **MangaHere Website**: Primary data source for manga content
- **consumet.ts Library**: Manga scraping logic and parsing patterns

## Cloudflare Worker Compatibility

### **Worker Architecture**
- **Main File**: `worker.js` - Cloudflare Worker entry point with ES6 modules
- **Scraper Module**: `mangahere-scraper.js` - Worker-compatible scraper using native fetch API
- **CBZ Generator**: `cbz-generator.js` - Pure JavaScript ZIP creation without Node.js dependencies
- **Storage Strategy**: R2 Object Storage for CBZ files + Workers KV for metadata caching

### **Storage Solutions**
- **R2 Object Storage**: Stores CBZ files (up to 5TB per file, zero egress fees)
- **Workers KV**: Caches file metadata globally (sub-100ms read latency)
- **48-Hour Retention**: Automatic cleanup prevents storage cost accumulation
- **Global Distribution**: Files served from 275+ edge locations worldwide

### **Deployment Files**
- `wrangler.toml` - Cloudflare Worker configuration with R2 and KV bindings
- `worker-package.json` - Package configuration for Worker deployment
- `CLOUDFLARE_DEPLOYMENT.md` - Complete deployment guide with setup instructions

## Recent Changes (Latest Session)

- Converted simple "hello world" console app to full-featured manga API server
- Implemented MangaHere scraper with search, info, and chapter page functionality
- Added CBZ file generation for downloading manga chapters
- Created comprehensive HTML documentation page with example links
- Set up Express.js server with proper error handling and middleware
- Configured server to run on port 5000 with external access
- **Updated pages endpoint**: Now returns download links instead of direct file streaming
- **Added file management**: CBZ files stored locally with 48-hour expiration
- **Implemented cleanup system**: Automatic deletion of files older than 48 hours
- **Added download endpoint**: Direct CBZ file download via /download/{fileName}
- **Enhanced documentation**: Updated HTML documentation to reflect new download link system
- **Created Cloudflare Worker version**: Complete worker-compatible implementation with R2/KV storage
- **Restructured API endpoints (Current Session)**: Separated pages viewing from CBZ generation
  - `/pages/{mangaId}/{chapterId}` now only returns page URLs without CBZ generation
  - New `/cbz/{mangaId}/{chapterId}` endpoint handles CBZ file creation and download links
  - Updated documentation to reflect new endpoint structure and usage examples
- **Integrated Catbox file hosting (Current Session)**: Automatic upload and custom filename downloads
  - CBZ files automatically uploaded to Catbox for permanent storage
  - Added `/rename` endpoint for custom filename downloads from Catbox URLs
  - Implemented fallback to local storage when Catbox upload fails
  - Fixed CBZ download extension issue by using proper content headers
  - **Added URL caching system**: Catbox URLs cached locally for instant responses
    - First request processes and uploads file to Catbox
    - Subsequent requests for same chapter return instantly from cache
    - Cache stored in `/cache` directory as JSON files
    - Eliminates delay on repeat requests
- **Added deployment guides**: Comprehensive instructions for Cloudflare Workers deployment
- **Implemented native ZIP creation**: Pure JavaScript CBZ generation without Node.js dependencies