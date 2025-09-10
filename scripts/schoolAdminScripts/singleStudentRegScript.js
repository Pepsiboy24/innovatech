// Assuming supabaseClient is correctly initialized from the previous conversation.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signUpUser(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    console.error("Error signing up user:", error.message);
    return null;
  }

  // The 'data' object contains the newly created user information
  console.log("User signed up successfully:", data.user);
  return data.user;
}
