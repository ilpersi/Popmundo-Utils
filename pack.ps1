# Pack the Popmundo Utils Chrome extension into a zip archive for store publishing.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Derive version from manifest.json
$Manifest = Get-Content "manifest.json" -Raw | ConvertFrom-Json
$Version = $Manifest.version
$Output = "popmundo-utils-v$Version.zip"

if (Test-Path $Output) {
    Remove-Item $Output
}

$IncludeDirs = @("_locales", "common", "features", "icons", "injected-js", "libs", "options")
$IncludeFiles = @("manifest.json", "background.js")

$ExcludeNames = @(".DS_Store", "Thumbs.db")
$ExcludeExts = @(".md", ".ps1", ".py", ".sh", ".zip")

$FilesToZip = [System.Collections.Generic.List[string]]::new()

foreach ($File in $IncludeFiles) {
    $FullPath = Join-Path $ScriptDir $File
    if (Test-Path $FullPath) {
        $FilesToZip.Add($FullPath)
    }
}

foreach ($Dir in $IncludeDirs) {
    $FullDir = Join-Path $ScriptDir $Dir
    if (Test-Path $FullDir) {
        Get-ChildItem -Path $FullDir -Recurse -File | Where-Object {
            $ExcludeNames -notcontains $_.Name -and
            $ExcludeExts -notcontains $_.Extension
        } | ForEach-Object { $FilesToZip.Add($_.FullName) }
    }
}

# Build zip with paths relative to $ScriptDir
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ZipStream = [System.IO.File]::Open(
    (Join-Path $ScriptDir $Output),
    [System.IO.FileMode]::Create
)
$Archive = [System.IO.Compression.ZipArchive]::new($ZipStream, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($File in $FilesToZip) {
    $RelPath = [System.IO.Path]::GetRelativePath($ScriptDir, $File) -replace '\\', '/'
    $Entry = $Archive.CreateEntry($RelPath, [System.IO.Compression.CompressionLevel]::Optimal)
    $EntryStream = $Entry.Open()
    $FileStream = [System.IO.File]::OpenRead($File)
    $FileStream.CopyTo($EntryStream)
    $FileStream.Close()
    $EntryStream.Close()
}

$Archive.Dispose()
$ZipStream.Close()

$FileCount = $FilesToZip.Count
$SizeKB = [math]::Round((Get-Item $Output).Length / 1KB, 1)
Write-Host "Created $Output  ($FileCount files, $SizeKB KB)"
