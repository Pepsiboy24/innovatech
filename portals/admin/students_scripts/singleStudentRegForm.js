import { registerNewStudent } from "./singleStudentRegScript.js";
import { supabaseClient } from './supabase_client.js';
import { downloadCredentials } from './multipleStudentReg.js';

// --- State Management ---
let currentStep = 1;
const totalSteps = 3;

// --- DOM References ---
const registrationForm = document.getElementById("registrationForm");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const progressFill = document.getElementById("progressFill");

// --- 1. UI Flow Logic ---

function updateProgress() {
  const percentage = (currentStep / totalSteps) * 100;
  if (progressFill) progressFill.style.width = percentage + "%";
}

function updateStepIndicators() {
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById("indicator" + i);
    if (!indicator) continue;
    const circle = indicator.querySelector(".step-circle");

    if (i < currentStep) {
      indicator.className = "step-indicator completed";
      circle.innerHTML = "✓";
    } else if (i === currentStep) {
      indicator.className = "step-indicator active";
      circle.innerHTML = i;
    } else {
      indicator.className = "step-indicator";
      circle.innerHTML = i;
    }
  }
}

function showStep(step) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  const stepEl = document.getElementById("step" + step);
  if (stepEl) stepEl.classList.add("active");

  // Button Visibility
  prevBtn.style.display = step === 1 ? "none" : "block";
  nextBtn.style.display = step === totalSteps ? "none" : "block";
  submitBtn.style.display = step === totalSteps ? "block" : "none";

  updateProgress();
  updateStepIndicators();
}

// --- 2. Validation Logic ---

function validateStep(step) {
  let isValid = true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkField = (id, errorId) => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim() || (el.type === 'email' && !el.validity.valid && el.value !== "No Email in DB")) {
      showError(errorId);
      isValid = false;
    } else {
      hideError(errorId);
    }
  };

  if (step === 1) {
    checkField("fullName", "fullNameError");

    // DOB check
    const dob = document.getElementById("dateOfBirth");
    if (!dob.value || new Date(dob.value) > today) {
      showError("dobError");
      isValid = false;
    } else {
      hideError("dobError");
    }

    // Parent Fields - CRITICAL for fixing the NULL issue
    checkField("parentFullName", "parentFullNameError");
    checkField("parentPhone", "parentPhoneError");
    checkField("relationship", "relationshipError");

    // Parent email is optional, but if it is filled in it must be valid.
    const parentEmail = document.getElementById("parentEmail");
    const pe = parentEmail.value.trim();
    if (pe && pe !== "No Email in DB" && !parentEmail.validity.valid) {
      showError("parentEmailError");
      isValid = false;
    } else {
      hideError("parentEmailError");
    }

    // Parent phone must look like a real number (it is also their login if they have no email).
    const phoneDigits = document.getElementById("parentPhone").value.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      showError("parentPhoneError");
      isValid = false;
    }
  }

  if (step === 2) {
    checkField("class", "classError");
    const admit = document.getElementById("admissionDate");
    if (!admit.value) {
      showError("admissionDateError");
      isValid = false;
    } else {
      hideError("admissionDateError");
    }
  }

  return isValid;
}

// --- 3. Action Handlers ---

nextBtn.addEventListener("click", () => {
  if (validateStep(currentStep)) {
    if (currentStep === 2) populateReview();
    currentStep++;
    showStep(currentStep);
  }
});

prevBtn.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
});

function showError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function populateReview() {
  const reviewContent = document.getElementById("reviewContent");
  if (!reviewContent) return;

  const getValue = (id) => document.getElementById(id)?.value || "N/A";
  const classId = getValue("class");
  const classText = document.querySelector(`#class option[value="${classId}"]`)?.textContent || "Not Selected";

  reviewContent.innerHTML = `
        <div class="review-section">
            <h4>Student Information</h4>
            <p><strong>Name:</strong> ${getValue("fullName")}</p>
            <p><strong>Admission No:</strong> ${document.getElementById("admissionNumber")?.value || "Not given"}</p>
            <p><strong>DOB:</strong> ${getValue("dateOfBirth")}</p>
        </div>
        <div class="review-section">
            <h4>Guardian Information</h4>
            <p><strong>Name:</strong> ${getValue("parentFullName")}</p>
            <p><strong>Phone:</strong> ${getValue("parentPhone")}</p>
            <p><strong>Relationship:</strong> ${getValue("relationship")}</p>
        </div>
        <div class="review-section">
            <h4>Enrollment</h4>
            <p><strong>Class:</strong> ${classText}</p>
            <p><strong>Admission Date:</strong> ${getValue("admissionDate")}</p>
        </div>
    `;
}

// --- 4. Submission ---

registrationForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (!validateStep(currentStep)) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

  const clean = (v) => (v || "").trim() === "No Email in DB" ? "" : (v || "").trim();
  const parentData = {
    linkedParentId: document.getElementById("linkedParentId").value,
    parentFullName: document.getElementById("parentFullName").value.trim(),
    parentEmail: clean(document.getElementById("parentEmail").value),
    parentPhone: document.getElementById("parentPhone").value.trim(),
    parentAddress: document.getElementById("parentAddress").value.trim(),
    relationship: document.getElementById("relationship").value,
    parentOccupation: document.getElementById("parentOccupation").value.trim()
  };

  const result = await registerNewStudent({
    fullName: document.getElementById("fullName").value.trim(),
    dateOfBirth: document.getElementById("dateOfBirth").value,
    admissionDate: document.getElementById("admissionDate").value,
    admissionNumber: document.getElementById("admissionNumber").value.trim(),
    classId: document.getElementById("class").value,
    gender: document.querySelector('input[name="gender"]:checked')?.value || 'other',
    parentInfo: parentData
  });

  if (result && result.success) {
    lastCredentials = result.credentials;
    renderCredentials(result.credentials);
    document.getElementById("step3").classList.remove("active");
    document.getElementById("successStep").classList.add("active");
    const navButtons = document.getElementById("navButtons");
    if (navButtons) navButtons.style.display = "none";
    if (typeof window.refreshStudentList === 'function') window.refreshStudentList();
  } else {
    alert("Error: " + (result?.error || "Unknown error"));
    submitBtn.disabled = false;
    submitBtn.textContent = "Complete Registration";
  }
});

// --- 4a. One-time credentials display ---
let lastCredentials = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderCredentials(c) {
  const box = document.getElementById("credentialsBox");
  if (!box) return;
  let html = `
    <div><strong>Student:</strong> ${esc(c.full_name)}</div>
    <div><strong>Login:</strong> <code>${esc(c.login)}</code></div>
    <div><strong>Password:</strong> <code>${esc(c.password)}</code></div>`;
  if (c.parent && c.parent.created) {
    html += `<hr style="opacity:.2">
    <div><strong>Parent:</strong> ${esc(c.parent_name)}</div>
    <div><strong>Login:</strong> <code>${esc(c.parent.login)}</code></div>
    <div><strong>Password:</strong> <code>${esc(c.parent.password)}</code></div>`;
  } else if (c.parent) {
    html += `<hr style="opacity:.2"><div>Parent: linked to an existing parent account.</div>`;
  }
  if (c.class_matched === false) html += `<div style="color:#b45309;margin-top:6px;">Class was not matched, the student has no class yet.</div>`;
  (c.warnings || []).forEach((w) => { html += `<div style="color:#b45309;margin-top:6px;">${esc(w)}</div>`; });
  html += `<div style="margin-top:10px;font-size:12px;opacity:.75;">These passwords are shown only once. Each person must choose their own password the first time they sign in.</div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <button type="button" class="btn btn-secondary" id="copyCredsBtn">Copy</button>
      <button type="button" class="btn btn-secondary" id="downloadCredsBtn">Download CSV</button>
    </div>`;
  box.innerHTML = html;

  document.getElementById("copyCredsBtn").addEventListener("click", async () => {
    let t = `${c.full_name}\nLogin: ${c.login}\nPassword: ${c.password}`;
    if (c.parent && c.parent.created) t += `\n\nParent: ${c.parent_name}\nLogin: ${c.parent.login}\nPassword: ${c.parent.password}`;
    try { await navigator.clipboard.writeText(t); document.getElementById("copyCredsBtn").textContent = "Copied"; }
    catch (_) { alert(t); }
  });
  document.getElementById("downloadCredsBtn").addEventListener("click", () => {
    downloadCredentials([{
      success: true, full_name: c.full_name, login: c.login, password: c.password,
      class_matched: c.class_matched, warnings: c.warnings, parent: c.parent,
      data: { parent: { full_name: c.parent_name } },
    }], "student_login.csv");
  });
}

// --- 4b. Register Another / Done (success step) ---

const registerAnotherBtn = document.getElementById("registerAnotherBtn");
const doneBtn = document.getElementById("doneBtn");

if (registerAnotherBtn) {
  registerAnotherBtn.addEventListener("click", () => {
    registrationForm.reset();
    lastCredentials = null;
    const cb = document.getElementById("credentialsBox");
    if (cb) cb.innerHTML = "";
    document.getElementById("linkedParentId").value = "";
    ["parentFullName", "parentEmail", "parentPhone", "parentOccupation", "parentAddress"].forEach((id) => { document.getElementById(id).readOnly = false; });
    const psm = document.getElementById("parentSearchMessage");
    if (psm) psm.innerHTML = "";
    document.querySelectorAll(".error-message").forEach((el) => el.style.display = "none");
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Complete Registration";
    currentStep = 1;
    showStep(1);
    const navButtons = document.getElementById("navButtons");
    if (navButtons) navButtons.style.display = "";
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (doneBtn) {
  doneBtn.addEventListener("click", () => {
    const popup = document.getElementById("registrationPopup");
    if (popup) popup.style.display = "none";
  });
}

// --- 5. Parent Search ---

const searchParentBtn = document.getElementById("searchParentBtn");
if (searchParentBtn) {
  searchParentBtn.addEventListener("click", async () => {
    const phoneInput = document.getElementById("parentSearchPhone").value.trim();
    const msgDiv = document.getElementById("parentSearchMessage");

    if (!phoneInput) return;
    const last10 = phoneInput.replace(/\D/g, "").slice(-10);
    if (last10.length < 10) {
      msgDiv.textContent = "Enter the full phone number.";
      msgDiv.style.color = "#b45309";
      return;
    }

    try {
      // Match on the last 10 digits so 0802..., +234802... and 234802... all find the same parent.
      const { data: found, error } = await supabaseClient
        .from("Parents")
        .select("*")
        .ilike("phone_number", `%${last10}`)
        .limit(1);
      if (error) throw error;
      const data = found && found[0];

      const parentFields = ["parentFullName", "parentEmail", "parentPhone", "parentOccupation", "parentAddress", "linkedParentId"];

      if (data) {
        document.getElementById("linkedParentId").value = data.parent_id;
        document.getElementById("parentFullName").value = data.full_name;
        document.getElementById("parentEmail").value = data.email || "No Email in DB";
        document.getElementById("parentPhone").value = data.phone_number;
        document.getElementById("parentOccupation").value = data.occupation || "";
        document.getElementById("parentAddress").value = data.address || "";

        parentFields.forEach(id => { if (id !== "linkedParentId") document.getElementById(id).readOnly = true; });
        msgDiv.innerHTML = `<i class="fas fa-check-circle"></i> Existing parent linked.`;
        msgDiv.style.color = "green";
      } else {
        document.getElementById("linkedParentId").value = "";
        document.getElementById("parentPhone").value = phoneInput;
        parentFields.forEach(id => { if (id !== "linkedParentId") document.getElementById(id).readOnly = false; });
        msgDiv.innerHTML = "New parent. Please enter details below.";
        msgDiv.style.color = "#64748b";
      }
    } catch (err) {
      console.error(err);
    }
  });
}

// --- 6. Initialization ---
async function loadClasses() {
  const dropdown = document.getElementById("class");
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">Loading classes...</option>';

  const { data: classes, error } = await supabaseClient
    .from('Classes')
    .select('class_id, class_name, section')
    .order('class_name');

  if (error) {
    console.error('Could not load classes:', error);
    dropdown.innerHTML = '<option value="">Could not load classes (see console)</option>';
    return;
  }
  if (!classes || classes.length === 0) {
    dropdown.innerHTML = '<option value="">No classes yet. Create one on the Classes page first.</option>';
    return;
  }
  dropdown.innerHTML = '<option value="">Select a Class</option>' +
    classes.map(c => `<option value="${c.class_id}">${c.class_name} ${c.section || ''}</option>`).join('');
}

async function init() {
  showStep(currentStep);
  document.getElementById("admissionDate").valueAsDate = new Date();
  await loadClasses();
}

// This file can finish loading AFTER the page's DOMContentLoaded event has already fired
// (it waits on a top-level await import in singleStudentRegScript.js). In that case a
// DOMContentLoaded listener never runs, which left the class list empty.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
