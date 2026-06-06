# Real OpenAI Generation Diagnostic Capture Runbook

This runbook is for a future backend-only real OpenAI generation retry after
Phase 134 is signed off. It does not authorize a retry by itself.

## Scope

- Backend-only local/staging diagnostic capture.
- Exactly one `/generation/jobs` request when a retry phase explicitly allows it.
- No frontend, browser smoke, public delivery, export integration, or credits/billing mutation.
- Do not retry automatically.

## Safe Non-2xx Capture Pattern

Use a PowerShell wrapper that captures JSON diagnostic fields from non-2xx
responses without printing raw fallback bodies.

```powershell
$GenerationResponse = $null
$GenerationError = $null

try {
  $GenerationResponse = Invoke-WebRequest `
    -Method Post `
    -Uri "http://127.0.0.1:8787/generation/jobs" `
    -Headers @{ Authorization = "Bearer $AccessToken" } `
    -ContentType "application/json" `
    -Body $GenerationBody `
    -ErrorAction Stop

  $GenerationJson = $GenerationResponse.Content | ConvertFrom-Json
} catch {
  $GenerationError = $_
  $ErrorResponse = $_.Exception.Response
  $ErrorContent = $null

  if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
    $ErrorContent = $_.ErrorDetails.Message
  } elseif ($ErrorResponse -and $ErrorResponse.GetResponseStream()) {
    $Reader = [System.IO.StreamReader]::new($ErrorResponse.GetResponseStream())
    $ErrorContent = $Reader.ReadToEnd()
    $Reader.Dispose()
  }

  if ($ErrorContent) {
    try {
      $GenerationJson = $ErrorContent | ConvertFrom-Json
    } catch {
      $GenerationJson = [pscustomobject]@{
        kind = "generation_diagnostic_capture_unparseable_json"
        message = "Response body was not JSON; raw body intentionally not printed."
      }
    }
  } else {
    $GenerationJson = [pscustomobject]@{
      kind = "generation_diagnostic_capture_no_response_body"
      message = "No response body was available."
    }
  }
}

[pscustomobject]@{
  kind = $GenerationJson.kind
  status = $GenerationJson.status
  message = $GenerationJson.message
  diagnosticCode = $GenerationJson.diagnosticCode
  failureCategory = $GenerationJson.failureCategory
  attemptedProviderIds = $GenerationJson.attemptedProviderIds
  vendorCallsEnabled = $GenerationJson.runtime.vendorCallsEnabled
}
```

## Required Absence Checks

The captured output, backend logs, and terminal transcript must not include:

- provider API keys
- JWTs or service-role keys
- BYOK encryption keys
- `encrypted_payload` or `secret_ref`
- raw provider request or response bodies
- provider headers or request IDs
- OpenAI account, org, or model metadata
- base64 image data or bytes
- local file paths or internal storage refs
- public, signed, or download URLs

## Stop Rules

- Stop after the first `/generation/jobs` response.
- Do not retry automatically.
- Stop if JSON diagnostic capture fails and only the safe fallback object is available.
- Stop if any secret-like value, provider metadata, local path, or delivery URL appears.
- Stop if frontend/browser/export/credits behavior is involved.
