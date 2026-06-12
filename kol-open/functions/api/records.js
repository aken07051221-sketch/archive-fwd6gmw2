// GET /api/records  → 後台列出所有回傳紀錄（文字 + 圖檔 key）
// ⚠️ 高敏感個資！上線前務必用 Cloudflare Access 鎖住此路徑，只允許財務同仁 Email。
//
// 參數：
//   ?limit=50&offset=0   分頁
//   ?q=關鍵字            針對姓名 / 電話 / 案名搜尋

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export async function onRequestGet({ request, env }) {
  try {
    if (!env.FORM_DB) {
      return json({ ok: false, error: "尚未綁定 D1。" }, 500);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    const q = (url.searchParams.get("q") || "").trim();

    let stmt;
    if (q) {
      const like = `%${q}%`;
      stmt = env.FORM_DB.prepare(
        `SELECT * FROM submissions
         WHERE name LIKE ? OR phone LIKE ? OR project LIKE ? OR company LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(like, like, like, like, limit, offset);
    } else {
      stmt = env.FORM_DB.prepare(
        `SELECT * FROM submissions ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, offset);
    }

    const { results } = await stmt.all();
    const total = await env.FORM_DB
      .prepare(`SELECT COUNT(*) AS c FROM submissions`)
      .first("c");

    return json({ ok: true, total, count: results.length, records: results });
  } catch (err) {
    return json({ ok: false, error: "讀取失敗。", detail: String(err) }, 500);
  }
}
