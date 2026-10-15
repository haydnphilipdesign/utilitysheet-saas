#requires -Version 5.1
<#
Read-only overview of this repository's worktrees and the open tasks in each.
It never writes files and never changes Git state.

  powershell -NoProfile -File .ai/tools/status.ps1             # from anywhere in the repo
  powershell -NoProfile -File .ai/tools/status.ps1 -All        # include done/dropped tasks
  & .ai/tools/status.ps1 -ProjectPath C:\path\to\project
#>
[CmdletBinding()]
param(
    [string]$ProjectPath = (Get-Location).Path,
    [switch]$All
)
$ErrorActionPreference = 'Stop'
# Closed statuses, including the older v2 names so their task files read correctly.
$closed = @('done', 'dropped', 'completed', 'released', 'abandoned', 'relinquished', 'archived')

function Invoke-Git([string]$dir, [string[]]$gitArgs) {
    $ErrorActionPreference = 'Continue'
    $out = & git -C $dir @gitArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return }
    $out
}

function Get-Worktrees([string]$root) {
    $list = @(); $cur = $null
    foreach ($line in @(Invoke-Git $root @('worktree', 'list', '--porcelain')) + @('')) {
        if ($line -eq '') { if ($cur) { $list += [pscustomobject]$cur; $cur = $null }; continue }
        $key, $value = $line -split ' ', 2
        if ($key -eq 'worktree') {
            $cur = [ordered]@{ Path = [IO.Path]::GetFullPath($value); Branch = ''; Head = ''; Detached = $false; Bare = $false; Locked = $false }
        }
        elseif (-not $cur) { continue }
        elseif ($key -eq 'branch') { $cur.Branch = $value -replace '^refs/heads/', '' }
        elseif ($key -eq 'HEAD') { $cur.Head = $value }
        elseif ($key -eq 'detached') { $cur.Detached = $true }
        elseif ($key -eq 'bare') { $cur.Bare = $true }
        elseif ($key -eq 'locked') { $cur.Locked = $true }
    }
    $list
}

function Get-BaseBranch([string]$root, $worktrees) {
    $candidates = @()
    $remoteHead = Invoke-Git $root @('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD')
    if ($remoteHead) { $candidates += ($remoteHead -replace '^origin/', ''); $candidates += $remoteHead }
    $candidates += @('main', 'master')
    if ($worktrees.Count -gt 0 -and $worktrees[0].Branch) { $candidates += $worktrees[0].Branch }
    foreach ($c in $candidates) {
        if (Invoke-Git $root @('rev-parse', '--verify', '--quiet', ($c + '^{commit}'))) { return $c }
    }
}

function Read-Tasks([string]$dir, [string]$label) {
    $taskDir = Join-Path $dir '.ai\tasks'
    if (-not (Test-Path -LiteralPath $taskDir -PathType Container)) { return }
    foreach ($f in Get-ChildItem -LiteralPath $taskDir -Filter '*.md' -File) {
        if ($f.Name -eq 'README.md') { continue }
        $text = [IO.File]::ReadAllText($f.FullName)
        $fm = @{}
        $m = [regex]::Match($text, '\A---\r?\n(.*?)\r?\n---', 'Singleline')
        if ($m.Success) {
            foreach ($l in ($m.Groups[1].Value -split '\r?\n')) {
                if ($l -match '^\s*([A-Za-z_-]+)\s*:\s*(.*?)\s*$') { $fm[$Matches[1].ToLowerInvariant()] = $Matches[2] }
            }
        }
        # Fall back to the generated block written by the v2 helper.
        $owner = $fm['owner']
        if (-not $owner) { $o = [regex]::Match($text, '(?m)^- Owner/session:\s*(.+?)\s*/'); if ($o.Success) { $owner = $o.Groups[1].Value } }
        $scope = $fm['scope']
        if (-not $scope) { $s = [regex]::Match($text, '(?m)^- Files/directories:\s*(.+?)\s*$'); if ($s.Success) { $scope = $s.Groups[1].Value } }
        $status = if ($fm['status']) { $fm['status'].ToLowerInvariant() } else { 'unknown' }
        $updated = [DateTime]::MinValue
        if ($fm['updated']) {
            $parsed = [DateTime]::MinValue
            if ([DateTime]::TryParse($fm['updated'], [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeLocal, [ref]$parsed)) { $updated = $parsed }
        }
        [pscustomobject]@{
            Id = $f.BaseName; Title = ([regex]::Match($text, '(?m)^#\s+(?:Task:\s*)?(.+?)\s*$')).Groups[1].Value
            Status = $status; Owner = $owner; Scope = $scope; UpdatedText = $fm['updated']; Updated = $updated
            WrittenUtc = $f.LastWriteTimeUtc; Worktree = $label; Folder = $dir
        }
    }
}

function Split-Scope([string]$scope) {
    if (-not $scope) { return }
    foreach ($p in ($scope -split ',')) {
        $v = $p.Trim().Trim('`').Replace('\', '/').Trim('/').ToLowerInvariant()
        if ($v.StartsWith('./')) { $v = $v.Substring(2) }
        if ($v) { $v }
    }
}

function Get-Overlap($a, $b) {
    foreach ($x in @(Split-Scope $a)) {
        foreach ($y in @(Split-Scope $b)) {
            if ($x -eq '.' -or $y -eq '.' -or $x -eq $y -or $x.StartsWith($y + '/') -or $y.StartsWith($x + '/')) {
                if ($x -eq $y) { return $x } else { return "$x / $y" }
            }
        }
    }
}

$start = (Get-Item -LiteralPath $ProjectPath).FullName
$top = Invoke-Git $start @('rev-parse', '--show-toplevel')
$tasks = @()
$out = New-Object System.Collections.Generic.List[string]

if (-not $top) {
    $out.Add("Not a Git repository; showing tasks in $start only.")
    $tasks = @(Read-Tasks $start '.')
}
else {
    $root = [IO.Path]::GetFullPath(($top | Select-Object -First 1).Trim())
    $worktrees = @(Get-Worktrees $root | Where-Object { -not $_.Bare })
    $base = Get-BaseBranch $root $worktrees
    $baseText = if ($base) { $base } else { 'none found' }
    $out.Add("Repository: $root   (merge checks against: $baseText)")
    $out.Add('')
    $out.Add("Worktrees ($($worktrees.Count)):")
    $infos = @()
    $i = 0
    foreach ($wt in $worktrees) {
        $i++
        $label = if ($wt.Branch) { $wt.Branch } elseif ($wt.Head) { 'detached@' + $wt.Head.Substring(0, [Math]::Min(7, $wt.Head.Length)) } else { 'unknown' }
        $here = if ($wt.Path -eq $root) { '  <- you are here' } else { '' }
        $out.Add("  [$i] $label  $($wt.Path)$here")
        if (-not (Test-Path -LiteralPath $wt.Path -PathType Container)) {
            $out.Add('      folder is missing; clean up with: git worktree prune')
            continue
        }
        $wtTasks = @(Read-Tasks $wt.Path $label)
        $tasks += $wtTasks
        $changed = @(Invoke-Git $wt.Path @('status', '--porcelain', '--untracked-files=all') | ForEach-Object { $_.Substring(3).Trim('"') })
        # Instruction/kit files only; task, plan, decision, evidence and history notes count as real work.
        $kitOnly = @($changed | Where-Object {
                ($_ -match '^(AGENTS\.md|CLAUDE\.md|\.ai/)' -and $_ -notmatch '^\.ai/(tasks|plans|decisions|evidence|history)/') -or
                ($_ -match '^\.ai/(tasks|plans|decisions)/README\.md$')
            })
        $dirty = $changed.Count
        $real = $dirty - $kitOnly.Count
        $age = Invoke-Git $wt.Path @('log', '-1', '--format=%cr')
        $unmerged = $null
        if ($base -and $wt.Head -and $age) {
            $count = Invoke-Git $root @('rev-list', '--count', ($base + '..' + $wt.Head))
            if ($null -ne $count) { $unmerged = [int]$count }
        }
        $parts = @()
        $parts += if ($dirty -eq 0) { 'clean' } elseif ($real -eq 0) { "only coordination files changed ($dirty)" } elseif ($kitOnly.Count -gt 0) { "$real uncommitted change(s) plus $($kitOnly.Count) in coordination files" } else { "$dirty uncommitted change(s)" }
        if ($null -ne $unmerged -and $i -gt 1) { $parts += if ($unmerged -eq 0) { "nothing unmerged" } else { "$unmerged commit(s) not in $base" } }
        if ($age) { $parts += "last commit $age" } else { $parts += 'no commits yet' }
        if ($wt.Locked) { $parts += 'locked' }
        $out.Add('      ' + ($parts -join '; '))
        $infos += [pscustomobject]@{ Index = $i; Wt = $wt; Label = $label; Dirty = $dirty; Real = $real; Unmerged = $unmerged }
    }
}

# The same task file can appear in several worktrees (inherited when a branch was
# created). Show the most recently updated copy only.
$tasks = @($tasks | Group-Object { $_.Id.ToLowerInvariant() } | ForEach-Object {
        $_.Group | Sort-Object -Property @{ Expression = 'Updated'; Descending = $true }, @{ Expression = 'WrittenUtc'; Descending = $true } | Select-Object -First 1
    })
$open = @($tasks | Where-Object { $_.Status -notin $closed } | Sort-Object Worktree, Id)
$shown = if ($All) { @($tasks | Sort-Object Worktree, Id) } else { $open }

if ($top) {
    # Worktrees with nothing to lose are worth pointing out; removing them is the user's call.
    $removable = @($infos | Where-Object {
            $info = $_
            $info.Index -gt 1 -and $info.Real -eq 0 -and $info.Unmerged -eq 0 -and -not $info.Wt.Locked -and
            @($open | Where-Object { $_.Folder -eq $info.Wt.Path }).Count -eq 0
        })
    if ($removable.Count -gt 0) {
        $out.Add('')
        $out.Add('Probably safe to remove (no unmerged commits, no open tasks, no changes except coordination files):')
        foreach ($r in $removable) {
            # git refuses to remove a worktree with uncommitted files unless forced.
            $force = if ($r.Dirty -gt 0) { '--force ' } else { '' }
            $cmd = "git worktree remove $force`"$($r.Wt.Path)`""
            if ($r.Wt.Branch) { $cmd += "; git branch -d $($r.Wt.Branch)" }
            $out.Add("  [$($r.Index)] $($r.Label): $cmd")
        }
    }
}

$out.Add('')
$heading = if ($All) { 'Tasks' } else { 'Open tasks' }
$out.Add("$heading ($($shown.Count)):")
if ($shown.Count -eq 0) { $out.Add('  none') }
foreach ($t in $shown) {
    $owner = if ($t.Owner) { $t.Owner } else { 'unassigned' }
    $upd = if ($t.Updated -ne [DateTime]::MinValue) { $t.Updated.ToLocalTime().ToString('yyyy-MM-dd HH:mm') } elseif ($t.UpdatedText) { $t.UpdatedText } else { '?' }
    $out.Add("  $($t.Id) [$($t.Status)] owner=$owner worktree=$($t.Worktree) updated=$upd")
    $detail = @()
    if ($t.Title -and $t.Title -ne $t.Id) { $detail += $t.Title }
    $paths = @(Split-Scope $t.Scope)
    $detail += if ($paths.Count -eq 0) { 'scope: not recorded' } elseif ($paths.Count -le 6) { "scope: $($paths -join ', ')" } else { "scope: $(($paths | Select-Object -First 6) -join ', ') (+$($paths.Count - 6) more)" }
    $out.Add('      ' + ($detail -join ' | '))
}

$overlaps = @()
for ($a = 0; $a -lt $open.Count; $a++) {
    for ($b = $a + 1; $b -lt $open.Count; $b++) {
        $hit = Get-Overlap $open[$a].Scope $open[$b].Scope
        if ($hit) { $overlaps += "  $($open[$a].Id) ($($open[$a].Worktree)) and $($open[$b].Id) ($($open[$b].Worktree)): $hit" }
    }
}
if ($overlaps.Count -gt 0) {
    $out.Add('')
    $out.Add('Overlapping scope (coordinate before editing these):')
    foreach ($o in $overlaps) { $out.Add($o) }
}
$out
