import { supabaseClient } from './supabase_client.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// Create a dedicated auth client for signing up new users without overwriting the current session
const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

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
    // Get current authenticated user (school admin) to get school_id
    const { data: { user: adminUser }, error: adminError } = await supabaseClient.auth.getUser();
    
    if (adminError || !adminUser) {
      console.error("Error getting authenticated admin:", adminError?.message);
      return { success: false, error: "Admin authentication required" };
    }

    // Get school_id from admin's metadata
    const schoolId = adminUser.user_metadata?.school_id;
    if (!schoolId) {
      console.error("Admin missing school_id in metadata");
      return { success: false, error: "Admin school association not found" };
    }

    const {
      data: { user: studentUser },
      error,
    } = await authClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error("Error signing up user:", error.message);
      return { success: false, error: error.message };
    }

    // Now, insert student's profile into public.Students table.
    // We explicitly use user's unique ID (uid) for student_id
    // to satisfy RLS policy.
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
          school_id: schoolId, // CRITICAL: Use school_id from authenticated admin
        },
      ]);

    if (insertError) {
      console.error("Error inserting student profile:", insertError.message);
      return { success: false, error: insertError.message };
    }

    // --- STEP D: Create Monnify Virtual Account ---
    try {
      if (schoolId) {
        const { data: virtualAccountData, error: virtualAccountError } = await supabaseClient.functions.invoke('create-student-virtual-account', {
          body: {
            studentId: studentUser.id,
            studentName: fullName,
            schoolId: schoolId,
            parentEmail: parentInfo?.parentEmail || null
          }
        });

        if (virtualAccountError) {
          console.warn("Failed to create virtual account:", virtualAccountError.message);
          // Don't fail the registration, just log the warning
        } else if (virtualAccountData?.success) {
          console.log("Virtual account created successfully:", virtualAccountData.accountNumber);
        }
      }
    } catch (virtualError) {
      console.warn("Virtual account creation error:", virtualError.message);
      // Don't fail the registration, just log the warning
    }

    // --- STEP B & C: Parent Auth & Link ---
    if (parentInfo) {
      let finalParentId = parentInfo.linkedParentId;

      // If we don't have a linked parent ID, we must create a new parent
      if (!finalParentId) {
        // Step B: Parent Auth Signup
        const { data: { user: parentUser }, error: parentAuthError } = await authClient.auth.signUp({
          email: parentInfo.parentEmail,
          password: '123456',
        });

        if (parentAuthError) {
          // If parent email already exists, it may fail here if not properly handled
          console.error("Error signing up parent auth:", parentAuthError.message);
          return { success: false, error: parentAuthError.message };
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
          return { success: false, error: parentInsertError.message };
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
        return { success: false, error: linkError.message };
      }
    }

    console.log("User signed up and profile inserted successfully.");
    return { success: true, error: null };
  } catch (err) {
    console.error("An unexpected error occurred:", err.message);
    return { success: false, error: err.message };
  }
}
