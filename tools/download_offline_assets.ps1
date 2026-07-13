$ErrorActionPreference = 'Stop'
$base = 'f:/Commercial Project/game'
$fontsDir = Join-Path $base 'assets/fonts'
$vendorDir = Join-Path $base 'assets/vendor'
$imagesDir = Join-Path $base 'assets/images'
New-Item -ItemType Directory -Path $fontsDir,$vendorDir,$imagesDir -Force | Out-Null

function Download-File {
  param([string]$Url, [string]$OutFile)
  if (Test-Path $OutFile) { return }
  Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 120
}

$fontCssUrls = @(
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800;900&display=swap'
)

$fontFaces = New-Object System.Collections.Generic.List[object]
foreach ($cssUrl in $fontCssUrls) {
  $css = Invoke-WebRequest -Uri $cssUrl -UseBasicParsing -TimeoutSec 120 | Select-Object -ExpandProperty Content
  foreach ($match in [regex]::Matches($css, "@font-face\s*\{([^}]+)\}", [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
    $block = $match.Groups[1].Value
    $familyMatch = [regex]::Match($block, "font-family:\s*'([^']+)'")
    $styleMatch = [regex]::Match($block, "font-style:\s*([^;]+)")
    $weightMatch = [regex]::Match($block, "font-weight:\s*([^;]+)")
    $srcMatch = [regex]::Match($block, "src:\s*url\(([^)]+)\)")
    if (-not ($familyMatch.Success -and $styleMatch.Success -and $weightMatch.Success -and $srcMatch.Success)) { continue }
    $family = $familyMatch.Groups[1].Value
    $style = $styleMatch.Groups[1].Value.Trim()
    $weight = $weightMatch.Groups[1].Value.Trim()
    $fontUrl = $srcMatch.Groups[1].Value.Trim()
    $uri = [System.Uri]$fontUrl
    $fileName = [System.IO.Path]::GetFileName($uri.LocalPath)
    $target = Join-Path $fontsDir $fileName
    Download-File -Url $fontUrl -OutFile $target
    $fontFaces.Add([pscustomobject]@{ Family = $family; Style = $style; Weight = $weight; File = $fileName })
  }
}

$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$lines = New-Object System.Collections.Generic.List[string]
foreach ($face in $fontFaces) {
  $key = '{0}|{1}|{2}' -f $face.Family, $face.Style, $face.Weight
  if ($seen.Add($key)) {
    $lines.Add("@font-face {`n  font-family: '$($face.Family)';`n  font-style: $($face.Style);`n  font-weight: $($face.Weight);`n  src: url('./$($face.File)') format('woff2');`n  font-display: swap;`n}")
  }
}

$localCssPath = Join-Path $fontsDir 'local-fonts.css'
Set-Content -Path $localCssPath -Value ($lines -join "`n`n") -Encoding utf8

$vendorUrls = @{
  'assets/vendor/lucide.min.js' = 'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
  'assets/vendor/fabric.min.js' = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js'
  'assets/vendor/three.module.js' = 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js'
}
foreach ($entry in $vendorUrls.GetEnumerator()) {
  $outPath = Join-Path $base $entry.Key
  $parent = Split-Path $outPath -Parent
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Download-File -Url $entry.Value -OutFile $outPath
}

$images = @{
  'assets/images/blue-team.png' = 'https://via.placeholder.com/150/1e3a8a/ffffff?text=Blue+Team'
  'assets/images/red-team.png' = 'https://via.placeholder.com/150/831843/ffffff?text=Red+Team'
}
foreach ($entry in $images.GetEnumerator()) {
  $outPath = Join-Path $base $entry.Key
  $parent = Split-Path $outPath -Parent
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Download-File -Url $entry.Value -OutFile $outPath
}

Write-Host 'Downloaded local assets successfully.'
