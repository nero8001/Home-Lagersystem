import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("INVITE_FROM_EMAIL");
  if (!resendKey || !fromEmail) return Response.json({ error: "Email-Versand ist noch nicht konfiguriert." }, { status: 503, headers: corsHeaders });
  const { email, code, link, householdName } = await req.json();
  if (!auth || !email || !code || !link) return Response.json({ error: "Ungültige Anfrage." }, { status: 400, headers: corsHeaders });
  // Verify the caller's Supabase session before sending.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: auth }
  });
  if (!userResponse.ok) return Response.json({ error: "Nicht angemeldet." }, { status: 401, headers: corsHeaders });
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail, to: [email], subject: "Einladung zu einem Haushalt",
      html: `<p>Du wurdest eingeladen, dem Haushalt <strong>${String(householdName ?? "Lager Zuhause").replace(/[<>&"]/g, "")}</strong> beizutreten.</p><p><a href="${String(link).replace(/["<>]/g, "")}">Einladung öffnen</a></p><p>Alternativ kannst du diesen Code eingeben: <strong>${String(code).replace(/[^A-Z0-9-]/gi, "")}</strong></p><p>Der Code ist 7 Tage gültig und kann nur einmal verwendet werden.</p>`
    })
  });
  const body = await result.json();
  if (!result.ok) return Response.json({ error: body.message ?? "E-Mail konnte nicht versendet werden." }, { status: 502, headers: corsHeaders });
  return Response.json({ ok: true }, { headers: corsHeaders });
});
