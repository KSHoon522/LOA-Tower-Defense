import { z } from "zod";
import { ENTITY_KINDS, GRADE_ORDER } from "./constants";
import { gachaCost, sellRefund } from "./gacha";
import type { EntityKind, GameData, Grade } from "./types";

/**
 * 게임 데이터 검증 (서버 API / 에디터 / 가져오기 공용, React·DOM 비의존)
 *
 * - error: 저장 차단 — 스키마 위반, 엔진이 의존하는 참조 누락(챕터→맵/적, 분열 대상 등)
 * - warning: 저장은 허용 — 동작은 하지만 의도와 다를 가능성이 큰 데이터 (밸런스, 미사용 참조 등)
 */

z.config(z.locales.ko());

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  kind: EntityKind;
  /** 항목 id (알 수 없으면 "") */
  id: string;
  /** 필드 경로 (예: stages[0].enemyIds[1]) */
  path: string;
  message: string;
}

// ============================================================
// 스키마
// ============================================================

const num = z.number().finite();
const nonNeg = num.min(0, "0 이상이어야 합니다");
const positive = num.gt(0, "0보다 커야 합니다");
const int = z.number().int("정수여야 합니다");
const optText = z.string().optional();

const idSchema = z
  .string()
  .trim()
  .min(1, "id가 필요합니다")
  .regex(/^[^\s/\\?#%]+$/, "id에는 공백과 / \\ ? # % 를 쓸 수 없습니다");
const nameSchema = z.string().trim().min(1, "이름이 필요합니다");
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "#RRGGBB 형식 색상이어야 합니다");

const gradeSchema = z.enum(GRADE_ORDER as [Grade, ...Grade[]]);
const damageTypeSchema = z.enum(["physical", "magical"]);

const spriteAnimSchema = z.object({
  row: int.min(0, "0 이상이어야 합니다"),
  frames: int.min(1, "1 이상이어야 합니다"),
  fps: positive,
});

const appearanceSchema = z.object({
  color: hexColor,
  shape: z.enum(["circle", "square", "triangle", "diamond", "star"]),
  icon: z.string(),
  image: optText,
  sprite: z
    .object({
      src: z.string(),
      frameWidth: int.min(1, "1 이상이어야 합니다"),
      frameHeight: int.min(1, "1 이상이어야 합니다"),
      animations: z.object({
        idle: spriteAnimSchema,
        attack: spriteAnimSchema.optional(),
        skill: spriteAnimSchema.optional(),
        walk: spriteAnimSchema.optional(),
        death: spriteAnimSchema.optional(),
      }),
      scale: positive.optional(),
      facing: z.enum(["left", "right"]).optional(),
    })
    .optional(),
  flipToFace: z.boolean().optional(),
});

const skillSchema = z.object({
  name: nameSchema,
  type: z.enum(["nuke", "aoe", "slow", "stun", "chain", "buff_atkspeed"]),
  damageType: damageTypeSchema,
  power: nonNeg,
  radius: positive.optional(),
  duration: nonNeg.optional(),
  slowPct: num.min(0, "0 이상이어야 합니다").max(100, "100 이하여야 합니다").optional(),
  bonusTargets: int.min(0, "0 이상이어야 합니다").optional(),
  buffPct: nonNeg.optional(),
  description: optText,
});

const towerSchema = z.object({
  id: idSchema,
  name: nameSchema,
  grade: gradeSchema,
  regions: z.array(z.string().trim().min(1, "빈 지역 이름")),
  atk: nonNeg,
  magicAtk: nonNeg,
  attackSpeed: positive,
  range: positive,
  maxMana: nonNeg,
  manaRegen: nonNeg,
  manaOnHit: nonNeg,
  skill: skillSchema,
  appearance: appearanceSchema,
  description: optText,
  artRef: optText,
});

const enemyTraitSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("regen"), pctPerSec: nonNeg }),
  z.object({ type: z.literal("stealth"), revealRange: nonNeg }),
  z.object({
    type: z.literal("split"),
    enemyId: z.string().min(1, "분열 대상 적을 선택하세요"),
    count: int.min(1, "1 이상이어야 합니다").max(10, "10 이하여야 합니다"),
  }),
  z.object({ type: z.literal("aura_defense"), radius: positive, defense: num, magicDefense: num }),
  z.object({ type: z.literal("slow_immune") }),
  z.object({ type: z.literal("stun_immune") }),
]);

const enemySchema = z.object({
  id: idSchema,
  name: nameSchema,
  hp: positive,
  defense: nonNeg,
  magicDefense: nonNeg,
  moveSpeed: positive,
  isBoss: z.boolean(),
  goldReward: nonNeg,
  traits: z.array(enemyTraitSchema).optional(),
  appearance: appearanceSchema,
  description: optText,
  artRef: optText,
});

const synergySchema = z.object({
  id: idSchema,
  region: z.string().trim().min(1, "지역 이름이 필요합니다"),
  name: nameSchema,
  color: hexColor.optional(),
  tiers: z
    .array(
      z.object({
        count: int.min(1, "1 이상이어야 합니다"),
        effects: z.array(
          z.object({
            type: z.enum([
              "atk_pct",
              "magic_atk_pct",
              "atk_speed_pct",
              "crit_chance",
              "crit_damage_pct",
              "mana_regen_pct",
              "range_add",
              "gold_per_kill",
            ]),
            value: num,
          })
        ),
      })
    )
    .min(1, "단계가 1개 이상 필요합니다"),
  description: optText,
});

const jobSkillSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("passive"),
    name: nameSchema,
    type: z.enum([
      "start_gold",
      "extra_lives",
      "gacha_discount_pct",
      "crit_chance_all",
      "atk_pct_all",
      "magic_atk_pct_all",
      "atk_speed_pct_all",
      "gold_per_kill",
      "fusion_jackpot_pct",
    ]),
    value: num,
    description: optText,
  }),
  z.object({
    kind: z.literal("active"),
    name: nameSchema,
    cooldown: nonNeg,
    effect: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("buff_all"),
        stat: z.enum(["atk_pct", "magic_atk_pct", "atk_speed_pct", "crit_chance"]),
        value: num,
        duration: positive,
      }),
      z.object({
        type: z.literal("damage_area"),
        damage: nonNeg,
        damageType: damageTypeSchema,
        radius: positive,
      }),
      z.object({ type: z.literal("gold_grant"), value: nonNeg }),
    ]),
    description: optText,
  }),
]);

const jobSchema = z.object({
  id: idSchema,
  name: nameSchema,
  synergyRegion: optText,
  skills: z.array(jobSkillSchema),
  appearance: appearanceSchema.optional(),
  description: optText,
});

const gachaSchema = z.object({
  id: idSchema,
  name: nameSchema,
  cost: nonNeg,
  rates: z.partialRecord(gradeSchema, nonNeg),
  regionMode: z.enum(["any", "select", "fixed"]),
  fixedRegion: optText,
  description: optText,
});

const pointSchema = z.object({ x: int, y: int });

const mapSchema = z.object({
  id: idSchema,
  name: nameSchema,
  region: optText,
  cols: int.min(1, "1 이상이어야 합니다").max(60, "60 이하여야 합니다"),
  rows: int.min(1, "1 이상이어야 합니다").max(60, "60 이하여야 합니다"),
  tiles: z.array(z.array(z.enum(["empty", "buildable", "path", "blocked"]))),
  paths: z
    .array(z.array(pointSchema))
    .max(3, "경로는 최대 3개입니다"),
  description: optText,
});

const waveDefSchema = z.object({
  groups: z.array(
    z.object({
      enemyId: z.string().min(1, "적을 선택하세요"),
      count: int.min(0, "0 이상이어야 합니다"),
      interval: nonNeg,
      delay: nonNeg.optional(),
    })
  ),
  bossId: optText,
  hpMult: positive.optional(),
  goldMult: nonNeg.optional(),
  missionId: optText,
  description: optText,
});

const stageSchema = z.object({
  id: idSchema,
  name: nameSchema,
  waves: int.min(1, "1 이상이어야 합니다"),
  enemyIds: z.array(z.string()),
  bossId: optText,
  hpMult: positive,
  goldMult: nonNeg,
  waveDefs: z.array(waveDefSchema).optional(),
  description: optText,
});

const chapterSchema = z.object({
  id: idSchema,
  name: nameSchema,
  region: optText,
  mapId: z.string().min(1, "맵을 선택하세요"),
  stages: z.array(stageSchema).min(1, "스테이지가 1개 이상 필요합니다"),
  description: optText,
});

const missionSchema = z.object({
  id: idSchema,
  name: nameSchema,
  condition: z.discriminatedUnion("type", [
    z.object({ type: z.literal("no_leak") }),
    z.object({ type: z.literal("clear_within"), seconds: positive }),
    z.object({ type: z.literal("no_job_skill") }),
    z.object({ type: z.literal("max_placed"), count: int.min(0, "0 이상이어야 합니다") }),
    z.object({ type: z.literal("boss_within"), seconds: positive }),
  ]),
  rewardGold: nonNeg,
  waveFilter: z.enum(["any", "normal", "boss"]),
  minWave: int.min(1, "1 이상이어야 합니다").optional(),
  description: optText,
});

export const ENTITY_SCHEMAS: Record<EntityKind, z.ZodType> = {
  maps: mapSchema,
  jobs: jobSchema,
  towers: towerSchema,
  enemies: enemySchema,
  synergies: synergySchema,
  gachas: gachaSchema,
  chapters: chapterSchema,
  missions: missionSchema,
};

// ============================================================
// 유틸
// ============================================================

function formatPath(path: PropertyKey[]): string {
  let out = "";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else out += out ? `.${String(p)}` : String(p);
  }
  return out;
}

/** 뽑기 1회의 판매 환급 기대값 (확률 가중 평균) */
export function gachaRefundExpectation(rates: Partial<Record<Grade, number>>): number {
  const total = GRADE_ORDER.reduce((s, g) => s + Math.max(0, rates[g] ?? 0), 0);
  if (total <= 0) return 0;
  return GRADE_ORDER.reduce(
    (s, g) => s + (Math.max(0, rates[g] ?? 0) / total) * sellRefund(g),
    0
  );
}

/**
 * 뽑자마자 팔아도 이득인지 (골드 무한 증식) — 직업 할인까지 반영한 실제 비용 기준
 * @returns 이득이면 { refund, cost }, 아니면 null
 */
export function gachaSellExploit(
  g: GameData["gachas"][number],
  job: GameData["jobs"][number] | null
): { refund: number; cost: number } | null {
  const refund = gachaRefundExpectation(g.rates);
  const cost = gachaCost(g, job);
  return refund > cost ? { refund, cost } : null;
}

/** 빈 문자열은 "미지정"으로 취급 */
function present(v: string | undefined | null): v is string {
  return typeof v === "string" && v.trim() !== "";
}

type Push = (level: IssueLevel, path: string, message: string) => void;

// ============================================================
// 항목 검증 (스키마 + 나가는 참조)
// ============================================================

/**
 * 항목 1개 검증
 * @param bundle 참조 검사용 전체 데이터 (검사 대상 항목이 반영된 상태여야 정확)
 */
export function validateItem(
  kind: EntityKind,
  item: unknown,
  bundle: GameData
): ValidationIssue[] {
  const id =
    item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
      ? (item as { id: string }).id
      : "";
  const issues: ValidationIssue[] = [];
  const push: Push = (level, path, message) => issues.push({ level, kind, id, path, message });

  const parsed = ENTITY_SCHEMAS[kind].safeParse(item);
  if (!parsed.success) {
    for (const iss of parsed.error.issues) push("error", formatPath(iss.path), iss.message);
    // 스키마가 깨진 상태에서는 참조 검사가 의미 없음
    return issues;
  }

  switch (kind) {
    case "maps":
      checkMap(item as GameData["maps"][number], push);
      break;
    case "towers":
      checkTower(item as GameData["towers"][number], bundle, push);
      break;
    case "enemies":
      checkEnemy(item as GameData["enemies"][number], bundle, push);
      break;
    case "synergies":
      checkSynergy(item as GameData["synergies"][number], push);
      break;
    case "jobs":
      checkJob(item as GameData["jobs"][number], bundle, push);
      break;
    case "gachas":
      checkGacha(item as GameData["gachas"][number], bundle, push);
      break;
    case "chapters":
      checkChapter(item as GameData["chapters"][number], bundle, push);
      break;
    case "missions":
      checkMission(item as GameData["missions"][number], push);
      break;
  }
  return issues;
}

function synergyRegions(bundle: GameData): Set<string> {
  return new Set(bundle.synergies.map((s) => s.region));
}

function checkMap(map: GameData["maps"][number], push: Push) {
  if (map.tiles.length !== map.rows) {
    push("error", "tiles", `타일 줄 수(${map.tiles.length})가 rows(${map.rows})와 다릅니다`);
  }
  map.tiles.forEach((row, y) => {
    if (row.length !== map.cols) {
      push("error", `tiles[${y}]`, `타일 칸 수(${row.length})가 cols(${map.cols})와 다릅니다`);
    }
  });
  if (map.paths.length === 0) {
    push("warning", "paths", "경로가 없어 게임에 사용할 수 없습니다");
  }
  map.paths.forEach((path, pi) => {
    if (path.length < 2) {
      push("error", `paths[${pi}]`, "경로는 출발지와 도착지를 포함해 2개 이상의 지점이 필요합니다");
    }
    path.forEach((p, i) => {
      if (p.x < 0 || p.y < 0 || p.x >= map.cols || p.y >= map.rows) {
        push("error", `paths[${pi}][${i}]`, `맵 밖의 지점입니다 (${p.x}, ${p.y})`);
      }
    });
  });
  const buildable = map.tiles.some((row) => row.includes("buildable"));
  if (!buildable) push("warning", "tiles", "건설 가능 타일이 없습니다");
}

function checkTower(t: GameData["towers"][number], bundle: GameData, push: Push) {
  const regions = synergyRegions(bundle);
  if (t.regions.length === 0) push("warning", "regions", "지역(시너지)이 없습니다 — 지역 뽑기·합성 상속에서 제외됩니다");
  if (new Set(t.regions).size !== t.regions.length) push("error", "regions", "같은 지역이 중복되어 있습니다");
  t.regions.forEach((r, i) => {
    if (!regions.has(r)) push("warning", `regions[${i}]`, `'${r}' 지역의 시너지 정의가 없어 시너지가 발동하지 않습니다`);
  });
  if (t.atk <= 0 && t.magicAtk <= 0) push("warning", "atk", "물리/마법 공격력이 모두 0입니다");
  if (t.maxMana > 0 && t.manaRegen <= 0 && t.manaOnHit <= 0) {
    push("warning", "maxMana", "마나 회복/획득이 0이라 스킬이 발동하지 않습니다");
  }
  if (t.appearance.sprite && !present(t.appearance.sprite.src)) {
    push("warning", "appearance.sprite.src", "스프라이트 시트 이미지 경로가 비어 있습니다");
  }
}

function checkEnemy(e: GameData["enemies"][number], bundle: GameData, push: Push) {
  const byId = new Map(bundle.enemies.map((x) => [x.id, x]));
  byId.set(e.id, e);
  (e.traits ?? []).forEach((tr, i) => {
    if (tr.type !== "split") return;
    const child = byId.get(tr.enemyId);
    if (!child) {
      push("error", `traits[${i}].enemyId`, `존재하지 않는 적 id: ${tr.enemyId}`);
      return;
    }
    // 분열 사슬 순환 검사 (A→A, A→B→A ...) — 무한 분열 방지
    const seen = new Set([e.id]);
    let cur: string | undefined = tr.enemyId;
    while (cur) {
      if (seen.has(cur)) {
        push("error", `traits[${i}].enemyId`, `분열이 순환합니다 (${[...Array.from(seen), cur].join(" → ")}) — 무한 분열`);
        break;
      }
      seen.add(cur);
      const next: GameData["enemies"][number] | undefined = byId.get(cur);
      const split = next?.traits?.find((x) => x.type === "split");
      cur = split && split.type === "split" ? split.enemyId : undefined;
    }
    if (child.isBoss) push("warning", `traits[${i}].enemyId`, "보스로 분열합니다");
  });
  if (e.appearance.sprite && !present(e.appearance.sprite.src)) {
    push("warning", "appearance.sprite.src", "스프라이트 시트 이미지 경로가 비어 있습니다");
  }
}

function checkSynergy(s: GameData["synergies"][number], push: Push) {
  for (let i = 1; i < s.tiers.length; i++) {
    if (s.tiers[i].count <= s.tiers[i - 1].count) {
      push("error", `tiers[${i}].count`, "단계 인원 수는 이전 단계보다 커야 합니다 (오름차순)");
    }
  }
  s.tiers.forEach((tier, i) => {
    if (tier.effects.length === 0) push("warning", `tiers[${i}].effects`, "효과가 없는 단계입니다");
  });
}

function checkJob(j: GameData["jobs"][number], bundle: GameData, push: Push) {
  if (present(j.synergyRegion) && !synergyRegions(bundle).has(j.synergyRegion)) {
    push("warning", "synergyRegion", `'${j.synergyRegion}' 지역의 시너지 정의가 없습니다`);
  }
  // 뽑기 할인으로 인해 할인 없이는 안전한 뽑기가 판매 이득으로 바뀌는 경우
  const skillIdx = j.skills.findIndex((s) => s.kind === "passive" && s.type === "gacha_discount_pct");
  if (skillIdx < 0) return;
  for (const g of bundle.gachas) {
    if (gachaSellExploit(g, null)) continue; // 할인과 무관한 문제는 뽑기 쪽에서 경고
    const ex = gachaSellExploit(g, j);
    if (ex) {
      push(
        "warning",
        `skills[${skillIdx}]`,
        `할인 적용 시 '${g.name}' 비용 ${ex.cost}G < 판매 환급 기대값 ${ex.refund.toFixed(1)}G — 이 직업으로 뽑기→판매 반복 시 골드 무한 증식`
      );
    }
  }
}

function checkGacha(g: GameData["gachas"][number], bundle: GameData, push: Push) {
  const total = GRADE_ORDER.reduce((s, gr) => s + (g.rates[gr] ?? 0), 0);
  if (total <= 0) push("error", "rates", "등급별 확률 합계가 0입니다");
  if (g.regionMode === "fixed") {
    if (!present(g.fixedRegion)) {
      push("error", "fixedRegion", "고정 지역을 지정하세요");
    } else if (!bundle.towers.some((t) => t.regions.includes(g.fixedRegion!))) {
      push("warning", "fixedRegion", `'${g.fixedRegion}' 지역 캐릭터가 없어 뽑기가 항상 실패합니다`);
    }
  }
  if (total > 0) {
    // 뽑자마자 팔아도 이득이면 골드 무한 증식 — 할인 없는 비용, 그다음 직업 할인 비용 순으로 검사
    const base = gachaSellExploit(g, null);
    const byJob = base
      ? null
      : bundle.jobs
          .map((j) => ({ job: j, ex: gachaSellExploit(g, j) }))
          .find((x) => x.ex !== null);
    const ex = base ?? byJob?.ex;
    if (ex) {
      push(
        "warning",
        "cost",
        `판매 환급 기대값 ${ex.refund.toFixed(1)}G가 비용 ${ex.cost}G${byJob ? ` (직업 '${byJob.job.name}' 할인 적용)` : ""}보다 큽니다 — 뽑기→판매 반복으로 골드가 무한히 늘어납니다`
      );
    }
    const pool = g.regionMode === "fixed" && present(g.fixedRegion)
      ? bundle.towers.filter((t) => t.regions.includes(g.fixedRegion!))
      : bundle.towers;
    for (const gr of GRADE_ORDER) {
      if ((g.rates[gr] ?? 0) > 0 && !pool.some((t) => t.grade === gr)) {
        push("warning", `rates.${gr}`, `해당 등급 캐릭터가 없습니다 — 이 확률만큼 뽑기가 실패합니다`);
      }
    }
  }
}

function checkChapter(c: GameData["chapters"][number], bundle: GameData, push: Push) {
  const enemies = new Map(bundle.enemies.map((e) => [e.id, e]));
  const missions = new Set(bundle.missions.map((m) => m.id));
  if (!bundle.maps.some((m) => m.id === c.mapId)) {
    push("error", "mapId", `존재하지 않는 맵 id: ${c.mapId}`);
  }
  const stageIds = new Set<string>();
  c.stages.forEach((st, si) => {
    const base = `stages[${si}]`;
    if (stageIds.has(st.id)) push("error", `${base}.id`, `스테이지 id 중복: ${st.id}`);
    stageIds.add(st.id);

    st.enemyIds.forEach((eid, i) => {
      const e = enemies.get(eid);
      if (!e) push("error", `${base}.enemyIds[${i}]`, `존재하지 않는 적 id: ${eid}`);
      else if (e.isBoss) push("warning", `${base}.enemyIds[${i}]`, `보스(${e.name})는 일반 적 목록에서 무시됩니다`);
    });
    if (present(st.bossId)) {
      const b = enemies.get(st.bossId);
      if (!b) push("error", `${base}.bossId`, `존재하지 않는 적 id: ${st.bossId}`);
      else if (!b.isBoss) push("warning", `${base}.bossId`, `${b.name}은(는) 보스로 지정되지 않은 적입니다`);
    }
    st.waveDefs?.forEach((wd, wi) => {
      const wbase = `${base}.waveDefs[${wi}]`;
      wd.groups.forEach((g, gi) => {
        if (!enemies.has(g.enemyId)) push("error", `${wbase}.groups[${gi}].enemyId`, `존재하지 않는 적 id: ${g.enemyId}`);
      });
      if (present(wd.bossId) && !enemies.has(wd.bossId)) {
        push("error", `${wbase}.bossId`, `존재하지 않는 적 id: ${wd.bossId}`);
      }
      if (present(wd.missionId) && !missions.has(wd.missionId)) {
        push("error", `${wbase}.missionId`, `존재하지 않는 미션 id: ${wd.missionId}`);
      }
      const spawns = wd.groups.reduce((s, g) => s + g.count, 0);
      if (spawns === 0 && !present(wd.bossId)) {
        push("warning", wbase, `웨이브 ${wi + 1}에 등장하는 적이 없습니다 (즉시 클리어)`);
      }
    });
  });
}

function checkMission(m: GameData["missions"][number], push: Push) {
  if (m.condition.type === "boss_within" && m.waveFilter === "normal") {
    push("warning", "waveFilter", "보스 처치 미션이 일반 웨이브 전용이라 배정되지 않습니다");
  }
}

// ============================================================
// 들어오는 참조 (삭제 / id 변경 시 무결성)
// ============================================================

export interface Reference {
  kind: EntityKind;
  id: string;
  name: string;
  path: string;
}

/** kind/id 항목을 참조하는 다른 항목 목록 */
export function findReferences(kind: EntityKind, id: string, bundle: GameData): Reference[] {
  const refs: Reference[] = [];
  if (kind === "maps") {
    for (const c of bundle.chapters) {
      if (c.mapId === id) refs.push({ kind: "chapters", id: c.id, name: c.name, path: "mapId" });
    }
  }
  if (kind === "enemies") {
    for (const c of bundle.chapters) {
      c.stages.forEach((st, si) => {
        const base = `stages[${si}]`;
        if (st.enemyIds.includes(id)) refs.push({ kind: "chapters", id: c.id, name: c.name, path: `${base}.enemyIds` });
        if (st.bossId === id) refs.push({ kind: "chapters", id: c.id, name: c.name, path: `${base}.bossId` });
        st.waveDefs?.forEach((wd, wi) => {
          if (wd.bossId === id || wd.groups.some((g) => g.enemyId === id)) {
            refs.push({ kind: "chapters", id: c.id, name: c.name, path: `${base}.waveDefs[${wi}]` });
          }
        });
      });
    }
    for (const e of bundle.enemies) {
      if (e.id === id) continue;
      if (e.traits?.some((tr) => tr.type === "split" && tr.enemyId === id)) {
        refs.push({ kind: "enemies", id: e.id, name: e.name, path: "traits(split)" });
      }
    }
  }
  if (kind === "missions") {
    for (const c of bundle.chapters) {
      c.stages.forEach((st, si) =>
        st.waveDefs?.forEach((wd, wi) => {
          if (wd.missionId === id) {
            refs.push({ kind: "chapters", id: c.id, name: c.name, path: `stages[${si}].waveDefs[${wi}].missionId` });
          }
        })
      );
    }
  }
  return refs;
}

// ============================================================
// 전체 데이터 검증 (데이터 점검 / 가져오기)
// ============================================================

export function validateBundle(bundle: GameData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const kind of ENTITY_KINDS) {
    const items = bundle[kind] as unknown[];
    if (!Array.isArray(items)) {
      issues.push({ level: "error", kind, id: "", path: "", message: "배열이어야 합니다" });
      continue;
    }
    const seen = new Set<string>();
    for (const item of items) {
      const id = (item as { id?: string })?.id ?? "";
      if (id && seen.has(id)) {
        issues.push({ level: "error", kind, id, path: "id", message: `중복 id: ${id}` });
      }
      seen.add(id);
      issues.push(...validateItem(kind, item, bundle));
    }
  }
  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/** 사람이 읽는 한 줄 요약 (API 오류 메시지용) */
export function summarizeIssues(issues: ValidationIssue[]): string {
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length === 0) return "";
  const first = errors[0];
  const where = [first.id, first.path].filter(Boolean).join(" · ");
  return `검증 실패 ${errors.length}건 — ${where ? `${where}: ` : ""}${first.message}`;
}
