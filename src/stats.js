async function getSurveyStats(db, survey) {
  const questions = await db
    .collection("questions")
    .find({ survey_id: survey._id })
    .sort({ order: 1 })
    .toArray();
  const responses = db.collection("responses");
  const totalResponses = await responses.countDocuments({ survey_id: survey._id });

  const result = [];
  for (const question of questions) {
    const match = {
      $match: { "answers.question_id": question._id }
    };
    const base = [
      { $match: { survey_id: survey._id } },
      { $unwind: "$answers" },
      match
    ];
    const item = {
      id: question._id.toString(),
      order: question.order,
      title: question.title,
      type: question.type,
      options: [],
      answered_count: 0,
      average: null,
      min: null,
      max: null,
      values: []
    };

    if (question.type === "single") {
      const counts = await responses
        .aggregate([
          ...base,
          { $group: { _id: "$answers.value", count: { $sum: 1 } } }
        ])
        .toArray();
      const countMap = new Map(counts.map((row) => [row._id, row.count]));
      item.answered_count = counts.reduce((sum, row) => sum + row.count, 0);
      item.options = question.options.map((option) => {
        const count = countMap.get(option.key) || 0;
        return {
          key: option.key,
          text: option.text,
          count,
          percent: item.answered_count
            ? Math.round((count / item.answered_count) * 1000) / 10
            : 0
        };
      });
    }

    if (question.type === "multiple") {
      const counts = await responses
        .aggregate([
          ...base,
          { $unwind: "$answers.value" },
          { $group: { _id: "$answers.value", count: { $sum: 1 } } }
        ])
        .toArray();
      const countMap = new Map(counts.map((row) => [row._id, row.count]));
      const answered = await responses.countDocuments({
        survey_id: survey._id,
        "answers.question_id": question._id
      });
      item.answered_count = answered;
      item.options = question.options.map((option) => {
        const count = countMap.get(option.key) || 0;
        return {
          key: option.key,
          text: option.text,
          count,
          percent: answered ? Math.round((count / answered) * 1000) / 10 : 0
        };
      });
    }

    if (question.type === "number") {
      const rows = await responses
        .aggregate([
          ...base,
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: "$answers.value" },
              min: { $min: "$answers.value" },
              max: { $max: "$answers.value" }
            }
          }
        ])
        .toArray();
      if (rows.length) {
        item.answered_count = rows[0].count;
        item.average = Math.round(rows[0].average * 100) / 100;
        item.min = rows[0].min;
        item.max = rows[0].max;
      }
    }

    if (question.type === "text") {
      const rows = await responses
        .aggregate([
          ...base,
          { $sort: { submitted_at: -1 } },
          {
            $project: {
              _id: 0,
              value: "$answers.value",
              submitted_at: 1
            }
          }
        ])
        .toArray();
      item.answered_count = rows.length;
      item.values = rows;
    }

    result.push(item);
  }

  return { total_responses: totalResponses, questions: result };
}

module.exports = { getSurveyStats };
