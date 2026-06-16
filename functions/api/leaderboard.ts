import { type FnContext, json } from './_lib';

interface RunRow {
  name: string;
  character: string;
  time: number;
  kills: number;
  level: number;
  gold: number;
  won: number;
  difficulty: string;
  mode: string;
  score: number;
  wave: number;
  created_at: number;
}

/**
 * GET /api/leaderboard?limit=10&difficulty=hard&gmode=story&mode=cleared
 * gmode=story（預設）：
 *   - mode=cleared  → 破關榜：only won=1，破關時間升冪（越快越前）
 *   - mode=survival → 生存榜：only won=0，存活時間降冪（越久越前）
 * gmode=deathmatch：死鬥榜，依分數降冪（越高越前，mode 參數忽略）
 * 一律排除作弊局；可選難度過濾。
 */
export const onRequestGet = async ({ request, env }: FnContext): Promise<Response> => {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);
  const difficulty = url.searchParams.get('difficulty');
  const deathmatch = url.searchParams.get('gmode') === 'deathmatch';
  const cleared = url.searchParams.get('mode') === 'cleared';
  try {
    const conds = ['cheated = 0'];
    const binds: unknown[] = [];
    let orderBy: string;
    if (deathmatch) {
      conds.push("mode = 'deathmatch'");
      orderBy = 'score DESC';
    } else {
      conds.push("mode = 'story'", 'won = ?');
      binds.push(cleared ? 1 : 0);
      orderBy = `time ${cleared ? 'ASC' : 'DESC'}`;
    }
    if (difficulty) {
      conds.push('difficulty = ?');
      binds.push(difficulty);
    }
    binds.push(limit);
    const sql = `SELECT name,character,time,kills,level,gold,won,difficulty,mode,score,wave,created_at FROM runs WHERE ${conds.join(
      ' AND ',
    )} ORDER BY ${orderBy} LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...binds).all<RunRow>();
    const list = results.map((r) => ({
      name: r.name,
      character: r.character,
      time: r.time,
      kills: r.kills,
      level: r.level,
      gold: r.gold,
      won: !!r.won,
      difficulty: r.difficulty,
      mode: r.mode,
      score: r.score,
      wave: r.wave,
      at: r.created_at,
    }));
    return json(list);
  } catch {
    return json({ error: 'db error' }, 500);
  }
};
