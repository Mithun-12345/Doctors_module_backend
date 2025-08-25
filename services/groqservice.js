const Groq = require("groq-sdk");
const {
  sendChronicForm,
  bookAppointment,
  getPayments,
} = require("../controllers/patientController");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ----------------------
// Analyze message using Groq LLM
// ----------------------
async function analyzePatientMessage(message) {
  const prompt = `
You are a medical AI assistant analyzing patient symptoms.
Analyze the patient message and return ONLY JSON in this exact format:
{
  "intent": "symptom_check" | "book_appointment" | "payment" | "prescription" | "general_query",
  "classification": "acute" | "chronic" | "none",
  "symptom": "primary symptom or condition extracted in 1-3 words (e.g., 'fever', 'cold and cough')",
  "details": "detailed medical assessment of the symptoms described"
}

Classification guidelines:
- "acute": Sudden onset, severe symptoms, recent development (fever, severe pain, breathing issues, chest pain, severe headache, etc.)
- "chronic": Long-term, persistent, ongoing symptoms (diabetes, arthritis, back pain lasting weeks/months, etc.)
- "none": Not symptom-related or unclear symptoms

The output must be valid JSON without any additional text, markdown, or formatting.

Patient message: "${message}"
`;

  let rawContent = ""; // Declare rawContent variable

  try {
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // Using a valid Groq model
      messages: [
        {
          role: "system",
          content:
            "You are a medical AI assistant that analyzes patient symptoms and returns only valid JSON responses.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    rawContent = completion.choices[0].message.content.trim();

    // Clean up the response - remove markdown formatting if present
    if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/```(json)?/g, "").trim();
    }

    // Remove any extra text before or after JSON
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawContent = jsonMatch[0];
    }

    console.log("🔍 Groq raw response:", rawContent);

    const parsed = JSON.parse(rawContent);

    // Validate the response structure
    if (!parsed.intent || !parsed.classification || !parsed.details) {
      throw new Error("Invalid response structure");
    }

    console.log("✅ Groq analysis successful:", parsed);
    return parsed;
  } catch (err) {
    console.error("❌ Groq analysis error:", err);
    console.error("Raw content:", rawContent);

    // Enhanced fallback with basic keyword analysis
    const lowerMessage = message.toLowerCase();
    let classification = "none";
    let details =
      "Unable to analyze symptoms automatically. Please describe your symptoms to your doctor directly.";

    // Basic keyword-based classification as fallback
    const acuteKeywords = [
      "fever",
      "severe pain",
      "chest pain",
      "breathing",
      "emergency",
      "urgent",
      "sudden",
      "acute",
      "bleeding",
      "vomiting",
      "dizzy",
    ];
    const chronicKeywords = [
      "diabetes",
      "arthritis",
      "chronic",
      "ongoing",
      "months",
      "years",
      "persistent",
      "recurring",
    ];

    if (acuteKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      classification = "acute";
      details =
        "Based on keywords, this appears to be an acute condition that may need immediate attention.";
    } else if (
      chronicKeywords.some((keyword) => lowerMessage.includes(keyword))
    ) {
      classification = "chronic";
      details =
        "Based on keywords, this appears to be a chronic condition requiring ongoing management.";
    }

    return {
      intent: "symptom_check",
      classification,
      details,
    };
  }
}

// ----------------------
// Conversational fallback
// ----------------------
async function conversationalFallback(userMessage) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly, professional hospital AI assistant. Provide helpful, empathetic responses to patient queries. Keep responses concise and direct patients to appropriate care when needed.",
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("Groq conversational fallback error:", err);
    return "I'm here to help with your healthcare needs. Could you please tell me more about your concern so I can assist you better?";
  }
}

// ----------------------
// Trigger actions based on intent or fallback
// ----------------------
async function triggerActionFromIntent(analysis, messageData, io) {
  const { intent, classification, details } = analysis;
  let actionTriggered = true;

  console.log(
    `🤖 Processing intent: ${intent}, classification: ${classification}`
  );

  switch (intent) {
    case "symptom_check":
      if (classification === "acute") {
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `🚨 **ACUTE SYMPTOMS DETECTED**\n\nYour symptoms appear to require immediate medical attention. I'm notifying your doctor right away.\n\n**Assessment:** ${details}\n\nWould you like me to book an urgent appointment?`,
          timestamp: new Date(),
          messageType: "bot",
        });
      } else if (classification === "chronic") {
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `⏰ **CHRONIC CONDITION IDENTIFIED**\n\nYour symptoms suggest a chronic condition that needs ongoing management.\n\n**Assessment:** ${details}\n\nI'll prepare a chronic condition form for you to fill out before scheduling your appointment.`,
          timestamp: new Date(),
          messageType: "bot",
        });

        // Send chronic form
        try {
          await sendChronicForm({
            body: { patientId: messageData.sender, symptoms: details },
          });
        } catch (error) {
          console.error("Error sending chronic form:", error);
        }
      } else {
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `🩺 **SYMPTOM REVIEW**\n\n${details}\n\nI recommend discussing these symptoms with your doctor. Would you like me to schedule an appointment?`,
          timestamp: new Date(),
          messageType: "bot",
        });
      }
      break;

    case "book_appointment":
      try {
        await bookAppointment({
          body: {
            patientId: messageData.sender,
            doctorId: messageData.receiver || "auto-assigned",
            date: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
            urgency: analysis.classification === "acute" ? "urgent" : "normal",
          },
        });

        const urgencyNote =
          analysis.classification === "acute"
            ? " (URGENT - due to acute symptoms)"
            : "";

        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `✅ **APPOINTMENT BOOKED**\n\nYour appointment has been scheduled for tomorrow${urgencyNote}.\n\nYou'll receive a confirmation email shortly with all the details.`,
          timestamp: new Date(),
          messageType: "bot",
        });
      } catch (error) {
        console.error("Error booking appointment:", error);
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `❌ I encountered an issue booking your appointment. Please contact our support team or try again later.`,
          timestamp: new Date(),
          messageType: "bot",
        });
      }
      break;

    case "payment":
      try {
        const paymentData = await getPayments({
          user: { id: messageData.sender },
        });
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `💳 **PAYMENT INFORMATION**\n\nHere are your payment details:\n${JSON.stringify(
            paymentData,
            null,
            2
          )}`,
          timestamp: new Date(),
          messageType: "bot",
        });
      } catch (error) {
        console.error("Error fetching payments:", error);
        io.to(`user_${messageData.sender}`).emit("receiveMessage", {
          sender: "ai_bot",
          senderName: "AI Assistant",
          message: `❌ I couldn't retrieve your payment information right now. Please try again later or contact support.`,
          timestamp: new Date(),
          messageType: "bot",
        });
      }
      break;

    case "prescription":
      io.to(`user_${messageData.sender}`).emit("receiveMessage", {
        sender: "ai_bot",
        senderName: "AI Assistant",
        message: `💊 **PRESCRIPTION REQUEST NOTED**\n\nI've recorded your prescription request. Your doctor will review it and prepare your prescription shortly.\n\nYou'll be notified once it's ready for pickup.`,
        timestamp: new Date(),
        messageType: "bot",
      });
      break;

    default:
      actionTriggered = false;
  }

  // ----------------------
  // Fallback if no action triggered
  // ----------------------
  if (!actionTriggered) {
    console.log(
      `⚠️ No action triggered for intent: ${intent} — using conversational fallback`
    );
    const fallbackResponse = await conversationalFallback(messageData.message);

    io.to(`user_${messageData.sender}`).emit("receiveMessage", {
      sender: "ai_bot",
      senderName: "AI Assistant",
      message: fallbackResponse,
      timestamp: new Date(),
      messageType: "bot",
    });
  }

  return actionTriggered;
}

// ----------------------
// Test function for debugging
// ----------------------
async function testAnalysis(message) {
  console.log(`🧪 Testing analysis for: "${message}"`);
  try {
    const result = await analyzePatientMessage(message);
    console.log("✅ Test result:", result);
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error);
    return null;
  }
}

module.exports = {
  analyzePatientMessage,
  triggerActionFromIntent,
  conversationalFallback,
  testAnalysis,
};