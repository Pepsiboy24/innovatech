// School Admin Form Handling
document.addEventListener('DOMContentLoaded', function() {
    const adminForm = document.getElementById('adminForm');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const submitBtn = document.getElementById('submitBtn');
    const backToEditBtn = document.getElementById('backToEditBtn');

    let currentStep = 0;
    const steps = ['step1', 'step2', 'step3'];

    // Navigation functions
    function updateSteps() {
        // Hide all steps
        steps.forEach((stepId, index) => {
            const stepEl = document.getElementById(stepId);
            if (stepEl) stepEl.classList.remove('active');

            const indicator = document.getElementById(`indicator${index + 1}`);
            if (indicator) indicator.classList.remove('active');
        });

        // Show current step
        document.getElementById(steps[currentStep]).classList.add('active');
        const currentIndicator = document.getElementById(`indicator${currentStep + 1}`);
        if (currentIndicator) currentIndicator.classList.add('active');

        // Update buttons
        prevBtn.style.display = currentStep === 0 ? 'none' : 'block';

        if (currentStep === steps.length - 1) {
            // Review Step
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
            populateReview();
        } else {
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
        }

        // Update progress
        document.getElementById('progressFill').style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    }

    function populateReview() {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('personalEmail').value;
        const phone = document.getElementById('mobilePhone').value;

        document.getElementById('reviewName').textContent = `${firstName} ${lastName}`;
        document.getElementById('reviewEmail').textContent = email;
        document.getElementById('reviewPhone').textContent = phone;
    }

    // Event listeners for navigation
    nextBtn.addEventListener('click', () => {
        if (validateCurrentStep()) {
            if (currentStep < steps.length - 1) {
                currentStep++;
                updateSteps();
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            updateSteps();
        }
    });

    // Form validation
    function validateCurrentStep() {
        const currentStepEl = document.getElementById(steps[currentStep]);
        const requiredFields = currentStepEl.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.style.borderColor = '#ef4444';
                isValid = false;
            } else {
                field.style.borderColor = '#d1d5db';
            }
        });

        // Additional validation for email
        if (currentStep === 1) { // Contact step
            const emailField = document.getElementById('personalEmail');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailField.value && !emailRegex.test(emailField.value)) {
                emailField.style.borderColor = '#ef4444';
                isValid = false;
            }
        }

        return isValid;
    }

    // Form submission
    adminForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!validateCurrentStep()) {
            return;
        }

        // Collect form data
        const formData = new FormData(adminForm);
        const adminData = {
            first_name: formData.get('firstName'),
            middle_name: formData.get('middleName'),
            last_name: formData.get('lastName'),
            date_of_birth: formData.get('dateOfBirth'),
            gender: formData.get('gender'),
            address: formData.get('address'),
            mobile_phone: formData.get('mobilePhone'),
            home_phone: formData.get('homePhone'),
            personal_email: formData.get('personalEmail'),
            emergency_contact_name: formData.get('emergencyContactName'),
            emergency_contact_relation: formData.get('emergencyContactRelation'),
            emergency_contact_phone: formData.get('emergencyContactPhone'),
            created_at: new Date().toISOString()
        };

        try {
            // Submit to database
            const result = await submitSchoolAdmin(adminData);

            if (result.success) {
                // Show success step
                document.getElementById('step3').classList.remove('active');
                document.getElementById('successStep').classList.add('active');
                submitBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            } else {
                // Show error step
                document.getElementById('step3').classList.remove('active');
                document.getElementById('errorStep').classList.add('active');
                document.getElementById('errorMessage').textContent = result.error;
                submitBtn.style.display = 'none';
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Form submission error:', error);
            // Show error step
            document.getElementById('step3').classList.remove('active');
            document.getElementById('errorStep').classList.add('active');
            document.getElementById('errorMessage').textContent = 'An unexpected error occurred. Please try again.';
            submitBtn.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    });

    // Back to edit button
    backToEditBtn.addEventListener('click', () => {
        document.getElementById('errorStep').classList.remove('active');
        document.getElementById('step3').classList.add('active');
        submitBtn.style.display = 'block';
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'none';
    });

    // Initialize
    updateSteps();
});
