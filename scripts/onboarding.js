import { supabase } from './config.js';

class SchoolOnboarding {
    constructor() {
        this.currentStep = 1;
        this.logoFile = null;
        this.formData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStepIndicator();
    }

    setupEventListeners() {
        const form = document.getElementById('onboardingForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // File input change handler
        const logoInput = document.getElementById('schoolLogo');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        }
    }

    updateStepIndicator() {
        const steps = document.querySelectorAll('.step');
        const progressFill = document.getElementById('progressFill');
        const progressBar = document.querySelector('.progress-bar');
        
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNumber < this.currentStep) {
                step.classList.add('completed');
            } else if (stepNumber === this.currentStep) {
                step.classList.add('active');
            }
        });

        // Update progress bar
        const progress = ((this.currentStep - 1) / 2) * 100;
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (progressBar) {
            progressBar.style.display = 'block';
        }

        // Show/hide sections based on current step
        this.updateFormSections();
    }

    updateFormSections() {
        const schoolInfoSection = document.getElementById('schoolInfoSection');
        const bankInfoSection = document.getElementById('bankInfoSection');
        const submitBtn = document.getElementById('btnText');

        if (this.currentStep === 1) {
            schoolInfoSection.style.display = 'block';
            bankInfoSection.style.display = 'none';
            submitBtn.textContent = 'Continue';
        } else if (this.currentStep === 2) {
            schoolInfoSection.style.display = 'none';
            bankInfoSection.style.display = 'block';
            submitBtn.textContent = 'Create School Account';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.currentStep === 1) {
            if (this.validateStep1()) {
                this.currentStep = 2;
                this.updateStepIndicator();
            }
        } else if (this.currentStep === 2) {
            if (this.validateStep2()) {
                await this.createSchoolAccount();
            }
        }
    }

    validateStep1() {
        const schoolName = document.getElementById('schoolName').value.trim();
        
        if (!schoolName) {
            this.showError('School name is required');
            return false;
        }

        if (schoolName.length < 3) {
            this.showError('School name must be at least 3 characters long');
            return false;
        }

        this.formData.schoolName = schoolName;
        this.hideMessages();
        return true;
    }

    validateStep2() {
        const bankName = document.getElementById('bankName').value.trim();
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const commissionRate = parseFloat(document.getElementById('commissionRate').value);

        if (!bankName) {
            this.showError('Bank name is required');
            return false;
        }

        if (!accountNumber) {
            this.showError('Account number is required');
            return false;
        }

        if (accountNumber.length < 8) {
            this.showError('Account number appears to be invalid');
            return false;
        }

        if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
            this.showError('Commission rate must be between 0 and 100');
            return false;
        }

        this.formData.bankName = bankName;
        this.formData.accountNumber = accountNumber;
        this.formData.bankCode = document.getElementById('bankCode').value.trim();
        this.formData.subAccountCode = document.getElementById('subAccountCode').value.trim();
        this.formData.commissionRate = commissionRate;

        this.hideMessages();
        return true;
    }

    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showError('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            this.showError('Logo file size must be less than 5MB');
            return;
        }

        this.logoFile = file;
        this.previewLogo(file);
    }

    previewLogo(file) {
        const preview = document.getElementById('logoPreview');
        const reader = new FileReader();

        reader.onload = (e) => {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="School Logo Preview">
                <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">
                    ${file.name} (${(file.size / 1024).toFixed(1)} KB)
                </p>
            `;
        };

        reader.readAsDataURL(file);
    }

    async createSchoolAccount() {
        const submitBtn = document.getElementById('submitBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const btnText = document.getElementById('btnText');

        try {
            // Show loading state
            submitBtn.disabled = true;
            loadingSpinner.style.display = 'inline-block';
            btnText.textContent = 'Creating Account...';

            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('User not authenticated. Please log in again.');
            }

            // Upload logo if provided
            let logoUrl = null;
            if (this.logoFile) {
                logoUrl = await this.uploadLogo(this.logoFile);
            }

            // Create school record
            const schoolData = {
                school_name: this.formData.schoolName,
                school_logo_url: logoUrl,
                bank_name: this.formData.bankName,
                account_number: this.formData.accountNumber,
                bank_code: this.formData.bankCode || null,
                sub_account_code: this.formData.subAccountCode || null,
                commission_rate: this.formData.commissionRate,
                is_active: true
            };

            const { data: school, error: schoolError } = await supabase
                .from('Schools')
                .insert([schoolData])
                .select()
                .single();

            if (schoolError) {
                throw new Error(`Failed to create school: ${schoolError.message}`);
            }

            // Create Monnify sub-account via Edge Function
            const monnifyData = await this.createMonnifySubAccount(school);

            // Update school with Monnify details
            if (monnifyData.success) {
                const { error: updateError } = await supabase
                    .from('Schools')
                    .update({
                        monnify_sub_account_code: monnifyData.subAccountCode,
                        monnify_api_key: monnifyData.apiKey
                    })
                    .eq('school_id', school.school_id);

                if (updateError) {
                    console.warn('Failed to update school with Monnify details:', updateError);
                }
            }

            // Create School_Admin record
            const adminData = {
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'School Admin',
                role: 'super_admin',
                permissions_json: { 
                    can_manage_school: true, 
                    can_manage_users: true, 
                    can_manage_payments: true,
                    can_manage_settings: true 
                },
                phone_number: user.phone || null,
                school_id: school.school_id
            };

            const { error: adminError } = await supabase
                .from('School_Admin')
                .insert([adminData]);

            if (adminError) {
                throw new Error(`Failed to create admin record: ${adminError.message}`);
            }

            // Update user metadata with school_id
            const { error: metadataError } = await supabase.auth.updateUser({
                data: { 
                    school_id: school.school_id,
                    school_name: school.school_name,
                    user_type: 'school_admin'
                }
            });

            if (metadataError) {
                console.warn('Failed to update user metadata:', metadataError);
            }

            this.showSuccess('School account created successfully! Redirecting to dashboard...');
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = './html/schoolAdmin/schoolAdminDashboard.html';
            }, 2000);

        } catch (error) {
            console.error('Onboarding error:', error);
            this.showError(error.message || 'Failed to create school account. Please try again.');
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            loadingSpinner.style.display = 'none';
            btnText.textContent = this.currentStep === 1 ? 'Continue' : 'Create School Account';
        }
    }

    async uploadLogo(file) {
        try {
            const fileName = `school-logos/${Date.now()}-${file.name}`;
            const { data, error } = await supabase.storage
                .from('school-assets')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw new Error(`Logo upload failed: ${error.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('school-assets')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Logo upload error:', error);
            throw error;
        }
    }

    async createMonnifySubAccount(school) {
        try {
            const { data, error } = await supabase.functions.invoke('create-monnify-subaccount', {
                body: {
                    schoolName: school.school_name,
                    schoolId: school.school_id,
                    bankName: school.bank_name,
                    accountNumber: school.account_number,
                    bankCode: school.bank_code,
                    splitCode: school.sub_account_code,
                    commissionRate: school.commission_rate
                }
            });

            if (error) {
                console.warn('Monnify sub-account creation failed:', error);
                return { success: false, error: error.message };
            }

            return { 
                success: true, 
                subAccountCode: data.subAccountCode, 
                apiKey: data.apiKey 
            };
        } catch (error) {
            console.error('Monnify API error:', error);
            return { success: false, error: error.message };
        }
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        const successElement = document.getElementById('successMessage');
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        successElement.style.display = 'none';
        
        // Scroll to top to show error
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showSuccess(message) {
        const errorElement = document.getElementById('errorMessage');
        const successElement = document.getElementById('successMessage');
        
        successElement.textContent = message;
        successElement.style.display = 'block';
        errorElement.style.display = 'none';
        
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    hideMessages() {
        const errorElement = document.getElementById('errorMessage');
        const successElement = document.getElementById('successMessage');
        
        errorElement.style.display = 'none';
        successElement.style.display = 'none';
    }
}

// Initialize onboarding when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SchoolOnboarding();
});

// Global function for file preview (called from HTML onclick)
window.previewLogo = function(event) {
    const onboarding = new SchoolOnboarding();
    onboarding.handleLogoUpload(event);
};
