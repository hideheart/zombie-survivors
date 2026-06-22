<template>
  <div class="absolute inset-0 overflow-auto bg-gradient-to-b from-[#0b1020] to-[#161f38] text-white">
    <!-- 返回首頁 -->
    <button
      class="absolute left-3 top-3 z-10 rounded-full bg-white/10 px-4 py-1 text-sm font-black backdrop-blur-md transition hover:bg-white/20 active:scale-95"
      @click="emit('home')"
    >
      ← 首頁
    </button>

    <!-- Debug 開關 -->
    <div class="absolute right-3 top-3 z-10 flex items-center gap-2">
      <button
        class="rounded-full px-3 py-1 text-xs font-black transition"
        :class="debug ? 'bg-lime-400 text-black' : 'bg-white/10 text-white/60'"
        @click="toggleDebug"
      >
        🛠 Debug {{ debug ? 'ON' : 'OFF' }}
      </button>
      <button
        v-if="debug"
        class="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-black"
        @click="emit('add-gold', 1000)"
      >
        +1000💰
      </button>
    </div>

    <div class="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <!-- 標題 -->
      <div class="pt-4 text-center">
        <div class="text-5xl font-black tracking-wider">殭屍大逃殺</div>
        <div class="mt-1 text-sm text-white/60">在殭屍潮中倖存・3D 倖存者類 roguelite</div>
        <div class="mt-3 inline-block rounded-full bg-amber-400/90 px-5 py-1 text-lg font-black text-black">
          💰 {{ meta.gold }}
        </div>
      </div>

      <!-- 角色 -->
      <div>
        <div class="mb-2 text-lg font-black">選擇角色</div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="c in characters"
            :key="c.id"
            class="flex cursor-pointer flex-col items-center gap-1 rounded-2xl p-3 text-center ring-2 transition"
            :class="cardClass(c.id)"
            @click="onCard(c)"
          >
            <div class="relative h-36 w-36">
              <canvas
                :ref="(el) => setCanvas(c.id, el)"
                class="h-36 w-36 rounded-xl ring-1 ring-white/10"
                width="384"
                height="384"
              />
              <span
                v-if="!ready[c.id]"
                class="absolute inset-0 flex items-center justify-center text-5xl"
              >
                {{ c.emoji }}
              </span>
            </div>
            <span class="font-black">{{ c.name }}</span>
            <span class="text-[0.72rem] font-bold leading-tight text-amber-200/80">{{ c.trait }}</span>
            <span class="text-[0.66rem] leading-snug text-white/55">{{ c.desc }}</span>
            <span
              v-if="!isUnlocked(c.id)"
              class="mt-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-black"
              :class="{ 'opacity-40': meta.gold < c.cost }"
            >
              解鎖 💰{{ c.cost }}
            </span>
          </div>
        </div>
      </div>

      <!-- 全域等級看板 -->
      <div class="rounded-3xl bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border border-cyan-500/20 p-5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="relative flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15 border-2 border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] text-2xl font-black text-cyan-300">
            {{ meta.globalLvl }}
          </div>
          <div>
            <div class="text-sm text-white/50 font-bold">全域帳號等級</div>
            <div class="text-xs text-cyan-300/80 mt-0.5">可用天賦點數：<span class="text-lg font-black text-amber-300">{{ meta.skillPoints }}</span> 點</div>
          </div>
        </div>
        <div class="flex-1 max-w-md">
          <div class="flex justify-between text-xs text-white/50 mb-1.5 font-bold">
            <span>經驗值進度 (POE 曲線)</span>
            <span v-if="meta.globalLvl < 100">{{ currentLvlXp.toLocaleString() }} / {{ nextLvlRequiredXp.toLocaleString() }} XP</span>
            <span v-else>已達最高等級 (MAX)</span>
          </div>
          <!-- 經驗值條 -->
          <div class="h-3.5 w-full overflow-hidden rounded-full bg-black/40 p-0.5 ring-1 ring-white/10">
            <div
              class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500 ease-out"
              :style="{ width: `${xpProgress}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- 天賦樹 -->
      <div class="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-md">
        <div class="mb-6 flex items-center justify-between">
          <div>
            <div class="text-xl font-black text-amber-300">天賦技能樹</div>
            <div class="text-xs text-white/50">消耗全域技能點來獲取永久強化</div>
          </div>
          <button
            class="rounded-full bg-red-500/20 px-4 py-1.5 text-xs font-black text-red-300 border border-red-500/30 transition hover:bg-red-500/40 active:scale-95"
            @click="onResetClick"
          >
            🔄 重置天賦
          </button>
        </div>

        <div class="grid grid-cols-2 gap-x-6 gap-y-8 max-w-xl mx-auto relative">
          <!-- 活力 (Vigor) -->
          <div class="col-span-2 flex flex-col items-center">
            <div :class="talentCardClass(getPerma('vigor'))" class="w-full max-w-xs rounded-2xl border p-3 flex flex-col gap-2 relative transition duration-300">
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getPerma('vigor').emoji }}</span>
                <div class="flex-1">
                  <div class="font-black text-sm">{{ getPerma('vigor').name }}</div>
                  <div class="text-[0.7rem] text-white/60">Lv {{ level('vigor') }}/{{ getPerma('vigor').maxLevel }}</div>
                </div>
                <button
                  class="rounded-full px-3 py-1 text-xs font-black transition active:scale-95"
                  :class="btnClass(getPerma('vigor'))"
                  :disabled="!canBuy(getPerma('vigor'))"
                  @click="emit('buy', 'vigor')"
                >
                  {{ btnText(getPerma('vigor')) }}
                </button>
              </div>
              <div class="text-[0.68rem] text-white/50">{{ getPerma('vigor').desc }}</div>
            </div>
            <!-- 連接線 -->
            <div class="h-6 w-0.5 bg-white/20 mt-1 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-white/20"></div>
          </div>

          <!-- 敏捷 (Swift) -->
          <div class="col-span-1 flex flex-col items-center">
            <div :class="talentCardClass(getPerma('swift'))" class="w-full rounded-2xl border p-3 flex flex-col gap-2 relative transition duration-300">
              <div v-if="isLocked(getPerma('swift'))" class="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-center p-2 z-10">
                <span class="text-lg">🔒</span>
                <span class="text-[0.65rem] text-white/70">需解鎖 活力 Lv 1</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getPerma('swift').emoji }}</span>
                <div class="flex-1">
                  <div class="font-black text-sm">{{ getPerma('swift').name }}</div>
                  <div class="text-[0.7rem] text-white/60">Lv {{ level('swift') }}/{{ getPerma('swift').maxLevel }}</div>
                </div>
                <button
                  class="rounded-full px-3 py-1 text-xs font-black transition active:scale-95"
                  :class="btnClass(getPerma('swift'))"
                  :disabled="!canBuy(getPerma('swift'))"
                  @click="emit('buy', 'swift')"
                >
                  {{ btnText(getPerma('swift')) }}
                </button>
              </div>
              <div class="text-[0.68rem] text-white/50">{{ getPerma('swift').desc }}</div>
            </div>
            <!-- 連接線 -->
            <div class="h-6 w-0.5 bg-white/20 mt-1 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-white/20"></div>
          </div>

          <!-- 急速 (Haste) -->
          <div class="col-span-1 flex flex-col items-center">
            <div :class="talentCardClass(getPerma('haste'))" class="w-full rounded-2xl border p-3 flex flex-col gap-2 relative transition duration-300">
              <div v-if="isLocked(getPerma('haste'))" class="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-center p-2 z-10">
                <span class="text-lg">🔒</span>
                <span class="text-[0.65rem] text-white/70">需解鎖 活力 Lv 1</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getPerma('haste').emoji }}</span>
                <div class="flex-1">
                  <div class="font-black text-sm">{{ getPerma('haste').name }}</div>
                  <div class="text-[0.7rem] text-white/60">Lv {{ level('haste') }}/{{ getPerma('haste').maxLevel }}</div>
                </div>
                <button
                  class="rounded-full px-3 py-1 text-xs font-black transition active:scale-95"
                  :class="btnClass(getPerma('haste'))"
                  :disabled="!canBuy(getPerma('haste'))"
                  @click="emit('buy', 'haste')"
                >
                  {{ btnText(getPerma('haste')) }}
                </button>
              </div>
              <div class="text-[0.68rem] text-white/50">{{ getPerma('haste').desc }}</div>
            </div>
          </div>

          <!-- 威力 (Might) -->
          <div class="col-span-1 flex flex-col items-center">
            <div :class="talentCardClass(getPerma('might'))" class="w-full rounded-2xl border p-3 flex flex-col gap-2 relative transition duration-300">
              <div v-if="isLocked(getPerma('might'))" class="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-center p-2 z-10">
                <span class="text-lg">🔒</span>
                <span class="text-[0.65rem] text-white/70">需解鎖 敏捷 Lv 1</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getPerma('might').emoji }}</span>
                <div class="flex-1">
                  <div class="font-black text-sm">{{ getPerma('might').name }}</div>
                  <div class="text-[0.7rem] text-white/60">Lv {{ level('might') }}/{{ getPerma('might').maxLevel }}</div>
                </div>
                <button
                  class="rounded-full px-3 py-1 text-xs font-black transition active:scale-95"
                  :class="btnClass(getPerma('might'))"
                  :disabled="!canBuy(getPerma('might'))"
                  @click="emit('buy', 'might')"
                >
                  {{ btnText(getPerma('might')) }}
                </button>
              </div>
              <div class="text-[0.68rem] text-white/50">{{ getPerma('might').desc }}</div>
            </div>
            <!-- 連接線 -->
            <div class="h-6 w-0.5 bg-white/20 mt-1 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-white/20"></div>
          </div>

          <!-- 右側空白佔位 -->
          <div class="col-span-1"></div>

          <!-- 貪婪 (Greed) -->
          <div class="col-span-1 flex flex-col items-center">
            <div :class="talentCardClass(getPerma('greed'))" class="w-full rounded-2xl border p-3 flex flex-col gap-2 relative transition duration-300">
              <div v-if="isLocked(getPerma('greed'))" class="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-center p-2 z-10">
                <span class="text-lg">🔒</span>
                <span class="text-[0.65rem] text-white/70">需解鎖 威力 Lv 1</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getPerma('greed').emoji }}</span>
                <div class="flex-1">
                  <div class="font-black text-sm">{{ getPerma('greed').name }}</div>
                  <div class="text-[0.7rem] text-white/60">Lv {{ level('greed') }}/{{ getPerma('greed').maxLevel }}</div>
                </div>
                <button
                  class="rounded-full px-3 py-1 text-xs font-black transition active:scale-95"
                  :class="btnClass(getPerma('greed'))"
                  :disabled="!canBuy(getPerma('greed'))"
                  @click="emit('buy', 'greed')"
                >
                  {{ btnText(getPerma('greed')) }}
                </button>
              </div>
              <div class="text-[0.68rem] text-white/50">{{ getPerma('greed').desc }}</div>
            </div>
          </div>

          <!-- 右側空白佔位 -->
          <div class="col-span-1"></div>
        </div>
      </div>

      <!-- 開始 -->
      <button
        class="sticky bottom-4 mt-2 w-full rounded-full bg-amber-400 py-4 text-2xl font-black text-black shadow-lg transition hover:bg-amber-300 active:scale-95"
        @click="emit('start', selectedId)"
      >
        ▶ 開始（{{ selectedName }}）
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { CHARACTERS, getCharacter, type Character } from '../game/characters';
import { PERMA, permaCost, type MetaData, type PermaUpgrade, POE_XP_TABLE } from '../game/meta';
import { setupCharacterPreview, type PreviewHandle } from '../game/character-previews';

const props = defineProps<{ meta: MetaData }>();
const emit = defineEmits<{
  (e: 'start', characterId: string): void;
  (e: 'buy', permaId: string): void;
  (e: 'unlock', characterId: string): void;
  (e: 'add-gold', amount: number): void;
  (e: 'reset-talents'): void;
  (e: 'home'): void;
}>();

const characters = CHARACTERS;
const selectedId = ref('matt');

/** 角色即時 3D 預覽 */
const ready = ref<Record<string, boolean>>({});
const canvases = new Map<string, HTMLCanvasElement>();
const handles: PreviewHandle[] = [];
function setCanvas(id: string, el: unknown) {
  if (el instanceof HTMLCanvasElement) canvases.set(id, el);
}
onMounted(async () => {
  await nextTick();
  for (const c of CHARACTERS) {
    const canvas = canvases.get(c.id);
    if (!canvas || !c.model) continue;
    const h = await setupCharacterPreview(canvas, c.model);
    if (h) {
      handles.push(h);
      ready.value = { ...ready.value, [c.id]: true };
    }
  }
});
onBeforeUnmount(() => {
  for (const h of handles) h.dispose();
});

const DEBUG_KEY = 'animal-survivors:debug';
const debug = ref(localStorage.getItem(DEBUG_KEY) === '1');
function toggleDebug() {
  /** 開啟需通過驗證；關閉不需要 */
  if (!debug.value) {
    const answer = window.prompt('請問作者的全名（三個字）？');
    if (answer === null) return;
    if (answer.trim() !== '黃國書') {
      window.alert('答錯了，無法開啟 Debug');
      return;
    }
  }
  debug.value = !debug.value;
  localStorage.setItem(DEBUG_KEY, debug.value ? '1' : '0');
}

const selectedName = computed(() => getCharacter(selectedId.value).name);

function isUnlocked(id: string) {
  return debug.value || props.meta.unlocked.includes(id);
}
function level(id: string) {
  return props.meta.perma[id] ?? 0;
}
function canBuy(p: PermaUpgrade) {
  const lvl = level(p.id);
  if (lvl >= p.maxLevel) return false;
  if (isLocked(p)) return false;
  return props.meta.skillPoints >= permaCost(p, lvl);
}
function cardClass(id: string) {
  if (selectedId.value === id) return 'bg-amber-400/20 ring-amber-300';
  if (isUnlocked(id)) return 'bg-white/5 ring-white/10 hover:ring-white/30';
  return 'bg-black/30 ring-white/5 opacity-80';
}
function onCard(c: Character) {
  if (isUnlocked(c.id)) {
    selectedId.value = c.id;
  } else if (props.meta.gold >= c.cost) {
    emit('unlock', c.id);
    selectedId.value = c.id;
  }
}

// 輔助函數：取得天賦設定
function getPerma(id: string): PermaUpgrade {
  return PERMA.find((p) => p.id === id)!;
}

// 計算當前等級的經驗值比例
const xpProgress = computed(() => {
  const lvl = props.meta.globalLvl;
  if (lvl >= 100) return 100;
  const minXp = POE_XP_TABLE[lvl - 1];
  const maxXp = POE_XP_TABLE[lvl];
  const range = maxXp - minXp;
  if (range <= 0) return 0;
  return Math.min(100, Math.max(0, ((props.meta.globalXp - minXp) / range) * 100));
});

// 當前等級累計經驗值
const currentLvlXp = computed(() => {
  const lvl = props.meta.globalLvl;
  if (lvl >= 100) return 0;
  return props.meta.globalXp - POE_XP_TABLE[lvl - 1];
});

// 升至下一等所需要的總經驗值
const nextLvlRequiredXp = computed(() => {
  const lvl = props.meta.globalLvl;
  if (lvl >= 100) return 0;
  return POE_XP_TABLE[lvl] - POE_XP_TABLE[lvl - 1];
});

// 檢查天賦是否被鎖定（前置天賦未點亮）
function isLocked(p: PermaUpgrade) {
  if (!p.dependsOn) return false;
  const parentLvl = props.meta.perma[p.dependsOn] ?? 0;
  return parentLvl < 1;
}

// 取得天賦卡樣式
function talentCardClass(p: PermaUpgrade) {
  const lvl = level(p.id);
  const locked = isLocked(p);
  if (locked) {
    return 'bg-black/40 border-zinc-800 text-white/40 pointer-events-none opacity-40';
  }
  if (lvl >= p.maxLevel) {
    return 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)] text-amber-200';
  }
  if (lvl > 0) {
    return 'bg-lime-500/10 border-lime-500/40 shadow-[0_0_10px_rgba(132,204,22,0.15)] text-lime-200';
  }
  return 'bg-white/5 border-white/10 text-white hover:border-white/20';
}

// 取得加點按鈕樣式
function btnClass(p: PermaUpgrade) {
  const lvl = level(p.id);
  if (lvl >= p.maxLevel) {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-default';
  }
  if (canBuy(p)) {
    return 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_2px_8px_rgba(245,158,11,0.3)]';
  }
  return 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed';
}

// 取得加點按鈕文字
function btnText(p: PermaUpgrade) {
  const lvl = level(p.id);
  if (lvl >= p.maxLevel) return '已滿';
  return '點亮';
}

// 觸發重置天賦點數
function onResetClick() {
  if (window.confirm('確定要重置所有天賦嗎？點數將會全額退回。')) {
    emit('reset-talents');
  }
}
</script>
