import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;
const DIR = path.join(process.cwd(), "public", "characters");

/**
 * 캐릭터 이미지/스프라이트 시트 업로드
 * multipart/form-data: file
 * → public/characters/<안전한 파일명> 저장, { path: "/characters/..." } 반환
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file 필드가 필요합니다" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "png/jpg/webp/gif만 가능합니다" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "8MB 이하만 가능합니다" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || ".png";
    const base = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
      .slice(0, 60) || "image";
    await fs.mkdir(DIR, { recursive: true });

    // 중복 시 -2, -3 ... 접미사
    let name = `${base}${ext}`;
    let n = 2;
    while (await exists(path.join(DIR, name))) {
      name = `${base}-${n++}${ext}`;
    }

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(DIR, name), buf);
    return NextResponse.json({ path: `/characters/${name}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 실패" },
      { status: 500 }
    );
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
