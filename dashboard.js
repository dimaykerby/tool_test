import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://elrwpaezjnemmiegkyin.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscndwYWV6am5lbW1pZWdreWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNzAyMDUsImV4cCI6MjA1MzY0NjIwNX0.p6R2S1HK8kPFYiEAYtYaxIAH8XSmzjQBWQ_ywy3akdI"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const studentId = sessionStorage.getItem("selectedStudentId");
const studentName = sessionStorage.getItem("selectedStudentName");
const exercises_arr = ["Esercizi per casa", "Assessment", "Post Assessment"];
const sections_arr = [
    "Logica e Insiemi", "Algebra", "Goniometria e Trigonometria",
    "Logaritmi e Esponenziali", "Geometria", "Probabilità, Combinatoria e Statistica", "Simulazioni"
];
document.getElementById("dashboardTitle").textContent = `${studentName}'s Dashboard`;

if (!studentId) {
    alert("Error: No student selected.");
    window.location.href = "tutor_dashboard.html";
}

// Global variables to hold fetched data, test type, and chart instances
let globalAnswers = [];
let globalQuestions = [];
let globalTestType; // holds student.test value
let chartInstance;     // for the pie chart
let barChartInstance;  // for the bar chart

async function loadDashboard() {
    // Set up the pie chart canvas
    const pieCanvas = document.getElementById("resultsChart");
    pieCanvas.style.maxWidth = "400px";
    pieCanvas.style.maxHeight = "400px";
    pieCanvas.width = 400;
    pieCanvas.height = 400;

    // Set up the bar chart canvas (hidden by default)
    const barCanvas = document.getElementById("barChart");
    barCanvas.style.maxWidth = "400px";
    barCanvas.style.maxHeight = "400px";
    barCanvas.width = 400;
    barCanvas.height = 400;
    barCanvas.style.display = "none";

    const { data: student, error: studentError } = await supabase
        .from("students")
        .select("test")
        .eq("auth_uid", studentId)
        .single();

    if (studentError || !student) {
        console.error("❌ Error fetching student test type:", studentError?.message);
        alert("Student data not found.");
        return;
    }

    globalTestType = student.test;
    console.log(`📌 Student Test Type: ${globalTestType}`);

    // For tolc_i students, show section and exercise filters.
    // For Bocconi (non-tolc_i), hide the section filter but keep exercise and argomento filters.
    if (globalTestType === "tolc_i") {
        document.getElementById("sectionFilter").style.display = "inline-block";
        document.getElementById("exerciseFilter").style.display = "inline-block";
    } else {
        document.getElementById("sectionFilter").style.display = "none";
        document.getElementById("exerciseFilter").style.display = "inline-block";
    }

    // Fetch data from appropriate tables.
    const answerTable = globalTestType === "tolc_i" ? "student_answers" : "studentbocconi_answers";
    const questionTable = globalTestType === "tolc_i" ? "questions" : "questions_bocconi";

    const { data: answers, error: answersError } = await supabase
        .from(answerTable)
        .select("question_id, answer, auto_score")
        .eq("auth_uid", studentId);

    if (answersError) {
        console.error("❌ Error fetching student answers:", answersError.message);
        return;
    }

    const { data: questions, error: questionsError } = await supabase
        .from(questionTable)
        .select("id, section, test_number, argomento");

    if (questionsError) {
        console.error("❌ Error fetching questions:", questionsError.message);
        return;
    }

    // Store data globally.
    globalAnswers = answers;
    globalQuestions = questions;

    // Populate section and argomento filters.
    populateFilters(questions, globalTestType);
    // Populate exercise filter based on current section selection (or for Bocconi, overall simulazioni).
    updateExerciseFilter();

    // Add change listeners for live updates.
    // For tolc_i, change in section filter updates exercise filter.
    document.getElementById("sectionFilter").addEventListener("change", () => {
        updateExerciseFilter();
        filterDashboard();
    });
    document.getElementById("exerciseFilter").addEventListener("change", filterDashboard);
    document.getElementById("argomentoFilter").addEventListener("change", filterDashboard);

    // Initially update the dashboard.
    filterDashboard();
}

function populateFilters(questions, testType) {
    const sectionFilter = document.getElementById("sectionFilter");
    const exerciseFilter = document.getElementById("exerciseFilter");
    const argomentoFilter = document.getElementById("argomentoFilter");

    // Clear and add default "All" options.
    sectionFilter.innerHTML = `<option value="all">All Sections</option>`;
    exerciseFilter.innerHTML = `<option value="all">All Exercises</option>`;
    argomentoFilter.innerHTML = `<option value="all">All Argomenti</option>`;

    const sections = new Set();
    const argomenti = new Set();

    questions.forEach(q => {
        if (testType === "tolc_i") {
            sections.add(q.section);
        }
        argomenti.add(q.argomento);
    });

    if (testType === "tolc_i") {
        sections.forEach(s => {
            sectionFilter.innerHTML += `<option value="${s}">${sections_arr[s - 1]}</option>`;
        });
    }
    argomenti.forEach(a => {
        argomentoFilter.innerHTML += `<option value="${a}">${a}</option>`;
    });
}

function updateExerciseFilter() {
    const exerciseFilter = document.getElementById("exerciseFilter");
    // Clear current options.
    exerciseFilter.innerHTML = "";

    if (globalTestType !== "tolc_i") {
        // For Bocconi students, show only simulazione options.
        exerciseFilter.innerHTML = `<option value="all">All Simulazioni</option>`;
        const simulazioniSet = new Set();
        globalQuestions.forEach(q => {
            simulazioniSet.add(q.test_number);
        });
        simulazioniSet.forEach(num => {
            exerciseFilter.innerHTML += `<option value="${num}">Simulazione ${num}</option>`;
        });
    } else {
        // For tolc_i students, update based on the selected section.
        const sectionFilter = document.getElementById("sectionFilter");
        if (sectionFilter.value === "all") {
            exerciseFilter.innerHTML = `<option value="all">All Exercises</option>`;
        } else if (sectionFilter.value === "7") {
            exerciseFilter.innerHTML = `<option value="all">All Simulazioni</option>`;
            const simulazioniSet = new Set();
            globalQuestions.forEach(q => {
                if (q.section.toString() === "7") {
                    simulazioniSet.add(q.test_number);
                }
            });
            simulazioniSet.forEach(num => {
                exerciseFilter.innerHTML += `<option value="${num}">Simulazione ${num}</option>`;
            });
        } else {
            exerciseFilter.innerHTML = `<option value="all">All Exercises</option>`;
            const exercisesSet = new Set();
            globalQuestions.forEach(q => {
                if (q.section.toString() === sectionFilter.value) {
                    exercisesSet.add(q.test_number);
                }
            });
            exercisesSet.forEach(num => {
                const label = exercises_arr[num - 1] || `Exercise ${num}`;
                exerciseFilter.innerHTML += `<option value="${num}">${label}</option>`;
            });
        }
    }
}

function filterDashboard() {
    // Get filter values.
    // For Bocconi, the section filter is hidden; default its value to "7" (Simulazioni).
    let sectionFilterVal = document.getElementById("sectionFilter").value;
    if (globalTestType !== "tolc_i") {
        sectionFilterVal = "7";
    }
    const exerciseFilterVal = document.getElementById("exerciseFilter").value;
    const argomentoFilterVal = document.getElementById("argomentoFilter").value;
    const scoreDisplay = document.getElementById("scoreDisplay");
    const scoreDisplay2 = document.getElementById("scoreDisplay2");

    // Filter questions based on selections.
    let filteredQuestions = globalQuestions;
    if (sectionFilterVal !== "all") {
        filteredQuestions = filteredQuestions.filter(q => q.section.toString() === sectionFilterVal);
    }
    if (exerciseFilterVal !== "all") {
        filteredQuestions = filteredQuestions.filter(q => q.test_number.toString() === exerciseFilterVal);
    }
    if (argomentoFilterVal !== "all") {
        filteredQuestions = filteredQuestions.filter(q => q.argomento === argomentoFilterVal);
    }

    // Allowed question IDs from filtered questions.
    const allowedQuestionIds = new Set(filteredQuestions.map(q => q.id));
    const filteredAnswers = globalAnswers.filter(ans => allowedQuestionIds.has(ans.question_id));

    // Always update the pie chart with the filtered answers.
    updateChart(filteredAnswers);

    // Updated condition for showing the bar chart:
    // For Bocconi: if exercise is "all" and a specific argomento is chosen.
    // For tolc_i: if both section and exercise are "all" and a specific argomento is chosen.
    const barCanvas = document.getElementById("barChart");
    if (
        (globalTestType !== "tolc_i" && exerciseFilterVal === "all" && argomentoFilterVal !== "all") ||
        (globalTestType === "tolc_i" && sectionFilterVal === "all" && exerciseFilterVal === "all" && argomentoFilterVal !== "all")
    ) {
        barCanvas.style.display = "block";
        updateBarChart(filteredAnswers, filteredQuestions);
    } else {
        if (barChartInstance) {
            barChartInstance.destroy();
            barChartInstance = null;
        }
        barCanvas.style.display = "none";
    }

    // Calculate and display the score based on the conditions.
    if (
        (globalTestType === "tolc_i" && sectionFilterVal !== "all" && exerciseFilterVal !== "all" && argomentoFilterVal === "all") ||
        (globalTestType !== "tolc_i" && exerciseFilterVal !== "all" && argomentoFilterVal === "all")
    ) {
        const score = calculateScore(filteredAnswers, 1); // Change 1 to 2 for the second modality
        scoreDisplay.textContent = `Score (1 for correct, 0 otherwise): ${score}`;
        const score2 = calculateScore(filteredAnswers, 2);
        scoreDisplay2.textContent = `Score (1 for correct, -0.25 for incorrect, 0 otherwise): ${score2}`;
        scoreDisplay.style.display = "block";
        scoreDisplay2.style.display = "block";
    } else {
        scoreDisplay.style.display = "none";
        scoreDisplay2.style.display = "none";
    }
}

function calculateScore(answers, modality) {
    let score = 0;
    answers.forEach(ans => {
        if (modality === 1) {
            score += ans.auto_score === 1 ? 1 : 0;
        } else if (modality === 2) {
            if (ans.auto_score === 1) {
                score += 1;
            } else if (ans.auto_score === 0 && !["x", "y", "z"].includes(ans.answer)) {
                score -= 0.25;
            }
        }
    });
    return score;
}

function updateChart(answers) {
    if (chartInstance) {
        chartInstance.destroy();
    }
    const categories = { correct: 0, wrong: 0, insicuro: 0, "non ho idea": 0, "non dato": 0 };
    answers.forEach(d => {
        if (d.auto_score === 1) {
            categories.correct++;
        } else if (d.auto_score === 0 && !["x", "y", "z"].includes(d.answer)) {
            categories.wrong++;
        } else if (d.answer === "x") {
            categories.insicuro++;
        } else if (d.answer === "y") {
            categories["non ho idea"]++;
        } else {
            categories["non dato"]++;
        }
    });
    const ctx = document.getElementById("resultsChart").getContext("2d");
    chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: ["green", "red", "blue", "orange", "gray"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: {
                    formatter: (value, context) => {
                        const dataArr = context.chart.data.datasets[0].data;
                        const total = dataArr.reduce((acc, val) => acc + val, 0);
                        if (total === 0) return '';
                        const percentage = ((value / total) * 100).toFixed(2);
                        return Number(percentage) === 0 ? '' : percentage + '%';
                    },
                    color: "#fff",
                    font: { weight: "bold" }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateBarChart(filteredAnswers, filteredQuestions) {
    // Group by section and exercise for the chosen argomento.
    const groups = {};
    filteredQuestions.forEach(q => {
        const key = `${q.section}-${q.test_number}`;
        if (!groups[key]) {
            groups[key] = { total: 0, correct: 0, section: q.section, test_number: q.test_number };
        }
        groups[key].total++;
    });
    const questionGroupMap = {};
    filteredQuestions.forEach(q => {
        questionGroupMap[q.id] = `${q.section}-${q.test_number}`;
    });
    filteredAnswers.forEach(ans => {
        const key = questionGroupMap[ans.question_id];
        if (key && ans.auto_score === 1) {
            groups[key].correct++;
        }
    });
    const groupKeys = Object.keys(groups).sort((a, b) => {
        const [s1, t1] = a.split("-").map(Number);
        const [s2, t2] = b.split("-").map(Number);
        return s1 === s2 ? t1 - t2 : s1 - s2;
    });
    const labels = [];
    const data = [];
    groupKeys.forEach(key => {
        const group = groups[key];
        const percentage = group.total ? (group.correct / group.total * 100) : 0;
        const sectionName = sections_arr[group.section - 1];
        let exerciseName;
        if (group.section === 7) {
            exerciseName = `Simulazione ${group.test_number}`;
        } else {
            exerciseName = exercises_arr[group.test_number - 1] || `Exercise ${group.test_number}`;
        }
        labels.push(`${sectionName} - ${exerciseName}`);
        data.push(percentage.toFixed(2));
    });
  
    const ctx = document.getElementById("barChart").getContext("2d");
    if (barChartInstance) {
        barChartInstance.destroy();
    }
    barChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Percentage Correct",
                data: data,
                backgroundColor: "blue"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            },
            plugins: {
                datalabels: {
                    formatter: (value, context) => {
                        if (Number(value) === 0) return '';
                        return value + '%';
                    },
                    color: "#fff",
                    font: { weight: "bold" }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function goBack() {
    window.history.back();
}

loadDashboard();
window.goBack = goBack;