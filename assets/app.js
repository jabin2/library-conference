// ══════════════════════════════════════════════════
//  Firebase 초기화
// ══════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0s2eooo79g7pXOf0dkmAf1I0pgfpvkow",
  authDomain: "library-conference-2026.firebaseapp.com",
  databaseURL: "https://library-conference-2026-default-rtdb.firebaseio.com",
  projectId: "library-conference-2026",
  storageBucket: "library-conference-2026.firebasestorage.app",
  messagingSenderId: "1045335926932",
  appId: "1:1045335926932:web:2195fd0d078a27e836ec81"
};

const _app  = initializeApp(firebaseConfig);
const _db   = getDatabase(_app);
const _auth = getAuth(_app);

const _doneRef   = ref(_db, 'lib63/done');
const _customRef = ref(_db, 'lib63/custom');
const _initRef   = ref(_db, 'lib63/initialized');

let _doneCache   = {};
let _customCache = [];
let _dbReady     = false;
let _initialized = false;

// ══════════════════════════════════════════════════
//  로그인 처리 (Firebase Authentication)
// ══════════════════════════════════════════════════
async function tryLogin() {
  const email = document.getElementById('loginId').value.trim();
  const pw    = document.getElementById('loginPw').value.trim();
  const err   = document.getElementById('loginErr');
  const btn   = document.getElementById('loginBtn');

  if (!email || !pw) {
    err.textContent = '이메일과 비밀번호를 입력해주세요.';
    return;
  }

  btn.textContent = '로그인 중...';
  btn.disabled = true;
  err.textContent = '';

  try {
    await signInWithEmailAndPassword(_auth, email, pw);
  } catch (e) {
    err.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
    document.getElementById('loginPw').value = '';
    document.getElementById('loginPw').focus();
    btn.textContent = '로그인';
    btn.disabled = false;
  }
}

document.getElementById('loginBtn').addEventListener('click', tryLogin);
document.getElementById('loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
document.getElementById('loginId').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPw').focus(); });

// ── 인증 상태 감지 → 앱 시작 ──
onAuthStateChanged(_auth, user => {
  if (user) {
    document.getElementById('loginScreen').style.display = 'none';
    initApp();
  }
});

// ══════════════════════════════════════════════════
//  앱 초기화 (로그인 성공 후 호출)
// ══════════════════════════════════════════════════
function initApp() {
  if (_dbReady) return;

  // done 리스너
  onValue(_doneRef, snap => {
    _doneCache = snap.val() || {};
    if (_dbReady) {
      document.querySelectorAll('.task-chip').forEach(chip => {
        const who  = chip.querySelector('.who')?.textContent || '';
        const text = chip.querySelector('.task-text strong')?.textContent || '';
        const key  = who + '|' + text;
        if (_doneCache[key]) chip.classList.add('done');
        else chip.classList.remove('done');
      });
      document.querySelectorAll('.week-row').forEach(row => updateProgress(row));
    }
  });

  // initialized 플래그 먼저 확인 후 custom 리스너 등록
  onValue(_initRef, snapInit => {
    _initialized = snapInit.val() === true;

    onValue(_customRef, snap => {
      _customCache = snap.val() ? Object.values(snap.val()) : [];

      if (!_dbReady) {
        if (!_initialized) {
          // 최초 1회: data[]를 Firebase에 저장
          const allTasks = [];
          data.forEach(m => {
            if (!m.weeks) return;
            m.weeks.forEach(w => {
              if (!w.tasks || w.tasks.length === 0) return;
              w.tasks.forEach(t => {
                allTasks.push({...t, weekLabel: w.label, custom: true});
              });
            });
          });
          _customCache = allTasks;
          const obj = {};
          allTasks.forEach((item, i) => { obj['t' + i] = item; });
          set(_customRef, obj);
          set(_initRef, true);
        }
        render();
        renderCalendar();
        renderInProgress();
        _dbReady = true;
        return;
      }

      // 이후 실시간 업데이트
      if (!_dbReady) return;
      document.querySelectorAll('.week-row').forEach(row => {
        const weekLabel = row.dataset.weekLabel;
        const tasks = row.querySelector('.week-tasks');
        if (!tasks) return;
        tasks.querySelectorAll('.task-chip').forEach(el => el.remove());
        row.querySelector('.done-count')?.remove();
        const addBtn = tasks.querySelector('.add-here-btn');
        const weekTasks = _customCache.filter(c => c.weekLabel === weekLabel);
        if (weekTasks.length > 0) {
          const lbl = row.querySelector('.week-label');
          const cnt = document.createElement('div'); cnt.className = 'done-count';
          cnt.innerHTML = `<span>0/${weekTasks.length} 완료</span><div class="done-bar-wrap"><div class="done-bar" style="width:0%"></div></div>`;
          lbl.appendChild(cnt);
          weekTasks.forEach(t => {
            const chip = buildTaskChip(t);
            tasks.insertBefore(chip, addBtn);
          });
        }
        updateProgress(row);
      });
      renderCalendar();
      renderInProgress();
      applyFilter();
    });
  });
}

// ══════════════════════════════════════════════════
//  Firebase 헬퍼
// ══════════════════════════════════════════════════
function loadDone()    { return _doneCache; }
function saveDone(o)   { _doneCache = o; set(_doneRef, o); }
function loadCustom()  { return _customCache; }
function saveCustom(a) {
  _customCache = a;
  const obj = {};
  a.forEach((item, i) => { obj['t' + i] = item; });
  set(_customRef, Object.keys(obj).length ? obj : null);
}
function taskKey(t) { return t.who + '|' + t.text; }

// ══════════════════════════════════════════════════
//  데이터
// ══════════════════════════════════════════════════
const data = [
{month:"3월",badge:"3월",desc:"기반 마련",weeks:[
  {label:"3월 4주",range:"3/23(월)~3/29(일)",tasks:[
    {who:"협회",type:"h",text:"기본계획 수립 완료",date:"3/26(목)"},
  ]}
]},
{month:"4월",badge:"4월",desc:"용역사 선정",weeks:[
  {label:"4월 3주",range:"4/20(월)~4/26(일)",tasks:[
    {who:"협회",type:"h",text:"행사 용역사 공모 및 선정·계약",date:"4/22(수)~6/11(목)"},
  ]},
]},
{month:"5월",badge:"5월",desc:"대회 기반 구축",weeks:[
  {label:"5월 1주",range:"5/4(월)~5/10(일)",tasks:[]},
  {label:"5월 2주",range:"5/11(월)~5/17(일)",tasks:[
    {who:"협회",type:"h",text:"대회 주제 공모",date:"5/12(화)~5/20(수)"},
  ]},
  {label:"5월 3주",range:"5/18(월)~5/24(일)",tasks:[
    {who:"협회",type:"h",text:"주제 선정 (사무국 및 회원 선호도 조사 포함)",date:"5/21(목)~5/29(금)"},
  ]},
  {label:"5월 4주",range:"5/25(월)~5/31(일)",tasks:[
    {who:"협회",type:"h",text:"차기·차차기 개최지 홍보 영상 요청",date:"5/26(화)~9/30(수)"},
  ]},
]},
{month:"6월",badge:"6월",desc:"전시·홈페이지 준비",weeks:[
  {label:"6월 1주",range:"6/1(월)~6/7(일)",tasks:[
    {who:"용역사",type:"y",text:"도서관문화전시회 기본계획 수립",date:"~6/19(금)"},
    {who:"용역사",type:"y",text:"부스 배치도(안) 확정",date:"~6/19(금)"},
  ]},
  {label:"6월 2주",range:"6/8(월)~6/14(일)",tasks:[
    {who:"용역사",type:"y",text:"도서관대회·전시회 홈페이지 개편 및 운영",date:"6/8(월)~12/31(목)"},
    {who:"협회",type:"h",text:"차차기 개최지 공모 및 선정",date:"6/10(수)~7/17(금)"},
  ]},
  {label:"6월 3주",range:"6/15(월)~6/21(일)",tasks:[
    {who:"용역사",type:"y",text:"도서관대회·전시회 홈페이지 수정 및 최신화",date:"6/15(월)~7/3(금)"},
    {who:"용역사",type:"y",text:"포스터 제작",date:"6/15(월)~6/30(화)"},
    {who:"공동",type:"b",text:"개최지 현장 답사",date:"6/17(수), 협의필요"},
  ]},
  {label:"6월 4주",range:"6/22(월)~6/30(화)",tasks:[
    {who:"협회",type:"h",text:"후원명칭 사용 요청 및 승인 확인",date:"6/29(월)~7/3(금)"},
    {who:"공동",type:"b",text:"프로그램 및 튜토리얼 기본계획 수립",date:"6/29(월)~7/10(금)"},
    {who:"용역사",type:"y",text:"포스터세션 모집 계획 수립(위치·규모 확정)",date:"6/29(월)~7/10(금)"},
    {who:"용역사",type:"y",text:"튜토리얼 기본계획 수립",date:"6/29(월)~7/10(금)"},
  ]},
]},
{month:"7월",badge:"7월",desc:"모집 공고 전면 개시",weeks:[
  {label:"7월 1,2주",range:"7/1(수)~7/12(일)",tasks:[
    {who:"용역사",type:"y",text:"신문광고 제작 및 배포(내일신문)",date:"7~10월(홀수 주)"},
    {who:"공동",type:"b",text:"숙박 루밍리스트 관리",date:"7월~10월"},
    {who:"용역사",type:"y",text:"대회 홈페이지 참가등록 개선",date:"7월~10월"},
    {who:"협회",type:"h",text:"지방보조금 교부 신청",date:"7/6(월)~7/10(금)"},
    {who:"공동",type:"b",text:"전시회 접수 및 전시참가비 입금 확인",date:"7/8(수)~10/16(금)"},
    {who:"용역사",type:"y",text:"참가사 모집(세미나)",date:"7/8(수)~8/19(수)"},
    {who:"용역사",type:"y",text:"프로그램 홈페이지 수정 및 최신화",date:"~7/10(금)"},
    {who:"협회",type:"h",text:"프로그램 주제 및 발표자 섭외",date:"7/10(금)~7/31(금)"},
  ]},
  {label:"7월 3주",range:"7/13(월)~7/19(일)",tasks:[
    {who:"협회",type:"h",text:"프로그램 운영 협회 산하협의회 지원금 안내",date:"7/13(월)"},
    {who:"공동",type:"b",text:"프로그램 모집 공문 발송(문서24, 메일)",date:"7/13(월)~8/4(화)"},
    {who:"용역사",type:"y",text:"전시회 참가사 모집 공문 발송 및 사전신청",date:"7/13(월)~8/4(화)"},
    {who:"용역사",type:"y",text:"포스터세션 모집 공고(전시 얼리버드와 동일)",date:"7/13(월)~8/4(화)"},
    {who:"용역사",type:"y",text:"프로그램 진행 기관 세션 내용 입력",date:"7/13(월)~9/11(금)"},
    {who:"용역사",type:"y",text:"프로그램 진행 기관 발표자료 파일 업로드",date:"7/13(월)~9/25(금)"},
  ]},
  {label:"7월 4주",range:"7/20(월)~7/26(일)",tasks:[
    {who:"용역사",type:"y",text:"협찬사 모집·관리",date:"7/20(월)~9/11(금)"},
  ]},
  {label:"7월 5주",range:"7/27(월)~8/2(일)",tasks:[
    {who:"용역사",type:"y",text:"참가자 안내사항(숙박·관광 등) 리스트 정리",date:"7/27(월)~8/6(목)"},
    {who:"용역사",type:"y",text:"전시회 기자재·부대시설 신청 접수 시작",date:"7/27(월)~9/29(화)"},
    {who:"공동",type:"b",text:"개최 안내 공문 발송(학교도서관, 17개시·도대표도서관)",date:"7/29(금)"},
  ]},
]},
{month:"8월 1주",badge:"8/1주",desc:"전시회 관련 업무",special:"key",weeks:[
  {label:"8월 1주 ★",range:"8/3(월)~8/9(일)",tasks:[
    {who:"용역사",type:"y",text:"전시회 관련 택배 안내 (상시안내)",date:"8/3(월)~"},
    {who:"용역사",type:"y",text:"전시회 참가사 사전신청 마감",date:"~8/4(화)"},
    {who:"공동",type:"b",text:"프로그램 모집 공문 발송 마감",date:"~8/4(화)"},
    {who:"용역사",type:"y",text:"전시회 참가사 모집(일반신청) 개시",date:"8/5(수)~8/31(월)"},
    {who:"용역사",type:"y",text:"참가등록 사전신청 개시(사전등록)",date:"8/7(금)~8/28(금)"},
  ]},
  {label:"8월 2주 WLIC",range:"8/10(월)~8/16(일)",tasks:[
    {who:"공동",type:"b",text:"초청장 제작·발송 대상자 명단 정리 시작",date:"8/10(월)~8/28(금)"},
  ]},
]},
{month:"8월 3~4주",badge:"8/3·4주",desc:"준비 본격화",weeks:[
  {label:"8월 3주",range:"8/18(화)~8/23(일)",tasks:[
    {who:"용역사",type:"y",text:"참가사 모집(세미나) 마무리",date:"~8/19(수)"},
  ]},
  {label:"8월 4주",range:"8/24(월)~8/30(일)",tasks:[
    {who:"공동",type:"b",text:"개최지 현장 답사(사전답사·실측)",date:"8/24(월)"},
    {who:"협회",type:"h",text:"시상식·홍보부스 운영 계획 수립",date:"8/24(월)~9/4(금)"},
    {who:"공동",type:"b",text:"프로그램 진행 기관 선정 및 공지",date:"8/24(월)~8/26(수)"},
    {who:"용역사",type:"y",text:"프로그램 일정표 작성 및 공유",date:"8/24(월)~9/4(금)"},
    {who:"협회",type:"h",text:"기념품 제작(상품 및 디자인 작업 포함)",date:"8/24(월)~10/2(금)"},
    {who:"용역사",type:"y",text:"참가등록 사전신청 마감",date:"8/28(금)"},
    {who:"용역사",type:"y",text:"자원봉사 모집 공고 시작",date:"8/31(월)~10/29(목)"},
    {who:"협회",type:"h",text:"문화공연(개회식 만남의자리) 섭외",date:"8/31(월)~9/11(금)"},
    {who:"협회",type:"h",text:"시상식 참석자 명단 조사 시작",date:"8/31(월)~9/18(금)"},
    {who:"용역사",type:"y",text:"참가등록 일반신청 개시(일반등록)",date:"8/31(월)~9/30(수)"},
  ]},
]},
{month:"9월",badge:"9월",desc:"최종 준비 · 모집 마감",weeks:[
  {label:"9월 1주",range:"9/1(화)~9/6(일)",tasks:[
    {who:"용역사",type:"y",text:"협회 홍보부스 기본계획 수립",date:"9/1(화)~9/11(금)"},
  ]},
  {label:"9월 2주",range:"9/7(월)~9/13(일)",tasks:[
    {who:"공동",type:"b",text:"초청장 발송",date:"9/7(월)~9/11(금)"},
    {who:"용역사",type:"y",text:"전시회 부스 추첨식(주요 안내사항 공지 포함)",date:"9/7(월)~9/11(금)"},
    {who:"용역사",type:"y",text:"대회진행본부·물품보관소 등 행사진행 공간 확정",date:"9/7(월)~9/18(금)"},
    {who:"용역사",type:"y",text:"각종 제작물 제작(통천, X배너, 사인물 등)",date:"9/7(월)~10/8(목)"},
    {who:"공동",type:"b",text:"홍보부스 디자인 제작",date:"9/7(월)~10/8(목)"},
    {who:"용역사",type:"y",text:"프로그램 자료집 제작(PDF)",date:"9/7(월)~10/14(수)"},
    {who:"협회",type:"h",text:"지방보조금 운영",date:"9/7(월)~11/6(금)"},
    {who:"공동",type:"b",text:"포스터세션 선정팀 안내(참가비 1인 면제)",date:"9/10(목)"},
    {who:"협회",type:"h",text:"시상식 참석자 명단 조사 마감",date:"~9/18(금)"},
  ]},
  {label:"9월 3주",range:"9/14(월)~9/20(일)",tasks:[
    {who:"용역사",type:"y",text:"수어통역 계획·계약",date:"9/14(월)~9/18(금)"},
    {who:"용역사",type:"y",text:"튜토리얼 발표자료 업로드",date:"9/18(금)"},
    {who:"용역사",type:"y",text:"협회 홍보부스 홍보물 제작",date:"9/14(월)~9/29(화)"},
    {who:"용역사",type:"y",text:"대회 홈페이지 업체별 홍보자료 업로드 확인",date:"~9/29(화)"},
  ]},
  {label:"9월 4주",range:"9/21(월)~9/30(수)",tasks:[
    {who:"용역사",type:"y",text:"홍보(보도자료 배포) — 총 2회(9월, 10월)"},
    {who:"용역사",type:"y",text:"튜토리얼 프로그램 홍보",date:"9/21(월)~10/8(목)"},
    {who:"용역사",type:"y",text:"프로그램 진행 기관 발표자료 업로드 마감",date:"9/25(금)"},
    {who:"용역사",type:"y",text:"포스터세션 선정팀 포스터 파일 제출",date:"9/25(금)"},
    {who:"용역사",type:"y",text:"셔틀버스 코스·정류장 확정",date:"9/21(월)~10/6(화)"},
    {who:"용역사",type:"y",text:"공식행사(개회식·만남의자리)시나리오 작성",date:"9/21(월)~10/23(금)"},
    {who:"용역사",type:"y",text:"프로그램·튜토리얼 홍보",date:"9/28(월)~10/8(목)"},
    {who:"용역사",type:"y",text:"오찬·만찬 세부 계획 확정(장소·메뉴·참석대상)",date:"9/28(월)~10/16(금)"},
    {who:"용역사",type:"y",text:"주요 내빈 참석여부(공식행사·숙박 등) 확인",date:"9/28(월)~10/23(금)"},
    {who:"용역사",type:"y",text:"참가등록 일반신청 마감(일반등록)",date:"~9/30(수)"},
  ]},
]},
{month:"10월 1~3주",badge:"10월",desc:"마무리 점검",weeks:[
  {label:"10월 1주",range:"10/5(월)~10/11(일)",tasks:[
    {who:"용역사",type:"y",text:"행사보험 가입",date:"10/6(화)~10/16(금)"},
    {who:"용역사",type:"y",text:"전시참가사 제출서류 확인",date:"~10/8(목)"},
    {who:"용역사",type:"y",text:"전시참가사별 기자재 확인",date:"~10/8(목)"},
  ]},
  {label:"10월 2주",range:"10/12(월)~10/18(일)",tasks:[
    {who:"용역사",type:"y",text:"참가등록 명찰 제작",date:"10월"},
    {who:"협회",type:"h",text:"프로그램 운영 협회 산하협의회 지원금 지급",date:"10/12(월)~10/16(금)"},
  ]},
  {label:"10월 3주",range:"10/19(월)~10/25(일)",tasks:[
    {who:"용역사",type:"y",text:"명찰 작업·전달",date:"10/19(월)~10/21(수)"},
    {who:"용역사",type:"y",text:"각종 사인물·제작물 현장 반입 준비",date:"~10/23(금)"},
  ]},
]},
{month:"10월 4주 ★대회당일",badge:"D-DAY",desc:"10/28(수)~10/30(금)",special:"event",event:[
  {date:"10/28(수)",desc:"개막·개회식 / 프로그램 진행 / 홍보부스 운영 / 포스터세션 / 전시회 운영 / 만남의자리"},
  {date:"10/29(목)",desc:"참가등록(오후 3:20 마감) / 프로그램 / 튜토리얼 / 홍보부스 / 포스터세션 / 전시회"},
  {date:"10/30(금)",desc:"지역 도서관 탐방 및 관광 등 자유일정"},
]},
{month:"11~12월",badge:"11·12월",desc:"사후 정리",weeks:[
  {label:"11월 1~2주",range:"11/3(화)~11/15(일)",tasks:[
    {who:"협회",type:"h",text:"튜토리얼 진행 정산",date:"11/3(화)"},
    {who:"협회",type:"h",text:"감사편지 발송(대회·프로그램·튜토리얼·전시회)",date:"11/9(월)~11/13(금)"},
    {who:"용역사",type:"y",text:"교육이수확인증 발급",date:"11/9(월)~12/31(목)"},
    {who:"공동",type:"b",text:"평가회의",date:"11월 둘째 주"},
    {who:"공동",type:"b",text:"결과보고서 제출",date:"~11/27(금)"},
  ]},
  {label:"11월 말~12월",range:"11월 중~12월",tasks:[
    {who:"협회",type:"h",text:"지방교부금 정산",date:"~11/27(금)"},
    {who:"협회",type:"h",text:"사업비(자체·지원금) 정산",date:"~12/4(금)"},
  ]},
]},
];

// ══════════════════════════════════════════════════
//  주차 목록 (모달 드롭다운)
// ══════════════════════════════════════════════════
function getAllWeeks() {
  const list = [];
  data.forEach(m => {
    if (!m.weeks) return;
    m.weeks.forEach(w => { if (!w.wlic) list.push({label:w.label, range:w.range, weekLabel:w.label}); });
  });
  return list;
}

// ══════════════════════════════════════════════════
//  칩 빌더
// ══════════════════════════════════════════════════
function buildTaskChip(t) {
  const d = document.createElement('div');
  d.className = 'task-chip ' + t.type + ' custom-task';
  d.dataset.type = t.type;
  const key = taskKey(t);
  if (loadDone()[key]) d.classList.add('done');

  const box     = document.createElement('span'); box.className = 'check-box'; box.title = '완료 표시';
  const who     = document.createElement('span'); who.className = 'who'; who.textContent = t.who;
  const txt     = document.createElement('span'); txt.className = 'task-text';
  txt.innerHTML = `<strong>${t.text}</strong>${t.date ? `<span class="date-tag">${t.date}</span>` : ''}`;
  const handle  = document.createElement('span'); handle.className = 'drag-handle'; handle.title = '순서 이동'; handle.textContent = '⠿';
  const editBtn = document.createElement('button'); editBtn.className = 'edit-btn'; editBtn.title = '수정'; editBtn.textContent = '✎';
  const del     = document.createElement('button'); del.className = 'delete-btn'; del.title = '삭제'; del.textContent = '✕';

  editBtn.addEventListener('click', e => { e.stopPropagation(); openEditModal(t, d); });
  del.addEventListener('click', e => { e.stopPropagation(); deleteTask(t, d); });

  d.appendChild(box); d.appendChild(who); d.appendChild(txt);
  d.appendChild(handle); d.appendChild(editBtn); d.appendChild(del);

  handle.addEventListener('mousedown', () => { d.draggable = true; });
  handle.addEventListener('mouseup',   () => { d.draggable = false; });
  d.draggable = false;
  d.addEventListener('dragstart', e => {
    dragSrc = d; d.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  d.addEventListener('dragend', () => {
    d.draggable = false; d.classList.remove('dragging');
    document.querySelectorAll('.task-chip').forEach(c => c.classList.remove('drag-over'));
  });
  d.addEventListener('dragover', e => {
    e.preventDefault(); e.stopPropagation();
    if (dragSrc && dragSrc !== d) d.classList.add('drag-over');
  });
  d.addEventListener('dragleave', () => d.classList.remove('drag-over'));
  d.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    d.classList.remove('drag-over');
    if (!dragSrc || dragSrc === d) return;
    const container = d.parentNode;
    const chips = [...container.querySelectorAll('.task-chip')];
    const srcIdx = chips.indexOf(dragSrc), tgtIdx = chips.indexOf(d);
    if (srcIdx < 0 || tgtIdx < 0) return;
    if (srcIdx < tgtIdx) container.insertBefore(dragSrc, d.nextSibling);
    else container.insertBefore(dragSrc, d);
    saveWeekOrder(container);
  });
  box.addEventListener('click', e => {
    e.stopPropagation(); d.classList.toggle('done');
    const obj = loadDone();
    if (d.classList.contains('done')) obj[key] = 1; else delete obj[key];
    saveDone(obj); updateProgress(d.closest('.week-row'));
  });
  return d;
}

function saveWeekOrder(container) {
  const weekLabel = container.closest('.week-row').dataset.weekLabel;
  const typeMap = {'협회':'h','용역사':'y','공동':'b'};
  const reordered = [...container.querySelectorAll('.task-chip')].map(el => ({
    who: el.querySelector('.who').textContent,
    type: typeMap[el.querySelector('.who').textContent] || 'h',
    text: el.querySelector('.task-text strong').textContent,
    date: el.querySelector('.date-tag')?.textContent || '',
    weekLabel, custom: true
  }));
  const others = loadCustom().filter(c => c.weekLabel !== weekLabel);
  saveCustom([...others, ...reordered]);
}

function updateProgress(row) {
  if (!row) return;
  const chips = [...row.querySelectorAll('.task-chip')];
  const total = chips.length, doneN = chips.filter(c => c.classList.contains('done')).length;
  const pct = total ? Math.round(doneN / total * 100) : 0;
  const cnt = row.querySelector('.done-count');
  if (cnt) { cnt.firstChild.textContent = `${doneN}/${total} 완료`; cnt.querySelector('.done-bar').style.width = pct + '%'; }
}

function deleteTask(t, chipEl) {
  if (!confirm('이 업무를 삭제할까요?')) return;
  const row = chipEl.closest('.week-row');
  chipEl.remove();
  saveWeekOrder(row.querySelector('.week-tasks'));
  updateProgress(row);
}

// ══════════════════════════════════════════════════
//  주차 행 빌더
// ══════════════════════════════════════════════════
function buildWeekRow(w) {
  const row = document.createElement('div'); row.className = 'week-row';
  row.dataset.weekLabel = w.label;
  const lbl = document.createElement('div'); lbl.className = 'week-label';
  lbl.innerHTML = `<div class="wk-num">${w.label}</div><div class="wk-range">${w.range}</div>`;
  const tasks = document.createElement('div'); tasks.className = 'week-tasks';

  if (w.wlic) {
    const n = document.createElement('div'); n.className = 'wlic-notice';
    n.innerHTML = '<span>⚠️</span><span><strong>WLIC 기간 (8/11~8/17)</strong> — 주요 업무 배제 주간</span>';
    tasks.appendChild(n);
  } else {
    const tasksToRender = loadCustom().filter(c => c.weekLabel === w.label);

    if (tasksToRender.length > 0) {
      const cnt = document.createElement('div'); cnt.className = 'done-count';
      cnt.innerHTML = `<span>0/${tasksToRender.length} 완료</span><div class="done-bar-wrap"><div class="done-bar" style="width:0%"></div></div>`;
      lbl.appendChild(cnt);
      tasksToRender.forEach(t => tasks.appendChild(buildTaskChip(t)));
    } else {
      const e = document.createElement('div');
      e.style.cssText = 'color:#94A3B8;font-size:.78rem;padding:5px 4px;';
      e.textContent = '해당 주차 예정 업무 없음';
      tasks.appendChild(e);
    }

    const addBtn = document.createElement('button'); addBtn.className = 'add-here-btn'; addBtn.textContent = '+ 여기에 업무 추가';
    addBtn.addEventListener('click', () => openModal(w.label));
    tasks.appendChild(addBtn);
  }

  if (!w.label || !w.range) return document.createDocumentFragment();
  row.appendChild(lbl); row.appendChild(tasks);
  updateProgress(row);
  return row;
}

// ══════════════════════════════════════════════════
//  메인 렌더 (월별 접기/펼치기 + localStorage 상태 유지)
// ══════════════════════════════════════════════════
const COLLAPSE_KEY = 'lib63_collapse'; // localStorage 키

function getCollapseState() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch { return {}; }
}
function setCollapseState(badge, isOpen) {
  const state = getCollapseState();
  state[badge] = isOpen;
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
}

function render() {
  const main = document.getElementById('main'); main.innerHTML = '';
  const collapseState = getCollapseState();

  data.forEach(m => {
    const sec = document.createElement('div'); sec.className = 'month-section';

    // 저장된 상태 불러오기 (기본값: 펼침=true)
    const isOpen = collapseState[m.badge] !== false;

    const title = document.createElement('div'); title.className = 'month-title';
    title.innerHTML = `<span class="mo-badge">${m.badge}</span><span>${m.month}</span><span class="mo-desc">${m.desc}</span><button class="collapse-btn" aria-expanded="${isOpen}" title="접기/펼치기">${isOpen ? '▲' : '▼'}</button>`;
    sec.appendChild(title);

    // ── 접기/펼치기 이벤트 ──
    title.querySelector('.collapse-btn').addEventListener('click', function() {
      const nowOpen = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!nowOpen));
      this.textContent = nowOpen ? '▼' : '▲';
      const content = sec.querySelector('.week-grid, .event-table');
      if (content) content.style.display = nowOpen ? 'none' : '';
      setCollapseState(m.badge, !nowOpen); // localStorage에 저장
    });

    if (m.special === 'event') {
      const tbl = document.createElement('table'); tbl.className = 'event-table';
      tbl.innerHTML = '<thead><tr><th style="width:120px">날짜</th><th>주요 행사</th></tr></thead>';
      const tbody = document.createElement('tbody');
      m.event.forEach(e => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="event-date">${e.date}</td><td>${e.desc}</td>`; tbody.appendChild(tr); });
      tbl.appendChild(tbody); sec.appendChild(tbl);
      if (!isOpen) tbl.style.display = 'none'; // 저장된 상태 즉시 반영
    } else if (m.weeks) {
      const grid = document.createElement('div'); grid.className = 'week-grid';
      m.weeks.forEach(w => grid.appendChild(buildWeekRow(w)));
      sec.appendChild(grid);
      if (!isOpen) grid.style.display = 'none'; // 저장된 상태 즉시 반영
    }
    main.appendChild(sec);
  });
}

// ══════════════════════════════════════════════════
//  필터
// ══════════════════════════════════════════════════
function applyFilter() {
  const activeBtn = document.querySelector('.filter-btn.active');
  const f = activeBtn ? activeBtn.dataset.f : 'all';
  document.querySelectorAll('.task-chip').forEach(chip => {
    chip.classList.toggle('hidden', f !== 'all' && chip.dataset.type !== f);
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  });
});

// ══════════════════════════════════════════════════
//  모달
// ══════════════════════════════════════════════════
let selectedType = 'h';
let dragSrc = null;
let editingTask = null;
let editingChip = null;

function selectType(btn, type) {
  selectedType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
  btn.classList.add('sel-' + type);
}

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => selectType(btn, btn.dataset.type));
});

function openModal(weekLabel = '') {
  editingTask = null; editingChip = null;
  document.querySelector('.modal-header h3').textContent = '✏️ 업무 추가';
  document.getElementById('modalSave').textContent = '추가하기';
  const sel = document.getElementById('formWeek'); sel.innerHTML = '';
  getAllWeeks().forEach(w => {
    const opt = document.createElement('option'); opt.value = w.weekLabel;
    opt.textContent = `${w.label}  (${w.range})`;
    if (w.weekLabel === weekLabel) opt.selected = true;
    sel.appendChild(opt);
  });
  document.getElementById('formText').value = '';
  document.getElementById('formDate').value = '';
  document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
  document.querySelector('.type-btn[data-type="h"]').classList.add('sel-h');
  selectedType = 'h';
  document.getElementById('modalOverlay').classList.add('open');
}

function openEditModal(t, chipEl) {
  editingTask = t; editingChip = chipEl;
  document.querySelector('.modal-header h3').textContent = '✎ 업무 수정';
  document.getElementById('modalSave').textContent = '저장하기';
  const sel = document.getElementById('formWeek'); sel.innerHTML = '';
  getAllWeeks().forEach(w => {
    const opt = document.createElement('option'); opt.value = w.weekLabel;
    opt.textContent = `${w.label}  (${w.range})`;
    if (w.weekLabel === t.weekLabel) opt.selected = true;
    sel.appendChild(opt);
  });
  document.getElementById('formText').value = t.text;
  document.getElementById('formDate').value = t.date || '';
  document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
  document.querySelector(`.type-btn[data-type="${t.type}"]`).classList.add('sel-' + t.type);
  selectedType = t.type;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

document.getElementById('openModalBtn').addEventListener('click', () => openModal());
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('modalSave').addEventListener('click', () => {
  const text = document.getElementById('formText').value.trim();
  if (!text) { document.getElementById('formText').focus(); return; }
  const weekLabel = document.getElementById('formWeek').value;
  const date = document.getElementById('formDate').value.trim();
  const whoMap = {h:'협회', y:'용역사', b:'공동'};

  if (editingTask && editingChip) {
    const oldKey = taskKey(editingTask);
    const updatedTask = {...editingTask, who:whoMap[selectedType], type:selectedType, text, date, weekLabel};
    let customs = loadCustom();
    const idx = customs.findIndex(c => c.who === editingTask.who && c.text === editingTask.text && c.weekLabel === editingTask.weekLabel);
    if (idx >= 0) customs[idx] = updatedTask;
    saveCustom(customs);
    const doneObj = loadDone();
    if (doneObj[oldKey]) { delete doneObj[oldKey]; doneObj[taskKey(updatedTask)] = 1; saveDone(doneObj); }
  } else {
    const newTask = {who:whoMap[selectedType], type:selectedType, text, date, weekLabel, custom:true};
    const customs = loadCustom(); customs.push(newTask); saveCustom(customs);
  }
  closeModal();
});

// ══════════════════════════════════════════════════
//  달력
// ══════════════════════════════════════════════════
const MONTHS = [
  {num:3,label:'3월'},{num:4,label:'4월'},{num:5,label:'5월'},{num:6,label:'6월'},{num:7,label:'7월'},
  {num:8,label:'8월'},{num:9,label:'9월'},{num:10,label:'10월'},{num:11,label:'11월'},{num:12,label:'12월'},
];

function monthCoversNum(m, n) {
  const s = m.month + ' ' + (m.badge || '');
  if (n === 10 && m.special === 'event') return true;
  if (n === 8 && (m.badge === '8/1W' || m.badge === '8/3·4W')) return true;
  if (n === 11 && (s.includes('11') || s.includes('11·12'))) return true;
  if (n === 12 && (s.includes('12') || s.includes('11·12'))) return true;
  return s.includes(n + '월') || s.includes(n + 'M');
}

function getTasksForMonth(n) {
  const res = [];
  data.forEach(m => {
    if (!monthCoversNum(m, n)) return;
    if (m.special === 'event' && n === 10)
      m.event.forEach(e => res.push({who:'행사', type:'k', text:e.date+' '+e.desc, date:'', week:'대회당일'}));
  });
  const weeks = (data.filter(m => monthCoversNum(m, n)) || []).flatMap(m => (m.weeks || []).map(w => w.label));
  loadCustom().filter(c => weeks.includes(c.weekLabel)).forEach(c => res.push({...c, week:c.weekLabel}));
  return res;
}

function getMonthDots(n) { return [...new Set(getTasksForMonth(n).map(t => t.type))].slice(0, 5); }

function renderCalendar() {
  const grid = document.getElementById('calGrid'); grid.innerHTML = '';
  MONTHS.forEach(mo => {
    const tasks = getTasksForMonth(mo.num), dots = getMonthDots(mo.num);
    const btn = document.createElement('button'); btn.className = 'cal-month-btn'; btn.dataset.month = mo.num;
    btn.innerHTML = `<span class="cm-num">${mo.num}</span><span class="cm-label">${mo.label}</span><div class="cm-dot-row">${dots.map(d => `<span class="cm-dot ${d}"></span>`).join('')}</div><span class="cm-count">${tasks.length}건</span>`;
    btn.addEventListener('click', () => openCalPanel(mo, tasks, btn));
    grid.appendChild(btn);
  });
}

let activePanelBtn = null;

// 1번: 월별 빠른 탐색 패널 — 주차 순서 정렬 + 그룹핑
function openCalPanel(mo, tasks, btn) {
  const panel = document.getElementById('calPanel'), title = document.getElementById('calPanelTitle'), body = document.getElementById('calPanelBody');
  if (activePanelBtn === btn && panel.classList.contains('open')) { closeCalPanel(); return; }
  document.querySelectorAll('.cal-month-btn').forEach(b => b.classList.remove('active-month'));
  btn.classList.add('active-month'); activePanelBtn = btn;
  title.textContent = `${mo.label} 업무 목록 (${tasks.length}건)`;
  body.innerHTML = '';
  if (!tasks.length) {
    body.innerHTML = '<div class="cal-empty">해당 월 업무 없음</div>';
  } else {
    // data[]에서 주차 순서 추출
    const weekOrder = [];
    data.forEach(m => { if (m.weeks) m.weeks.forEach(w => { if (!weekOrder.includes(w.label)) weekOrder.push(w.label); }); });
    // 주차 순서대로 정렬
    const sorted = [...tasks].sort((a, b) => {
      const ai = weekOrder.indexOf(a.week), bi = weekOrder.indexOf(b.week);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    // 주차별 그룹핑
    const groups = {};
    sorted.forEach(t => { (groups[t.week] = groups[t.week] || []).push(t); });
    Object.entries(groups).forEach(([weekLabel, items]) => {
      const hdr = document.createElement('div');
      hdr.className = 'cal-week-header';
      hdr.textContent = weekLabel;
      body.appendChild(hdr);
      items.forEach(t => {
        const row = document.createElement('div'); row.className = `cal-task-row ${t.type}`;
        row.innerHTML = `<span class="ct-who">${t.who}</span><span class="ct-week">${t.week}</span><span class="ct-text"><strong>${t.text}</strong></span>${t.date ? `<span class="ct-date">${t.date}</span>` : ''}`;
        body.appendChild(row);
      });
    });
  }
  panel.classList.add('open');
  setTimeout(() => panel.scrollIntoView({behavior:'smooth', block:'nearest'}), 50);
}

function closeCalPanel() {
  document.getElementById('calPanel').classList.remove('open');
  document.querySelectorAll('.cal-month-btn').forEach(b => b.classList.remove('active-month'));
  activePanelBtn = null;
}
document.getElementById('calPanelClose').addEventListener('click', closeCalPanel);

// ══════════════════════════════════════════════════
//  진행중 업무 섹션
// ══════════════════════════════════════════════════
function renderInProgress() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const YEAR = today.getFullYear(); // 실제 현재 연도 사용 (2026)
  const inProgress = [];

  // "6/12(목)" → Date 객체, 연도는 YEAR 사용
  function parseKorDate(str) {
    if (!str) return null;
    const m = str.match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    return new Date(YEAR, parseInt(m[1]) - 1, parseInt(m[2]));
  }

  loadCustom().forEach(t => {
    if (!t.date) return;

    // "~6/18(수)" → ['', '6/18(수)']
    // "6/8(월)~12/31(목)" → ['6/8(월)', '12/31(목)']
    // "6/12(목)" → ['6/12(목)']  단일 날짜
    const raw = t.date.trim();
    let start, end;

    if (raw.startsWith('~')) {
      // "~6/18" 형태: 마감일까지 진행중 → 시작일은 아주 과거로
      start = new Date(YEAR, 0, 1);
      end   = parseKorDate(raw.slice(1));
    } else if (raw.includes('~')) {
      const parts = raw.split('~');
      start = parseKorDate(parts[0]);
      end   = parseKorDate(parts[1]) || start;
    } else {
      // 단일 날짜
      start = parseKorDate(raw);
      end   = start;
    }

    if (!start || !end) return;
    if (loadDone()[taskKey(t)]) return; // 완료 제외
    if (start <= today && today <= end) inProgress.push(t);
  });

  const sec  = document.getElementById('inProgressSection');
  const body = document.getElementById('inProgressBody');
  const cnt  = document.getElementById('inProgressCount');
  if (!sec) return;

  body.innerHTML = '';
  if (!inProgress.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  cnt.textContent = `${inProgress.length}건`;

  inProgress.forEach(t => {
    const row = document.createElement('div');
    row.className = `cal-task-row ${t.type}`;
    row.innerHTML = `<span class="ct-who">${t.who}</span><span class="ct-week">${t.weekLabel}</span><span class="ct-text"><strong>${t.text}</strong></span>${t.date ? `<span class="ct-date">${t.date}</span>` : ''}`;
    body.appendChild(row);
  });
}
