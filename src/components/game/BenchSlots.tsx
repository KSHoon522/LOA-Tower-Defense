"use client";

import GradeSlot from "@/components/ui/GradeSlot";
import type { GameEngine } from "@/game/engine";
import type { TowerUnit } from "@/game/types";

/**
 * 대기석: 정해진 칸 수만큼 소켓을 그리고, 유닛이 있으면 등급 슬롯으로 표시
 * 새로 들어온 유닛은 소환 연출(빛나며 튀어나옴)로 등장
 */
export default function BenchSlots({
  engine,
  units,
  capacity,
  size,
  selectedUid,
  fusionCandidates,
  fusionTargetUid,
  onPointerDown,
  onClick,
  onContextMenu,
}: {
  engine: GameEngine;
  units: TowerUnit[];
  capacity: number;
  size: number;
  selectedUid: string | null;
  fusionCandidates: Set<string>;
  fusionTargetUid: string | null;
  onPointerDown: (uid: string, e: React.PointerEvent) => void;
  onClick: (uid: string, e: React.MouseEvent) => void;
  onContextMenu: (uid: string, e: React.MouseEvent) => void;
}) {
  const sockets = Math.max(capacity, units.length);
  return (
    <>
      {Array.from({ length: sockets }, (_, i) => {
        const unit = units[i];
        if (!unit) {
          return (
            <div
              key={`empty-${i}`}
              className="well shrink-0 rounded-[14px]"
              style={{ width: size, height: size }}
            />
          );
        }
        const def = engine.towerDefs.get(unit.defId);
        if (!def) return null;
        const selected = selectedUid === unit.uid;
        return (
          <div
            key={unit.uid}
            className={`shrink-0 animate-summon touch-none transition-transform duration-200 ease-spring ${
              selected ? "-translate-y-2 rotate-[-4deg]" : "hover:-translate-y-1"
            }`}
            onPointerDown={(e) => onPointerDown(unit.uid, e)}
            onClick={(e) => onClick(unit.uid, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(unit.uid, e);
            }}
            title={`${def.name} — ${def.skill.name}`}
          >
            <GradeSlot
              grade={def.grade}
              appearance={def.appearance}
              size={size}
              selected={selected || fusionTargetUid === unit.uid}
              dashed={fusionCandidates.has(unit.uid) && fusionTargetUid !== unit.uid}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-line/70 px-0.5 pb-px pt-px">
                <div className="truncate text-center text-[10px] leading-tight text-parchment-50">{def.name}</div>
              </div>
            </GradeSlot>
          </div>
        );
      })}
    </>
  );
}
