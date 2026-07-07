import { corsHeaders } from "./cors.ts";

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
