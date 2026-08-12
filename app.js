// =========================================================
// DUMMY BANK — Web Application JavaScript
// GitHub API Sync Version (Optimized for Real-time & Consistency)
// =========================================================

const GITHUB_TOKEN = "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";
const GITHUB_OWNER = "blackcivic4145";
const GITHUB_REPO = "DummyBankSystem";
const GITHUB_PATH = "data.json";

const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
const GITHUB_PAGES_URL = `https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/${GITHUB_PATH}`;
const POLL_INTERVAL_MS = 5000;

let DUMMY_DATA = { accounts: {} };
let currentUserId = null;
let pollTimer = null;

// ---- UTILS ----
function fmt(n) { return "¥" + Number(n).toLocaleString("ja-JP"); }
function fmtDate(d) { return d.replace(/-/g, "/"); }
function uuid() { return "xxxxxxxx".replace(/x/g, () => Math.floor(Math.random()*16).toString(16)); }
function today() { return new Date().toISOString().slice(0, 10); }

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p) => String.fromCharCode('0x' + p)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

// ---- SYNC ----
async function fetchServerState() {
  try {
    const useApi = !!GITHUB_TOKEN;
    const url = useApi ? GITHUB_API_URL : `${GITHUB_PAGES_URL}?t=${Date.now()}`;
    const res = await fetch(url, { headers: useApi ? { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" } : {} });
    if (!res.ok) return null;
    const data = await res.json();
    const jsonStr = useApi ? b64DecodeUnicode(data.content.replace(/\n/g, '')) : JSON.stringify(data);
    return JSON.parse(jsonStr);
  } catch (e) { console.warn("Fetch error:", e); return null; }
}

async function pushServerState() {
  if (!GITHUB_TOKEN) return;
  try {
    const getRes = await fetch(GITHUB_API_URL, { headers: { "Authorization": `token ${GITHUB_TOKEN}` } });
    const metadata = await getRes.json();
    const res = await fetch(GITHUB_API_URL, {
      method: "PUT",
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Web Update",
        content: b64EncodeUnicode(JSON.stringify(DUMMY_DATA.accounts, null, 2)),
        sha: metadata.sha
      })
    });
    if (res.ok) console.log("Sync Success");
  } catch (e) { console.error("Push error:", e); }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const accounts = await fetchServerState();
    if (accounts) {
      DUMMY_DATA.accounts = accounts;
      if (currentUserId && document.getElementById("screen-mypage").classList.contains("active")) renderMyPage();
    }
  }, POLL_INTERVAL_MS);
}

// ---- UI ----
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + id).classList.add("active");
  window.scrollTo(0,0);
}
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2800);
}
function showSuccess(title, body, cb) {
  document.getElementById("success-title").textContent = title;
  document.getElementById("success-body").textContent = body;
  const overlay = document.getElementById("success-overlay");
  overlay.classList.remove("hidden");
  setTimeout(() => { overlay.classList.add("hidden"); if (cb) cb(); }, 2200);
}

function getState() { return DUMMY_DATA.accounts[currentUserId]; }

// ---- INIT ----
function initLogin() {
  document.getElementById("btn-login").onclick = async () => {
    const id = document.getElementById("login-userid").value.trim().toLowerCase();
    const pw = document.getElementById("login-password").value;
    const accounts = await fetchServerState();
    if (accounts && accounts[id]) {
      DUMMY_DATA.accounts = accounts; currentUserId = id;
      renderMyPage(); showScreen("mypage"); startPolling();
    } else {
      document.getElementById("login-error").classList.remove("hidden");
    }
  };
}

function renderMyPage() {
  const state = getState();
  const info = state; // Structured flat in JSON
  document.getElementById("account-card").innerHTML = `<div class="bank-card-header"><span class="bank-card-name">DUMMY BANK CASH CARD</span><span class="bank-card-visa">VISA</span></div><div class="bank-card-balance-label">ご利用可能残高</div><div class="bank-card-balance">${fmt(info.balance)}</div><div class="bank-card-footer"><div><div class="bank-card-info-label">口座番号</div><div class="bank-card-info-value">${info.accountNumber}</div></div><div style="text-align:right"><div class="bank-card-info-label">名義人</div><div class="bank-card-info-value">${info.ownerName}</div></div></div>`;
  const txList = document.getElementById("tx-list");
  const txs = state.transactions.slice(0, 5);
  txList.innerHTML = txs.length ? txs.map(tx => `<div class="tx-row"><div class="tx-icon-box ${tx.type}">${tx.type==='deposit'?'⬇️':'⬆️'}</div><div class="tx-meta"><div class="tx-desc">${tx.description}</div><div class="tx-date">${fmtDate(tx.date)}</div></div><div class="tx-amount ${tx.type}">${tx.type==='deposit'?'+':'-'}${fmt(tx.amount)}</div></div>`).join("") : '<p style="text-align:center;padding:24px 0;color:#999">履歴なし</p>';
}

function initMyPage() {
  document.getElementById("btn-logout").onclick = () => { currentUserId = null; clearInterval(pollTimer); pollTimer = null; showScreen("login"); };
  document.getElementById("menu-transfer").onclick = () => { renderTransferScreen(); showScreen("transfer"); };
  document.getElementById("menu-savings").onclick = () => { renderSavingsScreen(); showScreen("savings"); };
  document.getElementById("menu-settings").onclick = () => { showScreen("settings"); };
}

function renderTransferScreen() {
  const state = getState();
  document.getElementById("transfer-from-card").innerHTML = `<div class="info-card-label">引出口座</div><div class="info-card-main">${state.ownerName}（${state.accountNumber}）</div><div class="info-card-balance">残高: ${fmt(state.balance)}</div>`;
  document.getElementById("transfer-branch").value = ""; document.getElementById("transfer-acno").value = "";
  document.getElementById("transfer-amount").value = ""; document.getElementById("transfer-amount").disabled = true;
  document.getElementById("btn-do-transfer").disabled = true; document.getElementById("transfer-confirmed").classList.add("hidden");
}

function initTransfer() {
  document.getElementById("btn-transfer-back").onclick = () => showScreen("mypage");
  document.getElementById("btn-check-account").onclick = () => {
    const b = document.getElementById("transfer-bank").value;
    const br = document.getElementById("transfer-branch").value.trim();
    const ac = document.getElementById("transfer-acno").value.trim();
    const foundEntry = Object.entries(DUMMY_DATA.accounts).find(([id, s]) => s.bankCode === b && s.branchCode === br && s.accountNumber === ac);
    if (foundEntry) {
      const info = foundEntry[1];
      document.getElementById("transfer-confirmed").innerHTML = `<div class="confirmed-card-icon">✅</div><div><div class="confirmed-card-name-label">受取人</div><div class="confirmed-card-name">${info.ownerName} 様</div></div>`;
      document.getElementById("transfer-confirmed").classList.remove("hidden");
      document.getElementById("transfer-amount").disabled = false;
      const btn = document.getElementById("btn-do-transfer");
      btn.disabled = false; btn.dataset.targetId = foundEntry[0];
    } else { showToast("口座が見つかりません"); }
  };
  document.getElementById("btn-do-transfer").onclick = async () => {
    const amount = parseInt(document.getElementById("transfer-amount").value);
    const state = getState();
    if (amount > state.balance) { showToast("残高不足"); return; }
    const targetId = document.getElementById("btn-do-transfer").dataset.targetId;
    const targetState = DUMMY_DATA.accounts[targetId];
    state.balance -= amount;
    state.transactions.unshift({ id: "tx_"+uuid(), date: today(), description: `振込（${targetState.ownerName}）`, amount, type: "withdrawal" });
    targetState.balance += amount;
    targetState.transactions.unshift({ id: "tx_"+uuid(), date: today(), description: `振込受入（${state.ownerName}）`, amount, type: "deposit" });
    await pushServerState();
    showSuccess("完了", `${targetState.ownerName} 様へ送金しました`, () => showScreen("mypage"));
  };
}

function renderSavingsScreen() {
  const state = getState();
  const svs = state.savingsAccounts || [];
  const total = svs.reduce((a, b) => a + b.amount, 0);
  document.getElementById("savings-summary-card").innerHTML = `<div class="bank-card-balance-label">定期合計</div><div class="bank-card-balance">${fmt(total)}</div>`;
  const container = document.getElementById("savings-list-container");
  container.innerHTML = svs.length ? svs.map(s => `<div class="savings-item"><div class="savings-item-header"><div>${s.type==='FIXED'?'定期':'積立'}</div><div>${fmt(s.amount)}</div></div></div>`).join("") : "なし";
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin(); initMyPage(); initTransfer();
});
