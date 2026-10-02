// loginIdentity.js
// ─────────────────────────────────────────────────────────────────────────
// Supabase Auth needs an email for every account. Students and many parents
// don't have one, so for them we build a hidden "login email" that is never
// used to send mail:
//
//   Staff / anyone with a real email   ->  typed as-is        (ade@gmail.com)
//   Student                            ->  amina.bello@afm    (username@schoolcode)
//                                          stored as amina.bello@afm.<LOGIN_EMAIL_DOMAIN>
//   Parent without an email            ->  08012345678        (phone number)
//                                          stored as 2348012345678@parents.<LOGIN_EMAIL_DOMAIN>
//
// !! LOGIN_EMAIL_DOMAIN must be a domain YOU own (add any MX record so email
// !! validation accepts it) and it must match the LOGIN_EMAIL_DOMAIN secret of
// !! the `manage-users` Edge Function. Change it in both places.
// ─────────────────────────────────────────────────────────────────────────

export const LOGIN_EMAIL_DOMAIN = 'login.ultra-tea.com';

export function isPlaceholderDomain() {
    return LOGIN_EMAIL_DOMAIN.startsWith('CHANGE-ME');
}

/** Nigerian phone -> 234XXXXXXXXXX (digits only). Returns '' if it doesn't look like a phone. */
export function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('234') && d.length === 13) return d;
    if (d.startsWith('0') && d.length === 11) return '234' + d.slice(1);
    if (d.length === 10) return '234' + d;
    return '';
}

/**
 * Convert whatever the person typed into the email Supabase knows them by.
 * Returns { email, kind } where kind is 'email' | 'student' | 'parent_phone',
 * or { error } if the input can't be understood.
 */
export function toLoginEmail(input) {
    const v = String(input || '').trim().toLowerCase();
    if (!v) return { error: 'Enter your email, username or phone number.' };

    // Real email (has an @ and a dot after it)
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return { email: v, kind: 'email' };

    // Student: username@schoolcode  (no dot after the @)
    const m = v.match(/^([a-z0-9._-]+)@([a-z0-9-]+)$/);
    if (m) {
        if (isPlaceholderDomain()) {
            return { error: 'Username login is not configured yet (LOGIN_EMAIL_DOMAIN).' };
        }
        return { email: `${m[1]}@${m[2]}.${LOGIN_EMAIL_DOMAIN}`, kind: 'student' };
    }

    // Parent phone number
    const phone = normalizePhone(v);
    if (phone) {
        if (isPlaceholderDomain()) {
            return { error: 'Phone login is not configured yet (LOGIN_EMAIL_DOMAIN).' };
        }
        return { email: `${phone}@parents.${LOGIN_EMAIL_DOMAIN}`, kind: 'parent_phone' };
    }

    return { error: 'Use your email, your username@schoolcode, or your phone number.' };
}

/** Where each role lands after login. */
export function homeFor(userType) {
    switch (userType) {
        case 'teacher': return '/teacher';
        case 'parent': return '/parent';
        case 'student': return '/student';
        default: return '/admin';
    }
}
