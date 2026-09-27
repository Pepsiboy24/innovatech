// result_template_editor.js
import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';
import { showSkeleton, hideSkeleton } from '../../assets/js-shared/ui-engine.js';

let currentSchoolId = null;
let templates = [];
let editingId = null; // null = create
let layoutBase = null; // source config (breakdown/gradingScale + any fields without a form control survive untouched)

const qs = (id) => document.getElementById(id);
const templateList = () => qs('templateList');
const templateEditorSection = () => qs('templateEditorSection');
const previewSection = () => qs('previewSection');

const clone = (o) => JSON.parse(JSON.stringify(o));

const alertContainer = () => qs('alertContainer');

function showAlert(type, msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  div.style.cssText = `
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: #fff; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,.1);
  `;
  alertContainer().appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function toggleEditor(show) {
  templateEditorSection().style.display = show ? 'block' : 'none';
  previewSection().style.display = show ? 'block' : 'none';
  if (!show) qs('editorTitle').textContent = 'New Template';
}

async function loadSchoolId() {
  try {
    const u = await waitForUser();
    if (!u?.user_metadata?.school_id) throw new Error('Missing school_id in user metadata');
    currentSchoolId = u.user_metadata.school_id;
  } catch (e) {
    showAlert('error', e.message);
    throw e;
  }
}

async function fetchTemplates() {
  const el = templateList();
  if (el) { showSkeleton(el, 4, 'list'); }
  try {
    if (!currentSchoolId) await loadSchoolId();
    const { data, error } = await supabase
      .from('result_sheet_templates')
      .select('*')
      .eq('school_id', currentSchoolId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { showAlert('error', error.message); return; }
    templates = data || [];
    renderList();
  } finally {
    if (el) { hideSkeleton(el); }
  }
}

function renderList() {
  const el = templateList();
  el.innerHTML = '';
  if (!templates.length) {
    el.innerHTML = '<div class="empty-state">No templates yet. Create your first one.</div>';
    return;
  }
  templates.forEach(t => {
    const div = document.createElement('div');
    div.className = 'template-card';
    div.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:8px;background:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;';
    div.innerHTML = `
      <div>
        <div style="font-weight:600">${t.template_name} ${t.is_default ? '<span class="badge" style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:999px;font-size:11px;margin-left:6px;">DEFAULT</span>' : ''} ${!t.is_active ? '<span style="opacity:.6">(Inactive)</span>' : ''}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;white-space:pre-wrap;">${t.description || ''}</div>
        <pre style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;padding:8px;max-height:160px;overflow:auto;font-size:11px;margin-top:8px;">${JSON.stringify(t.layout_config, null, 2)}</pre>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;min-width:120px;">
        <button class="btn btn-xs btn-outline" data-action="edit" data-id="${t.id}"><i class="fa-solid fa-pencil"></i> Edit</button>
        <button class="btn btn-xs btn-outline" data-action="setdefault" data-id="${t.id}" ${t.is_default ? 'disabled' : ''}><i class="fa-solid fa-star"></i> Set Default</button>
        <button class="btn btn-xs btn-outline" data-action="delete" data-id="${t.id}"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
    `;
    el.appendChild(div);
  });

  el.querySelectorAll('[data-action]').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = +e.currentTarget.getAttribute('data-id');
      const action = e.currentTarget.getAttribute('data-action');
      if (action === 'edit') return startEdit(id);
      if (action === 'setdefault') return setDefault(id);
      if (action === 'delete') return deleteTemplate(id);
    });
  });
}

const DEFAULT_LAYOUT = {
  header: {
    showLogo: true,
    showSchoolName: true,
    showAddress: true,
    showPhone: true,
    showTerm: true,
    title: "Student Result Sheet"
  },
  columns: {
    order: ["subject", "ca1", "ca2", "exam", "total", "grade", "position", "remark"],
    showCA1: true,
    showCA2: true,
    showExam: true,
    showTotal: true,
    showGrade: true,
    showPosition: true,
    showRemark: true
  },
  affective: {
    show: true,
    attendance: "Present",
    punctuality: "Punctual",
    attitudeToWork: "Good",
    conduct: "Orderly",
    neatness: "Tidy",
    speech: "Fluent",
    handwriting: "Legible"
  },
  psychomotor: {
    show: true,
    handlingTools: "Good",
    games: "Fair",
    creativeArts: "Good",
    musicalSkills: "Fair"
  },
  remarks: {
    showClassTeacher: true,
    classTeacherDefault: "A good term's work. Encouraged.",
    showPrincipal: true,
    principalDefault: "Promoted to the next class."
  },
  breakdown: { groupBy: "assessment_type", showAverageAndGrade: true },
  gradingScale: "WAEC",
  accentColor: "#0066cc",
  footerNote: "This result sheet is computer-generated and does not require a signature."
};

const COLUMN_IDS = ['ca1', 'ca2', 'exam', 'total', 'grade', 'position', 'remark'];
const COLUMN_LABELS = { ca1: 'CA1', ca2: 'CA2', exam: 'Exam', total: 'Total', grade: 'Grade', position: 'Position', remark: 'Remark' };
const AFFECTIVE_TRAITS = ['attendance', 'punctuality', 'attitudeToWork', 'conduct', 'neatness', 'speech', 'handwriting'];
const PSYCHOMOTOR_TRAITS = ['handlingTools', 'games', 'creativeArts', 'musicalSkills'];
// Renderer keys are showCA1/showCA2/showExam/… (uppercase CA prefixes).
const SHOW_KEY = (id) => 'show' + (id === 'ca1' || id === 'ca2' ? id.toUpperCase() : id[0].toUpperCase() + id.slice(1));

function populateColumns(cfg) {
  const order = cfg?.columns?.order || [];
  const el = qs('columnsEditor');
  if (!el) return;
  el.innerHTML = '';
  const ids = COLUMN_IDS.slice().sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  ids.forEach(id => {
    const showKey = SHOW_KEY(id);
    const shown = cfg.columns ? cfg.columns[showKey] !== false : true;
    const row = document.createElement('div');
    row.className = 'col-row';
    row.dataset.col = id;
    row.innerHTML = `
      <label class="checkbox-label">
        <input type="checkbox" class="col-check" id="col-show-${id}" ${shown ? 'checked' : ''}>
        <span class="checkmark"></span>
        <span class="checkbox-text">${COLUMN_LABELS[id]}</span>
      </label>
      <div class="col-arrows">
        <button type="button" class="col-btn" data-dir="up" aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button>
        <button type="button" class="col-btn" data-dir="down" aria-label="Move down"><i class="fa-solid fa-arrow-down"></i></button>
      </div>`;
    el.appendChild(row);
  });
}

function populateFields(cfg) {
  layoutBase = clone(cfg || {});
  const h = cfg.header || {};
  qs('hdrLogo').checked = h.showLogo !== false;
  qs('hdrSchoolName').checked = h.showSchoolName !== false;
  qs('hdrAddress').checked = h.showAddress !== false;
  qs('hdrPhone').checked = h.showPhone !== false;
  qs('hdrTerm').checked = h.showTerm !== false;
  qs('hdrTitle').value = h.title || '';

  populateColumns(cfg);

  const aff = cfg.affective || {};
  qs('affShow').checked = aff.show !== false;
  AFFECTIVE_TRAITS.forEach(k => { const el = qs('aff-' + k); if (el) el.value = aff[k] || ''; });

  const psy = cfg.psychomotor || {};
  qs('psyShow').checked = psy.show !== false;
  PSYCHOMOTOR_TRAITS.forEach(k => { const el = qs('psy-' + k); if (el) el.value = psy[k] || ''; });

  const rem = cfg.remarks || {};
  qs('remClassTeacher').checked = rem.showClassTeacher !== false;
  qs('remClassTeacherDefault').value = rem.classTeacherDefault || '';
  qs('remPrincipal').checked = rem.showPrincipal !== false;
  qs('remPrincipalDefault').value = rem.principalDefault || '';

  qs('accentColor').value = cfg.accentColor || '#0066cc';
  qs('footerNote').value = cfg.footerNote || '';
}

// Reassemble the same layout_config JSON shape the renderer expects.
// Any fields without a form control (breakdown, gradingScale, …) survive via layoutBase.
function configFromFields() {
  const ck = (id) => qs(id).checked;
  const val = (id) => (qs(id).value || '').trim();

  const columns = { order: ['subject'] };
  qs('columnsEditor').querySelectorAll('.col-row').forEach(row => {
    const id = row.dataset.col;
    columns.order.push(id);
    columns[SHOW_KEY(id)] = ck('col-show-' + id);
  });

  const affective = { show: ck('affShow') };
  AFFECTIVE_TRAITS.forEach(k => { affective[k] = val('aff-' + k); });
  const psychomotor = { show: ck('psyShow') };
  PSYCHOMOTOR_TRAITS.forEach(k => { psychomotor[k] = val('psy-' + k); });

  return {
    ...layoutBase,
    header: {
      showLogo: ck('hdrLogo'),
      showSchoolName: ck('hdrSchoolName'),
      showAddress: ck('hdrAddress'),
      showPhone: ck('hdrPhone'),
      showTerm: ck('hdrTerm'),
      title: val('hdrTitle') || 'Student Result Sheet'
    },
    columns,
    affective,
    psychomotor,
    remarks: {
      showClassTeacher: ck('remClassTeacher'),
      classTeacherDefault: val('remClassTeacherDefault'),
      showPrincipal: ck('remPrincipal'),
      principalDefault: val('remPrincipalDefault')
    },
    accentColor: qs('accentColor').value || '#0066cc',
    footerNote: val('footerNote')
  };
}

function startCreate() {
  editingId = null;
  qs('editorTitle').textContent = 'New Template';
  qs('templateName').value = '';
  qs('templateDescription').value = '';
  populateFields(clone(DEFAULT_LAYOUT));
  qs('isDefaultTemplate').checked = false;
  qs('isActiveTemplate').checked = true;
  toggleEditor(true);
  renderPreview();
}

function startEdit(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  editingId = t.id;
  qs('editorTitle').textContent = `Edit Template — ${t.template_name}`;
  qs('templateName').value = t.template_name || '';
  qs('templateDescription').value = t.description || '';
  populateFields(t.layout_config || DEFAULT_LAYOUT);
  qs('isDefaultTemplate').checked = !!t.is_default;
  qs('isActiveTemplate').checked = t.is_active !== false;
  toggleEditor(true);
  renderPreview();
}

function renderPreview() {
  const cfg = configFromFields();
  const pv = qs('templatePreview');
  const cols = cfg.columns || {};
  const colList = (cols.order || []).map(c => {
    const show = { ca1: cols.showCA1, ca2: cols.showCA2, exam: cols.showExam, total: cols.showTotal, grade: cols.showGrade, position: cols.showPosition, remark: cols.showRemark }[c];
    return show === false ? null : c;
  }).filter(Boolean).join(' • ');
  const aff = cfg.affective || {};
  const psy = cfg.psychomotor || {};
  const rem = cfg.remarks || {};
  const affDescr = aff.show ? Object.keys(aff).filter(k=>k!=='show').map(k=>k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+aff[k]).join('; ') : '(off)';
  const psyDescr = psy.show ? Object.keys(psy).filter(k=>k!=='show').map(k=>k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())+': '+psy[k]).join('; ') : '(off)';
  pv.innerHTML = `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
      <h3 style="margin:0;color:${cfg.accentColor||'#0066cc'}">${cfg.header?.title||'Student Result Sheet'}</h3>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
        Header: logo=${cfg.header?.showLogo!==false?'on':'off'} • name=${cfg.header?.showSchoolName!==false?'on':'off'} • address=${cfg.header?.showAddress?'on':'off'} • term=${cfg.header?.showTerm?'on':'off'}
      </p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Columns: ${colList || '(none)'}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Grading: ${cfg.gradingScale||'WAEC'} • GroupBy: ${cfg.breakdown?.groupBy||'assessment_type'}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Affective (${aff.show?'on':'off'}): ${affDescr}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Psychomotor (${psy.show?'on':'off'}): ${psyDescr}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Remarks: classTeacher=${rem.showClassTeacher?'on':'off'} / principal=${rem.showPrincipal?'on':'off'}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Footer: ${cfg.footerNote||'(none)'}</p>
      <pre style="background:#f8fafc;border:1px solid #f1f5f9;border-radius:6px;padding:8px;max-height:220px;overflow:auto;font-size:11px;margin-top:12px;">${JSON.stringify(cfg,null,2)}</pre>
    </div>
  `;
}

async function saveTemplate() {
  if (!currentSchoolId) await loadSchoolId();
  const name = qs('templateName').value.trim();
  if (!name) { showAlert('error', 'Template Name is required'); return; }
  const layout = configFromFields();
  const payload = {
    school_id: currentSchoolId,
    template_name: name,
    description: qs('templateDescription').value.trim() || null,
    layout_config: layout,
    is_default: qs('isDefaultTemplate').checked,
    is_active: qs('isActiveTemplate').checked,
  };
  if (editingId) {
    const { error } = await supabase.from('result_sheet_templates').update(payload).eq('id', editingId);
    if (error) { showAlert('error', error.message); return; }
    showAlert('success', 'Template updated');
  } else {
    const { error } = await supabase.from('result_sheet_templates').insert([payload]);
    if (error) { showAlert('error', error.message); return; }
    showAlert('success', 'Template created');
  }
  // If set default, ensure only this one is default (RLS+unique index will enforce; also can clear others client-side)
  if (payload.is_default && !editingId) {
    // best-effort: clear others
    await supabase.from('result_sheet_templates').update({ is_default: false }).eq('school_id', currentSchoolId).neq('id', (await supabase.from('result_sheet_templates').select('id').eq('school_id',currentSchoolId).eq('template_name',name).limit(1)).data?.[0]?.id || -1);
  }
  toggleEditor(false);
  await fetchTemplates();
}

async function setDefault(id) {
  if (!currentSchoolId) await loadSchoolId();
  // Clear existing defaults for this school
  const { error: e1 } = await supabase.from('result_sheet_templates').update({ is_default: false }).eq('school_id', currentSchoolId);
  if (e1) { showAlert('error', e1.message); return; }
  const { error: e2 } = await supabase.from('result_sheet_templates').update({ is_default: true }).eq('id', id);
  if (e2) { showAlert('error', e2.message); return; }
  showAlert('success', 'Default template set');
  await fetchTemplates();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template? This cannot be undone.')) return;
  const { error } = await supabase.from('result_sheet_templates').delete().eq('id', id);
  if (error) { showAlert('error', error.message); return; }
  showAlert('success', 'Template deleted');
  await fetchTemplates();
}

function handleColumnsClick(e) {
  const btn = e.target.closest('.col-btn');
  if (!btn) return;
  const el = qs('columnsEditor');
  const row = btn.closest('.col-row');
  if (!el || !row) return;
  if (btn.dataset.dir === 'up') {
    const prev = row.previousElementSibling;
    if (prev) el.insertBefore(row, prev);
  } else {
    const next = row.nextElementSibling;
    if (next) el.insertBefore(next, row);
  }
  renderPreview();
}

function init() {
  qs('newTemplateBtn')?.addEventListener('click', startCreate);
  qs('cancelEditBtn')?.addEventListener('click', () => toggleEditor(false));
  qs('saveTemplateBtn')?.addEventListener('click', saveTemplate);
  const editor = templateEditorSection();
  editor?.addEventListener('input', renderPreview);
  editor?.addEventListener('change', renderPreview);
  editor?.addEventListener('click', handleColumnsClick);
  loadSchoolId().then(fetchTemplates).catch(()=>{});
}

document.addEventListener('DOMContentLoaded', init);
