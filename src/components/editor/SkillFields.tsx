"use client";

import type { SkillDef, SkillType } from "@/game/types";
import { NumberField, SelectField, TextField } from "./crud";

const SKILL_TYPES: { value: SkillType; label: string }[] = [
  { value: "nuke", label: "단일 강타 (nuke)" },
  { value: "aoe", label: "범위 피해 (aoe)" },
  { value: "slow", label: "범위 둔화 (slow)" },
  { value: "stun", label: "기절 (stun)" },
  { value: "chain", label: "연쇄 공격 (chain)" },
  { value: "buff_atkspeed", label: "공속 버프 (buff)" },
];

const DAMAGE_TYPES = [
  { value: "physical", label: "물리" },
  { value: "magical", label: "마법" },
];

export default function SkillFields({
  value,
  onChange,
}: {
  value: SkillDef;
  onChange: (v: SkillDef) => void;
}) {
  const set = <K extends keyof SkillDef>(k: K, v: SkillDef[K]) =>
    onChange({ ...value, [k]: v });

  const t = value.type;

  return (
    <fieldset className="rounded border border-slate-800 p-2">
      <legend className="px-1 text-xs font-bold text-slate-400">
        스킬 (마나가 가득 차면 자동 발동)
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TextField label="스킬 이름" value={value.name} onChange={(v) => set("name", v)} />
        <SelectField
          label="종류"
          value={value.type}
          onChange={(v) => set("type", v as SkillType)}
          options={SKILL_TYPES}
        />
        <SelectField
          label="피해 타입"
          value={value.damageType}
          onChange={(v) => set("damageType", v as SkillDef["damageType"])}
          options={DAMAGE_TYPES}
        />
        <NumberField
          label="계수 (공격력 대비 %)"
          value={value.power}
          onChange={(v) => set("power", v)}
        />
        {(t === "aoe" || t === "slow") && (
          <NumberField
            label="반경 (타일)"
            value={value.radius ?? 1.5}
            onChange={(v) => set("radius", v)}
            step={0.1}
          />
        )}
        {(t === "slow" || t === "stun" || t === "buff_atkspeed") && (
          <NumberField
            label="지속시간 (초)"
            value={value.duration ?? 2}
            onChange={(v) => set("duration", v)}
            step={0.5}
          />
        )}
        {t === "slow" && (
          <NumberField
            label="둔화율 (%)"
            value={value.slowPct ?? 30}
            onChange={(v) => set("slowPct", v)}
          />
        )}
        {t === "chain" && (
          <NumberField
            label="추가 대상 수"
            value={value.bonusTargets ?? 2}
            onChange={(v) => set("bonusTargets", v)}
          />
        )}
        {t === "buff_atkspeed" && (
          <NumberField
            label="공속 증가 (%)"
            value={value.buffPct ?? 50}
            onChange={(v) => set("buffPct", v)}
          />
        )}
      </div>
      <div className="mt-2">
        <TextField
          label="스킬 설명"
          value={value.description ?? ""}
          onChange={(v) => set("description", v)}
        />
      </div>
    </fieldset>
  );
}
