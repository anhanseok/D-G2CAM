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
