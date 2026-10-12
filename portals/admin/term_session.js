import { supabase } from '../../core/config.js';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const $ = (id) => document.getElementById(id);
let school = null;

async function schoolId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.school_id;
}

function suggestNext(session, term) {
    const i = TERMS.indexOf(term);
    if (i >= 0 && i < 2) return { session, term: TERMS[i + 1] };
    const m = /^(\d{4})\/(\d{4})$/.exec(session || '');
    if (m) return { session: `${+m[1] + 1}/${+m[2] + 1}`, term: 'First Term' };
    return { session: session || '', term: 'First Term' };
}

async function load() {
    const id = await schoolId();
    const { data, error } = await supabase.from('Schools')
        .select('current_session, current_term, next_term_start_date').eq('school_id', id).single();
    if (error) { $('resultMessage').textContent = 'Could not load: ' + error.message; return; }
    school = data;
    $('curSession').textContent = data.current_session || 'not set';
    $('curTerm').textContent = data.current_term || 'not set';
    $('curNext').textContent = data.next_term_start_date || 'not set';

    if (data.current_session && data.current_term) {
        const { count } = await supabase.from('Termly_Enrollment')
            .select('enrollment_id', { count: 'exact', head: true })
            .eq('school_id', id).eq('academic_session', data.current_session).eq('term', data.current_term);
        $('curCount').textContent = count ?? 0;
    } else $('curCount').textContent = '0';

    const s = suggestNext(data.current_session, data.current_term);
    $('sessionInput').value = s.session;
    $('termSelect').value = s.term;
    $('suggestion').textContent = `Suggested next: ${s.term}, ${s.session}`;
}

$('startBtn').addEventListener('click', async () => {
    const session = $('sessionInput').value.trim();
    const term = $('termSelect').value;
    const next = $('nextInput').value || null;
    if (!/^\d{4}\/\d{4}$/.test(session)) { window.showToast('Session must look like 2026/2027.', 'error'); return; }

    const newSession = session !== school?.current_session;
    const msg = newSession
        ? `Start ${term} of the NEW session ${session}? Make sure promotions are done first.`
        : `Start ${term} of ${session}? The school will move to this term.`;
    if (!(await window.showConfirm(msg, 'Change term'))) return;

    $('startBtn').disabled = true;
    const { data, error } = await supabase.rpc('start_term', { p_session: session, p_term: term, p_next_start: next });
    $('startBtn').disabled = false;
    if (error) { window.showToast(error.message, 'error', 7000); return; }
    $('resultMessage').textContent = `Done: ${data.term}, ${data.session}. ${data.students_enrolled} students enrolled.`;
    window.showToast('Term started.', 'success');
    load();
});

load();
