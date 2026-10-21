"use client";

import { useState } from "react";
import {
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import type { SynergyDef, SynergyEffectType, SynergyTier } from "@/game/types";

const EFFECT_TYPES: { value: SynergyEffectType; label: string }[] = [
  { value: "atk_pct", label: "공격력 %" },
  { value: "magic_atk_pct", label: "마법 공격력 %" },
  { value: "atk_speed_pct", label: "공격속도 %" },
  { value: "crit_chance", label: "치명타 확률 %p" },
  { value: "crit_damage_pct", label: "치명타 피해 %p" },
  { value: "mana_regen_pct", label: "마나 회복 %" },
  { value: "range_add", label: "사거리 +타일" },
  { value: "gold_per_kill", label: "처치당 골드" },
];

function blank(): SynergyDef {
  return {
    id: "",
    region: "",
    name: "",
    color: "#38bdf8",
    tiers: [{ count: 2, effects: [{ type: "atk_pct", value: 15 }] }],
    description: "",
  };
}

function TierRow({
  tier,
  onChange,
  onRemove,
}: {
  tier: SynergyTier;
  onChange: (t: SynergyTier) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
      <div className="flex items-end gap-2">
        <div className="w-32">
          <NumberField
            label="필요 캐릭터 수"
            value={tier.count}
            onChange={(v) => onChange({ ...tier, count: v })}
          />
        </div>
        <button className="btn btn-danger ml-auto" onClick={onRemove}>
          단계 삭제
        </button>
      </div>
      <div className="mt-2 space-y-1">
        {tier.effects.map((eff, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField
                label={i === 0 ? "효과" : ""}
                value={eff.type}
                onChange={(v) =>
                  onChange({
                    ...tier,
                    effects: tier.effects.map((e, ei) =>
                      ei === i ? { ...e, type: v as SynergyEffectType } : e
                    ),
                  })
                }
                options={EFFECT_TYPES}
              />
            </div>
            <div className="w-28">
              <NumberField
                label={i === 0 ? "수치" : ""}
                value={eff.value}
                onChange={(v) =>
                  onChange({
                    ...tier,
                    effects: tier.effects.map((e, ei) =>
                      ei === i ? { ...e, value: v } : e
                    ),
                  })
                }
                step={0.5}
              />
            </div>
            <button
              className="btn"
              onClick={() =>
                onChange({ ...tier, effects: tier.effects.filter((_, ei) => ei !== i) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="btn text-xs"
          onClick={() =>
            onChange({ ...tier, effects: [...tier.effects, { type: "atk_pct", value: 10 }] })
          }
        >
          + 효과 추가
        </button>
      </div>
    </div>
  );
}

export default function SynergiesEditor() {
  const { items, save, remove, error, issues, clearIssues, busy } = useCrud<SynergyDef>("synergies");
  const [draft, setDraft] = useState<SynergyDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof SynergyDef>(k: K, v: SynergyDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <EditorLayout
      title="🔗 시너지 에디터"
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
            + 새 시너지
          </button>
          {items.map((s) => (
            <button
              key={s.id}
              className={`btn w-full text-left text-xs ${draft.id === s.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(s));
                setIsNew(false);
              }}
            >
              <span style={{ color: s.color }}>●</span> {s.region} · {s.name}
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="syn-xxx" disabled={!isNew} />
            <TextField label="지역 이름" value={draft.region} onChange={(v) => set("region", v)} placeholder="슈샤이어" />
            <TextField label="시너지 이름" value={draft.name} onChange={(v) => set("name", v)} />
            <div>
              <label className="label">색상</label>
              <input
                type="color"
                className="input h-8 p-0.5"
                value={draft.color ?? "#38bdf8"}
                onChange={(e) => set("color", e.target.value)}
              />
            </div>
          </div>

          <fieldset className="space-y-2 rounded border border-slate-800 p-2">
            <legend className="px-1 text-xs font-bold text-slate-400">
              단계별 효과 (발동 시 아군 전체 적용)
            </legend>
            {draft.tiers.map((tier, i) => (
              <TierRow
                key={i}
                tier={tier}
                onChange={(nt) =>
                  set(
                    "tiers",
                    draft.tiers.map((t, ti) => (ti === i ? nt : t))
                  )
                }
                onRemove={() =>
                  set(
                    "tiers",
                    draft.tiers.filter((_, ti) => ti !== i)
                  )
                }
              />
            ))}
            <button
              className="btn"
              onClick={() =>
                set("tiers", [
                  ...draft.tiers,
                  {
                    count: (draft.tiers[draft.tiers.length - 1]?.count ?? 0) + 2,
                    effects: [{ type: "atk_pct", value: 10 }],
                  },
                ])
              }
            >
              + 단계 추가
            </button>
          </fieldset>

          <TextField label="설명 (게임 화면 툴팁에 표시)" value={draft.description ?? ""} onChange={(v) => set("description", v)} />
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              disabled={busy || !draft.id || !draft.name || !draft.region || draft.tiers.length === 0}
              onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}
            >
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
