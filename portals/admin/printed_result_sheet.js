// printed_result_sheet.js
import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';
import { showSkeleton, hideSkeleton } from '../../assets/js-shared/ui-engine.js';
import { ResultsEngine } from '../../assets/js-shared/resultsEngine.js';

const re = new ResultsEngine();
let currentSchoolId = null;
let schoolInfo = null;
let templates = [];
let students = [];
let classSeq = []; // [{studentId, averagePercentage, rank}]
let lastRC = null;

const $ = (id) => document.getElementById(id);
const root = () => $('resultSheetPrintRoot');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (d) => d ? (new Date(d).toLocaleDateString() || 'N/A') : 'N/A';

async function loadSchoolId() {
  const u = await waitForUser();
  if (!u?.user_metadata?.school_id) throw new Error('Missing school_id');
  currentSchoolId = u.user_metadata.school_id;
  // School branding (logo / name / address)
  const { data, error } = await supabase
    .from('Schools')
    .select('school_name, school_logo_url, school_address, address, phone, email')
    .eq('school_id', currentSchoolId)
    .single();
  if (!error && data) {
    schoolInfo = {
      name: data.school_name || 'Educational Institution',
      logo: data.school_logo_url || null,
      address: data.school_address || data.address || null,
      phone: data.phone || null,
      email: data.email || null
    };
  } else {
    schoolInfo = { name: 'Educational Institution', logo: null, address: null, phone: null, email: null };
  }
}

async function loadTemplates() {
  const { data, error } = await supabase
    .from('result_sheet_templates')
    .select('*')
    .eq('school_id', currentSchoolId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  templates = data || [];
  const sel = $('templateSelect');
  sel.innerHTML = '<option value="">Select a template…</option>';
  templates.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = `${t.template_name}${t.is_default ? ' (Default)' : ''}`;
    if (t.is_default) o.selected = true;
    sel.appendChild(o);
  });
}

async function loadStudents() {
  const { data, error } = await supabase
    .from('Students')
    .select('student_id, full_name, admission_date, class_id, admission_number')
    .eq('school_id', currentSchoolId)
    .order('full_name', { ascending: true });
  if (error) throw error;
  students = data || [];
  const sel = $('studentSelect');
  sel.innerHTML = '<option value="">Select a student…</option>';
  students.forEach(s => {
    const o = document.createElement('option');
    o.value = s.student_id;
    o.textContent = `${s.full_name} (${s.student_id})`;
    sel.appendChild(o);
  });
}

function getSelectedTemplate() {
  const id = +$('templateSelect').value;
  return templates.find(t => t.id === id) || templates.find(t => t.is_default) || null;
}

// Build class ranking for the student's class to compute position
async function computeClassPosition(studentId, classId, term) {
  if (!classId) return null;
  const { data, error } = await supabase
    .from('Students')
    .select('student_id')
    .eq('class_id', classId);
  if (error || !data || data.length === 0) return null;
  const rows = await Promise.all(data.map(async s => {
    try {
      const p = await re.calculateStudentPerformance(s.student_id, term);
      return { studentId: s.student_id, avg: p?.averagePercentage ?? 0 };
    } catch { return { studentId: s.student_id, avg: 0 }; }
  }));
  rows.sort((a, b) => b.avg - a.avg);
  classSeq = rows;
  const idx = rows.findIndex(r => String(r.studentId) === String(studentId));
  return { position: idx + 1, totalStudents: rows.length };
}

function renderResultSheet(rc, srow, tpl) {
  const cfg = tpl?.layout_config || {};
  const accent = cfg.accentColor || '#0066cc';
  const header = cfg.header || {};
  const cols = cfg.columns || {};
  const order = cols.order || ['subject','ca1','ca2','exam','total','grade','position','remark'];
  const aff = cfg.affective || {};
  const psy = cfg.psychomotor || {};
  const rem = cfg.remarks || {};
  const breakdown = rc?.academicPerformance?.assessmentBreakdown || {};
  const sa = rc?.academicPerformance?.subjectAverages || {};

  const colShow = {
    subject: true,
    ca1: cols.showCA1 !== false,
    ca2: cols.showCA2 !== false,
    exam: cols.showExam !== false,
    total: cols.showTotal !== false,
    grade: cols.showGrade !== false,
    position: cols.showPosition !== false,
    remark: cols.showRemark !== false
  };
  const visCols = order.filter(c => colShow[c]);
  // subject always first even if missing from order
  if (!visCols.includes('subject')) visCols.unshift('subject');

  const colLabel = { subject:'Subject', ca1:'CA1', ca2:'CA2', exam:'Exam', total:'Total', grade:'Grade', position:'Position', remark:'Remark' };
  const colAlign = { subject:'left', ca1:'center', ca2:'center', exam:'center', total:'center', grade:'center', position:'center', remark:'left' };

  let schoolName = schoolInfo?.name || 'Educational Institution';
  let gradeRemark = rc?.academicPerformance?.overallGPA || '-';
  const positionNote = rc?.positionInfo?.position ? ` ${rc.positionInfo.position} of ${rc.positionInfo.totalStudents}` : '';

  let tbody = '';
  Object.entries(sa).forEach(([sid, d]) => {
    const b = breakdown[sid] || {};
    const cell = (col) => {
      if (col === 'subject') return esc(String(sid).slice(0, 28));
      if (col === 'ca1') return b.CA1 && b.CA1.score != null ? esc(String(b.CA1.score)) : '-';
      if (col === 'ca2') return b.CA2 && b.CA2.score != null ? esc(String(b.CA2.score)) : '-';
      if (col === 'exam') return b.Exam && b.Exam.score != null ? esc(String(b.Exam.score)) : '-';
      if (col === 'total') {
        const t = b.Total;
        if (t && t.score != null) return esc(String(t.score));
        return esc(String(d?.averagePercentage ?? '') + '%');
      }
      if (col === 'grade') return esc(d?.letterGrade || 'N/A');
      if (col === 'position') {
        const sd = (rc?.subjectPositions || {})[sid];
        return sd && sd.position ? esc(String(sd.position)) : '-';
      }
      if (col === 'remark') return esc(re.getGradeRemark(d?.averagePercentage));
      return '';
    };
    const align = (col) => colAlign[col] || 'left';
    const cellHtml = visCols.map(c => `<td class="num-${align(c)}">${cell(c)}</td>`).join('');
    tbody += `<tr>${cellHtml}</tr>`;
  });

  // Affective / psychomotor domain rows (from template config; admin can edit values offline — stored as static free-text in config for v1)
  const renderDomains = (domainName, entries) => {
    if (!entries || Object.keys(entries).length === 0) return '';
    return `<h4>${domainName}</h4><table class="domain-table"><tbody>` +
      Object.entries(entries).map(([k, v]) => `<tr><td class="lbl">${esc(k.replace(/([A-Z])/g, ' $1').replace(/^./, c=>c.toUpperCase()))}</td><td>${esc(String(v))}</td></tr>`).join('') +
      `</tbody></table>`;
  };
  const affectiveHtml = aff.show ? renderDomains('Affective Domain', (() => { const {show, ...rest} = aff; return rest; })()) : '';
  const psychomotorHtml = psy.show ? renderDomains('Psychomotor Domain', (() => { const {show, ...rest} = psy; return rest; })()) : '';

  let remarkBlock = '';
  if (rem.showClassTeacher || rem.showPrincipal) {
    remarkBlock = `<div class="remarks-block">
      ${rem.showClassTeacher ? `<div><span class="lbl">Class Teacher&#39;s Remark:</span> ${esc(rem.classTeacherDefault || '')}</div>` : ''}
      ${rem.showPrincipal ? `<div><span class="lbl">Principal&#39;s Remark:</span> ${esc(rem.principalDefault || '')}</div>` : ''}
    </div>`;
  }

  root().innerHTML = `
    <div id="rsSheet">
      <header class="result-sheet-header">
        ${header.showLogo !== false && schoolInfo?.logo ? `<img src="${esc(schoolInfo.logo)}" alt="School Logo">` : header.showLogo !== false ? `<div class="logo-placeholder"><i class="fa-solid fa-graduation-cap"></i></div>` : ''}
        <div>
          <h1 style="color:${accent}">${header.showSchoolName !== false ? esc(schoolName) : esc(header.title || 'Student Result Sheet')}</h1>
          ${header.showAddress && schoolInfo?.address ? `<p>${esc(schoolInfo.address)}</p>` : ''}
          ${header.showPhone && schoolInfo?.phone ? `<p>${esc(schoolInfo.phone)}</p>` : ''}
          ${header.showTerm ? `<p>Term: ${esc(rc?.academicPerformance?.term || $('termSelect').value)}</p>` : ''}
          ${!header.showSchoolName ? `<p style="font-weight:600">${esc(header.title || 'Student Result Sheet')}</p>` : ''}
        </div>
      </header>

      <div class="student-block">
        <div><span class="lbl">Name:</span> ${esc(rc?.studentInfo?.name || srow?.full_name || 'N/A')}</div>
        <div><span class="lbl">Admission No.:</span> ${esc(rc?.studentInfo?.admissionNumber || srow?.admission_number || srow?.student_id || 'N/A')}</div>
        <div><span class="lbl">Class:</span> ${esc(rc?.studentInfo?.class || srow?.class_id || 'N/A')}</div>
        <div><span class="lbl">Admission Date:</span> ${fmtDate(rc?.studentInfo?.admissionDate || srow?.admission_date)}</div>
        <div><span class="lbl">Overall Grade:</span> <span class="grade-badge" style="background:${accent}15;color:${accent};">${esc(rc?.academicPerformance?.overallGrade || 'N/A')}</span></div>
        <div><span class="lbl">Remark:</span> ${esc(gradeRemark)}${positionNote ? `<span class="grade-remark"> (${positionNote.trim()})</span>` : ''}</div>
      </div>

      <table class="subject-table">
        <thead>
          <tr>${visCols.map(c => `<th class=${colAlign[c]==='center'?'num':''}>${colLabel[c]}</th>`).join('')}</tr>
        </thead>
        <tbody>${tbody || `<tr><td colspan="${visCols.length}">No subject scores found for this term.</td></tr>`}</tbody>
      </table>

      ${affectiveHtml}
      ${psychomotorHtml}
      ${remarkBlock}

      <div class="summary-strip">
        <div>Overall Remark/GPA: <span class="grade-remark">${esc(gradeRemark)}</span></div>
        <div>Overall Grade: <span class="grade-badge" style="background:${accent}15;color:${accent};">${esc(rc?.academicPerformance?.overallGrade || 'N/A')}</span></div>
      </div>
      ${cfg.footerNote ? `<div class="result-sheet-footer">${esc(cfg.footerNote)}</div>` : ''}
    </div>
  `;
}

async function generate() {
  const sid = $('studentSelect').value;
  const tpl = getSelectedTemplate();
  if (!sid) { alert('Select a student'); return; }
  if (!tpl) { alert('Select a template'); return; }
  const term = $('termSelect').value;
  const srow = students.find(x => String(x.student_id) === String(sid));
  const r = root();
  if (r) { showSkeleton(r, 2, 'card'); }
  try {
    const rc = await re.generateReportCard(sid, term);
    lastRC = rc;
    // Compute position in class (best-effort)
    const pos = await computeClassPosition(sid, srow?.class_id || rc?.studentInfo?.class, term);
    if (pos) rc.positionInfo = pos;
    // Compute subject-level positions (best-effort) — rank each subject within class
    try {
      const subjPos = {};
      const { data: classStudents } = await supabase
        .from('Students').select('student_id').eq('class_id', srow?.class_id || rc?.studentInfo?.class);
      if (classStudents && classStudents.length > 1) {
        const gradesRows = await supabase
          .from('Grades')
          .select('student_id, subject_id, score, max_score')
          .eq('term', term)
          .eq('school_id', currentSchoolId);
        const subjAvg = {};
        classStudents.forEach(cs => {
          const rows2 = (gradesRows.data || []).filter(g => String(g.student_id) === String(cs.student_id));
          const bySubj = {};
          rows2.forEach(g => {
            const pct = (parseFloat(g.score) / parseFloat(g.max_score)) * 100;
            if (!bySubj[g.subject_id]) bySubj[g.subject_id] = [];
            bySubj[g.subject_id].push(pct);
          });
          Object.entries(bySubj).forEach(([subj, arr]) => {
            const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
            if (!subjAvg[subj]) subjAvg[subj] = [];
            subjAvg[subj].push({ studentId: cs.student_id, avg });
          });
        });
        Object.entries(subjAvg).forEach(([subj, list]) => {
          list.sort((a,b) => b.avg - a.avg);
          const myIdx = list.findIndex(x => String(x.studentId) === String(sid));
          if (myIdx !== -1) subjPos[subj] = { position: myIdx + 1, total: list.length };
        });
        rc.subjectPositions = subjPos;
      }
    } catch (e) { /* best-effort */ }
    renderResultSheet(rc, srow, tpl);
    $('printBtn').disabled = false;
    $('pdfBtn').disabled = false;
  } catch (e) {
    console.error(e);
    alert('Failed to generate report card: ' + e.message);
  } finally {
    if (r) { hideSkeleton(r); }
  }
}

function printSheet() { window.print(); }

function exportPDF() {
  if (!lastRC) { alert('Generate first'); return; }
  const tpl = getSelectedTemplate();
  const sid = $('studentSelect').value;
  const srow = students.find(x => String(x.student_id) === String(sid));
  const name = srow?.full_name || lastRC.studentInfo?.name || 'student';
  const term = $('termSelect').value;
  const cfg = tpl?.layout_config || {};
  const accent = cfg.accentColor || '#0066cc';
  const breakdown = lastRC.academicPerformance?.assessmentBreakdown || {};
  const sa = lastRC.academicPerformance?.subjectAverages || {};

  if (!window.jspdf || !window.jspdf.jsPDF) { alert('jsPDF library not loaded'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const title = cfg.header?.title || 'Student Result Sheet';
  doc.text(title, pageW / 2, y, { align: 'center' });
  y += 18;
  if (schoolInfo?.name) { doc.setFontSize(10); doc.text(schoolInfo.name, pageW/2, y, {align:'center'}); y += 13; }
  if (schoolInfo?.address) { doc.setFontSize(9); doc.text(schoolInfo.address, pageW/2, y, {align:'center'}); y += 10; }
  doc.text(`Term: ${term}`, margin, y); y += 16;

  // Student info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const stLines = [
    `Name: ${lastRC.studentInfo?.name || srow?.full_name || 'N/A'}`,
    `Admission No.: ${lastRC.studentInfo?.admissionNumber || srow?.admission_number || srow?.student_id || 'N/A'}`,
    `Class: ${lastRC.studentInfo?.class || srow?.class_id || 'N/A'}`,
    `Overall Grade: ${lastRC.academicPerformance?.overallGrade || 'N/A'}  |  Remark: ${lastRC.academicPerformance?.overallGPA || '-'}`
  ];
  stLines.forEach(l => { doc.text(l, margin, y); y += 13; });
  y += 6;

  const cols = cfg.columns || {};
  const order = cols.order || ['subject','ca1','ca2','exam','total','grade','position','remark'];
  const colShow = { ca1: cols.showCA1 !== false, ca2: cols.showCA2 !== false, exam: cols.showExam !== false, total: cols.showTotal !== false, grade: cols.showGrade !== false, position: cols.showPosition !== false, remark: cols.showRemark !== false };
  const vis = order.filter(c => (c==='subject') || colShow[c]);
  if (!vis.includes('subject')) vis.unshift('subject');

  const label = { subject:'Subject', ca1:'CA1', ca2:'CA2', exam:'Exam', total:'Total', grade:'Grade', position:'Position', remark:'Remark' };
  const colW = { subject: 120, ca1: 44, ca2: 44, exam: 44, total: 52, grade: 48, position: 60, remark: 90 };
  // compute x positions
  const xs = {};
  let cx = margin;
  vis.forEach(c => { xs[c] = cx; cx += (colW[c] || 60); });
  const tableRight = margin + vis.reduce((a,c)=>a+(colW[c]||60),0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  vis.forEach(c => { doc.text(label[c], xs[c], y); });
  y += 8; doc.line(margin, y, tableRight, y); y += 12;
  doc.setFont('helvetica', 'normal');

  Object.entries(sa).forEach(([sid, d]) => {
    if (y > 730) { doc.addPage(); y = margin; doc.setFont('helvetica','bold'); doc.setFontSize(9); vis.forEach(c=>doc.text(label[c], xs[c], y)); y += 8; doc.line(margin, y, tableRight, y); y += 12; doc.setFont('helvetica','normal'); }
    const b = breakdown[sid] || {};
    const cellVal = (c) => {
      if (c==='subject') return String(sid).slice(0,18);
      if (c==='ca1') return b.CA1?.score ?? '-';
      if (c==='ca2') return b.CA2?.score ?? '-';
      if (c==='exam') return b.Exam?.score ?? '-';
      if (c==='total') return b.Total?.score != null ? b.Total.score : (d?.averagePercentage ?? '')+'%';
      if (c==='grade') return d?.letterGrade ?? 'N/A';
      if (c==='position') { const sp = lastRC.subjectPositions?.[sid]; return sp ? sp.position : '-'; }
      if (c==='remark') return String(re.getGradeRemark(d?.averagePercentage));
      return '';
    };
    vis.forEach(c => doc.text(String(cellVal(c)), xs[c], y));
    y += 12;
  });
  y += 8;
  doc.line(margin, y, tableRight, y);
  y += 16;

  // Affective / psychomotor + remarks (text)
  const aff = cfg.affective || {};
  const psy = cfg.psychomotor || {};
  if (aff.show) {
    doc.setFont('helvetica','bold'); doc.text('Affective Domain', margin, y); y += 12; doc.setFont('helvetica','normal');
    Object.entries(aff).filter(([k])=>k!=='show').forEach(([k,v]) => { if (y>750){doc.addPage(); y=margin;} doc.text(`${k.replace(/([A-Z])/g,' $1')}: ${v}`, margin, y); y += 11; });
    y += 6;
  }
  if (psy.show) {
    doc.setFont('helvetica','bold'); doc.text('Psychomotor Domain', margin, y); y += 12; doc.setFont('helvetica','normal');
    Object.entries(psy).filter(([k])=>k!=='show').forEach(([k,v]) => { if (y>750){doc.addPage(); y=margin;} doc.text(`${k.replace(/([A-Z])/g,' $1')}: ${v}`, margin, y); y += 11; });
    y += 6;
  }
  const rem = cfg.remarks || {};
  if (rem.showClassTeacher) { if (y>740){doc.addPage(); y=margin;} doc.text(`Class Teacher's Remark: ${rem.classTeacherDefault || ''}`, margin, y); y += 13; }
  if (rem.showPrincipal) { if (y>740){doc.addPage(); y=margin;} doc.text(`Principal's Remark: ${rem.principalDefault || ''}`, margin, y); y += 13; }

  if (cfg.footerNote) { if (y>740){doc.addPage(); y=margin;} doc.setFontSize(9); const fl = doc.splitTextToSize(cfg.footerNote, pageW-margin*2); doc.text(fl, margin, y); }

  doc.save(`${name.replace(/[^a-zA-Z0-9]/g,'-')}-${term.replace(/\s+/g,'-')}-result-sheet.pdf`);
}

async function init() {
  const r = root();
  if (r) { showSkeleton(r, 3, 'card'); }
  try {
    await loadSchoolId();
    await Promise.all([loadTemplates(), loadStudents()]);
    $('generateBtn')?.addEventListener('click', generate);
    $('printBtn')?.addEventListener('click', printSheet);
    $('pdfBtn')?.addEventListener('click', exportPDF);
  } catch (e) {
    console.error(e);
    if (r) r.innerHTML = `<div style="color:#b91c1c;padding:16px;">Failed to initialize: ${e.message}</div>`;
  } finally {
    if (r) { hideSkeleton(r); }
  }
}

document.addEventListener('DOMContentLoaded', init);
