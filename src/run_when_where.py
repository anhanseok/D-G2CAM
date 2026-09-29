"""원본(또는 열화) CCTV 영상에서 사고 시점(When)과 위치(Where)를 예측한다.

영상 1개 처리 순서 (공식 파이프라인과 같음):
  1. 0.5초 간격 프레임마다 WHEN_PROMPT로 질문 -> 처음 'yes'가 나온 프레임을 사고 시점으로 예측
  2. Where(pred):   예측한 사고 프레임에 WHERE_PROMPT로 질문
  3. Where(oracle): 정답 사고 프레임(accident_frame)에 WHERE_PROMPT로 질문

결과는 영상 1개마다 predictions.jsonl 에 한 줄씩 추가된다. 중간에 끊겨도 다시 실행하면
이미 끝난 영상은 건너뛴다.

예시:
  python -m src.run_when_where --dataset-root dataset --video-list configs/pilot_100.csv \
      --run-name pilot_original --precision bf16
"""
import argparse
import json
import sys
import platform
import time
from datetime import datetime
from pathlib import Path

from tqdm import tqdm

from src.data import load_metadata, read_frames, sample_step, select_videos
from src.molmo import WHEN_PROMPT, WHERE_PROMPT, MockRunner, MolmoRunner, is_yes, parse_point


def parse_args():
    p = argparse.ArgumentParser(description="Molmo When/Where 추론")
    p.add_argument("--dataset-root", type=Path, required=True,
                   help="metadata-real.csv 와 real_videos/ 가 있는 폴더")
    p.add_argument("--split", default="test", choices=["test", "train", "all"])
    p.add_argument("--video-list", type=Path, default=None,
                   help="처리할 영상 목록 CSV(path 열). 예: configs/pilot_100.csv")
    p.add_argument("--run-name", required=True, help="results/<run-name>/ 에 저장")
    p.add_argument("--results-dir", type=Path, default=Path("results"))
    p.add_argument("--precision", default="bf16", choices=["fp32", "bf16", "8bit", "4bit"])
    p.add_argument("--backend", default="molmo", choices=["molmo", "mock"],
                   help="mock: GPU 없이 파이프라인만 점검")
    p.add_argument("--shard", default="0/1",
                   help="k/N: 영상을 N등분해 k번째만 처리 (여러 GPU/세션 분할용)")
    p.add_argument("--limit", type=int, default=None, help="앞에서부터 N개만 (빠른 점검용)")
    return p.parse_args()


def done_paths(pred_file: Path) -> set[str]:
    if not pred_file.exists():
        return set()
    with pred_file.open(encoding="utf-8") as f:
        recs = [json.loads(line) for line in f if line.strip()]
    return {r["path"] for r in recs if "error" not in r}  # 오류 난 영상은 다시 시도한다


def process_video(runner, row) -> dict:
    t0 = time.perf_counter()
    fps = row.fps_meta
    step = sample_step(fps)
    oracle_frame = int(row.accident_frame)
    middle_frame = int(row.no_frames) // 2
    frames, n_read = read_frames(row.video_path, step, extra_indices=[oracle_frame, middle_frame])
    sampled = sorted(i for i in frames if i % step == 0)

    # 1) When: 프레임마다 질문
    when_raw, call_secs = {}, []
    for i in sampled:
        text, sec = runner.ask(frames[i], WHEN_PROMPT)
        when_raw[i] = text
        call_secs.append(sec)
    yes_frames = [i for i in sampled if is_yes(when_raw[i])]
    pred_frame = yes_frames[0] if yes_frames else None
    pred_ts = None if pred_frame is None else pred_frame / fps

    # 2) Where(pred): 예측 프레임. 예측이 없으면 공식처럼 영상 가운데 프레임(no_frames // 2)
    where_pred_frame = pred_frame if pred_frame is not None else middle_frame
    if where_pred_frame not in frames:  # 메타데이터보다 실제 프레임이 적은 경우
        where_pred_frame = max(frames)
    img = frames[where_pred_frame]
    text_pred, sec = runner.ask(img, WHERE_PROMPT)
    call_secs.append(sec)
    xp, yp = parse_point(text_pred, *img.size)

    # 3) Where(oracle): 정답 프레임
    if oracle_frame not in frames:  # 메타데이터와 실제 프레임 수가 다른 경우
        oracle_frame = max(frames)
    img = frames[oracle_frame]
    text_oracle, sec = runner.ask(img, WHERE_PROMPT)
    call_secs.append(sec)
    xo, yo = parse_point(text_oracle, *img.size)

    return {
        "path": row.path,
        "fps_meta": fps,
        "step": step,
        "n_frames_read": n_read,
        "n_when_calls": len(sampled),
        "when_raw": {str(k): v for k, v in when_raw.items()},
        "pred_frame": pred_frame,
        "pred_ts": pred_ts,
        "where_pred": {"frame": where_pred_frame, "x_px": xp, "y_px": yp, "raw": text_pred},
        "where_oracle": {"frame": oracle_frame, "x_px": xo, "y_px": yo, "raw": text_oracle},
        "img_w": img.size[0],
        "img_h": img.size[1],
        "sec_total": time.perf_counter() - t0,
        "sec_model": sum(call_secs),
        "n_calls": len(call_secs),
    }


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows 콘솔 한글 깨짐 방지
    args = parse_args()
    k, n = (int(v) for v in args.shard.split("/"))

    meta = load_metadata(args.dataset_root)
    videos = select_videos(meta, args.split, args.video_list)
    videos = videos.iloc[k::n]
    if args.limit:
        videos = videos.head(args.limit)

    out_dir = args.results_dir / args.run_name
    out_dir.mkdir(parents=True, exist_ok=True)
    pred_file = out_dir / (f"predictions_shard{k}of{n}.jsonl" if n > 1 else "predictions.jsonl")
    skip = done_paths(pred_file)
    todo = videos[~videos["path"].isin(skip)]
    print(f"대상 {len(videos)}개, 완료 {len(skip)}개, 남은 {len(todo)}개 -> {pred_file}")

    config = {**{k_: str(v) for k_, v in vars(args).items()},
              "started_at": datetime.now().isoformat(timespec="seconds"),
              "host": platform.node()}
    (out_dir / "run_config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    runner = MockRunner() if args.backend == "mock" else MolmoRunner(args.precision)

    with pred_file.open("a", encoding="utf-8") as f:
        for row in tqdm(list(todo.itertuples()), desc=args.run_name):
            try:
                rec = process_video(runner, row)
            except Exception as e:  # 한 영상 오류로 전체가 멈추지 않게 기록만 남긴다
                rec = {"path": row.path, "error": repr(e)}
                print(f"[오류] {row.path}: {e!r}")
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush()


if __name__ == "__main__":
    main()
