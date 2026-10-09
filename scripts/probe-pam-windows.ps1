$taskEnv=@{}
Get-Content -LiteralPath .env.local | ForEach-Object { if($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$'){ $taskEnv[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'") } }
$taskBody=@{grant_type='client_credentials';client_id=$taskEnv['PAM_CLIENT_ID'];client_secret=$taskEnv['PAM_CLIENT_SECRET']}
if($taskEnv['PAM_CUSTOMER_ID']){ $taskBody.customer=$taskEnv['PAM_CUSTOMER_ID'] }
try {
 $taskResponse=Invoke-WebRequest -Uri ($taskEnv['PAM_BASE_URL'].TrimEnd('/')+'/pam/apps/autheticate/oauth/token-generation/') -Method Post -ContentType 'application/json' -Body ($taskBody|ConvertTo-Json -Compress) -TimeoutSec 20 -MaximumRedirection 0 -SkipHttpErrorCheck
 $taskData=$taskResponse.Content|ConvertFrom-Json
 @{stage='token';status=[int]$taskResponse.StatusCode;tokenReceived=[bool]$taskData.access_token;errors=$taskData.errors}|ConvertTo-Json -Depth 5 -Compress
} catch { @{stage='connection';error=$_.Exception.Message}|ConvertTo-Json -Compress }
