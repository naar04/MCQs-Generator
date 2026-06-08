document.addEventListener("DOMContentLoaded", () => {
    // Linked directly to your live production Render Web Service instance URL
    const BACKEND_URL = "https://mcqs-generator-vkxw.onrender.com";

    // Structural Navigation Controls
    const navTriggers = document.querySelectorAll(".nav-trigger");
    const sections = document.querySelectorAll(".app-section");

    navTriggers.forEach(trigger => {
        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            navTriggers.forEach(t => t.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            trigger.classList.add("active");
            const targetId = trigger.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");

            if(targetId === 'history-sec') {
                loadHistoryData();
            }
        });
    });

    // File Extraction Elements Event Handling
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("pdfFileInput");
    const fileLabelText = document.getElementById("file-label-text");
    let extractedPdfText = "";

    if (dropZone) dropZone.addEventListener("click", () => fileInput.click());
    if (fileInput) fileInput.addEventListener("change", handleFileSelection);

    async function handleFileSelection(e) {
        const file = e.target.files[0];
        if (!file || file.type !== "application/pdf") {
            alert("System Error: Please ensure you upload a valid PDF document configuration file.");
            return;
        }
        fileLabelText.innerText = `Reading File: ${file.name}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${BACKEND_URL}/api/upload-pdf`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            extractedPdfText = data.text;
            fileLabelText.innerText = `Successfully Imported: ${file.name} (${data.text.slice(0, 20)}...)`;
        } catch (err) {
            alert("Error parsing PDF context: " + err.message);
            fileLabelText.innerText = "Error encountered. Try uploading file context directly again.";
        }
    }

    // Core Generation Mechanism
    const generateBtn = document.getElementById("generateBtn");
    const engineLoader = document.getElementById("engineLoader");
    const quizInterface = document.getElementById("quizInterface");

    let currentActiveQuizData = null;

    if (generateBtn) {
        generateBtn.addEventListener("click", async () => {
            const topic = document.getElementById("topicInput").value.trim();
            const notes = document.getElementById("pastedNotes").value.trim();
            
            if (!extractedPdfText && !notes && !topic) {
                alert("Requirement Error: Provide structural input via either PDF upload, notes data or general target topic text.");
                return;
            }

            const payload = {
                sourceText: extractedPdfText || notes || "",
                topic: topic,
                className: document.getElementById("paramClass").value,
                subject: document.getElementById("paramSubject").value,
                board: document.getElementById("paramBoard").value,
                difficulty: document.getElementById("paramDifficulty").value,
                count: document.getElementById("paramCount").value
            };

            quizInterface.style.display = "none";
            document.getElementById("quizResultsBlock").style.display = "none";
            engineLoader.style.display = "block";

            try {
                const res = await fetch(`${BACKEND_URL}/api/generate-mcqs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const mcqPayload = await res.json();
                
                if (mcqPayload.error) throw new Error(mcqPayload.error);

                currentActiveQuizData = mcqPayload;
                renderActiveQuizModule(mcqPayload);
                
                await saveQuizToPersistenceHistory(mcqPayload, payload);

            } catch (error) {
                alert("Failed System Assessment Compilation: " + error.message);
            } finally {
                engineLoader.style.display = "none";
            }
        });
    }

    // Render Quiz Output Structure
    function renderActiveQuizModule(data) {
        quizInterface.style.display = "block";
        const headerBlock = document.getElementById("quizHeaderBlock");
        const container = document.getElementById("quizQuestionsContainer");

        headerBlock.innerHTML = `<h2>Assessment: ${data.title || "Generated Objective Profile"}</h2><p style="color: var(--text-secondary);">Answer all interactive question variables below explicitly.</p>`;
        container.innerHTML = "";

        data.questions.forEach((q, qIndex) => {
            const qCard = document.createElement("div");
            qCard.className = "quiz-question-card";
            qCard.innerHTML = `
                <p><strong>Q${qIndex + 1}:</strong> ${escapeHtml(q.question)}</p>
                <div class="options-list">
                    ${q.options.map((opt, oIdx) => {
                        const letter = String.fromCharCode(65 + oIdx);
                        return `
                            <label class="option-item" data-qindex="${qIndex}" data-letter="${letter}">
                                <input type="radio" name="question_${qIndex}" value="${letter}" required>
                                <span><strong>${letter}:</strong> ${escapeHtml(opt)}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            `;
            container.appendChild(qCard);
        });
    }

    const quizForm = document.getElementById("quizForm");
    if (quizForm) {
        quizForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!currentActiveQuizData) return;

            let score = 0;
            const questions = currentActiveQuizData.questions;
            const total = questions.length;

            questions.forEach((q, qIndex) => {
                const selectedInput = document.querySelector(`input[name="question_${qIndex}"]:checked`);
                const selectedLetter = selectedInput ? selectedInput.value : null;
                const correctLetter = q.answer.trim().toUpperCase();

                const optionWrappers = document.querySelectorAll(`label[data-qindex="${qIndex}"]`);
                optionWrappers.forEach(lbl => {
                    const currentLetter = lbl.getAttribute("data-letter");
                    if (currentLetter === correctLetter) {
                        lbl.classList.add("correct-reveal");
                    }
                    if (selectedLetter === currentLetter && selectedLetter !== correctLetter) {
                        lbl.classList.add("wrong-reveal");
                    }
                });

                if (selectedLetter === correctLetter) {
                    score++;
                }
            });

            const wrongAnswers = total - score;
            const ratioPercentage = Math.round((score / total) * 100);

            const resultsBlock = document.getElementById("quizResultsBlock");
            resultsBlock.style.display = "block";
            resultsBlock.innerHTML = `
                <div class="results-hero">
                    <h2>Score: ${ratioPercentage}%</h2>
                    <p>Performance Matrix Review</p>
                </div>
                <div class="grid-2" style="margin-bottom: 1.5rem; text-align: center;">
                    <div class="card" style="padding: 1rem;"><h3>${score}</h3><p style="color:var(--text-secondary)">Correct</p></div>
                    <div class="card" style="padding: 1rem;"><h3>${wrongAnswers}</h3><p style="color:var(--text-secondary)">Incorrect</p></div>
                </div>
                <button class="btn" type="button" id="retryQuizBtn" style="background: transparent; border: 1px solid var(--border-color)">Reset Configuration & Retry Assessment</button>
            `;

            document.getElementById("retryQuizBtn").addEventListener("click", () => {
                document.getElementById("quizForm").reset();
                const optionWrappers = document.querySelectorAll(`.option-item`);
                optionWrappers.forEach(lbl => {
                    lbl.classList.remove("correct-reveal", "wrong-reveal");
                });
                resultsBlock.style.display = "none";
                resultsBlock.scrollIntoView({ behavior: "smooth" });
            });

            resultsBlock.scrollIntoView({ behavior: "smooth" });
        });
    }

    async function saveQuizToPersistenceHistory(quizData, metaDataPayload) {
        const historyRecordItem = {
            id: "eval_" + Date.now(),
            title: quizData.title || metaDataPayload.topic || "Topic Assessment Set",
            dateString: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            questionCount: quizData.questions.length,
            payloadStructurePayload: quizData
        };

        try {
            await fetch(`${BACKEND_URL}/api/save-history`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(historyRecordItem)
            });
        } catch (err) {
            console.error("Local tracking storage logging error:", err);
        }
    }

    async function loadHistoryData() {
        const container = document.getElementById("historyLogsContainer");
        if (!container) return;
        container.innerHTML = "<p>Reading record directories data files...</p>";

        try {
            const res = await fetch(`${BACKEND_URL}/api/history`);
            const structuralHistoryList = await res.json();

            if(structuralHistoryList.length === 0) {
                container.innerHTML = "<p style='color: var(--text-secondary);'>No evaluation historical entities discovered inside storage logs.</p>";
                return;
            }

            container.innerHTML = "";
            structuralHistoryList.forEach(item => {
                const elementRow = document.createElement("div");
                elementRow.className = "history-item";
                elementRow.innerHTML = `
                    <div>
                        <strong>${escapeHtml(item.title)}</strong>
                        <div style="font-size:0.85rem; color: var(--text-secondary); margin-top:0.25rem;">
                            Date: ${item.dateString} | Questions count: ${item.questionCount}
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="btn-sm btn-primary launch-hist-btn" data-id="${item.id}">Launch Quiz</button>
                        <button class="btn-sm export-hist-btn" data-id="${item.id}">Export Plaintext</button>
                    </div>
                `;
                container.appendChild(elementRow);

                elementRow.querySelector(".launch-hist-btn").addEventListener("click", () => {
                    currentActiveQuizData = item.payloadStructurePayload;
                    document.querySelector("[data-target=generate-sec]").click();
                    renderActiveQuizModule(item.payloadStructurePayload);
                });

                elementRow.querySelector(".export-hist-btn").addEventListener("click", () => {
                    exportDataToPlaintextSchema(item.payloadStructurePayload);
                });
            });

        } catch (error) {
            container.innerHTML = "<p>Error reading system metadata history logs.</p>";
        }
    }

    function exportDataToPlaintextSchema(quizData) {
        let textualDataOutputString = `ASSESSMENT: ${quizData.title}\n========================================\n\n`;
        quizData.questions.forEach((q, idx) => {
            textualDataOutputString += `Q${idx+1}: ${q.question}\n`;
            q.options.forEach((opt, oIdx) => {
                textualDataOutputString += `   ${String.fromCharCode(65 + oIdx)}) ${opt}\n`;
            });
            textualDataOutputString += `Correct Target Answer Key: (${q.answer})\n\n`;
        });

        const dataBlob = new Blob([textualDataOutputString], { type: "text/plain" });
        const temporaryLinkNode = document.createElement("a");
        temporaryLinkNode.href = URL.createObjectURL(dataBlob);
        temporaryLinkNode.download = `${quizData.title.toLowerCase().replace(/\s+/g, '_')}_questions.txt`;
        temporaryLinkNode.click();
    }

    function escapeHtml(text) {
        return text ? text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
    }
});
