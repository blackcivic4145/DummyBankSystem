// =========================================================
// DUMMY BANK — Web Application JavaScript
// Full port of Kotlin DummyBankSystem
//
// UPDATED: now shares its account state with the Android app through the
// same backend (/api/state) that BankViewModel.kt already polls.
// =========================================================

// Point this at wherever dummybank-server/app.py is running.
const API_BASE_URL = "http://localhost:8080/api/state";
const POLL_INTERVAL_MS = 3000;

// ---- DATA ----
// Used only as a fallback if the server can't be reached (e.g. offline demo).
const DUMMY_DATA = {
  accounts: {
    test: {
      accountInfo: {
        bankCode: "001", branchCode: "001",
        accountNumber: "1234567890",
        balance: 1284500,
        ownerName: "テスト タロウ"
      },
      transactions: [
        { id:"tx_001", date:"2026-08-10", description:"給与振込（株式会社デモ）",     amount:350000, type:"deposit" },
        { id:"tx_002", date:"2026-08-08", description:"スーパー マルエツ",            amount:5420,   type:"withdrawal" },
        { id:"tx_003", date:"2026-08-05", description:"東京電力（電気料金）",          amount:12800,  type:"withdrawal" },
        { id:"tx_004", date:"2026-08-01", description:"家賃振込（デモ不動産）",        amount:85000,  type:"withdrawal" },
        { id:"tx_005", date:"2026-07-28", description:"セブン銀行ATM お引出し",        amount:30000,  type:"withdrawal" },
        { id:"tx_006", date:"2026-07-25", description:"ドトールコーヒー",             amount:650,    type:"withdrawal" },
        { id:"tx_007", date:"2026-07-20", description:"他行振込（ヤマダ ハナコ）",     amount:15000,  type:"deposit"    }
      ],
      savingsAccounts: [
        { id:"sv_001", type:"FIXED", amount:500000, interestRate:0.15, termMonths:12, startDate:"2026-01-15", maturityDate:"2027-01-15", maturityInstruction:"AUTO_RENEW_WITH_INTEREST" },
        { id:"sv_002", type:"ACCUMULATION", amount:120000, monthlyDepositAmount:10000, depositDay:25, interestRate:0.18, termMonths:24, startDate:"2025-08-25", maturityDate:"2027-08-25", maturityInstruction:"AUTO_CANCEL" }
      ]
    },
    guest: {
      accountInfo: {
        bankCode: "001", branchCode: "002",
        accountNumber: "0987654321",
        balance: 500000,
        ownerName: "ゲスト ジロウ"
      },
      transactions: [
        { id:"tx_g01", date:"2026-08-10", description:"給与振込（株式会社サンプル）", amount:200000, type:"deposit" },
        { id:"tx_g02", date:"2026-08-07", description:"ファミリーマート",             amount:1200,   type:"withdrawal" },
        { id:"tx_g03", date:"2026-08-02", description:"家賃引き落とし",              amount:60000,  type:"withdrawal" }
      ],
      savingsAccounts: [
        { id:"sv_g01", type:"FIXED", amount:100000, interestRate:0.10, termMonths:6, startDate:"2026-05-10", maturityDate:"2026-11-10", maturityInstruction:"AUTO_CANCEL" }
      ]
    }
  }
};

// ---- STATE ----
let currentUserId = null;
let pendingTransfer = null;
let pendingConfirmCallback = null;
let pollTimer = null;

// ---- SERVER SYNC ----
function serverJsonToAccounts(json) {
  const accounts = {};
  for (const [userId, u] of Object.entries(json)) {
    accounts[userId] = {
      accountInfo: {
        bankCode: u.bankCode,
        branchCode: u.branchCode,
        accountNumber: u.accountNumber,
        balance: u.balance,
        ownerName: u.ownerName
      },
      transactions: u.transactions || [],
      savingsAccounts: u.savingsAccounts || []
    };
  }
  return accounts;
}

function accountsToServerJson(accounts) {
  const json = {};
  for (const [userId, state] of Object.entries(accounts)) {
    json[userId] = {
      bankCode: state.accountInfo.bankCode,
      branchCode: state.accountInfo.branchCode,
      accountNumber: state.accountInfo.accountNumber,
      balance: state.accountInfo.balance,
      ownerName: state.accountInfo.ownerName,
      transactions: state.transactions,
      savingsAccounts: state.savingsAccounts
    };
  }
  return json;
}

async function fetchServerState() {
  try {
    const res = await fetch(API_BASE_URL, { method: "GET" });
    if (!res.ok) return null;
    const json = await res.json();
    return serverJsonToAccounts(json);
  } catch (e) {
    console.warn("Could not reach dummybank-server, using local state only.", e);
    return null;
  }
}

async function pushServerState() {
  try {
    await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountsToServerJson(DUMMY_DATA.accounts))
    });
  } catch (e) {
    console.warn("Could not push state to dummybank-server.", e);
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const serverAccounts = await fetchServerState();
    if (!serverAccounts) return;
    DUMMY_DATA.accounts = serverAccounts;
    if (currentUserId && document.getElementById("screen-mypage").classList.contains("active")) {
      renderMyPage();
    }
  }, POLL_INTERVAL_MS);
}

// ---- UTILS ----
function fmt(n) {
  return "¥" + Number(n).toLocaleString("ja-JP");
}
function fmtDate(d) {
  return d.replace(/-/g, "/");
}
function uuid() {
  return "xxxxxxxx".replace(/x/g, () => Math.floor(Math.random()*16).toString(16));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ---- NAVIGATION ----
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById("screen-" + id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
}

// ---- TOAST ----
let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
}

// ---- SUCCESS OVERLAY ----
function showSuccess(title, body, cb) {
  const titleEl = document.getElementById("success-title");
  const bodyEl = document.getElementById("success-body");
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  const overlay = document.getElementById("success-overlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    setTimeout(() => {
      overlay.classList.add("hidden");
      if (cb) cb();
    }, 2200);
  } else if (cb) {
    cb();
  }
}

// ---- CONFIRM MODAL ----
function showConfirm(title, body, okLabel, cb) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-body").textContent = body;
  document.getElementById("btn-confirm-ok").textContent = okLabel;
  document.getElementById("modal-confirm").classList.remove("hidden");
  pendingConfirmCallback = cb;
}

// ---- GET STATE ----
function getState() {
  return DUMMY_DATA.accounts[currentUserId];
}

// =========================================================
// LOGIN
// =========================================================
function initLogin() {
  const btnLogin = document.getElementById("btn-login");
  const togglePw = document.getElementById("toggle-pw");
  const pwInput = document.getElementById("login-password");
  const errBanner = document.getElementById("login-error");

  togglePw.addEventListener("click", () => {
    if (pwInput.type === "password") {
      pwInput.type = "text";
      togglePw.textContent = "🙈";
    } else {
      pwInput.type = "password";
      togglePw.textContent = "👁";
    }
  });

  btnLogin.addEventListener("click", doLogin);
  document.getElementById("login-userid").addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("login-password").focus(); });
  document.getElementById("login-password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

  async function doLogin() {
    errBanner.classList.add("hidden");
    const id = document.getElementById("login-userid").value.trim().toLowerCase();
    const pw = document.getElementById("login-password").value;
    if ((id === "test" && pw === "test") || (id === "guest" && pw === "guest")) {
      currentUserId = id;
      const serverAccounts = await fetchServerState();
      if (serverAccounts) DUMMY_DATA.accounts = serverAccounts;
      renderMyPage();
      showScreen("mypage");
      startPolling();
    } else {
      errBanner.textContent = "ユーザーIDまたはパスワードが間違っています。";
      errBanner.classList.remove("hidden");
    }
  }
}

// =========================================================
// MY PAGE
// =========================================================
function renderMyPage() {
  const state = getState();
  const info = state.accountInfo;

  // Render bank card
  document.getElementById("account-card").innerHTML = `
    <div class="bank-card-header">
      <span class="bank-card-name">DUMMY BANK CASH CARD</span>
      <span class="bank-card-visa">VISA</span>
    </div>
    <div class="bank-card-balance-label">ご利用可能残高</div>
    <div class="bank-card-balance">${fmt(info.balance)}</div>
    <div class="bank-card-footer">
      <div>
        <div class="bank-card-info-label">口座番号</div>
        <div class="bank-card-info-value">${info.accountNumber}</div>
      </div>
      <div style="text-align:right">
        <div class="bank-card-info-label">名義人</div>
        <div class="bank-card-info-value">${info.ownerName}</div>
      </div>
    </div>
  `;

  // Render transaction list
  const txList = document.getElementById("tx-list");
  const txs = state.transactions.slice(0, 5);
  if (txs.length === 0) {
    txList.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:24px 0;">取引履歴はありません</p>';
  } else {
    txList.innerHTML = txs.map(tx => {
      const isDeposit = tx.type === "deposit";
      const icon = isDeposit ? "⬇️" : "⬆️";
      const cls = isDeposit ? "deposit" : "withdrawal";
      const sign = isDeposit ? "+" : "-";
      return `
        <div class="tx-row">
          <div class="tx-icon-box ${cls}">${icon}</div>
          <div class="tx-meta">
            <div class="tx-desc">${tx.description}</div>
            <div class="tx-date">${fmtDate(tx.date)}</div>
          </div>
          <div class="tx-amount ${cls}">${sign}${fmt(tx.amount)}</div>
        </div>
      `;
    }).join("");
  }
}

function initMyPage() {
  document.getElementById("btn-logout").addEventListener("click", () => {
    currentUserId = null;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    document.getElementById("login-userid").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("login-error").classList.add("hidden");
    showScreen("login");
  });

  document.getElementById("menu-transfer").addEventListener("click", () => {
    renderTransferScreen();
    showScreen("transfer");
  });
  document.getElementById("menu-savings").addEventListener("click", () => {
    renderSavingsScreen();
    showScreen("savings");
  });
  document.getElementById("menu-settings").addEventListener("click", () => {
    renderSettingsScreen();
    showScreen("settings");
  });

  // Remove 2FA issue button if it exists in DOM
  const btnIssueCode = document.getElementById("menu-issue-code");
  if (btnIssueCode) btnIssueCode.style.display = "none";

  document.getElementById("menu-loan").addEventListener("click", () => {
    showToast("「カードローン」機能は準備中です。");
  });
}

// =========================================================
// TRANSFER
// =========================================================
function renderTransferScreen() {
  const state = getState();
  const info = state.accountInfo;
  document.getElementById("transfer-from-card").innerHTML = `
    <div class="info-card-label">引出口座（本人）</div>
    <div class="info-card-main">${info.ownerName}（${info.accountNumber}）</div>
    <div class="info-card-balance">お引出可能残高: ${fmt(info.balance)}</div>
  `;
  // Reset form
  document.getElementById("transfer-branch").value = "";
  document.getElementById("transfer-acno").value = "";
  document.getElementById("transfer-amount").value = "";
  document.getElementById("transfer-amount").disabled = true;
  document.getElementById("btn-do-transfer").disabled = true;
  document.getElementById("transfer-confirmed").classList.add("hidden");
  document.getElementById("transfer-error").classList.add("hidden");
}

function initTransfer() {
  document.getElementById("btn-transfer-back").addEventListener("click", () => {
    renderMyPage();
    showScreen("mypage");
  });

  document.getElementById("btn-check-account").addEventListener("click", () => {
    const errEl = document.getElementById("transfer-error");
    errEl.classList.add("hidden");
    document.getElementById("transfer-confirmed").classList.add("hidden");

    const bankCode = document.getElementById("transfer-bank").value;
    const branchCode = document.getElementById("transfer-branch").value.trim();
    const acno = document.getElementById("transfer-acno").value.replace(/-/g, "").trim();

    if (!branchCode) {
      errEl.textContent = "支店コードを入力してください。";
      errEl.classList.remove("hidden");
      return;
    }

    const found = findAccount(bankCode, branchCode, acno);
    const currentState = getState();
    const myInfo = currentState.accountInfo;

    if (!found) {
      errEl.textContent = "該当する口座が見つかりませんでした。";
      errEl.classList.remove("hidden");
      return;
    }
    if (found.bankCode === myInfo.bankCode && found.branchCode === myInfo.branchCode && found.accountNumber === myInfo.accountNumber) {
      errEl.textContent = "ご自身の口座へは振込できません。";
      errEl.classList.remove("hidden");
      return;
    }

    // Show confirmed
    const conf = document.getElementById("transfer-confirmed");
    conf.innerHTML = `
      <div class="confirmed-card-icon">✅</div>
      <div>
        <div class="confirmed-card-name-label">受取人名義</div>
        <div class="confirmed-card-name">${found.ownerName} 様</div>
      </div>
    `;
    conf.classList.remove("hidden");
    document.getElementById("transfer-amount").disabled = false;
    document.getElementById("btn-do-transfer").disabled = false;
    document.getElementById("btn-do-transfer").dataset.targetBank = found.bankCode;
    document.getElementById("btn-do-transfer").dataset.targetBranch = found.branchCode;
    document.getElementById("btn-do-transfer").dataset.targetAcno = found.accountNumber;
    document.getElementById("btn-do-transfer").dataset.targetName = found.ownerName;
  });

  document.getElementById("btn-do-transfer").addEventListener("click", async () => {
    const errEl = document.getElementById("transfer-error");
    errEl.classList.add("hidden");

    const amount = parseInt(document.getElementById("transfer-amount").value) || 0;
    const state = getState();
    if (amount <= 0) {
      errEl.textContent = "正しい振込金額を入力してください。";
      errEl.classList.remove("hidden");
      return;
    }
    if (amount > state.accountInfo.balance) {
      errEl.textContent = "残高が不足しています。";
      errEl.classList.remove("hidden");
      return;
    }

    const btn = document.getElementById("btn-do-transfer");
    pendingTransfer = {
      toBankCode: btn.dataset.targetBank,
      toBranchCode: btn.dataset.targetBranch,
      toAccountNumber: btn.dataset.targetAcno,
      toName: btn.dataset.targetName,
      amount: amount
    };

    // Direct transfer - 2FA removed
    await doTransfer(pendingTransfer);
  });
}

function findAccount(bankCode, branchCode, accountNumber) {
  for (const [userId, state] of Object.entries(DUMMY_DATA.accounts)) {
    const info = state.accountInfo;
    if (info.bankCode === bankCode && info.branchCode === branchCode && info.accountNumber === accountNumber) {
      return info;
    }
  }
  return null;
}

async function doTransfer(t) {
  const fromState = getState();
  const toEntry = Object.entries(DUMMY_DATA.accounts).find(([, s]) =>
    s.accountInfo.bankCode === t.toBankCode &&
    s.accountInfo.branchCode === t.toBranchCode &&
    s.accountInfo.accountNumber === t.toAccountNumber
  );
  if (!toEntry) return;
  const [toId, toState] = toEntry;

  const now = today();
  // Deduct from sender
  fromState.accountInfo.balance -= t.amount;
  fromState.transactions.unshift({
    id: "tx_" + uuid(), date: now,
    description: `振込（${t.toName}）`,
    amount: t.amount, type: "withdrawal"
  });
  // Add to receiver
  toState.accountInfo.balance += t.amount;
  toState.transactions.unshift({
    id: "tx_" + uuid(), date: now,
    description: `振込受入（${fromState.accountInfo.ownerName}）`,
    amount: t.amount, type: "deposit"
  });

  pendingTransfer = null;
  await pushServerState();
  showSuccess(
    "振込が完了しました",
    `${t.toName} 様へ\n${fmt(t.amount)}`,
    () => { renderMyPage(); renderTransferScreen(); showScreen("mypage"); }
  );
}

// =========================================================
// SAVINGS
// =========================================================
const INTEREST_RATES = { 6: 0.10, 12: 0.15, 24: 0.18, 36: 0.20, 60: 0.25 };
let selectedTermMonths = 12;
let selectedSavingsType = "FIXED";

function getInterestRate(months) {
  return INTEREST_RATES[months] || 0.10;
}

function renderSavingsScreen() {
  const state = getState();
  const totalSavings = state.savingsAccounts.reduce((s, a) => s + a.amount, 0);
  const summaryCard = document.getElementById("savings-summary-card");
  if (summaryCard) {
    summaryCard.innerHTML = `
      <div class="bank-card-balance-label">定期・積立 合計残高</div>
      <div class="bank-card-balance">${fmt(totalSavings)}</div>
      <div style="opacity:0.65;font-size:13px">保有口座数: ${state.savingsAccounts.length}口</div>
    `;
  }

  renderSavingsList();

  const balanceCard = document.getElementById("savings-balance-card");
  if (balanceCard) {
    balanceCard.innerHTML = `
      <div class="info-card-label">引出元口座（普通預金）</div>
      <div class="info-card-balance">ご利用可能残高: ${fmt(state.accountInfo.balance)}</div>
    `;
  }
}

function renderSavingsList() {
  const state = getState();
  const container = document.getElementById("savings-list-container");
  if (!container) return;
  if (state.savingsAccounts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 0">
        <div style="font-size:48px;margin-bottom:12px;opacity:0.3">💰</div>
        <p style="color:var(--text-light);margin-bottom:20px">現在、定期・積立のご契約はありません。</p>
        <button class="btn-primary" onclick="switchSavingsTab('savings-apply')" style="padding:0 24px;width:auto;height:44px;font-size:14px">新しく始める</button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.savingsAccounts.map(sv => {
    const isFixed = sv.type === "FIXED";
    const label = isFixed ? "定期" : "積立";
    const name = isFixed ? "定期預金" : "積立定期預金";
    const matLabel = { AUTO_RENEW_WITH_INTEREST:"元利自動継続", AUTO_RENEW_PRINCIPAL_ONLY:"元金自動継続", AUTO_CANCEL:"自動解約" }[sv.maturityInstruction];
    let extraRows = "";
    if (!isFixed && sv.monthlyDepositAmount) {
      extraRows += `
        <div class="savings-detail-row"><span class="savings-detail-label">毎月の積立額</span><span class="savings-detail-value">${fmt(sv.monthlyDepositAmount)}</span></div>
        <div class="savings-detail-row"><span class="savings-detail-label">振替指定日</span><span class="savings-detail-value">毎月 ${sv.depositDay} 日</span></div>
      `;
    }
    return `
      <div class="savings-item" id="sv-item-${sv.id}">
        <div class="savings-item-header" onclick="toggleSavingsItem('${sv.id}')">
          <div class="savings-item-left">
            <span class="savings-type-badge ${isFixed ? 'fixed' : 'acc'}">${label}</span>
            <div>
              <div class="savings-name">${name}</div>
              <div class="savings-maturity">満期日: ${fmtDate(sv.maturityDate)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="savings-amount">${fmt(sv.amount)}</span>
            <span id="sv-chevron-${sv.id}" style="font-size:20px;transition:transform 0.2s">▼</span>
          </div>
        </div>
        <div class="savings-item-body" id="sv-body-${sv.id}">
          <div class="savings-detail-row"><span class="savings-detail-label">金利</span><span class="savings-detail-value">${sv.interestRate}%（年利）</span></div>
          <div class="savings-detail-row"><span class="savings-detail-label">預入期間</span><span class="savings-detail-value">${sv.termMonths}ヶ月</span></div>
          <div class="savings-detail-row"><span class="savings-detail-label">預入開始日</span><span class="savings-detail-value">${fmtDate(sv.startDate)}</span></div>
          <div class="savings-detail-row"><span class="savings-detail-label">満期時の取扱</span><span class="savings-detail-value">${matLabel}</span></div>
          ${extraRows}
          <div style="margin-top:14px">
            <button class="btn-danger full-width" style="height:44px;font-size:14px" onclick="confirmCancelSavings('${sv.id}','${name}','${fmt(sv.amount)}')">この口座を解約する</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function toggleSavingsItem(id) {
  const body = document.getElementById("sv-body-" + id);
  const chev = document.getElementById("sv-chevron-" + id);
  const isOpen = body.classList.toggle("open");
  if (chev) chev.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
}

function confirmCancelSavings(id, name, amtStr) {
  showConfirm(
    "定期・積立の解約",
    `この${name}を解約しますか？\n解約された資金（${amtStr}）は即座に普通預金口座に戻されます。\n※中途解約利率が適用されます。`,
    "解約する",
    () => cancelSavings(id)
  );
}

async function cancelSavings(id) {
  const state = getState();
  const sv = state.savingsAccounts.find(s => s.id === id);
  if (!sv) return;
  state.accountInfo.balance += sv.amount;
  const typeLabel = sv.type === "FIXED" ? "定期解約" : "積立解約";
  state.transactions.unshift({
    id: "tx_" + uuid(), date: today(),
    description: `${typeLabel}（元金払戻）`,
    amount: sv.amount, type: "deposit"
  });
  state.savingsAccounts = state.savingsAccounts.filter(s => s.id !== id);
  await pushServerState();
  showSuccess("解約が完了しました", "普通預金口座に資金が払い戻されました。", () => {
    renderSavingsScreen();
    switchSavingsTab("savings-list");
  });
}

function switchSavingsTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  const tabBtn = document.getElementById("tab-" + tabId);
  const tabContent = document.getElementById(tabId);
  if (tabBtn) tabBtn.classList.add("active");
  if (tabContent) tabContent.classList.add("active");
}

function initSavings() {
  const btnBack = document.getElementById("btn-savings-back");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      renderMyPage();
      showScreen("mypage");
    });
  }

  const tabList = document.getElementById("tab-savings-list");
  if (tabList) tabList.addEventListener("click", () => switchSavingsTab("savings-list"));

  const tabApply = document.getElementById("tab-savings-apply");
  if (tabApply) tabApply.addEventListener("click", () => {
    renderSavingsApplyBalance();
    switchSavingsTab("savings-apply");
  });

  const goApply = document.getElementById("savings-go-apply");
  if (goApply) goApply.addEventListener("click", () => {
    renderSavingsApplyBalance();
    switchSavingsTab("savings-apply");
  });

  const typeFixed = document.getElementById("sv-type-fixed");
  if (typeFixed) typeFixed.addEventListener("click", () => setSavingsType("FIXED"));

  const typeAcc = document.getElementById("sv-type-acc");
  if (typeAcc) typeAcc.addEventListener("click", () => setSavingsType("ACCUMULATION"));

  const termChips = document.getElementById("term-chips");
  if (termChips) {
    termChips.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      selectedTermMonths = parseInt(chip.dataset.months);
      document.getElementById("interest-rate-val").textContent = getInterestRate(selectedTermMonths) + "%";
    });
  }

  const btnApply = document.getElementById("btn-sv-apply");
  if (btnApply) btnApply.addEventListener("click", doApplySavings);
}

function setSavingsType(type) {
  selectedSavingsType = type;
  document.getElementById("sv-type-fixed").classList.toggle("active", type === "FIXED");
  document.getElementById("sv-type-acc").classList.toggle("active", type === "ACCUMULATION");
  document.getElementById("sv-fixed-fields").classList.toggle("hidden", type !== "FIXED");
  document.getElementById("sv-acc-fields").classList.toggle("hidden", type !== "ACCUMULATION");
}

function renderSavingsApplyBalance() {
  const state = getState();
  const card = document.getElementById("savings-balance-card");
  if (card) {
    card.innerHTML = `
      <div class="info-card-label">引出元口座（普通預金）</div>
      <div class="info-card-balance">ご利用可能残高: ${fmt(state.accountInfo.balance)}</div>
    `;
  }
}

async function doApplySavings() {
  const errEl = document.getElementById("sv-apply-error");
  errEl.classList.add("hidden");
  const state = getState();

  const type = selectedSavingsType;
  const maturityInstruction = document.getElementById("sv-maturity").value;
  const interestRate = getInterestRate(selectedTermMonths);

  let amount, monthlyAmount = null, depositDay = null;

  if (type === "FIXED") {
    amount = parseInt(document.getElementById("sv-amount").value) || 0;
    if (amount <= 0) { errEl.textContent = "預入金額を入力してください。"; errEl.classList.remove("hidden"); return; }
    if (amount > state.accountInfo.balance) { errEl.textContent = "普通預金の残高が不足しています。"; errEl.classList.remove("hidden"); return; }
  } else {
    monthlyAmount = parseInt(document.getElementById("sv-monthly").value) || 0;
    amount = parseInt(document.getElementById("sv-total").value) || monthlyAmount * selectedTermMonths;
    depositDay = parseInt(document.getElementById("sv-day").value);
    if (monthlyAmount <= 0) { errEl.textContent = "毎月の積立額を入力してください。"; errEl.classList.remove("hidden"); return; }
    if (monthlyAmount > state.accountInfo.balance) { errEl.textContent = "普通預金の残高が不足しています。"; errEl.classList.remove("hidden"); return; }
  }

  const startDate = today();
  const maturityDate = addMonths(startDate, selectedTermMonths);
  const deduction = type === "FIXED" ? amount : monthlyAmount;
  const typeLabel = type === "FIXED" ? "定期預入" : "積立新規";

  state.accountInfo.balance -= deduction;
  state.transactions.unshift({
    id: "tx_" + uuid(), date: startDate,
    description: `${typeLabel}（金利 ${interestRate}%）`,
    amount: deduction, type: "withdrawal"
  });

  const newSv = {
    id: "sv_" + uuid(),
    type, amount, interestRate,
    termMonths: selectedTermMonths,
    startDate, maturityDate, maturityInstruction,
    monthlyDepositAmount: monthlyAmount,
    depositDay
  };
  state.savingsAccounts.push(newSv);

  document.getElementById("sv-amount").value = "";
  document.getElementById("sv-monthly").value = "";
  document.getElementById("sv-total").value = "";

  await pushServerState();

  const fmtDeduction = fmt(deduction);
  const typeName = type === "FIXED" ? "定期預金" : "積立定期預金";
  showSuccess(
    "預入の申し込みが完了しました",
    `${typeName}を開設しました。\n初回差引金額: ${fmtDeduction}`,
    () => {
      renderSavingsScreen();
      switchSavingsTab("savings-list");
    }
  );
}

// =========================================================
// SETTINGS
// =========================================================
function renderSettingsScreen() {
  document.getElementById("settings-portal").classList.remove("hidden");
  document.getElementById("settings-2fa").classList.add("hidden");
  document.getElementById("settings-header-title").textContent = "各種お手手続き";
}

function initSettings() {
  document.getElementById("btn-settings-back").addEventListener("click", () => {
    const twoFaView = document.getElementById("settings-2fa");
    if (twoFaView && !twoFaView.classList.contains("hidden")) {
      document.getElementById("settings-portal").classList.remove("hidden");
      twoFaView.classList.add("hidden");
      document.getElementById("settings-header-title").textContent = "各種お手続き";
    } else {
      renderMyPage();
      showScreen("mypage");
    }
  });

  // Hide 2FA entry point in settings
  const go2fa = document.getElementById("settings-go-2fa");
  if (go2fa) go2fa.style.display = "none";
}

// =========================================================
// CONFIRM MODAL
// =========================================================
function initConfirmModal() {
  document.getElementById("btn-confirm-cancel").addEventListener("click", () => {
    document.getElementById("modal-confirm").classList.add("hidden");
    pendingConfirmCallback = null;
  });
  document.getElementById("btn-confirm-ok").addEventListener("click", () => {
    document.getElementById("modal-confirm").classList.add("hidden");
    if (pendingConfirmCallback) {
      pendingConfirmCallback();
      pendingConfirmCallback = null;
    }
  });
}

// =========================================================
// INIT
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initMyPage();
  initTransfer();
  initSavings();
  initSettings();
  initConfirmModal();
});
