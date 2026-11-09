const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const questionsDir = path.join(projectRoot, 'Questions');
const supportedExtensions = ['.json', '.js'];

function normalizeDifficulty(value) {
    const difficulty = String(value || 'easy').trim().toLowerCase();

    if (['easy', 'e', 'beginner'].includes(difficulty)) return 'easy';
    if (['medium', 'm', 'intermediate'].includes(difficulty)) return 'medium';
    if (['hard', 'h', 'advanced', 'difficult'].includes(difficulty)) {
        return 'hard';
    }

    return difficulty;
}

function normalizeName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getQuestionFiles() {
    if (!fs.existsSync(questionsDir)) {
        console.error('Questions folder not found:', questionsDir);
        return [];
    }

    return fs.readdirSync(questionsDir, { withFileTypes: true })
        .filter(item => item.isFile())
        .filter(item => supportedExtensions.includes(path.extname(item.name).toLowerCase()))
        .filter(item => !['script.js', 'index.js'].includes(item.name.toLowerCase()))
        .map(item => path.join(questionsDir, item.name));
}

function readFileData(filePath) {
    try {
        const extension = path.extname(filePath).toLowerCase();

        if (extension === '.json') {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        if (extension === '.js') {
            const resolvedPath = require.resolve(filePath);

            delete require.cache[resolvedPath];

            return require(resolvedPath);
        }
    } catch (error) {
        console.error(`Could not read ${path.basename(filePath)}:`, error.message);
    }

    return null;
}

function collectQuestions(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (!data || typeof data !== 'object') {
        return [];
    }

    if (Array.isArray(data.questions)) {
        return data.questions;
    }

    if (Array.isArray(data.default)) {
        return data.default;
    }

    if (Array.isArray(data.questionBank)) {
        return data.questionBank;
    }

    return [];
}

function normalizeQuestion(question, course) {
    if (!question || typeof question !== 'object') {
        return null;
    }

    const questionText = String(question.question || '').trim();

    if (!questionText || !Array.isArray(question.options)) {
        return null;
    }

    const options = question.options
        .map(option => String(option).trim())
        .filter(Boolean);

    const uniqueOptions = [...new Set(options)];

    if (uniqueOptions.length < 2) {
        return null;
    }

    const answer = String(question.answer || '').trim();

    const matchingAnswer = uniqueOptions.find(
        option => option.toLowerCase() === answer.toLowerCase()
    );

    if (!matchingAnswer) {
        return null;
    }

    return {
        id: question.id || `${normalizeName(course)}-${Math.random().toString(36).slice(2, 10)}`,
        course,
        question: questionText,
        options: uniqueOptions,
        answer: matchingAnswer,
        difficulty: normalizeDifficulty(question.difficulty),
        explanation: question.explanation || ''
    };
}

function getQuestionInventory(course) {
    const requestedCourse = normalizeName(course);
    const files = getQuestionFiles();

    const matchingFiles = files.filter(file => {
        const fileName = normalizeName(path.basename(file, path.extname(file)));
        return fileName === requestedCourse;
    });

    const allQuestions = [];

    for (const file of matchingFiles) {
        const data = readFileData(file);
        const questions = collectQuestions(data);

        for (const question of questions) {
            const normalized = normalizeQuestion(question, course);

            if (normalized) {
                allQuestions.push(normalized);
            }
        }
    }

    return allQuestions;
}

function listSubjects() {
    return getQuestionFiles()
        .map(file => path.basename(file, path.extname(file)))
        .filter(name => !['script', 'index'].includes(name.toLowerCase()))
        .filter((name, index, all) =>
            all.findIndex(item => normalizeName(item) === normalizeName(name)) === index
        )
        .sort();
}

function shuffleQuestions(questions) {
    const shuffled = [...questions];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

function getQuestionsForCourse(course, difficulty = 'all', limit = 750) {
    const inventory = getQuestionInventory(course);

    const selectedDifficulty = String(difficulty || 'all').toLowerCase();

    const filtered = selectedDifficulty === 'all'
        ? inventory
        : inventory.filter(question =>
            question.difficulty === normalizeDifficulty(selectedDifficulty)
        );

    const safeLimit = Math.max(1, Math.min(Number(limit) || 750, 1000));

    return shuffleQuestions(filtered).slice(0, safeLimit);
}

function generateChallenge(course, difficulty = 'all', limit = 10) {
    const questions = getQuestionsForCourse(course, difficulty, limit);

    return {
        success: questions.length > 0,
        course,
        difficulty,
        total: questions.length,
        questions
    };
}

module.exports = {
    listSubjects,
    getQuestionInventory,
    getQuestionsForCourse,
    generateChallenge,
    normalizeDifficulty
};
