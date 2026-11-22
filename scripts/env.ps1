$projectRoot = 'D:\projects\QALAWindow'
$env:TEMP = "$projectRoot\.tmp"
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:npm_config_cache = "$projectRoot\.cache\npm"
$env:npm_config_prefix = "$projectRoot\.cache\npm-global"
$env:PIP_CACHE_DIR = "$projectRoot\.cache\pip"
$env:UV_CACHE_DIR = "$projectRoot\.cache\uv"
$env:ELECTRON_CACHE = "$projectRoot\.cache\electron"
$env:ELECTRON_BUILDER_CACHE = "$projectRoot\.cache\electron-builder"
$env:PLAYWRIGHT_BROWSERS_PATH = "$projectRoot\.cache\playwright"
$env:XDG_CACHE_HOME = "$projectRoot\.cache"
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:CARGO_HOME = "$projectRoot\.cache\cargo"
$env:RUSTUP_HOME = "$projectRoot\.cache\rustup"
$env:GIT_CONFIG_GLOBAL = "$projectRoot\.cache\gitconfig"
foreach ($directory in @($env:TEMP,$env:npm_config_cache,$env:ELECTRON_CACHE,$env:ELECTRON_BUILDER_CACHE,$env:PIP_CACHE_DIR)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
