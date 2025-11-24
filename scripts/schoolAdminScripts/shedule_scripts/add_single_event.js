// Supabase setup
// const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { supabase } from "../../config.js";

document.addEventListener('DOMContentLoaded', function () {
    const addEventForm = document.getElementById('addEventForm');

    if (addEventForm) {
        addEventForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Collect form data
            const formData = new FormData(addEventForm);
            const eventData = {
                academic_session: formData.get('academicSession'),
                term_period: formData.get('termPeriod'),
                activity_event: formData.get('activityEvent'),
                start_date: formData.get('startDate'),
                end_date: formData.get('endDate'),
                duration: formData.get('duration') || null,
                remarks: formData.get('remarks') || null
            };

            try {
                // Insert into Supabase
                const { data, error } = await supabase
                    .from('academic_events')
                    .insert([eventData]);

                if (error) throw error;

                // Success
                alert('Event added successfully!');

                // Reset form and close modal
                addEventForm.reset();
                const modal = document.getElementById('addEventModal');
                modal.classList.remove('show');

                // Refresh the table (assuming calendar_display.js has a refresh function)
                if (window.refreshAcademicTable) {
                    window.refreshAcademicTable();
                }

            } catch (error) {
                console.error('Error adding event:', error);
                alert('Failed to add event. Please try again.');
            }
        });
    }
});
