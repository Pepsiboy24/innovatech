// Chart.js configuration for the progress chart
const ctx = document.getElementById("progressChart").getContext("2d");
const progressChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Average Grade",
        data: [85, 87, 86, 89, 90, 88],
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
        beginAtZero: false,
        min: 60,
        max: 100,
        grid: {
          color: "#e2e8f0",
          lineWidth: 1,
        },
        ticks: {
          font: {
            size: 12,
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          color: "#64748b",
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          color: "#64748b",
        },
      },
    },
    elements: {
      point: {
        hoverRadius: 8,
      },
    },
  },
});

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("open");
}

// Close sidebar when clicking outside on mobile
document.addEventListener("click", function (e) {
  const sidebar = document.getElementById("sidebar");
  const mobileBtn = document.querySelector(".mobile-menu-btn");

  if (
    window.innerWidth <= 768 &&
    !sidebar.contains(e.target) &&
    !mobileBtn.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }
});

// Handle window resize
window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  if (window.innerWidth > 768) {
    sidebar.classList.remove("open");
  }
});
