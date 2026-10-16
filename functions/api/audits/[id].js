export async function onRequestDelete(context) {
  const db = context.env.DB;
  const id = context.params.id;
  try {
    await db.prepare("DELETE FROM audits WHERE id = ?").bind(id).run();
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
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
