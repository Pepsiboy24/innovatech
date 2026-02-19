import { supabase } from '../config.js';

// ---- Main Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  const studentId = await checkStudentLogin();
  if (!studentId) return;

  await fetchStudentData(studentId);
  await fetchTodaySchedule(studentId);
});

async function checkStudentLogin() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.log("No user logged in, redirecting...");
      // For dev purposes, maybe don't redirect if viewing file directly, but generally should.
      // window.location.href = '../../index.html'; 
      // Assuming we are testing, let's look for a student record for this user
      // If no user, maybe we can't do anything.
      return null;
    }

    // Check if user is a student
    const { data: student, error: studentError } = await supabase
      .from('Students')
      .select('student_id, class_id, full_name, total_points')
      .eq('student_id', user.id)
      .single();

    if (studentError || !student) {
      console.error("User is not a student", studentError);
      return null;
    }

    // Update welcome message
    const welcomeMsg = document.querySelector('.welcome-section h1');
    if (welcomeMsg) {
      welcomeMsg.innerHTML = `Welcome back, <span>${student.full_name}!</span>`;
    }

    return student.student_id;
  } catch (err) {
    console.error("Auth check failed", err);
    return null;
  }
}

// ---- Data Fetching & Rendering ----

async function fetchStudentData(studentId) {
  // 1. Get Student Details (Points, Class)
  const { data: student, error } = await supabase
    .from('Students')
    .select('*')
    .eq('student_id', studentId)
    .single();

  if (error) {
    console.error('Error fetching student data:', error);
    return;
  }

  // Update Points UI
  const pointsEl = document.getElementById('pointsValue');
  if (pointsEl) pointsEl.textContent = (student.total_points || 0).toLocaleString();

  // 2. Calculate Rank
  await calculateRank(student.class_id, student.total_points);

  // 3. Fetch Leaderboard
  await fetchLeaderboard(student.class_id);
}

async function calculateRank(classId, myPoints) {
  if (!classId) return;

  // Fetch all students in class, ordered by points desc
  const { data, error } = await supabase
    .from('Students')
    .select('student_id, total_points')
    .eq('class_id', classId)
    .order('total_points', { ascending: false });

  if (error) {
    console.error('Error calculating rank:', error);
    return;
  }

  // Find index
  // Note: This logic assumes simple ranking. 
  // If we have the student ID, we can find the index.
  // The previously fetched 'student' object has the ID. 
  // Wait, I need the current student ID again or pass it.
  // simpler: count how many students have MORE points than me.

  // Let's use the array approach since standard classes are small.
  // We need to know WHICH student is "me". 
  // I can get the user again or pass it. 
  // Let's assume the user is logged in, so `supabase.auth.getUser()` gives the ID.
  const { data: { user } } = await supabase.auth.getUser();

  const rankIndex = data.findIndex(s => s.student_id === user.id);
  const rank = rankIndex + 1; // 1-based

  // Suffix
  const suffix = (n) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  const rankEl = document.getElementById('rankValue');
  if (rankEl) rankEl.textContent = `${rank}${suffix(rank)}`;
}

async function fetchLeaderboard(classId) {
  if (!classId) return;

  const { data: students, error } = await supabase
    .from('Students')
    .select('full_name, total_points, profile_picture')
    .eq('class_id', classId)
    .order('total_points', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Leaderboard error:', error);
    return;
  }

  const container = document.getElementById('classLeaderboard');
  if (!container) return;

  container.innerHTML = ''; // Clear loading/static

  students.forEach((s, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    item.innerHTML = `
            <div class="leaderboard-left">
                <span class="rank-number">${index + 1}.</span>
                <div class="user-avatar">
                    ${s.profile_picture ? `<img src="${s.profile_picture}" style="width:100%;height:100%;border-radius:50%;">` : '<i class="fas fa-user"></i>'}
                </div>
                <span class="user-name">${s.full_name}</span>
            </div>
            <span class="points"><span>${(s.total_points || 0).toLocaleString()}</span> pts</span>
        `;
    container.appendChild(item);
  });
}

async function fetchTodaySchedule(studentId) {
  // 1. Get Student Class
  const { data: student } = await supabase.from('Students').select('class_id').eq('student_id', studentId).single();
  if (!student || !student.class_id) return;

  // 2. Get Today's Day Name (e.g., "Monday")
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];

  // 3. Fetch Timetable Entries for Class + Day
  const { data: entries, error } = await supabase
    .from('timetable_entries')
    .select(`
            start_time,
            duration_minutes,
            Subjects (
                subject_name
            )
        `)
    .eq('class_id', student.class_id)
    .eq('day_of_week', today)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Schedule error:', error);
    return;
  }

  renderSchedule(entries, today);
}

function renderSchedule(entries, dayName) {
  const container = document.getElementById('upcomingClassesGrid');
  if (!container) return;

  container.innerHTML = '';

  if (!entries || entries.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">No classes scheduled for today (${dayName}).</p>`;
    return;
  }

  entries.forEach(entry => {
    const subjectName = entry.Subjects?.subject_name || 'Unknown Subject';
    // Format Time
    // start_time is usually "HH:MM:SS"
    const timeParts = entry.start_time.split(':');
    const date = new Date();
    date.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
    const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    // Icon mapping (simple hash or random based on name)
    const icons = {
      'Mat': 'fa-calculator',
      'Eng': 'fa-book-open',
      'Sci': 'fa-flask',
      'Che': 'fa-flask',
      'Phy': 'fa-atom',
      'Bio': 'fa-dna',
      'His': 'fa-globe',
      'Geo': 'fa-mountain',
      'Art': 'fa-palette',
      'Mus': 'fa-music'
    };
    const iconKey = Object.keys(icons).find(k => subjectName.startsWith(k)) || 'Sci'; // Default
    const iconClass = icons[iconKey] || 'fa-book';

    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `
            <div class="class-header">
                <div class="class-icon" style="background: #e0f2fe; color: #0284c7;">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="class-info">
                    <h4>${subjectName}</h4>
                    <p>${entry.duration_minutes} mins</p>
                </div>
            </div>
            <div class="class-time">Today, ${timeString}</div>
            <button class="class-btn join-btn">Enter Class</button> 
        `;
    container.appendChild(card);
  });
}
