const supabase = window.supabase;

document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");

    if (!loginBtn) {
        console.error("❌ ERROR: 'loginBtn' not found in HTML.");
        return;
    }

    document.getElementById("loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();  // Prevent form reload

        const studentCode = document.getElementById("studentCode").value.trim();
        const errorMessage = document.getElementById("errorMessage");

        if (!studentCode) {
            errorMessage.textContent = "Please enter your code!";
            console.log("⚠️ No code entered.");
            return;
        }

        console.log(`🔍 Fetching student with login code: ${studentCode}...`);

        let { data: student, error } = await supabase
            .from("students")
            .select("*")
            .eq("login_code", studentCode)
            .single();

        console.log("📄 Supabase Response:", student, error);

        if (error || !student) {
            errorMessage.textContent = "Invalid code. Try again!";
            console.error("❌ ERROR: Login failed", error);
            return;
        }

        console.log("✅ Login successful!", student);

        // ✅ Store assigned test PDF in sessionStorage
        sessionStorage.setItem("studentId", student.id);
        sessionStorage.setItem("studentName", student.name);
        sessionStorage.setItem("testPdf", student.pdf_url);  // Ensure `pdf_url` exists in `students` table

        console.log("Redirecting to test page...");
        window.location.href = "test.html";
    });
});