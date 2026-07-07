const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsxw4wpk4LC_QIq-7w8e8n8G1M1RLVY-CBo8RdKFJyDkCFuh5_0nO2oo_83XtlD4s/exec";

const notes = [
  "Everything is under control.",
  "You focus on your goals. I'll handle the details.",
  "Ready when you are.",
  "Your schedule looks good today.",
  "One less thing to worry about."
];

const prompts = {
  persona: 'คุณคือ "คุณเจน" เลขาส่วนตัวของคุณเกี่ยวก้อย\nสุภาพ อบอุ่น เป็นธรรมชาติ แบบ Executive Assistant\nไม่ใช่ chatbot และไม่ต้องพยายามเปลี่ยนทุกข้อความให้เป็นงาน',
  language: 'ใช้ "ค่ะ" เป็นคำลงท้ายหลัก\nใช้ "คะ" เฉพาะประโยคคำถาม/เรียกผู้ใช้\nห้ามใช้ "ค่า", "ค้าบ", "งับ"\nไม่ต้องลงท้ายทุกประโยค',
  calendar: 'ก่อนสร้างนัดต้องเช็ก conflict\nถ้าชนให้เสนอเวลาว่าง\nถ้าไม่บอกเวลาจบ ให้จบหลังเริ่ม 1 ชั่วโมง\nแยก Work / Personal ตามบริบท',
  reminder: '30 นาที = เตรียมตัว\n15 นาที = เช็กความพร้อม\n5 นาที = แจ้งสั้น ๆ\nห้ามพูด agenda ถ้าไม่ใช่งาน',
  memory: 'จำเฉพาะข้อมูลระยะยาว เช่น preference, people, places\nห้ามจำข้อมูลชั่วคราว\nถ้าไม่มั่นใจให้ถามก่อนจำ',
  safety: 'ห้ามเปิดเผย secret / token / API key\nการลบจำนวนมากต้องยืนยันก่อน\nError ต้องตอบสั้นและเข้าใจง่าย'
};

const promptKeyMap = {
  persona: "PROMPT_PERSONA",
  language: "PROMPT_LANGUAGE",
  calendar: "PROMPT_CALENDAR",
  reminder: "PROMPT_REMINDER",
  memory: "PROMPT_MEMORY",
  safety: "PROMPT_SAFETY"
};

const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");
const tabs = document.querySelectorAll(".tab");
const promptBox = document.getElementById("promptBox");
const toast = document.getElementById("toast");
const modal = document.getElementById("memoryModal");

let editingMemoryRow = null;

function setGreeting() {
  const h = new Date().getHours();
  let greeting = "Good Afternoon";

  if (h < 12) greeting = "Good Morning";
  else if (h >= 18 && h < 23) greeting = "Good Evening";
  else if (h >= 23 || h < 5) greeting = "Working late?";

  document.getElementById("mainGreeting").textContent = `${greeting}, Gyokoi 💜`;
  document.getElementById("sideGreeting").innerHTML = `${greeting},<br><span>Gyokoi 💜</span>`;
  document.getElementById("jenNote").textContent = notes[Math.floor(Math.random() * notes.length)];
}

function showPage(id) {
  pages.forEach(p => p.classList.toggle("active", p.id === id));
  navLinks.forEach(n => n.classList.toggle("active", n.dataset.page === id));
  location.hash = id;
}

function showToast(message = "🐰 Saved successfully 💜") {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("alicejens_theme", next);
}

async function loadDashboard() {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=dashboard`);
  const json = await res.json();

  if (!json.ok) return;

  const data = json.data;
  console.log("Dashboard:", data);

  document.getElementById("todayScheduleCount").textContent = data.todaySchedule.length;
  document.getElementById("todayScheduleText").textContent = `${data.todaySchedule.length} event(s) today`;

  document.getElementById("activeBotsCount").textContent = data.activeBots;
  document.getElementById("activeBotsText").textContent = "AliceJens Online";

  document.getElementById("memoryCount").textContent = data.memoryCount;
  document.getElementById("memoryText").textContent = `${data.memoryCount} active memories`;

  document.getElementById("conflictStatus").textContent = data.noConflict ? "Yes" : "No";
  document.getElementById("conflictText").textContent = data.noConflict ? "Schedule looks clean" : "Conflict detected";

  const timeline = document.getElementById("todayFlow");
  if (!timeline) return;

  timeline.innerHTML = "";

  data.todayFlow.forEach(item => {
    timeline.innerHTML += `
      <div class="time-item">
        <b>${item.start}</b>
        <span>${item.title}</span>
      </div>
    `;
  });
}

async function loadPrompt(tabName = "persona") {
  const key = promptKeyMap[tabName] || "PROMPT_PERSONA";

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "prompt",
        key
      })
    });

    const json = await res.json();
    console.log("Memory loading...");
    console.log(json);

    if (json.ok && json.value) {
      promptBox.value = json.value;
    } else {
      promptBox.value = prompts[tabName] || prompts.persona;
    }
  } catch (err) {
    promptBox.value = prompts[tabName] || prompts.persona;
  }
}

async function savePromptToBackend() {
  const activeTab = document.querySelector(".tab.active")?.dataset.tab || "persona";
  const key = promptKeyMap[activeTab] || "PROMPT_PERSONA";

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "savePrompt",
      key,
      value: promptBox.value
    })
  });

  prompts[activeTab] = promptBox.value;
  localStorage.setItem("alicejens_prompts", JSON.stringify(prompts));
  showToast("🐰 Prompt saved to backend 💜");
}

async function loadMemory() {
  console.log("① loadMemory");

  const res = await fetch(`${APPS_SCRIPT_URL}?action=memory`);
  console.log("② fetch", res);

  const json = await res.json();
  console.log("③ json", json);

  const tbody = document.getElementById("memoryTableBody");
  console.log("④ tbody", tbody);

  if (!json.ok) return;
  if (!tbody) return;

  tbody.innerHTML = "";

  (json.data || [])
    .filter(item => item.status === "active")
    .forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${item.category}</td>
          <td>${item.key}</td>
          <td>${item.value}</td>
          <td><span class="badge active">${item.status}</span></td>
          <td>
            <button onclick='editMemory(${item.id}, ${JSON.stringify(item.category)}, ${JSON.stringify(item.key)}, ${JSON.stringify(item.value)})'>✏️</button>
            <button onclick="deleteMemory(${item.id})">🗑️</button>
          </td>
        </tr>
      `;
    });
}

function editMemory(rowIndex, category, key, value) {
  editingMemoryRow = rowIndex;

  document.getElementById("memoryCategory").value = category;
  document.getElementById("memoryKey").value = key;
  document.getElementById("memoryValue").value = value;

  modal.classList.add("show");
}

function openMemoryModalForAdd() {
  editingMemoryRow = null;

  document.getElementById("memoryCategory").value = "";
  document.getElementById("memoryKey").value = "";
  document.getElementById("memoryValue").value = "";

  modal.classList.add("show");
}

async function saveMemoryFromModal() {
  const category = document.getElementById("memoryCategory").value;
  const key = document.getElementById("memoryKey").value;
  const value = document.getElementById("memoryValue").value;

  const payload = {
    action: editingMemoryRow ? "updateMemory" : "saveMemory",
    category,
    key,
    value
  };

  if (editingMemoryRow) {
    payload.rowIndex = editingMemoryRow;
  }

  modal.classList.remove("show");

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  editingMemoryRow = null;

  document.getElementById("memoryCategory").value = "";
  document.getElementById("memoryKey").value = "";
  document.getElementById("memoryValue").value = "";

  showToast("🐰 Memory saved 💜");
  loadMemory();
  loadDashboard();
}

async function deleteMemory(rowIndex) {
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteMemory",
      rowIndex
    })
  });

  showToast("Memory archived");
  loadMemory();
  loadDashboard();
}

navLinks.forEach(link => {
  link.addEventListener("click", () => showPage(link.dataset.page));
});

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    loadPrompt(tab.dataset.tab);
  });
});

document.querySelectorAll(".primary").forEach(btn => {
  if (btn.id && btn.id.includes("open")) return;
  if (btn.id === "savePrompt") return;
  if (btn.id === "saveMemoryBtn") return;

  btn.addEventListener("click", () => showToast());
});

document.getElementById("savePrompt")?.addEventListener("click", savePromptToBackend);
document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
document.getElementById("themeToggle2")?.addEventListener("click", toggleTheme);
document.getElementById("openMemoryModal")?.addEventListener("click", openMemoryModalForAdd);
document.getElementById("closeMemoryModal")?.addEventListener("click", () => modal.classList.remove("show"));
document.getElementById("saveMemoryBtn")?.addEventListener("click", saveMemoryFromModal);

modal?.addEventListener("click", e => {
  if (e.target === modal) modal.classList.remove("show");
});

const storedTheme = localStorage.getItem("alicejens_theme");
if (storedTheme) document.documentElement.dataset.theme = storedTheme;

const storedPrompts = localStorage.getItem("alicejens_prompts");
if (storedPrompts) {
  try {
    Object.assign(prompts, JSON.parse(storedPrompts));
  } catch (e) {}
}

function initApp() {
  setGreeting();

  const initial = location.hash?.replace("#", "");
  if (initial && document.getElementById(initial)) {
    showPage(initial);
  }

  loadDashboard();
  loadMemory();
  loadPrompt("persona");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
