/**
 * CBZ Generator for Cloudflare Workers
 * Creates ZIP files (CBZ format) from manga page images
 * 
 * Uses native APIs available in Cloudflare Workers runtime
 */

class CBZGenerator {
  constructor() {
    this.crc32Table = this.generateCRC32Table();
  }

  // Generate CRC32 lookup table
  generateCRC32Table() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  }

  // Calculate CRC32 checksum
  calculateCRC32(data) {
    const bytes = new Uint8Array(data);
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = this.crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // Download image and return as Uint8Array
  async downloadImage(url, pageNumber, totalPages) {
    try {
      console.log(`Downloading page ${pageNumber}/${totalPages}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.mangahere.cc/'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      return new Uint8Array(imageBuffer);
    } catch (error) {
      console.error(`Error downloading page ${pageNumber}:`, error);
      throw error;
    }
  }

  // Create CBZ file from page URLs
  async createCBZFromPages(pages) {
    try {
      const files = [];
      
      // Download all images with rate limiting
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        try {
          // Add delay to avoid overwhelming the server
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          }
          
          const imageData = await this.downloadImage(page.img, i + 1, pages.length);
          const extension = this.getImageExtension(page.img);
          const fileName = `${String(i + 1).padStart(3, '0')}.${extension}`;
          
          files.push({
            name: fileName,
            data: imageData
          });
        } catch (error) {
          console.error(`Failed to download page ${i + 1}:`, error);
          // Continue with other pages instead of failing completely
        }
      }

      if (files.length === 0) {
        throw new Error('No pages were successfully downloaded');
      }

      console.log(`Creating CBZ file with ${files.length} pages`);
      return this.createZIP(files);
    } catch (error) {
      console.error('CBZ creation error:', error);
      throw error;
    }
  }

  // Get file extension from URL
  getImageExtension(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) {
      const ext = match[1].toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
    }
    return 'jpg';
  }

  // Create ZIP file
  createZIP(files) {
    const centralDirectoryEntries = [];
    let centralDirectorySize = 0;
    let offsetStart = 0;
    const chunks = [];

    // Process each file
    for (const file of files) {
      const fileName = new TextEncoder().encode(file.name);
      const fileData = file.data;
      const crc32 = this.calculateCRC32(fileData);
      
      // Local file header
      const localHeader = new ArrayBuffer(30 + fileName.length);
      const localView = new DataView(localHeader);
      
      localView.setUint32(0, 0x04034b50, true); // Local file header signature
      localView.setUint16(4, 20, true); // Version needed to extract
      localView.setUint16(6, 0, true); // General purpose bit flag
      localView.setUint16(8, 0, true); // Compression method (stored)
      localView.setUint16(10, 0, true); // Last mod file time
      localView.setUint16(12, 0, true); // Last mod file date
      localView.setUint32(14, crc32, true); // CRC-32
      localView.setUint32(18, fileData.length, true); // Compressed size
      localView.setUint32(22, fileData.length, true); // Uncompressed size
      localView.setUint16(26, fileName.length, true); // File name length
      localView.setUint16(28, 0, true); // Extra field length
      
      // Copy filename
      new Uint8Array(localHeader, 30).set(fileName);
      
      chunks.push(new Uint8Array(localHeader));
      chunks.push(fileData);
      
      // Central directory entry
      const centralEntry = new ArrayBuffer(46 + fileName.length);
      const centralView = new DataView(centralEntry);
      
      centralView.setUint32(0, 0x02014b50, true); // Central file header signature
      centralView.setUint16(4, 20, true); // Version made by
      centralView.setUint16(6, 20, true); // Version needed to extract
      centralView.setUint16(8, 0, true); // General purpose bit flag
      centralView.setUint16(10, 0, true); // Compression method
      centralView.setUint16(12, 0, true); // Last mod file time
      centralView.setUint16(14, 0, true); // Last mod file date
      centralView.setUint32(16, crc32, true); // CRC-32
      centralView.setUint32(20, fileData.length, true); // Compressed size
      centralView.setUint32(24, fileData.length, true); // Uncompressed size
      centralView.setUint16(28, fileName.length, true); // File name length
      centralView.setUint16(30, 0, true); // Extra field length
      centralView.setUint16(32, 0, true); // File comment length
      centralView.setUint16(34, 0, true); // Disk number start
      centralView.setUint16(36, 0, true); // Internal file attributes
      centralView.setUint32(38, 0, true); // External file attributes
      centralView.setUint32(42, offsetStart, true); // Relative offset of local header
      
      // Copy filename
      new Uint8Array(centralEntry, 46).set(fileName);
      
      centralDirectoryEntries.push(new Uint8Array(centralEntry));
      centralDirectorySize += centralEntry.byteLength;
      offsetStart += localHeader.byteLength + fileData.length;
    }

    // End of central directory record
    const endOfCentralDir = new ArrayBuffer(22);
    const endView = new DataView(endOfCentralDir);
    
    endView.setUint32(0, 0x06054b50, true); // End of central dir signature
    endView.setUint16(4, 0, true); // Number of this disk
    endView.setUint16(6, 0, true); // Number of the disk with start of central directory
    endView.setUint16(8, files.length, true); // Total number of entries in central directory on this disk
    endView.setUint16(10, files.length, true); // Total number of entries in central directory
    endView.setUint32(12, centralDirectorySize, true); // Size of central directory
    endView.setUint32(16, offsetStart, true); // Offset of start of central directory
    endView.setUint16(20, 0, true); // ZIP file comment length

    // Combine all chunks
    const totalSize = chunks.reduce((size, chunk) => size + chunk.length, 0) + 
                     centralDirectorySize + endOfCentralDir.byteLength;
    
    const result = new Uint8Array(totalSize);
    let offset = 0;
    
    // Copy file data
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Copy central directory
    for (const entry of centralDirectoryEntries) {
      result.set(entry, offset);
      offset += entry.length;
    }
    
    // Copy end of central directory
    result.set(new Uint8Array(endOfCentralDir), offset);
    
    return result.buffer;
  }
}

// Export the CBZ generator
export const CBZ_GENERATOR = new CBZGenerator();