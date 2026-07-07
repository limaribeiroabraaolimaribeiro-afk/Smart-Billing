import bcrypt from "npm:bcryptjs@2.4.3";
import { handleOptions } from "../_shared/cors.ts";
import { json, errorResponse } from "../_shared/response.ts";
import { signAdminToken } from "../_shared/auth.ts";

// Login simples de administrador, baseado em credenciais fixas nos secrets
// do projeto (ADMIN_EMAIL / ADMIN_PASSWORD_HASH). Nao ha cadastro de
// multiplos admins - e um login simples de um unico administrador.
Deno.serve(async (req) => {
  const cors = handleOptions(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Metodo nao permitido.", 405);
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse("Informe email e senha.", 400);
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const adminPasswordHash = Deno.env.get("ADMIN_PASSWORD_HASH");

    if (!adminEmail || !adminPasswordHash) {
      return errorResponse(
        "Login do admin nao configurado nos secrets (ADMIN_EMAIL/ADMIN_PASSWORD_HASH).",
        500,
      );
    }

    if (String(email).trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return errorResponse("Credenciais invalidas.", 401);
    }

    const senhaValida = await bcrypt.compare(password, adminPasswordHash);
    if (!senhaValida) {
      return errorResponse("Credenciais invalidas.", 401);
    }

    const token = signAdminToken({ email: adminEmail, role: "admin" });
    return json({ token, admin: { email: adminEmail } });
  } catch (err) {
    console.error("Erro no admin-login:", err);
    return errorResponse((err as Error).message || "Erro inesperado.", 500);
  }
});
