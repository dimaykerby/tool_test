const supabase = window.supabase;

let questions = [];
let currentPage = 1;
let totalPages = 1;
let studentAnswers = {};
let sectionPageBoundaries = {};
let testEndTime;
let pdfDoc = null; // Holds the loaded PDF document
let isSubmitting = false;

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded. Initializing test...");
    const submitBtn = document.getElementById("submitAnswers");

    if (!submitBtn) {
        console.error("ERROR: 'submitAnswers' button not found in HTML.");
        return;
    }

    console.log("Submit button found!");

    submitBtn.addEventListener("click", async () => {
        console.log("Submit button clicked!");
        await submitAnswers();
    });

    // Ensure navigation buttons exist
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    //const jumpToPageBtn = document.getElementById("jumpToPage");

    if (!prevPageBtn || !nextPageBtn) {
        console.error("ERROR: One or more navigation buttons not found in HTML.");
        return;
    }

    //Add event listeners for navigation
    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) loadQuestionsForPage(currentPage - 1);
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadQuestionsForPage(currentPage + 1);
    });

    /*jumpToPageBtn.addEventListener("click", () => {
        const page = parseInt(document.getElementById("pageNumberInput").value);
        if (page >= 1 && page <= totalPages) {
            loadQuestionsForPage(page);
        } else {
            alert(`Invalid page number! Enter a number between 1 and ${totalPages}.`);
        }
    });*/

    //Load test and PDF
    await loadTest();
});

async function loadTest() {
    const pdfUrl = sessionStorage.getItem("testPdf");
    const currentSection = parseInt(sessionStorage.getItem("currentSection")); // Ensure it's a number

    console.log("Fetching test for PDF URL:", pdfUrl);

    if (!pdfUrl) {
        alert("Test PDF not found! Contact your tutor.");
        console.error("ERROR: No `testPdf` found in sessionStorage.");
        window.location.href = "index.html";
        return;
    }

    let studentId = sessionStorage.getItem("studentId");

    // ✅ If `studentId` is missing, fetch it again
    if (!studentId) {
        console.log("🔄 Fetching student ID from Supabase...");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData || !sessionData.session) {
            console.error("❌ ERROR: No active session found.");
            alert("Session expired. Please log in again.");
            window.location.href = "index.html";
            return;
        }

        studentId = sessionData.session.user.id;
        sessionStorage.setItem("studentId", studentId); // ✅ Save it again
        console.log("✅ Student ID restored:", studentId);
    }

    console.log("🎯 Student ID:", studentId);
    
    // ✅ Load PDF first, but don't render yet
    await loadPdf(pdfUrl);
    // ✅ Fetch page numbers where question numbers 20, 30, and 40 appear
    const { data: boundaries, error: boundaryError } = await supabase
        .from("questions")
        .select("question_number, page_number")
        .eq("pdf_url", pdfUrl)
        .in("question_number", [20, 30, 40])
        .order("question_number");

    if (boundaryError) {
        console.error("❌ Error fetching section boundaries:", boundaryError.message);
        return;
    }

    console.log("📌 Section Boundaries (Page Numbers):", boundaries);

    // ✅ Store dynamically fetched page numbers
    sectionPageBoundaries = {};

    boundaries.forEach(q => {
        if (q.question_number === 20) sectionPageBoundaries[1] = q.page_number;
        if (q.question_number === 30) sectionPageBoundaries[2] = q.page_number;
        if (q.question_number === 40) sectionPageBoundaries[3] = q.page_number;
    });

    console.log("✅ Section Boundaries Loaded:", sectionPageBoundaries);

    // ✅ Fetch test duration from Supabase
    const { data: testData, error: testError } = await supabase
        .from("student_tests")
        .select("duration")
        .eq("auth_uid", studentId)
        .eq("section", currentSection)
        .eq("test_number", sessionStorage.getItem("currentTestNumber"))
        .single();

    if (testError || !testData) {
        console.error("❌ Error fetching test duration:", testError?.message);
        alert("Test not found.");
        return;
    }

    console.log("📌 Test Duration:", testData.duration, "seconds");

    const durationMs = testData.duration * 1000;
    testEndTime = Date.now() + durationMs;
    console.log(`✅ Test End Time: ${new Date(testEndTime).toLocaleString()}`);

    updateTimer();        

    // Fetch questions from Supabase
    let { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("pdf_url", pdfUrl)
        .order("page_number, question_number", { ascending: true });

    console.log("Supabase Response:", data, error);

    if (error) {
        console.error("ERROR fetching questions:", error);
        alert("Error loading questions! Check Console.");
        return;
    }

    if (!data || data.length === 0) {
        console.warn("⚠️ WARNING: No questions found for this PDF.");
        alert("No questions available for this test.");
        return;
    }

    questions = data;
    totalPages = Math.max(...questions.map(q => q.page_number));

    // Build nav grid once
    buildQuestionNav();

    console.log(`Test loaded successfully! Total pages: ${totalPages}`);

    // ✅ Render only the first page correctly
    loadQuestionsForPage(1); 
}

async function loadPdf(pdfUrl) {
    console.log("Loading PDF from:", pdfUrl);

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;

        console.log(`PDF Loaded! Total pages: ${pdfDoc.numPages}`);

        //Render first page
        renderPage(1);
    } catch (error) {
        console.error("ERROR Loading PDF:", error);
        alert("Failed to load PDF. Check console for details.");
    }
}

let zoomLevel = 1.0; // Default zoom level
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

let isRendering = false;  // ✅ Prevents multiple rendering calls

async function renderPage(pageNumber) {
    if (!pdfDoc) {
        console.error("ERROR: PDF not loaded yet!");
        return;
    }

    if (isRendering) {
        console.warn(`⚠️ Already rendering page ${pageNumber}. Skipping duplicate call.`);
        return;
    }

    isRendering = true;  // ✅ Set flag to prevent another render while in progress
    console.log(`Rendering Page: ${pageNumber} at Zoom Level: ${zoomLevel}`);

    try {
        const page = await pdfDoc.getPage(pageNumber);
        const canvas = document.getElementById("pdfCanvas");
        const ctx = canvas.getContext("2d");
        const pdfViewer = document.querySelector(".pdf-viewer");

        // ✅ Get viewport based on zoom level
        const viewport = page.getViewport({ scale: zoomLevel });

        // ✅ Ensure high resolution on Retina displays
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // ✅ Set correct scaling
        ctx.scale(outputScale, outputScale);

        // ✅ Clear previous rendering
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ✅ Render PDF onto the canvas
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext);

        // ✅ Ensure viewer can fully scroll when zoomed
        pdfViewer.scrollLeft = (canvas.width - pdfViewer.clientWidth) / 2;
        pdfViewer.scrollTop = (canvas.height - pdfViewer.clientHeight) / 2;
        setTimeout(() => { isRendering = false; }, 300);
    } catch (error) {
        console.error("❌ ERROR rendering page:", error);
    } finally {
        isRendering = false;  // ✅ Reset flag after render completes
    }
}
    

// ✅ Function to Adjust Scrolling After Zoom
function adjustScrolling() {
    const pdfViewer = document.querySelector(".pdf-viewer");
    const canvas = document.getElementById("pdfCanvas");

    pdfViewer.scrollLeft = (canvas.width - pdfViewer.clientWidth) / 2;
    pdfViewer.scrollTop = (canvas.height - pdfViewer.clientHeight) / 2;
}

// ✅ Zoom controls
document.getElementById("zoomIn").addEventListener("click", () => {
    zoomLevel = Math.min(zoomLevel + 0.2, 3.0); // Max zoom: 3.0x
    renderPage(currentPage);
});

document.getElementById("zoomOut").addEventListener("click", () => {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5); // Min zoom: 0.5x
    renderPage(currentPage);
});

// ✅ Enable Drag Scrolling When Zoomed In
const pdfViewer = document.querySelector(".pdf-viewer");

pdfViewer.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.pageX - pdfViewer.offsetLeft;
    startY = e.pageY - pdfViewer.offsetTop;
    scrollLeft = pdfViewer.scrollLeft;
    scrollTop = pdfViewer.scrollTop;
    pdfViewer.style.cursor = "grabbing";
});

pdfViewer.addEventListener("mouseleave", () => {
    isDragging = false;
    pdfViewer.style.cursor = "grab";
});

pdfViewer.addEventListener("mouseup", () => {
    isDragging = false;
    pdfViewer.style.cursor = "grab";
});

pdfViewer.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - pdfViewer.offsetLeft;
    const y = e.pageY - pdfViewer.offsetTop;
    const walkX = (x - startX) * 1.5; // Adjust scroll speed
    const walkY = (y - startY) * 1.5;
    pdfViewer.scrollLeft = scrollLeft - walkX;
    pdfViewer.scrollTop = scrollTop - walkY;
});


function loadQuestionsForPage(page) {
    const submitButton = document.getElementById("submitAnswers");    
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    console.log(`📄 Loading Page: ${page}`);

    currentPage = page;
    sessionStorage.setItem("currentPage", currentPage);

    renderPage(page);
    buildQuestionNav(); // Refresh nav grid highlight

    const questionContainer = document.getElementById("question-container");
    if (!questionContainer) {
        console.error("ERROR: 'question-container' not found in HTML!");
        return;
    }

    questionContainer.innerHTML = "";

    // ✅ First Page Special Display: Hide Navigation & Show Welcome Message
    if (page === 1) {
        console.log("📄 First Page - Showing Welcome Message");

        questionContainer.innerHTML = `
            <h2>Il test è da svolgere a schermo intero. Ogni tentativo di uscire annulla il test. Buon lavoro! 🎯</h2>
            <p>Premi "Inizia Test" per cominciare.</p>
            <button id="startTestBtn">Inizia Test</button>
        `;

        // ✅ Hide navigation buttons
        prevPageBtn.style.display = "none";
        nextPageBtn.style.display = "none";
        if (submitButton) submitButton.style.display = "none";

        // ✅ Attach event listener to "Inizia Test"
        document.getElementById("startTestBtn").addEventListener("click", async () => {
            await enforceFullScreen();  // ✅ Go fullscreen before starting
            loadQuestionsForPage(2);  // ✅ Move to the first real test page
        });

        return; // ✅ Prevent further execution
    }

    // ✅ Show navigation buttons again on other pages
    prevPageBtn.style.display = "inline-block";
    nextPageBtn.style.display = "inline-block";
    if (submitButton) submitButton.style.display = "inline-block";

    const pageQuestions = questions.filter(q => q.page_number === currentPage);

    if (pageQuestions.length === 0) {
        console.warn(`⚠️ No questions found on Page ${page}.`);
        return;
    }

    pageQuestions.forEach(q => {
        const questionDiv = document.createElement("div");
        questionDiv.innerHTML = `<h3>Quesito ${q.question_number}</h3>`;

        if (q.is_open_ended) {
            let input = document.createElement("input");
            input.type = "text";
            input.value = studentAnswers[q.id] || "";
            input.oninput = () => studentAnswers[q.id] = input.value;
            questionDiv.appendChild(input);
        } else {
            let choices = (q.wrong_answers || []).concat(q.correct_answer);
            // Add the two extra choices:
            choices = choices.concat(["insicuro", "non ho idea"]);
            choices.sort((a, b) => a.localeCompare(b));

            choices.forEach(choice => {
                let btn = document.createElement("button");
                btn.textContent = choice;
                btn.onclick = () => selectAnswer(q.id, choice, btn);

                if (studentAnswers[q.id] === choice || 
                    (choice.toLowerCase() === "insicuro" && studentAnswers[q.id] === "x") ||
                    (choice.toLowerCase() === "non ho idea" && studentAnswers[q.id] === "y")) {
                     btn.style.background = "green";
                 }

                questionDiv.appendChild(btn);
            });
        }

        questionContainer.appendChild(questionDiv);
    });

    updateNavigationButtons();
}

function selectAnswer(questionId, answer, btn) {
    let mappedAnswer = answer;
    // Map "insicuro" to "x" and "non ho idea" to "y"
    if(answer.toLowerCase() === "insicuro") {
        mappedAnswer = "x";
    } else if(answer.toLowerCase() === "non ho idea") {
        mappedAnswer = "y";
    }
    studentAnswers[questionId] = mappedAnswer;
    buildQuestionNav(); // Update nav grid

    // Only update buttons within the selected question
    const questionDiv = btn.closest("div"); // Find the parent div for this question
    const buttons = questionDiv.querySelectorAll("button");

    buttons.forEach(b => {
        // Determine mapped value for the button's text
        let btnMapped = b.textContent;
        if(btnMapped.toLowerCase() === "insicuro") btnMapped = "x";
        if(btnMapped.toLowerCase() === "non ho idea") btnMapped = "y";

        if (btnMapped === mappedAnswer) {
            b.style.background = "green";
        } else {
            b.style.background = "";
        }
    });
}

async function submitAnswers() {
    isSubmitting = true;
    let studentId = sessionStorage.getItem("studentId");

    // ✅ If `studentId` is missing, fetch it again
    if (!studentId) {
        console.log("🔄 Fetching student ID from Supabase...");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !sessionData || !sessionData.session) {
            console.error("❌ ERROR: No active session found.");
            alert("Session expired. Please log in again.");
            window.location.href = "index.html";
            return;
        }

        studentId = sessionData.session.user.id;
        sessionStorage.setItem("studentId", studentId); // ✅ Save it again
        console.log("✅ Student ID restored:", studentId);
    }

    if (Object.keys(studentAnswers).length === 0) {
        alert("No answers selected. Please answer at least one question.");
        return;
    }

    console.log("📌 Submitting answers for student:", studentId);

    // Instead of mapping over studentAnswers, loop over all questions:
    const submissions = questions.map(q => {
        // If no answer selected for this question, assign "z"
        const answer = (q.id in studentAnswers) ? studentAnswers[q.id] : "z";
        let auto_score = null;
        if (!q.is_open_ended) {
            auto_score = answer === q.correct_answer ? 1 : 0;
        }
        return {
            auth_uid: studentId,  // Using auth_uid
            question_id: q.id,
            answer: answer,
            auto_score: auto_score
        };
    });

    console.log("✅ Final submission data:", submissions);

    // ✅ Insert into Supabase
    let { data, error } = await supabase
        .from("student_answers")
        .insert(submissions);

    if (error) {
        console.error("❌ ERROR submitting answers:", error);
        alert("Submission failed. Please try again.");
    } else {
        console.log("✅ Answers submitted successfully!", data);
        alert("Answers submitted successfully!");
    }

    // ✅ Mark test as completed in `student_tests`
    await supabase
        .from("student_tests")
        .update({ status: "completed" })
        .eq("auth_uid", studentId)
        .eq("section", sessionStorage.getItem("currentSection"))
        .eq("test_number", sessionStorage.getItem("currentTestNumber"));

    console.log("✅ Test marked as completed!");

    // ✅ Turn test button green in `test-selection.html`
    sessionStorage.setItem("testCompleted", "true");
    window.location.href = "test_selection.html";    
}

// ✅ Function to Update the Timer Display
function updateTimer() {
    const timerElement = document.getElementById("timer");

    if (!timerElement) {
        console.error("❌ ERROR: Timer element not found in HTML.");
        return;
    }

    function tick() {
        const now = new Date().getTime();
        const endTime = new Date(testEndTime).getTime();

        const timeLeft = endTime - now; // ✅ Correct calculation

        if (timeLeft <= 0) {
            console.log("⏳ Time's up! Auto-submitting answers...");
            submitAnswers();  // ✅ Auto-submit when time runs out
            clearInterval(timerInterval);
            return;
        }

        // ✅ Format Time (MM:SS)
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerElement.textContent = `Time Left: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    }

    const timerInterval = setInterval(tick, 1000); // ✅ Update every second
    tick(); // ✅ Call once immediately
}

let currentSubsection = 1; // Track which subsection the student is on
function updateNavigationButtons() {
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    console.log(`🔄 Updating buttons for Page ${currentPage}`);

    const currentSection = parseInt(sessionStorage.getItem("currentSection"));

    // ✅ Prevent navigating back after section transition
    const isSectionBoundary = Object.values(sectionPageBoundaries).includes(currentPage);
    const isPastBoundary = Object.values(sectionPageBoundaries).some(boundary => boundary && currentPage === boundary+1);

    if (currentSection === 7 && isSectionBoundary) {
        nextPageBtn.textContent = "Prossima Sezione";
    } else {
        nextPageBtn.textContent = "Avanti";
    }

    // ✅ Disable "Previous Page" if past a section boundary (Page 21, 31, 41)
    if (currentSection === 7 && isPastBoundary) {
        prevPageBtn.disabled = true;
    } else {
        prevPageBtn.disabled = false;
    }
}

// ✅ Select the test container (modify ID/class as needed)
const testContainer = document.querySelector("#testContainer"); // Ensure this ID exists in test.html

// ✅ Force Fullscreen on Wide Screen When Test Starts
async function enforceFullScreen() {
    if (window.innerWidth > 1024) { // ✅ Only for wide screens
        if (!document.fullscreenElement) {
            try {
                await document.documentElement.requestFullscreen();
                console.log("🔲 Fullscreen Mode Activated");
            } catch (err) {
                console.error("❌ Fullscreen mode not supported:", err);
            }
        }
    }
}

// ✅ Detect Fullscreen Exit & Force Re-Entry
document.addEventListener("fullscreenchange", function () {
    if (isSubmitting) return; // ✅ Skip if already submitting
    if (!document.fullscreenElement) {
        alert("⚠ The test has been cancelled. You are being redirected to your progress tree.");
        window.location.href = "test_selection.html"; // ✅ Redirect immediately
    }
});

function buildQuestionNav() {
    const questionNav = document.getElementById("questionNav");
    if (!questionNav) return;
  
    questionNav.innerHTML = ""; // Clear existing
  
    // Determine the current question range based on the questions on the current page.
    const currentPageQuestions = questions.filter(q => q.page_number === currentPage);
    let currentRange = null;
    if (currentPageQuestions.length > 0) {
      const firstQuestionNumber = currentPageQuestions[0].question_number;
      if (firstQuestionNumber >= 1 && firstQuestionNumber <= 20)
        currentRange = { min: 1, max: 20 };
      else if (firstQuestionNumber >= 21 && firstQuestionNumber <= 30)
        currentRange = { min: 21, max: 30 };
      else if (firstQuestionNumber >= 31 && firstQuestionNumber <= 40)
        currentRange = { min: 31, max: 40 };
      else if (firstQuestionNumber >= 41 && firstQuestionNumber <= 50)
        currentRange = { min: 41, max: 50 };
    }
  
    // 1. Sort questions by question_number
    const sortedQuestions = [...questions].sort(
      (a, b) => a.question_number - b.question_number
    );
  
    // 2. Create a cell for each question
    sortedQuestions.forEach((q) => {
      const btn = document.createElement("button");
      btn.classList.add("question-cell");
  
      // Display question_number in the cell
      btn.textContent = q.question_number;
  
      // 3. If answered, turn green
      if (studentAnswers[q.id]) {
        btn.classList.add("answered");
      }
  
      // 4. If this question is on the current page, highlight it
      if (q.page_number === currentPage) {
        btn.classList.add("current-question");
      }
  
      // 5. Disable navigation to questions outside the current range
      if (currentRange && (q.question_number < currentRange.min || q.question_number > currentRange.max)) {
        btn.disabled = true;
        btn.classList.add("disabled-nav"); // Optional: add a class for styling (e.g., to gray out)
      } else {
        // Allow navigation within the current range
        btn.addEventListener("click", () => {
          loadQuestionsForPage(q.page_number);
        });
      }
  
      questionNav.appendChild(btn);
    });
  }