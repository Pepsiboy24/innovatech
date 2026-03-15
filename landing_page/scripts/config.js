// Supabase Configuration for EduHub Landing Page

const supabaseUrl = 'https://dzotwozhcxzkxtunmqth.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE';

// Initialize Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Export configuration
export const config = {
    supabaseUrl,
    supabaseAnonKey,
    app: {
        name: 'EduHub',
        description: 'School Management Reimagined',
        version: '1.0.0'
    },
    auth: {
        // Redirect URLs for different flows
        redirectTo: window.location.origin,
        // Email confirmation settings
        requireEmailConfirmation: true,
        // Plan tiers
        plans: {
            'admin-core': {
                name: 'Admin Core',
                price: 29,
                tier: 1
            },
            'student-engagement': {
                name: 'Student Engagement',
                price: 79,
                tier: 2
            },
            'full-connect': {
                name: 'Full Connect',
                price: 149,
                tier: 3
            }
        }
    }
};
