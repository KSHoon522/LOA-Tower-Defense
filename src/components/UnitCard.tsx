"use client";

import { GRADE_COLOR, GRADE_LABEL } from "@/game/constants";
import type { TowerDef } from "@/game/types";

export default function UnitCard({
  def,
  selected,
  fusionCandidate,
  fusionSelected,
  onClick,
}: {
  def: TowerDef;
  selected?: boolean;
  /** 선택된 유닛과 합성 가능 (점선 표시) */
  fusionCandidate?: boolean;
  /** 합성 대상으로 지정됨 */
  fusionSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-md border-2 bg-slate-900 transition-transform hover:scale-105 ${
        selected ? "ring-2 ring-green-400" : ""
      } ${fusionSelected ? "ring-2 ring-orange-400" : ""} ${
        fusionCandidate && !fusionSelected ? "border-dashed !border-amber-400" : ""
      }`}
      style={{ borderColor: GRADE_COLOR[def.grade] }}
      title={`${def.name} (${GRADE_LABEL[def.grade]} / ${def.regions.join(", ")})\n${def.skill.name}: ${def.skill.description ?? ""}`}
    >
      <span className="text-xl leading-none">{def.appearance.icon}</span>
      <span className="mt-0.5 w-full truncate px-0.5 text-center text-[9px] text-slate-300">
        {def.name}
      </span>
      <span
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded px-1 text-[8px] font-bold text-slate-950"
        style={{ backgroundColor: GRADE_COLOR[def.grade] }}
      >
        {GRADE_LABEL[def.grade]}
      </span>
    </button>
  );
}
