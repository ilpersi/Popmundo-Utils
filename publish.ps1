# Pack and publish the Popmundo Utils Chrome extension to the Chrome Web Store.
#
# Credentials (env vars or .cws_credentials.json):
#   CWS_EXTENSION_ID   — Chrome Web Store extension ID
#   CWS_CLIENT_ID      — OAuth 2.0 client ID
#   CWS_CLIENT_SECRET  — OAuth 2.0 client secret
#   CWS_REFRESH_TOKEN  — long-lived refresh token
#
# Usage:
#   .\publish.ps1                          pack + upload + publish (public)
#   .\publish.ps1 -Target trustedTesters
#   .\publish.ps1 -PackOnly
#   .\publish.ps1 -PublishOnly file.zip

param(
    [switch]$PackOnly,
    [string]$PublishOnly = "",
    [ValidateSet("default", "trustedTesters")]
    [string]$Target = "default",
    [switch]$GetToken
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$CredentialsFile = ".cws_credentials.json"
$CWSTokenUrl     = "https://oauth2.googleapis.com/token"
$CWSUploadUrl    = "https://www.googleapis.com/upload/chromewebstore/v1.1/items"
$CWSPublishUrl   = "https://www.googleapis.com/chromewebstore/v1.1/items"

# ---------------------------------------------------------------------------
# Get refresh token (one-time OAuth flow)
# ---------------------------------------------------------------------------

function Get-Token {
    $clientId     = $env:CWS_CLIENT_ID
    $clientSecret = $env:CWS_CLIENT_SECRET

    if (Test-Path $CredentialsFile) {
        $file = Get-Content $CredentialsFile -Raw | ConvertFrom-Json
        if (-not $clientId)     { $clientId     = $file.client_id     }
        if (-not $clientSecret) { $clientSecret = $file.client_secret }
    }

    if (-not $clientId -or -not $clientSecret) {
        Write-Error "CWS_CLIENT_ID and CWS_CLIENT_SECRET must be set before running -GetToken."
        exit 1
    }

    $port        = 8484
    $redirectUri = "http://localhost:$port/"
    $scope       = "https://www.googleapis.com/auth/chromewebstore"

    $query = [System.Web.HttpUtility]::ParseQueryString("")
    $query["client_id"]     = $clientId
    $query["redirect_uri"]  = $redirectUri
    $query["response_type"] = "code"
    $query["scope"]         = $scope
    $query["access_type"]   = "offline"
    $query["prompt"]        = "consent"
    $authUrl = "https://accounts.google.com/o/oauth2/auth?$($query.ToString())"

    Write-Host "Opening browser for authorization..."
    Start-Process $authUrl

    Write-Host "Waiting for OAuth callback on port $port..."
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add($redirectUri)
    $listener.Start()

    $context = $listener.GetContext()
    $rawUrl  = $context.Request.RawUrl

    # Send success response to browser
    $html    = [System.Text.Encoding]::UTF8.GetBytes("<h1>Authorization complete. You may close this tab.</h1>")
    $context.Response.ContentLength64 = $html.Length
    $context.Response.OutputStream.Write($html, 0, $html.Length)
    $context.Response.Close()
    $listener.Stop()

    # Parse authorization code from query string
    $queryStr = $rawUrl.Split("?", 2)[1]
    $params   = @{}
    $queryStr.Split("&") | ForEach-Object {
        $kv = $_.Split("=", 2)
        if ($kv.Length -eq 2) { $params[$kv[0]] = [Uri]::UnescapeDataString($kv[1]) }
    }
    $code = $params["code"]

    if (-not $code) {
        Write-Error "Failed to obtain authorization code."
        exit 1
    }

    $body = @{
        client_id     = $clientId
        client_secret = $clientSecret
        code          = $code
        redirect_uri  = $redirectUri
        grant_type    = "authorization_code"
    }
    $response = Invoke-RestMethod -Method Post -Uri $CWSTokenUrl -Body $body `
        -ContentType "application/x-www-form-urlencoded"

    if (-not $response.refresh_token) {
        Write-Error "Failed to obtain refresh token: $($response | ConvertTo-Json)"
        exit 1
    }

    Write-Host ""
    Write-Host "Refresh token:"
    Write-Host "  $($response.refresh_token)"
    Write-Host ""
    Write-Host "Add it to $CredentialsFile as `"refresh_token`" or set CWS_REFRESH_TOKEN."
}

# ---------------------------------------------------------------------------
# Pack
# ---------------------------------------------------------------------------

function Invoke-Pack {
    $Manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
    $Version  = $Manifest.version
    $Output   = "popmundo-utils-v$Version.zip"

    if (Test-Path $Output) { Remove-Item $Output }

    $IncludeDirs  = @("_locales", "common", "features", "icons", "injected-js", "libs", "options")
    $IncludeFiles = @("manifest.json", "background.js")
    $ExcludeNames = @(".DS_Store", "Thumbs.db")
    $ExcludeExts  = @(".md", ".ps1", ".py", ".sh", ".zip")

    $FilesToZip = [System.Collections.Generic.List[string]]::new()

    foreach ($File in $IncludeFiles) {
        $FullPath = Join-Path $ScriptDir $File
        if (Test-Path $FullPath) { $FilesToZip.Add($FullPath) }
    }

    foreach ($Dir in $IncludeDirs) {
        $FullDir = Join-Path $ScriptDir $Dir
        if (Test-Path $FullDir) {
            Get-ChildItem -Path $FullDir -Recurse -File | Where-Object {
                $ExcludeNames -notcontains $_.Name -and
                $ExcludeExts  -notcontains $_.Extension
            } | ForEach-Object { $FilesToZip.Add($_.FullName) }
        }
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $ZipStream = [System.IO.File]::Open(
        (Join-Path $ScriptDir $Output),
        [System.IO.FileMode]::Create
    )
    $Archive = [System.IO.Compression.ZipArchive]::new(
        $ZipStream, [System.IO.Compression.ZipArchiveMode]::Create
    )

    foreach ($File in $FilesToZip) {
        $RelPath    = $File.Substring($ScriptDir.Length).TrimStart('\', '/') -replace '\\', '/'
        $Entry      = $Archive.CreateEntry($RelPath, [System.IO.Compression.CompressionLevel]::Optimal)
        $EntryStream = $Entry.Open()
        $FileStream  = [System.IO.File]::OpenRead($File)
        $FileStream.CopyTo($EntryStream)
        $FileStream.Close()
        $EntryStream.Close()
    }

    $Archive.Dispose()
    $ZipStream.Close()

    $FileCount = $FilesToZip.Count
    $SizeKB    = [math]::Round((Get-Item $Output).Length / 1KB, 1)
    Write-Host "Packed:    $Output  ($FileCount files, $SizeKB KB)"

    return Join-Path $ScriptDir $Output
}

# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------

function Get-Credentials {
    $creds = @{
        ExtensionId   = $env:CWS_EXTENSION_ID
        ClientId      = $env:CWS_CLIENT_ID
        ClientSecret  = $env:CWS_CLIENT_SECRET
        RefreshToken  = $env:CWS_REFRESH_TOKEN
    }

    if (Test-Path $CredentialsFile) {
        $file = Get-Content $CredentialsFile -Raw | ConvertFrom-Json
        if (-not $creds.ExtensionId)  { $creds.ExtensionId  = $file.extension_id  }
        if (-not $creds.ClientId)     { $creds.ClientId     = $file.client_id     }
        if (-not $creds.ClientSecret) { $creds.ClientSecret = $file.client_secret }
        if (-not $creds.RefreshToken) { $creds.RefreshToken = $file.refresh_token }
    }

    $missing = $creds.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key }
    if ($missing) {
        Write-Error "Missing credentials: $($missing -join ', '). Set env vars or create $CredentialsFile."
        exit 1
    }

    return $creds
}

# ---------------------------------------------------------------------------
# OAuth token refresh
# ---------------------------------------------------------------------------

function Get-AccessToken($creds) {
    $body = @{
        client_id     = $creds.ClientId
        client_secret = $creds.ClientSecret
        refresh_token = $creds.RefreshToken
        grant_type    = "refresh_token"
    }

    $response = Invoke-RestMethod -Method Post -Uri $CWSTokenUrl -Body $body `
        -ContentType "application/x-www-form-urlencoded"
    if (-not $response.access_token) {
        Write-Error "Failed to obtain access token: $response"
        exit 1
    }
    return $response.access_token
}

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

function Invoke-Upload($ZipPath, $AccessToken, $creds) {
    Add-Type -AssemblyName System.Net.Http

    $client = [System.Net.Http.HttpClient]::new()
    $client.DefaultRequestHeaders.Add("Authorization", "Bearer $AccessToken")
    $client.DefaultRequestHeaders.Add("x-goog-api-version", "2")

    $content = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($ZipPath))
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new("application/zip")

    $uri          = "$CWSUploadUrl/$($creds.ExtensionId)"
    Write-Host "  PUT $uri"
    $responseMsg  = $client.PutAsync($uri, $content).Result
    $responseBody = $responseMsg.Content.ReadAsStringAsync().Result
    $client.Dispose()

    try { $response = $responseBody | ConvertFrom-Json }
    catch {
        Write-Error "Upload request failed (HTTP $([int]$responseMsg.StatusCode)): $responseBody"
        exit 1
    }

    if ($response.uploadState -eq "FAILURE") {
        Write-Error "Upload failed: $($response.itemError | ConvertTo-Json)"
        exit 1
    }

    Write-Host "Uploaded:  $(Split-Path $ZipPath -Leaf)  (state: $($response.uploadState))"
}

# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

function Invoke-Publish($AccessToken, $creds) {
    $headers = @{
        "Authorization"      = "Bearer $AccessToken"
        "x-goog-api-version" = "2"
        "Content-Length"     = "0"
    }

    $response = Invoke-RestMethod -Method Post `
        -Uri "$CWSPublishUrl/$($creds.ExtensionId)/publish?publishTarget=$Target" `
        -Headers $headers `
        -Body ""

    if ($response.status -contains "OK") {
        Write-Host "Published: target=$Target"
    } else {
        Write-Host "Publish response: $($response | ConvertTo-Json)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if ($GetToken) {
    Get-Token
    exit 0
}

if ($PublishOnly) {
    $ZipPath = Resolve-Path $PublishOnly
    if (-not (Test-Path $ZipPath)) {
        Write-Error "File not found: $PublishOnly"
        exit 1
    }
} else {
    $ZipPath = Invoke-Pack
}

if ($PackOnly) { exit 0 }

$Creds = Get-Credentials

Write-Host "Authenticating..."
$AccessToken = Get-AccessToken $Creds

Write-Host "Uploading..."
Invoke-Upload $ZipPath $AccessToken $Creds

Write-Host "Publishing..."
Invoke-Publish $AccessToken $Creds
