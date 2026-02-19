import { supabase } from './config.js';

(async function authGuard() {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // No user, redirect to login
            redirectToLogin();
            return;
        }

        // 1. Check School_Admin table
        const { data: adminRecord, error: adminError } = await supabase
            .from('School_Admin')
            .select('admin_id, role')
            .eq('email', user.email) // Using "email" as per schema
            .maybeSingle();

        if (adminRecord) {
            console.log('Role: School Admin', adminRecord.role);
            // User is an admin, allow access
            return;
        }

        // 2. Check Teachers table (Exception)
        // Note: Schema says Teachers table has 'email' column
        const { data: teacherRecord, error: teacherError } = await supabase
            .from('Teachers')
            .select('teacher_id')
            .eq('email', user.email)
            .maybeSingle();

        if (teacherRecord) {
            console.log('Role: Teacher');
            // User is a teacher. They are authenticated, but shouldn't be here.
            // Redirect to index (or teacher portal if we knew the URL, but index is safe)
            // DO NOT Sign Out.
            alert('Access Denied: You are logged in as a Teacher. Redirecting to Home...');
            window.location.href = '../../index.html'; // Assuming root is up two levels
            return;
        }

        // 3. Neither Admin nor Teacher
        console.warn('Role: Unknown. User is authenticated but not found in Admin or Teacher tables.');
        console.log('User Email:', user.email);

        // Sign out and redirect
        await supabase.auth.signOut();
        redirectToLogin();

    } catch (err) {
        console.error('Unexpected Auth Guard Error:', err);
        // Better safe than sorry? Or maybe just redirect to login without signout if it's a network error?
        // Let's redirect to login.
        redirectToLogin();
    }
})();

function redirectToLogin() {
    console.log('Redirecting to login...');
    window.location.href = '../../html/login.html';
}
