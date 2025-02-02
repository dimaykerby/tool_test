const supabase = window.supabase;

let questions = [];
let currentPage = 1;
let totalPages = 1;
let studentAnswers = {};
let pdfDoc = null; // Holds the loaded PDF document

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

    console.log("Fetching test for PDF URL:", pdfUrl);

    if (!pdfUrl) {
        alert("Test PDF not found! Contact your tutor.");
        console.error("ERROR: No `testPdf` found in sessionStorage.");
        window.location.href = "index.html";
        return;
    }

    // Load PDF using PDF.js
    await loadPdf(pdfUrl);

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

    console.log(`Test loaded successfully! Total pages: ${totalPages}`);

    //Load first page
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

async function renderPage(pageNumber) {
    if (!pdfDoc) {
        console.error("ERROR: PDF not loaded yet!");
        return;
    }

    console.log(`Rendering Page: ${pageNumber} at Zoom Level: ${zoomLevel}`);

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

    // ✅ Render PDF onto the canvas
    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    await page.render(renderContext);

    // ✅ Ensure viewer can fully scroll when zoomed
    pdfViewer.scrollLeft = (canvas.width - pdfViewer.clientWidth) / 2;
    pdfViewer.scrollTop = (canvas.height - pdfViewer.clientHeight) / 2;
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
    if (page < 1 || page > totalPages) {
        console.warn(`Invalid page: ${page}. Total pages: ${totalPages}`);
        return;
    }

    currentPage = page;
    document.getElementById("pageNumberInput").value = page;

    //Always render the PDF when changing pages
    renderPage(page);

    //Get questions for this page
    const questionContainer = document.getElementById("question-container");
    if (!questionContainer) {
        console.error("ERROR: 'question-container' not found in HTML!");
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
            // Sort choices alphabetically
            let choices = (q.wrong_answers || []).concat(q.correct_answer);
            choices.sort((a, b) => a.localeCompare(b)); // Sort A-Z

            choices.forEach(choice => {
                let btn = document.createElement("button");
                btn.textContent = choice;
                btn.onclick = () => selectAnswer(q.id, choice, btn);
                
                //Keep previously selected answer highlighted
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

    //Only update buttons within the selected question
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

async function submitAnswers() {
    const studentId = sessionStorage.getItem("studentId");
    if (!studentId) {
        alert("Error: Student not logged in. Please log in again.");
        window.location.href = "index.html";
        return;
    }

    if (Object.keys(studentAnswers).length === 0) {
        alert("No answers selected. Please answer at least one question.");
        return;
    }

    console.log("Submitting answers...");

    // ✅ Ensure submissions array is created correctly
    const submissions = Object.entries(studentAnswers).map(([questionId, answer]) => {
        let question = questions.find(q => q.id === questionId); // Ensure questionId is UUID
        if (!question) {
            console.warn(`Question ID ${questionId} not found.`);
            return null;
        }

        //console.log(`Checking answer for question "${question.question}": Expected ${question.correct_answer}, Given ${answer}`);

        let auto_score = null;
        if (!question.is_open_ended) {
            auto_score = answer === question.correct_answer ? 1 : 0; // Auto-score MCQs
        }

        return {
            student_id: studentId,
            question_id: questionId,
            answer: answer,
            auto_score: auto_score
        };
    }).filter(submission => submission !== null); //Remove null values

    console.log("Final submission data:", submissions);

    // Insert into Supabase
    let { data, error } = await supabase
        .from("student_answers")
        .insert(submissions);

    if (error) {
        console.error("ERROR submitting answers:", error);
        alert("Submission failed. Please try again.");
    } else {
        console.log("Answers submitted successfully!", data);
        alert("Answers submitted successfully!");
    }
}