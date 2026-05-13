# deploy.ps1
Write-Host "🚀 Deploying to Vercel with environment variables..." -ForegroundColor Green

# Read .env file and add each variable to Vercel
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        Write-Host "Adding $key..." -ForegroundColor Yellow
        echo $value | vercel env add $key production
    }
}

# Deploy the project
Write-Host "Deploying project..." -ForegroundColor Green
vercel --prod

Write-Host "✅ Deployment complete!" -ForegroundColor Green
