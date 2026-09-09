"use client";

import { useMemo, useState } from "react";
import {
  ChipsField,
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { DEFAULT_REGIONS } from "@/game/constants";
import type { ChapterDef, EnemyDef, MapDef, StageDef, SynergyDef } from "@/game/types";

function blankStage(n: number): StageDef {
  return {
    id: `stage-${n}`,
    name: `스테이지 ${n}`,
    waves: 10,
    enemyIds: [],
    bossId: "",
    hpMult: 1,
    goldMult: 1,
    description: "",
  };
}

function blank(): ChapterDef {
  return {
    id: "",
    name: "",
    region: "",
    mapId: "",
    stages: [blankStage(1)],
    description: "",
  };
}

function StageRow({
  stage,
  enemies,
  onChange,
  onRemove,
}: {
  stage: StageDef;
  enemies: EnemyDef[];
  onChange: (s: StageDef) => void;
  onRemove: () => void;
}) {
  const normals = enemies.filter((e) => !e.isBoss);
  const bosses = enemies.filter((e) => e.isBoss);
  const enemyName = (id: string) => enemies.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <TextField
          label="스테이지 ID"
          value={stage.id}
          onChange={(v) => onChange({ ...stage, id: v })}
        />
        <TextField
          label="이름"
          value={stage.name}
          onChange={(v) => onChange({ ...stage, name: v })}
        />
        <NumberField
          label="웨이브 수"
          value={stage.waves}
          onChange={(v) => onChange({ ...stage, waves: v })}
        />
        <NumberField
          label="체력 배수"
          value={stage.hpMult}
          onChange={(v) => onChange({ ...stage, hpMult: v })}
          step={0.1}
        />
        <NumberField
          label="골드 배수"
          value={stage.goldMult}
          onChange={(v) => onChange({ ...stage, goldMult: v })}
          step={0.1}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_200px]">
        <ChipsField
          label="등장 적 (일반)"
          value={stage.enemyIds}
          onChange={(v) => onChange({ ...stage, enemyIds: v })}
          options={normals.map((e) => e.id)}
          placeholder="+ 적 추가..."
          hint={
            stage.enemyIds.length > 0
              ? stage.enemyIds.map(enemyName).join(", ")
              : "비어있으면 모든 일반 적이 등장합니다"
          }
        />
        <SelectField
          label="보스 (보스 웨이브)"
          value={stage.bossId ?? ""}
          onChange={(v) => onChange({ ...stage, bossId: v || undefined })}
          options={[
            { value: "", label: "(전체 보스 풀)" },
            ...bosses.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="설명"
            value={stage.description ?? ""}
            onChange={(v) => onChange({ ...stage, description: v })}
          />
        </div>
        <button className="btn btn-danger" onClick={onRemove}>
          스테이지 삭제
        </button>
      </div>
    </div>
  );
}

export default function ChaptersEditor() {
  const { items, save, remove, error, busy } = useCrud<ChapterDef>("chapters");
  const { items: maps } = useCrud<MapDef>("maps");
  const { items: enemies } = useCrud<EnemyDef>("enemies");
  const { items: synergies } = useCrud<SynergyDef>("synergies");
  const [draft, setDraft] = useState<ChapterDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof ChapterDef>(k: K, v: ChapterDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const regionOptions = useMemo(() => {
    const set = new Set<string>(synergies.map((s) => s.region));
    if (set.size === 0) DEFAULT_REGIONS.forEach((r) => set.add(r));
    return Array.from(set);
  }, [synergies]);

  const valid = draft.id && draft.name && draft.mapId && draft.stages.length > 0;

  return (
    <EditorLayout
      title="📖 챕터 / 스테이지 에디터"
      error={error}
      list={
        <div className="space-y-1">
          <button
            className="btn btn-primary mb-2 w-full"
            onClick={() => {
              setDraft(blank());
              setIsNew(true);
            }}
          >
            + 새 챕터
          </button>
          {items.map((c) => (
            <button
              key={c.id}
              className={`btn w-full text-left text-xs ${draft.id === c.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(c));
                setIsNew(false);
              }}
            >
              📖 {c.name}{" "}
              <span className="text-slate-500">({c.stages.length}스테이지)</span>
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="ch-xxx" disabled={!isNew} />
            <TextField label="챕터 이름" value={draft.name} onChange={(v) => set("name", v)} />
            <SelectField
              label="챕터 지역 (테마)"
              value={draft.region ?? ""}
              onChange={(v) => set("region", v || undefined)}
              options={[
                { value: "", label: "(없음)" },
                ...regionOptions.map((r) => ({ value: r, label: r })),
              ]}
            />
            <SelectField
              label="맵"
              value={draft.mapId}
              onChange={(v) => set("mapId", v)}
              options={[
                { value: "", label: "맵 선택..." },
                ...maps.map((m) => ({ value: m.id, label: `${m.name} (${m.cols}×${m.rows})` })),
              ]}
            />
          </div>

          <fieldset className="space-y-2 rounded border border-slate-800 p-2">
            <legend className="px-1 text-xs font-bold text-slate-400">
              스테이지 목록 (스테이지마다 등장 적/웨이브/배수 다르게 설정)
            </legend>
            {draft.stages.map((stage, i) => (
              <StageRow
                key={i}
                stage={stage}
                enemies={enemies}
                onChange={(ns) =>
                  set(
                    "stages",
                    draft.stages.map((s, si) => (si === i ? ns : s))
                  )
                }
                onRemove={() =>
                  set(
                    "stages",
                    draft.stages.filter((_, si) => si !== i)
                  )
                }
              />
            ))}
            <button
              className="btn"
              onClick={() => set("stages", [...draft.stages, blankStage(draft.stages.length + 1)])}
            >
              + 스테이지 추가
            </button>
          </fieldset>

          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />

          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={busy || !valid} onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}>
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
            {!valid && (
              <span className="text-xs text-slate-500">ID·이름·맵·스테이지 1개 이상 필요</span>
            )}
          </div>
        </div>
      }
    />
  );
}
