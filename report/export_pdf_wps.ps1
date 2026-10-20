param(
    [string]$Docx = "C:\Users\Administrator\Documents\ChatGPT\当代数据管理系统 2\survey-mongodb\report\大作业一第一阶段-项目报告.docx",
    [string]$Pdf  = "C:\Users\Administrator\Documents\ChatGPT\当代数据管理系统 2\survey-mongodb\report\大作业一第一阶段-项目报告.pdf"
)

if (Test-Path -LiteralPath $Pdf) {
    Remove-Item -LiteralPath $Pdf -Force
}

$app = New-Object -ComObject KWPS.Application
try {
    $app.Visible = $false
    $app.DisplayAlerts = 0
    $doc = $app.Documents.Open($Docx, $false, $true)
    $doc.ExportAsFixedFormat($Pdf, 17)
    $doc.Close(0)
    Write-Output "PDF 导出完成"
}
finally {
    try { $app.Quit() } catch { }
}

Start-Sleep -Seconds 2
if (Test-Path -LiteralPath $Pdf) {
    "PDF: {0:N0} KB" -f ((Get-Item -LiteralPath $Pdf).Length / 1KB)
}
else {
    "PDF 未生成"
}
