document.addEventListener("DOMContentLoaded", () => {
    const signupBtn = document.getElementById("signupBtn");

    if (!signupBtn) {
        console.error("❌ ERROR: Signup button not found.");
        return;
    }

    signupBtn.addEventListener("click", async () => {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        const fullName = document.getElementById("fullName").value.trim();

        if (!email || !password || !fullName) {
            alert("Please fill in all fields.");
            return;
        }

        await signUpStudent(email, password, fullName);
    });
});

// ✅ Function to Sign Up a Student and Store in Database
async function signUpStudent(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        console.error("❌ Signup failed:", error.message);
        alert("Signup failed: " + error.message);
        return;
    }

    const user = data.user;
    console.log("✅ Signup successful! Auth UID:", user.id);

    // ✅ Wait until the user exists in `auth.users`
    await new Promise(resolve => setTimeout(resolve, 3000));  // Wait 3 seconds    

    // ✅ Insert student details into `students` table
    const { error: insertError } = await supabase.from("students").insert([
        { auth_uid: user.id, email: email, name: fullName }
    ]);

    if (insertError) {
        console.error("❌ Error saving student info:", insertError.message);
        alert("Error saving student info.");
        return;
    }

    // ✅ Initialize their test progress in `student_tests`
    await initializeStudentTests(user.id);

    alert("✅ Signup successful! You can now log in.");
    window.location.href = "index.html"; // Redirect to login
}

// ✅ Function to Insert Test Progress for a New Student
async function initializeStudentTests(authUid) {
    console.log("📌 Initializing tests for user:", authUid);

    // ✅ Fetch unique section & test_number from `questions` table
    const { data: tests, error } = await supabase
        .from("questions")
        .select("section, test_number")
        .order("section, test_number");

    if (error) {
        console.error("❌ Error fetching test structure:", error.message);
        return;
    }

    // ✅ Remove duplicates manually
    const uniqueTests = Array.from(
        new Set(tests.map(test => `${test.section}-${test.test_number}`))
    ).map(key => {
        const [section, test_number] = key.split("-").map(Number);
        return { section, test_number };
    });

    // ✅ Prepare test data for insertion
    const testEntries = uniqueTests.map(test => ({
        auth_uid: authUid,  // ✅ Now using `auth_uid`
        section: test.section,
        test_number: test.test_number,
        status: test.section === 1 && test.test_number === 1 ? "unlocked" : "locked"
    }));

    // ✅ Insert tests into `student_tests`
    const { error: insertError } = await supabase.from("student_tests").insert(testEntries);

    if (insertError) {
        console.error("❌ Error initializing student tests:", insertError.message);
    } else {
        console.log("✅ Student test entries created!");
    }
}