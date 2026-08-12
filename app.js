// =========================================================
// DUMMY BANK — Web Application JavaScript
// GitHub API Sync Version (Ultimate Stability & UTF-8)
// =========================================================

const GITHUB_TOKEN = "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";
const GITHUB_OWNER = "blackcivic4145";
const GITHUB_REPO = "DummyBankSystem";
const GITHUB_PATH = "data.json";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
const POLL_INTERVAL_MS = 5000;

let DUMMY_DATA = { accounts: {} };
let currentUserId = null;
let pollTimer = null;

function fmt(n) { return "¥" + Number(n).toLocaleString("ja-JP"); }
function fmtDate(d) { return d.replace(/-/g, "/"); }
function uuid() { return "xxxxxxxx".replace(/x/g, () => Math.floor(Math.random()*16).toString(16)); }
function today() { return new Date().toISOString().slice(0, 10); }

function b64EncodeUnicode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64DecodeUnicode(str) { return decodeURIComponent(escape(atob(str))); }

async function fetchServerState() {
  try {
    const res = await fetch(`${GITHUB_API_URL}?t=${Date.now()}`, { headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(b64DecodeUnicode(data.content.replace(/\n/g, '')));
  } catch (e) { return null; }
}

async function pushServerState() {
  try {
    const getRes = await fetch(GITHUB_API_URL, { headers: { "Authorization": `token ${GITHUB_TOKEN}` } });
    const metadata = await getRes.json();
    await fetch(GITHUB_API_URL, {
      method: "PUT",
      headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Web Update",
        content: b64EncodeUnicode(JSON.stringify(DUMMY_DATA.accounts, null, 2)),
        sha: metadata.sha
      })
    });
    const latest = await fetchServerState();
    if (latest) DUMMY_DATA.accounts = latest;
  } catch (e) { }
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

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + id).classList.add("active");
  window.scrollTo(0,0);
}

function showToast(msg) {
  const el = document.getElementById("toast"); el.textContent = msg; el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2800);
}

function showSuccess(title, body, cb) {
  document.getElementById("success-title").textContent = title; document.getElementById("success-body").textContent = body;
  const overlay = document.getElementById("success-overlay"); overlay.classList.remove("hidden");
  setTimeout(() => { overlay.classList.add("hidden"); if (cb) cb(); }, 2200);
}

function getState() { return DUMMY_DATA.accounts[currentUserId]; }

function initLogin() {
  document.getElementById("btn-login").onclick = async () => {
    const id = document.getElementById("login-userid").value.trim().toLowerCase();
    // Fetch latest BEFORE validating login
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
  const s = getState();
  document.getElementById("account-card").innerHTML = `<div class="bank-card-header"><span class="bank-card-name">DUMMY BANK CASH CARD</span><span class="bank-card-visa">VISA</span></div><div class="bank-card-balance-label">ご利用可能残高</div><div class="bank-card-balance">${fmt(s.balance)}</div><div class="bank-card-footer"><div><div class="bank-card-info-label">口座番号</div><div class="bank-card-info-value">${s.accountNumber}</div></div><div style="text-align:right"><div class="bank-card-info-label">名義人</div><div class="bank-card-info-value">${s.ownerName}</div></div></div>`;
  const txList = document.getElementById("tx-list");
  const txs = s.transactions.slice(0, 5);
  txList.innerHTML = txs.length ? txs.map(tx => `<div class="tx-row"><div class="tx-icon-box ${tx.type}">${tx.type==='deposit'?'⬇️':'⬆️'}</div><div class="tx-meta"><div class="tx-desc">${tx.description}</div><div class="tx-date">${fmtDate(tx.date)}</div></div><div class="tx-amount ${tx.type}">${tx.type==='deposit'?'+':'-'}${fmt(tx.amount)}</div></div>`).join("") : '<p style="text-align:center;padding:24px 0;color:#999">履歴なし</p>';
}

function initMyPage() {
  document.getElementById("btn-logout").onclick = () => { currentUserId = null; clearInterval(pollTimer); pollTimer = null; showScreen("login"); };
  document.getElementById("menu-transfer").onclick = () => { renderTransferScreen(); showScreen("transfer"); };
  document.getElementById("menu-savings").onclick = () => { renderSavingsScreen(); showScreen("savings"); };
  document.getElementById("menu-settings").onclick = () => { showScreen("settings"); };
}

function renderTransferScreen() {
  const s = getState();
  document.getElementById("transfer-from-card").innerHTML = `<div class="info-card-label">引出口座</div><div class="info-card-main">${s.ownerName}（${s.accountNumber}）</div><div class="info-card-balance">残高: ${fmt(s.balance)}</div>`;
  document.getElementById("transfer-branch").value = ""; document.getElementById("transfer-acno").value = ""; document.getElementById("transfer-amount").value = ""; document.getElementById("transfer-amount").disabled = true; document.getElementById("btn-do-transfer").disabled = true; document.getElementById("transfer-confirmed").classList.add("hidden");
}

function initTransfer() {
  document.getElementById("btn-transfer-back").onclick = () => showScreen("mypage");
  document.getElementById("btn-check-account").onclick = () => {
    const b = document.getElementById("transfer-bank").value, br = document.getElementById("transfer-branch").value.trim(), ac = document.getElementById("transfer-acno").value.trim();
    const entry = Object.entries(DUMMY_DATA.accounts).find(([id, s]) => s.bankCode === b && s.branchCode === br && s.accountNumber === ac);
    if (entry) {
      document.getElementById("transfer-confirmed").innerHTML = `<div class="confirmed-card-icon">✅</div><div><div class="confirmed-card-name-label">受取人</div><div class="confirmed-card-name">${entry[1].ownerName} 様</div></div>`;
      document.getElementById("transfer-confirmed").classList.remove("hidden"); document.getElementById("transfer-amount").disabled = false;
      const btn = document.getElementById("btn-do-transfer"); btn.disabled = false; btn.dataset.targetId = entry[0];
    } else { showToast("口座が見つかりません"); }
  };
  document.getElementById("btn-do-transfer").onclick = async () => {
    const amt = parseInt(document.getElementById("transfer-amount").value), s = getState(), targetId = document.getElementById("btn-do-transfer").dataset.targetId, t = DUMMY_DATA.accounts[targetId];
    if (amt > s.balance) { showToast("残高不足"); return; }
    s.balance -= amt; s.transactions.unshift({ id: "tx_"+uuid(), date: today(), description: `振込（${t.ownerName}）`, amount: amt, type: "withdrawal" });
    t.balance += amt; t.transactions.unshift({ id: "tx_"+uuid(), date: today(), description: `振込受入（${s.ownerName}）`, amount: amt, type: "deposit" });
    await pushServerState(); showSuccess("完了", `${t.ownerName} 様へ送金しました`, () => showScreen("mypage"));
  };
}

function renderSavingsScreen() {
  const s = getState(), total = (s.savingsAccounts || []).reduce((a, b) => a + b.amount, 0);
  document.getElementById("savings-summary-card").innerHTML = `<div class="bank-card-balance-label">定期合計</div><div class="bank-card-balance">${fmt(total)}</div>`;
  const container = document.getElementById("savings-list-container");
  container.innerHTML = (s.savingsAccounts || []).length ? s.savingsAccounts.map(sv => `<div class="savings-item"><div class="savings-item-header"><div>${sv.type==='FIXED'?'定期':'積立'}</div><div>${fmt(sv.amount)}</div></div></div>`).join("") : "なし";
}

document.addEventListener("DOMContentLoaded", () => {
  initLogin(); initMyPage(); initTransfer();
  document.getElementById("btn-settings-back").onclick = () => showScreen("mypage");
  const go2fa = document.getElementById("settings-go-2fa"); if (go2fa) go2fa.style.display = "none";
});
