$ErrorActionPreference = "Stop"

Write-Host "Initializing ORBITIDE repository..."

git init -b main
git add .
git commit -m "chore: initialize Orbitide project"

Write-Host "\nLocal git repository initialized."
Write-Host "To create the private GitHub repo and push it (GitHub CLI required), run:"
Write-Host "gh repo create andresbotia/orbitide --private --source=. --remote=origin --push"
