document.addEventListener("DOMContentLoaded", async () => {
    await loadTestTree();
});

document.addEventListener("DOMContentLoaded", async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData || !sessionData.session) {
        console.log("🔄 No active session found. Redirecting to login...");
        window.location.href = "index.html";
        return;
    }
});

async function loadTestTree() {
    // ✅ Get active session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData || !sessionData.session) {
        console.error("❌ No active session:", sessionError?.message);
        alert("Session expired. Please log in again.");
        window.location.href = "index.html";
        return;
    }

    const user = sessionData.session.user;
    console.log("👤 Logged-in User ID:", user.id);

    // ✅ Fetch student's `auth_uid` from the `students` table
    const { data: student, error: studentError } = await supabase
        .from("students")
        .select("auth_uid")
        .eq("auth_uid", user.id)
        .single();

    console.log("👤 Student Data:", student);
    if (studentError || !student) {
        console.error("❌ Error fetching student record:", studentError?.message);
        alert("Student data not found. Please contact support.");
        return;
    }

    const authUid = student.auth_uid;
    console.log("🎯 Auth UID Found:", authUid);

    // ✅ Fetch student's test progress using `auth_uid`
    const { data: studentTests, error: progressError } = await supabase
        .from("student_tests")
        .select("*")
        .eq("auth_uid", authUid)
        .order("section, test_number");

    if (progressError) {
        console.error("❌ Error fetching student progress:", progressError.message);
        return;
    }

    console.log("📊 Student Progress Data:", studentTests);

    // ✅ Fetch unique sections & tests from `questions` table
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

    displayTestTree(uniqueTests, studentTests);
}

// ✅ Function to Display the Test Progress Tree
function displayTestTree(tests, studentTests) {
    const testTree = document.getElementById("testTree");
    testTree.innerHTML = "";

    let currentSection = null;
    let sectionDiv = null;

    let sections = ["Logica e Insiemi", "Algebra", "Goniometria e Trigonometria", "Logaritmi e Esponenziali", "Geometria", "Probabilità, Combinatoria e Statistica", "Simulazioni"];

    tests.forEach(test => {
        if (test.section !== currentSection) {
            // ✅ Create a new section
            currentSection = test.section;
            sectionDiv = document.createElement("div");
            sectionDiv.classList.add("section");
            sectionDiv.innerHTML = `<h3>${sections[currentSection-1]}</h3>`;
            testTree.appendChild(sectionDiv);
        }

        // ✅ Find student progress for this test
        const studentTest = studentTests.find(t => t.section === test.section && t.test_number === test.test_number);
        const status = studentTest ? studentTest.status : "locked";
        
        // ✅ Create test button
        const testBtn = document.createElement("button");
        
        // ✅ Set button text based on section and test number
        if (test.section < 7) {
            let exercises = ["Esercizi per casa", "Assessment", "Post Assessment"];
            testBtn.textContent = `${exercises[test.test_number - 1]}`;
        } else {
            testBtn.textContent = `Simulazione ${test.test_number}`;
        }
        
        // ✅ Apply styles and behavior based on status
        if (status === "completed") {
            testBtn.textContent += " ✔ Done";
            testBtn.classList.add("completed");
        } else if (status === "locked") {
            testBtn.disabled = true;
            testBtn.classList.add("locked");
        } else {
            testBtn.onclick = () => startTest(test.section, test.test_number);
        }
        
        // ✅ Append the button to the section
        sectionDiv.appendChild(testBtn);  
    });

}

async function startTest(section, testNumber) {
    console.log(`Starting test: Section ${section}, Test ${testNumber}`);

    // ✅ Fetch the corresponding PDF URL from `questions` table
    const { data: testQuestion, error } = await supabase
        .from("questions")
        .select("pdf_url")
        .eq("section", section)
        .eq("test_number", testNumber)
        .limit(1)
        .single();

    if (error || !testQuestion) {
        console.error("❌ Error fetching PDF URL:", error?.message);
        alert("Error loading test. Please try again.");
        return;
    }

    const pdfUrl = testQuestion.pdf_url;

    if (!pdfUrl) {
        console.error("❌ No PDF URL found for this test.");
        alert("PDF not available for this test.");
        return;
    }

    console.log("✅ Storing test PDF URL:", pdfUrl);

    // ✅ Store test details in `sessionStorage`
    sessionStorage.setItem("testPdf", pdfUrl);
    sessionStorage.setItem("currentSection", section);
    sessionStorage.setItem("currentTestNumber", testNumber);

    // ✅ Redirect to `test.html`
    window.location.href = "test.html";
}