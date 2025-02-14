const supabase = window.supabase;

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");
    const resetPasswordLink = document.getElementById("resetPassword");

    if (!loginBtn || !resetPasswordLink) {
        console.error("❌ ERROR: Login elements not found.");
        return;
    }

    // ✅ Handle login
    loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!email || !password) {
            alert("Please enter both email and password.");
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("❌ Login failed:", error.message);
            alert("Login failed: " + error.message);
        } else {
            console.log("✅ Logged in successfully!", data);
            window.location.href = "test_selection.html"; // ✅ Redirect to the test page
        }
    });

    // ✅ Handle password reset
    resetPasswordLink.addEventListener("click", async () => {
        const email = prompt("Enter your email to reset your password:");
        if (!email) return;

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://elrwpaezjnemmiegkyin.supabase.co"  // ✅ Change this to your actual domain
        });

        if (error) {
            console.error("❌ Password reset failed:", error.message);
            alert("Password reset failed: " + error.message);
        } else {
            alert("A password reset link has been sent to your email.");
        }
    });
});

// ✅ Function to Log In a Student
async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("❌ Login failed:", error.message);
        alert("Login failed: " + error.message);
        return;
    }

    console.log("✅ Logged in successfully!", data);

    const user = data.user;

    if (!user || !user.id) {
        console.error("❌ ERROR: No user ID found after login.");
        alert("Login error. Please try again.");
        return;
    }

    // ✅ Store `auth_uid` in `sessionStorage`
    sessionStorage.setItem("studentId", user.id);
    console.log("📌 Stored studentId in sessionStorage:", user.id);

    // ✅ Fix #2: Save session to persist login after refresh
    await supabase.auth.setSession(data.session);

    // ✅ Redirect to progress tree page
    window.location.href = "test-selection.html";
}

document.addEventListener("DOMContentLoaded", async () => {
    // ✅ Check if user is already logged in
    const { data: user, error } = await supabase.auth.getUser();

    if (user && user.id) {
        console.log("🔄 User already logged in. Redirecting...");
        window.location.href = "test-selection.html";  // ✅ Auto-redirect to progress tree
    }
});