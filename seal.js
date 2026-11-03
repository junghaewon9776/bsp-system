// ============================================================================
// 🔴 단체 직인(도장) 보관 — 계정관리 화면에서 올려 두면 정산서·결의서 같은 출력물 서명칸에 쓸 수 있게
//   저장: /main/OrgSeal = { img: "data:image/png;base64,…"(흰 바탕 자동 투명), nm, at, by }
//   출력물에서 쓰기: orgSealHtml(크기px) → <img …> (도장 없으면 "")
// ============================================================================
function _sealData(){ return (typeof _cache !== "undefined" && _cache && _cache.OrgSeal) || null; }
function orgSealHtml(px, extra){
  var s = _sealData(); if(!s || !s.img) return "";
  px = px || 60;
  return '<img src="' + s.img + '" alt="직인" style="width:' + px + 'px;height:' + px + 'px;object-fit:contain;' + (extra || "") + '">';
}
function _sealCard(){
  if(typeof _isGlobalAdm !== "function" || !_isGlobalAdm()) return "";
  var s = _sealData();
  var h = '<div class="card" style="border:2px solid #b91c1c;background:#fff7f7"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px"><h3 style="margin:0;color:#7f1d1d;font-weight:800">🔴 단체 직인 (도장)</h3>';
  h += '<label class="btn btn-s" style="background:#b91c1c;color:#fff;font-weight:700;cursor:pointer">📷 도장 사진 ' + (s && s.img ? "바꾸기" : "올리기") + '<input type="file" accept="image/*" style="display:none" onchange="sealPick(this)"></label></div>';
  h += '<div style="font-size:12px;color:#991b1b;margin-bottom:8px">도장을 흰 종이에 찍어 사진 찍거나 스캔한 그림을 올려 주세요. <b>흰 바탕은 자동으로 투명하게</b> 바꿔서, 정산서·결의서 같은 출력물의 서명칸에 넣을 수 있게 보관해요.</div>';
  if(s && s.img){
    h += '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">';
    h += '<div style="text-align:center"><div style="width:120px;height:120px;border:1px dashed #fca5a5;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff">' + orgSealHtml(100) + '</div><div style="font-size:11px;color:#64748b;margin-top:3px">보관된 도장</div></div>';
    // 서명칸 미리보기 — 글자 위에 도장이 겹쳐 찍힌 모습
    h += '<div style="text-align:center"><div style="position:relative;width:220px;height:90px;border:1px solid #334155;background:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#111">' + esc(typeof SYS_PARENT !== "undefined" ? SYS_PARENT : "") + ' 회장 (인)<span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);opacity:.92">' + orgSealHtml(64) + '</span></div><div style="font-size:11px;color:#64748b;margin-top:3px">서명칸에 찍히는 모습</div></div>';
    h += '<div style="font-size:12px;color:#475569">' + (s.at ? "올린 날: " + esc(String(s.at).slice(0, 10)) : "") + (s.by ? " · " + esc(s.by) : "") + '<br><button class="btn btn-r btn-s" style="margin-top:6px" onclick="sealDel()">삭제</button></div>';
    h += '</div>';
  } else h += '<div style="padding:14px;text-align:center;color:#94a3b8;border:1px dashed #fca5a5;border-radius:8px;background:#fff">아직 보관된 도장이 없어요</div>';
  return h + '</div>';
}
// 흰 바탕 → 투명, 도장 부분만 잘라서 512px 안으로
function sealPick(inp){
  var f = inp.files && inp.files[0]; if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    var img = new Image();
    img.onload = function(){
      var M = 900, r = Math.min(1, M / Math.max(img.width, img.height)), w = Math.round(img.width * r), h = Math.round(img.height * r);
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d"); cx.drawImage(img, 0, 0, w, h);
      var d = cx.getImageData(0, 0, w, h), p = d.data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for(var i = 0; i < p.length; i += 4){
        var R = p[i], G = p[i + 1], B = p[i + 2], mn = Math.min(R, G, B), light = (R + G + B) / 3;
        // 밝고 색이 옅은 곳(종이)은 투명, 붉은 기 있는 곳(인주)은 남김
        var redness = R - (G + B) / 2;
        var a = light > 215 && redness < 40 ? 0 : light > 175 && redness < 25 ? Math.round((215 - light) / 40 * 255) : 255;
        p[i + 3] = Math.min(p[i + 3], a);
        if(a > 40){ var px = (i / 4) % w, py = Math.floor(i / 4 / w); if(px < x0) x0 = px; if(px > x1) x1 = px; if(py < y0) y0 = py; if(py > y1) y1 = py; }
      }
      if(x1 < 0){ toast("도장을 못 찾았어요 — 흰 바탕에 찍힌 사진으로 해 주세요", true); return; }
      cx.putImageData(d, 0, 0);
      var pad = 6, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2, S = 512, k = Math.min(1, S / Math.max(cw, ch));
      var out = document.createElement("canvas"); out.width = Math.round(cw * k); out.height = Math.round(ch * k);
      out.getContext("2d").drawImage(cv, x0 - pad, y0 - pad, cw, ch, 0, 0, out.width, out.height);
      var url = out.toDataURL("image/png");
      if(url.length > 700000){ toast("그림이 너무 커요 — 도장 부분만 잘라서 다시 올려 주세요", true); return; }
      var o = { img: url, at: new Date().toISOString(), by: (typeof ME !== "undefined" && ME && (ME.nm || ME.id)) || "" };
      showLoading("저장 중...");
      fbDb.ref("/main/OrgSeal").set(o).then(function(){ hideLoading(); if(typeof _cache !== "undefined") _cache.OrgSeal = o; toast("🔴 도장 보관했어요"); draw(); })
        .catch(function(e){ hideLoading(); toast("저장 실패: " + e.message, true); });
    };
    img.onerror = function(){ toast("이 그림은 열 수 없어요 — jpg/png 로 해 주세요", true); };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function sealDel(){
  if(!confirm("보관된 도장을 지울까요?")) return;
  fbDb.ref("/main/OrgSeal").remove().then(function(){ if(typeof _cache !== "undefined") delete _cache.OrgSeal; toast("도장 지웠어요"); draw(); })
    .catch(function(e){ toast("실패: " + e.message, true); });
}
