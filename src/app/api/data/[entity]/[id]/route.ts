import { NextRequest, NextResponse } from "next/server";
import {
  deleteItem,
  isEntityKind,
  readAll,
  readBundle,
  updateItem,
  validateAgainstStore,
} from "@/lib/dataStore";
import { ENTITY_LABEL } from "@/game/constants";
import { findReferences, hasErrors, summarizeIssues } from "@/game/validate";

export const dynamic = "force-dynamic";

interface Params {
  params: { entity: string; id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  const items = await readAll<{ id: string }>(params.entity);
  const item = items.find((i) => i.id === params.id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

/** 수정: 스키마/참조 검증 → 오류 있으면 400 + issues, 성공 시 경고(warnings)와 함께 반환 */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const body = await req.json();
    // id 변경은 다른 데이터의 참조를 깨뜨리므로 막는다 (새로 만들고 옮긴 뒤 삭제)
    if (body?.id && body.id !== params.id) {
      return NextResponse.json({ error: "id는 변경할 수 없습니다" }, { status: 400 });
    }
    const item = { ...body, id: params.id };
    const issues = await validateAgainstStore(params.entity, item);
    if (hasErrors(issues)) {
      return NextResponse.json({ error: summarizeIssues(issues), issues }, { status: 400 });
    }
    const updated = await updateItem(params.entity, params.id, item);
    return NextResponse.json({ item: updated, warnings: issues });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "수정 실패" },
      { status: 400 }
    );
  }
}

/** 삭제: 다른 데이터가 참조 중이면 거부 (참조 목록을 issues로 반환) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const refs = findReferences(params.entity, params.id, await readBundle());
    if (refs.length > 0) {
      const issues = refs.map((r) => ({
        level: "error" as const,
        kind: r.kind,
        id: r.id,
        path: r.path,
        message: `${ENTITY_LABEL[r.kind]} '${r.name}'이(가) 참조 중`,
      }));
      return NextResponse.json(
        {
          error: `다른 데이터가 참조 중이라 삭제할 수 없습니다 (${refs.length}곳) — 참조를 먼저 정리하세요`,
          issues,
        },
        { status: 400 }
      );
    }
    await deleteItem(params.entity, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 400 }
    );
  }
}
