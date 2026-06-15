import { type FnContext, json } from './_lib';

/** GET /api/online — 近 90 秒在線人數 + 同時在線歷史最高（心跳間隔 60s，視窗需 > 間隔以免閃動） */
export const onRequestGet = async ({ env }: FnContext): Promise<Response> => {
  try {
    const now = Date.now();
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM presence WHERE last_seen > ?')
      .bind(now - 90000)
      .first<{ n: number }>();
    const n = row?.n ?? 0;
    /** 機會性清除過期列（10 分鐘前），避免表無限成長 */
    await env.DB.prepare('DELETE FROM presence WHERE last_seen < ?')
      .bind(now - 600000)
      .run();
    /** 同步更新峰值（landing 輪詢也會推進峰值，不只靠心跳） */
    await env.DB.prepare('UPDATE stats SET peak_online = ?, peak_online_at = ? WHERE id = 1 AND peak_online < ?')
      .bind(n, now, n)
      .run();
    const peakRow = await env.DB.prepare('SELECT peak_online FROM stats WHERE id = 1').first<{ peak_online: number }>();
    return json({ online: n, peak: peakRow?.peak_online ?? n });
  } catch {
    return json({ online: 0, peak: 0 });
  }
};
