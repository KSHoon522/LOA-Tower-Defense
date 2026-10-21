import { NextRequest, NextResponse } from "next/server";
import { createItem, isEntityKind, readAll, validateAgainstStore } from "@/lib/dataStore";
import { hasErrors, summarizeIssues } from "@/game/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { entity: string } }
) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  const items = await readAll(params.entity);
  return NextResponse.json(items);
}

/** 생성: 스키마/참조 검증 → 오류 있으면 400 + issues, 성공 시 경고(warnings)와 함께 반환 */
export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const issues = await validateAgainstStore(params.entity, body);
    if (hasErrors(issues)) {
      return NextResponse.json({ error: summarizeIssues(issues), issues }, { status: 400 });
    }
    const created = await createItem(params.entity, body);
    return NextResponse.json({ item: created, warnings: issues }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "생성 실패" },
      { status: 400 }
    );
  }
}
