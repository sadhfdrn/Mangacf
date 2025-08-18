/**
 * MangaHere Scraper - Cloudflare Worker Compatible
 * Based on consumet.ts MangaHere provider
 * 
 * Uses native Cloudflare Worker APIs:
 * - fetch() for HTTP requests
 * - HTMLRewriter for DOM parsing (Cloudflare-specific)
 */

class MangaHereScraper {
  constructor() {
    this.baseUrl = 'https://www.mangahere.cc';
    this.name = 'MangaHere';
    this.logo = 'https://www.mangahere.cc/favicon.ico';
    this.classPath = 'MANGA.MangaHere';
  }

  async search(query, page = 1) {
    try {
      const searchUrl = `${this.baseUrl}/search?title=${encodeURIComponent(query)}&page=${page}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': this.baseUrl
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const results = this.parseSearchResults(html);

      return {
        currentPage: page,
        hasNextPage: results.length === 20, // MangaHere shows 20 results per page
        results: results
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  parseSearchResults(html) {
    const results = [];
    
    // Extract manga items using regex patterns (since HTMLRewriter is streaming)
    const mangaPattern = /<div class="manga-list-1-item.*?<\/div>/gs;
    const matches = html.match(mangaPattern) || [];

    for (const match of matches) {
      try {
        const titleMatch = match.match(/<a[^>]*href="[^"]*\/manga\/([^"\/]+)"[^>]*title="([^"]*)">/);
        const imageMatch = match.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/);
        const statusMatch = match.match(/<p class="manga-list-1-item-subtitle"[^>]*>([^<]*)</);

        if (titleMatch && imageMatch) {
          const id = titleMatch[1];
          const title = this.cleanText(titleMatch[2] || imageMatch[2]);
          const image = imageMatch[1];
          const status = statusMatch ? this.cleanText(statusMatch[1]) : 'Unknown';

          results.push({
            id: id,
            title: title,
            altTitles: [],
            description: '',
            status: status,
            releaseDate: null,
            contentRating: null,
            lastVolume: null,
            lastChapter: null,
            genres: [],
            authors: [],
            artists: [],
            characters: [],
            relations: [],
            malId: null,
            anilistId: null,
            mangaUpdatesId: null,
            image: this.resolveUrl(image),
            headerForImage: null,
            cover: this.resolveUrl(image)
          });
        }
      } catch (err) {
        console.warn('Error parsing search result:', err);
      }
    }

    return results;
  }

  async fetchMangaInfo(mangaId) {
    try {
      const mangaUrl = `${this.baseUrl}/manga/${mangaId}`;
      const response = await fetch(mangaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': this.baseUrl
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseMangaInfo(html, mangaId);
    } catch (error) {
      throw new Error(`Failed to fetch manga info: ${error.message}`);
    }
  }

  parseMangaInfo(html, mangaId) {
    try {
      // Extract title
      const titleMatch = html.match(/<h1[^>]*class="[^"]*detail-info-right-title[^"]*"[^>]*>([^<]*)</);
      const title = titleMatch ? this.cleanText(titleMatch[1]) : mangaId;

      // Extract image
      const imageMatch = html.match(/<img[^>]*class="[^"]*detail-info-cover-img[^"]*"[^>]*src="([^"]*)"/);
      const image = imageMatch ? this.resolveUrl(imageMatch[1]) : null;

      // Extract description
      const descMatch = html.match(/<p[^>]*class="[^"]*detail-info-right-content[^"]*"[^>]*>(.*?)<\/p>/s);
      const description = descMatch ? this.cleanText(descMatch[1].replace(/<[^>]*>/g, '')) : '';

      // Extract status
      const statusMatch = html.match(/<span[^>]*class="[^"]*detail-info-right-title-tip[^"]*"[^>]*>([^<]*)</);
      const status = statusMatch ? this.cleanText(statusMatch[1]) : 'Unknown';

      // Extract genres
      const genresPattern = /<a[^>]*href="[^"]*\/tag\/[^"]*"[^>]*>([^<]*)<\/a>/g;
      const genres = [];
      let genreMatch;
      while ((genreMatch = genresPattern.exec(html)) !== null) {
        genres.push(this.cleanText(genreMatch[1]));
      }

      // Extract chapters
      const chapters = this.parseChapters(html, mangaId);

      return {
        id: mangaId,
        title: title,
        altTitles: [],
        description: description,
        headerForImage: null,
        image: image,
        status: status,
        releaseDate: null,
        genres: genres,
        authors: [],
        artists: [],
        characters: [],
        relations: [],
        chapters: chapters,
        malId: null,
        anilistId: null,
        mangaUpdatesId: null
      };
    } catch (error) {
      throw new Error(`Failed to parse manga info: ${error.message}`);
    }
  }

  parseChapters(html, mangaId) {
    const chapters = [];
    
    // Extract chapter links
    const chapterPattern = /<a[^>]*href="[^"]*\/manga\/[^"]*\/([^"\/]+)"[^>]*class="[^"]*color-impo[^"]*"[^>]*>([^<]*)<\/a>/g;
    let chapterMatch;

    while ((chapterMatch = chapterPattern.exec(html)) !== null) {
      try {
        const chapterId = chapterMatch[1];
        const chapterTitle = this.cleanText(chapterMatch[2]);
        
        // Extract chapter number from title
        const numberMatch = chapterTitle.match(/(?:chapter|ch|#)\s*(\d+(?:\.\d+)?)/i);
        const chapterNumber = numberMatch ? parseFloat(numberMatch[1]) : null;

        chapters.push({
          id: `${mangaId}/${chapterId}`,
          chapterNumber: chapterNumber,
          title: chapterTitle,
          volumeNumber: null,
          pages: null,
          releaseDate: null
        });
      } catch (err) {
        console.warn('Error parsing chapter:', err);
      }
    }

    // Sort chapters by number (descending - newest first)
    return chapters.sort((a, b) => {
      if (a.chapterNumber && b.chapterNumber) {
        return b.chapterNumber - a.chapterNumber;
      }
      return 0;
    });
  }

  async fetchChapterPages(chapterId) {
    try {
      const chapterUrl = `${this.baseUrl}/manga/${chapterId}`;
      const response = await fetch(chapterUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': this.baseUrl
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseChapterPages(html);
    } catch (error) {
      throw new Error(`Failed to fetch chapter pages: ${error.message}`);
    }
  }

  parseChapterPages(html) {
    const pages = [];
    
    // Method 1: Extract from packed JavaScript without eval (Cloudflare Workers compatible)
    try {
      // Look for packed JavaScript patterns that contain image data
      const packedPatterns = [
        // Pattern 1: Direct string arrays in JavaScript
        /\['(\/\/[^']+\.(?:jpg|jpeg|png|gif|webp)[^']*(?:','\/\/[^']+\.(?:jpg|jpeg|png|gif|webp)[^']*)*?)'\]/g,
        // Pattern 2: Double quoted arrays  
        /"(\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*(?:","\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*)*?)"/g,
        // Pattern 3: Variable assignments with image arrays
        /(?:images|pages|urls)\s*=\s*\[([^\]]*\.(?:jpg|jpeg|png|gif|webp)[^\]]*)\]/gi
      ];

      for (const pattern of packedPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          try {
            const urlsString = match[1];
            const urls = urlsString.split(/['"','"]+/).filter(url => {
              const trimmed = url.trim();
              return trimmed && trimmed.length > 10 && 
                     !trimmed.includes('loading.gif') && 
                     !trimmed.includes('placeholder') &&
                     (trimmed.includes('.jpg') || trimmed.includes('.jpeg') || 
                      trimmed.includes('.png') || trimmed.includes('.gif') || 
                      trimmed.includes('.webp'));
            });
            
            if (urls.length > 0) {
              urls.forEach((relativeUrl, i) => {
                const cleanUrl = relativeUrl.trim().replace(/^['"]|['"]$/g, '');
                pages.push({
                  page: i + 1,
                  img: cleanUrl.startsWith('//') ? `https:${cleanUrl}` : `https:${cleanUrl}`,
                  headerForImage: null
                });
              });
              break;
            }
          } catch (err) {
            continue;
          }
        }
        if (pages.length > 0) break;
      }
    } catch (error) {
      console.warn('Failed to parse with pattern matching:', error);
    }
    
    // Method 2: Custom JavaScript unpacker (no eval needed)
    if (pages.length === 0) {
      try {
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[^}]+\}[^)]*\)/);
        if (packedMatch) {
          const unpacked = this.unpackJavaScript(packedMatch[0]);
          if (unpacked) {
            // Look for image arrays in unpacked code
            const imagePatterns = [
              /\['([^']+(?:','[^']+)*?)'\]/,
              /"([^"]+(?:","[^"]+)*?)"/,
              /images\s*=\s*\[([^\]]+)\]/
            ];
            
            for (const pattern of imagePatterns) {
              const match = unpacked.match(pattern);
              if (match) {
                const urls = match[1].split(/['"','"]+/).filter(url => {
                  const trimmed = url.trim();
                  return trimmed && trimmed.length > 10 && 
                         !trimmed.includes('loading.gif') &&
                         (trimmed.includes('.jpg') || trimmed.includes('.jpeg') || 
                          trimmed.includes('.png') || trimmed.includes('.gif') || 
                          trimmed.includes('.webp'));
                });
                
                urls.forEach((relativeUrl, i) => {
                  const cleanUrl = relativeUrl.trim().replace(/^['"]|['"]$/g, '');
                  pages.push({
                    page: i + 1,
                    img: cleanUrl.startsWith('//') ? `https:${cleanUrl}` : `https:${cleanUrl}`,
                    headerForImage: null
                  });
                });
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('JavaScript unpacking failed:', err);
      }
    }

    // Method 3: Extract page images from JavaScript variables (original method)
    if (pages.length === 0) {
      const scriptMatch = html.match(/var\s+chapterPages\s*=\s*(\[.*?\]);/s);
      if (scriptMatch) {
        try {
          const pagesData = JSON.parse(scriptMatch[1]);
          for (const pageData of pagesData) {
            if (pageData.u) {
              pages.push({
                img: this.resolveUrl(pageData.u),
                page: pages.length + 1,
                headerForImage: null
              });
            }
          }
        } catch (err) {
          console.warn('Error parsing pages from JavaScript:', err);
        }
      }
    }

    // Method 4: Fallback - extract from img tags
    if (pages.length === 0) {
      const imgPattern = /<img[^>]*class="[^"]*reader-main-img[^"]*"[^>]*src="([^"]*)"/g;
      let imgMatch;
      
      while ((imgMatch = imgPattern.exec(html)) !== null) {
        pages.push({
          img: this.resolveUrl(imgMatch[1]),
          page: pages.length + 1,
          headerForImage: null
        });
      }
    }

    return pages;
  }

  // Custom JavaScript unpacker that doesn't use eval()
  unpackJavaScript(packedCode) {
    try {
      // Extract the packed function parameters
      const match = packedCode.match(/function\(p,a,c,k,e,d\)\{.*?return p\}[^)]*\('([^']*)',(\d+),(\d+),'([^']*)'/);
      if (!match) return null;

      const [, encoded, base, count, dictionary] = match;
      const words = dictionary.split('|');
      
      // Simple unpacker implementation
      let decoded = encoded;
      
      // Replace encoded numbers with dictionary words
      for (let i = count - 1; i >= 0; i--) {
        const regex = new RegExp('\\b' + this.toBase(i, base) + '\\b', 'g');
        if (words[i]) {
          decoded = decoded.replace(regex, words[i]);
        }
      }
      
      return decoded;
    } catch (err) {
      return null;
    }
  }

  // Convert number to different base (for unpacking)
  toBase(num, base) {
    if (num === 0) return '0';
    const charset = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    while (num > 0) {
      result = charset[num % base] + result;
      num = Math.floor(num / base);
    }
    return result;
  }

  resolveUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return this.baseUrl + url;
    return url;
  }

  cleanText(text) {
    if (!text) return '';
    return text.trim()
      .replace(/\s+/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
  }
}

// Create and export scraper instance
export const MANGAHERE_SCRAPER = new MangaHereScraper();