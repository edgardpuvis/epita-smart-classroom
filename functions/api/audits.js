export async function onRequestGet(context) {
  const db = context.env.DB;
  try {
    const { results } = await db.prepare(
      "SELECT * FROM audits ORDER BY created_at DESC LIMIT 50"
    ).all();
    return Response.json(results, { headers: corsHeaders() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  try {
    const body = await context.request.json();
    await db.prepare(
      `INSERT INTO audits (id, date, name, views_count, engine, total_items, status, report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.id,
      body.date,
      body.name || "",
      body.viewsCount || 0,
      body.engine || "Vision IA",
      body.totalItems || 0,
      body.status || "",
      body.report || ""
    ).run();
    return Response.json({ ok: true }, { status: 201, headers: corsHeaders() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestDelete(context) {
  const db = context.env.DB;
  try {
    await db.prepare("DELETE FROM audits").run();
    return Response.json({ ok: true }, { headers: corsHeaders() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
