// ───────── 🏛 한수원 양식 문서 — 사업계획서 · 교부신청서 · 결과보고서(사업추진실적 및 정산보고서) ─────────
//  숫자는 전부 시스템에서: 세출(ExpBG 대분류·중분류·산출근거) = 계획 / 구매·지출 = 실제 집행 / 영수증·사진 = 구매 증빙
//  글(목적·효과·성과 등)과 단체 정보는 DB 에만: /main/HsDoc/_org (단체 공통) · /main/HsDoc/{행사} (그 사업)
//  ※ 공개 코드라 이름·전화번호 같은 개인정보는 여기 쓰지 말 것
var HS = { k: "", d: null, org: null, busy: false };
var HS_ORG_F = [["nm", "단체명"], ["bizNo", "고유번호"], ["ceo", "대표자"], ["tel", "전화"], ["fax", "FAX"], ["email", "E-mail"], ["zip", "우편번호"], ["addr", "주소"], ["bank", "예금계좌 (교부신청서)"], ["mgrPos", "실무책임자 직위 (결과보고서)"], ["mgrNm", "실무책임자 성명"], ["mgrTel", "실무책임자 연락처"]];
var HS_INFO_F = [["bizNm", "사업명", "예) 2027. 법성포청년회 하계방역"], ["kind", "사업종류", "예) 지역복지사업"], ["place", "사업장소", "예) 법성면 일대"], ["target", "수혜대상", "예) 법성면민"], ["from", "사업 시작일", "", "date"], ["to", "사업 끝나는 날", "", "date"], ["days", "사업 일수", "비우면 날짜로 자동 (예: 130)"], ["gubun", "시행구분", "계속 / 신규"], ["how", "시행방법", "직접 / 위탁"], ["chNm", "담당자 성명 (신청서)"], ["chPos", "담당자 직위"]];
var HS_PLAN_F = [["purpose", "1. 사업 목적"], ["supTgt", "□ 지원 대상"], ["supDet", "□ 지원 내역 · 사업 내용"], ["env", "4. 사업 환경"], ["effect", "5. 사업 효과"], ["sched", "6. 사업 추진 일정 — 한 줄에 「일정 | 항목 | 추진 내용 | 비고」"]];
var HS_RES_F = [["planTxt", "계획 대비 실적 — 실행계획"], ["doneTxt", "계획 대비 실적 — 추진실적"], ["doneNote", "계획 대비 실적 — 비고 (차이 나는 사유)"], ["rPurpose", "② 사업목적 (비우면 사업계획서 목적)"], ["rContent", "③ 사업내용"], ["achieve", "④ 사업추진 성과"], ["selfEval", "⑤ 사업추진 성과에 대한 자체평가"], ["sugg", "⑥ 개선 및 건의사항"], ["remWhy", "집행잔액 발생사유 — 한 줄에 「항목: 사유」"], ["chgWhy", "변경 사유 — 한 줄에 「항목: 사유」 (비우면 「○○ 잔액 / 추가」)"]];

function _hsKey(){ return (typeof _rgEvtKey === "function") ? _rgEvtKey() : String((CUR_EVT && CUR_EVT.evtId) || "_"); }
function _hsLoad(){
  var k = _hsKey();
  if(HS.k === k && HS.d) return Promise.resolve();
  HS.k = k; HS.d = null;
  return Promise.all([fbDb.ref('/main/HsDoc/' + k).once('value'), fbDb.ref('/main/HsDoc/_org').once('value')]).then(function(r){ if(HS.k !== k) return; HS.d = r[0].val() || {}; HS.org = r[1].val() || {}; });
}
function _hsV(sec, f){ var o = sec === "org" ? (HS.org || {}) : ((HS.d || {})[sec] || {}); return o[f] == null ? "" : String(o[f]); }
function _hsYr(){ var f = _hsV("info", "from"); return (f && f.slice(0, 4)) || String((CUR_EVT && CUR_EVT.yr) || new Date().getFullYear()); }
function _hsBizNm(){ return _hsV("info", "bizNm") || (_hsYr() + ". " + (_hsV("org", "nm") || "") + " " + ((CUR_EVT && CUR_EVT.nm) || "")).trim(); }

// ── 재원: 대분류마다 지원금(sup) / 자부담(self). 안 고르면 이름에 「자부담」 있으면 자부담
function _hsTps(){ var L = []; (expBG || []).forEach(function(r){ if(r.tp && L.indexOf(r.tp) < 0) L.push(r.tp); }); return L; }
function _hsFund(tp){ var F = (HS.d || {}).fund || {}, m = F[tp] || F[String(tp || "").replace(/[.#$\[\]\/]/g, "_")]; if(m === "sup" || m === "self") return m; return /자부담/.test(tp || "") ? "self" : "sup"; }
// 계획 (세출)
function _hsBud(){
  var big = { sup: 0, self: 0 }, mids = { sup: 0, self: 0 }, items = [], ix = {};
  (expBG || []).forEach(function(r){
    var f = _hsFund(r.tp), am = pn(r.planAm);
    if(!r.mid){ big[f] += am; return; }
    var it = ix[r.mid]; if(!it){ it = ix[r.mid] = { nm: r.mid, sup: 0, self: 0, note: [] }; items.push(it); }
    it[f] += am; mids[f] += am; if(r.note && it.note.indexOf(r.note) < 0) it.note.push(r.note);
  });
  var sup = big.sup || mids.sup, self = big.self || mids.self;
  return { sup: sup, self: self, tot: sup + self, items: items };
}
// 실제 집행 (구매·지출) — 재원은 구매에 고른 세입 대분류가 먼저, 없으면 세출 대분류의 재원
function _hsExec(){
  return _rgExpRows().map(function(r){
    var s = String(r.src || ""); r.f = s ? (/자부담|회비|자체/.test(s) ? "self" : (/지원|보조|한수원/.test(s) ? "sup" : _hsFund(r.tp))) : _hsFund(r.tp);
    return r;
  });
}
function _hsPlanOf(B, nm, f){ var it = B.items.filter(function(x){ return x.nm === nm; })[0]; return it ? it[f] : 0; }

// ── 공통 모양 ──
var HS_T = 'border:1px solid #000;padding:4px 6px;';
var HS_C = HS_T + 'text-align:center;', HS_N = HS_T + 'text-align:right;white-space:nowrap;', HS_H = HS_T + 'text-align:center;background:#e8edf3;font-weight:700;';
function _hsK(am){ return fm(Math.round(pn(am) / 1000)); }   // 천원
function _hsW(am){ return fm(pn(am)); }
function _hsPc(a, b){ return b ? (Math.round(a / b * 1000) / 10) : 0; }
function _hsTx(t){ return esc(t || "").replace(/\n/g, "<br>"); }
function _hsDt(d){ if(!d) return ""; var p = String(d).slice(0, 10).split("-"); return p[0] + ". " + (+p[1]) + ". " + (+p[2]) + "."; }
function _hsMd(d){ if(!d) return ""; var p = String(d).slice(0, 10).split("-"); return (+p[1]) + "." + (+p[2]); }
function _hsYmd(d){ if(!d) return '&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일'; var p = String(d).slice(0, 10).split("-"); return p[0] + " 년 &nbsp;" + (+p[1]) + " 월 &nbsp;" + (+p[2]) + " 일"; }
function _hsDays(){ var dd = pn(_hsV("info", "days")); if(dd) return dd; var a = _hsV("info", "from"), b = _hsV("info", "to"); if(!a || !b) return 0; return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5) + 1; }
function _hsPeriod(){ var a = _hsV("info", "from"), b = _hsV("info", "to"); return a || b ? _hsDt(a) + " ~ " + _hsDt(b) + (_hsDays() ? " (" + _hsDays() + "일)" : "") : ""; }
function _hsSp(s){ return String(s || "").split("").join(" "); }
function _hsPg(inner, st){ return '<div class="pg" style="font-family:\'바탕\',Batang,serif;font-size:13.5px;line-height:1.65;color:#000;' + (st || '') + '">' + inner + '</div>'; }
function _hsTbl(){ return '<table style="border-collapse:collapse;width:100%;margin:4px 0 10px;font-size:12.5px;font-family:\'맑은 고딕\',\'Malgun Gothic\',sans-serif">'; }
function _hsTh(cols){ return '<tr>' + cols.map(function(c){ return '<td style="' + HS_H + (c[1] ? 'width:' + c[1] + ';' : '') + '"' + (c[2] ? ' rowspan="' + c[2] + '"' : '') + (c[3] ? ' colspan="' + c[3] + '"' : '') + '>' + c[0] + '</td>'; }).join('') + '</tr>'; }
function _hsSec(t){ return '<div style="font-size:15px;font-weight:800;margin:12px 0 4px">' + t + '</div>'; }
function _hsUnit(t, u){ return '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px"><b>' + t + '</b><span style="font-size:12px">(' + (u || '단위 : 원') + ')</span></div>'; }
function _hsBody(t, ph){ var s = (t || "").trim(); return s ? '<div style="margin:2px 0 8px 10px">' + _hsTx(s) + '</div>' : '<div style="margin:2px 0 8px 10px;color:#94a3b8">' + (ph || '(✏ 내용 적기에서 적어 주세요)') + '</div>'; }
function _hsBig(n, t){ return '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px"><span style="background:#1e3a5f;color:#fff;font-weight:800;font-size:18px;padding:2px 12px">' + n + '</span><span style="font-size:19px;font-weight:800;border-bottom:2px solid #1e3a5f;flex:1;padding-bottom:2px">' + t + '</span></div>'; }
function _hsLines(t){ return String(t || "").split("\n").map(function(s){ return s.trim(); }).filter(Boolean); }
function _hsMap(t){ var o = {}; _hsLines(t).forEach(function(l){ var i = l.search(/[:：]/); if(i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); return o; }

// ═════════ 1) 사업신청서 + 사업계획서 ═════════
function _hsPlanHtml(){
  var B = _hsBud(), O = function(f){ return esc(_hsV("org", f)); }, I = function(f){ return esc(_hsV("info", f)); }, yr = _hsYr();
  var from = _hsV("info", "from"), to = _hsV("info", "to"), sm = from ? (+from.slice(5, 7)) : "";
  var org = function(lb){ return '<tr><td style="' + HS_H + '" rowspan="4">' + lb + '</td><td style="' + HS_H + '">기관(단체)명</td><td style="' + HS_T + '">' + O("nm") + '</td><td style="' + HS_H + '">고유번호</td><td style="' + HS_T + '">' + O("bizNo") + '</td></tr>'
    + '<tr><td style="' + HS_H + '">전 화</td><td style="' + HS_T + '">' + O("tel") + '</td><td style="' + HS_H + '">FAX</td><td style="' + HS_T + '">' + O("fax") + '</td></tr>'
    + '<tr><td style="' + HS_H + '">E-mail</td><td style="' + HS_T + '" colspan="3">' + O("email") + '</td></tr>'
    + '<tr><td style="' + HS_H + '">주 소</td><td style="' + HS_T + '" colspan="3">' + (O("zip") ? '(우' + O("zip") + ') ' : '') + O("addr") + '</td></tr>'; };
  var p1 = '<div style="text-align:center;font-size:26px;font-weight:800;letter-spacing:10px;margin:4mm 0 6mm">사 업 신 청 서</div>'
    + _hsTbl() + org("신청<br>기관<br>(단체)") + org("시행<br>기관<br>(단체)")
    + '<tr><td style="' + HS_H + '" rowspan="4">신청<br>사업</td><td style="' + HS_H + '">사업종류</td><td style="' + HS_T + '">' + I("kind") + '</td><td style="' + HS_H + '">사업장소</td><td style="' + HS_T + '">' + I("place") + '</td></tr>'
    + '<tr><td style="' + HS_H + '">사 업 명</td><td style="' + HS_T + '">' + esc(_hsBizNm()) + '</td><td style="' + HS_H + '">수혜대상</td><td style="' + HS_T + '">' + I("target") + '</td></tr>'
    + '<tr><td style="' + HS_H + '">사업 총기간</td><td style="' + HS_T + '">' + (from || to ? _hsDt(from) + ' ~ ' + _hsDt(to) : '') + '</td><td style="' + HS_H + '">사업시작시기(월)</td><td style="' + HS_T + '">' + (from ? from.slice(0, 4) + '년 ' + sm + '월' : '') + '</td></tr>'
    + '<tr><td style="' + HS_H + '">사업비<br>(천원)</td><td style="' + HS_T + ';padding:0" colspan="3"><table style="border-collapse:collapse;width:100%">' + _hsTh([["총 사업비"], ["사업자<br>지원사업비"], ["국비"], ["지방비"], ["자부담"]])
    + '<tr><td style="' + HS_N + 'text-align:center">' + _hsK(B.tot) + '</td><td style="' + HS_N + 'text-align:center">' + _hsK(B.sup) + '</td><td style="' + HS_C + '"></td><td style="' + HS_C + '"></td><td style="' + HS_N + 'text-align:center">' + (B.self ? _hsK(B.self) : '') + '</td></tr></table></td></tr>'
    + '<tr><td style="' + HS_H + '">담당자</td><td style="' + HS_H + '">성 명</td><td style="' + HS_T + '">' + I("chNm") + '</td><td style="' + HS_H + '">직 위</td><td style="' + HS_T + '">' + I("chPos") + '</td></tr></table>'
    + '<div style="margin:8mm 0 4mm;text-align:center;font-size:15px">위와 같이 ' + yr + '년도 한수원지원사업에 대한 사업신청서를 제출합니다.</div>'
    + '<div style="text-align:center;font-size:15px;margin-bottom:6mm">' + _hsYmd(_hsV("plan", "dt")) + '</div>'
    + '<div style="margin-left:45%;font-size:15px;line-height:2">기관(단체)명 : ' + O("nm") + '<br>대 &nbsp;표 &nbsp;자 : ' + esc(_hsSp(_hsV("org", "ceo"))) + ' &nbsp;(직인)</div>'
    + '<div style="font-size:18px;font-weight:800;margin:10mm 0 6mm">한국수력원자력(주) 사장 귀하</div>'
    + '<div style="font-size:13px">※ 붙임 &nbsp;1. 신청기관(단체)개요 1부 &nbsp;&nbsp;2. 사업계획서 1부 &nbsp;&nbsp;3. 서약서 1부</div>';
  var P = (HS.d || {}).plan || {};
  var it = '';
  B.items.forEach(function(x){ it += '<tr><td style="' + HS_C + '">' + esc(x.nm) + '</td><td style="' + HS_N + '">' + _hsK(x.sup + x.self) + '</td><td style="' + HS_N + '">' + (x.sup ? _hsK(x.sup) : '') + '</td><td style="' + HS_N + '">' + (x.self ? _hsK(x.self) : '') + '</td><td style="' + HS_T + 'font-size:11.5px">' + _hsTx(x.note.join("\n").replace(/ \/ /g, "\n")) + '</td></tr>'; });
  var sc = _hsLines(P.sched).map(function(l){ var c = l.split("|").map(function(s){ return s.trim(); }); return '<tr><td style="' + HS_C + '">' + esc(c[0] || "") + '</td><td style="' + HS_C + '">' + esc(c[1] || "") + '</td><td style="' + HS_T + '">' + esc(c[2] || "") + '</td><td style="' + HS_C + '">' + esc(c[3] || "") + '</td></tr>'; }).join('');
  var p2 = '<div style="text-align:center;font-size:24px;font-weight:800;letter-spacing:8px;margin:2mm 0 5mm">사 업 계 획 서</div>'
    + _hsTbl() + '<tr><td style="' + HS_H + 'width:18%">사 업 명</td><td style="' + HS_T + 'font-weight:700">' + esc(_hsBizNm()) + '</td></tr></table>'
    + _hsSec("1. 사업 목적") + _hsBody(P.purpose)
    + _hsSec("2. 사업 내용") + '<b>□ 시행 개요</b>' + _hsTbl() + _hsTh([["사업장소"], ["사업기간"], ["시행구분"], ["시행방법"], ["시행자"]])
    + '<tr><td style="' + HS_C + '">' + I("place") + '</td><td style="' + HS_C + '">' + (from || to ? _hsDt(from) + ' ~ ' + _hsDt(to) : '') + '</td><td style="' + HS_C + '">' + I("gubun") + '</td><td style="' + HS_C + '">' + I("how") + '</td><td style="' + HS_C + '">' + O("nm") + '</td></tr></table>'
    + _hsUnit("□ 사업 예산", "금액 : 천원") + _hsTbl() + _hsTh([["총사업비"], ["한수원지원사업비"], ["자부담"]]) + '<tr><td style="' + HS_C + '">' + _hsK(B.tot) + '</td><td style="' + HS_C + '">' + _hsK(B.sup) + '</td><td style="' + HS_C + '">' + _hsK(B.self) + '</td></tr></table>'
    + '<div style="font-size:11.5px">※ 자부담은 한수원지원사업비를 제외한 민자/시행자 부담금, 기금지원사업, 국비/지방비 포함</div>'
    + '<div style="margin-top:6px"><b>□ 지원 대상 :</b> ' + _hsTx(P.supTgt || _hsV("info", "target")) + '</div>'
    + '<div style="margin-top:4px"><b>□ 지원 내역</b></div>' + _hsBody(P.supDet)
    + _hsSec("3. 사업비 내역") + _hsUnit("□ 재원조달 및 방안", "금액 : 천원") + _hsTbl() + _hsTh([["구 분", "34%"], ["금액 (천원)"], ["비율"]])
    + [["한수원지원사업비", B.sup], ["국비/지방비", 0], ["민자/자부담", B.self], ["기금지원사업", 0]].map(function(r){ return '<tr><td style="' + HS_C + '">' + r[0] + '</td><td style="' + HS_N + '">' + (r[1] ? _hsK(r[1]) : '') + '</td><td style="' + HS_C + '">' + _hsPc(r[1], B.tot) + '%</td></tr>'; }).join('')
    + '<tr style="font-weight:800"><td style="' + HS_C + '">총 사업비</td><td style="' + HS_N + '">' + _hsK(B.tot) + '</td><td style="' + HS_C + '">100%</td></tr></table>'
    + _hsUnit("□ 항목별 산출 내역", "금액 : 천원") + _hsTbl() + _hsTh([["항 목", "16%", 2], ["금 액", "", 0, 3], ["산출근거", "46%", 2]]) + _hsTh([["계", "11%"], ["한수원<br>지원사업비", "13%"], ["자부담", "11%"]])
    + it + '<tr style="font-weight:800"><td style="' + HS_C + '">합 계</td><td style="' + HS_N + '">' + _hsK(B.tot) + '</td><td style="' + HS_N + '">' + _hsK(B.sup) + '</td><td style="' + HS_N + '">' + (B.self ? _hsK(B.self) : '') + '</td><td style="' + HS_T + '"></td></tr></table>'
    + _hsSec("4. 사업 환경") + _hsBody(P.env)
    + _hsSec("5. 사업 효과") + _hsBody(P.effect)
    + _hsSec("6. 사업 추진 일정") + _hsTbl() + _hsTh([["일 정", "16%"], ["항 목", "18%"], ["추 진 내 용"], ["비 고", "12%"]]) + (sc || '<tr><td style="' + HS_C + 'color:#94a3b8" colspan="4">(✏ 내용 적기 › 추진 일정)</td></tr>') + '</table>'
    + '<div style="font-size:12px;margin-top:6px">※ 붙임 : 한수원지원사업 산출내역 증빙서류(견적서, 물가정보, 나라장터 등)</div>';
  return _hsPg(p1) + _hsPg(p2);
}

// ═════════ 2) 교부신청서 ═════════
function _hsGrantHtml(){
  var B = _hsBud(), G = (HS.d || {}).grant || {}, O = function(f){ return esc(_hsV("org", f)); };
  var prev = pn(G.prev), req = G.req === "" || G.req == null ? B.sup - prev : pn(G.req), rem = B.sup - prev - req;
  var it = B.items.map(function(x){ return '<tr><td style="' + HS_C + '">' + esc(x.nm) + '</td><td style="' + HS_N + '">' + _hsK(x.sup + x.self) + '</td><td style="' + HS_N + '">' + (x.sup ? _hsK(x.sup) : '') + '</td><td style="' + HS_C + '"></td><td style="' + HS_N + '">' + (x.self ? _hsK(x.self) : '') + '</td><td style="' + HS_T + 'font-size:11.5px">' + _hsTx(x.note.join("\n").replace(/ \/ /g, "\n")) + '</td></tr>'; }).join('');
  var dt = G.dt ? _hsDt(G.dt) : '&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;.';
  var h = '<div style="font-size:12px">[별지 제12호 서식]</div><div style="text-align:center;font-size:23px;font-weight:800;margin:4mm 0 7mm">한수원 사업자지원사업비 교부신청서</div>'
    + '<div style="font-size:15px;margin-bottom:6px"><b>1. 사업명 :</b> ' + esc(_hsBizNm()) + '</div>'
    + '<div style="font-size:15px"><b>2. 교부신청 금액 및 내역</b></div>'
    + _hsUnit("◦ 교부내역", "단위 : 천원") + _hsTbl() + _hsTh([["구 분", "12%"], ["사업자 지원 사업비 총액 (a)"], ["기 교부금액 (b)"], ["금회 교부 신청금액 (c)"], ["잔 액 (d=a-b-c)"], ["비 고", "11%"]])
    + '<tr><td style="' + HS_C + '">금액<br>(천원)</td><td style="' + HS_C + '">' + _hsK(B.sup) + '</td><td style="' + HS_C + '">' + (prev ? _hsK(prev) : '') + '</td><td style="' + HS_C + '">' + _hsK(req) + '</td><td style="' + HS_C + '">' + (rem ? _hsK(rem) : '') + '</td><td style="' + HS_C + '"></td></tr></table>'
    + _hsUnit("◦ 금회 신청금액", "단위 : 천원") + _hsTbl() + _hsTh([["항 목", "14%"], ["계", "10%"], ["사업자<br>지원 사업비", "12%"], ["지방비", "9%"], ["자 부 담", "10%"], ["산출기초"]])
    + '<tr style="font-weight:800"><td style="' + HS_C + '">계</td><td style="' + HS_N + '">' + _hsK(B.tot) + '</td><td style="' + HS_N + '">' + _hsK(B.sup) + '</td><td style="' + HS_C + '"></td><td style="' + HS_N + '">' + (B.self ? _hsK(B.self) : '') + '</td><td style="' + HS_T + '"></td></tr>' + it + '</table>'
    + '<div style="margin:9mm 0 5mm;font-size:15px;text-align:center">「한수원 사업자지원사업 업무처리지침」에 따라 사업자지원사업비를 위와 같이 신청합니다.</div>'
    + '<div style="text-align:center;font-size:15px;margin-bottom:8mm">' + dt + '</div>'
    + '<div style="margin-left:30%;font-size:15px;line-height:2.1">신청자 : 단 체 명 &nbsp;' + O("nm") + '<br><span style="padding-left:4.6em">대 표 자 &nbsp;' + esc(_hsSp(_hsV("org", "ceo"))) + ' &nbsp;(직인)</span><br><span style="padding-left:4.6em">소 재 지 &nbsp;' + O("addr") + '</span><br><span style="padding-left:4.6em">예금계좌 &nbsp;' + O("bank") + '</span></div>'
    + '<div style="font-size:13px;margin-top:10mm">※ 첨부서류 : 지급증빙서류(산출내역서 및 세무증빙 등)</div>';
  return _hsPg(h);
}

// ═════════ 3) 결과보고서 (사업추진실적 및 정산보고서) ═════════
function _hsResHtml(opt){
  opt = opt || {};
  var B = _hsBud(), X = _hsExec(), R = (HS.d || {}).result || {}, P = (HS.d || {}).plan || {}, O = function(f){ return esc(_hsV("org", f)); };
  var use = { sup: 0, self: 0 }; X.forEach(function(r){ use[r.f] += r.am; });
  var uT = use.sup + use.self, inter = pn(R.inter);
  // 표지
  var cv = '<div style="font-size:12px">[별지 제14-3호 서식]</div>'
    + '<div style="text-align:center;margin:30mm 0 6mm;font-size:22px;font-weight:700">한수원 사업자지원사업</div><div style="text-align:center;font-size:30px;font-weight:800;letter-spacing:2px">사업추진실적 및 정산보고서</div>'
    + '<div style="text-align:center;font-size:17px;margin:10mm 0 22mm">(사업명 : ' + esc(_hsBizNm()) + ')</div>'
    + '<div style="text-align:center;font-size:17px;margin-bottom:16mm">' + (R.dt ? _hsDt(R.dt) : '&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;.') + '</div>'
    + '<div style="margin-left:30%;font-size:16px;line-height:2">제출자 : 단체명 &nbsp;' + O("nm") + '<br><span style="padding-left:4.2em">대표자 &nbsp;' + esc(_hsSp(_hsV("org", "ceo"))) + ' &nbsp;(직인)</span></div>'
    + '<div style="margin-top:16mm;font-size:14px;line-height:2">❍ 실무책임자 : ' + O("mgrPos") + ' , 성명 ' + O("mgrNm") + '<br>❍ 연 &nbsp;락 &nbsp;처 : 전화 ' + O("mgrTel") + (O("fax") ? ' , FAX ' + O("fax") : '') + (O("email") ? ' , E-mail ' + O("email") : '') + '<br>❍ 주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소 : ' + (O("zip") ? '(우' + O("zip") + ') ' : '') + O("addr") + '</div>'
    + '<div style="margin-top:12mm;font-size:13.5px;border:1px solid #000;padding:8px 12px;line-height:1.9">※ 첨부서류<br>&nbsp;1. 지원사업 추진실적 1부 &nbsp;&nbsp;&nbsp;2. 자금집행 정산보고서 1부<br>&nbsp;3. 영수증·세금계산서 사본 각 1부 &nbsp;&nbsp;&nbsp;4. 행사유인물·사진 등 1부<br>&nbsp;5. 기타 각종 증빙자료 1부</div>';
  var sumT = function(sup, self, lbs){
    return _hsTbl() + _hsTh([["구 분", "13%", 2], ["예 산 액", "", 2], ["지 출 액", "", 0, 2], ["집행잔액", "", 2], ["이 자<br>발생액", "", 2], ["비 고", "", 2]]) + _hsTh([["금액"], ["비율"]])
      + [[lbs[0], B.tot, uT], [lbs[1], B.sup, use.sup], [lbs[2], B.self, use.self]].map(function(r, i){ var rm = r[1] - r[2]; return '<tr' + (i ? '' : ' style="font-weight:800"') + '><td style="' + HS_C + '">' + r[0] + '</td><td style="' + HS_N + '">' + _hsW(r[1]) + '</td><td style="' + HS_N + '">' + _hsW(r[2]) + '</td><td style="' + HS_C + '">' + (i ? _hsPc(r[2], uT) : 100) + '</td><td style="' + HS_N + '">' + (rm > 0 ? _hsW(rm) : 0) + '</td><td style="' + HS_N + '">' + (i === 1 ? _hsW(inter) : (i ? 0 : _hsW(inter))) + '</td><td style="' + HS_T + 'font-size:11px">' + (rm < 0 ? '초과 ' + _hsW(-rm) : '') + '</td></tr>'; }).join('') + '</table>';
  };
  // 1 사업 추진실적
  var p1 = _hsBig("1", "사업 추진실적")
    + _hsSec("1. 사업개요") + '<div style="line-height:1.9;margin-left:6px">□ 시 행 자 : ' + O("nm") + (O("ceo") ? ' (대표자 : ' + O("ceo") + ')' : '') + '<br>□ 사 업 명 : ' + esc(_hsBizNm()) + '<br>□ 사업장소 : ' + esc(_hsV("info", "place")) + '<br>□ 사업기간 : ' + _hsPeriod() + '</div>'
    + _hsUnit("□ 사 업 비", "단위 : 원, %") + sumT(0, 0, ["계", "사업자지원금", "자부담"])
    + _hsSec("2. 추진실적") + '<b>① 계획 대비 실적</b>' + _hsTbl() + _hsTh([["구 분", "15%"], ["실행계획"], ["추진실적"], ["비 고", "15%"]])
    + '<tr><td style="' + HS_C + '">' + esc((CUR_EVT && CUR_EVT.nm) || "") + '</td><td style="' + HS_T + '">' + _hsTx(R.planTxt) + '</td><td style="' + HS_T + '">' + _hsTx(R.doneTxt) + '</td><td style="' + HS_T + 'font-size:11.5px">' + _hsTx(R.doneNote) + '</td></tr></table>'
    + '<b>② 사업목적</b>' + _hsBody(R.rPurpose || P.purpose)
    + '<b>③ 사업내용</b>' + _hsBody(R.rContent || P.supDet)
    + '<b>④ 사업추진 성과</b>' + _hsBody(R.achieve)
    + '<b>⑤ 사업추진 성과에 대한 자체평가</b>' + _hsBody(R.selfEval) + '<div style="font-size:11px;margin:-4px 0 6px 10px">※ 사업추진결과 잘된 점, 부진한 점, 사업 추진상 문제점 및 애로사항, 향후 사업추진을 위한 자체 발전 방안 등</div>'
    + '<b>⑥ 개선 및 건의사항</b>' + _hsBody(R.sugg);
  // 2 자금집행 정산보고서
  var byItem = function(f){
    var L = X.filter(function(r){ return r.f === f; }), G = _rgGroup(L, function(r){ return r.sub && r.sub !== "-" ? r.sub : r.tp; });
    var names = B.items.filter(function(x){ return x[f]; }).map(function(x){ return x.nm; }); G.O.forEach(function(k){ if(names.indexOf(k) < 0) names.push(k); });
    var pT = 0, uS = 0, rows = '';
    names.forEach(function(nm){
      var g = G.G[nm] || { t: 0, list: [] }, pl = _hsPlanOf(B, nm, f), ds = g.list.map(function(r){ return r.dt; }).filter(Boolean).sort();
      pT += pl; uS += g.t;
      var dts = ds.length ? (ds[0].slice(0, 4) + '.<br>' + _hsMd(ds[0]) + (ds.length > 1 && ds[ds.length - 1] !== ds[0] ? '~<br>' + _hsMd(ds[ds.length - 1]) : '')) : '';
      var bas = _rgGroup(g.list, function(r){ return r.ds || "(내역 없음)"; }), bl = bas.O.map(function(k){ return esc(k) + (bas.G[k].n > 1 ? ' (' + bas.G[k].n + '건)' : ''); });
      rows += '<tr><td style="' + HS_C + '">' + esc(nm) + '</td><td style="' + HS_C + 'font-size:11px">' + dts + '</td><td style="' + HS_N + '">' + (pl ? _hsW(pl) : '-') + '</td><td style="' + HS_T + 'font-size:11px">' + (bl.slice(0, 6).join('<br>') + (bl.length > 6 ? '<br>외 ' + (bl.length - 6) + '가지' : '')) + '</td><td style="' + HS_N + '">' + _hsW(g.t) + '</td><td style="' + HS_N + '">' + _hsW(pl - g.t) + '</td></tr>';
    });
    if(!names.length) rows = '<tr><td style="' + HS_C + '" colspan="6">해당 없음</td></tr>';
    return _hsTbl() + _hsTh([["세부사업", "14%", 2], ["사업<br>일시", "10%", 2], ["당초집행<br>계획액", "13%", 2], ["실제 집행내역", "", 0, 2], ["잔 액", "12%", 2]]) + _hsTh([["산출기초"], ["집행액", "13%"]])
      + '<tr style="font-weight:800"><td style="' + HS_C + '" colspan="2">합 계</td><td style="' + HS_N + '">' + _hsW(B[f] || pT) + '</td><td style="' + HS_T + '"></td><td style="' + HS_N + '">' + _hsW(uS) + '</td><td style="' + HS_N + '">' + _hsW((B[f] || pT) - uS) + '</td></tr>' + rows + '</table>';
  };
  var detail = function(f){
    var L = X.filter(function(r){ return r.f === f; });
    if(!L.length) return _hsTbl() + '<tr><td style="' + HS_C + '">해당 없음</td></tr></table>';
    var t = 0;
    return _hsTbl() + _hsTh([["인출<br>일자", "8%"], ["인출액", "11%"], ["비목", "10%"], ["내 역"], ["지출<br>일자", "8%"], ["지출액", "11%"], ["지급처", "13%"], ["지출<br>번호", "6%"], ["지급<br>방법", "9%"]])
      + L.map(function(r, i){ t += r.am; return '<tr><td style="' + HS_C + '">' + _hsMd(r.dt) + '</td><td style="' + HS_N + '">' + _hsW(r.am) + '</td><td style="' + HS_C + 'font-size:11.5px">' + esc(r.sub && r.sub !== "-" ? r.sub : r.tp) + '</td><td style="' + HS_T + 'font-size:11.5px">' + esc(r.ds) + '</td><td style="' + HS_C + '">' + _hsMd(r.dt) + '</td><td style="' + HS_N + '">' + _hsW(r.am) + '</td><td style="' + HS_C + 'font-size:11.5px">' + esc(r.vendor) + '</td><td style="' + HS_C + '">' + (i + 1) + '</td><td style="' + HS_C + 'font-size:11px">' + esc(r.payM || r.pay || "") + '</td></tr>'; }).join('')
      + '<tr style="font-weight:800"><td style="' + HS_C + '">계</td><td style="' + HS_N + '">' + _hsW(t) + '</td><td style="' + HS_T + '" colspan="3"></td><td style="' + HS_N + '">' + _hsW(t) + '</td><td style="' + HS_T + '" colspan="3"></td></tr></table>';
  };
  var rmW = _hsMap(R.remWhy), rmRows = '';
  B.items.forEach(function(x){ if(!x.sup) return; var u = 0; X.forEach(function(r){ if(r.f === "sup" && (r.sub === x.nm || (r.sub === "-" && r.tp === x.nm))) u += r.am; }); var rm = x.sup - u; if(rm > 0) rmRows += '<tr><td style="' + HS_C + '">' + esc(x.nm) + '</td><td style="' + HS_C + '">' + esc(x.nm) + '</td><td style="' + HS_N + '">' + _hsW(x.sup) + '</td><td style="' + HS_N + '">' + _hsW(u) + '</td><td style="' + HS_N + '">' + _hsW(rm) + '</td><td style="' + HS_T + '">' + esc(rmW[x.nm] || "") + '</td></tr>'; });
  var chW = _hsMap(R.chgWhy), chRows = '', allN = B.items.map(function(x){ return x.nm; });
  X.forEach(function(r){ var k = r.sub && r.sub !== "-" ? r.sub : r.tp; if(allN.indexOf(k) < 0) allN.push(k); });
  allN.forEach(function(nm){ ["sup", "self"].forEach(function(f){ var pl = _hsPlanOf(B, nm, f), u = 0; X.forEach(function(r){ if(r.f === f && ((r.sub && r.sub !== "-" ? r.sub : r.tp) === nm)) u += r.am; }); if(pl === u || (!pl && !u)) return; if(f === "sup" && u < pl) return;   // 지원금 남은 건 위 잔액 표에
    chRows += '<tr><td style="' + HS_C + '">' + esc(_hsBizNm()) + '</td><td style="' + HS_C + '">' + esc(nm) + (f === "self" ? '<br><span style="font-size:10.5px">(자부담)</span>' : '') + '</td><td style="' + HS_N + '">' + _hsW(pl) + '</td><td style="' + HS_N + '">' + _hsW(u) + '</td><td style="' + HS_T + '">' + esc(chW[nm] || (u > pl ? nm + " 추가금액" : nm + " 잔액")) + '</td><td style="' + HS_C + '">자체변경</td></tr>'; }); });
  var p2 = _hsBig("2", "자금집행 정산보고서")
    + _hsUnit("① 정산 총괄표", "단위 : 원, %") + sumT(0, 0, ["계", "지원금", "자부담"])
    + '<div style="font-size:11px">※ 지원금 교부시 제출·승인된 사업실행계획서를 기준으로 총사업비, 집행액과 집행잔액을 기록</div>'
    + _hsSec("② 지원금 집행현황") + _hsUnit("① 세부사업별 집행현황") + byItem("sup")
    + _hsUnit("② 지원금 집행 세부내역") + detail("sup")
    + '<div style="font-size:11px">※ 내부품의서, 지출결의서, 각종 영수증, 회계장부, 통장 등 세부증빙자료는 별도 편철 제출</div>'
    + _hsSec("③ 자부담 집행현황") + _hsUnit("① 세부사업별 집행현황") + byItem("self")
    + _hsUnit("② 자부담 집행 세부내역") + detail("self")
    + _hsUnit("④ 사업자지원금 집행잔액 발생사유") + _hsTbl() + _hsTh([["단위사업", "16%"], ["세부사업내용", "16%"], ["예산액", "13%"], ["지출액", "13%"], ["집행잔액", "13%"], ["발생사유"]]) + (rmRows || '<tr><td style="' + HS_C + '" colspan="6">해당 없음</td></tr>') + '</table>'
    + '<div style="font-size:11px">※ 발생사유 : 사업계획변경, 사업취소, 지급사유 미발생, 집행잔액, 이자 등 기재</div>'
    + _hsUnit("⑤ 사업 및 소요경비배분 변경내역 (변경사항이 있을 경우만)") + _hsTbl() + _hsTh([["세 부 내 용", "22%"], ["비목", "14%"], ["당초예산", "13%"], ["변경예산", "13%"], ["주요 변경사유"], ["승인<br>여부", "10%"]]) + (chRows || '<tr><td style="' + HS_C + '" colspan="6">해당 없음</td></tr>') + '</table>'
    + '<div style="font-size:11px">※ 승인여부 : 한수원 승인, 자체변경(내부 결재문서 사본 첨부)으로 구분 기재</div>';
  var h = _hsPg(cv) + _hsPg(p1) + _hsPg(p2);
  // 3 영수증·세금계산서 / 4 사진 — 구매에 올린 증빙 사진
  var ev = function(fl){ var C = []; X.forEach(function(r){ var p = r.p || {}; fl.forEach(function(k){ (p[k] || []).forEach(function(e){ var u = e && (e.u || e.url || e); if(typeof u === "string" && u) C.push({ u: u, rot: (e && e.r) || 0, cap: (r.sub && r.sub !== "-" ? r.sub : r.tp) + ' · ' + _hsDt(r.dt) + ' · ' + (r.vendor || '') + ' · ' + _hsW(r.am) + '원', k: k }); }); }); }); return C; };
  var pages = function(num, ttl, C){ var o = ''; for(var i = 0; i < C.length; i += 2){ var ch = C.slice(i, i + 2);
    o += _hsPg(_hsBig(num, ttl + ' (' + (i / 2 + 1) + '/' + Math.ceil(C.length / 2) + ')') + '<div style="height:240mm;display:grid;grid-template-rows:1fr 1fr;gap:4mm">' + ch.map(function(c){ return '<div style="min-height:0;display:flex;flex-direction:column;align-items:center;border:1px solid #94a3b8;padding:2mm;overflow:hidden"><img data-rot="' + c.rot + '" src="' + esc(typeof _evPrintBig === "function" ? _evPrintBig(c.u) : c.u) + '" style="flex:1;min-height:0;max-width:100%;object-fit:contain' + (c.rot ? ';transform:rotate(' + c.rot + 'deg)' : '') + '"><div style="font-size:12px;font-weight:700;margin-top:1mm">' + esc(c.cap) + '</div></div>'; }).join('') + '</div>'); }
    return o; };
  if(opt.rc !== false) h += pages("3", "영수증·세금계산서", ev(["rc", "taxDoc"]));
  if(opt.ph !== false) h += pages("4", "사업 관련 인쇄물·사진 등", ev(["ph"]));
  return h;
}

// ═════════ 화면: 결산서의 「사) 한수원 양식」 카드 · 고르기 · 내용 적기 ═════════
function _hsCard(){
  var b = 'border:none;border-radius:6px;padding:7px 8px;font-size:13px;font-weight:800;color:#fff;cursor:pointer;flex:1;min-width:84px;background:';
  return '<div class="card" style="border:2px solid #1e3a5f">'
    + '<div style="font-size:13px;color:#1e3a5f;font-weight:700;margin-bottom:4px">사)</div>'
    + '<h3 style="margin:0 0 8px">🏛 한수원 양식</h3>'
    + '<div class="mut" style="font-size:12px;margin-bottom:10px">세출 예산 → <b>사업계획서</b> · 확정되면 <b>교부신청서</b> · 끝나면 구매 기록으로 <b>결과보고서</b>(사업추진실적 및 정산보고서)</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<button style="' + b + '#1d4ed8" onclick="event.stopPropagation();hsPrint(\'plan\')">📝 사업계획서</button>'
    + '<button style="' + b + '#0f766e" onclick="event.stopPropagation();hsPrint(\'grant\')">💰 교부신청서</button>'
    + '<button style="' + b + '#7c2d12" onclick="event.stopPropagation();hsResAsk()">📘 결과보고서</button>'
    + '<button style="' + b + '#334155" onclick="event.stopPropagation();hsEdit()">✏ 내용 적기</button>'
    + '</div></div>';
}
function hsPrint(kind, opt){
  showLoading("📄 문서 만드는 중...");
  _hsLoad().then(function(){
    hideLoading();
    var nm = _hsBizNm(), T = { plan: "사업계획서", grant: "교부신청서", res: "사업추진실적 및 정산보고서" }[kind];
    var html = kind === "plan" ? _hsPlanHtml() : (kind === "grant" ? _hsGrantHtml() : _hsResHtml(opt));
    if(!(expBG || []).length) toast("이 행사에 세출 예산이 아직 없어요 — 예산관리(세출)에서 먼저 짜 주세요", true);
    _docPrint({ title: nm + " " + T, html: '<style>.pg{break-after:page}.pg:last-child{break-after:auto}</style>' + html, key: "hs_" + kind });
  }).catch(function(e){ hideLoading(); toast("불러오기 실패: " + (e && e.message || e), true); });
}
function hsResAsk(){
  var X = _hsExec(), nR = 0, nP = 0; X.forEach(function(r){ var p = r.p || {}; nR += (p.rc || []).length + (p.taxDoc || []).length; nP += (p.ph || []).length; });
  openPopup2('<h3>📘 결과보고서 뽑기 <button class="close-x" onclick="closePopup2()">&times;</button></h3>'
    + '<div style="font-size:13.5px;line-height:1.8;margin-bottom:10px">표지 · 1 사업 추진실적 · 2 자금집행 정산보고서는 항상 들어가요.<br>구매 기록 <b>' + X.length + '건</b> (지원금·자부담은 구매에 고른 재원으로 나눠요)</div>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:6px"><input type="checkbox" id="hsRc" ' + (nR ? 'checked' : '') + ' style="width:18px;height:18px">3 영수증·세금계산서 사진 (' + nR + '장, 한 쪽에 2장)</label>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:12px"><input type="checkbox" id="hsPh" ' + (nP ? 'checked' : '') + ' style="width:18px;height:18px">4 사업 사진 (' + nP + '장, 구매에 올린 사진)</label>'
    + '<div style="text-align:right"><button class="btn btn-b" onclick="var o={rc:document.getElementById(\'hsRc\').checked,ph:document.getElementById(\'hsPh\').checked};closePopup2();hsPrint(\'res\',o)">🖨 만들기</button></div>', 460);
}
function hsEdit(){
  showLoading("불러오는 중...");
  _hsLoad().then(function(){ hideLoading(); _hsEdDraw(); }).catch(function(e){ hideLoading(); toast("불러오기 실패: " + (e && e.message || e), true); });
}
function _hsEdDraw(){
  var inp = function(id, lb, v, ph, ty){ return '<label style="display:block;font-size:12.5px;font-weight:700;color:#334155">' + lb + '<input id="' + id + '" type="' + (ty || "text") + '" value="' + esc(v) + '" placeholder="' + esc(ph || "") + '" style="width:100%;box-sizing:border-box;padding:6px;font-size:14px;margin-top:2px;border:1px solid #cbd5e1;border-radius:5px"></label>'; };
  var ta = function(id, lb, v, r){ return '<label style="display:block;font-size:12.5px;font-weight:700;color:#334155;margin-top:6px">' + lb + '<textarea id="' + id + '" rows="' + (r || 4) + '" style="width:100%;box-sizing:border-box;padding:6px;font-size:14px;line-height:1.55;margin-top:2px;font-family:inherit;border:1px solid #cbd5e1;border-radius:5px">' + esc(v) + '</textarea></label>'; };
  var grid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px 10px">';
  var sec = function(t, c){ return '<div style="margin:12px 0 4px;padding:5px 8px;background:#1e3a5f;color:#fff;font-weight:800;border-radius:5px;font-size:14px">' + t + '</div>' + c; };
  var B = _hsBud(), G = (HS.d || {}).grant || {}, R = (HS.d || {}).result || {}, P = (HS.d || {}).plan || {};
  var h = '<h3>✏ 한수원 양식 내용 — ' + esc((CUR_EVT && CUR_EVT.nm) || "") + ' ' + esc(_hsYr()) + ' <button class="close-x" onclick="closePopup2()">&times;</button></h3>'
    + '<div style="font-size:12.5px;color:#475569;margin-bottom:6px">금액은 <b>세출 예산(계획)</b>과 <b>구매 기록(실제)</b>에서 자동으로 들어가요. 여기엔 글과 날짜만 적으면 돼요. <button class="btn btn-s" style="background:#7c3aed;color:#fff" onclick="hsCopyPrev()">📋 다른 해 내용 가져오기</button></div>';
  h += sec("🏢 단체 정보 (모든 사업 공통)", grid + HS_ORG_F.map(function(f){ return inp("hso_" + f[0], f[1], _hsV("org", f[0])); }).join('') + '</div>');
  h += sec("📌 사업 기본", grid + HS_INFO_F.map(function(f){ return inp("hsi_" + f[0], f[1], _hsV("info", f[0]), f[2], f[3]); }).join('') + '</div>');
  var tps = _hsTps();
  h += sec("💰 재원 — 세출 대분류가 지원금인지 자부담인지 (지금 계획: 지원 " + fm(B.sup) + " · 자부담 " + fm(B.self) + ")", tps.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + tps.map(function(t, i){ var f = _hsFund(t); return '<label style="font-size:13px;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px">' + esc(t) + ' <select id="hsf_' + i + '" data-tp="' + esc(t) + '" style="font-size:13px"><option value="sup"' + (f === "sup" ? ' selected' : '') + '>지원금</option><option value="self"' + (f === "self" ? ' selected' : '') + '>자부담</option></select></label>'; }).join('') + '</div>' : '<div style="color:#b91c1c;font-size:13px">세출 예산이 아직 없어요 — 예산관리(세출)에서 먼저 짜 주세요</div>');
  h += sec("📝 사업계획서", inp("hsp_dt", "신청일", P.dt || "", "", "date") + HS_PLAN_F.map(function(f){ return ta("hsp_" + f[0], f[1], P[f[0]] || "", f[0] === "sched" ? 5 : 4); }).join(''));
  h += sec("💰 교부신청서", grid + inp("hsg_dt", "신청일", G.dt || "", "", "date") + inp("hsg_prev", "기 교부금액 (원)", G.prev || "", "처음이면 비움") + inp("hsg_req", "금회 신청금액 (원)", G.req == null ? "" : G.req, "비우면 지원금 전액") + '</div>');
  h += sec("📘 결과보고서", grid + inp("hsr_dt", "제출일", R.dt || "", "", "date") + inp("hsr_inter", "이자 발생액 (원)", R.inter || "", "0") + '</div>' + HS_RES_F.map(function(f){ return ta("hsr_" + f[0], f[1], R[f[0]] || "", 3); }).join(''));
  h += '<div style="position:sticky;bottom:0;background:#fff;padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;margin-top:10px"><button class="btn btn-b" style="font-size:15px;padding:8px 22px" onclick="hsSave()">💾 저장</button></div>';
  openPopup2(h, 900);
}
function _hsCollect(){
  var g = function(id){ var e = document.getElementById(id); return e ? e.value : ""; };
  var org = {}; HS_ORG_F.forEach(function(f){ org[f[0]] = g("hso_" + f[0]).trim(); });
  var info = {}; HS_INFO_F.forEach(function(f){ info[f[0]] = g("hsi_" + f[0]).trim(); });
  var fund = {}; _hsTps().forEach(function(t, i){ var e = document.getElementById("hsf_" + i); if(e) fund[t.replace(/[.#$\[\]\/]/g, "_")] = e.value; });
  var plan = { dt: g("hsp_dt") }; HS_PLAN_F.forEach(function(f){ plan[f[0]] = g("hsp_" + f[0]); });
  var grant = { dt: g("hsg_dt"), prev: g("hsg_prev").replace(/[^\d]/g, ""), req: g("hsg_req").replace(/[^\d]/g, "") };
  var result = { dt: g("hsr_dt"), inter: g("hsr_inter").replace(/[^\d]/g, "") }; HS_RES_F.forEach(function(f){ result[f[0]] = g("hsr_" + f[0]); });
  return { org: org, d: { info: info, fund: fund, plan: plan, grant: grant, result: result } };
}
function hsSave(){
  var c = _hsCollect(), k = _hsKey();
  c.d.upAt = new Date().toISOString(); c.d.evtNm = (CUR_EVT && CUR_EVT.nm) || ""; c.d.yr = String((CUR_EVT && CUR_EVT.yr) || "");
  showLoading("💾 저장 중...");
  Promise.all([fbDb.ref('/main/HsDoc/' + k).set(c.d), fbDb.ref('/main/HsDoc/_org').set(c.org)]).then(function(){
    hideLoading(); HS.d = c.d; HS.org = c.org; HS.k = k; closePopup2(); toast("💾 한수원 양식 내용 저장");
  }).catch(function(e){ hideLoading(); toast("저장 실패: " + e.message, true); });
}
// 📋 다른 해(같은 이름 행사)의 글 가져오기 — 날짜·금액은 안 가져옴
function hsCopyPrev(){
  var c = _hsCollect(); HS.d = Object.assign(HS.d || {}, c.d); HS.org = c.org;   // 지금 적던 것 잃지 않게
  fbDb.ref('/main/HsDoc').once('value').then(function(s){
    var all = s.val() || {}, me = _hsKey(), L = Object.keys(all).filter(function(k){ return k !== "_org" && k !== me && all[k] && (all[k].plan || all[k].result); });
    if(!L.length){ toast("가져올 다른 사업 내용이 아직 없어요", true); return; }
    var nm = (CUR_EVT && CUR_EVT.nm) || "";
    L.sort(function(a, b){ return ((all[b].evtNm === nm) - (all[a].evtNm === nm)) || String(all[b].yr || "").localeCompare(String(all[a].yr || "")); });
    window._HS_ALL = all;
    openPopup2('<h3>📋 어느 사업 글을 가져올까요? <button class="close-x" onclick="closePopup2();_hsEdDraw()">&times;</button></h3><div style="font-size:12.5px;color:#475569;margin-bottom:8px">글(목적·내용·환경·효과·성과·평가·건의·일정)만 가져와요. 날짜·금액은 그대로. <b>지금 적은 글은 덮어써져요</b> (저장 누르기 전엔 안 바뀜)</div>'
      + L.map(function(k){ var x = all[k]; return '<button class="btn" style="display:block;width:100%;text-align:left;margin-bottom:6px;background:#eef2ff;color:#1e3a8a;font-weight:700" onclick="_hsCopyDo(\'' + esc(k) + '\')">' + esc((x.yr || "") + " " + (x.evtNm || k)) + ' <span style="font-weight:400;font-size:12px">' + esc((x.info || {}).bizNm || "") + '</span></button>'; }).join(''), 520);
  });
}
function _hsCopyDo(k){
  var x = (window._HS_ALL || {})[k] || {}, keep = ["dt", "inter", "prev", "req"];
  HS.d = HS.d || {};
  ["plan", "result"].forEach(function(s){ var src = x[s] || {}, dst = HS.d[s] = Object.assign({}, HS.d[s] || {}); Object.keys(src).forEach(function(f){ if(keep.indexOf(f) < 0) dst[f] = src[f]; }); });
  var I = HS.d.info = Object.assign({}, HS.d.info || {}); ["kind", "place", "target", "gubun", "how", "chNm", "chPos"].forEach(function(f){ if(!I[f] && (x.info || {})[f]) I[f] = x.info[f]; });
  closePopup2(); _hsEdDraw(); toast("📋 가져왔어요 — 고친 뒤 💾 저장");
}
