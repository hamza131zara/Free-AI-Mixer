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

## Required Same-Shell Gate Preflight

Before starting the backend for any explicitly approved real-provider retry,
run this preflight in the same PowerShell session that will start
`npm.cmd run backend:dev`. It prints only safe set/missing state, never raw
secret values or the generated-image storage root path.

```powershell
node -e "const names=['FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED','FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER','FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS','FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE','FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY','FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE','FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT','FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED']; for (const name of names) console.log(name + '=' + (process.env[name] ? '<set>' : '<missing>'))"
```

Required safe state:

- `FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED=<set>`
- `FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER=<set>`
- `FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS=<set>`
- `FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE=<set>`
- `FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY=<set>`
- `FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE=<set>`
- `FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT=<set>`
- `FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED=<set>`

Do not proceed to validation or `/generation/jobs` if any required gate prints
`<missing>`. Do not retry automatically.

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

## Provider 400 Diagnostics

OpenAI image-generation HTTP 400 responses are intentionally reported through
safe enum-only diagnostics. A 400 must not be treated as prompt text failure
without checking the sanitized diagnostic fields first.

Possible safe diagnostics include:

- `provider_invalid_prompt`
- `provider_request_shape_invalid`
- `provider_model_unsupported`
- `provider_org_verification_required`
- `provider_response_format_unsupported`
- `provider_moderation_blocked`
- `provider_unexpected_400`

Do not retry real generation until these fields are reviewed. Future real retry
phases should use the minimal OpenAI image request shape only: `model` and
`prompt`.

Interpretation for future retry planning:

- `provider_org_verification_required` means verify OpenAI API organization/project
  access before any retry.
- `provider_model_unsupported` means model access or selection needs a separate
  audit before changing models.
- `provider_request_shape_invalid` means audit the OpenAI request body again
  before retrying.
- `provider_moderation_blocked` or `provider_invalid_prompt` means choose a
  different benign prompt only after an audit.

## Stop Rules

- Stop after the first `/generation/jobs` response.
- Do not retry automatically.
- Stop if JSON diagnostic capture fails and only the safe fallback object is available.
- Stop if any secret-like value, provider metadata, local path, or delivery URL appears.
- Stop if frontend/browser/export/credits behavior is involved.
