// GET /api/image/<key>  → 從 R2 串流回單一圖檔
// key 形如 <時間戳_亂碼>/idf.jpg，含「/」，故用 catch-all [[key]].js 接整段路徑。
// ⚠️ 高敏感個資！上線前務必用 Cloudflare Access 鎖住 /api/image/*，只允許財務同仁。

export async function onRequestGet({ params, env }) {
  try {
    if (!env.FORM_BUCKET) {
      return new Response("尚未綁定 R2。", { status: 500 });
    }

    // params.key 在 catch-all 下是陣列，組回完整 key
    const key = Array.isArray(params.key) ? params.key.join("/") : String(params.key || "");
    if (!key) return new Response("Not found", { status: 404 });

    const obj = await env.FORM_BUCKET.get(key);
    if (!obj) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", `inline; filename="${key.split("/").pop()}"`);

    return new Response(obj.body, { headers });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
}
