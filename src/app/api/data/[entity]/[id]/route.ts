import { NextRequest, NextResponse } from "next/server";
import { deleteItem, isEntityKind, readAll, updateItem } from "@/lib/dataStore";

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

export async function PUT(req: NextRequest, { params }: Params) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const updated = await updateItem(params.entity, params.id, body);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "수정 실패" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    await deleteItem(params.entity, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "삭제 실패" },
      { status: 400 }
    );
  }
}
