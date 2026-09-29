const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat,
} = require("docx");

const FONT = "맑은 고딕";
const CONTENT_W = 9026; // A4 - 1" margins

const run = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });
// Text in [대괄호] = author must fill/confirm -> yellow highlight
const todo = (text) => run(text, { highlight: "yellow" });

const P = (children, opts = {}) =>
  new Paragraph({
    children: typeof children === "string" ? [run(children)] : children,
    alignment: AlignmentType.JUSTIFIED,
    indent: opts.noIndent ? undefined : { firstLine: 200 },
    spacing: { after: 120, line: 300 },
    ...opts.p,
  });

const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(text)], spacing: { before: 280, after: 140 } });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run(text)], spacing: { before: 200, after: 100 } });

const bullet = (children, level = 0) =>
  new Paragraph({
    numbering: { reference: "bullets", level },
    children: typeof children === "string" ? [run(children)] : children,
    spacing: { after: 60, line: 290 },
  });

const caption = (text) =>
  new Paragraph({ alignment: AlignmentType.CENTER, children: [run(text, { bold: true, size: 18 })], spacing: { before: 120, after: 80 } });

const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, r) =>
      new TableRow({
        tableHeader: r === 0,
        children: cells.map((c, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            borders,
            shading: r === 0 ? { type: ShadingType.CLEAR, fill: "E7ECF3", color: "auto" } : undefined,
            margins: { top: 60, bottom: 60, left: 90, right: 90 },
            children: [
              new Paragraph({
                alignment: r === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [run(c, { size: 17, bold: r === 0, highlight: c.startsWith("[") ? "yellow" : undefined })],
              }),
            ],
          })
        ),
      })
    ),
  });
}

// Pipeline diagram: bordered boxes with arrows
const box = (title, desc) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: border, bottom: border, left: border, right: border },
    shading: { type: ShadingType.CLEAR, fill: "F3F6FA", color: "auto" },
    indent: { left: 1400, right: 1400 },
    spacing: { before: 0, after: 0 },
    children: [run(title, { bold: true, size: 18 }), run("  " + desc, { size: 16, color: "444444" })],
  });
const arrow = () => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [run("↓", { size: 18 })] });

const body = [];
const add = (...xs) => body.push(...xs);

// ───────── 1. 제목 / 2. 저자
add(
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [run("CCTV 영상 열화에 따른 교통사고 탐지 AI의 성능 저하 및 판단 능력별 취약성 분석", { bold: true, size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [run("Performance Degradation and Task-wise Vulnerability Analysis of Traffic Accident Detection AI under CCTV Video Degradation", { italics: true, size: 20 })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [todo("[저자명 1]"), run("¹, "), todo("[저자명 2]"), run("²")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [run("¹", { size: 18 }), todo("[소속 학과/대학교]"), run("   ²", { size: 18 }), todo("[소속]"), run("   e-mail: ", { size: 18 }), todo("[이메일]")] }),
);

// ───────── 3. 요약
add(
  H1("요 약"),
  P("교통 CCTV 영상은 저해상도, 저비트레이트 압축, 모션 블러 등 다양한 화질 열화를 겪지만, 교통사고 탐지 AI는 주로 데이터셋 전체의 평균 성능으로만 평가되어 왔다. 본 연구는 실제 CCTV 사고 영상 2,027개로 구성된 ACCIDENT 벤치마크와 공식 zero-shot 비전-언어 모델(VLM) 베이스라인을 활용하여, 영상 열화가 사고 판단 능력에 미치는 영향을 정량적으로 분석한다. 열화 요인으로는 CCTV 환경에서 빈번하고 재현 가능한 해상도 저하, 영상 압축, 모션 블러의 세 가지를 선정하고, 각 요인을 CCTV 해상도 규격과 코덱 설정에 근거한 3단계 수준으로 적용한다. 성능은 사고 발생 시점(When), 위치(Where), 유형(What)의 세 판단 능력으로 분리하여 측정하고, 원본 대비 상대 성능 저하율로 비교한다. 이를 통해 어떤 판단 능력이 어떤 열화 조건에서 가장 크게 저하되는지를 규명하고, 사고 유형별 민감도를 추가로 분석한다. 본 연구의 결과는 CCTV 기반 사고 탐지 시스템의 화질 요구 수준 설정과 강건성 향상 연구의 기초 자료로 활용될 수 있다."),
);

// ───────── 4. 서론
add(
  H1("1. 서론"),
  P([todo("[※ 1페이지 초안의 문제 제기·통계 자료를 이 절에 병합하세요]")], { noIndent: true }),
  P("교통사고 발생 직후의 신속한 인지와 대응은 2차 사고 예방과 인명 피해 최소화에 직결된다. 도로 곳곳에 설치된 교통 CCTV는 사고 상황을 실시간으로 관찰할 수 있는 핵심 인프라이지만, 관제 인력이 다수의 화면을 동시에 감시해야 하는 한계로 인해 AI 기반 자동 사고 탐지에 대한 수요가 증가하고 있다."),
  P("그러나 실제 CCTV 영상의 품질은 이상적이지 않다. 저장 공간과 전송 대역폭을 절약하기 위해 낮은 해상도와 높은 압축률로 운용되는 경우가 많고, 야간이나 저조도 환경에서는 노출 시간이 길어져 고속으로 움직이는 차량에 모션 블러가 발생한다. 실제로 ACCIDENT 벤치마크를 구성한 실제 CCTV 사고 영상의 약 3분의 2가 저품질 또는 매우 낮은 품질로 분류되었으며, 저해상도와 압축 아티팩트가 주요 난제로 보고되었다[1]."),
  P("영상 품질 저하가 딥러닝 모델에 미치는 영향은 이미지 분류[2]와 행동 인식[3, 4] 분야에서 체계적으로 연구되어 왔다. 하지만 이들 연구는 단일 분류 정확도를 중심으로 강건성을 평가하였으며, 교통사고 탐지처럼 '언제(When)', '어디서(Where)', '어떤 사고(What)'라는 서로 다른 성격의 판단을 동시에 요구하는 과제에서 각 판단 능력이 열화에 얼마나 다르게 반응하는지는 충분히 밝혀지지 않았다."),
  P("이에 본 연구는 CCTV 환경에서 대표적인 세 가지 열화 요인인 해상도 저하, 영상 압축, 모션 블러를 단계적으로 적용하여 교통사고 탐지 AI의 판단 능력별 취약성을 분석한다. 본 연구의 기여는 다음과 같다."),
  bullet("CCTV 운용 환경에 근거하여 열화 요인과 3단계 열화 수준을 설정한 체계적 평가 프로토콜을 제시한다."),
  bullet("사고 발생 시점·위치·유형의 판단 능력을 분리 측정하여, 어떤 판단이 어떤 열화에 가장 취약한지를 정량적으로 비교한다."),
  bullet("사고 유형별 성능 변화를 분석하여, 특정 열화에 더 민감한 사고 유형을 식별한다."),
  P("본 논문의 구성은 다음과 같다. 2장에서 관련 연구를 소개하고, 3장에서 데이터셋, 열화 변수 선정 근거, 분석 구성 및 비교 방법을 설명한다. 4장에서 결론과 후속 연구를 제시한다."),
);

// ───────── 5. 관련연구
add(
  H1("2. 관련 연구"),
  H2("2.1 CCTV 기반 교통사고 탐지 벤치마크"),
  P("Picek 등[1]은 교통 감시 영상에서의 사고 탐지를 위해 ACCIDENT 벤치마크를 공개하였다. 공개 CCTV 소스에서 수집한 실제 사고 영상 2,027개와 CARLA 시뮬레이터로 생성한 합성 영상 2,211개로 구성되며, 각 영상에 사고 발생 시점, 충돌 위치, 충돌 유형(5종)이 주석되어 있다. 시점·위치·유형의 세 과제를 개별 지표로 평가하고, 지도학습과 zero-shot VLM 베이스라인을 함께 제공한다. 다만 영상 품질 조건에 따른 성능 변화는 분석하지 않았다."),
  H2("2.2 이미지 인식 모델의 열화 강건성"),
  P("Hendrycks와 Dietterich[2]는 ImageNet-C를 통해 노이즈, 블러, 날씨, 디지털 변형(JPEG 압축, 픽셀화 등) 15종의 열화를 5단계 심각도로 적용하는 강건성 평가 체계를 제안하였다. 이 연구는 열화 요인과 단계적 심각도를 체계적으로 정의하는 표준적 방법론을 제시하였으며, 본 연구의 열화 수준 설계도 이 체계를 참고한다."),
  H2("2.3 영상 인식 모델의 열화 강건성"),
  P("Yi 등[3]은 Mini Kinetics-C와 Mini SSV2-C를 구축하여 공간 열화뿐 아니라 프레임 손실, 비트레이트 압축 등 시간 축 열화가 시공간 모델에 미치는 영향을 분석하였다. Schiappa 등[4]은 90종의 실제 분포 변화 교란을 적용하여 6개 행동 인식 모델의 강건성을 대규모로 평가하였고, Transformer 기반 모델이 CNN 기반 모델보다 강건함을 보였다. 그러나 두 연구 모두 행동 분류 정확도라는 단일 지표에 초점을 두었으며, 시점·위치·유형 판단을 동시에 요구하는 사고 탐지 과제는 다루지 않았다."),
  P("본 연구는 [1]의 사고 탐지 과제에 [2–4]의 열화 강건성 평가 방법론을 적용하되, 판단 능력별로 성능 저하를 분리 분석한다는 점에서 기존 연구와 차별화된다."),
);

// ───────── 6. 본론
add(
  H1("3. 연구 방법"),
  H2("3.1 데이터셋"),
  P("본 연구는 ACCIDENT 벤치마크[1]의 실제 CCTV 영상 2,027개 중 공식 IID test split에 해당하는 1,520개를 평가에 사용한다. 공식 split은 충돌 유형 비율을 고려해 층화 분할되어 있으며, 공식 벤치마크 결과와 직접 비교할 수 있다. 합성 영상은 렌더링 품질이 균일하여 실제 열화 영향을 측정하기에 적합하지 않으므로 제외한다. 실제 영상의 특성은 표 1과 같다."),
  caption("표 1. ACCIDENT 실제 영상 세트의 특성[1]"),
  table([2600, 6426], [
    ["항목", "내용"],
    ["영상 수", "2,027개 (공개 교통 CCTV 소스에서 수집), 이 중 평가 사용 1,520개 (공식 IID test split)"],
    ["해상도", "314p ~ 3,840p (이질적)"],
    ["프레임률", "4 ~ 50 FPS"],
    ["길이 (test split)", "중앙값 29.9초, 99%가 30.1초 이하"],
    ["해상도 (test split, 짧은 변)", "중앙값 720p (240p ~ 2,160p)"],
    ["인코딩 (test split)", "전부 H.264 High, 비트레이트 중앙값 748kbps (CRF 23 수준)"],
    ["주간 / 야간 (test split)", "1,034개 / 486개"],
    ["주석", "사고 발생 시점, 충돌 위치 좌표, 충돌 유형"],
    ["충돌 유형 (5종)", "T-bone(측면 직각), Head-on(정면), Rear-end(추돌), Sideswipe(측면 접촉), Single-vehicle(단독)"],
    ["원본 화질 등급 (test split)", "Excellent 53 / Good 247 / Fine 412 / Poor 573 / Very Poor 235"],
    ["충돌 유형 분포 (test split)", "T-bone 506 / Single 500 / Rear-end 240 / Sideswipe 184 / Head-on 90"],
  ]),
  H2("3.2 평가 모델"),
  P("평가 모델로는 ACCIDENT 공식 저장소에서 제공하는 zero-shot VLM 베이스라인 중 Molmo-7B-D[5] 단일 모델을 사용한다. Molmo-7B-D는 원 논문에서 시점·위치·유형 세 과업의 실제 영상 성능이 모두 보고된 모델로, 원본 성능 재현의 기준이 명확하다. 원본과 모든 열화 조건에서 프롬프트, 프레임 추출 간격, 디코딩 방식(greedy)을 동일하게 고정하고 입력 영상만 변경한다. 영상은 0.5초 간격으로 프레임을 추출하여 모델에 입력한다. zero-shot 모델을 선택한 이유는 다음과 같다. 첫째, 추가 학습이 없으므로 학습 데이터의 화질 분포가 결과에 개입하지 않아 열화의 영향만을 분리하여 관찰할 수 있다. 둘째, 공식 코드로 원본 성능을 재현할 수 있어 비교 기준이 명확하다. 셋째, 범용 VLM을 CCTV 관제에 활용하려는 최근 흐름을 반영한다."),
  H2("3.3 열화 변수 선정 및 이유"),
  P("열화 변수는 (1) 실제 CCTV 운용 환경에서 빈번하게 발생하고, (2) 파라미터로 수준을 정량 제어할 수 있으며, (3) 서로 다른 시각 정보를 손상시켜 판단 능력별 차이를 드러낼 수 있는 요인을 기준으로 선정하였다(표 2)."),
  caption("표 2. 열화 변수 선정 근거"),
  table([1500, 3263, 4263], [
    ["열화 변수", "CCTV 환경에서의 발생 원인", "손상되는 정보 및 예상 영향"],
    ["해상도 저하", "저가 카메라, 원거리 설치, 저장·전송 비용 절감을 위한 다운스케일", "공간 세부 정보 손실 → 작은 차량의 위치(Where)·충돌 형태(What) 판단 저하 예상"],
    ["영상 압축", "제한된 대역폭·저장 용량으로 인한 저비트레이트 H.264/H.265 스트리밍", "블록·링잉 아티팩트, 빠른 움직임 구간의 화질 붕괴 → 충돌 순간(When) 판단 저하 예상"],
    ["모션 블러", "야간·저조도에서의 긴 노출 시간, 고속 차량, 바람에 의한 카메라 흔들림", "움직임 경계 번짐 → 차량 간 접촉 시점(When)·유형(What) 판단 저하 예상"],
  ]),
  P([run("저조도 제외 이유. ", { bold: true }), run("저조도는 CCTV의 대표적 열화 조건이지만 본 연구에서는 제외한다. 첫째, 밝기·감마를 낮추는 합성 방식으로는 실제 야간 CCTV의 센서 노이즈 증가, 가로등·헤드라이트 번짐, 적외선 모드 전환이 재현되지 않아 합성 저조도가 실제 야간 환경을 대표한다고 보기 어렵다. 둘째, 실제 저조도는 긴 노출로 인한 모션 블러를 함께 유발하므로 단독 요인으로 분리하면 모션 블러 조건과 효과가 겹친다. 셋째, 요인 수를 3개로 제한하여 분석 범위를 관리한다. 대신 평가 데이터에 포함된 실제 야간 영상 486개를 하위 그룹으로 분리하여, 합성 없이 저조도 환경에서의 열화 민감도를 간접적으로 분석한다. 안개·비 등 기상 조건도 같은 이유로 제외한다.")]),
  H2("3.4 열화 수준의 단계 설정 근거"),
  P("각 열화는 ImageNet-C[2]의 단계적 심각도 체계를 참고하되, 임의의 수치가 아닌 코덱 설정과 촬영 조건에 근거하여 경(L1)·중(L2)·강(L3)의 3단계로 설정한다(표 3). ACCIDENT 영상은 해상도가 제각각이므로, 모든 영상에 모든 단계를 적용하여 단계 간 비교의 공정성을 확보하도록, 세 요인 모두 절대값이 아닌 원본 대비 상대 강도로 정의한다. 최종 파라미터는 50~100개 영상을 사용한 pilot test에서 L3가 원본 대비 의미 있는 성능 저하를 보이는지 확인한 후 확정한다."),
  caption("표 3. 열화별 3단계 파라미터 (pilot test 후 확정)"),
  table([1300, 1000, 1000, 1000, 4726], [
    ["열화 변수", "L1 (경)", "L2 (중)", "L3 (강)", "설정 근거"],
    ["해상도 저하", "원본의 1/2", "원본의 1/4", "원본의 1/8", "가로·세로를 원본 대비 비율로 다운샘플한 뒤 원래 크기로 복원(bicubic). 1,520개 전체에 모든 단계를 적용할 수 있어 단계 간 표본이 동일하다. 단계별 결과 해상도의 중앙값을 함께 보고하여 CCTV 해상도 규격(HD·SD·CIF급)과의 대응을 제시"],
    ["영상 압축", "CRF 29", "CRF 35", "CRF 41", "H.264(libx264) 재인코딩. 평가 영상은 모두 CRF 23 수준으로 인코딩되어 있어(CRF 23 재인코딩 시 원본 크기의 96%), 샘플 40개 실측 결과 세 값이 원본 비트레이트의 약 1/2·1/4·1/8(중앙값 0.51·0.25·0.12)을 만든다"],
    ["모션 블러", "폭의 1%", "폭의 2%", "폭의 4%", "수평 방향 선형 모션 블러 커널의 길이를 프레임 폭 대비 비율로 설정. 블러 길이는 노출 시간 동안 차량의 이동 거리에 비례하므로 노출 시간이 2배씩 증가하는 상황을 모사. 방향을 고정하여 강도만 변수로 둠"],
  ]),
  P("해상도 저하와 모션 블러는 모델 입력 프레임에 직접 적용하고, 압축은 실제 코덱 아티팩트(프레임 간 예측 오류 등)를 재현하기 위해 영상 단위로 재인코딩한 뒤 프레임을 추출한다."),
  H2("3.5 전체 분석 구성도"),
  P("전체 분석 과정은 그림 1과 같이 원본 성능 재현, 열화 영상 생성, 추론, 판단 능력별 평가, 취약성 분석의 순서로 구성된다."),
  box("① 데이터 준비", "ACCIDENT 실제 CCTV 영상 1,520개 (공식 test split)"), arrow(),
  box("② 원본 성능 재현", "공식 baseline (Molmo-7B-D, zero-shot)"), arrow(),
  box("③ 열화 영상 생성", "해상도 · 압축 · 모션 블러 × L1~L3 = 9개 조건"), arrow(),
  box("④ 추론", "원본 1 + 열화 9 = 10개 조건 동일 설정으로 추론"), arrow(),
  box("⑤ 판단 능력별 평가", "When(시점) · Where(위치) · What(유형)"), arrow(),
  box("⑥ 취약성 분석", "열화별 · 판단 능력별 · 사고 유형별 비교"),
  caption("그림 1. 전체 분석 구성도"),
  H2("3.6 평가 지표 및 비교 분석 방법"),
  P("판단 능력별 성능은 ACCIDENT 공식 지표[1]를 따른다."),
  bullet([run("When (시점): ", { bold: true }), run("정답 시점과 예측 시점의 차이에 대한 가우시안 유사도 exp(−(t* − t̂)² / 2σ²), σ = 1초")]),
  bullet([run("Where (위치): ", { bold: true }), run("정답 좌표와 예측 좌표 간 이방성 가우시안 유사도(정규화된 박스 크기 기준)")]),
  bullet([run("What (유형): ", { bold: true }), run("5개 충돌 유형에 대한 Top-1 정확도")]),
  P("열화의 영향은 원본 대비 상대 성능 저하율(Relative Performance Drop, RPD)로 비교한다. RPD = (P₀ − P_k) / P₀ × 100(%)이며, P₀는 원본 성능, P_k는 열화 수준 k에서의 성능이다. 세 판단 능력은 원본 성능 수준이 서로 다르므로, 절대 점수가 아닌 RPD로 비교해야 공정한 비교가 가능하다."),
  P("공식 파이프라인에서 위치 판단은 예측된 사고 시점의 프레임을 입력으로 사용하므로, 시점 예측 오류가 위치 점수에 전파될 수 있다. 이를 분리하기 위해 Where는 (a) 예측 시점 기반과 (b) 정답 시점(oracle) 기반의 두 방식으로 측정한다. 비교 분석은 다음 세 가지로 수행한다."),
  bullet([run("비교 1 – 열화 수준별 성능 변화: ", { bold: true }), run("열화 수준(원본~L3)에 따른 When/Where/What 점수 변화 곡선")]),
  bullet([run("비교 2 – 판단 능력별 취약성: ", { bold: true }), run("열화 3종 × 판단 능력 3종의 RPD 히트맵으로 가장 취약한 조합 식별")]),
  bullet([run("비교 3 – 사고 유형별 민감도: ", { bold: true }), run("5개 충돌 유형별 정확도의 RPD 비교 (Head-on은 90개로 표본이 적어 해석에 유의)")]),
  bullet([run("비교 4 – 촬영 환경별 민감도: ", { bold: true }), run("주간/야간, 원본 화질 3단계(좋음·보통·나쁨)별 RPD 비교. 원본 화질이 낮은 영상에서 추가 열화의 영향이 작게 나타나는 천장 효과를 검증")]),
  P("모든 조건에 동일한 영상이 사용되므로, 각 성능 값과 RPD에는 영상 단위로 짝지은(paired) 부트스트랩 재표본추출(1,000회)로 95% 신뢰구간을 제시한다. 특정 조합이 더 취약하다는 판단은 신뢰구간이 0을 포함하지 않는 경우에만 내린다. 결과는 표 4의 형식으로 정리한다."),
  H2("3.7 실험 절차"),
  P("전체 실험에 앞서 층화 추출한 100개 영상으로 pilot test를 수행한다. 원본 100개와, 그중 50개에 대한 세 요인의 L3 조건을 추론하여 (1) 원본 성능이 원 논문 수치에 근접하는지, (2) 전체 실험의 예상 소요 시간이 허용 범위 이내인지, (3) 각 요인의 L3에서 성능 저하가 관찰되는지를 확인한다. 압축 L3에서 저하가 관찰되지 않으면 압축 단계를 CRF 35/41/47로 강화한다. 이후 1,520개 영상 전체에 10개 조건을 적용하여 추론한다."),
  caption("표 4. 열화 조건별 판단 능력 성능 (실험 후 기입)"),
  table([2226, 1700, 1700, 1700, 1700], [
    ["조건", "When", "Where (예측 시점)", "Where (oracle)", "What"],
    ["원본", "[ ]", "[ ]", "[ ]", "[ ]"],
    ["해상도 L1 / L2 / L3", "[ ]", "[ ]", "[ ]", "[ ]"],
    ["압축 L1 / L2 / L3", "[ ]", "[ ]", "[ ]", "[ ]"],
    ["모션 블러 L1 / L2 / L3", "[ ]", "[ ]", "[ ]", "[ ]"],
  ]),
);

// ───────── 7. 결론
add(
  H1("4. 결론"),
  P("본 연구는 CCTV 환경의 대표적 열화 요인인 해상도 저하, 영상 압축, 모션 블러를 CCTV 규격과 코덱 설정에 근거한 3단계로 적용하여, 교통사고 탐지 AI의 성능 저하를 사고 발생 시점·위치·유형의 판단 능력별로 분석하는 평가 체계를 제시하였다. 이를 통해 어떤 판단 능력이 어떤 열화 조건에 가장 취약한지, 그리고 어떤 사고 유형이 특정 열화에 더 민감한지를 정량적으로 규명하고자 한다."),
  P([todo("[실험 후 기입: 주요 발견 1~2문장, 예) \"~열화에서 ~판단 능력의 RPD가 가장 컸다\"]")], { noIndent: true }),
  P("본 연구는 원본 영상 자체가 이미 다양한 품질을 가진다는 점과 단일 모델을 중심으로 평가하였다는 한계가 있다. 후속 연구에서는 본 연구에서 확인된 취약 조건을 대상으로 영상 복원 전처리, 열화 증강 기반 미세조정, 합성 데이터 활용 등 강건성 향상 기법을 적용하고 그 효과를 검증할 예정이다. 또한 기상 및 저조도 조건으로 열화 요인을 확장할 계획이다."),
);

// ───────── 8. 참고문헌
const refs = [
  "L. Picek, M. Čermák, M. Hanzl, and V. Čermák, \"ACCIDENT: A Benchmark Dataset for Vehicle Accident Detection from Traffic Surveillance Videos,\" in Proc. IEEE/CVF Conf. Computer Vision and Pattern Recognition Workshops (CVPRW), 2026. arXiv:2604.09819.",
  "D. Hendrycks and T. Dietterich, \"Benchmarking Neural Network Robustness to Common Corruptions and Perturbations,\" in Proc. Int. Conf. Learning Representations (ICLR), 2019.",
  "C. Yi, S. Yang, H. Li, Y.-P. Tan, and A. Kot, \"Benchmarking the Robustness of Spatial-Temporal Models Against Corruptions,\" in Proc. NeurIPS Datasets and Benchmarks Track, 2021.",
  "M. C. Schiappa, N. Biyani, P. Kamtam, S. Vyas, H. Palangi, V. Vineet, and Y. S. Rawat, \"A Large-Scale Robustness Analysis of Video Action Recognition Models,\" in Proc. IEEE/CVF Conf. Computer Vision and Pattern Recognition (CVPR), pp. 14698–14708, 2023.",
  "M. Deitke et al., \"Molmo and PixMo: Open Weights and Open Data for State-of-the-Art Vision-Language Models,\" arXiv:2409.17146, 2024.",
];
add(H1("참고문헌"));
refs.forEach((r, i) =>
  add(new Paragraph({
    indent: { left: 440, hanging: 440 },
    spacing: { after: 80 },
    children: [run(`[${i + 1}] `, { size: 18 }), run(r, { size: 18 })],
  }))
);

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true, color: "1F3864" }, paragraph: { outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 21, bold: true }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 560, hanging: 280 } } } }],
    }],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(require("path").join(__dirname, "..", "paper", "논문초안_CCTV열화_사고탐지.docx"), buf);
  console.log("written");
});
