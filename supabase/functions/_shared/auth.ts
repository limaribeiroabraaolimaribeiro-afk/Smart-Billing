import jwt from "npm:jsonwebtoken@9.0.2";

export interface AdminPayload {
  email: string;
  role: "admin";
}

// Erro especifico para falhas de autenticacao, para que cada function
// saiba diferenciar "nao autorizado" (401) de erro interno (500).
export class AuthError extends Error {}

export function signAdminToken(payload: AdminPayload): string {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET nao configurado nos secrets do projeto.");
  const expiresIn = Deno.env.get("JWT_EXPIRES_IN") || "8h";
  return jwt.sign(payload, secret, { expiresIn });
}

// Le o header Authorization: Bearer <token> e valida o JWT proprio do admin
// (emitido por admin-login). Isso e diferente do JWT de autenticacao nativa
// do Supabase Auth - por isso todas as functions tem verify_jwt = false
// no supabase/config.toml e fazem essa validacao manualmente.
export function requireAdmin(req: Request): AdminPayload {
  const authHeader = req.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AuthError("Token de autenticacao ausente.");
  }

  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET nao configurado nos secrets do projeto.");

  try {
    return jwt.verify(token, secret) as unknown as AdminPayload;
  } catch {
    throw new AuthError("Token invalido ou expirado.");
  }
}
