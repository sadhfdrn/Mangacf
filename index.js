const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');
const streamPipeline = promisify(pipeline);

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// MangaHere scraper class
class MangaHere {
  constructor() {
    this.baseUrl = 'http://www.mangahere.cc';
    this.name = 'MangaHere';
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  }

  async search(query, page = 1) {
    const searchRes = {
      currentPage: page,
      results: [],
      hasNextPage: false
    };

    try {
      const { data } = await this.client.get(`${this.baseUrl}/search?title=${encodeURIComponent(query)}&page=${page}`);
      const $ = cheerio.load(data);

      searchRes.hasNextPage = $('div.pager-list-left > a.active').next().text() !== '>';

      searchRes.results = $('div.container > div > div > ul > li')
        .map((i, el) => ({
          id: $(el).find('a').attr('href')?.split('/')[2],
          title: $(el).find('p.manga-list-4-item-title > a').text(),
          image: $(el).find('a > img').attr('src'),
          description: $(el).find('p').last().text(),
          status: $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Ongoing' ? 'ONGOING' : 
                  $(el).find('p.manga-list-4-show-tag-list-2 > a').text() === 'Completed' ? 'COMPLETED' : 'UNKNOWN'
        }))
        .get()
        .filter(manga => manga.id && manga.title);

      return searchRes;
    } catch (err) {
      throw new Error(`Search failed: ${err.message}`);
    }
  }

  async fetchMangaInfo(mangaId) {
    const mangaInfo = {
      id: mangaId,
      title: '',
      description: '',
      image: '',
      genres: [],
      status: 'UNKNOWN',
      rating: 0,
      authors: [],
      chapters: []
    };

    try {
      const { data } = await this.client.get(`${this.baseUrl}/manga/${mangaId}`, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = cheerio.load(data);

      mangaInfo.title = $('span.detail-info-right-title-font').text();
      mangaInfo.description = $('div.detail-info-right > p.fullcontent').text();
      mangaInfo.image = $('div.detail-info-cover > img').attr('src');
      mangaInfo.genres = $('p.detail-info-right-tag-list > a')
        .map((i, el) => $(el).attr('title')?.trim())
        .get();
      
      const statusText = $('span.detail-info-right-title-tip').text();
      mangaInfo.status = statusText === 'Ongoing' ? 'ONGOING' : 
                        statusText === 'Completed' ? 'COMPLETED' : 'UNKNOWN';
      
      mangaInfo.rating = parseFloat($('span.detail-info-right-title-star > span').last().text()) || 0;
      mangaInfo.authors = $('p.detail-info-right-say > a')
        .map((i, el) => $(el).attr('title'))
        .get();
      
      mangaInfo.chapters = $('ul.detail-main-list > li')
        .map((i, el) => ({
          id: $(el).find('a').attr('href')?.split('/manga/')[1]?.slice(0, -7),
          title: $(el).find('a > div > p.title3').text(),
          releasedDate: $(el).find('a > div > p.title2').text().trim(),
        }))
        .get()
        .filter(chapter => chapter.id);

      return mangaInfo;
    } catch (err) {
      throw new Error(`Failed to fetch manga info: ${err.message}`);
    }
  }

  async fetchChapterPages(chapterId) {
    const chapterPages = [];
    const url = `${this.baseUrl}/manga/${chapterId}/1.html`;

    try {
      const { data } = await this.client.get(url, {
        headers: {
          cookie: 'isAdult=1',
        },
      });

      const $ = cheerio.load(data);

      // Check for copyright blocks
      const copyrightHandle = $('p.detail-block-content').text().match('Dear user') ||
                             $('p.detail-block-content').text().match('blocked');
      if (copyrightHandle) {
        throw new Error('Chapter blocked due to copyright');
      }

      const bar = $('script[src*=chapter_bar]').data();
      const html = $.html();
      
      if (typeof bar !== 'undefined') {
        // Method 1: Direct evaluation
        const ss = html.indexOf('eval(function(p,a,c,k,e,d)');
        const se = html.indexOf('</script>', ss);
        const s = html.substring(ss, se).replace('eval', '');
        
        try {
          const ds = eval(s);
          const urls = ds.split("['")[1].split("']")[0].split("','");

          urls.forEach((url, i) => {
            chapterPages.push({
              page: i,
              img: `https:${url}`,
              headerForImage: { Referer: url }
            });
          });
        } catch (evalErr) {
          console.error('Eval method failed:', evalErr);
        }
      } else {
        // Method 2: Extract key and use API
        try {
          let sKey = this.extractKey(html);
          const chapterIdsl = html.indexOf('chapterid');
          const chapterId = html.substring(chapterIdsl + 11, html.indexOf(';', chapterIdsl)).trim();

          const chapterPagesElmnt = $('body > div:nth-child(6) > div > span').children('a');
          const pages = parseInt(chapterPagesElmnt.last().prev().attr('data-page') || '0');
          const pageBase = url.substring(0, url.lastIndexOf('/'));

          for (let i = 1; i <= pages; i++) {
            const pageLink = `${pageBase}/chapterfun.ashx?cid=${chapterId}&page=${i}&key=${sKey}`;

            for (let j = 1; j <= 3; j++) {
              try {
                const { data } = await this.client.get(pageLink, {
                  headers: {
                    Referer: url,
                    'X-Requested-With': 'XMLHttpRequest',
                    cookie: 'isAdult=1',
                  },
                });

                if (data) {
                  const ds = eval(data.replace('eval', ''));
                  const baseLinksp = ds.indexOf('pix=') + 5;
                  const baseLinkes = ds.indexOf(';', baseLinksp) - 1;
                  const baseLink = ds.substring(baseLinksp, baseLinkes);

                  const imageLinksp = ds.indexOf('pvalue=') + 9;
                  const imageLinkes = ds.indexOf('"', imageLinksp);
                  const imageLink = ds.substring(imageLinksp, imageLinkes);

                  chapterPages.push({
                    page: i - 1,
                    img: `https:${baseLink}${imageLink}`,
                    headerForImage: { Referer: url }
                  });
                  break;
                }
              } catch (pageErr) {
                console.error(`Error fetching page ${i}:`, pageErr);
                if (j === 3) {
                  throw pageErr;
                }
              }
            }
          }
        } catch (keyErr) {
          console.error('Key extraction method failed:', keyErr);
        }
      }

      return chapterPages;
    } catch (err) {
      throw new Error(`Failed to fetch chapter pages: ${err.message}`);
    }
  }

  extractKey(html) {
    try {
      const skss = html.indexOf('eval(function(p,a,c,k,e,d)');
      const skse = html.indexOf('</script>', skss);
      const sks = html.substring(skss, skse).replace('eval', '');

      const skds = eval(sks);
      const sksl = skds.indexOf("'");
      const skel = skds.indexOf(';');
      const skrs = skds.substring(sksl, skel);

      return eval(skrs);
    } catch (err) {
      console.error('Key extraction failed:', err);
      return '';
    }
  }

  async downloadImage(url, headers = {}) {
    try {
      const response = await this.client.get(url, {
        responseType: 'stream',
        headers: {
          ...headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.data;
    } catch (err) {
      throw new Error(`Failed to download image: ${err.message}`);
    }
  }
}

const mangaHere = new MangaHere();

// File cleanup system - delete files older than 48 hours
const cleanupOldFiles = () => {
  try {
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
    
    if (fs.existsSync(DOWNLOADS_DIR)) {
      const files = fs.readdirSync(DOWNLOADS_DIR);
      
      files.forEach(file => {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > fortyEightHours) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old file: ${file}`);
        }
      });
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);
// Run cleanup on startup
setTimeout(cleanupOldFiles, 5000);

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MangaHere API</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 1200px; 
                margin: 0 auto; 
                padding: 20px; 
                line-height: 1.6; 
                background-color: #f5f5f5; 
            }
            .container { 
                background: white; 
                padding: 30px; 
                border-radius: 10px; 
                box-shadow: 0 0 10px rgba(0,0,0,0.1); 
            }
            h1 { 
                color: #2c3e50; 
                text-align: center; 
                border-bottom: 3px solid #3498db; 
                padding-bottom: 10px; 
            }
            h2 { 
                color: #34495e; 
                border-left: 4px solid #3498db; 
                padding-left: 15px; 
            }
            .endpoint { 
                background: #ecf0f1; 
                padding: 15px; 
                margin: 10px 0; 
                border-radius: 5px; 
                border-left: 4px solid #3498db; 
            }
            .method { 
                display: inline-block; 
                background: #2ecc71; 
                color: white; 
                padding: 3px 8px; 
                border-radius: 3px; 
                font-size: 12px; 
                font-weight: bold; 
            }
            .url { 
                font-family: monospace; 
                background: #34495e; 
                color: white; 
                padding: 8px; 
                border-radius: 4px; 
                margin: 5px 0; 
            }
            a { 
                color: #3498db; 
                text-decoration: none; 
            }
            a:hover { 
                text-decoration: underline; 
            }
            .example-links { 
                background: #e8f4f8; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 15px 0; 
            }
            .description { 
                color: #7f8c8d; 
                font-style: italic; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🍜 MangaHere API Documentation</h1>
            
            <p>Welcome to the MangaHere API! This service provides endpoints to search, get information, and download manga from MangaHere.</p>
            
            <h2>📚 Available Endpoints</h2>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <div class="url">/search/{query}</div>
                <p><strong>Description:</strong> Search for manga by title</p>
                <p class="description">Returns a list of manga matching your search query</p>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <div class="url">/info/{mangaId}</div>
                <p><strong>Description:</strong> Get detailed information about a specific manga</p>
                <p class="description">Returns manga details including chapters, genres, status, and more</p>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <div class="url">/pages/{mangaId}/{chapterId}</div>
                <p><strong>Description:</strong> Generate and get download link for chapter CBZ file</p>
                <p class="description">Returns a JSON response with download link for CBZ file containing all chapter pages</p>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <div class="url">/download/{fileName}</div>
                <p><strong>Description:</strong> Download CBZ file directly</p>
                <p class="description">Direct download endpoint for CBZ files (files expire after 48 hours)</p>
            </div>
            
            <h2>🚀 Example Usage</h2>
            
            <div class="example-links">
                <h3>Try these example links:</h3>
                
                <p><strong>Search for "jigokuraku":</strong><br>
                <a href="/search/jigokuraku" target="_blank">/search/jigokuraku</a></p>
                
                <p><strong>Get info for "jigokuraku_kaku_yuuji":</strong><br>
                <a href="/info/jigokuraku_kaku_yuuji" target="_blank">/info/jigokuraku_kaku_yuuji</a></p>
                
                <p><strong>Generate download link for "jigokuraku_kaku_yuuji/c001":</strong><br>
                <a href="/pages/jigokuraku_kaku_yuuji/c001" target="_blank">/pages/jigokuraku_kaku_yuuji/c001</a></p>
                
                <p><strong>Search for "one piece":</strong><br>
                <a href="/search/one%20piece" target="_blank">/search/one%20piece</a></p>
                
                <p><strong>Search for "naruto":</strong><br>
                <a href="/search/naruto" target="_blank">/search/naruto</a></p>
            </div>
            
            <h2>📖 Response Format</h2>
            
            <p><strong>Search Response:</strong> JSON with results array containing manga information</p>
            <p><strong>Info Response:</strong> JSON with detailed manga information and chapters list</p>
            <p><strong>Pages Response:</strong> JSON with download link and file information</p>
            <p><strong>Download Response:</strong> Direct CBZ file download</p>
            
            <h2>⚠️ Important Notes</h2>
            
            <ul>
                <li>CBZ files may take a few moments to generate depending on chapter length</li>
                <li>Generated files are stored on server and expire after 48 hours</li>
                <li>If a file already exists, you'll get the existing download link immediately</li>
                <li>Some chapters may be blocked due to copyright restrictions</li>
                <li>Chapter IDs follow the format: {mangaId}/c{chapterNumber}</li>
                <li>The /pages endpoint returns JSON with download link information</li>
                <li>Use the /download endpoint to actually download the CBZ files</li>
            </ul>
            
            <div style="text-align: center; margin-top: 30px; padding: 20px; background: #2c3e50; color: white; border-radius: 5px;">
                <p><strong>🔥 MangaHere API Server</strong></p>
                <p>Built with Express.js & Cheerio for web scraping</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Search endpoint
app.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const page = parseInt(req.query.page) || 1;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const results = await mangaHere.search(query.trim(), page);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search manga', message: error.message });
  }
});

// Info endpoint
app.get('/info/:mangaId', async (req, res) => {
  try {
    const { mangaId } = req.params;
    
    if (!mangaId || mangaId.trim() === '') {
      return res.status(400).json({ error: 'Manga ID is required' });
    }
    
    const info = await mangaHere.fetchMangaInfo(mangaId.trim());
    res.json(info);
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to fetch manga info', message: error.message });
  }
});

// Pages endpoint with CBZ file generation and download link
app.get('/pages/:mangaId/:chapterId', async (req, res) => {
  try {
    const { mangaId, chapterId } = req.params;
    const fullChapterId = `${mangaId}/${chapterId}`;
    
    if (!mangaId || !chapterId) {
      return res.status(400).json({ error: 'Manga ID and Chapter ID are required' });
    }
    
    const fileName = `${mangaId}_${chapterId}.cbz`;
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const downloadUrl = `${req.protocol}://${req.get('host')}/download/${fileName}`;
      
      return res.json({
        success: true,
        message: 'CBZ file already exists',
        downloadUrl: downloadUrl,
        fileName: fileName,
        fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        createdAt: stats.mtime.toISOString(),
        expiresAt: new Date(stats.mtime.getTime() + (48 * 60 * 60 * 1000)).toISOString()
      });
    }
    
    console.log(`Fetching pages for chapter: ${fullChapterId}`);
    const pages = await mangaHere.fetchChapterPages(fullChapterId);
    
    if (!pages || pages.length === 0) {
      return res.status(404).json({ error: 'No pages found for this chapter' });
    }
    
    // Create zip archive and save to file
    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      // Clean up partial file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create CBZ file', message: err.message });
      }
    });
    
    archive.pipe(output);
    
    // Download and add each page to the archive
    console.log(`Creating CBZ with ${pages.length} pages...`);
    
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      try {
        console.log(`Downloading page ${index + 1}/${pages.length}: ${page.img}`);
        const imageStream = await mangaHere.downloadImage(page.img, page.headerForImage);
        
        const paddedIndex = String(index + 1).padStart(3, '0');
        const extension = path.extname(page.img) || '.jpg';
        const filename = `page_${paddedIndex}${extension}`;
        
        archive.append(imageStream, { name: filename });
        
        // Wait a bit between downloads to avoid overwhelming the server
        if (index < pages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Failed to download page ${index + 1}:`, error);
        // Continue with other pages instead of failing completely
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    
    // Wait for the file to be written
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });
    
    console.log(`CBZ file created successfully for ${fullChapterId}`);
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const downloadUrl = `${req.protocol}://${req.get('host')}/download/${fileName}`;
    
    res.json({
      success: true,
      message: 'CBZ file created successfully',
      downloadUrl: downloadUrl,
      fileName: fileName,
      fileSize: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      totalPages: pages.length,
      createdAt: stats.mtime.toISOString(),
      expiresAt: new Date(stats.mtime.getTime() + (48 * 60 * 60 * 1000)).toISOString()
    });
    
  } catch (error) {
    console.error('Pages error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to fetch chapter pages', message: error.message });
    }
  }
});

// Download endpoint to serve CBZ files
app.get('/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    
    // Validate filename to prevent path traversal
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found or has expired' });
    }
    
    // Check if file is expired (older than 48 hours)
    const stats = fs.statSync(filePath);
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    
    if (now - stats.mtime.getTime() > fortyEightHours) {
      // Delete expired file
      fs.unlinkSync(filePath);
      return res.status(410).json({ error: 'File has expired and been removed' });
    }
    
    // Set headers for CBZ download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
    console.log(`Serving download: ${fileName}`);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to serve file', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍜 MangaHere API Server running on port ${PORT}`);
  console.log(`📚 Documentation available at http://localhost:${PORT}`);
});

module.exports = app;
