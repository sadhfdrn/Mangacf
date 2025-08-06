# Project Documentation

## Overview

This is a MangaHere API server built with Express.js that provides endpoints for searching manga, getting detailed information, and downloading chapters as CBZ files. The server integrates with the consumet.ts library to scrape manga data from MangaHere website.

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
- **GET /pages/{mangaId}/{chapterId}** - Download chapter pages as CBZ file
- **GET /health** - Server health check endpoint

### Design Decisions
- **MangaHere Integration**: Uses custom scraper class based on consumet.ts MangaHere provider
- **CBZ File Generation**: Converts chapter images to downloadable CBZ comic book archives
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

## Recent Changes (Latest Session)

- Converted simple "hello world" console app to full-featured manga API server
- Implemented MangaHere scraper with search, info, and chapter page functionality
- Added CBZ file generation for downloading manga chapters
- Created comprehensive HTML documentation page with example links
- Set up Express.js server with proper error handling and middleware
- Configured server to run on port 5000 with external access