// Artillery load test processor for generating random test data
module.exports.randomEmail = function (userContext, events, done) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  userContext.vars.randomEmail = `loadtest-${timestamp}-${random}@example.com`;
  return done();
};

module.exports.randomTaskTitle = function (userContext, events, done) {
  const adjectives = ['Important', 'Urgent', 'Critical', 'High Priority', 'Low Priority'];
  const nouns = ['Task', 'Assignment', 'Project', 'Deliverable', 'Milestone'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  userContext.vars.randomTaskTitle = `${randomAdj} ${randomNoun} ${Date.now()}`;
  return done();
};
