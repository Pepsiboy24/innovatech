import { supabase } from '../config.js';

// ---- Main Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  // For demo purposes, we will fetch the first student or a specific one
  const childId = await getLinkedChildId();
  if (!childId) return;

  await fetchRecentGrades(childId);
  await fetchOverallProgress(childId);

  // Sidebar listeners
  setupSidebar();
});


async function getLinkedChildId() {
  // Ideally, we fetch the parent's linked student.
  // Since we don't have that link, we'll fetch the first student in the DB.
  // Or check if a student is logged in (reusing student logic for demo).

  // Strategy: Fetch the first student from 'Students' table to simulate "Alex Smith"
  const { data, error } = await supabase
    .from('Students')
    .select('student_id, full_name')
    .limit(1)
    .single();

  if (error || !data) {
    console.error("Could not find a child record to link.", error);
    return null;
  }

  console.log(`Linked to child: ${data.full_name} (${data.student_id})`);

  // Update Header
  const userDetails = document.querySelector('.user-details p');
  if (userDetails) userDetails.textContent = `Parent of ${data.full_name}`;

  return data.student_id;
}


async function fetchRecentGrades(childId) {
  const { data: grades, error } = await supabase
    .from('Grades')
    .select(`
            score,
            date_recorded,
            term,
            Subjects (subject_name)
        `)
    .eq('student_id', childId)
    .order('date_recorded', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching recent grades:', error);
    return;
  }

  const container = document.getElementById('recentGradesContainer');
  if (!container) return;

  if (!grades || grades.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#666;">No recent grades found.</p>';
    return;
  }

  container.innerHTML = '';

  grades.forEach(grade => {
    const item = document.createElement('div');
    item.className = 'grade-item';
    item.innerHTML = `
            <div>
                <div class="grade-subject">${grade.Subjects?.subject_name || 'Subject'}</div>
                <div class="grade-type">${grade.term || 'Assessment'}</div>
            </div>
            <div class="grade-score">${grade.score}%</div>
        `;
    container.appendChild(item);
  });
}

let progressChartInstance = null;

async function fetchOverallProgress(childId) {
  // Fetch all grades to calculate average per month or term
  const { data: grades, error } = await supabase
    .from('Grades')
    .select('score, date_recorded')
    .eq('student_id', childId)
    .order('date_recorded', { ascending: true });

  if (error) {
    console.error('Error fetching progress:', error);
    return;
  }

  // Process data for chart
  // Simple approach: Group by Month of recorded date
  const monthlyData = {}; // "Jan": [85, 90], "Feb": [88]...

  grades.forEach(g => {
    const date = new Date(g.date_recorded);
    const month = date.toLocaleString('default', { month: 'short' });
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(g.score);
  });

  // Prepare Chart Data
  // Ensure chronological order if possible, but object keys might be mixed.
  // Let's use specific months array for labels to be safe/clean
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = [];
  const dataPoints = [];

  months.forEach(m => {
    if (monthlyData[m]) {
      const scores = monthlyData[m];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      labels.push(m);
      dataPoints.push(avg);
    }
  });

  // If no data, use some defaults or show empty
  if (labels.length === 0) {
    // Fallback to demo data or empty
    // console.log("No data for chart");
  }

  updateChart(labels, dataPoints);
}

function updateChart(labels, data) {
  const ctx = document.getElementById("progressChart");
  if (!ctx) return;

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  // If empty, show defaults for visual 
  if (labels.length === 0) {
    labels = ["Jan", "Feb", "Mar"];
    data = [0, 0, 0];
  }

  progressChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average Grade",
          data: data,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: "#e2e8f0",
            lineWidth: 1,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function setupSidebar() {
  // Mobile UX: Sidebar functionality
  const mobileBtn = document.querySelector(".mobile-menu-btn");
  const sidebar = document.getElementById("sidebar");

  // Ensure we are selecting the right elements
  if (!mobileBtn || !sidebar) return;

  // Remove existing listeners (crudely) by cloning or just adding new ones carefully
  // Since this script runs once, it's fine.

  mobileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  // Close sidebar when clicking outside on mobile
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

  // Handle window resize
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("open");
    }
  });
}
