/**
 * studentProfileAchivement.js — Fixed for Student Profiles View & Guardian Linking
 */

import { supabase } from '../../scripts/config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const SKELETONS = [
  { skel: 'upcomingClassesSkeleton', content: 'upcomingClassesGrid' },
  { skel: 'subjectsSkeleton', content: 'subjectsGrid' },
  { skel: 'activitySkeleton', content: 'activityFeed' },
];

const SUBJECT_ICONS = {
  math: 'fa-calculator', english: 'fa-book-open', science: 'fa-flask',
  chemistry: 'fa-flask', physics: 'fa-atom', biology: 'fa-dna',
  history: 'fa-landmark', geography: 'fa-mountain', ict: 'fa-laptop-code',
  art: 'fa-palette', music: 'fa-music', civics: 'fa-balance-scale', default: 'fa-book',
};

function getSubjectIcon(name = '') {
  const lower = name.toLowerCase();
  const key = Object.keys(SUBJECT_ICONS).find(k => lower.includes(k));
  return SUBJECT_ICONS[key] || SUBJECT_ICONS.default;
}

function hideSkeleton(skelId, contentId) {
  const skel = document.getElementById(skelId);
  const cont = document.getElementById(contentId);
  if (skel) skel.style.display = 'none';
  if (cont) cont.style.display = '';
}

function forceHideAllSkeletons() {
  SKELETONS.forEach(({ skel, content }) => hideSkeleton(skel, content));
}

function updateSubtitle(text) {
  const el = document.getElementById('newNotesMsg');
  if (el) el.textContent = text;
}

function timeAgo(dateString) {
  if (!dateString) return 'Recently';
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fail-Safe Logic
// ─────────────────────────────────────────────────────────────────────────────
let failSafeTimer = null;
function startFailSafe() {
  failSafeTimer = setTimeout(() => {
    forceHideAllSkeletons();
    updateSubtitle("Mission Control: Some data is offline. Refreshing recommended.");
  }, 5000);
}

function clearFailSafe() {
  if (failSafeTimer) clearTimeout(failSafeTimer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  startFailSafe();

  try {
    const student = await initStudentSession();

    if (!student) {
      updateSubtitle("Identity check failed.");
      forceHideAllSkeletons();
      return;
    }

    await Promise.all([
      fetchStudentStats(student),
      fetchTodaySchedule(student.student_id, student.class_id),
      fetchMySubjects(student.class_id)
        .then(subjects => fetchLiveActivity(subjects))
        .catch(() => fetchLiveActivity([])),
    ]);

  } catch (outerErr) {
    console.error('[Dashboard] Crash:', outerErr);
    forceHideAllSkeletons();
  } finally {
    clearFailSafe();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Handshake (Fixed to use View & Guardian Data)
// ─────────────────────────────────────────────────────────────────────────────
async function initStudentSession() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    // Fetch from the VIEW 'student_profiles' to get the Auth Email automatically
    const { data: student, error: studentError } = await supabase
      .from('student_profiles')
      .select(`
          *,
          Classes(class_name),
          Parent_Student_Links(
              Parents(*)
          )
      `)
      .eq('student_id', user.id)
      .single();

    if (studentError || !student) {
      console.error('[Dashboard] lookup failed:', studentError?.message);
      return null;
    }

    // Update Identity UI
    const firstName = student.full_name?.split(' ')[0] || 'Student';
    document.getElementById('studentName').textContent = firstName;

    // Set Profile Initial
    const initEl = document.getElementById('profileInitial');
    if (initEl) initEl.textContent = student.full_name[0].toUpperCase();

    // Set Student Email Display (From the fixed View)
    const emailEl = document.getElementById('studentEmailDisplay');
    if (emailEl) emailEl.innerHTML = `<i class="fas fa-envelope"></i> ${student.email}`;

    // Update Subtitle with Class Name
    const className = student.Classes?.class_name || 'Unassigned';
    updateSubtitle(`${className} · Preparing your dashboard…`);

    // Handle Guardian Card (Flattening the nested Parents array)
    if (student.Parent_Student_Links && student.Parent_Student_Links.length > 0) {
      const guardian = student.Parent_Student_Links[0].Parents;
      if (document.getElementById('guardianName')) {
        document.getElementById('guardianName').textContent = guardian.full_name;
        document.getElementById('guardianRelation').textContent = student.Parent_Student_Links[0].relationship || 'Guardian';
        document.getElementById('guardianPhone').innerHTML = `<i class="fas fa-phone"></i> ${guardian.phone_number}`;
      }
    }

    return student;
  } catch (err) {
    console.error('[Dashboard] Session error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats & Ranking
// ─────────────────────────────────────────────────────────────────────────────
async function fetchStudentStats(student) {
  try {
    const pointsEl = document.getElementById('pointsValue');
    if (pointsEl) pointsEl.textContent = (student.total_points || 0).toLocaleString();

    if (!student.class_id) return;

    const { data: classmates } = await supabase
      .from('Students')
      .select('student_id, total_points')
      .eq('class_id', student.class_id)
      .order('total_points', { ascending: false });

    if (classmates) {
      const rankIdx = classmates.findIndex(s => s.student_id === student.student_id);
      const rank = rankIdx >= 0 ? rankIdx + 1 : null;
      if (rank) {
        const suffix = n => (['th', 'st', 'nd', 'rd'][(n % 10 < 4 && (n < 11 || n > 13)) ? n % 10 : 0] || 'th');
        const rankEl = document.getElementById('rankValue');
        if (rankEl) rankEl.textContent = `${rank}${suffix(rank)}`;
      }
    }
  } catch (err) { console.error('Stats error:', err); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule (Fixed Table Join)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTodaySchedule(studentId, classId) {
  try {
    if (!classId) return renderTodayClasses([], 'upcomingClassesGrid');

    const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    const { data: entries, error } = await supabase
      .from('timetable_entries')
      .select('start_time, duration_minutes, Subjects(subject_name)')
      .eq('class_id', classId)
      .eq('day_of_week', today)
      .order('start_time', { ascending: true });

    renderTodayClasses(entries || [], 'upcomingClassesGrid', today);
    const todayEl = document.getElementById('todayClasses');
    if (todayEl) todayEl.textContent = (entries || []).length;
  } catch (err) { console.error('Schedule error:', err); }
  finally { hideSkeleton('upcomingClassesSkeleton', 'upcomingClassesGrid'); }
}

function renderTodayClasses(entries, containerId, dayName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = `<p class="empty-msg">No classes scheduled for ${dayName}.</p>`;
    return;
  }
  container.innerHTML = entries.map((entry, i) => {
    const name = entry.Subjects?.subject_name || 'Unknown';
    const [h, m] = entry.start_time.split(':');
    const d = new Date(); d.setHours(+h, +m);
    return `
        <div class="class-card">
            <div class="class-header">
                <div class="class-icon"><i class="fas ${getSubjectIcon(name)}"></i></div>
                <div class="class-info"><h4>${name}</h4><p>${entry.duration_minutes} min</p></div>
            </div>
            <div class="class-time">${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
        </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Subjects (Fixed to use class_subjects junction)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Subjects (Fixed Table Name & Join)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMySubjects(classId) {
  try {
    if (!classId) return [];

    // FIX: Change 'class_subjects' to 'Class_Subjects'
    const { data, error } = await supabase
      .from('Class_Subjects') // Matches capitalized schema definition
      .select(`
    subject_id,
    Subjects (
      subject_id,
      subject_name
    )
  `)
      .eq('class_id', classId);

    if (error) {
      console.error('[Dashboard] Subjects query error:', error.message);
      return [];
    }

    // Flatten the results and filter out any potential nulls from the join
    const subjects = (data || [])
      .map(item => item.Subjects)
      .filter(Boolean);

    console.log('[Dashboard] Subjects loaded:', subjects);

    renderSubjectsGrid(subjects, 'subjectsGrid');

    const countEl = document.getElementById('subjectsCount');
    if (countEl) countEl.textContent = subjects.length;

    return subjects;
  } catch (err) {
    console.error('[Dashboard] Subjects catch error:', err);
    return [];
  } finally {
    hideSkeleton('subjectsSkeleton', 'subjectsGrid');
  }
}
function renderSubjectsGrid(subjects, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !subjects.length) return;
  container.innerHTML = subjects.map((s, i) => `
        <a href="./studyMaterials.html?subject=${encodeURIComponent(s.subject_name)}" class="subject-card">
            <div class="subject-icon"><i class="fas ${getSubjectIcon(s.subject_name)}"></i></div>
            <span class="subject-name">${s.subject_name}</span>
        </a>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLiveActivity(subjects) {
  try {
    if (!subjects.length) {
      hideSkeleton('activitySkeleton', 'activityFeed');
      return;
    }
    const names = subjects.map(s => s.subject_name);
    const { data: materials } = await supabase
      .from('study_materials')
      .select('*')
      .in('subject', names)
      .order('uploaded_at', { ascending: false })
      .limit(5);

    const container = document.getElementById('activityFeed');
    if (!container || !materials?.length) return;

    container.innerHTML = materials.map(m => `
        <div class="activity-item">
            <div class="activity-dot"><i class="fas ${getSubjectIcon(m.subject)}"></i></div>
            <div class="activity-body">
                <div class="activity-title">${m.title}</div>
                <div class="activity-meta"><span>${m.subject}</span><span>${timeAgo(m.uploaded_at)}</span></div>
            </div>
        </div>`).join('');
  } catch (err) { console.error('Activity error:', err); }
  finally { hideSkeleton('activitySkeleton', 'activityFeed'); }
}