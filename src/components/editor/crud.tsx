"use client";

import { useCallback, useEffect, useState } from "react";
import type { EntityKind } from "@/game/types";
import type { ValidationIssue } from "@/game/validate";
import { ApiError, createEntity, deleteEntity, fetchAll, updateEntity } from "@/lib/api";

// ============================================================
// 공용 CRUD 훅
// ============================================================

export function useCrud<T extends { id: string }>(kind: EntityKind) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** 마지막 저장/삭제의 검증 결과 (실패 시 오류, 성공 시 경고) */
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchAll<T>(kind));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로딩 실패");
    }
  }, [kind]);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(
    async (item: T, isNew: boolean) => {
      setBusy(true);
      try {
        const res = isNew
          ? await createEntity(kind, item)
          : await updateEntity(kind, item.id, item);
        await reload();
        setError(null);
        setIssues(res.warnings ?? []);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
        setIssues(e instanceof ApiError ? e.issues : []);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [kind, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!confirm(`정말 삭제할까요? (${id})`)) return false;
      setBusy(true);
      try {
        await deleteEntity(kind, id);
        await reload();
        setError(null);
        setIssues([]);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "삭제 실패");
        setIssues(e instanceof ApiError ? e.issues : []);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [kind, reload]
  );

  const clearIssues = useCallback(() => {
    setIssues([]);
    setError(null);
  }, []);

  return { items, reload, save, remove, error, issues, clearIssues, busy };
}

// ============================================================
// 폼 필드 컴포넌트
// ============================================================

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        step={step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * 다중 선택 chip 필드 — 드롭다운에서 선택하면 chip이 추가되고 ×로 제거
 * (시너지 지역처럼 오타 없이 목록에서 골라야 하는 값에 사용)
 */
export function ChipsField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  hint?: string;
}) {
  const remaining = options.filter((o) => !value.includes(o));
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-700 bg-slate-950 p-1.5">
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300"
          >
            {v}
            <button
              type="button"
              className="text-amber-400 hover:text-red-400"
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
        <select
          className="min-w-24 flex-1 bg-transparent text-xs text-slate-400 outline-none"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value]);
          }}
        >
          <option value="">{placeholder ?? "+ 추가..."}</option>
          {remaining.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

// ============================================================
// 목록 + 편집 레이아웃
// ============================================================

/** 검증 결과 목록 (오류 = 빨강, 경고 = 주황) */
export function IssueList({
  issues,
  showItem,
}: {
  issues: ValidationIssue[];
  /** 항목 id까지 표시 (여러 항목을 한 번에 보여줄 때) */
  showItem?: boolean;
}) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs">
      {issues.map((iss, i) => (
        <li key={i} className={iss.level === "error" ? "text-red-400" : "text-amber-300"}>
          {iss.level === "error" ? "⛔" : "⚠"}{" "}
          {showItem && iss.id && <b className="mr-1">{iss.id}</b>}
          {iss.path && <code className="mr-1 rounded bg-slate-800 px-1 text-[10px]">{iss.path}</code>}
          {iss.message}
        </li>
      ))}
    </ul>
  );
}

export function EditorLayout({
  title,
  list,
  form,
  error,
  issues = [],
  onDismiss,
}: {
  title: string;
  list: React.ReactNode;
  form: React.ReactNode;
  error?: string | null;
  /** 저장/삭제 검증 결과 — 실패 시 오류 상세, 성공 시 경고 */
  issues?: ValidationIssue[];
  onDismiss?: () => void;
}) {
  const dismiss = onDismiss && (
    <button className="float-right px-1 text-slate-500 hover:text-slate-300" onClick={onDismiss}>
      ✕
    </button>
  );
  const warningsOnly = !error && issues.length > 0;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-amber-400">{title}</h1>
      {error && (
        <div className="panel space-y-1.5 border-red-800 text-sm text-red-400">
          {dismiss}
          <div>{error}</div>
          <IssueList issues={issues} showItem={issues.some((i) => i.kind !== issues[0].kind)} />
        </div>
      )}
      {warningsOnly && (
        <div className="panel space-y-1.5 border-amber-800/70">
          {dismiss}
          <div className="text-sm text-amber-300">저장했습니다. 확인이 필요한 경고:</div>
          <IssueList issues={issues} />
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="panel w-full lg:w-72 lg:shrink-0">{list}</div>
        <div className="panel min-w-0 flex-1">{form}</div>
      </div>
    </div>
  );
}
