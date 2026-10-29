#!/usr/bin/env node
/**
 * 등록된 캐릭터(아군·적·보스)의 로스트아크 카드 일러스트를 references/cards/에 내려받는다
 * - 캐릭터 이미지 생성 프롬프트에 첨부하기 위한 로컬 참고 자료
 * - 이미지 저작권은 스마일게이트에 있으므로 저장소에는 올리지 않는다 (.gitignore)
 * - 카드 코드는 캐릭터 id에서 읽음 (tw-c3200500 → 3200500), 인벤 카드 DB 상세 페이지에서 일러스트 주소를 찾음
 * - 이미 받은 파일은 건너뛰고, 아군↔적처럼 분류가 바뀌어 남은 옛 파일은 지움
 *
 * 사용: npm run cards            (다시 받으려면 npm run cards -- --force)
 *       프록시 뒤라면 NODE_USE_ENV_PROXY=1 npm run cards  (Node 22.21+ / 24+)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "references", "cards");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 4;

/** 카드 코드가 id에 없는 캐릭터 */
const SPECIAL_CODES = { "tw-esther-luteran": "3200018" };
const GRADE_LABEL = { common: "일반", uncommon: "고급", rare: "희귀", hero: "영웅", legendary: "전설" };
const GROUPS = [
  { dir: "allies", label: "아군" },
  { dir: "enemies", label: "적" },
  { dir: "bosses", label: "보스" },
];
const HEADERS = { "User-Agent": "Mozilla/5.0", Referer: "https://lostark.inven.co.kr/" };
const IMAGE_RE = /\/\/static\.inven\.co\.kr\/image_2011\/site_image\/lostark\/cardimage\/[^"'?\s]+\.png/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readData = async (file) => JSON.parse(await fs.readFile(path.join(ROOT, "data", file), "utf8"));
const cardCode = (id) => SPECIAL_CODES[id] ?? /^(?:tw|en)-c(\d+)$/.exec(id)?.[1] ?? null;
/** 파일 이름에 못 쓰는 문자 제거 (윈도우 포함) */
const safeName = (s) => s.replace(/[<>:"/\\|?*]/g, "_").trim();
const fileExists = (f) => fs.access(f).then(() => true, () => false);

/** 인벤 연결이 가끔 끊겨 몇 번 다시 시도 */
async function retry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(1000 * i);
    }
  }
}

async function findImageUrl(code) {
  const html = await retry(async () => {
    const res = await fetch(`https://lostark.inven.co.kr/dataninfo/card/?code=${code}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`카드 페이지 HTTP ${res.status}`);
    return res.text();
  });
  const m = IMAGE_RE.exec(html);
  return m ? `https:${m[0]}` : null;
}

async function download(url, file) {
  const buf = await retry(async () => {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`이미지 HTTP ${res.status}`);
    const b = Buffer.from(await res.arrayBuffer());
    // PNG 시그니처 확인 (중간에 끊긴 응답 걸러냄)
    if (b.length < 1000 || b.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG가 아님");
    return b;
  });
  await fs.writeFile(file, buf);
}

async function main() {
  const towers = await readData("towers.json");
  const enemies = await readData("enemies.json");
  const items = [
    ...towers.map((t) => ({
      group: "allies",
      def: t,
      info: [GRADE_LABEL[t.grade] ?? t.grade, (t.regions ?? []).join(", ")].filter(Boolean).join(" · "),
    })),
    ...enemies.map((e) => ({ group: e.isBoss ? "bosses" : "enemies", def: e, info: e.isBoss ? "보스" : "일반 적" })),
  ];
  for (const g of GROUPS) await fs.mkdir(path.join(OUT, g.dir), { recursive: true });

  for (const it of items) {
    it.code = cardCode(it.def.id);
    it.file = it.code ? `${it.group}/${safeName(it.def.name)}_${it.code}.png` : null;
  }

  let next = 0;
  let done = 0;
  const counts = { 받음: 0, 있음: 0, 실패: 0, 없음: 0 };
  const failures = [];
  async function worker() {
    while (next < items.length) {
      const it = items[next++];
      let status;
      try {
        if (!it.file) {
          status = "없음";
        } else if (!FORCE && (await fileExists(path.join(OUT, it.file)))) {
          status = "있음";
        } else {
          const url = await findImageUrl(it.code);
          if (!url) {
            status = "없음";
          } else {
            await download(url, path.join(OUT, it.file));
            status = "받음";
          }
        }
      } catch (err) {
        status = "실패";
        failures.push(`${it.def.name} (${it.def.id}): ${err.message}`);
      }
      counts[status]++;
      done++;
      if (status !== "있음") console.log(`[${done}/${items.length}] ${status} ${it.def.name}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 분류가 바뀌거나 삭제된 캐릭터의 옛 파일 정리 (이번에 실패한 캐릭터의 기존 파일은 남김)
  const keep = new Set(items.filter((it) => it.file).map((it) => it.file));
  let removed = 0;
  for (const g of GROUPS) {
    for (const f of await fs.readdir(path.join(OUT, g.dir))) {
      if (f.endsWith(".png") && !keep.has(`${g.dir}/${f}`)) {
        await fs.unlink(path.join(OUT, g.dir, f));
        removed++;
      }
    }
  }

  for (const it of items) {
    if (it.file && !(await fileExists(path.join(OUT, it.file)))) it.file = null;
  }
  await writeIndex(items);
  console.log(
    `\n카드 일러스트: 새로 받음 ${counts.받음} · 이미 있음 ${counts.있음} · 카드 없음 ${counts.없음} · 실패 ${counts.실패}` +
      (removed ? ` · 옛 파일 정리 ${removed}` : ""),
  );
  console.log(`저장 위치: ${path.relative(ROOT, OUT)}/ (목록: README.md, index.json)`);
  if (failures.length) {
    console.log("\n실패한 캐릭터 (다시 실행하면 이어서 받음):\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exitCode = 1;
  }
}

/** 프롬프트에 붙여 쓰기 좋게 이미지 + 외형 설명(artRef) 목록 */
async function writeIndex(items) {
  const index = items.map((it) => ({
    group: it.group,
    id: it.def.id,
    name: it.def.name,
    info: it.info,
    file: it.file,
    description: it.def.description ?? "",
    artRef: it.def.artRef ?? "",
  }));
  await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify(index, null, 2) + "\n");

  const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    "# 캐릭터 카드 일러스트 (로컬 전용)",
    "",
    "`npm run cards`로 받은 로스트아크 카드 일러스트입니다. 이미지 저작권은 스마일게이트에 있어 저장소에는 올리지 않습니다 (.gitignore).",
    "캐릭터 이미지 생성 프롬프트에 이미지를 첨부하고, 아래 외형 설명(artRef)을 함께 붙여 쓰면 됩니다.",
    "",
  ];
  for (const g of GROUPS) {
    const rows = index.filter((r) => r.group === g.dir);
    lines.push(`## ${g.label} (${rows.length})`, "", "| 카드 | 이름 | 분류 | 외형 설명 (artRef) |", "|---|---|---|---|");
    for (const r of rows) {
      const img = r.file ? `<img src="${encodeURI(r.file)}" width="64">` : "없음";
      lines.push(`| ${img} | ${cell(r.name)} | ${cell(r.info)} | ${cell(r.artRef)} |`);
    }
    lines.push("");
  }
  await fs.writeFile(path.join(OUT, "README.md"), lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
