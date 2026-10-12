$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$keystore = Join-Path $HOME 'bible-encyclopedia-upload-2026-10.jks'
$javaHome = Join-Path $env:LOCALAPPDATA 'Programs\Temurin21\jdk-21.0.12.1+1'
$androidHome = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

if (-not (Test-Path $keystore)) { throw "Upload keystore not found: $keystore" }
if (-not (Test-Path (Join-Path $javaHome 'bin\java.exe'))) { throw "JDK 21 not found: $javaHome" }
if (-not (Test-Path $androidHome)) { throw "Android SDK not found: $androidHome" }

$secureStorePassword = Read-Host 'Enter the upload keystore password' -AsSecureString
$storePasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureStorePassword)
$keyPasswordPointer = [IntPtr]::Zero

try {
    $storePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($storePasswordPointer)
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $androidHome
    $env:BIBLE_RELEASE_STORE_FILE = $keystore
    $env:BIBLE_RELEASE_STORE_PASSWORD = $storePassword
    $env:BIBLE_RELEASE_KEY_ALIAS = 'bible-upload-2026-10'

    $keytoolOutput = & (Join-Path $javaHome 'bin\keytool.exe') -list -keystore $keystore -alias 'bible-upload-2026-10' -storepass:env BIBLE_RELEASE_STORE_PASSWORD 2>&1
    if ($LASTEXITCODE -ne 0) {
        $keytoolDetail = ($keytoolOutput | Out-String).Trim()
        throw "Unable to unlock the upload keystore. keytool reported: $keytoolDetail"
    }

    $secureKeyPassword = Read-Host 'Enter the upload key password (press Enter to reuse the keystore password)' -AsSecureString
    $keyPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKeyPassword)
    $keyPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPasswordPointer)
    if ([string]::IsNullOrEmpty($keyPassword)) { $keyPassword = $storePassword }
    $env:BIBLE_RELEASE_KEY_PASSWORD = $keyPassword

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
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($storePasswordPointer)
    if ($keyPasswordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPasswordPointer)
    }
    Remove-Variable storePassword -ErrorAction SilentlyContinue
    Remove-Variable keyPassword -ErrorAction SilentlyContinue
    Remove-Item Env:BIBLE_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:BIBLE_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

$bundle = Join-Path $projectRoot 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $bundle)) { throw "Release bundle was not created: $bundle" }
Write-Host "Google Play bundle created: $bundle"