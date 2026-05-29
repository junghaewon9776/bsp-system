/**
 * 구글 드라이브 업로드 프록시 — Firebase 시스템용
 *
 * 사용법:
 * 1. script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드 붙여넣기
 * 3. 배포 → 웹 앱 → "나로 실행" + "모든 사용자 액세스" → 배포
 * 4. 웹 앱 URL을 복사해서 시스템 설정에 입력
 *
 * 폴더 구조:
 *   루트폴더/
 *     자료실/{evtId}/{폴더명}/파일들
 *     구매사진/{evtId}/파일들
 *     활동사진/{evtId}/파일들
 */

var PROPS = PropertiesService.getScriptProperties();
var ROOT_KEY = "ROOT_FOLDER_ID";

// ── 루트 폴더 자동 생성/조회 ──
function getRoot_() {
  var id = PROPS.getProperty(ROOT_KEY);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch(e) {}
  }
  var folder = DriveApp.createFolder("시스템_파일저장소");
  PROPS.setProperty(ROOT_KEY, folder.getId());
  return folder;
}

// 하위 폴더 가져오기 (없으면 생성)
function getSubFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ── doPost: 외부 시스템에서 호출 ──
function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var action = p.action || "";

    switch(action) {
      case "upload":       return json_(upload_(p));
      case "delete":       return json_(deleteFile_(p));
      case "listFolders":  return json_(listFolders_(p));
      case "addFolder":    return json_(addFolder_(p));
      case "deleteFolder": return json_(deleteFolder_(p));
      case "listFiles":    return json_(listFiles_(p));
      case "ping":         return json_({ok:true, msg:"pong", rootId: getRoot_().getId()});
      default:             return json_({ok:false, err:"unknown action: "+action});
    }
  } catch(err) {
    return json_({ok:false, err: String(err)});
  }
}

function doGet(e) {
  return json_({ok:true, msg:"Drive Proxy 작동 중", rootId: getRoot_().getId()});
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 파일 업로드 ──
// p: { base64, mime, filename, category("자료실"|"구매사진"|"활동사진"), evtId, folderId?(자료실용) }
function upload_(p) {
  var root = getRoot_();
  var category = p.category || "기타";
  var evtId = p.evtId || "general";
  var catFolder = getSubFolder_(root, category);
  var evtFolder = getSubFolder_(catFolder, evtId);

  // 자료실은 하위 폴더 추가 지원
  var targetFolder = evtFolder;
  if (p.folderId) {
    try { targetFolder = DriveApp.getFolderById(p.folderId); } catch(e) { targetFolder = evtFolder; }
  } else if (p.folderName) {
    targetFolder = getSubFolder_(evtFolder, p.folderName);
  }

  var blob = Utilities.newBlob(
    Utilities.base64Decode(p.base64),
    p.mime || "application/octet-stream",
    p.filename || ("file_" + Date.now())
  );
  var file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    ok: true,
    id: file.getId(),
    url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000",
    downloadUrl: "https://drive.google.com/uc?id=" + file.getId() + "&export=download",
    name: file.getName(),
    size: file.getSize()
  };
}

// ── 파일 삭제 ──
function deleteFile_(p) {
  var fileId = p.fileId || p.id;
  if (!fileId && p.url) {
    var m = String(p.url).match(/id=([^&]+)/);
    if (m) fileId = m[1];
  }
  if (!fileId) return {ok:false, err:"파일 ID 없음"};
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return {ok:true};
  } catch(err) {
    return {ok:false, err: String(err)};
  }
}

// ── 자료실: 폴더 목록 ──
function listFolders_(p) {
  var root = getRoot_();
  var catFolder = getSubFolder_(root, "자료실");
  var evtFolder = getSubFolder_(catFolder, p.evtId || "general");

  var folders = [];
  var it = evtFolder.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var fileCnt = 0;
    var fi = f.getFiles();
    while (fi.hasNext()) { fi.next(); fileCnt++; }
    folders.push({id: f.getId(), name: f.getName(), fileCnt: fileCnt});
  }
  folders.sort(function(a,b){ return a.name.localeCompare(b.name); });
  return {ok:true, folders:folders};
}

// ── 자료실: 폴더 추가 ──
function addFolder_(p) {
  var root = getRoot_();
  var catFolder = getSubFolder_(root, "자료실");
  var evtFolder = getSubFolder_(catFolder, p.evtId || "general");
  var newF = evtFolder.createFolder(p.name || "새 폴더");
  return {ok:true, id:newF.getId(), name:newF.getName()};
}

// ── 자료실: 폴더 삭제 ──
function deleteFolder_(p) {
  if (!p.fid) return {ok:false, err:"폴더 ID 없음"};
  try {
    DriveApp.getFolderById(p.fid).setTrashed(true);
    return {ok:true};
  } catch(err) {
    return {ok:false, err: String(err)};
  }
}

// ── 자료실: 파일 목록 ──
function listFiles_(p) {
  if (!p.folderId) return {ok:false, err:"폴더 ID 없음"};
  try {
    var folder = DriveApp.getFolderById(p.folderId);
    var files = [];
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      files.push({
        id: f.getId(),
        filename: f.getName(),
        mime: f.getMimeType(),
        size: f.getSize(),
        uploadedAt: Utilities.formatDate(f.getDateCreated(), "GMT+9", "yyyy-MM-dd HH:mm"),
        url: "https://drive.google.com/uc?id=" + f.getId() + "&export=download"
      });
    }
    files.sort(function(a,b){ return b.uploadedAt.localeCompare(a.uploadedAt); });
    return {ok:true, files:files};
  } catch(err) {
    return {ok:false, err: String(err)};
  }
}
