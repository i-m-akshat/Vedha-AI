# Bug Fix: Aksh Conversational Turn Mid-Turn Failure on Greetings ("HI")

## 1. Summary
When a candidate sent a simple greeting like `"HI"` or general conversational chat to Ask Aksh, the session terminated prematurely with:
`"The AI model failed mid-turn. Nothing was submitted — your plan and receipts are intact. Please try again."`

## 2. Root Cause Analysis
1. In `AkshAgentRunner.cs`, `AkshIntent.IsGreetingOrGeneralChat("HI")` accurately determined that the greeting did not require external tools, setting `toolsForTurn = Array.Empty<string>()`.
2. In `AkshChatClientAdapter.cs`, the adapter checked:
   ```csharp
   var toolsRequested = options?.Tools?.OfType<AIFunction>().Any() == true
       && (ProviderType is null || ProviderType == AiProviderType.Gemini);
   ```
   Because `toolsForTurn` was empty, `options.Tools` was empty or null, so `toolsRequested` was `false`.
3. Consequently, the adapter completely bypassed the robust `GeminiFunctionCallingClient` and fell back to the generic `provider.GenerateTextAsync(...)` path.
4. In `AiProviders.cs` inside `GeminiProvider.CreateGenerationConfig`, models matching `-2.5-flash` or `-pro` conditionally included:
   ```csharp
   thinkingConfig = new { thinkingBudget = 0 }
   ```
   In the Google Gemini REST API (v1beta), sending `thinkingConfig` with `thinkingBudget: 0` is rejected with HTTP 400 Bad Request (`Invalid JSON payload received`).
5. When `provider.GenerateTextAsync` returned this 400 Bad Request failure, `AkshChatClientAdapter` threw `AkshModelException("model_unavailable", result.Error)`.
6. `AkshAgentRunner.cs` caught `AkshModelException` and masked the inner error message under the generic string: `"The AI model failed mid-turn. Nothing was submitted..."`.

## 3. Proposed Fix & Architectural Hardening
1. **Unify Gemini Execution in `AkshChatClientAdapter.cs`**:
   Route all Gemini turns (both tool-calling turns and pure conversational turns without tools) through `GeminiFunctionCallingClient`. `GeminiFunctionCallingClient` natively formats messages, handles multi-turn conversation history, handles optional tools, avoids invalid `thinkingConfig`, tracks token usage, and gracefully returns `ChatMessage(ChatRole.Assistant, text)`.
2. **Payload Hygiene in `AiProviders.cs`**:
   Removed `thinkingConfig = new { thinkingBudget = 0 }` from `CreateGenerationConfig`, preventing 400 Bad Request on standard Gemini 2.x and Flash model endpoints.
3. **Transparent Error Telemetry in `AkshAgentRunner.cs`**:
   Refactored error event generation to surface actionable provider diagnostics instead of generic masking.
4. **Unit Verification**:
   Added `Adapter_RoutesToFunctionClient_ForConversationalTurnWithoutTools` in `AkshFunctionCallingTests.cs` to ensure conversational turns without tools are routed through `GeminiFunctionCallingClient` and never fail.

## 4. Affected Files
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshChatClientAdapter.cs`
- `backend/src/ResumeTailor.Infrastructure/Ai/AiProviders.cs`
- `backend/src/ResumeTailor.Infrastructure/Aksh/AkshAgentRunner.cs`
- `backend/tests/ResumeTailor.UnitTests/AkshFunctionCallingTests.cs`

## 5. Verification Steps & Results
- Ran `dotnet test --no-restore --filter "FullyQualifiedName~AkshFunctionCallingTests" backend/tests/ResumeTailor.UnitTests/ResumeTailor.UnitTests.csproj`:
  - 5/5 tests passed in 1.1s.
- Verified that conversational messages with zero tools execute cleanly through `GeminiFunctionCallingClient`.
