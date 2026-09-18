$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'assets\app-icons\app-store-1024.png'
$original = [System.Drawing.Bitmap]::FromFile($sourcePath)
$source = [System.Drawing.Bitmap]::new(
    $original.Width,
    $original.Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

$sourceGraphics = [System.Drawing.Graphics]::FromImage($source)
try {
    $sourceGraphics.DrawImageUnscaled($original, 0, 0)
} finally {
    $sourceGraphics.Dispose()
    $original.Dispose()
}

try {
    $visited = [bool[]]::new($source.Width * $source.Height)
    $queue = [System.Collections.Generic.Queue[int]]::new()

    for ($x = 0; $x -lt $source.Width; $x++) {
        $queue.Enqueue($x)
        $queue.Enqueue((($source.Height - 1) * $source.Width) + $x)
    }
    for ($y = 1; $y -lt ($source.Height - 1); $y++) {
        $queue.Enqueue($y * $source.Width)
        $queue.Enqueue(($y * $source.Width) + $source.Width - 1)
    }

    while ($queue.Count -gt 0) {
        $index = $queue.Dequeue()
        if ($visited[$index]) { continue }
        $visited[$index] = $true

        $x = $index % $source.Width
        $y = [int][Math]::Floor($index / $source.Width)
        $pixel = $source.GetPixel($x, $y)
        $isDarkBackground = $pixel.R -lt 105 -and
            $pixel.G -lt 115 -and
            $pixel.B -lt 140 -and
            $pixel.B -ge ($pixel.R * 0.85)
        if (-not $isDarkBackground) { continue }

        $source.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        if ($x -gt 0) { $queue.Enqueue($index - 1) }
        if ($x -lt ($source.Width - 1)) { $queue.Enqueue($index + 1) }
        if ($y -gt 0) { $queue.Enqueue($index - $source.Width) }
        if ($y -lt ($source.Height - 1)) { $queue.Enqueue($index + $source.Width) }
    }

    $bounds = [System.Drawing.Rectangle]::Empty
    for ($y = 0; $y -lt $source.Height; $y++) {
        for ($x = 0; $x -lt $source.Width; $x++) {
            if ($source.GetPixel($x, $y).A -gt 8) {
                if ($bounds.IsEmpty) {
                    $bounds = [System.Drawing.Rectangle]::new($x, $y, 1, 1)
                } else {
                    $bounds = [System.Drawing.Rectangle]::Union(
                        $bounds,
                        [System.Drawing.Rectangle]::new($x, $y, 1, 1)
                    )
                }
            }
        }
    }

    if ($bounds.IsEmpty) { throw 'The source logo has no visible pixels.' }

    function Write-TransparentIcon {
        param(
            [string] $RelativePath,
            [int] $Width,
            [int] $Height,
            [double] $ArtworkScale
        )

        $target = [System.Drawing.Bitmap]::new(
            $Width,
            $Height,
            [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
        )

        try {
            $graphics = [System.Drawing.Graphics]::FromImage($target)
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

                $scale = [Math]::Min(
                    ($Width * $ArtworkScale) / $bounds.Width,
                    ($Height * $ArtworkScale) / $bounds.Height
                )
                $drawWidth = [int][Math]::Round($bounds.Width * $scale)
                $drawHeight = [int][Math]::Round($bounds.Height * $scale)
                $left = [int][Math]::Floor(($Width - $drawWidth) / 2)
                $top = [int][Math]::Floor(($Height - $drawHeight) / 2)
                $destination = [System.Drawing.Rectangle]::new($left, $top, $drawWidth, $drawHeight)

                $graphics.DrawImage($source, $destination, $bounds, [System.Drawing.GraphicsUnit]::Pixel)
            } finally {
                $graphics.Dispose()
            }

            $outputPath = Join-Path $projectRoot $RelativePath
            $temporaryPath = "$outputPath.tmp.png"
            $target.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Move-Item -Force $temporaryPath $outputPath
        } finally {
            $target.Dispose()
        }
    }

    Write-TransparentIcon 'assets\app-icons\icon-512.png' 512 512 0.92
    Write-TransparentIcon 'assets\app-icons\icon-192.png' 192 192 0.92
    Write-TransparentIcon 'assets\app-icons\apple-touch-icon-180.png' 180 180 0.92
    Write-TransparentIcon 'assets\app-icons\favicon-48.png' 48 48 0.92

    $densitySizes = @{
        'ldpi' = 81
        'mdpi' = 108
        'hdpi' = 162
        'xhdpi' = 216
        'xxhdpi' = 324
        'xxxhdpi' = 432
    }

    foreach ($density in $densitySizes.Keys) {
        $foregroundSize = $densitySizes[$density]
        $launcherSize = [int][Math]::Round($foregroundSize * 4 / 9)
        $directory = "android\app\src\main\res\mipmap-$density"

        Write-TransparentIcon "$directory\ic_launcher_foreground.png" $foregroundSize $foregroundSize 0.78
        Write-TransparentIcon "$directory\ic_launcher.png" $launcherSize $launcherSize 0.92
        Write-TransparentIcon "$directory\ic_launcher_round.png" $launcherSize $launcherSize 0.92
    }
} finally {
    $source.Dispose()
}

Write-Host 'Generated transparent full-logo icons from assets/app-icons/app-store-1024.png.'