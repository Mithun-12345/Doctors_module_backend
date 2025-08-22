// groqFunctions.js
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Generate feedback questions and a feedback name
 */
export async function generateFeedbackQuestions(
  messengerUseCase,
  feedbackPurpose,
  totalQuestions
) {
  const prompt = `
Generate:
1. A short, clear feedback title (3–6 words) for a messenger use case '${messengerUseCase}'.
   The purpose of this feedback is: '${feedbackPurpose}'.
2. Exactly ${totalQuestions} service-related feedback questions for that use case.

Return the result as valid JSON in the format:
{
  "feedbackName": "short descriptive name",
  "questions": [
    {"question": "..."},
    {"question": "..."}
  ]
}
`;

  try {
    const response = await client.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a feedback generator AI. Generate a short, descriptive feedback name and a set of service-related feedback questions in the exact JSON format requested.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Invalid response format from Groq API");
    }

    const result = JSON.parse(jsonMatch[0]);
    return result;
  } catch (err) {
    throw new Error(`Failed to generate feedback questions: ${err.message}`);
  }
};

export async function regenerateSingleQuestion(
    oldQuestion,
    messengerUseCase,
    feedbackPurpose
  ) {
    const prompt = `
  Regenerate one new feedback question
  for a messenger use case '${messengerUseCase}',
  with the purpose: '${feedbackPurpose}'.
  It should be different from this existing question: '${oldQuestion}'.
  Only return the new question as plain text without quotes or explanation.
  `;
  
    try {
      const response = await client.chat.completions.create({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that rewrites one feedback question based on the given context.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 256,
      });
  
      let newQuestion = response.choices[0]?.message?.content?.trim() || "";
      newQuestion = newQuestion.replace(/^['"“”]+|['"“”]+$/g, "").trim();
      return newQuestion;
    } catch (err) {
      throw new Error(`Failed to regenerate question: ${err.message}`);
    }
  };
  