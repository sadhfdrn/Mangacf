# Project Documentation

## Overview

This project contains a minimal JavaScript program that outputs "hello world" to the console (hello.js) as the main entry point, along with an advanced MangaHere API server (index.js) built with Express.js. The API provides endpoints for searching manga, getting detailed information, viewing page URLs, and downloading chapters as CBZ files. A Cloudflare Worker version is also included for serverless deployment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Structure
- **Main Program**: `hello.js` - Simple hello world console output
- **Express.js Version**: `index.js` - Express.js server with MangaHere scraper
- **Cloudflare Worker Version**: `cloudflare/` folder containing worker implementation
- **Runtime Environment**: Node.js 20 with Express.js framework (main), Cloudflare Workers runtime (worker)
- **Architecture Pattern**: Simple console program (main), REST API server with web scraping capabilities (advanced)
- **Port**: Server runs on port 5000 (0.0.0.0 for external access) when using index.js

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

### **Worker Architecture (in /cloudflare folder)**
- **Main File**: `cloudflare/worker.js` - Cloudflare Worker entry point with ES6 modules
- **Scraper Module**: `cloudflare/mangahere-scraper.js` - Worker-compatible scraper using native fetch API
- **CBZ Generator**: `cloudflare/cbz-generator.js` - Pure JavaScript ZIP creation without Node.js dependencies
- **Storage Strategy**: Catbox.moe integration for permanent file hosting (simplified deployment)
- **Separate Configuration**: Independent package.json and wrangler.toml in cloudflare folder

### **Catbox Integration (Current)**
- **File Hosting**: Direct upload to Catbox.moe with user hash `630d80d5715d80cc0cfaa03ec`
- **Custom Downloads**: `/rename` endpoint for proper .cbz filename downloads
- **Zero Configuration**: No R2 buckets or KV namespaces required
- **Separated Endpoints**: `/pages` for viewing, `/cbz` for file generation
- **One-Command Deploy**: Simply `npx wrangler deploy` with no setup

### **Deployment Files**
- `cloudflare/wrangler.toml` - Simplified configuration (no R2/KV bindings needed)
- `cloudflare/package.json` - Package configuration for Worker deployment
- `cloudflare/README.md` - Complete setup and deployment guide
- `SIMPLE_DEPLOY.md` - Ultra-simple deployment guide (one command)
- `CLOUDFLARE_DEPLOYMENT.md` - Legacy R2/KV deployment guide (for reference)

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
- **Restructured for Cloudflare Workers (Current Session)**: Created dedicated `cloudflare/` folder
  - Moved all Cloudflare Worker files to separate directory for better organization
  - Created independent package.json and configuration files in cloudflare folder
  - Added comprehensive README.md with setup instructions for Cloudflare deployment
- **Added Optional CBZ Generation (Current Session)**: Both Express.js and Worker versions support optional CBZ
  - CBZ generation now requires CATBOX_USER_HASH environment variable
  - Without configuration: Only /search, /info, and /pages endpoints work
  - With configuration: All endpoints including /cbz generation are available
  - Updated documentation to reflect optional functionality in both versions
  - Added clear error messages when CBZ generation is requested without proper configuration
- **Project Structure Clarification (Current Session)**: Restored simple hello world as main entry point
  - Created hello.js as the primary program outputting "hello world" to console
  - Maintained manga API functionality as advanced feature (index.js)
  - Updated README.md to clearly explain project structure and usage options
  - Modified workflow to run simple hello.js by default while preserving API server functionality
- **Optimized Scraper Performance (Latest Session)**: Fixed page extraction issues and improved response times
  - Refined JavaScript eval pattern matching to handle multiple packed script formats
  - Enhanced URL extraction with better regex patterns for different array formats
  - Updated both Express.js and Cloudflare Worker versions with optimized parsing logic
  - Confirmed full functionality with test showing 67 pages extracted correctly
  - Response time optimized to ~3.7 seconds for complete chapter page extraction
- **Cloudflare Workers Compatibility Fix (Current Session)**: Resolved eval() restriction blocking Worker execution
  - **Root Cause Identified**: Cloudflare Workers blocks eval() function for security reasons
  - **Custom JavaScript Unpacker**: Implemented eval-free unpacking of packed JavaScript code
  - **Multiple Parsing Strategies**: Pattern matching + custom unpacker + fallback methods
  - **Production Ready**: Full compatibility with Workers runtime security restrictions
  - **Status**: Express.js version working (67 pages), Worker needs redeployment with eval-free code