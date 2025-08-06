# Cloudflare Worker Deployment Guide

## 🚀 Deploy MangaHere API to Cloudflare Workers

This guide will help you deploy the MangaHere API as a Cloudflare Worker with R2 storage for CBZ files.

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** - Install globally: `npm install -g wrangler`
3. **Node.js** - Version 16 or higher

## Step 1: Setup Cloudflare Resources

### 1.1 Login to Wrangler
```bash
wrangler login
```

### 1.2 Create R2 Bucket
```bash
wrangler r2 bucket create manga-storage
```

### 1.3 Create KV Namespace
```bash
wrangler kv:namespace create "MANGA_KV"
```
This will output something like:
```
{ binding = "MANGA_KV", id = "abc123def456..." }
```

### 1.4 Update wrangler.toml
Replace `your-kv-namespace-id` in `wrangler.toml` with the actual ID from step 1.3:
```toml
[[kv_namespaces]]
binding = "MANGA_KV"
id = "abc123def456..."  # Replace with your actual ID
```

## Step 2: Deploy the Worker

### 2.1 Deploy to Cloudflare
```bash
wrangler publish
```

### 2.2 Check Deployment
After deployment, you'll get a URL like:
```
https://mangahere-api.your-subdomain.workers.dev
```

## Step 3: Test the API

### 3.1 Test Health Endpoint
```bash
curl https://mangahere-api.your-subdomain.workers.dev/health
```

### 3.2 Test Search
```bash
curl https://mangahere-api.your-subdomain.workers.dev/search/jigokuraku
```

### 3.3 Test CBZ Generation
```bash
curl https://mangahere-api.your-subdomain.workers.dev/pages/jigokuraku_kaku_yuuji/c001
```

## Storage Architecture

### R2 Object Storage
- **Purpose**: Store CBZ files (comic book archives)
- **Capacity**: Up to 5TB per file
- **Features**: Zero egress fees, global distribution
- **Retention**: 48-hour automatic cleanup

### Workers KV
- **Purpose**: Cache file metadata for fast responses
- **Capacity**: 25MB per value, global distribution
- **Features**: Sub-100ms read latency worldwide
- **Retention**: Synchronized with R2 file expiration

## Cost Analysis

### Free Tier Limits
- **Workers**: 100,000 requests/day
- **R2 Storage**: First 10GB free
- **KV Operations**: 100,000 reads/day, 1,000 writes/day

### Paid Tier Scaling
- **Workers**: $0.50 per million requests
- **R2 Storage**: $0.015/GB/month + $0.36/million reads
- **KV Operations**: $0.50/million reads, $5/million writes

## Performance Features

### Global Edge Distribution
- API served from 275+ Cloudflare locations
- Sub-100ms response times worldwide
- Automatic caching and optimization

### Smart Caching Strategy
1. **File Check**: Query KV for existing file metadata
2. **R2 Lookup**: Verify file exists and hasn't expired
3. **Generate**: Create new CBZ if needed
4. **Cache**: Store metadata in KV for future requests

### Auto-Scaling
- Handles traffic spikes automatically
- No server management required
- Pay-per-use pricing model

## Monitoring & Logs

### View Logs
```bash
wrangler tail
```

### Analytics Dashboard
- Visit Cloudflare Dashboard → Workers → mangahere-api
- View request metrics, error rates, and performance data

## Custom Domain (Optional)

### 1. Add Custom Domain
In Cloudflare Dashboard:
1. Go to Workers → mangahere-api → Triggers
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `manga-api.yoursite.com`)

### 2. SSL Certificate
Cloudflare automatically provisions SSL certificates for custom domains.

## Environment Variables

Add any required environment variables in `wrangler.toml`:
```toml
[vars]
API_VERSION = "2.0.0"
MAX_FILE_SIZE = "100MB"
CLEANUP_INTERVAL = "48h"
```

## Troubleshooting

### Common Issues

1. **KV Namespace ID Error**
   - Ensure you've updated `wrangler.toml` with correct namespace ID
   - Run `wrangler kv:namespace list` to verify

2. **R2 Bucket Access**
   - Verify bucket name matches in `wrangler.toml`
   - Check R2 permissions in Cloudflare Dashboard

3. **Module Import Errors**
   - Ensure all files are in the same directory
   - Check ES6 import/export syntax

### Debug Commands
```bash
# View KV namespaces
wrangler kv:namespace list

# View R2 buckets
wrangler r2 bucket list

# View worker status
wrangler status
```

## Cleanup & Maintenance

### File Cleanup Process
The worker automatically:
1. Checks file age on each request
2. Deletes files older than 48 hours from R2
3. Removes corresponding KV metadata
4. Returns 404 for expired files

### Manual Cleanup
```bash
# List files in R2 bucket
wrangler r2 object list manga-storage

# Delete specific file
wrangler r2 object delete manga-storage filename.cbz
```

## Security Considerations

### Rate Limiting
- Implement custom rate limiting if needed
- Use Cloudflare's built-in DDoS protection

### Access Control
- Consider adding authentication for production use
- Use Cloudflare Access for IP restrictions

### Data Privacy
- CBZ files auto-expire after 48 hours
- No persistent user data storage
- All requests logged for security monitoring

## Scaling & Optimization

### Performance Optimization
1. **Parallel Downloads**: Images downloaded concurrently with rate limiting
2. **Efficient ZIP Creation**: Native binary operations in Workers runtime
3. **Smart Caching**: Metadata cached globally in KV store
4. **CDN Distribution**: Files served from global edge network

### Cost Optimization
1. **Auto-Cleanup**: Prevents storage cost accumulation
2. **Efficient KV Usage**: Only store essential metadata
3. **Request Batching**: Minimize API calls where possible

This deployment provides a scalable, cost-effective manga API with global distribution and automatic scaling capabilities.