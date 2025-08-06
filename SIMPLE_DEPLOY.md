# Ultra-Simple Cloudflare Worker Deployment

## 🚀 Zero Configuration Deployment

This MangaHere API uses **Catbox.moe** for file hosting, so no Cloudflare storage setup is required!

### Your Catbox Configuration
- **User Hash**: `630d80d5715d80cc0cfaa03ec` (already configured)
- **Storage**: Permanent file hosting on Catbox.moe
- **Downloads**: Custom filename support via `/rename` endpoint

## One-Command Deployment

```bash
npx wrangler deploy
```

That's literally it! 🎉

Your worker will be deployed to a URL like:
`https://mangahere-api.your-subdomain.workers.dev`

## Test Your Deployment

```bash
# Replace with your actual worker URL
curl https://mangahere-api.your-subdomain.workers.dev/health

# Test search
curl https://mangahere-api.your-subdomain.workers.dev/search/jigokuraku

# Test pages (view only)
curl https://mangahere-api.your-subdomain.workers.dev/pages/jigokuraku_kaku_yuuji/c001

# Test CBZ generation (uploads to Catbox)
curl https://mangahere-api.your-subdomain.workers.dev/cbz/jigokuraku_kaku_yuuji/c001
```

## API Endpoints

### 🔍 Search Manga
```
GET /search/{query}?page=1
```

### 📖 Get Manga Info
```
GET /info/{mangaId}
```

### 📄 View Chapter Pages
```
GET /pages/{mangaId}/{chapterId}
```

### 📦 Generate CBZ File
```
GET /cbz/{mangaId}/{chapterId}
```

### 📥 Download with Custom Name
```
GET /rename?url={catboxUrl}&filename={customName}.cbz
```

## How It Works

1. **Search & Info**: Scrapes MangaHere for manga data
2. **Pages**: Returns list of page URLs for viewing
3. **CBZ**: Creates comic book archive and uploads to Catbox
4. **Download**: Streams file from Catbox with custom filename

## Troubleshooting

### Login Issues
```bash
npx wrangler login
```

### Check Deployment Status
```bash
npx wrangler deployments list
```

### View Logs
```bash
npx wrangler tail
```

## No Setup Required! 
- ✅ No R2 buckets to create
- ✅ No KV namespaces to configure
- ✅ No wrangler.toml editing needed
- ✅ Your Catbox hash is pre-configured