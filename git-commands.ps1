#!/usr/bin/env pwsh
Write-Host "=== Starting Git Operations ===" -ForegroundColor Cyan
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Green

Write-Host "`n=== Git Add ===" -ForegroundColor Cyan
git add -A
Write-Host "Add completed" -ForegroundColor Green

Write-Host "`n=== Git Commit ===" -ForegroundColor Cyan
git commit -m "Add manual Check Status Now button to dashboard for on-demand SMS polling"
Write-Host "Commit completed" -ForegroundColor Green

Write-Host "`n=== Git Status ===" -ForegroundColor Cyan
git status --short
Write-Host "Status check completed" -ForegroundColor Green

Write-Host "`n=== Last Commit ===" -ForegroundColor Cyan
git log --oneline -1
Write-Host "Log check completed" -ForegroundColor Green

Write-Host "`n=== Git Push ===" -ForegroundColor Cyan
git push origin main 2>&1 | Write-Host
Write-Host "Push completed" -ForegroundColor Green

Write-Host "`n=== Final Status ===" -ForegroundColor Cyan
git status
Write-Host "`n=== All operations complete ===" -ForegroundColor Green
