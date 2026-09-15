$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$keystore = Join-Path $HOME 'bible-encyclopedia-upload.jks'
$javaHome = Join-Path $env:LOCALAPPDATA 'Programs\Temurin21\jdk-21.0.12.1+1'
$androidHome = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

if (-not (Test-Path $keystore)) { throw "Upload keystore not found: $keystore" }
if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) { throw "JDK 21 not found: $javaHome" }
if (-not (Test-Path $androidHome)) { throw "Android SDK not found: $androidHome" }

$securePassword = Read-Host 'Enter the upload keystore password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $androidHome
    $env:BIBLE_RELEASE_STORE_FILE = $keystore
    $env:BIBLE_RELEASE_STORE_PASSWORD = $password
    $env:BIBLE_RELEASE_KEY_ALIAS = 'bible-upload'
    $env:BIBLE_RELEASE_KEY_PASSWORD = $password

    Push-Location $projectRoot
    try {
        & npm.cmd run build:web
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
        & npx.cmd cap sync android
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
        & (Join-Path $projectRoot 'android\gradlew.bat') -p (Join-Path $projectRoot 'android') bundleRelease --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
    } finally {
        Pop-Location
    }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    Remove-Variable password -ErrorAction SilentlyContinue
    Remove-Item Env:BIBLE_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:BIBLE_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

$bundle = Join-Path $projectRoot 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $bundle)) { throw "Release bundle was not created: $bundle" }
Write-Host "Google Play bundle created: $bundle"