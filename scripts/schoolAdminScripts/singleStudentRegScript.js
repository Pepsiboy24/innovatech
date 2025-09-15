const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
// const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Assuming supabaseClient is correctly initialized from the previous conversation.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store student data temporarily after signup
export async function registerNewStudent(
  fullName,
  email,
  password,
  dateOfBirth,
  admissionDate,
  profilePicUrl
) {
  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Error signing up user:", error.message);
      return false;
    }

    // Now, insert the student's profile into the public.Students table.
    // We explicitly use the user's unique ID (uid) for the student_id
    // to satisfy the RLS policy.
    const { error: insertError } = await supabaseClient
      .from("Students")
      .insert([
        {
          student_id: user.id,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          gender: "Male",
          admission_date: admissionDate,
          profile_picture: profilePicUrl,
        },
      ]);

    if (insertError) {
      console.error("Error inserting student profile:", insertError.message);
      return false;
    }

    console.log("User signed up and profile inserted successfully.");
    return true;
  } catch (err) {
    console.error("An unexpected error occurred:", err.message);
    return false;
  }
}
