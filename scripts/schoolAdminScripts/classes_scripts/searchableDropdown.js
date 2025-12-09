const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
// const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Assuming supabaseClient is correctly initialized from the previous conversation.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('teacherSearchInput');
  const dropdownOptions = document.getElementById('teacherDropdownOptions');

  if (searchInput && dropdownOptions) {
    searchInput.addEventListener('input', async (e) => {
      const searchTerm = e.target.value.trim();
      dropdownOptions.innerHTML = ''; // Clear previous results

      if (searchTerm === '') {
        return;
      }

      try {
        const { data: teachers, error } = await supabaseClient
          .from('Teachers')
          .select('first_name')
          .ilike('first_name', `%${searchTerm}%`);

        if (error) {
          console.error('Supabase search error:', error);
          return;
        }

        if (teachers && teachers.length > 0) {
          teachers.forEach(teacher => {
            const optionEl = document.createElement('div');
            optionEl.textContent = teacher.first_name;
            dropdownOptions.appendChild(optionEl);
          });
        } else {
          const noRes = document.createElement('div');
          noRes.textContent = 'No teachers found';
          dropdownOptions.appendChild(noRes);
        }
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    });
  }
});
