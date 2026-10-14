// loginCards.js
// Printable login cards (8 per A4 page) for students and parents, plus the
// "reset password and print a fresh card" helpers.
//
// Passwords are never stored. They exist only in the result of creating or
// resetting an account, so a card can only be printed at that moment.
import { supabase } from '../../core/config.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── school details for the card header ────────────────────────────────────
let _school = null;
export async function getSchoolInfo() {
    if (_school) return _school;
    const { data: { user } } = await supabase.auth.getUser();
    const schoolId = user?.user_metadata?.school_id;
    let row = null;
    if (schoolId) {
        const r = await supabase.from('Schools').select('school_name, school_logo_url, login_code').eq('school_id', schoolId).maybeSingle();
        row = r.data;
    }
    _school = {
        name: row?.school_name || 'School',
        logo: row?.school_logo_url || '',
        code: row?.login_code || '',
    };
    return _school;
}

// ── cards from the results of creating students ──────────────────────────
export function cardsFromResults(results) {
    const cards = [];
    for (const r of results.filter((x) => x.success && x.password)) {
        cards.push({ kind: 'student', name: r.full_name, className: r.data?.class_input || '', login: r.login, password: r.password });
        if (r.parent?.created && r.parent.password) {
            cards.push({
                kind: 'parent',
                name: r.data?.parent?.full_name || r.parent_name || 'Parent',
                childName: r.full_name,
                login: r.parent.login,
                password: r.parent.password,
            });
        }
    }
    return cards;
}

// ── the printable sheet ───────────────────────────────────────────────────
function cardHtml(c, school, loginUrl) {
    const who = c.kind === 'parent' ? 'PARENT LOGIN' : 'STUDENT LOGIN';
    const sub = c.kind === 'parent'
        ? (c.childName ? `Parent of ${esc(c.childName)}` : '')
        : (c.className ? `Class: ${esc(c.className)}` : '');
    return `<div class="card">
  <div class="head">${school.logo ? `<img src="${esc(school.logo)}" alt="">` : ''}<div><div class="school">${esc(school.name)}</div><div class="kind">${who}</div></div></div>
  <div class="name">${esc(c.name)}</div>
  ${sub ? `<div class="sub">${sub}</div>` : ''}
  <div class="row"><span>${c.kind === 'parent' ? 'Phone / email' : 'Username'}</span><b>${esc(c.login)}</b></div>
  <div class="row"><span>Password</span><b class="pw">${esc(c.password)}</b></div>
  <ol class="steps">
    <li>Go to <b>${esc(loginUrl)}</b></li>
    <li>Type the login above and the password</li>
    <li>Choose your own new password</li>
  </ol>
  <div class="foot">Keep this card private. You will choose a new password when you sign in.</div>
</div>`;
}

const SHEET_CSS = `
@page { size: A4; margin: 8mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.card { height: 66mm; padding: 4mm 5mm; border: 1px dashed #888; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
.head { display: flex; align-items: center; gap: 6px; margin-bottom: 2mm; }
.head img { height: 9mm; width: 9mm; object-fit: contain; }
.school { font-weight: 700; font-size: 11pt; line-height: 1.1; }
.kind { font-size: 7.5pt; letter-spacing: .08em; color: #555; }
.name { font-size: 11pt; font-weight: 700; margin-top: 1mm; }
.sub { font-size: 8.5pt; color: #444; margin-bottom: 1.5mm; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 9pt; border-bottom: 1px solid #ddd; padding: 1mm 0; }
.row span { color: #555; }
.row b { font-family: "Courier New", monospace; font-size: 10pt; word-break: break-all; text-align: right; }
.row b.pw { font-size: 14pt; letter-spacing: .12em; }
.steps { margin: 2mm 0 1mm 4mm; padding: 0; font-size: 7.5pt; line-height: 1.35; color: #333; }
.foot { font-size: 7pt; color: #666; }
`;

export async function printLoginCards(cards, { loginUrl } = {}) {
    if (!cards?.length) return false;
    const school = await getSchoolInfo();
    const url = loginUrl || (location.host + '/login');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Login cards</title><style>${SHEET_CSS}</style></head>
<body><div class="grid">${cards.map((c) => cardHtml(c, school, url)).join('')}</div></body></html>`;

    // A hidden frame avoids pop-up blockers.
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    const go = () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => frame.remove(), 60000);
    };
    // let the logo load first, but never wait long
    const img = doc.querySelector('img');
    if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(go, 1500); } else { setTimeout(go, 150); }
    return true;
}

// ── reset passwords, then print fresh cards ──────────────────────────────
function note(msg, kind = 'info') {
    if (typeof window.showToast === 'function') window.showToast(msg, kind === 'error' ? 'error' : 'success', 5000);
    else console.log(msg);
}

async function resetOne(userId) {
    const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'reset_password', user_id: userId } });
    if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) { /* keep */ }
        throw new Error(msg);
    }
    if (!data?.ok) throw new Error(data?.error || 'Reset failed.');
    return data.password;
}

/**
 * students: [{ student_id, full_name, username, className }]
 * Resets each password (4 at a time), then opens the print dialog.
 * Returns { done, failed: [{name, error}] }.
 */
export async function resetAndPrintStudents(students, onProgress) {
    const school = await getSchoolInfo();
    if (!school.code) throw new Error('This school has no login code yet, so usernames cannot be shown. Set it in School Settings.');

    const cards = [];
    const failed = [];
    let finished = 0;
    const queue = students.filter((s) => s.username);
    students.filter((s) => !s.username).forEach((s) => failed.push({ name: s.full_name, error: 'No username yet.' }));

    async function worker() {
        while (queue.length) {
            const s = queue.shift();
            try {
                const password = await resetOne(s.student_id);
                cards.push({ kind: 'student', name: s.full_name, className: s.className || '', login: `${s.username}@${school.code}`, password });
            } catch (e) {
                failed.push({ name: s.full_name, error: e.message });
            }
            finished++;
            if (onProgress) onProgress(finished, students.length);
        }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);

    cards.sort((a, b) => a.name.localeCompare(b.name));
    if (cards.length) await printLoginCards(cards);
    return { done: cards.length, failed };
}

window.__loginCards = { printLoginCards, resetAndPrintStudents, cardsFromResults, getSchoolInfo };
