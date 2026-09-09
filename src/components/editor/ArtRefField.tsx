"use client";

import { useState } from "react";
import type { Grade } from "@/game/types";
import { buildPrompt, type PromptKind } from "@/lib/prompt";

/**
 * 이미지 생성 참고 설명(artRef) 입력 + 완성 프롬프트 생성/복사
 * docs/character-references.md 의 PROMPT 줄을 붙여넣는 용도
 */
export default function ArtRefField({
  name,
  value,
  onChange,
  grade,
  defaultKind,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  grade?: Grade;
  defaultKind: PromptKind;
}) {
  const [kind, setKind] = useState<PromptKind>(defaultKind);
  const [frameSize, setFrameSize] = useState(64);
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const p = buildPrompt({ name, artRef: value, grade, kind, frameSize });
    setOutput(p);
    setCopied(false);
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      /* clipboard 미지원 시 텍스트 영역에서 직접 복사 */
    }
  };

  return (
    <fieldset className="space-y-2 rounded border border-slate-800 p-2">
      <legend className="px-1 text-xs font-bold text-slate-400">
        🎨 이미지 생성 참고 설명 (실제 로스트아크 캐릭터 외형 — 영문 권장)
      </legend>
      <textarea
        className="input font-mono text-xs"
        rows={3}
        value={value}
        placeholder="예) young golden-haired knight king in polished silver plate armor with a white cape, broken longsword projecting a golden energy blade"
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[10px] text-slate-500">
        캐릭터별 디스크립터는 <code>docs/character-references.md</code>에서 복사하세요. 공통 스타일(카봇풍)과
        등급/역할 키워드는 버튼이 자동으로 붙입니다.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto text-xs"
          value={kind}
          onChange={(e) => setKind(e.target.value as PromptKind)}
        >
          <option value="portrait">단일 이미지 (아군)</option>
          <option value="sheet">스프라이트 시트</option>
          <option value="enemy">적 (일반)</option>
          <option value="boss">적 (보스)</option>
        </select>
        {kind === "sheet" && (
          <select
            className="input w-auto text-xs"
            value={frameSize}
            onChange={(e) => setFrameSize(Number(e.target.value))}
          >
            <option value={64}>64px 프레임</option>
            <option value={128}>128px 프레임</option>
          </select>
        )}
        <button className="btn btn-primary text-xs" onClick={generate} disabled={!value.trim()}>
          📋 프롬프트 생성
        </button>
        {output && (
          <button className="btn text-xs" onClick={copy}>
            {copied ? "✓ 복사됨" : "복사"}
          </button>
        )}
      </div>
      {output && (
        <textarea
          className="input font-mono text-[11px] text-slate-300"
          rows={7}
          readOnly
          value={output}
          onFocus={(e) => e.target.select()}
        />
      )}
    </fieldset>
  );
}
