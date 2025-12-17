import { supabase } from "../../config.js";

document.addEventListener('DOMContentLoaded', () => {
    const addEventForm = document.getElementById('addEventForm');
    const modal = document.getElementById('addEventModal');

    // Check if form exists to avoid errors on other pages
    if (addEventForm) {
        addEventForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop the page from reloading

            // 1. Get values from the form inputs
            // The 'academicSession' input might be auto-filled by your calendar_display.js script
            const session = document.getElementById('academicSession').value.trim();
            const term = document.getElementById('termPeriod').value;
            const activity = document.getElementById('activityEvent').value.trim();
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;
            const duration = document.getElementById('duration').value.trim();
            const remarks = document.getElementById('remarks').value.trim();

            const submitBtn = addEventForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;

            // 2. Validate required fields
            if (!session || !term || !activity || !start) {
                alert("Please fill in all required fields (Session, Term, Activity, Start Date).");
                return;
            }

            try {
                // Show loading state on button
                submitBtn.textContent = "Saving...";
                submitBtn.disabled = true;

                // 3. INSERT the data into Supabase
                // This is the step that actually saves the session name and event details
                const { data, error } = await supabase
                    .from('academic_events')
                    .insert([
                        {
                            academic_session: session, // This saves the "2025/2026" part
                            term_period: term,
                            activity_event: activity,
                            start_date: start,
                            end_date: end || null, // Handle empty end date
                            duration: duration,
                            remarks: remarks
                        }
                    ])
                    .select();

                if (error) throw error;

                // 4. Success Actions
                alert("Event added successfully!");
                
                // Close the modal
                modal.classList.remove('show');
                
                // Reset form fields BUT keep the session name 
                // (so the user can quickly add another event to the same session)
                document.getElementById('activityEvent').value = '';
                document.getElementById('remarks').value = '';
                document.getElementById('duration').value = '';
                // Optional: clear dates if you want
                // document.getElementById('startDate').value = '';
                // document.getElementById('endDate').value = '';

                // 5. Refresh the Table View
                // This calls the function inside calendar_display.js to reload data
                if (window.refreshAcademicTable) {
                    await window.refreshAcademicTable();
                }

            } catch (err) {
                console.error("Error adding event:", err);
                alert("Failed to save event: " + err.message);
            } finally {
                // Reset button state
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});