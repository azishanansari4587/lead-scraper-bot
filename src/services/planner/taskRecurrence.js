/**
 * Task Recurrence Engine
 * Idempotently computes and schedules recurring task occurrences
 */

const Task = require('../../models/Task');
const logger = require('../../config/logger');

/**
 * Calculates the next due date based on recurrence rule and base date
 * @param {Date|string} baseDate
 * @param {'daily'|'weekly'|'monthly'|'weekdays'} rule
 * @returns {Date}
 */
function calculateNextDueDate(baseDate, rule) {
  const current = baseDate ? new Date(baseDate) : new Date();
  const next = new Date(current.getTime());

  switch (rule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;

    case 'weekdays': {
      // Mon (1) to Fri (5)
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 5) {
        // Friday -> next Monday (+3 days)
        next.setDate(next.getDate() + 3);
      } else if (dayOfWeek === 6) {
        // Saturday -> Monday (+2 days)
        next.setDate(next.getDate() + 2);
      } else {
        // Sun-Thu -> next day (+1 day)
        next.setDate(next.getDate() + 1);
      }
      break;
    }

    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;

    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Handles recurrence creation when a task is marked 'done'
 * @param {Task} task
 * @returns {Promise<Task|null>}
 */
async function handleTaskCompletion(task) {
  if (!task.recurrenceRule || task.recurrenceRule === 'none') {
    return null;
  }

  const parentId = task.recurrenceParentId || task.id;

  // Idempotency check: see if an open recurrence occurrence already exists
  const existingOpen = await Task.findOne({
    where: {
      userId: task.userId,
      recurrenceParentId: parentId,
      status: ['todo', 'doing']
    }
  });

  if (existingOpen) {
    logger.debug({ taskId: task.id, parentId }, 'Open recurring task already exists; skipping duplicate generation');
    return existingOpen;
  }

  const nextDue = calculateNextDueDate(task.dueAt || new Date(), task.recurrenceRule);

  const nextTask = await Task.create({
    userId: task.userId,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    dueAt: nextDue,
    status: 'todo',
    isMIT: false,
    relatedLeadId: task.relatedLeadId,
    recurrenceRule: task.recurrenceRule,
    recurrenceParentId: parentId,
    sortOrder: task.sortOrder
  });

  logger.info(
    { oldTaskId: task.id, newTaskId: nextTask.id, rule: task.recurrenceRule, nextDue },
    'Auto-created next recurring task occurrence'
  );

  return nextTask;
}

module.exports = {
  calculateNextDueDate,
  handleTaskCompletion
};
