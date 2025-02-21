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
        const tutorId = document.getElementById("tutorDropdown").value;

        if (!email || !password || !fullName) {
            alert("Please fill in all fields.");
            return;
        }

        await signUpStudent(email, password, fullName, tutorId);
    });
});

// ✅ Function to Sign Up a Student and Store in Database
async function signUpStudent(email, password, fullName, tutorId) {
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

    if (!tutorId) {
        alert("Please select a tutor.");
        return;
    }

    // ✅ Insert student with selected tutor
    const { error: insertError } = await supabase
        .from("students")
        .insert([{ auth_uid: user.id, email, name: fullName, tutor_id: tutorId }]);

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

async function loadTutors() {
    const tutorDropdown = document.getElementById("tutorDropdown");

    const { data, error } = await supabase
        .from("tutors")
        .select("id, name");

    if (error) {
        console.error("❌ Error fetching tutors:", error.message);
        alert("Failed to load tutors.");
        return;
    }

    // ✅ Clear previous options
    tutorDropdown.innerHTML = '<option value="">Select Your Tutor</option>';

    // ✅ Populate dropdown with tutor names
    data.forEach(tutor => {
        let option = document.createElement("option");
        option.value = tutor.id;
        option.textContent = tutor.name;
        tutorDropdown.appendChild(option);
    });
}

// ✅ Refresh button to reload tutor list
document.getElementById("refreshTutors").addEventListener("click", loadTutors);

// ✅ Call this when the page loads
document.addEventListener("DOMContentLoaded", loadTutors);