/* =========================================
   FIGURE IT OUT
   MAIN JAVASCRIPT
========================================= */


/* =========================================
   GET HTML ELEMENTS
========================================= */

const homeScreen = document.getElementById("homeScreen");
const setupScreen = document.getElementById("setupScreen");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const launchBtn = document.getElementById("launchBtn");
const restartBtn = document.getElementById("restartBtn");

const levelSection = document.getElementById("levelSection");
const categorySection = document.getElementById("categorySection");
const courseSection = document.getElementById("courseSection");
const difficultySection = document.getElementById("difficultySection");

/* Question-count section.
   This is optional so the JS will still work
   even if you have not added it to HTML yet.
*/
const challengeLengthSection =
    document.getElementById("challengeLengthSection");
const independentTeamSection =
    document.getElementById("independentTeamSection");
const independentTeamMembers =
    document.getElementById("independentTeamMembers");
const addIndependentTeamMemberBtn =
    document.getElementById("addIndependentTeamMemberBtn");

const levelGrid = document.getElementById("levelGrid");
const categoryGrid = document.getElementById("categoryGrid");
const courseGrid = document.getElementById("courseGrid");

const courseSearch = document.getElementById("courseSearch");

const questionNumber = document.getElementById("questionNumber");
const questionText = document.getElementById("questionText");
const questionCategory = document.getElementById("questionCategory");
const answers = document.getElementById("answers");

const timerDisplay = document.getElementById("timer");
const progress = document.getElementById("progress");

const finalScore = document.getElementById("finalScore");
const correctAnswers = document.getElementById("correctAnswers");
const wrongAnswers = document.getElementById("wrongAnswers");
const resultMessage = document.getElementById("resultMessage");


/* =========================================
   ICONS
========================================= */

const iconSvgs = {

    arrow:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M5 12h13M13 6l6 6-6 6" />' +
        '</svg>',

    book:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />' +
        '<path d="M4 5.5v16M8 7h8M8 11h8" />' +
        '</svg>',

    tools:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="m14.5 6.5 3-3 3 3-3 3M16 8l-8.5 8.5a2.12 2.12 0 1 1-3-3L13 5" />' +
        '<path d="m14 14 6 6M17 14l-3 3" />' +
        '</svg>',

    compass:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" />' +
        '<path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />' +
        '</svg>',

    play:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="m9 6 9 6-9 6V6Z" />' +
        '</svg>',

    clock:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" />' +
        '<path d="M12 7v5l3 2" />' +
        '</svg>',

    trophy:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />' +
        '<path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" />' +
        '</svg>',

    refresh:
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M20 11a8 8 0 0 0-14.7-4L3 10M3 5v5h5M4 13a8 8 0 0 0 14.7 4L21 14m0 5v-5h-5" />' +
        '</svg>'
};


document.querySelectorAll("[class*='icon-']").forEach(function(element) {

    const iconName = Array.from(element.classList)
        .find(function(className) {
            return className.startsWith("icon-");
        })
        ?.replace("icon-", "");

    if (iconSvgs[iconName]) {
        element.innerHTML = iconSvgs[iconName];
    }

});


/* =========================================
   GAME VARIABLES
========================================= */

let selectedPath = "";
let selectedLevel = "";
let selectedCategory = "";
let selectedCourse = "";
let selectedDifficulty = "";

let currentQuestion = 0;
let score = 0;

let timer;
let timeLeft = 30;

let currentQuestions = [];

/* Number of questions in one challenge */
let challengeLength = 30;

function hydrateChallengeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const course = params.get('course') || sessionStorage.getItem('fioSelectedCourse');
    const difficulty = params.get('difficulty') || sessionStorage.getItem('fioSelectedDifficulty');
    const length = Number(params.get('length') || sessionStorage.getItem('fioQuestionLimit') || challengeLength);

    if (course) {
        selectedCourse = course;
    }

    if (difficulty) {
        selectedDifficulty = difficulty;
        const difficultyButton = document.querySelector(`.difficulty-btn[data-difficulty="${difficulty}"]`);
        if (difficultyButton) {
            document.querySelectorAll('.difficulty-btn').forEach((btn) => btn.classList.remove('selected'));
            difficultyButton.classList.add('selected');
        }
    }

    if (Number.isFinite(length) && length > 0) {
        challengeLength = length;
    }

    if (selectedCourse && selectedDifficulty && launchBtn) {
        launchBtn.classList.remove('hidden');
        launchBtn.disabled = false;
        launchBtn.textContent = 'START CHALLENGE 🚀';
    }
}

window.addEventListener('load', function() {
    hydrateChallengeFromUrl();

    if (selectedCourse && selectedDifficulty && setupScreen) {
        showScreen(setupScreen);
        setTimeout(function() {
            if (selectedCourse && selectedDifficulty) {
                startQuiz();
            }
        }, 200);
    }
});

function createIndependentTeamMemberRow() {
    const row = document.createElement("div");
    row.className = "team-member-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Student name";
    nameInput.maxLength = 80;
    nameInput.setAttribute("aria-label", "Student name");

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "student@email.com";
    emailInput.maxLength = 254;
    emailInput.setAttribute("aria-label", "Student email");

    row.append(nameInput, emailInput);
    return row;
}

function getIndependentTeamMembers() {
    if (!independentTeamMembers) return [];
    const rows = [...independentTeamMembers.querySelectorAll(".team-member-row")];
    return rows
        .map(function(row) {
            const nameField = row.querySelector("input[type='text']");
            const emailField = row.querySelector("input[type='email']");
            const name = (nameField?.value || "").trim();
            const email = (emailField?.value || "").trim();
            if (!name && !email) return null;
            return { name, email };
        })
        .filter(Boolean)
        .slice(0, 5);
}

function toggleIndependentTeamSection() {
    const isIndependentUser = document.documentElement.dataset.accountRole === "independent";
    if (!independentTeamSection) return;
    const shouldShow = isIndependentUser && Boolean(selectedDifficulty);
    independentTeamSection.classList.toggle("hidden", !shouldShow);
    if (shouldShow && independentTeamMembers && independentTeamMembers.children.length === 0) {
        independentTeamMembers.appendChild(createIndependentTeamMemberRow());
    }
}

function addIndependentTeamMemberRow() {
    if (!independentTeamMembers) return;
    if (independentTeamMembers.children.length >= 5) return;
    independentTeamMembers.appendChild(createIndependentTeamMemberRow());
}

if (addIndependentTeamMemberBtn) {
    addIndependentTeamMemberBtn.addEventListener("click", function() {
        addIndependentTeamMemberRow();
    });
}

toggleIndependentTeamSection();

/* =========================================
   LEARNING DATA
========================================= */

const learningData = {

    academic: {

        levels: {

            "CBC / Primary": {

                Mathematics: [
                    "Mathematics",
                    "English",
                    "Kiswahili",
                    "Science",
                    "Social Studies",
                    "Agriculture",
                    "Creative Arts",
                    "Computer Studies"
                ],

                Languages: [
                    "English",
                    "Kiswahili"
                ],

                Science: [
                    "Science",
                    "Agriculture",
                    "Computer Studies"
                ],

                Humanities: [
                    "Social Studies",
                    "Creative Arts"
                ]

            },


            "High School": {

                Sciences: [
                    "Mathematics",
                    "Biology",
                    "Chemistry",
                    "Physics"
                ],

                Languages: [
                    "English",
                    "Kiswahili",
                    "Literature"
                ],

                Humanities: [
                    "Geography",
                    "History",
                    "CRE",
                    "IRE"
                ],

                Business: [
                    "Business Studies",
                    "Accounting",
                    "Economics"
                ],

                Technology: [
                    "Computer Science",
                    "ICT"
                ],

                Agriculture: [
                    "Agriculture"
                ],

                "General Practice": [
                    "General Practice"
                ]

            },


            "College / University": {

                Computing: [
                    "Computer Science",
                    "Information Technology",
                    "Software Development",
                    "Web Development",
                    "Artificial Intelligence",
                    "HTML",
                    "Cyber Security",
                    "Networking",
                    "Database Systems"
                ],

                Business: [
                    "Business Administration",
                    "Accounting",
                    "Finance",
                    "Marketing",
                    "Human Resource Management",
                    "Supply Chain Management",
                    "Entrepreneurship"
                ],

                Engineering: [
                    "Mechanical Engineering",
                    "Electrical Engineering",
                    "Civil Engineering",
                    "Chemical Engineering"
                ],

                Science: [
                    "Biology",
                    "Chemistry",
                    "Physics",
                    "Mathematics"
                ],

                Health: [
                    "Nursing",
                    "Community Health",
                    "Medical Laboratory Science"
                ],

                Education: [
                    "Education",
                    "Early Childhood Education"
                ]

            }

        }

    },


    technical: {

        levels: {

            "Craft / Level 4": {

                ICT: [
                    "Information Technology",
                    "Computer Science",
                    "Software Development",
                    "Network System Administration"
                ],

                Beauty: [
                    "Hairdressing",
                    "Beauty Therapy",
                    "Cosmetology"
                ],

                Fashion: [
                    "Fashion Design and Garment Making",
                    "Tailoring",
                    "Dressmaking"
                ],

                Hospitality: [
                    "Catering and Accommodation Operations",
                    "Food and Beverage",
                    "Baking and Pastry"
                ],

                Automotive: [
                    "Motor Vehicle Mechanics",
                    "Motor Vehicle Technology",
                    "Automotive Technology"
                ],

                Electrical: [
                    "Electrical Installation",
                    "Electrical and Electronics Technology",
                    "Solar PV Installation"
                ],

                Construction: [
                    "Building Technology",
                    "Plumbing",
                    "Carpentry and Joinery",
                    "Welding and Fabrication"
                ],

                Agriculture: [
                    "General Agriculture",
                    "Animal Production"
                ],

                Creative: [
                    "Graphic Design",
                    "Photography",
                    "Videography"
                ],

                Transport: [
                    "Driving"
                ]

            },


            "Diploma / Level 5-6": {

                ICT: [
                    "Information Technology",
                    "Software Development",
                    "Computer Science",
                    "Web Development",
                    "Artificial Intelligence",
                    "HTML",
                    "Network System Administration",
                    "Cyber Security"
                ],

                Business: [
                    "Business Administration",
                    "Accounting and Management Skills",
                    "Human Resource Management",
                    "Marketing",
                    "Supply Chain Management",
                    "Entrepreneurship",
                    "Banking and Finance"
                ],

                Hospitality: [
                    "Catering and Accommodation Management",
                    "Baking Technology",
                    "Food and Beverage"
                ],

                Automotive: [
                    "Automotive Engineering",
                    "Motor Vehicle Technology"
                ],

                Engineering: [
                    "Mechanical Engineering",
                    "Electrical and Electronics Engineering",
                    "Chemical Engineering"
                ],

                Agriculture: [
                    "Agriculture",
                    "Agribusiness",
                    "Animal Production"
                ],

                Health: [
                    "Community Health",
                    "Health Care Assistant"
                ],

                Tourism: [
                    "Tourism",
                    "Travel and Tourism",
                    "Tour Guide"
                ]

            }

        }

    }

};


/* =========================================
   FALLBACK QUESTION BANK
========================================= */

const questionBank = {

    "Mathematics": [
        {
            question: "What is 5 × 6?",
            options: ["20", "25", "30", "35"],
            answer: "30",
            difficulty: "Easy"
        },
        {
            question: "What is 100 ÷ 10?",
            options: ["5", "10", "20", "50"],
            answer: "10",
            difficulty: "Easy"
        },
        {
            question: "What is 12 + 8?",
            options: ["18", "20", "22", "24"],
            answer: "20",
            difficulty: "Easy"
        }
    ],


    "Biology": [
        {
            question: "Which organ pumps blood around the body?",
            options: ["Liver", "Heart", "Lung", "Kidney"],
            answer: "Heart",
            difficulty: "Easy"
        },
        {
            question: "What is the basic unit of life?",
            options: ["Tissue", "Organ", "Cell", "Bone"],
            answer: "Cell",
            difficulty: "Easy"
        }
    ],


    "Chemistry": [
        {
            question: "What is the chemical symbol for oxygen?",
            options: ["O", "Ox", "C", "H"],
            answer: "O",
            difficulty: "Easy"
        },
        {
            question: "What is H₂O commonly called?",
            options: ["Salt", "Water", "Oxygen", "Hydrogen"],
            answer: "Water",
            difficulty: "Easy"
        }
    ],


    "Physics": [
        {
            question: "What force pulls objects toward Earth?",
            options: ["Friction", "Gravity", "Magnetism", "Pressure"],
            answer: "Gravity",
            difficulty: "Easy"
        },
        {
            question: "What is the SI unit of force?",
            options: ["Watt", "Volt", "Newton", "Joule"],
            answer: "Newton",
            difficulty: "Easy"
        }
    ],


    "English": [
        {
            question: "Which word is a noun?",
            options: ["Run", "Beautiful", "Teacher", "Quickly"],
            answer: "Teacher",
            difficulty: "Easy"
        },
        {
            question: "What is the opposite of 'hot'?",
            options: ["Warm", "Cold", "Bright", "Dry"],
            answer: "Cold",
            difficulty: "Easy"
        }
    ],


    "Kiswahili": [
        {
            question: "Neno 'kitabu' lina maana gani kwa Kiingereza?",
            options: ["Book", "Pen", "School", "Table"],
            answer: "Book",
            difficulty: "Easy"
        },
        {
            question: "Wingi wa neno 'mtoto' ni upi?",
            options: ["Watoto", "Vitoto", "Mtototo", "Mito"],
            answer: "Watoto",
            difficulty: "Easy"
        }
    ],


    "Geography": [
        {
            question: "Which is the largest continent?",
            options: ["Africa", "Asia", "Europe", "Australia"],
            answer: "Asia",
            difficulty: "Easy"
        },
        {
            question: "Which planet is known as the Red Planet?",
            options: ["Earth", "Mars", "Venus", "Jupiter"],
            answer: "Mars",
            difficulty: "Easy"
        }
    ],


    "History": [
        {
            question: "Which country is known as the birthplace of the ancient Olympic Games?",
            options: ["Italy", "Greece", "Egypt", "France"],
            answer: "Greece",
            difficulty: "Easy"
        }
    ],


    "Computer Science": [
        {
            question: "What does CPU stand for?",
            options: [
                "Central Processing Unit",
                "Computer Personal Unit",
                "Central Program Utility",
                "Computer Processing Utility"
            ],
            answer: "Central Processing Unit",
            difficulty: "Easy"
        },
        {
            question: "Which language is used to make webpages interactive?",
            options: [
                "HTML",
                "CSS",
                "JavaScript",
                "SQL"
            ],
            answer: "JavaScript",
            difficulty: "Easy"
        }
    ],


    "Information Technology": [
        {
            question: "What does IT stand for?",
            options: [
                "Internet Technology",
                "Information Technology",
                "Information Transfer",
                "Internet Transfer"
            ],
            answer: "Information Technology",
            difficulty: "Easy"
        },
        {
            question: "Which device is commonly used to connect computers to a network?",
            options: [
                "Router",
                "Monitor",
                "Keyboard",
                "Printer"
            ],
            answer: "Router",
            difficulty: "Easy"
        }
    ],


    "Software Development": [
        {
            question: "Which language is commonly used for web interactivity?",
            options: [
                "JavaScript",
                "HTML",
                "CSS",
                "XML"
            ],
            answer: "JavaScript",
            difficulty: "Easy"
        }
    ],


    "Networking": [
        {
            question: "What device forwards data between different networks?",
            options: [
                "Router",
                "Mouse",
                "Monitor",
                "Keyboard"
            ],
            answer: "Router",
            difficulty: "Easy"
        }
    ],


    "Hairdressing": [
        {
            question: "What is commonly used to cut hair?",
            options: [
                "Scissors",
                "Hammer",
                "Spanner",
                "Ruler"
            ],
            answer: "Scissors",
            difficulty: "Easy"
        }
    ],


    "Beauty Therapy": [
        {
            question: "Which practice focuses on improving skin appearance and health?",
            options: [
                "Skincare",
                "Carpentry",
                "Welding",
                "Plumbing"
            ],
            answer: "Skincare",
            difficulty: "Easy"
        }
    ],


    "Cosmetology": [
        {
            question: "Cosmetology mainly focuses on which area?",
            options: [
                "Beauty and personal care",
                "Construction",
                "Automotive repair",
                "Electrical wiring"
            ],
            answer: "Beauty and personal care",
            difficulty: "Easy"
        }
    ],


    "Food and Beverage": [
        {
            question: "Which item is commonly used for measuring ingredients?",
            options: [
                "Measuring cup",
                "Hammer",
                "Spanner",
                "Screwdriver"
            ],
            answer: "Measuring cup",
            difficulty: "Easy"
        }
    ],


    "Catering and Accommodation Operations": [
        {
            question: "Which department commonly prepares food in a hotel?",
            options: [
                "Kitchen",
                "Security",
                "Reception",
                "Laundry"
            ],
            answer: "Kitchen",
            difficulty: "Easy"
        }
    ],


    "Motor Vehicle Mechanics": [
        {
            question: "Which component stores electrical energy in a vehicle?",
            options: [
                "Battery",
                "Tyre",
                "Radiator",
                "Brake pad"
            ],
            answer: "Battery",
            difficulty: "Easy"
        }
    ],


    "Driving": [
        {
            question: "What should a driver do before changing lanes?",
            options: [
                "Check mirrors and surroundings",
                "Close their eyes",
                "Accelerate without checking",
                "Ignore other vehicles"
            ],
            answer: "Check mirrors and surroundings",
            difficulty: "Easy"
        }
    ],


    "Electrical Installation": [
        {
            question: "Which unit is used to measure electric current?",
            options: [
                "Ampere",
                "Meter",
                "Kilogram",
                "Newton"
            ],
            answer: "Ampere",
            difficulty: "Easy"
        }
    ],


    "Plumbing": [
        {
            question: "What is commonly used to carry water in a plumbing system?",
            options: [
                "Pipe",
                "Cable",
                "Tyre",
                "Glass"
            ],
            answer: "Pipe",
            difficulty: "Easy"
        }
    ],


    "Welding and Fabrication": [
        {
            question: "What process joins metal parts using heat?",
            options: [
                "Welding",
                "Painting",
                "Typing",
                "Printing"
            ],
            answer: "Welding",
            difficulty: "Easy"
        }
    ],


    "Graphic Design": [
        {
            question: "Which is commonly used in graphic design?",
            options: [
                "Typography",
                "Engine oil",
                "Plumbing pipe",
                "Brake fluid"
            ],
            answer: "Typography",
            difficulty: "Easy"
        }
    ],


    "Agriculture": [
        {
            question: "Which activity involves growing crops?",
            options: [
                "Crop farming",
                "Welding",
                "Programming",
                "Driving"
            ],
            answer: "Crop farming",
            difficulty: "Easy"
        }
    ]

};


/* =========================================
   SCREEN FUNCTION
========================================= */

function showScreen(screen) {

    document.querySelectorAll(".screen").forEach(function(item) {
        item.classList.remove("active");
    });

    if (screen) {
        screen.classList.add("active");
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================
   START BUTTON
========================================= */

startBtn.addEventListener("click", function() {

    showScreen(setupScreen);

});


/* =========================================
   CHOOSE PATH
========================================= */

document.querySelectorAll(".path-card").forEach(function(button) {

    button.addEventListener("click", function() {

        selectedPath = button.dataset.path;

        document.querySelectorAll(".path-card").forEach(function(card) {
            card.classList.remove("selected");
        });

        button.classList.add("selected");

        loadLevels();

        levelSection.classList.remove("hidden");

        categorySection.classList.add("hidden");
        courseSection.classList.add("hidden");
        difficultySection.classList.add("hidden");

        if (challengeLengthSection) {
            challengeLengthSection.classList.add("hidden");
        }

        launchBtn.classList.add("hidden");

        levelSection.scrollIntoView({
            behavior: "smooth"
        });

    });

});


/* =========================================
   LOAD LEVELS
========================================= */

function loadLevels() {

    levelGrid.innerHTML = "";

    const levels = learningData[selectedPath].levels;

    Object.keys(levels).forEach(function(level) {

        const button = document.createElement("button");

        button.className = "option-btn";
        button.type = "button";
        button.textContent = level;

        button.addEventListener("click", function() {

            selectedLevel = level;

            document.querySelectorAll("#levelGrid .option-btn")
                .forEach(function(btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");

            loadCategories();

            categorySection.classList.remove("hidden");

            courseSection.classList.add("hidden");
            difficultySection.classList.add("hidden");

            if (challengeLengthSection) {
                challengeLengthSection.classList.add("hidden");
            }

            launchBtn.classList.add("hidden");

            categorySection.scrollIntoView({
                behavior: "smooth"
            });

        });

        levelGrid.appendChild(button);

    });

}


/* =========================================
   LOAD CATEGORIES
========================================= */

function loadCategories() {

    categoryGrid.innerHTML = "";

    const categories =
        learningData[selectedPath]
            .levels[selectedLevel];

    Object.keys(categories).forEach(function(category) {

        const button = document.createElement("button");

        button.className = "option-btn";
        button.type = "button";
        button.textContent = category;

        button.addEventListener("click", function() {

            selectedCategory = category;

            document.querySelectorAll("#categoryGrid .option-btn")
                .forEach(function(btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");

            if (category === "Question Bank") {
                renderQuestionBankCourses();
            } else {
                loadCourses();
            }

            courseSection.classList.remove("hidden");

            difficultySection.classList.add("hidden");

            if (challengeLengthSection) {
                challengeLengthSection.classList.add("hidden");
            }

            launchBtn.classList.add("hidden");

            courseSection.scrollIntoView({
                behavior: "smooth"
            });

        });

        categoryGrid.appendChild(button);

    });

    const questionBankButton = document.createElement("button");
    questionBankButton.className = "option-btn";
    questionBankButton.type = "button";
    questionBankButton.textContent = "Question Bank";
    questionBankButton.addEventListener("click", function() {
        selectedCategory = "Question Bank";

        document.querySelectorAll("#categoryGrid .option-btn")
            .forEach(function(btn) {
                btn.classList.remove("selected");
            });

        questionBankButton.classList.add("selected");
        renderQuestionBankCourses();

        courseSection.classList.remove("hidden");
        difficultySection.classList.add("hidden");

        if (challengeLengthSection) {
            challengeLengthSection.classList.add("hidden");
        }

        launchBtn.classList.add("hidden");
        courseSection.scrollIntoView({
            behavior: "smooth"
        });
    });

    categoryGrid.appendChild(questionBankButton);

}

function getQuestionBankSubjectFallback() {
    const subjects = new Set();

    Object.keys(learningData || {}).forEach(function(pathKey) {
        const levels = learningData[pathKey]?.levels || {};

        Object.keys(levels).forEach(function(levelKey) {
            const categories = levels[levelKey] || {};

            Object.keys(categories).forEach(function(categoryKey) {
                const courses = categories[categoryKey] || [];

                if (!Array.isArray(courses)) {
                    return;
                }

                courses.forEach(function(course) {
                    const name = String(course || "").trim();
                    if (name) {
                        subjects.add(name);
                    }
                });
            });
        });
    });

    return Array.from(subjects).sort(function(a, b) {
        return a.localeCompare(b);
    });
}

async function loadQuestionBankSubjects() {
    return getQuestionBankSubjectFallback();
}

async function renderQuestionBankCourses(searchTerm) {
    const allCourses = await loadQuestionBankSubjects();
    const search = String(searchTerm || "").trim().toLowerCase();

    courseGrid.innerHTML = "";

    allCourses
        .filter(function(course) {
            return course.toLowerCase().includes(search);
        })
        .forEach(function(course) {
            const button = document.createElement("button");
            button.className = "course-card";
            button.type = "button";
            button.textContent = course;

            if (course === selectedCourse) {
                button.classList.add("selected");
            }

            button.addEventListener("click", function() {
                selectedCourse = course;

                document.querySelectorAll(".course-card")
                    .forEach(function(card) {
                        card.classList.remove("selected");
                    });
                button.classList.add("selected");

                difficultySection.classList.remove("hidden");

                if (challengeLengthSection) {
                    challengeLengthSection.classList.add("hidden");
                }

                launchBtn.classList.add("hidden");
                difficultySection.scrollIntoView({
                    behavior: "smooth"
                });
            });

            courseGrid.appendChild(button);
        });

    if (!courseGrid.children.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No question bank subjects are available yet.";
        courseGrid.appendChild(empty);
    }
}

/* =========================================
   LOAD COURSES
========================================= */

function loadCourses(searchTerm) {
    courseGrid.innerHTML = "";

    const courses =
        learningData[selectedPath]
            .levels[selectedLevel][selectedCategory] || [];
    const search = String(searchTerm || "").trim().toLowerCase();

    courses
        .filter(function(course) {
            return course.toLowerCase().includes(search);
        })
        .forEach(function(course) {
            const button = document.createElement("button");
            button.className = "course-card";
            button.type = "button";
            button.textContent = course;

            if (course === selectedCourse) {
                button.classList.add("selected");
            }

            button.addEventListener("click", function() {
                selectedCourse = course;

                document.querySelectorAll(".course-card")
                    .forEach(function(card) {
                        card.classList.remove("selected");
                    });
                button.classList.add("selected");

                difficultySection.classList.remove("hidden");

                if (challengeLengthSection) {
                    challengeLengthSection.classList.add("hidden");
                }

                launchBtn.classList.add("hidden");
                difficultySection.scrollIntoView({
                    behavior: "smooth"
                });
            });

            courseGrid.appendChild(button);
        });
}


/* =========================================
   LOAD AND VALIDATE QUESTIONS
========================================= */

async function loadQuestions(course, difficulty = selectedDifficulty) {
    const safeCourse = String(course || "").trim();
    if (!safeCourse) {
        return [];
    }

    try {
        const apiBase = String(window.FIO_API_BASE || "/api").replace(/\/+$/, "");
        const url = new URL(`${apiBase}/questions`, window.location.origin);
        url.searchParams.set("course", safeCourse);
        url.searchParams.set("difficulty", difficulty || "all");
        url.searchParams.set("limit", "750");

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data = await response.json();
        const questions = Array.isArray(data.questions) ? data.questions : [];
        const preparedQuestions = questions.map(function(question) {
            return {
                ...question,
                id: question.id || createQuestionID(safeCourse, question)
            };
        });

        const validatedQuestions = fioValidateQuestionBank(
            safeCourse,
            preparedQuestions
        );

        if (validatedQuestions.length) {
            return validatedQuestions;
        }

        throw new Error("No valid question data was returned.");

    } catch (error) {
        console.warn(
            `Falling back to a generated question bank for ${safeCourse}:`,
            error
        );

        const fallbackDifficulty = selectedDifficulty || "easy";
        const generatedQuestions = buildGeneratedQuestionSet(
            safeCourse,
            fallbackDifficulty,
            0
        );

        return fioValidateQuestionBank(safeCourse, generatedQuestions);
    }
}


/* =========================================
   COURSE SEARCH
========================================= */

if (courseSearch) {

    courseSearch.addEventListener("input", function() {

        if (selectedCategory === "Question Bank") {
            renderQuestionBankCourses(courseSearch.value);
            return;
        }

        loadCourses(courseSearch.value);

    });

}


/* =========================================
   DIFFICULTY
========================================= */

document.querySelectorAll(".difficulty-btn")
    .forEach(function(button) {

        button.addEventListener("click", function() {

            selectedDifficulty = button.dataset.difficulty;

            document.querySelectorAll(".difficulty-btn")
                .forEach(function(btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");
            toggleIndependentTeamSection();

            /*
               After choosing difficulty,
               show the question-count section.
            */

            if (challengeLengthSection) {

                challengeLengthSection.classList.remove("hidden");

                launchBtn.classList.add("hidden");

                challengeLengthSection.scrollIntoView({
                    behavior: "smooth"
                });

            } else {

                /*
                   If question-count section doesn't exist
                   yet, allow the quiz to launch normally.
                */

                launchBtn.classList.remove("hidden");

                launchBtn.scrollIntoView({
                    behavior: "smooth"
                });

            }

        });

    });


/* =========================================
   QUESTION COUNT BUTTONS
========================================= */

document.querySelectorAll(".challenge-length-btn")
    .forEach(function(button) {

        if (
            Number(button.dataset.length) === challengeLength
        ) {
            button.classList.add("selected");
        }

        button.addEventListener("click", function() {

            challengeLength =
                Number(button.dataset.length);

            document
                .querySelectorAll(".challenge-length-btn")
                .forEach(function(btn) {
                    btn.classList.remove("selected");
                });

            button.classList.add("selected");

            launchBtn.classList.remove("hidden");

            launchBtn.scrollIntoView({
                behavior: "smooth"
            });

        });

    });


/* =========================================
   CREATE QUESTION ID
========================================= */

function createQuestionID(course, question) {

    const text =
        String(question.question || "")
            .toLowerCase()
            .trim();

    return `${course}::${text}`;

}


/* =========================================
   STORAGE KEY
========================================= */

function getStorageKey(course, difficulty) {

    return `figureItOut_used_${course}_${difficulty}`;

}


/* =========================================
   GET USED QUESTION IDS
========================================= */

function getUsedQuestionIDs(course, difficulty) {

    const storageKey =
        getStorageKey(course, difficulty);

    try {

        const saved =
            localStorage.getItem(storageKey);

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.warn(
            "Could not read used questions:",
            error
        );

        return [];

    }

}


/* =========================================
   SAVE USED QUESTION IDS
========================================= */

function saveUsedQuestionIDs(
    course,
    difficulty,
    questionIDs
) {

    const storageKey =
        getStorageKey(course, difficulty);

    localStorage.setItem(
        storageKey,
        JSON.stringify(questionIDs)
    );

}


/* =========================================
   GET UNUSED QUESTIONS
========================================= */

function getUnusedQuestions(
    course,
    difficulty,
    questions
) {

    let usedIDs =
        getUsedQuestionIDs(
            course,
            difficulty
        );


    const preparedQuestions =
        questions.map(function(question) {

            return {
                ...question,

                id:
                    question.id ||
                    createQuestionID(
                        course,
                        question
                    )
            };

        });


    let unusedQuestions =
        preparedQuestions.filter(function(question) {

            return !usedIDs.includes(question.id);

        });


    /*
       If every question has already been used,
       start a fresh cycle.
    */

    if (unusedQuestions.length === 0) {

        usedIDs = [];

        saveUsedQuestionIDs(
            course,
            difficulty,
            []
        );

        unusedQuestions =
            [...preparedQuestions];

    }


    return {

        questions: unusedQuestions,

        usedQuestions: usedIDs,

        storageKey:
            getStorageKey(
                course,
                difficulty
            )

    };

}


/* =========================================
   SHUFFLE QUESTIONS
========================================= */

function shuffleQuestions(array) {

    const shuffled = [...array];

    for (
        let i = shuffled.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            shuffled[i],
            shuffled[j]
        ] = [
            shuffled[j],
            shuffled[i]
        ];

    }

    return shuffled;

}


/* =========================================
   COURSE FILE RESOLVER
========================================= */

function resolveQuestionFileName(course) {

    const lookup = String(course || "").trim();

    const aliasMap = {
        "Database Systems": "Database System",
        "Database System": "Database System",
        "HTML": "Html",
        "Html": "Html",
        "Welding and Fabrication": "Welding & Fabrication",
        "Welding & Fabrication": "Welding & Fabrication",
        "Motor Vehicle Mechanics": "Motor Vehicle Mechanic",
        "Motor Vehicle Mechanic": "Motor Vehicle Mechanic",
        "Catering and Accommodation Operations": "Catering",
        "Catering": "Catering",
        "Food and Beverage": "Catering",
        "Baking and Pastry": "Baking",
        "Baking": "Baking",
        "Fashion Design and Garment Making": "Fashion Design",
        "Fashion Design": "Fashion Design",
        "Tailoring": "Fashion Design",
        "Dressmaking": "Fashion Design",
        "Computer Studies": "Computer Science",
        "Computer Science": "Computer Science",
        "Network System Administration": "Networking",
        "Networking": "Networking",
        "Business Administration": "Business Administration",
        "Finance": "Business Administration",
        "Marketing": "Business Administration",
        "Human Resource Management": "Business Administration",
        "Supply Chain Management": "Business Administration",
        "Accounting and Management Skills": "Accounting",
        "Accounting": "Accounting",
        "Mechanical Engineering": "Physics",
        "Electrical Engineering": "Physics",
        "Civil Engineering": "Physics",
        "Chemical Engineering": "Physics",
        "Nursing": "Biology",
        "Community Health": "Biology",
        "Medical Laboratory Science": "Biology",
        "Education": "English",
        "Early Childhood Education": "English",
        "Animal Production": "Agriculture",
        "General Agriculture": "Agriculture",
        "Agriculture": "Agriculture",
        "Tour Guide": "Tourism",
        "Travel and Tourism": "Tourism",
        "Tourism": "Tourism",
        "CRE": "C.R.E",
        "C.R.E": "C.R.E",
        "IRE": "I.R.E",
        "I.R.E": "I.R.E"
    };

    return aliasMap[lookup] || lookup;

}


/* =========================================
   GENERATE EXTRA QUESTION BANK
========================================= */

function normalizeDifficultyLabel(value) {

    return String(value || "")
        .trim()
        .toLowerCase();

}

function titleCaseDifficulty(value) {

    const normalized = normalizeDifficultyLabel(value);

    if (normalized === "easy") return "Easy";
    if (normalized === "medium") return "Medium";
    if (normalized === "hard") return "Hard";

    return "Easy";

}

function buildGeneratedQuestionSet(course, difficulty, existingCount) {

    const subject = String(course || "this subject").trim() || "this subject";
    const difficultyLabel = titleCaseDifficulty(difficulty);
    const contexts = [
        "daily life",
        "real-world work",
        "classroom practice",
        "community tasks",
        "future careers",
        "team projects",
        "problem solving",
        "study routines",
        "professional work",
        "decision making"
    ];
    const focuses = [
        "problem solving",
        "critical thinking",
        "practical understanding",
        "responsible action",
        "clear communication",
        "quality work",
        "analytical thinking",
        "confidence",
        "skill development",
        "career readiness"
    ];
    const stems = [
        `Why is learning ${subject} important in ${contexts[0]}?`,
        `Which skill is most valuable when a learner applies ${subject} in ${contexts[1]}?`,
        `What is the strongest reason to study ${subject} seriously?`,
        `How does ${subject} help people make better choices in ${contexts[2]}?`,
        `What does a learner gain from understanding ${subject} in ${contexts[3]}?`,
        `Which statement best explains the role of ${subject} in ${contexts[4]}?`,
        `How does ${subject} support stronger ${focuses[0]} in daily work?`,
        `What is the clearest benefit of studying ${subject} for ${contexts[5]}?`,
        `Why should learners connect ${subject} to ${contexts[6]}?`,
        `Which idea best shows the value of ${subject} in ${contexts[7]}?`
    ];

    const generated = [];
    const seen = new Set();
    const targetCount = Math.max(30, existingCount + 30, challengeLength);

    for (let index = 0; generated.length < targetCount; index++) {

        const context = contexts[index % contexts.length];
        const focus = focuses[index % focuses.length];
        const prompt = `${stems[index % stems.length]} ${index % 2 === 0 ? `It strengthens ${focus} and improves performance in ${context}.` : `This matters because it supports deeper understanding and better decisions in ${context}.`}`;
        const answerText = `It helps learners apply ${subject} in practical situations, improve understanding, and support better decisions in real life.`;
        const options = [
            answerText,
            `It makes ${subject} unnecessary once a learner remembers a few facts.`,
            `It removes the need for effort, practice, and careful thinking in ${subject}.`,
            `It prevents learners from using ${subject} in daily work or future careers.`
        ];

        const uniqueKey = String(prompt).toLowerCase().trim();
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        generated.push({
            question: `${titleCaseDifficulty(difficulty)} ${index + 1}: ${prompt}`,
            options: [...options].sort(function() { return Math.random() - 0.5; }),
            answer: answerText,
            difficulty: difficultyLabel,
            id: `${String(course || "course").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-generated-${index + 1}`
        });
    }

    return generated;

}


/* =========================================
   QUESTION QUALITY VALIDATOR
========================================= */

function fioNormalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}

function fioNormalizeDifficulty(value) {
    const difficulty = fioNormalizeText(value).toLowerCase();

    if (difficulty === "easy") return "Easy";
    if (difficulty === "medium") return "Medium";
    if (difficulty === "hard") return "Hard";

    return "";
}

function fioValidateQuestionBank(course, questions) {
    if (!Array.isArray(questions)) {
        console.error("Invalid question bank:", course);
        return [];
    }

    const validQuestions = [];
    const seenIDs = new Set();
    const seenFingerprints = new Set();

    questions.forEach(function(question, index) {
        if (!question || typeof question !== "object") {
            console.warn("Invalid question at position", index + 1);
            return;
        }

        const text = fioNormalizeText(question.question);
        const answer = fioNormalizeText(question.answer);
        const difficulty = fioNormalizeDifficulty(question.difficulty);

        const options = Array.isArray(question.options)
            ? question.options.map(fioNormalizeText)
            : [];

        if (!text || !difficulty || options.length < 2) {
            console.warn("Incomplete question:", text || index + 1);
            return;
        }

        if (options.some(function(option) {
            return !option;
        })) {
            console.warn("Empty answer option:", text);
            return;
        }

        const normalizedOptions = options.map(function(option) {
            return option.toLowerCase();
        });

        if (new Set(normalizedOptions).size !== options.length) {
            console.warn("Duplicate answer options:", text);
            return;
        }

        const correctAnswer = options.find(function(option) {
            return option.toLowerCase() === answer.toLowerCase();
        });

        if (!correctAnswer) {
            console.warn("Correct answer missing from options:", text);
            return;
        }

        const fingerprint = [
            text.toLowerCase(),
            normalizedOptions.slice().sort().join("|")
        ].join("::");

        if (seenFingerprints.has(fingerprint)) {
            console.warn("Duplicate question skipped:", text);
            return;
        }

        const id = fioNormalizeText(question.id) ||
            createQuestionID(course, { question: text });

        if (seenIDs.has(id)) {
            console.warn("Duplicate question ID skipped:", id);
            return;
        }

        seenIDs.add(id);
        seenFingerprints.add(fingerprint);

        validQuestions.push({
            ...question,
            id: id,
            course: question.course || course,
            topic: question.topic || "General",
            question: text,
            options: options,
            answer: correctAnswer,
            difficulty: difficulty,
            explanation: fioNormalizeText(question.explanation)
                || "No explanation has been added yet."
        });
    });

    console.log(
        `${course}: ${validQuestions.length} valid questions loaded.`
    );

    return validQuestions;
}

/* =========================================
   START CHALLENGE BUTTON
========================================= */

launchBtn.addEventListener("click", function() {

    startQuiz();

});


/* =========================================
   START QUIZ — IMPROVED QUESTION ENGINE
========================================= */

async function startQuiz() {
    currentQuestion = 0;
    score = 0;
    currentQuestions = [];

    clearInterval(timer);

    launchBtn.disabled = true;
    launchBtn.textContent = "LOADING QUESTIONS...";

    try {
        if (!selectedCourse || !selectedDifficulty) {
            alert("Please choose a course and difficulty first.");
            return;
        }

        const allQuestions = await loadQuestions(selectedCourse, selectedDifficulty);

        if (!allQuestions.length) {
            alert(
                `No valid questions are available for ${selectedCourse} yet.`
            );
            return;
        }

        const difficultyQuestions = allQuestions.filter(function(question) {
            return question.difficulty.toLowerCase()
                === selectedDifficulty.toLowerCase();
        });

        if (!difficultyQuestions.length) {
            alert(
                `No ${selectedDifficulty} questions are available for ${selectedCourse} yet.`
            );
            return;
        }

        // Get questions not used in the current cycle.
        const questionPool = getUnusedQuestions(
            selectedCourse,
            selectedDifficulty,
            difficultyQuestions
        );

        const shuffledQuestions = shuffleQuestions(
            questionPool.questions
        );

        // Never fill a challenge by repeating questions.
        const amount = Math.min(
            challengeLength,
            shuffledQuestions.length
        );

        currentQuestions = shuffledQuestions.slice(0, amount);

        if (!currentQuestions.length) {
            alert("No questions are available for this challenge.");
            return;
        }

        // Save IDs only after selecting the actual questions.
        const updatedUsedQuestions = [
            ...new Set([
                ...questionPool.usedQuestions,
                ...currentQuestions.map(function(question) {
                    return question.id;
                })
            ])
        ];

        saveUsedQuestionIDs(
            selectedCourse,
            selectedDifficulty,
            updatedUsedQuestions
        );

        // Tell the learner if fewer questions are available.
        if (currentQuestions.length < challengeLength) {
            alert(
                `Your challenge requested ${challengeLength} questions, ` +
                `but only ${currentQuestions.length} unused ` +
                `${selectedDifficulty} questions are available. ` +
                `This challenge will use those questions without repeating them.`
            );
        }

        showScreen(quizScreen);
        displayQuestion();

    } catch (error) {
        console.error("Quiz error:", error);

        alert(
            "Something went wrong while loading questions. " +
            "Check the browser console for details."
        );

    } finally {
        launchBtn.disabled = false;
        launchBtn.textContent = "START CHALLENGE 🚀";
    }
}


/* =========================================
   DISPLAY QUESTION
========================================= */

function displayQuestion() {

    clearInterval(timer);


    const question =
        currentQuestions[currentQuestion];


    if (!question) {
        finishQuiz();
        return;
    }


    questionNumber.textContent =
        `${currentQuestion + 1} / ${currentQuestions.length}`;


    questionCategory.textContent =
        selectedCourse;


    questionText.textContent =
        question.question;


    progress.style.width =
        `${((currentQuestion + 1) / currentQuestions.length) * 100}%`;


    answers.innerHTML = "";


    question.options.forEach(function(option) {

        const button =
            document.createElement("button");

        button.className =
            "answer-btn";

        button.type =
            "button";

        button.textContent =
            option;


        button.addEventListener(
            "click",
            function() {

                checkAnswer(
                    button,
                    option
                );

            }
        );


        answers.appendChild(button);

    });


    startTimer();

}


/* =========================================
   CHECK ANSWER
========================================= */

function checkAnswer(
    button,
    selectedAnswer
) {

    clearInterval(timer);


    const question =
        currentQuestions[currentQuestion];


    document
        .querySelectorAll(".answer-btn")
        .forEach(function(btn) {

            btn.disabled = true;


            if (
                btn.textContent ===
                question.answer
            ) {

                btn.classList.add(
                    "correct"
                );

            }

        });


    if (
        selectedAnswer ===
        question.answer
    ) {

        score++;

        button.classList.add(
            "correct"
        );

    } else {

        button.classList.add(
            "wrong"
        );

    }


    setTimeout(
        nextQuestion,
        700
    );

}


/* =========================================
   NEXT QUESTION
========================================= */

function nextQuestion() {

    currentQuestion++;


    if (
        currentQuestion >=
        currentQuestions.length
    ) {

        finishQuiz();

    } else {

        displayQuestion();

    }

}


/* =========================================
   TIMER
========================================= */

function startTimer() {

    clearInterval(timer);

    timeLeft = 30;

    timerDisplay.textContent =
        timeLeft;


    timer =
        setInterval(function() {

            timeLeft--;

            timerDisplay.textContent =
                timeLeft;


            if (timeLeft <= 0) {

                clearInterval(timer);

                nextQuestion();

            }

        }, 1000);

}


/* =========================================
   FINISH QUIZ
========================================= */

function finishQuiz() {

    clearInterval(timer);


    const totalQuestions =
        currentQuestions.length;


    if (totalQuestions === 0) {
        return;
    }


    const percentage =
        Math.round(
            (score / totalQuestions) * 100
        );


    finalScore.textContent =
        `${percentage}%`;


    correctAnswers.textContent =
        score;


    wrongAnswers.textContent =
        totalQuestions - score;


    if (percentage >= 80) {

        resultMessage.textContent =
            "Excellent work! Keep building on it.";

    }

    else if (percentage >= 50) {

        resultMessage.textContent =
            "Good progress. A little more practice will sharpen it.";

    }

    else {

        resultMessage.textContent =
            "Keep learning. Every attempt builds your skill.";

    }


    showScreen(resultScreen);

    const activityNotice = document.getElementById('activityNotice');
    const params = new URLSearchParams(window.location.search);
    const course = selectedCourse || params.get('course') || sessionStorage.getItem('fioSelectedCourse');
    const difficulty = selectedDifficulty || params.get('difficulty') || sessionStorage.getItem('fioSelectedDifficulty');
    if (activityNotice && course && difficulty) {
        activityNotice.textContent = 'Saving your result...';
        fetch('/api/platform/student/activity', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                course,
                difficulty,
                correct: score,
                total: totalQuestions
            })
        })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not save your result.');
                activityNotice.textContent = 'Your result was saved to your learning activity.';
            })
            .catch((error) => {
                console.error('Could not save challenge result:', error);
                activityNotice.textContent = 'Your result could not be saved. Check your connection and try again.';
            });
    }

}


/* =========================================
   RESTART QUIZ
========================================= */

restartBtn.addEventListener(
    "click",
    function() {

        clearInterval(timer);

        currentQuestion = 0;
        score = 0;

        currentQuestions = [];

        selectedLevel = "";
        selectedCategory = "";
        selectedCourse = "";
        selectedDifficulty = "";

        showScreen(setupScreen);


        launchBtn.classList.add(
            "hidden"
        );


        difficultySection.classList.add(
            "hidden"
        );


        if (challengeLengthSection) {

            challengeLengthSection.classList.add(
                "hidden"
            );

        }

        if (independentTeamSection) {
            independentTeamSection.classList.add("hidden");
        }

        if (independentTeamMembers) {
            independentTeamMembers.innerHTML = "";
        }

        document
            .querySelectorAll(
                ".difficulty-btn"
            )
            .forEach(function(button) {

                button.classList.remove(
                    "selected"
                );

            });


        document
            .querySelectorAll(
                ".challenge-length-btn"
            )
            .forEach(function(button) {

                button.classList.remove(
                    "selected"
                );

            });


        document
            .querySelectorAll(
                ".path-card"
            )
            .forEach(function(button) {

                button.classList.remove(
                    "selected"
                );

            });


        document
            .querySelectorAll(
                ".option-btn"
            )
            .forEach(function(button) {

                button.classList.remove(
                    "selected"
                );

            });


        document
            .querySelectorAll(
                ".course-card"
            )
            .forEach(function(button) {

                button.classList.remove(
                    "selected"
                );

            });


        if (courseSearch) {

            courseSearch.value = "";

        }

    }
);

// =========================================
// ASK FIGURE IT OUT
// =========================================

const askScreen = document.getElementById("askScreen");
const askQuestionNavBtn = document.getElementById("askQuestionNavBtn");
const studentQuestion = document.getElementById("studentQuestion");
const askQuestionBtn = document.getElementById("askQuestionBtn");
const clearQuestionBtn = document.getElementById("clearQuestionBtn");

const askLoading = document.getElementById("askLoading");
const answerBox = document.getElementById("answerBox");
const answerText = document.getElementById("answerText");

askQuestionNavBtn.addEventListener("click", function() {
    showScreen(askScreen);
});

// ASK QUESTION
askQuestionBtn.addEventListener("click", async function () {

    const question = studentQuestion.value.trim();

    if (!question) {
        alert("Please type your question first.");
        studentQuestion.focus();
        return;
    }

    answerBox.classList.add("hidden");
    askLoading.classList.remove("hidden");

    askQuestionBtn.disabled = true;

    try {
        const response = await fetch("/api/ask", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "The AI assistant could not answer right now.");
        }

        if (typeof data.answer !== "string" || !data.answer.trim()) {
            throw new Error("The AI assistant returned an empty answer.");
        }

        answerText.textContent = data.answer;
        answerBox.classList.remove("hidden");

    } catch (error) {

        console.error("Ask Figure It Out error:", error);

        answerText.textContent = error.message
            || "Sorry, I couldn't answer that question right now. Please try again.";

        answerBox.classList.remove("hidden");

    } finally {

        askLoading.classList.add("hidden");
        askQuestionBtn.disabled = false;

    }
});


// CLEAR
clearQuestionBtn.addEventListener("click", function () {

    studentQuestion.value = "";

    answerText.textContent = "";

    answerBox.classList.add("hidden");

    studentQuestion.focus();

});