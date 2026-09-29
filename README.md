# CCTV 영상 열화에 따른 교통사고 탐지 AI의 성능 저하 및 판단 능력별 취약성 분석

실제 교통 CCTV 사고 영상에 해상도 저하·영상 압축·모션 블러를 단계적으로 적용하고, 사고 탐지 AI의 **When(시점) / Where(위치) / What(유형)** 판단 성능이 각각 얼마나 떨어지는지 비교하는 연구입니다.

## 연구 설계 요약

| 항목 | 내용 |
|---|---|
| 데이터 | [ACCIDENT](https://github.com/accidentbench/ACCIDENT) 실제 CCTV 영상, 공식 IID test split 1,520개 |
| 모델 | Molmo-7B-D (zero-shot, 공식 baseline) |
| 열화 요인 | 해상도 저하, 영상 압축, 모션 블러 |
| 열화 수준 | 해상도 원본의 1/2·1/4·1/8 / 압축 CRF 29·35·41 / 블러 폭의 1%·2%·4% (원본 포함 총 10개 조건) |
| 지표 | ACCIDENT 공식 지표(Where는 oracle 시점 포함) + 원본 대비 상대 성능 저하율(RPD), 짝지은 부트스트랩 95% CI |
| 하위 분석 | 충돌 유형, 주간/야간, 원본 화질 3단계 |

## 폴더 구조

```
paper/
  논문초안.md                      GitHub에서 바로 읽는 버전 (docx에서 자동 변환)
  논문초안_CCTV열화_사고탐지.docx    제출·편집용 원본
docs/
  실험설계_결정사항.md               확정된 설계 결정 11개와 이유, 버린 대안
  데이터분석_결과.md                test split 실측 분포와 열화 샘플 이미지
  data/                            분석 CSV와 샘플 비교 이미지
scripts/
  build_docx.js                    논문 docx 생성 스크립트
src/
  run_when_where.py                Molmo로 When/Where 예측 (이어하기·분할 실행 지원)
  evaluate_when_where.py           공식 지표 채점 + 95% CI + 그룹별 + 전체 소요 시간 예측
  molmo.py, data.py                모델 래퍼, 메타데이터·프레임 추출
configs/
  pilot_100.csv                    pilot 영상 100개 (충돌 유형 × 주야 층화, seed 0)
third_party/ACCIDENT/              공식 저장소 (submodule, commit 38b2297)
```

## 진행 현황 (2026-09-29)

| 단계 | 상태 |
|---|---|
| 선행연구, 논문 초안 | ✅ 초안 완료 (서론 1페이지 원고 병합, 저자 정보 필요) |
| 데이터 확인 | ✅ test split 실측 분석 완료 ([데이터분석_결과](docs/데이터분석_결과.md)) |
| 실험 설계 | ✅ 결정 11개 확정 ([실험설계_결정사항](docs/실험설계_결정사항.md)) |
| 원본 When/Where 코드 | ✅ 작성, mock 검증 완료. **실제 GPU 실행은 아직** |
| pilot test (원본 100개) | ⏳ 동료 GPU 실행 대기 ([실행가이드](docs/실행가이드_WhenWhere.md)) |
| 열화 생성 코드 (`degrade.py`) | ⬜ 다음 작업 |
| What(유형) 분류 코드 | ⬜ |
| 전체 실험, 분석, 논문 완성 | ⬜ |

**미정**: 실행 GPU 환경(집 PC VRAM 8GB/16GB), pilot 결과에 따른 속도 대책과 압축 강화 여부

## 실험 실행

GPU 환경에서 돌리는 방법은 [docs/실행가이드_WhenWhere.md](docs/실행가이드_WhenWhere.md)에 순서대로 있다. 요약:

```bash
git clone --recurse-submodules https://github.com/anhanseok/D-G2CAM.git && cd D-G2CAM
pip install -r requirements.txt            # torch는 CUDA에 맞춰 먼저 설치
python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
    --run-name pilot_original --precision bf16
python -m src.evaluate_when_where --dataset-root dataset --run-name pilot_original
```

## 논문 파일 다시 만들기

`scripts/build_docx.js`가 원본입니다. 내용을 고친 뒤 아래를 실행하면 docx와 md가 함께 갱신됩니다.

```bash
npm install docx
node scripts/build_docx.js
pandoc -t gfm --wrap=none paper/논문초안_CCTV열화_사고탐지.docx -o paper/논문초안.md
```

## 출처와 라이선스

- 데이터: L. Picek, M. Čermák, M. Hanzl, V. Čermák, "ACCIDENT: A Benchmark Dataset for Vehicle Accident Detection from Traffic Surveillance Videos," CVPRW 2026 ([arXiv:2604.09819](https://arxiv.org/abs/2604.09819)). 데이터 라이선스는 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)이다.
- `docs/data/`의 샘플 이미지와 CSV는 위 데이터에서 가공한 것으로, 같은 CC BY-NC-SA 4.0 라이선스를 따른다(비상업적 이용만 허용).
- 공식 베이스라인 코드는 [accidentbench/ACCIDENT](https://github.com/accidentbench/ACCIDENT)를 참조하며, 이 저장소에 복사하지 않는다.

## 데이터셋

영상 데이터는 용량과 라이선스 때문에 이 저장소에 포함하지 않습니다. ACCIDENT 저장소의 안내에 따라 Kaggle(`picekl/accident`)에서 받아 `dataset/` 폴더에 두세요. 이 폴더는 `.gitignore`에 등록되어 있습니다.
