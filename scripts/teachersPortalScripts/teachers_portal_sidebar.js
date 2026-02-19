
const sidebarContent = `
    <div class="logo">TeachSmart</div>
    <ul class="sidebar-menu">
        <li><a href="./teachersPortal.html" class="nav-item">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg>
            Dashboard
        </a></li>
        <li><a href="./listOfStudents.html" class="nav-item">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Students
        </a></li>
        <li><a href="./curriculum.html" class="nav-item">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
            Scheme of Work
        </a></li>
        <li><a href="./attendance.html" class="nav-item">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Attendance
        </a></li>
        <li><a href="./upload_results.html" class="nav-item">
             <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
            Upload Results
        </a></li>
        <li><a href="#" class="nav-item">
            <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><circle cx="12" cy="16" r="1"></circle><circle cx="12" cy="21" r="1"></circle><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            AI Assistant
        </a></li>
    </ul>

    <div class="user-section">
        <div class="user-info">
            <div class="user-avatar">MJ</div>
            <span>Mrs. Johnson</span>
        </div>
        <button class="logout-btn">Logout</button>
    </div>
`;

document.addEventListener("DOMContentLoaded", () => {
    const sidebarElement = document.querySelector('[data-sideBar]');
    if (sidebarElement) {
        sidebarElement.innerHTML = sidebarContent;

        const currentPath = window.location.pathname;
        const navLinks = sidebarElement.querySelectorAll('.nav-item');

        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href').replace('./', '');

            // Check for match
            if (linkHref !== "#" && currentPath.endsWith(linkHref)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
});
