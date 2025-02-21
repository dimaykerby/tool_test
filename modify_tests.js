import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://elrwpaezjnemmiegkyin.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscndwYWV6am5lbW1pZWdreWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNzAyMDUsImV4cCI6MjA1MzY0NjIwNX0.p6R2S1HK8kPFYiEAYtYaxIAH8XSmzjQBWQ_ywy3akdI";  ®

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ Predefined Sections, Test Numbers, and Argomenti
const sections = [
    "Logica e Insiemi", "Algebra", "Goniometria e Trigonometria",
    "Logaritmi e Esponenziali", "Geometria", "Probabilità, Combinatoria e Statistica", "Simulazioni"
];

const testNumbers = ["Esercizi per casa", "Assessment", "Post Assessment"];

const argomenti = [
    "logica e insiemi", "geometria", "scienze", "algebra", "probabilità",
    "combinatoria", "comprensione verbale", "geometria analitica", "funzioni"
];

// ✅ Function to Generate Dropdowns
function createDropdown(options, className) {
    const select = document.createElement("select");
    select.className = className;

    options.forEach((value, index) => {
        const option = document.createElement("option");
        option.value = index + 1; // Store index +1 for database
        option.textContent = value;
        select.appendChild(option);
    });

    return select;
}

// ✅ Generate Dynamic Question Fields with Dropdowns
document.getElementById("generateQuestions").addEventListener("click", () => {
    const numQuestionsInput = document.getElementById("numQuestions");
    const numQuestions = parseInt(numQuestionsInput.value);

    if (isNaN(numQuestions) || numQuestions <= 0) {
        alert("Please enter a valid number of questions.");
        return;
    }

    const questionsContainer = document.getElementById("questionsContainer");
    questionsContainer.innerHTML = ""; // Clear previous fields

    for (let i = 1; i <= numQuestions; i++) {
        const questionBlock = document.createElement("div");
        questionBlock.classList.add("question-block");

        // ✅ Create dropdowns for each question
        const sectionDropdown = createDropdown(sections, "section");
        const testNumberDropdown = createDropdown(testNumbers, "testNumber");
        const argomentoDropdown = createDropdown(argomenti, "argomento");

        questionBlock.innerHTML = `
            <h3>Question ${i}</h3>
            <label>Page Number:</label>
            <input type="number" class="pageNumber" min="1"><br>

            <label>Question Number:</label>
            <input type="number" class="questionNumber" min="1"><br>

            <label>Correct Answer:</label>
            <select class="correctAnswer">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
            </select><br>

            <label>Section:</label>
        `;
        
        // ✅ Append Dropdowns Inside Each Question Block
        questionBlock.appendChild(sectionDropdown);
        questionBlock.innerHTML += "<br><label>Test Type:</label>";
        questionBlock.appendChild(testNumberDropdown);
        questionBlock.innerHTML += "<br><label>Argomento:</label>";
        questionBlock.appendChild(argomentoDropdown);
        questionBlock.innerHTML += "<br>";

        questionsContainer.appendChild(questionBlock);
    }
});

// ✅ Submit Multiple Questions to Supabase
document.getElementById("submitQuestion").addEventListener("click", async () => {
    const pdfUrl = sessionStorage.getItem("pdfUrl");
    if (!pdfUrl) {
        alert("Upload a PDF first.");
        return;
    }

    const questionBlocks = document.querySelectorAll(".question-block");
    let questionsData = [];

    questionBlocks.forEach((block, index) => {
        const pageNumber = block.querySelector(".pageNumber").value;
        const questionNumber = block.querySelector(".questionNumber").value;
        const correctAnswer = block.querySelector(".correctAnswer").value;
        const section = block.querySelector(".section").value;
        const testNumber = block.querySelector(".testNumber").value;
        const argomento = block.querySelector(".argomento").value;

        questionsData.push({
            pdf_url: pdfUrl,
            page_number: parseInt(pageNumber),
            question_number: parseInt(questionNumber),
            correct_answer: correctAnswer,
            section: parseInt(section),
            test_number: parseInt(testNumber),
            argomento: argomento
        });
    });

    await supabase.from("questions").insert(questionsData);
    alert("✅ Questions added successfully!");
});

// ✅ Back to Tutor Dashboard
window.goBack = function () {
    window.location.href = "tutor_dashboard.html";
};