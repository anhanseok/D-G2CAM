"""ACCIDENT 메타데이터 로딩과 프레임 추출.

프레임 샘플링 규칙은 공식 코드(third_party/ACCIDENT, commit 38b2297)의
baselines/llm/baselines/temporal/main.py 와 같다:
  fps = no_frames / duration (메타데이터 기준)
  n   = round(fps * 0.5)        -> 0.5초 간격
  프레임 인덱스 0, n, 2n, ... 을 사용한다.
공식 코드는 decord로 읽지만, Windows 호환을 위해 OpenCV 순차 디코딩을 쓴다.
프레임 인덱스는 같고, 디코더 차이로 픽셀 값이 미세하게 다를 수 있다.
"""
from pathlib import Path

import cv2
import pandas as pd
from PIL import Image

META_FILE = "metadata-real.csv"


def load_metadata(dataset_root: Path) -> pd.DataFrame:
    meta = pd.read_csv(Path(dataset_root) / META_FILE)
    meta["video_path"] = meta["path"].apply(lambda p: str(Path(dataset_root) / p))
    meta["fps_meta"] = meta["no_frames"] / meta["duration"]
    return meta


def select_videos(meta: pd.DataFrame, split: str, video_list: Path | None) -> pd.DataFrame:
    """split: 'test' | 'train' | 'all'. video_list가 있으면 그 CSV의 path 열만 남긴다."""
    df = meta if split == "all" else meta[meta["split_in_distribution"] == split]
    if video_list is not None:
        keep = set(pd.read_csv(video_list)["path"])
        df = df[df["path"].isin(keep)]
    return df.sort_values("path").reset_index(drop=True)


def sample_step(fps: float, interval_sec: float = 0.5) -> int:
    return max(1, round(fps * interval_sec))


def read_frames(video_path: str, step: int, extra_indices=()) -> tuple[dict[int, Image.Image], int]:
    """영상을 한 번 순차로 읽어 step 간격 프레임과 extra_indices 프레임을 모은다.

    반환: ({frame_index: PIL.Image(RGB)}, 실제로 읽은 전체 프레임 수)
    """
    wanted_extra = set(int(i) for i in extra_indices)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"영상을 열 수 없습니다: {video_path}")
    frames: dict[int, Image.Image] = {}
    idx = 0
    while True:
        if idx % step == 0 or idx in wanted_extra:
            ok, bgr = cap.read()
            if not ok:
                break
            frames[idx] = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        elif not cap.grab():  # 디코딩만 하고 변환은 건너뛴다
            break
        idx += 1
    cap.release()
    return frames, idx
