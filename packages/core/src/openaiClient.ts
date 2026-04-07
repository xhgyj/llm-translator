import { AuthError, RateLimitError, UpstreamError } from "./errors.js";
import type { ChatMessage } from "./types.js";

export type OpenAICompatibleRequest = {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  apiKey?: string;
  temperature?: number;
  fetchImpl?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      role?: string;
    };
  }>;
};

export async function callOpenAICompatible(
  request: OpenAICompatibleRequest,
): Promise<string> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const url = `${request.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
      }),
    });
  } catch (error) {
    throw new UpstreamError("Failed to reach translation upstream", { cause: error });
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthError(`Authentication failed with status ${response.status}`);
  }

  if (response.status === 429) {
    throw new RateLimitError("Translation upstream rate limited the request");
  }

  if (!response.ok) {
    const detail = await safeReadText(response);
    const suffix = detail ? `: ${detail}` : "";
    throw new UpstreamError(
      `Translation upstream returned status ${response.status}${suffix}`,
    );
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch (error) {
    throw new UpstreamError("Translation upstream returned invalid JSON", {
      cause: error,
    });
  }
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new UpstreamError("Translation upstream returned an empty response");
  }

  return content;
}

async function safeReadText(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
}
