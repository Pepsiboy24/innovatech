import { supabase } from '../../core/config.js';

// ---------- state ----------
let school = null;            // { current_session, current_term }
let classes = [];             // all classes
let students = [];            // active students
let dest = {};                // class_id -> '' | 'graduate' | '<class_id>'
let repeaters = new Set();    // student_id
let batches = [];
let openRows = new Set();

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = c => `${c.class_name}${c.section ? ' - ' + c.section : ''}`;
const natural = (a, b) => label(a).localeCompare(label(b), undefined, { numeric: true, sensitivity: 'base' });

async function getSchoolId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.school_id;
}

// ---------- suggestions: "JSS 1 A" -> "JSS 2 A" ----------
function suggestNext(cls) {
    const m = String(cls.class_name || '').match(/^(.*?)(\d+)(.*)$/);
    if (!m) return '';
    const [, prefix, num, suffix] = m;
    const want = c => {
        const n = String(c.class_name || '').match(/^(.*?)(\d+)(.*)$/);
        return n && n[1].trim().toLowerCase() === prefix.trim().toLowerCase()
            && parseInt(n[2]) === parseInt(num) + 1
            && n[3].trim().toLowerCase() === suffix.trim().toLowerCase()
            && (c.section || '') === (cls.section || '');
    };
    const hit = classes.find(want);
    return hit ? String(hit.class_id) : '';
}

// ---------- load ----------
async function load() {
    const schoolId = await getSchoolId();
    if (!schoolId) return;

    const [sch, cls, stu, bat] = await Promise.all([
        supabase.from('Schools').select('current_session, current_term').eq('school_id', schoolId).single(),
        supabase.from('Classes').select('class_id, class_name, section, promotes_to, is_final').eq('school_id', schoolId),
        supabase.from('Students').select('student_id, full_name, class_id').eq('school_id', schoolId).eq('enrollment_status', 'active'),
        supabase.from('Promotion_Batches').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(5)
    ]);
    if (cls.error || stu.error) { showStatus('bad', 'Could not load classes or students. ' + (cls.error || stu.error).message); return; }

    school = sch.data || {};
    classes = (cls.data || []).slice().sort(natural);
    students = stu.data || [];
    batches = bat.data || [];

    // choose starting destinations: saved choice first, then a suggestion, else blank
    dest = {};
    classes.forEach(c => {
        if (c.is_final) dest[c.class_id] = 'graduate';
        else if (c.promotes_to) dest[c.class_id] = String(c.promotes_to);
        else dest[c.class_id] = suggestNext(c);
    });
    repeaters = new Set();
    render();
}

// ---------- render ----------
function studentsOf(classId) { return students.filter(s => s.class_id === classId); }

function render() {
    const session = school?.current_session;
    const term = school?.current_term;
    $('sessionLine').textContent = session
        ? `Closing session ${session}. After this, start the new session on the Term & Session page.`
        : 'No current session is set. Open Term & Session first.';

    const done = batches.find(b => !b.reverted_at && b.from_session === session);
    let msg = '';
    if (done) {
        msg = `<div class="pm-note pm-ok"><i class="fas fa-check-circle"></i><span>Promotion for <strong>${esc(session)}</strong> was already done on ${esc(new Date(done.created_at).toLocaleDateString())}.
            Next, <a href="/admin/term_session">start the new session</a>. To run it again, undo it below first.</span></div>`;
    } else if (term && term !== 'Third Term') {
        msg = `<div class="pm-note pm-warn"><i class="fas fa-exclamation-triangle"></i><span>The school is on <strong>${esc(term)}</strong>. Promotions are normally run after Third Term results are final.</span></div>`;
    }
    $('statusBox').innerHTML = msg;

    const withStudents = classes.filter(c => studentsOf(c.class_id).length > 0);
    const empty = classes.length - withStudents.length;
    $('hiddenNote').textContent = empty ? `${empty} class${empty > 1 ? 'es have' : ' has'} no students and ${empty > 1 ? 'are' : 'is'} not listed (still available as destinations).` : '';

    if (!withStudents.length) {
        $('classRows').innerHTML = '<tr><td colspan="4">No active students found.</td></tr>';
    } else {
        $('classRows').innerHTML = withStudents.map(c => {
            const list = studentsOf(c.class_id);
            const rep = list.filter(s => repeaters.has(s.student_id)).length;
            const d = dest[c.class_id] ?? '';
            const options = ['<option value="">Choose destination...</option>',
                '<option value="graduate"' + (d === 'graduate' ? ' selected' : '') + '>🎓 Graduates (leaves school)</option>']
                .concat(classes.filter(o => o.class_id !== c.class_id)
                    .map(o => `<option value="${o.class_id}"${String(o.class_id) === d ? ' selected' : ''}>${esc(label(o))}</option>`)).join('');
            const moving = list.length - rep;
            const verb = d === 'graduate' ? 'graduating' : 'moving up';
            const result = d ? `${moving} ${verb}${rep ? `, <strong>${rep} repeating</strong>` : ''}` : '<span style="color:#b91c1c">Pick a destination</span>';
            const isOpen = openRows.has(c.class_id);
            return `<tr data-class="${c.class_id}">
                <td><strong>${esc(label(c))}</strong></td>
                <td>${list.length} <button class="pm-link" data-toggle="${c.class_id}">${isOpen ? 'hide' : 'repeaters'}</button></td>
                <td><select data-dest="${c.class_id}" class="${d ? '' : 'pm-missing'}">${options}</select></td>
                <td>${result}</td></tr>` +
                (isOpen ? `<tr><td colspan="4" class="pm-students">
                    <div class="pm-small" style="margin-bottom:6px;">Tick students who will <strong>repeat</strong> this class:</div>
                    ${list.map(s => `<label><input type="checkbox" data-rep="${esc(s.student_id)}" ${repeaters.has(s.student_id) ? 'checked' : ''}> ${esc(s.full_name || 'Unnamed')}</label>`).join('')}
                </td></tr>` : '');
        }).join('');
    }
    updateTotals(withStudents, !!done);
    renderHistory();
}

function updateTotals(withStudents, alreadyDone) {
    let promo = 0, rep = 0, grad = 0, missing = 0;
    withStudents.forEach(c => {
        const list = studentsOf(c.class_id);
        const r = list.filter(s => repeaters.has(s.student_id)).length;
        rep += r;
        const d = dest[c.class_id];
        if (!d) { missing++; return; }
        if (d === 'graduate') grad += list.length - r; else promo += list.length - r;
    });
    // warn if two classes feed one class (a merge)
    const targets = {};
    withStudents.forEach(c => { const d = dest[c.class_id]; if (d && d !== 'graduate') (targets[d] = targets[d] || []).push(c); });
    const merges = Object.entries(targets).filter(([, v]) => v.length > 1)
        .map(([id, v]) => `${v.map(label).join(' + ')} → ${label(classes.find(c => String(c.class_id) === id))}`);

    $('totals').innerHTML = `<strong>${promo}</strong> moving up &nbsp;·&nbsp; <strong>${rep}</strong> repeating &nbsp;·&nbsp; <strong>${grad}</strong> graduating`
        + (merges.length ? `<div class="pm-note pm-warn" style="margin:12px 0 0;"><i class="fas fa-code-merge"></i><span>These classes will be merged: ${esc(merges.join('; '))}. Check this is what you want.</span></div>` : '');

    let reason = '';
    if (!school?.current_session) reason = 'Set the current session on Term & Session first.';
    else if (alreadyDone) reason = 'Already done for this session.';
    else if (!withStudents.length) reason = 'No students to promote.';
    else if (missing) reason = `${missing} class${missing > 1 ? 'es need' : ' needs'} a destination.`;
    $('blockReason').textContent = reason;
    $('executeBtn').disabled = !!reason;
}

function renderHistory() {
    if (!batches.length) { $('history').textContent = 'No promotions yet.'; return; }
    const latestActive = batches.find(b => !b.reverted_at);
    $('history').innerHTML = batches.map(b => `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--border);">
            <span><strong>${esc(b.from_session)}</strong> · ${esc(new Date(b.created_at).toLocaleString())}</span>
            <span>${b.promoted} promoted, ${b.repeated} repeated, ${b.graduated} graduated</span>
            ${b.reverted_at ? '<span class="pm-pill" style="background:#f1f5f9;color:#64748b;">Undone</span>'
                : (latestActive && latestActive.batch_id === b.batch_id ? `<button class="pm-link" data-undo="${esc(b.batch_id)}">Undo this promotion</button>` : '')}
        </div>`).join('');
}

// ---------- events ----------
$('classRows').addEventListener('change', e => {
    const d = e.target.dataset;
    if (d.dest !== undefined) { dest[d.dest] = e.target.value; render(); }
    if (d.rep !== undefined) {
        e.target.checked ? repeaters.add(d.rep) : repeaters.delete(d.rep);
        render();
    }
});
$('classRows').addEventListener('click', e => {
    const t = e.target.dataset?.toggle;
    if (t !== undefined) { const id = parseInt(t); openRows.has(id) ? openRows.delete(id) : openRows.add(id); render(); }
});

async function confirmBox(message, title) {
    if (typeof window.showConfirm === 'function') return window.showConfirm(message, title);
    return window.confirm(message);
}

$('executeBtn').addEventListener('click', async () => {
    const withStudents = classes.filter(c => studentsOf(c.class_id).length > 0);
    let promo = 0, rep = 0, grad = 0;
    withStudents.forEach(c => {
        const list = studentsOf(c.class_id);
        const r = list.filter(s => repeaters.has(s.student_id)).length;
        rep += r;
        if (dest[c.class_id] === 'graduate') grad += list.length - r; else promo += list.length - r;
    });
    const ok = await confirmBox(
        `Promote ${promo} student(s), keep ${rep} repeating and graduate ${grad} for session ${school.current_session}? You can undo this from the page afterwards.`,
        'Run promotion');
    if (!ok) return;

    const btn = $('executeBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    try {
        const map = withStudents.map(c => dest[c.class_id] === 'graduate'
            ? { class_id: c.class_id, promotes_to: null, is_final: true }
            : { class_id: c.class_id, promotes_to: parseInt(dest[c.class_id]), is_final: false });
        const { data, error } = await supabase.rpc('run_promotion', {
            p_session: school.current_session, p_map: map, p_repeaters: [...repeaters]
        });
        if (error) throw error;
        showResult(`Done. ${data.promoted} promoted, ${data.repeated} repeating, ${data.graduated} graduated. Next: start the new session on Term & Session.`, 'success');
        await load();
    } catch (err) {
        console.error(err);
        showResult('Failed: ' + (err.message || err), 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-bolt"></i> Run promotion';
        render();
    }
});

$('history').addEventListener('click', async e => {
    const id = e.target.dataset?.undo;
    if (!id) return;
    const ok = await confirmBox('Undo this promotion? Students will go back to their old classes. Anyone already moved again by hand is left as they are.', 'Undo promotion');
    if (!ok) return;
    try {
        const { data, error } = await supabase.rpc('undo_promotion', { p_batch: id });
        if (error) throw error;
        showResult(`Undone. ${data.restored} student(s) restored${data.skipped ? `, ${data.skipped} left as they were` : ''}.`, 'success');
        await load();
    } catch (err) {
        showResult('Could not undo: ' + (err.message || err), 'error');
    }
});

function showStatus(kind, text) {
    $('statusBox').innerHTML = `<div class="pm-note pm-${kind}"><span>${esc(text)}</span></div>`;
}
function showResult(message, type) {
    const el = $('resultMessage');
    el.textContent = message;
    el.className = `result-message result-${type}`;
    el.style.display = 'block';
}

load();
