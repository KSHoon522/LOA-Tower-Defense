import { NextRequest, NextResponse } from "next/server";
import { createItem, isEntityKind, readAll } from "@/lib/dataStore";

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

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  if (!isEntityKind(params.entity)) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const created = await createItem(params.entity, body);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "생성 실패" },
      { status: 400 }
    );
  }
}
