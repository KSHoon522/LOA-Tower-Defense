"use client";

import { useState } from "react";
import type { Appearance, SpriteAnim, SpriteSheet } from "@/game/types";
import { CheckField, NumberField, SelectField, TextField } from "./crud";

const SHAPES = [
  { value: "circle", label: "원" },
  { value: "square", label: "사각형" },
  { value: "triangle", label: "삼각형" },
  { value: "diamond", label: "다이아" },
  { value: "star", label: "별" },
];

const ANIM_KEYS: { key: keyof SpriteSheet["animations"]; label: string; required?: boolean }[] = [
  { key: "idle", label: "대기 (idle)", required: true },
  { key: "attack", label: "공격 (attack)" },
  { key: "skill", label: "스킬 (skill)" },
  { key: "walk", label: "이동 (walk, 적)" },
  { key: "death", label: "사망 (death)" },
];

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "업로드 실패");
  return body.path as string;
}

function UploadButton({ onUploaded, label }: { onUploaded: (p: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="btn cursor-pointer whitespace-nowrap text-xs">
      {busy ? "업로드 중..." : label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setErr(null);
          try {
            onUploaded(await uploadImage(f));
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "실패");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      {err && <span className="ml-1 text-red-400">{err}</span>}
    </label>
  );
}

function AnimRow({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: SpriteAnim | undefined;
  required?: boolean;
  onChange: (v: SpriteAnim | undefined) => void;
}) {
  const enabled = !!value;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded bg-slate-900/60 p-1.5">
      <div className="w-32 pb-1.5">
        {required ? (
          <span className="text-xs font-bold text-slate-300">{label}</span>
        ) : (
          <CheckField
            label={label}
            value={enabled}
            onChange={(v) => onChange(v ? { row: 0, frames: 4, fps: 8 } : undefined)}
          />
        )}
      </div>
      {value && (
        <>
          <div className="w-20">
            <NumberField label="줄(row)" value={value.row} onChange={(v) => onChange({ ...value, row: v })} />
          </div>
          <div className="w-20">
            <NumberField label="프레임 수" value={value.frames} onChange={(v) => onChange({ ...value, frames: v })} />
          </div>
          <div className="w-20">
            <NumberField label="fps" value={value.fps} onChange={(v) => onChange({ ...value, fps: v })} />
          </div>
        </>
      )}
    </div>
  );
}

export default function AppearanceFields({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (v: Appearance) => void;
}) {
  const sprite = value.sprite;
  const setSprite = (s: SpriteSheet | undefined) => onChange({ ...value, sprite: s });

  return (
    <fieldset className="space-y-2 rounded border border-slate-800 p-2">
      <legend className="px-1 text-xs font-bold text-slate-400">
        외형 — 우선순위: 스프라이트 시트 &gt; 단일 이미지 &gt; 도형 placeholder
      </legend>

      {/* placeholder */}
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
        <CheckField
          label="방향 따라 좌우 반전"
          value={value.flipToFace ?? true}
          onChange={(v) => onChange({ ...value, flipToFace: v })}
        />
      </div>

      {/* 단일 이미지 */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            label="단일 이미지 경로"
            value={value.image ?? ""}
            onChange={(v) => onChange({ ...value, image: v || undefined })}
            placeholder="/characters/xxx.png"
          />
        </div>
        <UploadButton label="📤 업로드" onUploaded={(p) => onChange({ ...value, image: p })} />
        {value.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.image} alt="" className="h-10 w-10 rounded border border-slate-700 object-contain" />
        )}
      </div>

      {/* 스프라이트 시트 */}
      <div className="rounded border border-slate-800 p-2">
        <CheckField
          label="스프라이트 시트 사용 (애니메이션)"
          value={!!sprite}
          onChange={(v) =>
            setSprite(
              v
                ? {
                    src: "",
                    frameWidth: 64,
                    frameHeight: 64,
                    scale: 1,
                    facing: "right",
                    animations: { idle: { row: 0, frames: 4, fps: 6 } },
                  }
                : undefined
            )
          }
        />
        {sprite && (
          <div className="mt-2 space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="시트 이미지 경로"
                  value={sprite.src}
                  onChange={(v) => setSprite({ ...sprite, src: v })}
                  placeholder="/characters/xxx-sheet.png"
                />
              </div>
              <UploadButton label="📤 시트 업로드" onUploaded={(p) => setSprite({ ...sprite, src: p })} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <NumberField label="프레임 가로(px)" value={sprite.frameWidth} onChange={(v) => setSprite({ ...sprite, frameWidth: v })} />
              <NumberField label="프레임 세로(px)" value={sprite.frameHeight} onChange={(v) => setSprite({ ...sprite, frameHeight: v })} />
              <NumberField label="렌더 배율" value={sprite.scale ?? 1} onChange={(v) => setSprite({ ...sprite, scale: v })} step={0.1} />
              <SelectField
                label="시트 기본 방향"
                value={sprite.facing ?? "right"}
                onChange={(v) => setSprite({ ...sprite, facing: v as "left" | "right" })}
                options={[
                  { value: "right", label: "오른쪽" },
                  { value: "left", label: "왼쪽" },
                ]}
              />
            </div>
            <div className="space-y-1">
              {ANIM_KEYS.map(({ key, label, required }) => (
                <AnimRow
                  key={key}
                  label={label}
                  required={required}
                  value={sprite.animations[key]}
                  onChange={(v) => {
                    const animations = { ...sprite.animations };
                    if (v) animations[key] = v;
                    else if (key !== "idle") delete animations[key];
                    setSprite({ ...sprite, animations });
                  }}
                />
              ))}
            </div>
            {sprite.src && (
              <div className="overflow-auto rounded border border-slate-700 bg-slate-950 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sprite.src} alt="sheet" className="max-h-40" style={{ imageRendering: "pixelated" }} />
              </div>
            )}
            <p className="text-[10px] text-slate-500">
              시트 형식: 가로로 프레임을 나열하고, 줄(row)마다 다른 애니메이션. 없는 애니메이션은 대기(idle)로
              대체됩니다. 프롬프트 가이드는 docs/image-prompts.md 참고.
            </p>
          </div>
        )}
      </div>
    </fieldset>
  );
}
