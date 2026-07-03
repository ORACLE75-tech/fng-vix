"use strict";

/* ============================================================
 * 내일 날씨 준비 앱
 * 데이터: Open-Meteo (무료 / API 키 불필요)
 * ============================================================ */

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  geoBtn: document.getElementById("geoBtn"),
  suggestions: document.getElementById("suggestions"),
  placeholder: document.getElementById("placeholder"),
  loader: document.getElementById("loader"),
  error: document.getElementById("error"),
  result: document.getElementById("result"),
  dateBar: document.getElementById("dateBar"),
  dateInput: document.getElementById("dateInput"),
  quickDays: document.getElementById("quickDays"),
};

/* 현재 선택된 위치/예보 데이터 (날짜 변경 시 재요청 없이 재계산) */
const state = { data: null, label: null };

/* 예보 가능 일수 (Open-Meteo 무료: 오늘 포함 최대 16일) */
const FORECAST_DAYS = 16;

/* ---------- WMO 날씨 코드 → 아이콘 / 설명 ---------- */
const WMO = {
  0:  ["☀️", "맑음"],
  1:  ["🌤️", "대체로 맑음"],
  2:  ["⛅", "부분적으로 구름"],
  3:  ["☁️", "흐림"],
  45: ["🌫️", "안개"],
  48: ["🌫️", "짙은 서리 안개"],
  51: ["🌦️", "약한 이슬비"],
  53: ["🌦️", "이슬비"],
  55: ["🌧️", "강한 이슬비"],
  56: ["🌧️", "얼어붙는 약한 이슬비"],
  57: ["🌧️", "얼어붙는 이슬비"],
  61: ["🌦️", "약한 비"],
  63: ["🌧️", "비"],
  65: ["🌧️", "강한 비"],
  66: ["🌧️", "얼어붙는 약한 비"],
  67: ["🌧️", "얼어붙는 비"],
  71: ["🌨️", "약한 눈"],
  73: ["🌨️", "눈"],
  75: ["❄️", "강한 눈"],
  77: ["🌨️", "싸락눈"],
  80: ["🌦️", "약한 소나기"],
  81: ["🌧️", "소나기"],
  82: ["⛈️", "강한 소나기"],
  85: ["🌨️", "약한 눈 소나기"],
  86: ["❄️", "강한 눈 소나기"],
  95: ["⛈️", "뇌우"],
  96: ["⛈️", "우박 동반 뇌우"],
  99: ["⛈️", "강한 우박 동반 뇌우"],
};
const wmoInfo = (code) => WMO[code] || ["🌡️", "정보 없음"];

/* ---------- 유틸 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const round = (n) => Math.round(n);

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function setState({ loading = false, error = null, hasResult = false } = {}) {
  hide(els.placeholder);
  loading ? show(els.loader) : hide(els.loader);
  if (error) {
    els.error.textContent = error;
    show(els.error);
  } else {
    hide(els.error);
  }
  hasResult ? show(els.result) : hide(els.result);
  if (!loading && !error && !hasResult) show(els.placeholder);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  return res.json();
}

/* ---------- 한국 주요 도시 사전 ----------
 * Open-Meteo 지오코딩은 한글(예: "서울") 검색이 매칭되지 않으므로,
 * 한국 주요 시·도/도시는 내장 사전으로 즉시 처리하고
 * 그 외(영문·해외 도시)는 API로 폴백한다.
 * 값: [위도, 경도, 시도명]
 */
const KR_CITIES = {
  "서울": [37.5665, 126.9780, "서울특별시"],
  "부산": [35.1796, 129.0756, "부산광역시"],
  "인천": [37.4563, 126.7052, "인천광역시"],
  "대구": [35.8714, 128.6014, "대구광역시"],
  "대전": [36.3504, 127.3845, "대전광역시"],
  "광주": [35.1595, 126.8526, "광주광역시"],
  "울산": [35.5384, 129.3114, "울산광역시"],
  "세종": [36.4801, 127.2890, "세종특별자치시"],
  "수원": [37.2636, 127.0286, "경기도"],
  "성남": [37.4200, 127.1267, "경기도"],
  "용인": [37.2411, 127.1776, "경기도"],
  "고양": [37.6584, 126.8320, "경기도"],
  "부천": [37.5034, 126.7660, "경기도"],
  "안양": [37.3943, 126.9568, "경기도"],
  "안산": [37.3219, 126.8309, "경기도"],
  "화성": [37.1996, 126.8312, "경기도"],
  "남양주": [37.6360, 127.2165, "경기도"],
  "평택": [36.9921, 127.1128, "경기도"],
  "의정부": [37.7380, 127.0338, "경기도"],
  "파주": [37.7599, 126.7800, "경기도"],
  "김포": [37.6152, 126.7156, "경기도"],
  "광명": [37.4786, 126.8644, "경기도"],
  "하남": [37.5394, 127.2148, "경기도"],
  "이천": [37.2722, 127.4350, "경기도"],
  "구리": [37.5944, 127.1296, "경기도"],
  "춘천": [37.8813, 127.7300, "강원특별자치도"],
  "원주": [37.3422, 127.9202, "강원특별자치도"],
  "강릉": [37.7519, 128.8761, "강원특별자치도"],
  "속초": [38.2070, 128.5918, "강원특별자치도"],
  "동해": [37.5247, 129.1143, "강원특별자치도"],
  "청주": [36.6424, 127.4890, "충청북도"],
  "충주": [36.9910, 127.9259, "충청북도"],
  "제천": [37.1326, 128.1910, "충청북도"],
  "천안": [36.8151, 127.1139, "충청남도"],
  "아산": [36.7898, 127.0019, "충청남도"],
  "서산": [36.7848, 126.4503, "충청남도"],
  "당진": [36.8895, 126.6457, "충청남도"],
  "공주": [36.4465, 127.1190, "충청남도"],
  "보령": [36.3331, 126.6128, "충청남도"],
  "전주": [35.8242, 127.1480, "전북특별자치도"],
  "익산": [35.9483, 126.9576, "전북특별자치도"],
  "군산": [35.9676, 126.7369, "전북특별자치도"],
  "여수": [34.7604, 127.6622, "전라남도"],
  "순천": [34.9506, 127.4872, "전라남도"],
  "목포": [34.8118, 126.3922, "전라남도"],
  "광양": [34.9407, 127.6960, "전라남도"],
  "나주": [35.0160, 126.7108, "전라남도"],
  "포항": [36.0190, 129.3435, "경상북도"],
  "경주": [35.8562, 129.2247, "경상북도"],
  "구미": [36.1196, 128.3446, "경상북도"],
  "안동": [36.5684, 128.7294, "경상북도"],
  "경산": [35.8251, 128.7414, "경상북도"],
  "김천": [36.1398, 128.1136, "경상북도"],
  "창원": [35.2280, 128.6811, "경상남도"],
  "김해": [35.2285, 128.8894, "경상남도"],
  "진주": [35.1800, 128.1076, "경상남도"],
  "양산": [35.3350, 129.0378, "경상남도"],
  "거제": [34.8806, 128.6211, "경상남도"],
  "통영": [34.8544, 128.4331, "경상남도"],
  "밀양": [35.5038, 128.7464, "경상남도"],
  "제주": [33.4996, 126.5312, "제주특별자치도"],
  "서귀포": [33.2541, 126.5600, "제주특별자치도"],
};

function localSearch(q) {
  const query = q.replace(/\s/g, "");
  if (!query) return [];
  const starts = [];
  const includes = [];
  for (const [name, [lat, lon, region]] of Object.entries(KR_CITIES)) {
    const hit = { name, latitude: lat, longitude: lon, admin1: region, country: "대한민국" };
    if (name === query || name.startsWith(query) || query.startsWith(name)) starts.push(hit);
    else if (name.includes(query)) includes.push(hit);
  }
  return [...starts, ...includes].slice(0, 6);
}

/* ---------- 지오코딩 (도시 검색) ---------- */
async function searchCity(name) {
  // 한국 주요 도시는 내장 사전으로 즉시 처리 (한글 검색 지원)
  const local = localSearch(name);
  if (local.length) return local;
  // 그 외(영문/해외 도시 등)는 Open-Meteo 지오코딩 API로 폴백
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=5&language=ko&format=json`;
  const data = await fetchJSON(url);
  return data.results || [];
}

function renderSuggestions(list) {
  if (!list.length) { hide(els.suggestions); return; }
  els.suggestions.innerHTML = "";
  list.forEach((c) => {
    const li = document.createElement("li");
    const region = [c.admin1, c.country].filter(Boolean).join(", ");
    li.innerHTML = `<strong>${c.name}</strong> <small>${region}</small>`;
    li.addEventListener("click", () => {
      hide(els.suggestions);
      els.input.value = c.name;
      loadWeather(c.latitude, c.longitude, `${c.name}${region ? ", " + region : ""}`);
    });
    els.suggestions.appendChild(li);
  });
  show(els.suggestions);
}

/* ---------- 예보 불러오기 ---------- */
async function loadWeather(lat, lon, label) {
  hide(els.suggestions);
  setState({ loading: true });
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      timezone: "auto",
      forecast_days: String(FORECAST_DAYS),
      hourly: [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
        "uv_index",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "uv_index_max",
        "sunrise",
        "sunset",
      ].join(","),
    });
    const data = await fetchJSON(`${FORECAST_URL}?${params}`);
    state.data = data;
    state.label = label;

    // 날짜 선택 가능 범위 설정 (오늘 ~ 마지막 예보일)
    els.dateInput.min = data.daily.time[0];
    els.dateInput.max = data.daily.time[data.daily.time.length - 1];
    // 선택값이 없거나 범위를 벗어나면 기본값 '내일'
    if (!els.dateInput.value ||
        els.dateInput.value < els.dateInput.min ||
        els.dateInput.value > els.dateInput.max) {
      els.dateInput.value = data.daily.time[Math.min(1, data.daily.time.length - 1)];
    }
    show(els.dateBar);

    renderForDate(els.dateInput.value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    setState({ error: `날씨 정보를 가져오지 못했습니다: ${err.message}` });
  }
}

/* 선택된 날짜로 요약 계산 후 렌더 (저장된 데이터 사용, 재요청 없음) */
function renderForDate(dateStr) {
  if (!state.data) return;
  const di = state.data.daily.time.indexOf(dateStr);
  if (di < 0) {
    setState({ error: "선택한 날짜는 예보 범위를 벗어났습니다." });
    return;
  }
  updateQuickDayButtons(dateStr);
  const summary = buildDaySummary(state.data, state.label, di);
  renderResult(summary);
  setState({ hasResult: true });
}

/* '오늘/내일/모레' 빠른 버튼 활성화 표시 */
function updateQuickDayButtons(dateStr) {
  const today = todayStr();
  const offset = daysBetween(today, dateStr);
  els.quickDays.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.offset) === offset);
  });
}

/* ---------- 날짜 유틸 ---------- */
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + "T00:00:00");
  const b = new Date(toStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
/* 오늘 기준 상대 표현 (오늘/내일/모레/글피/N일 후·전) + 요일 */
function relativeDayLabel(dateStr) {
  const off = daysBetween(todayStr(), dateStr);
  const names = { 0: "오늘", 1: "내일", 2: "모레", 3: "글피" };
  if (names[off]) return names[off];
  if (off > 0) return `${off}일 후`;
  if (off === -1) return "어제";
  return `${-off}일 전`;
}

/* ---------- 특정 날짜(daily 인덱스 di) 데이터 요약 ---------- */
function buildDaySummary(data, label, di) {
  const d = data.daily;
  const date = new Date(d.time[di] + "T00:00:00");

  // 해당 날짜에 해당하는 시간(hourly) 인덱스 모으기
  const dayStr = d.time[di];
  const idx = [];
  data.hourly.time.forEach((t, i) => { if (t.startsWith(dayStr)) idx.push(i); });

  const h = data.hourly;
  const pick = (key) => idx.map((i) => h[key][i]);

  const temps = pick("temperature_2m");
  const humid = pick("relative_humidity_2m");
  const pop = pick("precipitation_probability");
  const precip = pick("precipitation");
  const clouds = pick("cloud_cover");
  const wind = pick("wind_speed_10m");

  // 출근/외출 시간대(07~09시)와 퇴근(18~20시) 강조용
  const hours = idx.map((i) => new Date(h.time[i]).getHours());
  const slice = (from, to) => {
    const out = [];
    hours.forEach((hr, k) => { if (hr >= from && hr <= to) out.push(k); });
    return out;
  };
  const avgAt = (arr, sel) => {
    const v = sel.map((k) => arr[k]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const maxAt = (arr, sel) => {
    const v = sel.map((k) => arr[k]).filter((x) => x != null);
    return v.length ? Math.max(...v) : null;
  };

  const morn = slice(7, 9);
  const eve = slice(18, 20);

  // 시간대별 카드 (3시간 간격)
  const hourly = idx
    .map((i) => ({
      time: new Date(h.time[i]),
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      pop: h.precipitation_probability[i],
    }))
    .filter((x) => x.time.getHours() % 3 === 0);

  return {
    label,
    date,
    code: d.weather_code[di],
    tMax: d.temperature_2m_max[di],
    tMin: d.temperature_2m_min[di],
    feelsMax: d.apparent_temperature_max[di],
    feelsMin: d.apparent_temperature_min[di],
    feelsMorning: avgAt(pick("apparent_temperature"), morn),
    feelsEvening: avgAt(pick("apparent_temperature"), eve),
    humidityAvg: avgAt(humid, humid.map((_, k) => k)),
    popMax: d.precipitation_probability_max[di] ?? Math.max(...pop.filter((x) => x != null), 0),
    popMorning: maxAt(pop, morn),
    popEvening: maxAt(pop, eve),
    precipSum: d.precipitation_sum[di],
    cloudAvg: avgAt(clouds, clouds.map((_, k) => k)),
    windMax: d.wind_speed_10m_max[di],
    windAvg: avgAt(wind, wind.map((_, k) => k)),
    uvMax: d.uv_index_max[di],
    sunrise: new Date(d.sunrise[di]),
    sunset: new Date(d.sunset[di]),
    diurnal: d.temperature_2m_max[di] - d.temperature_2m_min[di],
    hourly,
  };
}

/* ============================================================
 *  심층 추천 엔진
 * ============================================================ */

/* 기온(체감 기준)별 옷차림 가이드 */
function clothingByTemp(t) {
  if (t >= 28) return {
    level: "한여름", emoji: "🩳",
    items: "민소매·반팔 티셔츠, 반바지, 린넨 소재, 원피스",
    text: "매우 덥습니다. 통풍이 잘 되는 얇고 밝은 옷을 입고, 땀 흡수가 좋은 면·기능성 소재를 권합니다.",
  };
  if (t >= 23) return {
    level: "더움", emoji: "👕",
    items: "반팔 티셔츠, 얇은 셔츠, 반바지·면바지",
    text: "덥습니다. 반팔 위주로 입되 실내 냉방에 대비해 얇은 겉옷을 하나 챙기면 좋습니다.",
  };
  if (t >= 20) return {
    level: "따뜻함", emoji: "👔",
    items: "긴팔 티셔츠, 얇은 셔츠·블라우스, 얇은 가디건, 면바지",
    text: "활동하기 좋은 날씨입니다. 아침저녁 선선할 수 있어 얇은 가디건 한 장을 추천합니다.",
  };
  if (t >= 17) return {
    level: "선선함", emoji: "🧥",
    items: "얇은 니트, 맨투맨, 후드, 가디건, 청바지",
    text: "선선합니다. 긴팔에 얇은 겉옷을 더해 레이어링하기 좋은 기온입니다.",
  };
  if (t >= 12) return {
    level: "쌀쌀함", emoji: "🧥",
    items: "자켓, 가디건, 야상, 트렌치코트, 스타킹, 청바지",
    text: "쌀쌀합니다. 바람을 막아주는 자켓이나 가벼운 코트를 챙기세요.",
  };
  if (t >= 9) return {
    level: "추움", emoji: "🧣",
    items: "트렌치코트, 야상, 점퍼, 니트, 스타킹, 청바지",
    text: "춥습니다. 도톰한 겉옷과 함께 안에 한 겹 더 입는 것을 권합니다.",
  };
  if (t >= 5) return {
    level: "많이 추움", emoji: "🧥",
    items: "코트, 가죽·두꺼운 자켓, 히트텍, 니트, 레깅스, 기모바지",
    text: "많이 춥습니다. 코트 안에 히트텍 등 보온 내의를 받쳐 입으세요.",
  };
  return {
    level: "혹한", emoji: "🧤",
    items: "두꺼운 패딩, 롱코트, 목도리, 장갑, 기모 제품, 내복",
    text: "매우 춥습니다. 패딩과 목도리·장갑으로 보온하고 노출 부위를 최소화하세요.",
  };
}

function buildAdvice(s) {
  const advice = [];   // 큰 카드형 조언
  const checklist = []; // 챙길 물건 체크리스트
  const notes = [];     // 유의사항

  /* --- 1. 옷차림 (체감 최저~최고 기준) --- */
  const cLow = clothingByTemp(s.feelsMin);
  const cHigh = clothingByTemp(s.feelsMax);
  let clothingText = `<strong>${cLow.items}</strong> 정도가 적당합니다. ${cLow.text}`;
  if (cLow.level !== cHigh.level) {
    clothingText += ` 낮에는 체감 ${round(s.feelsMax)}°C까지 올라 <strong>${cHigh.level}</strong> 수준이 되니, 벗고 입기 편한 <strong>레이어링(겹쳐 입기)</strong>을 추천합니다.`;
  }
  advice.push({
    emoji: cLow.emoji,
    title: `옷차림 — ${cLow.level}`,
    badge: null,
    text: clothingText,
  });

  /* --- 2. 일교차 --- */
  if (s.diurnal >= 10) {
    advice.push({
      emoji: "🌡️",
      title: "일교차 큼",
      badge: { type: "warn", label: `${round(s.diurnal)}°C 차이` },
      text: `아침 최저 ${round(s.tMin)}°C, 낮 최고 ${round(s.tMax)}°C로 <strong>일교차가 큽니다.</strong> 겉옷을 꼭 챙기고, 감기에 유의하세요. 출근길(체감 ${s.feelsMorning != null ? round(s.feelsMorning) : round(s.feelsMin)}°C)은 특히 쌀쌀할 수 있습니다.`,
    });
    checklist.push(["🧥", "탈착 가능한 겉옷 (일교차 대비)"]);
  }

  /* --- 3. 비 / 우산 (눈일 때는 4번 블록에서 처리) --- */
  const isSnow = (s.code >= 71 && s.code <= 77) || (s.code >= 85 && s.code <= 86);
  const pop = s.popMax ?? 0;
  const rainCode = s.code >= 51 && s.code <= 99 && !isSnow;
  if (isSnow) {
    // 강수 안내는 눈 블록에서 처리하므로 우산 조언은 건너뜀
  } else if (pop >= 60 || s.precipSum >= 5) {
    advice.push({
      emoji: "☔",
      title: "우산 꼭 챙기세요",
      badge: { type: "bad", label: `강수확률 ${round(pop)}%` },
      text: `비가 올 가능성이 높습니다(예상 강수량 ${s.precipSum?.toFixed(1) ?? 0}mm). <strong>튼튼한 장우산</strong>과 방수 신발을 권합니다.${s.popMorning >= 50 ? " 출근 시간대에 비가 예상됩니다." : ""}${s.popEvening >= 50 ? " 퇴근 시간대에도 비 소식이 있어 우산을 두고 오지 마세요." : ""}`,
    });
    checklist.push(["☂️", "우산 (장우산 권장)"]);
    checklist.push(["👟", "방수·여벌 신발 고려"]);
  } else if (pop >= 30) {
    advice.push({
      emoji: "🌂",
      title: "우산 챙기면 안심",
      badge: { type: "warn", label: `강수확률 ${round(pop)}%` },
      text: `소나기·약한 비 가능성이 있습니다. <strong>접이식 우산</strong>을 가방에 넣어두면 안심입니다.`,
    });
    checklist.push(["🌂", "접이식 우산"]);
  } else if (rainCode) {
    checklist.push(["🌂", "혹시 모를 비 대비 접이식 우산"]);
  }

  /* --- 4. 눈 --- */
  if (isSnow) {
    advice.push({
      emoji: "❄️",
      title: "눈 소식",
      badge: { type: "bad", label: "눈" },
      text: "눈이 예상됩니다. <strong>미끄럼 방지 신발</strong>과 방수 외투를 준비하고, 대중교통 지연·도로 결빙에 대비해 평소보다 일찍 출발하세요.",
    });
    checklist.push(["🥾", "미끄럼 방지 신발"]);
    notes.push("도로 결빙·교통 지연 가능 — 여유 있게 출발하세요.");
  }

  /* --- 5. 습도 --- */
  if (s.humidityAvg != null) {
    if (s.humidityAvg >= 75 && s.feelsMax >= 24) {
      advice.push({
        emoji: "💧",
        title: "습하고 후텁지근함",
        badge: { type: "warn", label: `습도 ${round(s.humidityAvg)}%` },
        text: "습도가 높아 끈적하고 더 덥게 느껴집니다. 통풍 잘 되는 옷, 손수건·여벌 티셔츠, 충분한 수분 섭취를 권합니다.",
      });
      checklist.push(["🧴", "손수건·물티슈, 여벌 티셔츠"]);
    } else if (s.humidityAvg <= 35) {
      notes.push(`공기가 건조합니다(습도 ${round(s.humidityAvg)}%). 보습·립밤과 수분 섭취, 정전기에 유의하세요.`);
    }
  }

  /* --- 6. 바람 --- */
  if (s.windMax != null && s.windMax >= 36) {
    advice.push({
      emoji: "🌬️",
      title: "강한 바람",
      badge: { type: "bad", label: `최대 ${round(s.windMax)} km/h` },
      text: "바람이 강하게 붑니다. 체감온도가 더 낮아지고 우산이 뒤집힐 수 있으니, 바람막이 외투와 모자 고정에 유의하세요.",
    });
    notes.push("강풍 — 우산보다 우비가 나을 수 있고, 가벼운 물건 비산에 주의하세요.");
  } else if (s.windMax != null && s.windMax >= 20) {
    notes.push(`바람이 다소 강합니다(최대 ${round(s.windMax)} km/h). 바람막이를 챙기면 좋습니다.`);
  }

  /* --- 7. 자외선 --- */
  if (s.uvMax != null) {
    if (s.uvMax >= 8) {
      advice.push({
        emoji: "🧴",
        title: "자외선 매우 강함",
        badge: { type: "bad", label: `UV ${round(s.uvMax)}` },
        text: "자외선 지수가 매우 높습니다. <strong>선크림(SPF50+)</strong>, 선글라스, 모자, 양산을 권하고 한낮 야외활동은 줄이세요.",
      });
      checklist.push(["🕶️", "선크림·선글라스·모자"]);
    } else if (s.uvMax >= 6) {
      notes.push(`자외선이 강합니다(UV ${round(s.uvMax)}). 선크림과 선글라스를 챙기세요.`);
    } else if (s.uvMax >= 3) {
      notes.push(`자외선 보통(UV ${round(s.uvMax)}) — 장시간 야외활동 시 선크림을 권합니다.`);
    }
  }

  /* --- 8. 추위 강조 (체감 낮음) --- */
  if (s.feelsMin <= 0) {
    notes.push(`아침 체감 ${round(s.feelsMin)}°C로 영하권입니다. 핫팩·장갑·목도리로 보온하세요.`);
    checklist.push(["🧤", "장갑·목도리·핫팩"]);
  }

  /* --- 9. 폭염 --- */
  if (s.feelsMax >= 33) {
    notes.push(`낮 체감 ${round(s.feelsMax)}°C로 폭염 수준입니다. 물을 자주 마시고 한낮 외출을 피하세요.`);
    checklist.push(["🧊", "물병·휴대용 선풍기"]);
  }

  /* --- 기본 체크리스트 보강 --- */
  if (checklist.length === 0) {
    checklist.push(["👍", "특별히 챙길 것 없이 가벼운 외출 OK"]);
  }

  /* 중복 제거 */
  const seen = new Set();
  const uniqChecklist = checklist.filter(([, t]) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  return { advice, checklist: uniqChecklist, notes };
}

/* ============================================================
 *  렌더링
 * ============================================================ */
function renderResult(s) {
  const [icon, desc] = wmoInfo(s.code);
  const { advice, checklist, notes } = buildAdvice(s);

  const fmtDate = s.date.toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", weekday: "long",
  });
  const dStr = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, "0")}-${String(s.date.getDate()).padStart(2, "0")}`;
  const rel = relativeDayLabel(dStr);
  const fmtTime = (d) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  const adviceHTML = advice.map((a) => `
    <div class="advice-item">
      <div class="advice-emoji">${a.emoji}</div>
      <div class="advice-body">
        <div class="advice-title">${a.title}${a.badge ? `<span class="badge ${a.badge.type}">${a.badge.label}</span>` : ""}</div>
        <div class="advice-text">${a.text}</div>
      </div>
    </div>`).join("");

  const checklistHTML = checklist.map(([e, t]) =>
    `<li><span class="chk-emoji">${e}</span><span>${t}</span></li>`).join("");

  const notesHTML = notes.length
    ? `<ul class="checklist">${notes.map((n) => `<li><span class="chk-emoji">⚠️</span><span>${n}</span></li>`).join("")}</ul>`
    : `<p class="advice-text">특별히 주의할 사항은 없습니다. 좋은 하루 보내세요! 🙂</p>`;

  const hourlyHTML = s.hourly.map((hr) => {
    const [hi] = wmoInfo(hr.code);
    return `
      <div class="hour">
        <div class="h-time">${hr.time.getHours()}시</div>
        <div class="h-icon">${hi}</div>
        <div class="h-temp">${round(hr.temp)}°</div>
        <div class="h-rain">${hr.pop != null && hr.pop > 0 ? "💧" + round(hr.pop) + "%" : ""}</div>
      </div>`;
  }).join("");

  els.result.innerHTML = `
    <div class="card">
      <div class="summary-top">
        <div>
          <div class="summary-loc">📍 ${s.label}</div>
          <div class="summary-date">${rel} · ${fmtDate}</div>
          <div class="summary-desc">${desc}</div>
        </div>
        <div style="text-align:center">
          <div class="summary-icon">${icon}</div>
          <div class="summary-temp">${round(s.tMax)}°<small> / ${round(s.tMin)}°</small></div>
          <div class="summary-date">체감 ${round(s.feelsMax)}° / ${round(s.feelsMin)}°</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="label">강수확률</div><div class="value">${round(s.popMax)}%</div><div class="sub">${s.precipSum != null ? s.precipSum.toFixed(1) + "mm" : ""}</div></div>
        <div class="stat"><div class="label">습도</div><div class="value">${s.humidityAvg != null ? round(s.humidityAvg) + "%" : "-"}</div></div>
        <div class="stat"><div class="label">구름</div><div class="value">${s.cloudAvg != null ? round(s.cloudAvg) + "%" : "-"}</div></div>
        <div class="stat"><div class="label">바람</div><div class="value">${s.windMax != null ? round(s.windMax) : "-"}</div><div class="sub">km/h 최대</div></div>
        <div class="stat"><div class="label">자외선</div><div class="value">${s.uvMax != null ? round(s.uvMax) : "-"}</div></div>
        <div class="stat"><div class="label">해뜸/해짐</div><div class="value" style="font-size:.95rem">${fmtTime(s.sunrise)}</div><div class="sub">${fmtTime(s.sunset)}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>🧳 ${rel} 이렇게 준비하세요</h2>
      ${adviceHTML}
    </div>

    <div class="card">
      <h2>✅ 챙길 것 체크리스트</h2>
      <ul class="checklist">${checklistHTML}</ul>
    </div>

    <div class="card">
      <h2>⚠️ 유의사항</h2>
      ${notesHTML}
    </div>

    <div class="card">
      <h2>⏰ 시간대별 예보</h2>
      <div class="hourly-scroll"><div class="hourly">${hourlyHTML}</div></div>
    </div>
  `;
}

/* ============================================================
 *  이벤트
 * ============================================================ */
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = els.input.value.trim();
  if (!q) return;
  hide(els.suggestions);
  setState({ loading: true });
  try {
    const results = await searchCity(q);
    if (!results.length) {
      setState({ error: `"${q}" 에 해당하는 도시를 찾지 못했습니다. 다른 이름으로 검색해 보세요.` });
      return;
    }
    if (results.length === 1) {
      const c = results[0];
      const region = [c.admin1, c.country].filter(Boolean).join(", ");
      loadWeather(c.latitude, c.longitude, `${c.name}${region ? ", " + region : ""}`);
    } else {
      setState({});
      renderSuggestions(results);
    }
  } catch (err) {
    setState({ error: `검색 실패: ${err.message}` });
  }
});

els.geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setState({ error: "이 브라우저에서는 위치 기능을 지원하지 않습니다." });
    return;
  }
  setState({ loading: true });
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude, "현재 위치"),
    () => setState({ error: "위치 권한이 거부되었습니다. 도시 이름으로 검색해 주세요." }),
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

// 날짜 직접 선택
els.dateInput.addEventListener("change", () => {
  if (els.dateInput.value) renderForDate(els.dateInput.value);
});

// 오늘/내일/모레 빠른 버튼
els.quickDays.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !state.data) return;
  const offset = Number(btn.dataset.offset);
  const target = new Date(todayStr() + "T00:00:00");
  target.setDate(target.getDate() + offset);
  const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  els.dateInput.value = dateStr;
  renderForDate(dateStr);
});

// 입력 중 자동완성 (디바운스)
let debounce;
els.input.addEventListener("input", () => {
  clearTimeout(debounce);
  const q = els.input.value.trim();
  if (q.length < 2) { hide(els.suggestions); return; }
  debounce = setTimeout(async () => {
    try {
      const results = await searchCity(q);
      renderSuggestions(results);
    } catch { /* 무시 */ }
  }, 350);
});

document.addEventListener("click", (e) => {
  if (!els.suggestions.contains(e.target) && e.target !== els.input) {
    hide(els.suggestions);
  }
});
