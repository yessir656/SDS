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
//                           Free tier: 1,500 req/day on gemini-1.5-flash
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
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    // Force JSON output to make parsing reliable.
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  // Gemini's inlineData part accepts base64-encoded image bytes directly
  // (no data: prefix).
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
    const result = await generativeModel.generateContent({ contents: [{ role: "user", parts }] });
    const text = result?.response?.text?.() ?? "";
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
