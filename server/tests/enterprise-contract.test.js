const test = require('node:test');
const assert = require('node:assert/strict');

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(64);

const Progress = require('../models/Progress');
const Plan = require('../models/Plan');
const User = require('../models/User');
const progressController = require('../controllers/progressController');
const adminController = require('../controllers/adminController');

function queryResult(value) {
  return {
    sort() { return this; },
    limit() { return Promise.resolve(value); },
    lean() { return Promise.resolve(value); },
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('daily weight update preserves existing habits', async () => {
  const originalFindOne = Progress.findOne;
  const originalFindOneAndUpdate = Progress.findOneAndUpdate;
  const originalFind = Progress.find;

  const existing = { habits: { meals: true, water: true, workout: false, sleep: true } };
  const updated = { ...existing, weightKg: 72, habits: existing.habits };

  try {
    Progress.findOne = async () => existing;
    Progress.findOneAndUpdate = async (_filter, update) => {
      assert.equal(update.$set.weightKg, 72);
      assert.deepEqual(update.$set.habits, existing.habits);
      return updated;
    };
    Progress.find = () => queryResult([updated]);

    const res = responseRecorder();
    await progressController.saveTodayProgress({
      user: { _id: 'user-1' },
      body: { date: '2026-08-13', weightKg: 72 },
      app: { locals: {} },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.progress.habits.meals, true);
    assert.equal(res.body.data.progress.habits.water, true);
  } finally {
    Progress.findOne = originalFindOne;
    Progress.findOneAndUpdate = originalFindOneAndUpdate;
    Progress.find = originalFind;
  }
});

test('workout completion rejects exercise IDs outside the current plan', async () => {
  const originalFindOne = Plan.findOne;
  try {
    Plan.findOne = () => ({
      sort() {
        return Promise.resolve({
          workout: {
            weeklySplit: [{
              day: 'Thursday',
              type: 'Strength',
              exercises: [
                { id: 'squat-1', name: 'Squat', sets: 2 },
                { id: 'push-1', name: 'Push Up', sets: 2 },
              ],
            }],
          },
        });
      },
    });

    const res = responseRecorder();
    await progressController.saveWorkoutCompletion({
      user: { _id: 'user-1' },
      body: {
        date: '2026-08-13',
        completedExerciseIds: ['squat-1', 'fake-exercise'],
      },
      app: { locals: {} },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /do not belong/i);
  } finally {
    Plan.findOne = originalFindOne;
  }
});

test('workout completion calculates authoritative exercise and set totals', async () => {
  const originalPlanFindOne = Plan.findOne;
  const originalProgressFindOne = Progress.findOne;
  const originalProgressFindOneAndUpdate = Progress.findOneAndUpdate;
  const originalProgressFind = Progress.find;

  try {
    Plan.findOne = () => ({
      sort() {
        return Promise.resolve({
          workout: {
            weeklySplit: [{
              day: 'Thursday',
              type: 'Strength',
              exercises: [
                { id: 'squat-1', name: 'Squat', sets: 2 },
                { id: 'push-1', name: 'Push Up', sets: 3 },
              ],
            }],
          },
        });
      },
    });
    Progress.findOne = async () => ({ habits: {} });
    Progress.findOneAndUpdate = async (_filter, update) => ({
      ...update.$set,
      habits: { meals: false, water: false, workout: true, sleep: false },
    });
    Progress.find = () => queryResult([{ completedDay: false, date: new Date() }]);

    const res = responseRecorder();
    await progressController.saveWorkoutCompletion({
      user: { _id: 'user-1' },
      body: {
        date: '2026-08-13',
        completedExerciseIds: ['squat-1', 'push-1'],
        totalExercises: 999,
        totalSets: 999,
      },
      app: { locals: {} },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.progress.workoutSession.totalExercises, 2);
    assert.equal(res.body.data.progress.workoutSession.totalSets, 5);
    assert.equal(res.body.data.progress.workoutSession.completedSets, 5);
  } finally {
    Plan.findOne = originalPlanFindOne;
    Progress.findOne = originalProgressFindOne;
    Progress.findOneAndUpdate = originalProgressFindOneAndUpdate;
    Progress.find = originalProgressFind;
  }
});

test('admin cannot deactivate the last active administrator', async () => {
  const originalFindById = User.findById;
  const originalCountDocuments = User.countDocuments;

  try {
    User.findById = () => ({
      select() {
        return Promise.resolve({
          _id: 'admin-1',
          role: 'admin',
          isActive: true,
          accountStatus: 'active',
          save: async () => {},
        });
      },
    });
    User.countDocuments = async () => 1;

    const res = responseRecorder();
    await adminController.updateUser({
      params: { id: 'admin-1' },
      body: { accountStatus: 'inactive' },
      user: { _id: 'admin-actor' },
    }, res);

    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /last active administrator/i);
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
  }
});


test('profile name and email updates persist to the authenticated user', async () => {
  const originalFindOne = User.findOne;
  const user = {
    _id: 'user-1',
    name: 'Old Name',
    email: 'old@example.com',
    profile: {},
    save: async function () { this.saved = true; },
  };

  try {
    User.findOne = () => ({
      select() { return Promise.resolve(null); },
    });

    const res = responseRecorder();
    await require('../controllers/authController').updateProfile({
      user,
      body: {
        name: 'New Name',
        email: 'new@example.com',
        profile: { goal: 'weight-loss' },
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(user.name, 'New Name');
    assert.equal(user.email, 'new@example.com');
    assert.equal(user.profile.goal, 'weight-loss');
    assert.equal(user.saved, true);
    assert.equal(res.body.data.user.email, 'new@example.com');
  } finally {
    User.findOne = originalFindOne;
  }
});

test('AI plan moderation persists status without changing the plan generation status', async () => {
  const originalFindByIdAndUpdate = Plan.findByIdAndUpdate;
  const originalAdminCreate = require('../models/AdminLog').create;
  const updatedPlan = {
    _id: 'plan-1',
    user: 'user-1',
    status: 'AI Generated',
    moderationStatus: 'Approved',
  };

  try {
    Plan.findByIdAndUpdate = async (_id, update) => {
      assert.equal(update.moderationStatus, 'Approved');
      assert.equal(update.moderatedBy, 'admin-1');
      assert.ok(update.moderatedAt instanceof Date);
      assert.equal(Object.prototype.hasOwnProperty.call(update, 'status'), false);
      return updatedPlan;
    };
    require('../models/AdminLog').create = async () => ({});

    const res = responseRecorder();
    await adminController.updateAIOutputStatus({
      params: { id: 'plan-1' },
      body: { type: 'Diet Plan', status: 'Approved' },
      user: { _id: 'admin-1' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.item.moderationStatus, 'Approved');
    assert.equal(res.body.data.item.status, 'AI Generated');
  } finally {
    Plan.findByIdAndUpdate = originalFindByIdAndUpdate;
    require('../models/AdminLog').create = originalAdminCreate;
  }
});


test('nutrition totals are calculated from the saved plan, not client-supplied totals', async () => {
  const originalPlanFindOne = Plan.findOne;
  const originalProgressFindOne = Progress.findOne;
  const originalProgressFindOneAndUpdate = Progress.findOneAndUpdate;
  const originalProgressFind = Progress.find;

  try {
    Plan.findOne = () => ({
      sort() {
        return {
          lean: async () => ({
            meals: [
              { name: 'Breakfast', calories: 400, protein: 30, carbs: 45, fat: 10 },
              { name: 'Lunch', calories: 600, protein: 45, carbs: 60, fat: 18 },
            ],
          }),
        };
      },
    });
    Progress.findOne = async () => ({ habits: { workout: true } });
    Progress.findOneAndUpdate = async (_filter, update) => update.$set;
    Progress.find = () => queryResult([{ completedDay: false, date: new Date() }]);

    const res = responseRecorder();
    await progressController.saveTodayNutrition({
      user: { _id: 'user-1' },
      body: {
        date: '2026-08-13',
        completedMealIds: ['0'],
        caloriesConsumed: 99999,
        proteinConsumed: 99999,
        carbsConsumed: 99999,
        fatConsumed: 99999,
        waterLiters: 2,
      },
      app: { locals: {} },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.progress.nutrition.caloriesConsumed, 400);
    assert.equal(res.body.data.progress.nutrition.proteinConsumed, 30);
    assert.equal(res.body.data.progress.nutrition.carbsConsumed, 45);
    assert.equal(res.body.data.progress.nutrition.fatConsumed, 10);
  } finally {
    Plan.findOne = originalPlanFindOne;
    Progress.findOne = originalProgressFindOne;
    Progress.findOneAndUpdate = originalProgressFindOneAndUpdate;
    Progress.find = originalProgressFind;
  }
});
