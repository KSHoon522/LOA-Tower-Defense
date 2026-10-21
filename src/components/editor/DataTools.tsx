"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ENTITY_KINDS, ENTITY_LABEL } from "@/game/constants";
import type { EntityKind } from "@/game/types";
import type { ValidationIssue } from "@/game/validate";
import {
  ApiError,
  fetchBundleReport,
  importBundle,
  type BundleReport,
  type DataBundleFile,
} from "@/lib/api";
import { IssueList } from "./crud";

/** 파일 저장 (브라우저 다운로드) */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** 종류별로 묶은 검증 결과 */
function IssuesByKind({ issues }: { issues: ValidationIssue[] }) {
  const kinds = ENTITY_KINDS.filter((k) => issues.some((i) => i.kind === k));
  return (
    <div className="space-y-2">
      {kinds.map((k) => (
        <div key={k}>
          <Link href={`/editor/${k}`} className="text-xs font-bold text-slate-300 hover:text-amber-400">
            {ENTITY_LABEL[k]} →
          </Link>
          <IssueList issues={issues.filter((i) => i.kind === k)} showItem />
        </div>
      ))}
    </div>
  );
}

/**
 * 에디터 허브의 데이터 도구
 * - 데이터 점검: 전체 데이터를 검증해 오류/경고 목록 표시
 * - 내보내기: 전체 데이터를 JSON 파일 하나로 저장 (백업, 다른 PC/버전으로 이동)
 * - 가져오기: 파일에 들어 있는 종류만 교체 — 먼저 미리 검증하고 확인 후 저장
 */
export default function DataTools() {
  const [report, setReport] = useState<(BundleReport & { file: DataBundleFile }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    name: string;
    file: DataBundleFile;
    preview: BundleReport & { replaced: EntityKind[] };
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setReport(await fetchBundleReport());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const doExport = async () => {
    setBusy(true);
    try {
      const fresh = await fetchBundleReport();
      setReport(fresh);
      download(`rotadi-data-${stamp()}.json`, JSON.stringify(fresh.file, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기 실패");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (f: File) => {
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const parsed = JSON.parse(await f.text()) as DataBundleFile;
      const preview = await importBundle(parsed, true);
      setPending({ name: f.name, file: parsed, preview });
    } catch (e) {
      setPending(null);
      setError(
        e instanceof SyntaxError
          ? "JSON 파일을 읽을 수 없습니다"
          : e instanceof Error
            ? e.message
            : "가져오기 실패"
      );
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await importBundle(pending.file, false);
      setMessage(`가져오기 완료: ${res.replaced.map((k) => ENTITY_LABEL[k]).join(", ")} 교체`);
      setPending(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기 실패");
      if (e instanceof ApiError && pending) {
        setPending({ ...pending, preview: { ...pending.preview, issues: e.issues } });
      }
    } finally {
      setBusy(false);
    }
  };

  const errors = report?.issues.filter((i) => i.level === "error").length ?? 0;
  const warnings = report?.issues.filter((i) => i.level === "warning").length ?? 0;
  const pendingErrors = pending?.preview.issues.filter((i) => i.level === "error").length ?? 0;

  return (
    <div className="grid gap-3">
      {/* 데이터 점검 */}
      <div className="panel space-y-2">
        <div className="flex items-center">
          <h2 className="font-bold">📋 데이터 점검</h2>
          <button className="btn ml-auto px-2 py-1 text-xs" onClick={refresh} disabled={busy}>
            다시 검사
          </button>
        </div>
        {report ? (
          <>
            <div className="flex flex-wrap gap-1 text-[11px] text-slate-400">
              {ENTITY_KINDS.map((k) => (
                <span key={k} className="rounded bg-slate-800 px-1.5 py-0.5">
                  {ENTITY_LABEL[k]} {report.counts[k] ?? 0}
                </span>
              ))}
            </div>
            <div className="text-sm">
              {errors === 0 && warnings === 0 ? (
                <span className="text-emerald-400">✓ 문제 없음</span>
              ) : (
                <>
                  <span className={errors > 0 ? "font-bold text-red-400" : "text-slate-400"}>
                    오류 {errors}
                  </span>
                  {" · "}
                  <span className={warnings > 0 ? "font-bold text-amber-300" : "text-slate-400"}>
                    경고 {warnings}
                  </span>
                </>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              <IssuesByKind issues={report.issues} />
            </div>
            <p className="text-[10px] text-slate-500">
              오류는 에디터에서 저장이 막히는 문제, 경고는 동작은 하지만 확인이 필요한 데이터입니다.
            </p>
          </>
        ) : (
          !error && <p className="animate-pulse text-xs text-slate-500">검사 중...</p>
        )}
      </div>

      {/* 내보내기 / 가져오기 */}
      <div className="panel space-y-2">
        <h2 className="font-bold">💾 백업 — 내보내기 / 가져오기</h2>
        <p className="text-[11px] text-slate-400">
          전체 데이터를 JSON 파일 하나로 내려받거나, 내보낸 파일을 다시 적용합니다. 가져오기는 파일에
          들어 있는 종류만 교체하고, 저장 전에 전체 데이터를 검증합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={doExport} disabled={busy}>
            ⬇ 내보내기
          </button>
          <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
            ⬆ 가져오기...
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {error && <div className="text-xs text-red-400">{error}</div>}
        {message && <div className="text-xs text-emerald-400">{message}</div>}

        {pending && (
          <div className="space-y-2 rounded border border-slate-700 bg-slate-950 p-2">
            <div className="text-xs">
              <b>{pending.name}</b> — 교체 대상:{" "}
              {pending.preview.replaced
                .map((k) => `${ENTITY_LABEL[k]} ${report?.counts[k] ?? 0}→${pending.preview.counts[k] ?? 0}`)
                .join(", ")}
            </div>
            <div className="max-h-56 overflow-y-auto">
              {pending.preview.issues.length === 0 ? (
                <span className="text-xs text-emerald-400">✓ 검증 통과</span>
              ) : (
                <IssuesByKind issues={pending.preview.issues} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-primary"
                disabled={busy || pendingErrors > 0}
                onClick={() => {
                  if (confirm("현재 데이터를 덮어씁니다. 계속할까요? (git으로 되돌릴 수 있습니다)")) doImport();
                }}
              >
                가져오기 실행
              </button>
              <button className="btn" onClick={() => setPending(null)} disabled={busy}>
                취소
              </button>
              {pendingErrors > 0 && (
                <span className="text-xs text-red-400">오류 {pendingErrors}건을 고친 파일만 가져올 수 있습니다</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
