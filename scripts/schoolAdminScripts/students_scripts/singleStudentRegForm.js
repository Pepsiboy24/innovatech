import { registerNewStudent } from "./singleStudentRegScript.js";

let currentStep = 1;
const totalSteps = 3;
const previousBtn = document.getElementById("prevBtn");
const nextBtns = document.getElementById("nextBtn");
const submitBtns = document.getElementById("submitBtn");

function updateProgress() {
  const progressFill = document.getElementById("progressFill");
  const percentage = (currentStep / totalSteps) * 100;
  progressFill.style.width = percentage + "%";
}

function updateStepIndicators() {
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById("indicator" + i);
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
  // Hide all steps
  const steps = document.querySelectorAll(".step");
  steps.forEach((s) => s.classList.remove("active"));

  // Show current step
  document.getElementById("step" + step).classList.add("active");

  // Update buttons
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const submitBtn = document.getElementById("submitBtn");

  if (step === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "block";
    submitBtn.style.display = "none";
  } else if (step === totalSteps) {
    prevBtn.style.display = "block";
    nextBtn.style.display = "none";
    submitBtn.style.display = "block";
  } else {
    prevBtn.style.display = "block";
    nextBtn.style.display = "block";
    submitBtn.style.display = "none";
  }

  updateProgress();
  updateStepIndicators();
}


function validateStep(step) {
  let isValid = true;

  if (step === 1) {
    const fullName = document.getElementById("fullName");
    const email = document.getElementById("email");
    const dateOfBirth = document.getElementById("dateOfBirth");
    const gender = document.querySelector('input[name="gender"]:checked');

    if (!fullName.value.trim()) {
      showError("fullNameError");
      isValid = false;
    } else {
      hideError("fullNameError");
    }

    if (!email.value.trim() || !email.validity.valid) {
      showError("emailError");
      isValid = false;
    } else {
      hideError("emailError");
    }

    if (!dateOfBirth.value) {
      showError("dobError");
      isValid = false;
    } else {
      hideError("dobError");
    }

    if (!gender) {
      showError("genderError");
      isValid = false;
    } else {
      hideError("genderError");
    }
  }

  if (step === 2) {
    const classField = document.getElementById("class");
    const admissionDate = document.getElementById("admissionDate");

    if (!classField.value) {
      showError("classError");
      isValid = false;
    } else {
      hideError("classError");
    }

    if (!admissionDate.value) {
      showError("admissionDateError");
      isValid = false;
    } else {
      hideError("admissionDateError");
    }
  }

  return isValid;
}
nextBtns.addEventListener("click", () => {
  changeStep(1);
});

previousBtn.addEventListener("click", () => {
  changeStep(-1);
});

// submitBtns.addEventListener("click", () => {
//   registerNewStudent("amramgadzama7@gmail.com", "Innovatech123!");
// });


function showError(errorId) {
  document.getElementById(errorId).style.display = "block";
}

function hideError(errorId) {
  // document.getElementById(errorId).style.display = "none";
}

function changeStep(direction) {
  if (direction === 1 && !validateStep(currentStep)) {
    return;
  }

  if (direction === 1 && currentStep === 2) {
    populateReview();
  }

  const newStep = currentStep + direction;
  if (newStep >= 1 && newStep <= totalSteps) {
    currentStep = newStep;
    showStep(currentStep);
  }
}

function populateReview() {
  const formData = new FormData(document.getElementById("registrationForm"));
  const reviewContent = document.getElementById("reviewContent");

  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const dateOfBirth = formData.get("dateOfBirth");
  const gender = formData.get("gender");
  const classValue = formData.get("class");
  const admissionDate = formData.get("admissionDate");

  const classText = document.querySelector(
    `option[value="${classValue}"]`
  ).textContent;

  reviewContent.innerHTML = `
                <h3 style="margin-bottom: 16px; color: #1e293b;">Personal Information</h3>
                <p><strong>Full Name:</strong> ${fullName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Date of Birth:</strong> ${new Date(
                  dateOfBirth
                ).toLocaleDateString()}</p>
                <p><strong>Gender:</strong> ${
                  gender.charAt(0).toUpperCase() + gender.slice(1)
                }</p>
                
                <h3 style="margin: 24px 0 16px; color: #1e293b;">Academic Details</h3>
                <p><strong>Class:</strong> ${classText}</p>
                <p><strong>Admission Date:</strong> ${new Date(
                  admissionDate
                ).toLocaleDateString()}</p>
            `;

  return {
    fullName,
    email,
    dateOfBirth,
    gender,
    classValue,
    admissionDate,
  };
}


function resetForm() {
  document.getElementById("registrationForm").reset();
  currentStep = 1;
  showStep(currentStep);
  document.getElementById("successStep").classList.remove("active");
}

// Form submission
// ... (code trimmed for brevity) ...
document
  .getElementById("registrationForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    if (validateStep(currentStep)) {
      const fullName = document.getElementById("fullName").value;
      const email = document.getElementById("email").value;
//       const password = document.getElementById("password").value; // Added password retrieval
      const dateOfBirth = document.getElementById("dateOfBirth").value;
      const admissionDate = document.getElementById("admissionDate").value;
      const profilePicUrl = "https://placehold.co/150x150/e8e8e8/363636?text=Profile"; // Placeholder URL
      
      const registrationResult = await registerNewStudent(fullName, email, "123456", dateOfBirth, admissionDate, profilePicUrl);

      if (registrationResult) {
        document.getElementById("step3").classList.remove("active");
        document.getElementById("successStep").classList.add("active");
        document.querySelector(".buttons").style.display = "none";
      } else {
        console.error("Registration failed. Please try again.");
      }
    }
  });
// ... (code trimmed for brevity) ...

// Set default admission date to today
document.getElementById("admissionDate").valueAsDate = new Date();

// Initialize
showStep(currentStep);
