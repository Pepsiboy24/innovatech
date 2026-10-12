// currentTerm.js
// Reads the school's current session and term (set on the Term & Session page)
// and pre-selects them in any session/term dropdown on the page.
// Add to a page with:  <script type="module" src="/core/currentTerm.js"></script>
// Users can still change the dropdowns; once they do, we leave them alone.
import { supabase } from './config.js';

const SESSION_IDS = ['academicSessionSelect', 'academicSession'];
const TERM_IDS = ['termSelect', 'bulkTermSelect', 'term'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

let cached = null;

export async function getCurrentTerm() {
    if (cached) return cached;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;
        if (!schoolId) return null;
        const { data, error } = await supabase
            .from('Schools')
            .select('current_session, current_term')
            .eq('school_id', schoolId)
            .single();
        if (error || !data) return null;
        const term = TERMS.includes(data.current_term) ? data.current_term : null;
        cached = { session: data.current_session || null, term };
    } catch (e) {
        console.warn('currentTerm: could not load', e);
        return null;
    }
    return cached;
}

const touched = new WeakSet();   // dropdowns the user changed by hand

function fill(select, value) {
    if (!select || !value || touched.has(select)) return;
    if (!select.dataset.ctWatched) {
        select.dataset.ctWatched = '1';
        select.addEventListener('change', e => { if (e.isTrusted) touched.add(select); });
    }
    if (select.value === value) return;
    let opt = [...select.options].find(o => o.value === value || o.text === value);
    if (!opt) {                                           // option not in the list yet
        opt = new Option(value, value);
        select.add(opt);
    }
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function apply() {
    const cur = await getCurrentTerm();
    if (!cur) return;
    SESSION_IDS.forEach(id => fill(document.getElementById(id), cur.session));
    TERM_IDS.forEach(id => fill(document.getElementById(id), cur.term));
}

function start() {
    apply();
    // Pages that load their own dropdown options after startup: try again
    // when options change, and a few times in the first seconds.
    const targets = [...SESSION_IDS, ...TERM_IDS]
        .map(id => document.getElementById(id)).filter(Boolean);
    const obs = new MutationObserver(() => apply());
    targets.forEach(t => obs.observe(t, { childList: true }));
    let n = 0;
    const timer = setInterval(() => { apply(); if (++n >= 8) { clearInterval(timer); obs.disconnect(); } }, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
