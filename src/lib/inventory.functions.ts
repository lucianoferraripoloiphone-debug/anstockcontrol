import { createServerFn } from "@tanstack/react-start";
import type { Part, PartInput } from "./types";

export const getInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isUnlocked } = await import("./gate.server");

  const { data, error } = await supabaseAdmin
    .from("parts")
    .select(
      "id, model, description, category, quantity, min_stock, location, machine, line, photo_url, price",
    )
    .order("category", { ascending: true })
    .order("model", { ascending: true });

  if (error) throw new Error(error.message);

  const parts = (data ?? []) as Part[];
  const paths = parts.map((p) => p.photo_url).filter((p): p is string => !!p);

  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from("part-photos")
      .createSignedUrls(paths, 60 * 60 * 6);
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const p of parts) {
      p.photo_signed_url = p.photo_url ? (map.get(p.photo_url) ?? null) : null;
    }
  }

  return { parts, isAdmin: await isUnlocked() };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const { getGateSession, passwordMatches } = await import("./gate.server");
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) throw new Error("SITE_PASSWORD is not configured");
    if (!data.password || !passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const session = await getGateSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { getGateSession } = await import("./gate.server");
  const session = await getGateSession();
  await session.clear();
  return { ok: true as const };
});

export const savePart = createServerFn({ method: "POST" })
  .inputValidator((data: PartInput) => data)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./gate.server");
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const model = (data.model ?? "").trim();
    if (!model) throw new Error("Model is required");

    const row = {
      model: model.slice(0, 120),
      description: data.description?.trim().slice(0, 1000) || null,
      category: (data.category || "OTHER").slice(0, 60),
      quantity: Math.max(0, Math.trunc(Number(data.quantity) || 0)),
      min_stock: Math.max(0, Math.trunc(Number(data.min_stock) || 0)),
      location: data.location?.trim().slice(0, 200) || null,
      machine: data.machine?.trim().slice(0, 200) || null,
      line: data.line?.trim().slice(0, 200) || null,
      photo_url: data.photo_url || null,
      price:
        data.price === null || data.price === undefined || Number.isNaN(Number(data.price))
          ? null
          : Math.max(0, Number(data.price)),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("parts").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("parts")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted.id as string };
  });

export const deletePart = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./gate.server");
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("parts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adjustQuantity = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; delta: number }) => data)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./gate.server");
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readError } = await supabaseAdmin
      .from("parts")
      .select("quantity")
      .eq("id", data.id)
      .single();
    if (readError) throw new Error(readError.message);

    const next = Math.max(0, (current?.quantity ?? 0) + Math.trunc(data.delta));
    const { error } = await supabaseAdmin
      .from("parts")
      .update({ quantity: next })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, quantity: next };
  });

export const withdrawByCode = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; amount?: number }) => data)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./gate.server");
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const raw = (data.code ?? "").trim();
    if (!raw) throw new Error("Empty code");
    const amount = Math.max(1, Math.trunc(Number(data.amount) || 1));

    const code = raw.replace(/^.*\/part\//i, "");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

    const query = supabaseAdmin.from("parts").select("id, model, quantity");
    const { data: found, error } = isUuid
      ? await query.eq("id", code).maybeSingle()
      : await query.ilike("model", code).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!found) throw new Error(`No part found for code "${code.slice(0, 40)}"`);

    if (found.quantity <= 0) {
      return { id: found.id, model: found.model, quantity: 0, changed: false as const };
    }

    const next = Math.max(0, found.quantity - amount);
    const { error: updateError } = await supabaseAdmin
      .from("parts")
      .update({ quantity: next })
      .eq("id", found.id);
    if (updateError) throw new Error(updateError.message);

    return { id: found.id, model: found.model, quantity: next, changed: true as const };
  });

export const uploadPartPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { dataUrl: string; filename: string }) => data)
  .handler(async ({ data }) => {
    const { requireUnlocked } = await import("./gate.server");
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Invalid image");
    const mime = match[1] ?? "image/jpeg";
    const bytes = Buffer.from(match[2] ?? "", "base64");
    if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("Image too large (max 6MB)");

    const ext = (mime.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("part-photos")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);

    const { data: signed } = await supabaseAdmin.storage
      .from("part-photos")
      .createSignedUrl(path, 60 * 60 * 6);

    return { path, signedUrl: signed?.signedUrl ?? null };
  });

export const identifyPartByPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { dataUrl: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    if (!/^data:image\/[a-zA-Z+]+;base64,/.test(data.dataUrl)) throw new Error("Invalid image");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("parts")
      .select("id, model, category, description, machine, line");
    if (error) throw new Error(error.message);

    const catalog = (rows ?? [])
      .map(
        (r) =>
          `${r.id} | ${r.model} | ${r.category}${r.description ? ` | ${r.description}` : ""}${r.machine ? ` | machine: ${r.machine}` : ""}`,
      )
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify industrial spare parts from photos and match them against a warehouse catalog. " +
              "Reply ONLY with compact JSON: {\"guess\":\"short description of the part in the photo\",\"matches\":[{\"id\":\"<catalog id>\",\"confidence\":0-100,\"reason\":\"short\"}]}. " +
              "Return at most 5 matches, best first. If nothing plausibly matches, return an empty matches array.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Catalog (id | model | category | notes):\n${catalog}` },
              { type: "image_url", image_url: { url: data.dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`AI gateway error [${response.status}]: ${body}`);
      if (response.status === 429) throw new Error("AI is busy right now. Please try again shortly.");
      if (response.status === 402)
        throw new Error("AI credits are exhausted. Please top up in Lovable to keep using photo search.");
      throw new Error(`Photo search failed (${response.status}).`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonText) as {
        guess?: string;
        matches?: { id: string; confidence?: number; reason?: string }[];
      };
      return {
        guess: parsed.guess ?? "",
        matches: (parsed.matches ?? []).slice(0, 5),
      };
    } catch {
      return { guess: raw.slice(0, 300), matches: [] };
    }
  });
