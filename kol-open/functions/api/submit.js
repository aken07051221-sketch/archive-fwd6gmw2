// POST /api/submit
// 接收 KOL 表單（multipart/form-data：文字欄位 + 4 個圖檔）
// → 圖檔寫入 R2（同一前綴）
// → 文字 + 4 個 key 寫入 D1 的同一列
//
// 綁定（Cloudflare Pages → Settings → Functions）：
//   D1 binding：FORM_DB     → kol-open-db
//   R2 binding：FORM_BUCKET → kol-open-files
// 環境變數（可選，建議啟用 Turnstile 防灌）：
//   TURNSTILE_SECRET

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// 圖檔白名單與大小上限（前端已壓縮，這裡是後端保險）
const IMAGE_FIELDS = [
  { field: "idf", name: "idf.jpg", type: "image/jpeg" },
  { field: "idb", name: "idb.jpg", type: "image/jpeg" },
  { field: "bank", name: "bank.jpg", type: "image/jpeg" },
  { field: "sig", name: "sig.png", type: "image/png" },
];
const MAX_BYTES = 8 * 1024 * 1024; // 單檔上限 8MB

function sanitize(str, max = 500) {
  if (str == null) return "";
  return String(str).slice(0, max).trim();
}

async function verifyTurnstile(secret, token, ip) {
  if (!secret) return true; // 未設定 secret 時略過（上線前務必設定）
  if (!token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await r.json().catch(() => ({ success: false }));
  return data.success === true;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.FORM_DB || !env.FORM_BUCKET) {
      return json({ ok: false, error: "伺服器尚未綁定 D1 / R2，請聯絡管理者。" }, 500);
    }

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json({ ok: false, error: "格式錯誤。" }, 415);
    }

    const form = await request.formData();
    const ip = request.headers.get("cf-connecting-ip") || "";

    // 1) 防機器人
    const passed = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      form.get("cf-turnstile-response"),
      ip
    );
    if (!passed) {
      return json({ ok: false, error: "驗證未通過，請重新整理頁面再試一次。" }, 403);
    }

    // 2) 文字欄位
    const fields = {
      name: sanitize(form.get("name"), 60),
      id_number: sanitize(form.get("id_number"), 20).toUpperCase(),
      birthday: sanitize(form.get("birthday"), 20),
      phone: sanitize(form.get("phone"), 30),
      email: sanitize(form.get("email"), 120),
      address: sanitize(form.get("address"), 200),
      bank_name: sanitize(form.get("bank_name"), 60),
      bank_code: sanitize(form.get("bank_code"), 10),
      bank_branch: sanitize(form.get("bank_branch"), 60),
      bank_account: sanitize(form.get("bank_account"), 40),
      account_holder: sanitize(form.get("account_holder"), 60),
      company: sanitize(form.get("company"), 80),
      project: sanitize(form.get("project"), 120),
      amount: sanitize(form.get("amount"), 40),
      note: sanitize(form.get("note"), 1000),
      agreed: form.get("agreed") === "1" || form.get("agreed") === "true" ? 1 : 0,
    };

    // 3) 必填檢核
    const required = ["name", "id_number", "phone", "bank_name", "bank_account"];
    for (const k of required) {
      if (!fields[k]) return json({ ok: false, error: "請完整填寫必填欄位。" }, 400);
    }
    if (!fields.agreed) {
      return json({ ok: false, error: "請先閱讀並勾選同意勞務單條款。" }, 400);
    }

    // 4) 同一前綴：<時間戳_亂碼>
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = crypto.randomUUID().slice(0, 8);
    const ref = `${ts}_${rand}`;

    // 5) 圖檔寫入 R2（簽名必填，其餘證件必填）
    const keys = {};
    for (const { field, name, type } of IMAGE_FIELDS) {
      const file = form.get(field);
      if (!file || typeof file === "string" || file.size === 0) {
        return json({ ok: false, error: `缺少檔案：${field}` }, 400);
      }
      if (file.size > MAX_BYTES) {
        return json({ ok: false, error: `檔案過大：${field}` }, 413);
      }
      const key = `${ref}/${name}`;
      await env.FORM_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: type },
      });
      keys[field] = key;
    }

    // 6) 寫入 D1（同一列）
    const createdAt = new Date().toISOString();
    await env.FORM_DB.prepare(
      `INSERT INTO submissions
        (ref, name, id_number, birthday, phone, email, address,
         bank_name, bank_code, bank_branch, bank_account, account_holder,
         company, project, amount, note,
         idf_key, idb_key, bank_key, sig_key,
         agreed, user_agent, ip, created_at)
       VALUES (?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)`
    )
      .bind(
        ref,
        fields.name,
        fields.id_number,
        fields.birthday,
        fields.phone,
        fields.email,
        fields.address,
        fields.bank_name,
        fields.bank_code,
        fields.bank_branch,
        fields.bank_account,
        fields.account_holder,
        fields.company,
        fields.project,
        fields.amount,
        fields.note,
        keys.idf,
        keys.idb,
        keys.bank,
        keys.sig,
        fields.agreed,
        sanitize(request.headers.get("user-agent"), 300),
        ip,
        createdAt
      )
      .run();

    return json({ ok: true, ref });
  } catch (err) {
    return json({ ok: false, error: "送出失敗，請稍後再試。", detail: String(err) }, 500);
  }
}
