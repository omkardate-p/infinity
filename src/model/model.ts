/**
 * Model construction. The agent receives a Model and never learns which
 * provider produced it.
 */

import type { Model } from "./types.ts";
import { OllamaModel } from "../providers/ollama.ts";
import { OpenAIModel } from "../providers/openai.ts";

export interface ModelConfig {
  provider: string;
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
    case "openai":
      return new OpenAIModel({
        model: config.model,
        ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      });
    default:
      throw new Error(`Unknown model provider: ${config.provider}`);
  }
}
