# 캐릭터 이미지 생성 가이드 (카봇풍 × 실제 로스트아크 캐릭터)

목표: 스타크래프트 **카봇(Carbot) 스킨** 스타일로, **실제 로스트아크 캐릭터를 알아볼 수 있게** 그린 게임 에셋.

지역 분위기 키워드만으로는 결과가 매번 달라지므로, 프롬프트는 항상 아래 3층으로 조립합니다.

```
[1] 공통 스타일  +  [2] 캐릭터 고유 외형 (실제 캐릭터 레퍼런스)  +  [3] 등급/역할/출력 형식
```

- [1] 은 고정 (아래 "공통 스타일")
- [2] 는 `character-references.md` 의 캐릭터별 `PROMPT` 줄 → 에디터의 **artRef** 필드에 저장
- [3] 은 에디터의 **📋 프롬프트 생성** 버튼이 등급/역할에 맞춰 자동으로 붙임

즉 에디터에서 캐릭터를 만들 때 artRef만 채우면 완성 프롬프트가 나옵니다.

---

## 워크플로우

1. `character-references.md`에서 만들 캐릭터를 고른다 (에스더/지역별 아군, 적, 보스, 군단장).
2. `⚠ 공식 일러 확인 필요` 표시가 있으면 인벤 카드 DB(https://lostark.inven.co.kr/dataninfo/card/)나
   인게임 스크린샷을 보고 머리색·복장·무기 색을 PROMPT에 보충한다.
3. `/editor/towers` 또는 `/editor/enemies`에서 캐릭터를 만들고 **이미지 생성 참고 설명(artRef)** 에 PROMPT를 붙여넣는다.
4. 출력 형식(단일 이미지 / 스프라이트 시트 / 적 / 보스)을 고르고 **📋 프롬프트 생성 → 복사**.
5. 이미지 생성 AI에 넣어 생성. 레퍼런스 이미지 입력을 지원하는 도구라면 **공식 일러스트를 참조 이미지로 함께 제공**하면 인식률이 크게 오른다.
6. 결과물을 외형 섹션의 **📤 업로드**로 올리고(→ `public/characters/`), 단일 이미지 또는 스프라이트 시트로 지정한다.

---

## [1] 공통 스타일 (모든 프롬프트 앞에 자동 삽입)

```
chibi cartoon game character in Carbot Animations style, thick black outlines,
flat cel shading, oversized head, tiny body, exaggerated cute proportions,
simple geometric shapes, vibrant saturated colors, white background,
game asset, centered, full body
--no realistic, photorealistic, 3d render, gradient shading, text, watermark, extra limbs
```

시리즈 일관성을 위해 같은 도구·같은 시드(또는 스타일 레퍼런스 기능)를 유지하세요.

---

## [2] 캐릭터 고유 외형 — 작성 규칙

`character-references.md`의 PROMPT는 아래 순서로 씁니다. 직접 추가할 때도 같은 순서를 지키면 결과가 안정적입니다.

1. **정체/역할 명사**: `knight king`, `ice priest`, `nine-tailed fox spirit`
2. **머리**: 색·길이·스타일 (`long swept-back white hair`, `red headband`)
3. **복장**: 색 + 재질 + 상징 (`crimson coat with gold embroidery`, `white wolf-fur mantle`)
4. **무기/도구**: 형태 + 특수효과 (`broken longsword projecting a golden energy blade`)
5. **가장 눈에 띄는 한 가지**: 실루엣을 결정하는 요소 (`towering horned crown`, `entire left arm is a mechanical prosthetic`)
6. (선택) **이펙트/동반물**: `translucent purple lion-demon spirit behind him`, `raven on shoulder`

> 팁: 카봇 스타일은 디테일을 단순화하므로, 5번 "실루엣 요소" 하나를 반드시 넣어야 캐릭터가 구분됩니다.

### 예시 — 웨이 (애니츠, 에스더)

```
[공통 스타일],
martial artist with dark brown medium hair and a red headband, short beard,
cream-colored oriental gi with fur collar and a red scarf, leather bracers,
bare-handed fighting stance, translucent purple lion-demon spirit rising behind him,
divine cyan-white glow, floating relics, godlike presence, particle sparkles,
idle pose, standing on small circular base, front-facing 3/4 view
--no realistic, photorealistic, 3d render, gradient shading, text, watermark, extra limbs
```

### 예시 — 아브렐슈드 (보스)

```
[공통 스타일],
regal demoness with a towering horned crown, pale pupil-less eyes, black and violet gown,
tearing space with a gesture, giant shadow demon silhouette behind her, chessboard motifs,
huge imposing boss monster, screen-filling presence, dramatic lighting accents, walking pose, side view
--no ...
```

---

## [3] 등급 / 역할 키워드 (자동 삽입)

| 등급 | 키워드 |
|------|--------|
| 일반 | simple humble outfit, plain colors |
| 고급 | sturdy adventurer gear, green accents |
| 희귀 | polished equipment, blue magical glow accents |
| 영웅 | ornate armor or robes, purple aura, heroic pose |
| 전설 | radiant golden-orange aura, legendary weapon, epic silhouette |
| 에스더 | divine cyan-white glow, floating relics, godlike presence, particle sparkles |

| 출력 형식 | 추가 키워드 |
|-----------|-------------|
| 단일 이미지(아군) | idle pose, standing on small circular base, front-facing 3/4 view |
| 적(일반) | menacing but comically cute expression, walking pose, side view |
| 적(보스) | huge imposing boss monster, screen-filling presence, dramatic lighting accents, walking pose, side view |
| 스프라이트 시트 | 아래 규격 |

---

## 스프라이트 시트 규격

게임은 **가로 프레임 나열 + 줄(row)별 애니메이션** 형식을 지원합니다. 에디터의 "스프라이트 시트 사용"에서 프레임 크기와 줄/프레임 수/fps를 지정하세요.

권장: 프레임 64×64 또는 128×128, 캐릭터가 **오른쪽**을 바라보게(왼쪽은 게임이 자동 반전), 배경 투명 PNG.

| 줄(row) | 애니메이션 | 권장 프레임 | 용도 |
|---------|-----------|------------|------|
| 0 | idle (대기) | 4 | 필수. 아군/적 공통 |
| 1 | attack (공격) | 4 | 아군 타워 |
| 2 | skill (스킬) | 6 | 아군 타워 |
| 3 | walk (이동) | 6 | 적 캐릭터 |

자동 삽입 문구:
```
pixel-perfect sprite sheet for a 2D game, 4 rows of animation on a transparent background,
each row is one animation, row 1: 4 frames idle breathing loop,
row 2: 4 frames attack (wind-up, strike, follow-through, recover),
row 3: 6 frames skill cast with glowing energy, row 4: 6 frames walk cycle,
every frame exactly 64x64 pixels in a uniform grid, character always facing right,
consistent size and position across all frames, no labels, no grid lines
```

> 생성 AI가 격자를 정확히 지키지 못하는 경우가 많으니, 생성 후 이미지 편집 도구로 프레임 경계를 정렬하세요.
> 단일 이미지로 먼저 캐릭터 디자인을 확정한 뒤, 그 이미지를 참조로 시트를 생성하면 일관성이 좋습니다.

---

## 스킬/타격 이펙트 프롬프트

```
cartoon game VFX sprite in Carbot Animations style, thick outlines, flat colors,
{이펙트 설명}, transparent background, game effect asset, radial burst composition, single frame
```

- 빙결(슈샤이어): `ice explosion with snowflakes and frost shards, blue-white palette`
- 기공파(애니츠): `shockwave ring of chi energy with ink-brush strokes, purple and gold`
- 헤비워커 포격(아르데타인): `cartoon cannon blast with brass shrapnel and smoke puffs, orange`
- 성속성(베른): `golden holy light pillar with sun emblem, white-gold`
- 몽환(로헨델): `violet dream-magic swirl with chess-piece fragments`
- 광기(파푸니카): `rainbow circus confetti burst with laughing masks`
- 치명타: `comic style impact star burst with "CRIT!" energy, yellow palette`
- 기절: `spinning stars and dizzy swirls, yellow palette`

---

## 저작권 메모

실제 게임 캐릭터를 모티프로 한 팬아트 성격의 에셋입니다. 개인/비상업 용도로 사용하고,
공개 배포·수익화 시에는 스마일게이트 로스트아크의 2차 창작 가이드라인을 확인하세요.
