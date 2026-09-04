import { supabase } from '../../core/config.js';

// Add error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// LocalStorage key used to cache the form so nothing is lost on reload/network failure
const DRAFT_KEY = 'eduhub_onboarding_draft';

// Wizard step sections (in order)
const STEPS = [
    { id: 'schoolInfoSection', label: 'School Info' },
    { id: 'adminAccountSection', label: 'Admin Account' },
    { id: 'academicSetupSection', label: 'Academic Setup' },
    { id: 'bankInfoSection', label: 'Logo & Bank' },
    { id: 'reviewSection', label: 'Review' },
];

const TIER_NAMES = { 1: 'Admin Core', 2: 'Student Engagement', 3: 'Full Connect' };

class SchoolOnboarding {
    constructor() {
        this.logoFile = null;
        this.formData = {};
        this.currentUser = null;
        this.authMode = 'new'; // 'new' = create account, 'existing' = already logged in
        this.completed = false;
        this.currentStep = 0;
        this.groups = []; // { id, name, levels: [], arms: [] }
        this.nextGroupId = 1;
        window.__onboarding = this;
        this.init();
    }

    init() {
        const hasDraft = this.restoreDraft();
        this.setupEventListeners();
        this.loadSavedData(hasDraft);

        // Show the form immediately — authentication is checked in the background
        this.goToStep(this.currentStep);
        this.enhanceWithAuth();
    }

    // ---------- Wizard navigation ----------

    get totalSteps() {
        return STEPS.length;
    }

    goToStep(index) {
        this.currentStep = Math.max(0, Math.min(this.totalSteps - 1, index));

        STEPS.forEach((step, i) => {
            const section = document.getElementById(step.id);
            if (section) section.classList.toggle('active', i === this.currentStep);

            const indicator = document.querySelector(`.step-indicator .step[data-step="${i}"]`);
            if (indicator) {
                indicator.classList.toggle('active', i === this.currentStep);
                indicator.classList.toggle('completed', i < this.currentStep);
            }
        });

        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${((this.currentStep + 1) / this.totalSteps) * 100}%`;
        }

        const btnBack = document.getElementById('btnBack');
        if (btnBack) btnBack.style.visibility = this.currentStep === 0 ? 'hidden' : 'visible';

        const btnNext = document.getElementById('btnNext');
        const submitBtn = document.getElementById('submitBtn');
        if (btnNext && submitBtn) {
            const isLast = this.currentStep === this.totalSteps - 1;
            btnNext.style.display = isLast ? 'none' : 'inline-flex';
            submitBtn.style.display = isLast ? 'inline-flex' : 'none';
        }

        if (this.currentStep === 2) this.applyLevelFilter();
        if (this.currentStep === 3) this.renderGroups();
        if (this.currentStep === 4) this.renderReview();

        this.hideMessages();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.saveDraft();
    }

    nextStep() {
        if (this.validateStep(this.currentStep)) {
            this.goToStep(this.currentStep + 1);
        }
    }

    // ---------- Draft caching (localStorage) ----------

    restoreDraft() {
        let draft = null;
        try {
            draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        } catch (e) {
            console.warn('Failed to restore onboarding draft:', e);
        }
        if (!draft) return false;

        const set = (id, value) => {
            if (value === null || value === undefined) return;
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        set('schoolName', draft.schoolName);
        set('schoolType', draft.schoolType);
        set('schoolWebsite', draft.schoolWebsite);
        set('schoolAddress', draft.schoolAddress);
        set('fullName', draft.fullName);
        set('workEmail', draft.workEmail);
        set('phoneNumber', draft.phoneNumber);
        set('gender', draft.gender);
        set('academicSession', draft.academicSession);
        set('currentTerm', draft.currentTerm);
        set('nextTermStartDate', draft.nextTermStartDate);
        set('bankName', draft.bankName);
        set('accountNumber', draft.accountNumber);
        set('bankCode', draft.bankCode);
        set('subAccountCode', draft.subAccountCode);
        set('commissionRate', draft.commissionRate);
        if (draft.tier) this.selectTier(draft.tier, true);

        if (Array.isArray(draft.classLevels)) {
            draft.classLevels.forEach(val => {
                const cb = document.querySelector(`.level-chip input[value="${val}"]`);
                if (cb) cb.checked = true;
            });
        }

        if (Array.isArray(draft.classGroups) && draft.classGroups.length) {
            this.groups = draft.classGroups.map((g, i) => ({
                id: this.nextGroupId++,
                name: g.name || `Group ${i + 1}`,
                levels: Array.isArray(g.levels) ? g.levels : [],
                arms: Array.isArray(g.arms) ? g.arms : [],
            }));
        }

        if (typeof draft.currentStep === 'number') this.currentStep = draft.currentStep;
        this.renderGroups();

        return true;
    }

    setupDraftAutoSave() {
        const form = document.getElementById('onboardingForm');
        if (!form) return;

        const save = () => this.saveDraft();
        form.addEventListener('input', save);
        form.addEventListener('change', save);

        // Safety net: also save if the user navigates away / refreshes
        window.addEventListener('beforeunload', () => {
            if (this.completed) return;
            this.saveDraft();
        });
    }

    saveDraft() {
        const val = (id) => document.getElementById(id)?.value || '';

        const checkedLevels = Array.from(document.querySelectorAll('.level-chip input:checked'))
            .map(cb => cb.value);

        const draft = {
            schoolName: val('schoolName'),
            schoolType: val('schoolType'),
            schoolWebsite: val('schoolWebsite'),
            schoolAddress: val('schoolAddress'),
            tier: parseInt(document.getElementById('tierSelect')?.value) || 1,
            fullName: val('fullName'),
            workEmail: val('workEmail'),
            phoneNumber: val('phoneNumber'),
            gender: val('gender'),
            academicSession: val('academicSession'),
            currentTerm: val('currentTerm'),
            nextTermStartDate: val('nextTermStartDate'),
            classLevels: checkedLevels,
            classGroups: this.groups.map(g => ({ name: g.name, levels: g.levels, arms: g.arms })),
            bankName: val('bankName'),
            accountNumber: val('accountNumber'),
            bankCode: val('bankCode'),
            subAccountCode: val('subAccountCode'),
            commissionRate: val('commissionRate'),
            currentStep: this.currentStep
        };

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (e) {
            console.warn('Failed to cache onboarding form:', e);
        }
    }

    clearDraft() {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (e) {
            console.warn('Failed to clear onboarding draft:', e);
        }
    }

    loadSavedData(hasDraft) {
        // Prefill fields from the earlier signup steps ONLY if the field is still empty
        const prefill = (id, value) => {
            if (!value) return;
            const el = document.getElementById(id);
            if (el && !el.value.trim()) el.value = value;
        };

        prefill('schoolName', sessionStorage.getItem('schoolName'));
        prefill('schoolType', sessionStorage.getItem('schoolType'));
        prefill('schoolWebsite', sessionStorage.getItem('schoolWebsite'));
        prefill('workEmail', sessionStorage.getItem('workEmail'));
        prefill('fullName', sessionStorage.getItem('fullName'));
        prefill('phoneNumber', sessionStorage.getItem('phoneNumber'));
        prefill('gender', sessionStorage.getItem('gender'));
        prefill('academicSession', sessionStorage.getItem('academicSession'));
        prefill('currentTerm', sessionStorage.getItem('currentTerm'));

        if (!hasDraft) {
            const tierEl = document.getElementById('tierSelect');
            const tier = parseInt(tierEl?.value)
                || parseInt(sessionStorage.getItem('selectedTier') || '1')
                || 1;
            this.selectTier(tier, true);
        }
    }

    async enhanceWithAuth() {
        try {
            // 1. Get current authenticated user (background, non-blocking)
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                // Not signed in — stay in new-account mode (password fields visible)
                console.log('User not authenticated — new account mode');
                return;
            }

            this.currentUser = user;

            // 2. If the user already manages a school, send them straight to their portal
            const { data: adminRecord } = await supabase
                .from('School_Admin')
                .select('school_id')
                .eq('email', user.email)
                .maybeSingle();

            if (adminRecord) {
                console.log('User already assigned to a school, redirecting to dashboard...');
                window.location.href = '../../portals/admin/schoolAdminDashboard.html';
                return;
            }

            // 3. Authenticated but no school yet — complete setup (password already exists)
            this.authMode = 'existing';
            const emailEl = document.getElementById('workEmail');
            if (emailEl && !emailEl.value.trim()) emailEl.value = user.email || '';

            const pwFields = document.getElementById('passwordFields');
            if (pwFields) pwFields.style.display = 'none';

            const hint = document.getElementById('accountHint');
            if (hint) hint.style.display = 'block';

        } catch (error) {
            // Never block the form on auth errors — fall back to new-account mode
            console.warn('Background auth check skipped:', error);
        }
    }

    selectTier(tier, silent) {
        tier = parseInt(tier) || 1;
        document.querySelectorAll('.tier-option').forEach(option => {
            option.classList.remove('selected');
        });
        const selected = document.querySelector(`[data-tier="${tier}"]`);
        if (selected) selected.classList.add('selected');
        const tierEl = document.getElementById('tierSelect');
        if (tierEl) tierEl.value = tier;
        if (!silent) this.saveDraft();
    }

    previewLogo(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type && !file.type.startsWith('image/')) {
            this.showError('Please upload an image file (PNG, JPG, SVG, etc.)');
            event.target.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.showError('Logo must be smaller than 2MB');
            event.target.value = '';
            return;
        }

        this.logoFile = file;
        const preview = document.getElementById('logoPreview');
        if (preview) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Logo Preview">`;
            };
            reader.readAsDataURL(file);
        }
    }

    // ---------- Academic class levels & groups ----------

    getCheckedLevels() {
        return Array.from(document.querySelectorAll('.level-chip input:checked'))
            .map(cb => cb.value);
    }

    applyLevelFilter() {
        const schoolType = document.getElementById('schoolType')?.value || '';
        const early = document.getElementById('levelSectionEarly');
        const primary = document.getElementById('levelSectionPrimary');
        const jss = document.getElementById('levelSectionJss');
        const ss = document.getElementById('levelSectionSs');

        if (schoolType === 'Secondary') {
            if (early) early.style.display = 'none';
            if (primary) primary.style.display = 'none';
            if (jss) jss.style.display = 'block';
            if (ss) ss.style.display = 'block';
        } else if (schoolType === 'Primary') {
            if (early) early.style.display = 'block';
            if (primary) primary.style.display = 'block';
            if (jss) jss.style.display = 'none';
            if (ss) ss.style.display = 'none';
        } else if (schoolType === 'Creche') {
            if (early) early.style.display = 'block';
            if (primary) primary.style.display = 'none';
            if (jss) jss.style.display = 'none';
            if (ss) ss.style.display = 'none';
        } else {
            if (early) early.style.display = 'block';
            if (primary) primary.style.display = 'block';
            if (jss) jss.style.display = 'block';
            if (ss) ss.style.display = 'block';
        }

        // Remove hidden checked levels from groups so generated classes stay valid
        const visibleValues = new Set(this.getCheckedLevels());
        const sections = [early, primary, jss, ss];
        sections.forEach(section => {
            if (section && section.style.display === 'none') {
                section.querySelectorAll('.level-chip input:checked').forEach(cb => {
                    visibleValues.delete(cb.value);
                    cb.checked = false;
                });
            }
        });
        this.groups.forEach(group => {
            group.levels = group.levels.filter(level => visibleValues.has(level));
        });

        this.renderGroups();
        this.saveDraft();
    }

    applySchoolTypeDefaults() {
        if (this.groups.length) return;
        const schoolType = document.getElementById('schoolType')?.value;

        const checkLevels = (values) => {
            values.forEach(val => {
                const cb = document.querySelector(`.level-chip input[value="${val}"]`);
                if (cb) cb.checked = true;
            });
        };

        if (schoolType === 'Secondary') {
            checkLevels(['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3']);
            this.groups.push({ id: this.nextGroupId++, name: 'Junior Classes', levels: ['JSS 1', 'JSS 2', 'JSS 3'], arms: ['A', 'B', 'C'] });
            this.groups.push({ id: this.nextGroupId++, name: 'Senior Classes', levels: ['SS 1', 'SS 2', 'SS 3'], arms: ['Science', 'Arts'] });
        } else if (schoolType === 'Primary') {
            checkLevels(['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6']);
            this.groups.push({ id: this.nextGroupId++, name: 'Primary Classes', levels: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'], arms: ['A', 'B', 'C'] });
        } else if (schoolType === 'Creche') {
            checkLevels(['Creche', 'Playgroup', 'Pre-Nursery', 'Nursery 1', 'Nursery 2', 'Nursery 3']);
            this.groups.push({ id: this.nextGroupId++, name: 'Early Years Classes', levels: ['Creche', 'Playgroup', 'Pre-Nursery', 'Nursery 1', 'Nursery 2', 'Nursery 3'], arms: ['A', 'B'] });
        } else {
            this.groups.push({ id: this.nextGroupId++, name: 'Class Group 1', levels: [], arms: ['A', 'B', 'C'] });
        }

        this.renderGroups();
        this.saveDraft();
    }

    renderGroups() {
        const container = document.getElementById('groupsContainer');
        if (!container) return;

        container.innerHTML = '';

        if (!this.groups.length) {
            this.groups.push({ id: this.nextGroupId++, name: 'Class Group 1', levels: [], arms: ['A', 'B', 'C'] });
        }

        const checkedLevels = this.getCheckedLevels();

        this.groups.forEach((group, index) => {
            const card = document.createElement('div');
            card.className = 'group-card';
            card.dataset.groupId = group.id;

            // Header: name + remove
            const header = document.createElement('div');
            header.className = 'group-header';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'group-name-input';
            nameInput.placeholder = `Group ${index + 1} name (e.g. Junior Classes)`;
            nameInput.value = group.name || '';
            nameInput.addEventListener('input', () => {
                group.name = nameInput.value.trim();
                this.saveDraft();
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-group-btn';
            removeBtn.title = 'Remove group';
            removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            removeBtn.addEventListener('click', () => {
                if (this.groups.length <= 1) {
                    this.showError('You need at least one class group.');
                    return;
                }
                this.groups = this.groups.filter(g => g.id !== group.id);
                this.renderGroups();
                this.saveDraft();
            });

            header.appendChild(nameInput);
            header.appendChild(removeBtn);

            // Arms input
            const armsLabel = document.createElement('label');
            armsLabel.textContent = 'Class Arms (comma separated)';
            armsLabel.style.cssText = 'font-size:13px;font-weight:500;color:#374151;display:block;margin-bottom:6px;';

            const armsInput = document.createElement('input');
            armsInput.type = 'text';
            armsInput.className = 'arms-input';
            armsInput.placeholder = 'e.g. A, B, C';
            armsInput.value = group.arms.join(', ');
            armsInput.addEventListener('input', () => {
                group.arms = armsInput.value.split(',').map(a => a.trim()).filter(Boolean);
                this.updatePreview();
                this.saveDraft();
            });

            const armsHelp = document.createElement('div');
            armsHelp.className = 'arms-help';
            armsHelp.textContent = 'Each arm × each level creates a class (e.g. JSS 1 A).';

            // Levels assignment chips
            const levelsLabel = document.createElement('label');
            levelsLabel.textContent = 'Assign Levels To This Group';
            levelsLabel.style.cssText = 'font-size:13px;font-weight:500;color:#374151;display:block;margin:14px 0 8px;';

            const chipsWrap = document.createElement('div');
            chipsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

            if (!checkedLevels.length) {
                const empty = document.createElement('span');
                empty.style.cssText = 'font-size:12px;color:#94a3b8;';
                empty.textContent = 'No levels selected — tick class levels above first.';
                chipsWrap.appendChild(empty);
            }

            checkedLevels.forEach(level => {
                const chip = document.createElement('span');
                const isAssigned = group.levels.includes(level);
                chip.textContent = level;
                chip.style.cssText = `padding:4px 10px;border-radius:99px;font-size:12px;cursor:pointer;border:1.5px solid ${isAssigned ? '#667eea' : '#cbd5e1'};background:${isAssigned ? '#667eea' : '#f1f5f9'};color:${isAssigned ? '#fff' : '#475569'};transition:all .2s ease;`;
                chip.addEventListener('click', () => {
                    const idx = group.levels.indexOf(level);
                    if (idx > -1) {
                        group.levels.splice(idx, 1);
                    } else {
                        group.levels.push(level);
                    }
                    this.renderGroups();
                    this.updatePreview();
                    this.saveDraft();
                });
                chipsWrap.appendChild(chip);
            });

            card.appendChild(header);
            card.appendChild(armsLabel);
            card.appendChild(armsInput);
            card.appendChild(armsHelp);
            card.appendChild(levelsLabel);
            card.appendChild(chipsWrap);

            container.appendChild(card);
        });

        this.updatePreview();
    }

    generateClasses() {
        const classes = [];
        this.groups.forEach(group => {
            (group.levels || []).forEach(level => {
                (group.arms || []).forEach(arm => {
                    classes.push({ name: `${level} ${arm}`, section: arm, level, group_name: group.name });
                });
            });
        });
        return classes;
    }

    updatePreview() {
        const preview = document.getElementById('classesPreview');
        if (!preview) return;
        const count = this.generateClasses().length;
        preview.textContent = count
            ? `${count} class${count !== 1 ? 'es' : ''} will be created`
            : '0 classes will be created';
    }

    // ---------- Validation ----------

    validateStep(step) {
        switch (step) {
            case 0: {
                const schoolName = (document.getElementById('schoolName')?.value || '').trim();
                const schoolType = document.getElementById('schoolType')?.value || '';
                if (schoolName.length < 3) {
                    this.showError('Please enter your school name (at least 3 characters).');
                    return false;
                }
                if (!schoolType) {
                    this.showError('Please select your school type.');
                    return false;
                }
                break;
            }
            case 1: {
                const fullName = (document.getElementById('fullName')?.value || '').trim();
                const workEmail = (document.getElementById('workEmail')?.value || '').trim();
                const phoneNumber = (document.getElementById('phoneNumber')?.value || '').trim();
                const password = document.getElementById('password')?.value || '';
                const confirmPassword = document.getElementById('confirmPassword')?.value || '';

                if (!fullName) {
                    this.showError('Please enter the admin full name.');
                    return false;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
                    this.showError('Please enter a valid work email address.');
                    return false;
                }
                if (phoneNumber.replace(/\D/g, '').length < 7) {
                    this.showError('Please enter a valid phone number.');
                    return false;
                }
                if (this.authMode === 'new') {
                    if (password.length < 6) {
                        this.showError('Password must be at least 6 characters.');
                        return false;
                    }
                    if (password !== confirmPassword) {
                        this.showError('Passwords do not match.');
                        return false;
                    }
                }
                break;
            }
            case 2: {
                const academicSession = (document.getElementById('academicSession')?.value || '').trim();
                const currentTerm = document.getElementById('currentTerm')?.value || '';
                const nextTermStartDate = document.getElementById('nextTermStartDate')?.value || '';

                if (!academicSession) {
                    this.showError('Please enter the academic session (e.g. 2025/2026).');
                    return false;
                }
                if (!currentTerm) {
                    this.showError('Please select the current term.');
                    return false;
                }
                if (!nextTermStartDate) {
                    this.showError('Please choose the next term start date.');
                    return false;
                }

                const checkedLevels = this.getCheckedLevels();
                if (!checkedLevels.length) {
                    this.showError('Please tick at least one class level.');
                    return false;
                }

                const emptyGroup = this.groups.find(g => !g.levels.length);
                if (emptyGroup) {
                    this.showError(`Group "${emptyGroup.name || 'unnamed'}" has no levels assigned.`);
                    return false;
                }
                const emptyArms = this.groups.find(g => !g.arms.length);
                if (emptyArms) {
                    this.showError(`Group "${emptyArms.name || 'unnamed'}" has no arms. Add at least one arm.`);
                    return false;
                }
                break;
            }
            case 3: {
                const bankName = (document.getElementById('bankName')?.value || '').trim();
                const accNum = (document.getElementById('accountNumber')?.value || '').trim();
                if (!bankName) {
                    this.showError('Please enter the school bank name.');
                    return false;
                }
                if (accNum.replace(/\D/g, '').length < 8) {
                    this.showError('Please enter a valid account number.');
                    return false;
                }
                break;
            }
            case 4: {
                const terms = document.getElementById('termsAgreement');
                if (terms && !terms.checked) {
                    this.showError('Please accept the Terms of Service to continue.');
                    return false;
                }
                break;
            }
        }

        this.hideMessages();
        return true;
    }

    validateForm() {
        for (let i = 0; i < this.totalSteps; i++) {
            if (!this.validateStep(i)) return false;
        }

        const val = (id) => (document.getElementById(id)?.value || '').trim();

        this.formData = {
            schoolName: val('schoolName'),
            schoolType: val('schoolType'),
            schoolWebsite: val('schoolWebsite'),
            schoolAddress: val('schoolAddress'),
            tier: parseInt(document.getElementById('tierSelect')?.value) || 1,
            fullName: val('fullName'),
            workEmail: val('workEmail'),
            phoneNumber: val('phoneNumber'),
            gender: val('gender'),
            academicSession: val('academicSession'),
            currentTerm: val('currentTerm'),
            nextTermStartDate: val('nextTermStartDate'),
            bankName: val('bankName'),
            accountNumber: val('accountNumber'),
            bankCode: val('bankCode'),
            subAccountCode: val('subAccountCode'),
            commissionRate: (() => {
                const rate = parseFloat(document.getElementById('commissionRate')?.value);
                return isNaN(rate) ? 1.5 : rate;
            })()
        };

        this.hideMessages();
        return true;
    }

    // ---------- Review ----------

    renderReview() {
        const grid = document.getElementById('reviewGrid');
        if (!grid) return;

        const val = (id) => document.getElementById(id)?.value.trim() || 'N/A';
        const tier = parseInt(document.getElementById('tierSelect')?.value) || 1;
        const classCount = this.generateClasses().length;

        const items = [
            ['School Name', val('schoolName')],
            ['School Type', val('schoolType')],
            ['Plan', TIER_NAMES[tier] || `Tier ${tier}`],
            ['Academic Session', val('academicSession')],
            ['Current Term', val('currentTerm')],
            ['Next Term Start', val('nextTermStartDate')],
            ['Classes To Create', String(classCount)],
            ['Admin Email', val('workEmail')],
            ['Bank', val('bankName') + (val('accountNumber') !== 'N/A' ? ` (${val('accountNumber')})` : '')],
        ];

        grid.innerHTML = items.map(([label, value]) => `
            <div class="review-item">
                <div class="label">${label}</div>
                <div class="value">${value}</div>
            </div>
        `).join('');
    }

    // ---------- Form submission ----------

    setupEventListeners() {
        const form = document.getElementById('onboardingForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const btnNext = document.getElementById('btnNext');
        if (btnNext) btnNext.addEventListener('click', () => this.nextStep());

        const btnBack = document.getElementById('btnBack');
        if (btnBack) btnBack.addEventListener('click', () => this.goToStep(this.currentStep - 1));

        const logoInput = document.getElementById('schoolLogo');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => this.previewLogo(e));
        }

        const schoolTypeEl = document.getElementById('schoolType');
        if (schoolTypeEl) {
            schoolTypeEl.addEventListener('change', () => {
                this.applyLevelFilter();
                this.applySchoolTypeDefaults();
            });
        }

        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => {
                this.groups.push({ id: this.nextGroupId++, name: '', levels: [], arms: ['A', 'B', 'C'] });
                this.renderGroups();
                this.saveDraft();
            });
        }

        // Level checkboxes: re-render group assignment chips + preview
        document.querySelectorAll('.level-chip input').forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    // Unchecking removes the level from every group that has it
                    this.groups.forEach(g => {
                        const idx = g.levels.indexOf(cb.value);
                        if (idx > -1) g.levels.splice(idx, 1);
                    });
                }
                this.renderGroups();
                this.updatePreview();
                this.saveDraft();
            });
        });

        // Select All / Deselect All buttons
        document.querySelectorAll('.select-all-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const grid = document.getElementById(btn.dataset.target);
                if (!grid) return;
                const cbs = Array.from(grid.querySelectorAll('input[type="checkbox"]'));
                const allChecked = cbs.every(c => c.checked);
                cbs.forEach(cb => {
                    cb.checked = !allChecked;
                    if (!cb.checked) {
                        this.groups.forEach(g => {
                            const idx = g.levels.indexOf(cb.value);
                            if (idx > -1) g.levels.splice(idx, 1);
                        });
                    }
                });
                btn.textContent = allChecked ? 'Select All' : 'Deselect All';
                this.renderGroups();
                this.updatePreview();
                this.saveDraft();
            });
        });

        this.setupDraftAutoSave();
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.currentStep < this.totalSteps - 1) {
            this.nextStep();
            return;
        }
        if (this.validateForm()) {
            await this.createSchoolAccount();
        }
    }

    async createSchoolAccount() {
        const submitBtn = document.getElementById('submitBtn');
        const loadingSpinner = document.getElementById('submitLoadingSpinner');
        const btnText = document.getElementById('btnText');

        try {
            if (submitBtn) submitBtn.disabled = true;
            if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
            if (btnText) btnText.textContent = 'Creating Account...';

            // ---- Resolve the authenticated user (create account if needed) ----
            if (this.authMode === 'new' && !this.currentUser) {
                const email = (document.getElementById('workEmail')?.value || '').trim();
                const password = document.getElementById('password')?.value || '';
                const fullName = (document.getElementById('fullName')?.value || '').trim();
                const phoneNumber = (document.getElementById('phoneNumber')?.value || '').trim();
                const gender = document.getElementById('gender')?.value || '';

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            phone_number: phoneNumber,
                            gender,
                            user_type: 'school_admin'
                        }
                    }
                });

                if (error) {
                    // If the email is already registered, sign in with the provided password
                    if (/already.*registered|email.*exist/i.test(error.message)) {
                        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                        if (signInError) throw new Error(`Account exists but login failed: ${signInError.message}`);
                        this.currentUser = signInData.user;
                    } else {
                        throw error;
                    }
                } else if (data.user) {
                    this.currentUser = data.user;
                }

                if (!this.currentUser) {
                    // Session could not be established (e.g. email confirmation enabled)
                    this.saveDraft();
                    this.showSuccess('Account created! Please confirm your email, then log in — your form is saved.');
                    setTimeout(() => {
                        window.location.href = "/public/html/login.html";
                    }, 2500);
                    return;
                }
            }

            if (!this.currentUser) throw new Error('Session expired. Please log in again.');

            // ---- Gather validated form data ----
            const schoolName = this.formData.schoolName
                || sessionStorage.getItem('schoolName')
                || (document.getElementById('schoolName')?.value.trim())
                || 'Unknown School';
            const workEmail = this.formData.workEmail
                || sessionStorage.getItem('workEmail')
                || this.currentUser.email
                || '';
            const fullName = this.formData.fullName
                || sessionStorage.getItem('fullName')
                || this.currentUser.user_metadata?.full_name
                || workEmail;
            const phoneNumber = this.formData.phoneNumber
                || sessionStorage.getItem('phoneNumber')
                || this.currentUser.user_metadata?.phone_number
                || '';
            const gender = this.formData.gender
                || sessionStorage.getItem('gender')
                || this.currentUser.user_metadata?.gender
                || '';

            let logoUrl = null;
            if (this.logoFile) {
                logoUrl = await this.uploadLogo(this.logoFile);
            }

            // 1. Insert into Schools table
            const { data: school, error: schoolError } = await supabase
                .from('Schools')
                .insert([{
                    school_name: schoolName,
                    school_type: this.formData.schoolType || null,
                    website: this.formData.schoolWebsite || null,
                    school_address: this.formData.schoolAddress || null,
                    school_logo_url: logoUrl,
                    bank_name: this.formData.bankName,
                    account_number: this.formData.accountNumber,
                    bank_code: this.formData.bankCode || null,
                    sub_account_code: this.formData.subAccountCode || null,
                    commission_rate: this.formData.commissionRate,
                    current_session: this.formData.academicSession,
                    current_term: this.formData.currentTerm,
                    next_term_start_date: this.formData.nextTermStartDate,
                    tier: this.formData.tier,
                    is_active: true,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (schoolError) throw new Error(`School creation failed: ${schoolError.message}`);

            // 2. Create School_Admin record
            const { error: adminError } = await supabase
                .from('School_Admin')
                .insert([{
                    email: workEmail,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    gender: gender,
                    role: 'super_admin',
                    school_id: school.school_id,
                    setup_completed: true,
                    setup_steps_json: { classes: true, profile: true, students: false, teachers: false },
                    permissions_json: { can_manage_school: true, can_manage_users: true }
                }]);

            if (adminError) throw new Error(`Admin assignment failed: ${adminError.message}`);

            console.log('✅ School_Admin record created successfully');

            // 3. Bulk create the generated classes
            const generatedClasses = this.generateClasses();
            if (generatedClasses.length) {
                const classRows = generatedClasses.map(cls => ({
                    class_name: cls.name,
                    section: cls.section,
                    school_id: school.school_id
                }));
                const { error: classesError } = await supabase.from('Classes').insert(classRows);
                if (classesError) {
                    console.warn('⚠️ Class bulk insert failed (school still created):', classesError.message);
                } else {
                    console.log(`✅ ${classRows.length} classes created`);
                }
            }

            // 4. CRITICAL: Update Auth Metadata for RLS compliance and tier persistence
            const { error: metadataError } = await supabase.auth.updateUser({
                data: {
                    school_id: school.school_id,
                    tier: parseInt(school.tier), // Ensure tier is an integer
                    user_type: 'school_admin'
                }
            });

            if (metadataError) {
                console.error('❌ Failed to update user metadata:', metadataError);
                throw new Error(`Metadata update failed: ${metadataError.message}`);
            }

            console.log('✅ User metadata updated - school_id:', school.school_id, 'tier:', school.tier);

            console.log('School created successfully with ID:', school.school_id);
            this.completed = true;
            this.clearDraft();
            this.showSuccess('School setup complete! Taking you to your dashboard...');

            setTimeout(() => {
                // Clear sessionStorage and take the new admin straight to their portal
                sessionStorage.clear();
                window.location.href = '../../portals/admin/schoolAdminDashboard.html';
            }, 2000);

        } catch (error) {
            console.error('Onboarding error:', error);
            this.showError(error.message);
            if (submitBtn) submitBtn.disabled = false;
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (btnText) btnText.textContent = 'Create School Account';
        }
    }

    // Helper methods for logo upload and UI messages
    async uploadLogo(file) {
        const fileName = `school-logos/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('school-assets').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('school-assets').getPublicUrl(fileName);
        return publicUrl;
    }

    showError(msg) {
        const el = document.getElementById('errorMessage');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
        const successEl = document.getElementById('successMessage');
        if (successEl) successEl.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showSuccess(msg) {
        const el = document.getElementById('successMessage');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
        const errEl = document.getElementById('errorMessage');
        if (errEl) errEl.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    hideMessages() {
        const errEl = document.getElementById('errorMessage');
        const sucEl = document.getElementById('successMessage');
        if (errEl) errEl.style.display = 'none';
        if (sucEl) sucEl.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => { new SchoolOnboarding(); });
