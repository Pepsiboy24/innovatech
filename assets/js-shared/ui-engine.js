/**
 * ui-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Global UI utilities for skeleton loading and animations
 * Provides standardized skeleton loading across all portals
 * ─────────────────────────────────────────────────────────────────────────────
 */

let skeletonStylesheetInjected = false;

/**
 * Ensure the shared skeleton stylesheet is present once.
 * Self-contained: any page that imports ui-engine gets the styles it needs.
 */
function ensureSkeletonStyles() {
    if (skeletonStylesheetInjected) return;
    if (document.querySelector('link[href="/assets/css/skeleton.css"]')) {
        skeletonStylesheetInjected = true;
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/skeleton.css';
    document.head.appendChild(link);
    skeletonStylesheetInjected = true;
}

/**
 * Resolve a container from a string id OR an HTMLElement.
 * @param {string|HTMLElement} id
 * @returns {HTMLElement|null}
 */
function resolveContainer(id) {
    if (typeof id === 'string') return document.getElementById(id);
    if (id && typeof id === 'object' && id.nodeType) return id;
    return null;
}

/**
 * Show skeleton loading with animated shine placeholders
 * @param {string|HTMLElement} containerId - ID or element of container to inject skeleton into
 * @param {number} count - Number of skeleton items to show
 * @param {string} templateType - Type of skeleton template ('card','list','table','profile','stat','rows')
 * @param {number} [colCount=4] - Number of table columns for the 'rows' (tbody) template
 */
export function showSkeleton(containerId, count, templateType = 'card', colCount = 4) {
    ensureSkeletonStyles();
    const container = resolveContainer(containerId);
    if (!container) {
        console.warn(`[UI Engine] Container #${containerId} not found`);
        return;
    }

    console.log(`[UI Engine] Showing ${count} ${templateType} skeletons in #${containerId}`);

    // Clear existing content
    container.innerHTML = '';

    // Generate skeleton HTML based on template type
    const skeletonHTML = generateSkeletonHTML(count, templateType, colCount);
    
    // Inject skeleton with animation
    container.innerHTML = skeletonHTML;
    
    // Add loading state class
    container.classList.add('skeleton-loading');
    
    // Trigger shine animation
    requestAnimationFrame(() => {
        const shineElements = container.querySelectorAll('.skeleton-shine');
        shineElements.forEach(el => {
            el.style.animation = 'none';
            setTimeout(() => {
                el.style.animation = 'shine 2s ease-in-out infinite';
            }, Math.random() * 1000); // Stagger the animations
        });
    });
}

/**
 * Hide skeleton loading and restore actual content
 * @param {string} containerId - ID of container to restore
 */
export function hideSkeleton(containerId) {
    const container = resolveContainer(containerId);
    if (!container) return;

    container.classList.remove('skeleton-loading');

    // ✅ FIX: Make container visible (it may have been hidden with display:none)
    container.style.display = '';

    const skeletons = container.querySelectorAll('.skeleton-card, .skeleton-list, .skeleton-table, .skeleton-profile, .skeleton-stat, .skeleton-row');
    skeletons.forEach(skeleton => {
        skeleton.style.opacity = '0';
        setTimeout(() => {
            if (skeleton.parentNode) skeleton.remove();
        }, 300);
    });
}

/**
 * Generate skeleton HTML based on template type
 * @param {number} count - Number of skeleton items
 * @param {string} templateType - Type of template
 * @param {number} [colCount=4] - Table columns for the 'rows' template
 * @returns {string} HTML string for skeleton
 */
function generateSkeletonHTML(count, templateType, colCount = 4) {
    switch (templateType) {
        case 'card':
            return generateCardSkeletons(count);
        case 'list':
            return generateListSkeletons(count);
        case 'table':
            return generateTableSkeletons(count);
        case 'profile':
            return generateProfileSkeletons(count);
        case 'stat':
            return generateStatSkeletons(count);
        case 'rows':
            return generateTableRowSkeletons(count, colCount);
        default:
            return generateCardSkeletons(count);
    }
}

/**
 * Generate card skeleton placeholders
 * @param {number} count - Number of cards
 * @returns {string} HTML string
 */
function generateCardSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-shine skeleton-title"></div>
                </div>
                <div class="skeleton-content">
                    <div class="skeleton-shine skeleton-text"></div>
                    <div class="skeleton-shine skeleton-text skeleton-short"></div>
                    <div class="skeleton-shine skeleton-text skeleton-medium"></div>
                </div>
                <div class="skeleton-footer">
                    <div class="skeleton-shine skeleton-button"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Generate list skeleton placeholders
 * @param {number} count - Number of list items
 * @returns {string} HTML string
 */
function generateListSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-list">
                <div class="skeleton-shine skeleton-avatar"></div>
                <div class="skeleton-content">
                    <div class="skeleton-shine skeleton-text"></div>
                    <div class="skeleton-shine skeleton-text skeleton-short"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Generate table skeleton placeholders
 * @param {number} count - Number of table rows
 * @returns {string} HTML string
 */
function generateTableSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-table">
                <div class="skeleton-row">
                    <div class="skeleton-shine skeleton-cell skeleton-short"></div>
                    <div class="skeleton-shine skeleton-cell skeleton-medium"></div>
                    <div class="skeleton-shine skeleton-cell skeleton-long"></div>
                    <div class="skeleton-shine skeleton-cell skeleton-short"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Generate profile skeleton placeholders
 * @param {number} count - Number of profiles
 * @returns {string} HTML string
 */
function generateProfileSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-profile">
                <div class="skeleton-shine skeleton-avatar-large"></div>
                <div class="skeleton-content">
                    <div class="skeleton-shine skeleton-title"></div>
                    <div class="skeleton-shine skeleton-text"></div>
                    <div class="skeleton-shine skeleton-text skeleton-short"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Generate compact stat-tile skeleton placeholders (dashboard number cards)
 * @param {number} count - Number of tiles
 * @returns {string} HTML string
 */
function generateStatSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-stat">
                <div class="skeleton-shine skeleton-stat-label"></div>
                <div class="skeleton-shine skeleton-stat-number"></div>
            </div>
        `;
    }
    return html;
}

/**
 * Generate <tr> skeleton rows for real <tbody> containers.
 * Plain div skeletons break DOM structure inside a table, so rows
 * are emitted as actual table rows with a single shimmering cell.
 * @param {number} count - Number of rows
 * @param {number} colCount - Number of columns to span
 * @returns {string} HTML string
 */
function generateTableRowSkeletons(count, colCount = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <tr class="skeleton-row">
                <td class="skeleton-row-cell" colspan="${colCount}">
                    <div class="skeleton-shine skeleton-cell-line"></div>
                </td>
            </tr>
        `;
    }
    return html;
}

/**
 * Utility function to show loading state with custom message
 * @param {string} containerId - ID of container
 * @param {string} message - Custom loading message
 */
export function showLoading(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        </div>
    `;
}

/**
 * Utility function to hide loading state
 * @param {string} containerId - ID of container
 */
export function hideLoading(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const loadingState = container.querySelector('.loading-state');
    if (loadingState) {
        loadingState.style.opacity = '0';
        setTimeout(() => {
            loadingState.remove();
        }, 300);
    }
}

/**
 * Utility function to show empty state
 * @param {string} containerId - ID of container
 * @param {string} message - Empty state message
 * @param {string} icon - Font Awesome icon class
 */
export function showEmptyState(containerId, message = 'No data available', icon = 'fa-inbox') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="empty-message">
                <h3>${message}</h3>
                <p>Try adjusting your filters or check back later</p>
            </div>
        </div>
    `;
}

/**
 * Utility function to show error state
 * @param {string} containerId - ID of container
 * @param {string} message - Error message
 */
export function showErrorState(containerId, message = 'Something went wrong') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="error-message">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn-retry" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        </div>
    `;
}

// Export all functions for global use
export default {
    showSkeleton,
    hideSkeleton,
    showLoading,
    hideLoading,
    showEmptyState,
    showErrorState
};
