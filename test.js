const supabase = window.supabase;

let questions = [];
let currentPage = 1;
let totalPages = 1;
let studentAnswers = {};
let pdfDoc = null; // Holds the loaded PDF document

document.addEventListener("DOMContentLoaded", async () => {
    console.log("✅ DOM fully loaded. Initializing test...");

    // ✅ Ensure navigation buttons exist
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const jumpToPageBtn = document.getElementById("jumpToPage");

    if (!prevPageBtn || !nextPageBtn || !jumpToPageBtn) {
        console.error("❌ ERROR: One or more navigation buttons not found in HTML.");
        return;
    }

    // ✅ Add event listeners for navigation
    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) loadQuestionsForPage(currentPage - 1);
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) loadQuestionsForPage(currentPage + 1);
    });

    jumpToPageBtn.addEventListener("click", () => {
        const page = parseInt(document.getElementById("pageNumberInput").value);
        if (page >= 1 && page <= totalPages) {
            loadQuestionsForPage(page);
        } else {
            alert(`Invalid page number! Enter a number between 1 and ${totalPages}.`);
        }
    });

    // ✅ Load test and PDF
    await loadTest();
});

async function loadTest() {
    const pdfUrl = sessionStorage.getItem("testPdf");

    console.log("📄 Fetching test for PDF URL:", pdfUrl);

    if (!pdfUrl) {
        alert("Test PDF not found! Contact your tutor.");
        console.error("❌ ERROR: No `testPdf` found in sessionStorage.");
        window.location.href = "index.html";
        return;
    }

    // ✅ Load PDF using PDF.js
    await loadPdf(pdfUrl);

    // ✅ Fetch questions from Supabase
    let { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("pdf_url", pdfUrl)
        .order("page_number, question_number", { ascending: true });

    console.log("📄 Supabase Response:", data, error);

    if (error) {
        console.error("❌ ERROR fetching questions:", error);
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

    console.log(`✅ Test loaded successfully! Total pages: ${totalPages}`);

    // ✅ Load first page
    loadQuestionsForPage(1);
}

async function loadPdf(pdfUrl) {
    console.log("📄 Loading PDF from:", pdfUrl);

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;

        console.log(`✅ PDF Loaded! Total pages: ${pdfDoc.numPages}`);

        // ✅ Render first page
        renderPage(1);
    } catch (error) {
        console.error("❌ ERROR Loading PDF:", error);
        alert("Failed to load PDF. Check console for details.");
    }
}

async function renderPage(pageNumber) {
    if (!pdfDoc) {
        console.error("❌ ERROR: PDF not loaded yet!");
        return;
    }

    console.log(`📄 Rendering Page: ${pageNumber}`);

    const page = await pdfDoc.getPage(pageNumber);
    const canvas = document.getElementById("pdfCanvas");
    const ctx = canvas.getContext("2d");

    // ✅ Increase scale factor for better quality
    const scale = 1;  // Change to 2.0 or higher for HD quality

    const viewport = page.getViewport({ scale: scale });

    // ✅ Use device pixel ratio for sharp rendering
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };

    await page.render(renderContext);
}

function loadQuestionsForPage(page) {
    if (page < 1 || page > totalPages) {
        console.warn(`❌ Invalid page: ${page}. Total pages: ${totalPages}`);
        return;
    }

    currentPage = page;

    document.getElementById("pageNumberInput").value = page;

    // ✅ Render the correct page from the PDF
    renderPage(page);

    // ✅ Get questions for this page
    const questionContainer = document.getElementById("question-container");
    if (!questionContainer) {
        console.error("❌ ERROR: 'question-container' not found in HTML!");
        return;
    }

    questionContainer.innerHTML = "";

    const pageQuestions = questions.filter(q => q.page_number === page);
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
            choices.sort(() => Math.random() - 0.5).forEach(choice => {
                let btn = document.createElement("button");
                btn.textContent = choice;
                btn.onclick = () => selectAnswer(q.id, choice, btn);
                if (studentAnswers[q.id] === choice) {
                    btn.style.background = "green";
                }
                questionDiv.appendChild(btn);
            });
        }

        questionContainer.appendChild(questionDiv);
    });
}

function selectAnswer(questionId, answer, btn) {
    studentAnswers[questionId] = answer;
    loadQuestionsForPage(currentPage);
}