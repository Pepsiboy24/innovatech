import { supabaseClient } from './supabase_client.js';

// const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store student data temporarily after signup
export async function registerNewStudent(
  fullName,
  email,
  password,
  dateOfBirth,
  admissionDate,
  profilePicUrl,
  classId,
  gender
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
          gender: gender,
          admission_date: admissionDate,
          profile_picture: profilePicUrl,
          class_id: classId,
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
