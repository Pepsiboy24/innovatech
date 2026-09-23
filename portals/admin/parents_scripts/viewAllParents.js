import { supabase } from '../../../core/config.js';
import { waitForUser, renderToFragment, debounce } from '/core/perf.js';
import { showSkeleton, hideSkeleton } from '../../../assets/js-shared/ui-engine.js';

let allParents = [];
let currentSearchTerm = '';

async function fetchParents() {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;

        if (!userSchoolId) {
            console.error('User missing school_id in metadata');
            return [];
        }

        const { data, error } = await supabase
            .from('Parents')
            .select('*')
            .eq('school_id', userSchoolId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching parents:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching parents:', err);
        return [];
    }
}

function filterParents(parents, searchTerm) {
    if (!searchTerm) return parents;
    const term = searchTerm.toLowerCase();
    return parents.filter(p => {
        const fullName = (p.full_name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const phone = (p.phone_number || '').toLowerCase();
        return fullName.includes(term) || email.includes(term) || phone.includes(term);
    });
}

function getInitials(fullName) {
    if (!fullName) return '?';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

function renderParents(parents) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (parents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#6b7280;">No parents found.</td></tr>`;
        return;
    }

    const _rows = [];
    parents.forEach(parent => {
        const initials = getInitials(parent.full_name);
        const address = parent.address || 'N/A';
        const phone = parent.phone_number || 'N/A';
        
        const row = `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:16px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:50%; background:#f1f5f9; color:#475569; font-weight:600; display:flex; align-items:center; justify-content:center;">${initials}</div>
                        <div>
                            <h4 style="margin:0; font-size:14px; color:#0f172a; font-weight:600;">${parent.full_name || 'Unknown'}</h4>
                            <p style="margin:0; font-size:12px; color:#64748b;">${parent.occupation || 'Occupation Not Added'}</p>
                        </div>
                    </div>
                </td>
                <td style="padding:16px; font-size:14px; color:#334155;">${parent.email || 'N/A'}</td>
                <td style="padding:16px; font-size:14px; color:#334155;">${phone}</td>
                <td style="padding:16px; font-size:14px; color:#334155;">${address}</td>
                <td class="actions-cell" style="padding:16px; display:flex; gap:6px;">
                    <button class="btn-icon view-parent-btn" data-parent-id="${parent.parent_id}" title="View Details">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-icon edit-parent-btn" data-parent-id="${parent.parent_id}" title="Edit Parent">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon link-student-btn" data-parent-id="${parent.parent_id}" title="Link Student">
                        <i class="fa-solid fa-link"></i>
                    </button>
                </td>
            </tr>
        `;
                _rows.push(row);
    });
    renderToFragment(tbody, _rows);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading parents...');
    const tableBody = document.querySelector('.students-table tbody');

    if (tableBody) { showSkeleton(tableBody, 5, 'rows', 5); }
    try {
        allParents = await fetchParents();
    } finally {
        if (tableBody) { hideSkeleton(tableBody); }
    }
    
    function applyFilters() {
        const filtered = filterParents(allParents, currentSearchTerm);
        renderParents(filtered);
    }
    
    applyFilters();

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            currentSearchTerm = this.value.trim();
            applyFilters();
        }, 300));
    }

    // Modal Logistics
    window.openEditModal = function(parentId) {
        const parent = allParents.find(p => p.parent_id === parentId);
        if (!parent) return;

        document.getElementById('editParentId').value = parent.parent_id;
        document.getElementById('editParentName').value = parent.full_name || '';
        document.getElementById('editParentEmail').value = parent.email || '';
        document.getElementById('editParentPhone').value = parent.phone_number || '';
        document.getElementById('editParentOccupation').value = parent.occupation || '';
        document.getElementById('editParentAddress').value = parent.address || '';

        document.getElementById('editParentOverlay').style.display = 'block';
        document.getElementById('editParentModal').style.display = 'block';
    };

    window.closeEditModal = function() {
        document.getElementById('editParentOverlay').style.display = 'none';
        document.getElementById('editParentModal').style.display = 'none';
    };

    window.submitParentEdit = async function() {
        const id = document.getElementById('editParentId').value;
        const btn = document.getElementById('editSubmitBtn');

        if (!id) return;

        btn.disabled = true;
        btn.textContent = 'Saving...';

        const updates = {
            full_name: document.getElementById('editParentName').value.trim(),
            email: document.getElementById('editParentEmail').value.trim(),
            phone_number: document.getElementById('editParentPhone').value.trim(),
            occupation: document.getElementById('editParentOccupation').value.trim(),
            address: document.getElementById('editParentAddress').value.trim()
        };

        try {
            const { error } = await supabase
                .from('Parents')
                .update(updates)
                .eq('parent_id', id);

            if (error) throw error;

            if (typeof showToast === 'function') {
                showToast('Parent updated successfully!', 'success');
            } else {
                alert('Parent updated successfully!');
            }

            window.closeEditModal();
            
            // Refresh inline
            const refreshBody = document.querySelector('.students-table tbody');
            if (refreshBody) { showSkeleton(refreshBody, 5, 'rows', 5); }
            try {
                allParents = await fetchParents();
            } finally {
                if (refreshBody) { hideSkeleton(refreshBody); }
            }
            applyFilters();
        } catch (err) {
            console.error('Error updating parent:', err);
            if (typeof showToast === 'function') {
                showToast('Failed to update parent: ' + err.message, 'error');
            } else {
                alert('Failed to update parent!');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    };

    // View Parent modal — parent data + linked students from Parent_Student_Links
    window.closeViewModal = function() {
        document.getElementById('viewParentOverlay').style.display = 'none';
        document.getElementById('viewParentModal').style.display = 'none';
    };

    async function openParentDetails(parentId) {
        const parent = allParents.find(p => p.parent_id === parentId);
        if (!parent) return;

        const body = document.getElementById('viewParentBody');
        if (!body) return;

        document.getElementById('viewParentOverlay').style.display = 'block';
        document.getElementById('viewParentModal').style.display = 'block';
        body.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Loading...</div>';

        try {
            const { data: links, error } = await supabase
                .from('Parent_Student_Links')
                .select(`student_id, Students(full_name, class_id, Classes(class_name, section))`)
                .eq('parent_id', parentId)
                .order('created_at', { ascending: false });

            const students = (error ? [] : (links || []))
                .filter(l => l.Students)
                .map(l => l.Students);

            const studentItems = students.length === 0
                ? '<p style="font-size:14px; color:#64748b; margin:0;">No students linked to this parent yet.</p>'
                : `<ul style="margin:0; padding:0; list-style:none;">${students.map(s => {
                    const classText = s.Classes ? `${s.Classes.class_name || ''} ${s.Classes.section || ''}`.trim() : '';
                    return `
                        <li style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                            <i class="fa-solid fa-user-graduate" style="color:#6366f1;"></i>
                            <span style="font-size:14px; color:#334155;">${s.full_name || 'Unknown'}</span>
                            ${classText ? `<span style="background:#eef2ff; color:#4f46e5; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:600; margin-left:auto;">${classText}</span>` : ''}
                        </li>`;
                }).join('')}</ul>`;

            body.innerHTML = `
                <div style="display:flex; align-items:center; gap:14px; margin-bottom:22px;">
                    <div style="width:52px; height:52px; border-radius:50%; background:#eef2ff; color:#4f46e5; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:18px;">${getInitials(parent.full_name)}</div>
                    <div>
                        <h3 style="margin:0; font-size:17px; color:#0f172a;">${parent.full_name || 'Unknown'}</h3>
                        <p style="margin:4px 0 0; font-size:13px; color:#64748b;">${parent.occupation || 'Occupation Not Added'}</p>
                    </div>
                </div>
                <div style="display:grid; gap:14px;">
                    <div style="border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                        <label style="font-size:12px; font-weight:600; color:#475569; text-transform:uppercase;">Email</label>
                        <p style="margin:4px 0 0; font-size:14px; color:#334155; word-break:break-all;">${parent.email || 'N/A'}</p>
                    </div>
                    <div style="border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                        <label style="font-size:12px; font-weight:600; color:#475569; text-transform:uppercase;">Phone Number</label>
                        <p style="margin:4px 0 0; font-size:14px; color:#334155;">${parent.phone_number || 'N/A'}</p>
                    </div>
                    <div style="border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                        <label style="font-size:12px; font-weight:600; color:#475569; text-transform:uppercase;">Address</label>
                        <p style="margin:4px 0 0; font-size:14px; color:#334155;">${parent.address || 'N/A'}</p>
                    </div>
                </div>
                <hr style="border:0; border-top:1px solid #e2e8f0; margin:20px 0;">
                <h4 style="margin:0 0 12px; font-size:14px; color:#0f172a;">Linked Students</h4>
                ${studentItems}
            `;
        } catch (err) {
            console.error('Error loading parent details:', err);
            body.innerHTML = '<p style="color:#dc2626;">Failed to load linked students.</p>';
        }
    }

    // Row action buttons (delegated, survives re-renders)
    const parentsTbody = document.querySelector('.students-table tbody');
    if (parentsTbody) {
        parentsTbody.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-parent-btn');
            if (viewBtn) {
                e.preventDefault();
                openParentDetails(viewBtn.dataset.parentId);
                return;
            }

            const editBtn = e.target.closest('.edit-parent-btn');
            if (editBtn) {
                e.preventDefault();
                window.openEditModal(editBtn.dataset.parentId);
                return;
            }

            const linkBtn = e.target.closest('.link-student-btn');
            if (linkBtn) {
                e.preventDefault();
                showToast('Link Student — coming soon', 'info');
            }
        });
    }
});

export { fetchParents };
