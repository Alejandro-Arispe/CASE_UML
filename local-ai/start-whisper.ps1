$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot 'local-ai\runtime\whisper.cpp\Release\whisper-server.exe'
$model = Join-Path $projectRoot 'local-ai\models\whisper\ggml-small-q5_1.bin'

if (!(Test-Path -LiteralPath $runtime)) { throw "No se encontro Whisper.cpp: $runtime" }
if (!(Test-Path -LiteralPath $model)) { throw "No se encontro el modelo Whisper: $model" }

& $runtime -m $model -l es --host 127.0.0.1 --port 8083 -t 4
