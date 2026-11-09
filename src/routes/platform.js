'use strict';

const express = require('express');
const {
  databaseError,
  databaseRequest,
  requireRole,
  requireUser
} = require('../services/platformStore');

const router = express.Router();

function isDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function matchesTarget(assignment, student) {
  return (!assignment.stream || assignment.stream.toLocaleLowerCase() === student.stream.toLocaleLowerCase())
    && (!assignment.class_name || assignment.class_name.toLocaleLowerCase() === student.className.toLocaleLowerCase());
}

async function getRows(config, table, filters) {
  const query = new URLSearchParams(filters);
  const { response, data } = await databaseRequest(config, `${table}?${query}`);
  if (!response.ok) throw new Error(databaseError(data));
  return Array.isArray(data) ? data : [];
}

router.get('/student/dashboard', requireUser, requireRole('student'), async (req, res) => {
  try {
    const [assignments, activity] = await Promise.all([
      getRows(req.supabaseConfig, 'assignments', {
        select: 'id,title,subject,difficulty,question_count,due_date,stream,class_name,created_at',
        school_id: `eq.${req.platformUser.schoolId}`,
        order: 'due_date.asc,created_at.desc',
        limit: '1000'
      }),
      getRows(req.supabaseConfig, 'learning_activity', {
        select: 'id,assignment_id,course,difficulty,correct_answers,total_questions,completed_at',
        student_id: `eq.${req.platformUser.id}`,
        order: 'completed_at.desc',
        limit: '20'
      })
    ]);

    const visibleAssignments = assignments
      .filter(assignment => matchesTarget(assignment, req.platformUser))
      .map(assignment => ({
        ...assignment,
        completed: activity.some(item => item.assignment_id === assignment.id)
      }));
    return res.json({
      success: true,
      user: req.platformUser,
      assignments: visibleAssignments,
      activity
    });
  } catch (error) {
    console.error('Could not load student school data:', error);
    return res.status(503).json({
      success: false,
      error: `Could not load your school work. ${error.message}`
    });
  }
});

router.get('/teacher/dashboard', requireUser, requireRole('teacher'), async (req, res) => {
  try {
    const schoolFilter = `eq.${req.platformUser.schoolId}`;
    const [schoolRows, students, assignments, activity] = await Promise.all([
      getRows(req.supabaseConfig, 'schools', {
        select: 'id,name,join_code',
        id: schoolFilter,
        limit: '1'
      }),
      getRows(req.supabaseConfig, 'profiles', {
        select: 'id,email,full_name,stream,class_name,created_at',
        school_id: schoolFilter,
        role: 'eq.student',
        order: 'class_name.asc,stream.asc,full_name.asc',
        limit: '1000'
      }),
      getRows(req.supabaseConfig, 'assignments', {
        select: 'id,title,subject,difficulty,question_count,due_date,stream,class_name,created_at',
        school_id: schoolFilter,
        order: 'created_at.desc',
        limit: '500'
      }),
      getRows(req.supabaseConfig, 'learning_activity', {
        select: 'id,student_id,assignment_id,course,difficulty,correct_answers,total_questions,completed_at,profiles(full_name,stream,class_name)',
        school_id: schoolFilter,
        order: 'completed_at.desc',
        limit: '50'
      })
    ]);
    const submissions = new Map();
    for (const item of activity) {
      if (!item.assignment_id) continue;
      submissions.set(item.assignment_id, (submissions.get(item.assignment_id) || 0) + 1);
    }

    return res.json({
      success: true,
      user: req.platformUser,
      school: schoolRows[0] || {
        id: req.platformUser.schoolId,
        name: req.platformUser.school,
        join_code: req.platformUser.schoolCode
      },
      students,
      assignments: assignments.map(assignment => ({
        ...assignment,
        submitted: submissions.get(assignment.id) || 0
      })),
      activity
    });
  } catch (error) {
    console.error('Could not load teacher school data:', error);
    return res.status(503).json({
      success: false,
      error: `Could not load your school dashboard. ${error.message}`
    });
  }
});

router.post('/assignments', requireUser, requireRole('teacher'), async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const difficulty = req.body?.difficulty;
  const questionCount = Number(req.body?.questionCount);
  const dueDate = req.body?.dueDate;
  const stream = typeof req.body?.stream === 'string' ? req.body.stream.trim() : '';
  const className = typeof req.body?.className === 'string' ? req.body.className.trim() : '';

  if (title.length < 2 || title.length > 120 || subject.length < 1 || subject.length > 120) {
    return res.status(400).json({ success: false, error: 'Enter an assignment title and subject.' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({ success: false, error: 'Choose a valid difficulty.' });
  }
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 250) {
    return res.status(400).json({ success: false, error: 'Choose between 1 and 250 questions.' });
  }
  if (!isDate(dueDate)) {
    return res.status(400).json({ success: false, error: 'Choose a valid assignment due date.' });
  }
  if (stream.length > 80 || className.length > 80) {
    return res.status(400).json({ success: false, error: 'Stream and class names must be 80 characters or fewer.' });
  }

  try {
    const { response, data } = await databaseRequest(req.supabaseConfig, 'assignments', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        school_id: req.platformUser.schoolId,
        teacher_id: req.platformUser.id,
        title,
        subject,
        difficulty,
        question_count: questionCount,
        due_date: dueDate,
        stream: stream || null,
        class_name: className || null
      }
    });
    if (!response.ok) {
      return res.status(503).json({
        success: false,
        error: `Could not create the assignment. ${databaseError(data)}`
      });
    }
    return res.status(201).json({ success: true, assignment: data[0] });
  } catch (error) {
    console.error('Assignment creation failed:', error);
    return res.status(503).json({ success: false, error: 'Could not save this assignment. Please try again.' });
  }
});

router.post('/activity', requireUser, requireRole('student'), async (req, res) => {
  const course = typeof req.body?.course === 'string' ? req.body.course.trim() : '';
  const difficulty = req.body?.difficulty;
  const correctAnswers = Number(req.body?.correctAnswers);
  const totalQuestions = Number(req.body?.totalQuestions);
  const assignmentId = typeof req.body?.assignmentId === 'string' ? req.body.assignmentId : '';

  if (!course || course.length > 120
    || !['easy', 'medium', 'hard'].includes(difficulty)
    || !Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 250
    || !Number.isInteger(correctAnswers) || correctAnswers < 0 || correctAnswers > totalQuestions) {
    return res.status(400).json({ success: false, error: 'The quiz result is incomplete or invalid.' });
  }

  try {
    if (assignmentId) {
      const assignmentQuery = new URLSearchParams({
        select: 'id,school_id,subject,difficulty,question_count,stream,class_name',
        id: `eq.${assignmentId}`,
        school_id: `eq.${req.platformUser.schoolId}`,
        limit: '1'
      });
      const { response, data } = await databaseRequest(req.supabaseConfig, `assignments?${assignmentQuery}`);
      if (!response.ok) {
        return res.status(503).json({ success: false, error: databaseError(data) });
      }
      const assignment = data[0];
      if (!assignment || !matchesTarget(assignment, req.platformUser)) {
        return res.status(404).json({ success: false, error: 'That assignment is not available to your class.' });
      }
      if (
        assignment.subject.toLocaleLowerCase() !== course.toLocaleLowerCase()
        || assignment.difficulty !== difficulty
        || assignment.question_count !== totalQuestions
      ) {
        return res.status(400).json({ success: false, error: 'This result does not match the assigned quiz.' });
      }
    }

    const { response, data } = await databaseRequest(req.supabaseConfig, 'learning_activity', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        student_id: req.platformUser.id,
        school_id: req.platformUser.schoolId,
        assignment_id: assignmentId || null,
        course,
        difficulty,
        correct_answers: correctAnswers,
        total_questions: totalQuestions
      }
    });
    if (!response.ok) {
      return res.status(503).json({
        success: false,
        error: `Could not record this learning activity. ${databaseError(data)}`
      });
    }
    return res.status(201).json({ success: true, activity: data[0] });
  } catch (error) {
    console.error('Could not save student learning activity:', error);
    return res.status(503).json({ success: false, error: 'Could not record this quiz. Please try again.' });
  }
});

module.exports = router;
