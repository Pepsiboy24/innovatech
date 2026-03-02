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
  gender,
  parentInfo = null // Additional object containing parent details
) {
  try {
    const {
      data: { user: studentUser },
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
          student_id: studentUser.id,
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

    // --- STEP B & C: Parent Auth & Link ---
    if (parentInfo) {
      let finalParentId = parentInfo.linkedParentId;

      // If we don't have a linked parent ID, we must create a new parent
      if (!finalParentId) {
        // Step B: Parent Auth Signup
        const { data: { user: parentUser }, error: parentAuthError } = await supabaseClient.auth.signUp({
          email: parentInfo.parentEmail,
          password: '123456',
        });

        if (parentAuthError) {
          // If parent email already exists, it may fail here if not properly handled
          console.error("Error signing up parent auth:", parentAuthError.message);
          return false;
        }

        const authUserId = parentUser ? parentUser.id : null;

        // Insert Parent Record
        const { data: newParentData, error: parentInsertError } = await supabaseClient
          .from("Parents")
          .insert([
            {
              user_id: authUserId,
              full_name: parentInfo.parentFullName,
              email: parentInfo.parentEmail,
              phone_number: parentInfo.parentPhone,
              address: parentInfo.parentAddress || null,
              occupation: parentInfo.parentOccupation || null
            }
          ])
          .select("parent_id")
          .single();

        if (parentInsertError) {
          console.error("Error inserting parent profile:", parentInsertError.message);
          return false;
        }

        finalParentId = newParentData.parent_id;
      }

      // Step C: Establishing the Link
      const { error: linkError } = await supabaseClient
        .from("Parent_Student_Links")
        .insert([
          {
            parent_id: finalParentId,
            student_id: studentUser.id,
            relationship: parentInfo.relationship || 'Guardian'
          }
        ]);

      if (linkError) {
        console.error("Error establishing parent-student link:", linkError.message);
        return false;
      }
    }

    console.log("User signed up and profile inserted successfully.");
    return true;
  } catch (err) {
    console.error("An unexpected error occurred:", err.message);
    return false;
  }
}
