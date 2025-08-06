/**
 * Cloudflare Worker version of MangaHere API
 * 
 * Storage Strategy:
 * - Uses Catbox.moe for file hosting (permanent storage with user hash)
 * - No R2 or KV storage required - simplified deployment
 * - Files uploaded to Catbox with custom download URLs
 * 
 * Required Configuration:
 * - CATBOX_USER_HASH: Your Catbox user hash for file uploads
 */

import { MANGAHERE_SCRAPER } from './mangahere-scraper.js';
import { CBZ_GENERATOR } from './cbz-generator.js';

// Your Catbox user hash
const CATBOX_USER_HASH = '630d80d5715d80cc0cfaa03ec';

// Catbox service for file uploads
class CatboxService {
  constructor(userHash) {
    this.userHash = userHash;
    this.uploadUrl = 'https://catbox.moe/user/api.php';
  }

  async uploadFile(fileBuffer, fileName) {
    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('userhash', this.userHash);
      formData.append('fileToUpload', new Blob([fileBuffer]), fileName);

      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.text();
      if (result && result.startsWith('https://files.catbox.moe/')) {
        return result.trim();
      } else {
        throw new Error(`Upload failed: ${result}`);
      }
    } catch (error) {
      throw new Error(`Catbox upload failed: ${error.message}`);
    }
  }

  generateDownloadLink(catboxUrl, fileName, baseUrl) {
    const encodedUrl = encodeURIComponent(catboxUrl);
    const encodedFileName = encodeURIComponent(fileName);
    return `${baseUrl}/rename?url=${encodedUrl}&filename=${encodedFileName}`;
  }
}

const catboxService = new CatboxService(CATBOX_USER_HASH);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (pathname === '/') {
        return handleDocumentation(corsHeaders);
      } else if (pathname.startsWith('/search/')) {
        return handleSearch(pathname, corsHeaders);
      } else if (pathname.startsWith('/info/')) {
        return handleInfo(pathname, corsHeaders);
      } else if (pathname.startsWith('/pages/')) {
        return handlePages(pathname, corsHeaders);
      } else if (pathname.startsWith('/cbz/')) {
        return handleCBZ(pathname, corsHeaders, request);
      } else if (pathname.startsWith('/rename')) {
        return handleRename(url, corsHeaders);
      } else if (pathname === '/health') {
        return handleHealth(corsHeaders);
      } else {
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
  }
};

async function handleDocumentation(corsHeaders) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MangaHere API - Cloudflare Worker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin: 20px 0;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #4a5568; 
            text-align: center; 
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            text-align: center;
            color: #718096;
            margin-bottom: 30px;
            font-size: 1.2em;
        }
        .endpoint {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }
        .method {
            background: #48bb78;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.9em;
            margin-right: 10px;
        }
        .url {
            font-family: 'Courier New', monospace;
            background: #edf2f7;
            padding: 2px 6px;
            border-radius: 3px;
            color: #2d3748;
        }
        .description {
            margin: 10px 0;
            color: #4a5568;
        }
        .example {
            background: #1a202c;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            margin: 10px 0;
            overflow-x: auto;
        }
        .try-link {
            display: inline-block;
            background: #4299e1;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 5px;
            margin: 5px 5px 5px 0;
            transition: background 0.3s;
        }
        .try-link:hover {
            background: #3182ce;
        }
        .feature {
            background: #e6fffa;
            border-left: 4px solid #38b2ac;
            padding: 15px;
            margin: 10px 0;
        }
        .storage-info {
            background: #fef5e7;
            border-left: 4px solid #ed8936;
            padding: 15px;
            margin: 20px 0;
        }
        .note {
            background: #ebf8ff;
            border-left: 4px solid #4299e1;
            padding: 15px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🍜 MangaHere API</h1>
            <p class="subtitle">Cloudflare Worker Edition - Powered by R2 Storage</p>
            
            <div class="storage-info">
                <h3>🚀 Cloudflare Worker Features</h3>
                <ul>
                    <li><strong>R2 Object Storage</strong>: Zero egress fees, up to 5TB per file</li>
                    <li><strong>Global Distribution</strong>: Served from 275+ edge locations</li>
                    <li><strong>48-Hour Retention</strong>: Automatic file cleanup</li>
                    <li><strong>High Performance</strong>: Sub-100ms response times globally</li>
                </ul>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/search/{query}</span></h3>
                <p class="description">Search for manga by title with pagination support</p>
                <div class="example">
GET /search/jigokuraku
GET /search/one%20piece?page=2</div>
                <a href="/search/jigokuraku" class="try-link">Try: Search "Jigokuraku"</a>
                <a href="/search/one%20piece" class="try-link">Try: Search "One Piece"</a>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/info/{mangaId}</span></h3>
                <p class="description">Get detailed manga information including chapter list</p>
                <div class="example">
GET /info/jigokuraku_kaku_yuuji</div>
                <a href="/info/jigokuraku_kaku_yuuji" class="try-link">Try: Get Jigokuraku Info</a>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/pages/{mangaId}/{chapterId}</span></h3>
                <p class="description">Generate CBZ file and return download link (stored in R2)</p>
                <div class="example">
GET /pages/jigokuraku_kaku_yuuji/c001

Response:
{
  "success": true,
  "downloadUrl": "https://worker.domain.com/download/jigokuraku_kaku_yuuji_c001.cbz",
  "fileName": "jigokuraku_kaku_yuuji_c001.cbz",
  "fileSize": "16.26 MB",
  "totalPages": 67,
  "expiresAt": "2025-08-08T08:46:17.240Z"
}</div>
                <a href="/pages/jigokuraku_kaku_yuuji/c001" class="try-link">Try: Generate Chapter 1 CBZ</a>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/pages/{mangaId}/{chapterId}</span></h3>
                <p class="description">Get all page URLs for a chapter (without CBZ generation)</p>
                <div class="example">
GET /pages/jigokuraku_kaku_yuuji/c001</div>
                <a href="/pages/jigokuraku_kaku_yuuji/c001" class="try-link">Try It</a>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/cbz/{mangaId}/{chapterId}</span></h3>
                <p class="description">Generate CBZ file and upload to Catbox with download link</p>
                <div class="example">
GET /cbz/jigokuraku_kaku_yuuji/c001</div>
                <a href="/cbz/jigokuraku_kaku_yuuji/c001" class="try-link">Try It</a>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/rename?url={catboxUrl}&filename={name}.cbz</span></h3>
                <p class="description">Download CBZ with custom filename from Catbox URL</p>
                <div class="example">
GET /rename?url=https%3A//files.catbox.moe/abc123.cbz&filename=MyManga_Ch1.cbz</div>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/health</span></h3>
                <p class="description">API health check</p>
                <a href="/health" class="try-link">Check Health</a>
            </div>
        </div>

        <div class="card">
            <h2>🛠️ Simplified Deployment</h2>
            
            <div class="note">
                <h4>Zero Configuration Required:</h4>
                <ul>
                    <li><strong>No R2 or KV setup needed</strong> - Uses Catbox for file hosting</li>
                    <li><strong>No Cloudflare bindings</strong> - Just deploy and it works</li>
                    <li><strong>Your Catbox hash</strong> is already configured: 630d80d5715d80cc0cfaa03ec</li>
                </ul>
            </div>

            <div class="example">
# Simple deployment (no setup required)
npx wrangler deploy

# That's it! Your worker will be live at:
# https://mangahere-api.your-subdomain.workers.dev</div>
        </div>

        <div class="card">
            <h2>⚡ Catbox Integration Features</h2>
            <div class="feature">
                <h4>Permanent Storage</h4>
                <p>Files hosted permanently on Catbox.moe with your user hash</p>
            </div>
            <div class="feature">
                <h4>Custom Downloads</h4>
                <p>Downloads with proper .cbz extension via rename endpoint</p>
            </div>
            <div class="feature">
                <h4>Zero Configuration</h4>
                <p>No Cloudflare R2 or KV setup required - deploy instantly</p>
            </div>
            <div class="feature">
                <h4>Separated Endpoints</h4>
                <p>/pages for viewing URLs, /cbz for file generation</p>
            </div>
        </div>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ...corsHeaders
    }
  });
}

async function handleSearch(pathname, corsHeaders) {
  const query = decodeURIComponent(pathname.split('/search/')[1]);
  const url = new URL('http://dummy.com' + pathname);
  const page = parseInt(url.searchParams.get('page')) || 1;
  
  try {
    const results = await MANGAHERE_SCRAPER.search(query, page);
    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Search failed', 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleInfo(pathname, corsHeaders) {
  const mangaId = pathname.split('/info/')[1];
  
  try {
    const info = await MANGAHERE_SCRAPER.fetchMangaInfo(mangaId);
    return new Response(JSON.stringify(info), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch manga info', 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handlePages(pathname, corsHeaders) {
  const pathParts = pathname.split('/');
  const mangaId = pathParts[2];
  const chapterId = pathParts[3];
  
  try {
    const pages = await MANGAHERE_SCRAPER.fetchChapterPages(`${mangaId}/${chapterId}`);
    if (!pages || pages.length === 0) {
      throw new Error('No pages found for this chapter');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Chapter pages retrieved successfully',
      mangaId: mangaId,
      chapterId: chapterId,
      totalPages: pages.length,
      pages: pages
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Pages fetch error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch chapter pages', 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleCBZ(pathname, corsHeaders, request) {
  const pathParts = pathname.split('/');
  const mangaId = pathParts[2];
  const chapterId = pathParts[3];
  const fileName = `${mangaId}_${chapterId}.cbz`;
  
  try {
    // Get chapter pages
    const pages = await MANGAHERE_SCRAPER.fetchChapterPages(`${mangaId}/${chapterId}`);
    if (!pages || pages.length === 0) {
      throw new Error('No pages found for this chapter');
    }

    // Download images and create CBZ
    const cbzBuffer = await createCBZFromPages(pages);
    
    // Upload to Catbox
    const catboxUrl = await catboxService.uploadFile(cbzBuffer, fileName);
    const baseUrl = new URL(request.url).origin;
    const downloadUrl = catboxService.generateDownloadLink(catboxUrl, fileName, baseUrl);

    return new Response(JSON.stringify({
      success: true,
      message: 'CBZ file created and uploaded to Catbox',
      downloadUrl: downloadUrl,
      catboxUrl: catboxUrl,
      fileName: fileName,
      fileSize: formatFileSize(cbzBuffer.byteLength),
      totalPages: pages.length,
      uploadedAt: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('CBZ generation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate CBZ file', 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleRename(url, corsHeaders) {
  const catboxUrl = url.searchParams.get('url');
  const filename = url.searchParams.get('filename');
  
  if (!catboxUrl || !filename) {
    return new Response('Missing url or filename parameter', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    const response = await fetch(catboxUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch file from Catbox');
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to download file', 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}



async function handleHealth(corsHeaders) {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'MangaHere API Worker',
    timestamp: new Date().toISOString(),
    version: '2.0.0-worker'
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// Utility function to create CBZ from page URLs
async function createCBZFromPages(pages) {
  return await CBZ_GENERATOR.createCBZFromPages(pages);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}