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

    // ✅ Get container size to properly scale the PDF
    const container = document.querySelector(".pdf-viewer");
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // ✅ Maintain aspect ratio while scaling
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);

    const scaledViewport = page.getViewport({ scale: scale });

    // ✅ Use device pixel ratio for high-resolution rendering (Retina screens)
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(scaledViewport.width * outputScale);
    canvas.height = Math.floor(scaledViewport.height * outputScale);
    canvas.style.width = `${scaledViewport.width}px`;
    canvas.style.height = `${scaledViewport.height}px`;

    // ✅ Scale context for better quality
    ctx.scale(outputScale, outputScale);

    // ✅ Render the PDF with high resolution
    const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport
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

    // ✅ Always render the PDF when changing pages
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
            // ✅ Sort choices alphabetically
            let choices = (q.wrong_answers || []).concat(q.correct_answer);
            choices.sort((a, b) => a.localeCompare(b)); // Sort A-Z

            choices.forEach(choice => {
                let btn = document.createElement("button");
                btn.textContent = choice;
                btn.onclick = () => selectAnswer(q.id, choice, btn);
                
                // ✅ Keep previously selected answer highlighted
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

    // ✅ Only update buttons within the selected question
    const questionDiv = btn.closest("div"); // Find the parent div for this question
    const buttons = questionDiv.querySelectorAll("button");

    buttons.forEach(b => {
        if (b.textContent === answer) {
            b.style.background = "green";
        } else {
            b.style.background = "";
        }
    });
}
