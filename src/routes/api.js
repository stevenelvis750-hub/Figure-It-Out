const express = require('express');
const {
  listSubjects,
  getQuestionInventory,
  getQuestionsForCourse,
  generateChallenge,
  normalizeDifficulty
} = require('../services/questionService');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Question maker backend is running.',
    timestamp: new Date().toISOString()
  });
});

router.post('/ask', async (req, res) => {
  const question = typeof req.body?.question === 'string'
    ? req.body.question.trim()
    : '';

  if (!question) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a question.'
    });
  }

  if (question.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Questions must be 2,000 characters or fewer.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: 'The AI assistant is not configured. Set GEMINI_API_KEY on the server.'
    });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You are Figure It Out, a friendly educational assistant. Answer the learner clearly and accurately, use age-appropriate language, and explain concepts step by step when helpful. If you are unsure, say so.'
            }]
          },
          contents: [{
            role: 'user',
            parts: [{ text: question }]
          }],
          generationConfig: {
            maxOutputTokens: 1024
          }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `Gemini API returned HTTP ${response.status}:`,
        data.error?.message || 'No error message provided.'
      );
      return res.status(502).json({
        success: false,
        error: 'The AI provider could not answer right now. Check the Gemini API key and try again.'
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      return res.status(502).json({
        success: false,
        error: 'The AI provider returned an empty answer. Please try again.'
      });
    }

    return res.json({ success: true, answer });
  } catch (error) {
    console.error('Error contacting Gemini API:', error);
    return res.status(502).json({
      success: false,
      error: 'Could not reach the AI provider. Check your connection and try again.'
    });
  }
});

router.get('/subjects', (req, res) => {
  try {
    const subjects = listSubjects();
    res.json({
      success: true,
      count: subjects.length,
      subjects
    });
  } catch (error) {
    console.error('Error while listing subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load subject list.'
    });
  }
});

router.get('/questions/:course', (req, res) => {
  try {
    const course = decodeURIComponent(req.params.course);
    const difficulty = req.query.difficulty || 'all';
    const limit = Number(req.query.limit || 0);

    const inventory = getQuestionInventory(course);
    const allQuestions = Array.isArray(inventory)
      ? inventory
      : Array.isArray(inventory?.questions)
        ? inventory.questions
        : [];

    const filteredQuestions = difficulty === 'all'
      ? allQuestions
      : allQuestions.filter(question => normalizeDifficulty(question.difficulty) === normalizeDifficulty(difficulty));

    const questions = limit > 0 ? filteredQuestions.slice(0, limit) : filteredQuestions;

    res.json({
      success: true,
      course: String(course),
      difficulty: difficulty === 'all' ? 'all' : normalizeDifficulty(difficulty),
      total: filteredQuestions.length,
      questions
    });
  } catch (error) {
    console.error('Error loading course question data:', error);
    res.status(500).json({
      success: false,
      message: 'Could not load the requested questions.'
    });
  }
});

router.post('/challenge', (req, res) => {
  try {
    const { course, difficulty, length } = req.body || {};

    if (!course || !String(course).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Course is required to generate a challenge.'
      });
    }

    const challenge = generateChallenge(course, difficulty || 'easy', length || 10);

    return res.json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Error generating challenge:', error);
    return res.status(500).json({
      success: false,
      message: 'Challenge generation failed.'
    });
  }
});

router.get('/course/:course', (req, res) => {
  const course = decodeURIComponent(req.params.course);

  try {
    const inventory = getQuestionInventory(course);
    const allQuestions = Array.isArray(inventory)
      ? inventory
      : Array.isArray(inventory?.questions)
        ? inventory.questions
        : [];

    res.json({
      success: true,
      course: String(course),
      totalQuestions: allQuestions.length,
      questions: allQuestions
    });
  } catch (error) {
    console.error('Error fetching course summary:', error);
    res.status(500).json({
      success: false,
      message: 'Could not fetch course summary.'
    });
  }
});

router.get('/questions', (req, res) => {
  try {
    const { course, difficulty, limit } = req.query;

    if (!course || !String(course).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A course name is required.'
      });
    }

    const questions = getQuestionsForCourse(course, difficulty || 'all', Number(limit) || 0);

    return res.json({
      success: true,
      course: String(course),
      difficulty: difficulty ? normalizeDifficulty(difficulty) : 'all',
      total: questions.length,
      questions
    });
  } catch (error) {
    console.error('Error fetching question list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch the requested question list.'
    });
  }
});

module.exports = router;
