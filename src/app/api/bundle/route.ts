import { NextRequest, NextResponse } from "next/server";
import { ENTITY_KINDS, readBundle, writeAll } from "@/lib/dataStore";
import { hasErrors, summarizeIssues, validateBundle } from "@/game/validate";
import type { EntityKind, GameData } from "@/game/types";

export const dynamic = "force-dynamic";

function countsOf(bundle: GameData): Partial<Record<EntityKind, number>> {
  return Object.fromEntries(ENTITY_KINDS.map((k) => [k, bundle[k].length]));
}

/** 전체 데이터 내보내기 + 데이터 점검 결과 */
export async function GET() {
  const bundle = await readBundle();
  return NextResponse.json({
    file: {
      format: "rotadi-data",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: bundle,
    },
    issues: validateBundle(bundle),
    counts: countsOf(bundle),
  });
}

/**
 * 가져오기: 파일에 포함된 종류(kind)만 교체하고 나머지는 유지.
 * - 교체 후의 전체 데이터를 검증해 오류가 있으면 저장하지 않음
 * - ?dryRun=1 이면 검증 결과만 반환
 */
export async function PUT(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 파일이 아닙니다" }, { status: 400 });
  }
  // 내보내기 파일 형식 또는 { maps: [...], ... } 형태 모두 허용
  const raw =
    body && typeof body === "object" && (body as { format?: string }).format === "rotadi-data"
      ? (body as { data?: unknown }).data
      : body;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "데이터가 비어 있습니다" }, { status: 400 });
  }

  const provided = ENTITY_KINDS.filter((k) => k in (raw as object));
  if (provided.length === 0) {
    return NextResponse.json(
      { error: `가져올 데이터가 없습니다 (${ENTITY_KINDS.join(", ")} 중 하나 이상 필요)` },
      { status: 400 }
    );
  }
  for (const k of provided) {
    if (!Array.isArray((raw as Record<string, unknown>)[k])) {
      return NextResponse.json({ error: `${k}는 배열이어야 합니다` }, { status: 400 });
    }
  }

  const current = await readBundle();
  const merged = { ...current } as GameData;
  for (const k of provided) {
    (merged as unknown as Record<string, unknown[]>)[k] = (raw as Record<string, unknown[]>)[k];
  }
  const issues = validateBundle(merged);
  const result = { issues, counts: countsOf(merged), replaced: provided };

  if (dryRun) return NextResponse.json(result);
  if (hasErrors(issues)) {
    return NextResponse.json({ error: summarizeIssues(issues), ...result }, { status: 400 });
  }
  for (const k of provided) await writeAll(k, merged[k]);
  return NextResponse.json(result);
}
