# Atlas prototip — assets/embed/*.png dosyalarini index.html icindeki IMG
# nesnesine data URI olarak gomer. Idempotent: zaten gomulmusse dokunmaz.
$root = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $root "index.html"
$html = [IO.File]::ReadAllText($htmlPath)

$map = @{
  'assets/embed/mascot-happy.png' = Join-Path $root 'assets\embed\mascot-happy.png'
  'assets/embed/mascot-sad.png'   = Join-Path $root 'assets\embed\mascot-sad.png'
  'assets/embed/mascot-wave.png'  = Join-Path $root 'assets\embed\mascot-wave.png'
  'assets/embed/castle-tyt.png'   = Join-Path $root 'assets\embed\castle-tyt.png'
}

$count = 0
foreach ($k in $map.Keys) {
  $needle = "'" + $k + "'"
  if ($html.Contains($needle)) {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($map[$k]))
    $html = $html.Replace($needle, "'data:image/png;base64," + $b64 + "'")
    $count++
  }
}

[IO.File]::WriteAllText($htmlPath, $html, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Gomulen gorsel: {0}  |  index.html boyutu: {1} KB" -f $count, [math]::Round((Get-Item $htmlPath).Length/1KB))
