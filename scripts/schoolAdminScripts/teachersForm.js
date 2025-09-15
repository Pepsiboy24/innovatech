let currentStep = 1;
const totalSteps = 7;

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
  const errorMessages = [];
  const requiredFields = document.querySelectorAll(`#step${step} [required]`);

  // Clear previous error styling
  requiredFields.forEach((field) => {
    field.classList.remove("error");
    const errorMsg = field.parentNode.querySelector(".error-message");
    if (errorMsg) errorMsg.remove();
  });

  requiredFields.forEach((field) => {
    let fieldValid = true;
    let fieldName =
      field.previousElementSibling?.textContent?.replace(" *", "") ||
      field.name;

    if (field.type === "radio") {
      const radioGroup = document.querySelectorAll(
        `input[name="${field.name}"]`
      );
      const isChecked = Array.from(radioGroup).some((radio) => radio.checked);
      if (!isChecked) {
        fieldValid = false;
        errorMessages.push(`Please select ${fieldName}`);
        // Highlight the radio group container
        field.closest(".form-group").classList.add("error");
      }
    } else if (field.type === "checkbox") {
      const checkboxGroup = document.querySelectorAll(
        `input[name="${field.name}"]`
      );
      const isChecked = Array.from(checkboxGroup).some(
        (checkbox) => checkbox.checked
      );
      if (!isChecked) {
        fieldValid = false;
        errorMessages.push(`Please select at least one ${fieldName}`);
        // Highlight the checkbox group container
        field.closest(".form-group").classList.add("error");
      }
    } else if (!field.value.trim()) {
      fieldValid = false;
      errorMessages.push(`${fieldName} is required`);
      field.classList.add("error");
    }

    // Additional validation for specific fields
    if (fieldValid && field.value.trim()) {
      switch (field.type) {
        case "email":
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(field.value)) {
            fieldValid = false;
            errorMessages.push(`Please enter a valid email address`);
            field.classList.add("error");
          }
          break;
        case "tel":
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          if (!phoneRegex.test(field.value.replace(/[\s\-\(\)]/g, ""))) {
            fieldValid = false;
            errorMessages.push(`Please enter a valid phone number`);
            field.classList.add("error");
          }
          break;
        case "date":
          const date = new Date(field.value);
          const today = new Date();
          if (field.id === "dateOfBirth" && date >= today) {
            fieldValid = false;
            errorMessages.push(`Date of birth must be in the past`);
            field.classList.add("error");
          }
          if (field.id === "startDate" && date < today) {
            fieldValid = false;
            errorMessages.push(`Start date must be today or in the future`);
            field.classList.add("error");
          }
          break;
        case "number":
          if (field.id === "graduationYear") {
            const year = parseInt(field.value);
            const currentYear = new Date().getFullYear();
            if (year > currentYear) {
              fieldValid = false;
              errorMessages.push(`Graduation year cannot be in the future`);
              field.classList.add("error");
            }
          }
          break;
      }
    }

    if (!fieldValid) {
      isValid = false;
    }
  });

  // Display error messages
  if (!isValid) {
    const errorContainer = document.querySelector(
      `#step${step} .error-summary`
    );
    if (errorContainer) {
      errorContainer.remove();
    }

    const stepContainer = document.getElementById(`step${step}`);
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-summary";
    errorDiv.style.cssText = `
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 12px;
            border-radius: 6px;
            margin: 16px 0;
        `;
    errorDiv.innerHTML = `
            <strong>Please correct the following errors:</strong>
            <ul style="margin: 8px 0 0 20px;">
                ${errorMessages.map((msg) => `<li>${msg}</li>`).join("")}
            </ul>
        `;
    // stepContainer.insertBefore(
    //   errorDiv,
    //   stepContainer.querySelector(".form-group")
    // );

    // Scroll to top of step to show errors
    stepContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return isValid;
}

function changeStep(direction) {
  if (direction === 1 && !validateStep(currentStep)) {
    return;
  }

  if (direction === 1 && currentStep === 6) {
    populateReview();
  }

  const newStep = currentStep + direction;
  if (newStep >= 1 && newStep <= totalSteps) {
    currentStep = newStep;
    showStep(currentStep);

    // Scroll to top of new step
    document.getElementById(`step${currentStep}`).scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

function populateReview() {
  const formData = new FormData(document.getElementById("teacherForm"));
  const reviewContent = document.getElementById("reviewContent");

  // Helper function to get multiple checkbox values
  function getCheckboxValues(name) {
    const checkboxes = document.querySelectorAll(
      `input[name="${name}"]:checked`
    );
    return (
      Array.from(checkboxes)
        .map((cb) => cb.nextElementSibling.textContent)
        .join(", ") || "None selected"
    );
  }

  // Helper function to format display values
  function formatValue(value, type = "text") {
    if (!value || value.trim() === "") return "Not provided";

    switch (type) {
      case "date":
        return new Date(value).toLocaleDateString();
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      default:
        return value;
    }
  }

  let reviewHTML = `
        <h3 style="margin-bottom: 16px; color: #1e293b;">Personal Information</h3>
        <p><strong>Name:</strong> ${formatValue(
          formData.get("firstName")
        )} ${formatValue(formData.get("middleName") || "")} ${formatValue(
    formData.get("lastName")
  )}</p>
        <p><strong>Date of Birth:</strong> ${formatValue(
          formData.get("dateOfBirth"),
          "date"
        )}</p>
        <p><strong>Gender:</strong> ${formatValue(formData.get("gender"))}</p>

        <h3 style="margin: 24px 0 16px; color: #1e293b;">Contact Information</h3>
        <p><strong>Address:</strong> ${formatValue(formData.get("address"))}</p>
        <p><strong>Mobile:</strong> ${formatValue(
          formData.get("mobilePhone")
        )}</p>
        <p><strong>Home Phone:</strong> ${formatValue(
          formData.get("homePhone")
        )}</p>
        <p><strong>Email:</strong> ${formatValue(
          formData.get("personalEmail")
        )}</p>
        <p><strong>Emergency Contact:</strong> ${formatValue(
          formData.get("emergencyContactName")
        )} (${formatValue(
    formData.get("emergencyContactRelation")
  )}) - ${formatValue(formData.get("emergencyContactPhone"))}</p>

        <h3 style="margin: 24px 0 16px; color: #1e293b;">Qualifications</h3>
        <p><strong>Highest Degree:</strong> ${formatValue(
          formData.get("highestDegree")
        )}</p>
        <p><strong>Field of Study:</strong> ${formatValue(
          formData.get("degreeMajor")
        )}</p>
        <p><strong>Institution:</strong> ${formatValue(
          formData.get("institution")
        )}</p>
        <p><strong>Graduation Year:</strong> ${formatValue(
          formData.get("graduationYear")
        )}</p>
        <p><strong>Teaching License:</strong> ${formatValue(
          formData.get("teachingLicense")
        )}</p>
        <p><strong>License Expiry:</strong> ${formatValue(
          formData.get("licenseExpiry"),
          "date"
        )}</p>
        <p><strong>Certified Subjects:</strong> ${getCheckboxValues(
          "subjects"
        )}</p>
        <p><strong>Grade Levels:</strong> ${getCheckboxValues(
          "gradeLevels"
        )}</p>

        <h3 style="margin: 24px 0 16px; color: #1e293b;">Experience</h3>
        <p><strong>Total Experience:</strong> ${formatValue(
          formData.get("totalExperience")
        )}</p>
        <p><strong>Previous School:</strong> ${formatValue(
          formData.get("previousSchool")
        )}</p>
        <p><strong>Previous Position:</strong> ${formatValue(
          formData.get("previousPosition")
        )}</p>
        <p><strong>Duration:</strong> ${formatValue(
          formData.get("previousDuration")
        )}</p>
        <p><strong>Professional Development:</strong> ${formatValue(
          formData.get("professionalDevelopment")
        )}</p>

        <h3 style="margin: 24px 0 16px; color: #1e293b;">Employment</h3>
        <p><strong>Position:</strong> ${formatValue(
          formData.get("jobTitle")
        )}</p>
        <p><strong>Start Date:</strong> ${formatValue(
          formData.get("startDate"),
          "date"
        )}</p>
        <p><strong>Contract Type:</strong> ${formatValue(
          formData.get("contractType")
        )}</p>
        <p><strong>Annual Salary:</strong> ${
          formData.get("salary")
            ? formatValue(formData.get("salary"), "currency")
            : "Not provided"
        }</p>
        <p><strong>Specialized Roles:</strong> ${getCheckboxValues(
          "specializedRoles"
        )}</p>

        <h3 style="margin: 24px 0 16px; color: #1e293b;">Background & Medical</h3>
        <p><strong>Work Authorization:</strong> ${formatValue(
          formData.get("workAuthorization")
        )}</p>
        <p><strong>Background Check:</strong> ${formatValue(
          formData.get("backgroundCheck")
        )}</p>
        <p><strong>References:</strong> ${formatValue(
          formData.get("references")
        )}</p>
        <p><strong>Allergies:</strong> ${formatValue(
          formData.get("allergies")
        )}</p>
        <p><strong>Medical Conditions:</strong> ${formatValue(
          formData.get("medicalConditions")
        )}</p>
        <p><strong>Current Medications:</strong> ${formatValue(
          formData.get("medications")
        )}</p>
    `;

  reviewContent.innerHTML = reviewHTML;
}

function resetForm() {
  document.getElementById("teacherForm").reset();
  currentStep = 1;
  showStep(currentStep);
  document.getElementById("successStep").classList.remove("active");
  document.querySelector(".buttons").style.display = "flex";

  // Clear any error states
  document
    .querySelectorAll(".error")
    .forEach((el) => el.classList.remove("error"));
  document.querySelectorAll(".error-summary").forEach((el) => el.remove());
}

// Add click navigation to step indicators
function addStepIndicatorNavigation() {
  for (let i = 1; i <= totalSteps; i++) {
    const indicator = document.getElementById("indicator" + i);
    indicator.addEventListener("click", function () {
      // Only allow navigation to completed steps or the next step
      if (i <= currentStep) {
        currentStep = i;
        showStep(currentStep);
      } else if (i === currentStep + 1) {
        changeStep(1); // This will validate current step before moving
      }
    });

    // Add cursor pointer for clickable indicators
    indicator.style.cursor = "pointer";
  }
}

// Add input event listeners for real-time validation feedback
function addRealTimeValidation() {
  const inputs = document.querySelectorAll("input, select, textarea");
  inputs.forEach((input) => {
    input.addEventListener("blur", function () {
      // Clear error state when user starts correcting
      this.classList.remove("error");
      const errorMsg = this.parentNode.querySelector(".error-message");
      if (errorMsg) errorMsg.remove();
    });

    input.addEventListener("input", function () {
      // Clear error state when user starts typing
      this.classList.remove("error");
    });
  });
}

// Save form data to prevent loss on accidental page refresh
function saveFormData() {
  const formData = new FormData(document.getElementById("teacherForm"));
  const data = {};

  // Save regular form fields
  for (let [key, value] of formData.entries()) {
    if (data[key]) {
      // Handle multiple values (checkboxes)
      if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    } else {
      data[key] = value;
    }
  }

  data.currentStep = currentStep;

  try {
    // Note: In a real application, you might want to use sessionStorage
    // But for Claude artifacts, we'll use a variable
    window.tempFormData = data;
  } catch (e) {
    console.log("Cannot save form data");
  }
}

// Load saved form data
function loadFormData() {
  try {
    const data = window.tempFormData;
    if (data) {
      // Restore form fields
      for (let key in data) {
        if (key === "currentStep") continue;

        const elements = document.querySelectorAll(`[name="${key}"]`);
        elements.forEach((element) => {
          if (element.type === "checkbox" || element.type === "radio") {
            if (Array.isArray(data[key])) {
              element.checked = data[key].includes(element.value);
            } else {
              element.checked = element.value === data[key];
            }
          } else {
            element.value = data[key];
          }
        });
      }

      // Restore current step
      if (data.currentStep) {
        currentStep = data.currentStep;
        showStep(currentStep);
      }
    }
  } catch (e) {
    console.log("Cannot load form data");
  }
}

// Auto-save form data periodically
function startAutoSave() {
  setInterval(() => {
    saveFormData();
  }, 30000); // Save every 30 seconds
}

// Form submission
document.getElementById("teacherForm").addEventListener("submit", function (e) {
  e.preventDefault();

  if (!validateStep(currentStep)) {
    return;
  }

  // Show loading state
  const submitBtn = document.getElementById("submitBtn");
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Submitting...";
  submitBtn.disabled = true;

  // Simulate form submission
  setTimeout(() => {
    document.getElementById("step7").classList.remove("active");
    document.getElementById("successStep").classList.add("active");
    document.querySelector(".buttons").style.display = "none";

    // Clear saved data after successful submission
    window.tempFormData = null;

    // Reset submit button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }, 1500);
});

// Add keyboard navigation
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    const nextBtn = document.getElementById("nextBtn");
    const submitBtn = document.getElementById("submitBtn");

    if (nextBtn.style.display !== "none") {
      changeStep(1);
    } else if (submitBtn.style.display !== "none") {
      document.getElementById("teacherForm").dispatchEvent(new Event("submit"));
    }
  }
});

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  showStep(currentStep);
  addStepIndicatorNavigation();
  addRealTimeValidation();
  loadFormData();
  startAutoSave();
});
