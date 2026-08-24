// ============================================================================
// Optional AI provider SDK type declarations
// ----------------------------------------------------------------------------
// These packages are NOT installed by default — they're only needed when the
// user picks a non-default AI_PROVIDER (openai / anthropic) in .env.
// @google/generative-ai IS installed by default (the recommended local dev
// provider) so it uses its real types.
//
// We declare the optional packages as `any` so TypeScript doesn't error on
// the dynamic `await import(...)` calls in src/lib/ai-vlm.ts when the packages
// aren't installed. Runtime behavior is unaffected: the import is wrapped in
// try/catch and throws a clear AiConfigError if the package is missing.
// ============================================================================

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
