module.exports = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  dbName: process.env.MONGODB_DB || "survey_system",
  sessionSecret: process.env.SESSION_SECRET || "survey-system-course-project",
  publicOrigin: process.env.PUBLIC_ORIGIN || ""
};
