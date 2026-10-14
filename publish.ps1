# Pack and publish the Popmundo Utils extension to the Chrome Web Store and to
# addons.mozilla.org (AMO, Firefox).
#
# Use -Target chrome|firefox|all (default: all) to choose the store. With
# "all", Firefox is skipped with a warning when no AMO credentials are
# configured, and a failure on one store does not prevent the other from being
# attempted.
#
# Chrome Web Store: uses the Chrome Web Store API v2 (the v1.1 API is retired
# 2026-10-15). Publish visibility (public vs. trusted testers) is no longer
# settable via the API - it must be configured once in the Developer Dashboard
# under Publisher > Distribution settings; Invoke-Publish always uses whatever
# is set there.
#
# AMO (Firefox): uses the AMO v5 API. Only NEW VERSIONS of an existing listing
# can be published: the very first listing must be created by hand in the AMO
# developer hub. The version is submitted to the listed channel and enters
# review, like on the Chrome Web Store. -SkipReview has no AMO equivalent and
# is ignored for Firefox.
#
# Chrome Web Store credentials (env vars or .cws_credentials.json):
#   CWS_EXTENSION_ID   — Chrome Web Store extension ID
#   CWS_PUBLISHER_ID   — publisher ID, from Developer Dashboard > Publisher > Settings
#   CWS_CLIENT_ID      — OAuth 2.0 client ID
#   CWS_CLIENT_SECRET  — OAuth 2.0 client secret
#   CWS_REFRESH_TOKEN  — long-lived refresh token
#
# AMO credentials (env vars or .amo_credentials.json, keys: jwt_issuer, jwt_secret, addon_id):
#   AMO_JWT_ISSUER     — API key ("JWT issuer"), from
#                        https://addons.mozilla.org/developers/addon/api/key/
#   AMO_JWT_SECRET     — API secret ("JWT secret"), from the same page
#   AMO_ADDON_ID       — optional; add-on id or slug. Defaults to the gecko id in manifest.json
#
# Usage:
#   .\publish.ps1                          pack + upload + publish to both stores
#   .\publish.ps1 -Target firefox          only AMO (-Target chrome: only the Chrome Web Store)
#   .\publish.ps1 -PackOnly
#   .\publish.ps1 -PublishOnly file.zip
#   .\publish.ps1 -GetStatus
#   .\publish.ps1 -SkipReview              publish with skipReview=true (Chrome only)
#   .\publish.ps1 -ReleaseNotes "text"     release notes for the AMO version (Firefox only)

param(
    [switch]$PackOnly,
    [string]$PublishOnly = "",
    [switch]$GetToken,
    [switch]$GetStatus,
    [switch]$SkipReview,
    [ValidateSet("chrome", "firefox", "all")]
    [string]$Target = "all",
    [string]$ReleaseNotes = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$CredentialsFile = ".cws_credentials.json"
$CWSTokenUrl     = "https://oauth2.googleapis.com/token"
$CWSApiBase      = "https://chromewebstore.googleapis.com/v2"
$CWSUploadBase   = "https://chromewebstore.googleapis.com/upload/v2"

$AmoCredentialsFile      = ".amo_credentials.json"
$AmoApiBase              = "https://addons.mozilla.org/api/v5"
$AmoPollIntervalSeconds  = 3
$AmoPollTimeoutSeconds   = 300

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

    if (Test-Path $CredentialsFile) {
        try {
            $existing = Get-Content $CredentialsFile -Raw | ConvertFrom-Json
            if ($existing.PSObject.Properties.Name -contains "refresh_token") {
                $existing.refresh_token = $response.refresh_token
            } else {
                $existing | Add-Member -MemberType NoteProperty -Name "refresh_token" -Value $response.refresh_token
            }
            ($existing | ConvertTo-Json -Depth 10) | Set-Content -Path $CredentialsFile -Encoding UTF8
            Write-Host "Updated $CredentialsFile with the new refresh_token."
        } catch {
            Write-Host "Failed to update ${CredentialsFile}: $_"
            Write-Host "Copy the token above into $CredentialsFile manually."
        }
    } else {
        Write-Host "Add it to $CredentialsFile as `"refresh_token`" or set CWS_REFRESH_TOKEN."
    }
}

# ---------------------------------------------------------------------------
# Pack
# ---------------------------------------------------------------------------

function Invoke-Pack {
    $Manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
    $Version  = $Manifest.version
    $Output   = "popmundo-utils-v$Version.zip"

    if (Test-Path $Output) { Remove-Item $Output }

    $IncludeDirs  = @("_locales", "common", "features", "icons", "libs", "options")
    $IncludeFiles = @("manifest.json", "background.js")
    $ExcludeNames = @(".DS_Store", "Thumbs.db", ".cws_credentials.json", ".amo_credentials.json")
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
        PublisherId   = $env:CWS_PUBLISHER_ID
        ClientId      = $env:CWS_CLIENT_ID
        ClientSecret  = $env:CWS_CLIENT_SECRET
        RefreshToken  = $env:CWS_REFRESH_TOKEN
    }

    if (Test-Path $CredentialsFile) {
        $file = Get-Content $CredentialsFile -Raw | ConvertFrom-Json
        if (-not $creds.ExtensionId)  { $creds.ExtensionId  = $file.extension_id  }
        if (-not $creds.PublisherId)  { $creds.PublisherId  = $file.publisher_id  }
        if (-not $creds.ClientId)     { $creds.ClientId     = $file.client_id     }
        if (-not $creds.ClientSecret) { $creds.ClientSecret = $file.client_secret }
        if (-not $creds.RefreshToken) { $creds.RefreshToken = $file.refresh_token }
    }

    $missing = $creds.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key }
    if ($missing) {
        Write-Error "Missing credentials: $($missing -join ', '). Set env vars or create $CredentialsFile."
        exit 1
    }

    $creds.ItemResource = "publishers/$($creds.PublisherId)/items/$($creds.ExtensionId)"

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

    $content = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($ZipPath))

    $uri          = "$CWSUploadBase/$($creds.ItemResource):upload"
    Write-Host "  POST $uri"
    $responseMsg  = $client.PostAsync($uri, $content).Result
    $responseBody = $responseMsg.Content.ReadAsStringAsync().Result
    $client.Dispose()

    try { $response = $responseBody | ConvertFrom-Json }
    catch {
        Write-Error "Upload request failed (HTTP $([int]$responseMsg.StatusCode)): $responseBody"
        exit 1
    }

    if (-not $responseMsg.IsSuccessStatusCode -or $response.uploadState -eq "FAILED") {
        Write-Error "Upload failed (HTTP $([int]$responseMsg.StatusCode)): $responseBody"
        exit 1
    }

    Write-Host "Uploaded:  $(Split-Path $ZipPath -Leaf)  (state: $($response.uploadState))"
}

# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

function Invoke-Publish($AccessToken, $creds) {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
    }

    $request = @{
        Method  = "Post"
        Uri     = "$CWSApiBase/$($creds.ItemResource):publish"
        Headers = $headers
    }
    if ($SkipReview) {
        $request.ContentType = "application/json"
        $request.Body        = '{"skipReview":true}'
    }

    try {
        $response = Invoke-RestMethod @request
    } catch {
        $Raw        = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        $HttpStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $Lines      = @()
        $ErrStatus  = ""

        try {
            $err = ($Raw | ConvertFrom-Json).error
            if ($err) {
                $ErrStatus = "$($err.status)"
                $Tag = if ($ErrStatus) { " [$ErrStatus]" } else { "" }
                $Lines += "Publish failed (HTTP $HttpStatus)${Tag}: $($err.message)"
                foreach ($d in @($err.details)) {
                    foreach ($v in @($d.fieldViolations)) {
                        if ($v) { $Lines += "  - $($v.field): $($v.description)" }
                    }
                    if ($d.reason) { $Lines += "  - reason: $($d.reason)" }
                }
            }
        } catch { }

        if (-not $Lines) { $Lines += "Publish failed (HTTP $HttpStatus): $Raw" }

        if ($SkipReview -and ($ErrStatus -in @("INVALID_ARGUMENT", "FAILED_PRECONDITION") -or $HttpStatus -in @(400, 412))) {
            $Lines += "skipReview was requested but could not be honored; re-run without -SkipReview to submit for normal review."
        }

        Write-Error ($Lines -join [Environment]::NewLine)
        exit 1
    }

    $Extra = ""
    if ($response.warningInfo.warnings) {
        $Extra = " warnings=$($response.warningInfo.warnings | ConvertTo-Json -Compress)"
    }

    Write-Host "Published: state=$($response.state)$Extra"
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

function Format-DistributionChannels($Revision) {
    if (-not $Revision.distributionChannels -or $Revision.distributionChannels.Count -eq 0) {
        return "no distribution channels"
    }
    $Parts = $Revision.distributionChannels | ForEach-Object {
        "crxVersion=$($_.crxVersion) deployPercentage=$($_.deployPercentage)"
    }
    return ($Parts -join ", ")
}

function Get-Status($AccessToken, $creds) {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
    }

    try {
        $response = Invoke-RestMethod -Method Get `
            -Uri "$CWSApiBase/$($creds.ItemResource):fetchStatus" `
            -Headers $headers
    } catch {
        $Detail = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        Write-Host "Status: request failed - $Detail"
        return
    }

    Write-Host "Status: lastAsyncUploadState=$($response.lastAsyncUploadState) takenDown=$($response.takenDown) warned=$($response.warned)"

    if ($response.publishedItemRevisionStatus) {
        $Published = $response.publishedItemRevisionStatus
        Write-Host "Status (published): state=$($Published.state) $(Format-DistributionChannels $Published)"
    } else {
        Write-Host "Status (published): none"
    }

    if ($response.submittedItemRevisionStatus) {
        $Submitted = $response.submittedItemRevisionStatus
        Write-Host "Status (submitted): state=$($Submitted.state) $(Format-DistributionChannels $Submitted)"
    } else {
        Write-Host "Status (submitted): none"
    }
}

# ---------------------------------------------------------------------------
# AMO (addons.mozilla.org) operations
# ---------------------------------------------------------------------------

function ConvertTo-Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# Short-lived HS256 JWT, as the AMO API expects. A new one is built for every call.
function New-AmoJwt($AmoCreds) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $headerJson  = '{"alg":"HS256","typ":"JWT"}'
    $payloadJson = [ordered]@{
        iss = $AmoCreds.JwtIssuer
        jti = [Guid]::NewGuid().ToString()
        iat = $now
        exp = $now + 240   # AMO accepts at most 5 minutes
    } | ConvertTo-Json -Compress

    $signingInput = "$(ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($headerJson))).$(ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson)))"

    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($AmoCreds.JwtSecret))
    try {
        $signature = $hmac.ComputeHash([Text.Encoding]::ASCII.GetBytes($signingInput))
    } finally {
        $hmac.Dispose()
    }
    return "$signingInput.$(ConvertTo-Base64Url $signature)"
}

# Returns $null (with the reason in $script:AmoCredentialsError) when the AMO credentials are incomplete.
function Get-AmoCredentials {
    $creds = @{
        JwtIssuer = $env:AMO_JWT_ISSUER
        JwtSecret = $env:AMO_JWT_SECRET
        AddonId   = $env:AMO_ADDON_ID
    }

    if (Test-Path $AmoCredentialsFile) {
        $file = Get-Content $AmoCredentialsFile -Raw | ConvertFrom-Json
        if (-not $creds.JwtIssuer) { $creds.JwtIssuer = $file.jwt_issuer }
        if (-not $creds.JwtSecret) { $creds.JwtSecret = $file.jwt_secret }
        if (-not $creds.AddonId)   { $creds.AddonId   = $file.addon_id   }
    }

    if (-not $creds.AddonId) {
        $manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
        $creds.AddonId = $manifest.browser_specific_settings.gecko.id
    }

    $missing = @()
    if (-not $creds.JwtIssuer) { $missing += "AMO_JWT_ISSUER" }
    if (-not $creds.JwtSecret) { $missing += "AMO_JWT_SECRET" }
    if (-not $creds.AddonId)   { $missing += "AMO_ADDON_ID" }

    if ($missing) {
        $script:AmoCredentialsError = "Missing AMO credentials: $($missing -join ', '). Set env vars or create $AmoCredentialsFile (keys from https://addons.mozilla.org/developers/addon/api/key/)."
        return $null
    }

    $creds.AddonPath = [Uri]::EscapeDataString($creds.AddonId)
    return $creds
}

function Get-HttpErrorText($ErrorRecord) {
    $raw  = if ($ErrorRecord.ErrorDetails.Message) { $ErrorRecord.ErrorDetails.Message } else { $ErrorRecord.Exception.Message }
    $http = if ($ErrorRecord.Exception.Response) { [int]$ErrorRecord.Exception.Response.StatusCode } else { 0 }
    return "HTTP ${http}: $raw"
}

function Invoke-AmoJson($Method, $Uri, $AmoCreds, $Body = $null) {
    $request = @{
        Method  = $Method
        Uri     = $Uri
        Headers = @{ "Authorization" = "JWT $(New-AmoJwt $AmoCreds)" }
    }
    if ($null -ne $Body) {
        $request.ContentType = "application/json"
        $request.Body        = $Body | ConvertTo-Json -Depth 5 -Compress
    }
    return Invoke-RestMethod @request
}

# Uploads the zip to AMO, waits for the validation and returns the upload uuid.
function Invoke-AmoUpload($ZipPath, $AmoCreds) {
    Add-Type -AssemblyName System.Net.Http

    $client  = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMinutes(2)
    $form    = [System.Net.Http.MultipartFormDataContent]::new()
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$AmoApiBase/addons/upload/")
    try {
        $form.Add([System.Net.Http.StringContent]::new("listed"), "channel")
        $file = [System.Net.Http.ByteArrayContent]::new([System.IO.File]::ReadAllBytes($ZipPath))
        $file.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/zip")
        $form.Add($file, "upload", (Split-Path $ZipPath -Leaf))

        $request.Headers.Add("Authorization", "JWT $(New-AmoJwt $AmoCreds)")
        $request.Content = $form

        $responseMsg  = $client.SendAsync($request).Result
        $responseBody = $responseMsg.Content.ReadAsStringAsync().Result
    } finally {
        $request.Dispose()
        $client.Dispose()
    }

    if (-not $responseMsg.IsSuccessStatusCode) {
        throw "AMO upload failed (HTTP $([int]$responseMsg.StatusCode)): $responseBody"
    }

    $uploadUuid = ($responseBody | ConvertFrom-Json).uuid
    if (-not $uploadUuid) {
        throw "AMO upload failed: no upload uuid in the answer: $responseBody"
    }
    Write-Host "Uploaded:  $(Split-Path $ZipPath -Leaf)  (upload $uploadUuid), waiting for AMO validation..."

    $deadline = (Get-Date).AddSeconds($AmoPollTimeoutSeconds)
    while ($true) {
        try {
            $upload = Invoke-AmoJson "Get" "$AmoApiBase/addons/upload/$uploadUuid/" $AmoCreds
        } catch {
            throw "AMO validation check failed ($(Get-HttpErrorText $_))"
        }

        if ($upload.processed) { break }

        if ((Get-Date) -gt $deadline) {
            throw "AMO validation did not finish in time; check the developer hub and retry."
        }
        Start-Sleep -Seconds $AmoPollIntervalSeconds
    }

    if (-not $upload.valid) {
        $Lines = @("AMO validation failed:")
        $messages = @($upload.validation.messages)
        if ($messages.Count -eq 0 -or -not $messages[0]) {
            $Lines += "  $($upload | ConvertTo-Json -Depth 5 -Compress)"
        } else {
            foreach ($m in $messages) { $Lines += "  - [$($m.type)] $($m.message)" }
        }
        throw ($Lines -join [Environment]::NewLine)
    }

    Write-Host "Validated: AMO accepted the package"
    return $uploadUuid
}

# Creates a new listed version of the add-on from a validated upload.
function Invoke-AmoPublish($UploadUuid, $AmoCreds) {
    $body = @{ upload = $UploadUuid }
    if ($ReleaseNotes) { $body.release_notes = @{ "en-US" = $ReleaseNotes } }

    try {
        $version = Invoke-AmoJson "Post" "$AmoApiBase/addons/addon/$($AmoCreds.AddonPath)/versions/" $AmoCreds $body
    } catch {
        $Text = Get-HttpErrorText $_
        $Hint = if ($Text -like "HTTP 404*") { "$([Environment]::NewLine)The add-on was not found: the first listing must be created by hand in the AMO developer hub." } else { "" }
        throw "AMO publish failed ($Text)$Hint"
    }

    $FileStatus = if ($version.file.status) { $version.file.status } else { "unknown" }
    Write-Host "Published: AMO version=$($version.version) file status=$FileStatus (submitted for review)"
}

function Get-AmoStatus($AmoCreds) {
    try {
        $addon = Invoke-AmoJson "Get" "$AmoApiBase/addons/addon/$($AmoCreds.AddonPath)/" $AmoCreds
    } catch {
        Write-Host "AMO status: request failed - $(Get-HttpErrorText $_)"
        return
    }

    $CurrentVersion = if ($addon.current_version.version) { $addon.current_version.version } else { "none" }
    $CurrentStatus  = if ($addon.current_version.file.status) { $addon.current_version.file.status } else { "unknown" }
    Write-Host "AMO status: addon status=$($addon.status) current version=$CurrentVersion file status=$CurrentStatus"

    try {
        $versions = Invoke-AmoJson "Get" "$AmoApiBase/addons/addon/$($AmoCreds.AddonPath)/versions/?filter=all_with_unlisted&page_size=3" $AmoCreds
    } catch {
        Write-Host "AMO versions: request failed - $(Get-HttpErrorText $_)"
        return
    }

    foreach ($v in @($versions.results)) {
        if (-not $v) { continue }
        $VStatus = if ($v.file.status) { $v.file.status } else { "unknown" }
        Write-Host "AMO version $($v.version): channel=$($v.channel) file status=$VStatus"
    }
}

# ---------------------------------------------------------------------------
# Per-store steps
# ---------------------------------------------------------------------------

# Runs one store's steps. The helpers stop with an error on failure: that is recorded so the other store still gets attempted.
$Results = [ordered]@{}
function Invoke-Store($Name, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "== $Name =="
    try {
        & $Action
        $script:Results[$Name] = "ok"
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        $script:Results[$Name] = "failed"
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if ($GetToken) {
    Get-Token
    exit 0
}

$WantChrome  = $Target -in @("chrome", "all")
$WantFirefox = $Target -in @("firefox", "all")

# Credentials are checked before packing/uploading anything. A store that is explicitly requested must have them,
# with "all" Firefox is optional so that Chrome-only setups keep working.
$AmoCreds = $null
if ($WantFirefox -and -not $PackOnly) {
    $AmoCreds = Get-AmoCredentials
    if (-not $AmoCreds) {
        if ($Target -eq "firefox") {
            Write-Error $script:AmoCredentialsError
            exit 1
        }
        Write-Host "Skipping Firefox: $script:AmoCredentialsError"
    }
}

if ($GetStatus) {
    if ($WantChrome) {
        Invoke-Store "Chrome Web Store" {
            $Creds = Get-Credentials
            Write-Host "Authenticating..."
            $AccessToken = Get-AccessToken $Creds
            Get-Status $AccessToken $Creds
        }
    }
    if ($AmoCreds) { Invoke-Store "AMO" { Get-AmoStatus $AmoCreds } }
    if ($Results.Values -contains "failed") { exit 1 }
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

if ($SkipReview -and $AmoCreds) {
    Write-Host "Note: -SkipReview only applies to the Chrome Web Store."
}

if ($WantChrome) {
    Invoke-Store "Chrome Web Store" {
        $Creds = Get-Credentials

        Write-Host "Authenticating..."
        $AccessToken = Get-AccessToken $Creds

        Write-Host "Uploading..."
        Invoke-Upload $ZipPath $AccessToken $Creds

        Write-Host $(if ($SkipReview) { "Publishing (skipReview=true)..." } else { "Publishing..." })
        Invoke-Publish $AccessToken $Creds
    }
}

if ($AmoCreds) {
    Invoke-Store "AMO" {
        Write-Host "Uploading..."
        $UploadUuid = Invoke-AmoUpload $ZipPath $AmoCreds

        Write-Host "Publishing..."
        Invoke-AmoPublish $UploadUuid $AmoCreds
    }
}

Write-Host ""
Write-Host ("Summary: " + (($Results.GetEnumerator() | ForEach-Object { "$($_.Key): $($_.Value)" }) -join ", "))
if ($Results.Values -contains "failed") { exit 1 }
exit 0
