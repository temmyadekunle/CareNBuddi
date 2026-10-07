# CareNBuddi Android build script (Windows)
# Produces signed, verified APKs in .\apk-output\.
# Usage:   .\build-apk.ps1            (full build)
#          .\build-apk.ps1 -SkipWeb   (reuse existing out\ web export)
param([switch]$SkipWeb)

$ErrorActionPreference = "Stop"

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$abt    = Join-Path $env:LOCALAPPDATA "Programs\android-build-tools"
$sdk    = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$android = Join-Path $root "android"
$outWeb  = Join-Path $root "out"
$assets  = Join-Path $android "app\src\main\assets"
$apks    = Join-Path $root "apk-output"

$JDK_URL  = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
$GRADLE_URL = "https://services.gradle.org/distributions/gradle-8.9-bin.zip"

New-Item -ItemType Directory -Force -Path $abt, $apks | Out-Null

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 1. Java 17
Step "Locating Java 17 (user-local, Temurin)"
function Find-Jdk {
    Get-ChildItem $abt -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
        Select-Object -First 1
}
$jdk = Find-Jdk
if (-not $jdk) {
    $zip = Join-Path $abt "temurin17.zip"
    if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 1MB) {
        Step "Downloading Temurin JDK 17 (official Adoptium endpoint)"
        & curl.exe -L --retry 3 -o $zip $JDK_URL
        if ($LASTEXITCODE -ne 0) { throw "JDK download failed" }
    }
    Step "Extracting JDK"
    Expand-Archive -Path $zip -DestinationPath $abt -Force
    $jdk = Find-Jdk
    if (-not $jdk) { throw "JDK extraction produced no bin\java.exe under $abt" }
}
$env:JAVA_HOME = $jdk.FullName
$env:Path = (Join-Path $env:JAVA_HOME "bin") + ";" + $env:Path
# cmd merges streams so PS 5.1 does not turn java's stderr into a terminating error
$javaVersion = (cmd /c "java -version 2>&1") -join "`n"
if ($javaVersion -notmatch '"17\.') { throw "Java 17 required, got: $javaVersion" }
Write-Host "    JAVA_HOME=$($env:JAVA_HOME)"

# ------------------------------------------------------------ 2. Android SDK
Step "Locating Android SDK"
if (-not (Test-Path (Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"))) {
    throw "Android SDK cmdline-tools not found at $sdk. Install Android cmdline-tools first."
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
if (-not (Test-Path (Join-Path $sdk "platforms\android-34"))) {
    Step "Installing platform android-34 via sdkmanager"
    $sm = Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"
    cmd /c "echo y| `"$sm`" platforms/android-34" | Out-Null
    if (-not (Test-Path (Join-Path $sdk "platforms\android-34"))) { throw "sdkmanager failed to install platforms/android-34" }
}
if (-not (Test-Path (Join-Path $sdk "build-tools\35.0.0"))) {
    Step "Installing build-tools 35.0.0 via sdkmanager"
    $sm = Join-Path $sdk "cmdline-tools\latest\bin\sdkmanager.bat"
    cmd /c "echo y| `"$sm`" build-tools/35.0.0" | Out-Null
    if (-not (Test-Path (Join-Path $sdk "build-tools\35.0.0"))) { throw "sdkmanager failed to install build-tools 35.0.0" }
}

# --------------------------------------------------------------- 3. Gradle
$gradlew = Join-Path $android "gradlew.bat"
if (-not (Test-Path $gradlew)) {
    Step "Bootstrapping Gradle 8.9 (official distribution) + wrapper"
    $gzip = Join-Path $abt "gradle-8.9-bin.zip"
    if (-not (Test-Path $gzip) -or (Get-Item $gzip).Length -lt 1MB) {
        Step "Downloading Gradle 8.9"
        & curl.exe -L --retry 3 -o $gzip $GRADLE_URL
        if ($LASTEXITCODE -ne 0) { throw "Gradle download failed" }
    }
    $gdir = Get-ChildItem $abt -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\gradle.bat") } | Select-Object -First 1
    if (-not $gdir) {
        Expand-Archive -Path $gzip -DestinationPath $abt -Force
        $gdir = Get-ChildItem $abt -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\gradle.bat") } | Select-Object -First 1
    }
    if (-not $gdir) { throw "Gradle extraction failed" }
    $distUrl = "file:///" + ($gzip -replace '\\', '/')
    & (Join-Path $gdir.FullName "bin\gradle.bat") -p $android wrapper --gradle-distribution-url $distUrl
    if ($LASTEXITCODE -ne 0) { throw "gradle wrapper generation failed" }
}

# ------------------------------------------------- 4. Web export (Next.js)
if (-not $SkipWeb) {
    Step "Building Next.js static export (npm run build)"
    Push-Location $root
    & npm run build
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { throw "next build failed with code $code" }
}
if (-not (Test-Path (Join-Path $outWeb "index.html"))) { throw "out\index.html missing - web export failed" }

# ------------------------------------------------- 5. Copy web assets in
Step "Syncing out\ -> android assets"
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
New-Item -ItemType Directory -Force -Path $assets | Out-Null
robocopy $outWeb $assets /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }
$global:LASTEXITCODE = 0

# ------------------------------------------------- 6. SDK path + signing key
$localProps = Join-Path $android "local.properties"
"sdk.dir=$($sdk -replace '\\','/')" | Set-Content -Path $localProps -Encoding ASCII

$ksPropsFile = Join-Path $android "keystore.properties"
$ksFile = Join-Path $android "keystore\carenbuddi.keystore"
if (-not (Test-Path $ksFile)) {
    Step "No release keystore found - generating a NEW CareNBuddi release key"
    Write-Host "    (If you have an existing release key for this app, stop and" -ForegroundColor Yellow
    Write-Host "     place it at android\keystore\carenbuddi.keystore instead.)" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path $ksFile) | Out-Null
    $pw = -join ((48..57) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    & (Join-Path $env:JAVA_HOME "bin\keytool.exe") -genkeypair `
        -keystore $ksFile -alias carenbuddi -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $pw -keypass $pw -dname "CN=CareNBuddi, O=CareNBuddi, C=NG"
    if ($LASTEXITCODE -ne 0) { throw "keytool keystore generation failed" }
    @"
storeFile=keystore/carenbuddi.keystore
storePassword=$pw
keyAlias=carenbuddi
keyPassword=$pw
"@ | Set-Content -Path $ksPropsFile -Encoding ASCII
    Write-Host "    Keystore: $ksFile" -ForegroundColor Yellow
    Write-Host "    Credentials (KEEP PRIVATE, gitignored): $ksPropsFile" -ForegroundColor Yellow
}

# ------------------------------------------------------------- 7. Build APK
Step "Running Gradle assembleRelease assembleDebug"
Push-Location $android
& .\gradlew.bat assembleRelease assembleDebug --stacktrace
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "Gradle build failed with code $code" }

# ------------------------------------------------- 8. Verify + publish APKs
Step "Verifying signatures and packaging"
$bt = Join-Path $sdk "build-tools\35.0.0"
$aapt = Join-Path $bt "aapt.exe"
if (-not (Test-Path $aapt)) { $aapt = Join-Path $bt "aapt2.exe" }
$built = @(
    @{ Src = Join-Path $android "app\build\outputs\apk\release\app-release.apk"; Dst = "CareNBuddi-1.0.0-release-signed.apk" },
    @{ Src = Join-Path $android "app\build\outputs\apk\debug\app-debug.apk";     Dst = "CareNBuddi-1.0.0-debug-signed.apk" }
)
$hashes = @()
foreach ($b in $built) {
    if (-not (Test-Path $b.Src)) { throw "Missing build output: $($b.Src)" }
    & (Join-Path $bt "apksigner.bat") verify --print-certs $b.Src | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "apksigner verify failed for $($b.Src)" }
    $dest = Join-Path $apks $b.Dst
    Copy-Item $b.Src $dest -Force
    $hash = (Get-FileHash -Algorithm SHA256 $dest).Hash.ToLower()
    $size = (Get-Item $dest).Length
    $hashes += "$hash  $($b.Dst)  ($size bytes)"
    Write-Host "    $($b.Dst): $([math]::Round($size/1MB,2)) MB  sha256=$hash"
}

Step "Badging (package / activity / versions)"
$badging = & $aapt dump badging (Join-Path $apks "CareNBuddi-1.0.0-release-signed.apk") | Out-String
$badging -split "`n" | Where-Object { $_ -match "^(package|sdkVersion|targetSdkVersion|application-label|launchable-activity)" } | ForEach-Object { "    $_".TrimEnd() }

$hashes | Set-Content -Path (Join-Path $apks "SHA256SUMS.txt") -Encoding ASCII

Write-Host ""
Write-Host "DONE. APKs in: $apks" -ForegroundColor Green
