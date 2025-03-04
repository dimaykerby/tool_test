document.addEventListener("DOMContentLoaded", async () => {
    await loadTestTree();
});

document.addEventListener("DOMContentLoaded", async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData || !sessionData.session) {
        console.log("🔄 No active session found. Redirecting to login...");
        window.location.href = "login.html";
        return;
    }
});

async function loadTestTree() {
    // ✅ Get active session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData || !sessionData.session) {
        console.error("❌ No active session:", sessionError?.message);
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
    }

    const user = sessionData.session.user;
    console.log("👤 Logged-in User ID:", user.id);

    // ✅ Fetch student's `auth_uid` from the `students` table
    const { data: student, error: studentError } = await supabase
        .from("students")
        .select("auth_uid, test")
        .eq("auth_uid", user.id)
        .single();

    console.log("👤 Student Data:", student);
    if (studentError || !student) {
        console.error("❌ Error fetching student record:", studentError?.message);
        alert("Student data not found. Please contact support.");
        return;
    }

    const authUid = student.auth_uid;
    const testType = student.test; // "tolc_i" or "bocconi"
    console.log("🎯 Student test type:", testType);

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

    if (testType === "tolc_i") {
        // For tolc_i, query the questions table
        const { data: tests, error } = await supabase
            .from("questions")
            .select("section, test_number")
            .order("section, test_number");
        if (error) {
            console.error("❌ Error fetching test structure:", error.message);
            return;
        }
        // Remove duplicates manually
        const uniqueTests = Array.from(
            new Set(tests.map(test => `${test.section}-${test.test_number}`))
        ).map(key => {
            const [section, test_number] = key.split("-").map(Number);
            return { section, test_number };
        });
        displayTolcTree(uniqueTests, studentTests);
    } else if (testType === "bocconi") {
        // For bocconi, query the questions_bocconi table (which now has section and test_number)
        const { data: tests, error } = await supabase
            .from("questions_bocconi")
            .select("section, test_number")
            .order("section, test_number");
        if (error) {
            console.error("❌ Error fetching bocconi test structure:", error.message);
            return;
        }
        // Remove duplicates manually
        const uniqueTests = Array.from(
            new Set(tests.map(test => `${test.section}-${test.test_number}`))
        ).map(key => {
            const [section, test_number] = key.split("-").map(Number);
            return { section, test_number };
        });
        displayBocconiTree(uniqueTests, studentTests);
    } else {
        console.error("❌ Unknown test type:", testType);
    }
}

// For tolc_i, use your existing tree display:
function displayTolcTree(tests, studentTests) {
    const testTree = document.getElementById("testTree");
    testTree.innerHTML = "";
    let currentSection = null;
    let sectionDiv = null;
    const sections = [
        "Logica e Insiemi", "Algebra", "Goniometria e Trigonometria",
        "Logaritmi e Esponenziali", "Geometria", "Probabilità, Combinatoria e Statistica", "Simulazioni"
    ];
    tests.forEach(test => {
        if (test.section !== currentSection) {
            currentSection = test.section;
            sectionDiv = document.createElement("div");
            sectionDiv.classList.add("section");
            sectionDiv.innerHTML = `<h3>${sections[currentSection - 1]}</h3>`;
            testTree.appendChild(sectionDiv);
        }
        // Find student's progress for this test
        const studentTest = studentTests.find(t => t.section === test.section && t.test_number === test.test_number);
        const status = studentTest ? studentTest.status : "locked";
        const testBtn = document.createElement("button");
        if (test.section < 7) {
            const exercises = ["Esercizi per casa", "Assessment", "Post Assessment"];
            testBtn.textContent = `${exercises[test.test_number - 1]}`;
        } else {
            testBtn.textContent = `Simulazione ${test.test_number}`;
        }
        if (status === "completed") {
            testBtn.textContent += " ✔ Done";
            testBtn.classList.add("completed");
        } else if (status === "locked") {
            testBtn.disabled = true;
            testBtn.classList.add("locked");
        } else {
            testBtn.onclick = () => startTolcTest(test.section, test.test_number);
        }
        sectionDiv.appendChild(testBtn);
    });
}

// For bocconi, display everything under one header "Simulazioni"
function displayBocconiTree(tests, studentTests) {
    const testTree = document.getElementById("testTree");
    testTree.innerHTML = "";
    const sectionDiv = document.createElement("div");
    sectionDiv.classList.add("section");
    sectionDiv.innerHTML = `<h3>Simulazioni</h3>`;
    testTree.appendChild(sectionDiv);

    tests.forEach(test => {
        const testBtn = document.createElement("button");
        testBtn.textContent = `Test ${test.test_number}`;
        // For bocconi, find student progress by matching section and test_number as well
        const studentTest = studentTests.find(t => t.section === test.section && t.test_number === test.test_number);
        const status = studentTest ? studentTest.status : "locked";
        if (status === "completed") {
            testBtn.textContent += " ✔ Done";
            testBtn.classList.add("completed");
        } else if (status === "locked") {
            testBtn.disabled = true;
            testBtn.classList.add("locked");
        } else {
            testBtn.onclick = () => startBocconiTest(test.section, test.test_number);
        }
        sectionDiv.appendChild(testBtn);
    });
}

async function startTolcTest(section, testNumber) {
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
    sessionStorage.setItem("testPdf", pdfUrl);
    sessionStorage.setItem("currentSection", section);
    sessionStorage.setItem("currentTestNumber", testNumber);
    window.location.href = "test.html";
}

async function startBocconiTest(section, testNumber) {
    // For Bocconi tests, no PDF URL is needed.
    sessionStorage.setItem("currentSection", section);
    sessionStorage.setItem("currentTestNumber", testNumber);
    // Redirect to the Bocconi-specific test interface
    window.location.href = "test_bocconi.html";
}