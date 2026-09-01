# Supabase Function Deployment Script
Write-Host "Starting Supabase function deployment..."
Write-Host "Current directory: $(Get-Location)"
Write-Host "Installing Supabase CLI..."
npm install -g @supabase/cli
Write-Host "Supabase CLI installation complete."
Write-Host "Deploying tiger-sms-status function..."
supabase functions deploy tiger-sms-status --project-ref autgqdfnjwgdnfzmspie
Write-Host "Deployment complete."
