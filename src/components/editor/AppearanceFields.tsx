"use client";

import type { Appearance } from "@/game/types";
import { SelectField, TextField } from "./crud";

const SHAPES = [
  { value: "circle", label: "원" },
  { value: "square", label: "사각형" },
  { value: "triangle", label: "삼각형" },
  { value: "diamond", label: "다이아" },
  { value: "star", label: "별" },
];

export default function AppearanceFields({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (v: Appearance) => void;
}) {
  return (
    <fieldset className="rounded border border-slate-800 p-2">
      <legend className="px-1 text-xs font-bold text-slate-400">
        외형 (placeholder — 이미지 등록 시 이미지 우선)
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="label">색상</label>
          <input
            type="color"
            className="input h-8 p-0.5"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
          />
        </div>
        <SelectField
          label="모양"
          value={value.shape}
          onChange={(v) => onChange({ ...value, shape: v as Appearance["shape"] })}
          options={SHAPES}
        />
        <TextField
          label="아이콘(이모지)"
          value={value.icon}
          onChange={(v) => onChange({ ...value, icon: v })}
          placeholder="⚔️"
        />
        <TextField
          label="이미지 경로"
          value={value.image ?? ""}
          onChange={(v) => onChange({ ...value, image: v || undefined })}
          placeholder="/characters/xxx.png"
        />
      </div>
    </fieldset>
  );
}
