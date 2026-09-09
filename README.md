# 로타디 — 로스트아크 랜덤 타워 디펜스

Next.js(App Router) + TypeScript + Tailwind CSS + Canvas 2D 기반 랜덤 타워 디펜스.

## 실행

```bash
cd ROTADI
npm install
npm run dev   # http://localhost:3001 (기존 LOA-WEB과 포트 충돌 방지)
```

## 구조 (UI ↔ 로직 분리)

```
data/                  # CRUD 대상 JSON 데이터 (git으로 버전관리 가능)
  maps.json / jobs.json / towers.json / enemies.json / synergies.json / gachas.json
src/
  game/                # ★ 순수 게임 로직 (React/DOM 비의존 → 서버 이관 용이)
    types.ts           # 도메인 타입 전체
    constants.ts       # 난이도/뽑기 확률/합성 규칙/전투 상수 (밸런스 조정 지점)
    engine.ts          # 전투 엔진 (tick 루프, 웨이브, 타겟팅, 스킬, 경제)
    combat.ts          # 방어력/치명타 공식
    gacha.ts           # 뽑기 (data/gachas.json 데이터 주도 — 종류/확률 CRUD)
    fusion.ts          # 합성 (지역 상속 40/40/20, 1% 잭팟)
    synergy.ts         # TFT식 지역 시너지 계산
    render.ts          # Canvas 렌더러 (placeholder 도형 + 모션/이펙트)
  app/
    page.tsx           # 맵/난이도/직업 선택
    game/              # 전투 화면
    editor/            # CRUD 에디터 (맵/직업/타워/적/시너지/뽑기)
    api/data/          # JSON 파일 CRUD API
  components/          # 게임 UI + 에디터 폼
docs/
  image-prompts.md     # 카봇풍 캐릭터/이펙트 이미지 생성 프롬프트
public/characters/     # (생성한 캐릭터 이미지를 여기에)
```

## 게임 규칙 요약

- 난이도: 이지/하드/나이트메어 — 적 체력·방어 배수, 목숨 수 차등
- 데미지: 물리/마법 분리, `감소율 = 방어력/(방어력+100)`
- 치명타: 기본 10% / 160%, 시너지·직업으로 강화
- 마나: 자연회복 + 타격 획득, 가득 차면 스킬 자동 발동
- 등급: 일반→고급→희귀→영웅→전설 (+뽑기 전용 에스더)
- 뽑기: 종류/비용/등급별 확률/지역 조건을 에디터에서 CRUD (data/gachas.json)
- 합성: 동일 등급 2개 → 상위 등급 (최대 전설), 지역 상속 40/40/20, 1% 2단계 점프
- 시너지: 지역별 서로 다른 캐릭터 수로 단계 발동, 직업이 특정 지역 +1.
  발동된 효과는 **아군 전체**에 적용
- 웨이브: 총 30, 5의 배수는 보스 웨이브

## 데이터 확장

`/editor`에서 모든 데이터를 CRUD로 관리합니다. 저장 즉시 `data/*.json`에 반영되며,
새 게임 시작 시 적용됩니다. 캐릭터 이미지 추가 방법은 `docs/image-prompts.md` 참고.
