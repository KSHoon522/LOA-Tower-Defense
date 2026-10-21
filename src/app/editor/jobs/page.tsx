"use client";

import { useMemo, useState } from "react";
import AppearanceFields from "@/components/editor/AppearanceFields";
import {
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { DEFAULT_REGIONS } from "@/game/constants";
import type {
  DamageType,
  JobActiveSkill,
  JobBuffStat,
  JobDef,
  JobPassiveSkill,
  JobPassiveType,
  JobSkill,
  SynergyDef,
} from "@/game/types";

const PASSIVE_TYPES: { value: JobPassiveType; label: string }[] = [
  { value: "start_gold", label: "시작 골드 +" },
  { value: "extra_lives", label: "목숨 +" },
  { value: "gacha_discount_pct", label: "뽑기 비용 할인 %" },
  { value: "crit_chance_all", label: "전체 치명타 확률 +%p" },
  { value: "atk_pct_all", label: "전체 물리 공격력 %" },
  { value: "magic_atk_pct_all", label: "전체 마법 공격력 %" },
  { value: "atk_speed_pct_all", label: "전체 공격속도 %" },
  { value: "gold_per_kill", label: "처치당 골드 +" },
  { value: "fusion_jackpot_pct", label: "합성 대성공 확률 +%p" },
];

const ACTIVE_EFFECT_TYPES = [
  { value: "buff_all", label: "아군 전체 일시 강화" },
  { value: "damage_area", label: "범위 피해 (클릭 시전)" },
  { value: "gold_grant", label: "즉시 골드 획득" },
];

const BUFF_STATS: { value: JobBuffStat; label: string }[] = [
  { value: "atk_pct", label: "물리 공격력 %" },
  { value: "magic_atk_pct", label: "마법 공격력 %" },
  { value: "atk_speed_pct", label: "공격속도 %" },
  { value: "crit_chance", label: "치명타 확률 %p" },
];

function blankPassive(): JobPassiveSkill {
  return { kind: "passive", name: "새 패시브", type: "start_gold", value: 20 };
}

function blankActive(): JobActiveSkill {
  return {
    kind: "active",
    name: "새 액티브",
    cooldown: 30,
    effect: { type: "buff_all", stat: "atk_pct", value: 30, duration: 5 },
  };
}

function blank(): JobDef {
  return {
    id: "",
    name: "",
    synergyRegion: "",
    skills: [blankPassive()],
    appearance: { color: "#f59e0b", shape: "circle", icon: "🧙" },
    description: "",
  };
}

// ---- 스킬 1개 편집 행 ----
function SkillRow({
  skill,
  onChange,
  onRemove,
}: {
  skill: JobSkill;
  onChange: (s: JobSkill) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField
          label="구분"
          value={skill.kind}
          onChange={(v) => onChange(v === "passive" ? blankPassive() : blankActive())}
          options={[
            { value: "passive", label: "패시브" },
            { value: "active", label: "액티브" },
          ]}
        />
        <TextField
          label="스킬 이름"
          value={skill.name}
          onChange={(v) => onChange({ ...skill, name: v })}
        />

        {skill.kind === "passive" && (
          <>
            <SelectField
              label="효과"
              value={skill.type}
              onChange={(v) => onChange({ ...skill, type: v as JobPassiveType })}
              options={PASSIVE_TYPES}
            />
            <NumberField
              label="수치"
              value={skill.value}
              onChange={(v) => onChange({ ...skill, value: v })}
            />
          </>
        )}

        {skill.kind === "active" && (
          <>
            <NumberField
              label="쿨다운 (초)"
              value={skill.cooldown}
              onChange={(v) => onChange({ ...skill, cooldown: v })}
            />
            <SelectField
              label="효과 종류"
              value={skill.effect.type}
              onChange={(v) => {
                const effect =
                  v === "buff_all"
                    ? ({ type: "buff_all", stat: "atk_pct", value: 30, duration: 5 } as const)
                    : v === "damage_area"
                      ? ({ type: "damage_area", damage: 200, damageType: "physical" as DamageType, radius: 2 } as const)
                      : ({ type: "gold_grant", value: 50 } as const);
                onChange({ ...skill, effect });
              }}
              options={ACTIVE_EFFECT_TYPES}
            />
          </>
        )}
      </div>

      {/* 액티브 효과 상세 */}
      {skill.kind === "active" && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {skill.effect.type === "buff_all" && (
            <>
              <SelectField
                label="강화 스탯"
                value={skill.effect.stat}
                onChange={(v) =>
                  onChange({
                    ...skill,
                    effect: { ...skill.effect, stat: v as JobBuffStat } as JobActiveSkill["effect"],
                  })
                }
                options={BUFF_STATS}
              />
              <NumberField
                label="수치"
                value={skill.effect.value}
                onChange={(v) =>
                  onChange({ ...skill, effect: { ...skill.effect, value: v } as JobActiveSkill["effect"] })
                }
              />
              <NumberField
                label="지속시간 (초)"
                value={skill.effect.duration}
                onChange={(v) =>
                  onChange({ ...skill, effect: { ...skill.effect, duration: v } as JobActiveSkill["effect"] })
                }
              />
            </>
          )}
          {skill.effect.type === "damage_area" && (
            <>
              <NumberField
                label="피해량"
                value={skill.effect.damage}
                onChange={(v) =>
                  onChange({ ...skill, effect: { ...skill.effect, damage: v } as JobActiveSkill["effect"] })
                }
              />
              <SelectField
                label="피해 타입"
                value={skill.effect.damageType}
                onChange={(v) =>
                  onChange({
                    ...skill,
                    effect: { ...skill.effect, damageType: v as DamageType } as JobActiveSkill["effect"],
                  })
                }
                options={[
                  { value: "physical", label: "물리" },
                  { value: "magical", label: "마법" },
                ]}
              />
              <NumberField
                label="반경 (타일)"
                value={skill.effect.radius}
                onChange={(v) =>
                  onChange({ ...skill, effect: { ...skill.effect, radius: v } as JobActiveSkill["effect"] })
                }
                step={0.5}
              />
            </>
          )}
          {skill.effect.type === "gold_grant" && (
            <NumberField
              label="골드"
              value={skill.effect.value}
              onChange={(v) =>
                onChange({ ...skill, effect: { ...skill.effect, value: v } as JobActiveSkill["effect"] })
              }
            />
          )}
        </div>
      )}

      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="스킬 설명"
            value={skill.description ?? ""}
            onChange={(v) => onChange({ ...skill, description: v })}
          />
        </div>
        <button className="btn btn-danger" onClick={onRemove}>
          스킬 삭제
        </button>
      </div>
    </div>
  );
}

export default function JobsEditor() {
  const { items, save, remove, error, issues, clearIssues, busy } = useCrud<JobDef>("jobs");
  const { items: synergies } = useCrud<SynergyDef>("synergies");
  const [draft, setDraft] = useState<JobDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof JobDef>(k: K, v: JobDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const regionOptions = useMemo(() => {
    const set = new Set<string>(synergies.map((s) => s.region));
    if (set.size === 0) DEFAULT_REGIONS.forEach((r) => set.add(r));
    return Array.from(set);
  }, [synergies]);

  return (
    <EditorLayout
      title="🧙 플레이어 직업 에디터"
      error={error}
      issues={issues}
      onDismiss={clearIssues}
      list={
        <div className="space-y-1">
          <button
            className="btn btn-primary mb-2 w-full"
            onClick={() => {
              setDraft(blank());
              setIsNew(true);
            }}
          >
            + 새 직업
          </button>
          {items.map((j) => (
            <button
              key={j.id}
              className={`btn w-full text-left text-xs ${draft.id === j.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(j));
                setIsNew(false);
              }}
            >
              {j.appearance?.icon} {j.name}
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="job-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
            <SelectField
              label="시너지 지역 (카운트 +1)"
              value={draft.synergyRegion ?? ""}
              onChange={(v) => set("synergyRegion", v || undefined)}
              options={[
                { value: "", label: "(없음)" },
                ...regionOptions.map((r) => ({ value: r, label: r })),
              ]}
            />
          </div>

          <fieldset className="space-y-2 rounded border border-slate-800 p-2">
            <legend className="px-1 text-xs font-bold text-slate-400">
              고유 능력 (패시브 = 상시 적용 / 액티브 = 쿨다운 버튼 스킬)
            </legend>
            {draft.skills.map((s, i) => (
              <SkillRow
                key={i}
                skill={s}
                onChange={(ns) =>
                  set(
                    "skills",
                    draft.skills.map((x, xi) => (xi === i ? ns : x))
                  )
                }
                onRemove={() =>
                  set(
                    "skills",
                    draft.skills.filter((_, xi) => xi !== i)
                  )
                }
              />
            ))}
            <div className="flex gap-2">
              <button className="btn" onClick={() => set("skills", [...draft.skills, blankPassive()])}>
                + 패시브 추가
              </button>
              <button className="btn" onClick={() => set("skills", [...draft.skills, blankActive()])}>
                + 액티브 추가
              </button>
            </div>
          </fieldset>

          {draft.appearance && (
            <AppearanceFields value={draft.appearance} onChange={(v) => set("appearance", v)} />
          )}
          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || !draft.id || !draft.name} onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}>
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}
