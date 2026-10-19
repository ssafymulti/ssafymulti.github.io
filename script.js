// ===================================================================
// ▼ v4 배포 설정 — 이 블록만 수정하면 됩니다
// ===================================================================
const CONFIG = {
  SITE_URL:   'ssafymulti.github.io',          // 이 테스트가 올라갈 실제 주소 (결과 사진 하단에 표시)
  CTA_URL:    'https://www.ssafy.com',         // 17기 지원 페이지 주소가 확정되면 교체 권장
  CAMPAIGN:   'ssafy17_recruit',               // utm_campaign 값
  GA_ID:      ''                               // GA4 측정 ID (예: 'G-XXXXXXXXXX'). 비워두면 GA 미로드
};
// ===================================================================

// 결과 유형 코드 (URL·GA용 영문 코드. 한글 파라미터는 깨지기 쉬워 영문으로 통일)
const TYPE_CODE = { 비겁: 'bigeop', 식상: 'siksang', 재성: 'jaeseong', 관성: 'gwanseong', 인성: 'inseong' };
const OHENG_CODE = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };
const IN_PARAMS = new URLSearchParams(location.search);
let lastResult = null;

// ───── GA4 ─────
// 생년월일·이름 등 개인정보는 절대 이벤트에 담지 않는다. 결과 유형 코드만 보낸다.
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
(function initGA() {
  if (!CONFIG.GA_ID) return;
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.GA_ID);
  document.head.appendChild(sc);
  gtag('js', new Date());
  gtag('config', CONFIG.GA_ID);
})();
function track(name, params) {
  params = params || {};
  if (CONFIG.GA_ID) gtag('event', name, params);
  else console.debug('[track]', name, params);  // GA 미설정 시 콘솔에서 확인
}

// ───── URL 빌더 ─────
function baseUrl() {
  if (CONFIG.SITE_URL && !CONFIG.SITE_URL.includes('YOUR-DOMAIN')) return CONFIG.SITE_URL;
  return location.origin + location.pathname;  // 미설정 시 현재 주소로 대체
}
// CTA: utm_content = 결과 유형, utm_term = 이 테스트에 처음 들어온 유입 채널
// → SSAFY 사이트 쪽에서도 "어느 채널 → 어느 유형 → 지원 페이지" 흐름을 볼 수 있다.
function ctaUrl(strongestKey) {
  const u = new URL(CONFIG.CTA_URL);
  u.searchParams.set('utm_source', 'saju_test');
  u.searchParams.set('utm_medium', 'content');
  u.searchParams.set('utm_campaign', CONFIG.CAMPAIGN);
  u.searchParams.set('utm_content', TYPE_CODE[strongestKey]);
  u.searchParams.set('utm_term', IN_PARAMS.get('utm_source') || 'direct');
  return u.toString();
}

// ===== v3 신규: 일주·시주 계산 (JDN 기반) =====
const GAN = ["갑","을","병","정","무","기","경","신","임","계"];
const JI  = ["자","축","인","묘","진","사","오","미","신","유","술","해"];

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

// 반환: [일간 index 0-9, 일지 index 0-11]
function dayPillar(y, m, d) {
  const i = ((jdn(y, m, d) + 49) % 60 + 60) % 60;
  return [i % 10, i % 12];
}

// 오자둔: 갑기일→갑자시, 을경일→병자시, 병신일→무자시,
//         정임일→경자시, 무계일→임자시
function hourStem(dayGan, hourJi) {
  const start = [0, 2, 4, 6, 8][dayGan % 5];
  return (start + hourJi) % 10;
}

// ===== v5: 년주/월주를 실제 절기 시각으로 계산 =====
// 기존 방식(입춘=매년 2/4, 모든 달의 경계=5일)은 실제 절기와 최대 3일 어긋났다.
//   예) 입추 8/7~8, 백로 9/7~8, 한로 10/8~9, 입동 11/7~8, 대설 12/7 → 5~7일생 월주 오류
//   또 2/4생은 년주는 새해, 월주는 전년 축월로 계산돼 월간(月干)까지 틀렸다.
// → 태어난 순간의 태양 황경으로 월지를 정한다. (입춘=315°부터 30°마다 한 달)
//   Meeus 저정밀식, 1900~2100년 12절 기준 천문력 대비 오차 최대 약 22분(중앙값 6분).

// 태양 겉보기 황경(도)
function solarLongitude(jdUT) {
  const T = (jdUT + 69 / 86400 - 2451545.0) / 36525;  // ΔT 약 69초 근사
  const rad = Math.PI / 180;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lam % 360) + 360) % 360;
}

// 한국 표준시의 UTC 오프셋(시간). 1908~1911, 1954~1961은 UTC+8:30, 1987·1988 여름은 서머타임(+1)
function kstOffset(y, m, d) {
  const v = y * 10000 + m * 100 + d;
  let off = 9;
  if ((v >= 19080401 && v <= 19111231) || (v >= 19540321 && v <= 19610809)) off = 8.5;
  if ((v >= 19870510 && v < 19871011) || (v >= 19880508 && v < 19881009)) off += 1;
  return off;
}

// 한국 시계 기준 날짜·시각(시간 단위 실수) → 율리우스일(UT)
function jdFromLocal(y, m, d, hours) {
  return Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 + (hours - kstOffset(y, m, d)) / 24;
}

// 황경 → 월지 순번 (0=인월 … 11=축월)
function monthOrder(lam) { return Math.floor((((lam - 315) % 360) + 360) % 360 / 30); }

// 시진별 대표 시각(가운데). 출생시간을 모르면 정오로 본다.
const HOUR_MID = { '자0': 0.75, 축: 2.5, 인: 4.5, 묘: 6.5, 진: 8.5, 사: 10.5, 오: 12.5,
                   미: 14.5, 신: 16.5, 유: 18.5, 술: 20.5, 해: 22.5, 자: 23.75 };
const HOUR_RANGE = { '자0': [0, 1.5], 축: [1.5, 3.5], 인: [3.5, 5.5], 묘: [5.5, 7.5], 진: [7.5, 9.5],
                     사: [9.5, 11.5], 오: [11.5, 13.5], 미: [13.5, 15.5], 신: [15.5, 17.5],
                     유: [17.5, 19.5], 술: [19.5, 21.5], 해: [21.5, 23.5], 자: [23.5, 24] };

function yearMonthPillars(year, month, day, hourStr) {
  const h = hourStr ? HOUR_MID[hourStr] : 12;
  const k = monthOrder(solarLongitude(jdFromLocal(year, month, day, h)));

  // 1~2월에 아직 자월·축월이면 입춘 전 → 전년도
  let sajuYear = year;
  if (month <= 2 && k >= 10) sajuYear -= 1;
  const yG = ((sajuYear + 6) % 10 + 10) % 10, yJ = ((sajuYear + 8) % 12 + 12) % 12;

  // 오호둔(五虎遁): 갑기년→병인월, 을경년→무인월, 병신년→경인월, 정임년→임인월, 무계년→갑인월
  const mG = (((yG % 5) * 2 + 2) + k) % 10;
  const mJ = (k + 2) % 12;

  // 절기가 바뀌는 시각이 출생일(시간 미상) 또는 선택한 시진 안에 있으면 월주가 달라질 수 있다
  const [r0, r1] = hourStr ? HOUR_RANGE[hourStr] : [0, 24];
  const kA = monthOrder(solarLongitude(jdFromLocal(year, month, day, r0)));
  const kB = monthOrder(solarLongitude(jdFromLocal(year, month, day, r1)));
  const termBoundary = kA !== kB;

  return { yG, yJ, mG, mJ, termBoundary };
}
// ===== v3 신규 끝 (일주·시주·년주·월주) =====

// ===== v3 신규: 십신 환산·집계·판정 =====
const GAN_HANJA = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const JI_HANJA  = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

const GAN_OHENG = ["목","목","화","화","토","토","금","금","수","수"];
const JI_OHENG  = ["수","토","목","목","토","화","화","토","금","금","토","수"];

const CYCLE = ["목","화","토","금","수"];

// ===== v5: 지장간(支藏干) — 지지 속에 숨어 있는 천간 =====
// 겉면 오행 하나만 세면 실제로 가진 기운을 놓친다.
// 예) 신(申) 속에는 임수(壬水)가 들어 있어, 겉으로는 금이지만 수 기운도 함께 지닌다.
// 배열은 여기(餘氣) → 중기(中氣) → 정기(正氣) 순. 값은 GAN 인덱스.
const JIJANGGAN = {
  0:  [8, 9],       // 자(子) : 임 계
  1:  [9, 7, 5],    // 축(丑) : 계 신 기
  2:  [4, 2, 0],    // 인(寅) : 무 병 갑
  3:  [0, 1],       // 묘(卯) : 갑 을
  4:  [1, 9, 4],    // 진(辰) : 을 계 무
  5:  [4, 6, 2],    // 사(巳) : 무 경 병
  6:  [2, 5, 3],    // 오(午) : 병 기 정
  7:  [3, 1, 5],    // 미(未) : 정 을 기
  8:  [4, 8, 6],    // 신(申) : 무 임 경
  9:  [6, 7],       // 유(酉) : 경 신
  10: [7, 3, 4],    // 술(戌) : 신 정 무
  11: [4, 0, 8]     // 해(亥) : 무 갑 임
};

// 가중치: 겉으로 드러난 천간이 가장 세고, 지지 안에서는 정기가 그 지지의 주된 기운이다.
const W_GAN = 2;
const W_JI3 = [1, 1, 3];   // 지장간 3개일 때 (여기·중기·정기)
const W_JI2 = [1, 3];      // 지장간 2개일 때 (여기·정기)
// ===== v5 끝 =====

function sipsinGroup(dayOheng, targetOheng) {
  const di = CYCLE.indexOf(dayOheng);
  const ti = CYCLE.indexOf(targetOheng);
  const diff = ((ti - di) % 5 + 5) % 5;
  return ["비겁","식상","재성","관성","인성"][diff];
}

const SIPSIN_ORDER = ["비겁","식상","재성","관성","인성"];

// gans: 일간을 제외한 천간 인덱스 배열 / jis: 지지 인덱스 배열
// score = 가중 점수(판정용), count = 글자 개수(상세 표기용)
function computeDistribution(dayGanIdx, gans, jis) {
  const dayOheng = GAN_OHENG[dayGanIdx];
  const score = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  const count = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };

  gans.forEach(g => {
    const k = sipsinGroup(dayOheng, GAN_OHENG[g]);
    score[k] += W_GAN;
    count[k] += 1;
  });

  jis.forEach(j => {
    const hidden = JIJANGGAN[j];
    const w = hidden.length === 3 ? W_JI3 : W_JI2;
    hidden.forEach((g, i) => {
      const k = sipsinGroup(dayOheng, GAN_OHENG[g]);
      score[k] += w[i];
      count[k] += 1;
    });
  });

  return { score, count };
}

// 동점일 때 배열 앞순서(비겁→식상→…)가 항상 이기던 문제를 수정.
// 단, 같은 생년월일시는 언제 돌려도 같은 결과가 나와야 하므로
// 난수가 아니라 원국 값으로 만든 seed를 쓰는 결정적 방식으로 분산한다.
function judgeWeakStrong(score, seed) {
  const vals = SIPSIN_ORDER.map(k => score[k]);
  const minVal = Math.min.apply(null, vals);
  const maxVal = Math.max.apply(null, vals);

  const lows  = SIPSIN_ORDER.filter(k => score[k] === minVal);
  const highs = SIPSIN_ORDER.filter(k => score[k] === maxVal);

  let weakest   = lows[seed % lows.length];
  let strongest = highs[remix(seed) % highs.length];

  if (weakest === strongest) {
    // 다섯 기운이 완전히 균등한 경우 → 강점은 남은 넷 중에서 다시 고른다
    const rest = SIPSIN_ORDER.filter(k => k !== weakest);
    strongest = rest.reduce((a, b) => (score[b] > score[a] ? b : a));
  }
  return { weakest, strongest };
}

// 원국 여덟 글자로 만드는 재현 가능한 seed (FNV-1a 해시)
// 주의: 60갑자는 천간·지지의 음양이 항상 일치하므로(갑자·을축…) 두 인덱스의 홀짝이 늘 같다.
// 단순 가중합을 쓰면 seed의 홀짝이 한쪽으로 고정돼 2파 동점에서 한 후보만 뽑히므로 해시로 섞는다.
function pillarSeed(p) {
  let h = 2166136261;
  [p.yG, p.yJ, p.mG, p.mJ, p.dG, p.dJ, p.hG + 1, p.hJi + 1].forEach(v => {
    h ^= (v + 1);
    h = Math.imul(h, 16777619);
  });
  // 마무리 혼합(avalanche). XOR과 곱셈만으로는 입력의 홀짝 관계가 그대로 보존돼
  // seed의 최하위 비트가 고정된다. 오른쪽 시프트로 상위 비트를 끌어내려 이를 깬다.
  h ^= h >>> 16; h = Math.imul(h, 2246822507);
  h ^= h >>> 13; h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// 같은 seed에서 서로 독립적인 두 번째 값을 뽑기 위한 재혼합
function remix(seed) {
  let h = Math.imul(seed ^ 0x9E3779B9, 2246822519);
  h ^= h >>> 13;
  return Math.imul(h, 3266489917) >>> 0;
}
// ===== v3 신규 끝 (십신) =====

// ===== v3 신규: 콘텐츠 데이터 구조 (문구는 플레이스홀더, 나중에 교체) =====
const CONTENT = {
  weak: {   // 가장 적은 기운(성장 포인트) → SSAFY가 키워주는 것
    비겁: {
      title: "생각은 깊은데, 먼저 꺼내기까지 시간이 필요한 타입",
      desc: "다른 사람의 이야기를 먼저 들어보고 신중하게 움직이는 편이라, 팀 안에서 내 생각을 먼저 꺼내기까지 시간이 조금 걸릴 수 있어요. 여기에 자신감을 조금만 더 실어주면, 그 신중함이 오히려 팀을 든든하게 받쳐주는 판단력이 됩니다.",
      ssafy: "SSAFY의 관통 프로젝트에서는 <b>팀원 모두가 역할을 맡아 함께 결정</b>하게 됩니다. 전국 각지에서 모인 동기들과 매일 함께하다 보면 <mark class=\"hl\">'나도 이 팀의 주인공'이라는 감각</mark>이 자연스럽게 자라나요."
    },
    식상: {
      title: "머릿속 좋은 생각을 꺼내 보일 무대가 필요한 타입",
      desc: "아이디어는 충분히 갖고 있는데, 그걸 말이나 글로 풀어낼 기회가 아직 많지 않았을 뿐이에요. 표현하는 경험이 조금씩 쌓이면 발표나 면접 자리에서도 내가 가진 실력을 온전히 보여줄 수 있어요.",
      ssafy: "SSAFY는 관통 프로젝트마다 <b>데모데이 발표, 코드 리뷰</b> 등 표현할 기회를 반복적으로 제공합니다. 매번 팀원들 앞에서 설명하다 보면 <mark class=\"hl\">표현하는 근육이 자연스럽게 붙습니다.</mark>"
    },
    재성: {
      title: "열심히 해온 만큼, 이제 눈에 보이게 담아낼 차례",
      desc: "이것저것 꾸준히 해온 경험은 많은데, 그걸 한눈에 보이는 결과물로 정리할 기회가 적었을 수 있어요. 해온 노력을 잘 엮어내기만 하면 그대로 나만의 경쟁력이 됩니다.",
      ssafy: "SSAFY는 <b>공통 → 특화 → 자율 프로젝트</b>로 이어지며 매 단계 결과물이 명확히 남습니다. <mark class=\"hl\">노력이 포트폴리오로 차곡차곡 쌓이는 구조</mark>예요."
    },
    관성: {
      title: "자유로운 리듬에 단단한 틀을 더하면 빛나는 타입",
      desc: "정해진 틀보다 내 방식대로 움직일 때 편안함을 느끼는 편이라, 긴 준비 기간 동안 같은 리듬을 이어가는 게 쉽지만은 않을 수 있어요. 나에게 맞는 루틴만 잡히면 그 유연함이 큰 장점이 됩니다.",
      ssafy: "SSAFY는 <b>주 40시간, 1년간</b> 이어지는 촘촘한 시간표와 학사관리 체계로 운영됩니다. 매일 같은 리듬으로 돌아가는 구조 자체가 <mark class=\"hl\">나만의 루틴을 자연스럽게 잡아줍니다.</mark>"
    },
    인성: {
      title: "천천히, 하지만 깊게 내 것으로 만드는 타입",
      desc: "새로운 개념을 빠르게 훑기보다 충분히 이해하고 넘어가고 싶어 하는 편이라, 처음에는 속도가 조금 느리게 느껴질 수 있어요. 대신 한번 이해한 건 오래 남는 깊이가 있습니다.",
      ssafy: "SSAFY는 <b>전공 여부와 무관한 눈높이 커리큘럼</b>과, 방향을 잡아주는 현업자 멘토링을 함께 제공합니다. <mark class=\"hl\">배움의 속도를 자기 리듬대로 맞춰갈 수 있어요.</mark>"
    }
  },
  strong: { // 강한 기운 → 강점 활용 전략 + SSAFY가 밀어주는 방법
    비겁: {
      title: "어디서든 중심을 잡는 존재감",
      strategy: "자기 주관이 뚜렷해서 압박 속에서도 자기 페이스를 지키는 <b>주도성</b>이 강점입니다. 자기소개서에는 방향을 정하고 팀을 이끈 경험을 구체적으로 쓰고, 면접에서는 압박 질문에도 위축되지 않는 태도로 답하세요. <mark class=\"hl\">흔들리지 않는 존재감 자체가 가장 강력한 무기</mark>입니다.",
      services: ["모의면접 프로그램", "맞춤형 취업상담"],
      ssafy: "실전 같은 면접을 미리 겪어보고, 그 배짱을 어느 기업에서 펼칠지 함께 고민합니다. <mark class=\"hl\">없는 걸 채우는 게 아니라, 잘하는 걸 조준하는 시간</mark>이에요.",
      campus: "관통 프로젝트의 팀 리더나 반 대표 역할에 잘 맞아요. 주도적으로 팀을 이끈 경험은 자소서·면접에서 바로 꺼내 쓸 수 있는 강력한 리더십 소재가 됩니다."
    },
    식상: {
      title: "설명 한 번이면 다들 이해되는 말솜씨",
      strategy: "머릿속 아이디어를 말과 글로 술술 풀어내는 <b>전달력</b>이 강점입니다. 자기소개서는 경험을 생생한 스토리로 풀고, 면접에서는 핵심부터 또렷하게 말하는 답변으로 승부하세요. <mark class=\"hl\">기술 면접에서도 내 코드를 쉽게 설명하는 힘은 큰 강점</mark>이 됩니다.",
      services: ["자기소개서 컨설팅", "모의면접 프로그램"],
      ssafy: "쓰고 말하는 과정을 반복해서 다듬습니다. 이미 말솜씨가 있는 당신에게는 <mark class=\"hl\">어떻게 말하느냐가 아니라 무엇을 말하느냐</mark>를 벼리는 시간이 됩니다.",
      campus: "데모데이 발표자나 싸피셜 기자단 같은 콘텐츠·발표 중심 활동에 잘 맞아요. 프로젝트 결과물을 설득력 있게 전달한 경험은 면접에서 그대로 강력한 무기가 됩니다."
    },
    재성: {
      title: "일단 붙잡으면 끝까지 결과를 내는 힘",
      strategy: "목표를 현실적으로 계산해 끝내 결과로 만들어내는 <b>완결성</b>이 강점입니다. 끝까지 만든 것 하나가 백 마디 말보다 세니, 자기소개서와 포트폴리오에 결과물을 숫자와 함께 남기세요. <mark class=\"hl\">면접관은 계획이 아니라 끝낸 것을 봅니다.</mark>",
      services: ["기업연계 프로젝트", "채용연계"],
      ssafy: "실무에 가까운 결과물을 만들고, 그 결과물을 기업에 선보일 기회로 이어갑니다. <mark class=\"hl\">만든 것이 나를 증명하는 포트폴리오가 되는 구조</mark>예요.",
      campus: "자율 프로젝트에서 실제로 배포까지 마치는 팀에 들어가 보세요. 끝까지 완성한 결과물 하나가 포트폴리오의 중심이 됩니다."
    },
    관성: {
      title: "맡은 건 끝까지 해내는 책임감",
      strategy: "원칙을 지키며 맡은 일에 책임을 다하는 <b>신뢰</b>가 강점입니다. 화려한 경험보다 끝까지 지킨 약속과 꾸준함을 쓰고, 면접에서는 과장 없이 담담하게 답하세요. <mark class=\"hl\">기업이 신입에게 가장 원하는 건 믿고 맡길 수 있느냐</mark>입니다.",
      services: ["SSAFY우대채용", "SSAFY특별전형"],
      ssafy: "1년 과정을 성실히 완주한 수료생이 도전할 수 있는 기회들이에요. <mark class=\"hl\">성실함을 말이 아니라 수료라는 기록으로 증명하는 길</mark>, 이 강점에 잘 맞습니다.",
      campus: "스터디 운영이나 학습 서포터즈처럼 꾸준함이 드러나는 역할에 잘 맞아요. 1년을 흐트러짐 없이 완주한 기록 자체가 신뢰의 증거가 됩니다."
    },
    인성: {
      title: "한번 배우면 내 것으로 만드는 흡수력",
      strategy: "새로운 지식을 빠르게 흡수하는 <b>성장 속도</b>가 강점입니다. 지금 아는 것보다 얼마나 빨리 익히는지를 보여주고, 새 기술을 짧은 기간에 익힌 경험을 구체적으로 쓰세요. <mark class=\"hl\">기업이 신입을 뽑는 건 완성품이 아니라 가능성 때문</mark>입니다.",
      services: ["현업개발자 멘토링", "채용설명회·Job Fair"],
      ssafy: "현장 기준을 먼저 배우고, 기업이 실제로 원하는 걸 직접 듣습니다. <mark class=\"hl\">배우는 방향까지 맞춰주는 것</mark>이 이 강점을 가장 크게 키웁니다.",
      campus: "심화 스터디나 신기술 세미나에 적극적으로 참여해 보세요. 빠르게 익히는 힘은 새로운 걸 계속 던져주는 환경에서 가장 크게 자랍니다."
    }
  },
  // 결과 상단 배지 (강점 5종)
  badge: {
    비겁: "면접에 강한 사주",
    식상: "말로 뚫는 사주",
    재성: "결과로 증명하는 사주",
    관성: "믿고 뽑는 사주",
    인성: "갈수록 크는 사주"
  },

  // 성향 요약 조각. 기존 matrix 20개 문장은 강점 5조각 + 약점 5조각으로 완전히 분해되므로
  // 20개를 하드코딩하지 않고 조합해서 만든다. (카피 수정 시 20군데 → 5군데)
  trait: {
    strong: {
      비겁: {
        point: "자기 주관이 뚜렷하고 어디서든 중심을 잡음",
        learn: "동등한 위치에서 부딪히며 배우는 팀 중심 학습에 강함",
        job:   "풀스택·팀 리드처럼 전체를 보는 직무"
      },
      식상: {
        point: "생각을 막힘없이 표현하고 사람들을 끌어당김",
        learn: "발표·설명 위주로 익히는 표현형 학습에 강함",
        job:   "프론트엔드·기술기획처럼 전달이 핵심인 직무"
      },
      재성: {
        point: "목표를 현실적으로 계산해 끝내 결과로 만들어냄",
        learn: "결과물이 뚜렷하게 남는 실전형 학습에 강함",
        job:   "PM·서비스 기획처럼 완성까지 책임지는 직무"
      },
      관성: {
        point: "원칙을 지키며 맡은 일에 책임을 다함",
        learn: "정해진 루틴을 반복하는 체계형 학습에 강함",
        job:   "백엔드·인프라처럼 안정성이 생명인 직무"
      },
      인성: {
        point: "새로운 지식을 빠르게 흡수하고 유연하게 받아들임",
        learn: "개념과 원리를 파고드는 이해 중심 학습에 강함",
        job:   "AI·데이터처럼 계속 새로 배워야 하는 직무"
      }
    },
    weak: {
      비겁: "내 의견을 먼저 꺼내기까지 시간이 조금 필요함",
      식상: "머릿속 생각을 말과 글로 꺼내 보일 기회가 더 필요함",
      재성: "해온 노력을 결과물로 정리해 두면 더 빛남",
      관성: "꾸준한 루틴을 잡아줄 환경이 있으면 더 힘을 냄",
      인성: "새로운 걸 내 것으로 만들기까지 시간이 조금 필요함"
    }
  },

  // 행운 부적 = 부적명·본문(강점 5종) + 마무리(캐릭터 20종, CHARACTER.closing)
  charm: {
    name: {
      비겁: "흔들림 없는 부적",
      식상: "말문 트임 부적",
      재성: "결실 맺음 부적",
      관성: "믿음 얻는 부적",
      인성: "쑥쑥 성장 부적"
    },
    body: {
      비겁: "압박 면접에도 당신은 흔들리지 않습니다. 끝까지 눈을 맞추고 답하는 그 배짱이 취업 성공을 부릅니다.",
      식상: "자기소개서 첫 줄부터 면접관이 당신을 궁금해합니다. 준비한 말이 술술 나오는 날 취업 성공이 옵니다.",
      재성: "끝까지 완성한 프로젝트 하나가 백 마디 말보다 셉니다. 쌓아둔 결과물이 당신의 취업문을 열어줍니다.",
      관성: "기업이 가장 뽑고 싶은 사람은 믿고 맡길 사람입니다. 당신의 성실함은 이력서 몇 줄에서도 드러납니다.",
      인성: "낯선 기술 앞에서도 당신은 겁내지 않습니다. 빠르게 배우는 신입, 기업이 가장 원하는 사람입니다."
    }
  }
};
// ===== v3 신규 끝 (CONTENT) =====

// ===== v3 신규: 화면 표기용 라벨 & 원국 종합 계산 =====
// 화면에는 십신 대신 오행으로 표기한다.
// 계산 로직(sipsinGroup)은 이미 '일간 오행 → 대상 오행의 거리(0~4)'로 십신을 정하므로,
// 그 거리를 되돌리면 각 십신에 해당하는 실제 오행을 무손실로 복원할 수 있다.
function sipsinToOheng(dayOheng, sipsinKey) {
  const diff = SIPSIN_ORDER.indexOf(sipsinKey);
  return CYCLE[(CYCLE.indexOf(dayOheng) + diff) % 5];
}

const OHENG_SLUG = { 목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su' };
// 화면 표기는 목·화·토·금·수로 통일한다.
// (예전에는 배너·차트 부제만 '나무/불/흙/쇠/물'을 써서 같은 오행이 두 이름으로 보였다)
const OHENG_INFO = {
  목: { hanja: '木' },
  화: { hanja: '火' },
  토: { hanja: '土' },
  금: { hanja: '金' },
  수: { hanja: '水' }
};

// 십신의 '의미'는 일상어로 남겨둔다 (동료/표현/성과/규율/배움)
const MEANING = { 비겁: '동료', 식상: '표현', 재성: '성과', 관성: '규율', 인성: '배움' };

// 예) '동료의 기운, 토(土)'
function labelOf(sipsinKey, dayOheng) {
  const o = sipsinToOheng(dayOheng, sipsinKey);
  return `<span class="nb">${MEANING[sipsinKey]}의 기운, ${o}(${OHENG_INFO[o].hanja})</span>`;
}

// 캐릭터 = 가장 강한 오행 × 가장 적은 오행(성장 포인트) → 20종
// 일간 한 글자로 정하던 방식은 '바다 캐릭터인데 물이 부족' 같은 모순이 생겨,
// 차트와 같은 기준(강점·성장 포인트)으로 바꿨다. 강점과 성장 포인트는 항상 다른 오행이다.
// closing = 부적 마무리 문구
const CHARACTER = {
  목: {
    화: { emoji: '🌴', name: '볕을 향해 뻗는 숲', tagline: '단단히 뿌리내려서, 볕만 들면 단숨에 자라날 사람', closing: '볕 드는 날, 숲은 한 번에 푸르러져요!' },
    토: { emoji: '🌳', name: '뿌리 내릴 땅을 찾는 나무', tagline: '뻗어가는 힘이 넘쳐, 좋은 터만 만나면 크게 자랄 사람', closing: '딱 맞는 땅을 만나면 쑥쑥 자라요!' },
    금: { emoji: '🌲', name: '다듬으면 명작이 될 원목', tagline: '타고난 결이 좋아, 조금만 다듬어도 빛나는 사람', closing: '다듬을수록 빛나는 결, 합격까지 쭉!' },
    수: { emoji: '🎋', name: '물길을 기다리는 대나무', tagline: '곧게 자라는 힘이 있어, 물길만 만나면 하늘까지 뻗을 사람', closing: '물길 만나는 순간 하늘까지 쭉!' }
  },
  화: {
    목: { emoji: '🔥', name: '장작을 기다리는 불꽃', tagline: '뜨거운 열정을 지녀, 재료만 더해지면 오래 타오를 사람', closing: '그 불꽃, 이제 꺼지지 않아요!' },
    토: { emoji: '🏺', name: '명작을 빚는 가마', tagline: '뜨거운 열정에 형태만 잡히면 오래 남을 작품을 빚을 사람', closing: '뜨겁게 구워낸 실력, 합격으로 완성!' },
    금: { emoji: '⚒️', name: '명검을 벼리는 대장간 불', tagline: '뜨거운 에너지로, 단단한 목표를 만나면 명검을 벼려낼 사람', closing: '제대로 벼린 실력, 어디서든 통해요!' },
    수: { emoji: '🌅', name: '바다 위로 떠오르는 해', tagline: '어디서든 환히 빛나고, 깊이를 더하면 더 멀리 비출 사람', closing: '떠오르는 해처럼 합격 소식도 곧!' }
  },
  토: {
    목: { emoji: '🏞️', name: '숲을 품을 너른 대지', tagline: '넉넉하게 품어 주는 힘이 있어, 씨앗만 심기면 숲을 키울 사람', closing: '심는 대로 거두는 땅, 합격도 쑥!' },
    화: { emoji: '🌾', name: '햇살을 기다리는 들판', tagline: '묵묵히 쌓아 온 게 많아, 햇살 한 줄기면 황금빛으로 물들 사람', closing: '황금 들판처럼 결실의 계절이 와요!' },
    금: { emoji: '⛰️', name: '보석을 품은 산', tagline: '든든하게 버티는 힘 속에, 아직 꺼내지 않은 원석을 품은 사람', closing: '품은 원석, 이제 세상에 꺼낼 차례!' },
    수: { emoji: '🌦️', name: '단비를 기다리는 너른 밭', tagline: '기반을 단단히 다져 두어, 단비만 내리면 무엇이든 키워낼 사람', closing: '단비 내리는 날, 합격 꽃이 피어요!' }
  },
  금: {
    목: { emoji: '🛠️', name: '재료를 기다리는 조각칼', tagline: '날카로운 실력을 갖춰, 다룰 재료만 만나면 작품을 만들어낼 사람', closing: '그 솜씨, 이제 마음껏 펼칠 차례!' },
    화: { emoji: '🏅', name: '불꽃 속에서 빛날 황금', tagline: '이미 단단한 원석이라, 열정만 더해지면 순금처럼 빛날 사람', closing: '제대로 달궈진 황금, 어디서든 빛나요!' },
    토: { emoji: '💎', name: '제자리를 찾는 보석', tagline: '디테일까지 반짝이는 감각으로, 든든한 자리를 만나면 가장 빛날 사람', closing: '제자리를 찾은 보석, 합격으로 반짝!' },
    수: { emoji: '🏔️', name: '맑은 샘을 품은 바위산', tagline: '단단하고 흔들림 없어, 마음속 샘만 열리면 생각이 끝없이 흐를 사람', closing: '샘솟는 아이디어로 합격까지 콸콸!' }
  },
  수: {
    목: { emoji: '💧', name: '숲을 키울 깊은 호수', tagline: '깊이 품어 주는 힘이 있어, 씨앗만 만나면 숲 하나를 길러낼 사람', closing: '그 깊은 물로 합격 숲까지 키워 봐요!' },
    화: { emoji: '🌊', name: '아침 해를 기다리는 바다', tagline: '생각의 폭이 넓고 깊어, 햇살만 비추면 눈부시게 반짝일 사람', closing: '해가 뜨는 순간, 바다는 가장 빛나요!' },
    토: { emoji: '🛶', name: '방향을 찾는 큰 강', tagline: '흐르는 힘이 넘쳐, 물길만 잡히면 어디든 닿을 수 있는 사람', closing: '물길이 잡히면 합격까지 한 번에!' },
    금: { emoji: '⛲', name: '마르지 않을 샘', tagline: '맑고 유연한 생각을 지녀, 원천만 만나면 끝없이 흘러갈 사람', closing: '마르지 않는 샘처럼 끝까지 가요!' }
  }
};

// 배너 오행 줄: '강한 수(水) · 키워갈 목(木)'
function charOhengLine(s, w) {
  return `강한 ${s}(${OHENG_INFO[s].hanja}) · 키워갈 ${w}(${OHENG_INFO[w].hanja})`;
}

// 자시 전반(23:30~23:59) 출생: 야자시 구분 없이 다음 날 일간으로 계산
function addOneDay(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 1);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

// 년주/월주/일주/시주 전체 계산. hourStr이 빈 문자열이면 시주 없음(hasHour:false)
function getFullPillars(year, month, day, hourStr) {
  const { yG, yJ, mG, mJ, termBoundary } = yearMonthPillars(year, month, day, hourStr);

  // '자'  = 23:30~23:59 출생 → 다음 날 일간 (자시를 하루의 시작으로 봄)
  // '자0' = 00:00~01:29 출생 → 이미 날짜가 바뀌었으므로 당일 일간 그대로
  const isJasi = hourStr === '자';
  const [dy, dm, dd] = isJasi ? addOneDay(year, month, day) : [year, month, day];
  const [dG, dJ] = dayPillar(dy, dm, dd);

  const hasHour = !!hourStr;
  let hG = -1, hJi = -1;
  if (hasHour) {
    hJi = hourStr === '자0' ? 0 : JI.indexOf(hourStr);
    hG = hourStem(dG, hJi);
  }
  return { yG, yJ, mG, mJ, dG, dJ, hG, hJi, hasHour, isJasi, termBoundary };
}

// 일간을 제외한 나머지 글자 + 각 지지의 지장간까지 집계해 판정
// v6: 일반 만세력 사이트와 같은 기준으로 판정한다.
//  ① 일간을 포함한 여덟 글자(시간 모르면 여섯 글자)를 한 글자씩 센다 → 차트 숫자가 사이트와 일치
//  ② 가장 많은/적은 십신 그룹이 동점일 때만 지장간 가중 점수로 가른다
//  ③ 그래도 같으면 원국 seed로 결정 (같은 생년월일시는 항상 같은 결과)
function computeSipsin(p) {
  const dayOheng = GAN_OHENG[p.dG];

  // ① 겉글자 개수
  const allGans = [p.yG, p.mG, p.dG];
  const allJis  = [p.yJ, p.mJ, p.dJ];
  if (p.hasHour) { allGans.push(p.hG); allJis.push(p.hJi); }
  const glyph = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  allGans.forEach(g => glyph[sipsinGroup(dayOheng, GAN_OHENG[g])]++);
  allJis.forEach(j => glyph[sipsinGroup(dayOheng, JI_OHENG[j])]++);

  // ② 동점 판정용 지장간 점수 (일간 제외, 기존 v5 방식)
  const gans = [p.yG, p.mG];
  const jis  = [p.yJ, p.mJ, p.dJ];
  if (p.hasHour) { gans.push(p.hG); jis.push(p.hJi); }
  const hidden = computeDistribution(p.dG, gans, jis).score;

  const seed = pillarSeed(p);
  const pick = (dir, avoid) => {
    const pool = SIPSIN_ORDER.filter(k => k !== avoid);
    const best = dir * Math.max(...pool.map(k => dir * glyph[k]));
    const ties = pool.filter(k => glyph[k] === best);
    const hBest = dir * Math.max(...ties.map(k => dir * hidden[k]));
    const ties2 = ties.filter(k => hidden[k] === hBest);
    return { key: ties2[(dir > 0 ? remix(seed) : seed) % ties2.length], ties };
  };
  const w = pick(-1);
  const st = pick(1, w.key);  // 강점과 약점이 같은 그룹이 되지 않도록

  return {
    counts: glyph, hidden, weakest: w.key, strongest: st.key,
    weakTies: w.ties, strongTies: st.ties,
    weakZero: glyph[w.key] === 0,
    total: allGans.length + allJis.length
  };
}
// ===== v3 신규 끝 (화면용 라벨 & 원국 계산) =====

// ───── 생년월일 3칸 입력 제어 ─────
const YY = () => document.getElementById('byYear');
const MM = () => document.getElementById('byMonth');
const DD = () => document.getElementById('byDay');

// 오류 표시는 개별 칸이 아니라 바깥 박스에 준다 (겉보기 입력칸이 하나이므로)
function showDateMsg(msg, focusEl) {
  document.getElementById('dateMsg').innerText = msg || '';
  document.getElementById('dateRow').classList.toggle('err', !!msg);
  if (focusEl) { focusEl.focus(); focusEl.select(); }
}

// 화면에 입력된 값을 읽어 검증한다. 결과 로직에 넘기는 값은 기존과 동일한 연·월·일 숫자.
function readBirthDate() {
  const y = +YY().value, m = +MM().value, d = +DD().value;
  if (!YY().value || !MM().value || !DD().value)
    return { ok: false, msg: '생년월일을 모두 입력해 주세요!', focus: !YY().value ? YY() : (!MM().value ? MM() : DD()) };
  if (y < 1900 || y > 2100)
    return { ok: false, msg: '연도는 1900~2100 사이로 입력해 주세요!', focus: YY() };
  if (m < 1 || m > 12)
    return { ok: false, msg: '월은 1~12 사이로 입력해 주세요!', focus: MM() };
  // 실제로 존재하는 날짜인지 확인 (2월 30일 같은 입력 차단)
  const dt = new Date(y, m - 1, d);
  if (d < 1 || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return { ok: false, msg: `${y}년 ${m}월에는 ${d}일이 없어요!`, focus: DD() };
  return { ok: true, y, m, d };
}

(function initDateInputs() {
  const fields = [YY(), MM(), DD()];

  fields.forEach((el, i) => {
    // 숫자만 허용하고, 자릿수가 다 차면 다음 칸으로 넘긴다
    el.addEventListener('input', () => {
      const digits = el.value.replace(/[^0-9]/g, '').slice(0, el.maxLength);
      if (el.value !== digits) el.value = digits;
      showDateMsg('');
      // 사용자가 끝자리를 지웠다가 다시 채우는 경우 커서가 튀지 않도록,
      // 커서가 맨 끝에 있을 때(= 이어서 입력 중일 때)만 다음 칸으로 넘긴다.
      const atEnd = el.selectionStart === el.value.length;
      if (digits.length === el.maxLength && atEnd && i < fields.length - 1) {
        const next = fields[i + 1];
        next.focus(); next.select();
      }
    });

    // 빈 칸에서 백스페이스를 누르면 이전 칸으로 돌아간다
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && el.value === '' && i > 0) {
        e.preventDefault();
        const prev = fields[i - 1];
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      }
      if (e.key === 'Enter') startTest();
    });

    // 칸을 벗어날 때 한 자리 입력을 두 자리로 보정 (8 → 08)
    el.addEventListener('blur', () => {
      if (i > 0 && el.value.length === 1) el.value = '0' + el.value;
    });

    // 어느 칸에 포커스가 있든 바깥 박스 전체가 반응하도록 한다
    el.addEventListener('focus', () => {
      el.select();
      document.getElementById('dateRow').classList.add('focus');
    });
    el.addEventListener('blur', () => {
      // 같은 박스 안의 다른 칸으로 옮겨가는 중이면 강조를 유지한다
      setTimeout(() => {
        const inside = fields.includes(document.activeElement);
        if (!inside) document.getElementById('dateRow').classList.remove('focus');
      }, 0);
    });
  });

  // 2000-01-01, 2000.1.1, 20000101 형태를 통째로 붙여넣어도 인식한다
  fields.forEach(el => el.addEventListener('paste', e => {
    const raw = (e.clipboardData || window.clipboardData).getData('text') || '';
    const n = raw.replace(/[^0-9]/g, '');
    if (n.length === 8) {
      e.preventDefault();
      YY().value = n.slice(0, 4); MM().value = n.slice(4, 6); DD().value = n.slice(6, 8);
      showDateMsg(''); DD().focus();
    }
  }));
})();

// ───── 자시 자정 전/후 선택 ─────
// 자시는 자정을 걸쳐 있어 하나로 보여주고, 고른 경우에만 자정 전(23:30~23:59)/후(00:00~01:29)를 묻는다.
// 계산에 넘기는 값은 기존과 같다: 자정 전 = '자'(다음 날 일간), 자정 후 = '자0'(당일 일간)
let jasiChoice = '';
function setJasiMsg(msg) {
  document.getElementById('jasiMsg').innerText = msg || '';
  document.getElementById('jasiPick').classList.toggle('err', !!msg);
}
(function initJasiPick() {
  const sel = document.getElementById('birthTime');
  const box = document.getElementById('jasiPick');
  const opts = box.querySelectorAll('.jasi-opt');
  sel.addEventListener('change', () => {
    box.hidden = sel.value !== '자시';
    jasiChoice = '';
    opts.forEach(o => { o.classList.remove('on'); o.setAttribute('aria-checked', 'false'); });
    setJasiMsg('');
  });
  opts.forEach(o => o.addEventListener('click', () => {
    jasiChoice = o.dataset.v;
    opts.forEach(x => { const on = x === o; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    setJasiMsg('');
  }));
})();

function startTest() {
const name = document.getElementById('userName').value || '예비개발자';
let timeStr = document.getElementById('birthTime').value;

const birth = readBirthDate();
if (!birth.ok) { showDateMsg(birth.msg, birth.focus); return; }
showDateMsg('');

if (timeStr === '자시') {
  if (!jasiChoice) { setJasiMsg('자정 전인지 후인지 골라 주세요!'); return; }
  timeStr = jasiChoice;
}

const pillars = getFullPillars(birth.y, birth.m, birth.d, timeStr);
track('test_start', { birth_time_known: timeStr ? 'yes' : 'no' });
const analysis = computeSipsin(pillars);
const { counts, weakest, strongest } = analysis;

document.getElementById('screen1').classList.remove('active');
document.getElementById('screen-loading').classList.add('active');
history.pushState({ screen: 'result' }, '');

resultTimer = setTimeout(() => {
document.getElementById('screen-loading').classList.remove('active');
document.getElementById('screen-result').classList.add('active');
document.querySelector('.container').classList.add('on-result');

renderResult(name, pillars, counts, weakest, strongest, analysis);
triggerConfetti();
track('result_view', {
  strong_type: TYPE_CODE[strongest],
  weak_type: TYPE_CODE[weakest],
  day_element: OHENG_CODE[GAN_OHENG[pillars.dG]],
  char_type: OHENG_CODE[lastResult.strongOheng] + '_' + OHENG_CODE[lastResult.weakOheng]
});

}, 2000);
}

// 결과로 넘어갈 때 방문 기록을 하나 쌓아 두고(startTest의 pushState),
// 뒤로가기를 누르면 사이트를 나가는 대신 첫 화면으로 돌아온다. 입력한 값은 그대로 남는다.
let resultTimer = null;
function goHome() {
  clearTimeout(resultTimer);  // 로딩 중에 뒤로가기를 눌러도 결과 화면이 뜨지 않게
  document.getElementById('screen-loading').classList.remove('active');
  document.getElementById('screen-result').classList.remove('active');
  document.getElementById('screen1').classList.add('active');
  document.querySelector('.container').classList.remove('on-result');
  closeImgModal();
  scrollTo(0, 0);
}
window.addEventListener('popstate', goHome);

let pendingBuff = null;

// 추천 캠퍼스 활동 노출 스위치. true로 바꾸면 즉시 복구된다. (HTML·CSS·데이터 모두 보존)
const SHOW_CAMPUS_ACTIVITY = false;

// 형광펜 장전 / 긋기
// 주의: `${selector} .hl`처럼 쓰면 콤마로 나열한 셀렉터의 마지막 항목에만 .hl이 붙는다.
// ("#a, #b .hl" → #a 자체 + #b .hl) 반드시 항목마다 따로 붙여야 한다.
function penTargets(selector) {
  const q = selector.split(',').map(v => `${v.trim()} .hl`).join(', ');
  return document.querySelectorAll(q);
}
function armPens(selector) {
  penTargets(selector).forEach(el => el.classList.add('pen'));
}
function drawPens(selector, delay = 0) {
  penTargets(selector).forEach(el => setTimeout(() => el.classList.remove('pen'), delay));
}

// 봉인 해제 ①  부족 카드 → 덮개가 걷힌 뒤 형광펜이 그어진다
function unseal() {
  const el = document.getElementById('weakSeal');
  if (el.classList.contains('opened')) return;
  el.classList.add('opened');
  track('seal_open', { seal: 'weak' });
  drawPens('#weakSsafy', 450);
}

// 봉인 해제 ②  강점 카드 → 덮개가 걷히고, 서비스명 칩이 쿵쿵 박힌 뒤 형광펜이 그어진다
function unsealStrong() {
  const el = document.getElementById('strongSeal');
  if (el.classList.contains('opened')) return;
  el.classList.add('opened');
  track('seal_open', { seal: 'strong' });
  const chips = document.querySelectorAll('#svcChips .svc-chip');
  chips.forEach((chip, i) => setTimeout(() => chip.classList.add('pop-in'), 450 + i * 220));
  drawPens('#strongSsafy', 450 + chips.length * 220 + 250);
}

// 강점 활용 전략이 화면에 들어오면 그 문단의 형광펜만 그어준다.
// SSAFY 블록은 봉인이라 사용자가 직접 열 때 재생된다.
let strongObserver = null;
function observeStrongBlock() {
  const block = document.getElementById('strongStrategy');
  if (!block) return;
  if (strongObserver) strongObserver.disconnect();

  const fire = () => drawPens('#strongStrategy', 150);

  if (!('IntersectionObserver' in window)) { fire(); return; }
  strongObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { fire(); obs.disconnect(); }
    });
  }, { threshold: 0.35 });
  strongObserver.observe(block);
}

function renderResult(name, pillars, counts, weakestKey, strongestKey, analysis) {
// v7: 가장 적은 기운은 글자 수와 관계없이 모두 '성장 포인트'로 표현한다
const weak = CONTENT.weak[weakestKey];
const strong = CONTENT.strong[strongestKey];

// v4: 공유·이미지용 결과 저장 + CTA에 UTM 부착
lastResult = { name, dG: pillars.dG, strongestKey, weakestKey, dayOheng: GAN_OHENG[pillars.dG],
               strongOheng: sipsinToOheng(GAN_OHENG[pillars.dG], strongestKey), weakOheng: sipsinToOheng(GAN_OHENG[pillars.dG], weakestKey) };
document.getElementById('ctaBtn').href = ctaUrl(strongestKey);

document.getElementById('resultName').innerText = `${name} 님의 취업운은?`;

// 5-2 출생시간 미상 안내 / 5-1 자시 처리 각주
document.getElementById('timeUnknownNotice').hidden = pillars.hasHour;
document.getElementById('termNotice').hidden = !pillars.termBoundary;
document.getElementById('jasiFootnote').hidden = !pillars.isJasi;

// ① 캐릭터 배너 (강한 오행 × 성장 포인트 오행)
const dayOheng = GAN_OHENG[pillars.dG];
const strongOheng = sipsinToOheng(dayOheng, strongestKey);
const weakOheng = sipsinToOheng(dayOheng, weakestKey);
const ch = CHARACTER[strongOheng][weakOheng];
document.getElementById('iljuEmoji').innerText = ch.emoji;
document.getElementById('iljuName').innerText = ch.name;
// 캐릭터명이 길면(최대 12자) 한 줄에 들어가도록 글자 크기를 줄인다
document.getElementById('iljuName').style.fontSize = ch.name.length > 11 ? '24px' : ch.name.length > 8 ? '28px' : '';
document.getElementById('iljuOheng').innerText = charOhengLine(strongOheng, weakOheng);
document.getElementById('iljuTagline').innerText = ch.tagline;

const weakLabel = labelOf(weakestKey, dayOheng);
const strongLabel = labelOf(strongestKey, dayOheng);

// ①-2 결과 배지 + 간략 분석 말풍선 (강점 → 성장 포인트 순)
document.getElementById('resultBadge').innerText = `${CONTENT.badge[strongestKey]}`;
document.getElementById('resultMeme').innerHTML =
  `만세력 분석 결과, <strong>${strongOheng}(${OHENG_INFO[strongOheng].hanja})</strong> 기운이 강하고 `
  + `<strong>${weakOheng}(${OHENG_INFO[weakOheng].hanja})</strong> 기운은 앞으로 더 키워가면 좋겠어요!<br>`
  + `SSAFY에서 강점은 살리고, 성장 포인트는 키워 봐요!`;

// 차트 부제 — '내 오행' 태그를 없애면서 '(나 자신 포함)' 표기도 함께 뺐다.
// 캐릭터가 일간이 아니라 강점·성장 포인트 기준이라, 일간을 따로 짚을 필요가 없다.
document.getElementById('chartSub').innerText = pillars.hasHour
  ? '사주 여덟 글자를 한 글자씩 센 비율이에요'
  : '태어난 시간을 몰라 여섯 글자로 센 비율이에요';

// ③ 성향 요약 (강점 3조각 + 약점 1조각을 조립해 개조식 박스로)
const tStrong = CONTENT.trait.strong[strongestKey];
const tWeak = CONTENT.trait.weak[weakestKey];
document.getElementById('summaryLead').innerText = `${name}님은 이런 사람입니다`;
document.getElementById('traitPoint').innerText = tStrong.point;
document.getElementById('traitWeak').innerText = tWeak;
document.getElementById('traitLearn').innerText = tStrong.learn;
document.getElementById('traitJob').innerText = tStrong.job;
document.getElementById('highlightLine').innerHTML = `강점은 살리고 성장 포인트까지 키우면 취업 준비가 훨씬 단단해져요. 지금부터 자세히 알아볼까요?`;

// ④ 부족한 기운 카드 (SSAFY 블록은 봉인 상태로 시작)
document.getElementById('weakTitle').innerHTML = `${name}님의 성장 포인트는 '${weakLabel}'입니다`;

document.getElementById('weakCatch').innerText = weak.title;
document.getElementById('weakDesc').innerText = weak.desc;
document.getElementById('weakSsafy').innerHTML = weak.ssafy;
document.getElementById('weakSeal').classList.remove('opened');
document.getElementById('strongSeal').classList.remove('opened');

// ⑤ 강한 기운 카드 (강점 활용 전략 + SSAFY가 밀어주는 방법)
document.getElementById('strongTitle').innerHTML = `${name}님의 가장 큰 강점은 '${strongLabel}'입니다`;
document.getElementById('strongCatch').innerText = strong.title;
document.getElementById('strongStrategy').innerHTML = strong.strategy;
document.getElementById('strongSsafy').innerHTML = strong.ssafy;
document.getElementById('svcChips').innerHTML =
  strong.services.map(v => `<span class="svc-chip">${v}</span>`).join('');
document.querySelectorAll('#svcChips .svc-chip').forEach(c => c.classList.remove('pop-in'));

// 형광펜을 0%로 감춰 둔다 (나중에 좍 그어지도록)
armPens('#weakSsafy, #strongStrategy, #strongSsafy');

// ⑥ 추천 캠퍼스 활동 (스위치로 노출 제어)
const campusBox = document.getElementById('campusBox');
campusBox.hidden = !SHOW_CAMPUS_ACTIVITY;
if (SHOW_CAMPUS_ACTIVITY) {
  document.getElementById('activitySubtitle').innerText = `SSAFY 17기로 입과한 ${name}님에게 어울리는 활동은?`;
  document.getElementById('activityCampus').innerText = strong.campus;
}

// 스크롤로 들어오면 서비스명 칩 → 도장 순으로 발동
observeStrongBlock();

// ⑦ 행운 부적 (강점 콘텐츠 재사용)
const talismanCard = document.getElementById('talismanCard');
if (talismanCard) { talismanCard.classList.remove('flipped'); }
// 부적명·본문은 강점(5종), 마무리는 캐릭터(20종)
document.getElementById('talismanBack').innerHTML =
  `<div style="font-size: 34px; margin-bottom: 4px;">🧧</div>`
  + `<h2>${CONTENT.charm.name[strongestKey]}</h2>`
  + `<p>${CONTENT.charm.body[strongestKey]}</p>`
  + `<div class="charm-closing">${ch.closing}</div>`;

// ② 오행 분포도 차트 - 진입 시에는 실제 퍼센트만 표시 (버프 연출은 부적을 긁는 시점에 트리거)
document.getElementById('chartDesc').innerHTML = `내 만세력 사주 분석 완료<br>이제 SSAFY 버프 받아 볼까요?`;
const buffBtn = document.getElementById('buffBtn');
buffBtn.hidden = false; buffBtn.classList.remove('done'); buffBtn.innerHTML = '⚡ SSAFY 버프 받기 ⚡';
buffOn = false;
['mok','hwa','to','geum','su'].forEach(sl => { const e = document.getElementById(`buff-${sl}`); e.style.width = '0%'; e.style.opacity = '0'; });

// v6: 한 글자 = 100 / 글자수 (%). 여덟 글자면 12.5% 단위로, 만세력 사이트와 같은 숫자가 나온다.
const percentages = {};
SIPSIN_ORDER.forEach(key => {
const slug = OHENG_SLUG[sipsinToOheng(dayOheng, key)];
const n = counts[key];
const pv = n / analysis.total * 100;
percentages[slug] = pv;
document.getElementById(`orig-${slug}`).style.width = pv + '%';
document.getElementById(`val-${slug}`).innerText = pv.toFixed(1) + '%';
document.getElementById(`val-${slug}`).style.color = '#FF3366';
document.getElementById(`sub-${slug}`).innerText = `${MEANING[key]} ${n}자`;
});

// 동점을 지장간으로 가른 경우, 왜 그 기운이 뽑혔는지 한 줄로 설명한다
const ohengName = k => { const o = sipsinToOheng(dayOheng, k); return `${o}(${OHENG_INFO[o].hanja})`; };
// 조사: 목·금은 받침 있음(이), 화·토·수는 받침 없음(가)
const iga = k => ['목','금'].includes(sipsinToOheng(dayOheng, k)) ? '이' : '가';
// 목화토금수 순서로 나열
const byCycle = arr => arr.slice().sort((x, y) => CYCLE.indexOf(sipsinToOheng(dayOheng, x)) - CYCLE.indexOf(sipsinToOheng(dayOheng, y)));
const tieLines = [];
if (analysis.strongTies.length > 1)
  tieLines.push(`${byCycle(analysis.strongTies).map(ohengName).join('·')}${iga(byCycle(analysis.strongTies).pop())} ${counts[strongestKey]}글자로 같지만, 지지 속 숨은 기운까지 보면 <b>${ohengName(strongestKey)}</b>${iga(strongestKey)} 가장 강해요`);
if (analysis.weakTies.length > 1)
  tieLines.push(`${byCycle(analysis.weakTies).map(ohengName).join('·')}${iga(byCycle(analysis.weakTies).pop())} ${counts[weakestKey]}글자로 같지만, 숨은 기운까지 보면 <b>${ohengName(weakestKey)}</b>${iga(weakestKey)} 가장 적어요`);
const tieNote = document.getElementById('tieNote');
tieNote.innerHTML = tieLines.map(t => `${t}`).join('<br>');
tieNote.hidden = tieLines.length === 0;



pendingBuff = { weakName: weakLabel, percentages, weakWord: '성장 포인트인' };
}


function flipTalisman() {
const card = document.getElementById('talismanCard');
if (!card) return;
card.classList.toggle('flipped');
if (card.classList.contains('flipped')) {
if (!card.dataset.tracked) { card.dataset.tracked = '1'; track('talisman_flip', { strong_type: lastResult ? TYPE_CODE[lastResult.strongestKey] : '' }); }
}
}

// v10: 차트 바로 아래 버튼으로 버프를 켜고 끈다.
//  켜기: 다섯 막대가 차례로 SSAFY 버프로 가득 차고, 숫자가 실제 비율 → 100%로 올라간다.
//  끄기: 원래 분포로 돌아간다. (글자 수 "○자"는 항상 표시돼 실제 결과는 언제든 확인 가능)
let buffOn = false;
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el, from, to, ms) {
  if (REDUCED_MOTION) { el.innerText = to.toFixed(to % 1 ? 1 : 0) + '%'; return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    const v = from + (to - from) * eased;
    el.innerText = (k < 1 ? v.toFixed(0) : to.toFixed(to % 1 ? 1 : 0)) + '%';
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function toggleBuff() {
  if (!pendingBuff) return;
  const { weakName, percentages, weakWord } = pendingBuff;
  const btn = document.getElementById('buffBtn');
  const slugs = ['mok', 'hwa', 'to', 'geum', 'su'];
  buffOn = !buffOn;

  if (buffOn) {
    track('buff_on', { strong_type: lastResult ? TYPE_CODE[lastResult.strongestKey] : '' });
    btn.disabled = true;
    slugs.forEach((slug, i) => {
      setTimeout(() => {
        const orig = percentages[slug];
        const buffElem = document.getElementById(`buff-${slug}`);
        buffElem.style.width = (100 - orig) + '%'; buffElem.style.opacity = '1';
        const val = document.getElementById(`val-${slug}`);
        val.style.color = '#E6A700';
        countUp(val, orig, 100, 900);
        const bg = buffElem.parentElement;
        bg.classList.remove('charged'); void bg.offsetWidth; bg.classList.add('charged');
        setTimeout(() => { val.classList.remove('pop'); void val.offsetWidth; val.classList.add('pop'); }, 900);
      }, REDUCED_MOTION ? 0 : i * 180);
    });
    setTimeout(() => {
      document.getElementById('chartDesc').innerHTML =
        `✨ SSAFY 버프 발동! 다섯 기운이 가득 찼어요<br>${weakWord} <strong>${weakName}</strong>까지, SSAFY에서 차근차근 키워갈 수 있어요`;
      btn.classList.add('done'); btn.innerHTML = '↩︎ 원래 분포 다시 보기'; btn.disabled = false;
      if (typeof confetti === 'function' && !REDUCED_MOTION) {
        const r = btn.getBoundingClientRect();
        confetti({ particleCount: 70, spread: 70, startVelocity: 30,
                   origin: { x: (r.left + r.width / 2) / innerWidth, y: r.top / innerHeight },
                   colors: ['#FFD54F', '#7B61FF', '#FF3366'] });
      }
      const confirmText = document.getElementById('buffConfirmText');
      if (confirmText) {
        confirmText.innerHTML = `강점은 살리고 성장 포인트는 키우는 1년,<br><strong>SSAFY 17기</strong>에서 시작해 보세요 🙌`;
        confirmText.classList.add('show');
      }
    }, REDUCED_MOTION ? 0 : 5 * 180 + 900);
  } else {
    slugs.forEach(slug => {
      const buffElem = document.getElementById(`buff-${slug}`);
      buffElem.style.width = '0%'; buffElem.style.opacity = '0';
      const val = document.getElementById(`val-${slug}`);
      val.style.color = '#FF3366';
      val.innerText = percentages[slug].toFixed(1) + '%';
    });
    document.getElementById('chartDesc').innerHTML = `내 만세력 사주 분석 완료 <br>이제 SSAFY 버프 받아 볼까요?`;
    btn.classList.remove('done'); btn.innerHTML = '⚡ SSAFY 버프 다시 받기 ⚡';
  }
}

// ===== v4: 공유 =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function plainLabel(key, dayOheng) {
  const o = sipsinToOheng(dayOheng, key);
  return `${MEANING[key]}의 기운, ${o}(${OHENG_INFO[o].hanja})`;
}

function shareText() {
  if (!lastResult) return '나의 취업 사주와 SSAFY 17기의 궁합은?';
  return `내 취업 사주는 '${CONTENT.badge[lastResult.strongestKey]}'. 당신의 SSAFY 17기 궁합은?`;
}

// ===== v4: 결과 이미지 (인스타 스토리 1080×1920) =====
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 한국어는 어절 단위로 줄바꿈하고, 한 어절이 너무 길면 글자 단위로 자른다
function wrapLines(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let line = '';
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) { line = test; return; }
    if (line) lines.push(line);
    line = w;
    while (ctx.measureText(line).width > maxW) {
      let i = line.length; while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
      lines.push(line.slice(0, i)); line = line.slice(i);
    }
  });
  if (line) lines.push(line);
  return lines;
}
// 한 줄에 반드시 들어가야 하는 문구는 폭에 맞춰 글자 크기를 줄인다
function fitFont(ctx, text, weight, size, family, maxW) {
  do { ctx.font = `${weight} ${size}px ${family}`; size -= 2; } while (ctx.measureText(text).width > maxW && size > 20);
}
function drawWrapped(ctx, text, x, y, maxW, lh) {
  const lines = wrapLines(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TITLE_FONT = '"CookieRun","Pretendard",sans-serif';
const BODY_FONT = '"Pretendard",sans-serif';

async function buildResultCanvas() {
  const r = lastResult;
  const W = 1080, H = 1920;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  try {
    await Promise.all([
      document.fonts.load(`700 80px ${TITLE_FONT}`),
      document.fonts.load(`700 40px ${BODY_FONT}`),
      document.fonts.load(`900 40px ${BODY_FONT}`)
    ]);
  } catch (e) {}

  const il = CHARACTER[r.strongOheng][r.weakOheng];
  const cx = W / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // 배경
  ctx.fillStyle = '#F9F3FF'; ctx.fillRect(0, 0, W, H);

  // 상단 캐릭터 패널
  const g = ctx.createLinearGradient(80, 110, 1000, 900);
  g.addColorStop(0, '#7B61FF'); g.addColorStop(1, '#B9A6F2');
  ctx.save(); ctx.shadowColor = 'rgba(123,97,255,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  rrect(ctx, 80, 110, 920, 800, 56); ctx.fillStyle = g; ctx.fill(); ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 38px ${BODY_FONT}`;
  ctx.fillText('SSAFY 17기 × 나의 취업 사주', cx, 200);
  ctx.font = `700 34px ${BODY_FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('당신이 타고난 기운은', cx, 280);
  ctx.font = `190px ${EMOJI_FONT}`; ctx.fillText(il.emoji, cx, 500);
  ctx.fillStyle = '#fff'; fitFont(ctx, il.name, 700, 92, TITLE_FONT, 820);
  ctx.fillText(il.name, cx, 640);
  ctx.font = `700 42px ${BODY_FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(charOhengLine(r.strongOheng, r.weakOheng), cx, 712);
  ctx.font = `500 36px ${BODY_FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  drawWrapped(ctx, il.tagline, cx, 790, 760, 52);

  // 이름 + 배지
  ctx.fillStyle = '#555'; ctx.font = `700 46px ${BODY_FONT}`;
  ctx.fillText(`${r.name} 님은`, cx, 1020);
  ctx.fillStyle = '#FF3366';
  fitFont(ctx, `${CONTENT.badge[r.strongestKey]}`, 900, 84, BODY_FONT, 940);
  ctx.save(); ctx.shadowColor = '#FFD1DC'; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
  ctx.fillText(`${CONTENT.badge[r.strongestKey]}`, cx, 1125); ctx.restore();

  // 강점 / 성장 포인트 박스
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.06)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  rrect(ctx, 80, 1180, 920, 250, 40); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  const rows = [
    ['강점', '#FF3366', '#FFF0F4', plainLabel(r.strongestKey, r.dayOheng)],
    ['성장 포인트', '#2E9E6B', '#EAF8F0', plainLabel(r.weakestKey, r.dayOheng)]
  ];
  // 태그 길이가 달라도('강점'/'성장 포인트') 오른쪽 글자가 같은 줄에서 시작하도록 가장 긴 태그 폭에 맞춘다
  ctx.font = `800 36px ${BODY_FONT}`;
  const tagW = Math.max(...rows.map(rw => ctx.measureText(rw[0]).width)) + 44;
  rows.forEach(([tag, fg, bg, txt], i) => {
    const y = 1260 + i * 100;
    ctx.textAlign = 'left';
    ctx.font = `800 36px ${BODY_FONT}`;
    const tw = ctx.measureText(tag).width + 44;
    rrect(ctx, 140, y - 46, tw, 66, 33); ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(tag, 162, y);
    ctx.fillStyle = '#333'; ctx.font = `700 42px ${BODY_FONT}`;
    ctx.fillText(txt, 140 + tagW + 28, y);
  });
  ctx.textAlign = 'center';

  // 부적
  rrect(ctx, 80, 1480, 920, 270, 40); ctx.fillStyle = '#FF3366'; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; rrect(ctx, 96, 1496, 888, 238, 32); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `700 54px ${TITLE_FONT}`;
  ctx.fillText(`${CONTENT.charm.name[r.strongestKey]}`, cx, 1590);
  ctx.font = `700 40px ${BODY_FONT}`;
  drawWrapped(ctx, il.closing, cx, 1670, 820, 54);

  // 하단
  let host = baseUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (location.protocol === 'file:') host = 'SSAFY 17기 취업 사주 테스트';
  ctx.fillStyle = '#7B61FF'; fitFont(ctx, `나도 해보기 👉 ${host}`, 800, 38, BODY_FONT, 920);
  ctx.fillText(`나도 해보기 👉 ${host}`, cx, 1838);
  ctx.fillStyle = '#AAA'; ctx.font = `500 26px ${BODY_FONT}`;
  ctx.fillText('재미로 보는 테스트예요', cx, 1884);

  return cv;
}

let _imgBlob = null;
async function saveResultImage() {
  if (!lastResult) return;
  showToast('결과 카드를 만드는 중…');
  const cv = await buildResultCanvas();
  _imgBlob = await new Promise(res => cv.toBlob(res, 'image/png'));
  document.getElementById('imgPreview').src = cv.toDataURL('image/png');
  document.getElementById('imgModal').hidden = false;
  document.getElementById('toast').classList.remove('show');
  track('image_open', { item_id: TYPE_CODE[lastResult.strongestKey] });
}
function closeImgModal() { document.getElementById('imgModal').hidden = true; }

// 카카오톡 인앱 브라우저는 공유 시트도, blob 다운로드도 처리하지 못한다("지원하지 않는 파일 형식").
// → 버튼을 누르면 안내문을 바꿔서 이미지를 길게 눌러 저장하도록 안내한다.
const IS_KAKAO = /KAKAOTALK/i.test(navigator.userAgent);
function showKakaoSaveGuide() {
  document.getElementById('imgHint').innerHTML = '카카오톡에서는 위 이미지를 <b>길게 눌러</b> 저장해 주세요';
}

document.getElementById('imgSaveBtn').addEventListener('click', async () => {
  if (!_imgBlob) return;
  const itemId = TYPE_CODE[lastResult.strongestKey];
  if (IS_KAKAO) { showKakaoSaveGuide(); return; }
  const file = new File([_imgBlob], `ssafy17_saju_${itemId}.png`, { type: 'image/png' });
  // 모바일: 시스템 공유 시트(사진 저장·인스타 스토리 바로 연결)
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: document.title, text: shareText() });
      track('image_save', { method: 'share_sheet', item_id: itemId });
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  // PC 등: 파일 다운로드
  const a = document.createElement('a');
  a.href = URL.createObjectURL(_imgBlob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  track('image_save', { method: 'download', item_id: itemId });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeImgModal(); });

document.getElementById('ctaBtn').addEventListener('click', () => {
  track('cta_click', { strong_type: lastResult ? TYPE_CODE[lastResult.strongestKey] : '' });
});
// v8: 봉인·부적 카드를 키보드(Enter/Space)로도 열 수 있게
['strongSeal', 'weakSeal', 'talismanCard'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  });
});
// ===== v4 끝 =====

function triggerConfetti() {
if (typeof confetti !== 'function') return; // CDN 차단 시 결과 화면은 그대로 동작
var duration = 3 * 1000; var animationEnd = Date.now() + duration; var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
function randomInRange(min, max) { return Math.random() * (max - min) + min; }
var interval = setInterval(function() {
var timeLeft = animationEnd - Date.now();
if (timeLeft <= 0) return clearInterval(interval);
var particleCount = 50 * (timeLeft / duration);
confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
}, 250);
}
