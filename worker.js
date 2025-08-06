/**
 * Cloudflare Worker version of MangaHere API
 * 
 * Storage Strategy:
 * - Uses R2 Object Storage for CBZ files (zero egress fees, up to 5TB per object)
 * - Uses Workers KV for metadata caching (fast global access)
 * - 48-hour file retention policy
 * 
 * Required Bindings in wrangler.toml:
 * - R2_BUCKET: R2 bucket for storing CBZ files
 * - MANGA_KV: KV namespace for metadata storage
 */

import { MANGAHERE_SCRAPER } from './mangahere-scraper.js';
import { CBZ_GENERATOR } from './cbz-generator.js';

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
        return handlePages(pathname, env, ctx, corsHeaders, request);
      } else if (pathname.startsWith('/download/')) {
        return handleDownload(pathname, env, corsHeaders);
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
                <h3><span class="method">GET</span><span class="url">/download/{fileName}</span></h3>
                <p class="description">Direct download CBZ files from R2 storage</p>
                <div class="example">
GET /download/jigokuraku_kaku_yuuji_c001.cbz</div>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span><span class="url">/health</span></h3>
                <p class="description">API health check</p>
                <a href="/health" class="try-link">Check Health</a>
            </div>
        </div>

        <div class="card">
            <h2>🛠️ Deployment Instructions</h2>
            
            <div class="note">
                <h4>Required Cloudflare Resources:</h4>
                <ul>
                    <li><strong>R2 Bucket</strong>: For storing CBZ files</li>
                    <li><strong>Workers KV Namespace</strong>: For metadata caching</li>
                </ul>
            </div>

            <div class="example">
# 1. Create R2 bucket
wrangler r2 bucket create manga-storage

# 2. Create KV namespace
wrangler kv:namespace create "MANGA_KV"

# 3. Update wrangler.toml
kv_namespaces = [
  { binding = "MANGA_KV", id = "your-kv-namespace-id" }
]
r2_buckets = [
  { binding = "R2_BUCKET", bucket_name = "manga-storage" }
]

# 4. Deploy
wrangler publish</div>
        </div>

        <div class="card">
            <h2>⚡ Performance Features</h2>
            <div class="feature">
                <h4>Smart Caching</h4>
                <p>File metadata cached in Workers KV for instant responses</p>
            </div>
            <div class="feature">
                <h4>Global CDN</h4>
                <p>Downloads served from closest Cloudflare edge location</p>
            </div>
            <div class="feature">
                <h4>Zero Egress Fees</h4>
                <p>No bandwidth costs with R2 object storage</p>
            </div>
            <div class="feature">
                <h4>Auto Cleanup</h4>
                <p>Files automatically deleted after 48 hours</p>
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

async function handlePages(pathname, env, ctx, corsHeaders, request) {
  const pathParts = pathname.split('/');
  const mangaId = pathParts[2];
  const chapterId = pathParts[3];
  const fileName = `${mangaId}_${chapterId}.cbz`;
  
  try {
    // Check if file already exists in R2
    const existingFile = await env.R2_BUCKET.head(fileName);
    if (existingFile) {
      // Check if file is still valid (within 48 hours)
      const uploadTime = new Date(existingFile.uploaded);
      const expiryTime = new Date(uploadTime.getTime() + 48 * 60 * 60 * 1000);
      
      if (new Date() < expiryTime) {
        return new Response(JSON.stringify({
          success: true,
          message: "CBZ file already exists",
          downloadUrl: `${new URL(pathname, request.url).origin}/download/${fileName}`,
          fileName: fileName,
          fileSize: formatFileSize(existingFile.size),
          createdAt: uploadTime.toISOString(),
          expiresAt: expiryTime.toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } else {
        // File expired, delete it
        await env.R2_BUCKET.delete(fileName);
      }
    }

    // Generate new CBZ file
    const pages = await MANGAHERE_SCRAPER.fetchChapterPages(`${mangaId}/${chapterId}`);
    if (!pages || pages.length === 0) {
      throw new Error('No pages found for this chapter');
    }

    // Download images and create CBZ
    const cbzBuffer = await createCBZFromPages(pages);
    
    // Upload to R2
    const uploadTime = new Date();
    const expiryTime = new Date(uploadTime.getTime() + 48 * 60 * 60 * 1000);
    
    await env.R2_BUCKET.put(fileName, cbzBuffer, {
      customMetadata: {
        mangaId: mangaId,
        chapterId: chapterId,
        createdAt: uploadTime.toISOString(),
        expiresAt: expiryTime.toISOString()
      }
    });

    // Cache metadata in KV
    await env.MANGA_KV.put(`file:${fileName}`, JSON.stringify({
      fileName: fileName,
      fileSize: formatFileSize(cbzBuffer.byteLength),
      totalPages: pages.length,
      createdAt: uploadTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    }), { expirationTtl: 48 * 60 * 60 }); // 48 hours

    return new Response(JSON.stringify({
      success: true,
      message: "CBZ file created successfully",
      downloadUrl: `${new URL(pathname, request.url).origin}/download/${fileName}`,
      fileName: fileName,
      fileSize: formatFileSize(cbzBuffer.byteLength),
      totalPages: pages.length,
      createdAt: uploadTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Pages generation error:', error);
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

async function handleDownload(pathname, env, corsHeaders) {
  const fileName = pathname.split('/download/')[1];
  
  // Security check: prevent path traversal
  if (fileName.includes('..') || fileName.includes('/') || !fileName.endsWith('.cbz')) {
    return new Response('Invalid file name', { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  try {
    const file = await env.R2_BUCKET.get(fileName);
    
    if (!file) {
      return new Response('File not found or expired', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': file.size.toString(),
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response('Failed to retrieve file', { 
      status: 500, 
      headers: corsHeaders 
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