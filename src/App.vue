<template>
  <landing-screen
    v-if="screen === 'landing'"
    @start="screen = 'mode'"
    @leaderboard="screen = 'leaderboard'"
    @bestiary="screen = 'bestiary'"
    @messages="screen = 'messages'"
    @online-history="screen = 'onlineHistory'"
  />
  <mode-screen v-else-if="screen === 'mode'" @select="onSelectMode" @back="screen = 'landing'" />
  <difficulty-screen v-else-if="screen === 'difficulty'" @select="onSelectDifficulty" @back="screen = 'mode'" />
  <leaderboard-screen v-else-if="screen === 'leaderboard'" @back="screen = 'landing'" />
  <bestiary-screen v-else-if="screen === 'bestiary'" @back="screen = 'landing'" />
  <message-board-screen v-else-if="screen === 'messages'" @back="screen = 'landing'" />
  <online-history-screen v-else-if="screen === 'onlineHistory'" @back="screen = 'landing'" />
  <menu-screen
    v-else-if="screen === 'menu'"
    :meta="meta"
    @start="onStart"
    @buy="onBuy"
    @unlock="onUnlock"
    @add-gold="onAddGold"
    @reset-talents="onResetTalents"
    @home="screen = 'landing'"
  />
  <game-view
    v-else
    :character-color="characterColor"
    :character-model="characterModel"
    :start-run-state="startRun"
    :gold-multiplier="goldMul"
    :difficulty="difficulty"
    :mode="gameMode"
    :on-global-xp-gain="onGlobalXpGain"
    :global-lvl="meta.globalLvl"
    :global-xp="meta.globalXp"
    @gameover="onGameOver"
    @menu="screen = 'landing'"
  />
</template>

<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue';
import MenuScreen from './components/menu-screen.vue';
import GameView from './components/game-view.vue';
import LandingScreen from './components/landing-screen.vue';
import LeaderboardScreen from './components/leaderboard-screen.vue';
import BestiaryScreen from './components/bestiary-screen.vue';
import DifficultyScreen from './components/difficulty-screen.vue';
import MessageBoardScreen from './components/message-board-screen.vue';
import OnlineHistoryScreen from './components/online-history-screen.vue';
import ModeScreen from './components/mode-screen.vue';
import { loadMeta, saveMeta, computeStartRunState, goldMultiplier, PERMA, permaCost, checkLevelUp } from './game/meta';
import { getCharacter } from './game/characters';
import { addRecord, recordStats, getPlayerName } from './game/leaderboard';
import { getDifficulty, type Difficulty } from './game/difficulty';
import { submitRun } from './game/api';
import type { RunState } from './game/upgrades';
import type { RunResult, GameMode } from './game/game';

const meta = reactive(loadMeta());
const screen = ref<
  'landing' | 'mode' | 'difficulty' | 'menu' | 'game' | 'leaderboard' | 'bestiary' | 'messages' | 'onlineHistory'
>('landing');

const gameMode = ref<GameMode>('story');
function onSelectMode(m: GameMode) {
  gameMode.value = m;
  screen.value = 'difficulty';
}

const startRun = shallowRef<RunState>();
const characterColor = ref<[number, number, number]>([1, 1, 1]);
const characterModel = ref<string>();
const goldMul = ref(1);
let lastCharId = 'matt';

const DIFF_KEY = 'animal-survivors:difficulty';
const difficulty = shallowRef<Difficulty>(getDifficulty(localStorage.getItem(DIFF_KEY) ?? 'easy'));
function onSelectDifficulty(id: string) {
  difficulty.value = getDifficulty(id);
  localStorage.setItem(DIFF_KEY, id);
  screen.value = 'menu';
}

function onStart(charId: string) {
  const ch = getCharacter(charId);
  lastCharId = charId;
  startRun.value = computeStartRunState(charId, meta.perma);
  characterColor.value = ch.bodyColor;
  characterModel.value = ch.model;
  goldMul.value = goldMultiplier(meta.perma) * difficulty.value.goldReward;
  screen.value = 'game';
}

let lastSaveTime = 0;
function saveMetaThrottled() {
  const now = Date.now();
  if (now - lastSaveTime > 3000) {
    saveMeta(meta);
    lastSaveTime = now;
  }
}

function onGlobalXpGain(amount: number, _reason: 'kill' | 'time' | 'level'): boolean {
  meta.globalXp += amount;
  const leveledUp = checkLevelUp(meta);
  if (leveledUp) {
    saveMeta(meta);
  } else {
    saveMetaThrottled();
  }
  return leveledUp;
}

function onGameOver(result: RunResult) {
  meta.gold += result.gold;
  saveMeta(meta); // 遊戲結束強制存檔一次
  
  const playerName = getPlayerName() || '倖存者';
  const character = getCharacter(lastCharId).name;
  const diffId = difficulty.value.id;
  /** 動過 debug 的局：不計本機累計、不進本機排行榜（後端則由 cheated 旗標標記＋排除） */
  if (!result.cheated) {
    recordStats(result.time, result.kills);
    addRecord({
      name: playerName,
      character,
      time: result.time,
      kills: result.kills,
      level: result.level,
      gold: result.gold,
      won: result.won,
      difficulty: diffId,
      mode: result.mode,
      wave: result.wave,
      score: result.score,
      at: Date.now(),
    });
  }
  /** 一律上傳全球（帶 cheated 旗標，後端負責標記、排除排行榜、且不累加統計）；失敗則忽略 */
  void submitRun({
    name: playerName,
    character,
    time: result.time,
    kills: result.kills,
    level: result.level,
    gold: result.gold,
    won: result.won,
    difficulty: diffId,
    cheated: result.cheated,
    mode: result.mode,
    wave: result.wave,
    score: result.score,
  });
}

function onBuy(permaId: string) {
  const p = PERMA.find((x) => x.id === permaId);
  if (!p) return;
  const lvl = meta.perma[permaId] ?? 0;
  if (lvl >= p.maxLevel) return;

  // 檢查前置天賦相依性
  if (p.dependsOn) {
    const parentLvl = meta.perma[p.dependsOn] ?? 0;
    if (parentLvl < 1) {
      return; // 前置天賦未點亮，無法解鎖進階天賦
    }
  }

  const cost = permaCost(p, lvl);
  if (meta.skillPoints < cost) return;
  meta.skillPoints -= cost;
  meta.perma[permaId] = lvl + 1;
  saveMeta(meta);
}

function onResetTalents() {
  meta.perma = {};
  meta.skillPoints = meta.globalLvl - 1; // 1 等時獲得 0 點技能點，每升 1 等加 1 點
  saveMeta(meta);
}

function onUnlock(charId: string) {
  const ch = getCharacter(charId);
  if (meta.unlocked.includes(charId) || meta.gold < ch.cost) return;
  meta.gold -= ch.cost;
  meta.unlocked.push(charId);
  saveMeta(meta);
}

function onAddGold(amount: number) {
  meta.gold += amount;
  saveMeta(meta);
}
</script>
