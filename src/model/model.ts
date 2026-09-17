/**
 * Model construction. The agent receives a Model and never learns which
 * provider produced it.
 */

import type { Model } from "./types.ts";
import { OllamaModel } from "../providers/ollama.ts";

export interface ModelConfig {
  /** Provider identifier, e.g. "ollama". */
  provider: string;
  /** Provider-specific model name, e.g. "qwen3-32k:latest". */
  model: string;
  baseUrl?: string;
  contextTokens?: number;
}

export function createModel(config: ModelConfig): Model {
  switch (config.provider) {
    case "ollama":
      return new OllamaModel({
        model: config.model,
        ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      });
    default:
      throw new Error(`Unknown model provider: ${config.provider}`);
  }
}
