"use client";

import type { EnemyDef, EnemyTrait, EnemyTraitType } from "@/game/types";
import { NumberField, SelectField } from "./crud";

const TRAIT_OPTIONS: { value: EnemyTraitType; label: string }[] = [
  { value: "regen", label: "재생 (초당 최대체력 % 회복)" },
  { value: "stealth", label: "은신 (가까운 타워만 타겟 가능)" },
  { value: "split", label: "분열 (사망 시 자식 스폰)" },
  { value: "aura_defense", label: "방어 오라 (주변 적 방어 증가)" },
  { value: "slow_immune", label: "둔화 면역" },
  { value: "stun_immune", label: "기절 면역" },
];

function blankTrait(type: EnemyTraitType, enemies: EnemyDef[]): EnemyTrait {
  switch (type) {
    case "regen":
      return { type, pctPerSec: 1 };
    case "stealth":
      return { type, revealRange: 1.5 };
    case "split":
      return { type, enemyId: enemies[0]?.id ?? "", count: 2 };
    case "aura_defense":
      return { type, radius: 1.5, defense: 20, magicDefense: 20 };
    case "slow_immune":
    case "stun_immune":
      return { type };
  }
}

export default function TraitFields({
  value,
  onChange,
  enemies,
}: {
  value: EnemyTrait[];
  onChange: (v: EnemyTrait[]) => void;
  /** 분열 자식 선택용 적 목록 */
  enemies: EnemyDef[];
}) {
  const update = (i: number, t: EnemyTrait) =>
    onChange(value.map((x, xi) => (xi === i ? t : x)));

  return (
    <fieldset className="space-y-2 rounded border border-slate-800 p-2">
      <legend className="px-1 text-xs font-bold text-slate-400">적 특성</legend>
      {value.map((tr, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded bg-slate-900/60 p-2">
          <div className="w-56">
            <SelectField
              label="특성"
              value={tr.type}
              onChange={(v) => update(i, blankTrait(v as EnemyTraitType, enemies))}
              options={TRAIT_OPTIONS}
            />
          </div>
          {tr.type === "regen" && (
            <div className="w-32">
              <NumberField label="초당 회복 %" value={tr.pctPerSec} onChange={(v) => update(i, { ...tr, pctPerSec: v })} step={0.1} />
            </div>
          )}
          {tr.type === "stealth" && (
            <div className="w-32">
              <NumberField label="노출 거리 (타일)" value={tr.revealRange} onChange={(v) => update(i, { ...tr, revealRange: v })} step={0.1} />
            </div>
          )}
          {tr.type === "split" && (
            <>
              <div className="w-44">
                <SelectField
                  label="자식 적"
                  value={tr.enemyId}
                  onChange={(v) => update(i, { ...tr, enemyId: v })}
                  options={enemies.map((e) => ({ value: e.id, label: e.name }))}
                />
              </div>
              <div className="w-24">
                <NumberField label="수" value={tr.count} onChange={(v) => update(i, { ...tr, count: v })} />
              </div>
            </>
          )}
          {tr.type === "aura_defense" && (
            <>
              <div className="w-24">
                <NumberField label="반경" value={tr.radius} onChange={(v) => update(i, { ...tr, radius: v })} step={0.5} />
              </div>
              <div className="w-24">
                <NumberField label="방어 +" value={tr.defense} onChange={(v) => update(i, { ...tr, defense: v })} />
              </div>
              <div className="w-24">
                <NumberField label="마방 +" value={tr.magicDefense} onChange={(v) => update(i, { ...tr, magicDefense: v })} />
              </div>
            </>
          )}
          <button className="btn btn-danger ml-auto" onClick={() => onChange(value.filter((_, xi) => xi !== i))}>
            ×
          </button>
        </div>
      ))}
      <button className="btn text-xs" onClick={() => onChange([...value, blankTrait("regen", enemies)])}>
        + 특성 추가
      </button>
    </fieldset>
  );
}
