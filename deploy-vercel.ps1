# Deploy to Vercel with environment variables
Set-Location 'C:\Users\mrdan\tdlib'

# Set environment variables for this session
$env:BOT_TOKEN = '8979661285:AAEfFkYsX9mEnsq_H5Ooj3g5Q9VVeYVgzQM'
$env:BOT_USERNAME = 'mrdanauthbot'
$env:JWT_SECRET = 'super-secret-jwt-key-tdlib-2026'

Write-Host "🚀 Deploying to Vercel with environment variables..." -ForegroundColor Cyan

# Deploy to production
vercel deploy --prod --env BOT_TOKEN=$env:BOT_TOKEN --env BOT_USERNAME=$env:BOT_USERNAME --env JWT_SECRET=$env:JWT_SECRET

Write-Host "✅ Deployment complete!" -ForegroundColor Green
