import Link from "next/link";
import DataTools from "@/components/editor/DataTools";

const MENUS = [
  { href: "/editor/chapters", icon: "📖", title: "챕터 / 스테이지", desc: "게임 레벨 디자인 — 챕터별 맵/지역, 스테이지별 등장 적" },
  { href: "/editor/maps", icon: "🗺️", title: "맵", desc: "타일 맵, 적 이동 경로 (최대 3개), 출발지/도착지 편집" },
  { href: "/editor/jobs", icon: "🧙", title: "플레이어 직업", desc: "직업별 지역 시너지, 고유 능력 편집" },
  { href: "/editor/towers", icon: "🏹", title: "아군 캐릭터(타워)", desc: "등급, 지역, 공격력, 스킬, 마나, 외형 편집" },
  { href: "/editor/enemies", icon: "👹", title: "적 캐릭터", desc: "체력, 방어력, 이동속도, 보스 여부 편집" },
  { href: "/editor/synergies", icon: "🔗", title: "시너지", desc: "지역 시너지 단계별 효과 편집 (효과는 아군 전체 적용)" },
  { href: "/editor/gachas", icon: "🎲", title: "뽑기", desc: "뽑기 종류, 비용, 등급별 확률, 지역 조건 편집" },
  { href: "/editor/missions", icon: "🎯", title: "웨이브 미션", desc: "웨이브마다 배정되는 미션 조건과 보상 골드 편집" },
  { href: "/editor/simulator", icon: "🧪", title: "밸런스 시뮬레이터", desc: "자동 플레이 AI로 N회 실행 — 클리어율, 도달 웨이브, 캐릭터 기여도" },
];

export default function EditorHome() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-amber-400">데이터 에디터</h1>
      <p className="text-sm text-slate-400">
        게임의 모든 데이터를 생성/조회/수정/삭제(CRUD)할 수 있습니다. 데이터는{" "}
        <code className="rounded bg-slate-800 px-1">data/*.json</code> 파일로 저장됩니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MENUS.map((m) => (
          <Link key={m.href} href={m.href} className="panel block hover:border-amber-600">
            <div className="text-lg font-bold">
              {m.icon} {m.title}
            </div>
            <div className="mt-1 text-xs text-slate-400">{m.desc}</div>
          </Link>
        ))}
      </div>
      <DataTools />
    </div>
  );
}
