import { supabase } from '../config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Link to Child (Demo logic)
  const childId = await getLinkedChildId();
  if (!childId) return;

  // 2. Fetch Grades
  await fetchChildGrades(childId);

  // 3. UI Setup
  setupSidebar();
});


async function getLinkedChildId() {
  // Demo: Fetch first student
  const { data, error } = await supabase
    .from('Students')
    .select('student_id, full_name, class_id')
    .limit(1)
    .single();

  if (error || !data) {
    console.error("Link error:", error);
    return null;
  }

  const userDetails = document.querySelector('.user-details p');
  if (userDetails) userDetails.textContent = `Parent of ${data.full_name}`;

  return data.student_id;
}


async function fetchChildGrades(childId) {
  // Fetch detailed grades
  const { data: grades, error } = await supabase
    .from('Grades')
    .select(`
            score,
            remarks,
            term,
            Subjects (subject_name)
        `)
    .eq('student_id', childId)
    .order('Subjects(subject_name)', { ascending: true }); // Order by subject

  if (error) {
    console.error('Error fetching grades:', error);
    return;
  }

  renderGradesTable(grades);
  calculateStats(grades);
}

function renderGradesTable(grades) {
  const tbody = document.getElementById('subjectGradesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!grades || grades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No grades recorded yet.</td></tr>';
    return;
  }

  grades.forEach(g => {
    const tr = document.createElement('tr');

    // Calculate Grade Letter
    let letter = 'F';
    let badgeClass = 'grade-f';
    const score = g.score;

    if (score >= 70) { letter = 'A'; badgeClass = 'grade-a'; }
    else if (score >= 60) { letter = 'B'; badgeClass = 'grade-b'; }
    else if (score >= 50) { letter = 'C'; badgeClass = 'grade-c'; }
    else if (score >= 45) { letter = 'D'; badgeClass = 'grade-d'; }
    else { letter = 'F'; badgeClass = 'grade-f'; }

    tr.innerHTML = `
            <td class="subject-name">${g.Subjects?.subject_name || 'Subject'}</td>
            <td>${g.term || '-'}</td>
            <td><strong>${score}/100</strong></td>
            <td><span class="grade-badge ${badgeClass}">${letter}</span></td>
            <td><span class="remarks">${g.remarks || '-'}</span></td>
        `;
    tbody.appendChild(tr);
  });
}

function calculateStats(grades) {
  if (!grades || grades.length === 0) return;

  // Average
  const total = grades.reduce((sum, g) => sum + g.score, 0);
  const avg = total / grades.length;

  const avgEl = document.getElementById('averageGrade');
  if (avgEl) avgEl.textContent = `${avg.toFixed(1)}%`;

  // We can't easily calculate "Class Position" without scanning whole class grades.
  // For now we will leave it or mock it if we wanted to be fancy.
  // Let's just set it to "-" or leave static if we didn't want to touch it, but we cleared it in HTML.
  const posEl = document.getElementById('classPosition');
  if (posEl) posEl.textContent = 'Calculated EOT';
}


function setupSidebar() {
  const mobileBtn = document.querySelector(".mobile-menu-btn");
  const sidebar = document.getElementById("sidebar");

  if (!mobileBtn || !sidebar) return;

  mobileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", function (e) {
    if (
      window.innerWidth <= 768 &&
      !sidebar.contains(e.target) &&
      !mobileBtn.contains(e.target) &&
      sidebar.classList.contains("open")
    ) {
      sidebar.classList.remove("open");
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("open");
    }
  });
}
