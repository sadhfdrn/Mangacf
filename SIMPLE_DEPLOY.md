# Simple Cloudflare Worker Deployment

## Step 1: Create Resources in Cloudflare Dashboard

### 1.1 Create R2 Bucket
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **R2 Object Storage** in the sidebar
3. Click **Create bucket**
4. Name it: `manga-storage`
5. Click **Create bucket**

### 1.2 Create KV Namespace
1. In Cloudflare Dashboard, click **Workers & Pages** in sidebar
2. Click **KV** tab
3. Click **Create a namespace**
4. Name it: `MANGA_KV`
5. Click **Add**
6. **Copy the Namespace ID** - you'll need this!

## Step 2: Update Configuration

### 2.1 Update wrangler.toml
Replace `REPLACE_WITH_YOUR_KV_ID` in `wrangler.toml` with your actual KV namespace ID:

```toml
[[kv_namespaces]]
binding = "MANGA_KV"
id = "abc123def456789..."  # Your actual namespace ID
```

## Step 3: Deploy

### Simple Deploy Command
```bash
npx wrangler deploy
```

That's it! Your worker will be deployed to a URL like:
`https://mangahere-api.your-subdomain.workers.dev`

## Test Your Deployment

```bash
# Replace with your actual worker URL
curl https://mangahere-api.your-subdomain.workers.dev/health

# Test search
curl https://mangahere-api.your-subdomain.workers.dev/search/jigokuraku
```

## Getting Your KV Namespace ID

### Method 1: Dashboard (Easiest)
1. Go to Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Find your `MANGA_KV` namespace
3. The **Namespace ID** is shown in the list

### Method 2: Command Line
```bash
npx wrangler kv:namespace list
```

### Method 3: Create via Command (if needed)
```bash
npx wrangler kv:namespace create "MANGA_KV"
```
This will output the namespace ID.

## Troubleshooting

### Common Issues
1. **KV namespace not found**: Make sure you updated the ID in `wrangler.toml`
2. **R2 bucket not found**: Check the bucket name is exactly `manga-storage`
3. **Deploy fails**: Run `npx wrangler login` first

### Quick Commands
```bash
# Login to Cloudflare
npx wrangler login

# List your KV namespaces
npx wrangler kv:namespace list

# List your R2 buckets
npx wrangler r2 bucket list

# Deploy
npx wrangler deploy
```