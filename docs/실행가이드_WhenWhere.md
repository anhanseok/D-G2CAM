# 실행 가이드: 원본 영상 When / Where 예측 (pilot)

이 문서는 GPU 환경에서 코드를 처음 돌리는 사람을 위한 순서다. 위에서부터 그대로 따라 하면 된다.

**이번 실행의 목표**: pilot 영상 100개(`configs/pilot_100.csv`)의 원본에서 Molmo-7B-D로 사고 시점(When)과 위치(Where)를 예측하고 채점한다. 열화(블러 등)는 아직 하지 않는다.

**끝나면 보내줄 것**: `results/pilot_original/` 폴더 전체 (특히 `summary.md`)

---

## 0. 준비물

| 항목 | 조건 |
|---|---|
| GPU | NVIDIA. **VRAM 24GB 이상**(L4, A10, RTX 3090/4090, A100)이면 `bf16`, 16GB면 `8bit`, 8~12GB면 `4bit` |
| 디스크 | 약 25GB (데이터 zip 16.8GB + 실제 영상 4.6GB + 모델 약 30GB 캐시는 별도) |
| Kaggle 계정 | 데이터 다운로드용 API 토큰 (https://www.kaggle.com/settings → API → Generate New Token) |
| 예상 시간 | 설치·다운로드 약 1시간 + pilot 추론 약 1~3시간(L4 bf16 기준 추정) |

모델 가중치(약 30GB)는 첫 실행 때 Hugging Face에서 자동으로 받는다.

## 1. 코드 받기

공식 ACCIDENT 코드를 submodule로 참조하므로 `--recurse-submodules`를 꼭 붙인다.

```bash
git clone --recurse-submodules https://github.com/anhanseok/D-G2CAM.git
cd D-G2CAM
```

## 2. 환경 설치

Python 3.10~3.12를 권장한다.

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# (1) torch: CUDA 버전에 맞는 명령을 https://pytorch.org/get-started/locally/ 에서 확인
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# (2) 나머지
pip install -r requirements.txt
```

Colab이면 torch가 이미 있으므로 `pip install -r requirements.txt`만 하면 된다.

## 3. 데이터 받기

```bash
# Kaggle 토큰 등록 (한 번만)
mkdir -p ~/.kaggle && echo "<발급받은 토큰>" > ~/.kaggle/access_token

# 전체 zip 다운로드 (16.8GB) 후 실제 영상과 메타데이터만 풀기
kaggle datasets download -d picekl/accident -p dataset/downloads
unzip -q dataset/downloads/accident.zip 'real_videos/*' 'metadata-real.csv' -d dataset/
rm dataset/downloads/accident.zip   # 공간이 부족하면 삭제
```

풀고 나면 이런 구조여야 한다.

```
dataset/
  metadata-real.csv
  real_videos/   (mp4 2,027개)
```

## 4. 파이프라인 점검 (GPU 없이, 1분)

가짜 모델(mock)로 3개만 돌려서 영상 읽기와 저장, 채점이 되는지 본다.

```bash
python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
    --run-name _check --backend mock --limit 3
python -m src.evaluate_when_where --dataset-root dataset --run-name _check
```

마지막에 `# 채점 결과: _check` 표가 나오면 정상이다. 점수는 의미 없다. 확인했으면 `results/_check/`를 지운다.

## 5. 모델 점검 (GPU, 약 10분)

진짜 모델로 3개만 먼저 돌린다. 모델 다운로드 시간이 포함된다.

```bash
python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
    --run-name _check_gpu --precision bf16 --limit 3
python -m src.evaluate_when_where --dataset-root dataset --run-name _check_gpu
```

확인할 것:
- `results/_check_gpu/predictions.jsonl`을 열어 `when_raw`에 "Yes"/"No" 같은 짧은 답이 있는지
- `where_oracle.raw`에 `<point x="..." y="...">` 형태가 있는지
- `summary.md`의 "모델 호출 1회 평균" 시간

VRAM이 부족하면(`CUDA out of memory`) `--precision 8bit`, 그래도 부족하면 `4bit`로 바꾼다.

## 6. pilot 실행 (본 실행)

```bash
python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
    --run-name pilot_original --precision bf16
python -m src.evaluate_when_where --dataset-root dataset --run-name pilot_original
```

- **중간에 끊겨도 같은 명령을 다시 실행하면 이어서 한다.** 끝난 영상은 건너뛴다.
- **5단계와 같은 `--precision`을 쓴다.** 앞으로 모든 조건을 같은 설정으로 돌려야 비교가 성립한다.
- GPU가 여러 개거나 세션을 나누려면 `--shard 0/2`, `--shard 1/2`처럼 나눠 실행한다. 채점은 한 번만 하면 된다.

### Colab에서 돌릴 때

세션이 끊기면 파일이 사라지므로 결과를 Google Drive에 저장한다.

```python
from google.colab import drive
drive.mount('/content/drive')
```
```bash
!python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
    --run-name pilot_original --precision bf16 --results-dir /content/drive/MyDrive/D-G2CAM_results
```

데이터(`dataset/`)도 Drive에 풀어두면 재접속 때 다시 받지 않아도 된다.

## 7. 결과 확인 (pilot 통과 기준)

`results/pilot_original/summary.md`에서 아래를 확인한다.

| 확인 항목 | 기준 | 어디를 보나 |
|---|---|---|
| 재현 | When(σ=1초, 공식 채움 방식)이 논문 값 **0.343 근처** | "재현 확인" 줄 |
| 속도 | **전체 실험 예상 100시간 이내** | "전체 실험 예상" 줄 |
| 정상 동작 | 오류 0개, Where 좌표 파싱 실패가 낮음 | "점검 항목" |

기준을 넘지 못해도 괜찮다. 결과 폴더를 그대로 보내주면 설정을 조정한다.

## 8. 결과 파일 설명

| 파일 | 내용 |
|---|---|
| `predictions.jsonl` | 영상 1개당 한 줄. 프레임별 When 답변, 예측 시점, Where 좌표와 원문, 소요 시간 |
| `run_config.json` | 실행 옵션, 시작 시각, 호스트 이름 |
| `scores_per_video.csv` | 영상별 점수 (하위 그룹 분석용) |
| `summary.md` / `summary.json` | 전체 점수, 95% 신뢰구간, 점검 항목, 그룹별 점수 |

## 참고: 공식 코드와 다른 점

설계는 공식 코드(`third_party/ACCIDENT`, commit `38b2297`)를 그대로 따르고, 아래만 다르다.

1. **정밀도 선택**: 공식 코드는 `torch_dtype='auto'`로 고정되어 있다. 여기서는 `bf16`/`8bit`/`4bit`를 고를 수 있다.
2. **프레임 디코더**: 공식은 decord, 여기는 OpenCV다(Windows 호환). 프레임 번호는 같다.
3. **When 예측이 없을 때 채점**: 공식은 `accident_time // 2`(정답 시점의 절반)로 채워서 정답 정보가 섞인다. 여기서는 영상 길이의 절반으로 채운 값을 본문 수치로 쓰고, 공식 방식은 재현 확인용으로만 따로 계산한다.
4. **Where(oracle)**: 공식은 별도 노트북에서 돌리지만 여기서는 한 번에 같이 돌린다.
