// ============================================================================
// Optional AI provider SDK type declarations
// ----------------------------------------------------------------------------
// These packages are NOT installed by default — they're only needed when the
// user picks a non-default AI_PROVIDER (gemini / openai / anthropic) in .env.
// We declare them as `any` so TypeScript doesn't error on the dynamic
// `await import(...)` calls in src/lib/ai-vlm.ts when the packages aren't
// installed. Runtime behavior is unaffected: the import is wrapped in
// try/catch and throws a clear AiConfigError if the package is missing.
// ============================================================================

declare module "@google/generative-ai" {
  const _default: any;
  export const GoogleGenerativeAI: any;
  export default _default;
}

declare module "openai" {
  const _default: any;
  export default _default;
  export const OpenAI: any;
}

declare module "@anthropic-ai/sdk" {
  const _default: any;
  export default _default;
  export const Anthropic: any;
}
