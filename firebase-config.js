// Firebase 설정 - 법성포청년회
const firebaseConfig = {
  apiKey: "AIzaSyBzj4lMZYzN8itEm_nOV91FSPXlq8pn4c8",
  authDomain: "bsp-system-63800.firebaseapp.com",
  databaseURL: "https://bsp-system-63800-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bsp-system-63800",
  storageBucket: "bsp-system-63800.firebasestorage.app",
  messagingSenderId: "825148036440",
  appId: "1:825148036440:web:dc584bc91a5e6f92a3412d"
};

firebase.initializeApp(firebaseConfig);
const fbDb = firebase.database();
const fbAuth = firebase.auth();

// 🔑 로그인 도우미(Apps Script) 주소 — 비어 있으면 예전 로그인 방식 (2026-10 보안작업 2단계, AuthHelper_GAS.js)
var SEC_AUTH_URL = "https://script.google.com/macros/s/AKfycbylFvbMgcGfy6E9fRXq-V2LPogguDKNVtfq1YI_baBES1q58SVxmJdfm54uI_MORxFa/exec";
var SEC_SYS = "bsp";
