import { supabaseClient } from './supabase_client.js';

export async function initializeSidebar() {
    const sidebarContainer = document.getElementById('sidebar-nav');
    if (!sidebarContainer) return;

    // 1. Get User Session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    // Safety: If no user or error, kick to login
    if (authError || !user) {
        console.warn("Unauthorized access attempt. Redirecting...");
        window.location.href = '/login.html';
        return;
    }

    // 2. Resolve the User Role (Database Check)
    let userRole = null;

    // Try Admin Table
    const { data: admin } = await supabaseClient
        .from('School_Admin')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (admin) {
        userRole = 'school_admin';
    } else {
        // Try Teacher Table
        const { data: teacher } = await supabaseClient
            .from('Teachers')
            .select('id')
            .eq('teacher_id', user.id) // Ensure this column name matches your DB
            .maybeSingle();

        if (teacher) userRole = 'teacher';
    }

    // 3. Define Menu Configurations (Absolute Paths)
    const menuConfig = {
        school_admin: [
            { title: "Dashboard", icon: "fa-th-large", path: "/html/schoolAdmin/dashboard.html" },
            { title: "Academic Manager", icon: "fa-book-open", path: "/html/schoolAdmin/academic_manager.html" },
            { title: "Manage All Notes", icon: "fa-folder-open", path: "/html/shared/manage_notes.html" }
        ],
        teacher: [
            { title: "Dashboard", icon: "fa-home", path: "/html/teacher/dashboard.html" },
            { title: "Upload Notes", icon: "fa-upload", path: "/html/teacher/upload_notes.html" },
            { title: "My Notes", icon: "fa-file-pdf", path: "/html/shared/manage_notes.html" }
        ]
    };

    // 4. Permission Check
    // If they aren't an Admin or Teacher, they shouldn't even see a menu here
    if (!userRole || !menuConfig[userRole]) {
        console.error("Access Denied: Role not recognized for this portal.");
        sidebarContainer.innerHTML = `<div class="error-msg">Access Denied</div>`;
        return;
    }

    // 5. Render the correct menu
    const links = menuConfig[userRole];
    renderLinks(sidebarContainer, links);
}

function renderLinks(container, links) {
    const currentPath = window.location.pathname;
    container.innerHTML = links.map(link => `
        <a href="${link.path}" class="nav-link ${currentPath === link.path ? 'active' : ''}">
            <i class="fas ${link.icon}"></i>
            <span>${link.title}</span>
        </a>
    `).join('');
}