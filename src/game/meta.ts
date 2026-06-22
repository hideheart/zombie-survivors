import { createRunState, type RunState } from './upgrades';
import { getCharacter } from './characters';

/** 永久升級（天賦樹，花技能點，套用到每一輪） */
export interface PermaUpgrade {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  maxLevel: number;
  dependsOn?: string; // 前置天賦 id
}

export const PERMA: PermaUpgrade[] = [
  { id: 'vigor', name: '活力', emoji: '❤️', desc: '起始生命 +20／級', maxLevel: 5 },
  { id: 'swift', name: '敏捷', emoji: '👟', desc: '起始移速 +5%／級', maxLevel: 5, dependsOn: 'vigor' },
  { id: 'haste', name: '急速', emoji: '⚡', desc: '起始攻速 +6%／級', maxLevel: 5, dependsOn: 'vigor' },
  { id: 'might', name: '威力', emoji: '⚔️', desc: '起始傷害 +1／級', maxLevel: 5, dependsOn: 'swift' },
  { id: 'greed', name: '貪婪', emoji: '💰', desc: '金幣獲得 +15%／級', maxLevel: 5, dependsOn: 'might' },
];

/** POE 1-100 等級累積經驗值需求表 */
export const POE_XP_TABLE = [
  0, 525, 1760, 3781, 7184, 12186, 19324, 29377, 43181, 61693, 
  85990, 117506, 157384, 207736, 269997, 346252, 438902, 550604, 684347, 843534, 
  1031899, 1253473, 1512768, 1814691, 2164438, 2567639, 3030252, 3558835, 4160673, 4843385, 
  5615024, 6484394, 7460775, 8553957, 9774641, 11134237, 12644917, 14320146, 16173873, 18221087, 
  20477815, 22961476, 25691458, 28688404, 31974643, 35574510, 39513364, 43818302, 48518171, 53644026, 
  59229046, 65309653, 71925345, 79118539, 86935272, 95425021, 104642999, 114648782, 125505436, 137283764, 
  150061559, 163925763, 178969796, 195293444, 213004381, 232219468, 253063595, 275677098, 300207572, 326815332, 
  355673551, 386968600, 420894569, 457662927, 497500589, 540656037, 587396781, 638012170, 692823614, 752178229, 
  816457319, 886074213, 961481076, 1043171317, 1131681283, 1227595300, 1331535492, 1444171217, 1566231940, 1698504456, 
  1841818225, 1997059737, 2165176667, 2347209630, 2544299403, 2757715694, 2988828062, 3239056637, 3509903912, 3802971207,
  4250334444
];

/** 每次加點消耗 1 點技能點 */
export function permaCost(_p: PermaUpgrade, _currentLevel: number): number {
  return 1;
}

export interface MetaData {
  gold: number;
  unlocked: string[];
  perma: Record<string, number>;
  globalLvl: number;
  globalXp: number;
  skillPoints: number;
}

const KEY = 'animal-survivors:meta:v3'; // 使用新 Key 避免損毀舊版存檔

export function loadMeta(): MetaData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<MetaData>;
      return {
        gold: data.gold ?? 0,
        unlocked: data.unlocked ?? ['matt'],
        perma: data.perma ?? {},
        globalLvl: data.globalLvl ?? 1,
        globalXp: data.globalXp ?? 0,
        skillPoints: data.skillPoints ?? 0,
      };
    }
  } catch {
    /* 忽略損毀資料 */
  }
  return { gold: 0, unlocked: ['matt'], perma: {}, globalLvl: 1, globalXp: 0, skillPoints: 0 };
}

export function saveMeta(meta: MetaData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* 忽略寫入失敗 */
  }
}

/** 檢查是否升級，若有升級則 globalLvl + 1 且發放 1 個技能點 */
export function checkLevelUp(meta: MetaData): boolean {
  let upgraded = false;
  while (meta.globalLvl < 100 && meta.globalXp >= POE_XP_TABLE[meta.globalLvl]) {
    meta.globalLvl++;
    meta.skillPoints++;
    upgraded = true;
  }
  return upgraded;
}

/** 依角色與永久升級計算一輪的起始數值 */
export function computeStartRunState(characterId: string, perma: Record<string, number>): RunState {
  const s = createRunState();
  getCharacter(characterId).apply(s);

  const might = perma.might ?? 0;
  const haste = perma.haste ?? 0;
  const vigor = perma.vigor ?? 0;
  const swift = perma.swift ?? 0;

  s.damage += might;
  s.fireInterval *= Math.pow(0.94, haste);
  s.maxHp += 20 * vigor;
  s.moveSpeed *= Math.pow(1.05, swift);
  return s;
}

/** 金幣加成倍率（貪婪） */
export function goldMultiplier(perma: Record<string, number>): number {
  return 1 + 0.15 * (perma.greed ?? 0);
}

