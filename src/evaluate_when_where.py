"""run_when_where.py 결과를 ACCIDENT 공식 지표로 채점한다.

지표 (공식 코드 baselines/llm/baselines/{temporal,spatial}/analysis.ipynb 와 같음)
  When  : exp(-(t_pred - t_gt)^2 / (2 sigma^2)),  sigma = 0.5 / 1 / 2 초
  Where : exp(-[(x-x_gt)^2/(2 sx^2) + (y-y_gt)^2/(2 sy^2)]),
          sx, sy = 전체 실제 영상 2,027개의 정답 박스 평균 너비/높이(정규화 좌표)
          점을 못 찾으면 화면 가운데(0.5, 0.5)로 채운다.

When 예측이 없을 때(모든 프레임에 'No') 채우는 방식은 두 가지로 모두 계산한다.
  midpoint : 영상 길이의 절반. 정답을 쓰지 않으므로 본문 수치로 쓴다.
  official : 공식 코드와 같은 accident_time // 2. 정답 시점을 쓰는 방식이라
             논문 수치와 비교(재현 확인)할 때만 쓴다.

예시:
  python -m src.evaluate_when_where --dataset-root dataset --run-name pilot_original
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from src.data import load_metadata

PAPER_WHEN_SIGMA1 = 0.343  # 원 논문 Molmo-7B When(σ=1), 실제 영상 전체 기준
N_CONDITIONS = 10          # 원본 1 + 열화 3종 × 3단계
N_BOOT = 1000


def parse_args():
    p = argparse.ArgumentParser(description="When/Where 채점")
    p.add_argument("--dataset-root", type=Path, required=True,
                   help="metadata-real.csv 가 있는 폴더 (영상은 없어도 된다)")
    p.add_argument("--run-name", required=True)
    p.add_argument("--results-dir", type=Path, default=Path("results"))
    return p.parse_args()


def load_predictions(run_dir: Path) -> tuple[pd.DataFrame, int]:
    recs = {}
    for f in sorted(run_dir.glob("predictions*.jsonl")):
        for line in f.open(encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                if "error" not in r or r["path"] not in recs:
                    recs[r["path"]] = r  # 같은 영상이 여러 번 있으면 마지막 정상 기록
    errors = sum("error" in r for r in recs.values())
    rows = []
    for r in recs.values():
        if "error" in r:
            continue
        rows.append({
            "path": r["path"], "pred_ts": r["pred_ts"],
            "wp_x": r["where_pred"]["x_px"], "wp_y": r["where_pred"]["y_px"],
            "wo_x": r["where_oracle"]["x_px"], "wo_y": r["where_oracle"]["y_px"],
            "n_when_calls": r["n_when_calls"], "n_calls": r["n_calls"],
            "sec_model": r["sec_model"], "sec_total": r["sec_total"],
        })
    return pd.DataFrame(rows), errors


def when_score(pred, gt, sigma):
    return np.exp(-(pred - gt) ** 2 / (2 * sigma ** 2))


def where_score(x_px, y_px, df, sx, sy):
    x = np.where(x_px.isna(), 0.5, x_px / df["width"])
    y = np.where(y_px.isna(), 0.5, y_px / df["height"])
    return np.exp(-((x - df["center_x"]) ** 2 / (2 * sx ** 2) + (y - df["center_y"]) ** 2 / (2 * sy ** 2)))


def boot_ci(values: np.ndarray, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(values), size=(N_BOOT, len(values)))
    means = values[idx].mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def quality3(q: str) -> str:
    return {"Excellent": "좋음", "Good": "좋음", "Fine": "보통"}.get(q, "나쁨")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows 콘솔 한글 깨짐 방지
    args = parse_args()
    run_dir = args.results_dir / args.run_name
    meta = load_metadata(args.dataset_root)
    sx = (meta["x2"] - meta["x1"]).abs().mean()
    sy = (meta["y2"] - meta["y1"]).abs().mean()

    pred, n_err = load_predictions(run_dir)
    if pred.empty:
        raise SystemExit(f"채점할 결과가 없습니다: {run_dir}")
    df = pred.merge(meta, on="path", how="left")
    df["quality3"] = df["quality"].map(quality3)
    df["no_pred"] = df["pred_ts"].isna()

    gt = df["accident_time"]
    fill_mid = df["pred_ts"].fillna(df["duration"] / 2)
    fill_off = df["pred_ts"].fillna(df["accident_time"] // 2)
    for s in (0.5, 1.0, 2.0):
        df[f"when_s{s}"] = when_score(fill_mid, gt, s)
        df[f"when_s{s}_official"] = when_score(fill_off, gt, s)
    df["where_pred"] = where_score(df["wp_x"], df["wp_y"], df, sx, sy)
    df["where_oracle"] = where_score(df["wo_x"], df["wo_y"], df, sx, sy)
    df.to_csv(run_dir / "scores_per_video.csv", index=False)

    metrics = ["when_s1.0", "where_pred", "where_oracle",
               "when_s0.5", "when_s2.0", "when_s1.0_official"]
    overall = {}
    for m in metrics:
        lo, hi = boot_ci(df[m].to_numpy())
        overall[m] = {"mean": float(df[m].mean()), "ci95": [lo, hi]}

    groups = {}
    for g in ["type", "day_time", "quality3"]:
        t = df.groupby(g).agg(n=("path", "size"), when_s1=("when_s1.0", "mean"),
                              where_pred=("where_pred", "mean"), where_oracle=("where_oracle", "mean"))
        groups[g] = t.round(3)

    # 속도: 전체 실험(test split 1,520개 × 10개 조건) 예상 시간
    sec_per_call = df["sec_model"].sum() / df["n_calls"].sum()
    test = meta[meta["split_in_distribution"] == "test"]
    step = (test["fps_meta"] * 0.5).round().clip(lower=1)
    calls_per_condition = (np.ceil(test["no_frames"] / step) + 2).sum()
    full_hours = calls_per_condition * N_CONDITIONS * sec_per_call / 3600

    health = {
        "videos_scored": int(len(df)),
        "videos_error": int(n_err),
        "no_when_prediction_rate": float(df["no_pred"].mean()),
        "where_pred_parse_fail_rate": float(df["wp_x"].isna().mean()),
        "where_oracle_parse_fail_rate": float(df["wo_x"].isna().mean()),
        "sec_per_call": float(sec_per_call),
        "sec_per_video": float(df["sec_total"].mean()),
        "full_experiment_hours_est": float(full_hours),
        "sigma_x": float(sx), "sigma_y": float(sy),
    }
    (run_dir / "summary.json").write_text(
        json.dumps({"overall": overall, "health": health}, ensure_ascii=False, indent=2), encoding="utf-8")

    names = {"when_s1.0": "When (σ=1초)", "where_pred": "Where (예측 시점)",
             "where_oracle": "Where (정답 시점, oracle)", "when_s0.5": "When (σ=0.5초)",
             "when_s2.0": "When (σ=2초)", "when_s1.0_official": "When (σ=1초, 공식 채움 방식)"}
    lines = [f"# 채점 결과: {args.run_name}", "",
             f"영상 {len(df)}개 채점, 오류 {n_err}개", "",
             "## 전체 성능 (평균, 부트스트랩 95% CI)", "", "| 지표 | 평균 | 95% CI |", "|---|---|---|"]
    for m in metrics:
        o = overall[m]
        lines.append(f"| {names[m]} | {o['mean']:.3f} | {o['ci95'][0]:.3f} ~ {o['ci95'][1]:.3f} |")
    lines += ["", f"재현 확인: 논문 Molmo When(σ=1) = {PAPER_WHEN_SIGMA1} "
              f"↔ 이번 실행(공식 채움 방식) = {overall['when_s1.0_official']['mean']:.3f}", "",
              "## 점검 항목", "",
              f"- When 예측 없음(전부 'No') 비율: {health['no_when_prediction_rate']:.1%}",
              f"- Where 좌표 파싱 실패: 예측 시점 {health['where_pred_parse_fail_rate']:.1%}, "
              f"oracle {health['where_oracle_parse_fail_rate']:.1%}",
              f"- 모델 호출 1회 평균: {sec_per_call:.2f}초, 영상 1개 평균: {health['sec_per_video']:.1f}초",
              f"- **전체 실험(1,520개 × {N_CONDITIONS}개 조건) 예상: 약 {full_hours:.0f}시간** "
              "(pilot 통과 기준 100시간 이내)", ""]
    for g, t in groups.items():
        lines += [f"## 그룹별: {g}", "", t.to_markdown(), ""]
    (run_dir / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
