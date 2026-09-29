"""Molmo-7B-D 추론 래퍼.

프롬프트, 생성 설정, 응답 해석 규칙은 공식 코드
third_party/ACCIDENT/baselines/llm/reasoning/molmo.py (commit 38b2297)와 같다.
여기서 다른 점은 정밀도(precision) 선택과 호출 시간 측정뿐이다.
"""
import random
import re
import time

MODEL_ID = "allenai/Molmo-7B-D-0924"

# 공식 기본 프롬프트 (reasoning/molmo.py)
WHEN_PROMPT = "Is there a traffic accident or collision? Yes or No answer only."
WHERE_PROMPT = (
    "The scene depicts a traffic accident with one or more cars colliding. "
    "Point to the car accident. "
)
MAX_NEW_TOKENS = 512

_POINT_RE = re.compile(r'<point\s+x="([\d.]+)"\s+y="([\d.]+)"')


def is_yes(text: str) -> bool:
    """공식 규칙: 응답을 소문자로 바꿨을 때 'yes'가 들어 있으면 사고 프레임."""
    return "yes" in text.strip().lower()


def parse_point(text: str, width: int, height: int):
    """공식 parse_point와 같은 규칙. Molmo는 0~100 퍼센트 좌표를 낸다.

    공식 코드는 퍼센트 값을 먼저 정수로 자른 뒤 픽셀로 바꾼다. 재현을 위해 그대로 따른다.
    반환: (x_px, y_px) 또는 (None, None)
    """
    m = _POINT_RE.search(text)
    if not m:
        return None, None
    x, y = (int(float(v)) for v in m.groups())
    return int(x * width / 100), int(y * height / 100)


class MolmoRunner:
    """precision: 'fp32' | 'bf16' | '8bit' | '4bit'"""

    def __init__(self, precision: str = "bf16"):
        import torch
        from transformers import AutoModelForCausalLM, AutoProcessor, GenerationConfig

        self.torch = torch
        self.processor = AutoProcessor.from_pretrained(
            MODEL_ID, trust_remote_code=True, torch_dtype="auto", device_map="auto"
        )
        kwargs = dict(trust_remote_code=True)
        if precision == "fp32":
            kwargs["torch_dtype"] = torch.float32
        elif precision == "bf16":
            kwargs["torch_dtype"] = torch.bfloat16
        elif precision in ("8bit", "4bit"):
            from transformers import BitsAndBytesConfig

            # 비전 인코더는 양자화하지 않는다(시각 특징 손상 방지). pilot에서 동작을 확인할 것.
            kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_8bit=precision == "8bit",
                load_in_4bit=precision == "4bit",
                bnb_4bit_compute_dtype=torch.bfloat16,
                llm_int8_skip_modules=["vision_backbone"],
            )
            kwargs["torch_dtype"] = torch.bfloat16
            kwargs["device_map"] = "auto"
        else:
            raise ValueError(f"알 수 없는 precision: {precision}")

        model = AutoModelForCausalLM.from_pretrained(MODEL_ID, **kwargs)
        if precision in ("fp32", "bf16"):
            model = model.to("cuda")
        self.model = model.eval()
        self.gen_config = GenerationConfig(max_new_tokens=MAX_NEW_TOKENS, stop_strings="<|endoftext|>")
        self.dtype = kwargs["torch_dtype"]

    def ask(self, img, prompt: str) -> tuple[str, float]:
        """이미지 1장 + 프롬프트 -> (응답 텍스트, 걸린 초)"""
        t0 = time.perf_counter()
        inputs = self.processor.process(images=[img], text=prompt)
        inputs = {k: v.to(self.model.device).unsqueeze(0) for k, v in inputs.items()}
        if "images" in inputs:
            inputs["images"] = inputs["images"].to(self.dtype)
        with self.torch.inference_mode():
            out = self.model.generate_from_batch(
                inputs, self.gen_config, tokenizer=self.processor.tokenizer
            )
        tokens = out[0, inputs["input_ids"].size(1):]
        text = self.processor.tokenizer.decode(tokens, skip_special_tokens=True)
        return text, time.perf_counter() - t0


class MockRunner:
    """GPU 없이 파이프라인을 점검하기 위한 가짜 모델. 결과는 의미가 없다."""

    def __init__(self, seed: int = 0):
        self.rng = random.Random(seed)

    def ask(self, img, prompt: str) -> tuple[str, float]:
        if prompt == WHEN_PROMPT:
            return ("Yes" if self.rng.random() < 0.1 else "No"), 0.0
        x, y = self.rng.uniform(0, 100), self.rng.uniform(0, 100)
        return f'<point x="{x:.1f}" y="{y:.1f}" alt="accident">accident</point>', 0.0
