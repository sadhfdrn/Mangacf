#!/bin/bash

# MangaHere API - Cloudflare Worker Deployment Script

echo "🍜 MangaHere API - Cloudflare Worker Deployment"
echo "=============================================="

# Check if we're in the cloudflare directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: Please run this script from the cloudflare folder"
    echo "   cd cloudflare && ./deploy.sh"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx (Node.js) is required but not installed"
    exit 1
fi

echo ""
echo "🚀 Deployment Options:"
echo "1) Deploy without CBZ generation (basic functionality)"
echo "2) Deploy with CBZ generation (requires Catbox user hash)"
echo ""

read -p "Choose option (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "📈 Deploying basic version (search, info, pages endpoints only)..."
        npx wrangler deploy
        echo ""
        echo "✅ Deployment complete!"
        echo "📝 Note: CBZ generation is disabled. Only /search, /info, and /pages endpoints will work."
        echo "🔗 To enable CBZ generation later, set CATBOX_USER_HASH environment variable."
        ;;
    2)
        echo ""
        echo "🔑 CBZ generation requires a Catbox user hash."
        echo "📖 Get yours from: https://catbox.moe (Account Settings)"
        echo ""
        read -p "Enter your Catbox user hash: " catbox_hash
        
        if [ -z "$catbox_hash" ]; then
            echo "❌ Error: Catbox user hash is required for CBZ generation"
            exit 1
        fi
        
        echo ""
        echo "🔐 Setting CATBOX_USER_HASH environment variable..."
        echo "$catbox_hash" | npx wrangler secret put CATBOX_USER_HASH
        
        echo ""
        echo "📈 Deploying full version with CBZ generation..."
        npx wrangler deploy
        
        echo ""
        echo "✅ Deployment complete!"
        echo "🎉 All endpoints are now available including CBZ generation!"
        ;;
    *)
        echo "❌ Invalid option. Please choose 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "🌐 Your API should now be available at:"
echo "   https://mangahere-api.your-subdomain.workers.dev"
echo ""
echo "📚 Available endpoints:"
echo "   GET /                          - API documentation"
echo "   GET /search/{query}            - Search manga"
echo "   GET /info/{mangaId}            - Get manga details"
echo "   GET /pages/{mangaId}/{chapterId} - Get page URLs"
if [ "$choice" = "2" ]; then
echo "   GET /cbz/{mangaId}/{chapterId}   - Generate CBZ files"
fi
echo ""
echo "✨ Happy manga scraping!"