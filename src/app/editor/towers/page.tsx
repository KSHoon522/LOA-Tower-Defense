"use client";

import { useMemo, useState } from "react";
import AppearanceFields from "@/components/editor/AppearanceFields";
import ArtRefField from "@/components/editor/ArtRefField";
import { cardImagePath } from "@/lib/prompt";
import SkillFields from "@/components/editor/SkillFields";
import {
  ChipsField,
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { DEFAULT_REGIONS, GRADE_LABEL, GRADE_ORDER } from "@/game/constants";
import type { Grade, SynergyDef, TowerDef } from "@/game/types";

function blank(): TowerDef {
  return {
    id: "",
    name: "",
    grade: "common",
    regions: [],
    atk: 10,
    magicAtk: 0,
    attackSpeed: 1,
    range: 2.5,
    maxMana: 60,
    manaRegen: 3,
    manaOnHit: 5,
    skill: {
      name: "새 스킬",
      type: "nuke",
      damageType: "physical",
      power: 200,
      description: "",
    },
    appearance: { color: "#facc15", shape: "circle", icon: "⭐" },
    description: "",
  };
}

export default function TowersEditor() {
  const { items, save, remove, error, issues, clearIssues, busy } = useCrud<TowerDef>("towers");
  const { items: synergies } = useCrud<SynergyDef>("synergies");
  const [draft, setDraft] = useState<TowerDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof TowerDef>(k: K, v: TowerDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // 시너지에 등록된 지역 목록 (chip 선택지)
  const regionOptions = useMemo(() => {
    const set = new Set<string>(synergies.map((s) => s.region));
    if (set.size === 0) DEFAULT_REGIONS.forEach((r) => set.add(r));
    return Array.from(set);
  }, [synergies]);

  return (
    <EditorLayout
      title="🏹 아군 캐릭터(타워) 에디터"
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
            + 새 캐릭터
          </button>
          {items.map((t) => (
            <button
              key={t.id}
              className={`btn w-full text-left text-xs ${draft.id === t.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(t));
                setIsNew(false);
              }}
            >
              {t.appearance.icon} {t.name}{" "}
              <span className="text-slate-500">
                ({GRADE_LABEL[t.grade]}/{t.regions.join(",")})
              </span>
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="tw-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
            <SelectField
              label="등급 (캐릭터 고정)"
              value={draft.grade}
              onChange={(v) => set("grade", v as Grade)}
              options={GRADE_ORDER.map((g) => ({ value: g, label: GRADE_LABEL[g] }))}
            />
          </div>
          <ChipsField
            label="시너지 지역 (여러 개 선택 가능)"
            value={draft.regions}
            onChange={(v) => set("regions", v)}
            options={regionOptions}
            placeholder="+ 지역 추가..."
            hint="시너지 에디터에 등록된 지역 목록에서 선택합니다. 새 지역이 필요하면 시너지를 먼저 만들어주세요."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumberField label="공격력" value={draft.atk} onChange={(v) => set("atk", v)} />
            <NumberField label="마법 공격력" value={draft.magicAtk} onChange={(v) => set("magicAtk", v)} />
            <NumberField label="공격속도 (회/초)" value={draft.attackSpeed} onChange={(v) => set("attackSpeed", v)} step={0.1} />
            <NumberField label="사거리 (타일)" value={draft.range} onChange={(v) => set("range", v)} step={0.1} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="최대 마나" value={draft.maxMana} onChange={(v) => set("maxMana", v)} />
            <NumberField label="마나 자연회복 (/초)" value={draft.manaRegen} onChange={(v) => set("manaRegen", v)} step={0.5} />
            <NumberField label="타격 시 마나" value={draft.manaOnHit} onChange={(v) => set("manaOnHit", v)} />
          </div>
          <SkillFields value={draft.skill} onChange={(v) => set("skill", v)} />
          <ArtRefField
            name={draft.name}
            value={draft.artRef ?? ""}
            onChange={(v) => set("artRef", v || undefined)}
            grade={draft.grade}
            defaultKind="portrait"
            cardImage={cardImagePath(draft.id, draft.name, "allies")}
          />
          <AppearanceFields value={draft.appearance} onChange={(v) => set("appearance", v)} />
          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary"
              disabled={busy || !draft.id || !draft.name || draft.regions.length === 0}
              onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}
            >
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
            {draft.regions.length === 0 && (
              <span className="text-xs text-slate-500">시너지 지역을 1개 이상 선택하세요</span>
            )}
          </div>
        </div>
      }
    />
  );
}
