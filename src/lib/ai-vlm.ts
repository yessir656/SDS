// ============================================================================
// src/lib/ai-vlm.ts
// ----------------------------------------------------------------------------
// Provider-agnostic abstraction over vision-language models (VLMs) for the
// SDS auto-fill feature.
//
// The admin uploads an SDS PDF → pdf-rasterize.ts turns the first 5 pages into
// PNG buffers → THIS module sends those PNGs + a structured extraction prompt
// to whichever VLM provider is configured, and returns the raw text response
// (expected to contain a JSON object).
//
// Supported providers (set via AI_PROVIDER env var):
//
//   AI_PROVIDER=zai       → in-house z-ai-web-dev-sdk (DEFAULT, sandbox-only,
//                           free, uses /etc/.z-ai-config auto-configured on
//                           the Z.ai cloud sandbox)
//   AI_PROVIDER=gemini    → Google Gemini (@google/generative-ai)
//                           Free tier: 1,500 req/day on gemini-3.6-flash
//                           Get a key: https://aistudio.google.com/apikey
//   AI_PROVIDER=openai    → OpenAI (openai SDK, gpt-4o-mini)
//                           Get a key: https://platform.openai.com/api-keys
//   AI_PROVIDER=anthropic → Anthropic Claude (@anthropic-ai/sdk, claude-3-5-sonnet)
//                           Get a key: https://console.anthropic.com/settings/keys
//
// Adding a new provider:
//   1. Add a branch in callVlm() below.
//   2. Add the provider name to the AiProvider type.
//   3. Add the required env vars to .env.example.
// ============================================================================

import type { Buffer } from "node:buffer";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid AI provider identifiers. Mirrors the AI_PROVIDER env var. */
export type AiProvider = "zai" | "gemini" | "openai" | "anthropic";

/** Result of a VLM call — just the raw text response from the model. */
export interface VlmResult {
  /** Raw model output (expected to contain a JSON object the caller parses). */
  text: string;
  /** Provider that produced this response (for logging / debugging). */
  provider: AiProvider;
  /** Model identifier used for this call. */
  model: string;
}

/** Thrown when the configured provider is missing its API key / config. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/** Thrown when the provider API call itself fails (network, auth, rate limit). */
export class AiRequestError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the configured provider from env vars.
 *
 * Defaults to "zai" (the in-house SDK) so the sandbox keeps working without
 * any env changes. On a local dev machine the user sets AI_PROVIDER=gemini
 * (or openai / anthropic) + the matching API key.
 */
export function resolveProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? "zai").trim().toLowerCase();
  if (
    raw === "zai" ||
    raw === "gemini" ||
    raw === "openai" ||
    raw === "anthropic"
  ) {
    return raw;
  }
  // Fall back to zai on unknown values — the call will then either succeed
  // (sandbox) or throw a clear AiConfigError (local machine).
  return "zai";
}

/**
 * Validate that the configured provider has the credentials it needs.
 * Throws AiConfigError with an actionable message if not.
 *
 * This is called BEFORE rasterizing the PDF so we fail fast (in <100ms)
 * instead of after a 10-second rasterization step.
 */
export function assertProviderConfigured(provider: AiProvider): void {
  switch (provider) {
    case "zai":
      // z-ai-web-dev-sdk auto-resolves /etc/.z-ai-config on the sandbox.
      // We can't check from here whether the file exists without duplicating
      // the SDK's search logic, so we let ZAI.create() throw at call time
      // and catch it in callVlm().
      return;
    case "gemini": {
      const key = process.env.GEMINI_API_KEY?.trim();
      if (!key) {
        throw new AiConfigError(
          "AI_PROVIDER=gemini is set but GEMINI_API_KEY is missing. " +
            "Get a free key at https://aistudio.google.com/apikey and add it to your .env file."
        );
      }
      return;
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (!key) {
        throw new AiConfigError(
          "AI_PROVIDER=openai is set but OPENAI_API_KEY is missing. " +
            "Get a key at https://platform.openai.com/api-keys and add it to your .env file."
        );
      }
      return;
    }
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) {
        throw new AiConfigError(
          "AI_PROVIDER=anthropic is set but ANTHROPIC_API_KEY is missing. " +
            "Get a key at https://console.anthropic.com/settings/keys and add it to your .env file."
        );
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Send page images + a text prompt to the configured VLM and return the raw
 * text response.
 *
 * @param images    Array of PNG buffers (one per PDF page, max 5).
 * @param prompt    The extraction prompt (text).
 * @returns         VlmResult with the model's raw text output.
 *
 * @throws AiConfigError   if the provider's API key / config is missing.
 * @throws AiRequestError  if the API call fails (network, auth, rate limit).
 */
export async function callVlm(
  images: Buffer[],
  prompt: string
): Promise<VlmResult> {
  const provider = resolveProvider();
  assertProviderConfigured(provider);

  switch (provider) {
    case "zai":
      return callZai(images, prompt);
    case "gemini":
      return callGemini(images, prompt);
    case "openai":
      return callOpenai(images, prompt);
    case "anthropic":
      return callAnthropic(images, prompt);
  }
}

// ---------------------------------------------------------------------------
// Provider: z-ai-web-dev-sdk (in-house, sandbox-only, default)
// ---------------------------------------------------------------------------

async function callZai(
  images: Buffer[],
  prompt: string
): Promise<VlmResult> {
  // Late import so this module can be imported even when the SDK isn't used.
  const ZAI = (await import("z-ai-web-dev-sdk")).default;

  let zai;
  try {
    zai = await ZAI.create();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Configuration file not found")) {
      throw new AiConfigError(
        "The in-house z-ai-web-dev-sdk could not find its config file " +
          "(/etc/.z-ai-config). This provider only works inside the Z.ai cloud " +
          "sandbox. To use AI auto-fill on a local machine, set AI_PROVIDER=gemini " +
          "(or openai / anthropic) and the matching API key in your .env file."
      );
    }
    throw new AiConfigError(`z-ai-web-dev-sdk init failed: ${msg}`);
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: prompt },
    ...images.map((b) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${b.toString("base64")}` },
    })),
  ];

  try {
    const resp = await zai.chat.completions.createVision({
      model: "glm-4.6v",
      messages: [{ role: "user", content }],
      thinking: { type: "disabled" },
    } as Parameters<typeof zai.chat.completions.createVision>[0]);
    const text = resp?.choices?.[0]?.message?.content ?? "";
    return { text, provider: "zai", model: "glm-4.6v" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AiRequestError(`z-ai-web-dev-sdk request failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Provider: Google Gemini
// ---------------------------------------------------------------------------
//
// Why Gemini is the recommended local-development provider:
//   - Free tier: 1,500 requests/day on gemini-3.6-flash (a lab with 200 SDS
//     PDFs will never exhaust this).
//   - Native multimodal — built for document understanding.
//   - JSON mode (responseMimeType: "application/json") forces structured
//     output, making parsing reliable.
//
// Critical: SDS documents routinely contain words like "carcinogen",
// "fatal if swallowed", "severe burns", "may cause death". These can trigger
// Gemini's default safety filters and either block the response entirely or
// return a redacted/empty string. We set ALL safety categories to BLOCK_NONE
// because this is a legitimate safety-critical use case — we NEED the model
// to read and transcribe hazard information verbatim. Without this, extraction
// silently fails on ~30% of SDS documents.
// ---------------------------------------------------------------------------

async function callGemini(
  images: Buffer[],
  prompt: string
): Promise<VlmResult> {
  // Late import — keeps this provider optional. If the user picks Gemini but
  // hasn't installed @google/generative-ai, the error message is clear.
  let GoogleGenerativeAI: new (apiKey: string) => any;
  try {
    const mod = await import("@google/generative-ai");
    GoogleGenerativeAI = mod.GoogleGenerativeAI;
  } catch {
    throw new AiConfigError(
      "AI_PROVIDER=gemini requires the @google/generative-ai package. " +
        "Install it with: bun add @google/generative-ai"
    );
  }

  const apiKey = process.env.GEMINI_API_KEY!.trim();
  // Default to gemini-3.6-flash — current generation, fast, good vision.
  // NOTE: older generations (1.5 / 2.0 / 2.5) are retired on the Gemini API and
  // return 404 "model no longer available". Override with GEMINI_MODEL only if
  // you know the model is still served.
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    // SDS documents contain hazard statements that trigger safety filters.
    // Disable all blocking — we need verbatim transcription of safety data.
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for consistent, factual extraction.
      maxOutputTokens: 8192, // Enough for a full 15-field SDS extraction.
      // Force JSON output mode — Gemini will return valid JSON directly,
      // no markdown fences to strip. (The prompt also requests JSON-only.)
      responseMimeType: "application/json",
    },
  });

  // Gemini's inlineData part accepts base64-encoded image bytes directly
  // (no data: prefix, unlike OpenAI's image_url format).
  const parts: Array<any> = [
    { text: prompt },
    ...images.map((b) => ({
      inlineData: {
        mimeType: "image/png",
        data: b.toString("base64"),
      },
    })),
  ];

  try {
    const result = await generativeModel.generateContent({
      contents: [{ role: "user", parts }],
    });

    // Check for safety-blocked or empty responses BEFORE calling .text().
    // The SDK's .text() helper throws an unhelpful error if content is empty,
    // so we inspect the candidate directly.
    const candidate = result?.response?.candidates?.[0];
    if (!candidate) {
      const blockReason = result?.response?.promptFeedback?.blockReason;
      throw new Error(
        blockReason
          ? `Gemini blocked the request (${blockReason}). ` +
              "This shouldn't happen with safetySettings=BLOCK_NONE — verify your API key has access to this model."
          : "Gemini returned no candidates. The request may have been blocked or the API key may be invalid."
      );
    }

    if (candidate.finishReason === "SAFETY") {
      throw new Error(
        "Gemini blocked the response due to safety filters despite BLOCK_NONE settings. " +
          "The model may not support overriding safety settings — try a different GEMINI_MODEL."
      );
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      // Response was truncated — log a warning but still return what we got.
      // The JSON may be incomplete and fail parsing downstream, which is
      // handled by the route's JSON.parse try/catch.
      console.warn(
        "[ai-vlm] Gemini response truncated (MAX_TOKENS). " +
          "Consider increasing maxOutputTokens or reducing the number of PDF pages."
      );
    }

    const text = result?.response?.text?.() ?? "";
    if (!text) {
      throw new Error(
        "Gemini returned an empty response. The model may have refused to generate content for this input."
      );
    }
    return { text, provider: "gemini", model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.status;
    throw new AiRequestError(`Gemini request failed: ${msg}`, status);
  }
}

// ---------------------------------------------------------------------------
// Provider: OpenAI (gpt-4o-mini)
// ---------------------------------------------------------------------------

async function callOpenai(
  images: Buffer[],
  prompt: string
): Promise<VlmResult> {
  let openai: any;
  try {
    const mod = await import("openai");
    const OpenAI = mod.default ?? mod.OpenAI;
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim() });
  } catch {
    throw new AiConfigError(
      "AI_PROVIDER=openai requires the openai package. " +
        "Install it with: bun add openai"
    );
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: string } }
  > = [
    { type: "text", text: prompt },
    ...images.map((b) => ({
      type: "image_url" as const,
      // "low" detail is cheaper and sufficient for SDS text extraction.
      image_url: {
        url: `data:image/png;base64,${b.toString("base64")}`,
        detail: "low",
      },
    })),
  ];

  try {
    const resp = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.1,
      // Encourage JSON-only output. The prompt also tells the model to return
      // only JSON, but this nudges it further.
      response_format: { type: "json_object" },
    });
    const text = resp?.choices?.[0]?.message?.content ?? "";
    return { text, provider: "openai", model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.status;
    throw new AiRequestError(`OpenAI request failed: ${msg}`, status);
  }
}

// ---------------------------------------------------------------------------
// Provider: Anthropic Claude (claude-3-5-sonnet)
// ---------------------------------------------------------------------------

async function callAnthropic(
  images: Buffer[],
  prompt: string
): Promise<VlmResult> {
  let anthropic: any;
  try {
    const mod = await import("@anthropic-ai/sdk");
    const Anthropic = mod.default ?? mod.Anthropic;
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  } catch {
    throw new AiConfigError(
      "AI_PROVIDER=anthropic requires the @anthropic-ai/sdk package. " +
        "Install it with: bun add @anthropic-ai/sdk"
    );
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022";

  // Anthropic's message format: a single user message with text + image blocks.
  const blocks: Array<any> = [
    { type: "text", text: prompt },
    ...images.map((b) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: b.toString("base64"),
      },
    })),
  ];

  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: blocks }],
    });
    // Anthropic returns an array of content blocks; concatenate text blocks.
    const text = (resp?.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text ?? "")
      .join("\n");
    return { text, provider: "anthropic", model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.status;
    throw new AiRequestError(`Anthropic request failed: ${msg}`, status);
  }
}

// ---------------------------------------------------------------------------
// Introspection + health check (used by /api/admin/system/*)
// ---------------------------------------------------------------------------

/**
 * Read-only snapshot of the current AI provider configuration.
 * Never returns the actual API key — only whether one is set.
 */
export function getProviderInfo() {
  const provider = resolveProvider();
  const env = process.env;

  const info: {
    provider: AiProvider;
    model: string;
    apiKeyConfigured: boolean;
    apiKeyHint: string | null;
    sdkInstalled: boolean;
    notes: string;
  } = {
    provider,
    model: "",
    apiKeyConfigured: false,
    apiKeyHint: null,
    sdkInstalled: false,
    notes: "",
  };

  switch (provider) {
    case "zai":
      info.model = "glm-4.6v";
      info.apiKeyConfigured = true; // auto-configured via /etc/.z-ai-config
      info.apiKeyHint = "auto (sandbox)";
      info.sdkInstalled = isModuleInstalled("z-ai-web-dev-sdk");
      info.notes =
        "In-house provider. Auto-configured on the Z.ai cloud sandbox. " +
        "Not available on local machines — use Gemini instead.";
      break;
    case "gemini":
      info.model = env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
      info.apiKeyConfigured = !!env.GEMINI_API_KEY?.trim();
      info.apiKeyHint = maskKey(env.GEMINI_API_KEY);
      info.sdkInstalled = isModuleInstalled("@google/generative-ai");
      info.notes =
        "Recommended for local development. Free tier: 1,500 req/day. " +
        "Get a key at https://aistudio.google.com/apikey";
      break;
    case "openai":
      info.model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
      info.apiKeyConfigured = !!env.OPENAI_API_KEY?.trim();
      info.apiKeyHint = maskKey(env.OPENAI_API_KEY);
      info.sdkInstalled = isModuleInstalled("openai");
      info.notes = "Get a key at https://platform.openai.com/api-keys";
      break;
    case "anthropic":
      info.model = env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022";
      info.apiKeyConfigured = !!env.ANTHROPIC_API_KEY?.trim();
      info.apiKeyHint = maskKey(env.ANTHROPIC_API_KEY);
      info.sdkInstalled = isModuleInstalled("@anthropic-ai/sdk");
      info.notes = "Get a key at https://console.anthropic.com/settings/keys";
      break;
  }

  return info;
}

/** Mask an API key for display: show only the first 4 + last 4 characters. */
function maskKey(key: string | undefined): string | null {
  const k = key?.trim();
  if (!k) return null;
  if (k.length <= 12) return "•".repeat(k.length);
  return `${k.slice(0, 4)}${"•".repeat(Math.max(8, k.length - 8))}${k.slice(-4)}`;
}

/** Check whether a node module is installed by looking for its package.json
 *  in node_modules. Uses fs instead of require.resolve because the Next.js
 *  Turbopack bundler mishandles require.resolve for some package names. */
function isModuleInstalled(name: string): boolean {
  const candidates = [
    path.join(process.cwd(), "node_modules", name, "package.json"),
    path.join(process.cwd(), "..", "node_modules", name, "package.json"),
  ];
  return candidates.some((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

/**
 * Send a minimal text-only prompt to the configured provider to verify the
 * API key works and the model is reachable. Does NOT send any image.
 *
 * Used by the System Settings → "Test Connection" button.
 */
export async function testProviderConnection(): Promise<{
  ok: boolean;
  provider: AiProvider;
  model: string;
  latencyMs: number;
  responsePreview: string;
  error?: string;
}> {
  const provider = resolveProvider();
  assertProviderConfigured(provider);

  const startedAt = Date.now();
  const testPrompt = 'Reply with exactly the JSON: {"ok":true}';

  try {
    let text = "";
    let model = "";

    switch (provider) {
      case "zai": {
        const ZAI = (await import("z-ai-web-dev-sdk")).default;
        const zai = await ZAI.create();
        const resp = await zai.chat.completions.create({
          model: "glm-4.6v",
          messages: [{ role: "user", content: testPrompt }],
        } as Parameters<typeof zai.chat.completions.create>[0]);
        text = resp?.choices?.[0]?.message?.content ?? "";
        model = "glm-4.6v";
        break;
      }
      case "gemini": {
        const mod = await import("@google/generative-ai");
        const GoogleGenerativeAI = mod.GoogleGenerativeAI;
        const apiKey = process.env.GEMINI_API_KEY!.trim();
        const modelId = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
          model: modelId,
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 64,
            responseMimeType: "application/json",
          },
        });
        const result = await generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: testPrompt }] }],
        });
        text = result?.response?.text?.() ?? "";
        model = modelId;
        break;
      }
      case "openai": {
        const mod = await import("openai");
        const OpenAI = mod.default ?? mod.OpenAI;
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY!.trim(),
        });
        const modelId = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
        const resp = await openai.chat.completions.create({
          model: modelId,
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 64,
          temperature: 0,
        });
        text = resp?.choices?.[0]?.message?.content ?? "";
        model = modelId;
        break;
      }
      case "anthropic": {
        const mod = await import("@anthropic-ai/sdk");
        const Anthropic = mod.default ?? mod.Anthropic;
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
        });
        const modelId =
          process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022";
        const resp = await anthropic.messages.create({
          model: modelId,
          max_tokens: 64,
          messages: [{ role: "user", content: testPrompt }],
        });
        text = (resp?.content ?? [])
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text ?? "")
          .join("\n");
        model = modelId;
        break;
      }
    }

    return {
      ok: true,
      provider,
      model,
      latencyMs: Date.now() - startedAt,
      responsePreview: text.slice(0, 200),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      provider,
      model: "",
      latencyMs: Date.now() - startedAt,
      responsePreview: "",
      error: msg,
    };
  }
}
