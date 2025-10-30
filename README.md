# InnovaTech: Comprehensive School Management System

---

## What is InnovaTech?

**InnovaTech** is a modern, web-based School Management System designed to streamline educational administration and enhance the learning experience for students, teachers, and parents. Built with a focus on user-friendly interfaces and comprehensive functionality, EduHub provides:

- **Multi-Role Dashboards** – Dedicated portals for students, teachers, parents, and school administrators.
- **Real-Time Analytics** – Track attendance, performance, and school metrics.
- **Interactive Learning Tools** – Study materials, schedules, and AI-powered study assistance.
- **Secure Authentication** – Role-based access with secure login for all users.
- **Responsive Design** – Accessible on desktop and mobile devices.

> Education management isn't complicated.  
> We simplifies school operations and empowers everyone with data-driven insights.

---

## Tech Stack & Tools

| Tool / Technology       | Purpose                                                                 |
|-------------------------|-------------------------------------------------------------------------|
| **HTML5**              | Structure and markup for all pages.                                     |
| **CSS3**               | Styling and responsive design across portals.                           |
| **JavaScript (ES6+)**  | Interactive functionality, DOM manipulation, and dynamic content.       |
| **Font Awesome**       | Icons for navigation and UI elements.                                   |
| **Supabase**           | Backend for authentication, data storage, and real-time updates.        |
| **Chart.js**           | Data visualization for analytics and reports.                           |
| **Local Storage**      | Client-side data persistence for user preferences.                      |

---

## Key Features

|  Feature                    | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| **Student Portal**           | Dashboard with class schedules, study materials, leaderboard, and social feed. |
| **Teacher Portal**           | Attendance tracking, student lists, and teaching resources.                 |
| **Parent Portal**            | Child's results, payment management, and communication with teachers.       |
| **Admin Dashboard**          | School-wide analytics, student/teacher management, and scheduling.          |
| **Secure Login**             | Role-based authentication for students, teachers, admins, and parents.      |
| **Responsive UI**            | Optimized for desktop, tablet, and mobile devices.                          |
| **Real-Time Updates**        | Live data synchronization using Supabase.                                   |
| **AI Study Buddy**           | Integrated AI assistant for student queries and learning support.           |

---

##  Project Structure

```plaintext
innovatech/
├── index.html                 # Main login page
├── assets/                    # Static assets (images, docs)
│   ├── Placeholder.txt
│   └── Readme.MD              # Placeholder README
├── html/                      # Portal pages
│   ├── signup.html            # Registration page
│   ├── studentsPortal/        # Student-specific pages
│   │   ├── studentPortal.html # Student dashboard
│   │   ├── schedule.html      # Class schedule
│   │   └── studyMaterials.html # Learning resources
│   ├── teachersPortal/        # Teacher-specific pages
│   │   ├── teachersPortal.html # Teacher dashboard
│   │   ├── attendance.html    # Attendance management
│   │   └── listOfStudents.html # Student roster
│   ├── parentsPortal/         # Parent-specific pages
│   │   ├── parentsPortal.html # Parent dashboard
│   │   ├── childsResult.html  # Child's academic results
│   │   └── payments.html      # Fee payments
│   └── schoolAdmin/           # Admin-specific pages
│       ├── schoolAdminDashboard.html # Admin dashboard
│       ├── students.html      # Student management
│       ├── teachers.html      # Teacher management
│       ├── schedule.html      # School scheduling
│       └── timeTable.html     # Timetable management
├── styles/                    # CSS stylesheets
│   ├── navbarStyles.css       # Navigation styles
│   ├── studentsPortalStyles/  # Student portal styles
│   ├── teachersPortalStyles/  # Teacher portal styles
│   ├── parentsPortalStyles/   # Parent portal styles
│   └── schoolAdminStyles/     # Admin portal styles
├── scripts/                   # JavaScript files
│   ├── config.js              # Configuration settings
│   ├── font-awesome.js        # Font Awesome integration
│   ├── graph.js               # Chart and graph utilities
│   ├── side.js                # Sidebar functionality
│   ├── sideBar.js             # Additional sidebar scripts
│   ├── studentProfileAchivement.js # Student achievements
│   ├── parentsPortalScripts/  # Parent portal scripts
│   ├── schoolAdminScripts/    # Admin portal scripts
│   └── teachersPortalScripts/ # Teacher portal scripts
└── trash/                     # Deprecated or backup files
    ├── chart.js
    └── chart2.js
```

---

## 🛠️ Local Dev Setup

1. **Clone the repository**

```bash
git clone <github.com/pepsiboy24/innovatech.git>
cd innovatech
```

2. **Open in browser**

Since this is a frontend-only project, simply open `index.html` in your web browser:

```bash
# On Windows
start index.html

# Or manually open index.html in your preferred browser
```

3. **For development with a local server** (optional, for better testing)

Install a simple HTTP server:

```bash
# Using Python (if installed)
python -m http.server 5500

# Or using Node.js
npx http-server
```

Then navigate to `http://localhost:5500` in your browser.

4. **Configure Supabase** (for backend features)

- Create a Supabase project at [supabase.com](https://supabase.com)
- Update `scripts/config.js` with your Supabase URL and API key

---

##  Testing

To test the application:

1. Open `index.html` in a web browser
2. Test login functionality (currently simulated)
3. Navigate through different portals
4. Verify responsive design on various screen sizes

For automated testing (if implemented):

```bash
# Placeholder for future test commands
npm test
```

---

##  Deployment

This project can be deployed to any static hosting service:

- **Netlify**: Drag and drop the project folder or connect via Git
- **GitHub Pages**: Enable Pages in repository settings
- **Vercel**: Import the project and deploy

Ensure all file paths are relative for proper asset loading.

---

##  Contribution

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request
6. We will respond in a jiffy.

---

##  Contact

- Project:  InnovaTech 
- Repository: [InnovaTech](https://github.com/Pepsiboy24/innovatech)
- Issues: [Here](https://github.com/Pepsiboy24/innovatech/issues)

---

## Final Words

InnovaTech represents the future of school management – efficient, accessible, and student-centered. By providing intuitive tools for all stakeholders, we aim to enhance educational outcomes and streamline administrative processes.

Let's build better schools.

---

**Built with ❤️ for Education**

[![Static Badge](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-blue)](https://github.com)
