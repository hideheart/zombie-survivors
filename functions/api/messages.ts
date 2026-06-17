import { type FnContext, json, sanitizeText, clampInt } from './_lib';

interface MsgRow {
  id: number;
  name: string;
  text: string;
  parent_id: number;
  created_at: number;
}

/** 刪除留言需輸入的「作者生日」 */
const DELETE_KEY = '0501';

/** GET /api/messages — 取最新 100 則留言（含回覆，新到舊；前端自行組成樹狀） */
export const onRequestGet = async ({ env }: FnContext): Promise<Response> => {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, text, parent_id, created_at FROM messages ORDER BY id DESC LIMIT 100',
    ).all<MsgRow>();
    return json(results.map((r) => ({ id: r.id, name: r.name, text: r.text, parentId: r.parent_id ?? 0, at: r.created_at })));
  } catch {
    return json({ error: 'db error' }, 500);
  }
};

/** POST /api/messages — 新增留言或回覆（parentId>0 為回覆某則） */
export const onRequestPost = async ({ request, env }: FnContext): Promise<Response> => {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      text?: string;
      deviceId?: string;
      parentId?: number;
    };
    const name = sanitizeText(body.name, 16);
    const text = sanitizeText(body.text, 200);
    if (!name || !text) return json({ ok: false }, 400);
    const device = sanitizeText(body.deviceId, 64);
    const parentId = clampInt(body.parentId, 0, 1_000_000_000);
    await env.DB.prepare('INSERT INTO messages (name, text, device_id, parent_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(name, text, device, parentId, Date.now())
      .run();
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
};

/** DELETE /api/messages?id=X&key=0501 — 需作者生日；連同其回覆一併刪除 */
export const onRequestDelete = async ({ request, env }: FnContext): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const id = clampInt(url.searchParams.get('id'), 1, 1_000_000_000);
    const key = url.searchParams.get('key') ?? '';
    if (key !== DELETE_KEY) return json({ ok: false, error: 'bad key' }, 403);
    if (!id) return json({ ok: false }, 400);
    /** 刪該則 + 其底下的回覆 */
    await env.DB.prepare('DELETE FROM messages WHERE id = ? OR parent_id = ?').bind(id, id).run();
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
};
